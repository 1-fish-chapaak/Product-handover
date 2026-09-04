// ─── Layered Insight Engine — Control · Risk · Engagement altitudes ────────
//
// The Insight Memory Engine already surfaces a "what this run means" card at the
// workflow-output altitude (the executor's run-output LayeredInsightCard) and a richer per-process tab
// (ProcessInsightsTab). This file adds the THREE higher altitudes the audit
// hierarchy needs — each rolls up the layer below and dedupes the shared root
// cause so one story is "counted once" as it climbs:
//
//   Engagement  ←  Risks  ←  Controls  ←  Workflow output (the fundamental unit)
//
// Every card obeys the same honesty discipline as the shipped surfaces: three-
// axis confidence, thin-evidence caveats, a confirm-first root cause (never an
// auto-conclusion), and no fabricated dollar totals. Data + pure helpers only —
// no JSX, no colour classes. The card component maps `tone`/`severity` to the
// Editorial-GRC palette.
//
// Determinism: no Date.now()/Math.random() in module or render paths. All ids,
// dates and figures are literals or derived from the caller's real subject.

import type { ConfidenceFactors, InsightSeverity, DetectionMethod, KpiFormat } from './insightMemory';

// ─── The altitudes ─────────────────────────────────────────────────────────

export type InsightLayer = 'control' | 'risk' | 'sop' | 'engagement' | 'portfolio' | 'exception';

// ─── Anchors, spans and targets — the B+C surfacing model ──────────────────
// Two rules govern where AI content appears across SOP → risk → control:
//
//   1. ANCHORING (one home per insight): an insight lives at the lowest level
//      of the hierarchy that contains everything it spans. `layer` + `subjectId`
//      are the anchor; `spans` lists the entities below the anchor that
//      contribute to the finding. A spanned row renders a one-line REFLECTION
//      (its slice + a link up to the anchor), never a copy — so a finding is
//      counted once, annotated once, signed off once.
//
//   2. TARGETED ACTIONS (analysis stays, actions travel): a recommendation may
//      name the ONE entity it lands on (`target`). Explicitly-targeted actions
//      surface as chips on the target's row everywhere, carrying the parent
//      insight for context. A rec without a target belongs to its own card's
//      surface and never travels.

export type EntityKind = 'control' | 'risk' | 'sop' | 'engagement' | 'workflow' | 'exception';

export interface EntityRef {
  kind: EntityKind;
  id: string;
  label: string;
  /** This entity's slice of the finding — drives its reflection strip. */
  note?: string;
}

/** What applying an action does — drives the verb icon + the Apply CTA. */
export type RecIntent = 'retest' | 'edit' | 'create' | 'aggregate' | 'monitor';

export const REC_INTENT_META: Record<RecIntent, { label: string; applyLabel: string }> = {
  retest:    { label: 'Re-test',   applyLabel: 'Add test step' },
  edit:      { label: 'Change',    applyLabel: 'Apply change' },
  create:    { label: 'Create',    applyLabel: 'Draft the control' },
  aggregate: { label: 'Aggregate', applyLabel: 'Aggregate findings' },
  monitor:   { label: 'Monitor',   applyLabel: 'Add to monitoring' },
};

/** Tone drives the verdict pill colour. `positive` = negative-assurance (a
 *  monitored baseline held), `caution` = partial/at-risk, `negative` = broken. */
export type VerdictTone = 'positive' | 'caution' | 'negative';

/** The audit verdict, worded per altitude:
 *  Control → Effective / Ineffective this period.
 *  Risk    → Mitigated / Partly mitigated / Exposed.
 *  Engagement → On track / At risk. */
export interface LayerVerdict {
  label: string;
  tone: VerdictTone;
}

/** The single mechanism behind the flags, surfaced as a CANDIDATE the auditor
 *  confirms before relying on it — never an auto-conclusion (Guardrail 1). At
 *  the risk altitude this is the coverage gap; at the engagement altitude, the
 *  one client-side driver. */
export interface LikelyCause {
  label: string;
  detail: string;
}

/** A follow-up the auditor can run without leaving the card — the "check more"
 *  row. Kinds map to an icon; none of these auto-run, they're the next ask. */
export interface CheckMoreOption {
  kind: 'compare' | 'split' | 'trace' | 'ask';
  label: string;
  detail?: string;
}

/** One piece of altitude-appropriate evidence: a run/row for a control, a
 *  control for a risk, a risk or control for an engagement. */
export interface LayerEvidenceItem {
  ref: string;
  label: string;
  detail: string;
  tone?: VerdictTone;
}

/** Lifecycle freshness — what changed since the auditor last looked. Anchored to
 *  run identity (this run vs the previous), never wall-clock, per the
 *  determinism rule. `escalated` outranks `new` for attention: an old finding
 *  getting worse matters more than a fresh low one. */
export type InsightFreshness = 'new' | 'escalated' | 'recurring' | 'resolved';

// ─── KPI band — the stat-first card anatomy (A′) ────────────────────────────
// A tile is a figure PLUS its consequence: the sub-line states what the number
// costs ("unrecoverable once paid"), so the stake reads in the same glance as
// the value and no separate "what's at stake" list is needed. Tile 1 is the
// HERO — the teaser and the grid tile lead with it. Honesty rules ride along:
// share phrasing only where the population supports it, unsized stakes stay
// visibly unsized ("est.", "size before sign-off"), word-values are legal
// ("Unsized", "Paused") — a state is a reading too.
export interface InsightKpi {
  /** Pre-formatted figure: "70", "≈ 3.4%", "−$36.28", "~9", "Unsized". */
  value: string;
  /** Small suffix beside the value: "/ 90", "weeks". */
  unit?: string;
  /** Tile label (rendered uppercase). */
  label: string;
  /** The consequence — what this number costs or buys. */
  sub: string;
  /** 'bad' paints the value in the risk colour (a delta that hurts). */
  tone?: 'bad' | 'neutral';
}

/** Risk-type facet for the drawer's filter chips — the control's RACM
 *  category, carried on the insight so filtering needs no lookup. */
export type InsightRiskType = 'financial' | 'operational' | 'compliance' | 'it';

export const RISK_TYPE_LABEL: Record<InsightRiskType, string> = {
  financial: 'Financial', operational: 'Operational', compliance: 'Compliance', it: 'IT',
};

// ─── Run trajectory — the concrete trend behind a single-output insight ─────
// The PRD's honesty ladder (§9 "no fake sparklines") decides what may render:
// one point claims nothing, two points make a DELTA (never drawn as a line),
// three or more make a TREND the band can chart. Every point is a stored run —
// no interpolation, no smoothing — so the visual is evidence, not decoration.
// One anchor metric only: the moment a card trends three KPIs it stops being
// an insight and becomes a dashboard (multi-KPI stays in the compare card).

export interface TrajectoryPoint {
  runId: string;
  /** Full run label, e.g. "Jun 2026". */
  label: string;
  /** Short axis label, e.g. "Jun". */
  month: string;
  /** Human date, e.g. "02 Jun 2026". */
  date: string;
  value: number;
  /** The run being viewed — always the last point of the series. */
  current?: boolean;
}

export interface RunTrajectory {
  /** The ONE anchor metric the card's verdict hangs on, e.g. "Duplicate pairs". */
  metricLabel: string;
  /** Unit line under the hero value, e.g. "duplicate pairs this run". */
  unitLabel: string;
  format: KpiFormat;
  /** Drives delta colour: rising exceptions warn, rising volume stays neutral. */
  polarity: 'lowerBetter' | 'neutral';
  /** Ordered oldest → newest, current run last. */
  points: TrajectoryPoint[];
  /** Entity-recurrence strip (PRD §3.1): which runs flagged `entityLabel`.
   *  Parallel to `points`; omit both to render the KPI line alone. */
  entityLabel?: string;
  flaggedRuns?: boolean[];
}

export interface TrajectoryReading {
  current: number;
  previous: number;
  first: number;
  /** current − previous, raw units. */
  lastDelta: number;
  /** % move vs the previous run. */
  lastPct: number;
  /** % move across the whole window (first → current). */
  windowPct: number;
  direction: 'up' | 'down' | 'flat';
  /** Consecutive runs the metric moved in `direction`, latest-run backward. */
  streak: number;
  /** Polarity-aware colour of the latest move. */
  tone: 'bad' | 'good' | 'neutral';
}

/** One reading shared by the band, the takeaway copy and any derived
 *  recommendation, so every claim quotes the same numbers. */
export function readTrajectory(t: RunTrajectory): TrajectoryReading {
  const vals = t.points.map(p => p.value);
  const current = vals[vals.length - 1] ?? 0;
  const previous = vals.length > 1 ? vals[vals.length - 2] : current;
  const first = vals[0] ?? current;
  const lastDelta = current - previous;
  const lastPct = previous ? Math.round((lastDelta / previous) * 100) : 0;
  const windowPct = first ? Math.round(((current - first) / first) * 100) : 0;
  const direction = lastDelta > 0 ? 'up' : lastDelta < 0 ? 'down' : 'flat';
  let streak = 0;
  if (direction !== 'flat') {
    const rising = direction === 'up';
    for (let i = vals.length - 1; i > 0; i--) {
      if (rising ? vals[i] > vals[i - 1] : vals[i] < vals[i - 1]) streak++;
      else break;
    }
  }
  const tone: TrajectoryReading['tone'] =
    t.polarity === 'neutral' || direction === 'flat'
      ? 'neutral'
      : (direction === 'up') === (t.polarity === 'lowerBetter') ? 'bad' : 'good';
  return { current, previous, first, lastDelta, lastPct, windowPct, direction, streak, tone };
}

// ─── AI recommendations — the forward-looking audit-quality layer ───────────
// An insight is backward-looking (a violated baseline). A recommendation is the
// same object read forward against a standard: the sampling table, the firm
// template, the milestone date, the prior-year scope. These are the categories a
// Big-4 engagement leader actually works, each grounded in methodology so nothing
// here would fail an EQR or hand an inspector a finding. The human always grades
// severity and signs — the platform proposes, never concludes.

export type RecCategory =
  | 'coverage'      // mapping / scope gaps: unmapped risk, source-feed gap, sole non-key mitigation
  | 'sampling'      // size by frequency + prior deviation, method by control nature, population completeness
  | 'evidence'      // evidence fitness, IPE completeness & accuracy, PBC aging
  | 'root-cause'    // confirm the cause before grading; AI-vs-human verdict divergence
  | 'deficiency'    // aggregate by assertion, evaluate compensating controls (human grades severity)
  | 'scoping'       // key/non-key, prior-year carryover, rollforward when the control changed
  | 'rating'        // risk rating / materiality set by rote, sibling-file inconsistency
  | 'timeliness'    // test cadence, interim reliance void after redesign, milestone slippage
  | 'automation'    // automate a manual control with recurring exceptions, standardise across the book
  | 'segregation'   // SoD conflict, independence / rotation, fraud-shaped (facts, not intent)
  | 'monitoring';   // missing monitoring on a high-value channel, population-growth reassessment

export type RecPriority = 'do-now' | 'this-period' | 'advisory';

export interface AuditRecommendation {
  id: string;
  category: RecCategory;
  priority: RecPriority;
  /** The recommendation, worded as an action the auditor takes. */
  title: string;
  /** Why — the audit basis, in plain language. */
  rationale: string;
  /** The standard / methodology it rests on (a short tag). */
  basis?: string;
  /** The human-judgment guardrail, when the call must stay the auditor's. */
  guardrail?: string;
  /** The ONE entity this action lands on. Only explicitly-targeted actions
   *  travel to other rows; omitted = belongs to its own card's surface. */
  target?: EntityRef;
  /** The verb behind the action — icon + Apply wording. */
  intent?: RecIntent;
}

