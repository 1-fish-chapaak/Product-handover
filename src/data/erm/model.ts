/**
 * Enterprise risk model — the shape of a rated risk, the tiers a score falls
 * into, what each tier sets in motion, and the appetite each category is
 * held to.
 *
 * The register rates every risk the way an offsite risk assessment rates a
 * branch: a 0–100 residual score built from parts you can point at —
 * inherent exposure (likelihood × impact), what each linked control takes
 * off it, the indicators breaching their thresholds, and recent loss events
 * — so "why this rating" always has an answer line by line.
 */
import type { RiskCategory, RiskEntry } from '../riskRegister';

/** The assessment window: April to October 2026, one value a month. */
export const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'] as const;
export const NOW = MONTHS.length - 1;
export const AS_OF = '15 Oct 2026';

export type Tier = 'Low' | 'Medium' | 'High' | 'Very High' | 'Critical';
export const TIERS: Tier[] = ['Low', 'Medium', 'High', 'Very High', 'Critical'];
/** Highest first — the order every list and legend reads in. */
export const TIERS_DESC: Tier[] = [...TIERS].reverse();

export const tierOf = (score: number): Tier =>
  score >= 60 ? 'Critical' : score >= 45 ? 'Very High' : score >= 30 ? 'High' : score >= 15 ? 'Medium' : 'Low';

export const TIER_FLOOR: Record<Tier, number> = { Low: 0, Medium: 15, High: 30, 'Very High': 45, Critical: 60 };

/** What a rating sets in motion. */
export const TIER_ACTION: Record<Tier, string> = {
  Critical: 'Escalate to the Audit Committee within 7 days',
  'Very High': 'Treatment plan signed off within 30 days',
  High: 'Owner action plan this quarter',
  Medium: 'Monitor indicators monthly',
  Low: 'Within appetite — annual review',
};

/** Risk appetite by category: the residual score a category tolerates. */
export const APPETITE: Record<RiskCategory, { level: 'Low' | 'Moderate' | 'High'; max: number }> = {
  Fraud: { level: 'Low', max: 25 },
  Compliance: { level: 'Low', max: 30 },
  Reporting: { level: 'Low', max: 30 },
  Financial: { level: 'Moderate', max: 35 },
  IT: { level: 'Moderate', max: 40 },
  Operational: { level: 'Moderate', max: 40 },
  Other: { level: 'High', max: 50 },
};

export const CATEGORIES: RiskCategory[] = ['Financial', 'Operational', 'Fraud', 'Compliance', 'Reporting', 'IT', 'Other'];

export type KriUnit = '%' | 'count' | '₹ L' | 'days' | 'pp';

/** A key risk indicator (KRI) — or a key control indicator (KCI), which
 *  measures a control failing rather than the risk itself rising. */
export interface Kri {
  id: string;
  name: string;
  type: 'KRI' | 'KCI';
  unit: KriUnit;
  /** Amber from / red from. Higher is worse unless `lowerIsWorse`. */
  amber: number;
  red: number;
  lowerIsWorse?: boolean;
  /** One value per month, Apr → Oct. */
  values: number[];
  source: string;
  defn: string;
}

export type Treatment = 'Mitigate' | 'Accept' | 'Transfer' | 'Avoid';

export interface RiskEvent {
  /** Month index into MONTHS. */
  m: number;
  text: string;
  /** Loss in ₹ lakh, if the event cost money. */
  loss?: number;
  /** A regulatory breach — holds the rating at Very High or above. */
  regulatory?: boolean;
}

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  due: string;
  done: boolean;
}

export interface Assessment {
  at: string;
  by: string;
  likelihood: number;
  impact: number;
  note: string;
}

export interface ErmRisk extends RiskEntry {
  /** Inherent likelihood and impact, 1–5. */
  likelihood: number;
  impact: number;
  treatment: Treatment;
  /** Control Library control IDs (custom `C-001` or standard `P2P-C01`). */
  controlIds: string[];
  /** Month a control started operating, when that was inside the window. */
  controlSince?: Record<string, number>;
  kris: Kri[];
  events: RiskEvent[];
  actions: ActionItem[];
  assessments: Assessment[];
}

/** Indicator status: 0 green, 1 amber, 2 red. */
export type Rag = 0 | 1 | 2;
export function ragOf(k: Kri, v: number): Rag {
  if (k.lowerIsWorse) return v <= k.red ? 2 : v <= k.amber ? 1 : 0;
  return v >= k.red ? 2 : v >= k.amber ? 1 : 0;
}

export function fmtKri(k: Kri, v: number): string {
  const n = Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toFixed(1);
  if (k.unit === '%') return `${n}%`;
  if (k.unit === '₹ L') return `₹${n} L`;
  if (k.unit === 'days') return `${n} d`;
  if (k.unit === 'pp') return `${v > 0 ? '+' : ''}${n} pp`;
  return n;
}
