import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { concludeRationale, designSuggestion } from './helpers';
import { say, sayOnce, useControlThread } from './controlChat';
import { acknowledge, nextPrompt, type ChatStepId, type Situation } from './controlChatScript';
import { actionsFor, type ChatAction } from './controlChatActions';
import { readIntent } from './controlChatIntents';
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
 *
 * It looks like Ask IRA looks, scaled to 400px — DESIGN.md §7.1. Ira's words
 * are prose, not a bubble: no border, no fill, no avatar, identity carried by
 * left-flush alignment against the reader's tinted pill on the right. That is
 * a house rule, and it also does a job here: once Ira stops speaking in boxes,
 * the only boxed things left in the rail are the buttons, so what can be
 * pressed is finally distinguishable from what has already been said.
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

/** The chat's thinking state, which is a named step and not three dots: the
 *  page's own validation says what it is doing, and so does this. Ask IRA
 *  shows reasoning steps OR pulsing dots, never both — there is one step here,
 *  so the step is what shows, and the dot beside it carries the pulse. */
function WorkingStep({ text }: { text: string }) {
  const still = useReducedMotion();
  return (
    <div className="pl-3 border-l border-canvas-border">
      <div className="flex items-center gap-1.5 text-[0.75rem] text-ink-500">
        <motion.span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
          animate={still ? undefined : { scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} />
        {text}
      </div>
    </div>
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
  const still = useReducedMotion();

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
      {/* 20px between turns, where the 840px thread uses 40 — prose needs the
          room to read as prose, and the rail has half the column to give. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4 space-y-5">
        {thread.map(m => (
          m.who === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="w-fit max-w-[85%] px-3 py-2 rounded-2xl bg-brand-50 text-ink-800 text-[0.8125rem] leading-[1.6] whitespace-pre-wrap break-words">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="text-[0.8125rem] leading-[1.65] text-ink-800">{m.text}</div>
          )
        ))}

        {working && <WorkingStep text={working} />}

        {/* Not a message — the live read on where this control stands. The
            eyebrow names the step rather than the speaker: which step Ira is
            talking about is information, and "Ira" is not, since the voice is
            already carried by the alignment. */}
        {!working && (
          <div>
            <div className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500">
              {STEP_NUM[prompt.step]} {stepLabel}
            </div>
            <div className="text-[0.8125rem] leading-[1.65] text-ink-800">{prompt.text}</div>
            {actions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {actions.map((a, i) => (
                  <motion.button key={a.id + a.label} onClick={() => run(a)}
                    initial={still ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    // The chat's own follow-up card (ChatView `FollowUpCard`),
                    // at rail width. The arrow is the click-scent: it is the
                    // one thing a line of Ira's prose above can never grow.
                    className={cn('group/row w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 rounded-xl border text-[0.8125rem] leading-snug transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      a.primary
                        ? 'bg-brand-50 text-brand-700 border-brand-200 font-semibold hover:bg-brand-100'
                        : 'bg-canvas-elevated text-ink-700 border-canvas-border hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200')}>
                    <span className="flex-1 min-w-0">{a.label}</span>
                    <ArrowRight size={14} className="shrink-0 -translate-x-1 opacity-0 transition-all duration-150 group-hover/row:translate-x-0 group-hover/row:opacity-100" />
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* The chat composer floats on a tinted canvas; this panel is flat white,
          so the hairline stays — it is what stops the thread sliding under the
          input. The rest is §7.1.3: `.ai-border`, and the global focus ring
          suppressed because the border tone is the focus signal. */}
      <div className="p-3 border-t border-canvas-border">
        <div className="ai-border">
          <textarea
            value={draft} onChange={e => setDraft(e.target.value)} rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={!!working} aria-label="Message Ira"
            placeholder={working ? 'One moment…' : 'Ask Ira, or tell it what to do…'}
            className="no-focus-ring w-full bg-transparent border-none outline-none resize-none px-3.5 pt-3 pb-1.5 text-[0.8125rem] leading-[1.5] text-ink-800 placeholder:text-ink-400 disabled:cursor-not-allowed"
          />
          {/* Send is mounted only when there is something to send, as it is in
              the chat. The hint holds the row's height so the composer does
              not grow by 32px under the reader's hands as they start typing. */}
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
            <span className="text-[0.6875rem] text-ink-400 select-none">Enter to send</span>
            {!!draft.trim() && !working && (
              <button onClick={send} aria-label="Send to Ira" title="Send · Enter to send, Shift+Enter for new line"
                className="inline-flex items-center justify-center size-8 rounded-lg bg-primary text-white hover:bg-primary-hover active:bg-brand-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                <ArrowUp size={16} strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
