// ─── Insight Memory Engine — shared data layer ────────────────────────────
//
// Token-agnostic mock data + types for the "AI insights based on memory"
// feature. Mirrors the architecture in the Insight Memory Engine PRD
// (auditify_ai_flow): a heuristic-first, traceable pipeline that correlates
// signals across runs / workflows / entities / time, scores each candidate,
// and only calls an LLM to write the human-readable explanation. Nothing
// reaches the shared "Enterprise Context" without an explicit human approval.
//
// Consumed by THREE surfaces, each in its own token system, so this file
// holds DATA + pure helpers only — no JSX, no colour classes. Each surface
// maps `severity` / `PatternType` to its own palette.
//
// Scenario: pharmaceutical chargeback pricing validation. The current run
// flags 90 pricing-variation exceptions, 70 of them concentrated under one
// vendor (MCKESSON CORPORATION) — the STAGE_3 insight this demo is built on.
//
// Determinism: this codebase avoids Date.now()/Math.random() in module and
// render paths. All timestamps and ids are literals.

// ─── Pattern taxonomy (the 10 detected types) ─────────────────────────────

export type PatternType =
  | 'recurring-output-anomaly'
  | 'kpi-trend-drift'
  | 'cohort-anomaly'
  | 'cross-workflow-correlation'
  | 'memory-conflict'
  | 'schema-decay'
  | 'user-override-pattern'
  | 'emerging-trend'
  | 'workflow-efficiency-gap'
  | 'distribution-engagement-gap';

export type InsightSeverity = 'high' | 'med' | 'low';

// Human Approval Gate states. `scoped` = approved but with a narrowed scope
// or an expiry the analyst set; `dismissed` = rejected for now (the engine may
// re-surface it if the signal strengthens).
export type ApprovalStatus = 'pending' | 'approved' | 'scoped' | 'dismissed';

// Where in the heuristic-first pipeline a signal was produced. Drives the
// "Traceable" vs "LLM" provenance chips — only the explanation is model-written.
export type DetectionMethod = 'traceable' | 'formula' | 'llm' | 'human-gate';

export interface PatternMeta {
  type: PatternType;
  label: string;
  /** lucide-react icon name — each surface imports the matching icon. */
  icon: string;
  severity: InsightSeverity;
  /** One-line definition, lifted from the PRD's "10 pattern types" table. */
  blurb: string;
}

// Ordered high → low to match the PRD's severity banding.
export const PATTERN_META: Record<PatternType, PatternMeta> = {
  'recurring-output-anomaly': {
    type: 'recurring-output-anomaly', label: 'Recurring Output Anomaly', icon: 'Repeat2',
    severity: 'high', blurb: 'The same entity is flagged across multiple runs of the same workflow.',
  },
  'kpi-trend-drift': {
    type: 'kpi-trend-drift', label: 'KPI Trend Drift', icon: 'TrendingUp',
    severity: 'high', blurb: 'A KPI moves consistently in one direction across consecutive periods.',
  },
  'cohort-anomaly': {
    type: 'cohort-anomaly', label: 'Cohort Anomaly', icon: 'Users',
    severity: 'high', blurb: 'An entity consistently deviates from its peer-group baseline.',
  },
  'cross-workflow-correlation': {
    type: 'cross-workflow-correlation', label: 'Cross-Workflow Correlation', icon: 'Network',
    severity: 'high', blurb: 'The same entity surfaces in two or more unrelated workflows.',
  },
  'memory-conflict': {
    type: 'memory-conflict', label: 'Memory Conflict', icon: 'GitCompareArrows',
    severity: 'high', blurb: 'A new run contradicts a promoted Enterprise Context fact.',
  },
  'schema-decay': {
    type: 'schema-decay', label: 'Schema Decay', icon: 'Unplug',
    severity: 'med', blurb: 'Structural mismatches are increasing — a likely source-system change.',
  },
  'user-override-pattern': {
    type: 'user-override-pattern', label: 'User Override Pattern', icon: 'UserX',
    severity: 'med', blurb: 'Analysts keep dismissing the same warning — the rule may be stale.',
  },
  'emerging-trend': {
    type: 'emerging-trend', label: 'Emerging Trend', icon: 'Sparkline',
    severity: 'med', blurb: 'A metric stable for months just made a sharp move in the last runs.',
  },
  'workflow-efficiency-gap': {
    type: 'workflow-efficiency-gap', label: 'Workflow Efficiency Gap', icon: 'Timer',
    severity: 'low', blurb: 'A workflow consistently triggers manual follow-ups.',
  },
  'distribution-engagement-gap': {
    type: 'distribution-engagement-gap', label: 'Distribution Engagement Gap', icon: 'MailQuestion',
    severity: 'low', blurb: 'Recipients never act on a distributed output — is it worth sending?',
  },
};

export const SEVERITY_ORDER: InsightSeverity[] = ['high', 'med', 'low'];
export const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  high: 'High', med: 'Medium', low: 'Low',
};

