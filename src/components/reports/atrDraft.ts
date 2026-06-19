// ─── Pending ATR draft (Manage-Exceptions round-trip) ───
// When the user chooses "Manage Exceptions First", the in-progress ATR is parked
// here so they can review exception cases and then return to finalize it with
// the same observations/meta intact.
import type { AtrReportData } from './atrTypes';

const DRAFT_KEY = 'irame.atr.pendingDraft';
const RESUME_KEY = 'irame.atr.resumeRequested';

export function saveAtrDraft(d: AtrReportData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}
export function loadAtrDraft(): AtrReportData | null {
  try { const r = localStorage.getItem(DRAFT_KEY); return r ? (JSON.parse(r) as AtrReportData) : null; } catch { return null; }
}
export function clearAtrDraft() {
  try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
}
export function hasAtrDraft(): boolean {
  try { return !!localStorage.getItem(DRAFT_KEY); } catch { return false; }
}

/** Set by the Manage-Exceptions "Return to ATR" banner; consumed by ReportsView. */
export function requestAtrResume() {
  try { localStorage.setItem(RESUME_KEY, '1'); } catch { /* ignore */ }
}
export function consumeAtrResume(): boolean {
  try { const v = localStorage.getItem(RESUME_KEY); if (v) localStorage.removeItem(RESUME_KEY); return !!v; } catch { return false; }
}
