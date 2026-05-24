import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Paperclip, Send, ArrowLeft, Link2, Check, Info, SlidersHorizontal, DollarSign, Play, RotateCcw, Loader2, CornerDownLeft, Eye } from 'lucide-react';
import StepUploadFiles from './StepUploadFiles';
import StepMapData from './StepMapData';
import StepReviewRun from './StepReviewRun';
import StepOutputView from './StepOutputView';
import type {
  ClarifyQuestion,
  InputSpec,
  JourneyAlignments,
  JourneyFiles,
  JourneyMappings,
  RunResult,
  WorkflowDraft,
} from './types';

export type EventTone = 'link' | 'info' | 'success';

export interface ToleranceCardState {
  mode: 'percentage' | 'absolute';
  percentage: number; // 0-20
  absolute: number;
  enabled: boolean;
}

export interface ToleranceCardProps {
  state: ToleranceCardState;
  onChange: (next: ToleranceCardState) => void;
  onRun: (state: ToleranceCardState) => void;
  onReset: () => void;
  running?: boolean;
  locked?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'event' | 'card' | 'loader';
  text: string;
  tone?: EventTone;
  cardType?: 'tolerance' | 'upload' | 'map' | 'review' | 'output' | 'view-preview';
}

export interface ViewPreviewCardProps {
  onClick: () => void;
  revealed?: boolean;
}

export interface UploadCardProps {
  workflow: WorkflowDraft;
  files: JourneyFiles;
  setFiles: (f: JourneyFiles) => void;
  onLinkSource?: (sourceName: string, inputName: string) => void;
  onFocusInput?: (input: InputSpec) => void;
  focusedInputId?: string | null;
  view?: 'full' | 'upload-only' | 'list-only';
  onOpenUploadModal?: () => void;
}

export interface MapCardProps {
  workflow: WorkflowDraft;
  files: JourneyFiles;
  setFiles: (f: JourneyFiles) => void;
  alignments: JourneyAlignments;
  expandedInputId?: string | null;
  onToggleExpand?: (inputId: string) => void;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  onViewWorkspace?: () => void;
}

export interface ReviewCardProps {
  workflow: WorkflowDraft;
  setWorkflow: Dispatch<SetStateAction<WorkflowDraft | null>>;
  files: JourneyFiles;
  mappings: JourneyMappings;
  setMappings: Dispatch<SetStateAction<JourneyMappings>>;
  running: boolean;
  result: RunResult | null;
  expandedSource?: string | null;
  setExpandedSource?: Dispatch<SetStateAction<string | null>>;
  onViewWorkspace?: () => void;
  onValidate?: () => void;
  validateDisabled?: boolean;
}

export interface OutputCardProps {
  workflow: WorkflowDraft;
  result: RunResult | null;
  running: boolean;
  onSave?: () => void;
  saved?: boolean;
}

export interface QuickReply {
  id: string;
  label: string;
  emphasis?: 'filled' | 'outline';
  onClick: () => void;
}

export interface ContextChip {
  title: string;
  subtitle?: string;
  onDismiss: () => void;
}

export interface PrimaryAction {
  label: string;
  icon?: ReactNode;
  enabled: boolean;
  onClick: () => void;
  hint?: string;
}

export interface InlineClarifyProps {
  question: ClarifyQuestion;
  index: number;
  total: number;
  stepLabel?: string;
  onAnswer: (questionId: string, answer: string) => void;
  onSkip: (questionId: string) => void;
}

interface Props {
  messages: ChatMessage[];
  quickReplies?: QuickReply[];
  contextChip?: ContextChip;
  primaryAction?: PrimaryAction;
  placeholder?: string;
  onSend: (text: string) => void;
  onOpenAttach?: () => void;
  input: string;
  setInput: (v: string) => void;
  onBack?: () => void;
  isTyping?: boolean;
  toleranceCard?: ToleranceCardProps;
  uploadCard?: UploadCardProps;
  mapCard?: MapCardProps;
  reviewCard?: ReviewCardProps;
  outputCard?: OutputCardProps;
  viewPreviewCard?: ViewPreviewCardProps;
  inlineClarify?: InlineClarifyProps;
}