// ─── Confidence model ─────────────────────────────────────────────────────
// Per the PRD: confidence = frequency × source diversity × recency × business
// impact. Each factor is 0–1. The product is the "scored confidence value
// (0–1)"; a threshold gates memory candidacy. A single-run finding can also
// carry an engine-scored `confidenceOverride` that supersedes the product for
// display (see MemoryInsight).

export interface ConfidenceFactors {
  frequency: number;       // how often the signal repeats
  sourceDiversity: number; // how many distinct runs/workflows/entities back it
  recency: number;         // how recent the supporting evidence is
  businessImpact: number;  // $ / risk weight of the finding
}

export const CONFIDENCE_FACTOR_META: { key: keyof ConfidenceFactors; label: string; hint: string }[] = [
  { key: 'frequency', label: 'Frequency', hint: 'How often the signal repeats across runs' },
  { key: 'sourceDiversity', label: 'Source Diversity', hint: 'Distinct runs, workflows & entities backing it' },
  { key: 'recency', label: 'Recency', hint: 'How recent the supporting evidence is' },
  { key: 'businessImpact', label: 'Business Impact', hint: 'Dollar value / risk weight at stake' },
];

/** The literal PRD formula — product of the four factors. */
export function computeConfidence(f: ConfidenceFactors): number {
  return f.frequency * f.sourceDiversity * f.recency * f.businessImpact;
}

/** Confidence at/above this becomes a memory candidate (gateable by a human). */
export const MEMORY_CANDIDATE_THRESHOLD = 0.45;

export function confidencePct(f: ConfidenceFactors): number {
  return Math.round(computeConfidence(f) * 100);
}

/** Display confidence: honour an engine-scored override, else the factor product. */
export function displayConfidencePct(i: { factors: ConfidenceFactors; confidenceOverride?: number }): number {
  return i.confidenceOverride != null ? Math.round(i.confidenceOverride * 100) : confidencePct(i.factors);
}

/** Memory-candidacy using the override when present, else the factor product. */
export function isMemoryCandidate(i: { factors: ConfidenceFactors; confidenceOverride?: number }): boolean {
  const c = i.confidenceOverride != null ? i.confidenceOverride : computeConfidence(i.factors);
  return c >= MEMORY_CANDIDATE_THRESHOLD;
}

// ─── Evidence + insight objects ───────────────────────────────────────────

export interface RunRef {
  id: string;
  label: string;  // e.g. "Chargeback Pricing Validation — Jun 2026"
  date: string;   // "02 Jun 2026"
}

// A single flagged exception line — the tabular evidence behind a chargeback
// pricing insight. Nulls are meaningful (a missing contract price is the whole
// point of the "Price Not Found in master" failure mode).
export interface ChargebackEvidenceRow {
  product: string;
  productRef: string;
  contractRef: string;
  remark: string;
  units: number;
  paid: number;
  wac: number;
  contractPrice: number | null;
  revised: number | null;
  difference: number | null;
}

// The structured bundle handed to the LLM explanation layer. The model can
// only describe what's in here — it cannot invent data it wasn't given.
export interface EvidenceBundle {
  runsAnalysed: number;
  timeWindow: string;            // "Current run · Jul 2026"
  workflows: string[];           // workflow names spanned
  entities: string[];            // resolved entity labels (vendor, contract…)
  kpiValues?: { label: string; value: string; delta?: string }[];
  runRefs?: RunRef[];
  /** Sampled exception rows — rendered as a table when present. */
  rows?: ChargebackEvidenceRow[];
}

export interface KpiDriftPoint {
  period: string;  // "Mar", "Apr"…
  value: number;   // raw KPI value for the period
  label: string;   // display value e.g. "$4.2M"
}

export interface MemoryInsight {
  id: string;
  type: PatternType;
  severity: InsightSeverity;
  /** Workflow this insight is anchored to (or "Across workflows"). */
  scope: string;
  title: string;
  /** The LLM-written, human-readable explanation. */
  description: string;
  recommendedAction: string;
  /** Optional ordered actions; when present the card renders them as a checklist. */
  recommendedActions?: string[];
  factors: ConfidenceFactors;
  /** Engine-scored confidence (0–1) that overrides the factor product for display —
   *  e.g. a single-run finding whose headline score comes from the model, not recurrence. */
  confidenceOverride?: number;
  evidence: EvidenceBundle;
  approvalStatus: ApprovalStatus;
  detectedOn: string;
  /** Pipeline stage that produced the core signal (the explanation is always LLM). */
  detectedBy: DetectionMethod;
  /** Present for kpi-trend-drift / emerging-trend — drives the sparkline. */
  series?: KpiDriftPoint[];
  /** For memory-conflict — the promoted fact this run contradicts. */
  conflictsWith?: string;
}

// ─── Seed insights — Chargeback Pricing Validation ────────────────────────
// These are the cards that render in the Business Process "AI Insights" tab
// and roll up to the Engagement view. The lead insight is the STAGE_3 MCKESSON
// concentration; two supporting findings fill out the severity banding. Every
// finding is single-run (runsAnalysed: 1) — an honest "1 of 1 runs" scenario,
// so no sparkline/trend is fabricated.

