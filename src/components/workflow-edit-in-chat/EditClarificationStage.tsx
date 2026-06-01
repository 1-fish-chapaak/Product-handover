import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, Paperclip, Pencil, Send, Check } from 'lucide-react';
import type { EditClarificationStep } from './types';

interface Props {
  steps: EditClarificationStep[];
  onBack: () => void;
  onComplete: (answers: Record<number, string>) => void;
}

export default function EditClarificationStage({ steps, onBack, onComplete }: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');
  const [chatInput, setChatInput] = useState('');

  const total = steps.length;
  const current = steps[currentPage];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount >= total;

  // Keyboard: 1-9 select, ↑↓/←→ navigate, Esc skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (customMode) return;
      const num = parseInt(e.key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= current.options.length) {
        handleOptionClick(current.options[num - 1]);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        if (currentPage < total - 1) setCurrentPage((p) => p + 1);
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        if (currentPage > 0) setCurrentPage((p) => p - 1);
      }
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, customMode, answers]);

  const advance = () => {
    if (currentPage < total - 1) {
      setCustomMode(false);
      setCustomText('');
      setTimeout(() => setCurrentPage((p) => p + 1), 220);
    }
  };

  const handleOptionClick = (option: string) => {
    setAnswers((prev) => ({ ...prev, [currentPage]: option }));
    advance();
  };

  const handleCustomSubmit = () => {
    const text = customText.trim();
    if (!text) return;
    setAnswers((prev) => ({ ...prev, [currentPage]: text }));
    setCustomMode(false);
    setCustomText('');
    advance();
  };

  const handleSkip = () => {
    if (currentPage < total - 1) {
      setCurrentPage((p) => p + 1);
    } else {
      onComplete(answers);
    }
  };

  const handleChatSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    // Treat free-form chat input as the answer to the current question and advance.
    setAnswers((prev) => ({ ...prev, [currentPage]: text }));
    setChatInput('');
    if (currentPage < total - 1) {
      setTimeout(() => setCurrentPage((p) => p + 1), 220);
    } else {
      onComplete({ ...answers, [currentPage]: text });
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Top breadcrumb */}
      <div className="px-8 pt-6 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-ink-500 hover:text-brand-600 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to AI Concierge
        </button>
      </div>

      {/* Hero — pinned to top of the chat area */}
      <div className="shrink-0 px-8 pt-12 pb-4 max-w-[860px] mx-auto w-full text-center">
        <div className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500 mb-4">
          <ChevronRight size={13} />
          Asking a few clarifying questions
        </div>
        <h1 className="font-serif text-[36px] tracking-tight text-ink-900 leading-[1.15]">
          One quick check before I edit.{' '}
          <span className="text-ink-500 italic">Pick what fits, or type your own.</span>
        </h1>
      </div>

      {/* Empty chat area — flex spacer (where messages would land) */}
      <div className="flex-1 min-h-0" />

      {/* Bottom dock — clarification card joined to chat input */}
      <div className="shrink-0 px-4 sm:px-6 pb-5 max-w-3xl mx-auto w-full">
        <motion.div
          key={currentPage}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          className="rounded-t-2xl rounded-b-none border border-b-0 border-canvas-border bg-white overflow-hidden"
          style={{ boxShadow: '0 -8px 32px rgba(106,18,205,0.05)' }}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-2.5 flex items-center justify-between gap-4">
            <h3 className="text-[14px] font-semibold text-ink-900 leading-snug truncate flex items-baseline gap-2">
              {current.question}
              <span className="text-[11.5px] font-medium text-ink-400 tabular-nums shrink-0">
                · {currentPage + 1} of {total}
              </span>
            </h3>
          </div>

          {/* Options */}
          <div>
            {current.options.map((option, idx) => {
              const selected = answers[currentPage] === option;
              return (
                <button
                  key={`${currentPage}-${idx}`}
                  type="button"
                  onClick={() => handleOptionClick(option)}
                  className={[
                    'w-full flex items-center gap-3 px-5 py-3 text-left transition-colors cursor-pointer border-t border-canvas-border',
                    selected ? 'bg-brand-50/60' : 'hover:bg-canvas',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-6 h-6 rounded-md flex items-center justify-center text-[11.5px] font-bold shrink-0',
                      selected ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700',
                    ].join(' ')}
                  >
                    {selected ? <Check size={11} /> : idx + 1}
                  </span>
                  <span className="flex-1 text-[13.5px] text-ink-800">{option}</span>
                  <ReturnArrowIcon dimmed={!selected} />
                </button>
              );
            })}

            {/* Something else / Skip row */}
            {!customMode ? (
              <div className="flex items-center gap-3 px-5 py-3 border-t border-canvas-border">
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className="flex-1 flex items-center gap-3 text-left cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-md flex items-center justify-center bg-canvas border border-canvas-border shrink-0">
                    <Pencil size={11} className="text-ink-400" />
                  </span>
                  <span className="text-[13px] text-ink-400">Something else</span>
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-[12.5px] font-semibold text-ink-500 hover:text-ink-700 transition-colors px-3 py-1.5 rounded-lg border border-canvas-border bg-white cursor-pointer"
                >
                  Skip
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-canvas-border bg-canvas/40">
                <input
                  autoFocus
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomSubmit();
                    if (e.key === 'Escape') {
                      setCustomMode(false);
                      setCustomText('');
                    }
                  }}
                  placeholder="Type your own answer…"
                  className="flex-1 px-3 py-2 rounded-lg border border-canvas-border bg-white text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={handleCustomSubmit}
                  disabled={!customText.trim()}
                  className={[
                    'px-3 py-2 rounded-lg flex items-center justify-center transition-colors',
                    customText.trim()
                      ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                      : 'bg-canvas-border text-ink-400 cursor-not-allowed',
                  ].join(' ')}
                >
                  <Send size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setCustomText('');
                  }}
                  className="text-[12.5px] text-ink-500 hover:text-ink-700 px-2 py-1 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Chat input — visually joined to the card above */}
        <div className="rounded-b-2xl border border-t-0 border-canvas-border bg-white">
          <div className="relative">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend();
                }
              }}
              rows={1}
              placeholder={`Or just type. I'll treat it as your answer to question ${currentPage + 1}.`}
              className="w-full bg-transparent border-none outline-none resize-none py-3 pl-4 pr-24 text-[13.5px] text-ink-800 placeholder:text-ink-400 min-h-[44px] max-h-[160px] rounded-b-2xl"
            />
            <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
              <button
                type="button"
                className="p-2 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                aria-label="Attach"
              >
                <Paperclip size={14} />
              </button>
              <button
                type="button"
                onClick={handleChatSend}
                disabled={!chatInput.trim()}
                className={[
                  'p-2 rounded-lg transition-colors',
                  chatInput.trim()
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

        {/* Footer hints */}
        <div className="flex items-center justify-between mt-3 text-[11.5px] text-ink-400">
          <div className="flex items-center gap-3">
            <KbdHint label="↑↓" desc="navigate" />
            <KbdHint label="Enter" desc="select" />
            <KbdHint label="Esc" desc="skip" />
          </div>
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {answeredCount} of {total} answered
            </span>
            {allAnswered && (
              <button
                type="button"
                onClick={() => onComplete(answers)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold cursor-pointer transition-colors"
              >
                Open editor
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KbdHint({ label, desc }: { label: string; desc: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-semibold text-ink-600">{label}</span>
      <span className="text-ink-400">to {desc}</span>
    </span>
  );
}

function ReturnArrowIcon({ dimmed }: { dimmed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className={dimmed ? 'text-ink-300' : 'text-brand-600'}
      fill="none"
    >
      <path
        d="M11 3v3a2 2 0 0 1-2 2H3m0 0 3 3m-3-3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
