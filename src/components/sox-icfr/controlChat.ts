import { useSyncExternalStore } from 'react';

/**
 * What has been SAID on a control, and nothing else.
 *
 * The thread is deliberately thin. Where the control stands — which documents
 * are on file, which checks are marked, whether the design is concluded — is
 * never written here; it is read off the control itself every render (see
 * controlChatScript.ts). That is the whole trick behind "Ira keeps up": a tick
 * on the left and a button in the chat move the same control, so both move the
 * conversation, and a prompt that has been answered cannot be offered again
 * because the prompt is a function of the state that answering it changed.
 *
 * Session-lifetime, like racmLibrary and racmConfig beside it: leave a control
 * and come back mid-conversation, reload the page and start fresh.
 */

export type ChatWho = 'ira' | 'user';

export interface ChatMsg {
  id: string;
  who: ChatWho;
  text: string;
  /** Human, like DiscussionComment.at — 'just now' is the house convention. */
  at: string;
  /** What this message was in answer to, so the same line is never said twice. */
  key?: string;
}

type Threads = Record<string, ChatMsg[]>;

// ─── Store ──────────────────────────────────────────────────────────────────────

let THREADS: Threads = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The snapshot is the whole record, returned by reference — indexing it here
 *  would hand useSyncExternalStore a fresh array every render and loop. */
const all = (): Threads => THREADS;
const EMPTY: ChatMsg[] = [];

