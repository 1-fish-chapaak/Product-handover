/**
 * The company view. What the platform gave back, against what it costs to run.
 *
 * This is the only scope that shows money going out, because a running cost
 * only means anything against the whole bill. It is also the only scope whose
 * total reconciles against the ledger row for row, since it is the only one
 * that can count the rows nothing wrote a user to.
 *
 * The headline is a floor and says so. It grows when evidence grows rather
 * than when the platform gets busier, which is the property that makes it
 * worth quoting to somebody else.
 */

import {
  BAND_LABEL, fmtHours, fmtInr, fmtInrExact, fmtInt, fmtMinutes, fmtOneDp, fmtPct, fmtSeconds,
  formatDate, plural, type Snapshot, type ValueSettings,
} from '../../data/value/model';
import { CONTROL_BY_ID, EFFORT_BASIS_LABEL } from '../../data/value/controls';
import { GROUP_LABEL } from '../../data/value/settings';
import { Lede, Note, Working } from '../usage/chrome';
import {
  Bars, BasisChip, Block, Cite, CoverageBar, Flag, Headline, NotValued, PairBar, Row, Spark,
  StackedWeeks, Table,
} from './chrome';

const GROUP_FILL: Record<string, string> = {
  workflow: 'bg-ink-800',
  chat: 'bg-ink-600',
  ingestion: 'bg-ink-400',
  govt: 'bg-ink-300',
};

