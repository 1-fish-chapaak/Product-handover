// Made-up problems, for the preview before saving.
//
// A client who has only ever seen empty boxes finds their mistakes in their
// first real report, which is months later. Three invented findings printed
// through their own template turn "wrong columns" into a minute-five problem.
//
// Every value in here is obviously invented and says so. It is never saved,
// never exported and never reaches a report: it exists for one screen.

import type { ReportFacts } from './templateBinding';
import type { CardFinding } from '../TemplateBlockBody';
import type { ScaleMap } from '../reportShared';

const MADE_UP: CardFinding[] = [
  {
    title: 'Vendor bank details changed without approval',
    severity: 'high',
    narrative: 'Made-up example. Bank details on 12 vendor master records were changed without a second approval, so a payment could be redirected without anyone noticing.',
    recommendation: 'Made-up example. Require a second approver on every bank-detail change and review the 12 records above.',
    counts: { total: '12', open: '9', closed: '3' },
    evidence: {
      title: 'Vendor bank changes',
      columns: ['Vendor', 'Changed on', 'Changed by', 'Approved by'],
      rows: [
        ['Example Supplies Ltd', '04 Apr 2026', 'A. Example', 'None'],
        ['Sample Logistics', '11 Apr 2026', 'B. Sample', 'None'],
        ['Placeholder Traders', '19 Apr 2026', 'A. Example', 'None'],
      ],
    },
  },
  {
    title: 'Journals posted outside the approval window',
    severity: 'medium',
    narrative: 'Made-up example. 34 journals were posted after the period close, past the window the policy allows.',
    recommendation: 'Made-up example. Lock posting at close and route late journals through a named approver.',
    counts: { total: '34', open: '20', closed: '14' },
    evidence: {
      title: 'Late journals',
      columns: ['Journal', 'Posted on', 'Posted by', 'Value'],
      rows: [
        ['JV-1041', '02 May 2026', 'C. Example', '48,200'],
        ['JV-1077', '03 May 2026', 'C. Example', '9,500'],
      ],
    },
  },
  {
    title: 'Access reviews recorded late',
    severity: 'low',
    narrative: 'Made-up example. Two quarterly access reviews were signed off after their due date.',
    recommendation: 'Made-up example. Diary the review a fortnight before it is due.',
    counts: { total: '2', open: '1', closed: '1' },
  },
];

/**
 * The report facts the preview draws with: three invented findings, one per
 * rating, and the counts and records that follow from them. The template's own
 * blocks read this exactly as they read a real report's data, so what the
 * preview shows is what the shape does.
 */
export function madeUpFacts(details?: { title?: string; entity?: string }, scaleMap?: ScaleMap): ReportFacts {
  const countOf = (word: string) => String(MADE_UP.filter(f => f.severity === word).length);
  const sum = (pick: (c: NonNullable<CardFinding['counts']>) => string | undefined) =>
    String(MADE_UP.reduce((total, f) => total + (f.counts ? Number(pick(f.counts) ?? 0) : 0), 0));
  return {
    findings: MADE_UP,
    // Their own rating words reach the count strips through this, the same way
    // they do in a real report.
    scaleMap,
    metrics: {
      findings: String(MADE_UP.length),
      actions: String(MADE_UP.length),
      critical: '0',
      high: countOf('high'),
      medium: countOf('medium'),
      low: countOf('low'),
      exceptions: sum(c => c.total),
      open: sum(c => c.open),
      closed: sum(c => c.closed),
      health: '38%',
    },
    categories: ['Financial risk', 'Compliance risk', 'Access risk'],
    evidence: MADE_UP.flatMap(f => (f.evidence ? [f.evidence] : [])),
    details: {
      title: details?.title ?? 'Made-up report',
      entity: details?.entity,
      date: 'Made-up date',
      period: 'Made-up period',
      reference: 'MADE-UP-01',
      preparedBy: 'Made-up author',
    },
  };
}

export const MADE_UP_FINDINGS = MADE_UP;
