/**
 * Platform Value — what the work gave back.
 *
 * Usage and cost answers what a piece of work cost to run. This tab answers
 * what it gave back, off the same rows, the same filters and the same
 * discipline: a by hand figure, a subtraction, and a floor where the evidence runs
 * out.
 *
 *   time given back = the timed manual minutes for this activity's size, less the
 *                     run's own duration
 *   what it is worth = time given back × the auditor hour rate agreed for that day
 *
 * Nothing here is estimated. Work with no timing on file adds nothing, so every
 * total is the least it could be and grows as more timings are taken.
 *
 * **The reader is an audit lead, not an analyst.** So none of our words appear
 * on screen: no turn, no surface, no band, no coverage, no uplift. A piece of
 * work is a workflow run, a question in chat or a file read; a band is how big
 * the activity was; coverage is how much of the work has a timing at all. Those
 * words are decided in `value.ts` and `bands.ts` and used everywhere, so the
 * page cannot drift back into house language one label at a time.
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, ChevronRight, Gauge, IndianRupee, Timer, Wallet } from 'lucide-react';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { ACTORS } from '../../data/usage/seed';
import {
  CHAT_TYPE_LABELS,
  RATE_CARD_AS_OF,
  USAGE_TURNS,
  billedIn,
  formatUsageAmount,
  turnKindLabel,
  type ChatType,
} from '../../data/usage/metering';
import { SIZE_RULE, bandPlain } from '../../data/usage/bands';
import {
  MIN_SAMPLE,
  HOURS_PER_DAY,
  LOOKUP_TIMINGS,
  SETUP_TIMINGS,
  formatRupees,
} from '../../data/usage/timings';
import {
  netOf,
  rollUp,
  scopeTurns,
  toCsv,
  workNoun,
  worstNet,
  type UnvaluedGroup,
  type ValueRollup,
} from '../../data/usage/value';
import ValueTile from './ValueTile';
import ValueNote, { type Note, type WorkingLine } from './ValueNote';
import ValueScopeBar, { type RangeAndScope } from './ValueScopeBar';
import ValueSection from './ValueSection';
import CostSplitBar from './CostSplitBar';
import ValueTable, { type ValueRow } from './ValueTable';

/* ── Formatting ─────────────────────────────────────────────────────────────
   A benefit rounds DOWN, everywhere, without exception. A page whose whole
   claim is that it is the least it could be cannot round that up. */

/** Hours, WHOLE. Totals reach the hundreds, where a decimal is noise, and a
 *  benefit floors rather than rounds: a page whose whole claim is that its
 *  figures are the least they could be cannot round one up. */
const hoursText = (h: number) => Math.floor(h).toLocaleString('en-IN');
/* Every VALUE figure floors. The page's whole claim is that its numbers are the
   least they could be, so a figure that rounded up would contradict the word
   "Minimum" printed in front of it. Cost figures round, because a bill is not
   a floor. The two must never be applied to the same underlying number: the
   headline tile once read ₹1,12,371 while the bar below it read ₹1,12,372, off
   by the rounding alone, and one number appearing twice with two values is the
   fastest way to lose a reader. */
const rupees = (r: number) => formatRupees(Math.floor(r));
const pct = (n: number) => `${Math.round(n * 100)}%`;
/** A whole number of minutes, for a working line. */
const mins = (m: number) => `${Math.round(m).toLocaleString('en-IN')} minutes`;
const count = (n: number) => n.toLocaleString('en-IN');
/** "1 activities" shipped once on a page whose whole argument is that it is
 *  careful with its own arithmetic. */
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;
/**
 * The unit, and there is only one of it.
 *
 * One row is an **activity**: a workflow run, a question in chat, or a file
 * read. That is the platform's own word for a thing that happened of any kind,
 * already carried by the Administration audit log, so a reader meeting it here
 * has met it before.
 *
 * It was three words for one thing before this: a metered turn on Usage and
 * cost, a piece of work in these panels, and a job in the tables. "Job" went
 * because it is not the platform's word and because auditors spend it on an
 * engagement. Not "task" either, which the home screen already spends on
 * something else.
 *
 * The kinds keep their own names, in `workNoun`: workflow runs, questions in
 * chat, file reads. Only the umbrella is one word.
 */
const activities = (n: number) => plural(n, 'activity', 'activities');

/**
 * A run's own time, and a by hand timing, are always WHOLE MINUTES.
 *
 * Not seconds and not hours. Runs live between a fraction of a minute and a few
 * minutes, so in hours they read as a fraction of one, and seconds would not
 * sit beside the by hand figure they are subtracted from. Both sides of that
 * subtraction carry the same unit or a reader cannot check it in their head.
 *
 * Decimals go too. `180 − 3 = 177` is checked at a glance and believed;
 * anything that needs a calculator is skipped, and a skipped sum has taught
 * nothing.
 *
 * Totals convert to hours ONCE, at the end of the working, never inside an
 * expression.
 */
function wholeMinutes(minutes: number): number {
  return Math.round(minutes);
}

function minutesText(minutes: number | null): string {
  if (minutes == null) return 'not timed';
  return `${count(wholeMinutes(minutes))} min`;
}

function runMinutesText(ms: number | null): string {
  return ms == null ? 'not recorded' : minutesText(ms / 60_000);
}

/** `2026-02-11` as `11 Feb 2026`, because a date nobody can read is not
 *  provenance. */
