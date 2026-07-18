// The content model — the stable intermediate between queries and a customer's
// format (PRD "Custom Report Formats", the content model).
//
//   queries  →  CONTENT MODEL  →  customer's format (a pure skin)
//
// Queries fill the findings and recommendations; the auditor fills the parts no
// query produces (objective, opinion, limitations); the format never touches
// queries — it only maps its headings to content-model *nodes*. So a second,
// different format renders the very same content model, unchanged.

import { extractFindings, type GeneratedQueryDef, type ReportFinding } from './templateQueryPool';
import { readReportData, contentTypeForCatalogId, type ReportData, type CatalogId, type ContentType, type TemplateSection } from './reportShared';
import { knownSectionFor } from './sectionSynonyms';

export type { CatalogId };

/** A recommendation, paired to the finding it addresses. */
export type Recommendation = {
  id: string;
  text: string;
  scopeArea: string;
  severity: string;
  queryId: string;
};

/** The content model a report is built from — populated once from queries +
 *  auditor input, then rendered by whatever format the customer chose. */
export type ContentModel = {
  version: 1;
  objective?: string;
  scope?: string;
  limitations?: string;
  findings: ReportFinding[];
  recommendations: Recommendation[];
  /** The overall audit opinion/rating — stated by the auditor (Conclusion section),
   *  never computed from finding counts. */
  conclusion?: string;
  background?: string;
};

/** Build the content model from the report's queries and its auditor-supplied
 *  values. Format-independent by construction: it never reads the template, so
 *  two different formats over the same queries + data get an identical model. */
export function buildContentModel(queries: GeneratedQueryDef[], data: ReportData | undefined): ContentModel {
  const findings = extractFindings(queries);
  const recommendations: Recommendation[] = findings
    .filter(f => f.recommendation)
    .map(f => ({ id: `${f.id}-r`, text: f.recommendation!, scopeArea: f.scopeArea, severity: f.severity, queryId: f.queryId }));
  return {
    version: 1,
    objective: readReportData(data, 'objective'),
    scope: readReportData(data, 'scope'),
    limitations: readReportData(data, 'limitations'),
    findings,
    recommendations,
    conclusion: readReportData(data, 'conclusion'),
    background: readReportData(data, 'background'),
  };
}

// A catalog heading (by name or synonym) → its catalog id. This is the single
// mapping behind the product's "Map to…" list: every one of the 11 catalog
// sections resolves here, so the picker, the "Map to…" dropdown, and the render
// all agree. A heading with no entry renders as prose.
const NAME_TO_NODE: Record<string, CatalogId> = {
  'Executive Summary': 'summary',
  'Findings': 'findings',
  'Recommendations': 'recommendations',
  'Appendix': 'appendix',
  'Scope': 'scope',
  'Objective': 'objective',
  'Methodology': 'methodology',
  'Limitations': 'limitations',
  'Conclusion': 'conclusion',
  'Background': 'background',
};

/** The content node a heading maps to (via the synonym list), or null when the
 *  heading has no model node and should render as prose. */
export function catalogIdFor(heading: string): CatalogId | null {
  const known = knownSectionFor(heading);
  if (!known) return null;
  return NAME_TO_NODE[known.name] ?? null;
}

/** The six-way content type a section fills as — the single resolver the renderer
 *  and the review UI share. Order: an explicit (confirmed/overridden) contentType,
 *  else the catalog id (its own or inferred from the verbatim name), else Narrative.
 *  So an unrecognised custom header always lands on Narrative, never dropped. */
export function contentTypeForSection(section: Pick<TemplateSection, 'contentType' | 'catalogId' | 'name'>): ContentType {
  if (section.contentType) return section.contentType;
  const catalogId = section.catalogId ?? catalogIdFor(section.name);
  return contentTypeForCatalogId(catalogId);
}

/** The auditor-supplied nodes that prompt for a single value and store it on
 *  reports.data (objective, conclusion, limitations). Scope / Background compose
 *  from the engagement; Management Response is per-finding (handled separately). */
export const AUDITOR_NODES: ReadonlySet<CatalogId> = new Set(['objective', 'conclusion', 'limitations']);

/** The reports.data key an auditor node stores its value under. */
export function dataKeyForNode(node: CatalogId): string | null {
  return AUDITOR_NODES.has(node) ? node : null;
}
