/**
 * Coverage, risk, control and RACM counts for a business process — the Process
 * Hub's own rules, in one place.
 *
 * These used to live inside the Process Hub components, which meant Platform
 * Usage had no way to reach them and fell back on the summary fields carried on
 * the BUSINESS_PROCESSES records. Those fields are stale in every direction:
 * they claim P2P has 9 risks / 24 controls and R2R 11 / 31, while the Process
 * Hub counts the actual records and shows 6 / 6 and 2 / 1 — and they say P2P is
 * 72% covered and R2R 85%, where the Hub computes 67% and 50%. The screen is
 * right, the fields are decoration, and the two pages disagreed in front of the
 * admin.
 *
 * Every rule below is defined exactly as the Process Hub defines it, and both
 * read this, so there is one answer.
 */

import { RISKS, CONTROLS } from './mockData';
import { processHubRacms } from './racmRegistry';

/** A process's risks — the register, filtered. Same rule as the Hub's Risks tab. */
export function processRisks(bpId: string) {
  return RISKS.filter(r => r.bpId === bpId);
}

/**
 * A process's controls — every control mapped to one of its risks. Controls carry
 * a riskId, not a bpId, so a process reaches its controls through its risks. Same
 * rule as the Hub's Controls tab.
 */
export function processControls(bpId: string) {
  const riskIds = new Set(processRisks(bpId).map(r => r.id));
  return CONTROLS.filter(c => riskIds.has(c.riskId));
}

/** Percent of a process's risks that have at least one control mapped to them. */
export function processCoverage(bpId: string): number {
  const risks = processRisks(bpId);
  if (risks.length === 0) return 0;
  const covered = new Set(processControls(bpId).map(c => c.riskId));
  return Math.round((covered.size / risks.length) * 100);
}

/**
 * RACMs built for a process — counted off the registry the Process Hub's RACM tab
 * actually renders, keyed by process abbreviation ('P2P'). The older
 * `mockData.RACMS` array disagrees with that screen, so it is not used here.
 */
export function racmsForProcess(abbr: string): number {
  return processHubRacms(abbr).length;
}
