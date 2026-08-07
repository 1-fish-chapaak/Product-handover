import { isInquiryOnly, ipeReliable, GRADE_RANK } from './types';
import type {
  AuditorProofKind, Conclusion, Control, Court, Deficiency, DesignDoc, DesignTrack, ExceptionGrade, HandoffTask, IcfrEngagement,
  FileOrigin, Likelihood, MaterialityRules, OperatingTrack, Population, PopulationBasis, ReviewNote, RiskRating, Role, Severity, TrackConclusion,
} from './types';

// ─── Severity (handbook §9.5) ────────────────────────────────────────────────────

export function isReasonablyPossible(l: Likelihood): boolean { return l !== 'Remote'; }
export function computeSeverity(likelihood: Likelihood, magnitude: number, materiality: number, mwIndicators: string[], band = 0.2): Severity {
  if (mwIndicators.length > 0) return 'Material Weakness';
  if (!isReasonablyPossible(likelihood)) return 'Deficiency';
  if (magnitude >= materiality) return 'Material Weakness';
  if (magnitude >= materiality * band) return 'Significant Deficiency';
  return 'Deficiency';
}
export function isClearlyTrivial(magnitude: number, rules: MaterialityRules): boolean {
  return magnitude <= rules.clearlyTrivial;
}
export function severityOf(d: Deficiency, materiality: number, rules?: MaterialityRules): Severity {
  return computeSeverity(d.likelihood, d.magnitude, materiality, d.mwIndicators, rules ? rules.sdBandPct / 100 : 0.2);
}

// ─── Assessed severity — the raw grade plus the compensating-control cap ─────────
// The cap only rescues the magnitude-driven MW line (MW → SD). It applies only
// when the chosen compensating control is itself concluded effective in this
// engagement, never when an MW indicator is present, and it never clears the
// exception — capBlocked says why a chosen control had no effect.
export const SEVERITY_RANK: Record<Severity, number> = { Deficiency: 0, 'Significant Deficiency': 1, 'Material Weakness': 2 };
export interface SeverityAssessment {
  raw: Severity;
  final: Severity;
  capped: boolean;
  capBlocked?: 'not-effective' | 'mw-indicator';
  bumped?: boolean;   // prudent-official judgment raised the grade above the math
}
// The three-value view of the grade, for the report, the archive and the
// roll-ups — all of which name only the three reportable severities. It is a
// projection of `gradeException` below, never a second calculation: one engine,
// so the card, the working paper and the engagement conclusion cannot disagree.
export function assessSeverity(d: Deficiency, eng: IcfrEngagement): SeverityAssessment {
  const g = gradeException(d, eng);
  const asSeverity = (x: ExceptionGrade): Severity => (x === 'Clearly Trivial' ? 'Deficiency' : x);
  return {
    raw: asSeverity(g.ladderGrade),
    final: asSeverity(g.grade),
    capped: !!g.cap,
    capBlocked: g.capBlocked === 'none-chosen' ? undefined : g.capBlocked,
    bumped: !!g.bumped,
  };
}

// ─── The severity engine — the seven rules, in order ─────────────────────────────
// Every conclusion on an exception is this function's output. Nothing hand-sets a
// severity, which is why "Show working" can list the rules that fired: the trail
// below IS the calculation, not a description written alongside it.
//
//   1  any MW indicator in force        → Material Weakness, exposure ignored
//   2  compensating control             → may CAP the grade, never clears it
//   3  exposure ≤ clearly trivial       → Clearly Trivial, and STOP
//   4  likelihood remote                → capped at Deficiency whatever the exposure
//   5  the ladder                       → < SD band · ≥ SD band · ≥ materiality
//   6  aggregation                      → the group's summed exposure, re-laddered
//   7  prudent official                 → raises only, and only with a rationale

export interface GradeStep {
  /** The rule number above, so the working reads in the order the rules run. */
  n: number;
  rule: string;
  /** Did this rule change anything? Rules that were reached and did nothing are
   *  still listed — "the cap did not apply, and here is why" is the answer to the
   *  commonest question anyone asks of a severity. */
  fired: boolean;
  detail: string;
}

export interface ExceptionGradeResult {
  grade: ExceptionGrade;
  /** Where rule 5's ladder landed, before cap, aggregation or judgment. */
  ladderGrade: ExceptionGrade;
  working: GradeStep[];
  cap?: { from: ExceptionGrade; to: ExceptionGrade; by: string };
  capBlocked?: 'not-effective' | 'mw-indicator' | 'none-chosen';
  aggregate?: { members: number; sum: number; grade: ExceptionGrade; raised: boolean; sharedBy: string };
  bumped?: { from: ExceptionGrade; to: ExceptionGrade; rationale: string };
}

