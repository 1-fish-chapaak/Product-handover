/**
 * The blocks a person acts on today.
 *
 * PU-11 stuck runs · PU-10 reliability · PU-13 per-person outcomes ·
 * PU-14 my queue.
 *
 * These are the reason the Head of Team view exists. A team lead cannot act on
 * "the platform saved eighteen lakh". They can act on one workflow that has
 * failed four times this week with the same error, which is why the stuck block
 * opens their view and carries the engine's own words rather than a count.
 *
 * PU-13 is where the no ranking rule is enforced in code: fixed alphabetical
 * sort, no share of the team's work, no averages, and every member present
 * whether they ran anything or not.
 */

import { AlertCircle, ArrowRight, PauseCircle, XCircle } from 'lucide-react';
import { formatDate, formatDateTime } from '../../data/platform-usage';
import {
  fmtHours, fmtInt, fmtOneDp, fmtPct, fmtSpan,
  type Period, type PersonRow, type QueueItem, type ReliabilityRow, type StuckRun,
} from '../../data/platform-usage-metrics';
import { Bars, Block, DataTable, Empty, Fig, Stat, StatRow } from './usageKit';

/* ──────────────────────────────────────────────────────────────────────────
 * PU-11 — what is stuck
 * ────────────────────────────────────────────────────────────────────────── */

const STATUS_ICON = {
  failed: XCircle,
  blocked: AlertCircle,
  paused: PauseCircle,
  complete: AlertCircle,
} as const;

const STATUS_TONE: Record<string, string> = {
  failed: 'text-risk-700',
  blocked: 'text-risk-700',
  paused: 'text-mitigated-700',
};

const STATUS_WORD: Record<string, string> = {
  failed: 'failed',
  blocked: 'blocked',
  paused: 'waiting on a person',
};

/**
 * Stuck runs.
 *
 * Every failed, blocked or long paused run, with the engine's error text as the
 * engine wrote it. Nothing here is summarised, because a summarised error is an
 * error nobody can fix. Where one workflow has hit the same error more than once
 * the row says how many times, since that is one job to do rather than four.
 */
