import type { ChatStepId, Situation } from './controlChatScript';
import { DESIGN_DOC_KINDS, type Role } from './types';

/**
 * What Ira may offer, and when.
 *
 * Two rules hold this file together.
 *
 *  1. **Never offer what the store would refuse.** Every guard below is the
 *     same predicate the page uses — `canTest`, the conclude gate, the
 *     four-eyes rule on approval. A button that looks live and then does
 *     nothing is worse than no button, because it teaches the reader that the
 *     chat is decoration.
 *  2. **Never resurrect a parked affordance.** Design checks are not written
 *     or deleted here, "Request data" left the TOD lane, and "Pass all" went
 *     with them. Ira offering any of those would quietly undo a decision the
 *     page has already made.
 *
 * Heavy actions — attaching a file, waiving an element, writing the reviewer's
 * note — are not reimplemented. They open the real thing on the left, so there
 * is exactly one uploader and one waiver form in the product.
 */

export type ChatActionId =
  | 'add-element'
  | 'ira-run'
  | 'conclude-effective'
  | 'conclude-ineffective'
  | 'approve-design'
  | 'lock-population'
  | 'toe-run'
  | 'conclude-op-effective'
  | 'conclude-op-ineffective'
  | 'sign-paper'
  | 'countersign'
  | 'show-step';

export interface ChatAction {
  id: ChatActionId;
  label: string;
  /** Posted as the reader's own line, so the thread reads back as a conversation. */
  said: string;
  /** The one action worth leading with, if there is one. */
  primary?: boolean;
  /** Which of the thing — the element kind, for `add-element`. */
  arg?: string;
  /** How the rail should DRAW this offer, as against what it does.
   *
   *  `pick` — a set to choose from rather than a next step, so it becomes a
   *  wrap of small chips under one caption instead of seven stacked rows.
   *  `pair` — one verdict with two faces. Stacked, the second reads as a
   *  lesser afterthought of the first; side by side they read as the two
   *  answers to one question, which is what a conclusion actually is. */
  group?: 'pick' | 'pair';
  /** For the actions that only move the page: which step to land on. */
  focus?: ChatStepId;
  /** The same offer as a verb phrase, for when Ira lists what it can do in a
   *  sentence. Button labels address the reader ("Show me…"), which reads
   *  backwards inside "I can …". */
  does?: string;
}

