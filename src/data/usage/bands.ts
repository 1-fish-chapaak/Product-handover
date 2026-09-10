/**
 * How hard a piece of work was, decided once and kept.
 *
 * Value is a band's manual timing minus what the run itself took, so the band
 * is the join between a row and a stopwatch. It has to be resolved from what
 * the row carried AT THE MOMENT IT RAN and written down there and then. If the
 * page worked the band out at read time, moving a threshold next quarter would
 * silently reband a year of history and every figure ever quoted off this page
 * would change under the reader.
 *
 * So: this module takes the four signals a turn already carries, returns a
 * band, and `metering.ts` stamps the answer onto the row as it builds it.
 * Nothing downstream re-derives it.
 *
 * The thresholds are deliberately coarse. Three bands is what a stopwatch can
 * actually cover: nine sittings, not ninety. A finer scale would need timings
 * nobody is ever going to take, and an untimed band is worth nothing.
 */

export type WorkBand = 'high' | 'medium' | 'low';

/* ──────────────────────────────────────────────────────────────────────────
 * SIZE
 *
 * Size is which bucket **the run's own completion time** falls into. Not the
 * by-hand time, not the kind, not the workflow, not the population. Nothing
 * else decides it.
 *
 * So every kind appears in all three sizes, and the same workflow moves between
 * them from one run to the next: WF01 taking 18 minutes on Monday is large, the
 * same WF01 finishing in 3 minutes on Tuesday is small. That is the point of
 * the split. It groups work by how long the platform actually took, run by run.
 *
 * **Only successful runs are sized.** A failed or stopped run has no meaningful
 * completion time and gives back nothing, so it is counted as an activity and
 * sits in no size bucket.
 *
 * **This is a grouping, not an input, and that is what stops it being
 * circular.** The duration decides which row a run is displayed in, and it is
 * also subtracted to give the saving. Two different jobs, and only the second
 * is arithmetic: the duration never sets the by-hand time, never scales it and
 * never multiplies anything. Move every threshold and not one saving changes,
 * only which row a run is shown in.
 *
 * The size is stamped on the row when the run happens, because these thresholds
 * will be tuned and history must not silently re-bucket when they are.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Minutes ON THE PLATFORM, at or above which a run is that size.
 *
 * These were 15 and 5 when they described BY-HAND time. They describe RUN time
 * now, and runs are far quicker: across the ledger the median is 26 seconds,
 * the ninetieth percentile is 3.1 minutes and the longest run is 4.8. Against
 * 15 and 5 every run read small and the other two rows were empty.
 *
 * 3 and 1 spread the population across all three rows on the evidence there is.
 * They are a decision to revisit against real duration data, not a constant to
 * treat as settled, and `BAND_RULE_VERSION` moves whenever they do.
 */
export const SIZE_THRESHOLDS = { large: 3, medium: 1 } as const;

/** The rule, in the words the page prints. Never printed in a figure column:
 *  a threshold is not a number anyone can subtract. */
export const SIZE_RULE: Record<WorkBand, string> = {
  high: `over ${SIZE_THRESHOLDS.large} min on the platform`,
  medium: `${SIZE_THRESHOLDS.medium} to ${SIZE_THRESHOLDS.large} min on the platform`,
  low: `under ${SIZE_THRESHOLDS.medium} min on the platform`,
};

/** Which bucket a RUN'S OWN DURATION lands in. The only thing that decides
 *  size. Null where the run has no duration to read, which is the same answer
 *  a failed run gets. */
export function sizeForRunMinutes(minutes: number | null): WorkBand | null {
  if (minutes == null) return null;
  if (minutes > SIZE_THRESHOLDS.large) return 'high';
  if (minutes >= SIZE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/** Bumped whenever a threshold below moves. A row keeps the version it was
 *  banded under, so a reader can tell which rule produced which history. */
export const BAND_RULE_VERSION = 'v2';

/** When this rule started stamping rows. Nothing before it was banded live. */
export const BAND_RULE_FROM = '2026-01-01';




const BAND_LABELS: Record<WorkBand, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function bandLabel(band: WorkBand): string {
  return BAND_LABELS[band];
}

export const BAND_ORDER: WorkBand[] = ['high', 'medium', 'low'];

/** The same three bands in words a reader who has never heard of a band can
 *  use. Every visible surface says it this way; `bandLabel` is for debugging
 *  and for column headers where the plain word would not fit. */
const BAND_PLAIN: Record<WorkBand, string> = {
  high: 'Large',
  medium: 'Medium',
  low: 'Small',
};

export function bandPlain(band: WorkBand): string {
  return BAND_PLAIN[band];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Saying the rule out loud
 * ────────────────────────────────────────────────────────────────────────── */