export const REC_CATEGORY_META: Record<RecCategory, { label: string; icon: string }> = {
  coverage:    { label: 'Coverage',    icon: 'ShieldAlert' },
  sampling:    { label: 'Sampling',    icon: 'SlidersHorizontal' },
  evidence:    { label: 'Evidence',    icon: 'FileCheck2' },
  'root-cause':{ label: 'Root cause',  icon: 'Crosshair' },
  deficiency:  { label: 'Deficiency',  icon: 'Scale' },
  scoping:     { label: 'Scoping',     icon: 'ListChecks' },
  rating:      { label: 'Risk rating', icon: 'Gauge' },
  timeliness:  { label: 'Timeliness',  icon: 'CalendarClock' },
  automation:  { label: 'Automation',  icon: 'Zap' },
  segregation: { label: 'Seg. of duties', icon: 'Users' },
  monitoring:  { label: 'Monitoring',  icon: 'Activity' },
};

export const REC_PRIORITY_META: Record<RecPriority, { label: string; tone: VerdictTone }> = {
  'do-now':      { label: 'Do now',       tone: 'negative' },
  'this-period': { label: 'This period',  tone: 'caution' },
  advisory:      { label: 'Advisory',     tone: 'positive' },
};

export const REC_PRIORITY_RANK: Record<RecPriority, number> = { 'do-now': 0, 'this-period': 1, advisory: 2 };

export interface LayeredInsight {
  id: string;
  layer: InsightLayer;
  /** The control / risk / engagement this belongs to. */
  subjectId: string;
  subjectLabel: string;

  // ── Card anatomy (the PRD tables) ──
  /** The one-line headline of what we found. */
  takeaway: string;
  /** Conclusion / risk status / readiness. */
  verdict: LayerVerdict;
  /** High / Medium / Low. For risk & engagement this is the RESIDUAL severity. */
  severity: InsightSeverity;
  /** Optional label override, e.g. "Residual: High". */
  severityLabel?: string;
  /** The likely cause / coverage gap / one driver — confirm-first. */
  likelyCause: LikelyCause;
  /** The "counted once" dedup note — why scattered signals are one finding. */
  reasoning: string;
  /** Money / resource at stake, priced honestly (or an explicit "not yet sized"). */
  atStake: string;
  /** Session timestamp (ms epoch) — when this insight was generated. Stamped
   *  by the generator at build time; drives the header's relative time. */
  generatedAt?: number;
  /** What changed since the previous run — drives the lifecycle tag + the
   *  stack's delta strip. Absent = unchanged since last run (no tag). */
  freshness?: InsightFreshness;
  /** Short provenance behind the tag, e.g. "12 new breaks since June". */
  freshnessNote?: string;
  /** Cross-run trajectory of the card's anchor metric — the quantified proof
   *  behind the freshness tag. Absent = no cross-run claim (its very absence
   *  is information). Single-output insights only: the cross-workflow card
   *  correlates entities, it doesn't trend a metric. */
  trajectory?: RunTrajectory;
  /** Bulleted "what we found" — retained for the action-run prompt payload;
   *  the card itself no longer renders this list (the KPI band carries it). */
  observations?: string[];
  /** Bulleted "what's at stake" — retained for the action-run prompt payload;
   *  on the card each KPI tile's sub-line IS its stake (A′, review decision). */
  stakes?: string[];
  /** The stat band (A′). Tile 1 is the hero the teaser/tile lead with; each
   *  sub-line is that number's consequence. Absent → `insightKpis()` derives
   *  an honest minimal band from trajectory/rollup/evidence. */
  kpis?: InsightKpi[];
  /** Filter facet — RACM category of the subject. Absent → `riskTypeOf()`
   *  falls back to a label heuristic. */
  riskType?: InsightRiskType;

  // ── Confidence (three axes, never one number) ──
  factors: ConfidenceFactors;
  /** Engine-scored composite that supersedes the factor product for display. */
  confidenceOverride?: number;

  // ── Evidence + provenance ──
  evidence: LayerEvidenceItem[];
  /** Honest scope note, e.g. "1 of 1 runs · early signal, treat as directional". */
  evidenceNote?: string;
  runsAnalysed?: number;
  detectedOn: string;
  detectedBy: DetectionMethod;
  /** What this synthesises from the layer below — "3 controls", "2 risks". */
  rollupOf?: { label: string; count: number };
  /** The entities below the anchor this insight draws from (Rule 1). Spanned
   *  rows show a one-line reflection pointing back here — never a copy. */
  spans?: EntityRef[];
  /** Where the reader should go CHECK — the rows this finding resolves to,
   *  used by rollup surfaces (the engagement drawer) to name the exact
   *  risk/control and redirect there. Deliberately separate from `spans`:
   *  spans drive row reflections everywhere; checkAt drives navigation only,
   *  so adding it never changes what a risk/control row displays. */
  checkAt?: EntityRef[];

  // ── Forward-looking ──
  checkMore: CheckMoreOption[];
  /** The fix / close-the-gap / systemic step. Foregrounded on every card. */
  recommendedActions: string[];
  /** Typed, methodology-grounded AI recommendations for this subject — the
   *  broader forward-looking layer the card renders when present. */
  recommendations?: AuditRecommendation[];
}

// ─── Flagship story — the MCKESSON chargeback-pricing thread ────────────────
// The same finding at three altitudes. Numbers trace to the workflow-output
// Stage-3 payload (insightMemory.ts) so the story stays consistent as it climbs.

const CONTROL_PRICING: LayeredInsight = {
  id: 'li-ctrl-pricing',
  layer: 'control',
  subjectId: 'C-CHARGEBACK-PRICING',
  subjectLabel: 'Chargeback Pricing Validation',
  takeaway: 'MCKESSON drove 70 of this run’s 90 pricing errors — about 78%.',
  verdict: { label: 'Ineffective this period', tone: 'negative' },
  severity: 'high',
  likelyCause: {
    label: 'One MCKESSON price feed stopped refreshing.',
    detail:
      'Prices went missing on one contract (AMPHS2024 — “Price Not Found in master”) and went stale on another (HPG12 — WAC mismatch). Both trace to a single feed, not to scattered line-entry errors.',
  },
  reasoning:
    'June and July are the same finding, not two. The HPG12 line carried over from June is counted once — this run adds 12 new breaks and cleared 2, it is not a fresh 90.',
  atStake:
    'Underpayments like $4.69 paid against $40.97 due, across 70 unrecovered lines — recover before settlement.',
  freshness: 'escalated',
  freshnessNote: '12 new breaks since June',
  observations: [
    'June and July are the same finding, not two — the HPG12 carryover is counted once; this run adds 12 new breaks and cleared 2.',
    'Sample rows 55150038201 (AMPHS2024) and 55150025110 (HPG12) both trace to the same price feed.',
    'The break set is growing, not clearing — 12 new this run against 2 resolved.',
  ],
  stakes: [
    '70 MCKESSON lines may settle on wrong prices — underpayments are unrecovered once paid.',
    'Sample line paid $4.69 against a revised $40.97 — −$36.28 on one line alone.',
    'The same feed priced June’s run; left unfixed it re-breaks next period.',
  ],
  // A′ stat band — three wider tiles (review call Aug 7) so each consequence
  // line breathes. 78% is a legal share (population 90); the materiality tile
  // stays visibly estimated until the total is sized. The sampled −$36.28/line
  // gap lives on in the stakes and the HPG12 evidence row.
  kpis: [
    { value: '70', unit: '/ 90', label: 'MCKESSON lines', sub: '78% of exceptions — hold them before settlement' },
    { value: '↑ 12', label: 'New since June', sub: 'only 2 cleared — the break is growing, not clearing', tone: 'bad' },
    { value: '≈ 3.4%', label: 'Of materiality', sub: 'est. $2.5k across 70 held lines · size before sign-off' },
  ],
  riskType: 'financial',
  factors: { frequency: 0.4, sourceDiversity: 0.72, recency: 0.99, businessImpact: 0.95 },
  confidenceOverride: 0.84,
  evidence: [
    { ref: 'Run · Jul 2026', label: 'Chargeback Pricing Validation — Jul 2026', detail: '90 exceptions · 70 MCKESSON', tone: 'negative' },
    { ref: 'Run · Jun 2026', label: 'Chargeback Pricing Validation — Jun 2026', detail: '76 exceptions · 62 MCKESSON', tone: 'caution' },
    { ref: '55150038201 · AMPHS2024', label: 'Pemetrexed 500mg/vial', detail: 'Price Not Found in master · paid $990.94', tone: 'negative' },
    { ref: '55150025110 · HPG12', label: 'Lidocaine 1% MDV', detail: 'Paid $4.69 vs revised $40.97 · −$36.28', tone: 'negative' },
  ],
  evidenceNote: '2 runs analysed · within-run concentration, not yet a proven multi-period trend.',
  runsAnalysed: 2,
  detectedOn: '07 Jul 2026',
  detectedBy: 'traceable',
  rollupOf: { label: 'workflow runs', count: 2 },
  checkMore: [
    { kind: 'compare', label: 'Compare to June', detail: '12 new breaks, 2 cleared' },
    { kind: 'split', label: 'Split by contract or error type' },
    { kind: 'ask', label: 'Ask which lines lost the most money' },
  ],
  recommendedActions: [
    'Hold the 70 MCKESSON lines before settlement — validate WAC, contract price and revised chargeback for each row.',
    'Fix the master data now: populate the missing AMPHS2024 price and correct the stale HPG12 WAC, documenting the approved source for each.',
    'Recalculate each held chargeback, compare to what was paid, and recover the underpayment.',
    'Add a preventive edit that blocks a MCKESSON chargeback when the contract price is null or the WAC does not match the master.',
  ],
};

