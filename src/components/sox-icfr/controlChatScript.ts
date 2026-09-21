import {
  designApproved, designCompleteness, designFilesOf, designOutstanding, designSuggestion, isControlLocked, isEngagementLocked,
  inquiryOnlyAttributes, operatingApplies, operatingProgress, passedWithoutFiles, pendingReviewNoteCount, pointResult,
  populationLocked, populationSources, sampledSources, samePerson, stepResult, toeRoundFailed, trackResult, yearEndPending,
} from './helpers';
import type { AuditRecord, Control, DesignDoc, IcfrEngagement, Role, TrackConclusion } from './types';

/**
 * What Ira knows, and what Ira therefore says.
 *
 * Read the whole thing as one rule: the conversation is a FUNCTION OF THE
 * CONTROL. Nothing here remembers what was said or what was offered; every
 * line is recomputed from the control on every render. Two consequences, both
 * of them the point:
 *
 *  · A prompt that has been answered cannot be offered again, because
 *    answering it changed the state the prompt was derived from.
 *  · It makes no difference whether the answer came from a button in the chat
 *    or a click on the left-hand page. Both move the same control, so both
 *    move the conversation.
 *
 * `situationOf` gathers the facts, using the SAME predicates the page uses —
 * never a second opinion about whether something is done. `nextPrompt` turns
 * those facts into one sentence about the one thing to do next.
 */

export type ChatStepId = 'design' | 'population' | 'sample' | 'operating' | 'signoff';

export interface ChatCtx {
  eng: IcfrEngagement;
  control: Control;
  role: Role;
  me: string;
  audit?: AuditRecord | null;
}

export interface Situation {
  /** Where the work actually is — not where the reader has scrolled. */
  step: ChatStepId;
  /** Changes when, and only when, something Ira would speak about changes. */
  key: string;
  locked: boolean;
  sealed: boolean;
  opApplies: boolean;
  yePending: { until: string } | null;

  // ① design
  designResult: TrackConclusion;
  todApproved: boolean;
  elementsTotal: number;
  elementsOnFile: number;
  missing: DesignDoc[];
  checksTotal: number;
  checksUnmarked: number;
  checksPassed: number;
  checksFailed: number;
  iraRun: boolean;
  iraStale: boolean;
  iraBlocked: string | null;
  designReturn?: { note: string; by: string; at: string };
  /** The design conclusion went against what the evidence suggested. */
  designOverride: boolean;
  /** What the evidence itself pointed to — the reviewer's first question when
   *  the auditor has departed from it. */
  evidenceSuggested: TrackConclusion;
  designRationale?: string;
  /** Elements the auditor has formally asked the owner for, as against ones
   *  simply not on file yet. The owner is owed the difference. */
  requested: DesignDoc[];
  /** Testing stopped because something cannot be produced. */
  blocked?: { reason: string; needed: string; raisedBy: string; converted?: string };
  preparedBy?: { by: string; at: string };
  approvedBy?: { by: string; at: string };
  /** Every required element is evidenced or accounted for — the page's own
   *  gate on concluding the design effective. */
  complete: boolean;
  /** The reader concluded this design themselves, so they cannot approve it. */
  ownConclusion: boolean;
  /** …and the same rule one step later, on the paper itself. */
  ownPaper: boolean;

  // ② population ③ sample ④ operating ⑤ sign-off
  popStarted: boolean;
  popLocked: boolean;
  popCount: number;
  popBlock: string | null;
  sampleDrawn: boolean;
  drawsOwed: number;
  toe: { tested: number; passed: number; failed: number; total: number };
  /** Why the operating conclusion is held, in the page's own terms — the
   *  ConcludeFooter's reasons, read once rather than guessed at twice. */
  toeHolds: string | null;
  operatingResult: TrackConclusion;
  preparerSigned?: { by: string; at: string };
  reviewerSigned?: { by: string; at: string };
  notesPending: number;
}

/** The label the page puts on a design element — kinds speak for themselves,
 *  a Custom one is whatever it was named. Mirrors docLabel in ControlDossier. */
const docLabel = (d: DesignDoc): string => (d.kind === 'Custom' ? d.name : d.kind);

/** "A, B and C" — a list a person would read aloud, capped so the rail keeps
 *  its shape when a control asks for seven documents. */
