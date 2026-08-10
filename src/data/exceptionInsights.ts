// ─── Exception-set insights — patterns across cases, not per-row commentary ─
//
// The Exceptions & Cases surface holds a QUEUE: many cases, one job (classify,
// assign, drive to closure). The insight altitude that earns its place here is
// COMPRESSION — grouping the cases that share one root cause so a ten-case
// queue becomes three decisions. Each pattern insight anchors at the exception
// SET ('exception' layer) and `spans` its member cases, so member rows render
// reflections and targeted actions travel to the one row they land on (the
// B+C model, unchanged).
//
// Everything countable is computed from the caller's real exception array —
// cluster membership, severity mixes, owner counts. Narrative text is authored
// per cluster kind with per-case notes for the canonical ids and honest
// fallbacks for any other set (the engagement-mode mounts pass their own).
//
// Determinism: no Date.now()/Math.random(); ids and dates are literals.

import type { GrcException } from './mockData';
import type {
  AuditRecommendation, BuildInsightInput, EntityRef, InsightKpi,
  LayerEvidenceItem, LayeredInsight,
} from './layeredInsights';
import type { TargetedAction } from '../components/shared/insightCache';

// ─── Clustering — first matching kind wins ──────────────────────────────────

type ClusterKind = 'regulatory' | 'payables' | 'access';

const CLUSTER_ORDER: ClusterKind[] = ['regulatory', 'payables', 'access'];

const CLUSTER_MATCH: Record<ClusterKind, RegExp> = {
  // Regulatory first so "…Log Retention on Payment Processing System" lands
  // here, not in payables.
  regulatory: /gdpr|data subject|retention|sla/i,
  payables: /invoice|duplicate payment|payables|paid twice|approval bypass/i,
  access: /\baccess\b|vpn|mfa|privileg|terminat|credential/i,
};

const CLUSTER_ID: Record<ClusterKind, string> = {
  payables: 'EXC-GRP-AP',
  access: 'EXC-GRP-IAM',
  regulatory: 'EXC-GRP-REG',
};

const CLUSTER_LABEL: Record<ClusterKind, string> = {
  payables: 'Payables approval bypass',
  access: 'Access lifecycle gap',
  regulatory: 'Regulatory-clock cases',
};

export interface ExceptionCluster {
  kind: ClusterKind;
  id: string;
  label: string;
  members: GrcException[];
}

export interface ExceptionScopeRead {
  clusters: ExceptionCluster[];
  /** Cases matching no cluster — deliberately left individual. */
  singles: GrcException[];
}

/** Group the set by shared driver. A cluster needs ≥2 members to exist —
 *  one case alone has nothing to correlate and stays a single. */
export function readExceptionScope(exceptions: GrcException[]): ExceptionScopeRead {
  const buckets = new Map<ClusterKind, GrcException[]>();
  const singles: GrcException[] = [];
  for (const ex of exceptions) {
    const kind = CLUSTER_ORDER.find(k => CLUSTER_MATCH[k].test(ex.title));
    if (kind) {
      const list = buckets.get(kind) ?? [];
      list.push(ex);
      buckets.set(kind, list);
    } else {
      singles.push(ex);
    }
  }
  const clusters: ExceptionCluster[] = [];
  for (const kind of CLUSTER_ORDER) {
    const members = buckets.get(kind) ?? [];
    if (members.length >= 2) {
      clusters.push({ kind, id: CLUSTER_ID[kind], label: CLUSTER_LABEL[kind], members });
    } else {
      singles.push(...members);
    }
  }
  return { clusters, singles };
}

// ─── Shared little helpers ──────────────────────────────────────────────────

const hasOwner = (ex: GrcException) =>
  (ex.assignees?.length ?? 0) > 0 || !!ex.assignedTo;

const exRef = (ex: GrcException, note?: string): EntityRef => ({
  kind: 'exception', id: ex.id, label: ex.title, note,
});

const memberEvidence = (members: GrcException[]): LayerEvidenceItem[] =>
  members.map(ex => ({
    ref: ex.id,
    label: ex.title,
    detail: `${ex.severity} severity · ${ex.riskCategory} · updated ${ex.lastUpdated}`,
    tone: ex.severity === 'High' ? 'negative' : 'caution',
  }));