export const PROCESS_INSIGHTS: MemoryInsight[] = [
  {
    id: 'ins-mck-concentration',
    type: 'cohort-anomaly',
    severity: 'high',
    scope: 'Chargeback Pricing Validation',
    title: 'MCKESSON drives 78% of this run’s chargeback pricing exceptions — remediate before settlement',
    description:
      'MCKESSON CORPORATION accounts for 70 of the 90 pricing-variation exceptions in this run (~78%); the next-largest vendor, Cardinal Health, has only 10. That volume rules out an isolated line-entry mistake and points to a vendor-level pricing-master or chargeback-validation breakdown. Two failure modes appear together: product 55150038201 on contract AMPHS2024 has no contract price at all (“Price Not Found in master”), while 55150016330 and 55150025110 on HPG12 are flagged for WAC mismatch. The exposure is direct — one row paid a $3.75 chargeback that should have been $27.75; another paid $4.69 against $40.97 — creating underpayment, dispute and contract-compliance risk if not corrected before settlement. Only one run was examined, so this is a severe within-run concentration rather than a proven multi-period recurrence.',
    recommendedAction:
      'Place all 70 MCKESSON exceptions into a controlled chargeback review queue before settlement, validating the WAC, contract price and revised chargeback for each row.',
    recommendedActions: [
      'Place all 70 MCKESSON exceptions into a controlled chargeback review queue before final settlement or adjustment, and validate the WAC, contract price and revised chargeback for each row before any payment or correction.',
      'Remediate MCKESSON master data now — start with product refs 55150038201, 55150016330 and 55150025110 and contracts AMPHS2024 and HPG12 — populating missing contract prices, correcting WAC mismatches and documenting the approved source used for each update.',
      'Recalculate the chargeback for every MCKESSON exception after corrections, then compare to what was paid to identify required recoveries, supplemental payments or claim adjustments.',
      'Add a preventive edit that blocks MCKESSON chargebacks when the contract price is null, the revised amount cannot be calculated, or the transaction WAC does not match the approved master.',
      'Assign the MCKESSON cluster to pricing governance with a documented root-cause sign-off distinguishing missing master setup, delayed price updates and transaction-level errors.',
    ],
    factors: { frequency: 0.40, sourceDiversity: 0.72, recency: 0.99, businessImpact: 0.95 },
    confidenceOverride: 0.84,
    evidence: {
      runsAnalysed: 1,
      timeWindow: 'Current run · Jul 2026',
      workflows: ['Chargeback Pricing Validation'],
      entities: ['MCKESSON CORPORATION', 'Contract AMPHS2024', 'Contract HPG12'],
      kpiValues: [
        { label: 'MCKESSON exceptions', value: '70 of 90' },
        { label: 'Next vendor', value: '10 (Cardinal Health)' },
      ],
      rows: [
        {
          product: 'Pemetrexed for injection, USP SDV, 500mg/vial - 1s', productRef: '55150038201',
          contractRef: 'AMPHS2024', remark: 'Price Not Found in master', units: 2, paid: 990.94,
          wac: 500.0, contractPrice: null, revised: null, difference: null,
        },
        {
          product: 'Lidocaine HCl Injection USP 1% SDV 300mg/30mL - 1s', productRef: '55150016330',
          contractRef: 'HPG12', remark: 'Due to WAC Mismatch', units: 15, paid: 3.75,
          wac: 3.19, contractPrice: 1.34, revised: 27.75, difference: -24.0,
        },
        {
          product: 'Lidocaine HCl Injection USP 1% MDV 100mg/10mL - 25s', productRef: '55150025110',
          contractRef: 'HPG12', remark: 'Due to WAC Mismatch', units: 1, paid: 4.69,
          wac: 64.97, contractPrice: 24.0, revised: 40.97, difference: -36.28,
        },
      ],
    },
    approvalStatus: 'pending',
    detectedOn: '07 Jul 2026',
    detectedBy: 'traceable',
  },
  {
    id: 'ins-cardinal-wac',
    type: 'cohort-anomaly',
    severity: 'med',
    scope: 'Chargeback Pricing Validation',
    title: 'Cardinal Health shows 10 WAC-mismatch exceptions, contained to one contract',
    description:
      'CARDINAL HEALTH INC. accounts for 10 of the 90 pricing-variation exceptions this run — the second-largest cluster after MCKESSON, but an order of magnitude smaller and concentrated on a single contract. The pattern looks like a localised WAC-update lag rather than a broad master-data gap, so it is contained but still worth clearing before settlement.',
    recommendedAction:
      'Re-validate the WAC on the affected Cardinal Health contract and clear the 10 exceptions before settlement.',
    factors: { frequency: 0.40, sourceDiversity: 0.50, recency: 0.99, businessImpact: 0.66 },
    confidenceOverride: 0.71,
    evidence: {
      runsAnalysed: 1,
      timeWindow: 'Current run · Jul 2026',
      workflows: ['Chargeback Pricing Validation'],
      entities: ['CARDINAL HEALTH INC.'],
      kpiValues: [{ label: 'Cardinal exceptions', value: '10 of 90' }],
    },
    approvalStatus: 'pending',
    detectedOn: '07 Jul 2026',
    detectedBy: 'formula',
  },
  {
    id: 'ins-hpg12-lag',
    type: 'schema-decay',
    severity: 'low',
    scope: 'Contract HPG12',
    title: 'Contract HPG12 shows repeated WAC-update lag across products',
    description:
      'Multiple products on contract HPG12 carry a WAC that trails the current master, producing “Due to WAC Mismatch” flags across more than one vendor. On its own each row is minor, but the shared contract points to a stale price-file feed for HPG12 that is worth monitoring before it widens.',
    recommendedAction:
      'Add HPG12 to the price-file freshness monitor and re-confirm its WAC source mapping on the next run.',
    factors: { frequency: 0.55, sourceDiversity: 0.45, recency: 0.90, businessImpact: 0.40 },
    confidenceOverride: 0.62,
    evidence: {
      runsAnalysed: 1,
      timeWindow: 'Current run · Jul 2026',
      workflows: ['Chargeback Pricing Validation'],
      entities: ['Contract HPG12'],
    },
    approvalStatus: 'pending',
    detectedOn: '07 Jul 2026',
    detectedBy: 'traceable',
  },
];