const RUPEE = (n: number): string =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${n.toLocaleString('en-IN')}`;

/** Rule 5 on its own — the pure ladder, no cap, no judgment, no aggregation. */
function ladder(magnitude: number, materiality: number, bandPct: number): ExceptionGrade {
  if (magnitude >= materiality) return 'Material Weakness';
  if (magnitude >= materiality * (bandPct / 100)) return 'Significant Deficiency';
  return 'Deficiency';
}

/** What this exception aggregates on. Process comes off the control and assertion
 *  off the attributes that actually failed — both already known, so neither is
 *  asked for. A shared root cause cannot be read off free prose, so it is the one
 *  the auditor states, by linking two exceptions together. */
export function aggregationKeys(d: Deficiency, eng: IcfrEngagement): { kind: 'process' | 'assertion' | 'root cause'; key: string }[] {
  const c = eng.controls.find(x => x.id === d.controlId);
  const keys: { kind: 'process' | 'assertion' | 'root cause'; key: string }[] = [];
  if (c) keys.push({ kind: 'process', key: `process:${c.process}` });
  if (c) {
    const failed = d.track === 'operating'
      ? c.operating.steps.filter(s => (s.override?.result ?? s.result) === 'Fail').map(s => s.assertion)
      : c.assertions;
    Array.from(new Set(failed)).forEach(a => keys.push({ kind: 'assertion', key: `assertion:${a}` }));
  }
  if (d.rootCauseLinkId) keys.push({ kind: 'root cause', key: `root:${d.rootCauseLinkId}` });
  return keys;
}

/** The other live exceptions this one combines with. Clearly-trivial items never
 *  join a group — rule 3 stopped them before aggregation was reached — and closed
 *  ones have been remediated, so they are not part of what is still wrong. */
export function aggregationGroup(d: Deficiency, eng: IcfrEngagement): { members: Deficiency[]; sharedBy: string } {
  const mine = new Set(aggregationKeys(d, eng).map(k => k.key));
  const shared = new Set<string>();
  const members = eng.deficiencies.filter(o => {
    if (o.id === d.id || o.status === 'Closed') return false;
    if (isClearlyTrivial(o.magnitude, eng.rules)) return false;
    const hits = aggregationKeys(o, eng).filter(k => mine.has(k.key));
    hits.forEach(h => shared.add(h.kind));
    return hits.length > 0;
  });
  return { members, sharedBy: Array.from(shared).join(' and ') };
}

export function gradeException(d: Deficiency, eng: IcfrEngagement): ExceptionGradeResult {
  const M = eng.materiality;
  const band = eng.rules.sdBandPct;
  const working: GradeStep[] = [];

  // ── 1 ── an indicator in force settles it on its own.
  if (d.mwIndicators.length > 0) {
    working.push({ n: 1, rule: 'MW indicator', fired: true, detail: `${d.mwIndicators[0]}${d.mwIndicators.length > 1 ? ` (and ${d.mwIndicators.length - 1} more)` : ''} — a material weakness whatever the amount.` });
    working.push({ n: 2, rule: 'Compensating control', fired: false, detail: 'No cap available — an indicator cannot be argued down by another control.' });
    return { grade: 'Material Weakness', ladderGrade: 'Material Weakness', working, capBlocked: d.compensatingControlId ? 'mw-indicator' : undefined };
  }
  working.push({ n: 1, rule: 'MW indicator', fired: false, detail: 'None recorded on this exception.' });

  // ── 2 ── is a cap available, and does it actually stand up?
  let capValid = false;
  let capBlocked: ExceptionGradeResult['capBlocked'];
  if (!d.compensatingControlId) {
    capBlocked = 'none-chosen';
    working.push({ n: 2, rule: 'Compensating control', fired: false, detail: 'None named.' });
  } else {
    const cc = eng.controls.find(c => c.id === d.compensatingControlId);
    if (!cc || controlConclusion(cc) !== 'Effective') {
      capBlocked = 'not-effective';
      working.push({ n: 2, rule: 'Compensating control', fired: false, detail: `${d.compensatingControlId} is not concluded effective in this engagement, so it caps nothing.` });
    } else {
      capValid = true;
      working.push({ n: 2, rule: 'Compensating control', fired: true, detail: `${d.compensatingControlId} is tested effective — it can cap a material weakness down to significant, and never clears the exception.` });
    }
  }

  // ── 3 ── below the de-minimis line nothing further is evaluated.
  if (isClearlyTrivial(d.magnitude, eng.rules)) {
    working.push({ n: 3, rule: 'Clearly trivial', fired: true, detail: `${RUPEE(d.magnitude)} is at or under ${RUPEE(eng.rules.clearlyTrivial)} — logged, not evaluated further.` });
    return { grade: 'Clearly Trivial', ladderGrade: 'Clearly Trivial', working, capBlocked };
  }
  working.push({ n: 3, rule: 'Clearly trivial', fired: false, detail: `${RUPEE(d.magnitude)} is above the ${RUPEE(eng.rules.clearlyTrivial)} floor.` });

  // ── 4 & 5 ── the ladder, with the remote-likelihood ceiling over it.
  let ladderGrade: ExceptionGrade;
  if (!isReasonablyPossible(d.likelihood)) {
    ladderGrade = 'Deficiency';
    working.push({ n: 4, rule: 'Likelihood', fired: true, detail: 'Remote — capped at a deficiency however large the exposure.' });
    working.push({ n: 5, rule: 'Exposure ladder', fired: false, detail: 'Not reached — rule 4 already set the ceiling.' });
  } else {
    working.push({ n: 4, rule: 'Likelihood', fired: false, detail: `${d.likelihood} — the ladder applies.` });
    ladderGrade = ladder(d.magnitude, M, band);
    const line = ladderGrade === 'Material Weakness' ? `at or above materiality ${RUPEE(M)}`
      : ladderGrade === 'Significant Deficiency' ? `at or above the ${band}% band, ${RUPEE(M * band / 100)}`
      : `below the ${band}% band, ${RUPEE(M * band / 100)}`;
    working.push({ n: 5, rule: 'Exposure ladder', fired: true, detail: `${RUPEE(d.magnitude)} is ${line} ⇒ ${ladderGrade}.` });
  }

  let grade = ladderGrade;
  let cap: ExceptionGradeResult['cap'];
  if (capValid && grade === 'Material Weakness') {
    cap = { from: grade, to: 'Significant Deficiency', by: d.compensatingControlId! };
    grade = 'Significant Deficiency';
    working.push({ n: 2, rule: 'Compensating control — applied', fired: true, detail: `Capped from Material Weakness to Significant Deficiency by ${d.compensatingControlId}. The exception stands.` });
  }

  // ── 6 ── individually minor, collectively not.
  let aggregate: ExceptionGradeResult['aggregate'];
  if (eng.rules.aggregate) {
    const { members, sharedBy } = aggregationGroup(d, eng);
    if (members.length > 0) {
      const sum = members.reduce((n, o) => n + o.magnitude, 0) + d.magnitude;
      const anyReasonable = [d, ...members].some(o => isReasonablyPossible(o.likelihood));
      const aggGrade: ExceptionGrade = anyReasonable ? ladder(sum, M, band) : 'Deficiency';
      const raised = GRADE_RANK[aggGrade] > GRADE_RANK[grade];
      aggregate = { members: members.length + 1, sum, grade: aggGrade, raised, sharedBy };
      working.push({
        n: 6, rule: 'Aggregation', fired: raised,
        detail: raised
          ? `Combines with ${members.length} other exception${members.length > 1 ? 's' : ''} sharing ${sharedBy} — ${RUPEE(sum)} together ⇒ ${aggGrade}.`
          : `Combines with ${members.length} other exception${members.length > 1 ? 's' : ''} sharing ${sharedBy} — ${RUPEE(sum)} together, which does not raise it.`,
      });
      if (raised) grade = aggGrade;
    } else {
      working.push({ n: 6, rule: 'Aggregation', fired: false, detail: 'Nothing else shares its process, assertion or root cause.' });
    }
  } else {
    working.push({ n: 6, rule: 'Aggregation', fired: false, detail: 'Switched off in the engagement ground rules.' });
  }

  // ── 7 ── judgment, upward only.
  let bumped: ExceptionGradeResult['bumped'];
  if (d.prudentOverride && GRADE_RANK[d.prudentOverride.to] > GRADE_RANK[grade]) {
    bumped = { from: grade, to: d.prudentOverride.to, rationale: d.prudentOverride.rationale };
    working.push({ n: 7, rule: 'Prudent official', fired: true, detail: `Raised to ${d.prudentOverride.to} by ${d.prudentOverride.by} — ${d.prudentOverride.rationale}` });
    grade = d.prudentOverride.to;
  } else {
    working.push({ n: 7, rule: 'Prudent official', fired: false, detail: d.prudentOverride ? 'Recorded, but it does not sit above the calculated grade.' : 'No judgment applied.' });
  }

  return { grade, ladderGrade, working, cap, capBlocked, aggregate, bumped };
}

/** Significant or worse has to be confirmed by the reviewer before the owner is
 *  sent off to plan a fix — a wrong rating must not drive weeks of remediation. */
export function needsRatingConfirmation(grade: ExceptionGrade): boolean {
  return GRADE_RANK[grade] >= GRADE_RANK['Significant Deficiency'];
}

// ─── Baton — whose court an exception is in ──────────────────────────────────────
// The same question `courtFor` answers for a control, answered for an exception.
// Here it needs no inference: one role owns each state by construction, which is
// what makes the flow's "absent, not disabled" rule enforceable in the first place.
export function courtForException(d: Deficiency): Court {
  switch (d.status) {
    case 'Identified': return 'auditor';        // ② sizing it
    case 'Rating review': return 'reviewer';    // ② confirming the grade
    case 'Planning': return 'risk-owner';       // ③ writing the plan
    case 'Plan review': return 'auditor';       // ③ judging it against the root cause
    case 'Remediation': return 'risk-owner';    // ④ doing the work
    case 'Retest': return 'auditor';            // ⑤ retesting the fix
    case 'Awaiting reviewer': return 'reviewer';// ⑥ reading the evidence and closing
    case 'Closed': return 'none';
  }
}

/** The named person the baton actually sits with, and what they are doing with
 *  it — "the auditor" is a role, and a role cannot be chased for an answer. */
export function exceptionCourtDetail(d: Deficiency, eng: IcfrEngagement): { who: string; doing: string } {
  const court = courtForException(d);
  const who = court === 'auditor' ? eng.preparer : court === 'reviewer' ? eng.reviewer : d.remediation.owner;
  const doing =
    d.status === 'Identified' ? (d.rootCause.trim() ? 'sizing it' : 'writing the root cause')
    : d.status === 'Rating review' ? 'confirming the rating before any fix starts'
    : d.status === 'Planning' ? (d.planReview?.decision === 'Rejected' ? 'rewriting the plan' : 'writing the plan')
    : d.status === 'Plan review' ? 'checking the plan against the root cause'
    : d.status === 'Remediation' ? 'implementing the fix and attaching evidence'
    : d.status === 'Retest' ? 'retesting on a post-fix sample'
    : d.status === 'Awaiting reviewer' ? 'reading the retest evidence and closing'
    : 'closed';
  return { who: court === 'none' ? (d.signoff?.by ?? who) : who, doing };
}

// ─── When the fix can actually be retested ───────────────────────────────────────
// A repaired control has to RUN before it can be sampled again — you cannot retest
// a monthly control the week after it was fixed and call the result evidence. The
// wait comes off the control's own frequency.

export const OPERATING_PERIOD: Record<Frequency, { months: number | null; label: string }> = {
  Daily: { months: 1, label: 'about a month of daily runs' },
  Weekly: { months: 2, label: 'one to two months of weekly runs' },
  Monthly: { months: 4, label: 'three to four monthly closes' },
  Quarterly: { months: 6, label: 'two quarters' },
  Recurring: { months: 1, label: 'about a month — it runs many times a day' },
  Annual: { months: null, label: 'it runs once a year, so it cannot run again before period end' },
  'Ad-hoc': { months: null, label: 'no fixed rhythm to count from' },
};

/** Reads ISO 'YYYY-MM-DD', '31 Mar 2026', 'Mar 2026' and the legacy '30 Jun'. */
export function parseLooseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) { const n = Date.parse(`${t}T00:00:00`); return Number.isNaN(n) ? null : new Date(n); }
  const withYear = /\b\d{4}\b/.test(t) ? t : `${t} ${new Date().getFullYear()}`;
  const n = Date.parse(withYear);
  return Number.isNaN(n) ? null : new Date(n);
}

const shortDate = (d: Date): string => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export interface RetestReadiness {
  /** Null when there is nothing to compute from, or nothing to compute. */
  date: Date | null;
  label: string;
  reason: string;
  beyondPeriodEnd: boolean;
  /** Ad-hoc — no rhythm, so the auditor states the date instead. */
  needsManualDate: boolean;
  /** Annual — it cannot produce another occurrence inside this period at all. */
  neverThisPeriod: boolean;
}

/** A period end written as 'Dec 2026' means the END of December, not the 1st.
 *  Read literally it moves the cliff a month early and puts fixes on the at-risk
 *  list that were always going to land in time. */
function parsePeriodEnd(label: string): Date | null {
  const d = parseLooseDate(label);
  if (!d) return null;
  const hasDay = /\d{4}-\d{2}-\d{2}/.test(label) || /\b\d{1,2}\b\s*[A-Za-z]/.test(label.trim());
  return hasDay ? d : new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

export function retestReadiness(d: Deficiency, c: Control | undefined, periodEnd: string): RetestReadiness {
  const period = OPERATING_PERIOD[c?.frequency ?? 'Monthly'];
  const end = parsePeriodEnd(periodEnd);
  const fixed = parseLooseDate(d.remediation.date);

  // Stated by the auditor — it wins over the arithmetic wherever it exists.
  const stated = parseLooseDate(d.expectedRetestReady);
  if (stated) {
    return {
      date: stated, beyondPeriodEnd: !!end && stated > end, needsManualDate: false, neverThisPeriod: false,
      label: shortDate(stated),
      reason: `Set by the auditor rather than counted off the frequency.${end && stated > end ? ` That lands after period end (${periodEnd}).` : ''}`,
    };
  }

  if (c?.frequency === 'Annual') {
    return {
      date: null, beyondPeriodEnd: true, needsManualDate: false, neverThisPeriod: true,
      label: 'Not retestable this period',
      reason: `It ${period.label}. Whatever is fixed now, there is no second occurrence to sample before ${periodEnd} — this carries forward.`,
    };
  }

  if (c?.frequency === 'Ad-hoc') {
    return {
      date: null, beyondPeriodEnd: false, needsManualDate: true, neverThisPeriod: false,
      label: 'Auditor to set',
      reason: 'The control runs when it runs — there is no frequency to count forward from, so the expected date has to be stated.',
    };
  }

  if (!fixed || period.months === null) {
    return {
      date: null, beyondPeriodEnd: false, needsManualDate: false, neverThisPeriod: false,
      label: 'Once the fix has a date',
      reason: `The wait is ${period.label}, counted from the day the fix lands. The plan has no date yet.`,
    };
  }

  const ready = new Date(fixed);
  ready.setMonth(ready.getMonth() + period.months);
  const beyond = !!end && ready > end;
  return {
    date: ready, beyondPeriodEnd: beyond, needsManualDate: false, neverThisPeriod: false,
    label: shortDate(ready),
    reason: `Fixed ${shortDate(fixed)} plus ${period.label}.${beyond ? ` That lands after period end (${periodEnd}) — there will be no testable sample in time.` : ''}`,
  };
}

/** Every exception whose fix cannot be retested before the books close. The
 *  engagement needs this NOW, while there is still room to move a date — not in
 *  March when the answer is already fixed. */
export function retestAtRisk(eng: IcfrEngagement): { d: Deficiency; readiness: RetestReadiness }[] {
  return eng.deficiencies
    .filter(d => d.status !== 'Closed')
    .map(d => ({ d, readiness: retestReadiness(d, eng.controls.find(c => c.id === d.controlId), eng.periodEnd) }))
    .filter(x => x.readiness.beyondPeriodEnd);
}

// ─── Ground-rules change preview ──────────────────────────────────────────────────
// What would re-grade if the materiality rule set changed? Used by the review
// modal before applying, and by the store to record the actual re-grades.
export interface RulesPatch { materiality?: number; performanceMateriality?: number; clearlyTrivial?: number; sdBandPct?: number }
export function previewRegrades(eng: IcfrEngagement, patch: RulesPatch): { defId: string; from: Severity; to: Severity }[] {
  const next: IcfrEngagement = {
    ...eng,
    materiality: patch.materiality ?? eng.materiality,
    performanceMateriality: patch.performanceMateriality ?? eng.performanceMateriality,
    rules: { ...eng.rules, clearlyTrivial: patch.clearlyTrivial ?? eng.rules.clearlyTrivial, sdBandPct: patch.sdBandPct ?? eng.rules.sdBandPct },
  };
  return eng.deficiencies
    .filter(d => d.status !== 'Closed')
    .map(d => ({ defId: d.id, from: assessSeverity(d, eng).final, to: assessSeverity(d, next).final }))
    .filter(x => x.from !== x.to);
}

// ─── Engagement-level ICFR conclusion ────────────────────────────────────────────
// An open material weakness at period end forces "not effective" — sign-off stays
// possible, but the conclusion recorded is adverse (handbook: open MW ⇒ disclosure).
// Uses the assessed (capped) severity: a validly-capped MW is an SD, not an MW.
export function openMaterialWeaknesses(eng: IcfrEngagement): Deficiency[] {
  return eng.deficiencies.filter(d => d.status !== 'Closed' && assessSeverity(d, eng).final === 'Material Weakness');
}
export function icfrConclusion(eng: IcfrEngagement): 'Effective' | 'Not effective' {
  return openMaterialWeaknesses(eng).length ? 'Not effective' : 'Effective';
}

// ─── ITGC cascade — a failed ITGC invalidates "test of one" downstream ───────────
// Any IT General Controls control concluded ineffective puts every automated /
// IT-dependent control in the other processes on notice: one instance no longer
// proves the rule, and benchmarking is off the table.
export function failedItgcs(eng: IcfrEngagement): Control[] {
  // DELIBERATELY the plain two-track read, never conclusionOf: operatingApplies
  // asks itgcHolds, which asks this. Routing it through the engagement-aware
  // version would close the loop and hang. ITGCs are their own process and never
  // take the short form anyway, so the plain read is also the correct one here.
  return eng.controls.filter(c => c.process === 'IT General Controls' && controlConclusion(c) === 'Ineffective');
}
export function isItgcDependent(c: Control): boolean {
  return c.nature !== 'Manual' && c.process !== 'IT General Controls';
}

/** Does test-of-one still stand for this control? An automated control earns a
 *  sample of one from the fact that the machine does the same thing every time —
 *  which is only true while the ITGCs around it hold. One failed IT General
 *  Controls control anywhere in the engagement withdraws that reliance from every
 *  automated and IT-dependent control in it. */
export function itgcHolds(eng: IcfrEngagement, c: Control): boolean {
  return !isItgcDependent(c) || failedItgcs(eng).length === 0;
}

// ─── Population — what is being sampled, before anything is pulled into it ────────
/** How many times a control at this frequency runs across a year. The population
 *  of an occurrence-based control is this, not its row count: a monthly
 *  reconciliation is twelve occurrences whatever the lines inside it total. */
export function expectedOccurrences(f: Frequency): number {
  switch (f) {
    case 'Annual': return 1;
    case 'Quarterly': return 4;
    case 'Monthly': return 12;
    case 'Weekly': return 52;
    case 'Daily': return 250;          // working days, not calendar days
    default: return 0;                 // Recurring / Ad-hoc — count it, don't derive it
  }
}
/** A control whose work is counted in occurrences rather than rows. Recurring and
 *  ad-hoc controls are transaction-based by nature; everything else has a
 *  countable rhythm the auditor can start from. */
export function defaultBasis(c: Control): PopulationBasis {
  return c.frequency === 'Recurring' || c.frequency === 'Ad-hoc' ? 'Transaction-based' : 'Occurrence-based';
}
/** Locked — the checks resolved and the auditor locked it. Until this is true
 *  nothing downstream may be drawn from it. */
export function populationLocked(c: Control): boolean {
  return !!c.operating.population?.locked;
}

// ─── What the application can work out for itself ────────────────────────────────
/** How seriously the application disagrees with the population.
 *
 *  `warn` and `fail` both hold the lock, but they are not the same finding and
 *  are not written the same way — see `countVerdict` for why an overshoot and a
 *  shortfall are different problems. */
export type VerdictLevel = 'pass' | 'warn' | 'fail';

/** A computed check. Anything other than `pass` is the machine disagreeing with
 *  the population, not a box left unticked — which is why it carries its own
 *  reasoning, and where it can, the evidence for it. */
export interface PopVerdict {
  level: VerdictLevel;
  headline: string;
  detail: string;
  /** Whether the population may be locked without an answer to this. */
  blocks: boolean;
  /** Where the extra rows sit. Only ever present on an overshoot: surplus rows
   *  are in the extract and can be grouped, while missing rows are by
   *  definition not there to count. */
  breakdown?: { label: string; n: number }[];
  /** What usually causes this, so the reader is not left guessing. */
  causes?: string;
}

/** Whole months between two ISO dates, rounded to the nearest month and never
 *  below one. Good enough to scale a yearly run-rate onto an interim window. */
export function windowMonths(from?: string, to?: string): number {
  if (!from || !to) return 12;
  const a = new Date(from), b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 12;
  const m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 1 : 0);
  return Math.max(1, m);
}

/** How many times the control runs across the window — derived from its
 *  frequency, so nobody has to be asked. Null for Recurring and Ad-hoc: those
 *  have no rhythm to scale, and a number the machine cannot reach is a number it
 *  has to ask for rather than invent. */
export function derivedRunCount(c: Control, from?: string, to?: string): number | null {
  const perYear = expectedOccurrences(c.frequency);
  if (perYear === 0) return null;
  return Math.max(1, Math.round((perYear * windowMonths(from, to)) / 12));
}

/** Read a date the way it is written.
 *
 *  `new Date('2026-01-01')` is UTC midnight by specification, so rendering it
 *  through toLocaleDateString anywhere west of UTC prints the day before: an
 *  audit window opening 1 Jan 2026 reads as 31 Dec 2025 in New York. Every date
 *  in this step is a calendar date rather than an instant — the day the period
 *  opens, the day the extract was taken — so each is parsed at LOCAL midnight
 *  and stays the day it says it is, wherever it is read.
 *
 *  Anything that isn't a bare YYYY-MM-DD falls through to the normal parse. */
export function parseDay(iso?: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** '2026-01-31' → '31 Jan 2026'. Left as-is if it isn't a date; `empty` covers
 *  the missing case, so a filter field can render blank where a working-paper
 *  row wants an em dash. */
export function fmtDay(iso?: string, empty = '—'): string {
  if (!iso) return empty;
  const d = parseDay(iso);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : iso;
}

const fmtDate = (iso?: string) => fmtDay(iso);
const dayGap = (a?: string, b?: string) => {
  const x = parseDay(a), y = parseDay(b);
  if (!x || !y) return 0;
  // Both ends are local midnight, so a DST boundary inside the span makes one
  // day 23 or 25 hours long — rounding keeps the answer in whole days.
  return Math.round((y.getTime() - x.getTime()) / 86_400_000);
};

/** An overshoot inside this band is noise on an estimate, not a finding. The
 *  expected figure is a judgement made before the data was seen, and holding it
 *  to the row is false precision. */
const OVER_BAND = 0.05;
/** How far the demo extract is allowed to drift off the expectation. Kept on the
 *  OVER side and inside the band above: a shortfall is a completeness gate now,
 *  so an extract that undershot by chance would open every demo on a block. */
export const EXTRACT_WOBBLE = 0.04;

/** Where the surplus rows sit — broken down along the dimension that was
 *  filtered on.
 *
 *  The question an over-inclusive filter raises is "what did I sweep in", and
 *  the fastest answer is the filtered dimension itself: `type Banking 1,180 ·
 *  type Other 238` says the filter let something through in one line. Falls back
 *  to the account when the filter named one instead, and to nothing at all when
 *  the filter named neither — a breakdown of an unnamed dimension explains
 *  nothing. */
function overBreakdown(pop: Population, excess: number): { label: string; n: number }[] {
  const dim = pop.filterType ? { key: 'type', value: pop.filterType } : pop.filterAccount ? { key: 'account', value: pop.filterAccount } : null;
  if (!dim || excess < 1) return [];
  return [
    { label: `${dim.key} ${dim.value}`, n: Math.max(0, pop.count - excess) },
    { label: `${dim.key} Other`, n: excess },
  ];
}

// ─── The shape of the extract, month by month ────────────────────────────────────
/** One month of the population. */
export interface PopMonth { key: string; label: string; n: number; }

/** How the instances fall across the filter window.
 *
 *  A total says nothing about whether the extract is whole: 1,418 instances over
 *  a year reads fine until you see that November and December hold none of them.
 *  So the count is never shown as a single number — the months are shown with
 *  it, and the reader can see the hole rather than be told there isn't one.
 *
 *  Deterministic from the control id (prototype data): the same population must
 *  not reshape itself between renders, or the working paper disagrees with the
 *  screen that produced it. */
export function monthlyBreakdown(c: Control): PopMonth[] {
  const pop = c.operating.population;
  if (!pop) return [];
  const start = parseDay(pop.filterFrom), end = parseDay(pop.filterTo);
  if (!start || !end) return [];
  const months = windowMonths(pop.filterFrom, pop.filterTo);
  if (months < 2 || months > 24) return [];

  let s = c.id.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  // A tail that stops early — the case a correct-looking filter window hides.
  // One control in four, chosen by its own id so it is always the same ones.
  //
  // Never on a seeded population (`checks` is the marker of one — the retired
  // tick boxes only ever existed on the fixtures). Those were locked before this
  // check existed, and growing a hole under a lock nobody can now answer would
  // read as a defect in the paper rather than a demonstration of the check. Both
  // draws happen either way, so the shape a population is generated with never
  // changes underneath it.
  const tailRoll = next(), tailLen = 1 + Math.floor(next() * 2);
  const deadTail = pop.checks ? 0 : tailRoll < 0.25 ? tailLen : 0;
  const live = Math.max(1, months - deadTail);
  // A spike month, so "highlight the spikes" has something to highlight.
  const spike = next() < 0.5 ? Math.floor(next() * live) : -1;

  const weights = Array.from({ length: months }, (_, i) => {
    if (i >= live) return 0;
    return (i === spike ? 2.4 : 1) * (0.75 + next() * 0.5);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const out: PopMonth[] = [];
  let left = pop.count;
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const label = d.toLocaleDateString('en-GB', { month: 'short' });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // The last live month takes the remainder, so the months always add to the
    // population. A breakdown that doesn't reconcile is worse than none.
    const last = i === live - 1;
    const n = weights[i] === 0 ? 0 : last ? Math.max(0, left) : Math.min(left, Math.round((pop.count * weights[i]) / total));
    out.push({ key, label, n });
    left -= n;
  }
  return out;
}

/** A month holding more than double the typical month. Worth a second look
 *  before the count is agreed with — usually a duplicate load or a second
 *  entity, occasionally the business itself. */
export function spikeMonths(months: PopMonth[]): Set<string> {
  const live = months.filter(m => m.n > 0).map(m => m.n).sort((a, b) => a - b);
  if (live.length < 3) return new Set();
  const median = live[Math.floor(live.length / 2)];
  return new Set(months.filter(m => m.n >= median * 2).map(m => m.key));
}

/** The first and last day the extract actually holds data for, read off the
 *  months. Distinct from the filter window: the filter is what was asked for,
 *  this is what came back. */
export function dataWindow(c: Control): { from: string; to: string } | null {
  const months = monthlyBreakdown(c);
  const live = months.filter(m => m.n > 0);
  if (live.length === 0) return null;
  const [fy, fm] = live[0].key.split('-').map(Number);
  const [ly, lm] = live[live.length - 1].key.split('-').map(Number);
  const end = new Date(ly, lm, 0);   // day 0 of the next month = last day of this one
  return {
    from: `${fy}-${String(fm).padStart(2, '0')}-01`,
    to: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  };
}

/** The same control's population last round, when there was a last round.
 *
 *  Prior counts are the only outside reference a reader has for whether this
 *  round's number is plausible, so where an earlier audit exists its figure is
 *  offered beside this one. Prototype data: derived from the control id rather
 *  than stored, since nothing archives a prior population yet. */
export function priorRoundCount(eng: IcfrEngagement, c: Control, openAuditId?: string | null): { label: string; n: number } | null {
  const pop = c.operating.population;
  if (!pop) return null;
  const open = eng.audits.find(a => a.id === openAuditId);
  const prior = eng.audits
    .filter(a => a.id !== openAuditId && (!open || a.windowFrom < open.windowFrom))
    .sort((a, b) => (a.windowFrom < b.windowFrom ? 1 : -1))[0];
  if (!prior) return null;
  const s = c.id.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 3);
  const drift = ((s % 25) - 8) / 100;              // −8% … +16% on the round before
  return { label: `${prior.period} · ${prior.round === 'yearend' ? 'year-end' : prior.round === 'interim' ? 'interim' : 'roll-forward'}`, n: Math.max(1, Math.round(pop.count * (1 - drift))) };
}

/** Does the count hold up?
 *
 *  Measured against the figure the auditor wrote down BEFORE the extract ran —
 *  the only number in this step nobody could have fitted to the answer.
 *
 *  The two directions are not the same problem and are not treated the same.
 *
 *  OVER — the filter swept too wide. The rows are all there to look at, so it is
 *  diagnosable, and the risk it carries is that the sample picks up an item this
 *  control never touched, which surfaces later as an exception that was never
 *  real. Serious enough to hold the lock until it is resolved; not serious
 *  enough to be called a failure.
 *
 *  UNDER — instances are missing from the population, and an instance that is
 *  not in the population can never be sampled. That is a completeness gap, it
 *  cannot be diagnosed from the extract (the rows aren't there to group), and it
 *  is the thing an external auditor goes looking for. Held to a tighter band and
 *  written as a failure.
 *
 *  Where no expectation was recorded it falls back to the derived run count, and
 *  there only a shortfall counts — most populations are transaction-grained
 *  while a run count never is.
 *
 *  Neither direction is a failure of the auditor's work, and neither is written
 *  as one. A variance is shown; only the ones that could hide missing instances
 *  hold the lock. */
export function countVerdict(c: Control): PopVerdict | null {
  const pop = c.operating.population;
  if (!pop) return null;
  const runs = derivedRunCount(c, pop.filterFrom, pop.filterTo);
  const months = windowMonths(pop.filterFrom, pop.filterTo);
  const span = `${months} month${months === 1 ? '' : 's'}`;
  const runNote = runs != null ? ` The control itself runs ${runs.toLocaleString()} times over ${span}.` : '';

  if (pop.expectedCount != null) {
    const exp = pop.expectedCount;
    const diff = pop.count - exp;
    const off = Math.abs(diff) / Math.max(1, exp);
    const pct = Math.round(off * 100);
    const headline = `${pop.count.toLocaleString()} extracted against ${exp.toLocaleString()} expected`;

    if (diff === 0) return { level: 'pass', blocks: false, headline, detail: `Exactly the figure recorded before the extract ran.${runNote}` };

    if (diff > 0) {
      if (off <= OVER_BAND) {
        return { level: 'pass', blocks: false, headline, detail: `${diff.toLocaleString()} over, ${pct}% — inside the 5% band. Variance on an estimate, not a finding.${runNote}` };
      }
      return {
        level: 'warn', blocks: true, headline,
        detail: `${diff.toLocaleString()} more than expected, ${pct}% over. Extra rows are not a hole in the test — the risk is sampling an item this control never touched, which turns up later as an exception that was never real. Refilter, or accept it with a reason.`,
        breakdown: overBreakdown(pop, diff),
        causes: 'Commonly duplicates, reversals, a transaction type outside the scope, one month too many in the window, or a second entity sitting in the same file.',
      };
    }

    // Short. A shortfall is the harder case whatever its size: the rows that
    // aren't there cannot be diagnosed, cannot be sampled, and cannot be seen
    // by anyone reading the population afterwards. So every shortfall carries a
    // recorded reason, and a small one is not waved through on percentage.
    return {
      level: 'fail', blocks: true, headline,
      detail: `${Math.abs(diff).toLocaleString()} fewer than expected, ${pct}% short. An instance that is not in the population can never be sampled, so this is a completeness gap rather than a filter that swept too wide — which is why every shortfall needs an answer, however small.`,
      causes: 'Commonly a month missing from the window, a transaction type the filter excluded, or an extract taken before the period closed.',
    };
  }

  if (runs == null) {
    // Recurring / Ad-hoc, and nothing was recorded up front.
    return { level: 'fail', blocks: true, headline: 'How many should there have been?', detail: `A ${c.frequency.toLowerCase()} control has no fixed rhythm, so the number cannot be worked out from the frequency. It has to come from you.` };
  }
  if (pop.count < runs) {
    return { level: 'fail', blocks: true, headline: `${pop.count.toLocaleString()} instances for ${runs.toLocaleString()} runs`, detail: `A ${c.frequency.toLowerCase()} control runs ${runs.toLocaleString()} times over ${span}, but the filter returned fewer instances than that — some runs are not in here.` };
  }
  const per = Math.round(pop.count / runs);
  return {
    level: 'pass', blocks: false,
    headline: `${pop.count.toLocaleString()} instances across ${runs.toLocaleString()} runs`,
    detail: `A ${c.frequency.toLowerCase()} control runs ${runs.toLocaleString()} times over ${span}${per > 1 ? ` — around ${per.toLocaleString()} instances a run` : ''}.`,
  };
}

/** Three windows have to line up, not two: the period the audit tests, the range
 *  the filter asked for, and the dates the extract actually came back with.
 *
 *  Checking the filter alone passes the case that matters most — a filter set to
 *  the whole year against a file whose data stops in October reads as full
 *  coverage while two months of the period were never in the population at all.
 *  So the filter is measured against the period, and then the data is measured
 *  against the filter. */
export function coverageVerdict(c: Control, windowFrom?: string, windowTo?: string): PopVerdict | null {
  const pop = c.operating.population;
  if (!pop) return null;
  if (!pop.filterFrom || !pop.filterTo || !windowFrom || !windowTo) {
    return { level: 'fail', blocks: true, headline: 'Window not recorded', detail: 'The filter was saved without dates, so the coverage cannot be measured. Refilter with a date range.' };
  }
  const late = dayGap(windowFrom, pop.filterFrom);
  const early = dayGap(pop.filterTo, windowTo);
  const gaps = [
    late > 0 && `opens ${late} day${late === 1 ? '' : 's'} after the period starts`,
    early > 0 && `closes ${early} day${early === 1 ? '' : 's'} before it ends`,
  ].filter(Boolean) as string[];

  if (gaps.length > 0) {
    // A short window is the same completeness problem as a short count: the
    // untested stretch can never be sampled out of.
    return { level: 'fail', blocks: true, headline: `${fmtDate(pop.filterFrom)} – ${fmtDate(pop.filterTo)}`, detail: `The audit period runs ${fmtDate(windowFrom)} – ${fmtDate(windowTo)}. This filter ${gaps.join(' and ')} — that stretch goes untested.`, causes: 'Commonly a window copied from the prior round, or an extract taken before the period closed.' };
  }

  // The filter is right. Is the data? A whole month with no instances at either
  // end of a correct window is a hole the filter cannot show you.
  const data = dataWindow(c);
  if (data) {
    const openLate = dayGap(pop.filterFrom, data.from);
    const stopEarly = dayGap(data.to, pop.filterTo);
    const holes = [
      openLate >= 28 && `starts ${fmtDate(data.from)}, ${openLate} days into it`,
      stopEarly >= 28 && `stops ${fmtDate(data.to)}, ${stopEarly} days before it closes`,
    ].filter(Boolean) as string[];
    if (holes.length > 0) {
      return {
        level: 'fail', blocks: true,
        headline: `Filter ${fmtDate(pop.filterFrom)} – ${fmtDate(pop.filterTo)}, data ${fmtDate(data.from)} – ${fmtDate(data.to)}`,
        detail: `The filter window is right, but the extract ${holes.join(' and ')} — that stretch has no instances in it, so nothing in it can ever be sampled.`,
        causes: 'Commonly an extract taken before the period closed, a feed that stopped, or a system cut over mid-period with the rest of the data in the old one.',
      };
    }
  }
  return { level: 'pass', blocks: false, headline: `${fmtDate(pop.filterFrom)} – ${fmtDate(pop.filterTo)}`, detail: `Covers the whole audit period, ${fmtDate(windowFrom)} – ${fmtDate(windowTo)}${data ? `, and the extract holds instances from ${fmtDate(data.from)} to ${fmtDate(data.to)}` : ''}.` };
}

/** Everything that has to be settled before the population can be locked: the
 *  computed checks holding, the count agreed with, and the origin answered.
 *
 *  Not every disagreement blocks. A small overshoot is shown and passed over;
 *  only the ones that could hide missing instances hold the lock, and either
 *  answer will do — a refilter that removes the disagreement, or a reason
 *  recorded against it, because sometimes the filter is wrong and sometimes the
 *  expectation is.
 *
 *  The count is different: it never blocks on arithmetic, but it is never locked
 *  without a human agreeing the shape looks right either. */
export function populationReady(c: Control, windowFrom?: string, windowTo?: string): boolean {
  const pop = c.operating.population;
  if (!pop) return false;
  // The COUNT verdict no longer gates the lock (Aug 2026). Its row was parked,
  // and that row was the only place a countNote could be written — so leaving
  // the gate would deadlock every population whose extract missed its estimate,
  // with no field anywhere to release it. countVerdict still runs for the
  // working paper, which prints the comparison either way.
  //
  // Period coverage still gates, because its row is still on the screen: a
  // period the extract does not cover is a hole in the population, and there is
  // somewhere to say why it stands.
  // Period coverage no longer gates the lock from here either (Aug 2026). Its
  // row was parked and that row was the only place a coverageNote could be
  // written — so the gate would have deadlocked every population whose extract
  // stops short, with no field anywhere to release it.
  //
  // Nothing is waved through: period coverage is now the fourth check inside the
  // IPE test below, and the report has to conclude Reliable before anything
  // locks. The gate did not disappear, it moved to where the auditor answers it.
  // The report the population came out of is itself under test, and it has to
  // pass before anything is built on it. A population drawn from an unproven
  // report is not a slightly weaker population — it is the wrong one, so it
  // never locks, and the sample, the TOE and the sign-off sitting behind that
  // lock never open either. One fix upstream releases all four.
  if (!ipeReliable(c.operating)) return false;
  // Provenance is deliberately NOT a condition here. It belongs to the source
  // file, was answered when that file entered the audit, and a file with no
  // answer cannot be picked as a source in the first place — so by the time
  // there is a population to lock, the question is already settled.
  // Nor the count agreement, since Aug 2026: "Does the count read right?" was
  // parked and it was the only thing that set countConfirmed. A gate on a flag
  // nothing can raise is not a standard, it is a locked door with no key.
  //
  // What the lock waits on is the report itself, above — four checks, each one
  // a procedure a person performs and signs. That is a higher bar than the
  // three computed rows this function used to stack in front of it.
  return true;
}

// ─── The file registry — provenance, once per file ───────────────────────────────
/** What a file's provenance defaults to before anybody has said anything.
 *
 *  Only for files the engagement DERIVES: a trial balance or general ledger
 *  reaches an audit as an ERP extract, and a RACM or SOP reaches it as a client
 *  document. Both are stated on the file record and both are correctable there.
 *  A file uploaded through the app never lands here — it is answered at upload,
 *  which is the whole point of the rule. */
export function defaultFileOrigin(kind: string): FileOrigin | undefined {
  if (kind === 'Trial balance' || kind === 'General ledger') return 'System export';
  if (kind === 'RACM / SOP') return 'Client-prepared';
  return undefined;
}

/** Which controls drew a population off this file. Derived rather than stored:
 *  a list kept in two places is a list that disagrees with itself, and the
 *  populations already name their source. */
export function controlsUsingFile(eng: IcfrEngagement, name: string): Control[] {
  return eng.controls.filter(c => c.operating.population?.sourceFile === name);
}

/** A file's kind read back off its name, for files nobody registered. */
export function guessFileKind(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('tb') || n.includes('trial')) return 'Trial balance';
  if (n.includes('gl') || n.includes('ledger')) return 'General ledger';
  if (n.includes('racm') || n.includes('sop')) return 'RACM / SOP';
  return 'Source file';
}

/** Where a file came from, resolved the ONE way, wherever the question is asked
 *  — the source line on a control, the registry on Configuration, the working
 *  paper.
 *
 *  Order: the registry record if somebody has said something; otherwise the
 *  default the file's kind implies; and last, for a population seeded before any
 *  of this existed, the system its extract recorded — a file that names the
 *  system it was pulled out of has already answered the question. */
export function fileOriginOf(eng: IcfrEngagement, name?: string, seededSystem?: string): {
  origin?: FileOrigin; systemFetched?: boolean; by?: string; at?: string;
} {
  if (!name) return {};
  const rec = eng.fileRegistry?.find(f => f.name === name);
  if (rec) return { origin: rec.origin, systemFetched: rec.systemFetched, by: rec.originBy, at: rec.originAt };
  const byKind = defaultFileOrigin(guessFileKind(name));
  if (byKind) return { origin: byKind };
  return seededSystem?.trim() ? { origin: 'System export' } : {};
}

/** A file with no answer cannot be a population source — that is what removing
 *  "unknown" means in practice. */
export function fileUsable(f: { origin?: FileOrigin; systemFetched?: boolean }): boolean {
  return !!f.systemFetched || !!f.origin;
}

/** How a file's provenance reads in one line, wherever it is shown. */
export function originLabel(f: { origin?: FileOrigin; systemFetched?: boolean }): string {
  return f.systemFetched ? 'fetched by the system' : f.origin ? f.origin.toLowerCase() : 'not answered';
}

// ─── Exceptions — every failure, at the grain the auditor has to judge it ─────────
/** One failed attribute on one sampled item. Where no sample has been drawn the
 *  attribute's own result stands in, so a failure is never invisible just because
 *  the testing hasn't reached per-item grain yet. */
export interface ExceptionRow { sampleId: string; stepId: string; ref: string; code: string; description: string; }
export function sampleExceptions(c: Control): ExceptionRow[] {
  const samples = c.operating.sampling?.samples ?? [];
  const out: ExceptionRow[] = [];
  for (const s of c.operating.steps) {
    if (samples.length && s.sampleResults) {
      for (const smp of samples) {
        if (s.sampleResults[smp.id] === 'Fail') out.push({ sampleId: smp.id, stepId: s.id, ref: smp.ref, code: s.code, description: s.description });
      }
    } else if (stepResult(s) === 'Fail') {
      out.push({ sampleId: '—', stepId: s.id, ref: 'attribute level', code: s.code, description: s.description });
    }
  }
  return out;
}
/** Has this failure been judged a deviation or an isolated anomaly yet? */
export function exceptionJudgement(c: Control, sampleId: string, stepId: string) {
  return (c.operating.exceptions ?? []).find(x => x.sampleId === sampleId && x.stepId === stepId);
}
/** The original draw and the extension round, counted separately and together —
 *  the combined evaluation is what the conclusion actually rests on. */
export function combinedSample(c: Control): { orig: number; ext: number; total: number; fails: number; deviations: number; anomalies: number } {
  const samples = c.operating.sampling?.samples ?? [];
  const ex = sampleExceptions(c);
  const judged = c.operating.exceptions ?? [];
  const ext = samples.filter(s => s.extension).length;
  return {
    orig: samples.length - ext, ext, total: samples.length, fails: ex.length,
    deviations: judged.filter(j => j.kind === 'Deviation' && ex.some(e => e.sampleId === j.sampleId && e.stepId === j.stepId)).length,
    anomalies: judged.filter(j => j.kind === 'Anomaly' && ex.some(e => e.sampleId === j.sampleId && e.stepId === j.stepId)).length,
  };
}
/** An attribute concluded on nothing but somebody's word. Operating refuses these. */
export function inquiryOnlyAttributes(c: Control): OperatingStep[] {
  return c.operating.steps.filter(s => isInquiryOnly(s.evidenceType));
}

// ─── Sample sizing — frequency AND the risk's rating (handbook table) ─────────────
// Annual 1 · Quarterly 1–4 · Monthly 2–5 · Weekly 5–15 · Daily 15–40 · Recurring
// (per-transaction) 25–60 · Automated nature = test of one, valid only while ITGCs hold.
//
// Frequency alone doesn't settle the size — the RATING moves it inside the band,
// and at the bottom it drops the count outright: a quarterly control whose risk is
// Low is one occurrence a year, not two quarters. Where no rating has been agreed
// the middle of the band stands, which is what this sized at before.
const SIZE_BANDS: Record<Frequency, { low: number; mid: number; high: number; range: string; note: string }> = {
  Annual: { low: 1, mid: 1, high: 1, range: '1', note: 'Runs once a year — test the occurrence.' },
  Quarterly: { low: 1, mid: 2, high: 4, range: '1–4', note: 'Test the quarters that carry the risk.' },
  Monthly: { low: 2, mid: 4, high: 5, range: '2–5', note: 'A handful of months.' },
  Weekly: { low: 5, mid: 10, high: 15, range: '5–15', note: 'Spread across the period.' },
  Daily: { low: 15, mid: 25, high: 40, range: '15–40', note: 'A meaningful spread of days.' },
  Recurring: { low: 25, mid: 40, high: 60, range: '25–60', note: 'Runs many times a day — the deepest samples.' },
  'Ad-hoc': { low: 5, mid: 10, high: 15, range: 'judgment', note: 'Size by how often it actually ran.' },
};
const RATING_NOTE: Record<RiskRating, string> = {
  High: 'Rated high risk — sized at the top of the band.',
  Medium: 'Rated medium risk — the middle of the band.',
  Low: 'Rated low risk — the lightest test that still holds.',
};
export function sampleSizeGuide(c: Control, itgcHolds = true): { suggested: number; range: string; note: string } {
  if (c.nature === 'Automated' && itgcHolds) return { suggested: 1, range: 'test of one', note: 'Automated — one instance proves the rule, valid only while ITGCs hold.' };
  // Everything below this line is the manual path — and an automated control
  // whose ITGCs have failed takes it. "Sized like a manual control" has to mean
  // sized like a manual control OF THIS FREQUENCY AND RATING, not a flat number:
  // a quarterly control does not become a daily one because an ITGC broke.
  const band = SIZE_BANDS[c.frequency];
  const rating = c.riskRating;
  const suggested = rating === 'High' ? band.high : rating === 'Low' ? band.low : band.mid;
  const sized = rating ? `${band.note} ${RATING_NOTE[rating]}` : band.note;
  return {
    suggested,
    range: band.range,
    note: c.nature === 'Automated' ? `ITGC failure in force — test of one is invalid; sized like a manual control. ${sized}` : sized,
  };
}

// ─── Identity ────────────────────────────────────────────────────────────────────

/** THE NUMBER TO PRINT. When the same control is tested at several companies its
 *  rows need unique ids, but the number people quote in a meeting is the same
 *  one for all of them — so `id` stays the key and this is what gets shown. */
export const controlCode = (c: Pick<Control, 'id' | 'code'>): string => c.code ?? c.id;

// ─── Track + control conclusions (override wins) ─────────────────────────────────

export function trackResult(t: DesignTrack | OperatingTrack): TrackConclusion {
  if (t.override) return t.override.result === 'Effective' ? 'Effective' : 'Ineffective';
  return t.conclusion;
}
export function designStarted(c: Control): boolean {
  return !!c.design.override || c.design.conclusion !== 'Not tested'
    || c.design.documents.some(d => d.status === 'Received') || c.design.points.some(p => p.result !== 'Not tested');
}
export function operatingStarted(c: Control): boolean {
  return !!c.operating.override || c.operating.conclusion !== 'Not tested'
    || !!c.operating.population || c.operating.steps.some(s => s.result !== 'Not tested');
}
/**
 * Does the operating track apply to this control at all?
 *
 * An AUTOMATED control does the same thing to every transaction, so testing
 * fifty of them proves nothing that testing one did not — the design test is the
 * whole test, and population, sample and operating do not apply.
 *
 * That argument is a claim about the SYSTEM, not about the control: it holds
 * only while the IT general controls behind it do. If change management or
 * access has failed, nobody can say the logic that ran in March is the logic
 * that ran in October, and the control has to be tested like a manual one. So a
 * failed ITGC puts the full flow back — the same condition `sampleSizeGuide`
 * already uses to invalidate the test of one, applied to the whole track.
 *
 * Manual and IT-dependent controls always operate; only pure automation earns
 * the short form.
 */
export function operatingApplies(eng: IcfrEngagement, c: Control): boolean {
  if (c.nature !== 'Automated') return true;
  return !itgcHolds(eng, c);
}

/**
 * `opApplies = false` concludes the control on its design alone — see
 * operatingApplies. Defaults to true so every caller that has no engagement in
 * hand keeps the two-track behaviour, which is right for every manual control.
 *
 * An operating track that was concluded BEFORE the control went short-form still
 * counts when it found something: silently dropping a recorded Ineffective would
 * erase a finding on a technicality.
 */
export function controlConclusion(c: Control, opApplies = true): Conclusion {
  const d = trackResult(c.design); const o = trackResult(c.operating);
  if (d === 'Ineffective' || o === 'Ineffective') return 'Ineffective';
  if (!opApplies) return d === 'Effective' ? 'Effective' : designStarted(c) ? 'In progress' : 'Not started';
  if (d === 'Effective' && o === 'Effective') return 'Effective';
  return designStarted(c) || operatingStarted(c) ? 'In progress' : 'Not started';
}

/** The engagement-aware read — what every surface showing a control's state
 *  should use, so a short-form control reads the same everywhere. */
export function conclusionOf(eng: IcfrEngagement, c: Control): Conclusion {
  return controlConclusion(c, operatingApplies(eng, c));
}

// ─── Locks — a concluded control is frozen until reopened with a reason ──────────
export function isControlLocked(c: Control, opApplies = true): boolean {
  const concl = controlConclusion(c, opApplies);
  return concl === 'Effective' || concl === 'Ineffective';
}
export function isControlLockedIn(eng: IcfrEngagement, c: Control): boolean {
  return isControlLocked(c, operatingApplies(eng, c));
}
// A countersigned engagement is locked for good — no edits, no reopen.
export function isEngagementLocked(eng: IcfrEngagement): boolean {
  return !!(eng.signoff.preparer && eng.signoff.reviewer);
}

// ─── Review gate — concluded is not final until the reviewer countersigns ────────
// The paper travels: conclude → preparer signs (auditor) → reviewer countersigns.
export function isControlFinal(c: Control): boolean {
  return isControlLocked(c) && !!c.wpSignoff?.reviewer;
}
/** Concluded and preparer-signed — sitting in the reviewer's court. */
export function isAwaitingReview(c: Control): boolean {
  return isControlLocked(c) && !!c.wpSignoff?.preparer && !c.wpSignoff?.reviewer;
}

// ─── Review notes — the formal raise → resolve → verify channel ──────────────────
export function reviewNotesFor(eng: IcfrEngagement, controlId: string): ReviewNote[] {
  return eng.reviewNotes.filter(n => n.controlId === controlId);
}
/** Notes that still block this paper's countersign (anything not Closed). */
export function pendingReviewNoteCount(eng: IcfrEngagement, controlId: string): number {
  return eng.reviewNotes.filter(n => n.controlId === controlId && n.status !== 'Closed').length;
}

// ─── Track progress ──────────────────────────────────────────────────────────────

import type { DesignPoint, OperatingStep, TestResult, ValidationQA, ValidationTable } from './types';
export function pointResult(p: DesignPoint): TestResult { return p.override ? (p.override.result as TestResult) : p.result; }
export function stepResult(s: OperatingStep): TestResult { return s.override ? (s.override.result as TestResult) : s.result; }

/** Deterministic Q&A a design-validation workflow returns for a consideration. */
export function validationQA(text: string, fail: boolean): ValidationQA[] {
  return [
    { q: 'Does the control as described address the stated risk and assertion?', a: 'Yes — traced to the risk register and the relevant assertion in the narrative.', pass: true },
    { q: 'Is the control performed at sufficient precision to catch a material error?', a: fail ? 'No — the review occurs after the entry is posted, so a material error could already be recorded before detection.' : 'Yes — it operates before the transaction completes and the threshold is below performance materiality.', pass: !fail },
    { q: 'Is the performer segregated from the activity being controlled?', a: 'Yes — distinct system roles were confirmed in the walkthrough.', pass: true },
    { q: 'Is the control’s operation evidenced and retained for the period?', a: fail ? 'Partially — sign-off is retained but does not evidence the pre-posting review.' : 'Yes — evidenced and retained for the full period.', pass: !fail },
  ];
}

// ── deterministic "real" results — every run reads like an actual test, and two
//    different attributes never return the same numbers/documents ───────────────
const hnum = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const SAMPLE_VENDORS = [
  'Indian Oil Skytanking', 'Boeing Distribution Services', 'TajSATS Air Catering', 'Menzies Aviation',
  'Collins Aerospace', 'Amadeus IT Group', 'Lufthansa Technik', 'Shell MRPL Aviation Fuels',
];
const TIERS = ['Tier 2 (S. Iyer)', 'Tier 3 (Head of Procurement)', 'Tier 4 (Supply Chain Director)'];
const lakh = (n: number) => `₹${(n / 1e5).toFixed(1)}L`;

/** A realistic workflow run reference — run number, population, exceptions. */
export function wfRunRef(key: string, fail: boolean): string {
  const h = hnum(key);
  const run = 4800 + (h % 900);
  const items = 120 + ((h >>> 3) % 480);
  const ex = fail ? 1 + ((h >>> 7) % 5) : 0;
  return `run #${run} · ${items} items checked · ${ex} exception${ex === 1 ? '' : 's'}`;
}