export default function AIAssistantPanel({
  messages,
  quickReplies,
  contextChip,
  primaryAction,
  placeholder,
  onSend,
  onOpenAttach,
  input,
  setInput,
  onBack,
  isTyping,
  toleranceCard,
  uploadCard,
  mapCard,
  reviewCard,
  outputCard,
  viewPreviewCard,
  inlineClarify,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, quickReplies, isTyping, contextChip]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleTextareaInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  return (
    <aside className="flex flex-col h-full w-full bg-canvas-elevated border-r border-canvas-border min-h-0">
      {/* Header — slim back-link only; stepper + Ira branding intentionally omitted */}
      {onBack && (
        <div className="px-4 pt-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-brand-600 transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            Back to AI Concierge
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className={[
          'flex-1 overflow-y-auto px-4 py-5 min-h-0 transition-opacity',
          inlineClarify ? 'opacity-55 pointer-events-none' : '',
        ].join(' ')}
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const isFirstOfRun = !prev || prev.role !== m.role;
            const prevWasEvent = prev?.role === 'event';
            // Tighter stacking inside a run, comfortable gap between runs.
            const topGap =
              i === 0
                ? ''
                : m.role === 'event' && prevWasEvent
                  ? 'mt-1'
                  : isFirstOfRun
                    ? 'mt-5'
                    : 'mt-1.5';

            if (m.role === 'card' && m.cardType === 'tolerance' && toleranceCard) {
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex justify-start ${topGap}`}
                >
                  <div className="max-w-[92%] min-w-0 w-full">
                    {isFirstOfRun && (
                      <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                        Ira
                      </div>
                    )}
                    <ToleranceAdjustCard {...toleranceCard} />
                  </div>
                </motion.div>
              );
            }

            if (m.role === 'card' && m.cardType === 'upload' && uploadCard) {
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex justify-start ${topGap}`}
                >
                  <div className="max-w-[96%] min-w-0 w-full">
                    {isFirstOfRun && (
                      <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                        Ira
                      </div>
                    )}
                    <StepUploadFiles {...uploadCard} />
                  </div>
                </motion.div>
              );
            }

            if (m.role === 'card' && m.cardType === 'map' && mapCard) {
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex justify-start ${topGap}`}
                >
                  <div className="max-w-[96%] min-w-0 w-full">
                    {isFirstOfRun && (
                      <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                        Ira
                      </div>
                    )}
                    <StepMapData {...mapCard} />
                  </div>
                </motion.div>
              );
            }

            if (m.role === 'card' && m.cardType === 'review' && reviewCard) {
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex justify-start ${topGap}`}
                >
                  <div className="max-w-[96%] min-w-0 w-full">
                    {isFirstOfRun && (
                      <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                        Ira
                      </div>
                    )}
                    <StepReviewRun {...reviewCard} />
                  </div>
                </motion.div>
              );
            }

            if (m.role === 'card' && m.cardType === 'output' && outputCard) {
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex justify-start ${topGap}`}
                >
                  <div className="max-w-[96%] min-w-0 w-full">
                    {isFirstOfRun && (
                      <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                        Ira
                      </div>
                    )}
                    <StepOutputView {...outputCard} />
                  </div>
                </motion.div>
              );
            }

            if (m.role === 'card' && m.cardType === 'view-preview' && viewPreviewCard) {
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex justify-start ${topGap}`}
                >
                  <div className="max-w-[92%] min-w-0 w-full">
                    {isFirstOfRun && (
                      <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                        Ira
                      </div>
                    )}
                    <ViewPreviewCard {...viewPreviewCard} />
                  </div>
                </motion.div>
              );
            }

            if (m.role === 'loader') {
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex justify-start ${topGap}`}
                >
                  <div className="max-w-[78%] min-w-0">
                    {isFirstOfRun && (
                      <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                        Ira
                      </div>
                    )}
                    <div className="inline-flex items-center gap-2">
                      <motion.span
                        animate={{ scale: [1, 1.35, 1], opacity: [0.55, 1, 0.55] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-2 h-2 rounded-full bg-brand-500"
                      />
                      <span
                        className="text-[13.5px] font-medium leading-[1.65] bg-clip-text text-transparent"
                        style={{
                          backgroundImage:
                            'linear-gradient(90deg, rgba(31,28,46,0.35) 0%, rgba(31,28,46,0.95) 50%, rgba(31,28,46,0.35) 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'ira-shimmer 1.6s linear infinite',
                        }}
                      >
                        {m.text || 'Working…'}
                      </span>
                    </div>
                    <style>{`@keyframes ira-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                  </div>
                </motion.div>
              );
            }

            if (m.role === 'event') {
              const Icon =
                m.tone === 'success' ? Check : m.tone === 'info' ? Info : Link2;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-2 ${topGap}`}
                >
                  <span className="w-5 h-5 rounded-md bg-canvas text-ink-500 flex items-center justify-center shrink-0 border border-canvas-border">
                    <Icon size={11} />
                  </span>
                  <span
                    className="text-[12.5px] text-ink-500 leading-[1.45] min-w-0 flex-1"
                    dangerouslySetInnerHTML={{
                      __html: renderInline(m.text, 'event'),
                    }}
                  />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} ${topGap}`}
              >
                <div className="max-w-[78%] min-w-0">
                  {m.role === 'assistant' && isFirstOfRun && (
                    <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                      Ira
                    </div>
                  )}
                  {m.role === 'user' ? (
                    <div className="px-3 py-2 rounded-2xl rounded-br-md bg-brand-50 border border-brand-200 text-ink-800 text-[13px] leading-relaxed break-words">
                      <span
                        dangerouslySetInnerHTML={{ __html: renderInline(m.text, 'user') }}
                      />
                    </div>
                  ) : (
                    <div className="text-[13.5px] leading-[1.65] text-ink-800 break-words">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderInline(m.text, 'assistant'),
                        }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start mt-5"
          >
            <div className="max-w-[78%]">
              <div className="mb-1 font-mono text-[10.5px] text-ink-400 uppercase tracking-[0.14em]">
                Ira
              </div>
              <div className="inline-flex items-center gap-1.5">
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  className="w-1.5 h-1.5 rounded-full bg-brand-400"
                />
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                  className="w-1.5 h-1.5 rounded-full bg-brand-400"
                />
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                  className="w-1.5 h-1.5 rounded-full bg-brand-400"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick replies for filled (assistant-suggested) actions render inline */}
        {quickReplies && quickReplies.some((r) => r.emphasis === 'filled') && (
          <div className="flex flex-wrap gap-2 mt-5">
            {quickReplies
              .filter((r) => r.emphasis === 'filled')
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={r.onClick}
                  className="rounded-full text-[12px] font-semibold px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white transition-colors cursor-pointer"
                >
                  {r.label}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Composer (replaced by inline clarify card when active) */}
      {inlineClarify ? (
        <div className="p-3 border-t border-canvas-border shrink-0">
          <InlineClarifyCard {...inlineClarify} />
        </div>
      ) : (
      <div className="p-3 border-t border-canvas-border shrink-0">
        {/* Context chip (e.g. "Match invoice to PO") — hidden for now; may reuse later.
        <AnimatePresence initial={false}>
          {contextChip && (
            <motion.div
              key="context-chip"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="mb-2 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-2.5 py-2"
            >
              <div className="w-7 h-7 rounded-md bg-white text-brand-600 flex items-center justify-center shrink-0 border border-brand-100">
                <Link2 size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-ink-800 truncate">
                  {contextChip.title}
                </div>
                {contextChip.subtitle && (
                  <div className="text-[11.5px] text-ink-500 truncate">
                    {contextChip.subtitle}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={contextChip.onDismiss}
                aria-label="Dismiss context"
                className="w-6 h-6 rounded-md text-ink-400 hover:bg-white hover:text-ink-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        */}
        {/* Contextual prompt suggestions — outline pills tied to the focused entity */}
        {contextChip && quickReplies && quickReplies.some((r) => r.emphasis !== 'filled') && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quickReplies
              .filter((r) => r.emphasis !== 'filled')
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={r.onClick}
                  className="rounded-full text-[12px] text-ink-700 px-3 py-1 border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 transition-colors cursor-pointer"
                >
                  {r.label}
                </button>
              ))}
          </div>
        )}
        {primaryAction && (
          <div className="mb-3">
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={!primaryAction.enabled}
              className={[
                'w-full inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold px-4 py-3 transition-all',
                primaryAction.enabled
                  ? 'bg-gradient-to-br from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white cursor-pointer shadow-[0_1px_0_rgba(106,18,205,0.08),0_8px_20px_-8px_rgba(106,18,205,0.45)]'
                  : 'bg-brand-100 text-brand-300 cursor-not-allowed',
              ].join(' ')}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
            {primaryAction.hint && !primaryAction.enabled && (
              <div className="mt-1.5 text-[11.5px] text-ink-400 text-center">
                {primaryAction.hint}
              </div>
            )}
          </div>
        )}
        <div className="ai-border">
          <div className="relative bg-white rounded-[12px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                handleTextareaInput();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder={placeholder ?? 'Describe what you need…'}
              className="w-full bg-transparent border-none outline-none resize-none pt-3 pb-10 px-3 text-[13px] text-ink-800 placeholder:text-ink-400 min-h-[44px] max-h-[140px] rounded-[12px]"
            />
            <div className="absolute left-2 bottom-2 flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenAttach}
                className="cursor-pointer w-7 h-7 rounded-lg text-ink-400 hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center transition-colors"
                aria-label="Attach data"
              >
                <Paperclip size={13} />
              </button>
            </div>
            <div className="absolute right-2 bottom-2">
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="Send"
                className={[
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                  input.trim()
                    ? 'bg-gradient-to-br from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white cursor-pointer shadow-sm'
                    : 'bg-canvas-border text-ink-400 cursor-not-allowed',
                ].join(' ')}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </aside>
  );
}

