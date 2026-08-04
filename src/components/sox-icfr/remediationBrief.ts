import { controlCode, formatDueDate, formatINR, gradeException, parseLooseDate } from './helpers';
import { isOwnerOf, ownersOf } from './auditScope';
import { SEVERITY_URGENCY } from './types';
import type { Control, Deficiency, DesignDoc, EvidenceFile, ExceptionStatus, HandoffTask, IcfrEngagement } from './types';

// ─── The remediation brief — the risk owner's own copy ───────────────────────────
//
// The working paper is the AUDIT's evidence file. It carries the sample, the
// attribute grid, the auditor's conclusion, the reviewer's notes and the sign-off,
// and the first line must never receive it: hand a risk owner the paper that
// concludes on them and the file stops being independent evidence and becomes a
// negotiation. So the owner does not get a filtered working paper — they get this,
// a separate artefact built from scratch out of owner-safe fields only.
//
// The rule that decides every line below: the owner is entitled to their own
// contributions, their own exception, and their own outstanding items. Under
// 404(a) the assessment is MANAGEMENT'S own, and the process owner is management —
// so they are also entitled to the grade, to the exposure it was graded on, and to
// the likelihood, because those are what an owner argues budget with and ranks
// their open items by. What they are NOT entitled to is the RULER: no materiality,
// no performance materiality, no clearly-trivial floor, no severity band, no
// magnitude-against-threshold arithmetic. Someone who can read the ruler sizes the
// fix to clear the bar rather than to fix the cause.
//
// Disagreement has a documented route instead — see SeverityChallenge. The brief
// carries the challenge and its answer, because "I disputed this and here is what
// they said" is precisely the record that an informal conversation never leaves.
//
// Deliberately never read anywhere in this file:
//   eng.materiality · eng.performanceMateriality · eng.rules · eng.reviewNotes
//   eng.signoff · c.wpSignoff · c.operating.sampling · s.sampleResults
//   WHICH MW indicator fired (the escalation shows; the condition does not —
//     they name things like senior-management fraud, often about individuals
//     and often unconfirmed)
//   gradeException(...).working / .aggregate / .cap — the working states the
//     thresholds, and the aggregate holds other people's findings
//   design.conclusion · operating.conclusion · design.points · retest sample grids
//
// If you extend this file, extend it by adding an owner-safe FIELD, never by
// widening a read to "the rest of the object".

/** The same block model the working paper uses — heading / kv / table / note — so
 *  the existing preview and .xlsx renderers can consume a brief unchanged. The
 *  paper's `tickFrom` is the one thing left out: P/r tick-marks are the auditor's
 *  own annotation of a test, and there is no test result on a brief to tick. */
export type BriefBlock =
  | { kind: 'heading'; text: string; sub: string }
  | { kind: 'kv'; title?: string; rows: [string, string][] }
  | { kind: 'table'; title: string; note?: string; headers: string[]; rows: string[][] }
  | { kind: 'note'; label: string; text: string; tone: 'good' | 'bad' | 'neutral' };

/** Where the exception has got to, written for the person who has to act on it.
 *
 *  Deliberately says "with the audit team" rather than naming the preparer and the
 *  reviewer separately: which of the two holds it, and what a reviewer is doing
 *  with it, is the audit's internal division of labour. What the owner needs from
 *  this line is only whether the next move is theirs. */
const STAGE: Record<ExceptionStatus, string> = {
  'Identified': 'With the audit team — they are working out how serious it is. Nothing is needed from you yet.',
  'Rating review': 'With the audit team — the classification is being confirmed before any fix is asked for.',
  'Planning': 'WITH YOU — write the plan: what will change, who does it, and by when.',
  'Plan review': 'With the audit team — they are reading your plan against the root cause.',
  'Remediation': 'WITH YOU — make the change, then attach the proof and submit it.',
  'Retest': 'With the audit team — they are testing the fixed control again.',
  'Awaiting reviewer': 'With the audit team — your evidence is being read.',
  'Closed': 'Closed. Nothing further is needed from you on this one.',
};