/** Plain-language summary the AI returns after checking the uploaded file. */
export function validationSummary(text: string, fail: boolean, key = text, sampleCount?: number): string {
  const h = hnum(key);
  // the real drawn-sample count when there is one — the summary sits directly
  // above the per-sample table, so an invented number would contradict it
  const n = sampleCount || [15, 25, 25, 40][h % 4]!;
  const ex = 1 + ((h >>> 5) % 3);
  const po = `45000${12840 + (h % 25) * 7}`;
  const vendor = SAMPLE_VENDORS[h % SAMPLE_VENDORS.length]!;
  return fail
    ? `Tested ${n} sampled items against “${text}”. ${ex} exception${ex === 1 ? '' : 's'} found — PO ${po} (${vendor}) could not evidence the required approval/threshold, so the attribute is concluded Fail. Item-level results are in the table below.`
    : `Tested ${n} sampled items against “${text}”. All ${n} met the control — required approvals present and amounts within policy on each. No exceptions, so the attribute is concluded Pass.`;
}

/** A per-item evidence table to accompany the summary — real procurement documents. */
export function validationTable(fail: boolean, key = 'seed'): ValidationTable {
  const h = hnum(key);
  const rows = Array.from({ length: 4 }, (_, i) => {
    const hi = h + i * 137;
    const isFailRow = fail && i === 3;
    return [
      `PO 45000${12840 + ((hi >>> 2) % 25) * 7}`,
      SAMPLE_VENDORS[hi % SAMPLE_VENDORS.length]!,
      isFailRow ? 'No approver at required tier' : `Approved — ${TIERS[hi % TIERS.length]!}`,
      lakh((((hi >>> 4) % 60) + 8) * 100_000),
      isFailRow ? 'Fail' : 'Pass',
    ];
  });
  return { columns: ['Document', 'Vendor', 'Approval', 'Amount', 'Result'], rows };
}

