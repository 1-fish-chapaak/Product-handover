// Single source of truth for the user's "Recent Chats" and "Favourites" lists
// surfaced in any chat/data picker (Dashboard's AddDataModal + CreateDashboardModal,
// Reports' AddQueryModal). Keeping one canonical history avoids the same UI surface
// returning different items depending on entry point.

export type QueryGroup = { group: string; items: string[] };

export const QUERY_SESSIONS: QueryGroup[] = [
  {
    group: 'TODAY',
    items: [
      'Detect duplicate invoice entries across vendors',
      'Show unauthorized vendor master changes — last 90 days',
    ],
  },
  {
    group: 'YESTERDAY',
    items: [
      'Risk identification across P2P, O2C, R2R, S2C processes',
      'What is the average order value by product category?',
    ],
  },
  {
    group: 'LAST 7 DAYS',
    items: [
      'Mitigation strategy effectiveness — partially mitigated high risks',
      'Control testing results — effectiveness across 87 controls',
      'Workflow execution performance — runs and accuracy',
      'Compare Q1 vs Q2 performance metrics',
      'Exception trend analysis — flagged vs resolved',
      'Board-level GRC posture summary',
    ],
  },
];

export const FAVOURITES: QueryGroup[] = [
  {
    group: '',
    items: [
      'Duplicate invoice detection summary',
      'Unauthorized vendor master changes — quarterly review',
      'Risk register — 12 critical risks across processes',
      'Control testing — effective vs requires remediation',
      'GRC posture for board reporting',
      'Monthly revenue breakdown by region',
    ],
  },
];
