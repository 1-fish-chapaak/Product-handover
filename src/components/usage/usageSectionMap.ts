/**
 * Platform Usage — which section owns which area (constants only).
 *
 * Kept apart from `UsagePlatformSections.tsx` so Fast Refresh stays happy: a
 * module may export components OR constants, not both.
 *
 * This map is what makes an area ONE thing on the page. The scatter, the busiest-
 * areas ranking, the "fastest growing" finding and the twelve cards all now open
 * the same detail for the same area, and they find it through here.
 */

import type { UsageModule } from '../../data/platform-usage';

export type SectionKey =
  | 'engagements' | 'planning' | 'exceptions' | 'process-hub'
  | 'ask-ira' | 'concierge' | 'reports' | 'workflows'
  | 'risk-controls' | 'knowledge' | 'dashboards' | 'admin';

/** Each section reports on exactly one area of the product. */
export const SECTION_MODULE: Record<SectionKey, UsageModule> = {
  engagements: 'Engagements',
  planning: 'Audit Planning',
  exceptions: 'Exceptions',
  'process-hub': 'Process Hub',
  'ask-ira': 'Ask IRA',
  concierge: 'AI Concierge',
  reports: 'Reports',
  workflows: 'Workflows',
  'risk-controls': 'Risk & Controls',
  knowledge: 'Knowledge Hub',
  dashboards: 'Dashboards',
  admin: 'Admin',
};

/**
 * The inverse: which section owns a given area.
 *
 * Every area maps to exactly one section EXCEPT 'Other' — the bucket an
 * unrecognised module string falls into, which by design has no register behind
 * it. That is the one area whose drill-down stays the standalone
 * `ModuleUsageModal`, because for 'Other' the usage view is the whole truth
 * rather than half of it.
 */
export const MODULE_SECTION = Object.fromEntries(
  (Object.entries(SECTION_MODULE) as [SectionKey, UsageModule][]).map(([k, m]) => [m, k]),
) as Partial<Record<UsageModule, SectionKey>>;
