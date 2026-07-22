// ─── Lifecycle-tag presentation — shared by card + stack ────────────────────
// One source of truth for the freshness pill styling so the tag on a card and
// the matching delta-strip chip in InsightStack can never drift apart.
// (Lives outside the component files to keep react-refresh happy.)

import type { InsightFreshness } from '../../data/layeredInsights';

export const FRESHNESS_META: Record<InsightFreshness, { label: string; pill: string; dot: string }> = {
  escalated: { label: 'Escalated', pill: 'bg-risk-50 text-risk border-risk/25',                     dot: 'bg-risk' },
  new:       { label: 'New',       pill: 'bg-brand-50 text-brand-700 border-brand-200',             dot: 'bg-brand-600' },
  recurring: { label: 'Recurring', pill: 'bg-canvas text-ink-500 border-canvas-border',             dot: 'bg-ink-400' },
  resolved:  { label: 'Resolved',  pill: 'bg-compliant-50 text-compliant-700 border-compliant-200', dot: 'bg-compliant' },
};
