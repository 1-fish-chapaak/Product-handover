/**
 * Coverage and RACM counts for a business process — the Process Hub's own rules.
 *
 * Both used to live inside ProgramsView, which meant Platform Usage had no way
 * to reach them and fell back on the `coverage` and `sops` fields carried on the
 * BUSINESS_PROCESSES records. Those fields are stale: they say P2P is 72%
 * covered and R2R is 85%, while the Process Hub screen computes 67% and 50% and
 * shows that to the user. The screen is right, the fields are decoration, and
 * the two pages disagreed in front of the admin.
 *
 * Coverage is defined here exactly as the Process Hub defines it, and both read
 * this, so there is one answer.
 */

import { RISKS, CONTROLS, RACMS } from './mockData';

/** Percent of a process's risks that have at least one control mapped to them. */
export function processCoverage(bpId: string): number {
  const risks = RISKS.filter(r => r.bpId === bpId);
  if (risks.length === 0) return 0;
  const riskIds = new Set(risks.map(r => r.id));
  const covered = new Set(
    CONTROLS.filter(c => riskIds.has(c.riskId)).map(c => c.riskId),
  );
  return Math.round((covered.size / risks.length) * 100);
}

/** RACMs built for a process — counted off the register, not a summary field. */
export function racmsForProcess(bpId: string): number {
  return RACMS.filter(r => r.bpId === bpId).length;
}
