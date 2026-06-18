import { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { EditClarificationStep } from './types';
import QueryClarificationCard, { type QueryClarificationData } from '../chat/QueryClarificationCard';
import type { AttachmentSelection } from '../chat/DataPickerModal';

interface Props {
  steps: EditClarificationStep[];
  onBack: () => void;
  onComplete: (answers: Record<number, string>) => void;
  // Attach (+) wiring, shared from the journey so the card matches chat.
  onAttach: () => void;
  attachedSources: AttachmentSelection[];
  files: File[];
  onRemoveSource: (index: number) => void;
  onRemoveFile: (index: number) => void;
}

/**
 * Full-page clarification stage shown before the edit editor opens. The page
 * chrome (breadcrumb + hero) is unchanged; the docked card is now the shared
 * QueryClarificationCard so it matches the chat Q&A flow exactly — per-question
 * single/multi pick, Back / Next / Done, type-your-own, "+" attach, no skip
 * (answering is required; the corner ✕ exits back to the concierge).
 */
export default function EditClarificationStage({
  steps,
  onBack,
  onComplete,
  onAttach,
  attachedSources,
  files,
  onRemoveSource,
  onRemoveFile,
}: Props) {
  const [answers, setAnswers] = useState<Record<number, string[]>>({});

  const data: QueryClarificationData = {
    intro: '',
    questions: steps.map((s) => ({ question: s.question, options: s.options })),
    answers,
    status: 'open',
  };

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Top breadcrumb */}
      <div className="px-8 pt-6 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-mono text-[0.75rem] font-semibold text-ink-500 hover:text-brand-600 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to AI Concierge
        </button>
      </div>

      {/* Hero — pinned to top of the chat area */}
      <div className="shrink-0 px-8 pt-12 pb-4 max-w-[860px] mx-auto w-full text-center">
        <div className="inline-flex items-center gap-1.5 text-[0.78125rem] text-ink-500 mb-4">
          <ChevronRight size={13} />
          Asking a few clarifying questions
        </div>
        <h1 className="font-serif text-[2.25rem] tracking-tight text-ink-900 leading-[1.15]">
          One quick check before I edit.{' '}
          <span className="text-ink-500 italic">Pick what fits, or type your own.</span>
        </h1>
      </div>

      {/* Empty chat area — flex spacer (where messages would land) */}
      <div className="flex-1 min-h-0" />

      {/* Bottom dock — shared clarification card */}
      <div className="shrink-0 px-4 sm:px-6 pb-5 max-w-3xl mx-auto w-full">
        <QueryClarificationCard
          data={data}
          onSetAnswer={(qi, ans) => setAnswers((prev) => ({ ...prev, [qi]: ans }))}
          onSubmit={() => {
            const flat: Record<number, string> = {};
            steps.forEach((_, i) => {
              const a = answers[i]?.[0];
              if (a) flat[i] = a;
            });
            onComplete(flat);
          }}
          onCancel={onBack}
          onAttach={onAttach}
          attachedSources={attachedSources}
          files={files}
          onRemoveSource={onRemoveSource}
          onRemoveFile={onRemoveFile}
        />
      </div>
    </div>
  );
}
