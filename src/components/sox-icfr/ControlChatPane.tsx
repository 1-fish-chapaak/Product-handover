import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUp, Paperclip, Plus, Sparkles, Square } from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import {
  auditSampling, concludeRationale, designOutstanding, designSuggestion, draftSamplePrompt, extractionCriteria,
  fileUsable, guessFileKind, itgcHolds, narrowedCount, operatingSuggestion, populationFrom, populationSources,
  readRowCount, readSamplePrompt, sampleSizeGuide, sampledSources, seedKeyOf, trackResult, workingAudit,
} from './helpers';
import { useAuditFiles } from './useAuditFiles';
import { OriginPicker } from './parts';
import { ROUND_TAG } from './types';
import { sampleRefs } from './mockData';
import { DESIGN_RUN_STEPS, TOE_RUN_STEPS, endRun, say, sayOnce, startRun, useControlRun, useControlThread, type RunStep } from './controlChat';
import { useTypewriter } from '../chat/reveal/useTypewriter';
import { acknowledge, listOf, nextPrompt, type ChatStepId, type PopFile, type Situation } from './controlChatScript';
import { actionsFor, type ChatAction, type ChatActionId } from './controlChatActions';
import { readIntent } from './controlChatIntents';
import { mapEvidence, type EvidenceMatch } from './controlChatEvidence';
import { cn } from '../../lib/cn';
import type { Control, DesignDocKind, FileOrigin, TestResult } from './types';

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
/** What to ask for each IPE dimension — the page's own textarea placeholders,
 *  so the chat asks for exactly what the working paper will print. */
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const IPE_ASK: Record<string, string> = {
  'Source & parameters': 'What did the parameter screen show, and how does it agree to the test scope?',
  'Period coverage': 'What span does the extract hold, and what accounts for any empty month inside the period?',
  Completeness: 'What did the tie-out show — the numbers, and the variance if there is one?',
  Accuracy: 'Which records did you vouch, to what, and what did you find?',
};

/** What a wrap of chips is a set OF. Every `pick` group used to sit under
 *  "Add an element", which was true of the first one built and of none of the
 *  four added since — a column of filenames captioned "Add an element" reads
 *  as a bug, because it is one. */
const PICK_CAPTION: Partial<Record<ChatActionId, string>> = {
  'add-element': 'Add an element',
  'pick-source': 'Draw it off',
  'upload-evidence': 'Or one attribute at a time',
  'ipe-check': 'Pick a check',
  'draw-sample': 'Draw off',
};

/** The same beat the page's own validation takes (VALIDATE_MS). Ira is not
 *  faster than the button beside it — the wait is part of what it means. */
const IRA_MS = 6000;
/** And the attribute run's own beat — the page's `runAll` takes 2400ms. */
const TOE_MS = 2400;
/** The draw's own, straight off the card: `setTimeout(…, 1800)`. */
const DRAW_MS = 1800;
const DRAW_RUN_STEPS = [
  'Reading the ask against the locked population',
  'Selecting the items on this file’s seed',
  'Dealing them across the audit window',
];
/** And the extract's, off the form's own `setTimeout(…, 1500)`. */
const EXTRACT_MS = 1500;
const EXTRACT_RUN_STEPS = [
  'Opening the file and reading what is in it',
  'Applying the filter you agreed',
  'Counting what this control actually operated on',
];

/** Ira's mark — the house AI gradient, at rail scale.
 *
 *  brand-500 → fuchsia-500 on the diagonal with a soft purple cast under it,
 *  which is the one gradient this product spends on "a machine did this": the
 *  Ask IRA header avatar, the One-Click Audit chip, the smart-queries card.
 *  DESIGN.md forbids decorative gradient everywhere else, and that prohibition
 *  is what makes this one legible as a signature rather than as decoration. */
function IraMark({ size = 20, running = false }: { size?: number; running?: boolean }) {
  const still = useReducedMotion();
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {running && !still && (
        <motion.span aria-hidden className="absolute inset-0 rounded-md bg-brand-400"
          animate={{ scale: [1, 1.45], opacity: [0.45, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }} />
      )}
      <span className="relative inline-flex items-center justify-center w-full h-full rounded-md bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-[0_0_10px_rgba(163,102,240,0.45)]">
        <Sparkles size={Math.round(size * 0.58)} strokeWidth={2.25} />
      </span>
    </span>
  );
}

/**
 * The working trail — what Ira is doing, one step at a time.
 *
 * Lifted from the flagship chat's live trail (`ChatView.tsx:7526-7567`): a
 * left rule, one row per step, and the ONLY running/done signal is the dot —
 * `bg-primary` on the live step, `bg-brand-200` on the ones behind it, with a
 * trailing ellipsis on the live one. No ticks, no strikes; a checklist that
 * ticks itself would promise a precision this read does not have.
 *
 * It replaces a single static line. One line said "something is happening";
 * four say what is being read and in what order, which is the difference
 * between a spinner and an agent showing its work.
 */
