/**
 * Engagement portfolio — cross-engagement aggregates for the Platform Usage
 * page's Engagements section. A managing partner / audit lead wants to see the
 * whole book of work at a glance: how many engagements, of what type, how far
 * along, how many controls are being tested and how many are effective, and
 * where the open findings are — all as charts and breakdowns, not a log.
 *
 * Everything derives from the real ENGAGEMENTS portfolio (src/data/engagements.ts):
 * each engagement carries its control count, health % (controls effective), and
 * open issues (failed tests / findings / unresolved alerts).
 */

import { ENGAGEMENTS, type Engagement, type EngType, type EngStatus, type ProcessCode } from './engagements';

export const ENG_TYPES: EngType[] = ['SOX / ICFR', 'Internal Audit', 'Compliance', 'Automation'];
export const ENG_STATUSES: EngStatus[] = ['Active', 'In Progress', 'Review', 'Planned', 'Draft', 'Closed'];

/** In-flight = work is actually happening (health reflects testing progress). */
const IN_FLIGHT: EngStatus[] = ['Active', 'In Progress', 'Review'];

export interface EngRow {
  id: string;
  code: string;
  name: string;
  type: EngType;
  status: EngStatus;
  process: ProcessCode;
  owner: string;
  controls: number;
  health: number;
  /** Controls effective = controls × health%. */
  effective: number;
  openIssues: number;
  lastActivity: string;
}

export interface TypeAgg {
  type: EngType;
  count: number;
  controls: number;
  effective: number;
  findings: number;
}

export interface StatusAgg {
  status: EngStatus;
  count: number;
}

export interface ProcessAgg {
  process: ProcessCode;
  count: number;
  controls: number;
}

export interface EngagementPortfolio {
  total: number;
  inFlight: number;
  planned: number;
  controlsInScope: number;
  controlsEffective: number;
  effectivePct: number;
  openFindings: number;
  avgHealth: number;
  needsAttention: number;
  byType: TypeAgg[];
  byStatus: StatusAgg[];
  byProcess: ProcessAgg[];
  rows: EngRow[];
}

function effectiveControls(e: Engagement): number {
  return Math.round((e.controls * e.health) / 100);
}

export function buildEngagementRows(engagements: Engagement[] = ENGAGEMENTS): EngRow[] {
  return engagements.map(e => ({
    id: e.id,
    code: e.code,
    name: e.name,
    type: e.type,
    status: e.status,
    process: e.process,
    owner: e.owner,
    controls: e.controls,
    health: e.health,
    effective: effectiveControls(e),
    openIssues: e.openIssues,
    lastActivity: e.lastActivity,
  }));
}

export function deriveEngagementPortfolio(engagements: Engagement[] = ENGAGEMENTS): EngagementPortfolio {
  const rows = buildEngagementRows(engagements);
  const inFlightRows = engagements.filter(e => IN_FLIGHT.includes(e.status));

  const controlsInScope = engagements.reduce((s, e) => s + e.controls, 0);
  const controlsEffective = engagements.reduce((s, e) => s + effectiveControls(e), 0);
  const openFindings = engagements.reduce((s, e) => s + e.openIssues, 0);
  const avgHealth = inFlightRows.length > 0
    ? Math.round(inFlightRows.reduce((s, e) => s + e.health, 0) / inFlightRows.length)
    : 0;

  const byType: TypeAgg[] = ENG_TYPES.map(type => {
    const of = engagements.filter(e => e.type === type);
    return {
      type,
      count: of.length,
      controls: of.reduce((s, e) => s + e.controls, 0),
      effective: of.reduce((s, e) => s + effectiveControls(e), 0),
      findings: of.reduce((s, e) => s + e.openIssues, 0),
    };
  }).filter(t => t.count > 0);

  const byStatus: StatusAgg[] = ENG_STATUSES.map(status => ({
    status,
    count: engagements.filter(e => e.status === status).length,
  })).filter(s => s.count > 0);

  const processes = [...new Set(engagements.map(e => e.process))];
  const byProcess: ProcessAgg[] = processes.map(process => {
    const of = engagements.filter(e => e.process === process);
    return { process, count: of.length, controls: of.reduce((s, e) => s + e.controls, 0) };
  }).sort((a, b) => b.controls - a.controls);

  return {
    total: engagements.length,
    inFlight: inFlightRows.length,
    planned: engagements.filter(e => e.status === 'Planned' || e.status === 'Draft').length,
    controlsInScope,
    controlsEffective,
    effectivePct: controlsInScope > 0 ? Math.round((controlsEffective / controlsInScope) * 100) : 0,
    openFindings,
    avgHealth,
    needsAttention: engagements.filter(e => e.openIssues > 0).length,
    byType,
    byStatus,
    byProcess,
    rows,
  };
}

/* ── Findings over time — deterministic seeded flow across the window ──────
 * The portfolio is current-state (each engagement carries an open-issue
 * count), so a raised/resolved flow is a seeded demo series (same philosophy
 * as the rest of the Usage page). Deterministic, so it survives reloads. */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FindingsPoint {
  label: string;
  raised: number;
  resolved: number;
  /** Running open count at this bucket. */
  open: number;
}

/** Findings raised vs resolved across `rangeDays`, ending near the current
 *  open total so the trend reconciles with the "Open findings" KPI. */
export function deriveFindingsTrend(rangeDays: number, openNow: number): FindingsPoint[] {
  const buckets = rangeDays <= 7 ? 7 : rangeDays <= 30 ? 10 : 12;
  const rnd = mulberry32(0xf1d0 + rangeDays);
  const spanDays = rangeDays;
  // Aim for a plausible flow: total raised a bit above what stays open.
  const points: { raised: number; resolved: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const raised = Math.round(1 + rnd() * (openNow / buckets) * 1.6);
    const resolved = Math.round(rnd() * (openNow / buckets) * 1.1);
    points.push({ raised, resolved });
  }
  // Normalise so the running open lands on `openNow` at the last bucket.
  let netRaised = points.reduce((s, p) => s + p.raised - p.resolved, 0);
  if (netRaised <= 0) netRaised = 1;
  const scale = openNow / netRaised;
  let open = 0;
  return points.map((p, i) => {
    const raised = Math.max(0, Math.round(p.raised * scale));
    const resolved = Math.max(0, Math.round(p.resolved * scale));
    open = Math.max(0, open + raised - resolved);
    if (i === buckets - 1) open = openNow; // pin the end to the live KPI
    const daysAgo = Math.round(((buckets - 1 - i) / (buckets - 1)) * spanDays);
    const d = new Date(Date.now() - daysAgo * 86400000);
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), raised, resolved, open };
  });
}

/** Brand-family colour per engagement type (matches the platform palette). */
export const ENG_TYPE_COLOR: Record<EngType, string> = {
  'SOX / ICFR': '#6A12CD',
  'Internal Audit': '#0369A1',
  'Compliance': '#0D9488',
  'Automation': '#C2610C',
};

/** Status colour — greens for in-flight, muted for not-yet-started. */
export const ENG_STATUS_COLOR: Record<EngStatus, string> = {
  'Active': '#15803D',
  'In Progress': '#0369A1',
  'Review': '#8838DE',
  'Planned': '#A1A1AA',
  'Draft': '#D4D4D8',
  'Closed': '#6B7280',
};
