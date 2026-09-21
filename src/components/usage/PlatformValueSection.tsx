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
import { ChevronDown, ChevronRight, IndianRupee, Timer } from 'lucide-react';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { ACTORS } from '../../data/usage/seed';
import {
  RATE_CARD_AS_OF,
  USAGE_TURNS,
  billedIn,
  turnKindLabel,
} from '../../data/usage/metering';
import { SIZE_RULE, bandPlain } from '../../data/usage/bands';
import {
  HOURS_PER_DAY,
  LOOKUP_TIMINGS,
  SETUP_TIMINGS,
  formatRupees,
} from '../../data/usage/timings';
import { resolveTiming, type TimingKind } from '../../data/usage/timingStore';
import {
  netOf,
  rollUp,
  timingTargetFor,
  valueTurn,
  scopeTurns,
  toCsv,
  workNoun,
  worstNet,
  type UnvaluedGroup,
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
      {/* One header row. "Per run" was repeated on three of the four figure
          columns, which ate the width and pushed the word that tells them apart
          onto a second line. The figures carry their own unit instead: minutes
          for a run, hours for the total. */}
      <div
        className={`${SIZE_GRID} items-end border-b border-canvas-border px-5 py-2 text-[0.6875rem] font-semibold uppercase leading-snug tracking-wide text-ink-400`}
      >
        <span>Size</span>
        <span className="text-right">Success runs</span>
        <span className="text-right">
          By hand <span className="inline-flex translate-y-[2px]">{notes.byHand}</span>
        </span>
        <span className="text-right">
          On the platform <span className="inline-flex translate-y-[2px]">{notes.onPlatform}</span>
        </span>
        <span className="text-right">
          Time saved <span className="inline-flex translate-y-[2px]">{notes.saved}</span>
        </span>
        <span className="text-right">
          Total saved <span className="inline-flex translate-y-[2px]">{notes.savedAll}</span>
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

  /* WHAT THE TIME IS WORTH, priced off the HOURS PRINTED BESIDE IT.
     The PRD's own formula for this tile is hours times the auditor rate, and
     taking it off the unrounded minutes instead put ₹1,13,167 next to "226
     hours × ₹500", which is ₹1,13,000. Every rupee figure on the page that
     starts from what the time is worth uses this one, so a reader can multiply
     the first tile by the rate and land on the second, then subtract the bill
     and land on the third. */
  const worthShown = Math.floor(r.hours_returned) * (r.rate?.value ?? 0);

  /* ONE RUN, and every panel prices from it.
     A middle-of-the-road run by what it gave back, with a name of its own and a
     platform time that does not round to nought, so the subtraction on it is
     one a reader can actually see and redo. */
  const oneRun = (() => {
    const priced = rows
      .map(valueTurn)
      .filter(v => v.returned_minutes != null && (v.manual_minutes ?? 0) > 0)
      .sort((a, b) => (a.returned_minutes ?? 0) - (b.returned_minutes ?? 0));
    const named = priced.filter(v => v.turn.workflow_name);
    const shows = named.filter(v => wholeMinutes(v.run_minutes) >= 1);
    const pool = shows.length > 0 ? shows : named.length > 0 ? named : priced;
    const v = pool[Math.floor(pool.length / 2)];
    if (!v) return null;
    const byHand = Math.round(v.manual_minutes ?? 0);
    const onPlatform = wholeMinutes(v.run_minutes);
    const saved = Math.max(0, byHand - onPlatform);
    const rate = r.rate?.value ?? 0;
    const record = resolveTiming(
      v.turn.surface as TimingKind,
      null,
      timingTargetFor(v.turn),
      v.turn.created_at.slice(0, 10),
    );
    return {
      name: v.turn.workflow_name ?? workNoun(v.turn.surface, false),
      kind: workNoun(v.turn.surface, false),
      sample: record?.sample ?? 0,
      whatWasTimed: record?.whatWasTimed ?? '',
      byHand,
      onPlatform,
      saved,
      /** Every figure this run produces is a rupee figure. */
      byHandWorth: Math.floor((byHand / 60) * rate),
      onPlatformWorth: Math.floor((onPlatform / 60) * rate),
      worth: Math.floor((saved / 60) * rate),
      cost: Math.round((v.model_cost_inr ?? 0) + (v.lookup_cost_inr ?? 0)),
    };
  })();

  /** The inputs that ONE calculation used, and nothing else. This was every
   *  timing on file, seventeen rows, when the line above it uses one. */
  const oneRunInputs = () =>
    oneRun
      ? [
          {
            label: 'By hand',
            value: `${count(oneRun.byHand)} min`,
            source: `Estimated, not yet timed. A sitting of ${plural(oneRun.sample, 'auditor')} would replace it. ${oneRun.whatWasTimed}`,
          },
          {
            label: 'On the platform',
            value: `${count(oneRun.onPlatform)} min`,
            source: 'Recorded on the run itself, the same duration Usage and cost lists for this row.',
          },
          rateInput,
        ]
      : [rateInput];

  /** ONE calculation, on one run, in rupees. Every panel shows this and
   *  nothing else: a reader who can redo one row can believe the totals. */
  const oneSum = (line: (x: NonNullable<typeof oneRun>) => string): WorkingLine[] =>
    oneRun ? [line(oneRun)] : ['Nothing in view has both a timing and a bill.'];


  /* ── The four headline figures ─────────────────────────────────────────── */

  const hoursNote: Note = {
    counts:
      'Finished activities whose own piece of work has a timing. A failed or stopped run gives nothing back. An untimed one still counts as an activity and is left at zero.',
    working: oneSum(x => `One run of ${x.name}: ${count(x.byHand)} min by hand less ${count(x.onPlatform)} min on the platform is ${count(x.saved)} min, which at ${rateText.replace(' an hour', '')} an hour is ${formatRupees(x.worth)}.`),
    inputs: oneRunInputs(),
  };

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

  /* WHERE 226 COMES FROM, as the table it actually is.
     Every other shape of this leaned on something a reader could not see: a
     total of 247 estimates, or an average blended across kinds that are nothing
     alike. This is the same six columns the page prints below, so the figures
     can be read across and added down. */
  const hoursTable = {
    head: ['Size', 'Runs', 'By hand', 'Platform', 'Saved', 'Total'],
    rows: r.by_band.map(b => {
      const byHand = wholeMinutes(b.succeeded ? b.manual_minutes / b.succeeded : 0);
      const onPlatform = wholeMinutes(b.succeeded ? b.run_minutes / b.succeeded : 0);
      return [
        bandPlain(b.band),
        count(b.succeeded),
        `${count(byHand)} min`,
        `${count(onPlatform)} min`,
        `${count(Math.max(0, byHand - onPlatform))} min`,
        `${count(bandHours.get(b.band) ?? 0)} hrs`,
      ];
    }),
  };

  const worthNote: Note = {
    counts:
      'The time given back, priced at the rate finance uses for an auditor hour on the day each activity ran.',
    working: oneSum(x => `One run of ${x.name} gave back ${count(x.saved)} min. ${count(x.saved)} ÷ 60 × ${rateText.replace(' an hour', '')} = ${formatRupees(x.worth)}.`),
    inputs: [
      rateInput,
      {
        label: 'Time given back',
        value: `${hoursText(r.hours_returned)} hours`,
        table: hoursTable,
      },
    ],
  };

  /* The last column is the table's only total and the only figure that feeds
     the headline, so it carries the panel that says which direction the
     derivation runs: summed run by run first, the per-run figures divided out
     of it afterwards. An average is shown here, never used. */
  const savedAllNote: Note = {
    counts: 'The time every successful, timed run in this size gave back, added up.',
    working: oneSum(x => `One run of ${x.name}: ${count(x.byHand)} min by hand less ${count(x.onPlatform)} min on the platform is ${count(x.saved)} min, worth ${formatRupees(x.worth)}.`),
    inputs: r.by_band.map(b => ({
      label: bandPlain(b.band),
      value: `${hoursText(b.hours)} hours`,
      source: `${plural(b.succeeded, 'successful run')} with a timing.`,
    })),
  };

  /* ── Where the time came from ──────────────────────────────────────────── */

  const batchNote: Note = {
    counts:
      'Setup is pulling the population, agreeing the parameters and lining the inputs up. The platform does it once for a whole batch. By hand it is done again for every run in it, so every run after the first is setup time given back.',
    working: [
      `For each batch, the timed setup times one fewer than the runs that finished in it. Across ${plural(r.batch.batches, 'batch', 'batches')} that is ${hoursText(r.batch.hours)} hours, worth ${formatRupees(Math.floor(r.batch.hours * (r.rate?.value ?? 0)))} at ${rateText}.`,
    ],
    inputs: SETUP_TIMINGS.map(t => ({
      label: `Setting up ${t.workflow_id.replace('wf-', '').replace(/-/g, ' ')}`,
      value: t.minutes == null ? 'Not timed yet' : `${t.minutes} minutes`,
      source: `Estimated, not yet timed. A sitting of ${plural(t.sample ?? 0, 'auditor')} would replace it.`,
    })),
  };

  /* Both averages now carry their working. An average printed with no division
     behind it is a number a reader has to take on trust, and this one decides
     the saving. */
  const avgRunNote: Note = {
    counts: 'What the runs actually took. A recording, not a promise or a target.',
    working: oneSum(
      x =>
        `One run of ${x.name} took ${count(x.onPlatform)} min on the platform, which is ${formatRupees(x.onPlatformWorth)} of auditor time at ${rateText.replace(' an hour', '')} an hour.`,
    ),
    inputs: r.by_surface.map(x => ({
      label: workNoun(x.surface).replace(/^./, c => c.toUpperCase()),
      value: minutesText(x.avg_run_minutes),
      source: `Recorded: ${hoursText(x.run_minutes_total / 60)} hours across ${count(x.averaged_over)} activities.`,
    })),
  };

  const avgManualNote: Note = {
    counts: 'How long an auditor takes over the same piece of work, timed with a stopwatch.',
    working: oneSum(
      x =>
        `${x.name} takes an auditor ${count(x.byHand)} min by hand, which is ${formatRupees(x.byHandWorth)} at ${rateText.replace(' an hour', '')} an hour.`,
    ),
    inputs: oneRunInputs(),
  };

  const kindNote: Note = {
    counts: 'A run\u2019s by hand time less its own duration, never below zero.',
    working: oneSum(
      x =>
        `One run of ${x.name}: ${count(x.byHand)} min by hand less ${count(x.onPlatform)} min on the platform is ${count(x.saved)} min, worth ${formatRupees(x.worth)} at ${rateText.replace(' an hour', '')} an hour.`,
    ),
    inputs: oneRunInputs(),
  };

  /* Size is which bucket the by-hand time lands in, and the by-hand time hangs
     off a NAMED thing, so the panel lists the things rather than a set of
     signal thresholds. Those thresholds are gone: nothing infers a size from
     what a run happened to burn any more. */
  const sizeNote: Note = {
    counts: "How long each run took on the platform. Nothing else decides a run's size.",
    working: [
      `Large: ${SIZE_RULE.high}. Medium: ${SIZE_RULE.medium}. Small: ${SIZE_RULE.low}.`,
    ],
    inputs: [
      { label: 'Large', value: SIZE_RULE.high },
      { label: 'Medium', value: SIZE_RULE.medium },
      { label: 'Small', value: SIZE_RULE.low },
      {
        label: 'Decided',
        value: 'On the run, when it ran',
        source:
          'Stamped from its own duration at the time, so tuning a threshold cannot re-bucket a period already quoted.',
      },
    ],
  };

  /* The two figures in the loss making row have to foot against each other,
     because a reader checks them by subtracting one from the other. Taken from
     the numbers actually PRINTED, not from the raw pair. */
  const flaggedCostShown = flagged
    ? Math.round((flagged.model_cost_inr ?? 0) + (flagged.lookup_cost_inr ?? 0))
    : 0;
  const flaggedByHand = flagged ? Math.round(flagged.manual_minutes ?? 0) : 0;
  const flaggedRunShown = flagged ? wholeMinutes(flagged.run_minutes) : 0;
  const flaggedSavedShown = Math.max(0, flaggedByHand - flaggedRunShown);
  const flaggedWorthShown = Math.floor((flaggedSavedShown / 60) * (r.rate?.value ?? 0));
  const flaggedNetShown = flagged ? flaggedWorthShown - flaggedCostShown : 0;

  /* The one row the page points at to show its own sum can go the other way,
     so every figure on it carries its own working, exactly as the tiles above
     do. A section-level panel used to carry all four, which meant a reader
     checking the cost had to read past the ranking and the saving to reach it. */
  const worstWhatNote: Note | null = flagged
    ? {
        counts:
          'Every finished activity with both a timing and a bill, ranked by what it gave back less what it cost. This is the bottom of that ranking.',
        working: [
          `One run of ${flagged.turn.workflow_name ?? workNoun(flagged.turn.surface, false)} gave back ${formatRupees(flaggedWorthShown)} and cost ${formatRupees(flaggedCostShown)} to run, so it came out ${flaggedNetShown < 0 ? 'down' : 'up'} ${formatRupees(Math.abs(flaggedNetShown))}.`,
        ],
        inputs: [
          {
            label: 'Kind',
            value: workNoun(flagged.turn.surface, false).replace(/^./, c => c.toUpperCase()),
          },
          { label: 'Who ran it', value: flagged.turn.run_by_name ?? 'Started by the scheduler' },
          { label: 'Reference', value: flagged.turn.session_id.slice(0, 8) },
        ],
      }
    : null;

  const worstBackNote: Note | null = flagged
    ? {
        counts: 'The hand work this run took off an auditor, priced at the rate in force the day it ran.',
        working: [
          `${count(flaggedByHand)} min by hand less ${count(flaggedRunShown)} min on the platform is ${count(flaggedSavedShown)} min, which at ${rateText.replace(' an hour', '')} an hour is ${formatRupees(flaggedWorthShown)}.`,
        ],
        inputs: [
          {
            label: 'By hand, for this piece of work',
            value: `${count(flaggedByHand)} min`,
            source:
              'Stamped on the run when it happened, so editing the timing today would not move this figure.',
          },
          { label: 'On the platform', value: minutesText(flagged.run_minutes) },
          rateInput,
        ],
      }
    : null;

  const worstCostNote: Note | null = flagged
    ? {
        counts:
          'What this run cost: its registry lookups at catalogue price, plus its AI tokens at the published price list.',
        working: [
          `${formatRupees(Math.round(flagged.lookup_cost_inr ?? 0))} of registry lookups plus ${formatRupees(Math.round(flagged.model_cost_inr ?? 0))} of AI is ${formatRupees(flaggedCostShown)}.`,
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
                value: `₹${count(r.fx.value)}`,
                setBy: r.fx.setBy,
                setOn: dateText(r.fx.setOn),
                source: r.fx.source,
              }
            : { label: 'Dollars to rupees', value: 'No rate on file' },
        ],
      }
    : null;

  const worstNetNote: Note | null = flagged
    ? {
        counts: 'What this run gave back, less what it cost to run.',
        working: [
          `${formatRupees(flaggedWorthShown)} given back less ${formatRupees(flaggedCostShown)} to run is ${flaggedNetShown < 0 ? '−' : ''}${formatRupees(Math.abs(flaggedNetShown))}.`,
        ],
        inputs: [
          { label: 'What it gave back', value: formatRupees(flaggedWorthShown) },
          { label: 'What it cost', value: formatRupees(flaggedCostShown) },
        ],
      }
    : null;

  /* Everything the Bulk runs section used to say, opened from the bulk row in
     the size table instead. A batch is a fact about bulk runs, so it belongs
     under them rather than in a section of its own further down the page. */
  const bulkNote: Note = {
    counts: 'Activities fired together in one batch. That is how a big population gets checked in one go.',
    working: [
      `${plural(r.batch.batches, 'batch', 'batches')} held ${plural(r.batch.runs, 'run')}, of which ${count(r.batch.finished)} succeeded. One run covers one entity, so those ${count(r.batch.finished)} runs are ${count(r.batch.finished)} entities a person would have done one at a time.`,
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
  };

  const batchClockNote: Note = {
    counts:
      "How long the batches took on the clock, start to finish. The platform describing itself, never set against a person: that comparison is the time saved.",
    working: [
      `${plural(r.batch.batches, 'batch', 'batches')} took ${mins(r.batch.elapsed_minutes)} on the clock, and ${count(r.batch.finished)} of the ${count(r.batch.runs)} runs in them succeeded.`,
    ],
    inputs: [
      { label: 'Batches', value: count(r.batch.batches) },
      { label: 'Runs in them', value: count(r.batch.runs) },
    ],
  };

  const bulkDetail = (
    <div className="border-t border-canvas-border pl-[38px]">
      <p className="max-w-[74ch] px-5 pt-3 text-[0.75rem] leading-relaxed text-ink-500">
        A bulk run is sized by how long it took, like everything else. The difference is on the by
        hand side. A person does the work once per entity, so a run's by hand time is the per
        entity timing times the entities it covered: fifty vendors at four minutes each is 200
        minutes, three vendors is 12.
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
          sub="Start to finish, on the clock. This is the platform timing itself. The comparison with a person is the time saved above."
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
                } batches earn nothing. Counted here only, not in the figures above.`
              : 'Firing one batch replaces setting the job up once per run. Counted here only, not in the figures above.'
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
      ? ` Over the ${count(months.length)} months here it has run between ${hoursText(Math.min(...perPersonSpread))} and ${hoursText(Math.max(...perPersonSpread))} hours each, so a move this size is normal.`
      : '';

  const perPersonNote: Note = {
    counts:
      'The time given back over the people who actually ran something. Somebody who holds a login and ran nothing is not counted, so this is per active person, not per licence.',
    working: oneSum(x => `One run of ${x.name} gave one person back ${count(x.saved)} min, worth ${formatRupees(x.worth)}.`),
    inputs: [
      {
        label: 'Time given back',
        value: `${hoursText(r.hours_returned)} hours`,
        table: hoursTable,
      },
      { label: 'People who ran something', value: count(r.active_people) },
      { label: 'Teams they sit in', value: count(r.teams_present) },
    ],
  };

  const changeNote: Note = {
    counts:
      'Hours per active person in the latest month, against the month before. Dividing by active people stops a busier month looking better just for being bigger.',
    working:
      last && prior
        ? [
            `${hoursText(last.hours_per_person)} hours each in ${last.label.split(' ')[0]} against ${hoursText(prior.hours_per_person)} in ${prior.label.split(' ')[0]}, which is ${changeText}.`,
          ]
        : ['There is only one month in view, so there is nothing to compare against.'],
    inputs: months.map(m => ({
      label: m.label,
      value: `${hoursText(m.hours_per_person)} hours each`,
      source: `${hoursText(m.hours)} hours across ${plural(m.people, 'active person', 'active people')}.`,
    })),
  };

  /* ── What it cost ──────────────────────────────────────────────────────── */

  const costNote: Note = {
    counts:
      'What the work cost to run: AI tokens at the published price list, plus the catalogue price of the registry lookups the runs made.',
    working: oneSum(x => `One run of ${x.name} cost ${formatRupees(x.cost)} to run, against ${formatRupees(x.worth)} of auditor time it gave back.`),
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
            value: `₹${count(r.fx.value)}`,
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
  };

  const perRupeeNote: Note = {
    counts: 'The time given back, priced, against what the same work cost to run.',
    working: oneSum(x => `One run of ${x.name} gave back ${formatRupees(x.worth)} of auditor time and cost ${formatRupees(x.cost)} to run.`),
    inputs: [
      {
        label: 'Time given back',
        value: `${hoursText(r.hours_returned)} hours`,
        table: hoursTable,
      },
      rateInput,
      { label: 'Time given back, priced', value: formatRupees(worthShown) },
      {
        label: 'What it cost to run',
        value: formatRupees(Math.round(r.running_cost_inr ?? 0)),
      },
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
    r.running_cost_inr == null ? null : worthShown - Math.round(r.running_cost_inr);

  /* The auditor side of the cost bar IS the two tiles that used to sit above
     it, so it carries their panel: the hours first, then the price. */
  const gaveBackNote: Note = {
    counts: 'The hand work these runs took off an auditor, priced at the auditor hour rate.',
    working: oneSum(x => `One run of ${x.name}: ${count(x.byHand)} min by hand less ${count(x.onPlatform)} min on the platform is ${count(x.saved)} min, which at ${rateText.replace(' an hour', '')} an hour is ${formatRupees(x.worth)}.`),
    inputs: oneRunInputs(),
  };


  /* ── The page ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6 pb-8">
      <ValueScopeBar value={filters} onChange={setFilters} onDownload={download} />

      {/* The tile row is gone at company scope. "Left after running costs" was
          the gap already drawn on the cost bar below, and the coverage figure is
          the "did not price" section said as a percentage. At a narrower scope
          there is no bill and no bar, so the hours and what they are worth stay
          on a row of their own. */}
      {companyScope && netAfterCost != null ? null : (
        <div className="grid grid-cols-2 gap-3">
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
            value={formatRupees(worthShown)}
            note={worthNote}
          />
        </div>
      )}

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
            gaveBack={worthShown}
            gaveBackSub={`${hoursText(r.hours_returned)} hours, ${count(daysFreed)} days at ${HOURS_PER_DAY} hours a day`}
            gaveBackNote={<ValueNote title="Auditor time it gave back" note={gaveBackNote} />}
            total={Math.round(r.running_cost_inr ?? 0)}
            perRupee={
              r.running_cost_inr ? worthShown / Math.round(r.running_cost_inr) : null
            }
            leftOver={netAfterCost}
            ratioNote={<ValueNote title="What each ₹1 gave back" note={perRupeeNote} />}
            format={formatRupees}
          />
        </ValueSection>
      ) : null}
      <ValueSection
        title="Where the time came from"
        blurb="Large, medium or small by how long the run itself took. Every kind turns up in all three. Open one to see what made it up."
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

      {companyScope && flagged && flaggedNet != null ? (
        <ValueSection
          title="The activity that paid for itself least"
          blurb="The run that gave back least against what it cost."
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
              sub={`${count(flaggedSavedShown)} min of auditor time, at ${rateText}`}
              value={formatRupees(flaggedWorthShown)}
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
        blurb="Every activity with no timing, and why. Open a reason to see which ones."
      >
        {r.unvalued.length === 0 ? (
          <Row label="Nothing. Every activity in view has a timing." value="0" />
        ) : (
          r.unvalued.map(u => <UnvaluedRow key={u.reason} group={u} />)
        )}
      </ValueSection>
    </div>
  );
}
