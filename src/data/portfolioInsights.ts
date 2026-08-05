// ─── Portfolio insights — the cross-engagement altitude ─────────────────────
//
// The layered-insight hierarchy tops out here:
//
//   Portfolio  ←  Engagements  ←  Risks  ←  Controls  ←  Workflow output
//
// The qualification rule (AI-INSIGHT-QUALIFICATION-CRITERIA.md) lifts one
// altitude with it: **a portfolio insight is something a single engagement
// cannot tell you.** "ENG-006 has 7 open findings" is that engagement's own
// story — its page already says it. What qualifies here is the correlation
// only the library sees: one client-side driver behind exceptions in three
// engagements, an ITGC book undermining reliance in the SOX files, three FY
// milestones landing in the same 72 hours.
//
// Stories are hand-authored (the dashboardInsights.ts precedent) and
// deterministic — every number traces to the engagement seed data, no
// Date.now()/Math.random(). Spans, checkAt and targeted recommendations use
// REAL engagement ids so reflections land on rows that exist, and each story
// self-disqualifies when the session library no longer holds at least two of
// its spanned engagements (the "pattern needs 2+ supporting items" gate —
// deleting engagements can un-make a pattern, and the scan must say so).

import type { Engagement } from './engagements';
import type { AuditRecommendation, BuildInsightInput, LayeredInsight } from './layeredInsights';

export const PORTFOLIO_SUBJECT_ID = 'portfolio';

// ─── The stories ────────────────────────────────────────────────────────────

interface PortfolioStory {
  /** Doubles as the BuildInsightInput.subjectId and the cache key suffix. */
  id: string;
  insight: LayeredInsight;
}

