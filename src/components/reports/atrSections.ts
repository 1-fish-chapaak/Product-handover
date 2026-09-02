// ATR document section keys + labels. Kept in their own module so AtrDocument.tsx
// only exports a component (React Fast Refresh requirement).

export type AtrSectionKey = 'summary' | 'process' | 'details' | 'insights';

export const ATR_SECTION_ORDER: AtrSectionKey[] = ['summary', 'process', 'details', 'insights'];

export const ATR_SECTION_LABEL: Record<AtrSectionKey, string> = {
  summary: 'Executive Summary',
  process: 'Observation Wise Summary',
  details: 'Observation Details',
  insights: 'Key Insights & Recommendations',
};
