import { useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, Eye, Link2, Play, Send, ShieldCheck, Sparkles } from 'lucide-react';
import QueryClarificationCard, { type QueryClarificationData } from '../chat/QueryClarificationCard';
import type { AttachmentSelection } from '../chat/DataPickerModal';
import StepOutputView from '../concierge-workflow-builder/StepOutputView';
import type { RunResult, WorkflowDraft } from '../concierge-workflow-builder/types';
import type { EditChatMessage, WorkflowPlanCard } from './types';

interface Props {
  messages: EditChatMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
  onBack?: () => void;
  onConfirmProceed: () => void;
  onViewWorkspace: () => void;
  onValidateWorkflow?: () => void;
  onViewPreview?: () => void;
  // Inline validate-step clarification — now the shared chat Q&A card.
  clarify?: {
    data: QueryClarificationData;
    onSetAnswer: (qi: number, ans: string[]) => void;
    onSubmit: () => void;
    onCancel: () => void;
    onAttach: () => void;
    attachedSources: AttachmentSelection[];
    files: File[];
    onRemoveSource: (i: number) => void;
    onRemoveFile: (i: number) => void;
  } | null;
  // For rendering the AI Summary block inside an IRA bubble when
  // `msg.outputSummary` is set.
  draft?: WorkflowDraft;
  editResult?: RunResult | null;
  onSaveEdits?: () => void;
  editsSaved?: boolean;
}