export function listOf(items: string[], cap = 3): string {
  const shown = items.slice(0, cap);
  const rest = items.length - shown.length;
  const joined = shown.length <= 1 ? (shown[0] ?? '')
    : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${joined} and ${rest} more` : joined;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function situationOf({ eng, control, role, me, audit }: ChatCtx): Situation {
  const d = control.design;
  const o = control.operating;

  const opApplies = operatingApplies(eng, control);
  const sealed = isEngagementLocked(eng);
  const locked = isControlLocked(control, opApplies);
  const yePending = yearEndPending(control, audit ?? null);

  const designResult = trackResult(d);
  const todApproved = designApproved(control);
  const completeness = designCompleteness(control);
  // designOutstanding ignores `required` on purpose (it feeds the conclude
  // suggestion); Ira talks about obligations, so it is filtered here.
  const missing = designOutstanding(control).filter(doc => doc.required !== false);
  const requested = missing.filter(doc => doc.status === 'Requested');
  const elementsOnFile = d.documents.filter(doc => designFilesOf(doc).length > 0).length;

  const checksTotal = d.points.length;
  const checksUnmarked = d.points.filter(p => pointResult(p) === 'Not tested').length;
  const checksPassed = d.points.filter(p => pointResult(p) === 'Pass').length;
  const checksFailed = d.points.filter(p => pointResult(p) === 'Fail').length;

  // The page's own reason the validation cannot run — quoted rather than
  // re-derived, so Ira never offers a button the page would refuse.
  const iraBlocked = checksTotal === 0 ? 'this control’s RACM lists no design checks'
    : elementsOnFile === 0 ? 'nothing is attached to a design element yet'
    : d.conclusion !== 'Not tested' ? 'the design is already concluded'
    : null;

  const popStarted = !!o.population;
  const popLocked = populationLocked(control);
  const ipe = o.ipe;
  const popBlock = popLocked ? null
    : !ipe ? 'Register the report this population came out of, and prove it, before locking.'
    : ipe.conclusion === 'Not reliable' ? 'The report behind this population is not reliable — nothing can be locked off it.'
    : ipe.conclusion === 'Not tested' ? 'Finish the IPE test on the report before locking.'
    : null;

  const drawn = sampledSources(populationSources(control));
  const drawsOwed = drawn.filter(s => !s.approvedSample).length;
  const toe = operatingProgress(control);
  const operatingResult = trackResult(o);
  // The same five things the page's conclude footer refuses on, in the order
  // it refuses on them. An auditor who is told "not yet" deserves the reason
  // that is actually holding it.
  const untested = o.steps.filter(x => stepResult(x) === 'Not tested').length;
  const unbacked = passedWithoutFiles(control).length;
  const onWordAlone = inquiryOnlyAttributes(control).length;
  const staleRuns = o.steps.filter(x => x.staleRun).length;
  const toeHolds = !o.sampling ? 'the sample has not been drawn yet'
    : untested > 0 ? `${plural(untested, 'attribute')} still to test`
    : unbacked > 0 ? `${plural(unbacked, 'attribute')} passed without the files the test asks for`
    : onWordAlone > 0 ? `${plural(onWordAlone, 'attribute')} rests on a statement with nothing behind it`
    : staleRuns > 0 ? `${plural(staleRuns, 'run')} sits against a draw that has since changed`
    : toeRoundFailed(control) ? 'this round failed, so effective is not available on it'
    : null;

  const preparedBy = d.approval?.preparedBy ?? (d.testedBy ? { by: d.testedBy, at: d.testedAt ?? '' } : undefined);

  // ── where the work is ─────────────────────────────────────────────────────
  // Strictly the order the paper runs in, and each step is "current" until the
  // thing that unlocks the next one has happened.
  const step: ChatStepId =
    // A finished control is at the end of the paper whatever the middle steps
    // look like. Without this it reported the first step it could not tick —
    // "② Population" on a control that was signed and countersigned months ago.
    locked ? 'signoff'
    : designResult === 'Not tested' || !todApproved ? 'design'
    : !opApplies ? 'signoff'
    : yePending ? 'population'
    : !popLocked ? 'population'
    : !o.sampling || drawsOwed > 0 ? 'sample'
    : operatingResult === 'Not tested' ? 'operating'
    : 'signoff';

  const s: Situation = {
    step, key: '', locked, sealed, opApplies, yePending,
    designResult, todApproved,
    elementsTotal: completeness.total, elementsOnFile, missing,
    complete: completeness.total > 0 && completeness.pct === 100,
    ownConclusion: samePerson(preparedBy, me),
    ownPaper: samePerson(control.wpSignoff?.preparer, me),
    checksTotal, checksUnmarked, checksPassed, checksFailed,
    iraRun: !!d.ira, iraStale: !!d.ira?.evidenceChanged, iraBlocked,
    designReturn: d.designReturn, designOverride: !!d.override, evidenceSuggested: designSuggestion(control),
    designRationale: d.rationale, requested,
    blocked: control.unableToTest && {
      reason: control.unableToTest.reason, needed: control.unableToTest.needed,
      raisedBy: control.unableToTest.raisedBy, converted: control.unableToTest.convertedTo,
    },
    preparedBy, approvedBy: d.approval?.approvedBy,
    popStarted, popLocked, popCount: o.population?.count ?? 0, popBlock,
    sampleDrawn: !!o.sampling, drawsOwed, toe, toeHolds, operatingResult,
    preparerSigned: control.wpSignoff?.preparer, reviewerSigned: control.wpSignoff?.reviewer,
    notesPending: pendingReviewNoteCount(eng, control.id),
  };
  s.key = [
    role, step, designResult, todApproved, missing.length, elementsOnFile,
    checksUnmarked, checksFailed, s.iraRun, s.iraStale, !!d.designReturn,
    popLocked, s.sampleDrawn, drawsOwed, toe.tested, toe.failed, operatingResult,
    !!s.preparerSigned, !!s.reviewerSigned, s.notesPending, locked,
  ].join('|');
  return s;
}

export interface ChatPrompt {
  /** The situation this line answers — the same key twice is the same line. */
  key: string;
  step: ChatStepId;
  text: string;
  /** The facts the line was made of, so the buttons under it are guarded by
   *  the same reading rather than a second one. */
  situation: Situation;
}

/**
 * One sentence about the one next thing, in the voice of somebody who has read
 * the paper. Every branch below is a state the control can actually be in; if
 * none of them fits, Ira says what it can see rather than inventing a task.
 */
export function nextPrompt(ctx: ChatCtx): ChatPrompt {
  const s = situationOf(ctx);
  const { role, control } = ctx;
  const line = (text: string): ChatPrompt => ({ key: s.key, step: s.step, text, situation: s });

  // ── the paper is shut ─────────────────────────────────────────────────────
  if (s.sealed) return line('This engagement is signed off, so nothing on this control can move. I can still walk you through what was done and why.');
  if (s.locked && s.reviewerSigned) return line(`Done — ${s.preparerSigned?.by ?? 'the auditor'} signed this paper and ${s.reviewerSigned.by} countersigned it. Ask me anything about how it got here.`);

  // ── the risk owner: their lane is the documents ───────────────────────────
  if (role === 'risk-owner') {
    // Testing has stopped on something only they can produce — that outranks
    // every ordinary document request, because nothing moves until it lands.
    if (s.blocked && !s.blocked.converted) {
      return line(`Testing is stopped here until you produce ${s.blocked.needed}. ${s.blocked.raisedBy} recorded why: “${s.blocked.reason}” — it is not a finding, and testing picks up where it left off.`);
    }
    if (s.blocked?.converted) {
      return line(`This one was never evidenced, so it was raised as ${s.blocked.converted}. What was asked for: ${s.blocked.needed}.`);
    }
    if (s.missing.length > 0) {
      // Asked-for and not-yet-on-file are different obligations, and an owner
      // reading "outstanding" about something nobody has asked them for has
      // been made to feel late for no reason.
      const asked = s.requested.length;
      const opening = asked === s.missing.length
        ? `${controlHandle(control)}: the auditor has asked you for ${listOf(s.requested.map(docLabel))}`
        : asked > 0
          ? `${controlHandle(control)}: the auditor has asked you for ${listOf(s.requested.map(docLabel))}, and ${plural(s.missing.length - asked, 'other document')} ${s.missing.length - asked === 1 ? 'is' : 'are'} not on file either`
          : `${plural(s.missing.length, 'document')} is not on file yet — ${listOf(s.missing.map(docLabel))}`;
      return line(`${opening}. Attach ${s.missing.length === 1 ? 'it' : 'them'} and the design can be tested.`);
    }
    if (s.designResult === 'Ineffective') {
      return line('Everything asked for is on file. The design came out ineffective, so the fix is yours — the remediation brief on the left says what was found and what it needs.');
    }
    if (s.designResult === 'Not tested') return line('Everything asked for is on file. The auditor is testing the design — nothing is waiting on you.');
    if (s.toe.failed > 0) return line(`Everything asked for is on file. The design held, but ${plural(s.toe.failed, 'attribute')} failed in testing — the exceptions are yours to remediate.`);
    return line('Everything asked for is on file and the design held. Nothing is waiting on you here.');
  }

  // ── the reviewer: approve, return, countersign ────────────────────────────
  if (role === 'reviewer') {
    if (s.designReturn) {
      return line(`You sent this design back: “${s.designReturn.note}”. It comes back to you once the auditor has answered it and concluded again.`);
    }
    if (s.designResult !== 'Not tested' && !s.approvedBy) {
      if (s.ownConclusion) {
        return line('You concluded this design yourself, so somebody else has to approve it. Four eyes — the person who did the work cannot be the one who signs it off.');
      }
      // A departure from the evidence is the one thing a reviewer must not
      // have to discover for themselves.
      if (s.designOverride) {
        return line(`${s.preparedBy?.by ?? 'The auditor'} concluded the design ${s.designResult.toLowerCase()} against the evidence, which pointed to ${s.evidenceSuggested.toLowerCase()}.${s.designRationale ? ` Their reason: “${s.designRationale}”` : ''} That is the thing to weigh before you approve it.`);
      }
      return line(`${s.preparedBy?.by ?? 'The auditor'} concluded the design ${s.designResult.toLowerCase()}${s.checksFailed > 0 ? ` on ${plural(s.checksFailed, 'failed check')}` : `, with all ${s.checksTotal} checks passed`}. Approve it, or send it back with a note.`);
    }
    if (s.preparerSigned && !s.reviewerSigned) {
      if (s.notesPending > 0) return line(`The paper is signed and waiting on you, but ${plural(s.notesPending, 'review note')} ${s.notesPending === 1 ? 'is' : 'are'} still open. Those close before you can countersign.`);
      if (s.ownPaper) return line('You prepared this paper, so it needs a different reviewer to countersign. Nothing for you here.');
      const outcome = s.operatingResult === 'Ineffective' ? ' It concludes ineffective, so the exception and its grading are part of what you are signing.'
        : s.opApplies ? ` Design and operating both held — ${s.toe.passed} of ${s.toe.total} attributes passed.`
        : ' Operating testing does not apply to this control, so the design conclusion is the whole of it.';
      return line(`The paper is prepared and waiting for your countersignature.${outcome} The working paper button up top has the whole thing.`);
    }
    if (s.notesPending > 0) {
      return line(`${plural(s.notesPending, 'review note')} of yours ${s.notesPending === 1 ? 'is' : 'are'} still open on this control. Nothing else is waiting on you until ${s.notesPending === 1 ? 'it is' : 'they are'} answered.`);
    }
    return line(`Nothing is waiting on you yet. The design is ${s.designResult === 'Not tested' ? 'still being tested' : `${s.designResult.toLowerCase()} and approved`}, and I will tell you the moment there is something to review.`);
  }

  // ── the auditor: the work itself ──────────────────────────────────────────
  if (s.step === 'design') {
    if (s.designReturn) {
      return line(`The reviewer sent the design back: “${s.designReturn.note}” — the conclusion is cleared, so this is open again. Fix what they raised and conclude afresh.`);
    }
    if (s.elementsTotal === 0 && s.checksTotal === 0) {
      return line('Nothing has been set up for this control’s design yet — no documents asked for, no checks to assess. The RACM is where both come from.');
    }
    if (s.missing.length > 0) {
      return line(`${plural(s.missing.length, 'required document')} missing before the design can be tested — ${listOf(s.missing.map(docLabel))}. Ask the owner for ${s.missing.length === 1 ? 'it' : 'them'}, or attach ${s.missing.length === 1 ? 'it' : 'them'} yourself if you have ${s.missing.length === 1 ? 'it' : 'them'}.`);
    }
    if (s.designResult !== 'Not tested' && !s.todApproved) {
      return line(`Design is concluded ${s.designResult.toLowerCase()} and sitting with the reviewer. Population unlocks once they approve it — nothing else to do on the design.`);
    }
    if (s.checksTotal === 0) {
      return line('Every document is on file, but this control’s RACM lists no design checks, so there is nothing to assess. The conclusion is a judgement call on the documents alone.');
    }
    if (s.checksUnmarked > 0) {
      const ready = !s.iraBlocked;
      return line(`Everything asked for is on file. ${plural(s.checksUnmarked, 'design check')} of ${s.checksTotal} not marked yet${ready ? ' — I can read the evidence and assess them all in one go, or you can mark them by hand.' : `, and I cannot run the validation because ${s.iraBlocked}.`}`);
    }
    if (s.iraStale) {
      return line(`All ${s.checksTotal} checks are marked, but the evidence has changed since I last read it. Worth a re-run before you conclude.`);
    }
    const suggests = s.checksFailed > 0 ? 'ineffective' : 'effective';
    return line(`All ${s.checksTotal} checks are marked — ${s.checksPassed} pass, ${s.checksFailed} fail. The evidence points to ${suggests}. Conclude the design and it goes to the reviewer.`);
  }

  if (s.step === 'population') {
    if (s.yePending) return line(`This is an annual control, so it is tested in the year-end audit — ${s.yePending.until}. Nothing to draw here.`);
    if (!s.popStarted) return line('Design is approved, so the population is next: point me at the report it comes out of and say what to pull, and I will extract it.');
    if (s.popBlock) return line(`${s.popCount ? `${s.popCount.toLocaleString('en-IN')} items extracted. ` : ''}${s.popBlock}`);
    return line(`${s.popCount.toLocaleString('en-IN')} items extracted and the report behind them is proved. Lock the population and the sample can be drawn off it.`);
  }

  if (s.step === 'sample') {
    if (!s.sampleDrawn) return line(`Population is locked at ${s.popCount.toLocaleString('en-IN')} items. Next is the sample — the size follows how often the control runs, and the method and seed are stored so anyone can reproduce the same items.`);
    return line(`${plural(s.drawsOwed, 'source file')} still ${s.drawsOwed === 1 ? 'owes' : 'owe'} a draw${s.popCount ? ` off the ${s.popCount.toLocaleString('en-IN')} locked items` : ''}. Once every file is drawn, testing can start on the sample.`);
  }

  if (s.step === 'operating') {
    if (s.toe.total === 0) return line('The sample is drawn, but this control has no attributes to test against — that comes from the RACM.');
    if (s.toe.tested === 0) return line(`Sample is drawn and ${plural(s.toe.total, 'attribute')} are waiting. Each sampled item gets a pass or fail against each attribute, with the evidence attached.`);
    if (s.toe.tested < s.toe.total) {
      return line(`${s.toe.tested} of ${s.toe.total} attributes tested${s.toe.failed > 0 ? `, ${s.toe.failed} failed so far` : ''}. Keep going — the conclusion unlocks when every attribute has a result.`);
    }
    if (s.toeHolds) {
      return line(`All ${s.toe.total} attributes are tested — ${s.toe.passed} pass, ${s.toe.failed} fail — but the conclusion is held: ${s.toeHolds}.`);
    }
    return line(`All ${s.toe.total} attributes are tested — ${s.toe.passed} pass, ${s.toe.failed} fail. Conclude the operating effectiveness and the control is ready to sign.`);
  }

  // ⑤ final
  if (!s.preparerSigned) {
    return line(`${s.opApplies ? 'Both tracks are' : 'The design is'} concluded, so this paper is ready to sign. Your signature sends it to the reviewer to countersign.`);
  }
  // Who actually signed it matters: an auditor reading "you signed this" about
  // somebody else's signature learns the wrong thing about their own paper.
  const signer = s.ownPaper ? 'You' : s.preparerSigned.by;
  return line(`${signer} signed this paper${s.preparerSigned.at ? ` ${s.preparerSigned.at}` : ''}. It is with the reviewer now${s.notesPending > 0 ? `, and ${plural(s.notesPending, 'review note')} ${s.notesPending === 1 ? 'is' : 'are'} open against it` : ''}.`);
}

/** The control's own handle, for the greeting's first line. */
export const controlHandle = (control: Control): string => control.code ?? control.id;

/**
 * What changed, said once, in the past tense.
 *
 * The prompt above says what to do NEXT; this says what just happened. Keeping
 * them apart is what stops the rail repeating itself — "five checks came back"
 * then "conclude the design" reads like somebody keeping up, while two lines
 * both describing the same state reads like a bug.
 *
 * It does not care WHERE the change came from. A tick on the left-hand page
 * and a button in the chat produce the same diff, which is the whole reason
 * the copilot can be left alone while the auditor works the page.
 *
 * Only one line per change, and only for changes worth remarking on — a
 * running commentary on every keystroke would be noise wearing a helpful face.
 */
export function acknowledge(prev: Situation, next: Situation): string | null {
  // ── ① design ──────────────────────────────────────────────────────────────
  if (next.designReturn && !prev.designReturn) {
    return `${next.designReturn.by} sent the design back. The conclusion is cleared, so it is open again.`;
  }
  if (prev.missing.length > next.missing.length) {
    const settled = prev.missing.filter(d => !next.missing.some(m => m.id === d.id));
    const what = listOf(settled.map(docLabel));
    return next.missing.length === 0
      ? `${what} is accounted for — that was the last one the design was waiting on.`
      : `${what} is accounted for. ${plural(next.missing.length, 'element')} still outstanding.`;
  }
  if (prev.elementsOnFile < next.elementsOnFile && next.missing.length > 0) {
    return 'New evidence is attached.';
  }
  if (!prev.iraRun && next.iraRun) {
    // The counts belong to the prompt underneath; saying them twice in two
    // adjacent bubbles reads like a stutter rather than a summary.
    return `Done — I read the evidence against all ${next.checksTotal} design ${next.checksTotal === 1 ? 'check' : 'checks'}.`;
  }
  if (prev.checksUnmarked > next.checksUnmarked) {
    return next.checksUnmarked === 0
      ? 'That is every design check marked.'
      : `${plural(prev.checksUnmarked - next.checksUnmarked, 'check')} marked.`;
  }
  if (!prev.iraStale && next.iraStale) {
    return 'The evidence has changed since I last read it, so that validation is stale now.';
  }
  if (prev.designResult === 'Not tested' && next.designResult !== 'Not tested') {
    return next.designOverride
      ? `Design concluded ${next.designResult.toLowerCase()}, against what the evidence suggested. Your rationale is on the paper as the reason.`
      : `Design concluded ${next.designResult.toLowerCase()}.`;
  }
  if (!prev.todApproved && next.todApproved) {
    return `${next.approvedBy?.by ?? 'The reviewer'} approved the design. Population is open.`;
  }

  // ── ② → ⑤, which have the rail but not the script yet ─────────────────────
  if (!prev.popLocked && next.popLocked) return `Population locked at ${next.popCount.toLocaleString('en-IN')} items.`;
  if (!prev.sampleDrawn && next.sampleDrawn) return 'Sample drawn.';
  if (prev.drawsOwed > next.drawsOwed && next.drawsOwed === 0) return 'Every source file has its draw.';
  if (prev.toe.tested < next.toe.tested) {
    return next.toe.tested === next.toe.total
      ? `That is all ${next.toe.total} attributes tested — ${next.toe.passed} pass, ${next.toe.failed} fail.`
      : `${next.toe.tested} of ${next.toe.total} attributes tested.`;
  }
  if (prev.operatingResult === 'Not tested' && next.operatingResult !== 'Not tested') {
    return `Operating effectiveness concluded ${next.operatingResult.toLowerCase()}.`;
  }
  if (!prev.preparerSigned && next.preparerSigned) return `${next.ownPaper ? 'You signed' : `${next.preparerSigned.by} signed`} the paper.`;
  if (!prev.reviewerSigned && next.reviewerSigned) return `${next.reviewerSigned.by} countersigned it. This control is done.`;
  if (prev.locked && !next.locked) return 'This control is open again.';
  return null;
}
