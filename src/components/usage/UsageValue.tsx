/**
 * The value view. What the quarter's audit work was worth.
 *
 * The whole chain is on screen in the order the guide states it: the work, what
 * a person would have taken, what we took, the hours saved, the people that
 * frees and what those hours are worth. Every step says whether it is recorded
 * or assumed, and the one assumed price carries its whole derivation on the
 * same screen as the money it produces.
 */

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import {
  ASSUMPTIONS, RATE_DERIVATION_STEPS, REVIEW_PROXY_NOTE, SENSITIVITY_CAUSE,
  SETTING_SHORT, SOURCE_LABEL,
  fmtDuration, fmtHours, fmtInt, fmtMoney, fmtMoneyExact, fmtMoneyFine, fmtOneDp, fmtPeople, fmtPrice,
  type Period, type UsageSettings, type UsageSnapshot,
} from '../../data/platform-usage-metrics';
import {
  Block, ChartOrTable, Drill, Grid, Lede, Line, Note, Num, Panel, Quiet, Unmeasured,
  type GroupSpec,
} from './usageChrome';

export interface ValueContext {
  data: UsageSnapshot;
  period: Period;
  settings: UsageSettings;
  showMoney: boolean;
  /** Named in the sentence, so a reader knows where a drill down goes. */
  onOpenRate: () => void;
  onOpenRuns: () => void;
}

