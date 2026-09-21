import { motion, useReducedMotion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import type { UpdateSegment, UpdateSegmentId } from '../../../data/dashboardUpdate';

/** Mode switch of the Update-dashboard dialog — a segmented control, not
 *  sequential steps. The active segment is a white thumb that slides between
 *  segments; a segment shows a spinner while it has work in flight and a green
 *  check once its action landed this visit. */
export default function UpdateDashboardStepper({ step, segments, onStepChange }: {
  step: UpdateSegmentId;
  segments: UpdateSegment[];
  onStepChange: (step: UpdateSegmentId) => void;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div role="tablist" aria-label="Update mode" className="inline-flex items-center gap-1 bg-canvas border border-canvas-border rounded-lg p-1" data-testid="update-dashboard-stepper">
      {segments.map(segment => {
        const active = step === segment.id;
        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onStepChange(segment.id)}
            className={`relative px-3 h-7 rounded-md text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors ${active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-900'}`}
            data-testid={`stepper-${segment.id}`}
          >
            {active && (
              <motion.span
                layoutId="update-dash-segment-thumb"
                className="absolute inset-0 bg-canvas-elevated rounded-md shadow-sm"
                transition={prefersReduced ? { duration: 0 } : { type: 'spring', bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {segment.label}
              {segment.busy && <Loader2 size={13} strokeWidth={2.5} className="animate-spin text-brand-600" />}
              {segment.complete && !segment.busy && <Check size={14} strokeWidth={3} className="text-compliant-700" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
