// ─── Dashboard insights — cross-widget correlations, trigger-gated ──────────
//
// A dashboard's alert bell watches ONE widget; the digest lists ONE event per
// line. The insight surface exists for what neither can say: two or three
// widgets read TOGETHER. Every insight here must clear the same bar as the
// rest of the engine (AI-INSIGHT-QUALIFICATION-CRITERIA.md):
//
//   • 2+ supporting widgets — a single widget's movement is a stat, not an
//     insight; it already has a threshold bell.
//   • Counts, not shares, on small denominators (no "33% of 3 rows").
//   • One snapshot is not history: evidenceNote says "directional", factors
//     stay capped, and no recurrence claim is made anywhere.
//   • Cause is a candidate to confirm, never an auto-conclusion.
//
// Two insights per dashboard: the finding the reader can't miss, and — when
// the widgets earn it — one corroborated PASS (negative assurance is a result,
// not filler). Numbers are lifted verbatim from DASHBOARDS / DAILY_DIGESTS in
// DashboardView so the story matches what the widgets show.
//
// Data + pure helpers only — no JSX. Deterministic: literals, no Date.now().

import type { LayeredInsight } from './layeredInsights';

export type InsightDashboardId = 'p2p' | 'o2c' | 's2c' | 'grc' | 'excel' | 'sql';

/** The generator's honest pipeline, worded for the dashboard altitude. */
export const DASHBOARD_INSIGHT_PIPELINE = [
  'Reading every widget and KPI on this dashboard',
  'Correlating movements across widgets',
  'Checking the correlations against targets and thresholds',
  'Writing the insights',
];

/** Idle-gate scan clause ("{scan}, correlates the findings, …"). */
export const DASHBOARD_INSIGHT_SCAN = 'Reads every widget and KPI on this dashboard';

// Which widget a "Set threshold alert" follow-through should pre-fill — the
// widget whose movement would have caught this finding earlier.
const ALERT_WIDGET: Record<string, string> = {
  'di-p2p-aging': 'Duplicate Flags',
  'di-p2p-cleanup': 'Compliance Rate',
  'di-o2c-collections': 'Monthly Collections ($M)',
  'di-o2c-revenue-quality': 'Disputed',
  'di-s2c-renewals': 'Vendor Compliance Scores',
  'di-s2c-savings': 'Savings Realized',
  'di-grc-scope': 'Controls Tested',
  'di-grc-automation': 'Workflow Runs',
  'di-sql-risk-pay': 'Avg Days to Pay',
  'di-sql-discount': 'Avg Risk Score',
};

export function insightAlertWidget(insightId: string): string {
  return ALERT_WIDGET[insightId] ?? 'Dashboard KPI';
}

const DETECTED_ON = '30 Jul 2026';