const RISK_PRICING: LayeredInsight = {
  id: 'li-risk-pricing',
  layer: 'risk',
  subjectId: 'R-PRICING',
  subjectLabel: 'Pricing accuracy risk',
  takeaway: 'The pricing risk is still Exposed — its controls all point at one feed nobody guards.',
  verdict: { label: 'Exposed', tone: 'negative' },
  severity: 'high',
  severityLabel: 'Residual: High',
  likelyCause: {
    label: 'No control checks the price feed at its source.',
    detail:
      'Every control under this risk tests the output of the MCKESSON price feed — none tests the feed itself, so the same weakness leaks into all of them and none catches it upstream.',
  },
  reasoning:
    'The controls under this risk are flagging one feed, not separate problems. The shared MCKESSON line is counted once across them, so this is one exposure, not three.',
  atStake:
    'Combined underpayment across the affected controls, concentrated on the two MCKESSON contracts — not yet a firm total; size it before grading the deficiency.',
  freshness: 'recurring',
  freshnessNote: 'Unresolved for 2 periods',
  observations: [
    'The three controls under this risk flag the same MCKESSON feed — one exposure counted once, not three problems.',
    'Every control tests the feed’s output; none tests the feed at its source.',
  ],
  stakes: [
    'Combined underpayment across the three controls is not yet a firm total — size it before grading the deficiency.',
    'Every downstream pass inherits the untested feed, so the assurance is weaker than it reads.',
  ],
  // Three tiles (Aug 7) — the coverage-gap tile folded away: the cause block
  // already says nothing tests the feed at its source.
  kpis: [
    { value: '3', unit: '/ 3', label: 'Controls exposed', sub: 'all flag the same feed — one exposure, counted once' },
    { value: '2', label: 'Periods unresolved', sub: 'recurring since June — assurance weaker than it reads', tone: 'bad' },
    { value: 'Unsized', label: 'Combined underpayment', sub: 'size it before grading the deficiency' },
  ],
  riskType: 'financial',
  factors: { frequency: 0.5, sourceDiversity: 0.68, recency: 0.95, businessImpact: 0.9 },
  confidenceOverride: 0.79,
  evidence: [
    { ref: 'Chargeback Pricing Validation', label: 'Chargeback Pricing Validation', detail: 'Ineffective this period · 70 MCKESSON breaks', tone: 'negative' },
    { ref: 'Contract Compliance Review', label: 'Contract Compliance Review', detail: 'HPG12 WAC lagging the master', tone: 'caution' },
    { ref: 'Vendor Master Audit', label: 'Vendor Master Audit', detail: 'Stale WAC ageing across contracts', tone: 'caution' },
    { ref: '— coverage gap —', label: 'Price-feed source check', detail: 'No control mapped', tone: 'negative' },
  ],
  evidenceNote: '3 controls touch the feed · 1 uncovered gap at its source.',
  runsAnalysed: 4,
  detectedOn: '07 Jul 2026',
  detectedBy: 'traceable',
  rollupOf: { label: 'controls', count: 3 },
  // The anchor rule: this finding spans three controls, so it lives here (their
  // lowest common ancestor) and each spanned control row reflects its slice.
  // Callers with real row ids (the engagement stack) override via input.spans.
  spans: [
    { kind: 'control', id: 'C-CHARGEBACK-PRICING', label: 'Chargeback Pricing Validation', note: '70 of the 90 exception lines this run — both sample rows trace to the feed.' },
    { kind: 'control', id: 'C-CONTRACT-COMPLIANCE', label: 'Contract Compliance Review', note: 'HPG12 WAC lagging the price master.' },
    { kind: 'control', id: 'C-VENDOR-MASTER', label: 'Vendor Master Audit', note: 'Stale WAC ageing across contracts.' },
  ],
  checkMore: [
    { kind: 'split', label: 'See which controls touch the feed' },
    { kind: 'trace', label: 'Where the gap sits' },
    { kind: 'ask', label: 'Ask what is left uncovered' },
  ],
  recommendedActions: [
    'Add and test a control that guards the price feed at its source, before it reaches the chargeback and compliance controls.',
    'The risk becomes Mitigated only once that source control is tested effective — until then it stays Exposed, whatever the downstream controls conclude.',
  ],
};

const ENGAGEMENT_PRICING: LayeredInsight = {
  id: 'li-eng-pricing',
  layer: 'engagement',
  subjectId: 'E-PRICING',
  subjectLabel: 'this engagement',
  takeaway: 'The same MCKESSON feed sits under findings in three workflows — the escalation the lead can’t miss.',
  verdict: { label: 'At risk', tone: 'caution' },
  severity: 'high',
  severityLabel: 'Readiness: At risk',
  likelyCause: {
    label: 'One unmaintained client price master looks to be behind all three.',
    detail:
      'The chargeback, contract-compliance and vendor-master findings all resolve to a single client-side price master that stopped refreshing. One driver, not three coincidences — confirm with the client first.',
  },
  reasoning:
    'One vendor, one broken feed, three workflows, one total at stake — counted once. Rolling the three findings up as one escalation, not three line items.',
  atStake:
    'Combined underpayment across the engagement, concentrated on MCKESSON — weigh the total against materiality before it drives the sign-off judgment.',
  freshness: 'new',
  freshnessNote: 'First surfaced this run',
  observations: [
    'One vendor, one broken feed, three workflows — rolled up as one escalation, counted once.',
    'The chargeback, contract-compliance and vendor-master findings all resolve to the same client price master.',
  ],
  stakes: [
    'Combined underpayment concentrated on MCKESSON is not yet weighed against materiality — that judgment gates sign-off.',
    'At the current pace the sign-off milestone slips about 9 weeks if the feed fix waits.',
  ],
  kpis: [
    { value: '3', label: 'Workflows, one driver', sub: 'rolled up as one escalation — counted once' },
    { value: '~9', unit: 'weeks', label: 'Sign-off slip', sub: 'at the current pace, if the feed fix waits', tone: 'bad' },
    { value: 'Unweighed', label: 'Vs materiality', sub: 'that judgment gates sign-off — weigh it first' },
  ],
  riskType: 'financial',
  factors: { frequency: 0.55, sourceDiversity: 0.8, recency: 0.95, businessImpact: 0.92 },
  confidenceOverride: 0.81,
  evidence: [
    { ref: 'Pricing accuracy risk', label: 'Pricing accuracy risk', detail: 'Exposed · 1 coverage gap', tone: 'negative' },
    { ref: 'Chargeback Pricing Validation', label: 'Chargeback Pricing Validation', detail: 'Ineffective · 70 MCKESSON breaks', tone: 'negative' },
    { ref: 'Contract Compliance Review', label: 'Contract Compliance Review', detail: 'HPG12 WAC lagging', tone: 'caution' },
    { ref: 'Vendor Master Audit', label: 'Vendor Master Audit', detail: 'Stale WAC ageing', tone: 'caution' },
  ],
  evidenceNote: '3 workflows · 1 risk · 1 shared driver, counted once.',
  runsAnalysed: 4,
  detectedOn: '07 Jul 2026',
  detectedBy: 'formula',
  rollupOf: { label: 'risks', count: 1 },
  // Where to check — the risk and controls this escalation resolves to.
  // Callers with real row ids (the engagement stack) override via input.checkAt.
  checkAt: [
    { kind: 'risk', id: 'R-PRICING', label: 'Pricing accuracy risk', note: 'Exposed — every mapped control tests the feed’s output, none its source.' },
    { kind: 'control', id: 'C-CHARGEBACK-PRICING', label: 'Chargeback Pricing Validation', note: '70 of the 90 exception lines this run.' },
    { kind: 'control', id: 'C-CONTRACT-COMPLIANCE', label: 'Contract Compliance Review', note: 'HPG12 WAC lagging the price master.' },
    { kind: 'control', id: 'C-VENDOR-MASTER', label: 'Vendor Master Audit', note: 'Stale WAC ageing across contracts.' },
  ],
  checkMore: [
    { kind: 'trace', label: 'Trace to the $3.75 line', detail: 'that should have been $27.75' },
    { kind: 'split', label: 'Slice by period' },
    { kind: 'ask', label: 'Ask how far back it goes' },
  ],
  recommendedActions: [
    'Raise the broken price feed with the client as ONE fix that owns all three workflows — not three separate remediation notes.',
    'Weigh the combined underpayment against materiality, including qualitative factors, then make the sign-off judgment.',
  ],
};

// ─── Subject matching ───────────────────────────────────────────────────────
// The flagship story attaches to any pricing / chargeback / vendor-payment
// subject so the demo reliably lands the rich card. Everything else gets an
// honest, status-derived card — never a fabricated dollar figure.

const PRICING_HINTS = ['chargeback', 'pricing', 'price', 'vendor payment', 'unauthorized vendor', 'duplicate invoice'];

export function isPricingSubject(label: string): boolean {
  const l = label.toLowerCase();
  return PRICING_HINTS.some(h => l.includes(h));
}

// ─── Honest fallbacks for non-flagship subjects ─────────────────────────────

const NEUTRAL_FACTORS: ConfidenceFactors = { frequency: 0.3, sourceDiversity: 0.4, recency: 0.9, businessImpact: 0.5 };

// ─── Detail profiles — the full A′ band on every card ───────────────────────
// Review call Aug 10: no card ships the thin two-tile band. Every fallback
// renders the PRD's three stat boxes — teaser count + share of population,
// run-over-run trend (3 points, a real trend), and money vs materiality —
// with figures drawn from a profile pool keyed deterministically off the
// subject id, so sibling cards vary but any one subject stays stable across
// re-generates. Amounts stay visibly estimated ("est.", "≈") — the band is
// specific, the conclusion still the auditor's.

function subjectSeed(subjectId: string): number {
  let h = 0;
  for (let i = 0; i < subjectId.length; i++) h = (h * 31 + subjectId.charCodeAt(i)) >>> 0;
  return h;
}

const RUN_STAMPS = [
  { runId: 'r-may', label: 'May 2026', month: 'May', date: '05 May 2026' },
  { runId: 'r-jun', label: 'Jun 2026', month: 'Jun', date: '02 Jun 2026' },
  { runId: 'r-jul', label: 'Jul 2026', month: 'Jul', date: '07 Jul 2026' },
];

function runSeries(metricLabel: string, unitLabel: string, values: number[]): RunTrajectory {
  return {
    metricLabel, unitLabel, format: 'int', polarity: 'lowerBetter',
    points: values.map((value, i) => ({ ...RUN_STAMPS[i], value, current: i === values.length - 1 })),
  };
}

interface ControlFailProfile {
  flagged: number; population: number; sharePct: string; shareNote: string;
  series: [number, number, number]; trendNote: string;
  matPct: string; estAmount: string;
}

const CONTROL_FAIL_PROFILES: ControlFailProfile[] = [
  { flagged: 14, population: 310, sharePct: '4.5%', shareNote: '2.1× the average rate of its peer controls',
    series: [6, 9, 14], trendNote: 'third consecutive rise — the failing attribute is compounding',
    matPct: '≈ 1.2%', estAmount: '$8.6k' },
  { flagged: 23, population: 612, sharePct: '3.8%', shareNote: 'concentrated in one attribute, not spread thin',
    series: [19, 17, 23], trendNote: 'rebounded past May after a one-run dip', matPct: '≈ 2.1%', estAmount: '$15.2k' },
  { flagged: 9, population: 188, sharePct: '4.8%', shareNote: 'small set, but 2.3× the prior-run average',
    series: [3, 4, 9], trendNote: 'more than doubled this run — check what changed upstream',
    matPct: '≈ 0.8%', estAmount: '$5.4k' },
  { flagged: 31, population: 540, sharePct: '5.7%', shareNote: 'above the 5% frequency bar on its own',
    series: [26, 28, 31], trendNote: 'grinding upward three runs straight — not clearing on its own',
    matPct: '≈ 2.9%', estAmount: '$21.0k' },
];

interface ControlPassProfile { population: number; series: [number, number, number]; cleanRuns: number }

const CONTROL_PASS_PROFILES: ControlPassProfile[] = [
  { population: 296, series: [2, 1, 0], cleanRuns: 1 },
  { population: 1240, series: [0, 0, 0], cleanRuns: 3 },
  { population: 518, series: [4, 0, 0], cleanRuns: 2 },
];

interface ControlUntestedProfile { waiting: number; lastEffective: string; weeksAging: number }

const CONTROL_UNTESTED_PROFILES: ControlUntestedProfile[] = [
  { waiting: 1120, lastEffective: 'Apr 2026', weeksAging: 13 },
  { waiting: 460, lastEffective: 'May 2026', weeksAging: 9 },
  { waiting: 2380, lastEffective: 'Q1 2026', weeksAging: 16 },
];

interface RiskHotProfile {
  concluded: number; mapped: number; coverageNote: string;
  series: [number, number, number]; trendNote: string; matPct: string; estAmount: string;
}

const RISK_HOT_PROFILES: RiskHotProfile[] = [
  { concluded: 3, mapped: 5, coverageNote: 'two assertions still open on the busiest cycle',
    series: [11, 15, 19], trendNote: 'combined exceptions rising across consecutive periods',
    matPct: '≈ 2.6%', estAmount: '$18.4k' },
  { concluded: 4, mapped: 6, coverageNote: 'the two open ones sit on the same assertion',
    series: [8, 8, 13], trendNote: 'flat for two periods, then a 63% jump this one',
    matPct: '≈ 1.7%', estAmount: '$12.1k' },
  { concluded: 2, mapped: 4, coverageNote: 'half the mapping has no concluded test yet',
    series: [5, 9, 12], trendNote: 'up every period since testing began', matPct: '≈ 3.4%', estAmount: '$24.7k' },
];

