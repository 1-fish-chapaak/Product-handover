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
export interface ControlRun {
  /** What is being done, in the present participle, for the rail to say. */
  label: string;
  /** Raised once by whoever started the run; the rail lowers it on arrival. */
  wantsRail: boolean;
}

let RUNS: Record<string, ControlRun> = {};
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

/** `focusRail` — the caller is not the rail, so bring the rail forward. */
export function startRun(controlId: string, label: string, focusRail = false): void {
  RUNS = { ...RUNS, [controlId]: { label, wantsRail: focusRail } };
  emitRuns();
}

export function endRun(controlId: string): void {
  if (!RUNS[controlId]) return;
  const next = { ...RUNS };
  delete next[controlId];
  RUNS = next;
  emitRuns();
}

/** The rail has come forward; it does not need asking twice. */
export function railShown(controlId: string): void {
  const run = RUNS[controlId];
  if (!run?.wantsRail) return;
  RUNS = { ...RUNS, [controlId]: { ...run, wantsRail: false } };
  emitRuns();
}
