/**
 * What is stuck, what keeps failing, and how the testing is going.
 *
 * The per person table here is the only one in the product's usage reporting.
 * It is alphabetical, and no code path reorders it. Opening it needs
 * `ad_usage_people`, and a reader without that right sees the rest of the page
 * rather than an empty one.
 *
 * The two blocks that only made sense to one of the three old readers, the
 * auditor's own queue and the auditor's own hours, are gone with the readers.
 * The queue is a home screen question rather than a reporting one, and the
 * hours rested on a rate we invented.
 */

import { AlertTriangle } from 'lucide-react';
import { formatDate, formatDateTime } from '../../data/platform-usage';
import {
  fmtDuration, fmtInt, fmtOneDp, fmtPct, openLabel,
  type CcmFigures, type Period, type PersonRow,
  type ReliabilityRow, type SamplingFigures, type StuckRun,
} from '../../data/platform-usage-metrics';
import { Block, Bars, DataTable, Drill, Empty, Fig, MadeList, MadeRow } from './usageKit';

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

  /*
   * One problem, one row.
   *
   * The same check failing four times with the same error was four rows of
   * identical text, each one repeating "4 times with this error" under it. It
   * reads as four things to fix when it is one, and the one real fact, that
   * nobody has touched it since the first failure, was buried in the repetition.
   * So the list groups on the check and the error text, keeps the most recent
   * failure as the row's date, and says how many times and since when
   * underneath. The figure in the head stays the run count, because that is
   * what it says it is.
   */
  const groups = stuck.reduce<{ key: string; latest: StuckRun; runs: StuckRun[] }[]>((acc, item) => {
    const key = `${item.run.workflowId}·${item.run.errorText}`;
    const found = acc.find(g => g.key === key);
    if (found) {
      found.runs.push(item);
      if (item.run.completedAt > found.latest.run.completedAt) found.latest = item;
      return acc;
    }
    return [...acc, { key, latest: item, runs: [item] }];
  }, []);

  return (
    <Block
      id="stuck"
      title="What is stuck right now"
      code="RUN-STUCK"
      figure={fmtInt(stuck.length)}
      tone="risk"
      context={groups.length < stuck.length
        ? <>runs that failed and have not been re-run, {groups.length === 1 ? 'all of them the same problem' : `${fmtInt(groups.length)} problems between them`}</>
        : 'runs that failed and have not been re-run'}
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
        {groups.map(({ key, latest, runs }) => {
          const { run } = latest;
          const first = runs.reduce((a, b) => (a.run.completedAt <= b.run.completedAt ? a : b)).run;
          return (
            <li key={key} className="py-3">
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
                    {run.status === 'blocked' ? 'Blocked' : 'Failed'} · last {formatDateTime(run.completedAt)} · started by{' '}
                    {run.scheduled ? 'the schedule' : run.actor.name}
                  </p>
                  {runs.length > 1 && (
                    <p className="mt-1 text-[0.75rem] text-ink-500">
                      {fmtInt(runs.length)} runs with this same error, the first on {formatDateTime(first.completedAt)}, and
                      nothing has run clean since.
                    </p>
                  )}
                </div>
                <AlertTriangle size={15} className="text-risk-600 shrink-0 mt-0.5" />
              </div>
            </li>
          );
        })}
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
      code="RUN-FAILED"
      tone="risk"
      figure={fmtDuration(wastedHours)}
      context="of machine time burned by runs that produced nothing, and none of it is in any saving on this page"
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
  // Running and queued samples are in the drill and in the total, so they have
  // to be in the sentence too. "3 passed, 0 failed, 0 errored" above a link that
  // opens 4 validations is a page a reader stops trusting.
  const unsettled = sampling.total - count('passed') - count('failed') - count('errored');

  return (
    <Block
      id="sampling"
      title="Sampling outcomes"
      code="SAMPLE-OUT"
      figure={fmtInt(sampling.counts.find(c => c.outcome === 'passed')?.value ?? 0)}
      of={fmtInt(sampling.total)}
      context={<>samples passed {period.phrase}</>}
      lede={
        <>
          <Fig>{fmtInt(count('passed'))}</Fig> {count('passed') === 1 ? 'sample' : 'samples'} passed,{' '}
          <Fig>{fmtInt(count('failed'))}</Fig> failed and <Fig>{fmtInt(count('errored'))}</Fig> errored{' '}
          {period.phrase}.
          {unsettled > 0 && (
            <> <Fig>{fmtInt(unsettled)}</Fig> {unsettled === 1 ? 'is' : 'are'} still running or
              waiting to start, so {unsettled === 1 ? 'it has' : 'they have'} no outcome yet. All{' '}
              <Fig>{fmtInt(sampling.total)}</Fig> are in the list below.</>
          )}
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
      code="CCM-LAG"
      figure={ccm.medianLagDays !== null ? `${Math.round(ccm.medianLagDays * 10) / 10} d` : '—'}
      context={<>from a thing happening to a scheduled check catching it, across {fmtInt(ccm.engagementsOnSchedule)} engagements on a schedule</>}
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

export function TeamWork({ people, period, subject }: { people: PersonRow[]; period: Period; subject: string }) {
  if (people.length === 0) {
    return (
      <Block id="people" title="Who did what" lede={null}>
        <Empty kind="quiet" title={`Nobody in ${subject} recorded work in this window.`} />
      </Block>
    );
  }

  /*
   * This block used to render as a heading with a fold under it and nothing
   * else: no figure, and its sentence folded away with the table. A reader saw
   * "Management · work by outcome" and a link. So it carries its own figure now,
   * and the figure is the team, not a ranking: how many people recorded work,
   * and what they did between them.
   */
  const runs = people.reduce((sum, p) => sum + p.runs, 0);
  const found = people.reduce((sum, p) => sum + p.exceptionsFound, 0);

  return (
    <Block
      id="people"
      title="Who did what"
      code="TEAM-WORK"
      figure={fmtInt(people.length)}
      context={
        <>
          {people.length === 1 ? 'person' : 'people'} in {subject} recorded work {period.phrase},{' '}
          {fmtInt(runs)} {runs === 1 ? 'run' : 'runs'} and {fmtInt(found)}{' '}
          {found === 1 ? 'exception' : 'exceptions'} found between them
        </>
      }
      lede={<>Everybody in {subject} and what they worked on {period.phrase}.</>}
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
