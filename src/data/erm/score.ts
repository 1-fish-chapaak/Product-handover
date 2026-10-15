/**
 * The scoring engine. A risk's residual score, 0–100, is the sum of lines you
 * can read off the screen:
 *
 *   + inherent exposure     likelihood × impact × 4
 *   − each linked control   its share of the exposure, by design weight and
 *                           how well it is evidenced today (capped at 75%)
 *   + each indicator        red 7 points, amber 3; red three months running
 *                           counts 1.25×
 *   + recent loss events    in the last three months, capped at 15
 *
 * Overrides lift the rating above what the score alone gives: a loss event
 * in the last 90 days holds it at High or above, a regulatory breach at Very
 * High, and no operating key control at High. A jump of 15+ points in 90 days
 * is flagged, not lifted.
 */
import type { ControlRow } from '../../components/governance/controlTypes';
import type { StdState } from '../auditPlan';
import { APPETITE, NOW, TIERS, TIER_FLOOR, ragOf, tierOf, type ErmRisk, type Kri, type Rag, type Tier } from './model';
import { controlEffect, type ControlEffect } from './controls';

export type Override = 'Loss event' | 'Regulatory breach' | 'No operating key control' | 'Score jump';
export const OVERRIDE_TIP: Record<Override, string> = {
  'Loss event': 'A loss in the last 90 days holds the rating at High or above',
  'Regulatory breach': 'A regulatory breach holds the rating at Very High or above',
  'No operating key control': 'No key control is operating effectively — the rating is held at High or above',
  'Score jump': 'Score up 15 points or more in 90 days — flagged for review',
};
const OVERRIDE_FLOOR: Partial<Record<Override, Tier>> = { 'Loss event': 'High', 'Regulatory breach': 'Very High', 'No operating key control': 'High' };

export interface ControlLine {
  id: string;
  row?: ControlRow;
  effect?: ControlEffect;
  /** Points taken off the score (positive number). */
  points: number;
}
export interface KriLine { kri: Kri; rag: Rag; value: number; points: number; repeat: boolean }
export interface EventLine { text: string; m: number; points: number; loss?: number }

export interface RiskScore {
  inherent: number;
  controls: ControlLine[];
  mitigation: number;
  kris: KriLine[];
  kriPoints: number;
  events: EventLine[];
  eventPoints: number;
  score: number;
  /** The tier the score alone gives. */
  scoreTier: Tier;
  /** The rating, after overrides. */
  tier: Tier;
  overrides: Override[];
  outsideAppetite: boolean;
  effectiveControls: number;
}

export interface ScoreContext { index: Map<string, ControlRow>; std: StdState }
export interface Simulation { fixKris?: Set<string>; fixControls?: Set<string> }

const CAP = 0.75;
const SHARE = 0.3;

function since(r: ErmRisk, cid: string, row: ControlRow | undefined, std: StdState): number {
  if (r.controlSince?.[cid] != null) return r.controlSince[cid];
  // A standard control approved in this session went live today.
  if (row?.library === 'standard' && row.stdKey && std.live.includes(row.stdKey)) return NOW;
  return 0;
}

export function scoreRisk(r: ErmRisk, ctx: ScoreContext, m = NOW, sim: Simulation = {}): RiskScore {
  const inherent = r.likelihood * r.impact * 4;

  // Controls — each its share of the exposure, scaled down together if the
  // shares pass the cap.
  const raw = r.controlIds.map(id => {
    const row = ctx.index.get(id);
    if (!row) return { id, share: 0 } as { id: string; row?: ControlRow; effect?: ControlEffect; share: number };
    let effect = controlEffect(row, ctx.std);
    if (sim.fixControls?.has(id)) effect = { ...effect, effectiveness: 1, label: 'Effective (simulated)', status: 'live', exceptions: 0 };
    const eff = m < since(r, id, row, ctx.std) ? Math.min(effect.effectiveness, 0.2) : effect.effectiveness;
    return { id, row, effect, share: effect.weight * eff * SHARE };
  });
  const total = raw.reduce((a, c) => a + c.share, 0);
  const scale = total > CAP ? CAP / total : 1;
  const controls: ControlLine[] = raw.map(c => ({ id: c.id, row: c.row, effect: c.effect, points: inherent * c.share * scale }));
  const mitigation = controls.reduce((a, c) => a + c.points, 0);

  // Indicators.
  const kris: KriLine[] = r.kris.map(k => {
    const value = k.values[m] ?? 0;
    const rag = sim.fixKris?.has(k.id) ? 0 : ragOf(k, value);
    const repeat = rag === 2 && m >= 2 && ragOf(k, k.values[m - 1]) === 2 && ragOf(k, k.values[m - 2]) === 2;
    const points = rag === 2 ? 7 * (repeat ? 1.25 : 1) : rag === 1 ? 3 : 0;
    return { kri: k, rag: rag as Rag, value, points, repeat };
  });
  const kriPoints = kris.reduce((a, k) => a + k.points, 0);

  // Loss events in the last three months.
  const events: EventLine[] = r.events.filter(e => e.m <= m && e.m >= m - 2).map(e => ({ text: e.text, m: e.m, loss: e.loss, points: 4 + Math.min(6, (e.loss ?? 0) / 3) }));
  const eventPoints = Math.min(15, events.reduce((a, e) => a + e.points, 0));

  const score = Math.max(0, Math.min(100, inherent - mitigation + kriPoints + eventPoints));
  const scoreTier = tierOf(score);

  const overrides: Override[] = [];
  if (r.events.some(e => e.loss && e.m <= m && e.m >= m - 2)) overrides.push('Loss event');
  if (r.events.some(e => e.regulatory && e.m <= m && e.m >= m - 2)) overrides.push('Regulatory breach');
  const keyOperating = controls.some(c => c.row?.classification === 'Key' && (c.effect?.effectiveness ?? 0) >= 0.55);
  if (!keyOperating && inherent >= 36) overrides.push('No operating key control');

  let tier = scoreTier;
  for (const o of overrides) {
    const floor = OVERRIDE_FLOOR[o];
    if (floor && TIERS.indexOf(floor) > TIERS.indexOf(tier)) tier = floor;
  }

  return {
    inherent, controls, mitigation, kris, kriPoints, events, eventPoints, score, scoreTier, tier, overrides,
    outsideAppetite: score > APPETITE[r.category].max,
    effectiveControls: controls.filter(c => (c.effect?.effectiveness ?? 0) >= 0.55).length,
  };
}

