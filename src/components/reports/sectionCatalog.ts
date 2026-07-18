// The fixed section catalog (PRD "Custom Report Formats" — the section catalog).
//
// A format is built by picking sections from this catalog, renaming them to the
// customer's words, reordering, and adding custom / placeholder sections. Each
// catalog section maps to exactly one data source, so it can appear once — once
// picked, it leaves the picker. Only the repeatable kinds (KPI / Chart / Table)
// and Custom have no single source, so they stay pickable and can be added many
// times, each with its own binding or prose.

import type { CatalogId, SectionKind } from './reportShared';

export type CatalogEntry = {
  /** Stable picker key. */
  key: string;
  /** Display label in the picker (also the default section name). */
  label: string;
  /** The block kind this entry adds. */
  kind: SectionKind;
  /** The single content source (Once sections). Absent on repeatable kinds. */
  catalogId?: CatalogId;
  /** Repeatable entries stay in the picker; "Once" entries leave once added. */
  repeats: boolean;
  /** Icon key (SECTION_ICONS). */
  icon: string;
  /** One-line hint shown under the label. */
  hint: string;
};

// The catalog — the four standard IA data sources only (PRD "Custom Internal Audit
// Report Formats": every section maps to one of these four, or to Narrative). The
// prose sections (Introduction, Objective, Scope, Methodology, Limitations, Opinion,
// Conclusion, Background, Management Response, or anything they invented) are all
// Narrative: added by naming them in the composer, not picked from the catalog.
// Narrative is the default, so it needs no catalog entry.
export const SECTION_CATALOG: CatalogEntry[] = [
  { key: 'summary', label: 'Executive Summary', kind: 'text', catalogId: 'summary', repeats: false, icon: 'file-text', hint: 'Query-derived — the report’s query results rolled up' },
  { key: 'findings', label: 'Findings', kind: 'text', catalogId: 'findings', repeats: false, icon: 'alert-triangle', hint: 'Query-derived — each issue, by scope area' },
  { key: 'recommendations', label: 'Recommendations', kind: 'text', catalogId: 'recommendations', repeats: false, icon: 'lightbulb', hint: 'Query-derived — the fix per finding' },
  { key: 'appendix', label: 'Appendix', kind: 'text', catalogId: 'appendix', repeats: false, icon: 'book-open', hint: 'Query-derived — full outputs, samples, references' },
];

/** The catalog entries still pickable given the catalog ids already in the outline
 *  — "Once" sections whose id is used are removed; repeatable kinds always stay. */
export function pickableCatalog(usedCatalogIds: Set<CatalogId>): CatalogEntry[] {
  return SECTION_CATALOG.filter(e => e.repeats || !e.catalogId || !usedCatalogIds.has(e.catalogId));
}

/** The catalog entry for a given catalog id (for labels / uniqueness messages). */
export function catalogEntryFor(catalogId: CatalogId): CatalogEntry | undefined {
  return SECTION_CATALOG.find(e => e.catalogId === catalogId);
}