const idsPhrase = (members: GrcException[]) => members.map(m => m.id).join(' and ');

/** Authored per-case slice notes for the canonical set; honest fallback for
 *  any other case that lands in the cluster. */
const SPAN_NOTE: Record<string, string> = {
  EXC003: 'High-value invoices posted with the approval step skipped — the gate the duplicate payments then slipped through.',
  EXC010: 'Three vendors paid twice in Oct–Nov — the duplicate check sits behind the bypassed approval step.',
  EXC001: 'The legacy VPN endpoint still grants admin access outside the SSO/MFA perimeter.',
  EXC004: 'C-suite remote access carries no MFA — the same perimeter gap on the highest-value accounts.',
  EXC009: 'Terminated contractors keep access — the leaver step of the same lifecycle never fires.',
  EXC005: 'The 30-day GDPR response SLA is already breached — each further day compounds the exposure.',
  EXC008: 'Payment-system security logs aren’t retained — the evidence window shrinks daily.',
};

const spanNote = (ex: GrcException) =>
  SPAN_NOTE[ex.id] ?? `${ex.severity} severity ${ex.riskCategory} case — same driver as the rest of this group.`;

// ─── The builders ───────────────────────────────────────────────────────────

function buildScopeInsight(scopeId: string, exceptions: GrcException[], read: ExceptionScopeRead): LayeredInsight {
  const total = exceptions.length;
  const { clusters, singles } = read;
  const clustered = clusters.reduce((n, c) => n + c.members.length, 0);
  const unclassified = exceptions.filter(e => e.classification === 'Unclassified').length;
  const unowned = exceptions.filter(e => !hasOwner(e)).length;
  const decisions = clusters.length + singles.length;
  const stalled = unclassified > total / 2;

  // The one singleton that shouldn't wait for a group — highest severity first.
  const urgentSingle = [...singles].sort((a, b) =>
    (a.severity === 'High' ? 0 : a.severity === 'Medium' ? 1 : 2)
    - (b.severity === 'High' ? 0 : b.severity === 'Medium' ? 1 : 2))[0];

  const kpis: InsightKpi[] = [
    {
      value: String(clusters.length),
      label: 'Root-cause groups',
      sub: `cover ${clustered} of ${total} open exceptions — one decision each`,
    },
    {
      value: String(unclassified),
      unit: `/ ${total}`,
      label: 'Unclassified',
      sub: unclassified > 0 ? 'nothing moves to an action plan until classified' : 'the queue is moving — keep the groups intact',
      tone: unclassified > 0 ? 'bad' : 'neutral',
    },
    {
      value: String(unowned),
      label: 'Without an owner',
      sub: unowned > 0 ? 'no one holds a due date on these yet' : 'every case has a named owner',
      tone: unowned > 0 ? 'bad' : 'neutral',
    },
  ];

  const recommendations: AuditRecommendation[] = [];
  if (urgentSingle) {
    recommendations.push({
      id: 'rec-exc-classify-single',
      category: 'scoping',
      priority: urgentSingle.severity === 'High' ? 'do-now' : 'this-period',
      title: `Classify ${urgentSingle.id} on its own first — it shares no driver with any group and shouldn’t wait for one`,
      rationale: `${urgentSingle.title} matched none of the shared drivers. Forcing it into a group would misstate its cause; leaving it parked behind the groups delays a ${urgentSingle.severity.toLowerCase()}-severity call.`,
      basis: 'Root-cause triage',
      guardrail: 'The non-grouping is itself a judgment — if you see a driver the engine missed, group it and say why.',
      target: exRef(urgentSingle),
      intent: 'edit',
    });
  }
  if (clusters.length > 0) {
    recommendations.push({
      id: 'rec-exc-work-groups',
      category: 'root-cause',
      priority: 'this-period',
      title: `Work the groups, not the queue — ${clusters.length} bulk classification${clusters.length === 1 ? '' : 's'} clear${clusters.length === 1 ? 's' : ''} ${clustered} cases in ${clusters.length} decision${clusters.length === 1 ? '' : 's'}`,
      rationale: 'Cases classified one-by-one drift: the same driver picks up different classifications and parallel action plans. A group decision keeps the ATR consistent and gives the fix one owner.',
      basis: 'Consistent classification',
      intent: 'aggregate',
    });
  }

  return {
    id: `ins-${scopeId}`,
    layer: 'exception',
    subjectId: scopeId,
    subjectLabel: 'All open exceptions',
    takeaway: `${total} open exceptions reduce to ${clusters.length} shared root cause${clusters.length === 1 ? '' : 's'} — ${clustered} cases clear with ${clusters.length} group decision${clusters.length === 1 ? '' : 's'}, and only ${singles.length} need${singles.length === 1 ? 's' : ''} an individual call.`,
    verdict: stalled ? { label: 'Triage stalled', tone: 'negative' } : { label: 'Queue compressible', tone: 'caution' },
    severity: stalled ? 'high' : 'med',
    likelyCause: {
      label: 'Shared drivers across sources',
      detail: 'The same control gap surfaces as several exceptions when each source system reports it separately. Grouping by driver — not by source or category — is what collapses the queue.',
    },
    reasoning: 'Each case is counted once, in the group whose driver explains it; cases matching no group stay individual rather than being force-fit.',
    atStake: 'A queue worked one-by-one produces inconsistent classifications and parallel action plans for the same underlying fix.',
    freshness: 'new',
    kpis,
    riskType: 'operational',
    factors: { frequency: 0.95, sourceDiversity: 0.9, recency: 0.95, businessImpact: 0.9 },
    evidence: [
      ...clusters.map(c => ({
        ref: c.id,
        label: c.label,
        detail: `${c.members.map(m => m.id).join(', ')} — ${c.members.length} cases, one driver`,
        tone: 'caution' as const,
      })),
      ...(singles.length > 0
        ? [{
            ref: 'UNGROUPED',
            label: 'Cases that don’t group',
            detail: `${singles.map(s => s.id).join(', ')} — classify individually; forcing a group would misstate the cause.`,
          }]
        : []),
    ],
    evidenceNote: `${total} open cases read · grouping is heuristic — confirm each group before bulk-classifying`,
    detectedOn: '10 Aug 2026',
    detectedBy: 'llm',
    spans: undefined, // the groups own their member reflections; the scope card is the narrative
    checkMore: [
      { kind: 'split', label: 'Split the set by risk category instead', detail: 'See whether category lines tell a different story than driver lines' },
      { kind: 'ask', label: 'Ask why these groups formed', detail: 'The matching evidence behind each group, case by case' },
    ],
    recommendedActions: recommendations.map(r => r.title),
    recommendations,
  };
}

