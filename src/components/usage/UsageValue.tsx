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
  ASSUMPTIONS, RATE_DERIVATION_LINE, RATE_DERIVATION_STEPS, REVIEW_PROXY_NOTE, SENSITIVITY_CAUSE,
  SETTING_SHORT, SOURCE_LABEL,
  fmtDuration, fmtHours, fmtInt, fmtMoney, fmtMoneyExact, fmtMoneyFine, fmtOneDp, fmtPeople, fmtPrice,
  type Period, type UsageSettings, type UsageSnapshot,
} from '../../data/platform-usage-metrics';
import {
  Block, ChartOrTable, Drill, Grid, Lede, Line, Note, Num, Panel, Quiet, Unmeasured, Working,
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
   * There is no net figure anywhere on this page and there must not be one.
   * What the contract charged covers the metered lookups only; it does not
   * include what the customer pays for the platform itself, which this product
   * does not record. Subtracting one from the work avoided and calling the
   * result net would tell a CFO we had taken off the cost of us when we had
   * taken off about one percent of it. The two figures sit side by side.
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
          We checked{' '}
          <Working sum={`${fmtInt(value.coveredRows)} rows across ${fmtInt(value.populations)} populations, counted once for each population however often it was re-tested. The repeats are counted separately, at ${fmtInt(value.checksPerformed)} row checks performed.`}>
            <Num>{fmtInt(value.coveredRows)}</Num>
          </Working>{' '}
          rows {period.phrase}. By hand that is about{' '}
          <Working
            estimated
            sum={`${fmtInt(value.coveredRows)} rows divided by ${fmtInt(settings.manualReviewRate)} rows an hour${
              value.zeroRowRuns > 0
                ? `, plus ${fmtInt(value.zeroRowRuns)} control tests that produced no rows at ${fmtOneDp(settings.manualControlTestHours)} hours each`
                : ''
            }. That pace is a person reading a row in a spreadsheet, checking it against a rule and moving on. A faster pace would make this smaller.`}
          >
            <Num>{fmtHours(value.manualHours)}</Num>
          </Working>{' '}
          hours. We did it in{' '}
          <Working sum={`Measured to the millisecond across ${fmtInt(value.runs)} successful runs. Failed runs are left out of every saving here and reported on their own, at ${fmtDuration(data.reliability.wastedHours)} of machine time spent on nothing.`}>
            <Num>{fmtDuration(value.machineHours)}</Num>
          </Working>
          , so{' '}
          <Working
            estimated
            sum={`${fmtHours(value.manualHours)} hours by hand, less the ${fmtDuration(value.machineHours)} we took. Always rounded down, because a saving rounded up is a saving nobody should believe.`}
          >
            <Num>{fmtHours(value.hoursSaved)}</Num>
          </Working>{' '}
          hours were saved.
        </Lede>

        <Lede>
          To do that by hand in the same window you would have needed about{' '}
          <Working
            estimated
            sum={`${fmtHours(value.hoursSaved)} hours divided by the ${fmtInt(hoursPerQuarter)} hours one auditor gives you over the ${fmtInt(period.days)} days this window covers. Nobody was freed, you simply never had to hire them.`}
          >
            <Num>{fmtPeople(value.people)}</Num>
          </Working>{' '}
          auditors
          {showMoney ? (
            <>
              , and that is{' '}
              <Working
                estimated
                sum={`${fmtHours(value.hoursSaved)} hours at ${fmtMoneyExact(settings.hourlyRate)} an hour. The hours come from your own records. The ${fmtMoneyExact(settings.hourlyRate)} is our estimate.`}
              >
                <Num>{fmtMoney(value.rupees)}</Num>
              </Working>{' '}
              of work avoided, at{' '}
              <Working estimated sum={RATE_DERIVATION_LINE}>
                <Num>{fmtMoneyExact(settings.hourlyRate)}</Num>
              </Working>{' '}
              an hour.
            </>
          ) : '.'}
        </Lede>

        {/*
          * The arithmetic lives in the hovers, but a rule is not arithmetic. The
          * three things below decide whether the figures above can be believed at
          * all, so they stay on screen where a reader meets them without asking.
          */}
        <Note>
          The rows are counted once for each population however often it was re-tested, so a check that
          re-reads the same list every week does not count it again. Those repeats are counted separately,
          at {fmtInt(value.checksPerformed)} row checks performed across {fmtInt(value.runs)} successful
          runs. The by-hand pace is a person reading a row in a spreadsheet, checking it against a rule and
          moving on, which is not full substantive testing. Failed runs are left out of every saving here
          and reported on their own, at {fmtDuration(data.reliability.wastedHours)} of machine time spent
          on nothing.
        </Note>
        {showMoney ? (
          <Note>
            The dotted figures are our estimates and the plain ones are your own records. Hover or tap the
            mark beside any figure to see how it was worked out.{' '}
            <Drill label="See where the rate comes from" onClick={ctx.onOpenRate} />.
          </Note>
        ) : (
          <Note>
            Your own work is counted in hours. Rupees are a whole company figure and they are read on the
            company view.
          </Note>
        )}

        {netKnown ? (
          <Note>
            Separately, your contract charged{' '}
            <Working sum="A recorded contract term, not an estimate. It covers the paid lookups this window and nothing else.">
              <Num>{fmtMoneyExact(cost.totalPaise / 100)}</Num>
            </Working>{' '}
            for the lookups {period.phrase}. It is shown beside the work avoided rather than taken off it,
            because it is only the metered lookups and does not include what you pay for the platform
            itself, which this page does not hold.
          </Note>
        ) : showMoney ? (
          <Note>
            Your contract prices none of this yet, so there is nothing charged to show beside it.
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
          {period.phrase}. That is what we billed for the paid lookups, and it does not include what you
          pay for the platform itself, so it is never taken off the work avoided.
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
    answer: `${fmtMoneyExact(settings.hourlyRate)} an hour. An estimate, and a round one on purpose.`,
    node: (
      <>
        <Lede>
          <Num>{fmtMoneyExact(settings.hourlyRate)}</Num> an hour is the one figure on this page we assume
          rather than read. It is an estimate, the numbers below are round on purpose, and it is not
          meant to be exact.
        </Lede>
        <Note>
          Nothing in this product records what anybody is paid, and no software can see salaries, so we
          work from what an auditor is roughly paid instead. The month leads because that is how an
          auditor is actually paid: firms may bill a client by the hour, but nobody employed is paid by
          the hour. The salary covers the whole month including weekends, and what you get back is about
          twenty working days, so the weekends are not free. Their cost is already inside the hourly
          figure. Published pay data for an internal auditor in India runs about ₹6.5 to ₹8 lakh a year,
          which is what we looked at, not what we are claiming. This is the one number here your finance
          team can replace with a better one.
        </Note>
        <Grid
          head={['', 'What it costs', 'How we got there']}
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
