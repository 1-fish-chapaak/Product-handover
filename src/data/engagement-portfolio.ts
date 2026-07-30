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
import { ENGAGEMENT_EXCEPTIONS } from './engagement-exceptions';

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

/**
 * Open findings, counted off the exception registry rather than the engagement
 * record's `openIssues` summary field.
 *
 * The Engagements overview and My Queue both work the exception registry, and
 * the summary field had drifted from it — the overview showed 32 open findings
 * while this page claimed 35. The registry is the thing a user can actually
 * open, triage and resolve, so it wins. An engagement nobody has raised an
 * exception against has none.
 */
function openExceptionsByEngagement(): Map<string, number> {
  const byEng = new Map<string, number>();
  for (const ex of ENGAGEMENT_EXCEPTIONS) {
    if (ex.status === 'Resolved') continue;
    byEng.set(ex.engagementId, (byEng.get(ex.engagementId) ?? 0) + 1);
  }
  return byEng;
}

export function buildEngagementRows(engagements: Engagement[] = ENGAGEMENTS): EngRow[] {
  const openByEng = openExceptionsByEngagement();
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
    openIssues: openByEng.get(e.id) ?? 0,
    lastActivity: e.lastActivity,
  }));
}

export function deriveEngagementPortfolio(engagements: Engagement[] = ENGAGEMENTS): EngagementPortfolio {
  const rows = buildEngagementRows(engagements);
  const inFlightRows = engagements.filter(e => IN_FLIGHT.includes(e.status));

  const controlsInScope = engagements.reduce((s, e) => s + e.controls, 0);
  const controlsEffective = engagements.reduce((s, e) => s + effectiveControls(e), 0);
  // Every unresolved exception on the register, matching the Engagements
  // overview KPI exactly — not the sum of each engagement's `openIssues` field.
  const openFindings = ENGAGEMENT_EXCEPTIONS.filter(ex => ex.status !== 'Resolved').length;
  const avgHealth = inFlightRows.length > 0
    ? Math.round(inFlightRows.reduce((s, e) => s + e.health, 0) / inFlightRows.length)
    : 0;

  const byType: TypeAgg[] = ENG_TYPES.map(type => {
    const of = engagements.filter(e => e.type === type);
    const ofRows = rows.filter(r => r.type === type);
    return {
      type,
      count: of.length,
      controls: of.reduce((s, e) => s + e.controls, 0),
      effective: of.reduce((s, e) => s + effectiveControls(e), 0),
      findings: ofRows.reduce((s, r) => s + r.openIssues, 0),
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
    needsAttention: rows.filter(r => r.openIssues > 0).length,
    byType,
    byStatus,
    byProcess,
    rows,
  };
}

/* The portfolio is current-state: each engagement carries an open-issue count,
 * with no per-finding history. A raised-vs-resolved trend is therefore not
 * derivable, and the Usage page shows open findings by engagement instead. */

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