// ─── Enterprise Context — already-promoted institutional memory ────────────
// What prior approvals have written into the shared, governed memory that the
// Intent Agent, Data Scout and Output Formatter all read from.

export interface EnterpriseContextEntry {
  id: string;
  fact: string;
  origin: string;       // which insight/run it was promoted from
  approvedBy: string;
  approvedOn: string;
  scope: string;        // "All chargeback workflows", "Contract HPG12"…
  expiry?: string;      // optional analyst-set expiry
}

export const ENTERPRISE_CONTEXT: EnterpriseContextEntry[] = [
  {
    id: 'ec-cb-formula',
    fact: 'A chargeback equals (WAC − contract price) × units; never settle one on a null contract price.',
    origin: 'Promoted from a Q1 chargeback reconciliation clarification',
    approvedBy: 'R. Mehta',
    approvedOn: '02 Jun 2026',
    scope: 'All chargeback workflows',
  },
  {
    id: 'ec-mck-watch',
    fact: 'MCKESSON CORPORATION is on a standing pricing-control watch pending master-data remediation.',
    origin: 'Promoted from a prior vendor pricing review',
    approvedBy: 'S. Iyer',
    approvedOn: '28 Jun 2026',
    scope: 'All chargeback workflows',
    expiry: 'Review by 30 Sep 2026',
  },
  {
    id: 'ec-hpg12',
    fact: 'Contract HPG12 requires WAC re-validation against the current master before chargeback processing.',
    origin: 'Promoted after repeated WAC-mismatch flags',
    approvedBy: 'R. Mehta',
    approvedOn: '20 Jun 2026',
    scope: 'Chargeback Pricing Validation',
  },
];

// ─── Cross-workflow entity index (Workflow Executor surface) ───────────────
// The Entity Resolver output: for a given vendor/entity in THIS run, what does
// memory know about it from OTHER runs and workflows. Keyed by the entity name
// as it appears in the executor results table.

export interface EntityMemory {
  entity: string;
  vendorId: string;
  /** Other runs of any workflow where this entity was also flagged. */
  alsoFlaggedIn: { workflow: string; detail: string; date: string }[];
  /** True if this entity is on a promoted Enterprise Context watch. */
  onWatch?: boolean;
  watchNote?: string;
}

export const ENTITY_MEMORY: Record<string, EntityMemory> = {
  'MCKESSON CORPORATION': {
    entity: 'MCKESSON CORPORATION',
    vendorId: 'MCK-CORP',
    onWatch: true,
    watchNote: 'On a standing pricing-control watch (Enterprise Context · approved 28 Jun 2026).',
    alsoFlaggedIn: [
      { workflow: 'Chargeback Pricing Validation', detail: '70 of 90 pricing exceptions this run', date: 'Jul 2026' },
      { workflow: 'Contract Compliance Review', detail: 'WAC mismatches on contract HPG12', date: 'Jun 2026' },
    ],
  },
  'CARDINAL HEALTH INC.': {
    entity: 'CARDINAL HEALTH INC.',
    vendorId: 'CAH-INC',
    alsoFlaggedIn: [
      { workflow: 'Chargeback Pricing Validation', detail: '10 WAC-mismatch exceptions, one contract', date: 'Jul 2026' },
    ],
  },
};

// ─── Output compare (Workflow Executor surface) ───────────────────────────
// Diff of THIS run vs the previous run of the same workflow: what's new, what
// resolved, and how the headline KPIs moved.

export interface OutputCompare {
  previousRunLabel: string;
  previousRunDate: string;
  newFindings: { ref: string; detail: string }[];
  resolvedFindings: { ref: string; detail: string }[];
  carriedOver: number;
  kpiDeltas: { label: string; current: string; previous: string; direction: 'up' | 'down' | 'flat' }[];
}

