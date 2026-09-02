/**
 * The coverage and findings view. The six lines an audit committee asks for.
 *
 * The plan, what was covered and what was left out, everything against a sample
 * of it, how long a thing sat there before anybody saw it, what was found and
 * how old it is, and what was promised about it. Not one figure here rests on
 * an assumed rate: every number is the customer's own record, which is what
 * makes this the view an audit lead can be argued at and not moved.
 */

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { formatDate } from '../../data/platform-usage';
import type { CoveragePack } from '../../data/audit-coverage';
import {
  DEDUPLICATION_LIMITS, fmtInt, fmtOneDp, fmtPct,
  type Period, type Scope, type UsageSnapshot,
} from '../../data/platform-usage-metrics';
import {
  Block, ChartOrTable, Drill, Grid, Lede, Line, Note, Num, Panel, Quiet, Unmeasured,
  type GroupSpec,
} from './usageChrome';

export interface CoverageContext {
  data: UsageSnapshot;
  committee: CoveragePack;
  period: Period;
  scope: Scope;
  onOpenEngagements: () => void;
  onOpenRisks: () => void;
  onOpenControls: () => void;
  onOpenFinding: (id: string) => void;
}

export function coverageGroups(ctx: CoverageContext): GroupSpec[] {
  const { data, committee, period } = ctx;
  const { plan, risks, population, detection, findings, actions } = committee;
  const { coverage } = data;

  const planGroup: GroupSpec = {
    id: 'plan',
    title: 'The plan, and what is slipping',
    answer: plan.completionPct === null
      ? `${fmtInt(plan.onTheBooks)} engagements on the books, none of them closed in the product.`
      : `${fmtPct(plan.completionPct)} of the plan closed, ${fmtInt(plan.slipping.length)} past their date.`,
    node: (
      <>
        {plan.completionPct === null ? (
          <>
            <Lede>
              <Num>{fmtInt(plan.onTheBooks)}</Num> engagements are on the books
              {plan.slipping.length > 0 ? (
                <> and <Num>{fmtInt(plan.slipping.length)}</Num> of them are past the date they were planned to close.</>
              ) : ' and none of them are past their planned close.'}
            </Lede>
            <Unmeasured>{plan.blocked}</Unmeasured>
          </>
        ) : (
          <>
            <Lede>
              <Num>{fmtInt(plan.closed)}</Num> of <Num>{fmtInt(plan.onTheBooks)}</Num> engagements on the
              books closed {period.phrase}, <Num>{fmtInt(plan.closedOnTime)}</Num> of them on the date they
              were planned to.
            </Lede>
            <Panel>
              <Line label="On the books" value={fmtInt(plan.onTheBooks)} />
              <Line label="Closed in this window" value={fmtInt(plan.closed)} />
              <Line label="Closed on or before the planned date" value={fmtInt(plan.closedOnTime)} />
              <Line strong label="Plan closed" value={fmtPct(plan.completionPct)} />
            </Panel>
          </>
        )}

        {plan.slipping.length > 0 ? (
          <Block heading="Past their planned close, still open">
            <Grid
              head={['Engagement', 'Owner', 'Reviewer', 'Planned close']}
              align={['left', 'left', 'left', 'right']}
              rows={plan.slipping.map(e => [`${e.code} · ${e.name}`, e.owner, e.reviewer, formatDate(e.plannedEnd)])}
              caption={
                <>
                  Past its planned date and nobody has closed it.{' '}
                  <Drill label="Open the engagements" onClick={ctx.onOpenEngagements} />.
                </>
              }
            />
          </Block>
        ) : (
          <Quiet>Nothing on the plan is past the date it was meant to close.</Quiet>
        )}
      </>
    ),
  };

  const coveredGroup: GroupSpec = {
    id: 'covered',
    title: 'What was covered, and what was left out',
    answer: `${fmtInt(coverage.tested.length)} of ${fmtInt(coverage.controlsInLibrary)} controls exercised, ${fmtInt(risks.uncovered)} risks with no control.`,
    node: (
      <>
        <Lede>
          <Num>{fmtInt(coverage.tested.length)}</Num> of the{' '}
          <Num>{fmtInt(coverage.controlsInLibrary)}</Num> controls in your library were exercised{' '}
          {period.phrase}, and <Num>{fmtInt(coverage.neverExercised.length)}</Num> have never been exercised
          at all.
        </Lede>
        <Note>
          Never means never, over your whole history, with the window taken off. A control that was quiet
          for three months is a different and much easier fact than one that has never run.
        </Note>
        <Panel>
          <Line label="Controls in the library" value={fmtInt(coverage.controlsInLibrary)} />
          <Line
            label="Exercised in this window"
            value={fmtInt(coverage.tested.length)}
            sub={`By a scheduled check or by a person validating a sample. ${fmtPct(coverage.pctTested)} of the library.`}
          />
          <Line
            label="Not exercised in this window"
            value={fmtInt(coverage.neverTested.length)}
            sub="A fact about this window, and it changes when the window changes."
          />
          <Line
            strong
            label="Never exercised at all"
            value={fmtInt(coverage.neverExercised.length)}
            sub="Nothing has ever tested these, on any window. This figure ignores the window on purpose."
          />
          <Line
            label="Workflows that have never run once"
            value={fmtInt(coverage.workflowsNeverRun.length)}
          />
        </Panel>

        {coverage.neverExercised.length > 0 ? (
          <Block heading="The controls nothing has ever tested">
            <Grid
              head={['Control', 'Process', 'Owner']}
              align={['left', 'left', 'left']}
              rows={coverage.neverExercised.slice(0, 12).map(c => [`${c.id} · ${c.name}`, c.process, c.owner])}
              caption={
                <>
                  {coverage.neverExercised.length > 12
                    ? `Twelve of ${fmtInt(coverage.neverExercised.length)} shown. `
                    : ''}
                  <Drill label="Open the control library" onClick={ctx.onOpenControls} />.
                </>
              }
            />
          </Block>
        ) : null}

        <Block heading="Risks with nothing covering them">
          <Lede>
            <Num>{fmtInt(risks.uncovered)}</Num> of the <Num>{fmtInt(risks.total)}</Num> risks on your
            register have no control mapped to them, and{' '}
            <Num>{fmtInt(risks.criticalUncovered)}</Num> of those are critical.
          </Lede>
          {risks.uncovered > 0 ? (
            <Grid
              head={['Risk', 'Priority', 'Owner']}
              align={['left', 'left', 'left']}
              rows={risks.rows.slice(0, 10).map(r => [r.name, r.priority, r.owner])}
              caption={
                <>
                  {risks.rows.length > 10 ? `Ten of ${fmtInt(risks.rows.length)} shown, alphabetically. ` : 'Alphabetical. '}
                  <Drill label="Open the risk register" onClick={ctx.onOpenRisks} />.
                </>
              }
            />
          ) : (
            <Quiet>Every risk on the register has at least one control mapped to it.</Quiet>
          )}
        </Block>

        <Block heading="Everything, against a sample of it">
          {population.multiple === null ? (
            <Unmeasured>
              Nobody validated a sample {period.phrase}, so there is nothing to compare the full populations
              against.
            </Unmeasured>
          ) : (
            <>
              <Lede>
                Scheduled checks read <Num>{fmtInt(population.fullRows)}</Num> rows end to end across{' '}
                <Num>{fmtInt(population.populations)}</Num> populations. The{' '}
                <Num>{fmtInt(population.samples)}</Num> samples a person validated covered{' '}
                <Num>{fmtInt(population.sampledRows)}</Num> rows, so the sample would have to grow{' '}
                <Num>{fmtInt(population.multiple)}</Num> times over to see what the full read saw.
              </Lede>
              <Note>
                Each population is counted once however often it was re-tested. Re-reading one ledger every
                week is speed rather than coverage.
              </Note>
            </>
          )}
        </Block>
      </>
    ),
  };

  const caughtGroup: GroupSpec = {
    id: 'caught',
    title: 'What was found, and how late it is',
    answer: detection.medianDays === null
      ? `${fmtInt(findings.raised)} findings raised, ${fmtInt(findings.open)} still open.`
      : `Caught in ${fmtOneDp(detection.medianDays)} days on average, ${fmtInt(findings.open)} findings still open.`,
    node: (
      <>
        {detection.medianDays === null ? (
          <Unmeasured>
            Nothing was caught {period.phrase}, so there is no time to detection to report.
          </Unmeasured>
        ) : (
          <>
            <Lede>
              A thing that went wrong sat there for <Num>{fmtOneDp(detection.medianDays)}</Num> days in the
              middle case before the platform caught it, across{' '}
              <Num>{fmtInt(detection.sample)}</Num> findings.
            </Lede>
            <Note>
              Measured from the day the thing happened in the business to the day a check found it. It is
              the middle value, so a handful of very old items cannot drag it.
            </Note>
            <ChartOrTable
              label="How long each finding sat there before it was caught"
              chart={
                <ChartAutoSizer height={190}>
                  {({ width, height }) => (
                    <BarChart width={width} height={height} data={detection.buckets} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B5D82' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6B5D82' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: '#F7F0FF' }}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                        formatter={(v: unknown) => [`${fmtInt(Number(v) || 0)} findings`, 'Caught'] as [string, string]}
                      />
                      <Bar dataKey="value" fill="#6A12CD" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ChartAutoSizer>
              }
              table={
                <Grid
                  head={['Time it sat there', 'Findings']}
                  rows={detection.buckets.map(b => [b.label, fmtInt(b.value)])}
                />
              }
            />
          </>
        )}

        <Block heading="What was found">
          <Panel>
            {findings.bySeverity.map(s => (
              <Line key={s.label} label={s.label} value={fmtInt(s.value)} />
            ))}
            <Line strong label={`Raised ${period.phrase}`} value={fmtInt(findings.raised)} />
            <Line
              label="Still open, on every window"
              value={fmtInt(findings.open)}
              sub="Open means nobody has dealt with it yet, not that the problem is still there. A finding never closes itself."
            />
          </Panel>
          <Note>{DEDUPLICATION_LIMITS.join(' ')}</Note>
        </Block>

        <Block heading="How long the open ones have been open">
          <Panel>
            {data.ageing.buckets.map(b => (
              <Line key={b.label} label={b.label} value={fmtInt(b.value)} />
            ))}
            <Line strong label="Open in total" value={fmtInt(data.ageing.open)} />
          </Panel>
          <Note>
            Age runs from the day a finding was first raised. A repeat occurrence never created a second
            row, so this really is how long a thing has been sitting there.
            {data.ageing.excludedLegacy > 0
              ? ` ${fmtInt(data.ageing.excludedLegacy)} findings are left out because they were raised before de-duplication shipped and nothing guarantees they are distinct.`
              : ''}
          </Note>
        </Block>

        {findings.overdue.length > 0 ? (
          <Block heading="Findings past their date">
            <Grid
              head={['Finding', 'Severity', 'Owner', 'Due']}
              align={['left', 'left', 'left', 'right']}
              rows={findings.overdue.slice(0, 10).map(ex => [
                <Drill key={ex.id} label={`${ex.ref} · ${ex.title}`} onClick={() => ctx.onOpenFinding(ex.engagementId)} />,
                ex.severity,
                ex.assignee.name,
                formatDate(ex.dueAt),
              ])}
              caption={findings.overdue.length > 10 ? `Ten of ${fmtInt(findings.overdue.length)} shown, soonest due first.` : 'Soonest due first.'}
            />
          </Block>
        ) : null}

        <Block heading="Whether the findings were real">
          {data.quality.falsePositiveRatePct === null ? (
            <Unmeasured>
              Nobody has classified a finding {period.phrase}, so there is no false alarm rate. Nought per
              cent would read as perfection when it really means nobody has looked.
            </Unmeasured>
          ) : (
            <>
              <Lede>
                <Num>{fmtPct(data.quality.falsePositiveRatePct)}</Num> of the findings somebody has looked
                at were the rule firing on something that was fine.
              </Lede>
              <Panel>
                <Line label="Called real" value={fmtInt(data.quality.truePositives)} />
                <Line label="Called a false alarm" value={fmtInt(data.quality.falsePositives)} />
                <Line
                  label="Nobody has looked yet"
                  value={fmtInt(data.quality.unclassified)}
                  sub="Left out of the rate. Dividing by every finding would let a large untouched backlog report a flattering one."
                />
              </Panel>
              <Note>
                A rising rate means a control's rule wants tuning. It does not mean the team is failing.
              </Note>
            </>
          )}
        </Block>

        <Block heading="What was promised about it">
          <Lede>
            <Num>{fmtInt(actions.open)}</Num> action plans are open and{' '}
            <Num>{fmtInt(actions.overdue.length)}</Num> of them are past their date.{' '}
            <Num>{fmtInt(actions.closedInWindow)}</Num> closed {period.phrase}
            {actions.medianDaysToClose === null
              ? '.'
              : `, taking ${fmtOneDp(actions.medianDaysToClose)} days in the middle case.`}
          </Lede>
          {actions.overdue.length > 0 ? (
            <Grid
              head={['Action plan', 'Risk', 'Owner', 'Due']}
              align={['left', 'left', 'left', 'right']}
              rows={actions.overdue.slice(0, 10).map(a => [
                a.title,
                a.severity ?? '—',
                a.owner.name,
                formatDate(a.dueAt),
              ])}
              caption={
                <>
                  {actions.overdue.length > 10 ? `Ten of ${fmtInt(actions.overdue.length)} shown, soonest due first. ` : 'Soonest due first. '}
                  The work itself is done on the engagement.{' '}
                  <Drill label="Open the engagements" onClick={ctx.onOpenEngagements} />.
                </>
              }
            />
          ) : (
            <Quiet>Nothing that was promised is past its date.</Quiet>
          )}
        </Block>
      </>
    ),
  };

  return [planGroup, coveredGroup, caughtGroup];
}