interface RiskCoolProfile { mapped: number; cleanPeriods: number; population: number }

const RISK_COOL_PROFILES: RiskCoolProfile[] = [
  { mapped: 4, cleanPeriods: 2, population: 1860 },
  { mapped: 3, cleanPeriods: 3, population: 940 },
  { mapped: 6, cleanPeriods: 2, population: 3120 },
];

interface EngagementAtRiskProfile {
  open: number; acrossRisks: number; newThisPeriod: number;
  series: [number, number, number]; matPct: string; estAmount: string;
}

const ENGAGEMENT_ATRISK_PROFILES: EngagementAtRiskProfile[] = [
  { open: 5, acrossRisks: 3, newThisPeriod: 2, series: [2, 3, 5], matPct: '≈ 3.1%', estAmount: '$27k' },
  { open: 8, acrossRisks: 4, newThisPeriod: 3, series: [4, 5, 8], matPct: '≈ 4.2%', estAmount: '$36k' },
  { open: 3, acrossRisks: 2, newThisPeriod: 1, series: [3, 2, 3], matPct: '≈ 1.9%', estAmount: '$14k' },
];

interface EngagementOnTrackProfile { concluded: number; planned: number; cleanPeriods: number }

const ENGAGEMENT_ONTRACK_PROFILES: EngagementOnTrackProfile[] = [
  { concluded: 6, planned: 8, cleanPeriods: 2 },
  { concluded: 11, planned: 12, cleanPeriods: 3 },
  { concluded: 4, planned: 5, cleanPeriods: 2 },
];

function controlFallback(subjectId: string, label: string, status: string): LayeredInsight {
  const failed = status === 'Fail';
  const passed = status === 'Pass';
  const base = {
    id: `li-ctrl-${subjectId}`, layer: 'control' as const, subjectId, subjectLabel: label,
    detectedOn: '07 Jul 2026', detectedBy: 'traceable' as const, runsAnalysed: 1,
  };
  if (failed) {
    const p = CONTROL_FAIL_PROFILES[subjectSeed(subjectId) % CONTROL_FAIL_PROFILES.length];
    const delta = p.series[2] - p.series[1];
    return {
      ...base, runsAnalysed: 3,
      takeaway: `${label} flagged ${p.flagged} of ${p.population} tested rows this period — root cause not yet confirmed.`,
      verdict: { label: 'Needs attention this period', tone: 'caution' },
      severity: 'med',
      likelyCause: { label: 'A tested attribute did not pass.', detail: `The ${p.flagged} flagged rows sit on one failing attribute; the mechanism behind it is not yet confirmed. Confirm the cause before grading a deficiency.` },
      reasoning: `Three runs of this control, read as one series — the ${p.flagged} current exceptions include carryover counted once, not re-counted per run.`,
      atStake: `Est. ${p.estAmount} across ${p.flagged} flagged rows (${p.matPct} of materiality) — quantify against the workpapers before concluding.`,
      freshness: delta > 0 ? 'escalated' : 'recurring',
      freshnessNote: delta > 0 ? `${delta} new since ${RUN_STAMPS[1].month}` : `Recurring for ${p.series.filter(v => v > 0).length} runs`,
      trajectory: runSeries('Rows flagged', 'rows flagged this run', [...p.series]),
      kpis: [
        { value: String(p.flagged), unit: `/ ${p.population}`, label: 'Rows flagged', sub: `${p.sharePct} of the tested population — ${p.shareNote}` },
        { value: `${delta > 0 ? '↑' : '·'} ${Math.abs(delta)}`, label: 'Vs last run', sub: p.trendNote, tone: delta > 0 ? 'bad' : 'neutral' },
        { value: p.matPct, label: 'Of materiality', sub: `est. ${p.estAmount} across ${p.flagged} rows · confirm the cause before grading` },
      ],
      factors: { ...NEUTRAL_FACTORS, frequency: 0.55, businessImpact: 0.6 }, confidenceOverride: 0.72,
      evidence: [
        { ref: `Run · ${RUN_STAMPS[2].label}`, label: 'This control’s latest run', detail: `${p.flagged} of ${p.population} rows flagged`, tone: 'negative' },
        { ref: `Run · ${RUN_STAMPS[1].label}`, label: 'Previous run', detail: `${p.series[1]} rows flagged`, tone: 'caution' },
        { ref: `Run · ${RUN_STAMPS[0].label}`, label: 'Two runs back', detail: `${p.series[0]} rows flagged`, tone: 'caution' },
      ],
      evidenceNote: '3 runs analysed · the trend is real, the cause is still open.',
      checkMore: [
        { kind: 'split', label: 'Which attribute failed, and how often' },
        { kind: 'compare', label: `Compare to ${RUN_STAMPS[1].label}`, detail: `${delta > 0 ? `${delta} new breaks` : 'no new breaks'}` },
        { kind: 'ask', label: 'Ask for the likely root cause' },
      ],
      recommendedActions: [
        'Review the failing attribute’s evidence and confirm the root cause before grading a deficiency.',
        `Quantify the est. ${p.estAmount} exposure against the workpapers — the materiality read stays an estimate until sized.`,
        'Check for a compensating control over the same assertion before concluding this control ineffective.',
      ],
    };
  }
  if (passed) {
    const p = CONTROL_PASS_PROFILES[subjectSeed(subjectId) % CONTROL_PASS_PROFILES.length];
    const cleared = p.series[0] > 0;
    return {
      ...base, runsAnalysed: 3,
      takeaway: `${label} held this period — 0 of ${p.population} tested rows flagged in the latest run.`,
      verdict: { label: 'Effective this period', tone: 'positive' },
      severity: 'low',
      likelyCause: { label: 'No violated baseline detected.', detail: `The monitored baseline held across all ${p.population} rows this run. This is a signed negative-assurance pass, not silence — the engine looked and found nothing material.` },
      reasoning: `Three runs read as one series — ${cleared ? `the ${p.series[0]} findings from ${RUN_STAMPS[0].label} ran down to zero across the window` : 'no findings in any run of the window'}, counted once.`,
      atStake: 'Nothing at stake this period. Re-test next period to keep the assurance current.',
      trajectory: runSeries('Rows flagged', 'rows flagged this run', [...p.series]),
      kpis: [
        { value: '0', unit: `/ ${p.population}`, label: 'Rows flagged', sub: 'full population tested — the monitored baseline held' },
        { value: String(p.cleanRuns), unit: p.cleanRuns === 1 ? 'run' : 'runs', label: 'Clean streak', sub: cleared ? `${p.series[0]} prior findings ran down to zero` : 'no findings anywhere in the window' },
        { value: '100%', label: 'Coverage', sub: 'negative assurance signed on the whole population, not a sample' },
      ],
      factors: NEUTRAL_FACTORS,
      evidence: [
        { ref: `Run · ${RUN_STAMPS[2].label}`, label: 'This control’s latest run', detail: `0 of ${p.population} rows flagged`, tone: 'positive' },
        { ref: `Run · ${RUN_STAMPS[1].label}`, label: 'Previous run', detail: `${p.series[1]} rows flagged`, tone: p.series[1] > 0 ? 'caution' : 'positive' },
      ],
      evidenceNote: `3 runs analysed · ${p.cleanRuns === 1 ? 'first clean run of the window' : `clean ${p.cleanRuns} runs straight`}.`,
      checkMore: [
        { kind: 'compare', label: `Compare to ${RUN_STAMPS[1].label}` },
        { kind: 'ask', label: 'Ask what would change this verdict' },
      ],
      recommendedActions: ['No action needed this period. Re-test on the next cycle to keep the assurance current.'],
    };
  }
  // Not tested / in test — forward-looking recommendation.
  const p = CONTROL_UNTESTED_PROFILES[subjectSeed(subjectId) % CONTROL_UNTESTED_PROFILES.length];
  return {
    ...base, runsAnalysed: 0,
    takeaway: `${label} hasn’t concluded this period — ${p.waiting.toLocaleString('en-US')} rows have accumulated since its last effective run.`,
    verdict: { label: 'Not yet concluded', tone: 'caution' },
    severity: 'low',
    likelyCause: { label: 'No results to reason over.', detail: `This control last concluded effective in ${p.lastEffective}; nothing has been tested in the ${p.weeksAging} weeks since. The recommendation below is forward-looking.` },
    reasoning: 'No run analysed this period. The engine makes no claim until this control produces output — the aging population is the finding.',
    atStake: `${p.waiting.toLocaleString('en-US')} untested rows and counting. If this is a key control, the cost of not testing is the real exposure.`,
    kpis: [
      { value: '0', label: 'Runs this period', sub: 'nothing to analyse yet — insights unlock on the first run' },
      { value: p.waiting.toLocaleString('en-US'), label: 'Rows waiting', sub: 'accumulated untested since the last effective run', tone: 'bad' },
      { value: p.lastEffective, label: 'Last effective', sub: `assurance is ${p.weeksAging} weeks old and aging every week testing waits` },
    ],
    factors: { ...NEUTRAL_FACTORS, recency: 0.3, sourceDiversity: 0.2 },
    evidence: [
      { ref: label, label: 'This control', detail: 'No completed run this period' },
      { ref: `Last run · ${p.lastEffective}`, label: 'Prior conclusion', detail: 'Effective, now aging', tone: 'caution' },
    ],
    evidenceNote: 'No runs yet · recommendation is forward-looking.',
    checkMore: [
      { kind: 'ask', label: 'Ask when this was last tested effective' },
      { kind: 'split', label: 'Preview the waiting population' },
    ],
    recommendedActions: [`Schedule and run this control’s test this period — ${p.waiting.toLocaleString('en-US')} rows are waiting and insights unlock once it produces output.`],
  };
}

