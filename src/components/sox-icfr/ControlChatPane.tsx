import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Send } from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { concludeRationale, designSuggestion } from './helpers';
import { say, useControlThread } from './controlChat';
import { nextPrompt, type ChatStepId } from './controlChatScript';
import { actionsFor, type ChatAction } from './controlChatActions';
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
 * Every button below calls the store function the page's own button calls.
 * Nothing is reimplemented here, so nothing can drift — and the heavy actions
 * (attaching a file, waiving an element, writing the reviewer's note) do not
 * even try: they scroll the real thing into view on the left.
 *
 * The composer is deliberately inert until the typed intents land (step 5).
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
/** The anchors the stepper already renders — see the <VStep id=…> props. */
const STEP_ANCHOR: Record<ChatStepId, string> = {
  design: 'vstep-design', population: 'vstep-population', sample: 'vstep-sample',
  operating: 'vstep-toe', signoff: 'vstep-signoff',
};
/** The same beat the page's own validation takes (VALIDATE_MS). Ira is not
 *  faster than the button beside it — the wait is part of what it means. */
const IRA_MS = 6000;

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {[0, 0.15, 0.3].map((d, i) => (
        <motion.span key={i} className="w-1 h-1 rounded-full bg-ink-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: d, ease: 'easeInOut' }} />
      ))}
    </span>
  );
}

export default function ControlChatPane({ control }: { control: Control }) {
  const { eng, role, me, openAuditId, runDesignIra, concludeDesign, overrideDesign, approveDesign } = useIcfr();
  const logEvent = useAuditLog();
  const audit = useMemo(() => eng.audits.find(a => a.id === openAuditId) ?? null, [eng.audits, openAuditId]);
  const prompt = useMemo(() => nextPrompt({ eng, control, role, me, audit }), [eng, control, role, me, audit]);
  const actions = useMemo(() => actionsFor(prompt.situation, role), [prompt.situation, role]);
  const thread = useControlThread(control.id);
  const [working, setWorking] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [thread, prompt.key, working]);

  // A validation left running when the reader walks away must not come back
  // and write to a control they are no longer looking at.
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const run = (a: ChatAction) => {
    if (working) return;
    say(control.id, 'user', a.said);

    if (a.id === 'show-step') {
      const step = a.focus ?? prompt.step;
      document.getElementById(STEP_ANCHOR[step])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      say(control.id, 'ira', `It’s on the left — ${STEP_NUM[step]} ${STEP_LABEL[step]}.`);
      return;
    }

    if (a.id === 'ira-run') {
      setWorking('Reading the evidence against each check');
      timer.current = window.setTimeout(() => {
        runDesignIra(control.id);
        logEvent({ action: 'Update', description: `Ran AI validation on design checks for ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
        setWorking(null);
      }, IRA_MS);
      return;
    }

    if (a.id === 'conclude-effective' || a.id === 'conclude-ineffective') {
      // The page's ConcludeFooter fires TWO store calls, and so must this one:
      // the conclusion, then either an override recording that it went against
      // the evidence, or a null clearing a stale one. Concluding from the chat
      // without the second call leaves the override banner lying.
      const target = a.id === 'conclude-effective' ? 'Effective' : 'Ineffective';
      const rationale = control.design.rationale ?? concludeRationale(control, 'design');
      const suggestion = designSuggestion(control);
      concludeDesign(control.id, target, rationale);
      logEvent({ action: 'Update', description: `Concluded TOD ${target.toLowerCase()} for ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
      if (suggestion !== 'Not tested' && target !== suggestion) {
        overrideDesign(control.id, { result: target, by: me, at: 'just now', rationale });
        say(control.id, 'ira', `Recorded ${target.toLowerCase()} against the evidence, which pointed to ${suggestion.toLowerCase()}. Your rationale is on the paper as the reason.`);
      } else {
        overrideDesign(control.id, null);
      }
      return;
    }

    if (a.id === 'approve-design') {
      approveDesign(control.id);
      logEvent({ action: 'Update', description: `Approved the design conclusion for ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
      return;
    }
  };

  // The owner does not test the design, so their step ① is called Documents —
  // same exception the stepper makes on the left.
  const stepLabel = role === 'risk-owner' && prompt.step === 'design' ? 'Documents' : STEP_LABEL[prompt.step];

  return (
    <>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
        {thread.map(m => (
          <div key={m.id} className={cn(m.who === 'user' ? 'ml-auto max-w-[85%]' : 'mr-auto max-w-[92%]')}>
            <div className={cn(m.who === 'user'
              ? 'rounded-xl rounded-br-md bg-brand-600 text-white px-3 py-2 text-[0.75rem] leading-relaxed'
              : 'subcard px-3 py-2.5 text-[0.75rem] leading-relaxed text-ink-700')}>
              {m.text}
            </div>
          </div>
        ))}

        {working && (
          <div className="mr-auto max-w-[92%]">
            <div className="subcard px-3 py-2.5 text-[0.75rem] leading-relaxed text-ink-500">
              {working} <TypingDots />
            </div>
          </div>
        )}

        {/* Not a message — the live read on where this control stands. */}
        {!working && (
          <div className="mr-auto max-w-[92%]">
            <div className="flex items-center gap-1.5 mb-1 text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400">
              <Sparkles size={11} className="text-brand-500" />
              Ira · {STEP_NUM[prompt.step]} {stepLabel}
            </div>
            <div className="subcard px-3 py-2.5 text-[0.75rem] leading-relaxed text-ink-700">{prompt.text}</div>
            {actions.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {actions.map(a => (
                  <button key={a.id + a.label} onClick={() => run(a)}
                    // Filled brand is what the READER said — the purple bubble
                    // above. An offer that wears the same clothes as a sent
                    // message reads as already-done, so the lead action is a
                    // tinted outline instead of a second purple block.
                    className={cn('w-full text-left rounded-[10px] px-3 py-2 text-[0.75rem] border transition-colors cursor-pointer',
                      a.primary
                        ? 'border-brand-300 bg-brand-50 text-brand-700 font-semibold hover:bg-brand-100'
                        : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-brand-300 hover:text-brand-700')}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
