// Field access for the 10 required ATR fields. Four of them (recommendation,
// action taken, evidence, verification) live on the observation's first action
// plan; the rest live on the observation itself. These helpers hide that split
// so the card can read/write any field by key.

import type { ExtractedObservation, ExtractedFieldKey, CompletenessStatus } from './types';
import type { AtrClassification, AtrRisk, AtrActionPlan } from '../atrTypes';

export type FieldKind = 'text' | 'textarea' | 'classification' | 'risk' | 'date';

export interface FieldDef {
  key: ExtractedFieldKey;
  label: string;
  kind: FieldKind;
  /** Where the value lives — on the observation or its first action plan. */
  loc: 'obs' | 'plan';
}

export const OBSERVATION_FIELDS: FieldDef[] = [
  { key: 'title',          label: 'Observation Title',                          kind: 'text',           loc: 'obs' },
  { key: 'description',     label: 'Observation Description',                    kind: 'textarea',       loc: 'obs' },
  { key: 'riskSummary',    label: 'Risk Summary',                               kind: 'textarea',       loc: 'obs' },
  { key: 'recommendation', label: 'Recommendation / Action Plan',     kind: 'textarea',       loc: 'plan' },
  { key: 'actionTaken',    label: 'Action Taken',                               kind: 'textarea',       loc: 'plan' },
  { key: 'evidence',       label: 'Evidence',                                   kind: 'textarea',       loc: 'plan' },
  { key: 'verification',   label: 'Management Comments / Auditor Verification',  kind: 'textarea',       loc: 'plan' },
  { key: 'classification', label: 'Classification',                             kind: 'classification', loc: 'obs' },
  { key: 'risk',           label: 'Risk Significance',                          kind: 'risk',           loc: 'obs' },
  { key: 'dueDate',        label: 'Due Date / Timeline',                        kind: 'date',           loc: 'obs' },
];

export const CLASSIFICATION_OPTIONS: AtrClassification[] = ['Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance'];
export const RISK_OPTIONS: AtrRisk[] = ['High', 'Medium', 'Low'];

const PLAN_PROP: Partial<Record<ExtractedFieldKey, keyof AtrActionPlan>> = {
  recommendation: 'text',
  actionTaken: 'actionTaken',
  evidence: 'evidence',
  verification: 'verification',
};

export function getFieldValue(obs: ExtractedObservation, key: ExtractedFieldKey): string {
  const plan = obs.actionPlans[0];
  if (key in PLAN_PROP) {
    const prop = PLAN_PROP[key]!;
    return String(plan?.[prop] ?? '');
  }
  if (key === 'dueDate') return obs.dueDate ?? plan?.dueDate ?? '';
  const v = (obs as unknown as Record<string, unknown>)[key];
  return v == null ? '' : String(v);
}

/** Return a new observation with `key` set to `value` in the right location. */
export function setFieldValue(obs: ExtractedObservation, key: ExtractedFieldKey, value: string): ExtractedObservation {
  if (key in PLAN_PROP) {
    const prop = PLAN_PROP[key]!;
    const plans = obs.actionPlans.length ? [...obs.actionPlans] : [{ text: '' } as AtrActionPlan];
    plans[0] = { ...plans[0], [prop]: value };
    return { ...obs, actionPlans: plans };
  }
  if (key === 'classification') return { ...obs, classification: (value || undefined) as AtrClassification | undefined };
  if (key === 'risk') return { ...obs, risk: (value || undefined) as AtrRisk | undefined };
  if (key === 'dueDate') return { ...obs, dueDate: value || undefined };
  return { ...obs, [key]: value || undefined } as ExtractedObservation;
}

/** Recompute the completeness badge from the unresolved missing fields. */
export function recomputeCompleteness(obs: ExtractedObservation): CompletenessStatus {
  const unresolved = obs.missingFields.filter(f => f.state === 'missing').map(f => f.key);
  if (unresolved.length === 0) return 'Complete';
  if (unresolved.includes('title') || unresolved.includes('actionTaken')) return 'Incomplete';
  return 'Partial';
}

export const hasUnresolved = (obs: ExtractedObservation): boolean =>
  obs.missingFields.some(f => f.state === 'missing');