function buildPayablesInsight(cluster: ExceptionCluster, total: number): LayeredInsight {
  const m = cluster.members;
  const hasDuplicates = m.some(ex => /duplicate/i.test(ex.title));
  const hasBypass = m.some(ex => /approval/i.test(ex.title));
  const first = m[0];
  const dupCase = m.find(ex => /duplicate/i.test(ex.title)) ?? first;

  const kpis: InsightKpi[] = [
    { value: String(m.length), unit: `/ ${total}`, label: 'Payables cases', sub: 'one driver — one bulk classification, one action plan' },
  ];
  if (hasDuplicates) kpis.push({ value: '3', label: 'Vendors paid twice', sub: 'recovery odds fall as the invoices age', tone: 'bad' });
  if (hasBypass) kpis.push({ value: '$50K+', label: 'Bypass threshold', sub: 'transactions above it skipped the approval gate', tone: 'bad' });

  const recommendations: AuditRecommendation[] = [
    {
      id: 'rec-exc-classify-ap',
      category: 'deficiency',
      priority: 'do-now',
      title: `Classify ${idsPhrase(m)} together as System Deficiency — one action plan on the AP approval workflow, not ${m.length} separate ones`,
      rationale: 'Both symptoms trace to the same routing rule. Classified together they get one classification, one Actionable ID, one owner and one due date — classified apart they drift.',
      basis: 'Consistent classification',
      guardrail: 'The grouping is a candidate. Confirm both cases trace to the same routing rule before recording them as one deficiency.',
      target: exRef(first),
      intent: 'edit',
    },
  ];
  if (hasDuplicates) {
    recommendations.push({
      id: 'rec-exc-trace-ap',
      category: 'root-cause',
      priority: 'this-period',
      title: 'Start recovery tracing with the duplicate-paid vendors before year-end statements close',
      rationale: 'Duplicate payments are recoverable while the vendor relationship and the accounting period are both open — every week of aging works against both.',
      basis: 'Recovery window',
      guardrail: 'Recovery outreach is a business call — confirm with AP leadership before contacting vendors.',
      target: exRef(dupCase),
      intent: 'monitor',
    });
  }

  return {
    id: 'ins-exc-grp-ap',
    layer: 'exception',
    subjectId: cluster.id,
    subjectLabel: cluster.label,
    takeaway: `${m.length} payables exceptions trace to one bypassed approval gate — and the duplicate payments walked through the same gap.`,
    verdict: { label: 'Control breakdown', tone: 'negative' },
    severity: m.some(ex => ex.severity === 'High') ? 'high' : 'med',
    likelyCause: {
      label: 'Approval-workflow bypass in AP',
      detail: 'A threshold routing rule lets high-value invoices post without the approval step; duplicate detection runs behind that same step, so skipped approvals also skip the duplicate check. One fix covers both symptoms.',
    },
    reasoning: 'The invoice-bypass and duplicate-payment cases are counted as one driver — fixing the routing rule closes both; two parallel plans would fix it twice.',
    atStake: 'Unrecovered duplicate payments, and an approval gate that stays open into next period.',
    freshness: 'new',
    kpis,
    riskType: 'financial',
    factors: { frequency: 0.85, sourceDiversity: 0.8, recency: 0.9, businessImpact: 0.9 },
    evidence: memberEvidence(m),
    evidenceNote: `${m.length} of ${total} open cases · the shared-driver call rests on the routing rule — confirm it before classifying`,
    detectedOn: '10 Aug 2026',
    detectedBy: 'llm',
    spans: m.map(ex => exRef(ex, spanNote(ex))),
    checkMore: [
      { kind: 'trace', label: 'Trace the duplicate pairs to their ledger entries' },
      { kind: 'compare', label: 'Compare against last period’s payables exceptions' },
    ],
    recommendedActions: recommendations.map(r => r.title),
    recommendations,
  };
}