export const RUN_OUTPUT_COMPARE: OutputCompare = {
  previousRunLabel: 'Chargeback Pricing Validation — Jun 2026',
  previousRunDate: '02 Jun 2026',
  carriedOver: 58,
  newFindings: [
    { ref: 'MCK-HPG12', detail: 'MCKESSON HPG12 WAC-mismatch cluster — new concentration this run' },
  ],
  resolvedFindings: [
    { ref: 'ABC-2210', detail: 'AmerisourceBergen mismatch from Jun cleared after a price-file update' },
    { ref: 'MCK-AMPHS', detail: 'A prior AMPHS2024 missing-price row was populated and reconciled' },
  ],
  kpiDeltas: [
    { label: 'Exceptions', current: '90', previous: '76', direction: 'up' },
    { label: 'Rows processed', current: '12,480', previous: '11,900', direction: 'up' },
    { label: '$ under-recovered (sampled)', current: '$60.28', previous: '$41.10', direction: 'up' },
  ],
};

// ─── STAGE_3 insight payload (backend format) ─────────────────────────────
// The exact object the Stage-3 pipeline emits and persists as
// STAGE_3_INSIGHT_FINAL_SAVED. The Workflow Executor's "Cross-workflow
// correlation" and "Compare with previous output" surfaces are derived
// straight from these records, so they render the real backend payload rather
// than a bespoke view model.

/** One flagged exception line, keyed exactly as the backend serialises it
 *  (verbose spaced keys, `null` where a value is genuinely absent). */
export interface Stage3EvidenceRow {
  'Vendor Name': string;
  'Product Name': string;
  'Product Ref Id': string;
  'Contract Ref Id': string;
  'Exception Remark': string;
  'Chargeback Units': number;
  'Chargeback Paid': number;
  'WAC Price Per Master': number | null;
  'Contract Price Per Master': number | null;
  'Revised Chargeback Amount': number | null;
  'Chargeback Difference': number | null;
  'WAC Updation Ageing Bucket': string | null;
  'Contract Updation Ageing Bucket': string | null;
}

/** The persisted Stage-3 insight object (STAGE_3_INSIGHT_FINAL_SAVED). */
export interface Stage3Insight {
  title: string;
  severity: 'high' | 'medium' | 'low';
  reasoning: string;
  recommended_actions: string[];
  confidence: number;   // 0–1
  entity_type: string;  // 'vendor', 'contract', …
  entity_key: string;   // normalised key, e.g. 'mckesson corporation'
  evidence: Stage3EvidenceRow[];
}

/** A Stage-3 insight tagged with the workflow + run it was produced in — the
 *  envelope the platform stores around each payload so surfaces can correlate
 *  the same entity across workflows and diff a run against its predecessor. */
export interface Stage3Record {
  workflow: string;
  runLabel: string;   // "Chargeback Pricing Validation — Jul 2026"
  runDate: string;    // "07 Jul 2026"
  insight: Stage3Insight;
}

