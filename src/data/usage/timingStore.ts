/**
 * Where the timings actually live.
 *
 * Every figure on Platform Value is measured against a number a person had to
 * enter somewhere. Until this store existed there was no somewhere: the
 * timings were constants in a file and the information panels printed
 * "Set by Priya Singh on 3 Mar 2026" for a record that nothing had recorded.
 * That line is the most persuasive thing on the page and it was the most
 * dangerous, because it reads as evidence. A placeholder that looks like
 * evidence is worse than an empty state.
 *
 * So a timing is a RECORD now, with three rules the screen enforces.
 *
 * · **Who and when are captured, never typed.** They come from the session and
 *   the clock. A provenance line a person can type is not provenance.
 * · **Editing never overwrites.** A change is a new effective-dated record, so
 *   a figure quoted last quarter still resolves to what was in force then.
 * · **Below the minimum sample a timing saves and does not count.** A part
 *   finished sitting is worth keeping; it is not worth pricing a quarter with.
 *
 * The store seeds itself from the example tables in `timings.ts` so the page
 * has something to show, and those seeded rows carry `enteredBySomeone: false`.
 * Every surface that prints provenance has to say "example" for those rather
 * than name somebody who never sat with a stopwatch.
 */

import type { WorkBand } from './bands';
import {
  LOOKUP_TIMINGS,
  MANUAL_TIMINGS,
  MIN_SAMPLE,
  SETUP_TIMINGS,
  type LookupTiming,
  type ManualTiming,
  type SetupTiming,
} from './timings';

/** Reading a file is deliberately not here: it is a step inside answering a
 *  question or running a workflow, not an activity of its own. */
export type TimingKind =
  | 'workflow'
  | 'bulk'
  | 'chat'
  | 'sop_racm'
  | 'report'
  | 'exception'
  | 'lookup'
  | 'setup';

export const TIMING_KIND_LABELS: Record<TimingKind, string> = {
  workflow: 'Workflow run',
  bulk: 'Bulk run',
  chat: 'Question in chat',
  sop_racm: 'SOP to RACM',
  report: 'Report',
  exception: 'Exception handled',
  lookup: 'Registry lookup',
  setup: 'Workflow setup',
};

export interface TimingRecord {
  id: string;
  kind: TimingKind;
  /** Null on a lookup or a setup. */
  band: WorkBand | null;
  /** The lookup's op key or the workflow's id. Null on the three activity kinds. */
  target: string | null;
  /** The MIDDLE result across the auditors timed, not the average. */
  minutes: number;
  sample: number;
  /** One line: "a full vendor sweep, portal lookups included". This is what
   *  lets a reader judge whether the timing matches the work. */
  whatWasTimed: string;
  /** `YYYY-MM-DD`. A timing prices work done on or after this day. */
  effectiveFrom: string;
  /** CAPTURED from the session, never typed. Null on a seeded example, and the
   *  surfaces that print provenance have to say "example" rather than name
   *  somebody who never sat with a stopwatch. */
  setBy: string | null;
  /** CAPTURED from the clock, never typed. An ISO instant. */
  setOn: string | null;
  /** False on the rows this file seeds itself with. The one flag every surface
   *  checks before it prints a name. */
  enteredBySomeone: boolean;
}

/** The estimates the page runs on today. No author on any of them, because
 *  nobody produced one. */
function estimates(): TimingRecord[] {
  const out: TimingRecord[] = [];
  const from = '2026-01-01';
  MANUAL_TIMINGS.forEach((t: ManualTiming, i) => {
    if (t.minutes == null) return;
    out.push({
      id: `est-m-${i}`,
      kind: t.surface as TimingKind,
      // A timing hangs off a NAMED thing now, never off a size. Size is read
      // off the minutes when the page is drawn.
      band: null,
      target: t.target,
      minutes: t.minutes,
      sample: t.sample ?? 0,
      whatWasTimed: t.note,
      effectiveFrom: from,
      setBy: null,
      setOn: null,
      enteredBySomeone: false,
    });
  });
  LOOKUP_TIMINGS.forEach((t: LookupTiming, i) => {
    out.push({
      id: `est-l-${i}`,
      kind: 'lookup',
      band: null,
      target: t.op_key,
      minutes: t.minutes,
      sample: t.sample,
      whatWasTimed: 'One lookup in the portal, keyed in and read back out.',
      effectiveFrom: from,
      setBy: null,
      setOn: null,
      enteredBySomeone: false,
    });
  });
  SETUP_TIMINGS.forEach((t: SetupTiming, i) => {
    if (t.minutes == null) return;
    out.push({
      id: `est-s-${i}`,
      kind: 'setup',
      band: null,
      target: t.workflow_id,
      minutes: t.minutes,
      sample: t.sample ?? 0,
      whatWasTimed: 'Pulling the population, agreeing the parameters, lining the inputs up.',
      effectiveFrom: from,
      setBy: null,
      setOn: null,
      enteredBySomeone: false,
    });
  });
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The store
 *
 * Read only. Timings are configuration and no screen for entering them is in
 * scope, so this holds the seeded records and resolves them by date. It stays a
 * RECORD rather than a bare number on purpose: the minutes alone cannot be
 * challenged, while the minutes plus how many auditors were timed plus one line
 * saying what was timed can be.
 *
 * The shape is append-ready. `effectiveFrom` is on every record and
 * `resolveTiming` already picks whatever was in force on the day the activity
 * ran, so adding entries later never rewrites a period that has been quoted.
 * ────────────────────────────────────────────────────────────────────────── */

let cache: TimingRecord[] | null = null;

export function allTimings(): TimingRecord[] {
  if (!cache) cache = estimates();
  return cache;
}

function matches(r: TimingRecord, kind: TimingKind, band: WorkBand | null, target: string | null) {
  return r.kind === kind && r.band === band && r.target === target;
}

/** The record in force on a given day for one cell, or null. */
export function resolveTiming(
  kind: TimingKind,
  band: WorkBand | null,
  target: string | null,
  day: string,
): TimingRecord | null {
  // `>=`, not `>`, and the list is in the order it was appended: on a tie the
  // LAST record entered wins. Somebody who enters a timing, spots a typo and
  // enters it again the same day means the second one, and a strict `>` would
  // quietly keep the first.
  let hit: TimingRecord | null = null;
  for (const r of allTimings()) {
    if (!matches(r, kind, band, target)) continue;
    if (r.effectiveFrom > day) continue;
    if (hit === null || r.effectiveFrom >= hit.effectiveFrom) hit = r;
  }
  return hit;
}

/** Measured, and measured on enough people to price anything. */
export function recordIsUsable(r: TimingRecord | null): boolean {
  return r != null && r.sample >= MIN_SAMPLE;
}

/** Every cell the page could price, with whatever is in force today, so the
 *  screen can list them and the page can name what is still outstanding. */
export function timingsToday(): TimingRecord[] {
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Map<string, TimingRecord>();
  for (const r of allTimings()) {
    if (r.effectiveFrom > today) continue;
    const key = `${r.kind}:${r.band ?? ''}:${r.target ?? ''}`;
    const hit = seen.get(key);
    // Same tie-break as `resolveTiming`: last entered wins on an equal date.
    if (!hit || r.effectiveFrom >= hit.effectiveFrom) seen.set(key, r);
  }
  return [...seen.values()];
}
