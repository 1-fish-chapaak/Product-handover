import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Plus, FileText, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AttachmentSelection } from './DataPickerModal';

// Query-clarification shape — distinct from the workflow ClarificationData
// because query questions can be multiple-choice. Answers are stored as a
// string[] per question, and each question carries an optional `multi` flag.
export interface QueryClarificationData {
  intro: string;
  questions: { question: string; options: string[]; multi?: boolean }[];
  answers: Record<number, string[]>;
  status: 'open' | 'submitted';
  purpose?: 'audit-query' | 'save-workflow';
}

// ─── Query clarification card (multi-select, navigated) ──────────────────────
// Supports per-question multi-select (checkboxes) vs single-select (radio),
// explicit Back / Next / Done navigation, a "Question X of Y" count, and no
// skip — answering is required to advance. The corner ✕ cancels the whole card
// (nothing runs). Shared by the chat query flow, the in-chat workflow builder,
// and the edit-workflow-in-chat flow.
export default function QueryClarificationCard({
  data, onSetAnswer, onSubmit, onCancel, onAttach, attachedSources, files, onRemoveSource, onRemoveFile,
}: {
  data: QueryClarificationData;
  onSetAnswer: (qIndex: number, answers: string[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onAttach: () => void;
  attachedSources: AttachmentSelection[];
  files: File[];
  onRemoveSource: (index: number) => void;
  onRemoveFile: (index: number) => void;
}) {
  const total = data.questions.length;
  const firstUnanswered = data.questions.findIndex((_, i) => !(data.answers[i]?.length));
  const [viewIndex, setViewIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [highlighted, setHighlighted] = useState(0);
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef(customInput);
  customInputRef.current = customInput;
  // Pin the whole card to the tallest question seen so its height never changes
  // as you step Next/Back. We measure the rendered height and keep the running
  // max; shorter questions are floored to it, and a flex spacer tucks the slack
  // below the answers (above the Back/Next row).
  const cardRef = useRef<HTMLDivElement>(null);
  const [pinnedHeight, setPinnedHeight] = useState(0);

  const safeIndex = Math.min(viewIndex, total - 1);
  const viewQ = total > 0 ? data.questions[safeIndex] : null;
  const selected = data.answers[safeIndex] ?? [];
  const isMulti = !!viewQ?.multi;
  const answeredCurrent = selected.length > 0;
  const isLast = safeIndex === total - 1;
  const canBack = safeIndex > 0;

  // Fixed height — reserve the answer area to fit the question with the most
  // options, so the card stays one height across the whole set (it never jumps
  // as you step Next/Back). Shorter questions just pad the bottom; nothing
  // scrolls. ~2.5rem per option row (py-2.5 + one line of 0.875rem text).
  const maxOptionCount = Math.max(...data.questions.map(q => q.options.length), 1);
  const answerAreaMinHeight = `${maxOptionCount * 2.5}rem`;

  // Render the question's options plus any selected custom answers (typed via
  // "Type something else") so those show up as checked rows too.
  const displayOptions = viewQ
    ? [...viewQ.options, ...selected.filter(s => !viewQ.options.includes(s))]
    : [];
  const optionCount = displayOptions.length;

  // Reset highlight + custom input when the viewed question changes.
  useEffect(() => {
    setHighlighted(0);
    setCustomInput('');
  }, [safeIndex]);

  function toggleOption(opt: string) {
    if (!viewQ) return;
    if (isMulti) {
      onSetAnswer(safeIndex, selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
    } else {
      // Single-select (radio): pick replaces; can't deselect by re-clicking.
      onSetAnswer(safeIndex, [opt]);
    }
  }

  function addCustom() {
    const v = customInputRef.current.trim();
    if (!v) return;
    if (isMulti) {
      if (!selected.includes(v)) onSetAnswer(safeIndex, [...selected, v]);
    } else {
      onSetAnswer(safeIndex, [v]);
    }
    setCustomInput('');
  }

  function goNext() {
    const pending = customInputRef.current.trim();
    if (pending) addCustom();
    if ((answeredCurrent || pending) && !isLast) setViewIndex(safeIndex + 1);
  }
  function goBack() { if (canBack) setViewIndex(safeIndex - 1); }
  function done() {
    if (!isLast) return;
    const pending = customInputRef.current.trim();
    if (pending) {
      addCustom();
      setTimeout(() => onSubmit(), 0);
    } else if (answeredCurrent) {
      onSubmit();
    }
  }

  // Keyboard: ↑/↓ highlight, 1-9 toggle, Enter picks the highlight then
  // advances (Next / Done), Esc cancels.
  useEffect(() => {
    if (data.status === 'submitted' || !viewQ) return;
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inMainTextarea = active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && active !== inputRef.current);
      const inOurInput = active === inputRef.current;
      if (e.key === 'ArrowDown') { if (inMainTextarea) return; e.preventDefault(); setHighlighted(h => Math.min(h + 1, optionCount - 1)); }
      else if (e.key === 'ArrowUp') { if (inMainTextarea) return; e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
      // Smart Enter: if nothing is picked yet, Enter ticks the highlighted
      // answer (keeps keyboard selection); once an answer is picked, Enter
      // advances — Next, or Done on the last question.
      else if (e.key === 'Enter' && !inMainTextarea && !inOurInput) {
        e.preventDefault();
        if (answeredCurrent) { if (isLast) done(); else goNext(); }
        else if (displayOptions[highlighted]) { toggleOption(displayOptions[highlighted]); }
      }
      else if (e.key === 'Escape') { if (inMainTextarea) return; e.preventDefault(); if (inOurInput) { setCustomInput(''); } else { onCancel(); } }
      else if (/^[1-9]$/.test(e.key) && !inMainTextarea && !inOurInput) { const n = parseInt(e.key, 10) - 1; if (n < optionCount) { e.preventDefault(); toggleOption(displayOptions[n]); } }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, safeIndex, optionCount, data.status, isMulti, selected]);

  // Measure after layout (pre-paint, so no flicker) and grow the pinned floor to
  // the tallest question. minHeight is a floor, so a taller question still grows
  // the card (and the floor); shorter ones hold the max via the spacer.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    setPinnedHeight(prev => (h > prev ? h : prev));
  }, [safeIndex, optionCount, isMulti, attachedSources.length, files.length]);

  if (data.status === 'submitted') {
    return <div className="text-[0.8125rem] text-ink-700 leading-relaxed">Got it. Running with these inputs.</div>;
  }
  if (!viewQ) return null;

  return (
    <div className="space-y-2.5">
      <div
        ref={cardRef}
        style={pinnedHeight ? { minHeight: `${pinnedHeight}px` } : undefined}
        className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden flex flex-col"
      >
        {/* Header — question count + close on top, then the question */}
        <div className="px-5 pt-3.5 pb-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[0.75rem] font-medium text-ink-500 tabular-nums">Question {safeIndex + 1} of {total}</span>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close clarification"
              title="Close — cancels this question set"
              className="inline-flex items-center justify-center size-7 -mr-1 rounded-md text-ink-500 hover:bg-brand-50 hover:text-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 shrink-0"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-[0.9375rem] font-semibold leading-[1.4] text-ink-900 break-words" title={viewQ.question}>{viewQ.question}</p>
          {isMulti && <p className="mt-0.5 text-[0.71875rem] font-medium text-ink-400">Select all that apply</p>}
        </div>

        {/* Options — checkbox rows */}
        <div role={isMulti ? 'group' : 'radiogroup'} aria-label={viewQ.question} className="py-1 flex-1 flex flex-col">
          {/* Reserve the answer area for the question with the most options so
              option-count differences don't move the answers; the card-level
              pin + spacer below absorb any remaining (wording-length) slack. */}
          <div style={{ minHeight: answerAreaMinHeight }}>
          {displayOptions.map((opt, idx) => {
            const isChecked = selected.includes(opt);
            const isHighlighted = highlighted === idx;
            return (
              <button
                key={opt}
                type="button"
                role={isMulti ? 'checkbox' : 'radio'}
                aria-checked={isChecked}
                onClick={() => toggleOption(opt)}
                onMouseEnter={() => setHighlighted(idx)}
                className={`group/opt relative w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset ${
                  isChecked ? 'bg-brand-50' : isHighlighted ? 'bg-brand-50/50' : 'hover:bg-brand-50/30'
                }`}
              >
                {/* Marker — square checkbox for multi-select, round radio for single */}
                <span
                  aria-hidden="true"
                  className={`inline-flex items-center justify-center size-[18px] border-2 shrink-0 transition-colors ${isMulti ? 'rounded-[5px]' : 'rounded-full'} ${
                    isChecked ? 'bg-brand-600 border-brand-600 text-white' : 'bg-canvas-elevated border-canvas-border group-hover/opt:border-brand-300'
                  }`}
                >
                  {isChecked && (isMulti
                    ? <Check size={12} strokeWidth={3} />
                    : <span className="size-1.5 rounded-full bg-white" />)}
                </span>
                <span className={`flex-1 text-[0.875rem] leading-snug transition-colors ${isChecked ? 'text-ink-900 font-medium' : 'text-ink-800'}`}>
                  {opt}
                </span>
              </button>
            );
          })}
          </div>

          {/* Attachments added via the + below — these ride along with the answers */}
          {(attachedSources.length > 0 || files.length > 0) && (
            <div className="flex items-center gap-1.5 overflow-x-auto px-5 pt-3 pb-1">
              {attachedSources.map((s, i) => (
                <div
                  key={`src-${i}`}
                  title={s.kind === 'source' ? s.name : undefined}
                  className="flex items-center gap-1.5 bg-brand-50 text-ink-700 text-[0.75rem] px-2 py-1 rounded-md font-medium border border-brand-100 shrink-0"
                >
                  {s.kind === 'source' && (
                    <>
                      <span className="text-[0.625rem] uppercase font-semibold tracking-[0.06em] text-ink-500">{s.type === 'database' ? 'DB' : s.type === 'api' ? 'API' : s.type === 'cloud' ? 'CLOUD' : s.type === 'session' ? 'SESS' : 'FILE'}</span>
                      <span className="truncate max-w-[10rem]">{s.name}</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveSource(i)}
                    className="text-ink-400 hover:text-ink-800 hover:bg-brand-100 ml-0.5 p-0.5 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={`Remove ${s.kind === 'source' ? s.name : 'attachment'}`}
                  ><X size={11} /></button>
                </div>
              ))}
              {files.map((f, i) => (
                <div
                  key={`file-${i}`}
                  title={f.name}
                  className="flex items-center gap-2 bg-canvas-elevated text-ink-800 text-[0.8125rem] pl-2 pr-1.5 py-1.5 rounded-lg font-medium border border-canvas-border shrink-0"
                >
                  <span className="inline-flex items-center justify-center size-6 rounded bg-brand-50 text-brand-700 shrink-0"><FileText size={13} /></span>
                  <span className="truncate max-w-[10rem]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(i)}
                    className="text-ink-400 hover:text-brand-700 hover:bg-brand-50 ml-0.5 p-0.5 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={`Remove ${f.name}`}
                  ><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Spacer — tucks the pinned-height slack below the answers so the
              Back/Next row stays at the bottom and the card holds one size. */}
          <div className="flex-1" aria-hidden="true" />

          {/* Input row — the only input while a clarification is open (the chat
              composer is hidden). "+" attaches data/files; typing adds a custom
              answer to this question. */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-canvas-border">
            <button
              type="button"
              onClick={onAttach}
              aria-label="Attach data sources or files"
              title="Attach data or files"
              className="inline-flex items-center justify-center size-8 rounded-lg text-ink-500 hover:bg-brand-50 hover:text-ink-800 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Plus size={18} strokeWidth={2} />
            </button>
            <input
              ref={inputRef}
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customInputRef.current.trim()) { e.preventDefault(); e.stopPropagation(); addCustom(); } }}
              placeholder="Type something else…"
              className="no-focus-ring flex-1 bg-transparent text-[0.875rem] text-ink-800 placeholder:text-ink-400 outline-none h-8"
            />
            {/* Back / Next (or Done) live here in the input row — no separate footer */}
            <div className="flex items-center gap-2 shrink-0 ml-1">
              <button
                type="button"
                onClick={goBack}
                disabled={!canBack}
                className="inline-flex items-center gap-1 h-8 pl-2 pr-3 rounded-lg text-[0.8125rem] font-medium text-ink-600 hover:bg-brand-50 hover:text-ink-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <ChevronLeft size={15} /> Back
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={done}
                  disabled={!answeredCurrent && !customInput.trim()}
                  title={answeredCurrent ? undefined : 'Pick an answer to continue'}
                  className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-[0.8125rem] font-semibold text-white bg-primary hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!answeredCurrent && !customInput.trim()}
                  title={answeredCurrent ? undefined : 'Pick an answer to continue'}
                  className="inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-lg text-[0.8125rem] font-semibold text-white bg-primary hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Next <ChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
