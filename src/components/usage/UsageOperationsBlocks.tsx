/**
 * What a team lead and an auditor open the page for: what is stuck, what keeps
 * failing, how the testing is going, and what is waiting on one person.
 *
 * The team table here is the only per-person table in the product's usage
 * reporting. It is alphabetical, and no code path reorders it.
 */

import { AlertTriangle } from 'lucide-react';
import { formatDate, formatDateTime } from '../../data/platform-usage';
import {
  fmtDuration, fmtHours, fmtInt, fmtOneDp, fmtPct, openLabel,
  SOURCE_LABEL,
  type CcmFigures, type ExceptionFigures, type Period, type PersonRow, type QueueFigures,
  type ReliabilityRow, type SamplingFigures, type StuckRun, type UsageSettings, type ValueFigures,
} from '../../data/platform-usage-metrics';
import { Block, Bars, DataTable, Drill, Empty, Fig, MadeList, MadeRow, Stat, StatRow, Working } from './usageKit';

/* ── What is stuck right now ─────────────────────────────────────────────── */

/**
 * The first thing a team lead sees, and the reason the savings sit at the
 * bottom of their view. Nobody can act on "85 lakh saved". They can act on "this
 * check failed four times with the same error", so the error text is printed in
 * full rather than summarised into a status word.
 */