/** TOD completeness — the share of REQUIRED design elements that carry evidence.
 *  Concluding design effective is gated on this reaching 100%. */
export function designCompleteness(c: Control): { done: number; total: number; pct: number } {
  const req = c.design.documents.filter(d => d.required !== false);
  // A waived element is accounted for, not outstanding — the audit team wrote it,
  // the client holds it, or there is nothing to hold. Either way the auditor has
  // recorded why, and a recorded judgement shouldn't read as a missing file.
  const done = req.filter(d => d.status === 'Received' || d.waiver).length;
  return { done, total: req.length, pct: req.length ? Math.round((done / req.length) * 100) : 0 };
}
/** Elements still genuinely outstanding — neither evidenced nor waived. */
export function designOutstanding(c: Control): DesignDoc[] {
  return c.design.documents.filter(d => d.status !== 'Received' && !d.waiver);
}
/** Attributes the walkthrough hasn't settled yet. Empty when it hasn't started —
 *  the gate is soft until the auditor commits to walking a transaction. */
export function walkthroughUntested(c: Control): OperatingStep[] {
  const w = c.design.walkthrough;
  if (!w) return [];
  return c.operating.steps.filter(s => (w.attributeResults[s.id] ?? 'Not tested') === 'Not tested');
}

// ─── Materiality worksheet math ──────────────────────────────────────────────────
import type { BenchmarkKey, MaterialityBasis } from './types';
export const BENCHMARK_META: Record<BenchmarkKey, { label: string; range: [number, number]; note: string }> = {
  assets: { label: 'Total assets', range: [0.5, 2], note: 'Asset-intensive entities (fleet, infrastructure)' },
  revenue: { label: 'Revenue', range: [0.5, 1], note: 'Stable top-line, thin or volatile margins' },
  pbt: { label: 'Profit before tax', range: [5, 10], note: 'Profit-oriented listed entities' },
  cash: { label: 'Cash & equivalents', range: [1, 3], note: 'Liquidity-driven / custodial operations' },
  equity: { label: 'Net assets / equity', range: [1, 2], note: 'Holding and investment entities' },
};
export function overallMateriality(b: MaterialityBasis): number { return Math.round(b.amounts[b.benchmark] * b.pct / 100); }
export function performanceMaterialityOf(b: MaterialityBasis): number { return Math.round(overallMateriality(b) * b.pmPct / 100); }
export function clearlyTrivialOf(b: MaterialityBasis): number { return Math.round(overallMateriality(b) * b.ctPct / 100); }

