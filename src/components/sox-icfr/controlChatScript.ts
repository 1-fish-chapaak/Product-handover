import {
  designApproved, designBlocked, designCompleteness, designFilesOf, designOutstanding, designSuggestion, isControlLocked, isEngagementLocked,
  inquiryOnlyAttributes, operatingApplies, operatingProgress, passedWithoutFiles, pendingReviewNoteCount, pointResult,
  populationLocked, populationSources, requiredFilesCount, requiredFilesReady, sampledSources, samePerson, stepResult, toeRoundFailed, trackResult, yearEndPending,
} from './helpers';
import { evidenceOwed } from './controlChatEvidence';
import type { AuditRecord, Control, DesignDoc, DesignDocKind, IcfrEngagement, IpeConclusion, Role, TestResult, TrackConclusion } from './types';

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

/**
 * One file this audit holds, as the rail needs to talk about it.
 *
 * It comes in from the pane rather than off the control, because the audit's
 * files are the ENGAGEMENT's (`useAuditFiles`), not this control's — the whole
 * point of registering one is that every other control can draw on it without
 * being asked where it came from again.
 */
export interface PopFile {
  name: string;
  rows: number;
  /** The system of record it was pulled out of, where there was one. */
  system?: string;
  /** Where it entered from — what the population's source line will read. */
  from: string;
  /** Provenance is answered, so a population may stand on it (`fileUsable`).
   *  A file nobody can place is a source you cannot build a test on. */
  usable: boolean;
}

