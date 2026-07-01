// Shared, non-component pieces of the section review canvas — the evidence model
// and the canvas section shape. Kept out of the .tsx so the component file exports
// only components (React Fast Refresh stays intact).

import type { SectionKind } from './reportShared';

// The badge is grounded in the kind of evidence the detector actually has: an
// explicit styled heading, a heading inferred from size, a possible fragment, or a
// section added after the fact. Honest labels beat a confidence colour we can't
// back up (§4 checklist).
export type Evidence = 'explicit' | 'inferred' | 'fragment' | 'added';

/** A section on the review canvas. `source` (the body lines beneath the heading)
 *  is present only for sections that came from the document — it drives the
 *  "Show in document" jump and marks the row as detected vs added. */
export interface CanvasSection {
  id: string;
  name: string;
  evidence: Evidence;
  source?: string[];
  /** Block type — text (a heading) or a kpi/chart/table placeholder. Absent = text. */
  kind?: SectionKind;
  /** For KPI/table placeholders — the label the block carried in the document. */
  metric?: string;
}

export const EVIDENCE_META: Record<Evidence, { label: string; dot: string; tint: string; text: string; flag: boolean }> = {
  explicit: { label: 'Explicit heading', dot: 'bg-compliant-500', tint: 'bg-compliant-50 text-compliant-700', text: 'text-compliant-700', flag: false },
  inferred: { label: 'Inferred — review', dot: 'bg-mitigated-500', tint: 'bg-mitigated-50 text-mitigated-700', text: 'text-mitigated-700', flag: true },
  fragment: { label: 'Possible fragment', dot: 'bg-high-500', tint: 'bg-high-50 text-high-700', text: 'text-high-700', flag: true },
  added: { label: 'Added for type', dot: 'bg-brand-500', tint: 'bg-brand-50 text-brand-700', text: 'text-brand-700', flag: false },
};

