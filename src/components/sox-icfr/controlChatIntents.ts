import type { ChatAction, ChatActionId } from './controlChatActions';
import type { Situation } from './controlChatScript';
import { listOf } from './controlChatScript';
import { pointResult, requiredFilesReady, stepResult } from './helpers';
import type { Control, DesignPoint, OperatingStep, Role, TestResult } from './types';

/**
 * Typing, understood as far as it honestly can be.
 *
 * The buttons lead — they are the contract. This reads a sentence and tries to
 * land it on one of those same actions, so a typed "run the validation" and
 * the button beside it are the identical call. Three rules:
 *
 *  · An intent is carried out only if the PAGE would carry it out. Usually
 *    that means the button was on offer; the one exception is the validation,
 *    which the rail hides while a document is outstanding but the page would
 *    still run — a typed instruction means it, so it runs, with a warning
 *    about what it will cost. Nothing here gets round a gate the store holds.
 *  · A request Ira understands but cannot do gets the reason, not a shrug:
 *    "I can't run it — the design is already concluded."
 *  · Anything else gets an honest fallback that names what it CAN do on this
 *    step. A copilot that says "I didn't understand" and stops has made the
 *    reader's problem their own again.
 *
 * No natural-language model sits behind this and none is pretended: it is a
 * short list of phrasings an auditor actually types, matched in order.
 */

export type Intent =
  | { kind: 'action'; action: ChatAction; note?: string }
  | { kind: 'mark'; pointId: string; label: string; result: TestResult }
  /** The same sentence one track later. "pass 5.1" means the design check on
   *  step ① and the attribute itself on step ④, because that is what it means
   *  to the person typing it — they are looking at one of the two. */
  | { kind: 'mark-step'; stepId: string; label: string; result: TestResult }
  | { kind: 'reply'; text: string }
  /** Nothing matched at all. Held apart from a `reply` because a caller that
   *  is mid-question needs the difference: "I understood you and here is the
   *  answer" and "I could not place that" are the same bubble to the reader,
   *  but only the second one can be an answer to a question Ira itself asked. */
  | { kind: 'unplaced'; text: string };

export interface IntentCtx {
  control: Control;
  s: Situation;
  role: Role;
  /** Exactly what the buttons offer right now — the one guard. */
  actions: ChatAction[];
  /** The live prompt, so "what now?" is answered with the same words. */
  promptText: string;
}

const has = (t: string, ...words: string[]) => words.some(w => t.includes(w));

/**
 * A sentence that is nothing but a verdict — "pass", "pass it", "mark it fail",
 * "pass kar do".
 *
 * It is for the one place where the live question IS pass-or-fail and the
 * reader answers it in words instead of pressing one of the two buttons: the
 * IPE dimension whose finding is already on the paper. Everything that is only
 * politeness comes out, including the Hinglish imperative tail "kar do", which
 * is exactly what "it" is doing in "pass it". What has to be left is the one
 * word, so "does it pass?" stays a question and is not answered as an order.
 */
export function readVerdict(raw: string): TestResult | null {
  const bare = raw.toLowerCase()
    .replace(/[.!,]/g, ' ')
    .replace(/\b(mark|it|this|that|one|the|check|as|please|now|kar\s*do|karo|kar\s*dijiye)\b/g, ' ')
    .trim();
  if (/^pass(ed|es)?$/.test(bare)) return 'Pass';
  if (/^fail(ed|s)?$/.test(bare)) return 'Fail';
  return null;
}

/** The code an attribute-level check inherits from its attribute — 5.1 and
 *  the like. Control-level checks have none; they are matched on their words. */
function codeOf(control: Control, p: DesignPoint): string | null {
  if (!p.stepId) return null;
  return control.operating.steps.find(s => s.id === p.stepId)?.code ?? null;
}