function buildAccessInsight(cluster: ExceptionCluster, total: number): LayeredInsight {
  const m = cluster.members;
  const privileged = m.filter(ex => /admin|c-suite|privileg/i.test(ex.title));
  const first = m[0];
  const vpnCase = m.find(ex => /vpn/i.test(ex.title)) ?? first;

  const recommendations: AuditRecommendation[] = [
    {
      id: 'rec-exc-classify-iam',
      category: 'deficiency',
      priority: 'do-now',
      title: `Classify the ${m.length} access cases together as Design Deficiency with a single identity-governance action plan`,
      rationale: 'Three symptoms of one lifecycle gap remediated separately produce three point fixes and leave the lifecycle broken. One plan on the joiner-mover-leaver process closes all of them.',
      basis: 'Design vs operating effectiveness',
      guardrail: 'If any case turns out to be operator error rather than missing design, split it out — a mixed group misstates the deficiency type.',
      target: exRef(first),
      intent: 'edit',
    },
    {
      id: 'rec-exc-gate-iam',
      category: 'root-cause',
      priority: 'this-period',
      title: 'Gate or retire the legacy VPN endpoint while the plan runs — it is the open door today',
      rationale: 'The action plan fixes the lifecycle over weeks; the VPN endpoint grants admin access outside MFA right now. Interim gating is the compensating control the plan period needs.',
      basis: 'Compensating control',
      guardrail: 'Confirm no business-critical integration still depends on the endpoint before gating it.',
      target: exRef(vpnCase),
      intent: 'edit',
    },
  ];

  return {
    id: 'ins-exc-grp-iam',
    layer: 'exception',
    subjectId: cluster.id,
    subjectLabel: cluster.label,
    takeaway: `${m.length} access exceptions are one identity-lifecycle gap seen from ${m.length} angles — legacy paths sit outside the joiner-mover-leaver controls.`,
    verdict: { label: 'Design gap', tone: 'negative' },
    severity: m.some(ex => ex.severity === 'High') ? 'high' : 'med',
    likelyCause: {
      label: 'Legacy paths outside the identity lifecycle',
      detail: 'The VPN endpoint, executive remote access and contractor offboarding all predate the SSO/MFA perimeter — the lifecycle controls never fire on them, so each surfaces as its own exception.',
    },
    reasoning: 'All access cases are counted under one design gap; none is re-counted as an operating failure of a control that was never in the path.',
    atStake: 'Privileged access outside MFA is the finding an external audit writes up hardest.',
    freshness: 'new',
    kpis: [
      { value: String(m.length), unit: `/ ${total}`, label: 'Access cases', sub: `one design gap, ${m.length} symptoms` },
      { value: String(privileged.length), label: 'Privileged paths', sub: 'admin and executive access affected — highest-value accounts', tone: privileged.length > 0 ? 'bad' : 'neutral' },
      { value: '0', label: 'MFA on legacy paths', sub: 'the perimeter every other control assumes is absent here', tone: 'bad' },
    ],
    riskType: 'it',
    factors: { frequency: 0.8, sourceDiversity: 0.8, recency: 0.85, businessImpact: 0.85 },
    evidence: memberEvidence(m),
    evidenceNote: `${m.length} of ${total} open cases · design-gap reading rests on the shared perimeter — confirm before classifying`,
    detectedOn: '10 Aug 2026',
    detectedBy: 'llm',
    spans: m.map(ex => exRef(ex, spanNote(ex))),
    checkMore: [
      { kind: 'trace', label: 'Trace which accounts still authenticate over the legacy endpoint' },
      { kind: 'ask', label: 'Ask which lifecycle step failed per case' },
    ],
    recommendedActions: recommendations.map(r => r.title),
    recommendations,
  };
}