export default function CompanyValue({
  snap, prior, phrase, settings, onOpenControls,
}: {
  snap: Snapshot;
  prior: Snapshot | null;
  phrase: string;
  settings: ValueSettings;
  onOpenControls: () => void;
}) {
  const monthHours = settings.hoursPerDay * settings.daysPerMonth;
  const delta = prior && prior.hours > 0 ? ((snap.hours - prior.hours) / prior.hours) * 100 : null;
  const floor = snap.coverage.unvaluedPct > 0;

  if (snap.events === 0) {
    return (
      <div className="border-t border-canvas-border py-8">
        <p className="text-[1rem] leading-relaxed text-ink-800">
          Nothing ran {phrase}, so there is no value to report.
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          This page compares what the platform took against what the same work takes by hand. With
          no activity there is nothing to compare, which is not the same as a return of nought.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-y-5 border-b border-canvas-border pb-5">
        <Headline
          label="Hours returned"
          value={fmtHours(snap.hours)}
          floor={floor}
          sub={
            <>
              From the {fmtPct(snap.coverage.valuedPct)} of activity we can substantiate
              {delta === null ? '' : `, ${delta >= 0 ? 'up' : 'down'} ${fmtPct(Math.abs(delta))} on the range before`}
            </>
          }
        />
        <Headline
          label="Value created"
          value={fmtInr(snap.inr)}
          floor={floor}
          sub={`At ₹${fmtInt(settings.hourlyRateInr)} an hour`}
        />
        <Headline
          label="Capacity returned"
          value={`${fmtOneDp(snap.auditorMonths)} months`}
          floor={floor}
          sub={`Auditor months, of ${fmtInt(monthHours)} hours each`}
        />
        <Headline
          label="After what it cost to run"
          value={fmtInr(snap.cost.netInr)}
          sub={
            snap.cost.unpricedRows > 0
              ? `Running cost ${fmtInr(snap.cost.totalInr)}, and itself a floor: ${plural(snap.cost.unpricedRows, 'row ran on a model with no published price', 'rows ran on models with no published price')}.`
              : `Running cost was ${fmtInr(snap.cost.totalInr)}`
          }
        />
      </div>

      <div className="py-5">
        <CoverageBar
          documentedPct={snap.coverage.documentedPct}
          measuredPct={snap.coverage.measuredPct}
          unvaluedPct={snap.coverage.unvaluedPct}
          onOpen={onOpenControls}
        />
        <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-500">
          {fmtPct(snap.coverage.documentedPct)} of the work counted here rests on your own control
          documentation and {fmtPct(snap.coverage.measuredPct)} on an auditor who was timed doing it
          by hand.{' '}
          {snap.coverage.unvaluedPct === 0 ? (
            <>Everything counted in this range has evidence behind it.</>
          ) : settings.reachBackOverHistory ? (
            <>
              The remaining {fmtPct(snap.coverage.unvaluedPct)} has neither, so it is counted and
              left unvalued rather than guessed at. Those hours were almost certainly saved. Nobody
              can yet prove how many, and the figures above leave them out.
            </>
          ) : (
            <>
              The remaining {fmtPct(snap.coverage.unvaluedPct)} either has neither, or was done
              before the figure that would value it was supplied. History is switched off in
              settings, so both are counted and left unvalued.
            </>
          )}
        </p>
      </div>

      {(snap.unattributedRuns > 0 || !settings.chatBands.validatedAgainstSample) ? (
        <div className="space-y-2 pb-5">
          {snap.unattributedRuns > 0 ? (
            <Flag>
              {plural(snap.unattributedRuns, 'run carries', 'runs carry')} no user at all, so{' '}
              {snap.unattributedRuns === 1
                ? 'it counts for the company and appears'
                : 'they count for the company and appear'}{' '}
              on no team and no personal figure. That is why the company total is larger than the
              teams under it added together.
            </Flag>
          ) : null}
          {!settings.chatBands.validatedAgainstSample ? (
            <Flag>{settings.chatBands.validationNote}</Flag>
          ) : null}
        </div>
      ) : null}

      {(snap.valuedFromLaterEvidence > 0 || snap.backfilledBands > 0) ? (
        <div className="space-y-2 pb-5">
          {snap.valuedFromLaterEvidence > 0 ? (
            <Flag>
              {fmtHours(snap.hoursFromLaterEvidence)} of the figure above, across{' '}
              {plural(snap.valuedFromLaterEvidence, 'thing', 'things')}, comes from work done before
              the document or timing that values it was supplied. The runs were recorded at the
              time either way, so loading a register makes a year of history valuable at once. It
              is said here rather than left to be discovered, and it can be switched off in
              settings.
            </Flag>
          ) : null}
          {snap.backfilledBands > 0 ? (
            <Flag>
              {plural(snap.backfilledBands, 'row was', 'rows were')} sized after the event rather
              than at it, on the columns the ledger held at the time. Those rows are banded on less
              than a new row is, which usually means they land lower.
            </Flag>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-7">
        <Block
          title="Where it came from, week by week"
          hint="Hours returned, stacked by what the platform was doing. Unvalued work is not in here."
        >
          <StackedWeeks
            stacks={snap.weeks.map(w => ({
              at: w.at,
              total: w.total,
              parts: [
                { key: 'workflow', value: w.workflow, fill: GROUP_FILL.workflow },
                { key: 'chat', value: w.chat, fill: GROUP_FILL.chat },
                { key: 'ingestion', value: w.ingestion, fill: GROUP_FILL.ingestion },
                { key: 'govt', value: w.govt, fill: GROUP_FILL.govt },
              ],
            }))}
            labelFor={formatDate}
          />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem] text-ink-500">
            {snap.groups.map(g => (
              <span key={g.group} className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-sm ${GROUP_FILL[g.group]}`} />
                {GROUP_LABEL[g.group]}
              </span>
            ))}
          </div>
        </Block>

        <Block title="What gave it back" hint="The same hours, by the kind of work behind them.">
          <Bars
            rows={snap.groups.map(g => ({
              key: g.group,
              label: GROUP_LABEL[g.group],
              value: g.hours,
              caption: `${fmtHours(g.hours)}, ${fmtInr(g.inr)}, from ${fmtInt(g.valued)} of ${fmtInt(g.counted)}`,
            }))}
          />
          <Note>
            The two counts on each line are how many of that kind of work could be valued and how
            many happened. Chat the platform raises for itself, a workflow suggestion or a name for
            one, is in neither: there was never a manual version of that job to save.
          </Note>
        </Block>

        <Block
          title="Hard work or easy work"
          hint="Share of the work against share of the value, by how big the job was. A large figure coming out of low band work means something different from the same figure coming out of high band work."
        >
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
            {snap.bands.map(b => (
              <div key={b.band}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.875rem] font-medium text-ink-900">{BAND_LABEL[b.band]}</span>
                  <span className="text-[0.875rem] tabular-nums text-ink-500">
                    {b.hours === 0 ? 'not valued' : `${fmtHours(b.hours)}, ${fmtInr(b.inr)}`}
                  </span>
                </div>
                <div className="mt-2">
                  <PairBar
                    leftPct={b.eventsPct}
                    rightPct={b.valuePct}
                    leftLabel="of the work"
                    rightLabel="of the value"
                    leftText={b.eventsPct === 0 && b.counted > 0 ? 'under 1%' : undefined}
                    rightText={b.valuePct === 0 && b.hours > 0 ? 'under 1%' : undefined}
                  />
                </div>
                <p className="mt-1.5 text-[0.75rem] text-ink-400">
                  {fmtInt(b.valued)} of {fmtInt(b.counted)} valued
                </p>
              </div>
            ))}
          </div>
          <Note>
            The three add up to the headline. Setup a batch avoided sits with the band of the
            workflow that ran it, because that is the work it belonged to.
          </Note>
        </Block>

        <Block
          title="The workflows that gave back the most"
          hint="Sorted by hours returned. Open a manual figure to see the control it was read off."
        >
          <Table
            columns={[
              { head: 'Workflow' },
              { head: 'Band' },
              { head: 'Control' },
              { head: 'Runs', align: 'right' },
              { head: 'Middle run', align: 'right' },
              { head: 'By hand', align: 'right' },
              { head: 'How we know' },
              { head: 'Hours back', align: 'right' },
              { head: 'Value', align: 'right' },
            ]}
            rows={snap.workflows.map(w => {
              const control = w.citation ? CONTROL_BY_ID.get(w.citation.controlId) : undefined;
              return [
                <span key="n">
                  {w.name}
                  {w.divergencePct !== null && w.divergencePct > settings.divergenceThresholdPct ? (
                    <span className="mt-0.5 block text-[0.75rem] text-ink-500">
                      A timing on this sits {fmtPct(w.divergencePct)} away from the document
                    </span>
                  ) : null}
                  {w.stale ? (
                    <span className="mt-0.5 block text-[0.75rem] text-ink-500">
                      The figure behind it was last confirmed more than{' '}
                      {settings.benchmarkStaleMonths === 12
                        ? 'a year'
                        : `${fmtInt(settings.benchmarkStaleMonths)} months`}{' '}
                      ago, and is still used
                    </span>
                  ) : null}
                </span>,
                <span key="b" className="text-ink-500">{BAND_LABEL[w.band]}</span>,
                w.controlIds.length > 0 ? w.controlIds.join(', ') : <span key="d" className="text-ink-400">none</span>,
                fmtInt(w.runs),
                fmtSeconds(w.medianSecs),
                w.manualMinutes === null
                  ? <span key="m" className="text-ink-400">not established</span>
                  : control && w.citation
                    ? (
                      <Cite
                        key="c"
                        label={fmtMinutes(w.manualMinutes)}
                        document={w.citation.document}
                        page={w.citation.page}
                        controlId={w.citation.controlId}
                        basis={EFFORT_BASIS_LABEL[control.effortBasis]}
                        description={control.description}
                        procedure={control.testProcedure}
                      />
                    )
                    : fmtMinutes(w.manualMinutes),
                <span key="t" className="inline-flex flex-col items-start gap-1">
                  {w.basis ? <BasisChip basis={w.basis} small /> : <NotValued small />}
                  <span className="text-[0.75rem] text-ink-500">{w.source}</span>
                </span>,
                w.basis ? fmtOneDp(w.hours) : <span key="h" className="text-ink-400">—</span>,
                w.basis ? fmtInr(w.inr) : <span key="v" className="text-ink-400">—</span>,
              ];
            })}
            caption={
              <>
                A dash is not a nought. It means nothing documents or times what that workflow
                replaced, so the page refuses to put a number on it.
              </>
            }
          />
        </Block>

        {snap.unvalued.length > 0 ? (
          <Block
            title="Counted, and not valued"
            hint="Ranked by how much of it there is, so the biggest gap is the first line. Closing the top one moves the headline more than closing the rest together."
            right={
              <button
                type="button"
                onClick={onOpenControls}
                className="text-[0.875rem] text-ink-600 underline decoration-dotted underline-offset-2 hover:text-ink-900"
              >
                Controls and benchmarks
              </button>
            }
          >
            <Table
              columns={[
                { head: 'What' },
                { head: 'How much', align: 'right' },
                { head: 'Why it is not valued' },
                { head: 'What would fix it' },
              ]}
              rows={snap.unvalued.map(u => [
                u.what,
                fmtInt(u.events),
                u.reason,
                <span key="f" className="text-ink-500">{u.fix}</span>,
              ])}
              caption={
                <>
                  This work almost certainly saved time. Nobody has established how much, so none of
                  it is in the figures above.
                </>
              }
            />
          </Block>
        ) : null}

        <Block
          title="Runs started together"
          hint="A batch pays the setup once. By hand it is paid for every instance, so the setup a batch avoided is counted once for every run after the first."
        >
          {snap.batches.length === 0 ? (
            <Note>
              Nothing was run as a batch {phrase}, so there is no bulk saving to report.
            </Note>
          ) : (
            <>
              <Table
                columns={[
                  { head: 'Workflow' },
                  { head: 'Runs', align: 'right' },
                  { head: 'The batch took', align: 'right' },
                  { head: 'By hand, one after another', align: 'right' },
                  { head: 'Setup avoided', align: 'right' },
                  { head: 'Extra hours', align: 'right' },
                ]}
                rows={snap.batches.slice(0, 12).map(b => [
                  b.name,
                  fmtInt(b.runs),
                  fmtSeconds(b.wallClockSecs),
                  b.sequentialMinutes === null
                    ? <span key="s" className="text-ink-400">not established</span>
                    : fmtMinutes(b.sequentialMinutes),
                  b.setup === null
                    ? <span key="u" className="text-ink-400">not timed</span>
                    : `${fmtMinutes(b.setup.minutes)} × ${fmtInt(b.runs - 1)}`,
                  b.setup === null ? <span key="e" className="text-ink-400">—</span> : fmtOneDp(b.upliftHours),
                ])}
                caption={
                  <>
                    {plural(snap.batches.length, 'batch', 'batches')} {phrase}, worth{' '}
                    {fmtHours(snap.batchUpliftHours)} of avoided setup on top of what the runs
                    themselves saved. The elapsed time is the batch itself, start of the trigger to
                    the end of the last run, which barely grows with the number of runs in it. The
                    batches here are small, two and three runs, so this workspace still runs things
                    one at a time far more often than it runs them together. A workflow whose setup
                    nobody has timed earns no extra for batching and says so rather than showing a
                    nought.
                  </>
                }
              />
            </>
          )}
        </Block>

        <Block title="What it found" hint="Exceptions the runs threw up. Counted, and never priced.">
          {snap.exceptionTotal === 0 ? (
            <Note>Nothing was flagged {phrase}.</Note>
          ) : (
            <>
              <Lede>
                <Working sum="One row per exception on the staging table, counted on the date it was flagged. Severity is a column on that row.">
                  <span className="font-semibold tabular-nums text-ink-900">{fmtInt(snap.exceptionTotal)}</span>
                </Working>{' '}
                exceptions were raised {phrase}, {fmtInt(snap.exceptionHigh)} of them high.
              </Lede>
              <Table
                columns={[
                  { head: 'Workflow' },
                  { head: 'Exceptions', align: 'right' },
                  { head: 'High', align: 'right' },
                  { head: 'Medium', align: 'right' },
                  { head: 'Low', align: 'right' },
                ]}
                rows={snap.exceptions.map(e => [e.name, fmtInt(e.total), fmtInt(e.high), fmtInt(e.medium), fmtInt(e.low)])}
                caption="These are not turned into money, and there is no setting that would. Pricing a missed exception is exactly the invented number this page exists to refuse, and the count carries the argument on its own."
              />
            </>
          )}
        </Block>

        <Block
          title="Government lookups"
          hint="Once timed, the most checkable part of the model: a published price on one side and a timed portal visit on the other."
        >
          {snap.govt.length === 0 ? (
            <Note>No government lookup ran {phrase}.</Note>
          ) : (
            <Table
              columns={[
                { head: 'Lookup' },
                { head: 'Calls', align: 'right' },
                { head: 'Charged', align: 'right' },
                { head: 'Reused', align: 'right' },
                { head: 'Cost', align: 'right' },
                { head: 'By hand', align: 'right' },
                { head: 'Hours back', align: 'right' },
                { head: 'Value', align: 'right' },
              ]}
              rows={snap.govt.map(g => [
                g.label,
                fmtInt(g.calls),
                fmtInt(g.billed),
                fmtInt(g.cached),
                fmtInrExact(g.costInr),
                g.manualMinutes === null
                  ? <span key="m" className="text-ink-400">not timed</span>
                  : `${fmtInt(g.manualMinutes)} min`,
                g.manualMinutes === null ? <span key="h" className="text-ink-400">—</span> : fmtOneDp(g.hours),
                g.manualMinutes === null ? <span key="v" className="text-ink-400">—</span> : fmtInr(g.inr),
              ])}
              caption={
                <>
                  The provider charges for any answer, including no record found, so a lookup that
                  found nothing still cost money and still saved somebody a trip to the portal. It
                  may also reuse its own answer for fourteen days, and those calls cost nothing and
                  save the same trip. Both are counted for time and only the charged ones for money.
                  Lookups nobody has timed show calls and cost and no value at all.
                </>
              }
            />
          )}
        </Block>

        <Block
          title="What it costs to run"
          hint="Model calls converted at the rate stored for the range, plus what the government connector charged."
        >
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <Row
              label="Model calls"
              value={fmtInr(snap.cost.llmInr)}
              sub={`$${fmtOneDp(snap.cost.llmUsd)} at ${fmtInrExact(settings.usdToInr)} to the dollar`}
            />
            <Row label="Government connector" value={fmtInr(snap.cost.govtInr)} sub="Charged calls only" />
            <Row
              label="Running cost"
              value={fmtInr(snap.cost.totalInr)}
              sub={snap.cost.unpricedRows > 0
                ? `A floor. ${plural(snap.cost.unpricedRows, 'row has', 'rows have')} no published price for the model that ran.`
                : 'Every model that ran has a published price.'}
            />
            <Row
              label="Returned for every rupee spent"
              value={snap.cost.ratio === 0 ? 'no cost recorded' : `₹${fmtInt(snap.cost.ratio)}`}
              sub="Value created divided by running cost. Value is a floor, so this is too."
            />
          </div>
          {snap.weeks.length > 2 ? (
            <div className="mt-4">
              <p className="text-[0.75rem] uppercase tracking-wide text-ink-400">
                Returned for every rupee spent, week by week
              </p>
              <Spark
                points={snap.weeks
                  .filter(w => w.costInr > 0)
                  .map(w => ({ at: w.at, value: (w.total * settings.hourlyRateInr) / w.costInr }))}
                format={v => `₹${fmtInt(v)}`}
              />
            </div>
          ) : null}
        </Block>
      </div>
    </>
  );
}
