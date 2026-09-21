import type { ChatStepId, Situation } from './controlChatScript';
import type { Role } from './types';

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
  | 'ira-run'
  | 'conclude-effective'
  | 'conclude-ineffective'
  | 'approve-design'
  | 'show-step';

export interface ChatAction {
  id: ChatActionId;
  label: string;
  /** Posted as the reader's own line, so the thread reads back as a conversation. */
  said: string;
  /** The one action worth leading with, if there is one. */
  primary?: boolean;
  /** For the actions that only move the page: which step to land on. */
  focus?: ChatStepId;
  /** The same offer as a verb phrase, for when Ira lists what it can do in a
   *  sentence. Button labels address the reader ("Show me…"), which reads
   *  backwards inside "I can …". */
  does?: string;
}

const show = (label: string, said: string, focus: ChatStepId, does = 'show you where it is on the page'): ChatAction =>
  ({ id: 'show-step', label, said, focus, does });

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
    if (s.preparerSigned && !s.reviewerSigned && !s.ownPaper) out.push(show('Take me to the sign-off', 'Take me to the sign-off.', 'signoff'));
    return out;
  }

  // ── the auditor ───────────────────────────────────────────────────────────
  if (s.locked) return [show('Take me to the sign-off', 'Take me to the sign-off.', 'signoff')];

  if (s.step === 'design') {
    if (s.designReturn) return [show('Read the reviewer’s note', 'Show me what the reviewer said.', 'design')];
    if (s.missing.length > 0) {
      return [show(s.missing.length === 1 ? 'Show me the missing element' : 'Show me the missing elements', 'Show me what is missing.', 'design')];
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
      out.push({ id: 'conclude-effective', label: 'Design effective', said: 'Conclude the design effective.', primary: s.checksFailed === 0, does: 'conclude the design effective' });
    }
    out.push({ id: 'conclude-ineffective', label: 'Design ineffective', said: 'Conclude the design ineffective.', primary: s.checksFailed > 0, does: 'conclude the design ineffective' });
    return out;
  }

  // The other four steps get the rail and the read, and the page for the work.
  return [show('Take me to this step', 'Take me to this step.', s.step)];
}
