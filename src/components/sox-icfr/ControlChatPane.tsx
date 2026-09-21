import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Send } from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { concludeRationale, designSuggestion } from './helpers';
import { say, sayOnce, useControlThread } from './controlChat';
import { acknowledge, nextPrompt, type ChatStepId, type Situation } from './controlChatScript';
import { actionsFor, type ChatAction } from './controlChatActions';
import { readIntent } from './controlChatIntents';
import { Button } from '../shared/Button';
import { cn } from '../../lib/cn';
import type { Control } from './types';

/**
 * Ira, sitting beside the control rather than inside it.
 *
 * The thread is what has been SAID; the last bubble is not in it. That bubble
 * is `nextPrompt(...)` computed fresh on every render, so it always describes
 * the control as it stands right now — attach a document on the left and the
 * line rewrites itself, because it was never a stored message in the first
 * place, and the effect below gives the change a voice: what just happened in
 * the past tense, then what to do next.
 *
 * Every button below calls the store function the page's own button calls.
 * Nothing is reimplemented here, so nothing can drift — and the heavy actions
 * (attaching a file, waiving an element, writing the reviewer's note) do not
 * even try: they scroll the real thing into view on the left.
 *
 * The composer carries the same actions in words. A sentence is matched to
 * one of the buttons on offer and then runs the identical call — typing is
 * another way to press what is there, never a way round a gate.
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
  const { eng, role, me, openAuditId, runDesignIra, concludeDesign, overrideDesign, approveDesign, setDesignPoint } = useIcfr();
  const logEvent = useAuditLog();
  const audit = useMemo(() => eng.audits.find(a => a.id === openAuditId) ?? null, [eng.audits, openAuditId]);
  const prompt = useMemo(() => nextPrompt({ eng, control, role, me, audit }), [eng, control, role, me, audit]);
  const actions = useMemo(() => actionsFor(prompt.situation, role), [prompt.situation, role]);
  const thread = useControlThread(control.id);
  const [working, setWorking] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [thread, prompt.key, working]);

  // A validation left running when the reader walks away must not come back
  // and write to a control they are no longer looking at.
  /** The control as it stands now, for anything that resolves on a timer. */
  const latest = useRef(control);
  latest.current = control;
  const controlId = useRef(control.id);
  controlId.current = control.id;

  const timer = useRef<number | null>(null);
  // The pane unmounts when the rail's tab changes, which used to cancel a
  // running validation in silence — the reader came back to their own request
  // sitting there with no answer and no error. It still cancels (the work is
  // the reader's to re-ask for), but it says so, and the thread outlives the
  // pane so the line is there when they come back.
  useEffect(() => () => {
    if (!timer.current) return;
    window.clearTimeout(timer.current);
    say(controlId.current, 'ira', 'I stopped reading when you moved away — ask again and I will pick it up.');
  }, []);

  // ── Ira keeps up ──────────────────────────────────────────────────────────
  // The whole of decision 4, in one effect. Something moved on this control —
  // a tick on the left, a button in here, the reviewer's approval landing —
  // and the situation is no longer the one Ira last spoke about. Say what
  // changed, once, and let the prompt below carry what happens next.
  //
  // It cannot tell the two sides apart and does not need to: both write to the
  // same control, so both arrive here as the same diff. Keyed on the situation
  // itself, so a re-render cannot say it twice and a change cannot be missed.
  const seen = useRef<{ id: string; s: Situation } | null>(null);
  /** Set when the chat has already said what changed in better words. */
  const skipAck = useRef(false);
  useEffect(() => {
    const prev = seen.current;
    seen.current = { id: control.id, s: prompt.situation };
    // First look at this control — the greeting is the opening line, not a
    // report of changes made while the reader was elsewhere.
    if (!prev || prev.id !== control.id || prev.s.key === prompt.situation.key) return;
    if (skipAck.current) { skipAck.current = false; return; }
    const note = acknowledge(prev.s, prompt.situation);
    if (note) sayOnce(control.id, `ack:${prompt.situation.key}`, note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control.id, prompt.key]);

  /** Do the thing. Called by a button press and by a typed sentence alike —
   *  which is the point: typing is another way to press what is on offer, not
   *  a second set of rules. The reader's own line is posted by the caller,
   *  because a button says `a.said` and a typed sentence says itself. */
  const perform = (a: ChatAction) => {
    if (a.id === 'show-step') {
      const step = a.focus ?? prompt.step;
      document.getElementById(STEP_ANCHOR[step])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      say(control.id, 'ira', `It’s on the left — ${STEP_NUM[step]} ${STEP_LABEL[step]}.`);
      return;
    }

    if (a.id === 'ira-run') {
      setWorking('Reading the evidence against each check');
      timer.current = window.setTimeout(() => {
        // Six seconds is long enough for the left-hand side to move. The store
        // refuses to run once the design is concluded, and logging regardless
        // would have written a validation into the SOX audit trail that never
        // happened — so the CURRENT control is read here, not the one captured
        // when the button was pressed.
        const now = latest.current;
        if (now.design.conclusion !== 'Not tested' || now.design.points.length === 0) {
          setWorking(null);
          say(now.id, 'ira', 'The design was concluded while I was reading, so I stopped — there is nothing left for me to assess.');
          return;
        }
        runDesignIra(now.id);
        logEvent({ action: 'Update', description: `Ran AI validation on design checks for ${now.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
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
      // Going against the evidence is recorded as an override, and the
      // acknowledgement says so — the diff effect below owns that line, so it
      // reads the same whether the conclusion came from here or from the page.
      if (suggestion !== 'Not tested' && target !== suggestion) overrideDesign(control.id, { result: target, by: me, at: 'just now', rationale });
      else overrideDesign(control.id, null);
      // Say whose words went on the paper. Concluding from here cannot see the
      // rationale box on the left — it is local to that form until it is filed
      // — so what gets recorded is the drafted sentence. Calling that "your
      // rationale" would put words in an auditor's mouth on a working paper,
      // which is the one thing this rail must never do.
      if (!control.design.rationale) {
        say(control.id, 'ira', `The rationale on the paper is the drafted one — “${rationale}” — because the box on the left was not filled in. Edit it there if it should read differently.`);
      }
      return;
    }

    if (a.id === 'approve-design') {
      approveDesign(control.id);
      logEvent({ action: 'Update', description: `Approved the design conclusion for ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
      return;
    }
  };

  const run = (a: ChatAction) => {
    if (working) return;
    say(control.id, 'user', a.said);
    perform(a);
  };

  // ── typed, and understood as far as it honestly can be ────────────────────
  const send = () => {
    const text = draft.trim();
    if (!text || working) return;
    say(control.id, 'user', text);
    setDraft('');
    const intent = readIntent(text, { control, s: prompt.situation, role, actions, promptText: prompt.text });
    if (intent.kind === 'action') {
      if (intent.note) say(control.id, 'ira', intent.note);
      perform(intent.action);
      return;
    }
    if (intent.kind === 'mark') {
      setDesignPoint(control.id, intent.pointId, intent.result);
      logEvent({ action: 'Update', description: `Marked a design check ${intent.result.toLowerCase()} on ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
      // This names WHICH check moved, because the reader named it and deserves
      // to see the right one answered. The diff effect's generic "1 check
      // marked" would only repeat it, so it stands down for this one change.
      skipAck.current = true;
      say(control.id, 'ira', `Marked ${intent.label} ${intent.result === 'Pass' ? 'passed' : 'failed'}.`);
      return;
    }
    say(control.id, 'ira', intent.text);
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
            value={draft} onChange={e => setDraft(e.target.value)} rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={!!working}
            placeholder={working ? 'One moment…' : 'Ask Ira, or tell it what to do…'}
            className="flex-1 text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none disabled:bg-paper-50 disabled:cursor-not-allowed"
          />
          {/* The shared Button, not a hand-rolled one: it brings the pressed
              state and the focus ring this rail had no way to grow on its own,
              and forces the accessible name an icon-only button was missing.
              The platform convention for a faded-rather-than-grey disabled
              primary is the `disabled:!` block — see ShareModal. */}
          <Button
            variant="primary" size="md" iconOnly shape="lg"
            disabled={!draft.trim() || !!working} onClick={send} aria-label="Send to Ira"
            className="shrink-0 hover:!bg-brand-700 !shadow-none disabled:!bg-primary disabled:!text-white disabled:!opacity-40"
          >
            <Send size={15} />
          </Button>
        </div>
      </div>
    </>
  );
}