function InlineClarifyCard({
  question,
  index,
  total,
  stepLabel,
  onAnswer,
  onSkip,
}: InlineClarifyProps) {
  const [selected, setSelected] = useState(0);
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    setSelected(0);
    setCustomText('');
  }, [question.id]);

  const submit = useCallback(
    (answer: string) => {
      onAnswer(question.id, answer);
    },
    [question.id, onAnswer],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;

      if (!typing && e.key >= '1' && e.key <= String(question.options.length)) {
        const i = parseInt(e.key, 10) - 1;
        setSelected(i);
        e.preventDefault();
        submit(question.options[i]);
        return;
      }
      if (!typing && e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, question.options.length - 1));
        return;
      }
      if (!typing && e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !typing) {
        e.preventDefault();
        submit(question.options[selected] ?? '');
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip(question.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, selected, submit, onSkip]);

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-[0_14px_36px_-18px_rgba(106,18,205,0.3)]"
    >
      <div className="px-4 pt-3.5 pb-3">
        {stepLabel && (
          <div className="text-[10.5px] font-bold text-brand-600 uppercase tracking-[0.14em] mb-2">
            {stepLabel}
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="text-[14px] font-semibold text-ink-800 leading-snug">
            {question.title}
          </div>
          {total > 1 && (
            <div className="text-[11.5px] text-ink-400 whitespace-nowrap tabular-nums shrink-0 mt-0.5">
              {index + 1} of {total}
            </div>
          )}
        </div>
      </div>
      <ul>
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          return (
            <li key={opt}>
              <button
                type="button"
                onClick={() => submit(opt)}
                onMouseEnter={() => setSelected(i)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-t border-canvas-border cursor-pointer',
                  isSelected ? 'bg-brand-50/60' : 'hover:bg-canvas',
                ].join(' ')}
              >
                <span className="flex-1 text-[13.5px] text-ink-800">{opt}</span>
                {isSelected && (
                  <span className="text-ink-400">
                    <CornerDownLeft size={13} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-canvas-border">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customText.trim()) {
              e.preventDefault();
              submit(customText.trim());
            }
          }}
          placeholder="Type something else..."
          className="flex-1 bg-transparent border-none outline-none text-[13px] text-ink-800 placeholder:text-ink-400"
        />
        <button
          type="button"
          onClick={() => onSkip(question.id)}
          className="text-[12.5px] font-semibold text-ink-600 hover:text-ink-800 underline underline-offset-2 cursor-pointer"
        >
          Skip
        </button>
      </div>
    </motion.div>
  );
}

