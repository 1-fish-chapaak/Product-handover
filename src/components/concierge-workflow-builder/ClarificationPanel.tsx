import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, CornerDownLeft, Pencil, X } from 'lucide-react';
import type { ClarifyAnswers, ClarifyQuestion } from './types';

interface Props {
  questions: ClarifyQuestion[];
  index: number;
  answers: ClarifyAnswers;
  onAnswer: (questionId: string, answer: string) => void;
  onSkip: (questionId: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}

export default function ClarificationPanel({
  questions,
  index,
  answers,
  onAnswer,
  onSkip,
  onBack,
  onClose,
}: Props) {
  const current = questions[index];
  const [selected, setSelected] = useState(0);
  const [customText, setCustomText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelected(0);
    setCustomText('');
  }, [index]);

  const submit = useCallback(
    (answer: string) => {
      if (!current) return;
      onAnswer(current.id, answer);
    },
    [current, onAnswer],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;

      if (!typing && e.key >= '1' && e.key <= String(current.options.length)) {
        const i = parseInt(e.key, 10) - 1;
        setSelected(i);
        e.preventDefault();
        submit(current.options[i]);
        return;
      }
      if (!typing && e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, current.options.length - 1));
        return;
      }
      if (!typing && e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !typing) {
        e.preventDefault();
        submit(current.options[selected] ?? '');
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip(current.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, selected, submit, onSkip]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v && v.trim().length > 0).length,
    [answers],
  );

  if (!current) return null;
  const total = questions.length;

  return (
    <div className="flex flex-col h-full w-full bg-canvas">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-6 pt-5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-600 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back to AI Concierge
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* Header copy */}
      <div className="shrink-0 px-6 pt-14 pb-6">
        <div className="max-w-[760px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-1 text-[12px] text-ink-400 font-medium mb-2">
              <ChevronRight size={12} />
              <span>Asking a few clarifying questions</span>
            </div>
            <h2 className="font-serif text-[26px] tracking-tight text-ink-900 leading-snug">
              One quick check before I run. <span className="text-ink-500 italic">Pick what fits, or type your own.</span>
            </h2>
          </motion.div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-0" />

      {/* Floating question card */}
      <div className="shrink-0 px-6 pb-6">
        <div className="max-w-[760px] mx-auto">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-[0_18px_48px_-18px_rgba(106,18,205,0.3)]"
          >
            {/* Card header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-canvas-elevated">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[14px] font-semibold text-ink-800 truncate">
                  {current.title}
                </span>
                <span className="text-[12px] text-ink-400 whitespace-nowrap">
                  · {index + 1} of {total}
                </span>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-6 h-6 rounded-md hover:bg-canvas text-ink-400 hover:text-ink-700 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Options */}
            <ul>
              {current.options.map((opt, i) => {
                const isSelected = selected === i;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => submit(opt)}
                      onMouseEnter={() => setSelected(i)}
                      className={[
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-t border-canvas-border cursor-pointer',
                        isSelected ? 'bg-brand-50/60' : 'bg-canvas-elevated hover:bg-canvas',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'w-6 h-6 rounded-md text-[11px] font-semibold flex items-center justify-center shrink-0 tabular-nums',
                          isSelected
                            ? 'bg-brand-100 text-brand-700'
                            : 'bg-canvas text-ink-500',
                        ].join(' ')}
                      >
                        {i + 1}
                      </span>
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

            {/* Custom input + skip */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-t border-canvas-border bg-canvas-elevated">
              <Pencil size={13} className="text-ink-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customText.trim()) {
                    e.preventDefault();
                    submit(customText.trim());
                  }
                }}
                placeholder="Something else"
                className="flex-1 bg-transparent border-none outline-none text-[13px] text-ink-800 placeholder:text-ink-400"
              />
              <button
                type="button"
                onClick={() => onSkip(current.id)}
                className="rounded-md border border-canvas-border bg-white hover:bg-canvas text-[12px] font-semibold text-ink-600 px-3 py-1 cursor-pointer transition-colors"
              >
                Skip
              </button>
            </div>
          </motion.div>

          {/* Footer hints */}
          <div className="flex items-center justify-between mt-3 text-[11.5px] text-ink-400 px-1">
            <div className="flex items-center gap-2">
              <span>↑↓ to navigate</span>
              <span>·</span>
              <span>Enter to select</span>
              <span>·</span>
              <span>Esc to skip</span>
            </div>
            <div className="tabular-nums">
              {answeredCount} of {total} answered
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
