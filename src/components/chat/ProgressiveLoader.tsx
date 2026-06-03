import { useState, useEffect, useRef, type ElementType } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Sparkles } from 'lucide-react';

interface LoadingStep {
  label: string;
  title: string;
  content: string;
  icon: ElementType;
  type: 'plan' | 'code' | 'sources' | 'result';
}

interface ProgressiveLoaderProps {
  steps: LoadingStep[];
  onComplete: () => void;
  activeArtifactTab?: string;
  onTabClick?: (tab: string) => void;
}

const ACCENT_COLORS: Record<LoadingStep['type'], string> = {
  plan:    'bg-brand-600',
  code:    'bg-evidence',
  sources: 'bg-compliant',
  result:  'bg-brand-600',
};

const ACCENT_TEXT: Record<LoadingStep['type'], string> = {
  plan:    'text-brand-700',
  code:    'text-evidence',
  sources: 'text-compliant',
  result:  'text-brand-700',
};

const STEP_DELAY_MS = 2000;

export default function ProgressiveLoader({
  steps,
  onComplete,
  activeArtifactTab,
  onTabClick,
}: ProgressiveLoaderProps) {
  const [completedCount, setCompletedCount] = useState(0);
  const completedRef = useRef(false);
  const onTabClickRef = useRef(onTabClick);
  onTabClickRef.current = onTabClick;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (steps.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step, idx) => {
      const timer = setTimeout(() => {
        setCompletedCount((prev) => {
          const next = prev + 1;
          // Auto-switch artifact tab to the next step being loaded (or current completing)
          if (onTabClickRef.current) {
            // When a step completes, switch tab to the NEXT step (which is now loading)
            // When last step completes, stay on 'result'
            if (next < steps.length) {
              onTabClickRef.current(steps[next].type);
            } else {
              onTabClickRef.current(step.type);
            }
          }
          if (next === steps.length && !completedRef.current) {
            completedRef.current = true;
            // Fire onComplete after a brief pause so the last card animates in
            setTimeout(() => onCompleteRef.current(), 400);
          }
          return next;
        });
      }, STEP_DELAY_MS * (idx + 1));
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  const activeIndex = completedCount; // 0-indexed step currently loading

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, idx) => {
        const StepIcon = step.icon;
        const isCompleted = idx < completedCount;
        const isActive = idx === activeIndex && !isCompleted;
        const isUpcoming = idx > activeIndex;

        // Hide upcoming steps entirely
        if (isUpcoming) return null;

        return (
          <motion.div
            key={step.type}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            layout
          >
            {isActive ? (
              /* Currently loading step */
              <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
                <div className="flex">
                  <div className={`w-1 shrink-0 ${ACCENT_COLORS[step.type]}`} />
                  <div className="flex-1 p-4">
                    {/* Loading header */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 2,
                          ease: 'linear',
                        }}
                      >
                        <Sparkles
                          size={16}
                          className={ACCENT_TEXT[step.type]}
                        />
                      </motion.div>
                      <span className="text-[0.8125rem] font-medium text-text-muted">
                        {step.label}
                      </span>
                    </div>

                    {/* Skeleton placeholder */}
                    <div className="space-y-2.5">
                      <div className="h-3 rounded-full bg-surface-2 animate-pulse w-4/5" />
                      <div className="h-3 rounded-full bg-surface-2 animate-pulse w-3/5" />
                      <div className="h-3 rounded-full bg-surface-2 animate-pulse w-2/3" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Completed step — collapsed or expanded */
              <AnimatePresence mode="wait">
                <motion.div
                  key={`completed-${step.type}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  onClick={() => onTabClick?.(step.type)}
                  className={`rounded-xl border overflow-hidden transition-colors ${
                    activeArtifactTab === step.type
                      ? 'border-brand-200'
                      : 'border-canvas-border'
                  } bg-canvas-elevated cursor-pointer hover:border-brand-200`}
                >
                  <div className="flex">
                    <div
                      className={`w-1 shrink-0 ${ACCENT_COLORS[step.type]}`}
                    />
                    <div className="flex-1 p-4">
                      {/* Completed header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <StepIcon
                            size={15}
                            className={ACCENT_TEXT[step.type]}
                          />
                          <span className="text-[0.8125rem] font-semibold text-text">
                            {step.title}
                          </span>
                        </div>
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-compliant-50">
                          <Check
                            size={11}
                            className="text-compliant"
                            strokeWidth={3}
                          />
                        </div>
                      </div>

                      {/* Content preview */}
                      <p className="text-[0.75rem] text-text-muted leading-relaxed line-clamp-2">
                        {step.content}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
