import { isInquiryOnly } from './types';
import type {
  Conclusion, Control, Court, Deficiency, DesignDoc, DesignTrack, HandoffTask, IcfrEngagement,
  Likelihood, MaterialityRules, OperatingTrack, PopulationBasis, ReviewNote, RiskRating, Role, Severity, TrackConclusion,
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
/** A shortfall is held tighter, and deliberately so. See `countVerdict`. */
const UNDER_BAND = 0.02;

/** Where the surplus rows sit, as a hypothesis worth checking.
 *
 *  Grouped rather than listed because the question an over-inclusive filter
 *  raises is "what did I sweep in", and three named buckets answer that faster
 *  than a thousand rows. Deterministic from the control id — a diagnosis that
 *  reshuffles on every render is not a diagnosis. */
function overBreakdown(c: Control, excess: number): { label: string; n: number }[] {
  if (excess < 3) return [];
  let s = c.id.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 11);
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const labels = ['Reversals and cancellations', 'Duplicate references', 'Transaction type not in scope', 'Outside the date window', 'A second entity in the file'];
  const picked = [labels[Math.floor(next() * 2)], labels[2], labels[3 + Math.floor(next() * 2)]];
  const w = picked.map(() => next() + 0.25);
  const total = w.reduce((a, b) => a + b, 0);
  // Every bucket but the last is rounded off the weights; the last takes the
  // remainder so the buckets always add to the surplus exactly. A breakdown
  // that doesn't reconcile is worse than no breakdown at all — so where the
  // remainder won't cover a bucket, that bucket is dropped rather than fudged.
  const out: { label: string; n: number }[] = [];
  let left = excess;
  picked.forEach((label, i) => {
    if (i === picked.length - 1) { if (left > 0) out.push({ label, n: left }); return; }
    const n = Math.max(1, Math.round((excess * w[i]) / total));
    if (n < left) { out.push({ label, n }); left -= n; }
  });
  return out;
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
 *  while a run count never is. */
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
        detail: `${diff.toLocaleString()} more than expected, ${pct}% over. Extra rows are not a hole in the test — the risk is sampling an item this control never touched, which turns up later as an exception that was never real.`,
        breakdown: overBreakdown(c, diff),
        causes: 'Commonly duplicates, reversals, a transaction type outside the scope, one month too many in the window, or a second entity sitting in the same file.',
      };
    }

    // Short. Tighter band, and a different kind of problem.
    if (off <= UNDER_BAND) {
      return { level: 'pass', blocks: false, headline, detail: `${Math.abs(diff).toLocaleString()} under, ${pct}% — inside the 2% band held for shortfalls.${runNote}` };
    }
    return {
      level: 'fail', blocks: true, headline,
      detail: `${Math.abs(diff).toLocaleString()} fewer than expected, ${pct}% short. An instance that is not in the population can never be sampled, so this is a completeness gap rather than a filter that swept too wide — which is why a shortfall is held to a tighter band than an overshoot.`,
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

/** Does the filter window cover the window the audit is testing?
 *
 *  Both dates are held, so this is subtraction. A window that opens late or
 *  closes early leaves a stretch of the period untested, and the gap is stated
 *  in days rather than left for someone to notice. */
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
  return { level: 'pass', blocks: false, headline: `${fmtDate(pop.filterFrom)} – ${fmtDate(pop.filterTo)}`, detail: `Covers the whole audit period, ${fmtDate(windowFrom)} – ${fmtDate(windowTo)}.` };
}

/** Everything that has to be settled before the population can be locked: every
 *  blocking check answered, and the three source facts in.
 *
 *  Not every disagreement blocks. A variance inside its band is shown and passed
 *  over; only the ones that hold the lock need an answer, and either answer will
 *  do — a refilter that removes the disagreement, or a reason recorded against
 *  it, because sometimes the filter is wrong and sometimes the expectation is. */
export function populationReady(c: Control, windowFrom?: string, windowTo?: string): boolean {
  const pop = c.operating.population;
  if (!pop) return false;
  const cv = countVerdict(c);
  const gv = coverageVerdict(c, windowFrom, windowTo);
  if (cv?.blocks && !pop.countNote?.trim()) return false;
  if (gv?.blocks && !pop.coverageNote?.trim()) return false;
  const p = pop.provenance;
  return !!p?.system.trim() && !!p.extractedBy.trim() && !!p.extractedOn.trim();
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
  if (c.nature === 'Automated' && !itgcHolds) return { suggested: 25, range: '25–60', note: 'ITGC failure in force — test of one is invalid; size like a manual control.' };
  const band = SIZE_BANDS[c.frequency];
  const rating = c.riskRating;
  const suggested = rating === 'High' ? band.high : rating === 'Low' ? band.low : band.mid;
  return { suggested, range: band.range, note: rating ? `${band.note} ${RATING_NOTE[rating]}` : band.note };
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

export function engagementProgress(eng: IcfrEngagement, controls?: Control[]) {
  // `controls` narrows the count to a subset — the open audit's scope, so the
  // audit Dashboard reports its own six rather than the engagement's thirty-two.
  // Omitted, it counts the whole engagement, which is what every other caller
  // wants.
  const cs = controls ?? eng.controls;
  const concl = cs.map(controlConclusion);
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