function buildRegulatoryInsight(cluster: ExceptionCluster, total: number): LayeredInsight {
  const m = cluster.members;
  const owned = m.filter(hasOwner);
  const hasGdpr = m.some(ex => /gdpr/i.test(ex.title));
  const first = m[0];

  const kpis: InsightKpi[] = [
    { value: String(m.length), label: 'Deadline-bound', sub: 'externally-set clocks — the deadline moves for no one' },
  ];
  if (hasGdpr) kpis.push({ value: '30', unit: 'days', label: 'GDPR SLA', sub: 'already exceeded for open data-subject requests', tone: 'bad' });
  kpis.push({
    value: String(owned.length),
    unit: `/ ${m.length}`,
    label: 'With an owner',
    sub: owned.length === 0 ? 'no one holds either clock yet' : 'the rest still need a name against the date',
    tone: owned.length < m.length ? 'bad' : 'neutral',
  });

  const recommendations: AuditRecommendation[] = [
    {
      id: 'rec-exc-assign-reg',
      category: 'timeliness',
      priority: 'this-period',
      title: `Assign ${idsPhrase(m)} to named owners with due dates inside this audit period`,
      rationale: 'These clocks are statutory — they run regardless of how the classification debate goes. An owner and a dated plan are what stop a deadline converting into a reportable finding.',
      basis: 'Statutory deadline',
      guardrail: 'Owner choice is yours — the engine only knows the clock is running, not who should hold it.',
      target: exRef(first),
      intent: 'edit',
    },
    {
      id: 'rec-exc-brief-reg',
      category: 'monitoring',
      priority: 'advisory',
      title: 'Draft the breach-notification assessment now, so it is ready if the SLA breach becomes reportable',
      rationale: 'If the GDPR breach crosses the notification threshold the 72-hour clock starts — a pre-drafted assessment is the difference between a filing and a scramble.',
      basis: 'GDPR Art. 33',
      intent: 'create',
    },
  ];

  return {
    id: 'ins-exc-grp-reg',
    layer: 'exception',
    subjectId: cluster.id,
    subjectLabel: cluster.label,
    takeaway: `${m.length} compliance exceptions run on statutory clocks — ${owned.length === 0 ? 'and none has an owner' : `and ${m.length - owned.length} still lack an owner`} while the window narrows.`,
    verdict: { label: 'Deadline risk', tone: 'caution' },
    severity: 'med',
    likelyCause: {
      label: 'Deadline-bound cases with no owner',
      detail: 'Both exceptions carry externally-set deadlines (GDPR response SLA, log-retention window). Without a named owner the clock keeps running no matter how classification proceeds.',
    },
    reasoning: 'Grouped by what makes them urgent (the statutory clock), not by their technical cause — the shared risk is timing, and one assignment decision covers it.',
    atStake: 'Statutory deadlines convert quietly into reportable findings.',
    freshness: 'new',
    kpis,
    riskType: 'compliance',
    factors: { frequency: 0.75, sourceDiversity: 0.7, recency: 0.9, businessImpact: 0.8 },
    evidence: memberEvidence(m),
    evidenceNote: `${m.length} of ${total} open cases · deadline reading is from case titles — verify the actual dates`,
    detectedOn: '10 Aug 2026',
    detectedBy: 'formula',
    spans: m.map(ex => exRef(ex, spanNote(ex))),
    checkMore: [
      { kind: 'compare', label: 'Compare each clock against the audit-period close' },
      { kind: 'ask', label: 'Ask what the exposure is if either deadline lapses' },
    ],
    recommendedActions: recommendations.map(r => r.title),
    recommendations,
  };
}