export interface RiskRating extends RiskScore {
  risk: ErmRisk;
  /** Apr → Oct. */
  history: number[];
  tierHistory: Tier[];
  delta: number;
  prevTier: Tier;
  prevOverrides: Override[];
}

/** The risk rated at every month, with this month's full breakdown. */
export function rateRisk(r: ErmRisk, ctx: ScoreContext): RiskRating {
  const months = Array.from({ length: NOW + 1 }, (_, m) => scoreRisk(r, ctx, m));
  const now = months[NOW];
  const history = months.map(x => x.score);
  if (now.score - history[Math.max(0, NOW - 3)] >= 15) now.overrides.push('Score jump');
  return {
    ...now, risk: r, history, tierHistory: months.map(x => x.tier),
    delta: now.score - history[NOW - 1], prevTier: months[NOW - 1].tier, prevOverrides: months[NOW - 1].overrides,
  };
}

/** Residual position on the 5×5 grid: controls bring likelihood down. */
export function residualCell(rt: RiskRating): { l: number; i: number } {
  const ratio = rt.inherent ? rt.score / rt.inherent : 1;
  return { l: Math.max(1, Math.min(5, Math.round(rt.risk.likelihood * ratio))), i: rt.risk.impact };
}

/** The indicator that moved most this month — why a rating changed. */
export function moveReason(rt: RiskRating): string {
  // A hold that applied last month and no longer does.
  const lifted = rt.prevOverrides.filter(o => o !== 'Score jump' && !rt.overrides.includes(o));
  if (lifted.includes('Loss event')) {
    const e = rt.risk.events.find(x => x.loss && x.m === NOW - 3);
    return e ? `${e.text} — now outside the 90-day window` : 'Loss event now outside the 90-day window';
  }
  if (lifted.length) return `${lifted[0]} hold lifted`;
  // Explain the move with indicators that moved the same way as the rating.
  const dir = Math.sign(TIERS.indexOf(rt.tier) - TIERS.indexOf(rt.prevTier)) || Math.sign(rt.delta);
  const moved = rt.kris
    .map(k => ({ k, d: k.rag - ragOf(k.kri, k.kri.values[NOW - 1] ?? 0) }))
    .filter(x => x.d !== 0);
  const ups = (moved.some(x => Math.sign(x.d) === dir) ? moved.filter(x => Math.sign(x.d) === dir) : moved)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  if (ups.length) {
    const x = ups[0];
    const to = x.k.rag === 2 ? 'red' : x.k.rag === 1 ? 'amber' : 'green';
    return `${x.k.kri.name} to ${to}${ups.length > 1 ? ` and ${ups.length - 1} more` : ''}`;
  }
  const newly = rt.controls.find(c => rt.risk.controlSince?.[c.id] === NOW);
  if (newly) return `${newly.row?.name ?? newly.id} went live`;
  if (rt.events.some(e => e.m === NOW)) return rt.events.find(e => e.m === NOW)!.text;
  return 'Indicator values shifted';
}

export const TIER_RANK = (t: Tier) => TIERS.indexOf(t);
export const tierAtLeast = (t: Tier, floor: Tier) => TIER_FLOOR[t] >= TIER_FLOOR[floor];
