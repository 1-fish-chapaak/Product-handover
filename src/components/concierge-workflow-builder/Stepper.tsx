export type JourneyStep = 1 | 2 | 3 | 4;

const STEPS: { id: JourneyStep; label: string }[] = [
  { id: 1, label: 'Describe' },
  { id: 2, label: 'Upload' },
  { id: 3, label: 'Map' },
  { id: 4, label: 'Review' },
];

interface Props {
  current: JourneyStep;
  completed: Set<JourneyStep>;
  onJump?: (step: JourneyStep) => void;
}

export default function Stepper({ current, completed, onJump }: Props) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const isCurrent = s.id === current;
        const isDone = completed.has(s.id) && !isCurrent;
        const isJumpable = isDone || s.id < current;

        return (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isJumpable && !isCurrent}
              onClick={() => isJumpable && onJump?.(s.id)}
              className={[
                'flex items-center gap-2 rounded-full px-2 py-1 transition-colors',
                isJumpable && !isCurrent ? 'cursor-pointer hover:bg-brand-50' : '',
                !isJumpable && !isCurrent ? 'cursor-not-allowed' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0',
                  isCurrent
                    ? 'bg-brand-600 text-white'
                    : isDone
                      ? 'bg-compliant text-white'
                      : 'bg-canvas border border-canvas-border text-ink-400',
                ].join(' ')}
              >
                {s.id}
              </span>
              <span
                className={[
                  'text-[12px] font-semibold',
                  isCurrent ? 'text-brand-700' : isDone ? 'text-ink-700' : 'text-ink-400',
                ].join(' ')}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className={`h-px w-6 ${isDone ? 'bg-compliant/40' : 'bg-canvas-border'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
