import type { CompareTone, MetricKey, Polarity } from './compareTypes';

// Which way is "good" for a metric. Defaults for the model's known columns, a
// name heuristic for anything else, and the user's overrides on top — because
// a KPI's colour must never assume that "up" is progress.

export const DEFAULT_POLARITY: Record<MetricKey, Polarity> = {
  'invoices.Amount': 'neutral',
  'invoices.AmountAtRisk': 'lowerBetter',
  'invoices.DuplicateCount': 'lowerBetter',
  'invoices.InvoiceID': 'neutral',
  'vendors.RiskScore': 'lowerBetter',
  'payments.Amount': 'neutral',
  // Chocolate Sales — a sales sheet, so more is progress.
  'chocolate.Amount': 'higherBetter',
  'chocolate.Boxes': 'higherBetter',
  'chocolate.SalesPerson': 'neutral',
};

export const metricKey = (table: string, column: string): MetricKey => `${table}.${column}`;

const LOWER = /risk|exception|duplicate|error|fail|pending|overdue|breach|defici|open/i;
const HIGHER = /rate|compliance|coverage|resolved|closed|complete|sales|revenue|shipped|boxes|units|score(?!.*risk)/i;

export function inferPolarity(column: string, label?: string): Polarity {
  const text = `${column} ${label ?? ''}`;
  if (LOWER.test(text)) return 'lowerBetter';
  if (HIGHER.test(text)) return 'higherBetter';
  return 'neutral';
}

export function polarityFor(key: MetricKey, overrides: Record<MetricKey, Polarity>, label?: string): Polarity {
  if (overrides[key]) return overrides[key];
  if (DEFAULT_POLARITY[key]) return DEFAULT_POLARITY[key];
  return inferPolarity(key.split('.')[1] ?? key, label);
}

/** Same rule as layeredInsights.readTrajectory, extended for higher-is-better. */
export function toneFor(polarity: Polarity, delta: number): CompareTone {
  if (delta === 0 || polarity === 'neutral') return 'neutral';
  const up = delta > 0;
  if (polarity === 'lowerBetter') return up ? 'bad' : 'good';
  return up ? 'good' : 'bad';
}

export const POLARITY_LABEL: Record<Polarity, string> = {
  higherBetter: 'Higher is better',
  lowerBetter: 'Lower is better',
  neutral: 'Neutral',
};
export const POLARITY_ORDER: Polarity[] = ['higherBetter', 'lowerBetter', 'neutral'];
