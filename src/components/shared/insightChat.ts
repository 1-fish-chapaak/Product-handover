// ─── Open / run an insight's next step in Ask IRA ──────────────────────────
// Two different things, deliberately kept apart:
//
//   openInChat  — a QUESTION. "Check more" chips and free-form asks pre-fill a
//                 fresh composer (?view=chat&prompt=…) and wait: the auditor
//                 edits and sends it themselves.
//   runActionInChat — an ACTION. A recommended action is not a suggestion to
//                 retype; it composes the complete prompt (the action plus the
//                 finding, cause, stakes, guardrail and every evidence row the
//                 insight carries), sends it on arrival, and the analysis plan
//                 that builds in the thread is derived from that same payload.
//
// Both open a new tab, so the surface the auditor was reading stays put.

import { actionRunHref, buildActionRun, stashActionRun, type ActionRunInput } from '../../data/actionRun';

function openTab(href: string): void {
  try {
    window.open(href, '_blank', 'noopener,noreferrer');
  } catch {
    /* ignore — popup blocked */
  }
}

export function openInChat(ask: string, subjectLabel?: string): void {
  const prompt = subjectLabel ? `${ask}\n\n(regarding ${subjectLabel})` : ask;
  openTab(`?view=chat&prompt=${encodeURIComponent(prompt)}`);
}

/** Run a recommended action: hand the full payload to a new chat tab, which
 *  sends it and runs it. Falls back to the pre-filled composer when the handoff
 *  store is unavailable — a chat that opens empty would be worse than one the
 *  auditor has to send. */
export function runActionInChat(input: ActionRunInput): void {
  const run = buildActionRun(input);
  if (!stashActionRun(run)) {
    openInChat(input.rec.title, input.insight?.subjectLabel ?? input.subjectLabel);
    return;
  }
  openTab(actionRunHref(run));
}
