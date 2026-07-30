// ─── Insight feedback — the signal-back row ─────────────────────────────────
//
// Every full insight card ends with one quiet question: was this useful?
//
// Placement is deliberate. The card header carries STATUS (severity, signed
// pass) and DISPATCH (email); the rating belongs *after* the reasoning, the
// evidence and the fix, because that is the first moment the reader can
// actually judge the finding. A rating control above the fold invites a
// reaction before comprehension, and it crowds a header that already earns its
// keep. Collapsed stack rows carry no rating at all — you cannot rate what you
// have not read.
//
// The two paths are deliberately asymmetric:
//   • Thumbs up is one tap and done. Forcing a form on the positive path
//     collapses response volume, and "this was useful" needs no diagnosis.
//   • Thumbs down opens a compact reason picker, because a bare thumbs-down is
//     a dead-end signal — it says the insight missed without saying which part
//     missed. The reasons are scoped to what can be wrong with a FINDING (its
//     numbers, its cause, its materiality, its fix), not to the chat taxonomy,
//     which rates a written response.
//
// Inline, not modal: these cards live inside slide-overs (Insight detail, the
// engagement stack), and a modal stacked over a drawer is a cost the reader
// pays for nothing. The submit copy and the toast stay identical to the chat
// feedback modal so the product speaks one feedback language across surfaces.
//
// State lives in the shared insight cache (keyed by insight id), not in this
// component, so a rating given on one surface is true on all of them.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import {
  getInsightFeedback, setInsightFeedback, useInsightCacheVersion,
} from './insightCache';
import { useToast } from './Toast';

// What can be wrong with a finding, in the order a reader doubts it: the
// figures, then the explanation, then whether it deserved surfacing at all,
// then whether the fix is usable. "Something else" catches the tail so the
// note field is never the only escape hatch.
const REASONS = [
  'Numbers look wrong',
  'Root cause is off',
  'Not material here',
  'I already knew this',
  "Actions don't fit",
  'Something else',
];

export default function InsightFeedback({
  insightId, className = 'mt-3 pt-2.5 border-t border-canvas-border',
}: {
  insightId: string;
  className?: string;
}) {
  // Subscribe to the shared cache so a rating recorded on another surface (or
  // by a sibling render of the same insight) shows up here without a remount.
  useInsightCacheVersion();
  const recorded = getInsightFeedback(insightId);
  const { addToast } = useToast();

  // The negative path's draft. Open only while the reader is filling it in —
  // submitting or cancelling closes it back to the one-line row.
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const closeForm = () => { setFormOpen(false); setReason(''); setNote(''); };

  // Clicking the lit thumb clears the rating (the standard undo); clicking the
  // other one switches to it.
  const rate = (kind: 'up' | 'down') => {
    if (recorded?.kind === kind) {
      setInsightFeedback(insightId, null);
      closeForm();
      return;
    }
    if (kind === 'up') {
      setInsightFeedback(insightId, { kind: 'up' });
      closeForm();
      return;
    }
    // Negative: record the thumb immediately (so the signal survives an
    // abandoned form) and open the picker to qualify it.
    setInsightFeedback(insightId, { kind: 'down' });
    setReason('');
    setNote('');
    setFormOpen(true);
  };

  const submitDown = () => {
    setInsightFeedback(insightId, {
      kind: 'down',
      reason: reason || undefined,
      note: note.trim() || undefined,
    });
    closeForm();
    addToast({ type: 'success', message: 'Feedback sent. Thanks for telling Ira.' });
  };

  // The left-hand line is the whole conversation: it asks, then it confirms.
  // No subject interpolation — the subject is already the card's headline, and
  // labels like "Risky payments — this answer" collide with the em dash here.
  const status = formOpen
    ? "What's off about this insight?"
    : recorded?.kind === 'up'
      ? 'Marked useful — Ira will favour findings like this.'
      : recorded?.kind === 'down'
        ? recorded.reason
          ? `Noted: ${recorded.reason.toLowerCase()}. Thanks for telling Ira.`
          : 'Noted — thanks for telling Ira.'
        : 'Was this insight useful?';

  const thumbClass = (active: boolean) =>
    `inline-flex items-center justify-center size-7 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
      active ? 'text-brand-700 bg-brand-50' : 'text-ink-300 hover:text-brand-700 hover:bg-brand-50'
    }`;

  return (
    <div
      className={className}
      onKeyDown={(e) => { if (e.key === 'Escape' && formOpen) { e.stopPropagation(); closeForm(); } }}
    >
      <div className="flex items-center gap-2">
        <p aria-live="polite" className="min-w-0 flex-1 text-[0.71875rem] text-ink-500 leading-snug">
          {recorded && !formOpen && (
            <Check size={11} className="inline-block mr-1 -mt-px text-compliant" aria-hidden="true" />
          )}
          {status}
        </p>
        <button
          type="button" onClick={() => rate('up')}
          aria-pressed={recorded?.kind === 'up'}
          aria-label="Mark this insight useful"
          title={recorded?.kind === 'up' ? 'Undo' : 'Mark this insight useful'}
          className={thumbClass(recorded?.kind === 'up')}
        >
          <ThumbsUp size={13} aria-hidden="true" />
        </button>
        <button
          type="button" onClick={() => rate('down')}
          aria-pressed={recorded?.kind === 'down'}
          aria-label="Mark this insight not useful"
          title={recorded?.kind === 'down' && !formOpen ? 'Undo' : 'Mark this insight not useful'}
          className={thumbClass(recorded?.kind === 'down')}
        >
          <ThumbsDown size={13} aria-hidden="true" />
        </button>
      </div>

      {/* The negative path, qualified inline. Single-select reasons + one
          optional line — anything longer and the reader abandons it. */}
      <AnimatePresence initial={false}>
        {formOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              role="radiogroup" aria-label="What's off about this insight?"
              className="mt-2 flex flex-wrap gap-1.5"
            >
              {REASONS.map(r => {
                const picked = reason === r;
                return (
                  <button
                    key={r} type="button" role="radio" aria-checked={picked}
                    onClick={() => setReason(picked ? '' : r)}
                    className={`rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      picked
                        ? 'border-brand-400 bg-brand-50 text-brand-700'
                        : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-brand-300 hover:text-brand-700'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                aria-label="Add a note about this insight (optional)"
                className="no-focus-ring min-w-0 flex-1 h-8 rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 text-[0.75rem] text-ink-800 placeholder:text-ink-400 outline-none hover:border-ink-300 focus:border-brand-400 transition-colors"
              />
              <button
                type="button" onClick={closeForm}
                className="inline-flex items-center h-8 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-ink-800 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Cancel
              </button>
              <button
                type="button" onClick={submitDown}
                className="inline-flex items-center h-8 px-3 rounded-md text-[0.75rem] font-semibold bg-primary text-white hover:bg-primary-hover active:bg-brand-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Send feedback
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