const STORIES: PortfolioStory[] = [
  // 1 · One vendor-master driver, three engagements — the flagship correlation.
  {
    id: 'pf-vendor-master',
    insight: {
      id: 'li-pf-vendor-master',
      layer: 'portfolio',
      subjectId: 'pf-vendor-master',
      subjectLabel: 'Vendor master integrity',
      takeaway: 'Open exceptions in three P2P engagements trace to the same vendor-master changes.',
      verdict: { label: 'Systemic — one driver', tone: 'negative' },
      severity: 'high',
      likelyCause: {
        label: 'Mid-period vendor-master changes are propagating unreviewed.',
        detail:
          'The duplicate-invoice hits, the reconciliation breaks and the internal-audit findings all cluster on vendors whose master records changed mid-period. Each engagement sees its own slice; only the portfolio sees they move together. Confirm the change-approval gap with the process owner before treating it as one deficiency.',
      },
      reasoning:
        'Three engagements, one candidate driver — counted once. The duplicate monitor, the airline reconciliation and the P2P internal audit each hold exceptions that resolve to changed vendor-master records, so this rolls up as one systemic finding, not three local ones.',
      atStake:
        'Recovery exposure across the three engagements is not yet sized — aggregate the open items against the changed master records before the audit-committee cycle.',
      freshness: 'new',
      freshnessNote: 'First surfaced by this portfolio scan',
      observations: [
        'AP Duplicate Invoice Monitor: both open hits sit on vendors whose master records changed mid-period.',
        'Vendor Reconciliation — Airline Group: 6 open breaks are payee-name and bank-detail mismatches against the master.',
        'P2P Internal Audit Review: vendor-master change control is one of its three scope areas, with open findings on unapproved changes.',
      ],
      stakes: [
        'Three engagements are each remediating a symptom while the shared driver keeps generating exceptions.',
        'A duplicate paid against a changed master record is unrecovered once settled — the exposure compounds per period.',
      ],
      factors: { frequency: 0.6, sourceDiversity: 0.85, recency: 0.9, businessImpact: 0.85 },
      confidenceOverride: 0.8,
      evidence: [
        { ref: 'ENG-003', label: 'AP Duplicate Invoice Monitor', detail: '2 open hits · both on changed master records', tone: 'caution' },
        { ref: 'ENG-009', label: 'Vendor Reconciliation — Airline Group', detail: '6 open breaks · payee/bank mismatches vs master', tone: 'negative' },
        { ref: 'EF-001', label: 'P2P Internal Audit Review', detail: 'Open findings on unapproved master changes', tone: 'negative' },
      ],
      evidenceNote: '3 engagements · 1 shared driver, counted once.',
      detectedOn: '15 May 2026',
      detectedBy: 'traceable',
      rollupOf: { label: 'engagements', count: 3 },
      spans: [
        { kind: 'engagement', id: 'eng-3', label: 'AP Duplicate Invoice Monitor', note: 'Both open duplicate hits sit on vendors whose master records changed mid-period.' },
        { kind: 'engagement', id: 'eng-9', label: 'Vendor Reconciliation — Airline Group', note: '6 open breaks are payee-name and bank-detail mismatches against the vendor master.' },
        { kind: 'engagement', id: 'ef-001', label: 'P2P Internal Audit Review', note: 'Vendor-master change findings here are the process-level view of the same driver.' },
      ],
      checkAt: [
        { kind: 'engagement', id: 'ef-001', label: 'P2P Internal Audit Review', note: 'Owns the process conclusion — consolidate the remediation here.' },
        { kind: 'engagement', id: 'eng-9', label: 'Vendor Reconciliation — Airline Group', note: 'Largest open break set of the three.' },
        { kind: 'engagement', id: 'eng-3', label: 'AP Duplicate Invoice Monitor', note: 'Earliest detector — its hits date the change window.' },
      ],
      checkMore: [
        { kind: 'compare', label: 'Compare exception dates to master-change dates' },
        { kind: 'split', label: 'Split by vendor' },
        { kind: 'ask', label: 'Ask which vendors changed in all three' },
      ],
      recommendedActions: [
        'Raise the vendor-master change gap with the process owner as ONE remediation owning all three engagements.',
        'Hold settlement on open items tied to changed master records until each change is evidenced as approved.',
      ],
      recommendations: [
        {
          id: 'pf-vm-1', category: 'root-cause', priority: 'do-now',
          title: 'Consolidate the three engagements’ vendor-master findings into one remediation.',
          rationale: 'Each engagement is remediating its own slice of the same driver. The P2P internal audit owns the process conclusion, so the consolidated finding belongs there — one fix, not three notes.',
          basis: 'Root-cause remediation', guardrail: 'Confirm the shared driver with the process owner before grading it systemic.',
          intent: 'aggregate', target: { kind: 'engagement', id: 'ef-001', label: 'P2P Internal Audit Review' },
        },
        {
          id: 'pf-vm-2', category: 'monitoring', priority: 'this-period',
          title: 'Extend the reconciliation match key to flag lines whose master record changed in-period.',
          rationale: 'The airline reconciliation catches the mismatch after settlement. Matching on master-change recency catches it before — the same detection, one period earlier.',
          basis: 'Preventive control design',
          intent: 'edit', target: { kind: 'engagement', id: 'eng-9', label: 'Vendor Reconciliation — Airline Group' },
        },
        {
          id: 'pf-vm-3', category: 'automation', priority: 'advisory',
          title: 'Standardise vendor-master change alerts across the P2P book.',
          rationale: 'Three engagements watch the same master from three angles with three thresholds. One shared alert definition makes the next cross-engagement pattern visible without a portfolio scan.',
          basis: 'Standardise across the book',
          intent: 'create',
        },
      ],
    },
  },

  // 2 · ITGC reliance cascade — the canonical cross-engagement dependency.
  {
    id: 'pf-itgc-reliance',
    insight: {
      id: 'li-pf-itgc-reliance',
      layer: 'portfolio',
      subjectId: 'pf-itgc-reliance',
      subjectLabel: 'ITGC reliance',
      takeaway: 'ITGC monitoring at 58% undermines automated-control reliance in both SOX files.',
      verdict: { label: 'Reliance at risk', tone: 'negative' },
      severity: 'high',
      likelyCause: {
        label: 'Open ITGC findings sit under the application controls the SOX files rely on.',
        detail:
          'IT General Controls Monitoring holds 7 open findings across access review and change management. Both SOX engagements conclude on automated application controls that inherit that ITGC layer — a pass on the application control is only as strong as the general controls under it.',
      },
      reasoning:
        'Neither SOX file can see this from inside: each tests its own application controls and finds them effective. The weakness is in the layer they share — one ITGC book, two reliance strategies, counted once.',
      atStake:
        'If the ITGC findings stand at attestation, both SOX engagements face expanded substantive testing this cycle — a scope, budget and deadline consequence, not yet priced.',
      freshness: 'recurring',
      freshnessNote: 'ITGC findings open for 2 periods',
      observations: [
        'IT General Controls Monitoring: 58% pass rate, 7 open findings — concentrated in access review and change management.',
        'FY26 ICFR — Airline P2P & O2C concludes on automated three-way-match and revenue controls that inherit the ITGC layer.',
        'O2C — SOX / ICFR reads 89% effective, but its automated-control conclusions carry the same inherited weakness.',
      ],
      stakes: [
        'A controls-reliance strategy built over an ineffective ITGC layer fails inspection — the fallback is substantive testing at scale.',
        'The annual attestation dated May 16 freezes the ITGC position both SOX files will have to live with.',
      ],
      factors: { frequency: 0.7, sourceDiversity: 0.75, recency: 0.95, businessImpact: 0.9 },
      confidenceOverride: 0.82,
      evidence: [
        { ref: 'ENG-006', label: 'IT General Controls Monitoring', detail: '58% pass · 7 open findings', tone: 'negative' },
        { ref: 'ENG-001', label: 'FY26 ICFR — Airline P2P & O2C', detail: 'Relies on automated P2P / O2C application controls', tone: 'caution' },
        { ref: 'ENG-002', label: 'O2C — SOX / ICFR', detail: '89% effective · conclusions inherit the ITGC layer', tone: 'caution' },
      ],
      evidenceNote: '1 ITGC book · 2 dependent SOX files.',
      detectedOn: '15 May 2026',
      detectedBy: 'formula',
      rollupOf: { label: 'engagements', count: 3 },
      spans: [
        { kind: 'engagement', id: 'eng-6', label: 'IT General Controls Monitoring', note: 'The 7 open findings here are the source of the portfolio exposure.' },
        { kind: 'engagement', id: 'eng-1', label: 'FY26 ICFR — Airline P2P & O2C', note: 'Automated-control reliance inherits the open ITGC findings.' },
        { kind: 'engagement', id: 'eng-2', label: 'O2C — SOX / ICFR', note: 'Reads 89% effective, but automated conclusions carry the inherited weakness.' },
      ],
      checkAt: [
        { kind: 'engagement', id: 'eng-6', label: 'IT General Controls Monitoring', note: 'Close or remediate the 7 findings before the May 16 attestation.' },
      ],
      checkMore: [
        { kind: 'split', label: 'Split the 7 findings by ITGC domain' },
        { kind: 'trace', label: 'Trace which application controls inherit each finding' },
        { kind: 'ask', label: 'Ask what expanded substantive testing would cost' },
      ],
      recommendedActions: [
        'Re-test the open ITGC findings before the May 16 attestation — remediated general controls keep both reliance strategies alive.',
        'Decide the fallback now: if remediation slips, plan the expanded substantive testing rather than discovering it at review.',
      ],
      recommendations: [
        {
          id: 'pf-itgc-1', category: 'timeliness', priority: 'do-now',
          title: 'Confirm remediation and re-test the 7 open ITGC findings before the May 16 attestation.',
          rationale: 'The attestation freezes the ITGC position both SOX files inherit. Findings closed after it help next year, not this one.',
          basis: 'ITGC reliance', guardrail: 'The reliance call on each SOX file stays with its engagement leader.',
          intent: 'retest', target: { kind: 'engagement', id: 'eng-6', label: 'IT General Controls Monitoring' },
        },
        {
          id: 'pf-itgc-2', category: 'scoping', priority: 'this-period',
          title: 'Decide each SOX file’s fallback strategy while there is still calendar to execute it.',
          rationale: 'If the ITGC findings stand, reliance narrows and substantive scope grows. Choosing that trade-off now costs planning time; discovering it at review costs the deadline.',
          basis: 'Controls-reliance strategy',
          intent: 'edit',
        },
      ],
    },
  },

  // 3 · Milestone collision — three closeouts in 72 hours.
  {
    id: 'pf-milestone-collision',
    insight: {
      id: 'li-pf-milestone-collision',
      layer: 'portfolio',
      subjectId: 'pf-milestone-collision',
      subjectLabel: 'FY closeout sequencing',
      takeaway: 'Three FY milestones land within 72 hours — May 15, 16 and 17 — on three different books.',
      verdict: { label: 'Sequencing risk', tone: 'caution' },
      severity: 'med',
      likelyCause: {
        label: 'Independent FY calendars converged; no one planned the collision.',
        detail:
          'The revenue-recognition final review, the ITGC annual attestation and the airline FY closeout recon were each scheduled inside their own engagement. No single plan sees all three — the portfolio calendar is where the collision is visible.',
      },
      reasoning:
        'Each date is fine alone; the pattern is the 72-hour window. Reviewer capacity and evidence pulls are shared resources, so three closeouts in one window is one risk, not three schedules.',
      atStake:
        'A slipped closeout cascades into the FY reporting window. The ITGC attestation is the most exposed — it has 7 open findings to clear first.',
      observations: [
        'May 15 — O2C Revenue Recognition Monitor final review (4 open findings).',
        'May 16 — IT General Controls annual attestation (7 open findings to clear first).',
        'May 17 — Vendor Reconciliation FY closeout recon (6 open breaks).',
      ],
      stakes: [
        'The three books share reviewer capacity — a slip on the first date compresses the next two.',
        'Each closeout is also the deadline for the open items above; the collision leaves no absorption room.',
      ],
      factors: { frequency: 0.5, sourceDiversity: 0.7, recency: 1, businessImpact: 0.6 },
      confidenceOverride: 0.74,
      evidence: [
        { ref: 'May 15 · ENG-008', label: 'O2C — Revenue Recognition Monitor', detail: 'Final review · 4 open findings', tone: 'caution' },
        { ref: 'May 16 · ENG-006', label: 'IT General Controls Monitoring', detail: 'Annual attestation · 7 open findings', tone: 'negative' },
        { ref: 'May 17 · ENG-009', label: 'Vendor Reconciliation — Airline Group', detail: 'FY closeout recon · 6 open breaks', tone: 'caution' },
      ],
      evidenceNote: '3 milestones · one 72-hour window.',
      detectedOn: '15 May 2026',
      detectedBy: 'formula',
      rollupOf: { label: 'engagements', count: 3 },
      spans: [
        { kind: 'engagement', id: 'eng-8', label: 'O2C — Revenue Recognition Monitor', note: 'Final review May 15 opens the window — a slip here compresses the next two.' },
        { kind: 'engagement', id: 'eng-6', label: 'IT General Controls Monitoring', note: 'Attestation May 16 with 7 open findings still to clear.' },
        { kind: 'engagement', id: 'eng-9', label: 'Vendor Reconciliation — Airline Group', note: 'FY closeout recon May 17 closes the window.' },
      ],
      checkAt: [
        { kind: 'engagement', id: 'eng-6', label: 'IT General Controls Monitoring', note: 'Most exposed of the three — open findings and the middle slot.' },
      ],
      checkMore: [
        { kind: 'compare', label: 'Compare reviewer assignments across the three dates' },
        { kind: 'ask', label: 'Ask which open items block each milestone' },
      ],
      recommendedActions: [
        'Sequence the three closeouts explicitly — name the reviewer for each date and the order the open items must clear.',
        'Front-load the attestation evidence pull: May 16 is the hardest date to move and the least ready.',
      ],
      recommendations: [
        {
          id: 'pf-ms-1', category: 'timeliness', priority: 'this-period',
          title: 'Front-load the ITGC attestation evidence pull ahead of the May 16 date.',
          rationale: 'The middle milestone has the most open findings and no slack on either side. Evidence pulled early is the only buffer the window allows.',
          basis: 'Milestone management',
          intent: 'monitor', target: { kind: 'engagement', id: 'eng-6', label: 'IT General Controls Monitoring' },
        },
        {
          id: 'pf-ms-2', category: 'timeliness', priority: 'advisory',
          title: 'Confirm reviewer coverage across May 15–17 before the window opens.',
          rationale: 'Three closeouts drawing on the same reviewers is a quiet single point of failure — visible only on the portfolio calendar.',
          basis: 'Resource sequencing',
          intent: 'monitor',
        },
      ],
    },
  },

  // 4 · Coverage overlap — a positive, efficiency-shaped portfolio finding.
  {
    id: 'pf-p2p-overlap',
    insight: {
      id: 'li-pf-p2p-overlap',
      layer: 'portfolio',
      subjectId: 'pf-p2p-overlap',
      subjectLabel: 'P2P duplicate-invoice coverage',
      takeaway: 'Four P2P engagements test overlapping duplicate-invoice ground — coverage holds, consolidation is available.',
      verdict: { label: 'Corroborated across the book', tone: 'positive' },
      severity: 'low',
      likelyCause: {
        label: 'The P2P book grew engagement by engagement; the overlap was never designed.',
        detail:
          'The duplicate monitor, the aging monitor, the airline reconciliation and the P2P internal audit each carry duplicate-invoice checks that were scoped independently. The redundancy is real assurance — and also duplicated effort.',
      },
      reasoning:
        'Four independent surfaces reaching the same conclusion is corroboration, which is why this reads positive. It qualifies as an insight because no single engagement can see that its check is one of four.',
      atStake:
        'Nothing at risk — the finding is efficiency. Consolidating to one shared detection standard frees testing effort without losing coverage.',
      observations: [
        'Duplicate-invoice detection runs in four P2P engagements with independently chosen thresholds and match keys.',
        'All four currently corroborate: no duplicate settled undetected in the periods reviewed.',
      ],
      stakes: [
        'Duplicated testing effort across four books — consolidation is an efficiency gain, not a coverage trade.',
      ],
      factors: { frequency: 0.8, sourceDiversity: 0.9, recency: 0.85, businessImpact: 0.4 },
      confidenceOverride: 0.77,
      evidence: [
        { ref: 'ENG-003', label: 'AP Duplicate Invoice Monitor', detail: 'Dedicated CCM · 94% pass', tone: 'positive' },
        { ref: 'EF-AUTO-001', label: 'AP Invoice Aging Monitor', detail: 'Carries duplicate checks in scope · 88% pass', tone: 'positive' },
        { ref: 'ENG-009', label: 'Vendor Reconciliation — Airline Group', detail: 'Near-duplicate matching in the recon key', tone: 'positive' },
        { ref: 'EF-001', label: 'P2P Internal Audit Review', detail: 'Duplicate invoices are a named scope area', tone: 'positive' },
      ],
      evidenceNote: '4 engagements · same assertion, independently corroborated.',
      detectedOn: '15 May 2026',
      detectedBy: 'formula',
      rollupOf: { label: 'engagements', count: 4 },
      spans: [
        { kind: 'engagement', id: 'eng-3', label: 'AP Duplicate Invoice Monitor', note: 'The dedicated detector — the natural home for a consolidated standard.' },
        { kind: 'engagement', id: 'ef-auto-001', label: 'AP Invoice Aging Monitor', note: 'Its duplicate checks overlap the dedicated monitor’s scope.' },
        { kind: 'engagement', id: 'eng-9', label: 'Vendor Reconciliation — Airline Group', note: 'Near-duplicate matching overlaps the same assertion.' },
        { kind: 'engagement', id: 'ef-001', label: 'P2P Internal Audit Review', note: 'Tests the assertion manually that three monitors already automate.' },
      ],
      checkMore: [
        { kind: 'compare', label: 'Compare the four match keys and thresholds' },
        { kind: 'ask', label: 'Ask which checks the audit could rely on instead of re-test' },
      ],
      recommendedActions: [
        'Adopt one duplicate-invoice detection standard across the P2P book, anchored on the dedicated monitor.',
        'Let the internal audit rely on the monitors’ output for this assertion and redirect its manual testing elsewhere.',
      ],
      recommendations: [
        {
          id: 'pf-ov-1', category: 'automation', priority: 'advisory',
          title: 'Standardise duplicate-invoice detection across the four P2P engagements.',
          rationale: 'Four independent match keys mean four different blind spots. One shared standard keeps the corroboration and removes the drift.',
          basis: 'Standardise across the book',
          intent: 'create', target: { kind: 'engagement', id: 'eng-3', label: 'AP Duplicate Invoice Monitor' },
        },
        {
          id: 'pf-ov-2', category: 'sampling', priority: 'advisory',
          title: 'Rely on the monitors’ output in the internal audit instead of re-testing the assertion.',
          rationale: 'Three automated surfaces already test what the audit samples by hand. Reliance frees the audit’s effort for the areas only it covers.',
          basis: 'Reliance on continuous monitoring', guardrail: 'The reliance decision is the audit lead’s call.',
          intent: 'edit', target: { kind: 'engagement', id: 'ef-001', label: 'P2P Internal Audit Review' },
        },
      ],
    },
  },
];

