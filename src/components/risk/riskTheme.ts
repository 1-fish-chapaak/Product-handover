/**
 * Risk register — the single-hue ramp tiers and scores are drawn in: the
 * deeper the purple, the higher the rating.
 */
import type { Tier } from '../../data/erm/model';

/** Fill and ink per tier — darker is worse. */
export const TIER_FILL: Record<Tier, [string, string]> = {
  Critical: ['#3B0764', '#FFFFFF'],
  'Very High': ['#6A12CD', '#FFFFFF'],
  High: ['#A366F0', '#FFFFFF'],
  Medium: ['#E4D4FB', '#3B0764'],
  Low: ['#F4F0F9', '#6B5D82'],
};

export const RAG_LABEL = ['Green', 'Amber', 'Red'] as const;

/** A 0–100 score as a heat cell, on the same single-hue ramp. */
export function heatFill(v: number): [string, string] {
  const t = Math.max(0, Math.min(1, v / 75));
  if (t < 0.02) return ['#F7F5FB', '#A39DB3'];
  const stops = [[246, 242, 252], [221, 204, 247], [167, 120, 234], [103, 17, 204], [59, 7, 100]];
  const p = t * 4;
  const i = Math.min(3, Math.floor(p));
  const f = p - i;
  const c = stops[i].map((x, j) => Math.round(x + (stops[i + 1][j] - x) * f));
  return [`rgb(${c.join(',')})`, t > 0.45 ? '#FFFFFF' : '#2E1065'];
}