export interface ChatCtx {
  eng: IcfrEngagement;
  control: Control;
  role: Role;
  me: string;
  audit?: AuditRecord | null;
  /** Everything the source picker on the left would offer. Absent where the
   *  caller only wants to know which step the work is on. */
  files?: PopFile[];
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
  /** The element kinds already on this control, so Ira's Add-element offer is
   *  the page's own menu minus what is there — never a duplicate. */
  elementKinds: DesignDocKind[];
  missing: DesignDoc[];
  checksTotal: number;
  checksUnmarked: number;
  checksPassed: number;
  checksFailed: number;
  iraRun: boolean;
  iraStale: boolean;
  /** Why the whole run cannot start. */
  iraBlocked: string | null;
  /** Checks the run DID reach and could not answer — still unmarked, still
   *  holding the conclusion, and re-running changes nothing about them until
   *  the evidence does. Different from `iraBlocked`, which is the run itself
   *  never starting. */
  checksBlocked: { text: string; reason: string }[];
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
  /** The files this audit offers to draw a population off. Empty is a real and
   *  common state — an audit created without a trial balance or a ledger — and
   *  it is the difference between "point me at the report" and "there is
   *  nothing here to point at yet". */
  popFiles: PopFile[];
  /** The report the population came out of, and how far its proof has got.
   *  Four dimensions, each one a person's judgement with a written finding —
   *  see `ipeChecklist`. Null until a report is registered, which is a form
   *  the page owns (system, t-code, parameters, who ran it, control total). */
  ipe: {
    reportName: string;
    conclusion: IpeConclusion;
    checks: { id: string; dimension: string; result: TestResult; note?: string }[];
    untested: { id: string; dimension: string }[];
    failed: number;
  } | null;
  sampleDrawn: boolean;
  drawsOwed: number;
  /** The files a draw comes off — one draw each, and a tick each when the
   *  auditor is done with it. Assisting tables are not in here: they join onto
   *  the population, they are not sampled. */
  sources: { id: string; file: string; count: number; drawn: boolean; approved: boolean }[];
  toe: { tested: number; passed: number; failed: number; total: number };
  /** Why the operating conclusion is held, in the page's own terms — the
   *  ConcludeFooter's reasons, read once rather than guessed at twice. */
  toeHolds: string | null;
  /** A run sits against a draw that has since changed. The page refuses BOTH
   *  conclusions on this, where every other hold only blocks Effective. */
  toeStale: boolean;
  /** Attributes with every required file uploaded — what a validation run can
   *  actually read, and the page's own count on its Run button. */
  toeReady: number;
  /** Attributes still short of the files their test asks for — the pile the
   *  reader is about to hand over, per attribute. */
  evidenceOwed: { stepId: string; code: string; missing: number; total: number }[];
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

export function situationOf({ eng, control, role, me, audit, files }: ChatCtx): Situation {
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
  // The same order, the same reasons, the same words the page uses — a rail
  // that gave a second opinion about whether the test can start would be the
  // one thing worse than no rail. `missing` first: a required element that is
  // not on file stops the test outright (user ask, 22 Sep), because reading
  // checks against evidence that has not arrived assesses the file room.
  const iraBlocked = checksTotal === 0 ? 'this control’s RACM lists no design checks'
    : missing.length > 0 ? `${listOf(missing.map(docLabel))} ${missing.length === 1 ? 'is' : 'are'} not on file yet, and the checks are read against the evidence`
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
    elementKinds: d.documents.map(doc => doc.kind),
    complete: completeness.total > 0 && completeness.pct === 100,
    ownConclusion: samePerson(preparedBy, me),
    ownPaper: samePerson(control.wpSignoff?.preparer, me),
    checksTotal, checksUnmarked, checksPassed, checksFailed,
    iraRun: !!d.ira, iraStale: !!d.ira?.evidenceChanged, iraBlocked,
    checksBlocked: designBlocked(control).map(p => ({ text: p.text, reason: p.validation!.blocked! })),
    designReturn: d.designReturn, designOverride: !!d.override, evidenceSuggested: designSuggestion(control),
    designRationale: d.rationale, requested,
    blocked: control.unableToTest && {
      reason: control.unableToTest.reason, needed: control.unableToTest.needed,
      raisedBy: control.unableToTest.raisedBy, converted: control.unableToTest.convertedTo,
    },
    preparedBy, approvedBy: d.approval?.approvedBy,
    popStarted, popLocked, popCount: o.population?.count ?? 0, popBlock, popFiles: files ?? [],
    ipe: ipe ? {
      reportName: ipe.reportName,
      conclusion: ipe.conclusion,
      checks: ipe.checks.map(k => ({ id: k.id, dimension: k.dimension, result: k.result, note: k.note })),
      untested: ipe.checks.filter(k => k.result === 'Not tested').map(k => ({ id: k.id, dimension: k.dimension })),
      failed: ipe.checks.filter(k => k.result === 'Fail').length,
    } : null,
    sampleDrawn: !!o.sampling, drawsOwed, toe, toeHolds, toeStale: staleRuns > 0,
    sources: drawn.map(x => ({ id: x.id, file: x.file, count: x.count, drawn: !!x.draw, approved: !!x.approvedSample })),
    toeReady: o.steps.filter(x => stepResult(x) === 'Not tested' && requiredFilesReady(x, control)).length,
    evidenceOwed: evidenceOwed(control),
    operatingResult,
    preparerSigned: control.wpSignoff?.preparer, reviewerSigned: control.wpSignoff?.reviewer,
    notesPending: pendingReviewNoteCount(eng, control.id),
  };
  s.key = [
    role, step, designResult, todApproved, missing.length, elementsOnFile, d.documents.length,
    checksUnmarked, checksFailed, s.iraRun, s.iraStale, s.checksBlocked.length, !!d.designReturn,
    // The extract itself, which the key used to miss entirely: locking was in
    // here but the population landing was not, so a reader who extracted on the
    // left left Ira holding the sentence it had already typed.
    popStarted, s.popCount,
    popLocked, s.sampleDrawn, drawsOwed, drawn.map(x => `${x.draw ? 'd' : '-'}${x.approvedSample ? 'a' : '-'}`).join(''),
    // A file landing on the audit, or its provenance being answered, changes
    // what Ira can offer at the extraction — so it changes the line too.
    (files ?? []).map(f => (f.usable ? 'u' : '-')).join(''),
    toe.tested, toe.failed, operatingResult, o.steps.map(x => requiredFilesCount(x, control).uploaded).join(','),
    ipe?.conclusion ?? '-', ipe?.checks.map(k => k.result).join('') ?? '-',
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
    // Setting up comes before testing, and the page's own empty state says as
    // much — "TOD isn't set up yet · Add the design elements this control is
    // evidenced by". Ira used to read that state and offer the ONE thing it
    // could still technically do, which was to conclude the design ineffective
    // on a control nobody had started testing (user ask, 22 Sep). The first
    // move is the elements, so the first move is what it offers.
    if (s.elementsTotal === 0) {
      return line(s.checksTotal === 0
        ? 'Nothing is set up for this control’s design yet. It starts with the elements the control is evidenced by — pick the ones it has and I’ll add them, then attach the file against each. The checks themselves arrive with the RACM.'
        : `The RACM gives this control ${plural(s.checksTotal, 'design check')}, but there is nothing to read ${s.checksTotal === 1 ? 'it' : 'them'} against yet. Pick the elements this control is evidenced by and I’ll add them.`);
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
      // ── the ones I read and could not answer (user ask, 22 Sep) ───────────
      // Re-running changes nothing about these until the evidence does, so
      // offering the run again would be the rail asking for a click it knows
      // will produce the same sentence. It says what is missing instead.
      const cant = s.checksBlocked;
      if (cant.length > 0 && cant.length === s.checksUnmarked) {
        return line(cant.length === 1
          ? `I read the evidence and could not answer the last one: “${cant[0].text}” — ${cant[0].reason} Mark it yourself if you know the answer, or attach what it needs and I will look again.`
          : `I read the evidence and could not answer ${plural(cant.length, 'of the checks', 'of the checks')}:\n\n${cant.map(x => `· ${x.text}\n  ${x.reason}`).join('\n')}\n\nMark them yourself if you know the answers, or attach what they need and I will look again.`);
      }
      const ready = !s.iraBlocked;
      const also = cant.length > 0 ? ` ${plural(cant.length, 'of them is', 'of them are')} waiting on me — I read ${cant.length === 1 ? 'it' : 'them'} and could not answer, so ${cant.length === 1 ? 'that one is' : 'those are'} yours or the evidence's.` : '';
      return line(`Everything asked for is on file. ${plural(s.checksUnmarked, 'design check')} of ${s.checksTotal} not marked yet${ready ? ' — I can read the evidence and assess them all in one go, or you can mark them by hand.' : `, and I cannot run the validation because ${s.iraBlocked}.`}${also}`);
    }
    if (s.iraStale) {
      return line(`All ${s.checksTotal} checks are marked, but the evidence has changed since I last read it. Worth a re-run before you conclude.`);
    }
    const suggests = s.checksFailed > 0 ? 'ineffective' : 'effective';
    return line(`All ${s.checksTotal} checks are marked — ${s.checksPassed} pass, ${s.checksFailed} fail. The evidence points to ${suggests}. Conclude the design and it goes to the reviewer.`);
  }

