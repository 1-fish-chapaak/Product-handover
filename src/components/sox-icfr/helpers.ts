import type {
  Conclusion, Control, Court, Deficiency, DesignTrack, HandoffTask, IcfrEngagement,
  Likelihood, OperatingTrack, Role, Severity, TrackConclusion,
} from './types';

// ─── Severity (handbook §9.5) ────────────────────────────────────────────────────

export function isReasonablyPossible(l: Likelihood): boolean { return l !== 'Remote'; }
export function computeSeverity(likelihood: Likelihood, magnitude: number, materiality: number, mwIndicators: string[], band = 0.2): Severity {
  if (mwIndicators.length > 0) return 'Material Weakness';
  if (!isReasonablyPossible(likelihood)) return 'Deficiency';
  if (magnitude >= materiality) return 'Material Weakness';
  if (magnitude >= materiality * band) return 'Significant Deficiency';
  return 'Deficiency';
}
export function severityOf(d: Deficiency, materiality: number): Severity {
  return computeSeverity(d.likelihood, d.magnitude, materiality, d.mwIndicators);
}

// ─── Track + control conclusions (override wins) ─────────────────────────────────

export function trackResult(t: DesignTrack | OperatingTrack): TrackConclusion {
  if (t.override) return t.override.result === 'Effective' ? 'Effective' : 'Ineffective';
  return t.conclusion;
}
export function designStarted(c: Control): boolean {
  return !!c.design.override || c.design.conclusion !== 'Not tested'
    || c.design.documents.some(d => d.status === 'Received') || c.design.points.some(p => p.result !== 'Not tested');
}
export function operatingStarted(c: Control): boolean {
  return !!c.operating.override || c.operating.conclusion !== 'Not tested'
    || !!c.operating.population || c.operating.steps.some(s => s.result !== 'Not tested');
}
export function controlConclusion(c: Control): Conclusion {
  const d = trackResult(c.design); const o = trackResult(c.operating);
  if (d === 'Ineffective' || o === 'Ineffective') return 'Ineffective';
  if (d === 'Effective' && o === 'Effective') return 'Effective';
  return designStarted(c) || operatingStarted(c) ? 'In progress' : 'Not started';
}

// ─── Track progress ──────────────────────────────────────────────────────────────

import type { DesignPoint, OperatingStep, TestResult, ValidationQA } from './types';
export function pointResult(p: DesignPoint): TestResult { return p.override ? (p.override.result as TestResult) : p.result; }
export function stepResult(s: OperatingStep): TestResult { return s.override ? (s.override.result as TestResult) : s.result; }

/** Deterministic Q&A a design-validation workflow returns for a consideration. */
export function validationQA(text: string, fail: boolean): ValidationQA[] {
  return [
    { q: 'Does the control as described address the stated risk and assertion?', a: 'Yes — traced to the risk register and the relevant assertion in the narrative.', pass: true },
    { q: 'Is the control performed at sufficient precision to catch a material error?', a: fail ? 'No — the review occurs after the entry is posted, so a material error could already be recorded before detection.' : 'Yes — it operates before the transaction completes and the threshold is below performance materiality.', pass: !fail },
    { q: 'Is the performer segregated from the activity being controlled?', a: 'Yes — distinct system roles were confirmed in the walkthrough.', pass: true },
    { q: 'Is the control’s operation evidenced and retained for the period?', a: fail ? 'Partially — sign-off is retained but does not evidence the pre-posting review.' : 'Yes — evidenced and retained for the full period.', pass: !fail },
  ];
}

export function designProgress(c: Control) {
  const docs = c.design.documents;
  return {
    docsReceived: docs.filter(d => d.status === 'Received').length,
    docsTotal: docs.length,
    docsMissing: docs.filter(d => d.status !== 'Received').length,
    pointsPass: c.design.points.filter(p => pointResult(p) === 'Pass').length,
    pointsTotal: c.design.points.length,
  };
}
export function operatingProgress(c: Control) {
  const s = c.operating.steps;
  return {
    tested: s.filter(x => x.result !== 'Not tested').length,
    passed: s.filter(x => x.result === 'Pass').length,
    failed: s.filter(x => x.result === 'Fail').length,
    total: s.length,
  };
}

// ─── Baton — whose court ─────────────────────────────────────────────────────────

export function courtFor(c: Control, tasks: HandoffTask[]): Court {
  if (tasks.some(t => t.controlId === c.id && t.assigneeRole === 'risk-owner' && t.status === 'open')) return 'risk-owner';
  const concl = controlConclusion(c);
  if (concl === 'Effective' || concl === 'Ineffective') return 'reviewer';
  return 'auditor';
}

// ─── Engagement progress ─────────────────────────────────────────────────────────

export function engagementProgress(eng: IcfrEngagement) {
  const cs = eng.controls;
  const concl = cs.map(controlConclusion);
  return {
    total: cs.length,
    designDone: cs.filter(c => trackResult(c.design) !== 'Not tested').length,
    operatingDone: cs.filter(c => trackResult(c.operating) !== 'Not tested').length,
    effective: concl.filter(x => x === 'Effective').length,
    ineffective: concl.filter(x => x === 'Ineffective').length,
    inProgress: concl.filter(x => x === 'In progress').length,
    waitingOnOwner: cs.filter(c => courtFor(c, eng.tasks) === 'risk-owner').length,
  };
}

export function tasksForRole(eng: IcfrEngagement, role: Role): HandoffTask[] {
  return eng.tasks.filter(t => t.assigneeRole === role && t.status === 'open');
}
export function discussionsFor(eng: IcfrEngagement, controlId: string) {
  return eng.discussions.filter(d => d.controlId === controlId);
}
export function openDiscussionCount(eng: IcfrEngagement, controlId: string): number {
  return discussionsFor(eng, controlId).filter(d => !d.resolved).length;
}

export function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${n}`;
}