export function designProgress(c: Control) {
  const docs = c.design.documents;
  return {
    docsReceived: docs.filter(d => d.status === 'Received').length,
    docsTotal: docs.length,
    docsMissing: docs.filter(d => d.status !== 'Received').length,
    pointsPass: c.design.points.filter(p => pointResult(p) === 'Pass').length,
    pointsTotal: c.design.points.length,
  };
}
export function operatingProgress(c: Control) {
  const s = c.operating.steps;
  return {
    tested: s.filter(x => x.result !== 'Not tested').length,
    passed: s.filter(x => x.result === 'Pass').length,
    failed: s.filter(x => x.result === 'Fail').length,
    total: s.length,
  };
}

/** The rationale the conclusion box opens with.
 *
 *  Every conclusion has to reach the working paper with words against it, but
 *  making the auditor type the same sentence on a control that passed cleanly
 *  buys nothing except two hundred variations of "as per testing". So the box
 *  arrives already written FROM THE EVIDENCE — what was tested, against what,
 *  and what it showed — and the auditor edits it or leaves it.
 *
 *  Written from the evidence, not from the target conclusion: the auditor has
 *  not pressed a button yet when this is generated, and a sentence that assumed
 *  which one they would press would be putting words in their mouth. Disagreeing
 *  with it is exactly the case where they should be writing their own. */
