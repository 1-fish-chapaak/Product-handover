/**
 * Hours returned — what a live workflow gives back to the team.
 *
 * A workflow replaces a manual test of its control. Each manual test is worth
 * a fixed number of auditor hours by the workflow's complexity, stamped once:
 *
 *   easy     0.5 h   one input file
 *   mid      1.5 h   two input files
 *   complex  3 h     three or more inputs
 *
 * …times how often the control would have been tested by hand. A daily
 * workflow on a control tested weekly earns four tests a month, not thirty —
 * credit follows the manual work replaced, not the run count.
 *
 * Where Platform Usage has a timing on file for the same workflow, that
 * timing wins (one source of truth for both screens); the complexity hours
 * are the fallback and are labelled "est." wherever they're shown.
 */
import { MANUAL_TIMINGS } from '../usage/timings';
import { CHECK_CATALOG, type CatalogEntry } from './catalog';
import { filesForEntry } from './stdFiles';

export type Complexity = 'easy' | 'mid' | 'complex';

export const COMPLEXITY_HOURS: Record<Complexity, number> = { easy: 0.5, mid: 1.5, complex: 3 };
export const COMPLEXITY_LABEL: Record<Complexity, string> = { easy: 'Easy', mid: 'Mid', complex: 'Complex' };

/** Manual tests a month the workflow stands in for, by its cadence. Daily and
 *  per-run controls are capped at a weekly manual test. */
const TESTS_PER_MONTH: Record<string, number> = {
  Daily: 4, Weekly: 4, 'Per run': 4, Monthly: 1, Quarterly: 1 / 3, Annual: 1 / 12,
};

/** Standard workflows that have a Platform Usage timing on file. */
const TIMED_TARGET: Record<string, string> = {
  'p2p-vendor-master': 'wf-vendor-master',
  'p2p-emp-vendor': 'wf-related-party',
  'p2p-dup': 'wf-duplicate-payments',
};

export function complexityOf(entry: CatalogEntry): Complexity {
  const inputs = filesForEntry(entry).length;
  return inputs >= 3 ? 'complex' : inputs === 2 ? 'mid' : 'easy';
}

export interface WorkflowValue {
  complexity: Complexity;
  /** Auditor hours one manual test takes. */
  hoursPerTest: number;
  /** 'timed' = Platform Usage's timing for this workflow; 'est.' = complexity. */
  basis: 'timed' | 'est.';
  hoursPerMonth: number;
}

export function valueOf(entry: CatalogEntry): WorkflowValue {
  const complexity = complexityOf(entry);
  const target = TIMED_TARGET[entry.key];
  const timed = target ? MANUAL_TIMINGS.find(t => t.surface === 'workflow' && t.target === target && t.minutes != null) : undefined;
  const hoursPerTest = timed?.minutes != null ? timed.minutes / 60 : COMPLEXITY_HOURS[complexity];
  const perMonth = TESTS_PER_MONTH[entry.cadence] ?? 1;
  return { complexity, hoursPerTest, basis: timed ? 'timed' : 'est.', hoursPerMonth: hoursPerTest * perMonth };
}

export function valueOfKey(key: string | undefined): WorkflowValue | undefined {
  const e = key ? CHECK_CATALOG.find(x => x.key === key) : undefined;
  return e && e.automatable ? valueOf(e) : undefined;
}

/** "4.5 h" — one decimal under 10, whole above. */
export function fmtHours(h: number): string {
  if (h <= 0) return '0 h';
  return `${h < 10 ? (Math.round(h * 10) / 10).toString() : Math.round(h).toLocaleString('en-IN')} h`;
}

/** Sum of hours/month a set of standard workflows would return once live. */
export const hoursPerMonthFor = (keys: string[]) =>
  keys.reduce((s, k) => s + (valueOfKey(k)?.hoursPerMonth ?? 0), 0);