// This run's persisted Stage-3 insight — the MCKESSON concentration, verbatim
// in the shape the pipeline saved it.
export const STAGE3_CURRENT: Stage3Record = {
  workflow: 'Chargeback Pricing Validation',
  runLabel: 'Chargeback Pricing Validation — Jul 2026',
  runDate: '07 Jul 2026',
  insight: {
    title: 'MCKESSON CORPORATION should be placed under immediate chargeback pricing control remediation because it accounts for nearly all current pricing variation exposure',
    severity: 'high',
    reasoning: `MCKESSON CORPORATION accounts for 70 of the 90 pricing variation exceptions in the current run, or approximately 78% of the entire flagged population, while the next largest vendor grouping is far smaller at 10 rows for CARDINAL HEALTH INC. Across the examined window, MCKESSON also accounts for 70 flagged rows and appears in 1 of 1 runs; because only one run was examined, this does not prove a multi-period recurrence, but the volume within the run rules out a single isolated line-entry mistake and points to a vendor-level pricing master or chargeback validation breakdown. The sample rows show more than one failure mode for the same vendor: product ref 55150038201 under contract AMPHS2024 has "Price Not Found in master" with no contract price or revised chargeback amount, while product refs 55150016330 and 55150025110 under contract HPG12 are flagged "Due to WAC Mismatch." The evidence points most strongly to incomplete or misaligned WAC and contract master data for MCKESSON rather than a random transaction error, because the exceptions span different products and contracts but concentrate heavily under one vendor. The financial exposure is direct because chargebacks are being paid or calculated using pricing records that are either missing or mismatched; for example, one MCKESSON row shows chargeback paid of 3.75 versus a revised chargeback amount of 27.75, and another shows 4.69 versus 40.97, creating underpayment, dispute, reversal, or contract-compliance risk if not corrected before settlement. Given that MCKESSON represents the dominant share of the flagged population and includes both missing-price and WAC-mismatch conditions, management should treat this as a concentrated master-data control failure affecting chargeback accuracy for that vendor.`,
    recommended_actions: [
      'Place all 70 MCKESSON CORPORATION pricing variation exceptions from the current run into a controlled chargeback review queue before final settlement or adjustment, requiring pricing operations to validate the WAC, contract price, and revised chargeback amount for each row so that payments are not released or corrected using incomplete master data.',
      'Perform an immediate master-data remediation for MCKESSON products and contracts appearing in the exception population, starting with product refs 55150038201, 55150016330, and 55150025110 and contract refs AMPHS2024 and HPG12, to populate missing contract prices, correct WAC mismatches, and document the approved source used for each price update.',
      'Recalculate the chargeback amount for every MCKESSON exception after the master-data corrections are completed, then compare the recalculated amount to the chargeback paid to identify required recoveries, supplemental payments, or claim adjustments; the expected outcome is a quantified and supportable settlement position for all 70 affected rows.',
      'Implement a preventive edit for MCKESSON chargebacks that blocks processing when the contract price is null, the revised chargeback amount cannot be calculated, or the WAC in the transaction does not match the current approved master, so future exceptions are stopped at intake rather than detected after payment activity.',
      'Assign ownership of the MCKESSON exception cluster to pricing governance and require a documented root-cause sign-off distinguishing missing master setup, delayed price updates, and transaction-level errors, so management can determine whether the failure is a data maintenance issue, a control design gap, or an approval override problem.',
    ],
    confidence: 0.84,
    entity_type: 'vendor',
    entity_key: 'mckesson corporation',
    evidence: [
      { 'Vendor Name': 'MCKESSON CORPORATION', 'Product Name': 'Pemetrexed for injection, USP SDV, 500mg/vial - 1s', 'Product Ref Id': '55150038201', 'Contract Ref Id': 'AMPHS2024', 'Exception Remark': 'Price Not Found in master', 'Chargeback Units': 2, 'Chargeback Paid': 990.94, 'WAC Price Per Master': 500.0, 'Contract Price Per Master': null, 'Revised Chargeback Amount': null, 'Chargeback Difference': null, 'WAC Updation Ageing Bucket': 'upto 15 days', 'Contract Updation Ageing Bucket': null },
      { 'Vendor Name': 'MCKESSON CORPORATION', 'Product Name': 'Lidocaine Hydrochloride Injection USP 1% SDV 300mg/30mL - 1s', 'Product Ref Id': '55150016330', 'Contract Ref Id': 'HPG12', 'Exception Remark': 'Due to WAC Mismatch', 'Chargeback Units': 15, 'Chargeback Paid': 3.75, 'WAC Price Per Master': 3.19, 'Contract Price Per Master': 1.34, 'Revised Chargeback Amount': 27.75, 'Chargeback Difference': -24.0, 'WAC Updation Ageing Bucket': 'upto 15 days', 'Contract Updation Ageing Bucket': 'upto 15 days' },
      { 'Vendor Name': 'MCKESSON CORPORATION', 'Product Name': 'Lidocaine Hydrochloride Injection USP 1% MDV 100mg/10mL - 25s', 'Product Ref Id': '55150025110', 'Contract Ref Id': 'HPG12', 'Exception Remark': 'Due to WAC Mismatch', 'Chargeback Units': 1, 'Chargeback Paid': 4.69, 'WAC Price Per Master': 64.97, 'Contract Price Per Master': 24.0, 'Revised Chargeback Amount': 40.97, 'Chargeback Difference': -36.28, 'WAC Updation Ageing Bucket': 'upto 15 days', 'Contract Updation Ageing Bucket': 'upto 15 days' },
    ],
  },
};

// The previous run of the SAME workflow (Jun 2026). Its evidence overlaps the
// current run on two HPG12 rows (carried over) and differs on one AMPHS2024 row
// that cleared this run — the raw material the compare surface diffs against.
export const STAGE3_PREVIOUS: Stage3Record = {
  workflow: 'Chargeback Pricing Validation',
  runLabel: 'Chargeback Pricing Validation — Jun 2026',
  runDate: '02 Jun 2026',
  insight: {
    title: 'MCKESSON CORPORATION pricing exceptions concentrate on contract HPG12 with an unresolved AMPHS2024 missing-price row',
    severity: 'high',
    reasoning: `In the June run MCKESSON CORPORATION accounts for 62 of the 76 pricing variation exceptions, concentrated on contract HPG12 for WAC mismatch and on contract AMPHS2024 where product ref 55150099001 returns "Price Not Found in master." The pattern is consistent with a vendor-level master-data gap rather than isolated line errors, and the AMPHS2024 missing-price condition remained open at close of the run.`,
    recommended_actions: [
      'Re-validate the HPG12 WAC values against the approved master and clear the MCKESSON mismatch cluster before settlement.',
      'Populate the missing AMPHS2024 contract price for product ref 55150099001 and reconcile the affected chargeback rows.',
    ],
    confidence: 0.76,
    entity_type: 'vendor',
    entity_key: 'mckesson corporation',
    evidence: [
      { 'Vendor Name': 'MCKESSON CORPORATION', 'Product Name': 'Lidocaine Hydrochloride Injection USP 1% SDV 300mg/30mL - 1s', 'Product Ref Id': '55150016330', 'Contract Ref Id': 'HPG12', 'Exception Remark': 'Due to WAC Mismatch', 'Chargeback Units': 12, 'Chargeback Paid': 3.60, 'WAC Price Per Master': 3.05, 'Contract Price Per Master': 1.30, 'Revised Chargeback Amount': 26.40, 'Chargeback Difference': -22.80, 'WAC Updation Ageing Bucket': 'upto 15 days', 'Contract Updation Ageing Bucket': 'upto 15 days' },
      { 'Vendor Name': 'MCKESSON CORPORATION', 'Product Name': 'Lidocaine Hydrochloride Injection USP 1% MDV 100mg/10mL - 25s', 'Product Ref Id': '55150025110', 'Contract Ref Id': 'HPG12', 'Exception Remark': 'Due to WAC Mismatch', 'Chargeback Units': 1, 'Chargeback Paid': 4.55, 'WAC Price Per Master': 62.10, 'Contract Price Per Master': 23.5, 'Revised Chargeback Amount': 39.80, 'Chargeback Difference': -35.25, 'WAC Updation Ageing Bucket': '15 to 30 days', 'Contract Updation Ageing Bucket': '15 to 30 days' },
      { 'Vendor Name': 'MCKESSON CORPORATION', 'Product Name': 'Ondansetron Injection USP 2mg/mL SDV 2mL - 25s', 'Product Ref Id': '55150099001', 'Contract Ref Id': 'AMPHS2024', 'Exception Remark': 'Price Not Found in master', 'Chargeback Units': 4, 'Chargeback Paid': 512.40, 'WAC Price Per Master': 300.0, 'Contract Price Per Master': null, 'Revised Chargeback Amount': null, 'Chargeback Difference': null, 'WAC Updation Ageing Bucket': '15 to 30 days', 'Contract Updation Ageing Bucket': null },
    ],
  },
};