  if (s.step === 'population') {
    if (s.yePending) return line(`This is an annual control, so it is tested in the year-end audit — ${s.yePending.until}. Nothing to draw here.`);
    // ── the extraction, done from here ──────────────────────────────────────
    // This used to be one sentence — "point me at the report it comes out of"
    // — under a button that only scrolled the page. On an audit with no source
    // data on it there was nothing to point AT, which is the state the reader
    // found it in (22 Sep): an offer to extract, over an empty picker. So the
    // line now says which of the three it actually is, and the upload itself
    // happens in here.
    if (!s.popStarted) {
      const usable = s.popFiles.filter(f => f.usable);
      if (s.popFiles.length === 0) {
        return line('Design is approved, so the population is next — but there is no source data on this audit yet. Hand me the file this control operates on and I will take it from there. It joins the audit’s files, so every other control can draw on it without being asked where it came from again.');
      }
      if (usable.length === 0) {
        return line(`${plural(s.popFiles.length, 'file')} on this audit, and ${s.popFiles.length === 1 ? 'nobody has said where it came from' : 'nobody has said where any of them came from'}. A population cannot stand on a file nobody can place, so that is answered first — on the file itself, under Configuration — or hand me another file and I will ask you as it lands.`);
      }
      const one = usable.length === 1 ? usable[0] : null;
      return line(one
        ? `Design is approved, so the population is next. This audit has one file to draw on — ${one.name}, ${one.rows.toLocaleString('en-IN')} rows. If that is what this control operated on I will draft the filter off it; if it is not, hand me the file that is.`
        : `Design is approved, so the population is next. This audit has ${plural(usable.length, 'file')} to draw on. Pick the one this control operated on and I will draft the filter, or hand me a file that is not here yet.`);
    }
    const had = s.popCount ? `${s.popCount.toLocaleString('en-IN')} items extracted. ` : '';
    // ── the IPE test, said as work rather than as a blocker ──────────────────
    // This used to read "Finish the IPE test on the report before locking" and
    // offer one button, which pointed at the page. Ira can do the test WITH
    // the reader now (user ask, 22 Sep), so it says what the test is and where
    // it has got to. The four dimensions are a person's judgement each, and
    // each needs a written finding before it can be answered — that is the
    // page's rule and it is the rule here.
    const ipe = s.ipe;
    if (ipe && ipe.conclusion === 'Not tested') {
      if (ipe.untested.length === 0) {
        return line(`${had}Every one of the ${plural(ipe.checks.length, 'IPE check')} is answered${ipe.failed > 0 ? ` and ${plural(ipe.failed, 'one')} failed` : ''}. ${ipe.failed > 0 ? 'A single failure sinks the report — an incomplete population is the wrong population, not a slightly worse one.' : 'The report holds up.'} Call it, and the population can be locked.`);
      }
      const done = ipe.checks.length - ipe.untested.length;
      return line(`${had}Before it can be locked, ${ipe.reportName} itself has to hold up — ${plural(ipe.checks.length, 'check')} on the report, ${done === 0 ? 'none answered yet' : `${done} answered`}. Pick one and I will put what you found on the paper: ${listOf(ipe.untested.map(k => k.dimension.toLowerCase()), 4)}.`);
    }
    if (s.popBlock) return line(`${had}${s.popBlock}`);
    return line(`${s.popCount.toLocaleString('en-IN')} items extracted and the report behind them is proved. Lock the population and the sample can be drawn off it.`);
  }

