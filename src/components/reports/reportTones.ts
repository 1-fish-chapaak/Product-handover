// Tone → accent mapping for report KPI tiles. Stats across the report system
// carry icon colour classes like "text-risk-700 bg-risk-50"; statTone derives
// the matching tile accent (left-border class, number colour, export hex).

export type StatTone = { border: string; text: string; hex: string };

const STAT_TONES: Record<string, StatTone> = {
  brand:     { border: 'border-l-brand-500', text: 'text-brand-700',     hex: '#6A12CD' },
  risk:      { border: 'border-l-risk',      text: 'text-risk-700',      hex: '#B42318' },
  high:      { border: 'border-l-high',      text: 'text-high-700',      hex: '#C2410C' },
  mitigated: { border: 'border-l-mitigated', text: 'text-mitigated-700', hex: '#B45309' },
  compliant: { border: 'border-l-compliant', text: 'text-compliant-700', hex: '#15803D' },
  evidence:  { border: 'border-l-evidence',  text: 'text-evidence-700',  hex: '#0369A1' },
};

export const statTone = (color: string): StatTone =>
  STAT_TONES[color.match(/text-(\w+)-700/)?.[1] ?? 'brand'] ?? STAT_TONES.brand;