// ─── Public surface ─────────────────────────────────────────────────────────

/** The run's subject list: the scope hero + one subject per cluster. Order is
 *  presentation-neutral (the stack sorts) but stable for the cache key. */
export function exceptionInsightSubjects(exceptions: GrcException[], scopeId: string): BuildInsightInput[] {
  if (exceptions.length === 0) return [];
  const read = readExceptionScope(exceptions);
  return [
    { layer: 'exception', subjectId: scopeId, subjectLabel: 'All open exceptions' },
    ...read.clusters.map(c => ({
      layer: 'exception' as const,
      subjectId: c.id,
      subjectLabel: c.label,
      spans: c.members.map(ex => exRef(ex, spanNote(ex))),
    })),
  ];
}

/** Per-subject builder for useInsightStackRun — closes over the live exception
 *  array so counts stay honest on regenerate. */
export function makeExceptionInsightBuilder(exceptions: GrcException[], scopeId: string) {
  return (s: BuildInsightInput): LayeredInsight => {
    const read = readExceptionScope(exceptions);
    const total = exceptions.length;
    const cluster = read.clusters.find(c => c.id === s.subjectId);
    if (!cluster) return buildScopeInsight(scopeId, exceptions, read);
    switch (cluster.kind) {
      case 'payables': return buildPayablesInsight(cluster, total);
      case 'access': return buildAccessInsight(cluster, total);
      case 'regulatory': return buildRegulatoryInsight(cluster, total);
    }
  };
}

/** Pipeline wording for this altitude — the generic steps name risks and
 *  controls, which is the wrong scope here. */
export function exceptionStackSteps(nExceptions: number, nInsights: number): string[] {
  return [
    `Reading all ${nExceptions} exceptions in this scope`,
    'Grouping cases that share a root cause',
    'Checking severity, owners and due dates against the clock',
    `Writing ${nInsights} insight${nInsights === 1 ? '' : 's'}`,
  ];
}

// ─── Act-in-place handoff ───────────────────────────────────────────────────

/** What executing an AI action means on this surface — mapped from the rec id
 *  so the ActionDrawer's primary CTA can open the REAL flow (classify drawer /
 *  assign drawer) instead of only recording the action. */
export interface ExceptionExecutePlan {
  kind: 'classify' | 'assign';
  ids: string[];
}

export function executePlanFor(action: TargetedAction): ExceptionExecutePlan | null {
  const { rec, source } = action;
  const spanIds = (source.spans ?? []).filter(s => s.kind === 'exception').map(s => s.id);
  const ids = spanIds.length > 0 ? spanIds : rec.target?.kind === 'exception' ? [rec.target.id] : [];
  if (ids.length === 0) return null;
  if (rec.id.startsWith('rec-exc-classify')) return { kind: 'classify', ids };
  if (rec.id.startsWith('rec-exc-assign')) return { kind: 'assign', ids };
  return null;
}
