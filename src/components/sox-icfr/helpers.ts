import type {
  Attribute, Conclusion, Control, Court, Deficiency, HandoffTask,
  IcfrEngagement, Likelihood, Role, Severity,
} from './types';

// ─── Deficiency severity (handbook §9.5: likelihood × magnitude vs materiality) ──

/** Reasonable possibility = more than remote. */
export function isReasonablyPossible(l: Likelihood): boolean {
  return l !== 'Remote';
}

/**
 * Computed severity. MW indicators force a material weakness. Otherwise:
 *   not reasonably possible            → Deficiency
 *   magnitude ≥ materiality            → Material Weakness
 *   magnitude ≥ significant band (20%) → Significant Deficiency  (configurable)
 *   else                               → Deficiency
 * Remediation after the assessment date must NOT lower this.
 */
export function computeSeverity(
  likelihood: Likelihood,
  magnitude: number,
  materiality: number,
  mwIndicators: string[],
  significantBand = 0.2,
): Severity {
  if (mwIndicators.length > 0) return 'Material Weakness';
  if (!isReasonablyPossible(likelihood)) return 'Deficiency';
  if (magnitude >= materiality) return 'Material Weakness';
  if (magnitude >= materiality * significantBand) return 'Significant Deficiency';
  return 'Deficiency';
}

export function severityOf(d: Deficiency, materiality: number): Severity {
  return computeSeverity(d.likelihood, d.magnitude, materiality, d.mwIndicators);
}

// ─── Attribute + control roll-up ─────────────────────────────────────────────────

/** An attribute is concluded effective only when BOTH TOD and TOE pass. */
export function attributeEffective(a: Attribute): boolean {
  return a.tod.result === 'Pass' && a.toe.result === 'Pass';
}

export function attributeFailed(a: Attribute): boolean {
  return a.tod.result === 'Fail' || a.toe.result === 'Fail';
}

/** Roll a control up from its attributes (TOD gates TOE). */
export function controlConclusion(c: Control): Conclusion {
  const attrs = c.attributes;
  if (attrs.length === 0) return 'Not started';
  if (attrs.some(attributeFailed)) return 'Ineffective';
  if (attrs.every(attributeEffective)) return 'Effective';
  const anyTested = attrs.some(a => a.tod.result !== 'Not tested' || a.toe.result !== 'Not tested');
  return anyTested ? 'In progress' : 'Not started';
}

// ─── Baton — whose court is the ball in ──────────────────────────────────────────

export function courtFor(c: Control, tasks: HandoffTask[]): Court {
  if (c.stage === 'signed-off') return 'none';
  const open = tasks.filter(t => t.controlId === c.id && t.status === 'open');
  if (open.some(t => t.assigneeRole === 'risk-owner')) return 'risk-owner';
  if (c.stage === 'remediation') return 'risk-owner';
  if (c.stage === 'in-review' || open.some(t => t.assigneeRole === 'reviewer')) return 'reviewer';
  return 'auditor';
}

// ─── Engagement progress ─────────────────────────────────────────────────────────

export interface Progress {
  total: number;
  todDone: number;
  toeDone: number;
  concluded: number;
  effective: number;
  deficient: number;
  waitingOnOwner: number;
}

export function engagementProgress(eng: IcfrEngagement): Progress {
  const cs = eng.controls;
  const todDone = cs.filter(c => c.attributes.length > 0 && c.attributes.every(a => a.tod.result !== 'Not tested')).length;
  const toeDone = cs.filter(c => c.attributes.length > 0 && c.attributes.every(a => a.toe.result !== 'Not tested')).length;
  const concl = cs.map(controlConclusion);
  return {
    total: cs.length,
    todDone,
    toeDone,
    concluded: concl.filter(c => c === 'Effective' || c === 'Ineffective').length,
    effective: concl.filter(c => c === 'Effective').length,
    deficient: concl.filter(c => c === 'Ineffective').length,
    waitingOnOwner: cs.filter(c => courtFor(c, eng.tasks) === 'risk-owner').length,
  };
}

// ─── Role queues ─────────────────────────────────────────────────────────────────

/** Tasks assigned to a role that still need action. */
export function tasksForRole(eng: IcfrEngagement, role: Role): HandoffTask[] {
  return eng.tasks.filter(t => t.assigneeRole === role && t.status === 'open');
}

/** Controls whose baton is currently with this role. */
export function controlsInCourt(eng: IcfrEngagement, role: Role): Control[] {
  return eng.controls.filter(c => courtFor(c, eng.tasks) === role);
}

export function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${n}`;
}
