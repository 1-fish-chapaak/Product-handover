import type {
  Conclusion, Control, Court, Deficiency, DesignTrack, HandoffTask, IcfrEngagement,
  Likelihood, MaterialityRules, OperatingTrack, Role, Severity, TrackConclusion,
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
export function assessSeverity(d: Deficiency, eng: IcfrEngagement): SeverityAssessment {
  const raw = severityOf(d, eng.materiality, eng.rules);
  let out: SeverityAssessment;
  if (!d.compensatingControlId) out = { raw, final: raw, capped: false };
  else if (d.mwIndicators.length > 0) out = { raw, final: raw, capped: false, capBlocked: 'mw-indicator' };
  else {
    const cc = eng.controls.find(c => c.id === d.compensatingControlId);
    if (!cc || controlConclusion(cc) !== 'Effective') out = { raw, final: raw, capped: false, capBlocked: 'not-effective' };
    else if (raw === 'Material Weakness') out = { raw, final: 'Significant Deficiency', capped: true };
    else out = { raw, final: raw, capped: false };
  }
  // prudent-official: judgment argues UP only — applied after the cap, never below it
  if (d.prudentOverride && SEVERITY_RANK[d.prudentOverride.to] > SEVERITY_RANK[out.final]) {
    out = { ...out, final: d.prudentOverride.to, bumped: true };
  }
  return out;
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
  return eng.controls.filter(c => c.process === 'IT General Controls' && controlConclusion(c) === 'Ineffective');
}
export function isItgcDependent(c: Control): boolean {
  return c.nature !== 'Manual' && c.process !== 'IT General Controls';
}

// ─── Frequency-based sample sizing (handbook table) ───────────────────────────────
// Annual 1 · Quarterly 2 · Monthly 2–5 · Weekly 5–15 · Daily 15–40 · Recurring
// (per-transaction) 25–60 · Automated nature = test of one, valid only while ITGCs hold.
export function sampleSizeGuide(c: Control, itgcHolds = true): { suggested: number; range: string; note: string } {
  if (c.nature === 'Automated' && itgcHolds) return { suggested: 1, range: 'test of one', note: 'Automated — one instance proves the rule, valid only while ITGCs hold.' };
  if (c.nature === 'Automated' && !itgcHolds) return { suggested: 25, range: '25–60', note: 'ITGC failure in force — test of one is invalid; size like a manual control.' };
  switch (c.frequency) {
    case 'Annual': return { suggested: 1, range: '1', note: 'Runs once a year — test the occurrence.' };
    case 'Quarterly': return { suggested: 2, range: '2', note: 'Test two quarters.' };
    case 'Monthly': return { suggested: 4, range: '2–5', note: 'A handful of months.' };
    case 'Weekly': return { suggested: 10, range: '5–15', note: 'Spread across the period.' };
    case 'Daily': return { suggested: 25, range: '15–40', note: 'A meaningful spread of days.' };
    case 'Recurring': return { suggested: 40, range: '25–60', note: 'Runs many times a day — the deepest samples.' };
    case 'Ad-hoc': return { suggested: 10, range: 'judgment', note: 'Size by how often it actually ran.' };
  }
}

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
export function controlConclusion(c: Control): Conclusion {
  const d = trackResult(c.design); const o = trackResult(c.operating);
  if (d === 'Ineffective' || o === 'Ineffective') return 'Ineffective';
  if (d === 'Effective' && o === 'Effective') return 'Effective';
  return designStarted(c) || operatingStarted(c) ? 'In progress' : 'Not started';
}

// ─── Locks — a concluded control is frozen until reopened with a reason ──────────
export function isControlLocked(c: Control): boolean {
  const concl = controlConclusion(c);
  return concl === 'Effective' || concl === 'Ineffective';
}
// A countersigned engagement is locked for good — no edits, no reopen.
export function isEngagementLocked(eng: IcfrEngagement): boolean {
  return !!(eng.signoff.preparer && eng.signoff.reviewer);
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
export function validationSummary(text: string, fail: boolean, key = text): string {
  const h = hnum(key);
  const n = [15, 25, 25, 40][h % 4]!;
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

// ─── Baton — whose court ─────────────────────────────────────────────────────────

export function courtFor(c: Control, tasks: HandoffTask[]): Court {
  if (tasks.some(t => t.controlId === c.id && t.assigneeRole === 'risk-owner' && t.status === 'open')) return 'risk-owner';
  const concl = controlConclusion(c);
  // A concluded control is closed out (no separate reviewer court on this platform).
  if (concl === 'Effective' || concl === 'Ineffective') return 'none';
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
export function isConcluded(c: Control): boolean {
  const x = controlConclusion(c);
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
export function testDueDisplay(c: Control): { label: string; cls: string } {
  const concl = controlConclusion(c);
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

export function engagementProgress(eng: IcfrEngagement) {
  const cs = eng.controls;
  const concl = cs.map(controlConclusion);
  return {
    total: cs.length,
    designDone: cs.filter(c => trackResult(c.design) !== 'Not tested').length,
    operatingDone: cs.filter(c => trackResult(c.operating) !== 'Not tested').length,
    effective: concl.filter(x => x === 'Effective').length,
    ineffective: concl.filter(x => x === 'Ineffective').length,
    inProgress: concl.filter(x => x === 'In progress').length,
    waitingOnOwner: cs.filter(c => courtFor(c, eng.tasks) === 'risk-owner').length,
  };
}

export function tasksForRole(eng: IcfrEngagement, role: Role): HandoffTask[] {
  return eng.tasks.filter(t => t.assigneeRole === role && t.status === 'open');
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
