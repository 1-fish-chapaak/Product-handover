// ─── Compliance Deficiency Severity — Types & Helpers ─────────────────────
// Local copy of the SOX/ICFR severity model (see src/components/sox-icfr/helpers.ts
// computeSeverity) — kept module-local intentionally so the compliance workspace
// does not couple to the SOX module's Deficiency/Materiality types.
//
// Model: likelihood × magnitude vs materiality, with Material-Weakness indicators
// as an override. Magnitude ≥ materiality → MW; ≥ SD band (20% of materiality)
// → Significant Deficiency; otherwise Deficiency. Remote likelihood caps at
// Deficiency regardless of magnitude.

export type DeficiencyLikelihood = 'Remote' | 'Reasonably Possible' | 'Probable';
export type DeficiencySeverity = 'Deficiency' | 'Significant Deficiency' | 'Material Weakness';

export const LIKELIHOOD_OPTIONS: DeficiencyLikelihood[] = ['Remote', 'Reasonably Possible', 'Probable'];

/** Demo materiality baseline for the engagement (₹50,00,000). */
export const DEFAULT_MATERIALITY = 5_000_000;
/** Significant-deficiency band as a fraction of materiality. */
export const SD_BAND = 0.2;

export const MW_INDICATOR_OPTIONS = [
  'Indication of fraud involving senior management',
  'Restatement of previously issued financials',
  'Ineffective oversight by those charged with governance',
];

export interface SeverityClassification {
  likelihood: DeficiencyLikelihood;
  magnitude: number;
  mwIndicators: string[];
  value: DeficiencySeverity;
  rationale: string;
  classifiedBy: string;
  classifiedAt: string;
}

export function computeDeficiencySeverity(
  likelihood: DeficiencyLikelihood,
  magnitude: number,
  materiality: number = DEFAULT_MATERIALITY,
  mwIndicators: string[] = [],
  band: number = SD_BAND,
): DeficiencySeverity {
  if (mwIndicators.length > 0) return 'Material Weakness';
  if (likelihood === 'Remote') return 'Deficiency';
  if (magnitude >= materiality) return 'Material Weakness';
  if (magnitude >= materiality * band) return 'Significant Deficiency';
  return 'Deficiency';
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function severityRationale(
  likelihood: DeficiencyLikelihood,
  magnitude: number,
  materiality: number = DEFAULT_MATERIALITY,
  mwIndicators: string[] = [],
): string {
  if (mwIndicators.length > 0) {
    return `Material Weakness indicator present (${mwIndicators[0]}) — severity is MW regardless of magnitude.`;
  }
  if (likelihood === 'Remote') {
    return `Likelihood is Remote — misstatement is not reasonably possible, so severity caps at Deficiency.`;
  }
  if (magnitude >= materiality) {
    return `Potential magnitude ${inr(magnitude)} ≥ materiality ${inr(materiality)} with a reasonably-possible likelihood — Material Weakness.`;
  }
  if (magnitude >= materiality * SD_BAND) {
    return `Potential magnitude ${inr(magnitude)} is ≥ ${Math.round(SD_BAND * 100)}% of materiality ${inr(materiality)} — merits attention as a Significant Deficiency.`;
  }
  return `Potential magnitude ${inr(magnitude)} is below ${Math.round(SD_BAND * 100)}% of materiality ${inr(materiality)} — classified as a Deficiency.`;
}

export const SEVERITY_DISPLAY: Record<DeficiencySeverity, { label: string; short: string; cls: string }> = {
  'Deficiency': { label: 'Deficiency', short: 'D', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Significant Deficiency': { label: 'Significant Deficiency', short: 'SD', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  'Material Weakness': { label: 'Material Weakness', short: 'MW', cls: 'bg-red-50 text-red-700 border-red-200' },
};
