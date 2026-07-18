// Shared, non-component pieces of the section review canvas — the evidence model
// and the canvas section shape. Kept out of the .tsx so the component file exports
// only components (React Fast Refresh stays intact).

import type { ContentType, DataBlock } from './reportShared';

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
  /** Author-editable one-line description. Absent = fall back to the auto blurb. */
  description?: string;
  /** How this detected heading matched a known fill source (§ "Matching a
   *  detected section to a data source"). Drives the per-row match status.
   *  Absent = not yet resolved. */
  match?: SectionMatch;
  /** The auditor's confirmed / overridden content type for this heading (the
   *  six-way reframe). Set when the user picks a type in review, WITHOUT renaming —
   *  the header text stays verbatim; only the type changes. Absent = inferred from
   *  the heading name. A `narrative` override wins over any name-based inference so
   *  a header named "Findings" can still be made prose. */
  contentType?: ContentType;
  /** Whether the auditor has confirmed this section's mapping. Detected sections
   *  start unconfirmed; the import can't be saved until every section is confirmed
   *  (PRD "the user confirms every one before save. Nothing auto-applies"). Set by
   *  the per-row confirm toggle or by "Confirm all". */
  confirmed?: boolean;
  /** A section the author added by hand ("Add a section the detector missed"),
   *  not read from the document. Its name AND description are both mandatory, and
   *  it confirms itself once both are filled — no Confirm button, since the author
   *  is writing it, not reviewing a machine guess. */
  manual?: boolean;
  /** The data blocks (Table / Graph / KPI) detected inside this section, shown as
   *  placeholders in review and bound to queries at generation. */
  dataBlocks?: DataBlock[];
}

/** The outcome of matching a detected heading to a known data source. */
export type SectionMatch =
  /** Case 1 — heading is one of our named sections; fills from its known source. */
  | { kind: 'known'; source: string }
  /** Case 2 — a synonym of a known section (auditor confirms the alias once). */
  | { kind: 'synonym'; source: string; alias: string }
  /** Case 3 — a narrative section we have no query source for. */
  | { kind: 'narrative' }
  /** Case 4 — matches nothing known; the user maps, keeps as prose, or deletes. */
  | { kind: 'unmatched' }
  /** Two headings resolved to the same catalog section — one source can't fill two
   *  sections, so the later one is flagged (rename it, make it custom, or delete). */
  | { kind: 'duplicate'; source: string };

export const EVIDENCE_META: Record<Evidence, { label: string; dot: string; tint: string; text: string; flag: boolean }> = {
  explicit: { label: 'Explicit heading', dot: 'bg-compliant-500', tint: 'bg-compliant-50 text-compliant-700', text: 'text-compliant-700', flag: false },
  inferred: { label: 'Inferred — review', dot: 'bg-mitigated-500', tint: 'bg-mitigated-50 text-mitigated-700', text: 'text-mitigated-700', flag: true },
  fragment: { label: 'Possible fragment', dot: 'bg-high-500', tint: 'bg-high-50 text-high-700', text: 'text-high-700', flag: true },
  added: { label: 'Added for type', dot: 'bg-brand-500', tint: 'bg-brand-50 text-brand-700', text: 'text-brand-700', flag: false },
};

