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
 * Nothing here is REIMPLEMENTED. Attaching a file and waiving an element are
 * done from the rail now (23 Sep) — but by making the page's own store calls,
 * `attachDesignEvidence` and `waiveDesignDoc`, with the page's own accept list
 * and the page's own insistence on a written reason. Two doors, one
 * implementation; a file attached from here is indistinguishable from one
 * attached on the left, because it is the same write.
 *
 * What stays on the page is what carries judgement a rail cannot hold: the
 * exception's sizing panel, the reviewer's note, the design-check editor.
 */

export type ChatActionId =
  | 'add-element'
  | 'attach-doc'
  | 'waive-doc'
  | 'upload-source'
  | 'pick-source'
  | 'upload-evidence'
  | 'draw-sample'
  | 'file-sample'
  | 'tick-sample'
  | 'ipe-check'
  | 'ipe-reliable'
  | 'ipe-unreliable'
  | 'ira-run'
  | 'conclude-effective'
  | 'conclude-ineffective'
  | 'approve-design'
  | 'lock-population'
  | 'toe-run'
  | 'conclude-op-effective'
  | 'conclude-op-ineffective'
  | 'rootcause-take'
  | 'rootcause-write'
  | 'show-exception'
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
  /** Which of the thing — the element kind for `add-element`, the check id for
   *  `ipe-check`, the attribute id for `upload-evidence` (absent = all of them),
   *  the source-file id for the draw, the file NAME for `pick-source`. */
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
  // ── the exception's root cause ────────────────────────────────────────────
  // Same order as the prompt, and for the same reason: the store refuses
  // `completeSizing` while this is unsettled, so nothing else on the exception
  // can be offered until it is. Sizing itself stays the page's — likelihood,
  // exposure and the compensating control are three fields with a working
  // panel behind one of them, and half of that from a chat rail would be a
  // grade nobody could reproduce.
  if (s.exception) {
    const ex = s.exception;
    const out: ChatAction[] = [];
    if (ex.drafted && ex.rootCause.trim()) {
      out.push({ id: 'rootcause-take', label: 'Use it as written', said: 'Use that root cause as written.', primary: true, does: 'put my drafted root cause on the paper as written' });
      out.push({ id: 'rootcause-write', label: 'I’ll say it in my own words', said: 'I’ll write the root cause myself.', does: 'take the root cause in your own words' });
    } else if (!ex.rootCause.trim()) {
      out.push({ id: 'rootcause-write', label: 'Tell me the mechanism', said: 'I’ll write the root cause.', primary: true, does: 'take the root cause in your own words' });
    }
    out.push({ id: 'show-exception', label: ex.rootCause.trim() && !ex.drafted ? 'Take me to the exception' : 'Show me the exception', said: 'Take me to the exception.', does: 'show you the exception on the page' });
    return out;
  }

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
      const one = s.missing.length === 1;
      // An element that will never arrive is not a hole in the paper — it is a
      // judgement, and the page takes it with a written reason the working
      // paper prints. Offered here because "not applicable" is the commonest
      // answer to "this is missing", and sending the reader to the left to say
      // it makes the rail a thing that only ever reports problems.
      // Ira offers to add an element; an element with nothing on it is not
      // finished work, so it offers the file too. Leading, because attaching
      // is what the reader came to do — the waiver is the exception.
      const attach: ChatAction[] = s.designResult === 'Not tested' && !s.locked
        ? [{
          id: 'attach-doc' as const, arg: one ? s.missing[0]!.id : undefined,
          label: one ? 'Attach the file' : 'Attach a file',
          said: one ? 'Attach the file for it.' : 'Attach a file.',
          primary: true,
          does: 'attach the evidence for an outstanding element',
        }]
        : [];
      const waive: ChatAction[] = s.designResult === 'Not tested' && !s.locked
        ? [{
          id: 'waive-doc' as const, arg: one ? s.missing[0]!.id : undefined,
          label: one ? 'Not applicable' : 'Mark one not applicable',
          said: one ? 'That one is not applicable.' : 'One of them is not applicable.',
          does: 'account for an element that will not be provided',
        }]
        : [];
      return [...attach, show(one ? 'Show me the missing element' : 'Show me the missing elements', 'Show me what is missing.', 'design'), ...waive, ...picks];
    }
    if (s.designResult !== 'Not tested' && !s.todApproved) {
      return [show('Show me what I concluded', 'Show me what I concluded.', 'design')];
    }
    if (s.checksUnmarked > 0) {
      const out: ChatAction[] = [];
      // Nothing left but the ones Ira already read and could not answer. The
      // run is not offered again: it would produce the same sentence, and a
      // button that costs six seconds to tell you what it told you last time
      // is a button that teaches the reader to stop pressing them.
      const allBlocked = s.checksBlocked.length > 0 && s.checksBlocked.length === s.checksUnmarked;
      if (!s.iraBlocked && !allBlocked) out.push({ id: 'ira-run', label: `Assess all ${s.checksTotal} checks for me`, said: 'Run the AI validation over the design checks.', primary: true, does: 'read the evidence and assess every design check' });
      out.push(show(allBlocked ? 'Show me the ones you couldn’t test' : 'I’ll mark them myself', 'Take me to the design checks.', 'design'));
      return out;
    }
    if (s.checksTotal > 0 && s.iraStale) {
      return [
        { id: 'ira-run', label: 'Re-run the AI validation', said: 'Re-run the validation against the new evidence.', primary: true, does: 'read the new evidence and assess the checks again' },
        show('Conclude anyway', 'Take me to the conclusion.', 'design'),
      ];
    }
    // A control whose RACM lists no design checks. Nothing has been ASSESSED,
    // so nothing is concluded from here (user ask, 23 Sep): the order is
    // elements → evidence → the checks read against it → the conclusion, and
    // the last step cannot be reached by the first three finishing. Falling
    // through to a verdict here was how attaching one file put "Design
    // effective" on offer against nothing that had been tested.
    //
    // The page's own footer still concludes it — a judgement on the documents
    // alone is the auditor's to make, and refusing it outright would be the
    // rail overruling the page. It is just not a thing Ira offers.
    if (s.checksTotal === 0) {
      return [show('Take me to the design step', 'Take me to the design step.', 'design'), ...picks];
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
  // Locking is one store call behind one gate the situation already carries.
  // The extract is three acts — the file, the filter, the run — and it used to
  // be refused here on the grounds that the form computes the count itself and
  // a second implementation would hand the reviewer a different population for
  // the same sentence. That was a reason to SHARE the computation, not to keep
  // the door shut: `narrowedCount` and `populationFrom` now live in helpers and
  // both sides call them, so there is one extract with two doors (user ask,
  // 22 Sep). Registering the REPORT is still the page's — that form asks for
  // the system, the t-code, the parameters, who ran it and the control total.
  if (s.step === 'population') {
    if (s.yePending) return [];

    // ── before there is a population at all ─────────────────────────────────
    // Which of the three states the audit is in decides what is on offer. The
    // old single button pointed at an empty picker; these point at the thing
    // that is actually missing.
    if (!s.popStarted) {
      const out: ChatAction[] = [];
      const usable = s.popFiles.filter(f => f.usable);
      if (usable.length === 1) {
        out.push({
          id: 'pick-source', arg: usable[0].name, primary: true,
          label: `Draw it off ${usable[0].name}`, said: `Draw it off ${usable[0].name}.`,
          does: `filter ${usable[0].name} down to this control’s instances`,
        });
      } else {
        usable.forEach(f => out.push({
          id: 'pick-source', arg: f.name, group: 'pick',
          label: f.name, said: `Draw it off ${f.name}.`,
          does: `filter ${f.name} down to this control’s instances`,
        }));
      }
      // The upload leads while there is nothing to pick, and stays available
      // afterwards: the file this control operated on is very often not the one
      // the audit was created with.
      out.push({
        id: 'upload-source', primary: usable.length === 0,
        label: usable.length === 0 ? 'Upload the source file' : 'Upload a different file',
        said: 'I have the file — take it.',
        does: 'take the source file, ask where it came from, and add it to the audit',
      });
      out.push(show('Take me to the extraction', 'Take me to this step.', 'population'));
      return out;
    }
    // ── the IPE test, done from here ────────────────────────────────────────
    // Each dimension is a judgement with a written finding, so it is offered
    // as a set to pick from rather than a next step. Registering the report is
    // NOT offered: that form asks for the system, the t-code, the parameters,
    // who ran it and the control total, and half a registration from here
    // would be a population standing on a report nobody can re-run.
    const ipe = s.ipe;
    if (ipe && ipe.conclusion === 'Not tested') {
      if (ipe.untested.length > 0) {
        return [
          ...ipe.untested.map<ChatAction>(k => ({
            id: 'ipe-check', arg: k.id, label: k.dimension, group: 'pick',
            said: `Let’s do ${k.dimension.toLowerCase()}.`,
            does: `test the report’s ${k.dimension.toLowerCase()}`,
          })),
          show('Take me to the report', 'Take me to the report.', 'population'),
        ];
      }
      // Every dimension answered. A single failure sinks the report, so the
      // page's own suggestion is what leads.
      return [
        { id: 'ipe-reliable', label: 'Report reliable', said: 'Conclude the report reliable.', primary: ipe.failed === 0, group: 'pair', does: 'conclude the report reliable' },
        { id: 'ipe-unreliable', label: 'Report not reliable', said: 'Conclude the report not reliable.', primary: ipe.failed > 0, group: 'pair', does: 'conclude the report not reliable' },
      ];
    }
    if (!s.popLocked && !s.popBlock) {
      return [
        { id: 'lock-population', label: `Lock the population at ${s.popCount.toLocaleString('en-IN')} items`, said: 'Lock the population.', primary: true, does: 'lock the population so the sample can be drawn off it' },
        show('Let me look at it first', 'Take me to the population.', 'population'),
      ];
    }
    return [show('Take me to the population', 'Take me to this step.', 'population')];
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
    // ── the evidence itself ─────────────────────────────────────────────────
    // The rail's old rule was that attaching a file is a heavy action and the
    // page owns the uploader. That held while an upload was one file into one
    // named slot — a chat adds nothing to a file picker. It stops holding for
    // SIX files across THREE attributes, which is the actual shape of TOE
    // evidence: on the page that is six separate pickers and six separate
    // decisions about which slot each file belongs in. Sorting a pile into
    // slots is the one thing a copilot is better at than a form, so it is
    // offered here (user ask, 22 Sep) — and it still calls the page's own
    // `uploadRequiredFile`, so there is one uploader in the product, not two.
    if (s.evidenceOwed.length > 0) {
      const totalMissing = s.evidenceOwed.reduce((n, x) => n + x.missing, 0);
      out.push({
        id: 'upload-evidence', primary: s.toeReady === 0,
        label: s.evidenceOwed.length === 1
          ? `Upload the ${plural(totalMissing, 'file')} attribute ${s.evidenceOwed[0].code} needs`
          : `Upload evidence — ${plural(totalMissing, 'file')} across ${plural(s.evidenceOwed.length, 'attribute')}`,
        said: 'I have the evidence — take it.',
        does: 'take a pile of files and put each one against the attribute it proves',
      });
      // …and one door per attribute when there are several, so a reader who
      // has this attribute's files in hand is not made to scope by filename.
      if (s.evidenceOwed.length > 1) {
        s.evidenceOwed.forEach(x => out.push({
          id: 'upload-evidence', arg: x.stepId, group: 'pick',
          label: `${x.code} · ${x.missing} of ${x.total}`,
          said: `Evidence for ${x.code}.`,
          does: `take the files for attribute ${x.code}`,
        }));
      }
    }
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

  // ── ③ the draw ────────────────────────────────────────────────────────────
  // This used to be the page's alone, on the grounds that a draw is two stages
  // and half of one done from here would leave step ③ showing nothing. The
  // answer to that was never "don't offer it" — it was "carry both stages",
  // which is what happens now (user ask, 22 Sep): the ask, the draw, the items
  // to look at, and only then the filing. Nothing is written until the reader
  // has seen what came out, exactly as on the left.
  if (s.step === 'sample') {
    const out: ChatAction[] = [];
    const owed = s.sources.filter(x => !x.drawn);
    const ticks = s.sources.filter(x => x.drawn && !x.approved);
    if (owed.length > 0) {
      const one = owed.length === 1 ? owed[0] : null;
      if (one) {
        out.push({ id: 'draw-sample', arg: one.id, label: `Draw the sample off ${one.file}`, said: 'Draw the sample.', primary: true, does: 'draw the sample off the locked population' });
      } else {
        owed.forEach(x => out.push({ id: 'draw-sample', arg: x.id, label: x.file, group: 'pick', said: `Draw off ${x.file}.`, does: `draw the sample off ${x.file}` }));
      }
    }
    // Filing a draw does not tick the file done — that is its own act on the
    // page and its own act here, because it is the thing that says "I am
    // finished with this file" rather than "the items are on the paper".
    ticks.forEach(x => out.push({ id: 'tick-sample', arg: x.id, label: owed.length ? `Mark ${x.file} done` : `Mark ${x.file} done`, said: `${x.file} is done.`, primary: owed.length === 0, does: `tick ${x.file} off as drawn` }));
    out.push(show('Take me to this step', 'Take me to this step.', s.step));
    return out;
  }

  // ⑤ before both tracks are in: the page does the work.
  return [show('Take me to this step', 'Take me to this step.', s.step)];
}