export function valueGroups(ctx: ValueContext): GroupSpec[] {
  const { data, period, settings, showMoney } = ctx;
  const { value, cost } = data;

  /*
   * With no contract price at all there is no total, so there is no net figure
   * either. The page says work avoided rather than net value, because a
   * complete sounding label over a partial figure is the one thing it may never
   * print.
   */
  const netKnown = cost.complete && showMoney;
  const hoursPerQuarter = settings.hoursPerPersonPerMonth * period.months;

  const worth: GroupSpec = {
    id: 'worth',
    title: 'What the work was worth',
    answer: value.runs === 0
      ? `Nothing ran ${period.phrase}.`
      : showMoney
        ? `${fmtHours(value.hoursSaved)} hours saved, ${fmtMoney(value.rupees)} at the cost of an auditor hour.`
        : `${fmtHours(value.hoursSaved)} hours saved.`,
    node: value.runs === 0 ? (
      <Quiet>
        No check finished successfully {period.phrase}, so there is nothing to price. This is a count of
        nought rather than a figure we could not work out.
      </Quiet>
    ) : (
      <>
        <Lede>
          The work {period.phrase} would have taken <Num>{fmtHours(value.manualHours)}</Num> hours by hand.
          It took <Num>{fmtDuration(value.machineHours)}</Num> of machine time, so{' '}
          <Num>{fmtHours(value.hoursSaved)}</Num> hours were saved, which is{' '}
          <Num>{fmtPeople(value.people)}</Num> people freed for the {period.days} days
          {showMoney ? (
            <>
              {' '}and <Num>{fmtMoney(value.rupees)}</Num> at{' '}
              <Num>{fmtMoneyExact(settings.hourlyRate)}</Num> an auditor hour.
            </>
          ) : '.'}
        </Lede>
        {showMoney ? (
          <Note>
            The rate is the only number in that sentence we did not read off your own records.{' '}
            <Drill label="See where it comes from" onClick={ctx.onOpenRate} />.
          </Note>
        ) : (
          <Note>
            Your own work is counted in hours. Rupees are a whole company figure and they are read on the
            company view.
          </Note>
        )}

        <Block heading="How that was reached, step by step">
          <Panel>
            <Line
              label="The work, counted once for each population however often it was re-tested"
              value={`${fmtInt(value.coveredRows)} rows`}
              sub={`Recorded, across ${fmtInt(value.populations)} populations and ${fmtInt(value.runs)} successful runs. The repeats are counted separately, at ${fmtInt(value.checksPerformed)} row checks performed.`}
            />
            <Line
              label="What a person would have taken"
              value={`${fmtHours(value.manualHours)} hours`}
              sub={`Estimated. ${fmtInt(value.coveredRows)} rows at ${fmtInt(settings.manualReviewRate)} rows an hour${
                value.zeroRowRuns > 0
                  ? `, plus ${fmtInt(value.zeroRowRuns)} control tests that produced no rows at ${fmtOneDp(settings.manualControlTestHours)} hours each`
                  : ''
              }. That pace is a person reading a row in a spreadsheet, checking it against a rule and moving on.`}
            />
            <Line
              label="What we took"
              value={fmtDuration(value.machineHours)}
              sub={`Recorded to the millisecond. Failed runs are left out of every saving here and reported on their own, at ${fmtDuration(data.reliability.wastedHours)} of machine time spent on nothing.`}
            />
            <Line
              strong
              label="Hours saved"
              value={fmtHours(value.hoursSaved)}
              sub={`${fmtHours(value.manualHours)} less ${fmtDuration(value.machineHours)}, rounded down. A saving is always rounded towards zero.`}
            />
            <Line
              label="People that frees"
              value={fmtPeople(value.people)}
              sub={`${fmtHours(value.hoursSaved)} hours over the ${fmtInt(hoursPerQuarter)} hours one person is available to work in ${period.days} days.`}
            />
            {showMoney ? (
              <Line
                strong
                label="What the hours saved are worth"
                value={fmtMoney(value.rupees)}
                sub={`Estimated. ${fmtHours(value.hoursSaved)} hours at ${fmtMoneyExact(settings.hourlyRate)}, the cost of an hour of an auditor your own company employs.`}
              />
            ) : null}
          </Panel>
        </Block>

        {netKnown ? (
          <Note>
            Less the {fmtMoneyExact(cost.totalPaise / 100)} your contract charged for running it, the{' '}
            {period.days} days come to <Num>{fmtMoney(data.netRupees)}</Num> net.
          </Note>
        ) : showMoney ? (
          <Note>
            Your contract prices none of this yet, so there is no total to take off and no net figure. What
            is above is work avoided.
          </Note>
        ) : null}
      </>
    ),
  };

  const charged: GroupSpec = {
    id: 'charged',
    title: 'What the contract charged',
    answer: cost.complete
      ? `${fmtMoneyExact(cost.totalPaise / 100)} ${period.phrase}.`
      : 'Nothing on your contract is priced yet.',
    node: !cost.complete ? (
      <Unmeasured>
        No lookup used {period.phrase} has a contract price against it yet, so there is no total. The prices
        are contract terms our operations team seeds when the deal is signed. Nobody types one here.
      </Unmeasured>
    ) : (
      <>
        <Lede>
          Running that work charged <Num>{fmtMoneyExact(cost.totalPaise / 100)}</Num> under your contract
          {netKnown ? (
            <>, so {period.phrase} is worth <Num>{fmtMoney(data.netRupees)}</Num> net.</>
          ) : '.'}
        </Lede>
        <Note>
          These are the prices in force on the day of each call, as per your contract. They are terms our
          operations team seeds when the deal is signed, so there is nothing to set here and no field to
          type one into.
        </Note>
        <Grid
          head={['Lookup', 'Calls', 'Charged for', 'Price', 'Cost']}
          align={['left', 'right', 'left', 'right', 'right']}
          rows={cost.lines.map(l => [
            l.name,
            fmtInt(l.calls),
            l.billingUnit === 'run' ? `${fmtInt(l.batches)} runs` : `${fmtInt(l.calls)} rows`,
            l.pricePaise === null ? 'more than one price this window' : fmtPrice(l.pricePaise / 100),
            fmtMoneyExact(l.paise / 100),
          ])}
          caption={
            <>
              {cost.unpriced.length > 0
                ? `${cost.unpriced.map(l => l.name).join(', ')} ran ${fmtInt(cost.unpriced.reduce((s, l) => s + l.calls, 0))} calls that the contract does not price yet, so they are counted and charged nothing. `
                : ''}
              {cost.failedCalls > 0
                ? `${fmtInt(cost.failedCalls)} calls came back with nothing and the contract charges for answers, so they are charged nothing either.`
                : ''}
            </>
          }
        />
      </>
    ),
  };

  const rate: GroupSpec = {
    id: 'rate',
    title: 'Where the rate comes from',
    answer: `${fmtMoneyExact(settings.hourlyRate)} an hour, worked out from published pay data.`,
    node: (
      <>
        <Lede>
          <Num>{fmtMoneyExact(settings.hourlyRate)}</Num> an hour is the one figure on this page that does
          not come from your own records. It is what an hour of an auditor your company employs costs, and
          it is worked out below rather than picked.
        </Lede>
        <Note>
          Nothing in the product records what anybody is paid, so this comes from published pay data. It is
          the cost of employing an auditor, not the price a firm charges to sell you an audit hour, because
          section 138 of the Companies Act means our customers employ their own. It is the one number here
          your finance team can replace with a better one.
        </Note>
        <Grid
          head={['Step', 'Value', 'Where it comes from']}
          align={['left', 'right', 'left']}
          rows={RATE_DERIVATION_STEPS.map(s => [s.step, s.value, s.from])}
        />

        <Block heading="What those same hours are worth, four ways">
          <Lede>
            The hours saved are the same <Num>{fmtHours(value.hoursSaved)}</Num> in every row below. Only
            the price of an hour moves.
          </Lede>
          <Grid
            head={['How you get an audit hour', 'Cost of an hour', `${period.label} is worth`]}
            align={['left', 'right', 'right']}
            rows={data.sensitivity.map(s => [
              <>
                {s.basis}
                {s.ours ? <span className="text-brand-700"> · the figure this page carries</span> : null}
                <span className="block mt-1 text-[0.75rem] text-ink-500">{s.from}</span>
              </>,
              fmtMoneyExact(s.rate),
              fmtMoneyFine(s.rupees),
            ])}
            caption={SENSITIVITY_CAUSE}
          />
        </Block>

        <Block heading="What every figure above assumes">
          <Panel>
            {ASSUMPTIONS.map(key => (
              <Line
                key={key}
                label={SETTING_SHORT[key]}
                value={key === 'manualControlTestHours' ? fmtOneDp(settings[key]) : fmtInt(settings[key])}
                sub={`${SOURCE_LABEL[settings.source[key]]}. ${settings.note[key]}`}
              />
            ))}
          </Panel>
          <Note>{REVIEW_PROXY_NOTE}</Note>
        </Block>
      </>
    ),
  };

  const overTime: GroupSpec = {
    id: 'over-time',
    title: 'The same work, week by week',
    answer: `${fmtInt(data.buckets.length)} windows, and a population is credited to the first one that tested it.`,
    node: (
      <>
        <Lede>
          A population is credited once, to the window that first tested it {period.phrase}, so these add up
          to the <Num>{fmtInt(value.coveredRows)}</Num> rows above rather than to thirteen times them. What
          moves week to week is effort rather than coverage.
        </Lede>
        <ChartOrTable
          label={`Successful runs by ${period.days > 130 ? 'month' : period.days > 40 ? 'week' : 'day'}`}
          chart={
            <ChartAutoSizer height={200}>
              {({ width, height }) => (
                <BarChart width={width} height={height} data={data.buckets} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B5D82' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12, fill: '#6B5D82' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: '#F7F0FF' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                    formatter={(v: unknown) => [`${fmtInt(Number(v) || 0)} runs`, 'Successful'] as [string, string]}
                  />
                  <Bar dataKey="runs" fill="#6A12CD" radius={[3, 3, 0, 0]} />
                </BarChart>
              )}
            </ChartAutoSizer>
          }
          table={
            <Grid
              head={showMoney
                ? ['Window', 'Runs', 'Row checks performed', 'Rows newly covered', 'Hours avoided', 'Worth']
                : ['Window', 'Runs', 'Row checks performed', 'Rows newly covered', 'Hours avoided']}
              rows={data.buckets.map(b => (showMoney
                ? [b.label, fmtInt(b.runs), fmtInt(b.checks), fmtInt(b.newRows), b.hours > 0 ? fmtHours(b.hours) : '—', b.rupees > 0 ? fmtMoney(b.rupees) : '—']
                : [b.label, fmtInt(b.runs), fmtInt(b.checks), fmtInt(b.newRows), b.hours > 0 ? fmtHours(b.hours) : '—']))}
            />
          }
        />
        <Note>
          Rows newly covered add up to the coverage figure. Row checks performed do not, because a
          population re-tested every week is counted once in coverage and every time under checks
          performed. <Drill label="Open the workflow library" onClick={ctx.onOpenRuns} />.
        </Note>
      </>
    ),
  };

  const groups = [worth];
  if (showMoney) groups.push(charged, rate);
  groups.push(overTime);
  return groups;
}