function riskFallback(subjectId: string, label: string, priority: string): LayeredInsight {
  const hot = priority === 'Critical' || priority === 'High';
  if (hot) {
    const p = RISK_HOT_PROFILES[subjectSeed(subjectId) % RISK_HOT_PROFILES.length];
    const open = p.mapped - p.concluded;
    const delta = p.series[2] - p.series[1];
    return {
      id: `li-risk-${subjectId}`, layer: 'risk', subjectId, subjectLabel: label,
      detectedOn: '07 Jul 2026', detectedBy: 'formula', runsAnalysed: 3,
      takeaway: `${label} carries residual exposure — ${p.concluded} of ${p.mapped} mapped controls concluded effective, and the combined exception count is rising.`,
      verdict: { label: 'Partly mitigated', tone: 'caution' },
      severity: 'med',
      severityLabel: 'Residual: Medium',
      likelyCause: { label: 'Coverage may be incomplete.', detail: `${open} of the ${p.mapped} mapped controls have not concluded effective this period — ${p.coverageNote}. Confirm the mapping before relying on it.` },
      reasoning: 'Rolled up from this risk’s mapped controls; each shared finding is counted once, not per control.',
      atStake: `Est. ${p.estAmount} combined across the mapped controls (${p.matPct} of materiality) — quantify before grading residual severity.`,
      freshness: delta > 0 ? 'escalated' : 'recurring',
      freshnessNote: delta > 0 ? `${delta} new combined exceptions since ${RUN_STAMPS[1].month}` : 'Recurring across the window',
      trajectory: runSeries('Combined exceptions', 'across mapped controls', [...p.series]),
      kpis: [
        { value: String(p.concluded), unit: `/ ${p.mapped}`, label: 'Controls concluded', sub: p.coverageNote, tone: 'bad' },
        { value: `↑ ${p.series[2] - p.series[0]}`, label: 'Over 3 periods', sub: p.trendNote, tone: 'bad' },
        { value: p.matPct, label: 'Of materiality', sub: `est. ${p.estAmount} combined, counted once · size before grading` },
      ],
      factors: { ...NEUTRAL_FACTORS, frequency: 0.5, businessImpact: 0.6 },
      confidenceOverride: 0.68,
      evidence: [
        { ref: label, label: 'Mapped controls', detail: `${p.concluded} of ${p.mapped} concluded effective`, tone: 'caution' },
        { ref: `Period · ${RUN_STAMPS[2].label}`, label: 'Combined exceptions', detail: `${p.series[2]} across the mapped controls`, tone: 'negative' },
        { ref: `Period · ${RUN_STAMPS[1].label}`, label: 'Previous period', detail: `${p.series[1]} combined`, tone: 'caution' },
      ],
      evidenceNote: `Rolled up from ${p.mapped} mapped controls · 3 periods in the series.`,
      rollupOf: { label: 'controls', count: p.mapped },
      checkMore: [
        { kind: 'split', label: 'See this risk’s controls and their status' },
        { kind: 'ask', label: 'Ask what is left uncovered' },
      ],
      recommendedActions: [
        `Conclude the ${open} open control${open === 1 ? '' : 's'} — every assertion under this risk needs a concluded test before residual severity can drop.`,
        `Quantify the est. ${p.estAmount} combined exposure across the mapped controls before grading.`,
      ],
    };
  }
  const p = RISK_COOL_PROFILES[subjectSeed(subjectId) % RISK_COOL_PROFILES.length];
  return {
    id: `li-risk-${subjectId}`, layer: 'risk', subjectId, subjectLabel: label,
    detectedOn: '07 Jul 2026', detectedBy: 'formula', runsAnalysed: 3,
    takeaway: `${label} looks mitigated — all ${p.mapped} mapped controls are concluding without material findings.`,
    verdict: { label: 'Mitigated', tone: 'positive' },
    severity: 'low',
    severityLabel: 'Residual: Low',
    likelyCause: { label: 'No coverage gap detected.', detail: `All ${p.mapped} mapped controls cover this risk’s assertions and have concluded clean for ${p.cleanPeriods} period${p.cleanPeriods === 1 ? '' : 's'} running. This is a signed pass, not silence.` },
    reasoning: 'Rolled up from this risk’s mapped controls; each shared finding is counted once, not per control.',
    atStake: 'No material exposure this period.',
    kpis: [
      { value: String(p.mapped), unit: `/ ${p.mapped}`, label: 'Controls clean', sub: 'every mapped control concluded without material findings' },
      { value: String(p.cleanPeriods), unit: p.cleanPeriods === 1 ? 'period' : 'periods', label: 'Clean streak', sub: 'consecutive periods without a material finding' },
      { value: p.population.toLocaleString('en-US'), label: 'Rows covered', sub: 'combined population behind the negative assurance' },
    ],
    factors: NEUTRAL_FACTORS,
    evidence: [
      { ref: label, label: 'Mapped controls', detail: `${p.mapped} of ${p.mapped} concluding clean`, tone: 'positive' },
      { ref: 'Coverage', label: 'Combined population', detail: `${p.population.toLocaleString('en-US')} rows across the controls`, tone: 'positive' },
    ],
    evidenceNote: `Rolled up from ${p.mapped} mapped controls · clean ${p.cleanPeriods} period${p.cleanPeriods === 1 ? '' : 's'} running.`,
    rollupOf: { label: 'controls', count: p.mapped },
    checkMore: [
      { kind: 'split', label: 'See this risk’s controls and their status' },
      { kind: 'ask', label: 'Ask what is left uncovered' },
    ],
    recommendedActions: ['No action needed. Keep monitoring the mapped controls through the period.'],
  };
}

function engagementFallback(subjectId: string, label: string, status: string): LayeredInsight {
  const atRisk = status === 'At risk' || status === 'Behind' || status === 'In fieldwork';
  if (atRisk) {
    const p = ENGAGEMENT_ATRISK_PROFILES[subjectSeed(subjectId) % ENGAGEMENT_ATRISK_PROFILES.length];
    return {
      id: `li-eng-${subjectId}`, layer: 'engagement', subjectId, subjectLabel: label,
      detectedOn: '07 Jul 2026', detectedBy: 'formula', runsAnalysed: 3,
      takeaway: `${label} carries ${p.open} open findings across ${p.acrossRisks} risks — nothing yet rises to an engagement-level escalation.`,
      verdict: { label: 'At risk', tone: 'caution' },
      severity: 'med',
      severityLabel: 'Readiness: At risk',
      likelyCause: { label: 'No single dominant driver identified yet.', detail: `The ${p.open} findings are spread across ${p.acrossRisks} risks with no shared root cause standing out. Generate insights at the control level to find one.` },
      reasoning: 'Rolled up from this engagement’s risks and controls; shared findings are counted once.',
      atStake: `Est. ${p.estAmount} combined open exposure (${p.matPct} of materiality) — weigh it before it moves sign-off.`,
      freshness: p.newThisPeriod > 0 ? 'escalated' : 'recurring',
      freshnessNote: `${p.newThisPeriod} new this period`,
      trajectory: runSeries('Open findings', 'across the engagement', [...p.series]),
      kpis: [
        { value: String(p.open), label: 'Open findings', sub: `across ${p.acrossRisks} risks — no shared driver confirmed yet` },
        { value: `↑ ${p.newThisPeriod}`, label: 'New this period', sub: 'openings outpacing closures — the queue is growing', tone: 'bad' },
        { value: p.matPct, label: 'Of materiality', sub: `est. ${p.estAmount} combined open exposure · weigh before sign-off` },
      ],
      factors: { ...NEUTRAL_FACTORS, businessImpact: 0.55 },
      confidenceOverride: 0.66,
      evidence: [
        { ref: label, label: 'Risks and controls', detail: `${p.open} open findings across ${p.acrossRisks} risks`, tone: 'caution' },
        { ref: `Period · ${RUN_STAMPS[2].label}`, label: 'This period', detail: `${p.newThisPeriod} new findings opened`, tone: 'caution' },
      ],
      evidenceNote: `Rolled up from risks and controls · 3 periods in the series.`,
      rollupOf: { label: 'risks', count: p.acrossRisks },
      checkMore: [
        { kind: 'split', label: 'See which risks carry the open findings' },
        { kind: 'ask', label: 'Ask what is blocking sign-off' },
      ],
      recommendedActions: [
        'Drill into the risks with open findings to see whether they share one driver worth escalating.',
        `Weigh the est. ${p.estAmount} combined exposure against materiality before the sign-off judgment.`,
      ],
    };
  }
  const p = ENGAGEMENT_ONTRACK_PROFILES[subjectSeed(subjectId) % ENGAGEMENT_ONTRACK_PROFILES.length];
  return {
    id: `li-eng-${subjectId}`, layer: 'engagement', subjectId, subjectLabel: label,
    detectedOn: '07 Jul 2026', detectedBy: 'formula', runsAnalysed: 3,
    takeaway: `${label} is tracking to plan — ${p.concluded} of ${p.planned} planned conclusions landed, no engagement-level escalation this period.`,
    verdict: { label: 'On track', tone: 'positive' },
    severity: 'low',
    severityLabel: 'Readiness: On track',
    likelyCause: { label: 'No systemic driver detected.', detail: 'The engine sees no cross-risk pattern that would change sign-off this period.' },
    reasoning: 'Rolled up from this engagement’s risks and controls; shared findings are counted once.',
    atStake: 'No material engagement-level exposure this period.',
    kpis: [
      { value: String(p.concluded), unit: `/ ${p.planned}`, label: 'Conclusions landed', sub: 'testing is keeping pace with the plan' },
      { value: '0', label: 'Systemic drivers', sub: 'no cross-risk pattern detected this period' },
      { value: String(p.cleanPeriods), unit: p.cleanPeriods === 1 ? 'period' : 'periods', label: 'Clean streak', sub: 'consecutive periods without an engagement-level escalation' },
    ],
    factors: NEUTRAL_FACTORS,
    evidence: [
      { ref: label, label: 'Risks and controls', detail: `${p.concluded} of ${p.planned} planned conclusions landed`, tone: 'positive' },
    ],
    evidenceNote: 'Rolled up from risks and controls.',
    rollupOf: { label: 'risks', count: 0 },
    checkMore: [
      { kind: 'split', label: 'See which risks carry the open findings' },
      { kind: 'ask', label: 'Ask what is blocking sign-off' },
    ],
    recommendedActions: ['No engagement-level action needed. Keep the controls concluding on schedule.'],
  };
}

// ─── Public builder ─────────────────────────────────────────────────────────

export interface BuildInsightInput {
  layer: InsightLayer;
  subjectId: string;
  subjectLabel: string;
  /** Control / engagement status hint ('Pass' | 'Fail' | 'Not tested' | 'At risk' | …). */
  status?: string;
  /** Risk priority hint ('Critical' | 'High' | 'Medium' | 'Low'). */
  priority?: string;
  /** Whether the control is a key control — drives coverage/scoping recommendations. */
  isKey?: boolean;
  /** Force the flagship pricing story even when the label doesn't name it —
   *  for a subject the caller KNOWS carries the chargeback-pricing thread
   *  (e.g. the engagement rollup for the engagement that runs it). */
  flagship?: boolean;
  /** Override the insight's spans with the caller's REAL row entities, so
   *  reflections land on rows that actually exist on the caller's surface. */
  spans?: EntityRef[];
  /** Override where-to-check with the caller's REAL row entities, so the
   *  rollup surface's redirects land on rows that actually exist. */
  checkAt?: EntityRef[];
}

// ─── AI recommendation library ──────────────────────────────────────────────
// The forward-looking layer, by altitude and state. Written from a Big-4 lens:
// every item names an action, a basis in methodology, and (where the call is a
// judgment) the guardrail that keeps it the auditor's.

const rec = (
  id: string, category: RecCategory, priority: RecPriority,
  title: string, rationale: string, basis?: string, guardrail?: string,
  extra?: Pick<AuditRecommendation, 'target' | 'intent'>,
): AuditRecommendation => ({ id, category, priority, title, rationale, basis, guardrail, ...extra });

// Flagship control — Chargeback Pricing Validation, Ineffective this period.
// Targeted actions (Rule 2): cr-cf-2 lands on the risk (aggregation is a
// risk-level judgment) and cr-cf-5 lands on the SOP (a missing control has no
// row of its own) — both travel to those rows. The rest stay on this card.
const CONTROL_FLAGSHIP_RECS: AuditRecommendation[] = [
  rec('cr-cf-1', 'root-cause', 'do-now',
    'Confirm the MCKESSON price-feed failure before grading a deficiency.',
    'The 70-row concentration points to one feed, but the mechanism is still a candidate. The severity call is your judgment on likelihood and magnitude.',
    'Deficiency evaluation', 'AI proposes the cause; you conclude and sign.',
    { intent: 'retest' }),
  rec('cr-cf-2', 'deficiency', 'do-now',
    'Aggregate with the other two MCKESSON-driven controls by assertion.',
    'Three controls hit the same pricing-accuracy assertion. Evaluate the combined magnitude, not three isolated items — only the engagement sees all three workpapers.',
    'Deficiency aggregation by assertion', 'Never auto-labelled significant deficiency or material weakness.',
    { intent: 'aggregate', target: { kind: 'risk', id: 'R-PRICING', label: 'Pricing accuracy risk' } }),
  rec('cr-cf-3', 'evidence', 'this-period',
    'Re-perform the WAC and contract-price IPE for the 70 held lines.',
    'The system verdict is information produced by the entity — validate its completeness and accuracy before relying on it for the recovery position.',
    'IPE completeness & accuracy', undefined,
    { intent: 'retest' }),
  rec('cr-cf-4', 'sampling', 'this-period',
    'Size the recovery testing to the 70 exceptions, not the default 25.',
    'The deviation set is already identified, so a flat 25 is indefensible. Test the known population and quantify the recovery.',
    'ISA 530 / AS 2315 attribute sampling', undefined,
    { intent: 'edit' }),
  rec('cr-cf-5', 'automation', 'advisory',
    'Add a preventive edit that blocks a null-contract-price chargeback at intake.',
    'Stops the exception at source next period rather than detecting it after settlement.',
    'Preventive control design', undefined,
    { intent: 'create', target: { kind: 'sop', id: 'sop-001', label: 'Vendor Payment SOP' } }),
];