export function StuckNow({
  stuck, period, onOpenRun,
}: {
  stuck: StuckRun[];
  period: Period;
  onOpenRun: (workflowId: string) => void;
}) {
  if (stuck.length === 0) {
    return (
      <Block id="stuck" title="What is stuck right now" lede={null}>
        <Empty kind="quiet" title="Nothing is stuck." detail="Every check that ran in this window either passed or was re-run successfully." />
      </Block>
    );
  }

  const repeated = stuck.find(s => s.repeats > 1);

  return (
    <Block
      id="stuck"
      title="What is stuck right now"
      lede={
        repeated
          ? (
            <>
              <Fig>{repeated.run.workflowName}</Fig> has failed <Fig>{fmtInt(repeated.repeats)}</Fig> times
              with the same error{repeated.repeats < stuck.length
                ? <>, and <Fig>{fmtInt(stuck.length - repeated.repeats)}</Fig> other checks are waiting on somebody {period.phrase}</>
                : <>, and nothing has re-run since</>}.
            </>
          )
          : (
            <>
              <Fig>{fmtInt(stuck.length)}</Fig> {stuck.length === 1 ? 'check is' : 'checks are'} waiting
              on somebody {period.phrase}.
            </>
          )
      }
    >
      <ul className="divide-y divide-canvas-border border-t border-canvas-border">
        {stuck.map(({ run, repeats }) => (
          <li key={run.id} className="py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenRun(run.workflowId)}
                  className="text-[0.875rem] font-medium text-ink-900 hover:text-brand-700 hover:underline text-left"
                >
                  {run.workflowName}
                </button>
                <p className="mt-1 text-[0.875rem] text-ink-700 leading-relaxed max-w-[80ch]">
                  {run.errorText}
                </p>
                <p className="mt-1 text-[0.75rem] text-ink-500">
                  {run.status === 'blocked' ? 'Blocked' : 'Failed'} · {formatDateTime(run.completedAt)} · started by{' '}
                  {run.scheduled ? 'the schedule' : run.actor.name}
                  {repeats > 1 && <> · {fmtInt(repeats)} times with this error</>}
                </p>
              </div>
              <AlertTriangle size={15} className="text-risk-600 shrink-0 mt-0.5" />
            </div>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/* ── What keeps failing, and what it burned ──────────────────────────────── */

export function Reliability({
  rows, wastedHours, period,
}: {
  rows: ReliabilityRow[];
  wastedHours: number;
  period: Period;
}) {
  if (rows.length === 0) {
    return (
      <Block id="reliability" title="What keeps failing" lede={null}>
        <Empty kind="quiet" title={`Nothing failed ${period.phrase}.`} />
      </Block>
    );
  }

  const worst = rows[0];

  return (
    <Block
      id="reliability"
      title="What keeps failing"
      lede={
        <>
          <Fig>{worst.workflowName}</Fig> failed <Fig>{fmtInt(worst.failures)}</Fig> of{' '}
          <Fig>{fmtInt(worst.runs)}</Fig> runs {period.phrase}. Failed runs burned{' '}
          <Fig>{fmtDuration(wastedHours)}</Fig> of machine time and produced nothing, so none of it
          is in any saving on this page.
        </>
      }
      chart={<Bars rows={rows.map(r => ({ label: r.workflowName, value: r.failureRatePct, note: `${fmtInt(r.failures)} of ${fmtInt(r.runs)} runs` }))} format={fmtPct} tone="risk" scaleTo={100} />}
      table={
        <DataTable
          head={['Check', 'Failures', 'Runs', 'Failure rate', 'Machine time wasted']}
          rows={rows.map(r => [r.workflowName, fmtInt(r.failures), fmtInt(r.runs), fmtPct(r.failureRatePct), fmtDuration(r.wastedHours)])}
        />
      }
      footer={worst.commonError ? <>The error that came back most often: {worst.commonError}</> : undefined}
    />
  );
}

/* ── Sampling ────────────────────────────────────────────────────────────── */

export function SamplingOutcomes({ sampling, period }: { sampling: SamplingFigures; period: Period }) {
  if (sampling.total === 0) {
    return (
      <Block id="sampling" title="Sampling outcomes" lede={null}>
        <Empty kind="quiet" title={`No sample was validated ${period.phrase}.`} />
      </Block>
    );
  }

  const count = (o: string) => sampling.counts.find(c => c.outcome === o)?.value ?? 0;

  return (
    <Block
      id="sampling"
      title="Sampling outcomes"
      lede={
        <>
          <Fig>{fmtInt(count('passed'))}</Fig> {count('passed') === 1 ? 'sample' : 'samples'} passed,{' '}
          <Fig>{fmtInt(count('failed'))}</Fig> failed and <Fig>{fmtInt(count('errored'))}</Fig> errored{' '}
          {period.phrase}.
          {count('errored') > 0 && (
            <> An errored run is not a failed control, so it is counted separately. Somebody has to
              look at it before it means anything.</>
          )}
        </>
      }
      chart={<Bars rows={sampling.counts.map(c => ({ label: c.outcome, value: c.value }))} />}
      table={<DataTable head={['Outcome', 'Samples']} rows={sampling.counts.map(c => [c.outcome, fmtInt(c.value)])} />}
    >
      <div className="mb-4">
        <Drill label={openLabel(sampling.total, 'validation', 'validations')}>
          <MadeList>
            {sampling.rows.map(s => (
              <MadeRow key={s.id} name={s.controlName} madeBy={`${s.outcome} · sample of ${fmtInt(s.sampleSize)} · ${s.actor.name}`} when={formatDate(s.at)} />
            ))}
          </MadeList>
        </Drill>
      </div>
    </Block>
  );
}

/* ── Continuous monitoring ───────────────────────────────────────────────── */

export function CcmCoverage({ ccm, period }: { ccm: CcmFigures; period: Period }) {
  if (ccm.rows.length === 0) {
    return (
      <Block id="ccm" title="Continuous monitoring" lede={null}>
        <Empty kind="quiet" title="No engagement runs on a schedule yet." detail="Continuous monitoring is a mode of an engagement rather than a separate feature, so this block fills in as engagements are put on a schedule." />
      </Block>
    );
  }

  return (
    <Block
      id="ccm"
      title="Continuous monitoring"
      lede={
        <>
          <Fig>{fmtInt(ccm.engagementsOnSchedule)}</Fig> of{' '}
          <Fig>{fmtInt(ccm.engagementsTotal)}</Fig> engagements{' '}
          {ccm.engagementsOnSchedule === 1 ? 'runs' : 'run'} on a schedule
          {ccm.below > 0 && <>, and <Fig>{fmtInt(ccm.below)}</Fig> of them are below the pass rate they are configured to hold</>}.
          {ccm.medianLagDays !== null && (
            <> A scheduled check caught things about <Fig>{fmtOneDp(ccm.medianLagDays)}</Fig> days
              after they happened {period.phrase}.</>
          )}
        </>
      }
      hint="Re-testing the same population does not add coverage. What it shortens is the gap between an event and the platform catching it, and that is the figure credited here."
      table={
        <DataTable
          head={['Engagement', 'Threshold', 'Actual pass rate', 'Approval levels', 'Alerts']}
          rows={ccm.rows.map(r => [
            r.engagementName,
            fmtPct(r.thresholdPct),
            r.actualPct === null ? 'nothing settled yet' : fmtPct(r.actualPct),
            fmtInt(r.approvalLevels),
            r.alertsOn ? 'on' : 'off',
          ])}
        />
      }
    />
  );
}

/* ── The team, alphabetically, and never ranked ──────────────────────────── */

/**
 * Everybody on the team and what they worked on.
 *
 * Alphabetical, and the sort order is not a prop, a state or a URL parameter, so
 * there is no way to reorder it. Section 12 of the guide makes this a build rule
 * rather than a style choice. A table that sorts by output works as a league
 * table however it is labelled.
 */

export function TeamWork({ people, period, team }: { people: PersonRow[]; period: Period; team: string }) {
  if (people.length === 0) {
    return (
      <Block id="people" title={`${team} · work by outcome`} lede={null}>
        <Empty kind="quiet" title="Nobody on this team recorded work in this window." />
      </Block>
    );
  }

  return (
    <Block
      id="people"
      title={`${team} · work by outcome`}
      lede={<>Everybody on {team} and what they worked on {period.phrase}.</>}
      hint="Alphabetical, and there is no way to sort it by output, by click or by URL. It records what each person worked on rather than comparing them."
      table={
        <DataTable
          head={['Person', 'Runs', 'Exceptions found', 'Resolved', 'Last active']}
          rows={people.map(p => [
            p.name,
            fmtInt(p.runs),
            fmtInt(p.exceptionsFound),
            fmtInt(p.exceptionsResolved),
            p.lastActive ? formatDate(p.lastActive) : 'not in this window',
          ])}
        />
      }
    />
  );
}

/* ── The auditor's queue ─────────────────────────────────────────────────── */

export function MyQueue({ queue, onOpen }: { queue: QueueFigures; onOpen: (item: QueueFigures['items'][number]) => void }) {
  if (queue.items.length === 0) {
    return (
      <Block id="queue" title="What is waiting on you" lede={null}>
        <Empty kind="quiet" title="Nothing is waiting on you." detail="No exception, review or action plan is assigned to you at the moment." />
      </Block>
    );
  }

  return (
    <Block
      id="queue"
      title="What is waiting on you"
      lede={
        queue.overdue > 0
          ? (
            <>
              <Fig>{fmtInt(queue.items.length)}</Fig> {queue.items.length === 1 ? 'item is' : 'items are'} yours,
              and <Fig>{fmtInt(queue.overdue)}</Fig> {queue.overdue === 1 ? 'is' : 'are'} past{' '}
              {queue.overdue === 1 ? 'its' : 'their'} date. Those are first.
            </>
          )
          : (
            <>
              <Fig>{fmtInt(queue.items.length)}</Fig> {queue.items.length === 1 ? 'item is' : 'items are'} yours.
              None are overdue.
            </>
          )
      }
    >
      <ul className="divide-y divide-canvas-border border-t border-canvas-border">
        {queue.items.map(item => (
          <li key={item.id} className="py-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="text-[0.875rem] text-ink-800 text-left hover:text-brand-700 hover:underline truncate"
              >
                {item.title}
              </button>
              <span className={`text-[0.75rem] shrink-0 tabular-nums ${item.overdue ? 'text-risk-700 font-medium' : 'text-ink-400'}`}>
                {item.overdue ? 'overdue · ' : 'due '}{formatDate(item.dueAt)}
              </span>
            </div>
            <p className="text-[0.75rem] text-ink-500">{item.detail}</p>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/* ── The auditor's own work ──────────────────────────────────────────────── */

export function MyWork({
  value, exceptions, period, settings,
}: {
  value: ValueFigures;
  exceptions: ExceptionFigures;
  period: Period;
  settings: UsageSettings;
}) {
  if (value.runs === 0 && exceptions.total === 0) {
    return (
      <Block id="my-work" title="Your own work" lede={null}>
        <Empty kind="quiet" title={`You started nothing ${period.phrase}.`} />
      </Block>
    );
  }

  return (
    <Block
      id="my-work"
      title="Your own work"
      lede={
        <>
          You started <Fig>{fmtInt(value.runs)}</Fig> successful{' '}
          {value.runs === 1 ? 'run' : 'runs'} {period.phrase} and found{' '}
          <Fig>{fmtInt(exceptions.total)}</Fig>{' '}
          {exceptions.total === 1 ? 'exception' : 'exceptions'}
          {exceptions.total > 0 && (
            <>, <Fig>{fmtInt(exceptions.open)}</Fig> of which{' '}
              {exceptions.open === 1 ? 'is' : 'are'} still open</>
          )}.
        </>
      }
    >
      <StatRow>
        <Stat value={fmtInt(value.runs)} label="runs you started" />
        <Stat value={fmtInt(exceptions.total)} label="exceptions you found" />
        <Stat value={fmtInt(exceptions.resolved)} label="of those, closed" />
        <Stat
          value={fmtHours(value.hoursSaved)}
          label="hours you saved"
          sub="What your runs would have taken by hand, less the time the machine took."
        />
      </StatRow>

      {value.coveredRows > 0 && (
        <Working
          title="How the hours are worked out"
          rows={[
            {
              expr: `${fmtInt(value.coveredRows)} rows`,
              means: `you checked ${period.phrase}, with each population counted once`,
              source: 'measured',
            },
            {
              expr: `÷ ${fmtInt(settings.manualReviewRate)} rows an hour`,
              means: 'what one person gets through by hand',
              source: SOURCE_LABEL[settings.source.manualReviewRate],
            },
            { expr: `= ${fmtHours(value.manualHours)} hours`, means: 'the same work done by hand', source: 'estimated' },
            { expr: `less ${fmtDuration(value.machineHours)}`, means: 'what the machine actually took', source: 'measured' },
            {
              expr: `= ${fmtHours(value.hoursSaved)} hours saved`,
              means: 'rounded down, so the saving is never overstated',
              source: 'estimated',
            },
          ]}
        />
      )}
    </Block>
  );
}