const show = (label: string, said: string, focus: ChatStepId, does = 'show you where it is on the page'): ChatAction =>
  ({ id: 'show-step', label, said, focus, does });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function actionsFor(s: Situation, role: Role): ChatAction[] {
  // A sealed engagement or a countersigned paper is a record, not a workspace.
  if (s.sealed || (s.locked && s.reviewerSigned)) return [];

  if (role === 'risk-owner') {
    return s.missing.length > 0
      ? [show(s.missing.length === 1 ? 'Show me what is outstanding' : 'Show me what is outstanding', 'Show me what is outstanding.', 'design')]
      : [];
  }

  if (role === 'reviewer') {
    const out: ChatAction[] = [];
    if (s.designResult !== 'Not tested' && !s.approvedBy) {
      // Four eyes: the store refuses an approval from whoever concluded it, so
      // Ira does not offer one either — it offers the honest way out instead.
      if (!s.ownConclusion) out.push({ id: 'approve-design', label: 'Approve the design', said: 'Approve the design.', primary: true, does: 'approve the design conclusion' });
      out.push(show('Send it back with a note', 'I want to send it back.', 'design'));
    }
    // The page's own gate, to the letter: a paper prepared by somebody else,
    // not yet countersigned, with every review note closed.
    if (s.preparerSigned && !s.reviewerSigned && !s.ownPaper) {
      if (s.notesPending === 0) out.push({ id: 'countersign', label: 'Countersign the paper', said: 'Countersign the paper.', primary: true, does: 'countersign the working paper' });
      out.push(show('Take me to the sign-off', 'Take me to the sign-off.', 'signoff'));
    }
    return out;
  }

  // ── the auditor ───────────────────────────────────────────────────────────
  // Both tracks concluded: the paper is ready to sign, and signing it is a
  // single store call with a single guard, so it is offered rather than
  // pointed at. Once signed it belongs to the reviewer and there is nothing
  // here but the way to look at it.
  if (s.locked) {
    return s.preparerSigned
      ? [show('Take me to the sign-off', 'Take me to the sign-off.', 'signoff')]
      : [
        { id: 'sign-paper', label: 'Sign off this paper', said: 'Sign off this paper.', primary: true, does: 'sign the working paper and send it to the reviewer' },
        show('Show me what I am signing', 'Show me what I am signing.', 'signoff'),
      ];
  }

  if (s.step === 'design') {
    if (s.designReturn) return [show('Read the reviewer’s note', 'Show me what the reviewer said.', 'design')];

    // ── setting up, before there is anything to test ────────────────────────
    // The page's Add-element menu, minus what is already on the control. It is
    // the one part of setting up TOD that is a single store call, so Ira does
    // it rather than pointing at it (user ask, 22 Sep).
    //
    // It clears itself the moment one file lands: past that, adding elements
    // is housekeeping and the page's own menu owns it. Anything else would
    // leave a seven-chip cloud sitting under every line Ira says for the rest
    // of the step.
    const picks: ChatAction[] = s.elementsOnFile === 0 && s.designResult === 'Not tested' && !s.locked
      ? DESIGN_DOC_KINDS.filter(k => !s.elementKinds.includes(k)).map(k => ({
        id: 'add-element' as const, arg: k, label: k, group: 'pick' as const,
        said: `Add ${k.charAt(0).toLowerCase()}${k.slice(1)}.`,
        does: `add ${k.charAt(0).toLowerCase()}${k.slice(1)} to the design step`,
      }))
      : [];

    // Nothing on the control at all. The page hides its conclude footer in
    // exactly this state, so the rail does not offer one either — the old
    // version's only button here was "Design ineffective", on a control whose
    // testing had not begun.
    if (s.elementsTotal === 0) {
      return picks.length > 0 ? picks : [show('Take me to the design step', 'Take me to the design step.', 'design')];
    }
    if (s.missing.length > 0) {
      return [show(s.missing.length === 1 ? 'Show me the missing element' : 'Show me the missing elements', 'Show me what is missing.', 'design'), ...picks];
    }
    if (s.designResult !== 'Not tested' && !s.todApproved) {
      return [show('Show me what I concluded', 'Show me what I concluded.', 'design')];
    }
    if (s.checksUnmarked > 0) {
      const out: ChatAction[] = [];
      if (!s.iraBlocked) out.push({ id: 'ira-run', label: `Assess all ${s.checksTotal} checks for me`, said: 'Run the AI validation over the design checks.', primary: true, does: 'read the evidence and assess every design check' });
      out.push(show('I’ll mark them myself', 'I’ll mark them myself.', 'design'));
      return out;
    }
    if (s.checksTotal > 0 && s.iraStale) {
      return [
        { id: 'ira-run', label: 'Re-run the AI validation', said: 'Re-run the validation against the new evidence.', primary: true, does: 'read the new evidence and assess the checks again' },
        show('Conclude anyway', 'Take me to the conclusion.', 'design'),
      ];
    }
    // Everything is marked. The page disables Effective until every required
    // element is accounted for and no check is unmarked; the same gate here.
    const out: ChatAction[] = [];
    if (s.complete && s.checksUnmarked === 0) {
      out.push({ id: 'conclude-effective', label: 'Design effective', said: 'Conclude the design effective.', primary: s.checksFailed === 0, group: 'pair', does: 'conclude the design effective' });
    }
    out.push({ id: 'conclude-ineffective', label: 'Design ineffective', said: 'Conclude the design ineffective.', primary: s.checksFailed > 0, group: 'pair', does: 'conclude the design ineffective' });
    return [...out, ...picks];
  }

  // ── ② population ──────────────────────────────────────────────────────────
  // Locking is one store call behind one gate the situation already carries,
  // so it is done from here. Extracting is not: the form picks a file and
  // computes the count itself, and a second implementation of that would give
  // a different population than the page does for the same criteria.
  if (s.step === 'population') {
    if (s.yePending) return [];
    if (s.popStarted && !s.popLocked && !s.popBlock) {
      return [
        { id: 'lock-population', label: `Lock the population at ${s.popCount.toLocaleString('en-IN')} items`, said: 'Lock the population.', primary: true, does: 'lock the population so the sample can be drawn off it' },
        show('Let me look at it first', 'Take me to the population.', 'population'),
      ];
    }
    return [show(s.popStarted ? 'Take me to the population' : 'Take me to the extraction', 'Take me to this step.', 'population')];
  }

  // ── ④ test of effectiveness ───────────────────────────────────────────────
  // The conclusion, both ways, on the page's own gates. A stale run blocks
  // both; everything else in `toeHolds` blocks only Effective.
  if (s.step === 'operating') {
    const out: ChatAction[] = [];
    // The same offer the design step makes, one track later: read what has
    // been uploaded and assess the attributes it covers. The page counts the
    // ready ones on its own button, so this counts them the same way — an
    // attribute whose files are not all in cannot be assessed and is not
    // included in the promise.
    if (s.toe.tested < s.toe.total && s.toeReady > 0) {
      out.push({
        id: 'toe-run', primary: true,
        label: s.toeReady === s.toe.total - s.toe.tested
          ? `Assess ${plural(s.toeReady, 'attribute')} for me`
          : `Assess the ${plural(s.toeReady, 'attribute')} that ${s.toeReady === 1 ? 'has' : 'have'} its files`,
        said: 'Run the AI validation over the ready attributes.',
        does: 'read the uploaded files and assess every attribute that has them',
      });
    }
    if (s.toe.total > 0 && s.toe.tested === s.toe.total && !s.toeStale) {
      if (!s.toeHolds) out.push({ id: 'conclude-op-effective', label: 'Operating effective', said: 'Conclude the operating effectiveness effective.', primary: s.toe.failed === 0, group: 'pair', does: 'conclude the operating effectiveness effective' });
      out.push({ id: 'conclude-op-ineffective', label: 'Operating ineffective', said: 'Conclude the operating effectiveness ineffective.', primary: s.toe.failed > 0, group: 'pair', does: 'conclude the operating effectiveness ineffective' });
    }
    out.push(show(out.length ? 'Show me the attributes' : 'Take me to the testing', 'Take me to this step.', 'operating'));
    return out;
  }

  // ③ sample, and ⑤ before both tracks are in: the page does the work. Drawing
  // is a two-stage thing the page holds between a draw and an approval, and
  // half a draw done from here would leave a control whose step ③ shows
  // nothing.
  return [show('Take me to this step', 'Take me to this step.', s.step)];
}