/** What the label means for how fast the owner has to move.
 *
 *  This is the whole of what the brief says about severity. It gives the urgency
 *  the label carries — who hears about it, and whether it has to be fixed and
 *  proven before the books close — and never the numbers behind it. "Reported
 *  outside the company" is a consequence the owner can act on; "₹4.2 Cr is at or
 *  above materiality" is a threshold they could aim just under next time. */
const URGENCY = SEVERITY_URGENCY;

/** How long is left, in the words someone chasing a date actually uses. Reads only
 *  the owner's own committed date — never the audit's retest-scheduling maths, which
 *  is the audit team's problem and not a promise the owner made. */
function dueUrgency(date: string | null | undefined): string {
  const d = parseLooseDate(date);
  if (!d) return 'No date agreed yet — this is the first thing the plan needs.';
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${formatDueDate(date)} — ${-days} day${days === -1 ? '' : 's'} OVERDUE.`;
  if (days === 0) return `${formatDueDate(date)} — due today.`;
  if (days <= 14) return `${formatDueDate(date)} — ${days} day${days === 1 ? '' : 's'} left.`;
  return `${formatDueDate(date)}.`;
}

const fileLine = (f: EvidenceFile): string => `${f.name} (${f.kind})`;
const fileList = (files: EvidenceFile[] | undefined): string => files?.map(fileLine).join(' · ') || '—';
const controlLine = (c: Control): string => `${controlCode(c)} — ${c.description}`;

/** How this person is named on the control. A brief that says "your control" to
 *  someone who is the process owner rather than the accountable owner is telling
 *  them the wrong thing about what is being asked of them. */
function capacity(c: Control, owner: string): string {
  const o = ownersOf(c);
  if (o.single) return 'Control owner';
  if (o.controlOwner === owner && o.processOwner === owner) return 'Control owner and process owner';
  return o.controlOwner === owner ? 'Control owner — accountable that it operates' : 'Process owner — you run it day to day';
}

/** Every control this person is named on, in either capacity. EVERYTHING in the
 *  brief is filtered through this: a brief that mentions a control the reader does
 *  not own has leaked one team's audit to another. */
function myControls(eng: IcfrEngagement, owner: string): Control[] {
  return eng.controls.filter(c => isOwnerOf(c, owner));
}

/** The open exceptions a brief would cover — exported so a caller can decide
 *  whether there is anything worth sending before it offers the button. Closed
 *  exceptions are left out: the owner has nothing left to do on them. */
export function openExceptionsFor(eng: IcfrEngagement, owner: string): Deficiency[] {
  const mine = new Set(myControls(eng, owner).map(c => c.id));
  return eng.deficiencies.filter(d => mine.has(d.controlId) && d.status !== 'Closed');
}

/** The design elements still being asked for on a control — the owner's side of
 *  the request. A waived element is not outstanding: the audit team accounted for
 *  it themselves, so chasing the owner for it would be chasing a closed item. */
const outstandingDocs = (c: Control): DesignDoc[] =>
  c.design.documents.filter(d => d.status !== 'Received' && !d.waiver);

/** The open handoffs sitting with this person. `isOwnerTask` in helpers.ts matches
 *  on `c.owner` alone, which drops every task riding a control this person runs as
 *  PROCESS owner — and the process owner is exactly who a document request reaches.
 *  So the match here goes through `isOwnerOf` instead. */
function myOpenTasks(eng: IcfrEngagement, owner: string, controls: Control[]): HandoffTask[] {
  const ids = new Set(controls.map(c => c.id));
  return eng.tasks.filter(t =>
    t.status === 'open'
    && ids.has(t.controlId)
    && (t.assignee === owner || !!eng.controls.find(c => c.id === t.controlId && isOwnerOf(c, owner))));
}

/**
 * The brief, in reading order.
 *
 * `defId` narrows it to one exception and its control. Omitted, it covers every
 * open exception on every control this person is named on, plus their side of the
 * paperwork across those controls.
 *
 * A `defId` that does not resolve to one of this person's controls returns the
 * empty brief rather than the exception — the miss is silent on purpose, because
 * a "you are not entitled to see this" message still confirms the exception exists.
 */
export function buildRemediationBrief(eng: IcfrEngagement, owner: string, defId?: string): BriefBlock[] {
  const mine = myControls(eng, owner);
  const byId = new Map(mine.map(c => [c.id, c]));

  const exceptions = (defId
    ? eng.deficiencies.filter(d => d.id === defId)
    : eng.deficiencies.filter(d => d.status !== 'Closed')
  ).filter(d => byId.has(d.controlId));

  // With one exception named, the paperwork sections narrow to its control — the
  // reader asked about one thing. Across the whole lane they widen to everything
  // this person is on, because that is the honest answer to "what do you have
  // outstanding with the audit".
  const scope: Control[] = defId
    ? mine.filter(c => exceptions.some(d => d.controlId === c.id))
    : mine;

  const blocks: BriefBlock[] = [];

  blocks.push({
    kind: 'heading',
    text: exceptions.length === 1 ? `Remediation brief — ${exceptions[0].id}` : 'Remediation brief',
    sub: `${owner} · ${eng.entity} · ${eng.name} (${eng.code})`,
  });

  // Says what the document is AND what it is not. An owner who has heard "working
  // paper" all cycle will otherwise assume this is an extract of one and read a
  // silence as something being withheld from them.
  blocks.push({
    kind: 'note', label: 'What this is', tone: 'neutral',
    text: 'Your own copy of what the audit has raised on the controls you are named on: what was found, what you have given us, and what is still outstanding from you. '
      + 'It is not the audit working paper. The testing, the sampling and the audit team\'s conclusions stay in the audit file, which is why nothing of that kind appears below.',
  });

  if (!exceptions.length && !scope.length) {
    blocks.push({
      kind: 'note', label: 'Nothing outstanding', tone: 'good',
      text: 'There is nothing open against you on this engagement.',
    });
    return blocks;
  }

  // ── One section per exception ────────────────────────────────────────────────
  exceptions.forEach(d => {
    const c = byId.get(d.controlId)!;
    // The grade and the two inputs the owner is entitled to argue with. What
    // `gradeException` also returns — the seven-rule working, the thresholds each
    // rule tested against, and the aggregation group — is the RULER, and it stops
    // here. So does which MW indicator fired; the escalation shows, the reason
    // does not.
    const grade = gradeException(d, eng).grade;

    const exceptionRows: [string, string][] = [
      ['Control', controlLine(c)],
      ['Process', `${c.process} / ${c.subProcess}`],
      ['Your role on it', capacity(c, owner)],
      ['What was found', d.description],
      // The mechanism, not the count. It sits above the plan because the plan is
      // judged against it — a fix that does not change this is not a fix.
      ['Root cause', d.rootCause],
      ['Classification', grade],
      ['What that means', URGENCY[grade] ?? '—'],
      // Read-only, and here because an owner arguing for budget needs a number to
      // argue with. Stated as what could have slipped through — never as a
      // distance from a threshold, which is the ruler by another name.
      ['Exposure', `${formatINR(d.magnitude)} — what could have slipped through`],
      ['Likelihood', d.likelihood],
    ];
    if (d.compensatingControlId) {
      exceptionRows.push(['Compensating control', `${d.compensatingControlId} — it caps how far the grade can rise, and never clears the exception.`]);
    }
    if (d.mwIndicators.length) {
      exceptionRows.push(['Escalated', 'A reportable condition was recorded against this control, which sets the grade whatever the exposure.']);
    }
    exceptionRows.push(['Where it stands', STAGE[d.status]]);
    exceptionRows.push(['Fix due by', dueUrgency(d.remediation.date)]);
    blocks.push({ kind: 'kv', title: `Exception — ${d.id}`, rows: exceptionRows });

    // ── The argument, if there was one ───────────────────────────────────────
    // Their own challenge and the answer to it. On the brief because "I disagreed
    // and they said no, for this reason" is the record the owner is entitled to
    // keep — that is the whole point of replacing the corridor conversation.
    (d.challenges ?? []).forEach(ch => {
      blocks.push({
        kind: 'note',
        label: `You disputed the ${ch.input}`,
        tone: ch.response?.decision === 'Accepted' ? 'good' : 'neutral',
        text: ch.response
          ? `${ch.reasoning} — ${ch.response.decision} by ${ch.response.by}: ${ch.response.reason}`
          : `${ch.reasoning} — with the audit team; they answer either way, with a reason.`,
      });
    });

    // ── The owner's own plan, read back to them ──────────────────────────────
    const r = d.remediation;
    const planRows: [string, string][] = [
      ['What you committed to', r.action.trim() || 'Not written yet.'],
      ['Who is doing it', r.owner],
      ['By when', formatDueDate(r.date)],
      ['Progress', r.status],
      ['Submitted for review', d.planSubmitted ? `${d.planSubmitted.by}, ${d.planSubmitted.at}` : 'Not yet submitted'],
    ];
    // The audit team's verdict on the PLAN belongs here, and only this verdict.
    // It is not a conclusion about the control — it is the answer to something the
    // owner submitted, and a rejection they cannot read is a rejection they cannot
    // act on. The reason travels with it for exactly that reason.
    if (d.planReview) {
      planRows.push(['Reviewed by the audit team', d.planReview.decision === 'Accepted'
        ? `Accepted — ${d.planReview.by}, ${d.planReview.at}`
        : `Sent back — ${d.planReview.reason ?? 'no reason recorded'} (${d.planReview.by}, ${d.planReview.at})`]);
    }
    blocks.push({ kind: 'kv', title: 'Your remediation plan', rows: planRows });

    if (r.evidence?.length) {
      blocks.push({
        kind: 'table', title: 'Proof of the fix you attached',
        note: `${r.evidence.length} file${r.evidence.length === 1 ? '' : 's'}`,
        headers: ['', 'File', 'Type', 'Uploaded by', 'When'],
        rows: r.evidence.map((f, i) => [String(i + 1), f.name, f.kind, f.uploadedBy, f.uploadedAt]),
      });
    }

    // ── A retest that came back failed ───────────────────────────────────────
    // Only the FAILED rounds, and only the auditor's written rationale on them —
    // the thing that tells the owner why the fix did not hold and what to change.
    // The round's own sample list and its attribute grid are the retest working
    // paper and stay in the audit file. A PASSED round is deliberately absent too:
    // a pass is the audit team's conclusion, and the owner hears it when the
    // exception closes, not from a brief that would be announcing it early.
    (d.retests ?? []).filter(x => x.result === 'Fail').forEach(x => {
      blocks.push({
        kind: 'note', label: `Retest ${x.n} — did not hold`, tone: 'bad',
        text: `${x.rationale?.trim() || 'The retested control failed again; no written reason was recorded.'} (${x.by}, ${x.at})`,
      });
    });
  });

  // ── What this person has already put in ──────────────────────────────────────
  // Received design elements on the controls they are named on, with the uploader
  // named. Filtered on the CONTROL rather than on `uploadedBy === owner`: the field
  // is optional and is empty on everything seeded before it existed, and a brief
  // that shows an owner an empty "what you have provided" table is telling them
  // they have provided nothing, which is worse than telling them nothing at all.
  const provided = scope.flatMap(c =>
    c.design.documents.filter(doc => doc.status === 'Received').map(doc => ({ c, doc })));
  if (provided.length) {
    blocks.push({
      kind: 'table', title: 'Documents received from you',
      note: `${provided.length} across ${new Set(provided.map(p => p.c.id)).size} control${new Set(provided.map(p => p.c.id)).size === 1 ? '' : 's'}`,
      headers: ['', 'Control', 'What was asked for', 'Files', 'Provided by', 'When'],
      rows: provided.map(({ c, doc }, i) => [
        String(i + 1),
        controlCode(c),
        doc.kind === 'Custom' ? doc.name : doc.kind,
        fileList(doc.files),
        doc.uploadedBy ?? '—',
        doc.at ?? '—',
      ]),
    });
  }

  // Self-attestations — what this person put their name to, and what they attached
  // to back it. The attribute is named so the statement makes sense on its own; the
  // attestation's own Pass/Fail and the audit's result on that attribute are BOTH
  // left out. The first is the owner marking their own homework and reads as a
  // verdict; the second is an attribute-level test outcome and is the audit's.
  const attested = scope.flatMap(c =>
    c.operating.steps
      .filter(s => s.attestation && s.attestation.by === owner)
      .map(s => ({ c, s, a: s.attestation! })));
  if (attested.length) {
    blocks.push({
      kind: 'table', title: 'What you attested to',
      note: `${attested.length} statement${attested.length === 1 ? '' : 's'} signed in your name`,
      headers: ['', 'Control', 'On', 'What you said', 'Evidence you attached', 'When'],
      rows: attested.map(({ c, s, a }, i) => [
        String(i + 1),
        controlCode(c),
        `${s.description} (${s.code})`,
        a.note.trim() || '—',
        fileList(a.evidence),
        a.at,
      ]),
    });
  }

  // ── What is still outstanding from this person ───────────────────────────────
  // Three sources, one list, because the owner does not care which queue an ask
  // came out of: open handoffs addressed to them, design elements still being
  // asked for, and their own committed fix dates.
  type Pending = { what: string; control: string; detail: string; due: string; overdue: boolean };
  const pending: Pending[] = [];

  myOpenTasks(eng, owner, scope).forEach(t => {
    const c = byId.get(t.controlId);
    if (!c) return;   // belt and braces — myOpenTasks is already scoped
    pending.push({
      what: t.type === 'pbc' ? 'Document request' : t.type === 'query' ? 'Question' : 'Remediation',
      control: controlCode(c),
      detail: `${t.title} — ${t.detail}`,
      due: t.dueLabel,
      overdue: t.overdue,
    });
  });

  scope.forEach(c => outstandingDocs(c).forEach(doc => {
    pending.push({
      what: 'Document request',
      control: controlCode(c),
      detail: doc.description?.trim() || (doc.kind === 'Custom' ? doc.name : doc.kind),
      due: doc.status === 'Requested' ? 'Requested' : 'Not provided',
      overdue: false,
    });
  }));

  // Testing the audit team could not start is a document request in substance —
  // there is something the owner has to produce before the work can go on, and it
  // sits in their court like any other ask. Only `needed` is carried across. The
  // auditor's own `reason` is their account of why the test is blocked, which is
  // working-paper narrative about the control, so it stays out.
  scope.forEach(c => {
    if (c.unableToTest && !c.unableToTest.resolvedAt) {
      pending.push({
        what: 'Needed before testing can go on',
        control: controlCode(c),
        detail: c.unableToTest.needed,
        due: `Asked ${c.unableToTest.raisedAt}`,
        overdue: false,
      });
    }
  });

  exceptions.forEach(d => {
    const c = byId.get(d.controlId)!;
    const day = parseLooseDate(d.remediation.date);
    pending.push({
      what: 'Fix due',
      control: controlCode(c),
      detail: d.remediation.action.trim() || `${d.id} — the plan still has to be written`,
      due: formatDueDate(d.remediation.date),
      overdue: !!day && day.getTime() < Date.now(),
    });
  });

  if (pending.length) {
    const late = pending.filter(p => p.overdue).length;
    blocks.push({
      kind: 'table', title: 'Still outstanding from you',
      note: `${pending.length} item${pending.length === 1 ? '' : 's'}${late ? ` · ${late} overdue` : ''}`,
      headers: ['', 'What', 'Control', 'Detail', 'By when'],
      rows: pending.map((p, i) => [String(i + 1), p.what, p.control, p.detail, p.overdue ? `${p.due} — OVERDUE` : p.due]),
    });
  } else {
    blocks.push({
      kind: 'note', label: 'Still outstanding from you', tone: 'good',
      text: 'Nothing is waiting on you right now.',
    });
  }

  // Closes on the one thing the brief exists to make happen. Names the preparer
  // because a person can be replied to and "the audit team" cannot — the same
  // reason `exceptionCourtDetail` names a person rather than a role.
  blocks.push({
    kind: 'note', label: 'If something here is wrong', tone: 'neutral',
    text: `Reply to ${eng.preparer} rather than editing this document — dates, plans and evidence are recorded against the exception itself, and a change made here would not reach it.`,
  });

  return blocks;
}
