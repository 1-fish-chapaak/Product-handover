import { useEffect, useMemo, useRef } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { useIcfr } from './store';
import { useControlThread } from './controlChat';
import { nextPrompt, type ChatStepId } from './controlChatScript';
import { cn } from '../../lib/cn';
import type { Control } from './types';

/**
 * Ira, sitting beside the control rather than inside it.
 *
 * The thread is what has been SAID; the last bubble is not in it. That bubble
 * is `nextPrompt(...)` computed fresh on every render, so it always describes
 * the control as it stands right now — attach a document on the left and the
 * line rewrites itself, because it was never a stored message in the first
 * place. Step 4 gives that change a voice ("got it, that's the last one");
 * until then it simply keeps up quietly.
 *
 * The composer is deliberately inert until the typed intents land (step 5). A
 * box that accepts a sentence and then does nothing with it is worse than one
 * that says it is not listening yet.
 */

/** The step names as the page prints them, so Ira and the left-hand stepper
 *  never call the same step two different things. */
const STEP_LABEL: Record<ChatStepId, string> = {
  design: 'Test of design',
  population: 'Population',
  sample: 'Sample drawing',
  operating: 'Test of effectiveness',
  signoff: 'Final',
};
const STEP_NUM: Record<ChatStepId, string> = {
  design: '①', population: '②', sample: '③', operating: '④', signoff: '⑤',
};

export default function ControlChatPane({ control }: { control: Control }) {
  const { eng, role, me, openAuditId } = useIcfr();
  const audit = useMemo(() => eng.audits.find(a => a.id === openAuditId) ?? null, [eng.audits, openAuditId]);
  const prompt = useMemo(() => nextPrompt({ eng, control, role, me, audit }), [eng, control, role, me, audit]);
  const thread = useControlThread(control.id);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [thread, prompt.key]);

  // The owner does not test the design, so their step ① is called Documents —
  // same exception the stepper makes on the left.
  const stepLabel = role === 'risk-owner' && prompt.step === 'design' ? 'Documents' : STEP_LABEL[prompt.step];

  return (
    <>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
        {thread.map(m => (
          <div key={m.id} className={cn('max-w-[92%]', m.who === 'user' ? 'ml-auto max-w-[85%]' : 'mr-auto')}>
            <div className={cn(m.who === 'user'
              ? 'rounded-xl rounded-br-md bg-brand-600 text-white px-3 py-2 text-[0.75rem] leading-relaxed'
              : 'subcard px-3 py-2.5 text-[0.75rem] leading-relaxed text-ink-700')}>
              {m.text}
            </div>
          </div>
        ))}

        {/* Not a message — the live read on where this control stands. */}
        <div className="max-w-[92%] mr-auto">
          <div className="flex items-center gap-1.5 mb-1 text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400">
            <Sparkles size={11} className="text-brand-500" />
            Ira · {STEP_NUM[prompt.step]} {stepLabel}
          </div>
          <div className="subcard px-3 py-2.5 text-[0.75rem] leading-relaxed text-ink-700">{prompt.text}</div>
        </div>
      </div>

      <div className="p-3 border-t border-canvas-border">
        <div className="flex items-end gap-2">
          <textarea
            disabled rows={2}
            placeholder="Ask Ira what to do next…"
            className="flex-1 text-[0.75rem] rounded-lg border border-canvas-border bg-paper-50 px-2.5 py-2 text-ink-800 placeholder:text-ink-400 resize-none disabled:cursor-not-allowed"
          />
          <button
            disabled
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