export function concludeRationale(c: Control, which: 'design' | 'operating'): string {
  if (which === 'design') {
    const { pointsPass, pointsTotal } = designProgress(c);
    const evidenced = c.design.documents
      .filter(d => d.status === 'Received')
      .map(d => d.kind === 'Custom' ? d.name : d.kind.toLowerCase());
    const against = evidenced.length
      ? ` against the ${listPhrase(evidenced)} on file`
      : '';
    if (!pointsTotal) return `No design checks were recorded for this control${against}.`;
    const failed = c.design.points.filter(p => pointResult(p) === 'Fail');
    if (!failed.length) return `All ${pointsTotal} design check${pointsTotal === 1 ? '' : 's'} passed${against}.`;
    return `${pointsPass} of ${pointsTotal} design checks passed${against}. ${failed.length} failed: ${listPhrase(failed.map(p => p.text))}.`;
  }
  const { passed, failed, total } = operatingProgress(c);
  const n = c.operating.sampling?.size;
  const across = n ? ` across ${n} sampled item${n === 1 ? '' : 's'}` : '';
  if (!total) return `No attributes were recorded for this control${across}.`;
  if (!failed) return `All ${total} attribute${total === 1 ? '' : 's'} passed${across}.`;
  return `${passed} of ${total} attributes passed${across}. ${failed} failed.`;
}