function findPoint(control: Control, ref: string): DesignPoint | undefined {
  const needle = ref.trim().toLowerCase();
  if (!needle) return undefined;
  const byCode = control.design.points.find(p => (codeOf(control, p) ?? '').toLowerCase() === needle);
  if (byCode) return byCode;
  return control.design.points.find(p => p.text.toLowerCase().includes(needle));
}

const labelOf = (control: Control, p: DesignPoint): string => {
  const code = codeOf(control, p);
  return code ? `check ${code}` : `“${p.text.replace(/\.$/, '')}”`;
};

/** The attribute itself, by its code or by words from what it says. */
function findStep(control: Control, ref: string): OperatingStep | undefined {
  const needle = ref.trim().toLowerCase();
  if (!needle) return undefined;
  return control.operating.steps.find(s => s.code.toLowerCase() === needle)
    ?? control.operating.steps.find(s => s.description.toLowerCase().includes(needle));
}

const stepLabelOf = (s: OperatingStep): string => `attribute ${s.code}`;

/** Why an action the reader asked for is not on offer. Read off the same
 *  situation the buttons are, so the two can never disagree. */
function refusal(id: ChatActionId, { s, role }: IntentCtx): string {
  if (s.sealed) return 'This engagement is signed off — nothing on this control can move now.';
  const auditorsOwn: ChatActionId[] = ['add-element', 'attach-doc', 'waive-doc', 'upload-source', 'pick-source', 'upload-evidence', 'draw-sample', 'file-sample', 'tick-sample', 'ipe-check', 'ipe-reliable', 'ipe-unreliable', 'ira-run', 'toe-run', 'conclude-effective', 'conclude-ineffective', 'lock-population', 'conclude-op-effective', 'conclude-op-ineffective', 'rootcause-take', 'rootcause-write'];
  if (role !== 'auditor' && auditorsOwn.includes(id)) {
    return `That one is the auditor’s. You are viewing as ${role === 'reviewer' ? 'the reviewer' : 'the risk owner'}, so I can’t do it from here.`;
  }
  if (id === 'approve-design') {
    if (role !== 'reviewer') return 'Only the reviewer approves a design conclusion. Switch hats and I can do it.';
    if (s.ownConclusion) return 'You concluded this design yourself, so somebody else has to approve it — four eyes.';
    if (s.approvedBy) return `${s.approvedBy.by} has already approved it.`;
    return 'There is no concluded design to approve yet.';
  }
  if (id === 'add-element') {
    if (s.designResult !== 'Not tested') return `The design is already concluded ${s.designResult.toLowerCase()} — it has to be reopened before what it is evidenced by can change.`;
    if (s.elementsOnFile > 0) return 'Evidence is already attached on this step, so I leave the element list to the page — Add element at the top of the design step has the whole menu, custom ones included.';
    return 'Every element I can add is already on this control. The page’s Add element menu has a Custom… option for anything else.';
  }
  if (id === 'attach-doc') {
    if (s.missing.length === 0) return 'Every element on this design has its evidence already — there is nothing outstanding to attach to.';
    if (s.designResult !== 'Not tested') return `The design is already concluded ${s.designResult.toLowerCase()}, and what it was tested against does not change after the fact. It has to be reopened first.`;
    return 'I can’t attach it from here just now.';
  }
  if (id === 'waive-doc') {
    if (s.missing.length === 0) return 'Nothing is outstanding on this design, so there is nothing to account for.';
    if (s.designResult !== 'Not tested') return `The design is already concluded ${s.designResult.toLowerCase()}, and what it was tested against does not change after the fact. It has to be reopened first.`;
    return 'I can’t account for it from here just now.';
  }
  if (id === 'rootcause-take' || id === 'rootcause-write') {
    if (!s.exception) return 'There is no exception open on this control that needs a root cause.';
    if (id === 'rootcause-take') return 'There is nothing of mine to take — the root cause on the paper is already in somebody\u2019s own words.';
    return 'I can\u2019t write it from here just now.';
  }
  if (id === 'upload-source' || id === 'pick-source') {
    if (s.step !== 'population') {
      return s.popStarted
        ? 'The population is already extracted — the source files are listed on step ② if one of them needs changing.'
        : 'The source data is step ②’s, and this control is not there yet.';
    }
    if (s.popStarted) return 'This control already has its population. Adding a second file to it is done on the left, because a joined-on table is not the same thing as the one being sampled.';
    if (id === 'pick-source') {
      return s.popFiles.length === 0
        ? 'There is no source data on this audit yet — hand me the file and I will add it.'
        : 'None of this audit’s files can be drawn off until somebody says where they came from.';
    }
    return 'I can’t take a file from here just now.';
  }
  if (id === 'upload-evidence') {
    if (s.step !== 'operating') return 'Evidence goes against the attributes, and this control is not at the testing step yet.';
    if (s.evidenceOwed.length === 0) return 'Every attribute already has the files its test asks for.';
    return 'I can’t take files from here just now.';
  }
  if (id === 'draw-sample' || id === 'tick-sample') {
    if (s.step !== 'sample') return s.popLocked ? 'The draw is not the step this control is on.' : 'The population has to be locked before anything can be drawn off it.';
    return s.sources.every(x => x.drawn) ? 'Every source file already has its draw.' : 'I can’t draw it from here just now.';
  }
  if (id === 'ipe-check' || id === 'ipe-reliable' || id === 'ipe-unreliable') {
    if (!s.ipe) return 'No report is registered against this population yet — register it on the left, and then its four checks are mine to work through with you.';
    if (s.ipe.conclusion !== 'Not tested') return `The report is already concluded ${s.ipe.conclusion.toLowerCase()}. Re-test a check on the left and it opens up again.`;
    if (id === 'ipe-check') return 'Every check on that report is answered already.';
    return `${plural(s.ipe.untested.length, 'check')} still to answer before the report can be called either way.`;
  }
  if (id === 'ira-run') {
    return s.iraBlocked ? `I can’t run it — ${s.iraBlocked}.` : 'There is nothing to assess just now.';
  }
  // The order is elements → evidence → checks → conclusion, so a refusal names
  // the step actually standing in the way rather than saying "not yet".
  const noChecks = 'This control’s RACM lists no design checks, so nothing has been assessed. A conclusion drawn from here would rest on nothing I read — add the checks to the RACM row and I can assess them.';
  if (id === 'conclude-effective') {
    if (s.designResult !== 'Not tested') return `The design is already concluded ${s.designResult.toLowerCase()}. It has to be reopened or returned before it changes.`;
    if (!s.complete) return `Effective is held until every required element is accounted for — ${plural(s.missing.length, 'element')} still outstanding.`;
    if (s.checksTotal === 0) return noChecks;
    if (s.checksUnmarked > 0) return `Effective is held until every check is marked — ${plural(s.checksUnmarked, 'check')} to go.`;
    return 'Not yet — the design is not ready to conclude.';
  }
  if (id === 'conclude-ineffective') {
    if (s.designResult !== 'Not tested') return `The design is already concluded ${s.designResult.toLowerCase()}.`;
    if (s.checksTotal === 0) return noChecks;
    return 'Not yet — the design is not ready to conclude.';
  }
  if (id === 'toe-run') {
    if (s.operatingResult !== 'Not tested') return `Operating effectiveness is already concluded ${s.operatingResult.toLowerCase()}.`;
    if (s.toe.total === 0) return 'This control has no attributes to test against — that comes from the RACM.';
    if (s.toe.tested === s.toe.total) return 'Every attribute already has a result. Nothing left for me to read.';
    return 'No attribute has all the files its test asks for yet, so there is nothing I can read.';
  }
  if (id === 'lock-population') {
    if (s.popLocked) return 'The population is already locked.';
    if (!s.popStarted) return 'There is no population yet — point the extraction at a report and say what to pull, and then it can be locked.';
    return s.popBlock ?? 'Not yet — the population is not ready to lock.';
  }
  if (id === 'conclude-op-effective' || id === 'conclude-op-ineffective') {
    if (s.operatingResult !== 'Not tested') return `Operating effectiveness is already concluded ${s.operatingResult.toLowerCase()}.`;
    if (s.toeStale) return 'A run sits against a draw that has since changed. Re-run it and the conclusion opens up again.';
    if (s.toe.total === 0) return 'This control has no attributes to test against, so there is nothing to conclude on.';
    if (s.toe.tested < s.toe.total) return `${plural(s.toe.total - s.toe.tested, 'attribute')} still to test.`;
    if (id === 'conclude-op-effective' && s.toeHolds) return `Effective is held: ${s.toeHolds}.`;
    return 'Not yet — the testing is not ready to conclude.';
  }
  if (id === 'sign-paper') {
    if (s.preparerSigned) return s.ownPaper ? 'You have already signed this paper.' : `${s.preparerSigned.by} has already signed it.`;
    if (role !== 'auditor') return 'The auditor signs the paper first. You are viewing as somebody else, so I can’t do it from here.';
    return 'Not yet — both tracks have to be concluded before the paper can be signed.';
  }
  if (id === 'countersign') {
    if (role !== 'reviewer') return 'Only the reviewer countersigns. Switch hats and I can do it.';
    if (!s.preparerSigned) return 'Nobody has signed it yet, so there is nothing to countersign.';
    if (s.reviewerSigned) return `${s.reviewerSigned.by} has already countersigned it.`;
    if (s.ownPaper) return 'You prepared this paper, so it needs a different reviewer to countersign — four eyes.';
    if (s.notesPending > 0) return `${plural(s.notesPending, 'review note')} ${s.notesPending === 1 ? 'is' : 'are'} still open, and a paper is not countersigned over an open note.`;
    return 'I can’t countersign it from here just now.';
  }
  return 'I can’t do that from here.';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What Ira can do right now, said as a list — the fallback's whole value. */
function capabilities(ctx: IntentCtx): string {
  const { actions, s, role } = ctx;
  const adds = actions.filter(a => a.id === 'add-element');
  // A cloud of file names is the same problem one step later, so it folds the
  // same way — but only when there IS a cloud; a single file reads better by
  // name than as "one of this audit's files".
  const srcs = actions.filter(a => a.id === 'pick-source');
  const folded = srcs.length > 1;
  const can = actions
    .filter(a => a.id !== 'add-element' && !(folded && a.id === 'pick-source'))
    .map(a => a.does ?? a.label.toLowerCase());
  // Seven "add X" offers would fill the whole list and crowd out the one thing
  // that is actually the next step, so they are named as one capability.
  if (adds.length > 0) can.unshift(`add a design element — ${listOf(adds.map(a => a.label.toLowerCase()), 3)}`);
  if (folded) can.unshift(`draw the population off one of this audit’s files — ${listOf(srcs.map(a => a.arg ?? a.label), 3)}`);
  if (role === 'auditor' && s.step === 'design' && s.checksTotal > 0 && s.designResult === 'Not tested' && !s.locked) {
    can.push('mark one check — try “pass 5.1” or “fail 5.2”');
  }
  can.push('tell you where this control stands');
  return listOf(can, 4);
}

export function readIntent(raw: string, ctx: IntentCtx): Intent {
  const t = raw.trim().toLowerCase();
  const { control, s, actions } = ctx;
  const offered = (id: ChatActionId) => actions.find(a => a.id === id);
  const take = (id: ChatActionId): Intent => {
    const a = offered(id);
    if (a) return { kind: 'action', action: a };
    // Not offered is not the same as not allowed: the rail leads with one thing
    // at a time, so the run is not always on the buttons even when the page
    // would do it. Somebody who types the instruction means it, so it runs —
    // but only where the page would run it too. The old version here made an
    // exception for a missing element and warned about the cost; there is no
    // exception to make any more, because the store refuses that one outright.
    if (id === 'ira-run' && !s.iraBlocked && ctx.role === 'auditor' && !s.locked && !s.sealed) {
      return { kind: 'action', action: { id: 'ira-run', label: 'Run the AI validation', said: raw.trim(), does: 'assess the design checks' } };
    }
    return { kind: 'reply', text: refusal(id, ctx) };
  };

  if (!t) return { kind: 'reply', text: 'Say what you want done and I will do it, or press one of the buttons above.' };

  // ── questions first: a question that contains "pass" is still a question ──
  if (has(t, 'what can you', 'what do you do', 'help', 'options')) {
    return { kind: 'reply', text: `On this step I can ${capabilities(ctx)}.` };
  }
  if (has(t, "what's next", 'what next', 'what now', 'where are we', 'where am i', 'status', 'what should i')) {
    return { kind: 'reply', text: ctx.promptText };
  }
  if (t.startsWith('why') || has(t, 'why is', 'why can')) {
    if (s.step === 'design' && s.designResult !== 'Not tested' && !s.todApproved) {
      return { kind: 'reply', text: 'Population, sample and testing all wait on the design being approved — a second pair of eyes on the conclusion before any of the work rests on it.' };
    }
    if (s.step === 'population' && s.yePending) {
      return { kind: 'reply', text: `It is an annual control: it only operates once, at the year end, so there is nothing to test until ${s.yePending.until}.` };
    }
    if (s.step === 'population' && s.popBlock) return { kind: 'reply', text: s.popBlock };
    if (s.step === 'sample' && !s.sampleDrawn) {
      return { kind: 'reply', text: 'Because a sample drawn off an unlocked population proves nothing — the population could change underneath it. Lock it and the draw becomes reproducible: same method, same seed, same items.' };
    }
    if (s.step === 'sample' && s.drawsOwed > 0) {
      return { kind: 'reply', text: `Each source file is drawn from in its own right, and ${plural(s.drawsOwed, 'file')} ${s.drawsOwed === 1 ? 'has' : 'have'} not been. Testing starts once every one of them has its items.` };
    }
    if (s.step === 'operating' && s.toeHolds) return { kind: 'reply', text: `The conclusion is held because ${s.toeHolds}.` };
    if (s.step === 'signoff' && s.notesPending > 0) {
      return { kind: 'reply', text: `${plural(s.notesPending, 'review note')} ${s.notesPending === 1 ? 'is' : 'are'} still open on this control, and a paper is not countersigned over an open note.` };
    }
    if (s.step === 'signoff' && s.ownPaper) {
      return { kind: 'reply', text: 'Because the person who prepared a paper cannot be the one who countersigns it — that is what the second signature is for.' };
    }
    if (s.step === 'design' && s.missing.length > 0) {
      return { kind: 'reply', text: `Because the design cannot be tested against documents that are not there — ${listOf(s.missing.map(d => (d.kind === 'Custom' ? d.name : d.kind)))} still outstanding.` };
    }
    return { kind: 'reply', text: ctx.promptText };
  }

  // ── mark one check, or one attribute ──────────────────────────────────────
  const mark = /\b(pass|fail)\b/.exec(t);
  if (mark && !has(t, 'all')) {
    const result: TestResult = mark[1] === 'pass' ? 'Pass' : 'Fail';
    // "kar do" is the Hinglish tail for "do it", so it is doing the same job
    // here that "it" is doing in "pass it" — nothing, once the instruction is
    // read. It comes out with the rest of the politeness.
    const ref = t.replace(/\b(pass|fail|mark|the|check|attribute|as|it|please|kar\s*do|karo)\b/g, ' ').trim();

    // On step ② the same words mean one of the report's four dimensions. The
    // reader is looking at the IPE test; nothing else on this step takes a
    // pass or a fail. It cannot be done in one line, though — the page will
    // not take a verdict without a written finding, so this opens the check
    // and Ira asks for the finding first.
    //
    // A dimension that is already mid-test never gets this far: the pane is
    // holding that question, and it answers it itself. That is where a bare
    // "pass kar do" is actually recorded on the control.
    if (s.step === 'population' && s.ipe && s.ipe.conclusion === 'Not tested') {
      const hit = s.ipe.untested.find(k => t.includes(k.dimension.toLowerCase()))
        ?? s.ipe.untested.find(k => k.dimension.toLowerCase().split(/[^a-z]+/).some(w => w.length >= 4 && t.includes(w)));
      if (hit) {
        const a = actions.find(x => x.id === 'ipe-check' && x.arg === hit.id);
        if (a) return { kind: 'action', action: a, note: `${hit.dimension} can’t be marked ${result.toLowerCase()} until what you found is on the paper — that is the page’s rule and I keep it too.` };
      }
      if (s.ipe.untested.length > 0) {
        return { kind: 'reply', text: `Which one? ${listOf(s.ipe.untested.map(k => k.dimension.toLowerCase()), 4)}.` };
      }
      // Every dimension is answered, so a pass on this step can only be about
      // the report itself — and that is a different word, because a report is
      // called reliable rather than passed. Without this the sentence fell
      // through to the design checks and was answered with a list of codes
      // from a step the reader left two steps ago.
      return { kind: 'reply', text: `Every check on ${s.ipe.reportName} is answered — what is left is the report itself. Say “reliable” or “not reliable” and I will call it.` };
    }

    // On step ④ the same words mean the attribute, not the design check that
    // happens to hang off it. Whichever one the reader is looking at is the
    // one they mean.
    if (s.step === 'operating') {
      const step = findStep(control, ref);
      if (!step) {
        const codes = control.operating.steps.map(x => x.code);
        return { kind: 'reply', text: codes.length
          ? `I could not tell which attribute you mean. This control has ${listOf(codes, 5)} — try “${result.toLowerCase()} ${codes[0]}”.`
          : 'This control has no attributes to test against — that comes from the RACM.' };
      }
      if (ctx.role !== 'auditor' || s.locked || s.operatingResult !== 'Not tested') {
        return { kind: 'reply', text: s.operatingResult !== 'Not tested'
          ? `Operating effectiveness is already concluded ${s.operatingResult.toLowerCase()}, so the attributes are settled.`
          : refusal('conclude-op-effective', ctx) };
      }
      if (stepResult(step) === result) {
        return { kind: 'reply', text: `${stepLabelOf(step)} is already marked ${result === 'Pass' ? 'passed' : 'failed'}.` };
      }
      // The store refuses a pass on an attribute whose required files are not
      // all in, so the reason is given rather than the click being swallowed.
      if (result === 'Pass' && !requiredFilesReady(step, control)) {
        const files = step.requiredFiles ?? [];
        const missing = files.filter(f => !f.file).map(f => f.label);
        return { kind: 'reply', text: files.length === 0
          ? `${stepLabelOf(step)} lists no required files, so there is nothing to pass it on. Add what the test asks for on the attribute first.`
          : `${stepLabelOf(step)} can’t be passed until its files are in — ${listOf(missing)} still missing. Failing it does not need them.` };
      }
      return { kind: 'mark-step', stepId: step.id, label: stepLabelOf(step), result };
    }

    const point = findPoint(control, ref);
    if (!point) {
      const codes = control.design.points.map(p => codeOf(control, p)).filter(Boolean) as string[];
      return { kind: 'reply', text: codes.length
        ? `I could not tell which check you mean. This control has ${listOf(codes, 5)} — try “${result.toLowerCase()} ${codes[0]}”.`
        : 'I could not tell which check you mean — name a few words from it and I will find it.' };
    }
    if (ctx.role !== 'auditor' || s.locked || s.designResult !== 'Not tested') {
      return { kind: 'reply', text: refusal('conclude-effective', ctx) };
    }
    // Already that answer: say so rather than writing the same value again.
    // A no-op write also left the situation unchanged, which stranded the
    // acknowledgement that was standing down for it — so this is a correctness
    // fix as much as a courtesy.
    if (pointResult(point) === result) {
      return { kind: 'reply', text: `${labelOf(control, point)} is already marked ${result === 'Pass' ? 'passed' : 'failed'}.` };
    }
    return { kind: 'mark', pointId: point.id, label: labelOf(control, point), result };
  }
  if (mark && has(t, 'all')) {
    return { kind: 'reply', text: 'I don’t mark every check in one go — that button came off the page on purpose, because a design check is a judgement each time. I can read the evidence and assess them, or you can mark them one by one.' };
  }

  // ── the real actions ──────────────────────────────────────────────────────
  // Order matters more than it looks: "sign off the design" is a conclusion,
  // not a signature, so the conclusions are read before the paper is.
  if (has(t, 'lock the population', 'lock population', 'lock the pop')) return take('lock-population');
  if (has(t, 'draw the sample', 'draw sample', 'draw it', 'pull the sample')) {
    const a = actions.find(x => x.id === 'draw-sample');
    return a ? { kind: 'action', action: a } : { kind: 'reply', text: refusal('draw-sample', ctx) };
  }
  // What an upload MEANS depends on the step: on ① it is the evidence behind a
  // design element, on ② the source data the population comes out of, on ④ the
  // evidence behind an attribute. Three steps, three meanings of one word, and
  // the reader types the same sentence for all of them meaning whichever one
  // is in front of them.
  if (has(t, 'upload', 'attach', 'here are the files', 'here is the file', 'take the file', 'evidence for')) {
    const wanted: ChatActionId = s.step === 'population' ? 'upload-source'
      : s.step === 'design' ? 'attach-doc'
      : 'upload-evidence';
    const a = actions.find(x => x.id === wanted && !x.arg);
    return a ? { kind: 'action', action: a } : { kind: 'reply', text: refusal(wanted, ctx) };
  }
  // The extraction itself, by name or by the file it should run against.
  if (has(t, 'extract', 'pull the population', 'filter it down', 'source file', 'source data')) {
    const picks = actions.filter(x => x.id === 'pick-source');
    const named = picks.find(x => x.arg && t.includes(x.arg.toLowerCase()));
    const a = named ?? (picks.length === 1 ? picks[0] : undefined);
    if (a) return { kind: 'action', action: a };
    if (picks.length > 1) {
      return { kind: 'reply', text: `Which file? ${listOf(picks.map(x => x.arg ?? x.label), 4)}.` };
    }
    return { kind: 'reply', text: refusal('pick-source', ctx) };
  }
  // The report itself, by name or by dimension.
  if (has(t, 'ipe', 'the report', 'reliab')) {
    if (has(t, 'not reliable', 'unreliable')) return take('ipe-unreliable');
    if (has(t, 'reliable')) return take('ipe-reliable');
    const open = s.ipe?.untested ?? [];
    const named = open.find(k => t.includes(k.dimension.toLowerCase()));
    const a = actions.find(x => x.id === 'ipe-check' && (named ? x.arg === named.id : true));
    if (a) return { kind: 'action', action: a };
    return { kind: 'reply', text: refusal('ipe-check', ctx) };
  }
  // The root cause, by name or by the two ways of settling it.
  if (has(t, 'root cause', 'rootcause', 'mechanism')) {
    if (has(t, 'use it', 'use that', 'as written', 'keep it', 'that\u2019s right', 'thats right', 'looks right')) return take('rootcause-take');
    return take('rootcause-write');
  }
  if (has(t, 'countersign')) return take('countersign');
  // ④ asked for by its own name, before the words inside it are read for
  // anything else — "test of effectiveness" contains "effective", and a reader
  // asking to start the testing has not asked for a conclusion. It was not
  // placed at all until now, which is how "start toe" ended up being taken for
  // a sampling ask and drawing a sample nobody wanted (user report, 23 Sep).
  if (/\btoe\b/.test(t) || has(t, 'test of effectiveness', 'start testing', 'step 4', 'step four', '④')) {
    if (s.step === 'operating') return take('toe-run');
    if (s.step === 'sample') {
      return { kind: 'reply', text: s.drawsOwed > 0
        ? `Testing is step ④, and it starts once every source file has its items — ${plural(s.drawsOwed, 'file')} still ${s.drawsOwed === 1 ? 'owes' : 'owe'} a draw.`
        : 'Testing is step ④, and it starts once the sample is drawn off the locked population.' };
    }
    return { kind: 'reply', text: `Testing is step ④, and this control is not there yet. ${ctx.promptText}` };
  }
  // Which validation is meant is decided by where the work is, the same way a
  // conclusion is: on ④ there is only one thing left to run.
  //
  // "run" and "ira" are matched as WORDS, where everything else here is matched
  // as a substring. Both of them live inside things an auditor types for
  // entirely different reasons — payment_runs.xlsx, this very control's name,
  // Irame itself — and a sampling ask that named one of those files used to be
  // answered as a request to validate something.
  if (/\b(run|ira)\b/.test(t) || has(t, 'validate', 'validation', 'assess', 'check the evidence')) {
    return take(s.step === 'operating' ? 'toe-run' : 'ira-run');
  }
  // Which track a conclusion lands on is decided by where the work is, not by
  // the reader having to say "TOE" — on step ④ "conclude it effective" can
  // only mean one thing.
  const onOperating = s.step === 'operating';
  if (has(t, 'ineffective', 'not effective', 'fails design', 'fails')) return take(onOperating ? 'conclude-op-ineffective' : 'conclude-ineffective');
  if (has(t, 'effective', 'conclude', 'sign off the design')) return take(onOperating ? 'conclude-op-effective' : 'conclude-effective');
  if (has(t, 'approve')) return take('approve-design');
  if (has(t, 'sign off', 'sign the paper', 'sign this', 'sign it off')) return take('sign-paper');
  if (has(t, 'send it back', 'send back', 'return it', 'reject')) {
    const a = offered('show-step');
    return a ? { kind: 'action', action: a } : { kind: 'reply', text: 'There is nothing to send back just now.' };
  }
  // ── setting up the design step ────────────────────────────────────────────
  // The commonest answer to "this is missing" is that it was never going to
  // arrive. It is the page's waiver, so it runs the page's flow: which element,
  // then the written reason the working paper prints. Neither half is skipped
  // from here — the form on the left refuses an empty reason and so does Ira.
  if (has(t, 'not applicable', 'n/a', 'does not apply', 'doesn’t apply', "doesn't apply", 'not apply')) {
    return take('waive-doc');
  }
  // "add a walkthrough", "add the process narrative". Matched against the SAME
  // chips the rail is offering, so typing can never add a kind that is already
  // on the control or touch a design that has been concluded.
  if (/\badd\b/.test(t)) {
    const adds = actions.filter(a => a.id === 'add-element');
    const words = (a: ChatAction) => a.label.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 3);
    const best = adds.reduce<{ a: ChatAction; n: number } | null>((acc, a) => {
      const n = words(a).reduce((k, w) => k + (t.includes(w) ? 1 : 0), 0);
      return n > 0 && (!acc || n > acc.n) ? { a, n } : acc;
    }, null);
    if (best) return { kind: 'action', action: best.a };
    if (adds.length > 0) {
      return { kind: 'reply', text: `I can add ${listOf(adds.map(a => a.label.toLowerCase()), 4)}. Say which one, or press it above.` };
    }
    return { kind: 'reply', text: refusal('add-element', ctx) };
  }
  if (has(t, 'show', 'take me', 'open', 'go to', 'where is', 'scroll')) {
    const a = offered('show-step');
    return a ? { kind: 'action', action: a } : { kind: 'reply', text: ctx.promptText };
  }

  return { kind: 'unplaced', text: `I couldn’t place that. On this step I can ${capabilities(ctx)}.` };
}
