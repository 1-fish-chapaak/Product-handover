/**
 * The RACM registry — the matrices the Process Hub actually shows.
 *
 * This used to live inside RacmListTable.tsx, which meant a data module could
 * not reach it: Platform Usage fell back on `mockData.RACMS`, a second, older
 * RACM array that disagrees with the screen. The Process Hub's RACM tab counts
 * 4 matrices for P2P and 1 for R2R; `mockData.RACMS` claimed 5 and 2, and the
 * two numbers sat one click apart in front of the same admin.
 *
 * The Hub composes its list as RACM_SEED_DATA + the P2P "RACM Ready" extras
 * (the matrices generated from the P2P SOP list, injected through the table's
 * `extraRacms` prop rather than the global seed). `processHubRacms()` is that
 * same composition, so anything reporting on RACMs reads the one answer.
 *
 * RacmListTable re-exports `RacmEntry` and `RACM_SEED_DATA` from here, so its
 * existing importers are untouched.
 */

import { AR_RACM_ENTRIES, AR_RACM_ID } from './arRacm';

export interface RacmEntry {
  id: string; name: string; version: string; process: string; framework: string;
  risks: number; controls: number; mappedRisks: number; unmappedRisks: number;
  keyControls: number; workflowCoverage: number; attributesCoverage: number;
  isValidated: boolean; linkedToEngagement: boolean;
  /** Creation date (human-readable, e.g. "May 28, 2026") — shown on the RACM card meta line. */
  createdAt?: string;
  /** Last-updated date (human-readable) — shown next to "Created" on the RACM card meta line. */
  updatedAt?: string;
  /** false = still in draft review (editable Excel grid); true | undefined = frozen / active */
  isFrozen?: boolean;
  /** Original uploaded file name — used when re-opening the review editor */
  sourceFileName?: string;
}

export const RACM_SEED_DATA: RacmEntry[] = [
  { id: AR_RACM_ID, name: 'FY26 AR: Accounts Receivable RACM', version: 'v1.0', process: 'O2C', framework: 'IFC/ICOFR, COSO 2013', risks: AR_RACM_ENTRIES.length, controls: new Set(AR_RACM_ENTRIES.map(e => e.controlId)).size, mappedRisks: AR_RACM_ENTRIES.length, unmappedRisks: 0, keyControls: AR_RACM_ENTRIES.filter(e => e.riskRating === 'Critical' || e.riskRating === 'High').length, workflowCoverage: 78, attributesCoverage: 100, isValidated: true, linkedToEngagement: false, sourceFileName: 'SOP_Accounts Receivable.pptx' },
  { id: 'racm-001', name: 'FY26 P2P: Vendor Payment', version: 'v2.1', createdAt: 'May 20, 2026', updatedAt: 'Jun 4, 2026', process: 'P2P', framework: 'SOX ICFR', risks: 9, controls: 24, mappedRisks: 9, unmappedRisks: 0, keyControls: 6, workflowCoverage: 92, attributesCoverage: 88, isValidated: true, linkedToEngagement: true },
  { id: 'racm-002', name: 'FY26 O2C: Order to Cash RACM', version: 'v2.1', createdAt: 'May 15, 2026', updatedAt: 'Jun 1, 2026', process: 'O2C', framework: 'SOX ICFR', risks: 7, controls: 18, mappedRisks: 7, unmappedRisks: 0, keyControls: 5, workflowCoverage: 80, attributesCoverage: 75, isValidated: true, linkedToEngagement: false },
  { id: 'racm-003', name: 'FY26 R2R: Financial Close', version: 'v2.1', createdAt: 'Apr 28, 2026', updatedAt: 'May 22, 2026', process: 'R2R', framework: 'SOX ICFR', risks: 11, controls: 31, mappedRisks: 10, unmappedRisks: 1, keyControls: 8, workflowCoverage: 85, attributesCoverage: 80, isValidated: true, linkedToEngagement: true },
  // S2C intentionally has NO seed RACM — it's the "from scratch" demo process whose
  // RACM tab shows the empty state + Create RACM flow. (Was racm-004 Contract Review.)
  { id: 'racm-005', name: 'FY26 ITGC: Access & Change', version: 'v2.1', createdAt: 'Mar 30, 2026', updatedAt: 'May 8, 2026', process: 'ITGC', framework: 'ISO 27001', risks: 6, controls: 15, mappedRisks: 6, unmappedRisks: 0, keyControls: 5, workflowCoverage: 100, attributesCoverage: 100, isValidated: true, linkedToEngagement: true },
];

/**
 * RACMs surfaced in the P2P RACM tab so the list mirrors the "RACM Ready" SOPs in
 * the SOP section — each shares its source SOP's name (sop-102/104/105). Injected
 * through the RacmListTable `extraRacms` prop (NOT the global RACM_SEED_DATA), so
 * Audit Planning and every other RACM consumer stay untouched. Badge state is a
 * deliberate mix: Sample SOP + Agrawal Metals read as fully Ready (Active · Ready),
 * while Testing RACM is mapped but still Workflow Missing.
 */
export const P2P_RACM_READY_RACMS: RacmEntry[] = [
  { id: 'RACM-102', name: 'Sample SOP', version: 'v1.0', createdAt: 'May 28, 2026', updatedAt: 'Jun 6, 2026', process: 'P2P', framework: 'SOX ICFR', risks: 6, controls: 16, mappedRisks: 6, unmappedRisks: 0, keyControls: 4, workflowCoverage: 100, attributesCoverage: 100, isValidated: true, linkedToEngagement: false },
  { id: 'RACM-104', name: 'Testing RACM (4)_RACM', version: 'v1.0', createdAt: 'May 12, 2026', updatedAt: 'May 30, 2026', process: 'P2P', framework: 'SOX ICFR', risks: 8, controls: 20, mappedRisks: 8, unmappedRisks: 0, keyControls: 5, workflowCoverage: 80, attributesCoverage: 100, isValidated: false, linkedToEngagement: false },
  { id: 'RACM-105', name: 'Agrawal Metals - Part 1 - Fixed Assets - SOP', version: 'v1.0', createdAt: 'Apr 30, 2026', updatedAt: 'May 25, 2026', process: 'P2P', framework: 'SOX ICFR', risks: 7, controls: 19, mappedRisks: 7, unmappedRisks: 0, keyControls: 5, workflowCoverage: 100, attributesCoverage: 100, isValidated: true, linkedToEngagement: false },
];

export const P2P_RACM_READY_IDS = new Set(P2P_RACM_READY_RACMS.map(r => r.id));

/** Every seeded RACM the Process Hub shows, across all processes. */
export const PROCESS_HUB_RACMS: RacmEntry[] = [...RACM_SEED_DATA, ...P2P_RACM_READY_RACMS];

/**
 * The matrices the Process Hub's RACM tab lists for one process, keyed by the
 * process abbreviation ('P2P', 'O2C', …) — the same key the tab filters on.
 * Excludes user-created RACMs, which are runtime state, not seeded records.
 */
export function processHubRacms(abbr: string): RacmEntry[] {
  return PROCESS_HUB_RACMS.filter(r => r.process === abbr);
}