/**
 * The extraction criteria the population step opens with.
 *
 * Two free-text boxes used to ask for a transaction type and an account, which
 * only ever worked when the source was a spreadsheet somebody had already
 * shaped. Against a system of record the criteria ARE the query, and there is
 * no fixed set of them — every table needs a different one. So the statement is
 * drafted from what is actually known about this control and its window, and
 * the auditor edits it into the thing they mean.
 *
 * Deliberately plain English rather than SQL: it is read by a reviewer, not run.
 * What runs against the system is a separate concern, and writing it as a query
 * here would put a language in the working paper that the paper's readers do
 * not have to know.
 */
export function extractionCriteria(c: Control, from: string, to: string, source?: { system?: string; name: string }): string {
  const what = c.subProcess && c.subProcess !== 'General' ? c.subProcess.toLowerCase() : c.process.toLowerCase();
  const window = from && to ? ` between ${fmtDay(from, '')} and ${fmtDay(to, '')}` : '';
  const where = source?.system ? ` from ${source.system}` : source ? ` in ${source.name}` : '';
  const entity = c.entity ? `, ${c.entity}` : '';
  return `All ${what} records${where}${window}${entity}, excluding reversals and test postings.`;
}

/** "a, b and c" — the Oxford-less join the rest of the copy uses. */
function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** What the design conclusion actually rests on — DERIVED from the checks, never
 *  typed by anyone.
 *
 *  A basis is a claim about how hard the auditor looked, and a free-text field
 *  invites the claim to run ahead of the work. So it is read off the auditor's
 *  own proof instead: a control where no check carries any is a control taken on
 *  the client's documents, whatever anybody would like to write. The clauses
 *  combine, because a walkthrough on one check and a reperformance on another
 *  are both true of the same conclusion. (Step-2 action items 11 + 12.) */
export function designBasis(c: Control): string {
  const kinds = new Set(c.design.points.map(p => p.auditorProof?.kind).filter(Boolean) as AuditorProofKind[]);
  if (kinds.size === 0) return 'documentation, inquiry and observation only';
  const parts: string[] = [];
  if (kinds.has('Walkthrough note')) parts.push('walkthrough performed');
  if (kinds.has('Reperformance result')) parts.push('reperformance included');
  if (kinds.has('Configuration extract')) parts.push('system configuration inspected');
  return listPhrase(parts);
}

/** How many checks the auditor did their own work on — the count behind the
 *  basis, so the sentence can be questioned rather than just believed. */
export function auditorProvenChecks(c: Control): number {
  return c.design.points.filter(p => p.auditorProof).length;
}

// ─── What the check list is missing (Step-2 action item 13) ──────────────────────
// A blank "add a consideration" box gets the checks somebody remembered on the
// day, and the ones nobody remembered never get written — which is the failure
// mode a design test cannot recover from, because an untested consideration
// leaves no trace of its absence.
//
// So the standard set is held here and offered against the control's own facts.
// Deterministic, like every other "AI" result in this module: same control, same
// suggestions, every time. Nothing is inserted — each one is added or dismissed
// by hand, because a check the auditor did not choose is a check they will not
// defend.
const CHECK_LIBRARY: { text: string; when: (c: Control) => boolean }[] = [
  { text: 'The person performing the control is independent of the person who prepares what it checks.', when: c => c.type === 'Detective' || /review|approv|verif|reconcil/i.test(c.description) },
  { text: 'The threshold or tolerance the control operates at is documented and approved.', when: c => /threshold|toleran|limit|exceed|above|below|match/i.test(`${c.description} ${c.precision ?? ''}`) },
  { text: 'Exceptions the control raises are followed through to resolution, not just noted.', when: c => c.type === 'Detective' },
  { text: 'The control leaves evidence that it operated — a reviewer can tell it ran on a given date.', when: () => true },
  { text: 'The person performing the control has the authority and competence to do so.', when: c => c.nature === 'Manual' },
  { text: 'The control operates over a complete population — nothing routes around it.', when: c => c.assertions?.includes('Completeness') ?? false },
  { text: 'Transactions are captured in the correct period.', when: c => c.assertions?.includes('Cut-off') ?? false },
  { text: 'The inputs to the calculation are independently verified before it runs.', when: c => c.assertions?.includes('Valuation') ?? false },
  { text: 'The system configuration behind the control is under change control.', when: c => c.nature === 'Automated' || c.nature === 'IT-dependent' },
  { text: 'The report the control is performed against is itself reliable.', when: c => c.nature === 'IT-dependent' },
  { text: 'The control runs often enough to catch a misstatement before it reaches the accounts.', when: c => c.frequency === 'Quarterly' || c.frequency === 'Annual' },
];

/** Significant words, so "reviewer is independent of the preparer" and "the
 *  person performing the control is independent of the person who prepares"
 *  are recognised as the same consideration rather than offered twice. */
const STOPWORDS = new Set(['the', 'a', 'an', 'is', 'are', 'of', 'to', 'and', 'or', 'it', 'that', 'this', 'on', 'in', 'at', 'by', 'for', 'with', 'not', 'has', 'have', 'been', 'was', 'were', 'be', 'who', 'which', 'they', 'them', 'its', 'control', 'person']);
function keyWords(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOPWORDS.has(w)));
}
function alreadyCovered(existing: Set<string>[], candidate: string): boolean {
  const cand = keyWords(candidate);
  if (cand.size === 0) return false;
  return existing.some(have => {
    let hits = 0;
    cand.forEach(w => { if (have.has(w)) hits++; });
    return hits / cand.size >= 0.5;
  });
}

// ─── Which file is this control's population? (Step-2 action item 20) ───────────
/** A ranked guess, with the sentence that justifies it.
 *
 *  Stated, never applied. The picker still opens with nothing chosen — the
 *  suggestion sits above the list saying which row it would take and why, in the
 *  same voice as "Evidence suggests" on the conclude footer. An auditor who
 *  disagrees changes nothing but their mind; an auditor who agrees clicks the
 *  row they were going to click anyway, having read the reason.
 *
 *  The reason matters more than the ranking. "Most of this process draws off it"
 *  is checkable; a confidence percentage is not. */