function ViewPreviewCard({ onClick, revealed }: ViewPreviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2"
    >
      <span className="text-[12.5px] text-ink-600 leading-snug">
        Review the output schema on the right, then open the preview when ready.
      </span>
      <button
        type="button"
        onClick={onClick}
        disabled={revealed}
        className={[
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all shrink-0',
          revealed
            ? 'bg-brand-50 text-brand-400 cursor-not-allowed'
            : 'text-white bg-gradient-to-br from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 shadow-[0_8px_16px_-10px_rgba(106,18,205,0.5)] cursor-pointer',
        ].join(' ')}
      >
        <Eye size={13} />
        {revealed ? 'Preview opened' : 'View Preview'}
      </button>
    </motion.div>
  );
}

function severityForPct(v: number): { label: string; bg: string; color: string } {
  if (v <= 3) return { label: 'Strict', bg: 'rgba(220,38,38,0.12)', color: '#B91C1C' };
  if (v <= 10) return { label: 'Moderate', bg: 'rgba(183,137,0,0.14)', color: '#92631F' };
  return { label: 'Relaxed', bg: 'rgba(15,110,86,0.12)', color: '#0F6E56' };
}

function severityForAbs(v: number): { label: string; bg: string; color: string } {
  if (v <= 100) return { label: 'Strict', bg: 'rgba(220,38,38,0.12)', color: '#B91C1C' };
  if (v <= 1000) return { label: 'Moderate', bg: 'rgba(183,137,0,0.14)', color: '#92631F' };
  return { label: 'Relaxed', bg: 'rgba(15,110,86,0.12)', color: '#0F6E56' };
}