function dateText(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/* ── Shapes ───────────────────────────────────────────────────────────────── */

function Row({
  label,
  value,
  sub,
  valueSub,
  note,
}: {
  label: string;
  value: string;
  sub?: string;
  /** A qualifier on the NUMBER, printed under it on the right. It cannot go in
   *  `sub`: that sits under the label, which a reader crosses before they reach
   *  the figure, so "293 of them high risk" arrives before the 1,965 it
   *  qualifies. */
  valueSub?: string;
  note?: Note;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="min-w-0 max-w-[76ch]">
        <p className="text-[0.875rem] text-ink-800">{label}</p>
        {sub ? <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-500">{sub}</p> : null}
      </div>
      <div className="flex shrink-0 items-start gap-2">
        <div className="text-right">
          <p className="text-[0.875rem] font-semibold text-ink-900 tabular-nums">{value}</p>
          {valueSub ? <p className="mt-0.5 text-[0.75rem] text-ink-500">{valueSub}</p> : null}
        </div>
        {note ? <ValueNote title={label} note={note} /> : <span className="w-5" />}
      </div>
    </div>
  );
}

/**
 * One reason on the "did not price" list, and the activities behind it.
 *
 * A count on this list is the page admitting to a gap, and a gap nobody can
 * open is a gap nobody can check. Clicking the reason lists the activities it
 * covers, with enough of each one to go and find it on Usage and cost: when it
 * ran, who ran it, what it was, how long it took, and its reference.
 */
function UnvaluedRow({ group }: { group: UnvaluedGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-canvas"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRight
            size={13}
            className={`shrink-0 text-ink-300 transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="text-[0.875rem] text-ink-800">{group.reason}</span>
        </span>
        <span className="shrink-0 text-[0.875rem] font-semibold text-ink-900 tabular-nums">
          {activities(group.turns)}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-canvas-border bg-canvas py-1">
              {/* Fixed column widths. Left to itself the browser spreads five
                  short columns across the full width of the page, which reads
                  as five unrelated lists rather than one row. */}
              <ValueTable
                columns={[
                  { key: 'when', label: 'When', width: '7.5rem' },
                  {
                    key: 'who',
                    label: 'Who',
                    width: '10.5rem',
                    // A fixed-width cell cannot also carry `truncate`: that sets
                    // `max-width: 0`, which wins over the width and collapses
                    // the column onto the one beside it. The span truncates.
                    render: r => <span className="block truncate">{String(r.who)}</span>,
                  },
                  {
                    key: 'named',
                    label: 'Which activity',
                    truncate: true,
                    // What names this one activity apart from the others. A
                    // workflow has a name; a chat turn has a kind, which is the
                    // only thing separating one question from the next; a file
                    // read has neither, so its size and kind stand alone rather
                    // than being printed twice.
                    render: r =>
                      r.named ? (
                        <>
                          <div className="truncate text-ink-900" title={String(r.named)}>
                            {String(r.named)}
                          </div>
                          <div className="truncate text-[0.6875rem] text-ink-400">
                            {String(r.shape)}
                          </div>
                        </>
                      ) : (
                        <div className="truncate text-ink-900">{String(r.shape)}</div>
                      ),
                  },
                  { key: 'took', label: 'Took', width: '7rem', align: 'right' },
                  {
                    key: 'ref',
                    label: 'Reference',
                    width: '7rem',
                    align: 'right',
                    render: r => (
                      <span className="font-mono text-[0.6875rem] text-ink-400">
                        {String(r.ref)}
                      </span>
                    ),
                  },
                ]}
                rows={group.rows.map<ValueRow>(t => ({
                  id: String(t.id),
                  when: new Date(t.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                  who: t.run_by_name ?? 'Started by the scheduler',
                  named:
                    t.workflow_name ?? (t.surface === 'chat' ? turnKindLabel(t.turn_kind) : null),
                  shape:
                    t.by_hand_minutes == null
                      ? workNoun(t.surface, false)
                      : `${workNoun(t.surface, false)}, ${t.by_hand_minutes} min by hand`,
                  took: runMinutesText(t.duration_ms),
                  ref: `${t.session_id.slice(0, 8)}…`,
                }))}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Notes ──────────────────────────────────────────────────────────────────
   The four things behind every information icon: what it counts, how it is
   worked out with the real numbers in it, each input with who set it and when,
   and what it leaves out. Built here rather than in the data layer, because a
   note is the page's explanation of its own wording and has to move whenever
   that wording moves. */

/**
 * One run, by hand against the platform, per kind of activity.
 *
 * This is the whole calculation the page rests on, said at the scale it
 * actually happens at. The panels used to open on aggregate division
 * ("13,608 minutes ÷ 138 activities"), which is arithmetic a reader has to
 * work through before they reach the comparison they came for. A reader
 * checking these figures wants one number against one number: what a person
 * spends on one of these, and what the platform spends.
 *
 * The two figures are averages across the sizes that ran, because a kind spans
 * several. That is stated rather than hidden.
 */
function oneRunLines(r: ValueRollup): WorkingLine[] {
  return r.by_surface.flatMap<WorkingLine>(x => {
    const head = {
      heading: workNoun(x.surface).replace(/^./, c => c.toUpperCase()),
    };
    if (x.avg_manual_minutes == null || x.avg_run_minutes == null) {
      return [
        head,
        'Nothing of this kind has a by hand figure yet, so there is nothing to set it against.',
      ];
    }
    const byHand = wholeMinutes(x.avg_manual_minutes);
    const onPlatform = wholeMinutes(x.avg_run_minutes);
    return [
      head,
      `Per run, by hand: ${count(byHand)} min`,
      `Per run, recorded on the platform: ${count(onPlatform)} min`,
      `Per run, given back: ${count(byHand)} − ${count(onPlatform)} = ${count(Math.max(0, byHand - onPlatform))} min`,
    ];
  });
}

/** What a timing is attached to, in the reader's words: the named workflow or
 *  report where there is one, the kind where the kind genuinely has one job in
 *  it. Never a size — a size is an outcome of the minutes, not a label on the
 *  timing. */
function timingLabel(t: { kind: string; target: string | null }): string {
  const kind = workNoun(t.kind, false).replace(/^./, c => c.toUpperCase());
  if (!t.target) return kind;
  // A chat type is a phrase the product controls, so it reads as written
  // rather than as the slug the row stores.
  const named =
    t.kind === 'chat'
      ? (CHAT_TYPE_LABELS[t.target as ChatType] ?? t.target).toLowerCase()
      : t.target.replace(/^wf-|^rp-/, '').replace(/-/g, ' ');
  return `${kind}: ${named}`;
}

function timingInputs(r: ValueRollup) {
  return r.timings_used.map(t => ({
    label: timingLabel(t),
    value: `${t.minutes} minutes by hand`,
    // Value and the SAMPLE SIZE, which is what a reader uses to decide how much
    // the figure is worth. No name and no date: nobody has entered any of these
    // and a provenance line nothing produced is decoration.
    source: `${plural(t.sample, 'auditor')} timed, against a floor of ${MIN_SAMPLE}. ${t.whatWasTimed}`,
  }));
}

function notTimedYet(r: ValueRollup): string[] {
  if (r.unvalued.length === 0) return ['Nothing. Every activity in view has a timing.'];
  return r.unvalued.map(u => `${activities(u.turns)}: ${u.reason}`);
}

/* ── The tab ────────────────────────────────────────────────────────────────── */

/* ── The size table ──────────────────────────────────────────────────────────
   Size is the page's top-level split. Six columns: the size, the threshold that
   defines it, how many runs succeeded, and the three figures that make the sum.
   A row opens to show what made it up, in the same columns one level down, so
   the breakdown lines up under the total it belongs to instead of becoming a
   second table with its own header.

   Built as a grid rather than as `ValueTable`, because a table cannot nest a
   row inside a row and keep the columns aligned. */
const SIZE_GRID =
  'grid grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_9.5rem_8.5rem_9rem] gap-x-4 items-baseline';

interface SizeRow {
  id: string;
  size: string;
  /** Successful runs, and the only count on the row. Failed and stopped runs
   *  saved nothing, so they are not in it and not in the total. */
  succeeded: string;
  /** All three are PER RUN, in whole minutes, so a reader can do the
   *  subtraction in their head and then multiply by the count themselves. */
  byHand: string;
  onPlatform: string;
  saved: string;
  /** The row's only total, and the only figure that feeds the headline. */
  savedAll: string;
  detail?: Omit<SizeRow, 'detail'>[];
  /** Some kinds have more to say than a row. Bulk does: a batch pays its setup
   *  once and finishes its runs alongside each other, and neither fact fits in
   *  a column. It opens under the kind it belongs to. */
  more?: React.ReactNode;
}

function SizeTable({
  rows,
  notes,
}: {
  rows: SizeRow[];
  /** Every figure on the page carries a panel, and these three columns are
   *  figures. They ride in the header, as they do on `ValueTable`. */
  notes: {
    byHand: React.ReactNode;
    onPlatform: React.ReactNode;
    saved: React.ReactNode;
    savedAll: React.ReactNode;
  };
}) {
  const [open, setOpen] = useState<string | null>(null);
  const reduced = useReducedMotion();
  return (
    <div>
      <div
        className={`${SIZE_GRID} items-end border-b border-canvas-border px-5 py-2 text-[0.6875rem] font-semibold uppercase leading-snug tracking-wide text-ink-400`}
      >
        <span>Size</span>
        <span className="text-right">Success runs</span>
        <span className="text-right">
          Per run, by hand <span className="inline-flex translate-y-[2px]">{notes.byHand}</span>
        </span>
        <span className="text-right">
          Per run, on the platform{' '}
          <span className="inline-flex translate-y-[2px]">{notes.onPlatform}</span>
        </span>
        <span className="text-right">
          Per run, time saved <span className="inline-flex translate-y-[2px]">{notes.saved}</span>
        </span>
        <span className="text-right">
          Time saved, all runs{' '}
          <span className="inline-flex translate-y-[2px]">{notes.savedAll}</span>
        </span>
      </div>
      {rows.map(row => {
        const isOpen = open === row.id;
        const canOpen = (row.detail?.length ?? 0) > 0;
        return (
          <div key={row.id} className="border-b border-canvas-border last:border-0">
            <button
              type="button"
              disabled={!canOpen}
              onClick={() => setOpen(o => (o === row.id ? null : row.id))}
              aria-expanded={canOpen ? isOpen : undefined}
              className={`${SIZE_GRID} w-full px-5 py-3 text-left text-[0.75rem] transition-colors ${
                canOpen ? 'cursor-pointer hover:bg-canvas' : 'cursor-default'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {canOpen ? (
                  <ChevronDown
                    size={13}
                    aria-hidden
                    className={`shrink-0 text-ink-400 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`}
                  />
                ) : (
                  <span className="w-[13px]" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink-900">{row.size}</span>
                </span>
              </span>
              <span className="text-right tabular-nums text-ink-700">{row.succeeded}</span>
              <span className="text-right tabular-nums text-ink-700">{row.byHand}</span>
              <span className="text-right tabular-nums text-ink-700">{row.onPlatform}</span>
              <span className="text-right tabular-nums text-ink-700">{row.saved}</span>
              <span className="text-right font-medium tabular-nums text-ink-900">
                {row.savedAll}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && row.detail ? (
                <motion.div
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden bg-canvas"
                >
                  <p className="px-5 pt-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
                    What made up {row.size.toLowerCase()}
                  </p>
                  {row.detail.map(d => (
                    <KindRow key={d.id} d={d} />
                  ))}
                  <div className="h-2.5" />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/** One kind inside a size, in the same columns one level down. Opens where it
 *  has more to say than its row. */
function KindRow({ d }: { d: Omit<SizeRow, 'detail'> }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const canOpen = d.more != null;
  return (
    <div>
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => setOpen(o => !o)}
        aria-expanded={canOpen ? open : undefined}
        className={`${SIZE_GRID} w-full px-5 py-2 text-left text-[0.75rem] transition-colors ${
          canOpen ? 'cursor-pointer hover:bg-canvas-elevated' : 'cursor-default'
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5 pl-[22px]">
          {canOpen ? (
            <ChevronDown
              size={12}
              aria-hidden
              className={`shrink-0 text-ink-400 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
            />
          ) : (
            <span className="w-3" />
          )}
          <span className="truncate text-ink-600">{d.size}</span>
        </span>
        <span className="text-right tabular-nums text-ink-500">{d.succeeded}</span>
        <span className="text-right tabular-nums text-ink-500">{d.byHand}</span>
        <span className="text-right tabular-nums text-ink-500">{d.onPlatform}</span>
        <span className="text-right tabular-nums text-ink-500">{d.saved}</span>
        <span className="text-right tabular-nums text-ink-700">{d.savedAll}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && d.more ? (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden bg-canvas-elevated"
          >
            {d.more}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function PlatformValueSection() {
  const { can, currentUser } = useCurrentUser();

  /* The scope a reader LANDS on has to be one they are allowed to hold. A team
     lead reads their own team; defaulting everybody to the company total put
     the workspace bill in front of them before they touched a control. */
  const wideRead = can('ad_usage');
  const [filters, setFilters] = useState<RangeAndScope>(() => {
    if (wideRead) return { scope: { kind: 'company' } };
    const team = ACTORS.find(a => a.email === currentUser?.email)?.team;
    return { scope: team ? { kind: 'team', team } : { kind: 'company' } };
  });

  const rows = useMemo(() => scopeTurns(USAGE_TURNS, filters), [filters]);
  const r = useMemo(() => rollUp(rows), [rows]);

  /* One row per activity, with every column the page adds up, so a reader
     who does not believe a total can rebuild it rather than argue about it. */
  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const who =
      filters.scope.kind === 'company'
        ? 'whole-company'
        : filters.scope.kind === 'team'
          ? filters.scope.team.toLowerCase().replace(/\s+/g, '-')
          : filters.scope.email.split('@')[0];
    const when =
      filters.date_from || filters.date_to
        ? `${filters.date_from ?? 'start'}-to-${filters.date_to ?? 'end'}`
        : 'all';
    a.download = `platform-value-${who}-${when}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const flagged = useMemo(() => worstNet(rows), [rows]);

  const rateText = r.rate ? `${formatRupees(r.rate.value)} an hour` : 'no rate agreed';
  const rateInput = r.rate
    ? {
        label: 'What an auditor hour is worth',
        value: `${formatRupees(r.rate.value)} an hour`,
        setBy: r.rate.setBy,
        setOn: dateText(r.rate.setOn),
        source: `${r.rate.source}. Applies to work done from ${dateText(r.rate.from)} onwards, so a rate agreed later does not change what this period is worth.`,
      }
    : { label: 'What an auditor hour is worth', value: 'Not agreed' };

  const daysFreed = Math.floor(r.hours_returned / HOURS_PER_DAY);

  /* ── The four headline figures ─────────────────────────────────────────── */

  const hoursNote: Note = {
    counts:
      'Every activity in this period that finished and whose own named piece of work has been timed. An activity that failed or was stopped gives nothing back, and an activity with no timing on file is counted and left at zero rather than borrowing a figure from the ones beside it.',
    working: [
      `${count(r.valued_turns)} of ${activities(r.counted_turns)} have a timing.`,
      `Doing those by hand takes ${mins(r.manual_minutes_total)}.`,
      `The runs themselves took ${mins(r.run_minutes_total)}.`,
      `${mins(r.manual_minutes_total)} less ${mins(r.run_minutes_total)} is ${mins(r.manual_minutes_total - r.run_minutes_total)}, which is ${hoursText(r.hours_returned)} hours.`,
    ],
    inputs: timingInputs(r),
    omits: [
      ...notTimedYet(r),
      `The ${hoursText(r.batch.hours)} hours saved by running activities in batches, which is shown on its own further down rather than added in here.`,
    ],
  };

  const worthNote: Note = {
    counts:
      'The time given back, priced at the rate finance uses for an auditor hour on the day each activity ran.',
    working: [
      `${mins(r.manual_minutes_total - r.run_minutes_total)} given back.`,
      `${mins(r.manual_minutes_total - r.run_minutes_total)} ÷ 60 × ${rateText.replace(' an hour', '')} = ${rupees(r.value_created)}.`,
    ],
    inputs: [
      rateInput,
      {
        label: 'Time given back',
        value: `${hoursText(r.hours_returned)} hours`,
      },
    ],
    omits: [
      'This is time given back, not cash saved. Nobody is invoiced less because of it.',
      ...notTimedYet(r),
    ],
  };

  const daysNote: Note = {
    counts: 'The same time given back, said as how many days of one auditor it adds up to.',
    working: [
      `${hoursText(r.hours_returned)} hours ÷ ${HOURS_PER_DAY} hours in a working day`,
      `= ${count(daysFreed)} days of one auditor's time.`,
    ],
    inputs: [{ label: 'Hours in a working day', value: `${HOURS_PER_DAY}` }],
    omits: [
      'It does not mean anybody left. It is time the same team got back, not an activity removed.',
      ...notTimedYet(r),
    ],
  };

  const timedNote: Note = {
    counts:
      'How many of the activities in view have a timing behind them. It says whether the three figures beside it are nearly complete or barely started.',
    working: [
      `${count(r.valued_turns)} with a timing ÷ ${count(r.counted_turns)} counted`,
      `= ${pct(r.coverage)}`,
    ],
    inputs: [
      { label: 'Activities counted', value: count(r.counted_turns) },
      { label: 'Of those, with a timing', value: count(r.valued_turns) },
    ],
    omits: notTimedYet(r),
  };

  /* The last column is the table's only total and the only figure that feeds
     the headline, so it carries the panel that says which direction the
     derivation runs: summed run by run first, the per-run figures divided out
     of it afterwards. An average is shown here, never used. */
  const savedAllNote: Note = {
    counts:
      'The time given back by every successful, timed run in this size, added up. It is the only total in this table and the only figure that reaches the top of the page.',
    working: [
      { heading: 'How it is summed' },
      'Run by run: for each one, its own by hand time less its own duration, floored at zero. Never the count times an average.',
      ...r.by_band.map(
        b =>
          `${bandPlain(b.band)}: ${plural(b.succeeded, 'run')}, ${mins(b.manual_minutes)} by hand less ${mins(b.run_minutes)} on the platform = ${mins(Math.max(0, b.manual_minutes - b.run_minutes))} = ${hoursText(b.hours)} hours.`,
      ),
      { heading: 'The per-run columns' },
      'Each is this row\u2019s own total over its success runs, worked out after the sum. They are displays, so a reader can check the subtraction and multiply back up; they are never what the total is calculated from.',
    ],
    inputs: r.by_band.map(b => ({
      label: bandPlain(b.band),
      value: `${hoursText(b.hours)} hours`,
      source: `${plural(b.succeeded, 'successful run')} with a timing.`,
    })),
    omits: [
      'Runs that failed or were stopped. They saved nothing, so they are in neither the count nor the total.',
      ...notTimedYet(r),
      `The ${hoursText(r.batch.hours)} hours of setup a batch pays once, which is reported on its own.`,
    ],
  };

  /* ── Where the time came from ──────────────────────────────────────────── */

  const batchNote: Note = {
    counts:
      'Setting an activity up means pulling the population, agreeing the parameters and lining the inputs up. The platform does that once for a whole batch. By hand it is done again for every activity in it, so every activity after the first is setup time given back.',
    working: [
      `${plural(r.batch.batches, 'batch', 'batches')} holding ${plural(r.batch.finished, 'finished activity', 'finished activities')}.`,
      'For each batch: the timed setup in minutes, times one fewer than the finished runs in it.',
      `Added up: ${mins(r.batch.hours * 60)} = ${hoursText(r.batch.hours)} hours.`,
    ],
    inputs: SETUP_TIMINGS.map(t => ({
      label: `Setting up ${t.workflow_id.replace('wf-', '').replace(/-/g, ' ')}`,
      value: t.minutes == null ? 'Not timed yet' : `${t.minutes} minutes`,
      source: `${plural(t.sample ?? 0, 'auditor')} timed.`,
    })),
    omits: [
      r.batch.untimed_workflows.length
        ? `Batches of ${r.batch.untimed_workflows.join(', ')}. Nobody has timed setting that one up, so it adds nothing here.`
        : 'Nothing. Every workflow run in a batch here has a setup timing.',
      'Activities run on their own, which pay their setup once either way.',
      'This is not inside the time given back figure at the top.',
    ],
  };

  /* Both averages now carry their working. An average printed with no division
     behind it is a number a reader has to take on trust, and this one decides
     the saving. */
  const avgRunNote: Note = {
    counts:
      "What these runs actually took, recorded after the fact: this group's own run time divided by its runs. It is a recording and never a promise, a target or a service level, and it moves whenever the runs move.",
    working: oneRunLines(r),
    inputs: r.by_surface.map(x => ({
      label: workNoun(x.surface).replace(/^./, c => c.toUpperCase()),
      value: minutesText(x.avg_run_minutes),
      source: `Recorded: ${mins(x.run_minutes_total)} across ${count(x.averaged_over)} activities.`,
    })),
    omits: [
      'Runs that failed or were stopped. They never reached their normal length, so they would drag the figure down.',
      'Waiting, reviewing and signing off, none of which is recorded.',
      'Any promise about how long a run takes. Every one of these has its own time and they vary widely.',
    ],
  };

  const avgManualNote: Note = {
    counts:
      'How long one of these takes a person by hand: a stopwatch timing held against the named workflow, report or chat type. Where the work is done once per entity or control by control, it is the per unit timing times the units that run covered.',
    working: oneRunLines(r),
    inputs: timingInputs(r),
    omits: [
      'Named things with no timing on file. They are in neither figure, which is what keeps the total a floor.',
      'Any weighting by how hard the work was.',
      "The run's own duration, which decides which size row a run appears in and never what it was worth.",
    ],
  };

  const kindNote: Note = {
    counts:
      'What one run gives back: its own by hand time less its own duration, floored at zero. Every total on this page is this, summed run by run.',
    working: [
      ...oneRunLines(r),
      { heading: 'Added up' },
      ...r.by_surface.map(x =>
        x.worked_minutes == null
          ? `${workNoun(x.surface).replace(/^./, c => c.toUpperCase())}: none has a timing, so nothing to add.`
          : `${workNoun(x.surface).replace(/^./, c => c.toUpperCase())}: ${count(x.valued_turns)} runs × ${minutesText((x.avg_manual_minutes ?? 0) - (x.avg_run_minutes ?? 0))} = ${mins(x.worked_minutes)} = ${hoursText(x.hours)} hours.`,
      ),
    ],
    inputs: timingInputs(r),
    omits: [
      ...notTimedYet(r),
      'The kinds themselves, which come from where the work was started and are not a judgement about it.',
    ],
  };

  /* Size is which bucket the by-hand time lands in, and the by-hand time hangs
     off a NAMED thing, so the panel lists the things rather than a set of
     signal thresholds. Those thresholds are gone: nothing infers a size from
     what a run happened to burn any more. */
  const sizeNote: Note = {
    counts:
      "The same activities split by how long each RUN took on the platform. Nothing else decides it: not the kind, not the workflow, not the population.",
    working: [
      { heading: 'The rule, for every kind of activity' },
      `Large: ${SIZE_RULE.high}.`,
      `Medium: ${SIZE_RULE.medium}.`,
      `Small: ${SIZE_RULE.low}.`,
      { heading: 'Why every kind lands in more than one size' },
      'The same workflow moves between sizes from one run to the next, because it is that run\u2019s own time that decides the row. That is the point of the split: it groups work by how long the platform actually took, run by run.',
      { heading: 'Why this is not circular' },
      'The run\u2019s time decides which row it is shown in, and it is also subtracted to give the saving. Two different jobs, and only the second is arithmetic. The run\u2019s time never sets the by hand figure, never scales it and never multiplies anything, so moving a threshold changes which row a run appears in and not one saving.',
      { heading: 'What is not in it' },
      'No kind is pinned to a size. A bulk run is sized by how long it took, exactly like everything else.',
      'Runs that failed or were stopped. They have no meaningful completion time and gave nothing back, so they are counted as activities and sit in no size.',
    ],
    inputs: [
      { label: 'Large', value: SIZE_RULE.high },
      { label: 'Medium', value: SIZE_RULE.medium },
      { label: 'Small', value: SIZE_RULE.low },
      {
        label: 'Where the size is decided',
        value: 'On the run, when it ran',
        source:
          'Stamped from that run\u2019s own duration at the time. Thresholds will be tuned, and a tuned threshold must never re-bucket a period that has already been quoted.',
      },
    ],
    omits: [
      'The by hand time, which decides the saving and never the size.',
      'How hard the work was to judge, the kind of activity, and the size of the population.',
      'Any re-sizing of older activities.',
    ],
  };

  /* The whole subtraction, on one row, in minutes.
     "Workflow runs: 55" says the platform did something 55 times and nothing
     about how long any of it took. With the two averages and the working on the
     row, a reader checks the hours where they are rather than opening a panel.
     The working uses the count WITH a timing, not the count that ran, which is
     why both are here. */
  /* The figures in the loss making sentence have to foot against each other,
     because a reader checks them by subtracting one from the other. So the net
     is taken from the two numbers actually PRINTED, not from the raw pair. */
  const flaggedCostShown = flagged
    ? Math.round((flagged.model_cost_inr ?? 0) + (flagged.lookup_cost_inr ?? 0))
    : 0;
  const flaggedNetShown = flagged ? Math.floor(flagged.value_rupees ?? 0) - flaggedCostShown : 0;

  /* The one row the page points at to show its own sum can go the other way,
     so every figure on it carries its own working, exactly as the tiles above
     do. A section-level panel used to carry all four, which meant a reader
     checking the cost had to read past the ranking and the saving to reach it. */
  const worstOmits = [
    'What we charge for the platform itself, which is not counted activity by activity.',
    'Waiting, reviewing and signing off, none of which is recorded.',
  ];

  const worstWhatNote: Note | null = flagged
    ? {
        counts:
          'Every finished activity in view with both a timing and a bill, ranked by what it gave back less what it cost. This row is the bottom of that ranking.',
        working: [
          `${flagged.turn.workflow_name ?? workNoun(flagged.turn.surface, false)}, run on ${new Date(flagged.turn.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
          `It gave back ${rupees(flagged.value_rupees ?? 0)} and cost ${formatRupees(flaggedCostShown)}, so it came out ${flaggedNetShown < 0 ? 'down' : 'up'} ${formatRupees(Math.abs(flaggedNetShown))}.`,
          'Nothing else in view came out lower.',
        ],
        inputs: [
          {
            label: 'Kind',
            value: workNoun(flagged.turn.surface, false).replace(/^./, c => c.toUpperCase()),
          },
          { label: 'Who ran it', value: flagged.turn.run_by_name ?? 'Started by the scheduler' },
          { label: 'Reference', value: flagged.turn.session_id.slice(0, 8) },
        ],
        omits: [
          'Activities with no timing, which have nothing to rank.',
          'Activities that failed or were stopped. They gave nothing back, so every one of them would sit below this.',
        ],
      }
    : null;

  const worstBackNote: Note | null = flagged
    ? {
        counts:
          'The hand work this one run took off an auditor, priced at the rate in force on the day it ran.',
        working: [
          `By hand this piece of work is timed at ${flagged.manual_minutes} minutes.`,
          `The run itself took ${minutesText(flagged.run_minutes)}.`,
          `${flagged.manual_minutes} − ${(flagged.run_minutes).toFixed(1)} = ${(flagged.returned_minutes ?? 0).toFixed(1)} min.`,
          `${(flagged.returned_minutes ?? 0).toFixed(1)} ÷ 60 × ${rateText.replace(' an hour', '')} = ${rupees(flagged.value_rupees ?? 0)}.`,
        ],
        inputs: [
          {
            label: 'By hand, for this piece of work',
            value: `${flagged.manual_minutes} minutes`,
            source:
              'One flat figure for this named piece of work, stamped on the run when it happened. It does not grow with the population the run swept.',
          },
          { label: 'This run took', value: minutesText(flagged.run_minutes) },
          rateInput,
        ],
        omits: worstOmits,
      }
    : null;

  const worstCostNote: Note | null = flagged
    ? {
        counts:
          'What this one run cost to run: the registry lookups it made at their catalogue price, plus its AI tokens at the published price list.',
        working: [
          `${plural(flagged.turn.govt_calls, 'registry lookup')}, billed in rupees already: ${formatRupees(Math.round(flagged.lookup_cost_inr ?? 0))}.`,
          `The AI bill arrived as ${formatUsageAmount(flagged.model_cost_usd, 'USD')}.`,
          `At ${r.fx ? `₹${r.fx.value.toFixed(2)} to the dollar` : 'no rate on file'} that is ${formatRupees(Math.round(flagged.model_cost_inr ?? 0))}.`,
          `${formatRupees(Math.round(flagged.lookup_cost_inr ?? 0))} + ${formatRupees(Math.round(flagged.model_cost_inr ?? 0))} = ${formatRupees(flaggedCostShown)}.`,
        ],
        inputs: [
          { label: 'Registry lookups it made', value: count(flagged.turn.govt_calls) },
          {
            label: 'AI price list',
            value: `As at ${RATE_CARD_AS_OF}`,
            source:
              'Published list prices rather than what we pay under contract, so this side is a floor even where it is complete.',
          },
          r.fx
            ? {
                label: 'Dollars to rupees',
                value: `₹${r.fx.value.toFixed(2)}`,
                setBy: r.fx.setBy,
                setOn: dateText(r.fx.setOn),
                source: r.fx.source,
              }
            : { label: 'Dollars to rupees', value: 'No rate on file' },
        ],
        omits: worstOmits,
      }
    : null;

  const worstNetNote: Note | null = flagged
    ? {
        counts: 'What this run gave back, less what it cost to run.',
        working: [
          `${rupees(flagged.value_rupees ?? 0)} given back`,
          `less ${formatRupees(flaggedCostShown)} to run`,
          `= ${flaggedNetShown < 0 ? '−' : ''}${formatRupees(Math.abs(flaggedNetShown))}`,
        ],
        inputs: [
          { label: 'What it gave back', value: rupees(flagged.value_rupees ?? 0) },
          { label: 'What it cost', value: formatRupees(flaggedCostShown) },
        ],
        omits: [
          ...worstOmits,
          'The lookups are almost all of that bill, and the by hand timing is one flat figure, so this is really a statement about how long a population the run swept.',
        ],
      }
    : null;

  /* Everything the Bulk runs section used to say, opened from the bulk row in
     the size table instead. A batch is a fact about bulk runs, so it belongs
     under them rather than in a section of its own further down the page. */
  const bulkNote: Note = {
    counts:
      'Activities fired together in one batch, in this period. A batch is how a big population gets checked in one go.',
    working: [
      `${plural(r.batch.batches, 'batch', 'batches')} holding ${plural(r.batch.runs, 'run')}, of which ${count(r.batch.finished)} finished.`,
      `They took ${mins(r.batch.elapsed_minutes)} on the clock.`,
      `The same runs added up come to ${mins(r.batch.sequential_minutes)}.`,
    ],
    inputs: [
      { label: 'Batches', value: count(r.batch.batches) },
      { label: 'Runs in them', value: count(r.batch.runs) },
      { label: 'Of those, succeeded', value: count(r.batch.finished) },
      {
        label: 'How a bulk run is sized',
        value: 'By how long it took, like everything else',
        source:
          'No kind is pinned to a size. An earlier rule declared every bulk run large, which was an assumption about how people batch rather than something anybody measured.',
      },
    ],
    omits: [
      'Activities run on their own, which cover one thing each.',
      'Runs in a batch that failed or were stopped. They are counted as activities and give nothing back.',
    ],
  };

  const batchClockNote: Note = {
    counts:
      "The batch's own shape: how long the batches in view took on the clock, start to finish. This is the platform describing itself. It is never set against a person, because that comparison is already the time saved.",
    working: [
      `${plural(r.batch.batches, 'batch', 'batches')} took ${mins(r.batch.elapsed_minutes)} on the clock, start to finish.`,
      `${plural(r.batch.finished, 'run')} of the ${count(r.batch.runs)} in them succeeded.`,
    ],
    inputs: [
      { label: 'Batches', value: count(r.batch.batches) },
      { label: 'Runs in them', value: count(r.batch.runs) },
    ],
    omits: [
      'Activities run on their own, which are not in a batch.',
      'The setup a batch saves, which is a figure of its own below.',
      'Any comparison with doing the work by hand. That is the time saved on the row this opened from, and the two are not the same measure.',
    ],
  };

  const bulkDetail = (
    <div className="border-t border-canvas-border pl-[38px]">
      <p className="max-w-[74ch] px-5 pt-3 text-[0.75rem] leading-relaxed text-ink-500">
        A bulk run is sized by how long it took, exactly like everything else. What makes bulk
        different is the by hand side: a person does the work once per entity, so a run's by hand
        time is the per entity timing times the entities that run covered. Fifty vendors at four
        minutes each is two hundred minutes by hand; three vendors is twelve. The saving scales
        with the population, exactly as the cost does.
      </p>
      <div className="mt-1 divide-y divide-canvas-border border-t border-canvas-border">
        <Row label="Batches fired" value={count(r.batch.batches)} note={bulkNote} />
        <Row
          label="Runs in them"
          value={count(r.batch.runs)}
          valueSub={`${count(r.batch.finished)} succeeded`}
          note={bulkNote}
        />
        <Row
          label="How long the batches took"
          sub="Start to finish, on the clock. Not a comparison with a person: that comparison is already the time saved above."
          value={minutesText(r.batch.elapsed_minutes)}
          note={batchClockNote}
        />
        <Row
          label="Setup that never had to happen"
          sub={
            r.batch.untimed_workflows.length
              ? `Firing one batch replaces setting the job up once per run. ${r.batch.untimed_workflows.join(', ')} ${
                  r.batch.untimed_workflows.length === 1 ? 'has' : 'have'
                } no setup timing, so ${
                  r.batch.untimed_workflows.length === 1 ? 'its' : 'their'
                } batches earn nothing. Reported on its own, and not inside the headline.`
              : 'Firing one batch replaces setting the job up once per run. Reported on its own, and not inside the headline.'
          }
          value={`${hoursText(r.batch.hours)} hours`}
          note={batchNote}
        />
        {r.batch.rows.length > 0 ? (
          <ValueTable
            paginated
            columns={[
              { key: 'batch', label: 'Workflow', truncate: true },
              { key: 'runs', label: 'Runs', width: '6.5rem', align: 'right' },
              { key: 'elapsed', label: 'On the clock', width: '9rem', align: 'right' },
              { key: 'sequential', label: 'Added up', width: '9rem', align: 'right' },
              { key: 'setup', label: 'Setup avoided', width: '9rem', align: 'right' },
              {
                key: 'extra',
                label: 'Extra hours',
                width: '9rem',
                align: 'right',
                note: <ValueNote title="Every batch in view" note={batchNote} />,
              },
            ]}
            rows={r.batch.rows.map<ValueRow>((x, i) => ({
              id: `${x.workflow_name ?? 'batch'}-${i}`,
              batch: x.workflow_name ?? 'Workflow',
              runs: `${count(x.finished)} of ${count(x.runs)}`,
              elapsed: minutesText(x.elapsed_minutes),
              sequential: minutesText(x.sequential_minutes),
              setup: x.setup_minutes == null ? 'Not timed' : `${x.setup_minutes} min`,
              extra: x.extra_hours == null ? '—' : hoursText(x.extra_hours),
            }))}
          />
        ) : null}
      </div>
    </div>
  );

  /* SIZE is the top-level split, and it is the core of the page: every activity
     lands in one of three buckets by how long THAT RUN took on the platform, so
     every kind appears in all three and the same workflow moves between them
     from one run to the next.

     Every figure column is PER RUN, in whole minutes, because that is the unit
     the calculation actually happens in: by hand, less what the run took, is
     the saving. A reader multiplies by the count beside it and lands on the
     total themselves. Those per-run figures are DISPLAYS, worked out as the
     row's own total over its success runs AFTER the sum. The totals are still
     summed run by run, exactly as the calculation says; showing an average must
     never turn into calculating from one.

     No share-of-value column: the last column already carries it, and a reader
     comparing three rows does not need the same fact restated as percentages. */
  const perRun = (totalMinutes: number, runs: number) => (runs === 0 ? 0 : totalMinutes / runs);

  /* The three row totals have to ADD UP TO THE TILE. Floored one at a time they
     came to 57 + 100 + 68 = 225 against a headline of 226, and a reader who
     adds a column of three numbers and lands somewhere else stops checking
     anything on the page.
     So the whole hours are apportioned: floor each row, then hand the leftover
     hours to the rows with the largest fractions. Every row stays within one
     hour of its own figure and the column sums exactly. */
  const bandHours = (() => {
    const parts = r.by_band.map(b => ({ band: b.band, exact: b.hours }));
    const target = Math.floor(r.hours_returned);
    const floors = parts.map(p => Math.floor(p.exact));
    let left = target - floors.reduce((a, c) => a + c, 0);
    const order = parts
      .map((p, i) => ({ i, frac: p.exact - Math.floor(p.exact) }))
      .sort((a, c) => c.frac - a.frac);
    const out = new Map<string, number>();
    parts.forEach((p, i) => out.set(p.band, floors[i]));
    for (const { i } of order) {
      if (left <= 0) break;
      out.set(parts[i].band, (out.get(parts[i].band) ?? 0) + 1);
      left -= 1;
    }
    return out;
  })();
  const sizeCells = (
    x: {
      succeeded: number;
      manual_minutes: number;
      run_minutes: number;
      hours: number;
    },
    shownHours?: number,
  ) => {
    const byHand = wholeMinutes(perRun(x.manual_minutes, x.succeeded));
    const onPlatform = wholeMinutes(perRun(x.run_minutes, x.succeeded));
    return {
      succeeded: count(x.succeeded),
      byHand: `${count(byHand)} min`,
      onPlatform: minutesText(perRun(x.run_minutes, x.succeeded)),
      /* Taken from the two figures PRINTED beside it, not from the raw pair.
         This row exists to be checked in a reader's head, and a subtraction
         that does not come out is the fastest way to lose them. */
      saved: `${count(Math.max(0, byHand - onPlatform))} min`,
      savedAll: `${count(shownHours ?? Math.floor(x.hours))} hrs`,
    };
  };

  const bandRows: ValueRow[] = r.by_band.map(b => ({
    id: b.band,
    size: bandPlain(b.band),
    ...sizeCells(b, bandHours.get(b.band)),
    /* What made up this size, one level down, in the same columns. */
    detail: b.kinds.map(k => ({
      id: `${b.band}-${k.surface}`,
      size: workNoun(k.surface).replace(/^./, c => c.toUpperCase()),
      ...sizeCells(k),
      /* Bulk has more to say than a row: a batch pays its setup once, and that
         is not a column. It opens under the kind it belongs to. */
      more: k.surface === 'bulk' ? bulkDetail : undefined,
    })),
  }));

  /* ── Who got the time back ─────────────────────────────────────────────── */

  const months = r.by_month;
  const last = months[months.length - 1];
  const prior = months[months.length - 2];
  const changePct =
    last && prior && prior.hours_per_person > 0
      ? ((last.hours_per_person - prior.hours_per_person) / prior.hours_per_person) * 100
      : null;
  const changeText =
    changePct == null
      ? 'Only one month in view'
      : `${changePct > 0 ? 'up' : 'down'} ${Math.abs(changePct).toFixed(0)}%`;

  /* A month on month move means nothing on its own. What makes it readable is
     the range the figure has been running in, which the reader can see for
     themselves in the table below but should not have to work out. */
  /* "March against February" when they share a year, the full labels when they
     do not. The table underneath carries the years either way. */
  const monthPair =
    last && prior
      ? last.month.slice(0, 4) === prior.month.slice(0, 4)
        ? `${last.label.split(' ')[0]} against ${prior.label.split(' ')[0]}`
        : `${last.label} against ${prior.label}`
      : '';

  const perPersonSpread = months.map(m => m.hours_per_person).filter(h => h > 0);
  const monthSwing =
    perPersonSpread.length > 2
      ? ` Across the ${count(months.length)} months in view it has run between ${hoursText(Math.min(...perPersonSpread))} and ${hoursText(Math.max(...perPersonSpread))} hours each, so a move of this size is normal here.`
      : '';

  const perPersonNote: Note = {
    counts:
      'The time given back, divided by the people who actually ran something. Somebody who holds a login and ran nothing is not counted, so this is per active person rather than per licence.',
    working: [
      `${hoursText(r.hours_returned)} hours ÷ ${plural(r.active_people, 'person', 'people')} who ran something`,
      `= ${hoursText(r.hours_per_person)} hours each`,
    ],
    inputs: [
      {
        label: 'Time given back',
        value: `${hoursText(r.hours_returned)} hours`,
      },
      { label: 'People who ran something', value: count(r.active_people) },
      { label: 'Teams they sit in', value: count(r.teams_present) },
    ],
    omits: [
      'People who hold a login and ran nothing.',
      r.orphan_turns > 0
        ? `${plural(r.orphan_turns, 'run')} started by the scheduler rather than a person. Those count for the company and are left out of every team and personal figure.`
        : 'Nothing in view is missing the person who ran it.',
    ],
  };

  const changeNote: Note = {
    counts:
      'Hours given back per active person in the latest month in view, against the month before it. Dividing by the people who were active means a month with more people in it does not look better just for being busier.',
    working:
      last && prior
        ? [
            `${prior.label}: ${hoursText(prior.hours)} hours across ${plural(prior.people, 'person', 'people')}, so ${hoursText(prior.hours_per_person)} each.`,
            `${last.label}: ${hoursText(last.hours)} hours across ${plural(last.people, 'person', 'people')}, so ${hoursText(last.hours_per_person)} each.`,
            `That is ${changeText}.`,
          ]
        : ['There is only one month in view, so there is nothing to compare against.'],
    inputs: months.map(m => ({
      label: m.label,
      value: `${hoursText(m.hours_per_person)} hours each`,
      source: `${hoursText(m.hours)} hours across ${plural(m.people, 'active person', 'active people')}.`,
    })),
    omits: [
      'A part month at either end of the range, which reads low for being short rather than for being slow.',
      'Work with no timing, which moves month to month and is in neither figure.',
    ],
  };

  /* ── What it cost ──────────────────────────────────────────────────────── */

  /* The ratio is almost entirely a statement about how many registry lookups
     the runs made, and saying so is what stops it being read as an efficiency
     score. It used to be said on the face of the section; it is behind the
     information icon now, because breaking the platform's cost in two on the
     page competes with the only division that section is for. */
  const lookupShare =
    r.running_cost_inr && r.lookup_cost_inr ? r.lookup_cost_inr / r.running_cost_inr : null;

  const costNote: Note = {
    counts:
      'What the same work cost to run: the AI tokens at the published price list, plus the catalogue price of the registry lookups the runs actually made.',
    working: [
      `The AI bill arrived as ${formatUsageAmount(r.model_cost_usd, 'USD')}.`,
      `At ${r.fx ? `₹${r.fx.value.toFixed(2)} to the dollar` : 'no rate on file'} that is ${formatRupees(Math.round(r.model_cost_inr ?? 0))}, which is the figure the addition below uses.`,
      `Registry lookups are billed in rupees already: ${formatRupees(Math.round(r.lookup_cost_inr ?? 0))}.`,
      `Together: ${formatRupees(Math.round(r.running_cost_inr ?? 0))}.`,
      lookupShare == null
        ? 'Nothing else is in the bill.'
        : `${pct(lookupShare)} of that is registry lookups, so the bill mostly tracks how many lookups the runs make rather than how efficient the AI is.`,
      { heading: 'The auditor side' },
      'Auditor time it gave back is the hand work this took off an auditor, priced at the rate the business already uses for auditor time. It is what was given back, not what the whole job would have cost.',
      `Doing this work by hand was timed at ${mins(r.manual_minutes_total)}, which is ${rupees((r.manual_minutes_total / 60) * (r.rate?.value ?? 0))} of auditor time.`,
      `The runs themselves took ${mins(r.run_minutes_total)} of that back, so ${rupees(r.value_created)} is what was actually given back.`,
    ],
    inputs: [
      {
        label: 'AI price list',
        value: `As at ${RATE_CARD_AS_OF}`,
        source:
          'Published list prices rather than what we pay under contract, so the AI half is a floor even where it is complete.',
      },
      r.fx
        ? {
            label: 'Dollars to rupees',
            value: `₹${r.fx.value.toFixed(2)}`,
            setBy: r.fx.setBy,
            setOn: dateText(r.fx.setOn),
            source: r.fx.source,
          }
        : { label: 'Dollars to rupees', value: 'No rate on file' },
      {
        label: 'Lookup prices',
        value: `${LOOKUP_TIMINGS.length} lookups`,
        source:
          'The same price per call the run is billed at, ₹10 each except Udyam by PAN at ₹15.',
      },
    ],
    omits: [
      r.has_unpriced_model
        ? 'Work that used an AI model with no published price. Those tokens were spent and are not in this figure, so the cost is understated too.'
        : 'Nothing on the AI side. Every model in view has a price.',
      r.has_unpriced_lookup
        ? 'Lookups with no price on file.'
        : 'Nothing on the lookup side. Every lookup in view has a price.',
      'What we charge for the platform itself, which is not counted activity by activity.',
    ],
  };

  const perRupeeNote: Note = {
    counts: 'The time given back, priced, against what the same work cost to run.',
    working: [
      `${rupees(r.value_created)} given back ÷ ${formatRupees(Math.round(r.running_cost_inr ?? 0))} spent`,
      r.returned_per_rupee
        ? `= ₹${r.returned_per_rupee.toFixed(2)} back for every ₹1 spent`
        : 'Nothing in view has a price.',
    ],
    inputs: [
      { label: 'Time given back, priced', value: rupees(r.value_created) },
      {
        label: 'What it cost to run',
        value: formatRupees(Math.round(r.running_cost_inr ?? 0)),
      },
    ],
    omits: [
      'Work with no timing, which is missing from the top of the division and not the bottom, so this ratio is understated.',
      'What we charge for the platform itself, which is not counted activity by activity.',
      'Model cost is priced off published list prices rather than what we pay under contract, and any model with no price on file adds nothing, so the cost side of this is a floor too.',
      lookupShare == null
        ? 'Nothing else.'
        : `Any separation of the two costs. ${pct(lookupShare)} of the spend is registry lookups, so a run over a long population moves this number far more than the choice of AI model does.`,
    ],
  };

  const flaggedNet = flagged ? netOf(flagged) : null;

  /* What is left after the bill. The headline was three figures about the
     benefit and one about how complete it was, which is the half of the
     argument nobody attacks. A renewal conversation asks what is left after
     what it cost, so that figure sits in the headline and the days figure moves
     down into Who got the time back, where it belongs anyway.
     It needs a bill, and a bill is a company figure, so at team and personal
     scope the tile falls back rather than inventing a split. */
  // Company scope AND the workspace-wide permission. The scope bar no longer
  // offers "the whole company" to a team lead, but the gate is checked here too
  // rather than trusting a control to be the only way in.
  const companyScope = filters.scope.kind === 'company' && wideRead;
  const netAfterCost =
    r.running_cost_inr == null
      ? null
      : Math.floor(r.value_created) - Math.round(r.running_cost_inr);

  const netNote: Note = {
    counts:
      'The time given back, priced, less what the same activities cost to run. It is the figure a renewal conversation actually turns on.',
    working: [
      `${rupees(r.value_created)} given back`,
      `less ${formatRupees(Math.round(r.running_cost_inr ?? 0))} to run`,
      `= ${netAfterCost == null ? 'nothing priced' : formatRupees(netAfterCost)}`,
    ],
    inputs: [
      { label: 'Time given back, priced', value: rupees(r.value_created) },
      {
        label: 'What it cost to run',
        value: formatRupees(Math.round(r.running_cost_inr ?? 0)),
      },
      rateInput,
    ],
    omits: [
      'What we charge for the platform itself, which is not counted activity by activity. This is the running cost only.',
      'Model cost is priced off published list prices rather than what we pay under contract, and any model with no price on file adds nothing, so the cost side of this is a floor too.',
      ...notTimedYet(r),
    ],
  };

  /* The gap list read as a complaint until it said what closes it. File reads
     are 18 of 18 unpriced here, and three sittings fixes all eighteen. */
  const totalSittings = r.timing_gaps.reduce((n, g) => n + g.sittings, 0);
  const unpricedTotal = r.unvalued.reduce((n, u) => n + u.turns, 0);

  /* ── The page ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6 pb-8">
      <ValueScopeBar value={filters} onChange={setFilters} onDownload={download} />

      <div
        className={`grid grid-cols-2 gap-3 ${
          companyScope && netAfterCost != null ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}
      >
        <ValueTile
          index={0}
          icon={Timer}
          label="Auditor time given back"
          qualifier="Minimum"
          value={`${hoursText(r.hours_returned)} hours`}
          note={hoursNote}
        />
        <ValueTile
          index={1}
          icon={IndianRupee}
          label="What that time is worth"
          qualifier="Minimum"
          value={rupees(r.value_created)}
          note={worthNote}
        />
        {/* Net of cost is a company figure, so it is absent at a narrower
            scope. Nothing takes its place: auditor days used to, and auditor
            days is deliberately NOT a headline. It restates hours in a second
            unit, and a reader who has just read "43.6 hours" learns nothing
            from "5 days" beside it. It has its own section below. Three tiles
            at team and person scope is the honest row. */}
        {companyScope && netAfterCost != null ? (
          <ValueTile
            index={2}
            icon={Wallet}
            label="Left after running costs"
            qualifier="Minimum"
            value={formatRupees(netAfterCost)}
            note={netNote}
          />
        ) : null}
        <ValueTile
          index={companyScope && netAfterCost != null ? 3 : 2}
          icon={Gauge}
          label="Activities we have timed"
          value={pct(r.coverage)}
          note={timedNote}
        />
      </div>

      {filters.scope.kind === 'company' ? (
        <ValueSection
          title="What it cost to run"
          blurb="A person against the platform, on the same work."
          note={<ValueNote title="What it cost to run" note={costNote} />}
        >
          {/* One division only: the auditor on one side, the platform on the
              other. Where the platform's money went is real and it is behind
              the icon above, not a second split on the same bar competing with
              the comparison the section exists to make. */}
          <CostSplitBar
            gaveBack={Math.floor(r.value_created)}
            total={Math.round(r.running_cost_inr ?? 0)}
            perRupee={r.returned_per_rupee}
            leftOver={netAfterCost}
            ratioNote={<ValueNote title="What each ₹1 gave back" note={perRupeeNote} />}
            format={formatRupees}
          />
        </ValueSection>
      ) : null}
      <ValueSection
        title="Where the time came from"
        blurb="Every activity falls into large, medium or small by how long that run took on the platform, so every kind appears in all three. Open a size to see what made it up."
        note={<ValueNote title="How size is decided" note={sizeNote} />}
      >
        <SizeTable
          rows={bandRows as unknown as SizeRow[]}
          notes={{
            byHand: <ValueNote title="The by hand total" note={avgManualNote} />,
            onPlatform: <ValueNote title="The time on the platform" note={avgRunNote} />,
            saved: <ValueNote title="The time saved" note={kindNote} />,
            savedAll: <ValueNote title="Time saved, all runs" note={savedAllNote} />,
          }}
        />
      </ValueSection>
      <ValueSection title="Who got the time back" blurb="Per person, and whether it is moving.">
        <Row
          label="Time given back per person"
          sub={`${plural(r.active_people, 'person', 'people')} ran something, across ${plural(r.teams_present, 'team')}`}
          value={`${hoursText(r.hours_per_person)} hours`}
          note={perPersonNote}
        />
        <Row
          label="Change on the month before"
          sub={last && prior ? `${monthPair}, per person.${monthSwing}` : 'Only one month in view'}
          value={changeText}
          note={changeNote}
        />
        {months.length > 1 ? (
          <ValueTable
            columns={[
              { key: 'month', label: 'Month', truncate: true },
              {
                key: 'hours',
                label: 'Hours given back',
                width: '11rem',
                align: 'right',
              },
              {
                key: 'people',
                label: 'People who ran something',
                width: '13rem',
                align: 'right',
              },
              {
                key: 'each',
                label: 'Hours each',
                width: '9rem',
                align: 'right',
              },
            ]}
            rows={months.map<ValueRow>(m => ({
              id: m.month,
              month: m.label,
              hours: hoursText(m.hours),
              people: count(m.people),
              each: hoursText(m.hours_per_person),
            }))}
          />
        ) : null}
      </ValueSection>
      <ValueSection
        title="Auditor days freed up"
        blurb="The headline said again for a reader who thinks in people rather than in hours."
      >
        <Row
          label={`Hours given back, over an ${HOURS_PER_DAY} hour working day`}
          sub={`${hoursText(r.hours_returned)} hours ÷ ${HOURS_PER_DAY}`}
          value={`${count(daysFreed)} days`}
          note={daysNote}
        />
      </ValueSection>

      {companyScope && flagged && flaggedNet != null ? (
        <ValueSection
          title="The activity that paid for itself least"
          blurb="The same sum that shows the platform paying for itself has to be able to show an activity that did not, or neither answer is worth believing."
        >
          {/* Rows, not a paragraph. It was seventy words carrying six figures,
              and a subtraction buried in prose is one nobody checks. The three
              things the PRD asks for read down the column instead: what it gave
              back, what it cost, and the why on the cost row that produced it. */}
          <div className="divide-y divide-canvas-border">
            <Row
              label="What it was"
              sub={`${workNoun(flagged.turn.surface, false).replace(/^./, c => c.toUpperCase())} on ${new Date(
                flagged.turn.created_at,
              ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              value={flagged.turn.workflow_name ?? workNoun(flagged.turn.surface, false)}
              note={worstWhatNote!}
            />
            <Row
              label="What it gave back"
              sub={`${minutesText(flagged.returned_minutes ?? 0)} of auditor time, at ${rateText}`}
              value={rupees(flagged.value_rupees ?? 0)}
              note={worstBackNote!}
            />
            <Row
              label="What it cost"
              sub={`${plural(flagged.turn.govt_calls, 'registry lookup')} at ${formatRupees(
                Math.round(flagged.lookup_cost_inr ?? 0),
              )}, plus ${formatRupees(Math.round(flagged.model_cost_inr ?? 0))} of AI${billedIn(
                flagged.model_cost_usd,
              )}`}
              value={formatRupees(flaggedCostShown)}
              note={worstCostNote!}
            />
            <Row
              label="Net"
              value={`${flaggedNetShown < 0 ? '−' : ''}${formatRupees(Math.abs(flaggedNetShown))}`}
              note={worstNetNote!}
            />
          </div>
        </ValueSection>
      ) : null}

      <ValueSection
        title="Activities we counted but did not price"
        blurb="Every activity with no timing, and why. Open a reason to see exactly which activities it covers."
      >
        {r.unvalued.length === 0 ? (
          <Row label="Nothing. Every activity in view has a timing." value="0" />
        ) : (
          r.unvalued.map(u => <UnvaluedRow key={u.reason} group={u} />)
        )}
        {r.timing_gaps.length > 0 ? (
          <div className="px-5 py-3.5">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">
              What would close this
            </p>
            <ul className="mt-1.5 space-y-1">
              {r.timing_gaps.map(g => (
                <li
                  key={g.surface}
                  className="max-w-[78ch] text-[0.75rem] leading-relaxed text-ink-600"
                >
                  {plural(g.sittings, 'sitting')} with a stopwatch on{' '}
                  {g.names.length ? g.names.join(', ') : workNoun(g.surface)} would
                  price {activities(g.turns)} on this list.
                </li>
              ))}
            </ul>
            <p className="mt-2 max-w-[78ch] text-[0.75rem] leading-relaxed text-ink-500">
              {plural(totalSittings, 'sitting')} in all would price {count(r.untimed_turns)} of the{' '}
              {count(unpricedTotal)} here and take the figure at the top of the page from{' '}
              {pct(r.coverage)} to{' '}
              {pct((r.valued_turns + r.untimed_turns) / Math.max(1, r.counted_turns))}. The rest are
              activities that did not finish, and no timing prices those.
            </p>
          </div>
        ) : null}
      </ValueSection>
    </div>
  );
}