const INSIGHTS: Record<InsightDashboardId, LayeredInsight[]> = {
  p2p: [
    {
      id: 'di-p2p-aging',
      layer: 'engagement',
      subjectId: 'dash-p2p-aging',
      subjectLabel: 'Procurement (P2P)',
      takeaway: 'The duplicate-flag KPI is improving while the oldest flagged invoices sit unworked — the queue is aging under a healthy headline.',
      verdict: { label: 'Needs attention before the next batch', tone: 'caution' },
      severity: 'med',
      likelyCause: {
        label: 'Resolution effort looks focused on the newest flags.',
        detail: 'The −12% headline tracks the total of open flags, so clearing easy new arrivals improves it even while the December-dated reviews never move. Confirm queue ownership before relying on the trend.',
      },
      reasoning: 'Read across three widgets — the Duplicate Flags KPI, the Invoice Records table and the overnight digest. One review queue, counted once.',
      atStake: '3 of the 8 sampled invoice records are duplicate-matched and still open, the oldest since 13-Dec — a payment batch can release a duplicate while its flag waits.',
      freshness: 'new',
      freshnessNote: 'First surfaced from this dashboard snapshot',
      observations: [
        'Duplicate Flags reads 23 open, down 12% — while processed volume is up 8.2% in the same period.',
        '3 of the 8 sampled Invoice Records rows are duplicate-matched and still Pending/Under Review; the oldest (INV-040083) is dated 13-Dec. Counts, not shares — the sample is small.',
        '3 new flags landed overnight: Acme Corp (2), Global Supplies (1) — arrivals have not stopped.',
      ],
      stakes: [
        'A duplicate can reach payment while its flag ages in the queue — the exposure the improving KPI hides.',
        'The headline will keep improving even if the oldest flags never close, so nobody is forced to look.',
      ],
      kpis: [
        { value: '3', unit: '/ 8', label: 'Sampled still open', sub: 'duplicate-matched and unworked — the oldest since 13-Dec', tone: 'bad' },
        { value: '−12%', label: 'Headline KPI', sub: '23 flags open — improving while the tail ages unseen' },
        { value: '+3', label: 'Overnight arrivals', sub: 'Acme Corp (2), Global Supplies (1) — arrivals have not stopped' },
      ],
      factors: { frequency: 0.55, sourceDiversity: 0.6, recency: 0.95, businessImpact: 0.6 },
      evidence: [
        { ref: 'KPI', label: 'Duplicate Flags KPI', detail: '23 open · −12% vs last period', tone: 'positive' },
        { ref: 'Invoice Records', label: 'Invoice Records table', detail: '3 of 8 sampled rows duplicate-matched, still open · oldest 13-Dec', tone: 'negative' },
        { ref: 'Daily digest', label: 'Overnight digest', detail: '3 new flags — Acme Corp (2), Global Supplies (1)', tone: 'caution' },
      ],
      evidenceNote: 'Read from this dashboard’s widgets — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'split', label: 'Split open flags by age bucket' },
        { kind: 'trace', label: 'Trace the December-dated reviews', detail: 'INV-025832 · INV-040083' },
        { kind: 'ask', label: 'Ask which flags have no owner' },
      ],
      recommendedActions: [
        'Work the December-dated duplicate reviews before the next payment batch releases.',
        'Alert on flag age, not flag count — the count is what let the queue age unseen.',
      ],
      recommendations: [
        {
          id: 'di-p2p-aging-r1', category: 'timeliness', priority: 'do-now', intent: 'edit',
          title: 'Assign the December-dated duplicate reviews before the next payment batch',
          rationale: 'The oldest open flags are the exposure the improving KPI hides — a batch release pays a duplicate the queue already caught.',
          basis: 'Exception aging SLA',
          guardrail: 'Whether to hold the batch while they clear is the payables lead’s call.',
        },
        {
          id: 'di-p2p-aging-r2', category: 'monitoring', priority: 'this-period', intent: 'monitor',
          title: 'Add a threshold alert on oldest-open-flag age',
          rationale: 'Count-based tracking rewarded clearing new arrivals; an age threshold makes the queue’s tail visible the day it slips.',
          basis: 'Monitoring design',
        },
      ],
    },
    {
      id: 'di-p2p-cleanup',
      layer: 'engagement',
      subjectId: 'dash-p2p-cleanup',
      subjectLabel: 'Procurement (P2P)',
      takeaway: 'Three widgets moved together after the vendor-master cleanup — the improvement is corroborated, not a single-metric blip.',
      verdict: { label: 'Holding — corroborated pass', tone: 'positive' },
      severity: 'low',
      likelyCause: {
        label: 'The vendor-master cleanup looks to be the shared driver.',
        detail: 'Compliance, processing time and duplicate flags all improved after the same intervention. One snapshot can’t prove causation — check the moves against the cleanup change log before crediting it.',
      },
      reasoning: 'Three independent KPIs and the digest, read once against one intervention — corroboration, not repetition.',
      atStake: 'Nothing at stake this period — hold the cadence and the assurance stays current.',
      observations: [
        'Compliance Rate is 94.2% (+1.4 pts), Avg Processing Time is 1.8 days (−0.3d), Duplicate Flags are down 12% — three separate widgets, one direction.',
        'The digest dates the vendor-master cleanup 12h before the compliance move — the timing lines up.',
      ],
      stakes: [
        'Nothing at stake this period. The one open thread is Atlas Manufacturing’s pending KYC — keep it ahead of the next payment batch.',
      ],
      kpis: [
        { value: '3', unit: '/ 3', label: 'KPIs improved', sub: 'compliance, processing time and duplicates — one direction' },
        { value: '94.2%', label: 'Compliance rate', sub: '+1.4 pts in the window after the cleanup' },
        { value: '12h', label: 'Cleanup → move', sub: 'the digest dates the cleanup just before the compliance move' },
      ],
      factors: { frequency: 0.5, sourceDiversity: 0.65, recency: 0.95, businessImpact: 0.35 },
      evidence: [
        { ref: 'KPI', label: 'Compliance Rate', detail: '94.2% · +1.4 pts after cleanup', tone: 'positive' },
        { ref: 'KPI', label: 'Avg Processing Time', detail: '1.8 days · −0.3d', tone: 'positive' },
        { ref: 'KPI', label: 'Duplicate Flags', detail: '−12% vs last period', tone: 'positive' },
      ],
      evidenceNote: 'Read from this dashboard’s widgets — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'compare', label: 'Compare against the pre-cleanup month' },
        { kind: 'ask', label: 'Ask what the cleanup changed' },
      ],
      recommendedActions: [
        'Re-read the three KPIs after the next vendor-master refresh to confirm the improvement holds.',
        'Expedite Atlas Manufacturing’s KYC before it reaches a payment batch.',
      ],
      recommendations: [
        {
          id: 'di-p2p-cleanup-r1', category: 'monitoring', priority: 'advisory', intent: 'monitor',
          title: 'Re-check the three KPIs after the next vendor-master refresh',
          rationale: 'If the next refresh holds the same levels, the cleanup graduates from a one-snapshot read to a trend you can rely on.',
          basis: 'Trend confirmation',
        },
        {
          id: 'di-p2p-cleanup-r2', category: 'timeliness', priority: 'this-period', intent: 'edit',
          title: 'Expedite Atlas Manufacturing’s KYC before the next payment batch',
          rationale: 'The one open thread in an otherwise clean read — an unverified vendor reaching payment undoes the assurance above.',
          guardrail: 'Whether to block payment until KYC clears is the vendor-master owner’s call.',
        },
      ],
    },
  ],

  o2c: [
    {
      id: 'di-o2c-collections',
      layer: 'engagement',
      subjectId: 'dash-o2c-collections',
      subjectLabel: 'Order to Cash (O2C)',
      takeaway: 'Recognition is growing faster than cash is arriving — March collections dropped $1.1M while two $180K+ approvals sit past SLA.',
      verdict: { label: 'At risk before close', tone: 'negative' },
      severity: 'high',
      likelyCause: {
        label: 'The DSO gain reads like the collection drive, not a durable change.',
        detail: 'DSO improved to 38 days right after the drive, while the monthly collections bar fell back in March. If the drive pulled cash forward, April will give it back. Confirm against the drive’s ledger before relying on the DSO trend.',
      },
      reasoning: 'Read across the Revenue KPI, the Monthly Collections bars, the DSO KPI and the SLA alert — one cash-conversion story, counted once.',
      atStake: 'Two invoices above $180K each are past approval SLA while recognized revenue runs +12% — the growth is booked, the cash is not.',
      freshness: 'new',
      freshnessNote: 'First surfaced from this dashboard snapshot',
      observations: [
        'Revenue Recognized is $42.5M, up 12% — while Monthly Collections fell from $8.3M (Feb) to $7.2M (Mar).',
        'DSO improved to 38 days (−2d) in the same window the digest credits to a collection drive — the two moves may be the same event.',
        '2 invoices above $180K are pending approval beyond SLA (digest, 3h ago).',
      ],
      stakes: [
        'If the drive pulled April’s cash into March, the DSO gain reverses next month — after close has priced it in.',
        'The two SLA-breached approvals age toward the quarter boundary with every day unescalated.',
      ],
      kpis: [
        { value: '−$1.1M', label: 'March collections', sub: '$8.3M → $7.2M while recognition runs +12%', tone: 'bad' },
        { value: '2', label: 'Approvals past SLA', sub: '$180K+ each — aging toward the quarter boundary', tone: 'bad' },
        { value: '38', unit: 'days', label: 'DSO', sub: '−2d right after the drive — April decides if it holds' },
      ],
      factors: { frequency: 0.55, sourceDiversity: 0.65, recency: 0.95, businessImpact: 0.8 },
      evidence: [
        { ref: 'KPI', label: 'Revenue Recognized', detail: '$42.5M · +12%', tone: 'caution' },
        { ref: 'Monthly Collections', label: 'Monthly Collections bars', detail: 'Feb $8.3M → Mar $7.2M', tone: 'negative' },
        { ref: 'Daily digest', label: 'SLA alert', detail: '2 invoices $180K+ past approval SLA', tone: 'negative' },
      ],
      evidenceNote: 'Read from this dashboard’s widgets — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'split', label: 'Split March collections by customer' },
        { kind: 'compare', label: 'Compare the drive’s haul vs the March dip' },
        { kind: 'ask', label: 'Ask which approvals are stuck and where' },
      ],
      recommendedActions: [
        'Escalate the two SLA-breached $180K+ approvals today.',
        'Watch April collections against recognition before crediting the DSO gain.',
      ],
      recommendations: [
        {
          id: 'di-o2c-collections-r1', category: 'timeliness', priority: 'do-now', intent: 'edit',
          title: 'Escalate the two SLA-breached $180K+ approvals',
          rationale: 'They are the largest single cash items on the board and every unescalated day pushes them toward the quarter boundary.',
          basis: 'Approval SLA',
        },
        {
          id: 'di-o2c-collections-r2', category: 'monitoring', priority: 'this-period', intent: 'monitor',
          title: 'Alert on collections-vs-recognition divergence, not DSO alone',
          rationale: 'DSO absorbed the collection drive and read as improvement — the divergence between the two lines is the earlier, harder-to-flatter signal.',
          basis: 'Monitoring design',
        },
      ],
    },
    {
      id: 'di-o2c-revenue-quality',
      layer: 'engagement',
      subjectId: 'dash-o2c-revenue-quality',
      subjectLabel: 'Order to Cash (O2C)',
      takeaway: 'Two revenue-quality signals are converging on quarter close — 34 open disputes (+3) and an unresolved Q4 rev-rec timing discrepancy.',
      verdict: { label: 'Clear before close', tone: 'caution' },
      severity: 'med',
      likelyCause: {
        label: 'Both signals may share a billing-timing root.',
        detail: 'Disputes and a recognition-timing flag rising together often trace to the same invoicing cut-off practice. That is a candidate, not a finding — sample the newest disputes before treating them as one issue.',
      },
      reasoning: 'The Disputed KPI and the digest’s rev-rec flag are separate widgets pointing at the same close — read once, together.',
      atStake: 'A timing discrepancy that survives into close becomes a restatement conversation instead of a journal fix.',
      freshness: 'new',
      freshnessNote: 'First surfaced from this dashboard snapshot',
      observations: [
        'Disputed orders read 34, up 3 this period.',
        'The digest carries an unresolved revenue-recognition timing discrepancy flagged in Q4 entries.',
      ],
      stakes: [
        'Anything unresolved at close hardens: a pre-close journal fix becomes a post-close adjustment with sign-off implications.',
      ],
      kpis: [
        { value: '34', label: 'Open disputes', sub: '↑ 3 this period — converging on quarter close', tone: 'bad' },
        { value: '1', label: 'Rev-rec discrepancy', sub: 'Q4 timing flag still unresolved in the digest' },
        { value: '2', label: 'Signals, one root?', sub: 'both may share a billing-timing cause — sample before merging' },
      ],
      factors: { frequency: 0.45, sourceDiversity: 0.5, recency: 0.9, businessImpact: 0.65 },
      evidence: [
        { ref: 'KPI', label: 'Disputed', detail: '34 open · +3', tone: 'caution' },
        { ref: 'Daily digest', label: 'Rev-rec check', detail: '1 timing discrepancy flagged in Q4 entries', tone: 'negative' },
      ],
      evidenceNote: 'Read from this dashboard’s widgets — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'trace', label: 'Trace the Q4 timing discrepancy' },
        { kind: 'split', label: 'Split the 3 newest disputes by cause' },
        { kind: 'ask', label: 'Ask whether the disputes share a billing period' },
      ],
      recommendedActions: [
        'Resolve the Q4 timing discrepancy before period close.',
        'Sample the three newest disputes for the same timing pattern.',
      ],
      recommendations: [
        {
          id: 'di-o2c-revq-r1', category: 'evidence', priority: 'this-period', intent: 'retest',
          title: 'Clear the Q4 rev-rec timing discrepancy before close',
          rationale: 'Pre-close it is a journal fix; post-close it is an adjustment with sign-off implications.',
          basis: 'Period-close checklist',
        },
        {
          id: 'di-o2c-revq-r2', category: 'sampling', priority: 'advisory', intent: 'retest',
          title: 'Sample the 3 newest disputes for a shared billing-timing cause',
          rationale: 'If the disputes and the rev-rec flag share a root, one fix closes both — sample before treating them separately.',
          basis: 'Targeted sampling',
          guardrail: 'Whether they aggregate into one finding is the reviewer’s judgment.',
        },
      ],
    },
  ],

  s2c: [
    {
      id: 'di-s2c-renewals',
      layer: 'engagement',
      subjectId: 'dash-s2c-renewals',
      subjectLabel: 'Source to Contract (S2C)',
      takeaway: 'Renewal exposure is stacking on the weakest vendors — contracts are expiring while the two lowest compliance scores on the board sit at 65% and 72%.',
      verdict: { label: 'Act before the renewals land', tone: 'negative' },
      severity: 'high',
      likelyCause: {
        label: 'The renewal calendar and vendor scoring look like separate processes.',
        detail: 'Expiry dates come from the contract system, compliance scores from vendor monitoring — nothing on this board joins them before a renewal is signed. Confirm with the sourcing owner before concluding.',
      },
      reasoning: 'Read across the Expiring Soon KPI, the Vendor Compliance Scores widget and the digest’s expiry alert — one renewal window, counted once.',
      atStake: '2 of the 4 contracts expiring within 30 days are high-value (>$500K each) — renewing on yesterday’s terms locks in another cycle with under-bar vendors.',
      freshness: 'new',
      freshnessNote: 'First surfaced from this dashboard snapshot',
      observations: [
        'Expiring Soon reads 12 contracts, up 4 — and the digest narrows it: 4 expire within 30 days, 2 of them above $500K.',
        'Vendor Compliance Scores shows FastShip at 65% and TechParts Ltd at 72% — the only two vendors under the 75% bar on the board.',
        '3 vendors were downgraded to Medium risk in the same window (digest, 1d ago).',
      ],
      stakes: [
        'A renewal signed before the scores are read locks in a full contract cycle with an under-bar vendor.',
        'The two >$500K expirations carry most of the money in the 30-day window.',
      ],
      kpis: [
        { value: '4', unit: '/ 12', label: 'Expiring in 30 days', sub: '2 above $500K — most of the money in the window', tone: 'bad' },
        { value: '65%', label: 'Lowest vendor score', sub: 'FastShip — TechParts at 72% joins it under the 75% bar', tone: 'bad' },
        { value: '3', label: 'Downgraded', sub: 'vendors moved to Medium risk in the same window' },
      ],
      factors: { frequency: 0.5, sourceDiversity: 0.6, recency: 0.9, businessImpact: 0.85 },
      evidence: [
        { ref: 'KPI', label: 'Expiring Soon', detail: '12 contracts · +4', tone: 'caution' },
        { ref: 'Vendor Compliance Scores', label: 'Compliance scores', detail: 'FastShip 65% · TechParts 72% — under the 75% bar', tone: 'negative' },
        { ref: 'Daily digest', label: 'Expiry alert', detail: '4 expire within 30 days · 2 above $500K', tone: 'negative' },
      ],
      evidenceNote: 'Read from this dashboard’s widgets — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'trace', label: 'Match the 4 expiring contracts to their vendors' },
        { kind: 'split', label: 'Split expirations by vendor score band' },
        { kind: 'ask', label: 'Ask which renewals auto-renew' },
      ],
      recommendedActions: [
        'Start renegotiation on the two >$500K expiring contracts with compliance conditions attached.',
        'Suspend auto-renewal for vendors scoring under 75% until scores recover.',
      ],
      recommendations: [
        {
          id: 'di-s2c-renewals-r1', category: 'timeliness', priority: 'do-now', intent: 'edit',
          title: 'Open renegotiation on the two >$500K expiring contracts now',
          rationale: 'A 30-day window is the minimum for renegotiating terms — waiting converts the decision into a rollover.',
          basis: 'Contract renewal leadtime',
          guardrail: 'Commercial terms stay the sourcing lead’s call — this flags the window, not the answer.',
        },
        {
          id: 'di-s2c-renewals-r2', category: 'monitoring', priority: 'this-period', intent: 'monitor',
          title: 'Gate auto-renewal on the vendor compliance score',
          rationale: 'Joining the two systems this board reads separately prevents the next under-bar renewal from happening silently.',
          basis: 'Vendor governance',
        },
      ],
    },
    {
      id: 'di-s2c-savings',
      layer: 'engagement',
      subjectId: 'dash-s2c-savings',
      subjectLabel: 'Source to Contract (S2C)',
      takeaway: 'Savings are ahead while the contract base grows — $2.1M realized (+$340K) across 18 net-new contracts, with the vendor score rising alongside.',
      verdict: { label: 'Holding — corroborated pass', tone: 'positive' },
      severity: 'low',
      likelyCause: {
        label: 'Category consolidation looks like the shared driver.',
        detail: 'Savings, contract count and the aggregate vendor score improving together usually trace to consolidating spend on fewer, better vendors. Confirm against the category plan before crediting it.',
      },
      reasoning: 'Three KPIs moving the same way is corroboration — read once against the sourcing plan, not three separate wins.',
      atStake: 'Nothing at stake this period — hold the cadence and the assurance stays current.',
      observations: [
        'Savings Realized is $2.1M, up $340K, while Active Contracts grew by 18 — the savings rate is holding through growth.',
        'The aggregate Vendor Score rose 2.3 pts to 87% in the same window.',
      ],
      stakes: [
        'Nothing at stake this period. The renewal-window finding above is the one active thread on this board.',
      ],
      kpis: [
        { value: '$2.1M', label: 'Savings realized', sub: '+$340K — the rate is holding through growth' },
        { value: '+18', label: 'Net-new contracts', sub: 'the base grew without diluting the savings pace' },
        { value: '87%', label: 'Vendor score', sub: '+2.3 pts alongside — consistent with consolidation' },
      ],
      factors: { frequency: 0.5, sourceDiversity: 0.6, recency: 0.9, businessImpact: 0.3 },
      evidence: [
        { ref: 'KPI', label: 'Savings Realized', detail: '$2.1M · +$340K', tone: 'positive' },
        { ref: 'KPI', label: 'Active Contracts', detail: '234 · +18', tone: 'positive' },
        { ref: 'KPI', label: 'Vendor Score', detail: '87% · +2.3 pts', tone: 'positive' },
      ],
      evidenceNote: 'Read from this dashboard’s widgets — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'split', label: 'Split savings by category' },
        { kind: 'ask', label: 'Ask which categories drove the gain' },
      ],
      recommendedActions: [
        'Hold the consolidation cadence; re-read after next quarter’s category review.',
      ],
      recommendations: [
        {
          id: 'di-s2c-savings-r1', category: 'monitoring', priority: 'advisory', intent: 'monitor',
          title: 'Re-read the savings pace after next quarter’s category review',
          rationale: 'One good window is a read, not a trend — the next review either confirms the consolidation story or catches it flattening.',
          basis: 'Trend confirmation',
        },
      ],
    },
  ],

  grc: [
    {
      id: 'di-grc-scope',
      layer: 'engagement',
      subjectId: 'dash-grc-scope',
      subjectLabel: 'GRC Overview',
      takeaway: 'Scope is growing faster than testing closes it — 2 risks joined the register while 10 of 24 controls remain untested and DEF-002 is 6 days from deadline.',
      verdict: { label: 'Reprioritize this week', tone: 'negative' },
      severity: 'high',
      likelyCause: {
        label: 'Testing capacity looks allocated by calendar, not by exposure.',
        detail: 'The tested count is rising (+3), but the weakest families on the Control Effectiveness widget — Auth at 70, SOD at 78 — are where untested exposure costs most. Confirm the test plan’s ordering with the control owners before concluding.',
      },
      reasoning: 'Read across the Total Risks KPI, Controls Tested, the Audit Completion widget and the digest’s DEF-002 deadline — one capacity question, counted once.',
      atStake: 'A material-weakness deadline in 6 days, 10 untested controls, and a new risk (RSK-012) with no mapped control yet — all competing for the same testing capacity.',
      freshness: 'new',
      freshnessNote: 'First surfaced from this dashboard snapshot',
      observations: [
        'Total Risks reads 12 (+2 this period); Controls Tested reads 14 of 24 — the untested pool is 10 while the register grows.',
        'DEF-002 remediation is due in 6 days and still shows "in progress" (digest, 2h ago).',
        'SOX FY26 completion sits at 58% on the Audit Completion widget; the weakest effectiveness families are Auth (70) and SOD (78).',
      ],
      stakes: [
        'A missed DEF-002 deadline converts a tracked deficiency into a reportable failure.',
        'RSK-012 (GL balance discrepancy, R2R) ages uncovered while capacity goes to the calendar.',
      ],
      kpis: [
        { value: '10', unit: '/ 24', label: 'Controls untested', sub: 'while the register added 2 risks this period', tone: 'bad' },
        { value: '6', unit: 'days', label: 'DEF-002 deadline', sub: 'remediation still “in progress” — the hardest date on the board', tone: 'bad' },
        { value: '58%', label: 'SOX FY26 complete', sub: 'weakest families Auth (70) and SOD (78) — order capacity by exposure' },
      ],
      factors: { frequency: 0.6, sourceDiversity: 0.7, recency: 0.95, businessImpact: 0.85 },
      evidence: [
        { ref: 'KPI', label: 'Total Risks', detail: '12 · +2 this period', tone: 'caution' },
        { ref: 'KPI', label: 'Controls Tested', detail: '14 of 24 · 10 untested', tone: 'negative' },
        { ref: 'Daily digest', label: 'DEF-002 deadline', detail: 'Remediation due in 6 days · in progress', tone: 'negative' },
        { ref: 'Audit Completion', label: 'SOX FY26', detail: '58% complete', tone: 'caution' },
      ],
      evidenceNote: 'Read from this dashboard’s widgets — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'split', label: 'Split the 10 untested controls by family' },
        { kind: 'trace', label: 'Trace DEF-002’s remediation evidence' },
        { kind: 'ask', label: 'Ask what RSK-012 needs to be covered' },
      ],
      recommendedActions: [
        'Evidence DEF-002’s remediation ahead of the 6-day deadline.',
        'Pull the untested Auth and SOD controls to the front of the plan; map a control to RSK-012.',
      ],
      recommendations: [
        {
          id: 'di-grc-scope-r1', category: 'timeliness', priority: 'do-now', intent: 'retest',
          title: 'Evidence DEF-002’s remediation before the deadline',
          rationale: 'Six days out with status "in progress" is the board’s hardest deadline — everything else on this card can slip a week; this cannot.',
          basis: 'Remediation SLA',
        },
        {
          id: 'di-grc-scope-r2', category: 'coverage', priority: 'this-period', intent: 'create',
          title: 'Map a control to RSK-012 before it ages past the period',
          rationale: 'A new risk with no mapped control is uncovered exposure the testing plan can’t even see yet.',
          basis: 'Risk-control mapping',
          guardrail: 'Which control design fits R2R stays the process owner’s call.',
        },
      ],
    },
    {
      id: 'di-grc-automation',
      layer: 'engagement',
      subjectId: 'dash-grc-automation',
      subjectLabel: 'GRC Overview',
      takeaway: 'Automation is absorbing the added scope — 156 workflow runs (+23) this period while deficiencies fell to 2 and the tested count rose.',
      verdict: { label: 'Holding — corroborated pass', tone: 'positive' },
      severity: 'low',
      likelyCause: {
        label: 'The automation push looks to be carrying the testing pace.',
        detail: 'Runs, tested controls and the deficiency count all moved the right way together — and the digest prices it at 45 person-hours saved this month. Confirm the runs map to the tested controls before crediting automation.',
      },
      reasoning: 'Three widgets and the digest moving together — corroboration for one driver, read once.',
      atStake: 'Nothing at stake this period — the capacity question in the scope insight above is where attention belongs.',
      observations: [
        'Workflow Runs read 156, up 23; Deficiencies fell to 2 (−1); Controls Tested rose by 3.',
        'The digest prices the automation gain at 45 person-hours saved this month.',
      ],
      stakes: [
        'Nothing at stake this period. The unautomated remainder of the 10 untested controls is the natural next target.',
      ],
      kpis: [
        { value: '156', label: 'Workflow runs', sub: '+23 this period — automation absorbing the added scope' },
        { value: '2', label: 'Deficiencies', sub: '−1 while tested controls rose 3 — moving the right way together' },
        { value: '45', unit: 'hrs', label: 'Saved this month', sub: 'the digest prices the automation gain in person-hours' },
      ],
      factors: { frequency: 0.5, sourceDiversity: 0.6, recency: 0.9, businessImpact: 0.35 },
      evidence: [
        { ref: 'KPI', label: 'Workflow Runs', detail: '156 · +23', tone: 'positive' },
        { ref: 'KPI', label: 'Deficiencies', detail: '2 · −1', tone: 'positive' },
        { ref: 'Daily digest', label: 'Automation gain', detail: '45 person-hours saved this month', tone: 'positive' },
      ],
      evidenceNote: 'Read from this dashboard’s widgets — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'split', label: 'Split runs by control family' },
        { kind: 'ask', label: 'Ask which untested controls have a workflow template' },
      ],
      recommendedActions: [
        'Extend automation to whichever of the 10 untested controls already has a workflow template.',
      ],
      recommendations: [
        {
          id: 'di-grc-automation-r1', category: 'automation', priority: 'advisory', intent: 'create',
          title: 'Extend automation to the untested controls that already have templates',
          rationale: 'The cheapest capacity on the board — the saved 45 person-hours came from exactly this move on other controls.',
          basis: 'Automation coverage',
        },
      ],
    },
  ],

  excel: [],

  sql: [
    {
      id: 'di-sql-risk-pay',
      layer: 'engagement',
      subjectId: 'dash-sql-risk-pay',
      subjectLabel: 'Live SQL — Vendor Risk',
      takeaway: 'Payment is accelerating into a riskier vendor pool — days-to-pay fell to 38 in the same week 5 vendors crossed the 70-point risk threshold.',
      verdict: { label: 'Review before the next batch', tone: 'negative' },
      severity: 'high',
      likelyCause: {
        label: 'Early-payment eligibility doesn’t look risk-gated.',
        detail: 'The discount drive that improved days-to-pay applies on invoice terms, and nothing on this board suggests it reads risk scores. If so, the newly-risky vendors are being paid faster too. Confirm the eligibility rule before concluding.',
      },
      reasoning: 'Read across the Avg Days to Pay KPI, the risk-threshold alert and the Vendor Records table — one payment-speed question, counted once.',
      atStake: 'Of the three 70+ vendors visible in the sample, two are still Active with ₹7.98L outstanding between them; only TechParts Ltd is on Hold.',
      freshness: 'new',
      freshnessNote: 'First surfaced from this dashboard snapshot',
      observations: [
        'Avg Days to Pay fell to 38d (−4d) in the same week the digest flags 5 vendors crossing the 70-point risk threshold.',
        'In the sampled Vendor Records, the 70+ vendors are Acme Global Imaging (78, Active, ₹4.82L outstanding), Korean Technologies (71, Active, ₹3.16L) and TechParts Ltd (82 — already on Hold). Counts, not shares: the sample is 8 rows.',
        'Outstanding invoice volume is up 18% MoM, driven by Procurement — more flow through the same ungated rule.',
      ],
      stakes: [
        'Faster payment shrinks the window in which a risk review can stop a payment to a deteriorating vendor.',
        '₹7.98L sits outstanding with the two Active 70+ vendors in the sample alone.',
      ],
      kpis: [
        { value: '38', unit: 'days', label: 'Avg days to pay', sub: '−4d in the week 5 vendors crossed the 70-point bar', tone: 'bad' },
        { value: '2', unit: '/ 3', label: '70+ still Active', sub: 'only TechParts is on Hold — the review hasn’t reached the rest', tone: 'bad' },
        { value: '₹7.98L', label: 'Outstanding', sub: 'with the two Active 70+ vendors in the sample alone' },
      ],
      factors: { frequency: 0.55, sourceDiversity: 0.65, recency: 0.95, businessImpact: 0.8 },
      evidence: [
        { ref: 'KPI', label: 'Avg Days to Pay', detail: '38d · −4d', tone: 'caution' },
        { ref: 'Daily digest', label: 'Risk threshold alert', detail: '5 vendors crossed 70 — Acme Global, Korean Tech, +3', tone: 'negative' },
        { ref: 'Vendor Records', label: 'Sampled 70+ vendors', detail: '2 of 3 still Active · ₹7.98L outstanding combined', tone: 'negative' },
      ],
      evidenceNote: 'Read live from public.vendors and public.invoices — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'split', label: 'Split the 5 flagged vendors by outstanding amount' },
        { kind: 'trace', label: 'Trace the two Active 70+ vendors’ open invoices' },
        { kind: 'ask', label: 'Ask whether early-payment eligibility reads risk scores' },
      ],
      recommendedActions: [
        'Hold the 5 threshold-crossing vendors out of the next payment batch pending review.',
        'Gate early-payment eligibility on the risk score.',
      ],
      recommendations: [
        {
          id: 'di-sql-risk-pay-r1', category: 'monitoring', priority: 'do-now', intent: 'monitor',
          title: 'Hold the 5 threshold-crossing vendors from the next payment batch',
          rationale: 'TechParts is already on Hold — the same review that put it there hasn’t reached the other four, and payment now runs 4 days faster.',
          basis: 'Vendor risk policy',
          guardrail: 'Releasing any individual payment stays the payables lead’s call.',
        },
        {
          id: 'di-sql-risk-pay-r2', category: 'automation', priority: 'this-period', intent: 'edit',
          title: 'Add a risk-score gate to early-payment eligibility',
          rationale: 'Joins the two systems this board reads separately, so a rising score slows payment automatically instead of after a review catches it.',
          basis: 'Payment-run design',
        },
      ],
    },
    {
      id: 'di-sql-discount',
      layer: 'engagement',
      subjectId: 'dash-sql-discount',
      subjectLabel: 'Live SQL — Vendor Risk',
      takeaway: 'The early-payment drive is holding — days-to-pay improved 4 days while the average risk score fell 3 points in the same window.',
      verdict: { label: 'Holding — corroborated pass', tone: 'positive' },
      severity: 'low',
      likelyCause: {
        label: 'Discount uptake looks to be the shared driver.',
        detail: 'Days-to-pay and the average risk score improving together is consistent with healthier vendors taking the discount. One snapshot can’t prove it — re-read after next month’s refresh.',
      },
      reasoning: 'Two KPIs and the digest’s improvement line, read once against one intervention.',
      atStake: 'Nothing at stake this period — the ungated 70+ vendors in the insight above are the active thread.',
      observations: [
        'Avg Days to Pay is 38d (−4d); Avg Risk Score is 42 (−3) — both improved across the same window.',
        'The digest attributes the days-to-pay gain to early-payment discount uptake.',
      ],
      stakes: [
        'Nothing at stake this period. The tail risk is the one the companion insight covers: fast payment reaching the wrong vendors.',
      ],
      kpis: [
        { value: '−4', unit: 'days', label: 'Days to pay', sub: 'now 38d — the discount drive is landing' },
        { value: '−3', unit: 'pts', label: 'Avg risk score', sub: 'now 42 — consistent with healthier vendors taking the discount' },
        { value: '2', unit: '/ 2', label: 'KPIs corroborate', sub: 'one more window graduates this read to a trend' },
      ],
      factors: { frequency: 0.45, sourceDiversity: 0.55, recency: 0.9, businessImpact: 0.3 },
      evidence: [
        { ref: 'KPI', label: 'Avg Days to Pay', detail: '38d · −4d', tone: 'positive' },
        { ref: 'KPI', label: 'Avg Risk Score', detail: '42 · −3', tone: 'positive' },
      ],
      evidenceNote: 'Read live from public.vendors and public.invoices — one snapshot, no run history. Treat as directional.',
      runsAnalysed: 1,
      detectedOn: DETECTED_ON,
      detectedBy: 'formula',
      checkMore: [
        { kind: 'compare', label: 'Compare uptake vs days-to-pay by month' },
        { kind: 'ask', label: 'Ask which categories take the discount' },
      ],
      recommendedActions: [
        'Hold the drive; re-read both KPIs after next month’s refresh.',
      ],
      recommendations: [
        {
          id: 'di-sql-discount-r1', category: 'monitoring', priority: 'advisory', intent: 'monitor',
          title: 'Re-read days-to-pay and risk score after next month’s refresh',
          rationale: 'A second window either graduates this to a trend or catches the drive flattening — either answer is useful.',
          basis: 'Trend confirmation',
        },
      ],
    },
  ],
};

/** The dashboard's generated insights — most severe first, authored to the
 *  qualification criteria. Empty array = the scan legitimately finds nothing
 *  (the Excel board's quality stats are per-widget, not cross-widget). */
export function buildDashboardInsights(id: InsightDashboardId): LayeredInsight[] {
  return INSIGHTS[id] ?? [];
}
