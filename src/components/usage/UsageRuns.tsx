/**
 * What ran, and what is stuck.
 *
 * This sits on the value view rather than in a view of its own, because it is a
 * caveat on the saving rather than a subject beside it. A stuck check is work
 * that did not happen, so the money printed above it is understated by whatever
 * those checks would have contributed, and a page that prints a saving while
 * quietly sitting on broken runs is not being straight.
 *
 * A stuck check carries the words the failure itself used rather than a code or
 * a status colour, because a person who can read the error is a person who can
 * go and fix it. Every count opens the list behind it.
 *
 * This used to be an Activity view alongside two blocks that were cut: "who is
 * using it", which was per person adoption this product deliberately does not
 * do, and "what got created", which was a number because it was countable.
 * Neither carried a decision.
 */

import { formatDateTime } from '../../data/platform-usage';
import {
  fmtDuration, fmtInt, fmtPct,
  type Period, type UsageSnapshot,
} from '../../data/platform-usage-metrics';
import {
  Block, Drill, Grid, Lede, Line, Note, Num, Panel, Quiet,
  type GroupSpec,
} from './usageChrome';

export interface RunsContext {
  data: UsageSnapshot;
  period: Period;
  /**
   * Somebody reading their own work sees hours and never rupees, on every view.
   * The cost of a lookup they ran is still a price on their work, so the money
   * column goes with the rest of it.
   */
  showMoney: boolean;
  onOpenRuns: (id?: string) => void;
}

export function runsGroups(ctx: RunsContext): GroupSpec[] {
  const { data, period, showMoney } = ctx;
  const { volume, stuck, reliability, insights } = data;

  const ranGroup: GroupSpec = {
    id: 'ran',
    title: 'What ran, and what is stuck',
    answer: stuck.length === 0
      ? `${fmtInt(volume.passed)} checks finished, nothing is stuck.`
      : `${fmtInt(volume.passed)} checks finished, ${fmtInt(stuck.length)} are stuck.`,
    node: (
      <>
        <Lede>
          <Num>{fmtInt(volume.runs)}</Num> checks ran {period.phrase}.{' '}
          <Num>{fmtInt(volume.passed)}</Num> finished,{' '}
          <Num>{fmtInt(volume.failed + volume.blocked)}</Num> did not, and{' '}
          {stuck.length === 0
            ? 'every one of those was re-run successfully afterwards.'
            : <><Num>{fmtInt(stuck.length)}</Num> of them are still stuck with nothing successful after them.</>}
        </Lede>

        {stuck.length > 0 ? (
          <Block heading="Stuck now, in the words the failure used">
            <Grid
              head={['Check', 'What came back', 'Last tried']}
              align={['left', 'left', 'right']}
              rows={stuck.slice(0, 8).map(s => [
                <Drill
                  key={s.run.id}
                  label={s.run.workflowName}
                  onClick={() => ctx.onOpenRuns(s.run.workflowId)}
                />,
                <>
                  <span className="text-ink-900">{s.run.errorText}</span>
                  {s.repeats > 1 ? (
                    <span className="block mt-1 text-[0.75rem] text-ink-500">
                      {fmtInt(s.repeats)} runs failed the same way {period.phrase}.
                    </span>
                  ) : null}
                </>,
                formatDateTime(s.run.completedAt),
              ])}
              caption={
                stuck.length > 8
                  ? `Eight of ${fmtInt(stuck.length)} shown, most recent first. Stuck means it failed and nothing has run successfully since.`
                  : 'Stuck means it failed and nothing has run successfully since. A check that failed at two and was re-run at half past is not stuck.'
              }
            />
          </Block>
        ) : (
          <Quiet>
            Nothing is stuck. Every check that failed {period.phrase} was followed by one that worked.
          </Quiet>
        )}

        {reliability.rows.length > 0 ? (
          <Block heading="What keeps failing">
            <Grid
              head={['Check', 'Failures', 'Of runs', 'Failure rate', 'Machine time spent on nothing']}
              rows={reliability.rows.slice(0, 8).map(r => [
                r.workflowName,
                fmtInt(r.failures),
                fmtInt(r.runs),
                fmtPct(r.failureRatePct),
                fmtDuration(r.wastedHours),
              ])}
              caption={`${fmtDuration(reliability.wastedHours)} of machine time went on runs that produced nothing. It is left out of every saving on the value view and reported here instead.`}
            />
          </Block>
        ) : null}

        <Block heading="Everything the platform was asked to do">
          <Panel>
            <Line label="Checks run" value={fmtInt(volume.runs)} sub={`${fmtInt(volume.passed)} finished, ${fmtInt(volume.failed)} failed, ${fmtInt(volume.blocked)} blocked.`} />
            <Line label="Row checks performed" value={fmtInt(volume.checksPerformed)} sub="Repeats included. This is the one figure on the page that counts a population every time it was re-tested." />
            <Line label="Questions asked of the assistant" value={fmtInt(volume.chat)} sub={`${fmtInt(volume.chatVerified)} of them were answered with a figure the assistant could trace back to a record.`} />
            <Line label="Concierge jobs" value={fmtInt(volume.concierge)} sub={`${fmtInt(volume.conciergeFailed)} failed and ${fmtInt(volume.conciergeTimedOut)} timed out.`} />
            <Line label="SOP to RACM jobs" value={fmtInt(volume.sopJobs)} sub={`${fmtInt(volume.sopCacheHits)} were served from the cache and used no AI at all.`} />
            <Line label="Paid verification lookups" value={fmtInt(volume.lookupCalls)} sub={`${fmtInt(volume.lookupCallsFailed)} came back with nothing. The contract charges for answers, so those are charged nothing.`} />
          </Panel>
        </Block>

        <Block heading={showMoney
          ? 'What the AI did, and what can honestly be said about the cost of it'
          : 'What the AI did'}
        >
          <Grid
            head={showMoney ? ['Surface', 'Count', 'Money'] : ['Surface', 'Count']}
            align={showMoney ? ['left', 'right', 'left'] : ['left', 'right']}
            rows={data.aiUsage.map(a => {
              const cells = [
                <>
                  {a.surface}
                  {a.note ? <span className="block mt-1 text-[0.75rem] text-ink-500">{a.note}</span> : null}
                </>,
                `${fmtInt(a.count)} ${a.countLabel}`,
              ];
              return showMoney ? [...cells, a.money] : cells;
            })}
          />
        </Block>

        <Block heading="What the assistant noticed">
          <Panel>
            <Line label="Inside one check" value={fmtInt(insights.perRun)} />
            <Line label="Across a whole engagement" value={fmtInt(insights.consolidated)} />
          </Panel>
          <Note>
            The two are never added together. A consolidated insight summarises the per check ones, so a
            total would count the same observation twice.
          </Note>
        </Block>
      </>
    ),
  };

  return [ranGroup];
}