function WorkingTrail({ label, steps }: { label: string; steps: RunStep[] }) {
  const still = useReducedMotion();
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <IraMark size={18} running />
        <span className="text-[0.75rem] font-semibold text-ink-700">{label}</span>
      </div>
      <div className="pl-3 border-l border-canvas-border space-y-1" aria-live="polite" aria-label="Working">
        {steps.map((s, i) => {
          const live = i === steps.length - 1;
          return (
            <motion.div key={s.id}
              initial={still ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="text-[0.75rem] text-ink-500 flex items-start gap-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]', live ? 'bg-primary' : 'bg-brand-200')} aria-hidden />
              <span className="min-w-0">{s.label}{live ? '…' : ''}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Ira's words, typed rather than posted.
 *
 * The house typewriter (`chat/reveal/useTypewriter`) — the same per-character
 * pace, the same beat after a full stop, the same caret the flagship chat
 * blinks. Only the NEWEST line types; everything above it is history and
 * history does not re-perform itself every time the reader opens the tab.
 *
 * The caret is `.ai-caret` — the 2px brand-600 bar DESIGN.md specifies by the
 * millimetre ("blinks once per 1.2s with steps(1) — square, not sine"). The
 * flagship renders a `▌` glyph instead because its prose goes through markdown;
 * this rail prints plain text, so it can use the real thing.
 */
function IraText({ text, stream, onDone }: { text: string; stream: boolean; onDone?: (done: boolean) => void }) {
  // Half the flagship's 9ms. Its column is 66ch of prose the reader is meant
  // to sit and watch; this one is a 400px rail where the reader is waiting to
  // press something, and the buttons below wait for the sentence to land.
  const { shown, done } = useTypewriter(text, { enabled: stream, baseDelay: 4 });
  // Whoever owns the turn decides what may appear once Ira has finished
  // speaking — offering the buttons mid-sentence reads as a form, not a reply.
  useEffect(() => { onDone?.(done); }, [done, onDone]);
  return (
    <div className="text-[0.8125rem] leading-[1.65] text-ink-800 whitespace-pre-wrap break-words">
      {shown}{!done && <span className="ai-caret" aria-hidden />}
    </div>
  );
}

export default function ControlChatPane({ control }: { control: Control }) {
  const { eng, role, me, openAuditId, addDesignDoc, runDesignIra, concludeDesign, overrideDesign, approveDesign, setDesignPoint, overrideDesignPoint,
    setIpeCheck, concludeIpe, uploadRequiredFile, drawSourceSample, approveSource, lockPopulation, concludeOperating, overrideOperating, signOffControlWp,
    setStepResult, overrideStep, validateReadyAttributes, registerFile, setPopulation } = useIcfr();
  const logEvent = useAuditLog();
  const audit = useMemo(() => eng.audits.find(a => a.id === openAuditId) ?? null, [eng.audits, openAuditId]);
  // The audit's own files, read exactly as the source picker on the left reads
  // them: `ofAudit` only — everything the engagement merely holds is not
  // evidence somebody put here, and a rail offering it would be a second
  // opinion about what this audit is allowed to draw on.
  const auditFiles = useAuditFiles();
  const popFiles = useMemo<PopFile[]>(
    () => auditFiles.filter(f => f.ofAudit).map(f => ({ name: f.name, rows: f.rows, system: f.system, from: f.from, usable: fileUsable(f) })),
    [auditFiles],
  );
  const prompt = useMemo(() => nextPrompt({ eng, control, role, me, audit, files: popFiles }), [eng, control, role, me, audit, popFiles]);
  const actions = useMemo(() => actionsFor(prompt.situation, role), [prompt.situation, role]);
  // Two shapes, one list: next steps are stacked rows, a set to choose from is
  // a wrap of chips. Split here rather than in the action map, because it is a
  // fact about how the rail draws them, not about what they do.
  const rows = useMemo(() => actions.filter(a => !a.group), [actions]);
  const pairs = useMemo(() => actions.filter(a => a.group === 'pair'), [actions]);
  const picks = useMemo(() => actions.filter(a => a.group === 'pick'), [actions]);
  const thread = useControlThread(control.id);
  // Not local state: the page's own "Run AI validation" starts the same run,
  // and the reader's rule is that it narrates here (22 Sep). One run, one
  // place it is spoken about, whichever button started it.
  const liveRun = useControlRun(control.id);
  const working = liveRun?.label ?? null;
  const [draft, setDraft] = useState('');
  // A check Ira has already answered cannot be flipped from here without a
  // reason either (user ask, 22 Sep) — the page asks for it in a form, so the
  // chat asks for it in the only way a chat can: it holds the mark, asks, and
  // takes the next thing typed as the rationale.
  const [awaitingWhy, setAwaitingWhy] = useState<{ kind: 'point' | 'attribute'; id: string; label: string; result: TestResult } | null>(null);
  // One IPE dimension, mid-test. The page will not take a Pass or a Fail until
  // the finding is written — "a failure nobody wrote down is not one" — so the
  // chat asks in the same order: the finding first, the verdict after. `note`
  // null means Ira is still waiting to be told what was found.
  const [ipeDraft, setIpeDraft] = useState<{ checkId: string; dimension: string; note: string | null } | null>(null);
  // A pile of files, mapped but not yet filed. Shown before anything is
  // written: the auditor signs a paper saying this evidence proves that
  // attribute, so they see what went where first.
  const [pile, setPile] = useState<EvidenceMatch[] | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pickFor = useRef<string | undefined>(undefined);
  // A draw in progress. `refs` null while the ask is still being settled; set
  // once the items are out and waiting to be looked at. The page holds exactly
  // the same two things between its own two stages.
  const [draw, setDraw] = useState<{ sourceId: string; file: string; ask: string; refs: string[] | null } | null>(null);
  // The extract, mid-flight, in the order the page asks its questions.
  //  `origin`   — a file has been handed over and Ira is waiting to be told
  //               where it came from. It is not registered until that is
  //               answered: provenance is asked once, at the door, and a file
  //               nobody can place is not a source you can build a test on.
  //  `criteria` — the file is settled and the filter is being agreed.
  const [extract, setExtract] = useState<
    | { stage: 'origin'; name: string; rows: number }
    | { stage: 'criteria'; file: PopFile; ask: string }
    | null
  >(null);
  const srcPicker = useRef<HTMLInputElement>(null);
  const still = useReducedMotion();

  // The id of the newest Ira line AS OF the render that first saw it. A message
  // that was already on screen when the pane re-rendered must not start typing
  // again, so this is set once per new id and never recomputed from the array.
  // ── local state answers to the control, not the other way round ──────────
  // The two mid-question states below are the only things in this pane that
  // are not derived, and that is exactly where it broke (user report, 22 Sep):
  // the reader answered an IPE dimension ON THE PAGE and Ira carried on asking
  // them for it in here. A question whose answer has already been given is not
  // a question, wherever it was answered — so both are reconciled against the
  // control every render and dropped the moment they are stale. Render-phase
  // setState on purpose: it is derived state, and waiting for an effect would
  // paint one frame of the wrong question.
  if (draw && populationSources(control).find(x => x.id === draw.sourceId)?.draw) setDraw(null);
  // The same rule for the extract: a population that landed — from here, or
  // from the form on the left while this was half-answered — settles the
  // question, so the question goes.
  if (extract && control.operating.population) setExtract(null);
  const liveIpeCheck = ipeDraft ? control.operating.ipe?.checks.find(k => k.id === ipeDraft.checkId) : undefined;
  if (ipeDraft && (!liveIpeCheck || liveIpeCheck.result !== 'Not tested')) setIpeDraft(null);
  if (awaitingWhy) {
    const settled = awaitingWhy.kind === 'point'
      ? control.design.points.find(p => p.id === awaitingWhy.id)
      : control.operating.steps.find(x => x.id === awaitingWhy.id);
    if (!settled) setAwaitingWhy(null);
  }

  const latestIra = useRef<string | null>(null);
  const lastMsg = thread[thread.length - 1];
  if (lastMsg?.who === 'ira' && lastMsg.id !== latestIra.current) latestIra.current = lastMsg.id;

  // Has Ira finished saying the live line? The buttons under it wait on this,
  // so a turn reads as "it speaks, then it offers" rather than a sentence
  // being typed beneath a row of controls that were already there.
  const [saidIt, setSaidIt] = useState(false);
  useEffect(() => { setSaidIt(false); }, [prompt.key]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [thread, prompt.key, working, saidIt]);

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
    // Only a run THIS pane started is cancelled here — `timer` is the proof of
    // ownership. One the page started keeps its own clock and its own ending.
    endRun(controlId.current);
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

  // ── ② the extract, in three acts ──────────────────────────────────────────
  // The page asks the same three questions in the same order: which file, where
  // did it come from (once, at the door), and what to take out of it. None of
  // it is reimplemented — `readRowCount`, `narrowedCount` and `populationFrom`
  // are the form's own, moved into helpers so both doors read from one.

  /** Act three's opening: the filter, drafted exactly as the box on the left
   *  drafts it, and then the reader's to change. */
  const beginCriteria = (file: PopFile) => {
    const ask = extractionCriteria(control, audit?.windowFrom ?? '', audit?.windowTo ?? '', { system: file.system, name: file.name });
    setExtract({ stage: 'criteria', file, ask });
    say(control.id, 'ira', `${file.name} — ${file.rows.toLocaleString('en-IN')} rows. Here is the filter I would run:\n\n“${ask}”\n\nSend it as it stands, or type what to take instead. The population is what this control actually operated on, not the whole file.`);
  };

  /** A file handed over. Nothing is registered yet — provenance comes first. */
  const pickedSource = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    // Already here. Registering it again would overwrite the record — and with
    // it somebody's answer about where it came from — so it does not.
    const known = popFiles.find(x => x.name === f.name);
    if (known) {
      if (known.usable) {
        say(control.id, 'ira', `${f.name} is already on this audit, so I have not added it twice.`);
        beginCriteria(known);
      } else {
        say(control.id, 'ira', `${f.name} is already on this audit, but nobody has said where it came from — and a population cannot stand on a file nobody can place. That is answered on the file itself, under Configuration, and then this one is ready to draw off.`);
      }
      return;
    }
    const rows = readRowCount(f.name);
    setExtract({ stage: 'origin', name: f.name, rows });
    say(control.id, 'ira', `${f.name} — I read ${rows.toLocaleString('en-IN')} rows in it.\n\nBefore it can be a population, where did this file come from? It is asked once and recorded on the file, so nothing that reads it later has to ask again.`);
  };

  /** Provenance answered: the file joins the audit, and the filter is next. */
  const landFile = (origin: FileOrigin) => {
    if (extract?.stage !== 'origin') return;
    const { name, rows } = extract;
    // The page's own call, argument for argument — a file landed from here is
    // indistinguishable from one landed through the modal on the left.
    registerFile({ name, kind: guessFileKind(name), rows, from: `Uploaded on ${control.id}`, uploadedBy: me, uploadedAt: 'just now', origin, originBy: me, originAt: 'just now' });
    logEvent({ action: 'Upload', description: `Added "${name}" to the audit's files from ${control.id} from the chat — ${origin.toLowerCase()}, ${rows.toLocaleString()} rows`, module: 'SOX ICFR', entity: 'Evidence' });
    say(control.id, 'user', origin);
    say(control.id, 'ira', `On the audit’s files — ${origin.toLowerCase()}. Every other control can draw on it now without being asked again.`);
    beginCriteria({ name, rows, from: `Uploaded on ${control.id}`, usable: true });
  };

  /** Act three: run it. The form's own beat, the form's own arithmetic. */
  const runExtract = (ask: string) => {
    if (extract?.stage !== 'criteria') return;
    const file = extract.file;
    const criteria = ask.trim() || 'No filter applied';
    setExtract({ stage: 'criteria', file, ask: criteria });
    startRun(control.id, `Filtering ${file.rows.toLocaleString('en-IN')} rows in ${file.name}`, EXTRACT_RUN_STEPS, EXTRACT_MS);
    timer.current = window.setTimeout(() => {
      const now = latest.current;
      endRun(now.id);
      // Six seconds is long enough for the left to move, and so is one and a
      // half: the form may have extracted while this was running, and a second
      // population written over the first would be a filter nobody agreed to.
      if (now.operating.population) {
        say(now.id, 'ira', 'A population landed on the left while I was filtering, so I stopped — yours is the one on the paper.');
        return;
      }
      const count = narrowedCount(now, file);
      setExtract(null);
      setPopulation(now.id, populationFrom(now, file, criteria, count, {
        version: `POP-${audit ? ROUND_TAG[audit.round] : 'v1'}`, me,
        from: audit?.windowFrom ?? '', to: audit?.windowTo ?? '',
      }));
      logEvent({ action: 'Run', description: `Extracted the population for ${now.id} from the chat — ${count.toLocaleString()} instances from ${file.rows.toLocaleString()} rows in ${file.name}`, module: 'SOX ICFR', entity: 'Evidence' });
      skipAck.current = true;
      say(now.id, 'ira', `${count.toLocaleString('en-IN')} instances, filtered out of ${file.rows.toLocaleString('en-IN')} rows in ${file.name}. The filter is on the paper in the words you agreed.`);
    }, EXTRACT_MS);
  };

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

    // Setting up the design step. The page's own Add-element menu calls this
    // with the same argument, so an element added from here is indistinguishable
    // from one added on the left — which is the point of doing it at all.
    if (a.id === 'add-element' && a.arg) {
      addDesignDoc(control.id, a.arg as DesignDocKind);
      logEvent({ action: 'Create', description: `Added the ${a.arg} design element to ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
      return;
    }

    // Start one dimension of the IPE test. Ira restates what is being proven
    // and how, because the assertion and the method are what the finding has
    // to answer — asking "what did you find?" without them is asking a
    // question the reader has to go and look up on the left.
    // Open the picker. `arg` scopes it to one attribute; without it the pile is
    // mapped across every attribute that is short of something.
    if (a.id === 'upload-evidence') {
      pickFor.current = a.arg;
      picker.current?.click();
      return;
    }

    // ── ② the source data ───────────────────────────────────────────────────
    // A separate picker from the evidence one, with the page's own accept list
    // — a population is filtered out of rows, and a PDF has none.
    if (a.id === 'upload-source') { srcPicker.current?.click(); return; }

    if (a.id === 'pick-source' && a.arg) {
      const file = popFiles.find(f => f.name === a.arg);
      if (!file) return;
      beginCriteria(file);
      return;
    }

    // ── the draw, stage one ────────────────────────────────────────────────
    if (a.id === 'draw-sample' && a.arg) {
      const src = sampledSources(populationSources(control)).find(x => x.id === a.arg);
      if (!src) return;
      const guide = sampleSizeGuide(control, itgcHolds(eng, control));
      const ask = draftSamplePrompt(src, guide.suggested, workingAudit(eng, openAuditId));
      setDraw({ sourceId: src.id, file: src.file, ask, refs: null });
      say(control.id, 'ira', `I have drafted the ask:\n\n“${ask}”\n\nThe sizing table says ${guide.suggested} for this one — band ${guide.range}. Send it as it stands, or type a different ask and I will read that instead.`);
      return;
    }

    if (a.id === 'tick-sample' && a.arg) {
      approveSource(control.id, a.arg, 'sample', true);
      logEvent({ action: 'Update', description: `Marked the sample done for a source file on ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Test Result' });
      return;
    }

    if (a.id === 'ipe-check' && a.arg) {
      const k = control.operating.ipe?.checks.find(x => x.id === a.arg);
      if (!k) return;
      setIpeDraft({ checkId: k.id, dimension: k.dimension, note: null });
      say(control.id, 'ira', `${k.dimension} — ${k.description}\n\nHow to prove it: ${k.method}\n\n${IPE_ASK[k.dimension] ?? 'What did you find?'}`);
      return;
    }

    if (a.id === 'ipe-reliable' || a.id === 'ipe-unreliable') {
      concludeIpe(control.id, a.id === 'ipe-reliable' ? 'Reliable' : 'Not reliable');
      logEvent({ action: 'Update', description: `Concluded the report ${a.id === 'ipe-reliable' ? 'reliable' : 'not reliable'} for ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Evidence' });
      return;
    }

    if (a.id === 'ira-run') {
      startRun(control.id, 'Reading the evidence against each check', DESIGN_RUN_STEPS, IRA_MS);
      timer.current = window.setTimeout(() => {
        // Six seconds is long enough for the left-hand side to move. The store
        // refuses to run once the design is concluded, and logging regardless
        // would have written a validation into the SOX audit trail that never
        // happened — so the CURRENT control is read here, not the one captured
        // when the button was pressed.
        const now = latest.current;
        endRun(now.id);
        // The store's own refusals, re-read at the moment of writing rather
        // than at the moment of asking — including the required element that
        // may have been removed while I was reading, which now stops the run
        // outright instead of failing every check on its absence.
        const gone = designOutstanding(now).filter(doc => doc.required !== false);
        if (now.design.conclusion !== 'Not tested' || now.design.points.length === 0) {
          say(now.id, 'ira', 'The design was concluded while I was reading, so I stopped — there is nothing left for me to assess.');
          return;
        }
        if (gone.length > 0) {
          say(now.id, 'ira', `${listOf(gone.map(d => (d.kind === 'Custom' ? d.name : d.kind)))} came off the control while I was reading, so I stopped — the checks are read against the evidence, and that is no longer on file.`);
          return;
        }
        runDesignIra(now.id);
        logEvent({ action: 'Update', description: `Ran AI validation on design checks for ${now.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
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

    if (a.id === 'toe-run') {
      // The page's own beat for this run (runAll, 2400ms) — shorter than the
      // design one because it reads uploaded files rather than the whole
      // evidence set, and Ira is not faster than the button beside it.
      startRun(control.id, 'Reading the uploaded files against each attribute', TOE_RUN_STEPS, TOE_MS);
      timer.current = window.setTimeout(() => {
        const now = latest.current;
        endRun(now.id);
        if (trackResult(now.operating) !== 'Not tested') {
          say(now.id, 'ira', 'The testing was concluded while I was reading, so I stopped — the attributes are settled.');
          return;
        }
        validateReadyAttributes(now.id);
        logEvent({ action: 'Run', description: `Ran AI validation on the ready attributes for ${now.id} from the chat`, module: 'SOX ICFR', entity: 'Test Result' });
      }, TOE_MS);
      return;
    }

    if (a.id === 'lock-population') {
      lockPopulation(control.id);
      logEvent({ action: 'Update', description: `Locked the population for ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Evidence' });
      return;
    }

    if (a.id === 'conclude-op-effective' || a.id === 'conclude-op-ineffective') {
      // The operating footer fires two calls exactly as the design one does —
      // the conclusion, then either an override recording that it went against
      // the evidence or a null clearing a stale one. Missing the second leaves
      // the override banner on the page telling the reviewer a lie.
      const target = a.id === 'conclude-op-effective' ? 'Effective' : 'Ineffective';
      const rationale = control.operating.rationale ?? concludeRationale(control, 'operating');
      const suggestion = operatingSuggestion(control);
      concludeOperating(control.id, target, rationale);
      logEvent({ action: 'Update', description: `Concluded TOE ${target.toLowerCase()} for ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
      if (suggestion !== 'Not tested' && target !== suggestion) overrideOperating(control.id, { result: target, by: me, at: 'just now', rationale });
      else overrideOperating(control.id, null);
      if (!control.operating.rationale) {
        say(control.id, 'ira', `The rationale on the paper is the drafted one — “${rationale}” — because the box on the left was not filled in. Edit it there if it should read differently.`);
      }
      return;
    }

    if (a.id === 'sign-paper' || a.id === 'countersign') {
      const step = a.id === 'sign-paper' ? 'preparer' : 'reviewer';
      signOffControlWp(control.id, step);
      logEvent({ action: 'Update', description: `${step === 'preparer' ? 'Signed off' : 'Countersigned'} the working paper for ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
      return;
    }
  };

  const run = (a: ChatAction) => {
    if (working) return;
    say(control.id, 'user', a.said);
    perform(a);
  };

  /** Interrupt. Only a run THIS pane started has a timer to clear — one the
   *  page started owns its own clock, so stopping it here would end the
   *  narration while the work carried on writing to the control. */
  /** Stage one → two. The same 1800ms the page takes, the same `sampleRefs` on
   *  the same plan — the rail is not a faster way to draw a sample, it is
   *  another door onto the one that exists. */
  const runDraw = (ask: string) => {
    if (!draw) return;
    const src = sampledSources(populationSources(control)).find(x => x.id === draw.sourceId);
    if (!src) { setDraw(null); return; }
    const audit = workingAudit(eng, openAuditId);
    const plan = readSamplePrompt(ask, src, sampleSizeGuide(control, itgcHolds(eng, control)).suggested, audit, auditSampling(audit));
    setDraw({ ...draw, ask });
    startRun(control.id, `Drawing ${plan.size} of ${src.count.toLocaleString('en-IN')} from ${src.file}`, DRAW_RUN_STEPS, DRAW_MS);
    timer.current = window.setTimeout(() => {
      const now = latest.current;
      endRun(now.id);
      const refs = sampleRefs(now.process, plan.size);
      setDraw(d => (d ? { ...d, refs } : d));
      say(now.id, 'ira', `${plan.reading}. Here they are — look them over before I file them.`);
    }, DRAW_MS);
  };

  /** Stage two → filed. Both calls the page makes, in the page's order. */
  const fileDraw = () => {
    if (!draw?.refs) return;
    const src = sampledSources(populationSources(control)).find(x => x.id === draw.sourceId);
    if (!src) { setDraw(null); return; }
    const audit = workingAudit(eng, openAuditId);
    const agreed = auditSampling(audit);
    const plan = readSamplePrompt(draw.ask, src, sampleSizeGuide(control, itgcHolds(eng, control)).suggested, audit, agreed);
    // The same five-digit reperformance number the card computes, off the same
    // string — a reviewer walking the paper has to land on these items.
    const seed = 10000 + (`${seedKeyOf(control)}·${src.id}·${openAuditId ?? ''}`.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 17) % 89999);
    const refs = draw.refs;
    setDraw(null);
    drawSourceSample(control.id, src.id, { size: refs.length, method: agreed.method, seed, prompt: draw.ask.trim() || undefined, ...(plan.months ? { months: plan.months } : {}) }, refs);
    logEvent({ action: 'Update', description: `Approved the sample from ${src.file} for ${control.id} from the chat — ${refs.length} items, ${agreed.method.toLowerCase()}, seed ${seed}`, module: 'SOX ICFR', entity: 'Test Result' });
  };

  /** Files chosen. Map them, say what landed where, and wait to be told to file
   *  — the mapper is confident, not certain, and it is not its paper. */
  const picked = (list: FileList | null) => {
    const scope = pickFor.current;
    pickFor.current = undefined;
    if (!list || list.length === 0) return;
    const names = Array.from(list).map(f => f.name);
    const matches = mapEvidence(control, names, scope);
    setPile(matches);
    const placed = matches.filter(m => m.slot);
    const lost = matches.filter(m => !m.slot);
    const lines = placed.map(m => `· ${m.name} → ${m.slot!.code} ${m.slot!.label}${m.score < 30 ? ' (a guess — say so if it is wrong)' : ''}${m.slot!.taken ? ' — replaces what is there' : ''}`);
    say(control.id, 'ira', placed.length === 0
      ? `${plural(names.length, 'file')}, and I could not place ${names.length === 1 ? 'it' : 'any of them'} against what these attributes ask for. Name the attribute and I will put ${names.length === 1 ? 'it' : 'them'} there.`
      : `${plural(names.length, 'file')}. Here is where each one goes:\n${lines.join('\n')}${lost.length ? `\n\nI could not place ${listOf(lost.map(m => m.name))}.` : ''}`);
  };

  /** File the pile. One `uploadRequiredFile` per match — the same call the
   *  page's own per-slot picker makes, so a file landed from here is
   *  indistinguishable from one landed on the left. */
  const fileThePile = () => {
    if (!pile) return;
    const placed = pile.filter(m => m.slot);
    setPile(null);
    placed.forEach(m => {
      uploadRequiredFile(control.id, m.slot!.stepId, m.slot!.fileId, m.name);
      logEvent({ action: 'Upload', description: `Uploaded ${m.name} as "${m.slot!.label}" for attribute ${m.slot!.code} (${control.id}) from the chat`, module: 'SOX ICFR', entity: 'Evidence' });
    });
  };

  /** The verdict on the dimension whose finding is already recorded. */
  const settleIpe = (result: TestResult) => {
    if (!ipeDraft?.note) return;
    const { checkId, dimension, note } = ipeDraft;
    setIpeDraft(null);
    say(control.id, 'user', `${dimension} ${result === 'Pass' ? 'passes' : 'fails'}.`);
    setIpeCheck(control.id, checkId, { result, note });
    logEvent({ action: 'Update', description: `Marked the report's ${dimension.toLowerCase()} ${result.toLowerCase()} on ${control.id} from the chat — ${note}`, module: 'SOX ICFR', entity: 'Evidence' });
  };

  const stop = () => {
    if (!timer.current) return;
    window.clearTimeout(timer.current);
    timer.current = null;
    endRun(control.id);
    say(control.id, 'ira', 'Stopped. Nothing was written — ask again and I will read it from the top.');
  };

  // ── typed, and understood as far as it honestly can be ────────────────────
  const send = () => {
    const text = draft.trim();
    if (!text || working) return;
    say(control.id, 'user', text);
    setDraft('');

    // Mid-sentence: the last thing said was "tell me why", so this is the why.
    // Not parsed, not matched against anything — a rationale is whatever the
    // auditor wrote, and second-guessing it would be the one place this rail
    // must not have an opinion.
    // Mid-test on one IPE dimension: this is the finding. Like a rationale it
    // is not parsed and not second-guessed — it is what the auditor wrote, and
    // it goes on the working paper in their words.
    // Mid-draw and the items are not out yet: this is the ask.
    if (draw && draw.refs === null) {
      if (/^(no|not now|later|skip|cancel|stop|never ?mind|leave it)\b/i.test(text) && text.length < 40) {
        setDraw(null);
        say(control.id, 'ira', 'Left the draw alone.');
        return;
      }
      runDraw(text);
      return;
    }

    // Mid-extract. Where it came from is a closed question with two answers, so
    // it is matched rather than taken as prose — writing "probably the client"
    // onto a file record as its provenance would be a fact nobody stated.
    if (extract?.stage === 'origin') {
      if (/^(no|not now|later|skip|cancel|stop|never ?mind|leave it)\b/i.test(text) && text.length < 40) {
        setExtract(null);
        say(control.id, 'ira', `Left ${extract.name} alone — it is not on the audit, so nothing reads it.`);
        return;
      }
      const o: FileOrigin | null = /system|export|sap|pulled|extract(ed)? from/i.test(text) ? 'System export'
        : /client|prepared|sent|they (gave|sent)|manual|spreadsheet/i.test(text) ? 'Client-prepared'
        : null;
      if (!o) {
        say(control.id, 'ira', 'One of the two, and it matters: a system export is the system’s own record of itself, a client-prepared file has been through somebody’s hands. Press one above, or say which.');
        return;
      }
      landFile(o);
      return;
    }

    // Mid-extract, on the filter: this is the filter. Not parsed — it is the
    // sentence the reviewer will read, in the auditor's words.
    if (extract?.stage === 'criteria') {
      if (/^(no|not now|later|skip|cancel|stop|never ?mind|leave it)\b/i.test(text) && text.length < 40) {
        setExtract(null);
        say(control.id, 'ira', 'Left the extraction alone. The file is still on the audit whenever you want it.');
        return;
      }
      runExtract(text);
      return;
    }

    if (ipeDraft && ipeDraft.note === null) {
      // …unless they are plainly backing out. Everything typed here goes on a
      // working paper, and "not now, next step" filed as an audit finding is
      // the one outcome that would make this whole flow untrustworthy. A short
      // line that reads as a retreat drops the question instead of answering it.
      if (/^(no|not now|later|skip|cancel|stop|never ?mind|leave it|not needed|next step|start next|move on)\b/i.test(text) && text.length < 40) {
        setIpeDraft(null);
        say(control.id, 'ira', `Left ${ipeDraft.dimension.toLowerCase()} open — nothing recorded against it.`);
        return;
      }
      setIpeCheck(control.id, ipeDraft.checkId, { note: text });
      setIpeDraft({ ...ipeDraft, note: text });
      say(control.id, 'ira', `On the paper. Does ${ipeDraft.dimension.toLowerCase()} pass or fail on that?`);
      return;
    }

    if (awaitingWhy) {
      const { kind, id, label, result } = awaitingWhy;
      setAwaitingWhy(null);
      const override = { result, by: me, at: 'just now', rationale: text };
      if (kind === 'point') overrideDesignPoint(control.id, id, override);
      else overrideStep(control.id, id, override);
      logEvent({ action: 'Update', description: `Overrode ${label} to ${result.toLowerCase()} on ${control.id} from the chat — ${text}`, module: 'SOX ICFR', entity: 'Test Result' });
      skipAck.current = true;
      say(control.id, 'ira', `Recorded. ${label.charAt(0).toUpperCase()}${label.slice(1)} now reads ${result === 'Pass' ? 'passed' : 'failed'}, with your reason on the paper beside it.`);
      return;
    }

    const intent = readIntent(text, { control, s: prompt.situation, role, actions, promptText: prompt.text });
    if (intent.kind === 'action') {
      if (intent.note) say(control.id, 'ira', intent.note);
      perform(intent.action);
      return;
    }
    if (intent.kind === 'mark') {
      // The page makes the same demand at the tick: contradicting Ira is a
      // judgement, and a judgement on a working paper carries a reason. Asking
      // for it here rather than writing silently is what keeps the two sides
      // telling the reviewer the same story.
      const point = control.design.points.find(p => p.id === intent.pointId);
      const iraSaid = point?.validation?.result;
      if (iraSaid && iraSaid !== intent.result) {
        setAwaitingWhy({ kind: 'point', id: intent.pointId, label: intent.label, result: intent.result });
        say(control.id, 'ira', `I read that one as ${iraSaid === 'Pass' ? 'a pass' : 'a fail'}. Marking it ${intent.result === 'Pass' ? 'passed' : 'failed'} goes against what I found, so tell me why and I will record both — your answer on the paper, mine underneath it.`);
        return;
      }
      setDesignPoint(control.id, intent.pointId, intent.result);
      logEvent({ action: 'Update', description: `Marked a design check ${intent.result.toLowerCase()} on ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Control' });
      // This names WHICH check moved, because the reader named it and deserves
      // to see the right one answered. The diff effect's generic "1 check
      // marked" would only repeat it, so it stands down for this one change.
      skipAck.current = true;
      say(control.id, 'ira', `Marked ${intent.label} ${intent.result === 'Pass' ? 'passed' : 'failed'}.`);
      return;
    }

    // ── the same thing, one track later ──────────────────────────────────────
    if (intent.kind === 'mark-step') {
      const step = control.operating.steps.find(x => x.id === intent.stepId);
      const iraSaid = step?.validation?.result;
      if (iraSaid && iraSaid !== intent.result) {
        setAwaitingWhy({ kind: 'attribute', id: intent.stepId, label: intent.label, result: intent.result });
        say(control.id, 'ira', `I read that one as ${iraSaid === 'Pass' ? 'a pass' : 'a fail'}. Marking it ${intent.result === 'Pass' ? 'passed' : 'failed'} goes against what I found, so tell me why and I will record both — your answer on the paper, mine underneath it.`);
        return;
      }
      setStepResult(control.id, intent.stepId, intent.result);
      logEvent({ action: 'Update', description: `Marked ${intent.label} ${intent.result.toLowerCase()} on ${control.id} from the chat`, module: 'SOX ICFR', entity: 'Test Result' });
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
          room to read as prose, and the rail has half the column to give.
          `mt-auto` sits a short conversation on the floor rather than leaving
          it adrift at the top of a full-height rail: the live prompt lands
          where the hands already are. A long one fills upward and scrolls as
          usual, because auto margins give up the moment there is no slack. */}
      <div ref={scrollRef} className="chat-canvas-mesh flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4 flex flex-col">
       <div className="mt-auto space-y-5">
        {thread.map((m, i) => (
          m.who === 'user' ? (
            <motion.div key={m.id} className="flex justify-end"
              initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
              <div className="w-fit max-w-[85%] px-3 py-2 rounded-2xl bg-brand-50 text-ink-800 text-[0.8125rem] leading-[1.6] whitespace-pre-wrap break-words">
                {m.text}
              </div>
            </motion.div>
          ) : (
            // Only the newest line types itself out. An older one re-performing
            // every time the reader comes back from History would be theatre.
            <IraText key={m.id} text={m.text} stream={i === thread.length - 1 && m.id === latestIra.current} />
          )
        ))}

        {liveRun && <WorkingTrail label={liveRun.label} steps={liveRun.steps} />}

        {/* Not a message — the live read on where this control stands. The
            eyebrow names the step rather than the speaker: which step Ira is
            talking about is information, and "Ira" is not, since the voice is
            already carried by the alignment. */}
        {/* The drawn items, before anything is filed. The same three columns
            the page shows in its review stage, at rail width — the reader is
            being asked to look at what came out, so what came out has to be
            on screen. */}
        {!working && draw?.refs && (
          <div>
            <div className="rounded-lg border border-canvas-border overflow-hidden mb-2">
              <div className="grid grid-cols-[1.1fr_1fr] gap-2 px-2.5 py-1.5 bg-paper-50/70 border-b border-canvas-border text-[0.5625rem] font-bold uppercase tracking-wide text-ink-400">
                <span>Reference</span><span className="text-right">Drawn from</span>
              </div>
              <div className="max-h-[11rem] overflow-y-auto">
                {draw.refs.map((ref, i) => (
                  <div key={`${ref}-${i}`} className="grid grid-cols-[1.1fr_1fr] gap-2 px-2.5 py-1.5 border-b border-canvas-border last:border-b-0 text-[0.6875rem]">
                    <span className="font-mono text-ink-700 truncate">{ref}</span>
                    <span className="text-right text-ink-400 truncate">{draw.file}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={fileDraw}
                className="min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-center bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white hover:from-brand-500 hover:to-fuchsia-500 border border-transparent shadow-[0_6px_20px_-8px_rgba(106,18,205,0.55)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                File {plural(draw.refs.length, 'item')}
              </button>
              <button onClick={() => { setDraw(d => (d ? { ...d, refs: null } : d)); say(control.id, 'ira', 'Dropped that draw. Say what to take and I will run it again — the ask is still yours to change.'); }}
                className="min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] text-center border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                Reject and retry
              </button>
            </div>
          </div>
        )}

        {/* Mid-ask on a draw: the composer is the input, so there is nothing to
            put here but the way out. */}
        {!working && draw && draw.refs === null && (
          <button onClick={() => { setDraw(null); say(control.id, 'ira', 'Left the draw alone.'); }}
            className="text-[0.6875rem] text-ink-400 hover:text-ink-700 transition-colors cursor-pointer">Leave it for now</button>
        )}

        {/* Where the file came from — the page's own picker, not a lookalike.
            One tap files it: the modal on the left needs a second click because
            it is also collecting the file, and here the file is already in. */}
        {!working && !draw && extract?.stage === 'origin' && (
          <div>
            <OriginPicker onPick={landFile} />
            <button onClick={() => { const name = extract.name; setExtract(null); say(control.id, 'ira', `Left ${name} alone — it is not on the audit, so nothing reads it.`); }}
              className="mt-1.5 text-[0.6875rem] text-ink-400 hover:text-ink-700 transition-colors cursor-pointer">Leave it for now</button>
          </div>
        )}

        {/* The filter, agreed before it runs. The composer is where a different
            one is typed, so this is the yes and the way out. */}
        {!working && !draw && extract?.stage === 'criteria' && (
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => runExtract(extract.ask)}
              className="min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-center bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white hover:from-brand-500 hover:to-fuchsia-500 border border-transparent shadow-[0_6px_20px_-8px_rgba(106,18,205,0.55)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              Extract population
            </button>
            <button onClick={() => { setExtract(null); say(control.id, 'ira', 'Left the extraction alone. The file is still on the audit whenever you want it.'); }}
              className="min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] text-center border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              Not this one
            </button>
          </div>
        )}

        {/* A mapped pile, waiting to be filed. Nothing is written until this is
            pressed: the mapper is confident, not certain, and what it decides
            ends up on a working paper under the auditor's name. */}
        {!working && !draw && pile && (
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={fileThePile} disabled={!pile.some(m => m.slot)}
              className="min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-center bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white enabled:hover:from-brand-500 enabled:hover:to-fuchsia-500 border border-transparent shadow-[0_6px_20px_-8px_rgba(106,18,205,0.55)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              File {plural(pile.filter(m => m.slot).length, 'file')}
            </button>
            <button onClick={() => { pickFor.current = undefined; picker.current?.click(); }}
              className="min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] text-center border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              Choose again
            </button>
            <button onClick={() => { setPile(null); say(control.id, 'ira', 'Dropped — nothing was filed.'); }}
              className="col-span-2 text-[0.6875rem] text-ink-400 hover:text-ink-700 transition-colors cursor-pointer">Cancel</button>
          </div>
        )}

        {/* Mid-test on one IPE dimension. The derived prompt is not the live
            question here — the one Ira just asked is, and it is already in the
            thread above. All this adds is the verdict, once the finding is
            written: the page will not take a Pass or a Fail before that and
            neither will this. */}
        {!working && !pile && !draw && !extract && ipeDraft && (
          <div>
            {ipeDraft.note === null ? (
              <div className="text-[0.75rem] text-ink-400">Type what you found — it prints on the working paper.</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => settleIpe('Pass')}
                  className="min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-center bg-compliant-600 text-white hover:bg-compliant-700 border border-transparent transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">Pass</button>
                <button onClick={() => settleIpe('Fail')}
                  className="min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-center border border-risk-300 text-risk-700 bg-canvas-elevated hover:bg-risk-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">Fail</button>
                <button onClick={() => { setIpeDraft(null); say(control.id, 'ira', 'Left it open — the finding is saved, so pick it up whenever.'); }}
                  className="col-span-2 text-[0.6875rem] text-ink-400 hover:text-ink-700 transition-colors cursor-pointer">Leave it for now</button>
              </div>
            )}
          </div>
        )}

        {!working && !ipeDraft && !pile && !draw && !extract && (
          <div>
            {/* Ira's mark sits on the LIVE line only. The thread above stays
                unmarked prose (DESIGN.md §7.1.7 — no avatar, identity carried
                by alignment); what the mark distinguishes is not "who said
                this" but "this is the agent reading the control right now",
                which is the one thing in the rail that is not history. */}
            <div className="flex items-center gap-2 mb-2">
              <IraMark size={18} />
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500">
                {STEP_NUM[prompt.step]} {stepLabel}
              </span>
            </div>
            <IraText key={prompt.key} text={prompt.text} stream onDone={setSaidIt} />
            {/* The verdict, both faces on one line (user ask, 22 Sep). Stacked,
                "Design ineffective" under "Design effective" read as a second,
                lesser button; side by side they read as the two answers to one
                question — which is what concluding a track is. Centred, and
                without the row arrow: neither is a "next", they are the choice
                itself. */}
            {saidIt && pairs.length > 0 && (
              <div className={cn('mt-3 grid gap-1.5', pairs.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
                {pairs.map((a, i) => (
                  <motion.button key={a.id + a.label} onClick={() => run(a)}
                    initial={still ? false : { y: 6 }}
                    animate={{ y: 0 }}
                    transition={{ delay: i * 0.09, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                    className={cn('min-w-0 px-2.5 py-2.5 rounded-xl text-[0.8125rem] leading-snug text-center truncate transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      a.primary
                        ? 'bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white font-semibold border border-transparent shadow-[0_6px_20px_-8px_rgba(106,18,205,0.55)] hover:shadow-[0_8px_24px_-8px_rgba(106,18,205,0.65)]'
                        : 'border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200')}>
                    {a.label}
                  </motion.button>
                ))}
              </div>
            )}

            {saidIt && rows.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {rows.map((a, i) => (
                  <motion.button key={a.id + a.label} onClick={() => run(a)}
                    // The reveal moves the button, it does not fade it in. An
                    // entrance that starts at zero opacity leaves the one thing
                    // on this rail worth pressing invisible if the animation
                    // never gets to run — a background tab freezes rAF, and a
                    // button you cannot see is worse than one that just appears.
                    // The house follow-up cascade (DESIGN.md §7.1.10) — it can
                    // run its full 0.13s-per-chip stagger now that the chips
                    // wait for Ira to stop speaking rather than racing it.
                    initial={still ? false : { y: 6 }}
                    animate={{ y: 0 }}
                    transition={{ delay: i * 0.13, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                    // The chat's own follow-up card (ChatView `FollowUpCard`),
                    // at rail width. The arrow is the click-scent: it is the
                    // one thing a line of Ira's prose above can never grow.
                    // The PRIMARY action is what Ira recommends, so it wears
                    // the house AI CTA — the same brand→fuchsia sweep and soft
                    // purple cast as the One-Click Audit start button. One
                    // gradient per turn: everything else stays a flat outline,
                    // or the recommendation stops being findable.
                    className={cn('group/row w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 rounded-xl text-[0.8125rem] leading-snug transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      a.primary
                        ? 'bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white font-semibold border border-transparent shadow-[0_6px_20px_-8px_rgba(106,18,205,0.55)] hover:shadow-[0_8px_24px_-8px_rgba(106,18,205,0.65)]'
                        : 'border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200')}>
                    <span className="flex-1 min-w-0">{a.label}</span>
                    <ArrowRight size={14} className="shrink-0 -translate-x-1 opacity-0 transition-all duration-150 group-hover/row:translate-x-0 group-hover/row:opacity-100" />
                  </motion.button>
                ))}
              </div>
            )}

            {/* A SET to choose from, not a next step — so it wraps into small
                chips under one caption rather than becoming seven full-width
                rows that each claim to be the thing to do. The shape says
                "pick any, more than one is fine", which is exactly what
                setting up a design step is. */}
            {saidIt && picks.length > 0 && (
              <div className="mt-3.5">
                <div className="mb-1.5 text-[0.6875rem] font-semibold text-ink-400">{PICK_CAPTION[picks[0].id] ?? 'Pick one'}</div>
                <div className="flex flex-wrap gap-1.5">
                  {picks.map((a, i) => (
                    <motion.button key={a.id + a.label} onClick={() => run(a)}
                      initial={still ? false : { y: 6 }}
                      animate={{ y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                      className="inline-flex items-center gap-1 h-7 pl-2 pr-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                      <Plus size={12} className="shrink-0 text-ink-400" />{a.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
       </div>
      </div>

      {/* The chat composer floats on a tinted canvas; this panel is flat white,
          so the hairline stays — it is what stops the thread sliding under the
          input. The rest is §7.1.3: `.ai-border`, and the global focus ring
          suppressed because the border tone is the focus signal. */}
      {/* The one picker behind every upload offer in this rail — the same accept
          list the page's design picker carries. `multiple` is the whole point:
          the reader hands over the pile and Ira sorts it. */}
      <input ref={picker} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
        className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => { picked(e.target.files); e.target.value = ''; }} />
      {/* And the source data's own, with the page's accept list rather than the
          evidence one: a population is filtered out of rows, and a PDF has
          none. One file, because the first source is what makes a population —
          joining a second onto it is the page's, and a different question. */}
      <input ref={srcPicker} type="file" accept=".xlsx,.xls,.csv"
        className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => { pickedSource(e.target.files); e.target.value = ''; }} />

      <div className="p-3 border-t border-canvas-border">
        <div className="ai-border">
          <textarea
            value={draft} onChange={e => setDraft(e.target.value)} rows={2}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              if (e.key === 'Escape' && working) { e.preventDefault(); stop(); }
            }}
            disabled={!!working} aria-label="Message Ira"
            placeholder={working ? 'One moment…'
              : extract?.stage === 'origin' ? 'System export, or client-prepared? — recorded on the file'
              : extract?.stage === 'criteria' ? 'Say what to take out of it — or send the drafted filter as it is'
              : draw?.refs === null ? 'Say what to take — or send the drafted ask back as it is'
              : draw ? 'Look the items over — File or Reject above'
              : ipeDraft?.note === null ? `${IPE_ASK[ipeDraft.dimension] ?? 'What did you find?'} — this prints on the working paper`
              : ipeDraft ? 'Pass or fail — the buttons above'
              : awaitingWhy ? `Why does ${awaitingWhy.label} ${awaitingWhy.result === 'Pass' ? 'pass' : 'fail'}? — this goes on the paper`
              : 'Ask Ira, or tell it what to do…'}
            className="no-focus-ring w-full bg-transparent border-none outline-none resize-none px-3.5 pt-3 pb-1.5 text-[0.8125rem] leading-[1.5] text-ink-800 placeholder:text-ink-400 disabled:cursor-not-allowed"
          />
          {/* Send is mounted only when there is something to send, as it is in
              the chat. The hint holds the row's height so the composer does
              not grow by 32px under the reader's hands as they start typing. */}
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Attach, where the chat puts it. Only on the step where a file
                  has somewhere to go — an attach button that leads to "nothing
                  here takes a file" is a button that lies. */}
              {prompt.step === 'operating' && prompt.situation.evidenceOwed.length > 0 && !working && (
                <button onClick={() => { pickFor.current = undefined; picker.current?.click(); }}
                  aria-label="Attach evidence" title="Attach evidence — I will put each file against the attribute it proves"
                  className="inline-flex items-center justify-center size-7 rounded-lg text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <Paperclip size={14} />
                </button>
              )}
              {/* The same affordance one step earlier, where what a file is FOR
                  is different: this is the data the population comes out of. */}
              {prompt.step === 'population' && !prompt.situation.popStarted && !prompt.situation.yePending && role === 'auditor' && !working && !extract && (
                <button onClick={() => srcPicker.current?.click()}
                  aria-label="Attach the source file" title="Attach the source file — the data this control's population comes out of"
                  className="inline-flex items-center justify-center size-7 rounded-lg text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <Paperclip size={14} />
                </button>
              )}
              <span className="text-[0.6875rem] text-ink-400 select-none truncate">{working ? 'Working…' : 'Enter to send'}</span>
            </div>
            {/* Stop, exactly as the flagship composer does it: the send button
                becomes an ink-900 square while something is in flight, and it
                genuinely interrupts — the run ends and the timer is cleared,
                rather than the affordance merely being hidden. */}
            {working ? (
              <button onClick={stop} aria-label="Stop Ira" title="Stop reading (Esc)"
                className="inline-flex items-center justify-center size-8 rounded-lg bg-ink-900 text-white hover:bg-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                <Square size={11} fill="currentColor" />
              </button>
            ) : !!draft.trim() && (
              <button onClick={send} aria-label="Send to Ira" title="Send · Enter to send, Shift+Enter for new line"
                className="inline-flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-brand-600 to-fuchsia-600 text-white hover:from-brand-500 hover:to-fuchsia-500 shadow-[0_4px_14px_-6px_rgba(106,18,205,0.55)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                <ArrowUp size={16} strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