// Stage-3 insights from OTHER workflows. The same entity_key surfacing across
// workflows is exactly what the cross-workflow correlation surface reads.
export const STAGE3_CROSS_WORKFLOW: Stage3Record[] = [
  {
    workflow: 'Contract Compliance Review',
    runLabel: 'Contract Compliance Review — Jun 2026',
    runDate: '18 Jun 2026',
    insight: {
      title: 'MCKESSON CORPORATION contract HPG12 shows WAC values lagging the approved price master',
      severity: 'medium',
      reasoning: `The contract compliance sweep found MCKESSON CORPORATION rows on contract HPG12 whose transaction WAC lags the approved master, matching the mismatch pattern seen in chargeback pricing and pointing to the same delayed price-update mechanism for this vendor.`,
      recommended_actions: [
        'Confirm the approved HPG12 WAC source of record and refresh the master before the next compliance cycle.',
      ],
      confidence: 0.69,
      entity_type: 'vendor',
      entity_key: 'mckesson corporation',
      evidence: [
        { 'Vendor Name': 'MCKESSON CORPORATION', 'Product Name': 'Lidocaine Hydrochloride Injection USP 1% SDV 300mg/30mL - 1s', 'Product Ref Id': '55150016330', 'Contract Ref Id': 'HPG12', 'Exception Remark': 'Due to WAC Mismatch', 'Chargeback Units': 15, 'Chargeback Paid': 3.75, 'WAC Price Per Master': 3.19, 'Contract Price Per Master': 1.34, 'Revised Chargeback Amount': 27.75, 'Chargeback Difference': -24.0, 'WAC Updation Ageing Bucket': 'upto 15 days', 'Contract Updation Ageing Bucket': 'upto 15 days' },
      ],
    },
  },
  {
    workflow: 'Vendor Master Audit',
    runLabel: 'Vendor Master Audit — May 2026',
    runDate: '29 May 2026',
    insight: {
      title: 'MCKESSON CORPORATION carries stale WAC ageing across multiple contracts in the vendor master',
      severity: 'high',
      reasoning: `The vendor master audit flagged MCKESSON CORPORATION for WAC ageing buckets extending beyond the update tolerance on several contracts, indicating the price master for this vendor was not refreshed on schedule — an upstream cause consistent with the downstream chargeback mismatches.`,
      recommended_actions: [
        'Prioritise MCKESSON in the master-data refresh schedule and add a staleness alert when WAC ageing exceeds 30 days.',
      ],
      confidence: 0.72,
      entity_type: 'vendor',
      entity_key: 'mckesson corporation',
      evidence: [
        { 'Vendor Name': 'MCKESSON CORPORATION', 'Product Name': 'Pemetrexed for injection, USP SDV, 500mg/vial - 1s', 'Product Ref Id': '55150038201', 'Contract Ref Id': 'AMPHS2024', 'Exception Remark': 'WAC ageing beyond tolerance', 'Chargeback Units': 2, 'Chargeback Paid': 990.94, 'WAC Price Per Master': 500.0, 'Contract Price Per Master': null, 'Revised Chargeback Amount': null, 'Chargeback Difference': null, 'WAC Updation Ageing Bucket': '30 to 60 days', 'Contract Updation Ageing Bucket': null },
      ],
    },
  },
  {
    // Different entity_key — proves the correlation filter is entity-scoped
    // (this record never surfaces under the MCKESSON insight).
    workflow: 'Contract Compliance Review',
    runLabel: 'Contract Compliance Review — Jun 2026',
    runDate: '18 Jun 2026',
    insight: {
      title: 'CARDINAL HEALTH INC. shows an isolated WAC-update lag on one contract',
      severity: 'low',
      reasoning: `CARDINAL HEALTH INC. shows a small, single-contract WAC-update lag, an order of magnitude below the MCKESSON concentration and consistent with a localised timing issue rather than a master-data breakdown.`,
      recommended_actions: ['Clear the single Cardinal Health contract lag in the next cycle.'],
      confidence: 0.58,
      entity_type: 'vendor',
      entity_key: 'cardinal health inc.',
      evidence: [
        { 'Vendor Name': 'CARDINAL HEALTH INC.', 'Product Name': 'Heparin Sodium Injection USP 5000 units/mL - 10s', 'Product Ref Id': '55150071220', 'Contract Ref Id': 'CAH-2210', 'Exception Remark': 'Due to WAC Mismatch', 'Chargeback Units': 3, 'Chargeback Paid': 12.10, 'WAC Price Per Master': 11.40, 'Contract Price Per Master': 8.90, 'Revised Chargeback Amount': 18.60, 'Chargeback Difference': -6.50, 'WAC Updation Ageing Bucket': 'upto 15 days', 'Contract Updation Ageing Bucket': 'upto 15 days' },
      ],
    },
  },
];