// ─── The gate + builders ────────────────────────────────────────────────────

/** A story survives only while the session library still holds at least two of
 *  its spanned engagements (Door A: a pattern needs 2+ supporting items).
 *  Spans, checkAt and targeted recs are filtered to the engagements present so
 *  reflections and redirects never point at a deleted row. */
function qualify(story: PortfolioStory, presentIds: Set<string>): LayeredInsight | null {
  const spans = (story.insight.spans ?? []).filter(s => presentIds.has(s.id));
  if (spans.length < 2) return null;
  const checkAt = story.insight.checkAt?.filter(c => presentIds.has(c.id));
  const keepRec = (r: AuditRecommendation) =>
    !r.target || r.target.kind !== 'engagement' || presentIds.has(r.target.id);
  return {
    ...story.insight,
    spans,
    checkAt: checkAt && checkAt.length > 0 ? checkAt : undefined,
    recommendations: story.insight.recommendations?.filter(keepRec),
    rollupOf: { label: 'engagements', count: spans.length },
  };
}

/** One BuildInsightInput per qualifying story — what the library's header
 *  launcher passes to useInsightStackRun. Length drives the cache key, so
 *  adding/removing engagements that change which stories qualify invalidates
 *  the cached scan (scope changed → the old result no longer claims currency). */