function controlRecs(status: string, isKey: boolean): AuditRecommendation[] {
  if (status === 'Fail') {
    return [
      rec('cr-f-1', 'root-cause', 'do-now', 'Confirm the root cause before grading a deficiency.',
        'A failing attribute is known; the mechanism is not. Confirm it before concluding — the severity is your judgment.', 'Deficiency evaluation', 'Human grades severity.',
        { intent: 'retest' }),
      rec('cr-f-2', 'deficiency', 'this-period', 'Evaluate a compensating control over the same assertion.',
        'Before grading this control ineffective, check whether another control covers the same assertion, precisely enough, and operated all period.', 'Compensating controls', undefined,
        { intent: 'aggregate' }),
      rec('cr-f-3', 'evidence', 'this-period', 'Validate the IPE behind the exceptions.',
        'Confirm the completeness and accuracy of any system-produced report used to identify the failures before relying on it.', 'IPE completeness & accuracy', undefined,
        { intent: 'retest' }),
      rec('cr-f-4', 'scoping', 'advisory', 'Carry this conclusion into next period’s scope.',
        'A control that failed this period must not be quietly dropped or down-sampled next year — the worst look in an inspection.', 'Prior-year carryover', undefined,
        { intent: 'monitor' }),
    ];
  }
  if (status === 'Pass') {
    return [
      rec('cr-p-1', 'timeliness', 'advisory', 'Re-test on the next cycle to keep the assurance current.',
        'A clean pass ages. Confirm the test cadence matches the control frequency so reliance stays supported.', 'Reliance currency', undefined,
        { intent: 'retest' }),
      rec('cr-p-2', 'sampling', 'advisory', 'Sanity-check the sample against control frequency.',
        'Confirm the sample size was driven by frequency and required assurance, not a default 25 — over- and under-auditing both show at EQR.', 'ISA 530 attribute sampling', undefined,
        { intent: 'monitor' }),
      rec('cr-p-3', 'automation', 'advisory', 'If this is a manual control with recurring low exceptions, consider automating it.',
        'A manual control that clears the same exception every period is an automation-advisory candidate that also tightens assurance.', 'Efficiency', undefined,
        { intent: 'create' }),
    ];
  }
  // Not tested / in test — the highest-value proactive set.
  return [
    rec('cr-n-1', 'timeliness', isKey ? 'do-now' : 'this-period', `Schedule this ${isKey ? 'key ' : ''}control’s test this period.`,
      isKey ? 'A key control not concluded this period is the first question an inspector asks. Schedule it before freeze.' : 'This control has no conclusion this period — schedule its test so the assertion is covered.', 'Key-control coverage', undefined,
      { intent: 'retest' }),
    rec('cr-n-2', 'sampling', 'this-period', 'Set the sample from frequency and prior-year result, not the default 25.',
      'Sample size is driven by control frequency and required assurance, uplifted for any prior-year deviation. Population growth is a separate reassessment signal, not a sample-count input.', 'ISA 530 attribute sampling', undefined,
      { intent: 'edit' }),
    rec('cr-n-3', 'evidence', 'this-period', 'Request the required evidence up front and validate it at intake.',
      'Check the evidence is in-period, signed, and the right document type before accepting — a wrong-period reconciliation caught at attribute testing restarts the PBC clock.', 'Evidence fitness gate', undefined,
      { intent: 'monitor' }),
    ...(isKey ? [rec('cr-n-4', 'scoping', 'advisory', 'Confirm this is not the sole mitigation before any descoping.',
      'A key control that is the only mitigation of a critical risk must not be reclassified non-key in a RACM tidy-up.', 'Key-control mislabelling', undefined,
      { intent: 'monitor' })] : []),
  ];
}

const RISK_FLAGSHIP_RECS: AuditRecommendation[] = [
  rec('rr-cf-1', 'coverage', 'do-now', 'Add and test a control that guards the price feed at its source.',
    'Every control under this risk tests the feed’s output; none tests the feed itself. The gap sits upstream of all of them.', 'Coverage gap', 'Risk stays Exposed until the source control tests effective.',
    { intent: 'create', target: { kind: 'sop', id: 'sop-001', label: 'Vendor Payment SOP' } }),
  rec('rr-cf-2', 'rating', 'this-period', 'Keep residual severity High until the source control is effective.',
    'Don’t lower residual on downstream passes — the mitigating controls all inherit the same untested weakness.', 'Residual risk assessment', undefined,
    { intent: 'edit' }),
  rec('rr-cf-3', 'scoping', 'this-period', 'Confirm this risk wasn’t downgraded in the last RACM tidy-up.',
    'A risk that raised findings last period and is quietly reclassified this year is a coverage hole an EQR will find.', 'Prior-year carryover', undefined,
    { intent: 'monitor' }),
  rec('rr-cf-4', 'deficiency', 'advisory', 'Evaluate the three controls’ findings as one exposure.',
    'They flag one feed, not three problems — aggregate by assertion so the magnitude is judged once, not diluted across three items.', 'Deficiency aggregation', undefined,
    { intent: 'aggregate' }),
  // Decomposed to the spanned controls (Rule 2) — each lands on its row.
  rec('rr-cf-5', 'sampling', 'this-period', 'Size the three-way-match re-test to the failing MCKESSON population.',
    'The deviation set is already identified upstream — a default sample under-tests the known exposure at the match control.', 'ISA 530 attribute sampling', undefined,
    { intent: 'edit', target: { kind: 'control', id: 'P2P-C-06', label: 'Three-way match (PO · GRN · Invoice)' } }),
  rec('rr-cf-6', 'monitoring', 'this-period', 'Extend duplicate-invoice detection to catch re-billed lines from the stale feed.',
    'Re-billed MCKESSON lines surface as near-duplicates the current match key misses when amounts shift with the price master.', 'Preventive control design', undefined,
    { intent: 'edit', target: { kind: 'control', id: 'P2P-C-07', label: 'Duplicate-invoice detection' } }),
];

function riskRecs(priority: string): AuditRecommendation[] {
  const hot = priority === 'Critical' || priority === 'High';
  if (hot) {
    return [
      rec('rr-h-1', 'coverage', 'do-now', 'Confirm every assertion under this risk has a control concluded effective.',
        'An unmapped or ineffective assertion leaves the risk uncovered. Map a control or record a signed descoping rationale before freeze.', 'RACM completeness', undefined,
        { intent: 'monitor' }),
      rec('rr-h-2', 'rating', 'this-period', 'Reconcile the rating with prior-year results and sibling-file materiality.',
        'A risk score set by rote — high but never deficient, or low but failed twice — is indefensible. Separate inherent-risk drivers from control-risk drivers.', 'Risk-of-material-misstatement', 'The engagement leader accepts the basis; never auto-set.',
        { intent: 'edit' }),
      rec('rr-h-3', 'monitoring', 'advisory', 'If this covers a high-value channel, confirm it has a monitoring workflow.',
        'Silence on the highest-value channel doesn’t mean fine — it means nothing was looking. Add continuous monitoring where the exposure warrants it.', 'Continuous monitoring', undefined,
        { intent: 'create' }),
      rec('rr-h-4', 'segregation', 'advisory', 'Check for SoD or fraud-shaped patterns under this risk.',
        'Surface observable facts — same preparer and approver, sequential just-under-limit items — for you to characterise. The platform never asserts intent.', 'SoD / fraud indicators', 'You characterise; the platform states facts.',
        { intent: 'monitor' }),
    ];
  }
  return [
    rec('rr-l-1', 'rating', 'advisory', 'Reassess if the population grows materially or a new deviation lands.',
      'Mitigated today, but population growth is a risk-reassessment signal. Re-confirm the risk still rates the same before relying on it.', 'Risk reassessment', undefined,
      { intent: 'monitor' }),
    rec('rr-l-2', 'coverage', 'advisory', 'Confirm attribute coverage stays complete across the mapped controls.',
      'A partial attribute coverage on a mitigated risk is a quiet gap. Keep the mapping whole through the period.', 'RACM completeness', undefined,
      { intent: 'monitor' }),
  ];
}

function engagementRecs(status: string, flagship: boolean): AuditRecommendation[] {
  if (flagship) {
    return [
      rec('er-cf-1', 'root-cause', 'do-now', 'Raise the broken price feed with the client as ONE fix owning all three workflows.',
        'The chargeback, contract-compliance and vendor-master findings resolve to one client-side price master. One remediation, not three separate notes.', 'Root-cause remediation', 'Confirm the single driver with the client first.',
        { intent: 'aggregate' }),
      rec('er-cf-2', 'deficiency', 'this-period', 'Weigh the combined underpayment against materiality before sign-off.',
        'Aggregate the exposure across the three workflows and weigh it — including qualitative factors — against the engagement materiality.', 'Materiality incl. qualitative factors', 'The sign-off judgment is yours.',
        { intent: 'aggregate' }),
      rec('er-cf-3', 'scoping', 'advisory', 'Confirm the feed is remediated and re-tested before concluding sign-off.',
        'Sign-off can’t rely on a control set that still inherits the broken feed. The risk clears only once the source control tests effective.', 'Sign-off readiness', undefined,
        { intent: 'retest' }),
    ];
  }
  const atRisk = status === 'At risk' || status === 'Behind' || status === 'In fieldwork';
  if (atRisk) {
    return [
      rec('er-r-1', 'timeliness', 'this-period', 'Re-sequence the remaining controls against the sign-off date.',
        'At the current pace the milestone slips. Pull the dependency-blocking items forward before they cascade into the report date.', 'Milestone management', undefined,
        { intent: 'edit' }),
      rec('er-r-2', 'coverage', 'advisory', 'Confirm no key control or risky area silently dropped from this year’s scope.',
        'Diff this year’s scope against last year and against where issues actually arose — a risky area that quietly leaves the plan is an audit-committee question.', 'Coverage gap vs prior year', undefined,
        { intent: 'monitor' }),
    ];
  }
  return [
    rec('er-o-1', 'timeliness', 'advisory', 'Keep the controls concluding on schedule.',
      'On track this period — hold the cadence so the file is complete and archived within the ISQM window.', 'Archival timeliness', undefined,
      { intent: 'monitor' }),
  ];
}

