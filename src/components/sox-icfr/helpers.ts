import { isInquiryOnly, ipeReliable, GRADE_RANK, AUDIT_SAMPLE_SPREADS, DEFAULT_AUDIT_SAMPLING, TESTING_STRATEGIES } from './types';
import type {
  AuditorProofKind, AuditSampleSpread, AuditSampling, Conclusion, Control, Court, Deficiency, DesignDoc, DesignDocKind, DesignTrack, ExceptionGrade, HandoffTask, IcfrEngagement,
  FileOrigin, IpeCheck, Likelihood, MaterialityRules, OperatingTrack, Population, PopulationBasis, PopulationSource, ReviewNote, RiskRating, Role,
  Sample, Severity, TestingStrategy, ToeRound, TrackConclusion, DeficiencyGroup, ExceptionStatus,
  ControlType, Nature,
} from './types';

// ─── Severity (handbook §9.5) ────────────────────────────────────────────────────


/** What a control's deterministic demo numbers hash — the id it was seeded
 *  under, so the S11 ID rename moves nothing. See Control.seedKey. */
export const seedKeyOf = (c: { id: string; seedKey?: string }): string => c.seedKey ?? c.id;

export function isReasonablyPossible(l: Likelihood): boolean { return l !== 'Remote'; }
// ─── PARKED (Sep 2026) — the three-grade severity calculator ─────────────────────
// computeSeverity / severityOf graded straight onto the ladder, with no
// clearly-trivial floor, no compensating-control cap and no aggregation. Nothing
// has called them since gradeException below became the one engine, and a second
// calculation left lying around is how two screens come to disagree. Kept here as
// the reference the compliance workspace's local copy points at
// (complianceSeverityData.ts).
//
// export function computeSeverity(likelihood: Likelihood, magnitude: number, materiality: number, mwIndicators: string[], band = 0.2): Severity {
//   if (mwIndicators.length > 0) return 'Material Weakness';
//   if (!isReasonablyPossible(likelihood)) return 'Deficiency';
//   if (magnitude >= materiality) return 'Material Weakness';
//   if (magnitude >= materiality * band) return 'Significant Deficiency';
//   return 'Deficiency';
// }
// export function severityOf(d: Deficiency, materiality: number, rules?: MaterialityRules): Severity {
//   return computeSeverity(d.likelihood, d.magnitude, materiality, d.mwIndicators, rules ? rules.sdBandPct / 100 : 0.2);
// }
export function isClearlyTrivial(magnitude: number, rules: MaterialityRules): boolean {
  return magnitude <= rules.clearlyTrivial;
}