export function StuckRuns({
  stuck,
  period,
  subject,
  onOpenRuns,
}: {
  stuck: StuckRun[];
  period: Period;
  subject: string;
  onOpenRuns: () => void;
}) {
  if (stuck.length === 0) {
    return (
      <Block id="stuck" title="What is stuck" lede={null}>
        <Empty
          kind="quiet"
          title={`Nothing is stuck for ${subject}.`}
          detail="Every run in this window either finished or is still inside its first day."
        />
      </Block>
    );
  }

  const failed = stuck.filter(s => s.status === 'failed').length;
  const waiting = stuck.filter(s => s.status === 'paused').length;
  const blocked = stuck.filter(s => s.status === 'blocked').length;
  const worst = stuck.filter(s => s.repeats > 1).sort((a, b) => b.repeats - a.repeats)[0];

  return (
    <Block
      id="stuck"
      title="What is stuck"
      lede={
        <>
          <Fig>{fmtInt(stuck.length)}</Fig> runs are stuck for {subject} {period.phrase}:{' '}
          <Fig>{fmtInt(failed)}</Fig> failed
          {blocked > 0 && <>, <Fig>{fmtInt(blocked)}</Fig> blocked</>}
          {waiting > 0 && <> and <Fig>{fmtInt(waiting)}</Fig> waiting on a person for more than a day</>}.
          {worst && (
            <> One of them accounts for most of it: <Fig>{worst.workflow}</Fig> has failed{' '}
              <Fig>{fmtInt(worst.repeats)}</Fig> times with the same error, so fixing that one clears most of the queue.</>
          )}
        </>
      }
      hint="A run is stuck when it failed, was blocked, or has been waiting on a person for more than 24 hours."
      action={
        <button type="button" onClick={onOpenRuns} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline">
          Open the run history <ArrowRight size={12} />
        </button>
      }
      chart={
        <ul className="divide-y divide-canvas-border border-t border-canvas-border">
          {stuck.map(run => {
            const Icon = STATUS_ICON[run.status];
            return (
              <li key={run.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.875rem] font-medium text-ink-900">{run.workflow}</p>
                    <p className="mt-0.5 text-[0.875rem] text-ink-700 break-words">{run.error}</p>
                    <p className="mt-1 text-[0.75rem] text-ink-500">
                      {run.ranBy} · {formatDateTime(run.at)} · {run.id}
                      {run.repeats > 1 && <> · same error {fmtInt(run.repeats)} times in this window</>}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 shrink-0 text-[0.75rem] font-medium ${STATUS_TONE[run.status]}`}>
                    <Icon size={13} /> {STATUS_WORD[run.status]}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      }
      table={
        <DataTable
          head={['Workflow', 'Ran by', 'When', 'State', 'Times']}
          rows={stuck.map(run => [run.workflow, run.ranBy, formatDate(run.at), STATUS_WORD[run.status], fmtInt(run.repeats)])}
          numericFrom={4}
        />
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-10 — reliability
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Reliability by workflow, and the hours failures burned.
 *
 * Failed runs never add to what was saved. They are reported here instead, as
 * wasted machine time, which is the most honest and least flattering way to say
 * it. A workflow with no runs in the window produces no row rather than a
 * misleading zero.
 */
export function Reliability({
  rows,
  wasted,
  period,
}: {
  rows: ReliabilityRow[];
  wasted: { hours: number; runs: number };
  period: Period;
}) {
  if (rows.length === 0) {
    return (
      <Block title="Reliability by workflow" lede={null}>
        <Empty kind="quiet" title="No runs started in this window, so there is no failure rate to report." />
      </Block>
    );
  }

  const worst = rows[0];
  const clean = rows.filter(r => r.failed === 0).length;

  return (
    <Block
      title="Reliability by workflow"
      lede={
        worst.failed === 0 ? (
          <>Every workflow that ran {period.phrase} finished. Nothing failed, so nothing was wasted.</>
        ) : (
          <>
            <Fig>{worst.workflow}</Fig> is the least reliable workflow {period.phrase}, failing{' '}
            <Fig>{fmtPct(worst.failurePct)}</Fig> of its <Fig>{fmtInt(worst.total)}</Fig> runs.
            Failed runs burned <Fig>{fmtSpan(wasted.hours)}</Fig> of machine time across{' '}
            <Fig>{fmtInt(wasted.runs)}</Fig> runs, and none of it counts towards what the platform saved.
            {clean > 0 && <> <Fig>{fmtInt(clean)}</Fig> workflows did not fail once.</>}
          </>
        )
      }
      chart={
        <Bars
          rows={rows.map(r => ({
            label: r.workflow,
            value: r.failurePct,
            note: `${fmtInt(r.failed)} failed of ${fmtInt(r.total)} runs${r.failed > 0 ? `, ${fmtSpan(r.wastedHours)} lost` : ''}`,
          }))}
          format={fmtPct}
          tone="risk"
          scaleTo={100}
        />
      }
      table={
        <DataTable
          head={['Workflow', 'Runs', 'Failed', 'Failure rate', 'Hours lost']}
          rows={rows.map(r => [r.workflow, fmtInt(r.total), fmtInt(r.failed), fmtPct(r.failurePct), fmtOneDp(r.wastedHours)])}
        />
      }
      footer="Failure rate counts runs that started inside the window, so a run still going is counted where it began."
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-13 — per-person outcomes
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The team's work by outcome.
 *
 * Alphabetical, and the sort cannot be changed by a click or by a URL. No
 * shares, no ranks, no team average: "you ran 62, the team average is 51" is a
 * ranking through the back door and is banned too. Somebody with no runs still
 * appears, because leaving them out ranks them as well.
 */
export function PerPersonOutcomes({ people, period, team }: { people: PersonRow[]; period: Period; team: string }) {
  if (people.length === 0) {
    return (
      <Block title="Your team, by outcome" lede={null}>
        <Empty kind="quiet" title="Nobody is on this team yet." />
      </Block>
    );
  }

  const active = people.filter(p => p.runs > 0).length;
  const waiting = people.reduce((s, p) => s + p.waitingOnThem, 0);

  return (
    <Block
      title="Your team, by outcome"
      lede={
        <>
          <Fig>{fmtInt(active)}</Fig> of {team}'s <Fig>{fmtInt(people.length)}</Fig> members ran something{' '}
          {period.phrase}, and <Fig>{fmtInt(waiting)}</Fig> items are open against the team.
          This table is alphabetical and cannot be sorted any other way.
        </>
      }
      hint="The order is the alphabet, and it is the only order this table has."
      table={
        <DataTable
          head={['Member', 'Runs', 'Exceptions found', 'Waiting on them']}
          rows={people.map(p => [p.name, fmtInt(p.runs), fmtInt(p.exceptionsFound), fmtInt(p.waitingOnThem)])}
        />
      }
      footer="Names appear on the work they did, and the work is what is counted."
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-14 — my queue
 * ────────────────────────────────────────────────────────────────────────── */

const KIND_LABEL: Record<QueueItem['kind'], string> = {
  exception: 'Exception',
  'control test': 'Control test',
  approval: 'Approval',
  'action plan': 'Action plan',
};

/**
 * What is waiting on the reader.
 *
 * Overdue first, and each row goes straight to the thing that needs doing. This
 * is the auditor's whole reason to open the page, so it opens their view and
 * nothing else sits above it.
 */
export function MyQueue({ queue, onOpen }: { queue: QueueItem[]; onOpen: (item: QueueItem) => void }) {
  if (queue.length === 0) {
    return (
      <Block id="queue" title="Waiting on you" lede={null}>
        <Empty kind="quiet" title="You are clear." detail="Nothing is assigned to you and nothing is overdue." />
      </Block>
    );
  }

  const overdue = queue.filter(q => q.overdue).length;

  return (
    <Block
      id="queue"
      title="Waiting on you"
      lede={
        <>
          <Fig>{fmtInt(queue.length)}</Fig> {queue.length === 1 ? 'item is' : 'items are'} waiting on you
          {overdue > 0 ? <>, and <Fig>{fmtInt(overdue)}</Fig> of them {overdue === 1 ? 'is' : 'are'} past the date {overdue === 1 ? 'it' : 'they'} should have been cleared.</> : ', and everything is inside its date.'}
        </>
      }
      hint="Only your items. Nobody else's work appears anywhere on this view."
      chart={
        <ul className="divide-y divide-canvas-border border-t border-canvas-border">
          {queue.map(item => (
            <li key={`${item.kind}-${item.id}`} className="py-3">
              <button type="button" onClick={() => onOpen(item)} className="text-left w-full group">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.875rem] text-ink-900 group-hover:text-brand-700">{item.title}</p>
                    <p className="mt-0.5 text-[0.75rem] text-ink-500">
                      {KIND_LABEL[item.kind]} · {item.detail}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[0.75rem] tabular-nums ${item.overdue ? 'text-risk-700 font-medium' : 'text-ink-400'}`}>
                    {item.dueAt === null ? 'no date' : item.overdue ? `overdue, due ${formatDate(item.dueAt)}` : `due ${formatDate(item.dueAt)}`}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      }
      table={
        <DataTable
          head={['Item', 'Kind', 'Due', 'State']}
          rows={queue.map(item => [
            item.title,
            KIND_LABEL[item.kind],
            item.dueAt === null ? 'no date' : formatDate(item.dueAt),
            item.overdue ? 'overdue' : 'on track',
          ])}
          numericFrom={99}
        />
      }
    />
  );
}

/** The auditor's own three numbers, said without a comparison of any kind. */
export function MyWork({
  runs,
  failed,
  exceptions,
  openExceptions,
  hours,
  period,
}: {
  runs: number;
  failed: number;
  exceptions: number;
  openExceptions: number;
  hours: number;
  period: Period;
}) {
  return (
    <Block
      title="Your work"
      lede={
        <>
          You started <Fig>{fmtInt(runs)}</Fig> runs {period.phrase}, found{' '}
          <Fig>{fmtInt(exceptions)}</Fig> exceptions and saved <Fig>{fmtHours(hours)}</Fig> against doing the
          same work by hand.
        </>
      }
      hint="Your own numbers only. Nobody else appears anywhere on this view."
      table={
        <StatRow>
          <Stat value={fmtInt(runs)} label="Runs you started" sub={`${fmtInt(failed)} failed`} />
          <Stat value={fmtInt(exceptions)} label="Exceptions you found" sub={`${fmtInt(openExceptions)} still open`} />
          <Stat value={fmtHours(hours)} label="Time you saved" sub="against doing it by hand" />
        </StatRow>
      }
    />
  );
}