function ToleranceAdjustCard({
  state,
  onChange,
  onRun,
  onReset,
  running,
  locked,
}: ToleranceCardProps) {
  const disabled = !!locked;
  const sev =
    state.mode === 'percentage'
      ? severityForPct(state.percentage)
      : severityForAbs(state.absolute);
  const summary =
    state.mode === 'percentage'
      ? `±${state.percentage}%`
      : `±$${state.absolute.toLocaleString()}`;

  return (
    <div
      className="rounded-2xl border border-canvas-border bg-canvas-elevated shadow-[0_10px_28px_-14px_rgba(16,24,40,0.18)] overflow-hidden"
      aria-disabled={disabled}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <SlidersHorizontal size={14} />
          </span>
          <span className="text-[14px] font-semibold text-ink-800">Tolerance rules</span>
          <span className="text-[10.5px] font-bold tracking-wider rounded-md px-2 py-0.5 bg-brand-50 text-brand-700">
            INTERACTIVE
          </span>
        </div>
        <span className="text-[11.5px] text-ink-400 font-medium whitespace-nowrap">
          {state.enabled ? '1 active' : 'Off'}
        </span>
      </div>

      {/* Rule row */}
      <div className="px-4 pb-3">
        <div className="rounded-xl border border-canvas-border bg-canvas p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: '#E1F5EE', color: '#0F6E56' }}
              >
                <DollarSign size={15} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13.5px] font-semibold text-ink-800">Amount</span>
                  <span className="text-[11.5px] text-ink-500 tabular-nums">{summary}</span>
                  <span
                    className="text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: sev.bg, color: sev.color }}
                  >
                    {sev.label}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    Invoice Amount
                  </span>
                  <span className="text-ink-400">vs</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    GL Amount
                  </span>
                </div>
              </div>
            </div>

            {/* Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={state.enabled}
              aria-label="Toggle tolerance rule"
              disabled={disabled}
              onClick={() => onChange({ ...state, enabled: !state.enabled })}
              className={[
                'relative w-10 h-[22px] rounded-full transition-colors shrink-0',
                state.enabled ? 'bg-brand-600' : 'bg-canvas-border',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform',
                  state.enabled ? 'translate-x-[18px]' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Controls */}
          <div
            className={[
              'mt-3 flex flex-col gap-3 transition-opacity',
              state.enabled && !disabled ? 'opacity-100' : 'opacity-55 pointer-events-none',
            ].join(' ')}
          >
            {/* Mode tabs */}
            <div className="flex rounded-lg border border-canvas-border overflow-hidden">
              {(['percentage', 'absolute'] as const).map((m) => {
                const active = state.mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChange({ ...state, mode: m })}
                    className="flex-1 py-1.5 text-[11px] font-semibold transition-all cursor-pointer capitalize"
                    style={
                      active
                        ? { background: '#6A12CD', color: '#fff' }
                        : { background: '#fff', color: '#94a3b8' }
                    }
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {state.mode === 'percentage' ? (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[18px] font-bold tabular-nums min-w-[40px] text-brand-700">
                    {state.percentage}%
                  </span>
                  <span
                    className="text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: sev.bg, color: sev.color }}
                  >
                    {sev.label}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={state.percentage}
                  onChange={(e) =>
                    onChange({ ...state, percentage: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-[#6A12CD] [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(106,18,205,0.35)]"
                  style={{
                    background:
                      'linear-gradient(to right, rgba(220,38,38,0.2), rgba(183,137,0,0.2), rgba(15,110,86,0.2))',
                  }}
                />
                <div className="flex justify-between mt-1.5">
                  <span
                    className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
                  >
                    0% Strict
                  </span>
                  <span
                    className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(15,110,86,0.08)', color: '#0F6E56' }}
                  >
                    20% Relaxed
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 border border-canvas-border rounded-lg overflow-hidden focus-within:border-brand-400/50 focus-within:ring-2 focus-within:ring-brand-100 transition-all bg-white">
                    <span className="text-[11px] font-semibold text-ink-400 pl-3 pr-1 select-none">$</span>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={state.absolute}
                      onChange={(e) =>
                        onChange({
                          ...state,
                          absolute: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="flex-1 py-1.5 pr-3 text-[13px] font-semibold bg-transparent outline-none tabular-nums text-brand-700"
                    />
                  </div>
                  <span
                    className="text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: sev.bg, color: sev.color }}
                  >
                    {sev.label}
                  </span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[100, 500, 1000, 5000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onChange({ ...state, absolute: v })}
                      className="flex-1 py-1 text-[10.5px] font-semibold rounded-md border transition-all cursor-pointer"
                      style={
                        state.absolute === v
                          ? {
                              background: 'rgba(106,18,205,0.06)',
                              color: '#6A12CD',
                              borderColor: 'rgba(106,18,205,0.25)',
                            }
                          : { background: '#fff', color: '#94a3b8', borderColor: '#e2e8f0' }
                      }
                    >
                      ${v.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 pb-3.5">
        <button
          type="button"
          onClick={() => onRun(state)}
          disabled={disabled || !!running}
          className={[
            'flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-[12.5px] font-semibold px-3 py-2 transition-all',
            disabled || running
              ? 'bg-brand-100 text-brand-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white cursor-pointer shadow-[0_8px_16px_-8px_rgba(106,18,205,0.45)]',
          ].join(' ')}
        >
          {running ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play size={13} />
              Run workflow
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled || !!running}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-brand-600 px-2.5 py-2 rounded-lg hover:bg-brand-50/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>
    </div>
  );
}

function renderInline(text: string, role: ChatMessage['role']): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const boldClass =
    role === 'user'
      ? 'font-semibold text-brand-700'
      : role === 'event'
        ? 'font-semibold text-ink-800'
        : 'font-semibold text-brand-700';
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, `<strong class="${boldClass}">$1</strong>`)
    .replace(/\n/g, '<br />');
}