// ─── Stage-3 derivations (correlation + run compare) ──────────────────────

/** Composite key for an evidence row — a row is "the same exception" across
 *  runs when its product and contract refs match. */
const stage3RowKey = (r: Stage3EvidenceRow): string => `${r['Product Ref Id']}·${r['Contract Ref Id']}`;

/** Cross-workflow correlation: Stage-3 records from OTHER workflows that
 *  flagged the same entity_key as `current`, most-recent context first. */
export function correlatedRecords(
  current: Stage3Record,
  pool: Stage3Record[] = STAGE3_CROSS_WORKFLOW,
): Stage3Record[] {
  return pool.filter(
    (r) => r.insight.entity_key === current.insight.entity_key && r.workflow !== current.workflow,
  );
}

export interface Stage3RunDiff {
  previous: Stage3Record;
  current: Stage3Record;
  newRows: Stage3EvidenceRow[];       // present this run, absent last run
  resolvedRows: Stage3EvidenceRow[];  // present last run, cleared this run
  carriedRows: Stage3EvidenceRow[];   // present in both
  confidenceDelta: number;            // current − previous (0–1)
  exceptionDelta: number;             // current row count − previous row count
}

/** Diff this run's Stage-3 evidence against the previous run of the same
 *  workflow, matching exceptions on (product ref · contract ref). */
export function diffRuns(
  current: Stage3Record,
  previous: Stage3Record = STAGE3_PREVIOUS,
): Stage3RunDiff {
  const prevKeys = new Set(previous.insight.evidence.map(stage3RowKey));
  const currKeys = new Set(current.insight.evidence.map(stage3RowKey));
  return {
    previous,
    current,
    newRows: current.insight.evidence.filter((r) => !prevKeys.has(stage3RowKey(r))),
    resolvedRows: previous.insight.evidence.filter((r) => !currKeys.has(stage3RowKey(r))),
    carriedRows: current.insight.evidence.filter((r) => prevKeys.has(stage3RowKey(r))),
    confidenceDelta: current.insight.confidence - previous.insight.confidence,
    exceptionDelta: current.insight.evidence.length - previous.insight.evidence.length,
  };
}

// ─── Golden-record cost bypass (Workflow Executor surface) ─────────────────
// The PRD's "80% of recurring audits bypass the LLM via golden records". When
// a re-run's inputs match a cached golden record, most steps replay
// deterministically and the run costs a fraction of a fresh planning pass.

export interface GoldenRecordStatus {
  /** % of this run's work served from the golden record vs freshly computed. */
  reusePct: number;
  cachedCost: string;
  freshCost: string;
  savedVs: string;       // human label, e.g. "vs a full re-plan"
  matchedRecord: string; // which golden record matched
  /** Steps that still ran live because their inputs changed. */
  recomputedSteps: string[];
}

export const RUN_GOLDEN_RECORD: GoldenRecordStatus = {
  reusePct: 80,
  cachedCost: '$0.05',
  freshCost: '$0.38',
  savedVs: 'vs a full re-plan + code-gen',
  matchedRecord: 'Golden record · Chargeback Pricing Validation v4 (frozen 02 Jun 2026)',
  recomputedSteps: ['Match WAC & contract price to master'],
};

// ─── Memory-backed assumptions (Chat surface) ─────────────────────────────
// Provenance attached to an assumption so the chat can say "based on your
// earlier input I assumed X" instead of asking the same clarification again.
// Consumed by the shared AssumptionsCard via the optional `memory` field.

export interface AssumptionMemory {
  /** Short source label, e.g. "Q1 Chargeback Recon". */
  source: string;
  /** When the user originally established this, e.g. "2 weeks ago". */
  learnedOn: string;
  /** 0–1 — how confident memory is that the old answer still applies. */
  confidence: number;
  /** True if this answer is governed Enterprise Context (shared across team). */
  enterprise?: boolean;
  /** The original question this assumption spares the user from re-answering. */
  sparedQuestion: string;
}
