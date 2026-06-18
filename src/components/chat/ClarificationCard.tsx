import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  Pencil,
  Send,
  CornerDownLeft,
} from 'lucide-react';

interface ClarificationCardProps {
  questions: Array<{
    question: string;
    options: string[];
  }>;
  onComplete: (answers: Record<number, string>) => void;
  onSkipAll: () => void;
}

export default function ClarificationCard({
  questions,
  onComplete,
  onSkipAll,
}: ClarificationCardProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');

  const total = questions.length;
  const current = questions[currentPage];

  const goTo = useCallback((page: number) => {
    setCurrentPage(page);
    setCustomMode(false);
    setCustomText('');
  }, []);

  const handleOptionClick = (option: string) => {
    setAnswers(prev => ({ ...prev, [currentPage]: option }));
    if (currentPage < total - 1) {
      setTimeout(() => goTo(currentPage + 1), 300);
    }
  };

  const handleCustomSubmit = () => {
    const text = customText.trim();
    if (text) {
      setAnswers(prev => ({ ...prev, [currentPage]: text }));
      setCustomMode(false);
      setCustomText('');
      if (currentPage < total - 1) {
        setTimeout(() => goTo(currentPage + 1), 300);
      }
    }
  };

  const handleSkip = () => {
    if (currentPage < total - 1) {
      goTo(currentPage + 1);
    } else {
      onComplete(answers);
    }
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-sm"
    >
      {/* Header — serif title + labeled Back/Next + close */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 gap-4">
        <h3 className="font-display text-[1.0625rem] font-semibold text-ink-800 leading-snug flex-1 tracking-tight">
          {current.question}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            disabled={currentPage === 0}
            onClick={() => goTo(currentPage - 1)}
            aria-label="Previous question"
            className="flex items-center gap-1 h-7 px-2 rounded-md text-[0.75rem] font-medium text-ink-600 hover:bg-paper-100 hover:text-ink-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronLeft size={13} />
            Back
          </button>
          <span className="text-[0.6875rem] text-ink-500 tabular-nums px-1.5 min-w-[44px] text-center">
            {currentPage + 1} of {total}
          </span>
          <button
            disabled={currentPage === total - 1}
            onClick={() => goTo(currentPage + 1)}
            aria-label="Next question"
            className="flex items-center gap-1 h-7 px-2 rounded-md text-[0.75rem] font-medium text-ink-600 hover:bg-paper-100 hover:text-ink-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            Next
            <ChevronRight size={13} />
          </button>
          <button
            onClick={onSkipAll}
            aria-label="Close"
            className="ml-1 p-1 rounded text-ink-400 hover:text-ink-700 cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Options — continuous list, hairline rules between rows */}
      <div role="listbox" aria-label={current.question}>
        {current.options.map((option, idx) => {
          const isSelected = answers[currentPage] === option;
          return (
            <button
              key={`${currentPage}-${idx}`}
              role="option"
              aria-selected={isSelected}
              onClick={() => handleOptionClick(option)}
              className={`group w-full flex items-center gap-3 px-5 py-3 text-left text-[0.75rem] transition-colors cursor-pointer border-t border-canvas-border/70 first:border-t-0 ${
                isSelected
                  ? 'bg-primary/5 text-ink-800'
                  : 'text-ink-700 hover:bg-paper-50'
              }`}
            >
              <span
                className={`flex items-center justify-center w-7 h-7 rounded-md text-[0.75rem] font-semibold tabular-nums shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-paper-100 text-ink-500 group-hover:bg-paper-200 group-hover:text-ink-700'
                }`}
              >
                {idx + 1}
              </span>
              <span className="flex-1">{option}</span>
              {isSelected ? (
                <ArrowRight size={14} className="text-primary shrink-0" />
              ) : (
                <CornerDownLeft
                  size={13}
                  className="text-ink-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Submit row — surfaces progress + lets the user commit early */}
      {answeredCount > 0 && (
        <div className="border-t border-canvas-border flex items-center justify-between gap-3 px-5 py-2.5 bg-paper-50/40">
          <span className="text-[0.75rem] text-ink-500 tabular-nums">
            {answeredCount} of {total} answered
          </span>
          <motion.button
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => onComplete(answers)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
          >
            Submit {answeredCount} answer{answeredCount === 1 ? '' : 's'}
          </motion.button>
        </div>
      )}

      {/* Footer — Something else + Skip */}
      <div className="border-t border-canvas-border flex items-center gap-3 px-5 py-3">
        {!customMode ? (
          <>
            <button
              onClick={() => setCustomMode(true)}
              className="flex-1 flex items-center gap-3 text-left text-[0.75rem] text-ink-400 hover:text-ink-700 transition-colors cursor-pointer"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated shrink-0">
                <Pencil size={12} className="text-ink-400" />
              </span>
              <span>Something else</span>
            </button>
            <button
              onClick={handleSkip}
              className="h-8 px-4 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-ink-700 hover:bg-paper-50 transition-colors cursor-pointer shrink-0"
            >
              Skip
            </button>
          </>
        ) : (
          <>
            <span className="flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated shrink-0">
              <Pencil size={12} className="text-ink-400" />
            </span>
            <input
              type="text"
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); }}
              placeholder="Type your answer..."
              autoFocus
              className="no-focus-ring flex-1 h-8 px-3 rounded-md border border-canvas-border bg-white text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-primary/40"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customText.trim()}
              aria-label="Submit custom answer"
              className="h-8 w-8 flex items-center justify-center rounded-md bg-primary text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-primary-hover transition-colors shrink-0"
            >
              <Send size={13} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