// ─── Assessed severity — the raw grade plus the compensating-control cap ─────────
// The cap only rescues the magnitude-driven MW line (MW → SD). It applies only
// when the chosen compensating control is itself concluded effective in this
// engagement, never when an MW indicator is present, and it never clears the
// exception — capBlocked says why a chosen control had no effect.
export const SEVERITY_RANK: Record<Severity, number> = { Deficiency: 0, 'Significant Deficiency': 1, 'Material Weakness': 2 };
export interface SeverityAssessment {
  raw: ExceptionGrade;
  final: ExceptionGrade;
  capped: boolean;
  capBlocked?: 'not-effective' | 'mw-indicator';
  bumped?: boolean;   // prudent-official judgment raised the grade above the math
}
// The short form of `gradeException` below — the grade, and whether a cap or a
// judgement moved it — for the dashboard, the roll-ups, the working paper, the
// reviewer queue and the archive. It carries the SAME four grades the register
// shows, Clearly Trivial included: this used to fold Clearly Trivial into
// Deficiency, so one finding read as two different grades depending on the
// screen (C10, Sep 2026). Never a second calculation — one engine, so the card,
// the working paper and the engagement conclusion cannot disagree. The opinion
// needs no three-grade view: it only ever asks whether a grade is Material
// Weakness (openMaterialWeaknesses), and Clearly Trivial never is.
export function assessSeverity(d: Deficiency, eng: IcfrEngagement): SeverityAssessment {
  const g = gradeException(d, eng);
  return {
    raw: g.ladderGrade,
    final: g.grade,
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

/**
 * The severity ladder, callable with FIGURES rather than a deficiency record.
 *
 * `gradeException` below grades one exception and narrates every rule it passed
 * through. A GROUP has no record to narrate — it has a combined exposure and a
 * combined likelihood and nothing else — so the same rules have to be reachable
 * without one. Both read the same primitives (isClearlyTrivial, the remote
 * ceiling, `ladder`, and the cap), so a group and a member can never be graded
 * by two different rulebooks.
 */
export function gradeFromFigures(
  input: { exposure: number; likelihood: Likelihood; mwIndicator?: boolean; capBy?: string },
  eng: IcfrEngagement,
): { grade: ExceptionGrade; cap?: { from: ExceptionGrade; to: ExceptionGrade; by: string } } {
  // An indicator settles it whatever the amount, and cannot be argued down.
  if (input.mwIndicator) return { grade: 'Material Weakness' };
  if (isClearlyTrivial(input.exposure, eng.rules)) return { grade: 'Clearly Trivial' };
  const ladderGrade: ExceptionGrade = isReasonablyPossible(input.likelihood)
    ? ladder(input.exposure, eng.materiality, eng.rules.sdBandPct)
    : 'Deficiency';
  // One step down, never to zero.
  if (input.capBy && ladderGrade === 'Material Weakness') {
    return { grade: 'Significant Deficiency', cap: { from: 'Material Weakness', to: 'Significant Deficiency', by: input.capBy } };
  }
  return { grade: ladderGrade };
}

/* ── Groups ───────────────────────────────────────────────────────────────────
 *
 * Replaced process and assertion as grouping keys (13 Aug 2026). They grouped
 * exceptions that share a WORKFLOW; aggregation is about exceptions that hit the
 * same NUMBER. Two P2P controls failing on unrelated accounts were being added
 * together, and two controls in different processes hitting Accounts Payable
 * were not — both the wrong way round.
 *
 * What a deficiency joins now: one derived group per FS line item on its
 * control, plus any root-cause group a person has put it in.
 */

/** Deficiencies that never join anything.
 *
 *  An MW-indicator exception is already a material weakness whatever the amount,
 *  so a group cannot raise it — and adding its exposure to one would inflate
 *  every other member's grade off a figure the indicator made irrelevant. An
 *  ITGC exception is out of the ACCOUNT groups by the same logic it has always
 *  followed: it does not land on one line item, it withdraws reliance across the
 *  engagement. Both can still be put in a root-cause group by hand. */
export function joinsNoDerivedGroup(d: Deficiency, eng: IcfrEngagement): boolean {
  if (d.mwIndicators.length > 0) return true;
  const c = eng.controls.find(x => x.id === d.controlId);
  return c?.process === 'IT General Controls';
}

/** Is this exception live enough to be part of what is still wrong? Clearly
 *  trivial never aggregates — the de-minimis rule stopped it before aggregation
 *  was reached — and a closed one has been remediated. */
export const aggregable = (d: Deficiency, eng: IcfrEngagement): boolean =>
  d.status !== 'Closed' && !isClearlyTrivial(d.magnitude, eng.rules);

/** The keys this exception groups on. */
export function groupKeysFor(d: Deficiency, eng: IcfrEngagement): { kind: 'account' | 'root cause'; key: string; name: string }[] {
  const keys: { kind: 'account' | 'root cause'; key: string; name: string }[] = [];
  if (!joinsNoDerivedGroup(d, eng)) {
    const c = eng.controls.find(x => x.id === d.controlId);
    (c?.accountIds ?? []).forEach(id => {
      const acc = eng.accounts.find(a => a.id === id);
      if (acc) keys.push({ kind: 'account', key: `account:${id}`, name: acc.name });
    });
  }
  (eng.rootCauseGroups ?? []).forEach(g => {
    if (g.memberIds.includes(d.id)) keys.push({ kind: 'root cause', key: `root:${g.id}`, name: g.name });
  });
  return keys;
}

/**
 * The exposure a group actually stands behind.
 *
 * Two members share a population when their figures came out of the same file
 * under the same filter — a control failing twice on one extract is one hole,
 * not two, and adding them would count the same rupees twice. So members are
 * partitioned by population identity, the LARGEST is taken inside a partition,
 * and the partitions are added.
 *
 * Identity is proven, never guessed. `criteria` is a sentence the auditor wrote,
 * so two of them can only be compared for being the SAME — nothing can read
 * whether "Jan–Jun, excluding reversals" overlaps "H1 payments". Anything short
 * of an exact match on both file and criteria is treated as a separate
 * population and added, which errs upward. That is the safe direction: the rule
 * that must never break is that aggregation does not lower a grade.
 *
 * A member whose figure cannot be placed against any file at all becomes its own
 * partition and marks the whole group unverified — the total is still shown,
 * because the auditor needs a number, but it is not claimed as proven.
 */
export function populationIdentity(d: Deficiency, eng: IcfrEngagement): string | null {
  const c = eng.controls.find(x => x.id === d.controlId);
  if (!c) return null;
  const sources = populationSources(c);
  if (!sources.length) return null;
  // Which file the failure was found in — read off the items that failed.
  const failed = new Set(d.failedSamples ?? []);
  const hit = (c.operating.sampling?.samples ?? []).find(s => failed.has(s.ref));
  const src = hit ? sources.find(s => s.id === (hit.sourceId ?? LEGACY_SOURCE_ID)) : undefined;
  // A single-source control has only one answer, so it does not need the items
  // to point at it. A multi-source control does, and without them nothing is
  // proven — see `unverified` on the group.
  const only = sources.length === 1 ? sources[0] : undefined;
  const use = src ?? only;
  if (!use?.file) return null;
  return `${use.file}\u0000${use.criteria ?? ''}`;
}

export function combinedExposure(members: Deficiency[], eng: IcfrEngagement): { total: number; unverified: boolean } {
  const partitions = new Map<string, number>();
  let unverified = false;
  members.forEach((d, i) => {
    const id = populationIdentity(d, eng);
    if (id === null) unverified = true;
    // Unplaceable figures each get a partition of their own, keyed so they can
    // never merge with anything — including each other.
    const key = id ?? `\u0000unplaced:${d.id}:${i}`;
    partitions.set(key, Math.max(partitions.get(key) ?? 0, d.magnitude));
  });
  return { total: Array.from(partitions.values()).reduce((a, b) => a + b, 0), unverified };
}

/** The highest likelihood among the members — a group is at least as likely to
 *  bite as its likeliest member. */
export function combinedLikelihood(members: Deficiency[]): Likelihood {
  return members.some(m => isReasonablyPossible(m.likelihood)) ? 'Reasonably possible' : 'Remote';
}

/** A compensating control that may cap the GROUP.
 *
 *  Once for the whole group, and only one that is not already doing the job for
 *  an individual member: a control cannot be spent twice. */
function groupCap(members: Deficiency[], eng: IcfrEngagement): string | undefined {
  for (const m of members) {
    const id = m.compensatingControlId;
    if (!id) continue;
    const cc = eng.controls.find(c => c.id === id);
    if (!cc || controlConclusion(cc) !== 'Effective') continue;
    // Already claimed — this member's own grade was capped by it.
    if (gradeException({ ...m, prudentOverride: undefined }, eng, true).cap?.by === id) continue;
    return id;
  }
  return undefined;
}

/** Every group in the engagement, rebuilt from current state. Derived groups
 *  with a single member are not groups — nothing aggregates with itself — so
 *  they are dropped rather than shown as a group of one. */
export function deficiencyGroups(eng: IcfrEngagement): DeficiencyGroup[] {
  if (!eng.rules.aggregate) return [];
  const live = eng.deficiencies.filter(d => aggregable(d, eng));
  const byKey = new Map<string, { kind: 'account' | 'root cause'; name: string; members: Deficiency[] }>();
  live.forEach(d => groupKeysFor(d, eng).forEach(k => {
    const g = byKey.get(k.key) ?? { kind: k.kind, name: k.name, members: [] };
    g.members.push(d);
    byKey.set(k.key, g);
  }));
  const out: DeficiencyGroup[] = [];
  byKey.forEach((g, key) => {
    // A root-cause group the user made is theirs to keep even at one member —
    // they are mid-linking. A derived group of one is just a deficiency.
    if (g.kind === 'account' && g.members.length < 2) return;
    const { total, unverified } = combinedExposure(g.members, eng);
    const likelihood = combinedLikelihood(g.members);
    const mwIndicator = g.members.some(m => m.mwIndicators.length > 0);
    const capBy = groupCap(g.members, eng);
    const { grade, cap } = gradeFromFigures({ exposure: total, likelihood, mwIndicator, capBy }, eng);
    out.push({
      key, kind: g.kind, name: g.name, members: g.members,
      exposure: total, unverified, likelihood, grade, cap,
      conclusion: (eng.groupConclusions ?? []).find(c => c.groupKey === key),
    });
  });
  return out;
}

/** The groups one exception belongs to. */
export const groupsFor = (d: Deficiency, eng: IcfrEngagement): DeficiencyGroup[] =>
  deficiencyGroups(eng).filter(g => g.members.some(m => m.id === d.id));

/** A group of three or more resting on the lowest likelihood is worth a second
 *  look before it is accepted — several exceptions all judged remote is the
 *  shape a understated group takes. */
export const likelihoodNeedsConfirming = (g: DeficiencyGroup): boolean =>
  g.members.length >= 3 && !isReasonablyPossible(g.likelihood);

/**
 * Confirmations that no longer stand.
 *
 * A reviewer confirms a GRADE, not a deficiency: "I agree this is a significant
 * deficiency". Aggregation means someone else's exception can move that grade —
 * a fourth finding on Accounts Payable can turn three significant deficiencies
 * into a material weakness without any of the three being touched. The
 * confirmation given for the old grade is then a confirmation of something that
 * is no longer true.
 *
 * So this is a SWEEP, not a per-record fix: every recompute walks every
 * confirmed exception, not only the one that changed, which is the whole reason
 * it exists. Where the grade has moved the confirmation is cleared, the
 * exception goes back to the reviewer, and `ratingReset` records what it used to
 * be and why — a confirmation that simply vanished would read as a bug.
 *
 * Run after anything that can move a grade: a member's figures, membership, the
 * ground rules, materiality, a remediation that closed one.
 */
export function reconcileConfirmations(eng: IcfrEngagement): IcfrEngagement {
  let touched = false;
  const deficiencies = eng.deficiencies.map(d => {
    if (!d.ratingConfirm) return d;
    const now = gradeException(d, eng).grade;
    if (now === d.ratingConfirm.grade) return d;
    touched = true;
    const g = groupsFor(d, eng).find(x => GRADE_RANK[x.grade] >= GRADE_RANK[now as ExceptionGrade]);
    return {
      ...d,
      ratingConfirm: undefined,
      status: 'Rating review' as ExceptionStatus,
      ratingReset: {
        was: d.ratingConfirm.grade,
        reason: g ? `${g.name} — the group now grades ${g.grade}` : 'the severity inputs changed',
        at: 'just now',
      },
    };
  });
  return touched ? { ...eng, deficiencies } : eng;
}

/** `ownGradeOnly` is the cycle-breaker, and internal. A group's grade is built
 *  from its members' OWN grades, so anything computing a group must be able to
 *  ask for one without the group being consulted again on the way. Step 1 of the
 *  order feeding step 5, never the other way round. */
export function gradeException(d: Deficiency, eng: IcfrEngagement, ownGradeOnly = false): ExceptionGradeResult {
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
  //
  // Roll-down, and only ever upward: a member's final grade is the worst of its
  // own and every group it is in. A group that grades lower changes nothing —
  // aggregation exists to catch what the single view misses, never to argue a
  // finding down.
  let aggregate: ExceptionGradeResult['aggregate'];
  if (!eng.rules.aggregate) {
    working.push({ n: 6, rule: 'Aggregation', fired: false, detail: 'Switched off in the engagement ground rules.' });
  } else if (ownGradeOnly) {
    working.push({ n: 6, rule: 'Aggregation', fired: false, detail: 'Not evaluated — this is the exception on its own, which is what its groups are built from.' });
  } else {
    const groups = groupsFor(d, eng);
    if (groups.length) {
      const worst = groups.reduce((a, b) => (GRADE_RANK[b.grade] > GRADE_RANK[a.grade] ? b : a));
      const raised = GRADE_RANK[worst.grade] > GRADE_RANK[grade];
      aggregate = { members: worst.members.length, sum: worst.exposure, grade: worst.grade, raised, sharedBy: worst.name };
      working.push({
        n: 6, rule: 'Aggregation', fired: raised,
        detail: `${worst.members.length} exception${worst.members.length === 1 ? '' : 's'} on ${worst.name} — ${RUPEE(worst.exposure)} together${worst.unverified ? ' (not all of it placed against a population)' : ''} ⇒ ${worst.grade}${raised ? `, which raises this one from ${grade}.` : ', which does not raise it.'}`,
      });
      if (raised) grade = worst.grade;
    } else {
      working.push({ n: 6, rule: 'Aggregation', fired: false, detail: joinsNoDerivedGroup(d, eng) ? 'Not grouped — an MW indicator or an ITGC exception does not aggregate on a line item.' : 'Nothing else hits the same line item, and it is not linked to a root cause.' });
    }
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

// Every rating is confirmed by the reviewer before the owner is sent off to plan
// a fix — a wrong rating must not drive weeks of remediation, and a grade only
// looks small once someone has agreed it is small. (This used to fire above
// Significant Deficiency alone; the rung is the reviewer's on every finding now,
// so the threshold helper it needed is gone.)

// ─── No two rungs in a row by the same hands ─────────────────────────────────────
// A finding travels through eight steps, and at every handoff the point is that
// somebody ELSE looks. Roles alone do not guarantee that: one person can hold two
// hats, and on a small team usually does. So each rung stamps who did it, and the
// next one is refused to that name — sized-then-confirmed, submitted-then-judged,
// fixed-then-retested, retested-then-closed. Checked by NAME for the same reason
// the own-control prohibition is: changing hats must not change the answer.
//
// An absent stamp (a finding seeded mid-ladder, or raised before the field
// existed) reads as "no clash known" rather than blocking — a rule that fires on
// missing history would freeze records nobody can unfreeze.
export function samePerson(previous: { by: string } | undefined, actor: string): boolean {
  return !!previous && previous.by === actor;
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

/** Step 1 is done: a root cause is written, and it is the auditor's — not an
 *  Ira draft nobody has looked at yet (17 Sep dev call). */
export function rootCauseReady(d: Pick<Deficiency, 'rootCause' | 'iraSuggested'>): boolean {
  return !!d.rootCause.trim() && !d.iraSuggested?.rootCause;
}

/**
 * Ira's draft root cause, read off what failed — the failed design checks for a
 * TOD exception, the failed attributes, the items they failed on and the notes
 * written against those items for a TOE one. It names the mechanism the evidence
 * points at, not the count, and quotes the evidence it came from. null when
 * nothing failed that it could read (an unable-to-test exception).
 */
export function suggestRootCause(
  c: Control, track: 'design' | 'operating', failedSamples: string[], onSecondRound: boolean,
): { text: string; reason: string } | null {
  const quote = (t: string) => `"${t.replace(/[.\s]+$/, '')}"`;
  const lowerFirst = (t: string) => (t.charAt(0).toLowerCase() + t.slice(1).replace(/[.\s]+$/, '')).replace(/^(control|process|system|review|approval)\b/, 'the $1');
  const again = onSecondRound ? ' It failed again on the redrawn sample, so it is not a one-off.' : '';
  if (track === 'design') {
    const checks = c.design.points.filter(p => (p.override?.result ?? p.result) === 'Fail').map(p => p.text);
    if (!checks.length) return null;
    const more = checks.length > 1 ? ` ${checks.length - 1} other design check${checks.length === 2 ? '' : 's'} failed the same way.` : '';
    return {
      text: `The control as designed does not make sure that ${lowerFirst(checks[0]!)} — nothing in the way it is set up forces that step.${more}`,
      reason: `from the failed design check ${quote(checks[0]!)}`,
    };
  }
  const steps = c.operating.steps.filter(s => stepResult(s) === 'Fail');
  if (!steps.length) return null;
  const first = steps[0]!;
  const noted = (c.operating.exceptions ?? []).find(x => x.reason.trim())?.reason.trim();
  const items = failedSamples.length
    ? ` ${failedSamples.length} sampled item${failedSamples.length === 1 ? '' : 's'} (${failedSamples.slice(0, 3).join(', ')}${failedSamples.length > 3 ? '…' : ''}) went through without it.`
    : '';
  const who = c.owner ? `${c.owner} applying` : 'someone applying';
  return {
    text: `The control relies on ${who} ${quote(first.description)} every time, and nothing stops the step being skipped.${items}${noted ? ` The notes on the failed items say: ${quote(noted)}.` : ''}${again}`,
    reason: `from the failed attribute ${first.code}${failedSamples.length ? ` and the items it failed on` : ''}${noted ? ', with the notes against them' : ''}`,
  };
}

/** The named person the baton actually sits with, and what they are doing with
 *  it — "the auditor" is a role, and a role cannot be chased for an answer. */
export function exceptionCourtDetail(d: Deficiency, eng: IcfrEngagement): { who: string; doing: string } {
  const court = courtForException(d);
  const who = court === 'auditor' ? eng.preparer : court === 'reviewer' ? eng.reviewer : d.remediation.owner;
  const doing =
    d.status === 'Identified' ? (rootCauseReady(d) ? 'sizing it' : d.rootCause.trim() ? 'checking Ira\'s root cause' : 'writing the root cause')
    : d.status === 'Rating review' ? 'confirming the rating before any fix starts'
    : d.status === 'Planning' ? (d.planReview?.decision === 'Rejected' ? 'rewriting the plan' : 'writing the plan')
    : d.status === 'Plan review' ? 'checking the plan against the root cause'
    : d.status === 'Remediation' ? 'implementing the fix and attaching evidence'
    : d.status === 'Retest' ? (d.track === 'design' ? 're-checking the failed design checks against the fix' : 'retesting on a post-fix sample')
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

/** The design checks a TOD retest re-checks — the ones whose failure raised the
 *  exception, never a list written for the retest. First answer wins:
 *    · a round already started or run — every round re-checks the same list;
 *    · the list stamped on the exception when it was raised;
 *    · the control's design checks reading Fail now — for an exception raised
 *      before the stamp existed;
 *    · every design check on the control — a design exception that never isolated
 *      a failing check (never evidenced) has nothing narrower to re-check. */
export function designRetestChecks(d: Deficiency, c: Control | undefined): { pointId: string; text: string }[] {
  const run = d.retestDraft?.checks ?? d.retests?.find(r => r.checks?.length)?.checks;
  if (run?.length) return run.map(x => ({ pointId: x.pointId, text: x.text }));
  if (d.failedChecks?.length) return d.failedChecks;
  const points = c?.design.points ?? [];
  const failing = points.filter(p => pointResult(p) === 'Fail');
  return (failing.length ? failing : points).map(p => ({ pointId: p.id, text: p.text }));
}

// ─── Ground-rules change preview ──────────────────────────────────────────────────
// What would re-grade if the materiality rule set changed? Used by the review
// modal before applying, and by the store to record the actual re-grades.
// Aggregation belongs in the patch even though it is not a threshold: switching
// it off re-runs rule 6 against a standalone magnitude, so a material weakness
// that was only material because it combined falls back to significant. That is
// a re-grade downwards, and it has to be seen before it happens.
export interface RulesPatch { materiality?: number; performanceMateriality?: number; clearlyTrivial?: number; sdBandPct?: number; aggregate?: boolean }
export function previewRegrades(eng: IcfrEngagement, patch: RulesPatch): { defId: string; from: ExceptionGrade; to: ExceptionGrade }[] {
  const next: IcfrEngagement = {
    ...eng,
    materiality: patch.materiality ?? eng.materiality,
    performanceMateriality: patch.performanceMateriality ?? eng.performanceMateriality,
    rules: { ...eng.rules, clearlyTrivial: patch.clearlyTrivial ?? eng.rules.clearlyTrivial, sdBandPct: patch.sdBandPct ?? eng.rules.sdBandPct, aggregate: patch.aggregate ?? eng.rules.aggregate },
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

// ─── The files a population stands on ────────────────────────────────────────────
/** Every source file behind this control's population, oldest first.
 *
 *  A control may stand on several (dev call, Aug 2026 — "मल्टीपल फाइल्स वो डाल
 *  सकता है"), and everything downstream reads them through here rather than off
 *  `population.sources` directly. A population drawn before that was possible
 *  has no `sources` array at all, and is presented as the one file it always
 *  was — so a seeded control, a control extracted last week and a control built
 *  out of four quarterly files all read the same way, and no caller has to ask
 *  which kind it is holding.
 *
 *  The synthesised id is stable (`src-legacy`) rather than generated: checks and
 *  drawn items are tagged with it, and an id that changed on every render would
 *  untag them. */
export function populationSources(c: Control): PopulationSource[] {
  const pop = c.operating.population;
  if (!pop) return [];
  if (pop.sources?.length) return pop.sources;
  return [{
    id: LEGACY_SOURCE_ID,
    file: pop.sourceFile ?? pop.source,
    rows: pop.sourceCount ?? pop.count,
    count: pop.count,
    criteria: pop.criteria,
    draw: c.operating.sampling
      ? { size: c.operating.sampling.size, method: c.operating.sampling.method, seed: c.operating.sampling.seed ?? 0 }
      : undefined,
  }];
}
export const LEGACY_SOURCE_ID = 'src-legacy';

/** The checks proving one file. An untagged check belongs to the one file a
 *  single-source population has — which is what every check written before this
 *  existed is. */
export function ipeChecksFor(c: Control, sourceId: string): IpeCheck[] {
  const checks = c.operating.ipe?.checks ?? [];
  return checks.filter(k => (k.sourceId ?? LEGACY_SOURCE_ID) === sourceId);
}

/** The items drawn out of one file. Tagged the same way, for the same reason. */
export function samplesFor(c: Control, sourceId: string): Sample[] {
  const samples = c.operating.sampling?.samples ?? [];
  return samples.filter(s => (s.sourceId ?? LEGACY_SOURCE_ID) === sourceId);
}

/** Is this file the thing being tested, or a table joined onto it? */
export const isAssisting = (s: PopulationSource): boolean => s.role === 'assisting';

/** The files the control is actually tested on. Assisting tables are read by the
 *  workflow and proven like anything else, but nothing is drawn from them. */
export const sampledSources = (sources: PopulationSource[]): PopulationSource[] => sources.filter(s => !isAssisting(s));

/** The totals the control-level record carries — recomputed from the files
 *  rather than incremented, so adding, re-filtering and withdrawing a file all
 *  land on the same arithmetic and none of them can drift.
 *
 *  Assisting files are left out of both numbers. A vendor master's rows are not
 *  instances of the control, and adding them to the population count would
 *  inflate the very figure the sample size is judged against. */
export function sourceTotals(sources: PopulationSource[]): { count: number; rows: number } {
  return sampledSources(sources).reduce((a, s) => ({ count: a.count + s.count, rows: a.rows + s.rows }), { count: 0, rows: 0 });
}

// ─── A shared control's reach ────────────────────────────────────────────────────
// One control run centrally for several companies concludes once, and that
// conclusion carries to all of them — so the sample has to actually reach each
// one. A company with nothing drawn has had nothing tested, however healthy the
// overall sample size looks, and saying it is covered would be saying more than
// the work supports. Same shape as the per-file rule the population already
// follows: every source gets its own draw, and here every company gets its own
// items.
export function isShared(c: Control): boolean {
  return (c.entities?.length ?? 0) > 1;
}
export interface EntityCoverage {
  entity: string;
  drawn: number;
  failed: number;
}
/** Per company: how many items were drawn for it, and how many of those failed.
 *  Ordered as the control names them, so the list reads the same every time. */
export function entityCoverage(c: Control): EntityCoverage[] {
  const items = c.operating.sampling?.samples ?? [];
  return (c.entities ?? []).map(entity => {
    const mine = items.filter(s => s.entity === entity);
    return { entity, drawn: mine.length, failed: mine.filter(s => s.result === 'Fail').length };
  });
}
/** The companies the conclusion would cover without a single item behind them. */
export function uncoveredEntities(c: Control): string[] {
  return entityCoverage(c).filter(e => e.drawn === 0).map(e => e.entity);
}
/** What a register row prints in its entity cell.
 *
 *  A row answering for one company names it. A row answering for several names
 *  the first and counts the rest — "Altura Infra Holdings Ltd +3" — because a
 *  column of identical "Shared — covers 4 companies" labels says nothing about
 *  WHICH companies, which is the only thing the reader wants from it. `more` is
 *  rendered outside the truncating span so a narrow column can eat the name
 *  without ever eating the count. The full list rides the title. */
export function entityCell(c: Control): { label: string; more: number; title: string } | null {
  const covers = c.entities ?? [];
  if (covers.length > 1) {
    const first = c.entity && covers.includes(c.entity) ? c.entity : covers[0]!;
    return { label: first, more: covers.length - 1, title: covers.join(' · ') };
  }
  return c.entity ? { label: c.entity, more: 0, title: c.entity } : null;
}

// ─── A multi-path control's reach ────────────────────────────────────────────────
// Some controls have more than one way through them — a payment released by hand
// vs auto-released under a threshold — and a draw that never landed on the second
// route has not tested the second route, however healthy its size. Same rule as
// the companies above, along a different axis: every route needs its own items.
export function hasPaths(c: Control): boolean {
  return (c.paths?.length ?? 0) > 1;
}
/** Per route: how many drawn items went down it. Ordered as the control names
 *  them, so the list reads the same every time. */
export function pathCoverage(c: Control): { path: string; drawn: number }[] {
  const items = c.operating.sampling?.samples ?? [];
  return (c.paths ?? []).map(path => ({ path, drawn: items.filter(s => s.path === path).length }));
}
/** The routes the conclusion would cover without a single item having gone
 *  down them. Empty until something is drawn — an undrawn control has no draw
 *  to accuse of missing anything. */
export function untouchedPaths(c: Control): string[] {
  if (!(c.operating.sampling?.samples.length)) return [];
  return pathCoverage(c).filter(p => p.drawn === 0).map(p => p.path);
}

// ─── The audit's sampling methodology (A28) ──────────────────────────────────────
// How items are selected, and what they have to be spread across, is agreed once
// on the audit (feedback #38; Dubai — "an agreed sampling methodology covering
// quarters, countries and entities"). A control asks how many, and from which
// months — in words, per file (see readSamplePrompt), never how. What follows
// turns that agreement into a draw — which quarter each item falls in, which
// company it is dealt to — and reads the draw back as the split the Sample step
// prints, and as the year's running total of items tested.

type AuditWindow = Pick<AuditRecord, 'windowFrom' | 'windowTo' | 'yearBasis'>;

/** The audit a control is being worked under: the one that is open, else the
 *  live cycle (newest unarchived) — the only record whose results sit on the
 *  controls. */
export function workingAudit(eng: Pick<IcfrEngagement, 'audits'>, openAuditId: string | null): AuditRecord | undefined {
  return eng.audits.find(a => a.id === openAuditId) ?? eng.audits.find(a => !a.archive);
}
/** The audit's methodology, with the default standing in for a record older than it. */
export const auditSampling = (a?: AuditRecord): AuditSampling => a?.sampling ?? DEFAULT_AUDIT_SAMPLING;

/** "spread by quarter and entity", or "not spread" — named in the wizard's order. */
export function spreadPhrase(spread: AuditSampleSpread[]): string {
  const words = AUDIT_SAMPLE_SPREADS.map(s => s.id).filter(id => spread.includes(id));
  if (!words.length) return 'not spread';
  return `spread by ${words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0]}`;
}

// Whole days since the epoch, in UTC so no clock change can move a date by one.
const DAY_MS = 86_400_000;
const dayOf = (iso: string): number => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y!, m! - 1, d!) / DAY_MS); };
const isoOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
/** Where an item without an audit to date it falls — the demo's own FY26. */
const FALLBACK_WINDOW = { windowFrom: '2025-04-01', windowTo: '2026-03-31' };

/** The quarters an audit's window touches, each clipped to the window. Q1 opens
 *  the year the audit runs on — April for an April–March year, January for the
 *  rest. A window long enough to meet the same quarter twice names the year. */
export function auditQuarters(a: AuditWindow): { label: string; from: string; to: string }[] {
  const from = dayOf(a.windowFrom), to = dayOf(a.windowTo);
  if (!(from <= to)) return [];
  const opens = a.yearBasis === 'fy' ? 3 : 0;
  const [y0, m0] = a.windowFrom.split('-').map(Number);
  let y = y0!, m = m0! - 1 - (((m0! - 1 - opens) % 3) + 3) % 3;
  if (m < 0) { m += 12; y -= 1; }
  const out: { label: string; from: string; to: string; year: number }[] = [];
  for (let guard = 0; guard < 40; guard++) {
    const qFrom = Math.round(Date.UTC(y, m, 1) / DAY_MS);
    if (qFrom > to) break;
    const ny = m + 3 >= 12 ? y + 1 : y, nm = (m + 3) % 12;
    const qTo = Math.round(Date.UTC(ny, nm, 1) / DAY_MS) - 1;
    out.push({ label: `Q${Math.floor((((m - opens) % 12) + 12) % 12 / 3) + 1}`, from: isoOf(Math.max(qFrom, from)), to: isoOf(Math.min(qTo, to)), year: y });
    y = ny; m = nm;
  }
  const repeats = new Set(out.map(q => q.label)).size < out.length;
  return out.map(q => ({ label: repeats ? `${q.label} ${q.year}` : q.label, from: q.from, to: q.to }));
}

/** When an item happened. A draw made under the audit's methodology stored the
 *  date it dealt; an older item gets a stable one off its own id, somewhere in
 *  `home` — the round that drew it (sampleHome) — so the date on its row, the
 *  quarter it counts in and the round it counts toward all agree. Never the open
 *  audit's window: a date is a fact about the item, and opening the roll-forward
 *  must not move it. */
export function sampleDate(s: Sample, home?: Pick<AuditRecord, 'windowFrom' | 'windowTo'>): string {
  if (s.date) return s.date;
  const w = home ?? FALLBACK_WINDOW;
  const from = dayOf(w.windowFrom), span = Math.max(1, dayOf(w.windowTo) - from + 1);
  return isoOf(from + (hnum(`${s.id}·${s.ref}`) % span));
}

/** The round an undated item was drawn in. Items without a date sat on the
 *  control before draws stored one, so they are the live cycle's — and inside
 *  its year, the earliest audit that covers the control: the interim, where
 *  there is one, since a roll-forward only adds to what the interim drew. The
 *  open audit plays no part, so the answer is the same from either round. */
export function sampleHome(eng: Pick<IcfrEngagement, 'audits'>, covers: (a: AuditRecord) => boolean): AuditRecord | undefined {
  const live = eng.audits.find(a => !a.archive);
  if (!live) return undefined;
  return eng.audits
    .filter(a => a.yearBasis === live.yearBasis && a.fiscalYear === live.fiscalYear && covers(a))
    .sort((x, y) => x.windowFrom.localeCompare(y.windowFrom))[0] ?? live;
}

// ─── What a population is worth (S9, A32) ────────────────────────────────────────
// The prototype holds no file bytes, so a population's instances are a model —
// but ONE model. The preview's rows, a drawn item's amount and the exposure worked
// out from the data all read it, so no two screens can price the same item two
// ways. Deterministic off the control id: a population that reshaped itself
// between renders would disagree with the paper it produced.
//
// Dates follow the population's own monthly shape (monthlyBreakdown), so the
// months the Population step prints and the instances a failure window counts
// are the same fact — a dead tail holds nothing here either. Amounts sit around a
// typical figure the control is given off its id, skewed the way transaction
// values are: most of them small, a few of them large.

/** Uniform in [0, 1) off a seed and an index — one mulberry32 step. `hnum` on
 *  its own will not do: consecutive indices hash to consecutive numbers. */
function mix(seed: number, n: number): number {
  let t = (seed + Math.imul(n + 1, 0x6d2b79f5)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
type ModelWindow = Pick<AuditRecord, 'windowFrom' | 'windowTo'>;
interface PopulationModel {
  /** One epoch day per instance, in date order. */
  days: number[];
  seed: number;
  /** The control's typical instance, ₹ — between ₹20K and ₹1.5L. */
  typical: number;
}
export interface PopulationInstance { ref: string; date: string; amount: number }

// A control is replaced, never mutated, whenever anything on it moves — so the
// object is a safe cache key, and a list of twenty-five sample rows lays the
// population out once rather than twenty-five times.
const MODELS = new WeakMap<Control, Map<string, PopulationModel>>();

/** `fallback` places a population whose filter carries no dates — the round
 *  that drew it, else the audit. */
function populationModel(c: Control, fallback?: ModelWindow): PopulationModel {
  const w = fallback ?? FALLBACK_WINDOW;
  const key = `${w.windowFrom}·${w.windowTo}`;
  const cached = MODELS.get(c)?.get(key);
  if (cached) return cached;
  const pop = c.operating.population;
  const count = Math.max(0, pop?.count ?? 0);
  const seed = hnum(`${seedKeyOf(c)}·population`);
  const typical = Math.round((20_000 + mix(hnum(`${seedKeyOf(c)}·typical`), 0) * 130_000) / 1000) * 1000;
  const days: number[] = [];
  // n instances inside [lo, hi], stepping evenly with a jitter under one step, so
  // the days only ever go forward and the list needs no sort.
  const lay = (lo: number, hi: number, n: number) => {
    const span = Math.max(1, hi - lo + 1);
    for (let j = 0; j < n; j++) days.push(lo + Math.min(span - 1, Math.floor(((j + mix(seed ^ 0x5bd1e995, days.length)) * span) / n)));
  };
  const pf = pop?.filterFrom && ISO_DAY.test(pop.filterFrom) ? dayOf(pop.filterFrom) : NaN;
  const pt = pop?.filterTo && ISO_DAY.test(pop.filterTo) ? dayOf(pop.filterTo) : NaN;
  const months = count > 0 && pf <= pt ? monthlyBreakdown(c) : [];
  months.forEach(m => {
    const [y, mo] = m.key.split('-').map(Number);
    const lo = Math.max(pf, Math.round(Date.UTC(y!, mo! - 1, 1) / DAY_MS));
    const hi = Math.min(pt, Math.round(Date.UTC(y!, mo!, 1) / DAY_MS) - 1);
    if (m.n > 0 && lo <= hi) lay(lo, hi, m.n);
  });
  // No monthly shape to follow (or one that would not place every instance):
  // spread the whole count across the filter window, else the fallback's.
  if (days.length !== count) {
    days.length = 0;
    const lo = pf <= pt ? pf : dayOf(w.windowFrom), hi = pf <= pt ? pt : dayOf(w.windowTo);
    if (lo <= hi) lay(lo, hi, count);
  }
  const model = { days, seed, typical };
  const byWindow = MODELS.get(c) ?? new Map<string, PopulationModel>();
  byWindow.set(key, model);
  MODELS.set(c, byWindow);
  return model;
}
/** 0.2× to 2.6× the typical figure, cubed so most instances sit low. */
const instanceAmount = (m: PopulationModel, k: number): number =>
  Math.round(m.typical * (0.2 + 2.4 * mix(m.seed, k) ** 3));
/** The first index whose day is on or after `day`. */
const firstOnOrAfter = (days: number[], day: number): number => {
  let lo = 0, hi = days.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (days[mid]! < day) lo = mid + 1; else hi = mid; }
  return lo;
};

/** The population's first `n` instances, in date order — what the preview lists. */
export function populationInstances(c: Control, n: number, fallback?: ModelWindow): PopulationInstance[] {
  const m = populationModel(c, fallback);
  return m.days.slice(0, Math.max(0, n)).map((day, k) => ({ ref: `${seedKeyOf(c)}-${String(k + 1).padStart(5, '0')}`, date: isoOf(day), amount: instanceAmount(m, k) }));
}

/** How many instances fall between two ISO dates, both inclusive, and their total. */
export function populationValue(c: Control, from: string, to: string, fallback?: ModelWindow): { count: number; value: number } {
  const m = populationModel(c, fallback);
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return { count: 0, value: 0 };
  const lo = firstOnOrAfter(m.days, dayOf(from)), hi = firstOnOrAfter(m.days, dayOf(to) + 1);
  let value = 0;
  for (let k = lo; k < hi; k++) value += instanceAmount(m, k);
  return { count: Math.max(0, hi - lo), value };
}

/** A drawn item's amount: the amount of the population instance it IS — one that
 *  happened on the item's date, picked by its reference, else the nearest one to
 *  that date. An item with no population behind it takes a figure off the same
 *  curve, so the column still reads like this control's work. */
export function sampleAmount(c: Control, ref: string, date: string | undefined, fallback?: ModelWindow): number {
  const m = populationModel(c, fallback);
  const h = hnum(ref);
  const n = m.days.length;
  if (!n || !date || !ISO_DAY.test(date)) return instanceAmount(m, n + (h % 100_000));
  const day = dayOf(date);
  const lo = firstOnOrAfter(m.days, day), hi = firstOnOrAfter(m.days, day + 1);
  if (hi > lo) return instanceAmount(m, lo + (h % (hi - lo)));
  const k = lo >= n ? n - 1 : lo === 0 ? 0 : m.days[lo]! - day <= day - m.days[lo - 1]! ? lo : lo - 1;
  return instanceAmount(m, k);
}

// ─── Exposure, worked out from the data (S9, A32) ────────────────────────────────
// Value at risk: what could have gone through the control while it was broken.
// For an operating failure that is every population instance from the first
// failed item to the fix — the remediation's done date, else the end of the
// audit, since nothing inside the window says it stopped. A design failure was
// built wrong from the day the period opened, so it has no first failure to
// count from; nor does a control with no population to count. Both take the
// whole audit period, priced off the trial balance: the material accounts mapped
// to the control's process. Either way the figure is offered, never forced — the
// auditor uses it or types their own.
import type { TbCaption } from '../audit/sox-testing/soxTestingData';

/** What the working needs from outside the engagement record. The store and the
 *  sizing form each build one; helpers stays clear of the scope module. */
export interface ExposureContext {
  /** The audit it is sized under — open, else the live cycle (workingAudit). */
  audit?: AuditRecord;
  /** The round that drew the control's undated items (sampleHome). */
  home?: ModelWindow;
  /** The group's trial balance (captionsFor). Balances are ₹ Cr. */
  captions: TbCaption[];
  /** The register's spelling of a process (normaliseProcess). */
  normalise: (process: string) => string;
  /** A company's name from its register id. */
  entityName: (entityId: string) => string;
}
export interface ExposureAccount { id: string; caption: string; entity: string; /** ₹ */ balance: number }
export type DataExposure =
  | {
    kind: 'population'; value: number; count: number; population: number; from: string; to: string;
    /** The earliest failed item, when one could be dated. Absent → `from` is the audit's start. */
    firstFailed?: { ref: string; date: string };
    /** `to` is the fix, not the end of the audit. */
    fixed: boolean;
  }
  | {
    kind: 'trial-balance'; value: number; from: string; to: string;
    why: 'design' | 'no-population'; process: string;
    /** Empty when no material account maps to the process — there is nothing to total. */
    accounts: ExposureAccount[];
  }
  | { kind: 'no-audit' };

/** 'YYYY-MM-DD' off a date string as it is written — ISO, '30 Jun 2026' or '30 Jun'. */
const looseIso = (s: string | null | undefined): string | undefined => {
  const d = parseLooseDate(s);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined;
};

export function exposureFromData(d: Deficiency, eng: IcfrEngagement, x: ExposureContext): DataExposure {
  const a = x.audit;
  const c = eng.controls.find(k => k.id === d.controlId);
  if (!a || !c) return { kind: 'no-audit' };
  const pop = c.operating.population;
  if (d.track === 'operating' && pop && pop.count > 0) {
    const failed = new Set(d.failedSamples ?? []);
    const firstFailed = (c.operating.sampling?.samples ?? [])
      .filter(s => failed.has(s.ref))
      .map(s => ({ ref: s.ref, date: sampleDate(s, x.home) }))
      .sort((p, q) => p.date.localeCompare(q.date))[0];
    // A fix dated after the audit closed ends nothing inside it.
    const fix = d.remediation.status === 'Done' ? looseIso(d.remediation.date) : undefined;
    const fixed = !!fix && fix <= a.windowTo;
    const from = firstFailed?.date ?? a.windowFrom;
    const to = fixed ? fix! : a.windowTo;
    const { count, value } = populationValue(c, from, to, x.home ?? a);
    return { kind: 'population', value, count, population: pop.count, from, to, firstFailed, fixed };
  }
  // The audit's own ruler decides what is material — the one its mapping was made
  // against — and the mapping wins wherever one was made (S10, A34a).
  const process = x.normalise(c.process);
  const pmCr = a.overall > 0 ? (a.overall * (a.materiality.pmPct ?? 75)) / 100 : eng.performanceMateriality / 1e7;
  const mapped = a.accountProcesses
    ? x.captions.filter(k => a.accountProcesses![k.id] !== undefined && x.normalise(a.accountProcesses![k.id]!) === process)
    : x.captions.filter(k => k.balance >= pmCr && x.normalise(k.process) === process);
  const accounts = mapped
    .map(k => ({ id: k.id, caption: k.caption, entity: x.entityName(k.entityId), balance: Math.round(k.balance * 1e7) }))
    .sort((p, q) => q.balance - p.balance);
  return {
    kind: 'trial-balance', value: accounts.reduce((s, k) => s + k.balance, 0), from: a.windowFrom, to: a.windowTo,
    why: d.track === 'design' ? 'design' : 'no-population', process, accounts,
  };
}

// ─── Ira's first sizing (S9, A31) ────────────────────────────────────────────────
// Pre-filled when an exception is raised, tagged with why, and the auditor's to
// change — no accept click, and the grade computes off it straight away.
//
//  Likelihood — Probable when the failure is not a one-off: a design failure (it
//    fails every time the control runs), a control never evidenced at all, a
//    failure on the redrawn sample, or 1 failed item in 10 tested or worse.
//    Reasonably possible below that. NEVER Remote: Remote caps the grade at a
//    deficiency, and arguing a grade down is the auditor's call to make, not a
//    default to accept by not looking.
//  Exposure — the figure worked out from the data above. Left at ₹0 and untagged
//    when there is nothing to work it out from.
//  Compensating control — another control concluded effective on the same risk,
//    else in the same process; the first in register order. None qualifying is
//    still an answer, and is tagged as one.
export interface SizingSuggestion {
  likelihood: Likelihood;
  magnitude: number;
  compensatingControlId?: string;
  iraSuggested: NonNullable<Deficiency['iraSuggested']>;
}

export function suggestSizing(d: Deficiency, eng: IcfrEngagement, x: ExposureContext, secondRound = false): SizingSuggestion {
  const c = eng.controls.find(k => k.id === d.controlId);
  const tag: NonNullable<Deficiency['iraSuggested']> = {};

  let likelihood: Likelihood = 'Reasonably possible';
  const f = d.failedSamples?.length ?? 0;
  const n = Math.max(f, c ? samplesTestedCount(c) : 0);
  const pct = n ? Math.round((f / n) * 100) : 0;
  if (d.unableToTestReason) {
    likelihood = 'Probable';
    tag.likelihood = 'never evidenced — nothing shows the control ran at all';
  } else if (d.track === 'design') {
    likelihood = 'Probable';
    tag.likelihood = 'design failure — built wrong, so it fails every time it runs';
  } else if (secondRound) {
    likelihood = 'Probable';
    tag.likelihood = f ? `failed again on the redrawn sample — ${f} of ${n} items` : 'failed again on the redrawn sample';
  } else if (!f) {
    tag.likelihood = 'concluded ineffective with no failed item to read a rate from';
  } else if (f * 10 >= n) {
    likelihood = 'Probable';
    tag.likelihood = `${f} of ${n} items failed (${pct}%) — 1 in 10 or more, a pattern`;
  } else {
    tag.likelihood = `${f} of ${n} items failed (${pct}%) — under 1 in 10, no pattern`;
  }

  let magnitude = 0;
  const ex = exposureFromData(d, eng, x);
  if (ex.kind === 'population' && ex.value > 0) {
    magnitude = ex.value;
    tag.magnitude = ex.firstFailed
      ? `value at risk from the first failed item to the ${ex.fixed ? 'fix' : 'end of the audit'}, see working`
      : 'value at risk across the whole audit — no failed item to date it from, see working';
  } else if (ex.kind === 'trial-balance' && ex.value > 0) {
    magnitude = ex.value;
    tag.magnitude = 'whole period from the trial balance, see working';
  }

  let compensatingControlId: string | undefined;
  if (c) {
    const effective = eng.controls.filter(k => k.id !== c.id && controlConclusion(k) === 'Effective');
    const sameRisk = c.riskId ? effective.find(k => k.riskId === c.riskId) : undefined;
    const sameProcess = sameRisk ? undefined : effective.find(k => x.normalise(k.process) === x.normalise(c.process));
    compensatingControlId = (sameRisk ?? sameProcess)?.id;
    tag.compensatingControlId = sameRisk ? `${sameRisk.id} is concluded effective on the same risk, ${c.riskId}`
      : sameProcess ? `${sameProcess.id} is concluded effective in the same process, ${x.normalise(c.process)}`
      : 'none — no control on the same risk or process is concluded effective';
  }

  return { likelihood, magnitude, compensatingControlId, iraSuggested: tag };
}

/** The companies a draw deals among. Only a shared control deals: a row that
 *  answers for one company owns every item by construction (see Sample.entity). */
const dealtCompanies = (c: Control): string[] => ((c.entities?.length ?? 0) > 1 ? c.entities! : []);
/** Every company the control has to reach, shared or not. */
const reachedCompanies = (c: Control): string[] => ((c.entities?.length ?? 0) > 1 ? c.entities! : c.entity ? [c.entity] : []);
/** The first of `xs` holding the fewest — ties go to the earlier one, so an even
 *  deal runs in the order the groups are listed. */
const fewest = <T,>(xs: T[], n: (x: T) => number): T => xs.reduce((best, x) => (n(x) < n(best) ? x : best));

export interface DealtItem { date: string; entity?: string }

/**
 * Where each new item falls. `existing` is what already sits in the sample and
 * stays, so an extension fills the groups a draw left short before it evens out
 * anything else.
 *
 *   quarter — each item goes to the quarter of the audit window holding fewest,
 *             so 25 across a full year lands 7 · 6 · 6 · 6.
 *   country — each item goes to a company in the country holding fewest, so
 *             every country is reached before any is doubled up.
 *   entity  — each company gets one before any gets two. A shared control has
 *             always been dealt this way (the coverage strip reads it), so it
 *             still is whatever the audit asked for.
 *
 * Then the date inside whichever stretch the item landed in: evenly spaced for a
 * systematic draw, anywhere for a random or targeted one. Deterministic — the
 * Sample step previews a draw with this and the store files it with this, so the
 * rows the auditor approved are the rows that land.
 *
 * `a` is the stretch to deal inside: the audit's window, or the narrower months
 * a file's ask named (readSamplePrompt). `home` dates the existing items that
 * carry no date of their own (sampleHome).
 */
export function dealSample(
  c: Control, a: AuditWindow | undefined, sampling: AuditSampling, count: number, existing: Sample[], key: string,
  countryOf: (entity: string) => string | undefined, home: Pick<AuditRecord, 'windowFrom' | 'windowTo'> | undefined,
): DealtItem[] {
  const spread = sampling.spread;
  const companies = dealtCompanies(c);
  const perCompany = new Map(companies.map(e => [e, existing.filter(s => s.entity === e).length]));
  const countryKey = (e: string) => countryOf(e) ?? '';
  const perCountry = new Map<string, number>();
  companies.forEach(e => perCountry.set(countryKey(e), (perCountry.get(countryKey(e)) ?? 0) + perCompany.get(e)!));
  const w = a ?? { ...FALLBACK_WINDOW, yearBasis: 'fy' as const };
  const quarters = spread.includes('quarter') ? auditQuarters(w) : [];
  const perQuarter = quarters.map(q => existing.filter(s => { const d = sampleDate(s, home); return d >= q.from && d <= q.to; }).length);

  // First pass — which company and which stretch of the window each item takes.
  const slots = Array.from({ length: count }, () => {
    let entity: string | undefined;
    if (companies.length) {
      const pool = spread.includes('country')
        ? companies.filter(e => countryKey(e) === fewest([...perCountry.keys()], k => perCountry.get(k)!))
        : companies;
      entity = fewest(pool, e => perCompany.get(e)!);
      perCompany.set(entity, perCompany.get(entity)! + 1);
      perCountry.set(countryKey(entity), perCountry.get(countryKey(entity))! + 1);
    }
    const q = quarters.length ? fewest(quarters.map((_, k) => k), k => perQuarter[k]!) : -1;
    if (q >= 0) perQuarter[q] = perQuarter[q]! + 1;
    return { entity, q };
  });

  // Second pass — the day. A systematic draw steps evenly through its stretch,
  // so it needs to know how many items share it before it can space them.
  const inStretch = new Map<number, number>();
  const seen = new Map<number, number>();
  slots.forEach(s => inStretch.set(s.q, (inStretch.get(s.q) ?? 0) + 1));
  return slots.map((s, i) => {
    const lo = dayOf(s.q >= 0 ? quarters[s.q]!.from : w.windowFrom);
    const span = Math.max(1, dayOf(s.q >= 0 ? quarters[s.q]!.to : w.windowTo) - lo + 1);
    const j = seen.get(s.q) ?? 0;
    seen.set(s.q, j + 1);
    const offset = sampling.method === 'Systematic'
      ? Math.floor(((j + 0.5) * span) / inStretch.get(s.q)!)
      : hnum(`${key}·${existing.length + i}`) % span;
    return { date: isoOf(lo + Math.min(span - 1, offset)), ...(s.entity ? { entity: s.entity } : {}) };
  });
}

/** Label for the companies a register left without a country. Listed, so the
 *  gap shows, but never flagged as a group the draw missed — it isn't one. */
export const NO_COUNTRY = 'Country not recorded';
export interface SampleSplit { axis: AuditSampleSpread; groups: { label: string; n: number }[] }
/**
 * The draw read back along each axis the audit spreads by. The groups come from
 * what the control has to reach — the quarters of the window, the companies it
 * answers for, their countries — not from what happened to be drawn, so a group
 * with nothing in it is listed at 0. That is the point of listing it.
 */
export function sampleSplit(
  c: Control, a: AuditWindow | undefined, sampling: AuditSampling, countryOf: (entity: string) => string | undefined,
  home: Pick<AuditRecord, 'windowFrom' | 'windowTo'> | undefined,
): SampleSplit[] {
  const items = c.operating.sampling?.samples ?? [];
  const companies = reachedCompanies(c);
  // A row answering for one company owns its items without tagging them.
  const companyOf = (s: Sample) => s.entity ?? (companies.length === 1 ? companies[0] : undefined);
  const countryKey = (e: string) => countryOf(e) ?? NO_COUNTRY;
  return AUDIT_SAMPLE_SPREADS.map(x => x.id).filter(axis => sampling.spread.includes(axis)).map(axis => {
    if (axis === 'quarter') {
      const w = a ?? { ...FALLBACK_WINDOW, yearBasis: 'fy' as const };
      return { axis, groups: auditQuarters(w).map(q => ({ label: q.label, n: items.filter(s => { const d = sampleDate(s, home); return d >= q.from && d <= q.to; }).length })) };
    }
    if (axis === 'entity') return { axis, groups: companies.map(e => ({ label: e, n: items.filter(s => companyOf(s) === e).length })) };
    const countries = Array.from(new Set(companies.map(countryKey)));
    return { axis, groups: countries.map(k => ({ label: k, n: items.filter(s => { const e = companyOf(s); return !!e && countryKey(e) === k; }).length })) };
  });
}

/** Has a result been recorded against this item? Against an attribute — how the
 *  TOE grid records — or on the item itself, which is where items tested before
 *  that grid carry theirs. */
export function sampleTested(c: Control, s: Sample): boolean {
  return s.result !== 'Not tested'
    || c.operating.steps.some(st => { const r = st.sampleResults?.[s.id]; return !!r && r !== 'Not tested'; });
}
export const samplesTestedCount = (c: Control): number =>
  (c.operating.sampling?.samples ?? []).filter(s => sampleTested(c, s)).length;

export interface YearRound { audit: AuditRecord; tested: number; current: boolean }
/**
 * A control's samples tested so far this year, audit by audit (#38 — "no
 * mechanism to track the cumulative number of samples tested throughout the
 * year for each control").
 *
 * The year is the working audit's: same fiscal year, same basis, and only the
 * audits that cover this control. Each tested item counts toward the round whose
 * window its date falls in — whichever audit is open, because both rounds of a
 * year read the same live control, and an item tested in the interim is the
 * interim's even while the roll-forward is open. An item dated between two
 * rounds' windows counts toward the nearer; one dated outside the year is
 * another year's and is not counted here.
 *
 * A round with nothing of its own left on the control — the next cycle reset it
 * — reads the count it froze when that happened (createAudit). A round with
 * neither reads 0: nothing was tested in it that the page can see.
 */
export function yearSampleRounds(
  eng: Pick<IcfrEngagement, 'audits'>, c: Control, current: AuditRecord | undefined,
  covers: (a: AuditRecord) => boolean,
): YearRound[] {
  if (!current) return [];
  const year = eng.audits
    .filter(a => a.yearBasis === current.yearBasis && a.fiscalYear === current.fiscalYear && (a.id === current.id || covers(a)))
    .sort((x, y) => x.windowFrom.localeCompare(y.windowFrom));
  // The days the year runs: calendar, or April to March (fiscalYear is the year
  // it ends on), stretched to take in any window that runs past it. A quarter or
  // custom check has no named year, so its audits' own windows bound it.
  const fy = current.fiscalYear;
  const bounds = current.yearBasis === 'cy' ? [dayOf(`${fy}-01-01`), dayOf(`${fy}-12-31`)]
    : current.yearBasis === 'fy' ? [dayOf(`${fy - 1}-04-01`), dayOf(`${fy}-03-31`)]
    : [];
  const yearFrom = Math.min(...bounds.slice(0, 1), ...year.map(a => dayOf(a.windowFrom)));
  const yearTo = Math.max(...bounds.slice(1), ...year.map(a => dayOf(a.windowTo)));
  const home = sampleHome(eng, covers);
  const live = year.map(() => 0);
  for (const s of c.operating.sampling?.samples ?? []) {
    if (!sampleTested(c, s)) continue;
    const d = dayOf(sampleDate(s, home));
    if (d < yearFrom || d > yearTo) continue;
    const gaps = year.map(a => Math.max(0, dayOf(a.windowFrom) - d, d - dayOf(a.windowTo)));
    const k = gaps.indexOf(Math.min(...gaps));
    live[k] = (live[k] ?? 0) + 1;
  }
  return year.map((a, i) => ({
    audit: a,
    tested: live[i] || (a.archive?.conclusions.find(v => v.controlId === c.id)?.samplesTested ?? 0),
    current: a.id === current.id,
  }));
}

/** A draw change puts every already-recorded run out of date — results that
 *  predate the sample were not testing these items. Flag them; the next run (or
 *  a fresh attestation) clears the flag, and the operating track refuses to
 *  conclude while one stands. A step with nothing recorded has nothing to go
 *  stale. */
export function staleSteps(steps: OperatingStep[]): OperatingStep[] {
  return steps.map(s => (s.validation || s.workflowRunRef ? { ...s, staleRun: true } : s));
}

// ─── Where the population's files come from ──────────────────────────────────────
// Not from browsing the platform. "फाइल्स वही आ रही है जो एट्रिब्यूट के अंदर
// वर्कफ्लो लिंक्ड है और वर्कफ्लो लिंकिंग में जो इनपुट फाइल्स हैं, वो सारी फाइल्स
// की लिस्ट" — the control's attributes each link a workflow, each workflow reads
// an input file, and those files ARE the population's sources. Picking anything
// else is picking a file no workflow will run on ("ऐड सोर्स नहीं होगा ना,
// वर्कफ्लो ही नहीं चलेगा").

/** One file the attributes' workflows read, and which attributes read it. */
export interface ExpectedInput {
  name: string;
  /** Attribute codes, so the reason the file is offered is on the screen rather
   *  than in someone's head. */
  attributes: string[];
  workflow?: string;
}

/** What this control's attributes expect, and what they are still waiting for.
 *
 *  `awaiting` is the honest other half: an attribute can have a workflow linked
 *  and no input file attached yet, and that is a thing somebody owes rather than
 *  a thing to hide. It is what the reminder to the owner is built on. */
export function expectedInputsFor(c: Control): { inputs: ExpectedInput[]; awaiting: { code: string; workflow?: string }[] } {
  const byName = new Map<string, ExpectedInput>();
  const awaiting: { code: string; workflow?: string }[] = [];
  for (const s of c.operating.steps) {
    // An attribute with no workflow and no validation reads nothing — it is
    // evidenced by inspection or attestation, and it expects no file.
    // Every attribute names the files its AI validation reads (requiredFilesOf).
    // The uploaded ones are inputs; any still missing is something owed.
    const files = requiredFilesOf(s, c);
    files.forEach(f => {
      if (!f.file) return;
      const hit = byName.get(f.file.name);
      if (hit) { if (!hit.attributes.includes(s.code)) hit.attributes.push(s.code); }
      else byName.set(f.file.name, { name: f.file.name, attributes: [s.code] });
    });
    if (files.some(f => !f.file)) awaiting.push({ code: s.code });
  }
  return { inputs: [...byName.values()], awaiting };
}

// ─── Asking for a sample in words ────────────────────────────────────────────────
// A number could not carry what a draw actually needs. "क्या 25 निकालना है, किस
// महीने का निकालना है, सब डिपेंड करता है उसपे" — testing whether every onboarded
// vendor has a PAN on file is twenty-five vendors off the master; finding
// duplicate invoices in a journal table is not something twenty-five rows can
// find at all, and the answer there is two months tested end to end. The
// selection unit itself changes, so the ask is written rather than picked, and
// each file is asked for separately: "प्रॉम्प्ट फॉलोज़, सैंपल फॉलोज़".
//
// The words decide two things: how many items, and which months — a stretch
// inside the audit's window. How the items are picked and what they are spread
// across was agreed on the audit (A28), so an ask that names another method is
// drawn the audit's way, and the reading says so rather than quietly ignoring it.

/** The months a stretch runs through — "Jan–Jun", or "Nov 2025–Feb 2026" when it
 *  crosses a year. */
function monthSpanLabel(from: string, to: string): string {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const name = (y: number, m: number) => `${MONTH_SHORT[m - 1]}${fy !== ty ? ` ${y}` : ''}`;
  return fy === ty && fm === tm ? name(fy!, fm!) : `${name(fy!, fm!)}–${name(ty!, tm!)}`;
}

/** What the application would ask for, before the auditor edits it. Drafted from
 *  the sizing table, the file and the audit's months, so the ordinary case is one
 *  read and a click and only the unusual one is typed. It names no method — that
 *  is the audit's. */
export function draftSamplePrompt(source: PopulationSource, suggested: number, a?: AuditWindow): string {
  const w = a ?? FALLBACK_WINDOW;
  return `Take ${suggested} of the ${source.count.toLocaleString()} instances in ${source.file}, from ${monthSpanLabel(w.windowFrom, w.windowTo).replace('–', ' to ')}.`;
}

/** How the ask was read. Stated back on screen before the draw runs, because a
 *  prompt nobody confirms the reading of is a prompt that quietly did something
 *  else — and the ask itself is printed on the paper. */
export interface SamplePlan {
  size: number;
  /** The months the ask narrowed the draw to, clipped to the audit's window.
   *  Absent when it named none, or named the whole window — the draw then runs
   *  across all of it. */
  months?: { from: string; to: string };
  /** One line, in the same plain English the ask was written in. */
  reading: string;
}

// "Q1", "H2", "second quarter", "first half", "March", "Nov 2025" — each a run of
// months. Groups: quarter number, half number, quarter word, half word, month.
const WHEN = /\b(?:q([1-4])|h([12])|(first|second|third|fourth|1st|2nd|3rd|4th)\s+quarter|(first|second|1st|2nd)\s+half|(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))(?:\s+(?:19|20)\d{2})?\b/g;
const ORDINAL: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, '1st': 1, '2nd': 2, '3rd': 3, '4th': 4 };
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, 'twenty-five': 25, thirty: 30, forty: 40, fifty: 50 };
const UNIT = '(?:items?|rows?|instances?|samples?|vendors?|invoices?|entries|entry|transactions?|payments?|journals?)';
const METHOD_WORDS: [RegExp, AuditSampling['method']][] = [
  [/\b(?:at\s+)?random(?:ly)?\b/, 'Random'],
  [/\bsystematic(?:ally)?\b|\bevery\s+(?:nth|\d+(?:st|nd|rd|th))\b|\bevenly\s+spaced\b/, 'Systematic'],
  [/\btarget(?:ed)?\b|\blargest\b|\bhighest\b|\bbiggest\b|\bjudge?ment(?:al)?\b/, 'Targeted'],
];

export function readSamplePrompt(
  prompt: string, source: PopulationSource, suggested: number, a: AuditWindow | undefined, sampling: AuditSampling,
): SamplePlan {
  const w = a ?? { ...FALLBACK_WINDOW, yearBasis: 'fy' as const };
  const whole = monthSpanLabel(w.windowFrom, w.windowTo);
  const p = prompt.trim();
  if (!p) return { size: suggested, reading: `Nothing asked for — the sizing table's ${suggested} items · ${whole}` };
  // The file's own name is not part of the ask — "Q1 extract.xlsx" names no months.
  const cased = source.file ? p.replace(new RegExp(source.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ') : p;
  // "may" is the month only when it reads like one — "May", "May 2026", "in may",
  // "Apr to may". "You may take 15" is not a month (17 Sep: it narrowed the draw).
  const lower = cased.toLowerCase().replace(/\bmay\b/g, (m: string, at: number) => {
    const written = cased.slice(at, at + 3);
    const before = cased.slice(0, at);
    const capital = written === 'May' && !/(?:^|[.!?]\s*)$/.test(before);
    const nextToYear = /^\s+(?:19|20)\d{2}\b/.test(cased.slice(at + 3));
    const opensRange = /^\s*(?:-|–|—|to|through|thru|till|until)\s*(?:jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)/i.test(cased.slice(at + 3));
    const afterWord = /\b(?:in|during|for|from|of|to|till|until|through|thru|and|since)\s*$|[-–—]\s*$/i.test(before);
    return capital || nextToYear || opensRange || afterWord ? m : 'm~y';
  });

  // ── which months ─────────────────────────────────────────────────────────────
  // Named months, quarters and halves, in the order written. Two joined by "to"
  // or a dash are a range; anything else adds up. Quarters open the year the
  // audit runs on — April for an April–March year (auditQuarters).
  const opens = w.yearBasis === 'fy' ? 3 : 0;
  const tokens = [...lower.matchAll(WHEN)].map(m => {
    const run = (first: number, n: number) => Array.from({ length: n }, (_, k) => (first + k) % 12);
    const q = m[1] ? Number(m[1]) : m[3] ? ORDINAL[m[3]]! : 0;
    const h = m[2] ? Number(m[2]) : m[4] ? ORDINAL[m[4]]! : 0;
    const months = q ? run(opens + 3 * (q - 1), 3)
      : h ? run(opens + 6 * (h - 1), 6)
      : run(MONTH_SHORT.findIndex(x => m[5]!.startsWith(x.toLowerCase())), 1);
    return { at: m.index!, end: m.index! + m[0].length, months };
  });
  const asked = new Set<number>();
  tokens.forEach((t, i) => {
    t.months.forEach(x => asked.add(x));
    const next = tokens[i + 1];
    if (next && /^\s*(?:-|–|—|to|through|thru|till|until)\s*$/.test(lower.slice(t.end, next.at))) {
      for (let x = t.months[0]!, k = 0; k < 12; x = (x + 1) % 12, k++) { asked.add(x); if (x === next.months[next.months.length - 1]) break; }
    }
  });
  // "two months", "3 months" — every instance inside them, so the size is the
  // file's run rate over them. Which two, when none are named, is the first two.
  const spanWords = lower.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:calendar\s+)?months?\b/);
  const [fy0, fm0] = w.windowFrom.split('-').map(Number);
  const [ty0, tm0] = w.windowTo.split('-').map(Number);
  const inWindow = Array.from({ length: Math.max(0, (ty0! - fy0!) * 12 + (tm0! - fm0!) + 1) }, (_, k) => {
    const n = fy0! * 12 + (fm0! - 1) + k;
    return { y: Math.floor(n / 12), m: n % 12 };
  });
  const spanN = spanWords ? Math.max(1, Math.min(inWindow.length, Number(spanWords[1]) || NUMBER_WORDS[spanWords[1]!] || 1)) : 0;
  const hit = asked.size ? inWindow.filter(x => asked.has(x.m)) : spanN ? inWindow.slice(0, spanN) : [];
  const outside = asked.size > 0 && hit.length === 0;
  const first = hit[0], last = hit[hit.length - 1];
  const stretch = first && last ? {
    from: [w.windowFrom, `${first.y}-${String(first.m + 1).padStart(2, '0')}-01`].sort()[1]!,
    to: [w.windowTo, isoOf(Math.round(Date.UTC(last.y, last.m + 1, 1) / DAY_MS) - 1)].sort()[0]!,
  } : undefined;
  const months = stretch && (stretch.from !== w.windowFrom || stretch.to !== w.windowTo) ? stretch : undefined;
  const label = months ? monthSpanLabel(months.from, months.to) : whole;

  // ── how many ─────────────────────────────────────────────────────────────────
  // The first number left once the months, years and dates are taken out — "Q1"
  // and "Jan 2026" never read as a count.
  const bare = lower
    .replace(WHEN, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(new RegExp(`\\b(?:fy|cy)\\s*'?\\d{2,4}\\b|\\b(?:19|20)\\d{2}\\b(?!\\s*${UNIT})`, 'g'), ' ')
    .replace(/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:calendar\s+)?months?\b/g, ' ');
  // The count is the number the ask ties to taking something — "take 15",
  // "15 invoices" — before any other number, so "from the 60 rows, take 15"
  // reads 15 (17 Sep, bug #31). A number after "from / of / out of" is the
  // population, not the ask.
  const verbNum = bare.match(/\b(?:take|pick|draw|select|sample|pull|choose|test|need|want)\s+(?:any\s+|about\s+|around\s+|only\s+|a\s+sample\s+of\s+)?(\d[\d,]*)\b/);
  const unitNum = [...bare.matchAll(new RegExp(`\\b(\\d[\\d,]*)\\s+(?:[a-z]+\\s+)?${UNIT}\\b`, 'g'))]
    .find(m => !/\b(?:from|of|out\s+of|among|amongst|in|within|population\s+of)\s*(?:the\s+|all\s+|these\s+)?$/.test(bare.slice(0, m.index)));
  const digits = verbNum ?? unitNum ?? bare.match(/\b(\d[\d,]*)\b/);
  const worded = bare.match(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\s+${UNIT}\\b`));
  const n = digits ? Number(digits[1]!.replace(/,/g, '')) : worded ? NUMBER_WORDS[worded[1]!]! : NaN;
  const runRate = !(n > 0) && spanN > 0;
  const monthsN = hit.length || spanN;
  const perMonth = Math.max(1, Math.round(source.count / Math.max(1, windowMonths(w.windowFrom, w.windowTo))));
  const size = n > 0 ? Math.max(1, Math.min(source.count, n))
    : runRate ? Math.max(1, Math.min(source.count, monthsN * perMonth))
    : suggested;

  // ── the method is the audit's ────────────────────────────────────────────────
  const named = METHOD_WORDS.filter(([re]) => re.test(lower)).map(([, m]) => m);
  const notes = [
    runRate ? `every instance in ${monthsN === 1 ? 'that month' : `those ${monthsN} months`}, at this file's run rate` : '',
    outside ? 'the months asked for are outside this audit' : '',
    named.some(m => m !== sampling.method) ? `method stays ${sampling.method} — set on the audit` : '',
  ].filter(Boolean);
  return {
    size,
    ...(months ? { months } : {}),
    reading: [`${size.toLocaleString()} item${size === 1 ? '' : 's'}`, label, ...notes].join(' · '),
  };
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

/** An instant as a person reads it on the page — '15 Sep 2026, 14:32'. Built by
 *  hand rather than through toLocaleString: newer browsers print September as
 *  "Sept" in en-GB, and a stamp should read the same on every machine. */
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDateTime(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fmtDate = (iso?: string) => fmtDay(iso);
const dayGap = (a?: string, b?: string) => {
  const x = parseDay(a), y = parseDay(b);
  if (!x || !y) return 0;
  // Both ends are local midnight, so a DST boundary inside the span makes one
  // day 23 or 25 hours long — rounding keeps the answer in whole days.
  return Math.round((y.getTime() - x.getTime()) / 86_400_000);
};

/* PARKED (dev call, Aug 2026) — all three below served the extracted-vs-expected
   comparison, and went with the "Expected instances" field that fed it:

     OVER_BAND       the 5% band an overshoot was forgiven inside
     EXTRACT_WOBBLE  how far the demo extract drifted off the typed figure
     overBreakdown   where the surplus rows sat, along the filtered dimension

   overBreakdown is the one worth restoring first if a comparison ever comes
   back: it answered "what did the filter sweep in" in one line, which no other
   surface does. It read pop.filterType, falling back to pop.filterAccount, and
   returned [{filtered dimension, count}, {Other, excess}]. */

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

  let s = seedKeyOf(c).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
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
  const s = seedKeyOf(c).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 3);
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

  // PARKED (dev call, Aug 2026) — this used to open on "N extracted against M
  // expected", where M was a figure the auditor typed before running the
  // extract. That field is gone: the reference number is already visible on the
  // source, so asking for it by hand was asking twice. What remains is what the
  // application can work out for itself, and it says nothing it cannot support.
  const src = pop.sourceCount;

  // A filter that returned the whole file did not filter. This is the one thing
  // the source count CAN settle on its own — it is not a size comparison, which
  // would be meaningless (a population is meant to be a subset), it is the
  // absence of a subset at all.
  if (src != null && pop.count === src) {
    return {
      level: 'warn', blocks: true,
      headline: `${pop.count.toLocaleString()} instances from ${src.toLocaleString()} rows`,
      detail: `Every row in the source came through, so nothing was filtered out. Either the file holds only this control's instances — say so — or the filter did not apply.${runNote}`,
      causes: 'Commonly a filter that was drafted but never run, or a source already cut to this control before it was sent.',
    };
  }

  if (runs == null) {
    // Recurring / Ad-hoc — the frequency gives no rhythm to measure against, and
    // there is no longer a typed figure standing in for one. So the row states
    // the two facts it has rather than failing for want of a number nobody is
    // asked for any more.
    return {
      level: 'pass', blocks: false,
      headline: src != null
        ? `${pop.count.toLocaleString()} instances from ${src.toLocaleString()} rows`
        : `${pop.count.toLocaleString()} instances`,
      detail: `A ${c.frequency.toLowerCase()} control has no fixed rhythm, so there is no run count to measure this against. The filter and the source it came from are what a reviewer reperforms.`,
    };
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
  // Every file the population stands on, not just the first — a control drawing
  // off four quarterly extracts uses all four, and a file that only ever showed
  // up second would read as used by nobody.
  return eng.controls.filter(c => populationSources(c).some(s => s.file === name));
}

/** Whether a file has a row count worth stating.
 *
 *  A spreadsheet or an extract does; a PDF does not — "अगर PDF है तो नहीं
 *  दिखेगी रो सीधी बात है". A number printed beside a PDF is a number somebody
 *  counted for it, not one the file has, and the population is drawn off
 *  structured sources anyway: the ground truth an audit tests against lives in
 *  a spreadsheet, and the PDF is the proof beside it. */
export function hasRowCount(name?: string): boolean {
  return !!name && !/\.pdf$/i.test(name.trim());
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
/** An attribute concluded on nothing but somebody's word. Operating refuses these.
 *
 *  Derived, not asked. The per-attribute "Evidence type" dropdown was removed on
 *  31 Jul and is not coming back — but the rule under it is a real one, and the
 *  answer was always sitting in the attribute already: an attestation is somebody
 *  telling you it happened, and if nothing was validated, no run was pulled and
 *  the attester attached nothing, then the statement is the whole of the evidence.
 *  That is inquiry, and inquiry does not carry an operating conclusion.
 *
 *  A bare result with no attestation at all is deliberately NOT caught here. That
 *  is the auditor recording their own testing, not somebody's word about it, and
 *  sweeping it in would block every manual control on the register.
 *
 *  An explicit evidenceType still wins where one exists, so the parked field and
 *  its mutator keep their meaning if they are ever brought back. */
export function inquiryOnlyAttributes(c: Control): OperatingStep[] {
  return c.operating.steps.filter(s => isInquiryOnly(s.evidenceType) || restsOnStatementAlone(s));
}
/** Attested, with nothing behind the attestation. */
export function restsOnStatementAlone(s: OperatingStep): boolean {
  return !!s.attestation
    && !s.validation?.result
    && !s.workflowRunRef
    && (s.attestation.evidence?.length ?? 0) === 0;
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
/** Has the reviewer approved the concluded TOD (S6, A36)? Population, Sample and
 *  TOE stay locked until they have — a design nobody has checked is not a design
 *  worth pulling data against. A cleared conclusion is never approved, whatever
 *  an older approval on the record says. */
export function designApproved(c: Control): boolean {
  return trackResult(c.design) !== 'Not tested' && !!c.design.approval?.approvedBy;
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
// A countersigned audit seals its cycle — no edits, no reopen. The seal reads the
// LIVE audit (newest unarchived record — auditPortfolio's liveAuditId, inlined
// because auditPortfolio imports from this file): that is the only record whose
// results are on the controls, so both of its signatures freeze the engagement's
// working state. Starting the next cycle archives it, which is the only release.
export function isEngagementLocked(eng: IcfrEngagement): boolean {
  const live = eng.audits.find(a => !a.archive);
  return !!(live?.signoff?.preparer && live?.signoff?.reviewer);
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

import type { DesignPoint, EvidenceFile, OperatingStep, RequiredFile, TestResult, ValidationQA, ValidationTable } from './types';
export function pointResult(p: DesignPoint): TestResult { return p.override ? (p.override.result as TestResult) : p.result; }

/** A validated file and a person's attestation reached opposite conclusions on
 *  the same attribute.
 *
 *  Attestation is the answer to a control whose evidence is an inspection
 *  performed in person — not a way round a document that says otherwise. So it
 *  is always secondary: where the two disagree, the validation is what the
 *  attribute tested, and the attestation survives as the statement it is.
 *  attestStep already refuses to write the contradicting result, so this is the
 *  read-side backstop for every other way a step can reach that state. */
export function attestationOverruled(s: OperatingStep): boolean {
  return !!(s.validation?.result && s.attestation?.result && s.validation.result !== s.attestation.result);
}
export function stepResult(s: OperatingStep): TestResult {
  // The auditor's own override stays supreme — it is a named judgment with a
  // recorded reason, not a second opinion sneaking past the evidence.
  if (s.override) return s.override.result as TestResult;
  if (attestationOverruled(s)) return s.validation!.result as TestResult;
  return s.result;
}

// ─── Required files — the evidence an attribute's AI validation runs against ─────
// The RACM's Control Evidence column names what proves a control; Ira splits it
// per attribute. Uploads carry no real bytes in this prototype, so the split is
// read off the attribute's own wording: the records it talks about are the
// records it needs. Deterministic, so an attribute asks for the same files on
// every render until somebody edits the list.
const EVIDENCE_FROM_WORDING: [RegExp, string][] = [
  [/approv|sign|authori/i, 'Signed approval record'],
  [/reconcil/i, 'Reconciliation workpaper'],
  [/invoice/i, 'Invoice register extract'],
  [/\bpo\b|purchase order/i, 'Purchase order report'],
  [/\bgrn\b|goods receipt/i, 'Goods receipt notes'],
  [/journal/i, 'Journal entry register'],
  [/vendor|supplier|payee/i, 'Vendor master change log'],
  [/confirm/i, 'Bank or third-party confirmation'],
  [/call-?back/i, 'Call-back log'],
  [/bank|payment/i, 'Payment run report'],
  [/access|user|role|password/i, 'User access listing'],
  [/change|ticket/i, 'Change ticket log'],
  [/toleran|exception|breach|hold/i, 'Exception and hold report'],
  [/review/i, 'Reviewer sign-off evidence'],
  [/timestamp|before|date|timely|period/i, 'System audit-trail extract'],
];

/** The attribute's required files: the edited list when there is one, otherwise
 *  the split read off its wording together with its control's own sentence, and
 *  then the control's activity (up to three), with the old single required file
 *  standing as the first line's upload. The control matters because attributes
 *  are worded generically ("Exceptions handled per policy") — they no longer
 *  repeat the control's sentence, which is what names the records. */
type EvidenceSource = Pick<Control, 'description' | 'controlActivity'>;
export function requiredFilesOf(s: OperatingStep, c: EvidenceSource): RequiredFile[] {
  if (s.requiredFiles) return s.requiredFiles;
  const read = (text: string) => EVIDENCE_FROM_WORDING.filter(([re]) => re.test(text)).map(([, label]) => label);
  const labels = Array.from(new Set([...read(`${s.description} ${c.description}`), ...read(c.controlActivity ?? c.description)])).slice(0, 3);
  const list = labels.length ? labels : ['Supporting document for the sampled items'];
  return list.map((label, i) => ({ id: `${s.id}-rf${i + 1}`, label, ...(i === 0 && s.inputFile ? { file: s.inputFile } : {}) }));
}
/** Uploaded out of required, e.g. 2 of 3. */
export function requiredFilesCount(s: OperatingStep, c: EvidenceSource): { uploaded: number; total: number } {
  const list = requiredFilesOf(s, c);
  return { uploaded: list.filter(f => f.file).length, total: list.length };
}
/** AI validation can run only once every required file is in. */
export function requiredFilesReady(s: OperatingStep, c: EvidenceSource): boolean {
  const { uploaded, total } = requiredFilesCount(s, c);
  return total > 0 && uploaded === total;
}
/** Attributes standing at Pass while a required file is still missing (17 Sep
 *  dev call: no Pass without the evidence, whichever way it was given — the
 *  Pass button, an override, an attestation). They can't carry an effective TOE. */
export function passedWithoutFiles(c: Control): OperatingStep[] {
  return c.operating.steps.filter(s => stepResult(s) === 'Pass' && !requiredFilesReady(s, c));
}

/**
 * Why Ira cannot answer one design check, or null if it can.
 *
 * A real assistant reads the evidence it was given and sometimes finds that
 * nothing in it speaks to the question. Saying so is the honest outcome; the
 * dishonest one is a Pass, because a check nobody could assess and a check that
 * held look identical on a working paper once a tick is on it.
 *
 * Two ways it happens, and they are different problems with different fixes:
 *
 *  · MISSING — the element that answers this check is on the control, and
 *    nobody has attached its file. One upload away.
 *  · INSUFFICIENT — the element that answers it is not on the control at all.
 *    A process narrative does not say who holds which SAP role, and reading one
 *    harder will not make it. Somebody has to add the element.
 *
 * Nothing here is invented: the check's own words say what it is asking about,
 * and the control's own elements say whether that question has anything behind
 * it. Run twice on the same control it gives the same answer, because it is a
 * reading of the control rather than a roll of the dice.
 */
export interface IraBlock {
  kind: 'missing' | 'insufficient';
  /** The element that would have answered it. */
  needs: DesignDocKind;
  /** The sentence the row prints, in amber. */
  reason: string;
}

/** What a check is asking about, and the element that answers it. Only the two
 *  specialised kinds are here: the general ones (narrative, flowchart,
 *  walkthrough, control description) describe the control as a whole, so any of
 *  them can speak to an ordinary check. These two cannot be substituted —
 *  neither who-holds-which-role nor where-the-threshold-sits is in a narrative. */
const ANSWERED_BY: { kind: DesignDocKind; asks: RegExp }[] = [
  { kind: 'Segregation of duties', asks: /\b(segregat\w*|independent of|distinct|four[- ]eyes|same person|different person|requester|preparer|authoriser|second authoriser)\b/i },
  { kind: 'Precision & thresholds', asks: /\b(threshold\w*|toleran\w*|signing limits?|precision|materiality|tiers?|de minimis)\b/i },
];

export function iraCannotTest(p: DesignPoint, c: Control): IraBlock | null {
  const onFile = c.design.documents.filter(d => designFilesOf(d).length > 0);
  const label = (k: string) => k.toLowerCase();

  // The check names its own evidence and none of what it names has arrived.
  // This outranks the reading below: a check told where to look and finding an
  // empty shelf is the plainest case there is.
  const cited = p.evidencedBy?.length ? c.design.documents.filter(d => p.evidencedBy!.includes(d.id)) : [];
  if (cited.length > 0 && cited.every(d => designFilesOf(d).length === 0)) {
    const names = cited.map(d => (d.kind === 'Custom' ? d.name : d.kind));
    return {
      kind: 'missing', needs: cited[0].kind,
      reason: `Nothing is attached to ${listPhrase(names.map(n => n.toLowerCase()))} yet, and that is what this check points at.`,
    };
  }

  // What it is asking about, and whether anything on file can answer it.
  const needs = ANSWERED_BY.find(x => x.asks.test(p.text));
  if (!needs) return null;
  if (onFile.some(d => d.kind === needs.kind)) return null;
  const onControl = c.design.documents.some(d => d.kind === needs.kind);
  return onControl
    ? {
      kind: 'missing', needs: needs.kind,
      reason: `${needs.kind} is on this control but has no file, so there is nothing to read this one against.`,
    }
    : {
      kind: 'insufficient', needs: needs.kind,
      reason: onFile.length === 0
        ? 'Nothing is attached to any element yet, so there is nothing to read.'
        : `${cap(listPhrase(onFile.map(d => label(d.kind === 'Custom' ? d.name : d.kind))))} ${onFile.length === 1 ? 'is' : 'are'} all that is on file, and ${onFile.length === 1 ? 'it does' : 'they do'} not say enough to answer this. A ${label(needs.kind)} element would.`,
    };
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Checks Ira ran and could not reach a verdict on — what the header counts. */
export function designBlocked(c: Control): DesignPoint[] {
  return c.design.points.filter(p => !!p.validation?.blocked && pointResult(p) === 'Not tested');
}

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
const lakh = (n: number) => `₹${(n / 1e5).toFixed(1)}L`;

/** A realistic workflow run reference — run number, population, exceptions. */
export function wfRunRef(key: string, fail: boolean): string {
  const h = hnum(key);
  const run = 4800 + (h % 900);
  const items = 120 + ((h >>> 3) % 480);
  const ex = fail ? 1 + ((h >>> 7) % 5) : 0;
  return `run #${run} · ${items} items checked · ${ex} exception${ex === 1 ? '' : 's'}`;
}

// ── document against system (S7, A24) ────────────────────────────────────────
// Ira does not take a yes/no column's word for it (Dubai). For every sampled
// item it reads what the document says and what the system or master data holds
// for the same field, and a mismatch is the exception. The field each item is
// compared on comes from the attribute's required files — an approval record is
// compared on the approver, a vendor master log on the bank account.
const APPROVERS = ['R. Iyer', 'S. Menon', 'A. Kapoor', 'P. Nair', 'D. Rao'];
const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis'];
const ROLES = ['AP clerk', 'AP approver', 'Treasury maker', 'Treasury checker'];
const MONTHS_SHORT = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const onDay = (h: number) => `${(h % 27) + 1} ${MONTHS_SHORT[(h >>> 3) % 12]}`;
const COMPARE_FIELDS: [RegExp, string, (h: number) => string][] = [
  [/approval/i, 'Approver', h => APPROVERS[h % APPROVERS.length]!],
  [/vendor master/i, 'Vendor bank account', h => `${BANKS[h % BANKS.length]} …${String(1000 + ((h >>> 2) % 9000))}`],
  [/invoice/i, 'Invoice amount', h => lakh((((h >>> 4) % 60) + 8) * 100_000)],
  [/purchase order/i, 'PO amount', h => lakh((((h >>> 4) % 60) + 8) * 100_000)],
  [/goods receipt/i, 'Quantity received', h => `${20 + (h % 380)} units`],
  [/journal/i, 'Journal amount', h => lakh((((h >>> 4) % 90) + 2) * 100_000)],
  [/reconciliation/i, 'Reconciled balance', h => lakh((((h >>> 4) % 400) + 20) * 100_000)],
  [/confirmation/i, 'Confirmed balance', h => lakh((((h >>> 4) % 400) + 20) * 100_000)],
  [/call-back/i, 'Called-back account', h => `${BANKS[h % BANKS.length]} …${String(1000 + ((h >>> 2) % 9000))}`],
  [/payment/i, 'Payment amount', h => lakh((((h >>> 4) % 60) + 8) * 100_000)],
  [/access/i, 'User role', h => ROLES[h % ROLES.length]!],
  [/change/i, 'Change ticket', h => `CHG-${10000 + (h % 9000)}`],
  [/exception|hold/i, 'Hold release date', onDay],
  [/sign-off/i, 'Review date', onDay],
  [/audit-trail/i, 'Posting date', onDay],
];
/** The fields an attribute's items are compared on — one per required file that
 *  names one, in the order the files are listed. */
function compareFieldsFor(c: Control, s: OperatingStep): [string, (h: number) => string][] {
  const out: [string, (h: number) => string][] = [];
  for (const f of requiredFilesOf(s, c)) {
    const hit = COMPARE_FIELDS.find(([re]) => re.test(f.label));
    if (hit && !out.some(([name]) => name === hit[1])) out.push([hit[1], hit[2]]);
  }
  return out.length ? out : [['Amount', h => lakh((((h >>> 4) % 60) + 8) * 100_000)]];
}
export interface DocumentSystemRow { id: string; ref: string; field: string; document: string; system: string; result: TestResult }
/** One row per item: the document's value, the system's value, and whether they
 *  agree. Read off the verdicts already on the attribute, so this table and the
 *  sample grid can never disagree about which item failed. */
function compareRow(key: string, id: string, ref: string, i: number, fields: [string, (h: number) => string][], result: TestResult): DocumentSystemRow {
  const [field, value] = fields[i % fields.length]!;
  const h = hnum(key + id);
  const document = value(h);
  // a mismatch has to actually differ — walk the hash until it does
  let system = document;
  for (let k = 1; result === 'Fail' && system === document && k < 8; k++) system = value(h + k * 7919);
  return { id, ref, field, document, system, result };
}
/** The drawn sample, compared item by item. Empty before a sample exists. */
export function documentSystemRows(c: Control, s: OperatingStep): DocumentSystemRow[] {
  const fields = compareFieldsFor(c, s);
  return (c.operating.sampling?.samples ?? []).map((it, i) =>
    compareRow(seedKeyOf(c) + s.id, it.id, it.ref, i, fields, s.sampleResults?.[it.id] ?? 'Not tested'));
}

/** Plain-language summary the AI returns after comparing the sampled items'
 *  documents with the system. Names the item that failed — the same one the
 *  sample grid marks (stampSamples fails the first item). */
export function validationSummary(c: Control, s: OperatingStep, fail: boolean, key = seedKeyOf(c) + s.id): string {
  const samples = c.operating.sampling?.samples ?? [];
  const fields = compareFieldsFor(c, s).map(([name]) => name.toLowerCase());
  const on = fields.length > 1 ? `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}` : fields[0]!;
  if (!samples.length) {
    const ref = `PO 45000${12840 + (hnum(key) % 25) * 7}`;
    return fail
      ? `No sample has been drawn yet, so Ira compared 4 items from the files instead, on ${on}. ${ref}'s document doesn't match the system, so the attribute is concluded Fail.`
      : `No sample has been drawn yet, so Ira compared 4 items from the files instead, on ${on}. Each document matches the system, so the attribute is concluded Pass.`;
  }
  const n = samples.length;
  return fail
    ? `Ira compared each of the ${n} sampled items' documents with what the system and master data hold, on ${on}. ${samples[0]!.ref} doesn't match, so the attribute is concluded Fail.`
    : `Ira compared each of the ${n} sampled items' documents with what the system and master data hold, on ${on}. All ${n} match, so the attribute is concluded Pass.`;
}

/** The comparison table for an attribute with no sample yet — four items read
 *  straight off the files, in the same columns the sampled comparison uses. */
export function validationTable(c: Control, s: OperatingStep, fail: boolean, key = seedKeyOf(c) + s.id): ValidationTable {
  const fields = compareFieldsFor(c, s);
  const h = hnum(key);
  const rows = Array.from({ length: 4 }, (_, i) => {
    const ref = `PO 45000${12840 + (((h + i * 137) >>> 2) % 25) * 7}`;
    const r = compareRow(key, `item-${i}`, ref, i, fields, fail && i === 3 ? 'Fail' : 'Pass');
    return [r.ref, r.field, r.document, r.system, r.result === 'Fail' ? 'Mismatch' : 'Match'];
  });
  return { columns: ['Item', 'Field', 'Document says', 'System says', 'Result'], rows };
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
/** What the evidence says the design conclusion should be.
 *
 *  Lifted out of DesignSection (21 Sep) when the chat rail started concluding
 *  too: the page shows "Evidence suggests X" and files an override when the
 *  auditor goes against it, so a second copy of this rule in the chat would
 *  have been two products disagreeing about the same paper.
 *
 *  A failed walkthrough attribute counts as a design failure — the control as
 *  built did not do what it claims on a real transaction. */
export function designSuggestion(c: Control): TrackConclusion {
  const d = c.design;
  const walkFailed = d.walkthrough ? c.operating.steps.some(s => d.walkthrough!.attributeResults[s.id] === 'Fail') : false;
  return d.documents.length === 0 && d.points.length === 0 ? 'Not tested'
    : designOutstanding(c).length > 0 || walkFailed || d.points.some(p => pointResult(p) === 'Fail') ? 'Ineffective'
    : d.points.length > 0 && d.points.every(p => pointResult(p) === 'Pass') ? 'Effective' : 'Not tested';
}
/** What the attribute results point to, before anybody concludes anything.
 *
 *  Lifted out of OperatingSection (22 Sep) for the same reason designSuggestion
 *  was: the chat has to know what the evidence suggested in order to file the
 *  conclusion as an override when the auditor departs from it, and two copies
 *  of this expression would eventually disagree about whether they had. */
export function operatingSuggestion(c: Control): TrackConclusion {
  const steps = c.operating.steps;
  if (steps.some(s => stepResult(s) === 'Fail')) return 'Ineffective';
  return steps.length > 0 && steps.every(s => stepResult(s) !== 'Not tested') ? 'Effective' : 'Not tested';
}

/** The files on a design element. An older seeded element can read Received with
 *  no file list at all — its one file is the element itself — so that case is
 *  read as a single file with a stable id, and the page, the trail and a removal
 *  all see the same thing. */
export function designFilesOf(d: DesignDoc): EvidenceFile[] {
  if (d.files) return d.files;
  return d.status === 'Received' ? [{ id: `${d.id}-f`, name: d.name, kind: 'PDF', uploadedBy: d.uploadedBy ?? 'Risk Owner', uploadedAt: d.at ?? '' }] : [];
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
/* ── Rounds of operating testing ──────────────────────────────────────────────
 *
 * At most two (user, 12 Aug). The first failure is allowed to be the draw's
 * fault rather than the control's — a window that was wrong, an entity that was
 * wrong, reversals nobody excluded — so the auditor may correct the criteria and
 * draw once more, with a written reason. A failure in the SECOND round is the
 * control's: the deficiency is raised there and then, and there is no third
 * round to look for a kinder sample in.
 *
 * Every question about rounds is answered here so the store's guards and the
 * screen's buttons cannot drift apart.
 */
export const TOE_MAX_ROUNDS = 2;

/** Rounds that have closed, oldest first. */
export const toeRounds = (c: Control): ToeRound[] => c.operating.rounds ?? [];

/** Which round the live draw is — 1 until a redraw, 2 after it. */
export const toeRoundNo = (c: Control): number => toeRounds(c).length + 1;

/** Has the LIVE round produced a failure on any attribute? Read through
 *  stepResult, so an override or a validation standing over an attestation
 *  counts exactly as the conclusion will count it. */
export const toeRoundFailed = (c: Control): boolean =>
  c.operating.steps.some(s => stepResult(s) === 'Fail');

/** Is this the last round the control gets, and has it already failed? Past this
 *  point the finding stands: no extension, no redraw. */
export const toeSpent = (c: Control): boolean =>
  toeRoundNo(c) >= TOE_MAX_ROUNDS && toeRoundFailed(c);

/** May the auditor correct the criteria and draw again?
 *
 *  Needs a failure to answer — a redraw over a clean round is not a correction,
 *  it is a re-roll — and needs the redraw not to have been used already. The
 *  reason itself is the store's to insist on; this only says the door exists. */
export const canRedrawToe = (c: Control): boolean =>
  !isControlLocked(c) && toeRoundNo(c) < TOE_MAX_ROUNDS && toeRoundFailed(c);

/** May the sample still be extended?
 *
 *  Extending stays INSIDE the round it happens in — more items against the same
 *  criteria is the handbook's answer to a deviation, and it is not a new round.
 *  It closes only once the last round has failed, because by then the finding is
 *  already the control's. */
export const canExtendToe = (c: Control): boolean =>
  !isControlLocked(c) && !!c.operating.sampling && !toeSpent(c);

export function operatingProgress(c: Control) {
  const s = c.operating.steps;
  // Counted through stepResult, so the meter and the conclusion cannot disagree:
  // an override, or a validation that stands over a contradicting attestation,
  // has to move both or neither.
  return {
    // Through stepResult like the other two (21 Sep). Reading raw `.result`
    // here meant an attribute settled by override counted as passed or failed
    // but never as tested, so "N of M tested" could never reach M — and the
    // chat rail read it and told the auditor to keep going on work that was
    // finished. The comment above had claimed this for a while; now it is true.
    tested: s.filter(x => stepResult(x) !== 'Not tested').length,
    passed: s.filter(x => stepResult(x) === 'Pass').length,
    failed: s.filter(x => stepResult(x) === 'Fail').length,
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
    // A failed check is named WITH the attribute it belongs to. The rationale is
    // what the paper carries as the reason, and "exceptions handled per policy
    // failed" does not say which of the five things the control has to do.
    const named = failed.map(p => {
      const on = p.stepId ? c.operating.steps.find(s => s.id === p.stepId) : undefined;
      return on ? `${p.text} (${on.code})` : p.text;
    });
    return `${pointsPass} of ${pointsTotal} design checks passed${against}. ${failed.length} failed: ${listPhrase(named)}.`;
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

/** The row count a file is read as holding.
 *
 *  This prototype holds no file bytes, so the number is derived from the name —
 *  which means it is stated once and never moves, however many times the same
 *  file is read. It lives here because two doors now put a file on an audit
 *  (the page's Add-source modal and the chat), and a file that counted 4,102
 *  rows through one and 11,890 through the other would be two files. */
export function readRowCount(name: string): number {
  return 400 + (name.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 5) % 19000);
}

/**
 * How far a filter narrows its source — the one answer, wherever it was run.
 *
 * Always a fraction of the file: a population the same size as the thing it
 * came out of is a file somebody copied rather than a population somebody
 * defined. Deterministic from the control AND the file, so two files under one
 * control narrow to different numbers, and the same extract run twice does not
 * move.
 *
 * Shared with the chat (user ask, 22 Sep), which runs the same extract. Two
 * implementations of this would hand the reviewer two different populations for
 * the same sentence, which is the one thing a second door must never do.
 */
export function narrowedCount(c: Control, file: { name: string; rows: number }): number {
  const seed = `${seedKeyOf(c)}·${file.name}`.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 11);
  const share = 0.2 + (seed % 30) / 100;
  return Math.max(1, Math.min(file.rows - 1, Math.round(file.rows * share)));
}

/** The population one extract produces, built in one place so the form on the
 *  left and the chat on the right file the identical record. */
export function populationFrom(
  c: Control,
  chosen: { name: string; rows: number; from: string; system?: string },
  criteria: string,
  count: number,
  ctx: { version: string; me: string; from?: string; to?: string },
): Population {
  return {
    version: ctx.version,
    source: `${chosen.name} · ${chosen.from}`,
    sources: [{ id: 'src-1', file: chosen.name, rows: chosen.rows, count, criteria }],
    sourceFile: chosen.name, sourceCount: chosen.rows,
    criteria,
    filterFrom: ctx.from || undefined, filterTo: ctx.to || undefined,
    // The criteria are prose, but the over-extraction breakdown still needs a
    // dimension to name ("type Banking 1,180 · type Other 238"). The sub-process
    // is what the old Transaction-type box defaulted to.
    filterType: c.subProcess && c.subProcess !== 'General' ? c.subProcess : undefined,
    count,
    // The person signed in is the person who just ran the extract, and the
    // system fills itself in when the pull came from one.
    provenance: { system: chosen.system ?? '', extractedBy: ctx.me, extractedOn: '' },
    tieOut: `Filtered from ${chosen.rows.toLocaleString()} rows`,
    evidence: [{ id: 'pop-ev', name: chosen.name, kind: chosen.name.endsWith('.csv') ? 'CSV' : 'XLSX', uploadedBy: ctx.me, uploadedAt: 'just now' }],
  };
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
    const mine = eng.controls.find(x => x.id === c.id);
    if (mine && populationSources(mine).some(s => s.file === f.name)) { score += 60; why.push('this control drew off it last round'); }

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
  // Control-level checks only, deliberately. The library offers control-level
  // considerations, and it decides "already covered" on keyword overlap — so
  // letting attribute checks into the corpus would suppress real suggestions on
  // a coincidence of wording. An attribute check reading "…exceptions handled
  // per policy…" would silently retire the library's own exceptions check, which
  // is a different question about a different thing.
  const existing = c.design.points.filter(p => !p.stepId).map(p => keyWords(p.text));
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

import type { AuditRecord, Frequency } from './types';
import type { ProcurementRacmRow } from '../../data/procurement-racm';
const CYCLE_DAYS: Record<Frequency, number> = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, Annual: 365, Recurring: 7, 'Ad-hoc': 30 };

// ── year-end controls (A29) ──────────────────────────────────────────────────
// A control that runs once a year (frequency Annual) has not operated yet when an
// interim or roll-forward round is tested — so there is no population to pull,
// nothing to sample and no TOE to run until the year closes. Those three wait for
// the year-end audit; TOD does not, because a design can be walked through any
// time. Nothing new is set on the control: Annual is the whole rule. A year-end
// round, and quarter and custom audits (one-off checks with no rounds), hold
// nothing back.
/** The date an Annual control's operating work is pending until in this audit —
 *  the last day of the audit's cycle — or null when nothing is held back. */
export function yearEndPending(c: Control, audit?: AuditRecord | null): { until: string } | null {
  if (!audit || c.frequency !== 'Annual') return null;
  if (audit.round !== 'interim' && audit.round !== 'rollforward') return null;
  // FY cycles run April to March (NewAuditWizard); fiscalYear is the year the
  // cycle ends on, so FY 2026-27 ⇒ 31 Mar 2027 and CY 2026 ⇒ 31 Dec 2026.
  if (audit.yearBasis === 'cy') return { until: `31 Dec ${audit.fiscalYear}` };
  if (audit.yearBasis === 'fy') return { until: `31 Mar ${audit.fiscalYear}` };
  return null;
}

/** A concluded control (Effective or Ineffective) is off the due schedule —
 *  effective ones wait for the next cycle, ineffective ones for remediation. */
export function isConcluded(c: Control, opApplies = true): boolean {
  const x = controlConclusion(c, opApplies);
  return x === 'Effective' || x === 'Ineffective';
}

export function testDueInDays(c: Control): number {
  const cycle = CYCLE_DAYS[c.frequency];
  let h = 0; const sk = seedKeyOf(c); for (let i = 0; i < sk.length; i++) h = (h * 31 + sk.charCodeAt(i)) >>> 0;
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

/** Row display — concluded controls read as scheduled/parked, never as due.
 *  `audit` is the open audit, when there is one: a year-end control it holds back
 *  (yearEndPending) reads as pending rather than due or overdue. Left out — the
 *  engagement level — every control reads as it always has. */
export function testDueDisplay(c: Control, opApplies = true, audit?: AuditRecord | null): { label: string; cls: string } {
  const concl = controlConclusion(c, opApplies);
  if (concl === 'Ineffective') return { label: 'Retest after remediation', cls: 'text-risk-700' };
  const d = testDueInDays(c);
  if (concl === 'Effective') return { label: `Next test in ${d}d`, cls: '' };
  const pending = yearEndPending(c, audit);
  if (pending) return { label: `Pending until ${pending.until}`, cls: '' };
  if (d < 0) return { label: `Overdue ${-d}d`, cls: 'text-risk-700 font-semibold' };
  if (d === 0) return { label: 'Due today', cls: 'text-mitigated-700 font-semibold' };
  return { label: testDueLabel(d), cls: '' };
}

/** Same `audit` as testDueDisplay: a control the open audit holds back until year
 *  end is not due in it, so it is never counted as due now or overdue. */
export function isTestDueNow(c: Control, audit?: AuditRecord | null): boolean {
  return !isConcluded(c) && !yearEndPending(c, audit) && testDueInDays(c) <= 0;
}

export function testsDueNow(controls: Control[], audit?: AuditRecord | null): Control[] {
  return controls.filter(c => isTestDueNow(c, audit)).sort((a, b) => testDueInDays(a) - testDueInDays(b));
}

/** What an audit's sign-off waits on. A year-end control the audit holds back
 *  (yearEndPending) cannot finish inside an interim or roll-forward, so waiting
 *  on it would leave that audit unsignable: it is set aside as `pending`, with
 *  the date it waits for, and the sign-off gate counts `gating` (user ask —
 *  pending controls don't block). A year-end audit, and quarter and custom
 *  audits, hold nothing back, so every control still gates them. */
export function signoffControls(controls: Control[], audit?: AuditRecord | null): { gating: Control[]; pending: Control[]; until: string | null } {
  const pending = controls.filter(c => !!yearEndPending(c, audit));
  if (!pending.length) return { gating: controls, pending, until: null };
  return { gating: controls.filter(c => !yearEndPending(c, audit)), pending, until: yearEndPending(pending[0]!, audit)!.until };
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

// ─── RACM editor rows — the matrix a SOX RACM actually holds ─────────────────────
// Clicking a RACM on the RACM tab opens the spreadsheet editor in a new tab. That
// tab has none of this engagement's state, so the rows travel with it: this lays
// a process's controls out in the editor's spreadsheet columns (the same grouping
// Racm.tsx uses), and openEditorTab hands them over. Columns a control has no
// field for stay blank.
export const RACM_ROWS_KEY = (racmId: string) => `sox-racm-rows:${racmId}`;
/** The rows the editor must not let anyone change — published control IDs, in
 *  the editor's own spelling. Handed over beside the rows: the editor refuses to
 *  edit them, and `applyEditorRows` refuses them again on the way back, because
 *  the first lock lives in another browser tab and can be reached by other
 *  means. */
export const RACM_LOCKED_KEY = (racmId: string) => `sox-racm-locked:${racmId}`;
export function racmEditorRows(controls: Control[], process: string): ProcurementRacmRow[] {
  const seen = new Set<string>();
  return controls
    .filter(c => c.process === process)
    .map(c => {
      // The editor keys a row on risk + control id. The same control tested at
      // several companies shares its client-facing number, so a repeat falls
      // back to the row's own unique id rather than colliding with the first.
      const shown = c.code ?? c.id;
      const controlId = seen.has(`${c.riskId}-${shown}`) ? c.id : shown;
      seen.add(`${c.riskId}-${controlId}`);
      const evidence = Array.from(new Set(c.operating.steps.flatMap(s => requiredFilesOf(s, c).map(f => f.label))));
      return {
        riskId: c.riskId,
        controlId,
        isKey: c.isKey,
        processArea: c.process,
        subProcess: c.subProcess,
        // A shared control is operated at several companies, so the grid lists
        // them all rather than picking one.
        entity: c.entities?.length ? c.entities.join(', ') : (c.entity ?? ''),
        // Left blank when the control carries no country of its own — the row
        // inherits its entity's, which is resolved where the row is read.
        country: c.country ?? '',
        riskCategory: c.clazz ?? '',
        riskTitle: c.riskTitle ?? '',
        riskDescription: c.riskDescription,
        riskRating: c.riskRating ?? '',
        likelihood: '',
        impact: '',
        controlTitle: c.description,
        controlObjective: c.objective ?? '',
        controlActivity: c.controlActivity ?? c.description,
        controlType: c.type,
        controlNature: c.nature,
        frequency: c.frequency,
        effectiveDate: c.effectiveDate ?? '',
        testingStrategy: c.testingStrategy ?? '',
        controlOwner: c.owner,
        controlEvidence: evidence.join('; '),
        assertions: c.assertions.join(', '),
        fsLineItem: '',
        regulatoryRef: '',
        keyReport: c.reportRef ?? '',
        ipeIceDetails: '',
        segregationOfDuties: '',
        mgmtReviewControl: c.isMrc ? 'Yes' : '',
        confidence: '',
        sopSectionRef: '',
        attributes: c.operating.steps.map(s => s.description).join(' | '),
      };
    });
}

/** The editor's key for a row — the same pair `racmEditorRows` writes out, so a
 *  row that came from a control can be matched back to it. */
const editorKey = (riskId: string, controlId: string) => `${riskId}|${controlId}`;

/** The published rows, named the way the EDITOR names them.
 *
 *  A control's id and the id the grid shows are not always the same string —
 *  the grid shows the client-facing number (`code`) where there is one. The
 *  editor can only match on what it can see, so the lock list is translated on
 *  the way out; a row whose control has since gone is dropped rather than
 *  locking a row that no longer answers to anything. */
export function lockedEditorIds(controls: Control[], process: string, published: string[]): string[] {
  const inProcess = controls.filter(c => c.process === process);
  const live = new Set(published);
  return racmEditorRows(controls, process)
    .filter((_, i) => { const c = inProcess[i]; return !!c && live.has(c.id); })
    .map(r => r.controlId);
}

const NATURES: Nature[] = ['Manual', 'Automated', 'IT-dependent'];
const TYPES: ControlType[] = ['Preventive', 'Detective'];
const RATINGS: RiskRating[] = ['High', 'Medium', 'Low'];
const FREQS: Frequency[] = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Recurring', 'Ad-hoc'];
const oneOf = <T extends string>(allowed: T[], cell: string): T | undefined =>
  allowed.find(a => a.toLowerCase() === cell.trim().toLowerCase());

/**
 * The spreadsheet editor's rows, written back onto the controls they came from.
 *
 * The editor is a grid of strings in a separate browser tab; a control is a
 * record with test results hanging off it. So this maps back only the columns a
 * person can meaningfully type into, and refuses anything it cannot read: a
 * frequency cell saying "fortnightly" leaves the frequency alone rather than
 * guessing, because a wrong frequency silently changes how big a sample has to
 * be. Test results, populations, samples and sign-offs are never touched — they
 * are not in the grid and nothing in the grid should be able to move them.
 *
 * Rows the editor added have no control to match and become new ones. Rows that
 * disappeared are NOT deleted here: a row vanishing from a grid is as likely to
 * be a bad round-trip as a deliberate removal, and deleting a tested control on
 * that evidence is not a risk worth taking.
 *
 * `locked` names the control ids that must not move — the published ones. The
 * editor already refuses to edit them; this is the second lock, because the
 * first one lives in another browser tab and can be reached by other means.
 */
export function applyEditorRows(
  controls: Control[], process: string, rows: ProcurementRacmRow[], locked: Set<string>,
): { controls: Control[]; changed: number; added: number } {
  const byKey = new Map<string, string>();
  racmEditorRows(controls, process).forEach((r, i) => {
    const c = controls.filter(x => x.process === process)[i];
    if (c) byKey.set(editorKey(r.riskId, r.controlId), c.id);
  });

  let changed = 0;
  const seen = new Set<string>();
  const next = controls.map(c => {
    const id = [...byKey.entries()].find(([, v]) => v === c.id)?.[0];
    const row = id ? rows.find(r => editorKey(r.riskId, r.controlId) === id) : undefined;
    if (!row || locked.has(c.id)) return c;
    seen.add(editorKey(row.riskId, row.controlId));
    const text = (v: string | undefined) => (v ?? '').trim();
    const patch: Partial<Control> = {};
    if (text(row.controlTitle) && text(row.controlTitle) !== c.description) patch.description = text(row.controlTitle);
    if (text(row.riskDescription) && text(row.riskDescription) !== c.riskDescription) patch.riskDescription = text(row.riskDescription);
    if (text(row.riskTitle) !== (c.riskTitle ?? '')) patch.riskTitle = text(row.riskTitle) || undefined;
    if (text(row.controlObjective) !== (c.objective ?? '')) patch.objective = text(row.controlObjective) || undefined;
    if (text(row.controlActivity) !== (c.controlActivity ?? '')) patch.controlActivity = text(row.controlActivity) || undefined;
    if (text(row.subProcess) !== c.subProcess) patch.subProcess = text(row.subProcess);
    if (text(row.controlOwner) && text(row.controlOwner) !== c.owner) patch.owner = text(row.controlOwner);
    if (text(row.effectiveDate) !== (c.effectiveDate ?? '')) patch.effectiveDate = text(row.effectiveDate) || undefined;
    if (text(row.country) !== (c.country ?? '')) patch.country = text(row.country) || undefined;
    const nature = oneOf(NATURES, text(row.controlNature));
    if (nature && nature !== c.nature) patch.nature = nature;
    const type = oneOf(TYPES, text(row.controlType));
    if (type && type !== c.type) patch.type = type;
    const freq = oneOf(FREQS, text(row.frequency));
    if (freq && freq !== c.frequency) patch.frequency = freq;
    const rating = oneOf(RATINGS, text(row.riskRating));
    if (rating && rating !== c.riskRating) patch.riskRating = rating;
    const strategy = oneOf(TESTING_STRATEGIES, text(row.testingStrategy));
    if (strategy && strategy !== c.testingStrategy) patch.testingStrategy = strategy;
    if (typeof row.isKey === 'boolean' && row.isKey !== c.isKey) patch.isKey = row.isKey;
    if (!Object.keys(patch).length) return c;
    changed++;
    return { ...c, ...patch };
  });

  // Anything the grid has that no control answers to is new work, and lands as
  // a draft row — publishing it is a separate, deliberate act.
  const fresh: Control[] = [];
  const taken = new Set(next.map(c => c.id));
  rows.forEach(row => {
    const key = editorKey(row.riskId, row.controlId);
    if (byKey.has(key) || seen.has(key)) return;
    const title = (row.controlTitle ?? '').trim() || (row.controlActivity ?? '').trim();
    if (!title || !(row.riskDescription ?? '').trim()) return;
    let id = (row.controlId ?? '').trim() || `${row.riskId}/C${String(fresh.length + 1).padStart(3, '0')}`;
    while (taken.has(id)) id = `${id}-2`;
    taken.add(id);
    fresh.push({
      id,
      wpRef: id,
      description: title,
      process,
      subProcess: (row.subProcess ?? '').trim(),
      nature: oneOf(NATURES, row.controlNature ?? '') ?? 'Manual',
      type: oneOf(TYPES, row.controlType ?? '') ?? 'Preventive',
      frequency: oneOf(FREQS, row.frequency ?? '') ?? 'Monthly',
      isKey: row.isKey === true,
      precision: title,
      owner: (row.controlOwner ?? '').trim(),
      riskId: (row.riskId ?? '').trim() || id,
      riskDescription: (row.riskDescription ?? '').trim(),
      assertions: [],
      ...((row.riskTitle ?? '').trim() ? { riskTitle: row.riskTitle!.trim() } : {}),
      ...((row.controlObjective ?? '').trim() ? { objective: row.controlObjective!.trim() } : {}),
      ...((row.controlActivity ?? '').trim() ? { controlActivity: row.controlActivity!.trim() } : {}),
      ...((row.entity ?? '').trim() ? { entity: row.entity!.trim() } : {}),
      ...((row.effectiveDate ?? '').trim() ? { effectiveDate: row.effectiveDate!.trim() } : {}),
      ...((row.country ?? '').trim() ? { country: row.country!.trim() } : {}),
      ...(oneOf(TESTING_STRATEGIES, row.testingStrategy ?? '') ? { testingStrategy: oneOf(TESTING_STRATEGIES, row.testingStrategy ?? '')! } : {}),
      ...(oneOf(RATINGS, row.riskRating ?? '') ? { riskRating: oneOf(RATINGS, row.riskRating ?? '')! } : {}),
      design: { documents: [], points: [], conclusion: 'Not tested', testedBy: null, testedAt: null },
      operating: { method: 'Manual', steps: [], conclusion: 'Not tested', testedBy: null, testedAt: null },
    });
  });

  return { controls: [...next, ...fresh], changed, added: fresh.length };
}

/** "Risk that year-end accruals are understated because no review is performed"
 *  → "Year-end accruals are understated". A TRIM, never a rewrite: the words a
 *  risk sentence always opens with are dropped, and what explains WHY the risk
 *  exists is cut, because the reason belongs to the description. Nothing is
 *  added that the description did not already say.
 *
 *  What is deliberately NOT cut is a trailing qualifier — "granted WITHOUT
 *  approval", "paid TWICE". Those carry the negative the whole risk turns on,
 *  and a title that dropped them would state the opposite of the risk it names.
 *  So the length cap is a last resort, applied at a word boundary, and a title
 *  that needs every one of its words keeps them.
 *
 *  Used where an uploaded file carried no Risk title of its own, and by the seed
 *  registers, which predate the column (17 Sep). */
export function titleFromRisk(text: string): string {
  const body = String(text ?? '')
    .replace(/^\s*(?:the\s+)?risk\s+(?:that|of|is\s+that)\s+/i, '')
    .replace(/^\s*there\s+is\s+a\s+risk\s+(?:that|of)\s+/i, '')
    .replace(/^\s*(?:potential|possibility|chance)\s+(?:that|of)\s+/i, '')
    .trim();
  if (!body) return '';
  // First the sentence's own punctuation, then the connector that introduces the
  // cause — "because no review is performed" is the description's job, not the
  // title's.
  const firstClause = (body.split(/[,;:]\s|\s[—–-]\s|\.(?:\s|$)/)[0] ?? '').trim();
  const reason = /\s\b(?:because|since|as|due\s+to|owing\s+to|resulting\s+in|leading\s+to|so\s+that|such\s+that|thereby|which\s+(?:could|may|might|would))\b\s/i.exec(firstClause);
  const cut = (reason ? firstClause.slice(0, reason.index) : firstClause).replace(/[.;:,]+$/, '').trim();
  if (!cut) return '';
  // Only a genuinely unwieldy title is truncated, and then at a word boundary so
  // it never ends mid-word.
  const MAX = 72;
  const out = cut.length <= MAX ? cut : `${cut.slice(0, cut.lastIndexOf(' ', MAX)).replace(/[.;:,]+$/, '')}…`;
  return out[0]!.toUpperCase() + out.slice(1);
}