let seq = 0;
const nextId = () => `msg-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** Everything said on one control, oldest first. Re-renders when it changes. */
export function useControlThread(controlId: string): ChatMsg[] {
  const threads = useSyncExternalStore(subscribe, all, all);
  return threads[controlId] ?? EMPTY;
}

/** The same thread, read once — for code outside React. */
export const controlThread = (controlId: string): ChatMsg[] => THREADS[controlId] ?? EMPTY;

function commit(controlId: string, msgs: ChatMsg[]): void {
  THREADS = { ...THREADS, [controlId]: msgs };
  emit();
}

export function say(controlId: string, who: ChatWho, text: string, key?: string): ChatMsg {
  const msg: ChatMsg = { id: nextId(), who, text, at: 'just now', key };
  commit(controlId, [...controlThread(controlId), msg]);
  return msg;
}

/** Say it only if it has not been said — the guard that stops a derived prompt
 *  being posted again on every render it survives. */
export function sayOnce(controlId: string, key: string, text: string): void {
  if (controlThread(controlId).some(m => m.key === key)) return;
  say(controlId, 'ira', text, key);
}

export function clearThread(controlId: string): void {
  if (!THREADS[controlId]) return;
  const next = { ...THREADS };
  delete next[controlId];
  THREADS = next;
  emit();
}

// ─── What is running, and where it says so ──────────────────────────────────────

/**
 * A long-running assessment on a control, and the one place it narrates.
 *
 * It lives out here rather than inside the chat pane because the button that
 * starts it is not always in the chat: the page has its own "Run AI validation"
 * on the design checks, and the user's rule (22 Sep) is that pressing it
 * streams in the rail. One run, one narration — whichever door it came in by.
 *
 * `wantsRail` is how the page asks the rail to come to the front, so a reader
 * who pressed the button on the left is not left reading an empty column while
 * the answer arrives on a tab they cannot see.
 */

/** One line of the working trail. The same shape Ask IRA streams
 *  (`chat/stream/streamTypes.ts` → `ReasoningStep`), so the rail's trail and
 *  the flagship chat's are one idea with one vocabulary rather than two
 *  lookalikes that drift. */
export interface RunStep {
  id: string;
  label: string;
  status: 'active' | 'done';
}

export interface ControlRun {
  /** What is being done, in the present participle, for the rail to say. */
  label: string;
  /** What it has done so far, oldest first — the last one is the live step. */
  steps: RunStep[];
  /** Raised once by whoever started the run; the rail lowers it on arrival. */
  wantsRail: boolean;
  /** Which run this is. The work a run started checks it is still the live run
   *  before it lands, so a Stop (agentic UX #15) really stops it. */
  token: number;
}

let RUNS: Record<string, ControlRun> = {};
/** Per-control timers that walk the trail. Kept here rather than in the pane so
 *  the steps keep turning over while the reader is on History, and so a run the
 *  PAGE started narrates identically to one the chat started. */
const RUN_TIMERS: Record<string, number[]> = {};
const runListeners = new Set<() => void>();
const emitRuns = () => runListeners.forEach(l => l());
const subscribeRuns = (l: () => void) => { runListeners.add(l); return () => { runListeners.delete(l); }; };
const allRuns = (): Record<string, ControlRun> => RUNS;

/** What is running on this control, or null. */
export function useControlRun(controlId: string): ControlRun | null {
  const runs = useSyncExternalStore(subscribeRuns, allRuns, allRuns);
  return runs[controlId] ?? null;
}

export const controlRun = (controlId: string): ControlRun | null => RUNS[controlId] ?? null;

/**
 * Start a run and lay out the trail it will walk.
 *
 * `stepLabels` are spread evenly across `ms` — the caller already knows how
 * long its own work takes (the page's VALIDATE_MS, the chat's IRA_MS), so the
 * narration finishes exactly when the work does instead of guessing.
 *
 * `focusRail` — the caller is not the rail, so bring the rail forward.
 */
let NEXT_TOKEN = 1;
export function startRun(controlId: string, label: string, stepLabels: string[], ms: number, focusRail = false): number {
  clearRunTimers(controlId);
  const token = NEXT_TOKEN++;
  // Only the first is live at the start; the rest are not shown until their turn.
  const steps: RunStep[] = stepLabels.length
    ? [{ id: 's0', label: stepLabels[0], status: 'active' }]
    : [];
  RUNS = { ...RUNS, [controlId]: { label, steps, wantsRail: focusRail, token } };
  emitRuns();
  // The last step stays live until the work lands and `endRun` is called —
  // a trail that finishes before the answer does is a trail that lied.
  const gap = ms / Math.max(stepLabels.length, 1);
  const timers = stepLabels.slice(1).map((l, i) => window.setTimeout(() => {
    const run = RUNS[controlId];
    if (!run) return;
    RUNS = {
      ...RUNS,
      [controlId]: {
        ...run,
        steps: [...run.steps.map(s => ({ ...s, status: 'done' as const })), { id: `s${i + 1}`, label: l, status: 'active' }],
      },
    };
    emitRuns();
  }, gap * (i + 1)));
  RUN_TIMERS[controlId] = timers;
  return token;
}

/** Is the run that `token` names still the one going? False once it was stopped
 *  — the caller then drops its result on the floor instead of writing it. */
export const runIsLive = (controlId: string, token: number): boolean => RUNS[controlId]?.token === token;

/** Stop whatever Ira is running on this control (agentic UX #15, 1 Oct). The
 *  work it started finds its run gone and writes nothing. */
export const stopRun = (controlId: string): void => endRun(controlId);

function clearRunTimers(controlId: string): void {
  (RUN_TIMERS[controlId] ?? []).forEach(t => window.clearTimeout(t));
  delete RUN_TIMERS[controlId];
}

export function endRun(controlId: string): void {
  clearRunTimers(controlId);
  if (!RUNS[controlId]) return;
  const next = { ...RUNS };
  delete next[controlId];
  RUNS = next;
  emitRuns();
}

/**
 * What Ira says it is doing, step by step, while it reads.
 *
 * These live here rather than at the call sites because the page and the chat
 * start the SAME run — the reader's rule (22 Sep) is that one run narrates in
 * one place — and two lists would eventually describe the same work two ways.
 * Each is written in the present participle and names a real stage of the read,
 * not a fake progress ladder: the last one stays live until the work lands.
 */
export const DESIGN_RUN_STEPS = [
  'Opening the evidence on each design element',
  'Reading it against every design check',
  'Weighing what each check asks for',
  'Writing up what I found',
];
export const TOE_RUN_STEPS = [
  'Opening the files behind each attribute',
  'Checking each against what its test asks for',
  'Recording a result per attribute',
];

/** The rail has come forward; it does not need asking twice. */
export function railShown(controlId: string): void {
  const run = RUNS[controlId];
  if (!run?.wantsRail) return;
  RUNS = { ...RUNS, [controlId]: { ...run, wantsRail: false } };
  emitRuns();
}

// ── Manual / Automatic (agentic UX #3, user ask 1 Oct) ─────────────────────────
// The trust ladder, as one switch under the Ira chat box. Manual: Ira proposes
// and you press each button. Automatic: Ira runs the mechanical work itself the
// moment it can and confirms its own SURE results in your name; a less-sure
// result still waits for you, and the sample request is drafted, never sent.
// Never automatic, in either mode (agentic UX #2): concluding, signing,
// countersigning, the materiality number, the key flag and descoping.
// Remembered per viewer; every control follows it.
export type IraMode = 'manual' | 'automatic';
const MODE_KEY = 'sox-ira-mode';
let MODE: IraMode = (() => { try { return window.localStorage.getItem(MODE_KEY) === 'automatic' ? 'automatic' : 'manual'; } catch { return 'manual'; } })();
const modeListeners = new Set<() => void>();
const subscribeMode = (l: () => void) => { modeListeners.add(l); return () => { modeListeners.delete(l); }; };
const getMode = (): IraMode => MODE;
export function setIraMode(next: IraMode): void {
  MODE = next;
  try { window.localStorage.setItem(MODE_KEY, next); } catch { /* storage blocked */ }
  modeListeners.forEach(l => l());
}
export function useIraMode(): IraMode {
  return useSyncExternalStore(subscribeMode, getMode, getMode);
}