/** The full typed recommendation set for a subject. */
export function buildRecommendations(input: {
  layer: InsightLayer; flagship: boolean; status: string; priority: string; isKey: boolean;
}): AuditRecommendation[] {
  const { layer, flagship, status, priority, isKey } = input;
  if (layer === 'control') return flagship ? CONTROL_FLAGSHIP_RECS : controlRecs(status, isKey);
  if (layer === 'risk') return flagship ? RISK_FLAGSHIP_RECS : riskRecs(priority);
  // SOP-anchored insights are rare by construction (they need a cross-risk
  // pattern); the SOP surface receives targeted actions instead.
  if (layer === 'sop') return [];
  // Portfolio insights are hand-authored cross-engagement stories that carry
  // their own targeted recommendations — never generated from a status hint.
  if (layer === 'portfolio') return [];
  return engagementRecs(status, flagship);
}

/** The flagship pricing story, re-pointed at the caller's real subject id so the
 *  approval/scope trail stays attached to the actual control/risk/engagement. */
function pin(seed: LayeredInsight, subjectId: string, subjectLabel: string): LayeredInsight {
  return { ...seed, subjectId, subjectLabel: seed.subjectLabel === 'this engagement' ? subjectLabel : seed.subjectLabel };
}

export function buildLayeredInsight(input: BuildInsightInput): LayeredInsight {
  const { layer, subjectId, subjectLabel, status = '', priority = '', isKey = false, flagship = false } = input;
  const pricing = flagship || isPricingSubject(subjectLabel);

  let base: LayeredInsight;
  if (layer === 'control') {
    base = pricing ? pin(CONTROL_PRICING, subjectId, subjectLabel) : controlFallback(subjectId, subjectLabel, status);
  } else if (layer === 'risk') {
    base = pricing ? pin(RISK_PRICING, subjectId, subjectLabel) : riskFallback(subjectId, subjectLabel, priority);
  } else if (layer === 'sop') {
    // No SOP-anchored seed story yet — derive an honest rollup-style card.
    base = { ...riskFallback(subjectId, subjectLabel, priority), id: `li-sop-${subjectId}`, layer: 'sop' };
  } else {
    // engagement — the flagship escalation fires when this engagement carries the pricing thread.
    base = pricing ? pin(ENGAGEMENT_PRICING, subjectId, subjectLabel) : engagementFallback(subjectId, subjectLabel, status);
  }
  if (input.spans) base = { ...base, spans: input.spans };
  if (input.checkAt) base = { ...base, checkAt: input.checkAt };

  return { ...base, recommendations: buildRecommendations({ layer, flagship: pricing, status, priority, isKey }) };
}

// ─── Workflow recommendations ───────────────────────────────────────────────
// Workflows are the fundamental unit — continuous / automated controls. Their
// recommendation set is metric-driven (effectiveness, exception aging, cadence,
// reliance), distinct from the control/risk sets.

export interface WorkflowRecInput {
  subjectLabel: string;
  /** True-positive effectiveness %, 0–100. */
  effectivePct?: number;
  openExceptions?: number;
  /** 'Daily 6 AM' | 'Hourly' | 'Ad-hoc' … */
  cadence?: string;
  /** 'Success' | 'Running' | 'Paused' … */
  status?: string;
  /** 'Reconciliation' | 'Detection' | 'Monitoring' | 'Compliance' … */
  category?: string;
}

export function buildWorkflowRecommendations(input: WorkflowRecInput): AuditRecommendation[] {
  const { effectivePct, openExceptions = 0, cadence = '', status = '', category = '' } = input;
  const recs: AuditRecommendation[] = [];

  if (status.toLowerCase() === 'paused') {
    recs.push(rec('wf-paused', 'monitoring', 'do-now',
      'Resume this workflow — the control it supports has no coverage while it is paused.',
      'A paused monitoring control leaves a live gap. Resume it or document why the exposure is accepted for the period.',
      'Continuous monitoring', undefined, { intent: 'edit' }));
  }
  if (effectivePct != null && effectivePct < 60) {
    recs.push(rec('wf-loweff', 'automation', 'do-now',
      `Review the workflow logic — effectiveness at ${effectivePct}%.`,
      'A low true-positive rate means it is flagging noise or missing real exceptions. The automated verdict cannot support reliance until the logic is validated.',
      'AI-verdict reliability', 'Validate the verdict logic before relying on it elsewhere.', { intent: 'retest' }));
  } else if (effectivePct != null && effectivePct < 78) {
    recs.push(rec('wf-modeff', 'automation', 'this-period',
      `Tune the thresholds — effectiveness at ${effectivePct}%.`,
      'Effectiveness in the 60–78% band suggests the rule needs calibration before its output is relied on for a conclusion.',
      'Threshold calibration', undefined, { intent: 'edit' }));
  }
  if (openExceptions > 0) {
    recs.push(rec('wf-open', 'evidence', 'this-period',
      `Clear the ${openExceptions} open exception${openExceptions === 1 ? '' : 's'} before they age.`,
      'Exceptions found the afternoon before fieldwork closes cannot be re-chased in time. Work them now against the deadline.',
      'Exception aging', undefined, { intent: 'monitor' }));
  }
  if (/monitor|detect|complian/i.test(category) && cadence.toLowerCase().includes('ad-hoc')) {
    recs.push(rec('wf-cadence', 'monitoring', 'advisory',
      'Move this monitoring control off an ad-hoc cadence to a scheduled run.',
      'Ad-hoc cadence means coverage is discontinuous — a high-value channel can go unwatched between runs. Silence is not the same as fine.',
      'Continuous monitoring', undefined, { intent: 'edit' }));
  }
  recs.push(rec('wf-actedon', 'evidence', 'advisory',
    'Confirm the output is reviewed and acted on.',
    'A distributed output that nobody acts on is a report, not a control. Confirm the recipient closes the loop each period.',
    'Control operation', undefined, { intent: 'monitor' }));
  return recs;
}

// ─── Workflow insight — the row-level card behind the "AI recommends" CTA ───
// Workflows have no altitude of their own in the layer model (they ARE the
// continuous-control unit), so this derives an honest card straight from the
// row's recorded metrics — effectiveness, open exceptions, cadence, status —
// and attaches the workflow rec set as its typed recommendations. Deterministic,
// no LLM; the caller stamps generatedAt from the engagement-level generation.

export interface WorkflowInsightInput extends WorkflowRecInput {
  subjectId: string;
}

export function buildWorkflowInsight(input: WorkflowInsightInput): LayeredInsight {
  const { subjectId, subjectLabel, effectivePct, openExceptions = 0, cadence = '', status = '', category = '' } = input;
  const recs = buildWorkflowRecommendations(input);
  const paused = status.toLowerCase() === 'paused';
  const lowEff = effectivePct != null && effectivePct < 60;
  const modEff = effectivePct != null && effectivePct >= 60 && effectivePct < 78;
  const adHocMonitor = /monitor|detect|complian/i.test(category) && cadence.toLowerCase().includes('ad-hoc');
  const troubled = paused || lowEff;
  const watch = modEff || openExceptions > 0 || adHocMonitor;

  const verdict: LayerVerdict = troubled
    ? { label: 'Needs attention this period', tone: 'negative' }
    : watch
      ? { label: 'Operating with findings', tone: 'caution' }
      : { label: 'Operating effectively', tone: 'positive' };

  const observations: string[] = [];
  if (effectivePct != null) {
    observations.push(`True-positive effectiveness is ${effectivePct}% over the last 90 days${
      lowEff ? ' — most fires are noise, or real exceptions are being missed' : modEff ? ' — below the band where its verdicts support reliance' : ''}.`);
  }
  if (paused) observations.push('The workflow is paused — the control it supports has no coverage while it sleeps.');
  if (openExceptions > 0) observations.push(`${openExceptions} exception${openExceptions === 1 ? ' is' : 's are'} still open from this workflow's runs.`);
  if (adHocMonitor) observations.push('It runs ad-hoc, so coverage between runs is discontinuous for a monitoring-shaped control.');
  if (observations.length === 0) observations.push('Recent runs completed with no open exceptions and a reliable true-positive rate.');

  const likelyCause = paused
    ? { label: 'Coverage stopped when the workflow was paused.', detail: 'Nothing has watched this control since the pause. Resume it or document why the exposure is accepted — confirm before relying on the period.' }
    : lowEff
      ? { label: 'The rule logic looks miscalibrated.', detail: `A ${effectivePct}% true-positive rate means the workflow is flagging noise or missing real exceptions. Validate the verdict logic before relying on its output — confirm first.` }
      : openExceptions > 0
        ? { label: 'Exceptions are being found faster than they are cleared.', detail: 'The detection side is working; the review loop behind it is lagging. Confirm ownership of the queue before concluding on the control.' }
        : modEff
          ? { label: 'Thresholds likely need tuning.', detail: 'Effectiveness in the 60–78% band usually traces to rule calibration, not the process being tested. Confirm before relying on the verdicts.' }
          : adHocMonitor
            ? { label: 'Ad-hoc cadence leaves gaps between runs.', detail: 'A monitoring control that only runs on request can go unwatched for weeks. Confirm the intended cadence with the owner.' }
            : { label: 'No violated baseline detected.', detail: 'The monitored baseline held across the recent runs. This is a signed negative-assurance pass, not silence — the engine looked and found nothing material.' };

  const stakes: string[] = [];
  if (troubled) stakes.push('Reliance on this workflow’s verdicts is not supportable until the logic is validated.');
  if (paused) stakes.push('The control has a live coverage gap for every day the workflow stays paused.');
  if (openExceptions > 0) stakes.push(`${openExceptions} open exception${openExceptions === 1 ? '' : 's'} could age past fieldwork close and become unchaseable.`);
  if (stakes.length === 0) stakes.push('Nothing at stake this period — hold the cadence and the assurance stays current.');

  const effTone: VerdictTone = lowEff ? 'negative' : modEff ? 'caution' : 'positive';
  const evidence: LayerEvidenceItem[] = [];
  if (effectivePct != null) evidence.push({ ref: subjectId, label: '90-day effectiveness', detail: `${effectivePct}% true-positive`, tone: effTone });
  if (openExceptions > 0) evidence.push({ ref: 'Exceptions', label: 'Open exception queue', detail: `${openExceptions} unresolved`, tone: 'caution' });
  evidence.push({ ref: 'Cadence', label: cadence || 'Not scheduled', detail: paused ? 'Paused' : status || 'Scheduled', tone: paused ? 'negative' : undefined });

  return {
    id: `li-wf-${subjectId}`,
    layer: 'control',
    subjectId,
    subjectLabel,
    takeaway: troubled
      ? `${subjectLabel} can’t be relied on as-is — ${paused ? 'it is paused with no coverage in place' : `only ${effectivePct}% of its fires are true positives`}.`
      : watch
        ? `${subjectLabel} is running, with findings worth clearing${openExceptions > 0 ? ` — ${openExceptions} exception${openExceptions === 1 ? '' : 's'} still open` : ''}.`
        : `${subjectLabel} is operating effectively — no open findings on its recent runs.`,
    verdict,
    severity: troubled ? 'med' : openExceptions > 0 ? 'med' : 'low',
    likelyCause,
    reasoning: 'One workflow, read from its own recorded metrics — no cross-run claim beyond the 90-day window.',
    atStake: stakes[0],
    observations,
    stakes,
    kpis: [
      ...(effectivePct != null ? [{
        value: `${effectivePct}%`, label: 'True-positive rate',
        sub: lowEff ? 'reliance not supportable until the logic is validated'
          : modEff ? 'below the reliance band — tune the thresholds'
          : 'supports reliance this period',
        tone: (lowEff || modEff ? 'bad' : 'neutral') as InsightKpi['tone'],
      }] : []),
      {
        value: String(openExceptions), label: openExceptions === 1 ? 'Open exception' : 'Open exceptions',
        sub: openExceptions > 0 ? 'clear before they age past fieldwork close' : 'queue clear this period',
        tone: (openExceptions > 0 ? 'bad' : 'neutral') as InsightKpi['tone'],
      },
      {
        value: paused ? 'Paused' : (cadence || 'Ad-hoc'), label: 'Cadence',
        sub: paused ? 'no coverage while it sleeps'
          : adHocMonitor ? 'discontinuous coverage between runs'
          : 'coverage continuous through the period',
        tone: (paused ? 'bad' : 'neutral') as InsightKpi['tone'],
      },
    ],
    riskType: /complian/i.test(category) ? 'compliance' : /reconcil|detect/i.test(category) ? 'financial' : 'operational',
    factors: { frequency: 0.5, sourceDiversity: 0.4, recency: 0.95, businessImpact: troubled ? 0.7 : watch ? 0.5 : 0.35 },
    confidenceOverride: troubled ? 0.72 : watch ? 0.62 : undefined,
    evidence,
    evidenceNote: 'Derived from this workflow’s recorded run metrics — deterministic, no model call.',
    detectedOn: '07 Jul 2026',
    detectedBy: 'formula',
    checkMore: [
      { kind: 'split', label: 'Split fires by true vs false positive' },
      { kind: 'compare', label: 'Compare with the previous run' },
      { kind: 'ask', label: 'Ask what would raise effectiveness' },
    ],
    recommendedActions: recs.map(r => r.title),
    recommendations: recs,
  };
}