export function suggestPopulationFile(
  eng: IcfrEngagement,
  c: Control,
  files: { name: string; kind: string; rows: number; systemFetched?: boolean; origin?: FileOrigin; system?: string }[],
  requiredNames: string[] = [],
): { name: string; reason: string } | null {
  // A file nobody has said where it came from cannot be picked at all, so it
  // must not be suggested either — a recommendation into a disabled row.
  const usable = files.filter(f => !!f.systemFetched || !!f.origin);
  if (usable.length === 0) return null;

  const scored = usable.map(f => {
    let score = 0;
    const why: string[] = [];

    // 1. What this same control drew off before. The strongest signal there is,
    //    and it was sitting unused: a control's population comes out of the same
    //    place round after round unless something changed.
    const mine = eng.controls.find(x => x.id === c.id)?.operating.population?.sourceFile;
    if (mine === f.name) { score += 60; why.push('this control drew off it last round'); }

    // 2. What the rest of the process uses. Controls in one process read the
    //    same ledgers; a file 30 of them share is not a coincidence.
    const mates = controlsUsingFile(eng, f.name).filter(x => x.process === c.process && x.id !== c.id).length;
    if (mates >= 3) { score += 30; why.push(`${mates} other ${c.process} controls draw off it`); }
    else if (mates > 0) { score += 12; why.push(`${mates} other ${c.process} control${mates === 1 ? '' : 's'} draws off it`); }

    // 3. The dataset this control was always going to need, by name.
    const wanted = requiredNames.find(n => {
      const stem = n.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim().split(/\s+/)[0] ?? '';
      return stem.length > 3 && f.name.toLowerCase().includes(stem);
    });
    if (wanted) { score += 25; why.push(`it is the ${wanted.toLowerCase()} this control tests against`); }

    // 4. A trial balance holds account totals, not the instances of a control.
    //    Cheap to state and it stops the most common wrong answer.
    if (f.kind === 'Trial balance') { score -= 25; }
    if (f.kind === 'General ledger' || f.kind === 'System extract' || f.kind === 'Source file') score += 8;

    // 5. It has to be able to hold the instances. A file smaller than the number
    //    of times the control ran cannot be the population it ran over.
    const runs = derivedRunCount(c, undefined, undefined);
    if (runs != null && f.rows < runs) { score -= 30; why.push('too few rows to hold every run'); }

    return { f, score, why };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  // No positive evidence is not a weak recommendation, it is no recommendation.
  // Nor is a tie: two files with the same claim means the machine has nothing to
  // add, and saying so is better than picking one and sounding certain.
  if (!top || top.score <= 0 || top.why.length === 0) return null;
  if (scored[1] && scored[1].score === top.score) return null;
  return { name: top.f.name, reason: listPhrase(top.why) };
}

export function suggestedDesignChecks(c: Control): string[] {
  const existing = c.design.points.map(p => keyWords(p.text));
  return CHECK_LIBRARY
    .filter(x => x.when(c))
    .map(x => x.text)
    .filter(t => !alreadyCovered(existing, t));
}

// ─── Baton — whose court ─────────────────────────────────────────────────────────

export function courtFor(c: Control, tasks: HandoffTask[], notes: ReviewNote[] = []): Court {
  if (tasks.some(t => t.controlId === c.id && t.assigneeRole === 'risk-owner' && t.status === 'open')) return 'risk-owner';
  // Review notes move the baton with them: an open note waits on the auditor's
  // resolution; a resolved one waits on the reviewer's verification.
  if (notes.some(n => n.controlId === c.id && n.status === 'Open')) return 'auditor';
  if (notes.some(n => n.controlId === c.id && n.status === 'Resolved')) return 'reviewer';
  const concl = controlConclusion(c);
  // Concluded isn't closed: the paper still travels auditor (sign) → reviewer
  // (countersign). Only a countersigned paper leaves every court.
  if (concl === 'Effective' || concl === 'Ineffective') {
    if (c.wpSignoff?.reviewer) return 'none';
    return c.wpSignoff?.preparer ? 'reviewer' : 'auditor';
  }
  return 'auditor';
}

// ─── Test schedule — every control carries a next-test due date ──────────────────
// Regular testing is the tool's heartbeat for the risk owner: each control is due
// on its frequency cycle. Concluding the operating track pushes the date out to
// the next cycle; an untested control can be due today or overdue.

import type { Frequency } from './types';
const CYCLE_DAYS: Record<Frequency, number> = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, Annual: 365, Recurring: 7, 'Ad-hoc': 30 };

/** A concluded control (Effective or Ineffective) is off the due schedule —
 *  effective ones wait for the next cycle, ineffective ones for remediation. */
export function isConcluded(c: Control, opApplies = true): boolean {
  const x = controlConclusion(c, opApplies);
  return x === 'Effective' || x === 'Ineffective';
}

export function testDueInDays(c: Control): number {
  const cycle = CYCLE_DAYS[c.frequency];
  let h = 0; for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
  // concluded (or operating already tested) → next cycle, never "due now"
  if (isConcluded(c) || trackResult(c.operating) !== 'Not tested') return Math.max(1, cycle - (h % Math.max(1, Math.floor(cycle / 3))));
  if (c.testDueInDays != null) return c.testDueInDays;
  return (h % (cycle + 4)) - 3;
}

export function testDueLabel(d: number): string {
  if (d < 0) return `Overdue ${-d}d`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `Due in ${d}d`;
}

/** Row display — concluded controls read as scheduled/parked, never as due. */
export function testDueDisplay(c: Control, opApplies = true): { label: string; cls: string } {
  const concl = controlConclusion(c, opApplies);
  if (concl === 'Ineffective') return { label: 'Retest after remediation', cls: 'text-risk-700' };
  const d = testDueInDays(c);
  if (concl === 'Effective') return { label: `Next test in ${d}d`, cls: '' };
  if (d < 0) return { label: `Overdue ${-d}d`, cls: 'text-risk-700 font-semibold' };
  if (d === 0) return { label: 'Due today', cls: 'text-mitigated-700 font-semibold' };
  return { label: testDueLabel(d), cls: '' };
}

export function isTestDueNow(c: Control): boolean { return !isConcluded(c) && testDueInDays(c) <= 0; }

export function testsDueNow(controls: Control[]): Control[] {
  return controls.filter(isTestDueNow).sort((a, b) => testDueInDays(a) - testDueInDays(b));
}

// ─── Engagement progress ─────────────────────────────────────────────────────────

export function engagementProgress(eng: IcfrEngagement, controls?: Control[]) {
  // `controls` narrows the count to a subset — the open audit's scope, so the
  // audit Dashboard reports its own six rather than the engagement's thirty-two.
  // Omitted, it counts the whole engagement, which is what every other caller
  // wants.
  const cs = controls ?? eng.controls;
  const concl = cs.map(c => conclusionOf(eng, c));
  return {
    total: cs.length,
    designDone: cs.filter(c => trackResult(c.design) !== 'Not tested').length,
    operatingDone: cs.filter(c => trackResult(c.operating) !== 'Not tested').length,
    effective: concl.filter(x => x === 'Effective').length,
    ineffective: concl.filter(x => x === 'Ineffective').length,
    inProgress: concl.filter(x => x === 'In progress').length,
    waitingOnOwner: cs.filter(c => courtFor(c, eng.tasks, eng.reviewNotes) === 'risk-owner').length,
    awaitingReview: cs.filter(isAwaitingReview).length,
    reviewed: cs.filter(isControlFinal).length,
  };
}

/**
 * How much of the engagement is FINISHED — the third engagement score.
 *
 * Milestone-weighted, because "done" is not one event: a control travels RACM
 * approval → TOD → TOE → countersign, and an exception raised on the way has to
 * be closed before the control is off the table. Each control is worth exactly
 * 1.0, split across those five, and the engagement reads the average.
 *
 * Weights sum to 1.0 per control, so `Σ credits ÷ control count` is the same
 * number as `Σ credits ÷ Σ maximum credits` — the control is the denominator
 * because every milestone above is an event ON a control. Nothing here is done
 * to a process or an entity directly.
 *
 * COMPLETENESS IS NOT EFFECTIVENESS. A control that concluded ineffective is
 * finished work, so every milestone credits on conclusion, whichever way it
 * went. An engagement can read 100% and still conclude ICFR not effective.
 */
const MILESTONE = { racm: 0.10, tod: 0.25, toe: 0.30, countersign: 0.25, exceptions: 0.10 } as const;

export function engagementCompleteness(eng: IcfrEngagement, controls?: Control[]) {
  const cs = controls ?? eng.controls;
  let credits = 0;
  let fullyDone = 0;
  let blocked = 0;
  let keyNotStarted = 0;
  cs.forEach(c => {
    // A short-form automated control has no operating track to conclude, so its
    // TOE weight moves to design rather than leaving it unable to reach 1.0.
    // Dropping it from the denominator instead would make the score move every
    // time an ITGC conclusion changed, which is not progress.
    const shortForm = !operatingApplies(eng, c);
    let n = 0;
    if (c.racmReview?.status === 'Approved') n += MILESTONE.racm;
    if (trackResult(c.design) !== 'Not tested') n += MILESTONE.tod + (shortForm ? MILESTONE.toe : 0);
    if (!shortForm && trackResult(c.operating) !== 'Not tested') n += MILESTONE.toe;
    if (isControlLockedIn(eng, c) && !!c.wpSignoff?.reviewer) n += MILESTONE.countersign;
    if (!eng.deficiencies.some(d => d.controlId === c.id && d.status !== 'Closed')) n += MILESTONE.exceptions;
    credits += n;
    if (n >= 1) fullyDone += 1;
    else {
      // Blocked = the work cannot move without somebody else — testing recorded
      // as unable to proceed, or the baton sitting in the owner's court.
      const u = c.unableToTest;
      if ((u && !u.resolvedAt && !u.convertedTo) || courtFor(c, eng.tasks, eng.reviewNotes) === 'risk-owner') blocked += 1;
      if (c.isKey && !designStarted(c) && !operatingStarted(c)) keyNotStarted += 1;
    }
  });
  return {
    total: cs.length,
    credits,
    fullyDone,
    blocked,
    keyNotStarted,
    pct: cs.length ? Math.round((credits / cs.length) * 100) : 0,
  };
}

export function tasksForRole(eng: IcfrEngagement, role: Role): HandoffTask[] {
  return eng.tasks.filter(t => t.assigneeRole === role && t.status === 'open');
}
/** Person-lane match: a task is this owner's if it names them, or rides a control they own. */
export function isOwnerTask(eng: IcfrEngagement, t: HandoffTask, owner: string): boolean {
  return t.assigneeRole === 'risk-owner'
    && (t.assignee === owner || eng.controls.find(c => c.id === t.controlId)?.owner === owner);
}
export function discussionsFor(eng: IcfrEngagement, controlId: string) {
  return eng.discussions.filter(d => d.controlId === controlId);
}
export function openDiscussionCount(eng: IcfrEngagement, controlId: string): number {
  return discussionsFor(eng, controlId).filter(d => !d.resolved).length;
}

// Parse a period-end label like 'Mar 2026' to the last moment of that month.
export function periodEndDate(label: string): Date | null {
  const parsed = Date.parse(`1 ${label}`);
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

export function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${n}`;
}

// A remediation due date is stored as a string — ISO 'YYYY-MM-DD' (the date picker) or a
// legacy '30 Jun' seed label. Format both to a human '30 Jun 2026' ('—' when unset) so the
// working-paper preview and the .xlsx export read the same as the on-screen view.
export function formatDueDate(date: string | null | undefined): string {
  if (!date) return '—';
  const s = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return s;
}