  if (s.step === 'sample') {
    const owed = s.sources.filter(x => !x.drawn);
    const drawnNotTicked = s.sources.filter(x => x.drawn && !x.approved);
    if (owed.length > 0) {
      const one = owed.length === 1 ? owed[0] : null;
      return line(`Population is locked at ${s.popCount.toLocaleString('en-IN')} items. ${one
        ? `The sample comes off ${one.file} — ${one.count.toLocaleString('en-IN')} instances in it.`
        : `${plural(owed.length, 'source file')} still ${owed.length === 1 ? 'owes' : 'owe'} a draw — ${listOf(owed.map(x => x.file))}.`} The size follows how often the control runs, and the method and seed are stored so anyone can reproduce the same items. Say what to take and I will draw it.`);
    }
    if (drawnNotTicked.length > 0) {
      return line(`${plural(drawnNotTicked.length, 'file')} ${drawnNotTicked.length === 1 ? 'is' : 'are'} drawn but not ticked off — ${listOf(drawnNotTicked.map(x => x.file))}. Mark ${drawnNotTicked.length === 1 ? 'it' : 'them'} done and testing can start on the sample.`);
    }
    return line('Every source file has its draw. Testing can start on the sample.');
  }

  if (s.step === 'operating') {
    if (s.toe.total === 0) return line('The sample is drawn, but this control has no attributes to test against — that comes from the RACM.');
    // What is holding the untested ones is the useful half of this: "12 to go"
    // and "12 to go, none of which have their files" are different problems.
    const waiting = s.toe.total - s.toe.tested;
    const filesNote = s.toeReady === 0
      ? waiting === 1
        ? ' It does not have all the files the test asks for yet, so there is nothing I can read.'
        : ' None of them have all the files the test asks for yet, so there is nothing I can read.'
      : s.toeReady < waiting ? ` ${plural(s.toeReady, 'of them has', 'of them have')} all its files — I can read those.`
      : waiting === 1 ? ' It has its files, so I can read it.'
      : ' Every one of them has its files, so I can read them all in one go.';
    if (s.toe.tested === 0) return line(`Sample is drawn and ${plural(s.toe.total, 'attribute')} ${s.toe.total === 1 ? 'is' : 'are'} waiting.${filesNote}`);
    if (s.toe.tested < s.toe.total) {
      return line(`${s.toe.tested} of ${s.toe.total} attributes tested${s.toe.failed > 0 ? `, ${s.toe.failed} failed so far` : ''}.${filesNote}`);
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
  if (next.elementsTotal > prev.elementsTotal) {
    const added = next.missing.filter(d => !prev.missing.some(m => m.id === d.id));
    const what = added.length ? listOf(added.map(docLabel)) : 'That';
    return `${what} added — it is on the design step, waiting for its file.`;
  }
  if (prev.elementsOnFile < next.elementsOnFile && next.missing.length > 0) {
    return 'New evidence is attached.';
  }
  if (!prev.iraRun && next.iraRun) {
    // The counts belong to the prompt underneath; saying them twice in two
    // adjacent bubbles reads like a stutter rather than a summary. The ones it
    // could NOT answer are the exception: that is not a count, it is the
    // difference between what was asked of me and what I did.
    const cant = next.checksBlocked.length;
    return cant > 0
      ? `Done — I read the evidence against all ${next.checksTotal} design ${next.checksTotal === 1 ? 'check' : 'checks'}, and there ${cant === 1 ? 'is one' : `are ${cant}`} I could not answer.`
      : `Done — I read the evidence against all ${next.checksTotal} design ${next.checksTotal === 1 ? 'check' : 'checks'}.`;
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
      ? `Design concluded ${next.designResult.toLowerCase()}, against what the evidence suggested. The rationale on the paper is what records why.`
      : `Design concluded ${next.designResult.toLowerCase()}.`;
  }
  if (!prev.todApproved && next.todApproved) {
    return `${next.approvedBy?.by ?? 'The reviewer'} approved the design. Population is open.`;
  }

  // ── ② → ⑤ ─────────────────────────────────────────────────────────────────
  if (!prev.popStarted && next.popStarted) {
    return `Population extracted — ${next.popCount.toLocaleString('en-IN')} instances.`;
  }
  if (prev.ipe && next.ipe && prev.ipe.untested.length > next.ipe.untested.length) {
    const settled = prev.ipe.untested.filter(k => !next.ipe!.untested.some(u => u.id === k.id));
    const left = next.ipe.untested.length;
    return `${listOf(settled.map(k => k.dimension))} recorded.${left === 0 ? ' That is every check on the report answered.' : ` ${plural(left, 'check')} to go.`}`;
  }
  if (prev.ipe?.conclusion === 'Not tested' && next.ipe && next.ipe.conclusion !== 'Not tested') {
    return next.ipe.conclusion === 'Reliable'
      ? 'Report concluded reliable. The population can be locked off it now.'
      : 'Report concluded not reliable — nothing can be locked off it until the extract is put right.';
  }
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