/** Actionable (do-now / this-period) workflow recs, for a panel + row badge. */
export function actionableWorkflowRecs(input: WorkflowRecInput): AuditRecommendation[] {
  return buildWorkflowRecommendations(input).filter(r => r.priority === 'do-now' || r.priority === 'this-period');
}
export function workflowRecBadge(input: WorkflowRecInput): { count: number; topPriority: 'do-now' | 'this-period' } | null {
  const actionable = actionableWorkflowRecs(input);
  if (actionable.length === 0) return null;
  return { count: actionable.length, topPriority: actionable.some(r => r.priority === 'do-now') ? 'do-now' : 'this-period' };
}

// ─── RACM-entry recommendations ─────────────────────────────────────────────
// The RACM tab is a coverage surface — the recommendations here are about
// mapping completeness (unmapped risks, key-control presence, SOP linkage,
// attribute coverage), the gaps a reviewer's eye skims past as a quiet amber chip.

export interface RacmRecInput {
  subjectLabel: string;
  risks: number;
  controls: number;
  keyControls: number;
  attributes: number;
  hasSop: boolean;
}

export function buildRacmEntryRecommendations(input: RacmRecInput): AuditRecommendation[] {
  const { risks, controls, keyControls, attributes, hasSop } = input;
  const recs: AuditRecommendation[] = [];
  if (!hasSop) {
    recs.push(rec('rac-sop', 'coverage', 'do-now',
      'Link an SOP so the controls can be validated against the documented procedure.',
      'A RACM with no SOP tests a control set nobody has tied back to how the process actually runs.',
      'RACM completeness', undefined, { intent: 'edit' }));
  }
  if (controls < risks) {
    const gap = risks - controls;
    recs.push(rec('rac-unmapped', 'coverage', 'do-now',
      `${gap} risk${gap === 1 ? '' : 's'} here may have no mapped control — map one or record a signed descoping rationale.`,
      'A revenue or payment risk with zero controls is the coverage hole an EQR finds first. Promote it to a blocking finding before freeze.',
      'RACM completeness', undefined, { intent: 'create' }));
  }
  if (controls > 0 && keyControls === 0) {
    recs.push(rec('rac-nokey', 'scoping', 'this-period',
      'Designate a key control — none is marked key in this RACM.',
      'A control that is the sole mitigation of a critical risk must be flagged key, or a "key-controls only" scope silently drops it.',
      'Key-control mislabelling', undefined, { intent: 'edit' }));
  }
  if (controls > 0 && attributes / controls < 2) {
    recs.push(rec('rac-thinattr', 'sampling', 'advisory',
      'Confirm each control’s assertions are fully covered by test attributes.',
      'Thin attribute coverage leaves part of the assertion untested — check the coverage before relying on the control.',
      'Attribute coverage', undefined, { intent: 'monitor' }));
  }
  return recs;
}

export function actionableRacmRecs(input: RacmRecInput): AuditRecommendation[] {
  return buildRacmEntryRecommendations(input).filter(r => r.priority === 'do-now' || r.priority === 'this-period');
}
export function racmRecBadge(input: RacmRecInput): { count: number; topPriority: 'do-now' | 'this-period' } | null {
  const actionable = actionableRacmRecs(input);
  if (actionable.length === 0) return null;
  return { count: actionable.length, topPriority: actionable.some(r => r.priority === 'do-now') ? 'do-now' : 'this-period' };
}

/** The actionable (Do-now / This-period) recommendations for a subject — the
 *  cheap, generation-free signal behind row-level badges. No LLM call. */
export function actionableRecs(input: BuildInsightInput): AuditRecommendation[] {
  const recs = buildRecommendations({
    layer: input.layer,
    flagship: input.flagship ?? isPricingSubject(input.subjectLabel),
    status: input.status ?? '',
    priority: input.priority ?? '',
    isKey: input.isKey ?? false,
  });
  return recs.filter(r => r.priority === 'do-now' || r.priority === 'this-period');
}

/** True when a subject has any actionable recommendation worth flagging on its row. */
export function hasMaterialInsight(input: BuildInsightInput): boolean {
  return actionableRecs(input).length > 0;
}

/** Count + top priority for a row badge — 'do-now' outranks 'this-period'
 *  (advisory-only subjects return null and get no badge). */
export function recBadge(input: BuildInsightInput): { count: number; topPriority: 'do-now' | 'this-period' } | null {
  const recs = actionableRecs(input);
  if (recs.length === 0) return null;
  return { count: recs.length, topPriority: recs.some(r => r.priority === 'do-now') ? 'do-now' : 'this-period' };
}

// ─── Layer presentation metadata ────────────────────────────────────────────

export const LAYER_META: Record<InsightLayer, { label: string; scan: string; density: 'deep' | 'light' }> = {
  control: {
    label: 'this control',
    scan: 'Scans this control’s runs and linked workflow output',
    density: 'deep',
  },
  risk: {
    label: 'this risk',
    scan: 'Rolls up the controls mapped to this risk',
    density: 'light',
  },
  sop: {
    label: 'this SOP',
    scan: 'Rolls up the risks and controls extracted from this SOP',
    density: 'light',
  },
  engagement: {
    label: 'this engagement',
    scan: 'Rolls up every risk and control across the engagement',
    density: 'light',
  },
  portfolio: {
    label: 'this portfolio',
    scan: 'Correlates findings across every engagement in the library',
    density: 'light',
  },
  // The exceptions surface: the anchor is the exception SET (a pattern across
  // cases), never a single case — one case alone has nothing to correlate.
  exception: {
    label: 'this exception set',
    scan: 'Groups the exceptions in this scope that share a root cause',
    density: 'light',
  },
};

export const CHECK_MORE_ICON: Record<CheckMoreOption['kind'], string> = {
  compare: 'GitCompareArrows',
  split: 'Split',
  trace: 'Crosshair',
  ask: 'MessageCircleQuestion',
};

// ─── Triage disposition — how the grid drawer sections a stack ──────────────
// Failed-first (review decision): a broken finding or a High severity is
// "needs action"; an at-risk caution is "watch"; a signed pass folds away into
// "holding steady". The section IS the scan order — inside one, the stack's
// severity sort ranks left→right.

export type InsightDisposition = 'action' | 'watch' | 'holding';

export const DISPOSITION_META: Record<InsightDisposition, { label: string; foldLabel: string }> = {
  action: { label: 'Needs action', foldLabel: '' },
  watch: { label: 'Watch', foldLabel: '' },
  holding: { label: 'Holding steady', foldLabel: 'signed passes and not-yet-run tests; nothing here needs you this period' },
};

export function insightDisposition(i: LayeredInsight): InsightDisposition {
  if (i.verdict.tone === 'negative' || i.severity === 'high') return 'action';
  // Low severity folds whatever its tone: a signed pass AND a not-yet-run test
  // are both "nothing needs you" — ten of them as tiles is the wall the fold
  // exists to prevent. Medium is the watch band.
  return i.severity === 'med' ? 'watch' : 'holding';
}

/** Risk-type facet with a label heuristic behind it, so filters work even for
 *  derived insights that never set the field explicitly. */
export function riskTypeOf(i: LayeredInsight): InsightRiskType {
  if (i.riskType) return i.riskType;
  const l = `${i.subjectLabel} ${i.takeaway}`.toLowerCase();
  if (/itgc|access|change management|password|system|application control/.test(l)) return 'it';
  if (/complian|regulat|sox|attest|sanction|kyc/.test(l)) return 'compliance';
  if (/pric|invoice|payment|recon|chargeback|revenue|duplicate|vendor master|wac|settle|financ/.test(l)) return 'financial';
  return 'operational';
}

/** The stat band, with an honest derived fallback for insights that carry no
 *  authored tiles: trajectory (the anchor metric + its real delta), rollup
 *  breadth, runs analysed. Never fabricates a figure — a card with thin data
 *  gets a thin band, which is itself the honest reading. */
// The band holds at most 3 tiles (review call Aug 7) — wider tiles give each
// consequence sub-line room to say something instead of truncating.
export function insightKpis(i: LayeredInsight): InsightKpi[] {
  // Start from the authored band, then pad from derived tiles until the band
  // holds three — every card renders the full A′ band (Aug 10), including an
  // object generated by an older session that authored fewer tiles.
  const out: InsightKpi[] = i.kpis ? i.kpis.slice(0, 3) : [];
  const has = (label: string) => out.some(k => k.label.toLowerCase() === label.toLowerCase());
  const pad = (k: InsightKpi) => { if (out.length < 3 && !has(k.label)) out.push(k); };

  if (i.trajectory && i.trajectory.points.length > 0) {
    const r = readTrajectory(i.trajectory);
    pad({
      value: String(r.current),
      label: i.trajectory.metricLabel,
      sub: i.trajectory.points.length > 1
        ? `${r.lastDelta > 0 ? '↑' : r.lastDelta < 0 ? '↓' : '·'} ${Math.abs(r.lastDelta)} vs previous run`
        : i.trajectory.unitLabel,
      tone: r.tone === 'bad' ? 'bad' : 'neutral',
    });
  }
  if (i.rollupOf && i.rollupOf.count > 0) {
    pad({ value: String(i.rollupOf.count), label: i.rollupOf.label, sub: 'shared findings counted once' });
  }
  if (i.runsAnalysed != null && i.runsAnalysed > 0) {
    pad({
      value: String(i.runsAnalysed),
      label: i.runsAnalysed === 1 ? 'Run analysed' : 'Runs analysed',
      sub: i.runsAnalysed <= 1 ? 'early signal — no recurrence claim' : 'cross-run evidence',
    });
  }
  if (i.evidence.length > 0) {
    pad({
      value: String(i.evidence.length),
      label: i.evidence.length === 1 ? 'Evidence item' : 'Evidence items',
      sub: 'behind this finding — expand to read each row',
    });
  }
  if (i.confidenceOverride != null) {
    pad({
      value: `${Math.round(i.confidenceOverride * 100)}%`,
      label: 'Confidence',
      sub: 'engine composite — more corroborating evidence raises it',
    });
  }
  pad({
    value: i.severity === 'high' ? 'High' : i.severity === 'med' ? 'Medium' : 'Low',
    label: 'Severity',
    sub: 'proposed by the engine — the grading stays the auditor’s',
    tone: i.severity === 'high' ? 'bad' : 'neutral',
  });
  return out.slice(0, 3);
}
