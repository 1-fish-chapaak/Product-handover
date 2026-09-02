/**
 * The activity view. What ran, what is stuck, who is using it, what got made.
 *
 * The workspace admin's question is whether the team is actually using what was
 * bought, and the answer to that is useless without the other half: what tried
 * to run and failed, in the words the failure itself used. So a stuck check
 * carries its real error text rather than a code or a status colour, and every
 * count on this view opens the list behind it.
 *
 * Nothing here ranks anybody. The per person table is alphabetical and no prop,
 * state or URL parameter can reorder it.
 */

import { formatDate, formatDateTime } from '../../data/platform-usage';
import {
  fmtDuration, fmtInt, fmtPct,
  type Period, type QueueFigures, type Scope, type UsageSnapshot,
} from '../../data/platform-usage-metrics';
import {
  Block, Drill, Grid, Lede, Line, Note, Num, Panel, Quiet, Unmeasured,
  type GroupSpec,
} from './usageChrome';

export interface ActivityContext {
  data: UsageSnapshot;
  period: Period;
  scope: Scope;
  /** Named people are a permission of their own, so a count stands in without it. */
  canSeeNames: boolean;
  /**
   * Somebody reading their own work sees hours and never rupees, on every view.
   * The cost of a lookup they ran is still a price on their work, so the money
   * column goes with the rest of it.
   */
  showMoney: boolean;
  onOpenRuns: (id?: string) => void;
  onOpenQueueItem: (item: QueueFigures['items'][number]) => void;
}

export function activityGroups(ctx: ActivityContext): GroupSpec[] {
  const { data, period, scope, canSeeNames, showMoney } = ctx;
  const { volume, stuck, reliability, created, reports, product, people, queue, insights } = data;

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

  const peopleGroup: GroupSpec = {
    id: 'people',
    title: 'Who is using it',
    answer: scope.persona === 'auditor'
      ? `${fmtInt(queue.items.length)} things are waiting on you.`
      : `${fmtInt(people.length)} people ran something ${period.phrase}.`,
    node: scope.persona === 'auditor' ? (
      queue.items.length === 0 ? (
        <Quiet>Nothing is waiting on you.</Quiet>
      ) : (
        <>
          <Lede>
            <Num>{fmtInt(queue.items.length)}</Num> things are waiting on you and{' '}
            <Num>{fmtInt(queue.overdue)}</Num> of them are past their date. The work itself happens on the
            screen that owns it, so each line here leaves for that screen.
          </Lede>
          <Grid
            head={['What', 'Detail', 'Due']}
            align={['left', 'left', 'right']}
            rows={queue.items.slice(0, 12).map(item => [
              <Drill key={item.id} label={item.title} onClick={() => ctx.onOpenQueueItem(item)} />,
              item.detail,
              <span className={item.overdue ? 'text-risk-700' : undefined}>
                {formatDate(item.dueAt)}{item.overdue ? ' · overdue' : ''}
              </span>,
            ])}
            caption={queue.items.length > 12 ? `Twelve of ${fmtInt(queue.items.length)} shown, the overdue ones first.` : 'The overdue ones first, then by how soon.'}
          />
        </>
      )
    ) : people.length === 0 ? (
      <Quiet>Nobody ran a check {period.phrase}.</Quiet>
    ) : !canSeeNames ? (
      <>
        <Lede>
          <Num>{fmtInt(people.length)}</Num> people ran something {period.phrase}.
        </Lede>
        <Unmeasured>
          Naming them is a permission of its own and your role does not carry it, so this is a count. Ask an
          administrator if you need the names.
        </Unmeasured>
      </>
    ) : (
      <>
        <Lede>
          <Num>{fmtInt(people.length)}</Num> people ran something {period.phrase}, across{' '}
          <Num>{fmtInt(new Set(people.map(p => p.team)).size)}</Num> teams.
        </Lede>
        <Note>
          Alphabetical, and nothing on this page can reorder it. It records what each person worked on
          rather than comparing them, so there is no share, no average and no position in a list.
        </Note>
        <Grid
          head={['Person', 'Team', 'Checks run', 'Findings assigned', 'Of those, resolved', 'Last active']}
          align={['left', 'left', 'right', 'right', 'right', 'right']}
          rows={people.map(p => [
            p.name,
            p.team,
            fmtInt(p.runs),
            fmtInt(p.exceptionsFound),
            fmtInt(p.exceptionsResolved),
            p.lastActive === null ? '—' : formatDate(p.lastActive),
          ])}
        />
      </>
    ),
  };

  const madeCount = created.engagements.length + created.controls.length + created.dashboards.length
    + created.reports.length + created.risks.length;

  const madeRow = (label: string, rows: { name: string; by: string | null; at: number; note?: string }[]) => (
    rows.length === 0 ? null : (
      <Block key={label} heading={label}>
        <Grid
          head={['What', 'Who made it', 'When']}
          align={['left', 'left', 'right']}
          rows={rows.slice(0, 8).map(r => [
            <>
              {r.name}
              {r.note ? <span className="block mt-1 text-[0.75rem] text-ink-500">{r.note}</span> : null}
            </>,
            canSeeNames ? (r.by ?? 'the assistant') : (r.by ? 'a person' : 'the assistant'),
            formatDate(r.at),
          ])}
          caption={rows.length > 8 ? `Eight of ${fmtInt(rows.length)} shown, most recent first.` : undefined}
        />
      </Block>
    )
  );

  const createdGroup: GroupSpec = {
    id: 'created',
    title: 'What got created',
    answer: madeCount === 0
      ? `Nothing new was created ${period.phrase}.`
      : `${fmtInt(madeCount)} things were created ${period.phrase}.`,
    node: madeCount === 0 ? (
      <Quiet>
        Nothing new was created {period.phrase}. Existing work carried on: the counts above say how much.
      </Quiet>
    ) : (
      <>
        <Lede>
          <Num>{fmtInt(madeCount)}</Num> things were created {period.phrase}, and{' '}
          <Num>{fmtInt(reports.made.length)}</Num> reports were written of which{' '}
          <Num>{fmtInt(reports.finalised)}</Num> were finalised and{' '}
          <Num>{fmtInt(reports.shared.length)}</Num> shared.
        </Lede>
        <Panel>
          <Line label="Engagements" value={fmtInt(created.engagements.length)} />
          <Line label="Controls" value={fmtInt(created.controls.length)} />
          <Line label="Risks" value={fmtInt(created.risks.length)} />
          <Line label="Dashboards" value={fmtInt(created.dashboards.length)} sub={`${fmtInt(product.dashboardEdits)} edits and ${fmtInt(product.widgetsAdded)} widgets added to the ones that already existed.`} />
          <Line label="Reports" value={fmtInt(created.reports.length)} sub={`${fmtInt(reports.downloads)} downloads.`} />
          <Line label="Alerts configured" value={fmtInt(product.alertsConfigured.length)} sub={`They fired ${fmtInt(product.alertsFired)} times.`} />
        </Panel>
        {madeRow('Engagements', created.engagements)}
        {madeRow('Controls', created.controls)}
        {madeRow('Reports', created.reports)}
      </>
    ),
  };

  return [ranGroup, peopleGroup, createdGroup];
}
