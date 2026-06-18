import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CornerDownLeft } from 'lucide-react';
import type { ValidateClarifyQuestion } from './types';

interface Props {
  question: ValidateClarifyQuestion;
  index: number;
  total: number;
  stepLabel?: string;
  onAnswer: (questionId: string, answer: string) => void;
  onSkip: (questionId: string) => void;
}

/** Inline clarification card used at the Validate Workflow step. Mirrors the
 *  AI Concierge builder's InlineClarifyCard. The parent should pass a `key`
 *  on the question id so this remounts (and resets local state) per question. */
export default function InlineClarifyCard({
  question,
  index,
  total,
  stepLabel,
  onAnswer,
  onSkip,
}: Props) {
  const [selected, setSelected] = useState(0);
  const [customText, setCustomText] = useState('');

  const submit = useCallback(
    (answer: string) => onAnswer(question.id, answer),
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
          <div className="text-[0.75rem] font-bold text-brand-600 uppercase tracking-[0.14em] mb-2">
            {stepLabel}
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="text-[0.875rem] font-semibold text-ink-800 leading-snug">
            {question.title}
          </div>
          {total > 1 && (
            <div className="text-[0.75rem] text-ink-400 whitespace-nowrap tabular-nums shrink-0 mt-0.5">
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
                <span className="flex-1 text-[0.75rem] text-ink-800">{opt}</span>
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
          className="flex-1 bg-transparent border-none outline-none text-[0.8125rem] text-ink-800 placeholder:text-ink-400"
        />
        <button
          type="button"
          onClick={() => onSkip(question.id)}
          className="text-[0.75rem] font-semibold text-ink-600 hover:text-ink-800 underline underline-offset-2 cursor-pointer"
        >
          Skip
        </button>
      </div>
    </motion.div>
  );
}