export default function EditChatPanel({
  messages,
  input,
  setInput,
  onSend,
  onBack,
  onConfirmProceed,
  onViewWorkspace,
  onValidateWorkflow,
  onViewPreview,
  clarify,
  draft,
  editResult,
  onSaveEdits,
  editsSaved,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  return (
    <aside className="flex flex-col h-full bg-canvas-elevated border-r border-canvas-border min-h-0">
      {/* Header — slim back-link only, matching the AI Concierge builder pattern */}
      {onBack && (
        <div className="px-4 pt-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-500 hover:text-brand-600 transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            Back to Workflow
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            msg={m}
            onConfirmProceed={onConfirmProceed}
            onViewWorkspace={onViewWorkspace}
            onValidateWorkflow={onValidateWorkflow}
            onViewPreview={onViewPreview}
            draft={draft}
            editResult={editResult}
            onSaveEdits={onSaveEdits}
            editsSaved={editsSaved}
          />
        ))}

        {clarify && (
          <QueryClarificationCard
            data={clarify.data}
            onSetAnswer={clarify.onSetAnswer}
            onSubmit={clarify.onSubmit}
            onCancel={clarify.onCancel}
            onAttach={clarify.onAttach}
            attachedSources={clarify.attachedSources}
            files={clarify.files}
            onRemoveSource={clarify.onRemoveSource}
            onRemoveFile={clarify.onRemoveFile}
          />
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-canvas-border shrink-0">
        <div className="rounded-xl border border-canvas-border bg-canvas px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Describe what you need…"
            className="w-full bg-transparent resize-none text-[0.75rem] text-ink-800 placeholder:text-ink-400 focus:outline-none"
          />
          <div className="flex items-center justify-end pt-1.5">
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className={[
                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                input.trim()
                  ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                  : 'bg-canvas-border text-ink-400 cursor-not-allowed',
              ].join(' ')}
              aria-label="Send"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ChatBubble({
  msg,
  onConfirmProceed,
  onViewWorkspace,
  onValidateWorkflow,
  onViewPreview,
  draft,
  editResult,
  onSaveEdits,
  editsSaved,
}: {
  msg: EditChatMessage;
  onConfirmProceed: () => void;
  onViewWorkspace: () => void;
  onValidateWorkflow?: () => void;
  onViewPreview?: () => void;
  draft?: WorkflowDraft;
  editResult?: RunResult | null;
  onSaveEdits?: () => void;
  editsSaved?: boolean;
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] px-3 py-2 rounded-2xl rounded-br-md bg-brand-50 border border-brand-200 text-ink-800 text-[0.8125rem] leading-relaxed break-words">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 font-mono text-[0.75rem] text-ink-400 uppercase tracking-[0.14em]">
        Ira
      </div>
      <div className="space-y-2">
        {msg.text && (
          <div className="text-[0.75rem] leading-[1.65] text-ink-800 break-words">
            {renderRich(msg.text)}
          </div>
        )}

        {msg.linkedSources && msg.linkedSources.length > 0 && (
          <ul className="space-y-1">
            {msg.linkedSources.map((l, i) => (
              <li key={i} className="flex items-center gap-2 text-[0.75rem] text-ink-700">
                <Link2 size={11} className="text-brand-500 shrink-0" />
                <span>
                  Linked <strong className="font-semibold text-ink-900">{l.source}</strong>
                  <span className="mx-1.5 text-ink-400">→</span>
                  <strong className="font-semibold text-ink-900">{l.target}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}

        {msg.mappings && msg.mappings.length > 0 && (
          <div className="space-y-2">
            {msg.mappings.map((mp, i) => (
              <div
                key={i}
                className="rounded-xl border border-canvas-border bg-white px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="text-[0.75rem] font-semibold text-ink-900 truncate">
                      {mp.name}
                    </span>
                    <span className="text-ink-300">←</span>
                    <span className="text-[0.75rem] text-ink-500 truncate">{mp.from}</span>
                  </div>
                  <span className="text-[0.75rem] font-semibold text-ink-400 tabular-nums shrink-0">
                    {mp.cols.length} of {mp.ofTotal} cols
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {mp.cols.map((c) => (
                    <span
                      key={c}
                      className="text-[0.6875rem] font-medium px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {msg.workflowPlan && <WorkflowPlanBlock plan={msg.workflowPlan} />}

        {msg.outputSummary && draft && editResult && (
          <StepOutputView
            workflow={draft}
            result={editResult}
            running={false}
            onSave={onSaveEdits}
            saved={editsSaved}
            saveLabel="Save edits"
            savedLabel="Edits saved"
          />
        )}

        {(msg.showConfirmProceed ||
          msg.showViewWorkspace ||
          msg.showValidateWorkflow ||
          msg.showViewPreview) && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            {msg.showConfirmProceed ? (
              <button
                type="button"
                onClick={onConfirmProceed}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] font-semibold px-3.5 py-2 transition-colors cursor-pointer"
              >
                <ShieldCheck size={13} />
                Confirm &amp; Proceed
              </button>
            ) : msg.showValidateWorkflow ? (
              <button
                type="button"
                onClick={onValidateWorkflow}
                className="inline-flex items-center gap-1.5 rounded-xl text-white text-[0.75rem] font-semibold px-3.5 py-2 transition-opacity cursor-pointer hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #6a12cd 0%, #8b5cf6 100%)',
                  boxShadow: '0 1px 3px rgba(106,18,205,0.3)',
                }}
              >
                <Play size={13} />
                Validate workflow
              </button>
            ) : msg.showViewPreview ? (
              <button
                type="button"
                onClick={onViewPreview}
                className="inline-flex items-center gap-1.5 rounded-xl text-white text-[0.75rem] font-semibold px-3.5 py-2 transition-opacity cursor-pointer hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #6a12cd 0%, #8b5cf6 100%)',
                  boxShadow: '0 1px 3px rgba(106,18,205,0.3)',
                }}
              >
                <Eye size={13} />
                View Preview
              </button>
            ) : (
              <span />
            )}
            {msg.showViewWorkspace && (
              <button
                type="button"
                onClick={onViewWorkspace}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-canvas-border hover:border-brand-300 hover:text-brand-700 text-ink-600 text-[0.75rem] font-semibold px-3 py-2 transition-colors cursor-pointer"
              >
                <Sparkles size={12} />
                View Workspace
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const PLAN_BADGE_TONE: Record<string, string> = {
  INGESTION: 'bg-brand-50 text-brand-700',
  COMPARISON: 'bg-compliant-50 text-compliant-700',
  VALIDATION: 'bg-evidence-50 text-evidence-700',
  FLAGGING: 'bg-mitigated-50 text-mitigated-700',
  ANALYSIS: 'bg-brand-600 text-white',
  SUMMARY: 'bg-compliant-50 text-compliant-700',
  CALCULATION: 'bg-mitigated-50 text-mitigated-700',
};

function WorkflowPlanBlock({ plan }: { plan: WorkflowPlanCard }) {
  return (
    <div className="rounded-2xl border border-canvas-border bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-canvas-border">
        <div className="min-w-0">
          <div className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">
            Workflow plan
          </div>
          <div className="text-[0.6875rem] text-ink-400 mt-0.5">
            {plan.totalSteps} steps · {plan.durationLabel}
          </div>
        </div>
        <span className="text-[0.6875rem] text-ink-400 shrink-0">View full plan in the Plan tab</span>
      </div>
      <ol>
        {plan.steps.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-canvas-border last:border-0"
          >
            <span className="w-6 h-6 rounded-full bg-ink-900 text-white flex items-center justify-center text-[0.6875rem] font-bold shrink-0">
              {i + 1}
            </span>
            <span className="flex-1 text-[0.75rem] font-medium text-ink-800 truncate">
              {s.name}
            </span>
            <span
              className={`text-[0.75rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${PLAN_BADGE_TONE[s.badge] ?? 'bg-paper-50 text-ink-500'}`}
            >
              {s.badge}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 px-4 py-2.5 bg-compliant-50/40">
          <span className="w-6 h-6 rounded-full bg-compliant text-white flex items-center justify-center shrink-0">
            <CheckCircle2 size={12} />
          </span>
          <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-compliant-700 shrink-0">
            Output
          </span>
          <span className="flex-1 text-[0.75rem] font-medium text-ink-800 truncate">
            {plan.outputLabel}
          </span>
          <span className="text-[0.75rem] font-semibold text-ink-400 tabular-nums shrink-0">
            {plan.outputRows}
          </span>
        </li>
      </ol>
    </div>
  );
}

// Lightweight markdown-ish: **bold** only.
function renderRich(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-brand-700">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