export function portfolioInsightSubjects(engagements: Engagement[]): BuildInsightInput[] {
  const present = new Set(engagements.map(e => e.id));
  return STORIES
    .filter(s => qualify(s, present) !== null)
    .map(s => ({ layer: 'portfolio' as const, subjectId: s.id, subjectLabel: s.insight.subjectLabel }));
}

/** The per-subject builder the run hook uses in place of buildLayeredInsight —
 *  hand-authored stories, filtered to the engagements the session still holds. */
export function makePortfolioBuilder(engagements: Engagement[]): (s: BuildInsightInput) => LayeredInsight {
  const present = new Set(engagements.map(e => e.id));
  return (s) => {
    const story = STORIES.find(st => st.id === s.subjectId);
    const built = story ? qualify(story, present) : null;
    if (!built) {
      throw new Error(`Unknown portfolio story: ${s.subjectId}`);
    }
    return built;
  };
}

/** Scope-true pipeline wording for the portfolio scan (the generic stackSteps
 *  reads "every risk and control", which is the wrong altitude here). */
export function portfolioStackSteps(nEngagements: number, nInsights: number): string[] {
  return [
    `Reading findings across ${nEngagements} engagement${nEngagements === 1 ? '' : 's'}`,
    'Correlating drivers across engagements',
    'Collapsing findings that share one driver',
    `Writing ${nInsights} insight${nInsights === 1 ? '' : 's'}`,
  ];
}
