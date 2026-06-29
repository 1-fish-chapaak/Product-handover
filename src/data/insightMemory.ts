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
// (0–1)"; a threshold gates memory candidacy.

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

// ─── Evidence + insight objects ───────────────────────────────────────────

export interface RunRef {
  id: string;
  label: string;  // e.g. "AP Ageing — May 2026"
  date: string;   // "12 May 2026"
}

// The structured bundle handed to the LLM explanation layer. The model can
// only describe what's in here — it cannot invent data it wasn't given.
export interface EvidenceBundle {
  runsAnalysed: number;
  timeWindow: string;            // "4 consecutive months · Mar–Jun 2026"
  workflows: string[];           // workflow names spanned
  entities: string[];            // resolved entity labels (vendor, GL code…)
  kpiValues?: { label: string; value: string; delta?: string }[];
  runRefs?: RunRef[];
}

export interface KpiDriftPoint {
  period: string;  // "Mar", "Apr"…
  value: number;   // raw KPI value for the period
  label: string;   // display value e.g. "₹4.2Cr"
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
  factors: ConfidenceFactors;
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

// ─── Seed insights — P2P business process, 6 workflows ────────────────────
// These are the cards that render in the Business Process "AI Insights" tab.
// Tuned so the four high-severity PRD patterns all surface for the demo, plus
// a couple of mid/low to show the full banding.

export const PROCESS_INSIGHTS: MemoryInsight[] = [
  {
    id: 'ins-apex-recurring',
    type: 'recurring-output-anomaly',
    severity: 'high',
    scope: 'AP Ageing',
    title: 'Apex Industrial Supplies flagged in 5 of the last 6 AP Ageing runs',
    description:
      'Apex Industrial Supplies (V-1234) has appeared in the 90+ day overdue bucket in 5 of the last 6 monthly AP Ageing runs, totalling ₹38.4L unpaid. No single run treats this as systemic, but the recurrence across half a year points to a stuck account rather than month-to-month noise.',
    recommendedAction:
      'Escalate Apex (V-1234) to AP management for a payment-plan review and add a standing watch on this vendor.',
    factors: { frequency: 0.96, sourceDiversity: 0.78, recency: 0.94, businessImpact: 0.92 },
    evidence: {
      runsAnalysed: 6,
      timeWindow: '6 consecutive months · Jan–Jun 2026',
      workflows: ['AP Ageing'],
      entities: ['Apex Industrial Supplies (V-1234)'],
      kpiValues: [{ label: 'Total 90+ day exposure', value: '₹38.4L' }],
      runRefs: [
        { id: 'r-apa-jun', label: 'AP Ageing — Jun 2026', date: '03 Jun 2026' },
        { id: 'r-apa-may', label: 'AP Ageing — May 2026', date: '02 May 2026' },
        { id: 'r-apa-apr', label: 'AP Ageing — Apr 2026', date: '04 Apr 2026' },
        { id: 'r-apa-mar', label: 'AP Ageing — Mar 2026', date: '03 Mar 2026' },
        { id: 'r-apa-feb', label: 'AP Ageing — Feb 2026', date: '04 Feb 2026' },
      ],
    },
    approvalStatus: 'pending',
    detectedOn: '28 Jun 2026',
    detectedBy: 'traceable',
  },
  {
    id: 'ins-kpi-90day-drift',
    type: 'kpi-trend-drift',
    severity: 'high',
    scope: 'AP Ageing',
    title: '90+ day overdue bucket drifting up 9–12% every month',
    description:
      'The 90+ day overdue bucket has grown between 9% and 12% in each of the last four AP Ageing runs — a sustained, compounding drift rather than a one-off spike. At the current rate the bucket will cross ₹6Cr within two cycles.',
    recommendedAction:
      'Promote this drift to Enterprise Context so every future AP Ageing run opens with the trend, and brief the controller before next month-end.',
    factors: { frequency: 0.92, sourceDiversity: 0.62, recency: 0.97, businessImpact: 0.90 },
    evidence: {
      runsAnalysed: 4,
      timeWindow: '4 consecutive months · Mar–Jun 2026',
      workflows: ['AP Ageing'],
      entities: ['90+ day bucket'],
      kpiValues: [
        { label: 'Jun bucket', value: '₹5.1Cr', delta: '+11%' },
        { label: 'Mar bucket', value: '₹3.8Cr' },
      ],
    },
    series: [
      { period: 'Mar', value: 380, label: '₹3.8Cr' },
      { period: 'Apr', value: 415, label: '₹4.2Cr' },
      { period: 'May', value: 460, label: '₹4.6Cr' },
      { period: 'Jun', value: 510, label: '₹5.1Cr' },
    ],
    approvalStatus: 'pending',
    detectedOn: '28 Jun 2026',
    detectedBy: 'formula',
  },
  {
    id: 'ins-apex-crossflow',
    type: 'cross-workflow-correlation',
    severity: 'high',
    scope: 'Across workflows',
    title: 'Apex appears in both Duplicate Invoice Detection and PO Leakage',
    description:
      'The same vendor driving the AP Ageing recurrence — Apex Industrial Supplies (V-1234) — was independently flagged this quarter by Duplicate Invoice Detection (2 duplicate groups) and by PO Leakage Analysis (₹4.1L billed over PO). Three different workflows converging on one vendor is a pattern no single run can see.',
    recommendedAction:
      'Open a vendor-level investigation case for Apex spanning AP Ageing, Duplicate Invoices and PO Leakage rather than triaging each flag in isolation.',
    factors: { frequency: 0.74, sourceDiversity: 0.95, recency: 0.90, businessImpact: 0.93 },
    evidence: {
      runsAnalysed: 9,
      timeWindow: 'Q1 FY26 · Apr–Jun 2026',
      workflows: ['AP Ageing', 'Duplicate Invoice Detection', 'PO Leakage Analysis'],
      entities: ['Apex Industrial Supplies (V-1234)'],
      kpiValues: [
        { label: 'Duplicate groups', value: '2' },
        { label: 'Over-PO billing', value: '₹4.1L' },
      ],
      runRefs: [
        { id: 'r-dup-jun', label: 'Duplicate Invoice Detection — Jun', date: '21 Jun 2026' },
        { id: 'r-pol-jun', label: 'PO Leakage Analysis — Jun', date: '19 Jun 2026' },
      ],
    },
    approvalStatus: 'pending',
    detectedOn: '28 Jun 2026',
    detectedBy: 'traceable',
  },
  {
    id: 'ins-schema-decay',
    type: 'memory-conflict',
    severity: 'high',
    scope: 'Vendor Master sync',
    title: "New run contradicts the approved 'Amount column = col F' memory",
    description:
      "The latest Acme entity upload reads its amount from a different column than the Enterprise Context fact promoted on 14 Apr 2026. The run still completed green, but it is reconciling against the wrong field — a classic silent source-system change after an accounting-system switch.",
    recommendedAction:
      "Pause auto-runs for the Acme source and re-confirm the column mapping before the next cycle. Memory has already drafted the corrected mapping for review.",
    factors: { frequency: 0.55, sourceDiversity: 0.70, recency: 0.99, businessImpact: 0.95 },
    evidence: {
      runsAnalysed: 2,
      timeWindow: 'Last 2 runs · Jun 2026',
      workflows: ['Vendor Master sync', 'Duplicate Invoice Detection'],
      entities: ['Acme Corp source', 'Amount column'],
    },
    conflictsWith: "Enterprise Context · 'Acme: Amount = column F' (approved 14 Apr 2026)",
    approvalStatus: 'pending',
    detectedOn: '27 Jun 2026',
    detectedBy: 'traceable',
  },
  {
    id: 'ins-override-stale',
    type: 'user-override-pattern',
    severity: 'med',
    scope: 'GST Mismatch Check',
    title: 'Analysts dismissed the same GST rounding warning 7 times',
    description:
      'A ±₹1 GST rounding warning on the GST Mismatch Check has been dismissed by reviewers in 7 of the last 8 runs. The rule is firing on immaterial rounding and is adding review noise without catching real exceptions.',
    recommendedAction:
      'Raise the GST rounding tolerance to ±₹2 or retire the rule — this is a stale-rule signal.',
    factors: { frequency: 0.90, sourceDiversity: 0.50, recency: 0.85, businessImpact: 0.55 },
    evidence: {
      runsAnalysed: 8,
      timeWindow: 'Last 8 runs · Feb–Jun 2026',
      workflows: ['GST Mismatch Check'],
      entities: ['GST rounding rule'],
    },
    approvalStatus: 'pending',
    detectedOn: '26 Jun 2026',
    detectedBy: 'traceable',
  },
  {
    id: 'ins-efficiency',
    type: 'workflow-efficiency-gap',
    severity: 'low',
    scope: 'Three-Way Match',
    title: 'Three-Way Match triggers a manual follow-up on ~40% of runs',
    description:
      'The Three-Way Match workflow has handed off to a manual reviewer on 11 of the last 28 runs, usually for the same unmatched-GRN reason. The follow-up is predictable enough to fold into the workflow itself.',
    recommendedAction:
      'Add an automated GRN-lookup step so the common manual follow-up is resolved inside the run.',
    factors: { frequency: 0.78, sourceDiversity: 0.45, recency: 0.70, businessImpact: 0.40 },
    evidence: {
      runsAnalysed: 28,
      timeWindow: 'Last quarter',
      workflows: ['Three-Way Match'],
      entities: ['Unmatched GRN'],
    },
    approvalStatus: 'pending',
    detectedOn: '24 Jun 2026',
    detectedBy: 'formula',
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
  scope: string;        // "All AP workflows", "Acme source only"…
  expiry?: string;      // optional analyst-set expiry
}

export const ENTERPRISE_CONTEXT: EnterpriseContextEntry[] = [
  {
    id: 'ec-net-sales',
    fact: 'total_revenue maps to the "Net Sales" column (not "Gross Sales").',
    origin: 'Promoted from Q1 Revenue Recon clarification',
    approvedBy: 'R. Mehta',
    approvedOn: '14 Apr 2026',
    scope: 'All revenue workflows',
  },
  {
    id: 'ec-shipping',
    fact: 'Shipping cost is a separate expense line — never folded into Cost of Goods.',
    origin: 'Promoted after two analysts disagreed on the same client',
    approvedBy: 'R. Mehta',
    approvedOn: '02 May 2026',
    scope: 'All P2P workflows',
  },
  {
    id: 'ec-apex-watch',
    fact: 'Apex Industrial Supplies (V-1234) is on a standing high-risk watch.',
    origin: 'Promoted from cross-workflow correlation',
    approvedBy: 'S. Iyer',
    approvedOn: '11 Jun 2026',
    scope: 'All AP workflows',
    expiry: 'Review by 30 Sep 2026',
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
  'Apex Industrial Supplies': {
    entity: 'Apex Industrial Supplies',
    vendorId: 'V-1234',
    onWatch: true,
    watchNote: 'On a standing high-risk watch (Enterprise Context · approved 11 Jun 2026).',
    alsoFlaggedIn: [
      { workflow: 'AP Ageing', detail: '90+ day bucket, 5 of last 6 runs', date: 'Jun 2026' },
      { workflow: 'PO Leakage Analysis', detail: '₹4.1L billed over PO', date: '19 Jun 2026' },
    ],
  },
  'Global Logistics Inc.': {
    entity: 'Global Logistics Inc.',
    vendorId: 'V-3318',
    alsoFlaggedIn: [
      { workflow: 'Duplicate Invoice Detection', detail: '1 duplicate group last month', date: 'May 2026' },
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
  previousRunLabel: 'Invoice Duplicate Detection — May 2026',
  previousRunDate: '02 May 2026',
  carriedOver: 6,
  newFindings: [
    { ref: 'DG-004', detail: 'Meridian Office Supplies — new near-duplicate pair this month' },
  ],
  resolvedFindings: [
    { ref: 'DG-009', detail: 'TechCore duplicate from May was voided and cleared' },
    { ref: 'DG-011', detail: 'Northwind pair reconciled after vendor merge' },
  ],
  kpiDeltas: [
    { label: 'Flags Raised', current: '8', previous: '9', direction: 'down' },
    { label: 'Records Processed', current: '4,521', previous: '4,180', direction: 'up' },
    { label: '$ at Risk', current: '₹49.6L', previous: '₹52.1L', direction: 'down' },
  ],
};

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
  cachedCost: '$0.04',
  freshCost: '$0.34',
  savedVs: 'vs a full re-plan + code-gen',
  matchedRecord: 'Golden record · Invoice Duplicate Detection v3 (frozen 02 May 2026)',
  recomputedSteps: ['Detect near-duplicate invoices'],
};

// ─── Memory-backed assumptions (Chat surface) ─────────────────────────────
// Provenance attached to an assumption so the chat can say "based on your
// earlier input I assumed X" instead of asking the same clarification again.
// Consumed by the shared AssumptionsCard via the optional `memory` field.

export interface AssumptionMemory {
  /** Short source label, e.g. "Q1 Revenue Recon". */
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
