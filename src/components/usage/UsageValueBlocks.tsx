/**
 * What the platform was worth, what it cost, and what those numbers rest on.
 *
 * The headline is the guide's worked example rendered as a page. It prices the
 * same work done by hand, at the assumed pace and the assumed rate, less the
 * time the machine actually took. The cost block is the other column of that
 * table, and it appears on the owner's view only.
 */

import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '../../data/platform-usage';
import {
  ASSUMPTIONS, DEDUPLICATION_LIMITS, RATE_BASIS, RATE_PER_DAY, RATE_PER_HOUR, REVIEW_PROXY_NOTE,
  SETTING_SHORT, SOURCE_LABEL,
  fmtDuration, fmtHours, fmtInt, fmtMoney, fmtMoneyExact, fmtOneDp, fmtPeople, fmtPrice, plural, priorLabel,
  type AiUsageRow, type Bucket, type CostFigures, type NumericSetting, type Period, type Scope,
  type Sensitivity, type UsageSettings, type ValueChange, type ValueFigures,
} from '../../data/platform-usage-metrics';
import ChartAutoSizer from './ChartAutoSizer';
import { Block, Compare, DataTable, Drill, Empty, Fig, MadeList, MadeRow, Maths, MathsSources, RestsOn, Stat, StatRow, Story } from './usageKit';

/* ── PU-05 · The net-value hero, and the four tiles under it ─────────────── */

/**
 * What the whole company view opens on.
 *
 * PU-05 is net value: what the work was worth, less what running the platform
 * charged. It only reads as net value when the cost is complete. While any
 * lookup is running without a contract price against it, the hero reads "work
 * avoided" instead, because "net value" minus an unknown is not net value, and
 * a partial figure under a complete-sounding label is the one thing this page
 * may never print.
 *
 * The four tiles are PU-01 to PU-04, each carrying its change against the
 * window of the same length immediately before this one.
 */
export function NetValueHero({
  value, change, cost, netRupees, period, settings,
}: {
  value: ValueFigures;
  change: ValueChange;
  cost: CostFigures;
  netRupees: number;
  period: Period;
  settings: UsageSettings;
}) {
  if (value.runs === 0) {
    return (
      <Block id="hero" title="What the platform was worth" lede={null}>
        <Empty
          kind="quiet"
          title={`No checks finished ${period.phrase}.`}
          detail="Nothing ran in this window, so there is nothing here to value. We do measure this; it was a quiet window."
        />
      </Block>
    );
  }

  const costRupees = cost.totalPaise / 100;
  const net = cost.complete;
  const calls = cost.lines.reduce((sum, line) => sum + line.calls, 0);
  const hoursPerWindow = settings.hoursPerPersonPerMonth * period.months;
  const window = period.label.toLowerCase().replace('this ', '');

  /*
   * The sum as somebody would say it: what it would have taken, what it took,
   * what that is worth, what it charged, what is left. Five lines, one number
   * each, in that order. The rate behind a line sits under it in small type.
   */
  const story: { text: ReactNode; value: string; note?: ReactNode; strong?: boolean }[] = [
    {
      text: <>Checking the {fmtInt(value.coveredRows)} records by hand</>,
      value: `${fmtHours(value.manualHours)} hours`,
      note: <>if one person gets through {fmtInt(settings.manualReviewRate)} records an hour</>,
    },
    {
      text: <>The platform did it in</>,
      value: fmtDuration(value.machineHours),
    },
    {
      text: <>Time your team did not spend</>,
      value: `${fmtHours(value.hoursSaved)} hours`,
      note: (
        <>
          the same as {fmtPeople(value.people)} people working the whole {window}, at{' '}
          {fmtInt(hoursPerWindow)} hours each
        </>
      ),
    },
    {
      text: <>What that time is worth</>,
      value: fmtMoney(value.rupees),
      note: <>the {fmtHours(value.hoursSaved)} hours saved, at {fmtMoneyExact(settings.hourlyRate)} an auditor hour</>,
    },
  ];

  if (net) {
    story.push(
      {
        text: <>What running the platform cost</>,
        value: fmtMoneyExact(costRupees),
        note: <>{fmtInt(calls)} verification lookups, at the price in your contract</>,
      },
      {
        text: <>So you are ahead by</>,
        value: fmtMoney(netRupees),
        strong: true,
      },
    );
  } else {
    story.push({
      text: <>What running the platform cost</>,
      value: '—',
      note: <>no lookup in this window has a contract price against it yet</>,
    });
  }

  const top = value.lists.slice(0, 3);
  const rest = value.lists.length - top.length;

  // One list, read twice: as the sum on screen and as its sources in the fold.
  const maths = [
          {
            sum: <>{fmtInt(value.coveredRows)} records ÷ {fmtInt(settings.manualReviewRate)} an hour</>,
            answer: `${fmtHours(value.manualHours)} hours by hand`,
            from: (
              <>
                Records: from your runs. {fmtInt(settings.manualReviewRate)} an hour: our estimate,
                and here is the whole of it. A {RATE_BASIS.shiftHours} hour shift is about{' '}
                {RATE_BASIS.checkingHours} hours of real checking once meetings, review calls and
                lunch come out. At {RATE_BASIS.secondsPerRecord} seconds a record that is{' '}
                {fmtInt(RATE_PER_HOUR)} an hour, or {fmtInt(RATE_PER_DAY)} in a day. Argue with any of
                those three and every figure below moves with you.
              </>
            ),
          },
          {
            sum: <>{fmtHours(value.manualHours)} hours − {fmtDuration(value.machineHours)} the platform took</>,
            answer: `${fmtHours(value.hoursSaved)} hours saved`,
            from: <>The {fmtDuration(value.machineHours)} is measured, from the runs themselves.</>,
          },
          {
            sum: <>{fmtHours(value.hoursSaved)} hours ÷ {fmtInt(hoursPerWindow)} hours one person works</>,
            answer: `${fmtPeople(value.people)} people for the ${window}`,
            from: <>{fmtInt(settings.hoursPerPersonPerMonth)} hours a month: 8 hours a day across 20 working days.</>,
          },
          {
            sum: <>{fmtHours(value.hoursSaved)} hours saved × {fmtMoneyExact(settings.hourlyRate)} an hour</>,
            answer: fmtMoney(value.rupees),
            from: (
              <>
                The hours saved are priced, not the {fmtHours(value.manualHours)} by hand, so the
                money never claims back the {fmtDuration(value.machineHours)} the platform spent.{' '}
                {fmtMoneyExact(settings.hourlyRate)} an hour is ours, not yours. Nothing in the
                product records what anybody is paid, so this is the softest number here
                {net && <>. Your contract charged {fmtMoneyExact(costRupees)} to run the platform, which leaves {fmtMoney(netRupees)}</>}.
              </>
            ),
          },
        ];

  return (
    <Block
      id="hero"
      title="What the platform was worth"
      lede={
        <>
          The platform checked <Fig>{fmtInt(value.coveredRows)}</Fig> records {period.phrase}, across{' '}
          <Fig>{fmtInt(value.runs)}</Fig> checks:{' '}
          {top.map((list, i) => (
            <span key={list.name}>
              <Fig>{fmtInt(list.size)}</Fig> {list.name.toLowerCase()}
              {i < top.length - 1 ? ', ' : ''}
            </span>
          ))}
          {rest > 0 && <> and <Fig>{fmtInt(rest)}</Fig> more lists</>}.
        </>
      }
      hint="A list is counted once however often it is re-checked, so re-checking the same ledger every week does not inflate the figure."
      footer={<><MathsSources rows={maths} /><div className="mt-3"><Story rows={story} /></div></>}
    >
      {/*
        * The sum, on the page, with the real numbers in it.
        *
        * Every line here is one a reader can do on a calculator, and every input
        * says whether it came from their records or from us. The rate is the
        * only made-up number on the page, so it shows its own working too.
        */}
      <Maths rows={maths} showFrom={false} />

      {/*
        * No restatement of the saving here.
        *
        * The page opens with it in the strip and the sum below reaches it on
        * its third line. Printing it a third time in a tinted box was the
        * single loudest duplicate on the page. What the box did carry that
        * nothing else does is the comparison, so that one line stays.
        */}
      <p className="mt-4 text-[0.875rem] text-ink-600">{changeWord(change.hours, period)}</p>
    </Block>
  );
}

/** The comparison, said in words, once, under the figure it belongs to. */
function changeWord(pct: number | null, period: Period): string {
  if (pct === null) return '';
  if (Math.abs(pct) < 5) return `About the same as ${priorLabel(period)}.`;
  return `${pct > 0 ? 'Up' : 'Down'} ${fmtInt(Math.abs(pct))}% on ${priorLabel(period)}.`;
}

/* ── The headline ────────────────────────────────────────────────────────── */

export function HeadlineValue({
  value, prior, change, period, scope, settings, showMoney,
}: {
  value: ValueFigures;
  prior: ValueFigures;
  change: ValueChange;
  period: Period;
  scope: Scope;
  settings: UsageSettings;
  /** An auditor reads their own work in hours and never in rupees. */
  showMoney: boolean;
}) {
  if (value.runs === 0) {
    return (
      <Block id="headline" title="What it was worth" lede={null}>
        <Empty
          kind="quiet"
          title={`No checks finished ${period.phrase}.`}
          detail="Nothing ran in this window, so there is nothing here to value. We do measure this; it was a quiet window."
        />
      </Block>
    );
  }

  // "The platform" for the whole company, the team's own name for a team lead,
  // and "you" for somebody reading their own work.
  const who = scope.subject === 'the company' ? 'The platform' : scope.subject === 'you' ? 'You' : scope.subject;
  const yours = scope.subject === 'you';
  const hoursPerWindow = settings.hoursPerPersonPerMonth * period.months;
  const window = period.label.toLowerCase().replace('this ', '');

  const story: { text: ReactNode; value: string; note?: ReactNode; strong?: boolean }[] = [
    {
      text: <>Checking the {fmtInt(value.coveredRows)} records by hand</>,
      value: `${fmtHours(value.manualHours)} hours`,
      note: <>if one person gets through {fmtInt(settings.manualReviewRate)} records an hour</>,
    },
    {
      text: <>The platform did it in</>,
      value: fmtDuration(value.machineHours),
    },
    {
      text: yours ? <>Time you did not spend</> : <>Time the team did not spend</>,
      value: `${fmtHours(value.hoursSaved)} hours`,
      note: showMoney
        ? <>the same as {fmtPeople(value.people)} people working the whole {window}, at {fmtInt(hoursPerWindow)} hours each</>
        : <>out of the {fmtInt(hoursPerWindow)} hours one person works in a {window}</>,
      strong: !showMoney,
    },
  ];

  if (showMoney) {
    story.push({
      text: <>What that time is worth</>,
      value: fmtMoney(value.rupees),
      note: <>the {fmtHours(value.hoursSaved)} hours saved, at {fmtMoneyExact(settings.hourlyRate)} an auditor hour</>,
      strong: true,
    });
  }

  return (
    <Block
      id="headline"
      title="What it was worth"
      lede={
        <>
          {who} checked <Fig>{fmtInt(value.coveredRows)}</Fig> records {period.phrase}, across{' '}
          <Fig>{fmtInt(value.runs)}</Fig> checks.
        </>
      }
      hint={`A list of records is counted once however often it is re-checked. ${fmtInt(prior.runs)} checks in ${priorLabel(period)}.`}
      footer={<Story rows={story} />}
    >
      <Compare
        rows={[
          {
            label: 'Doing it by hand',
            value: `about ${fmtHours(value.manualHours)} hours`,
            amount: value.manualHours,
            tone: 'muted',
            note: (
              <>
                our estimate, at {fmtInt(settings.manualReviewRate)} records an hour: a{' '}
                {RATE_BASIS.shiftHours} hour shift, about {RATE_BASIS.checkingHours} hours of real
                checking, {RATE_BASIS.secondsPerRecord} seconds a record
              </>
            ),
          },
          {
            label: 'The platform took',
            value: fmtDuration(value.machineHours),
            amount: value.machineHours,
            note: <>from your records</>,
          },
        ]}
      />

      <div className="mt-5 rounded-lg bg-brand-50/60 border border-brand-100 px-5 py-5">
        <p className="text-[2.5rem] font-semibold text-ink-900 leading-none tabular-nums">
          {fmtHours(value.hoursSaved)} hours
        </p>
        <p className="mt-2 text-[1rem] text-ink-700">
          of work {yours ? 'you' : 'the team'} did not have to do
          {showMoney && <>, about <Fig>{fmtPeople(value.people)}</Fig> people for the {window}</>}.
        </p>
        <p className="mt-1 text-[0.75rem] text-ink-500">{changeWord(change.hours, period)}</p>
      </div>

      {showMoney && (
        <p className="mt-4 text-[0.875rem] text-ink-600 leading-relaxed max-w-[80ch]">
          Put a price on those <Fig>{fmtHours(value.hoursSaved)}</Fig> saved hours and it comes to{' '}
          <Fig>{fmtMoney(value.rupees)}</Fig>, at our {fmtMoneyExact(settings.hourlyRate)} an auditor hour. That rate is ours rather than yours,
          so treat the money as an estimate and the hours as the firmer number.
        </p>
      )}
    </Block>
  );
}

/* ── Value over time ─────────────────────────────────────────────────────── */

/**
 * What the window looked like week by week.
 *
 * The bars are runs, because runs are what vary. Coverage does not vary: once a
 * population has been tested it stays tested, so it is credited to the bucket
 * that first reached it and never counted again. The block therefore says where
 * the coverage was reached and what the rest of the window bought instead, and
 * it does not draw the same rows thirteen times.
 */
export function ValueOverTime({
  buckets, period, settings, showMoney,
}: {
  buckets: Bucket[];
  period: Period;
  settings: UsageSettings;
  showMoney: boolean;
}) {
  const active = buckets.filter(b => b.runs > 0);
  if (active.length === 0) {
    return (
      <Block id="over-time" title="Value over time" lede={null}>
        <Empty kind="quiet" title={`Nothing ran ${period.phrase}, so there is no shape to show.`} />
      </Block>
    );
  }

  const busiest = [...active].sort((a, b) => b.runs - a.runs)[0];
  const bought = buckets.filter(b => b.newRows > 0);
  const lastBought = bought[bought.length - 1];
  const totalRuns = buckets.reduce((sum, b) => sum + b.runs, 0);

  /*
   * A handful of runs has no shape, and saying "the busiest stretch was 1 Mar,
   * at 1 run" makes the page sound like it is reading a formula out loud. Below
   * the floor the block says how little there was and stops, and the "all of the
   * coverage was reached by" line goes with it: on two runs it is arithmetic
   * rather than a finding.
   *
   * The chart goes too. One bar standing in a month of empty axis is a drawing
   * of nothing, and it reads as a page that failed to load rather than a month
   * with one run in it. The sentence says what happened and the numbers stay one
   * click away.
   */
  const thin = totalRuns < 5 || busiest.runs <= 1;
  const runsAfter = buckets
    .filter(b => lastBought && b.from > lastBought.from)
    .reduce((s, b) => s + b.runs, 0);

  return (
    <Block
      id="over-time"
      title="Value over time"
      lede={
        thin
          ? (
            <>
              Only <Fig>{fmtInt(totalRuns)}</Fig> {totalRuns === 1 ? 'check' : 'checks'} finished{' '}
              {period.phrase}
              {active.length === 1 && (
                <>, {totalRuns === 1 ? 'on' : 'all on'} <Fig>{active[0].label}</Fig></>
              )}. That is too little to have a busy stretch or a shape worth drawing, so the numbers
              are below rather than a chart.
            </>
          )
          : (
            <>
              The busiest stretch was <Fig>{busiest.label}</Fig>, at <Fig>{fmtInt(busiest.runs)}</Fig>{' '}
              {busiest.runs === 1 ? 'run' : 'runs'}.
              {lastBought && <> All of the coverage {period.phrase} was reached by <Fig>{lastBought.label}</Fig>.</>}
            </>
          )
      }
      hint={
        <>
          Bars are runs. A population is credited to the window once, on the day it was first tested,
          so no two bars count the same rows.
          {runsAfter > 0 && (
            <> The {fmtInt(runsAfter)} runs after the coverage was reached re-tested populations that
              were already covered, which catches problems sooner without widening the coverage.</>
          )}
        </>
      }
      chart={thin ? undefined : (
        <ChartAutoSizer height={220}>
          {({ width, height }) => (
            <BarChart width={width} height={height} data={buckets} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B5D82' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#6B5D82' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: '#F7F0FF' }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                formatter={(v: unknown) => [`${fmtInt(Number(v) || 0)} runs`, 'Successful'] as [string, string]}
              />
              <Bar dataKey="runs" fill="#6A12CD" radius={[3, 3, 0, 0]} />
            </BarChart>
          )}
        </ChartAutoSizer>
      )}
      table={
        <DataTable
          head={showMoney
            ? ['Window', 'Runs', 'Row checks performed', 'Rows newly covered', 'Hours avoided', 'Value']
            : ['Window', 'Runs', 'Row checks performed', 'Rows newly covered', 'Hours avoided']}
          rows={buckets.map(b => (showMoney
            ? [b.label, fmtInt(b.runs), fmtInt(b.checks), fmtInt(b.newRows), b.hours > 0 ? fmtHours(b.hours) : '—', b.rupees > 0 ? fmtMoney(b.rupees) : '—']
            : [b.label, fmtInt(b.runs), fmtInt(b.checks), fmtInt(b.newRows), b.hours > 0 ? fmtHours(b.hours) : '—']))}
        />
      }
      footer={<RestsOn settings={settings} keys={showMoney ? ['manualReviewRate', 'hourlyRate'] : ['manualReviewRate']} />}
    />
  );
}

/* ── Cost, and what is left ──────────────────────────────────────────────── */

/**
 * The only block that carries money out as well as in, and the only one an
 * owner sees. Everything here is recorded volume priced at the contract, so it
 * says "as per your contract" and means it.
 */
export function CostAndNetValue({
  cost, value, netRupees, period,
}: {
  cost: CostFigures;
  value: ValueFigures;
  netRupees: number;
  period: Period;
}) {
  const rupees = cost.totalPaise / 100;
  const anyPriced = cost.lines.length > 0;
  const calls = cost.lines.reduce((sum, line) => sum + line.calls, 0);

  /*
   * The activity tab counts every attempt and this block counts what the
   * contract charges for, so the two figures differ by two things: lookups our
   * operations team has not priced yet, and calls that came back with nothing.
   * Both were already named on this block, neither carried a number, and a
   * reader was left to guess at the gap between two counts of the same thing.
   */
  const unpricedCalls = cost.unpriced.reduce((sum, line) => sum + line.calls, 0);
  const attempted = calls + unpricedCalls + cost.failedCalls;

  return (
    <Block
      id="cost"
      code="COST-CONTRACT"
      figure={fmtMoneyExact(rupees)}
      context={<>charged by the contract {period.phrase}, leaving {fmtMoney(netRupees)} of the work avoided</>}
      title="What it cost, and what is left"
      lede={
        anyPriced
          ? (
            <>
              The paid lookups cost <Fig>{fmtMoneyExact(rupees)}</Fig> {period.phrase}, which leaves{' '}
              <Fig>{fmtMoney(netRupees)}</Fig> of the <Fig>{fmtMoney(value.rupees)}</Fig> avoided.
            </>
          )
          : (
            <>
              No lookup in this window has a contract price against it yet, so the cost line is blank
              instead of zero. Fixing that is our job.
            </>
          )
      }
      hint="Volume is recorded run by run. The price is a term of your contract, set by our operations team when the deal was signed."
      footer={
        <>
          {attempted > calls && (
            <>
              The activity tab counts {fmtInt(attempted)} lookup calls and this block counts{' '}
              {fmtInt(calls)}. The other {fmtInt(attempted - calls)} are counted and charged nothing:{' '}
              {unpricedCalls > 0 && <>{fmtInt(unpricedCalls)} ran on a lookup our operations team has not priced yet</>}
              {unpricedCalls > 0 && cost.failedCalls > 0 && <>, and </>}
              {cost.failedCalls > 0 && <>{fmtInt(cost.failedCalls)} went out and came back with nothing</>}.{' '}
            </>
          )}
          Nothing else here is turned into money. The Concierge recorded{' '}
          {fmtMoneyExact(cost.conciergePaise / 100)} for itself across {fmtInt(cost.conciergeJobsPriced)} jobs
          and {fmtInt(cost.conciergeJobsUnpriceable)} more have no cost code at all. Chat is estimated from
          text length, and the SOP to RACM pipeline records nothing about what it consumes, so{' '}
          {fmtInt(cost.sopCacheHits)} of its {fmtInt(cost.sopJobs)} jobs used no AI at all. A blended AI
          cost would be half real and half guess, and nobody could defend it, so there is not one on this page.
        </>
      }
    >
      {anyPriced && (
        <>
          {/* The sum above reaches the money, so this block prints the charge
              and the net once, as its own head, and then the lines behind it. */}
          <p className="text-[0.875rem] text-ink-600">
            <Fig>{fmtInt(calls)}</Fig> calls on a contract price
            {cost.unpriced.length > 0 && <>, and {fmtInt(cost.unpriced.length)} lookup with no price yet</>}.
          </p>

          {/* The twelve priced lines are the evidence behind the total, not the
              answer. They open when somebody wants to check the total. */}
          <div className="mt-4">
            <Drill label={`Open the ${fmtInt(cost.lines.length)} lookups behind that figure`}>
              <DataTable
                head={['Lookup', 'Vendor', 'Calls', 'Charged for', 'Price', 'Cost']}
                numericFrom={2}
                rows={cost.lines.map(line => [
                  line.name,
                  line.vendor ?? '—',
                  fmtInt(line.calls),
                  line.billingUnit === 'run' ? `${fmtInt(line.batches)} runs` : `${fmtInt(line.calls)} rows`,
                  line.prices.length > 1
                    ? line.prices.map(p => fmtPrice(p.pricePaise / 100)).join(' then ')
                    : fmtPrice((line.pricePaise ?? 0) / 100),
                  fmtMoneyExact(line.paise / 100),
                ])}
              />
            </Drill>
          </div>
        </>
      )}

      {cost.unpriced.length > 0 && (
        <div className="mt-4">
          <Empty
            kind="unmeasured"
            title={`${plural(cost.unpriced.length, 'lookup ran', 'lookups ran')} without a contract price: ${cost.unpriced.map(l => l.name).join(', ')}.`}
            detail="Their calls are counted and charged nothing. Getting them on the contract is our job, not yours."
          />
        </div>
      )}
    </Block>
  );
}

/* ── One assumption swings everything ────────────────────────────────────── */

export function SensitivityBlock({ rows, settings }: { rows: Sensitivity[]; settings: UsageSettings }) {
  if (rows.length === 0 || rows[1].rupees === 0) return null;
  return (
    <Block
      id="sensitivity"
      title="How much the pace matters"
      lede={
        <>
          At <Fig>{fmtInt(rows[0].rate)}</Fig> rows an hour the same work comes to{' '}
          <Fig>{fmtMoney(rows[0].rupees)}</Fig> of hand checking, and at{' '}
          <Fig>{fmtInt(rows[2].rate)}</Fig> it comes to <Fig>{fmtMoney(rows[2].rupees)}</Fig>.
        </>
      }
      hint="Everything on this tab rests on how many rows a person checks by hand in an hour. The same quarter is worth eight times as much at one end of that range as the other, which is why every figure resting on it is printed next to it. These are the hours by hand at each pace, before the machine time comes off, so each one sits a little above the saving at the top of the tab."

      table={
        <DataTable
          head={['Rows checked by hand per hour', 'Hours by hand', 'The same work in money']}
          rows={rows.map(r => [
            r.rate === settings.manualReviewRate ? `${fmtInt(r.rate)} (what this page uses)` : fmtInt(r.rate),
            fmtHours(r.hours),
            fmtMoney(r.rupees),
          ])}
        />
      }
    />
  );
}

/* ── The read-only reference behind the four assumptions ─────────────────── */


/**
 * The four assumptions, their sources, and every change on the record.
 *
 * There is no editor and no input field, here or anywhere else in this feature.
 * The two measurable ones replace themselves from the customer's own recorded
 * history once both guards pass. The other two are labelled defaults and say why
 * they will stay that way.
 */
export function AssumptionsReference({ settings }: { settings: UsageSettings }) {
  const measured = ASSUMPTIONS.filter(k => settings.source[k] === 'measured');
  const shown = (key: NumericSetting) =>
    (key === 'hourlyRate'
      ? fmtMoneyExact(settings[key])
      : key === 'manualControlTestHours' ? fmtOneDp(settings[key]) : fmtInt(settings[key]));

  return (
    <Block
      id="assumptions"
      title="What the page assumes"
      lede={
        measured.length > 0
          ? (
            <>
              Four numbers cannot be read off a record, so they are assumed and labelled.{' '}
              {measured.length === 1 ? 'One' : fmtInt(measured.length)} of them{' '}
              {measured.length === 1 ? 'has' : 'have'} already been replaced by your own recorded
              history.
            </>
          )
          : <>Four numbers cannot be read off a record. They are assumed and labelled as such, and your own history replaces them once there is enough of it.</>
      }
      hint="Read only. Nothing on this page, or anywhere else in this feature, asks anyone to type a number."
      footer={REVIEW_PROXY_NOTE}
    >
      {/* Name, number, and the one line that says where the number came from.
          "default 200" with nothing beside it is not an assumption anybody can
          argue with, so the reason sits on the row rather than in a fold. */}
      <ul className="divide-y divide-canvas-border border-t border-canvas-border">
        {ASSUMPTIONS.map(key => (
          <li key={key} className="py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.875rem] text-ink-800">{SETTING_SHORT[key]}</span>
              <span className="flex items-baseline gap-2 shrink-0">
                <span className="text-[0.75rem] text-ink-400">{SOURCE_LABEL[settings.source[key]]}</span>
                <span className="text-[0.875rem] font-semibold text-ink-900 tabular-nums">{shown(key)}</span>
              </span>
            </div>
            <p className="mt-1 text-[0.75rem] text-ink-500 leading-relaxed max-w-[80ch]">{settings.note[key]}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        {settings.changes.length === 0
          ? <Empty kind="quiet" title="Nothing has changed yet. Every value is the one it shipped with." />
          : (
            <Drill label={`${plural(settings.changes.length, 'change', 'changes')} on the record`} hideLabel="Hide the changes">
              <MadeList>
                {settings.changes.map((c, i) => (
                  <MadeRow
                    key={`${c.setting}-${i}`}
                    name={`${SETTING_SHORT[c.setting]} · ${c.from ?? '—'} to ${c.to}`}
                    madeBy={c.by}
                    when={formatDate(c.at)}
                    note={c.note}
                  />
                ))}
              </MadeList>
            </Drill>
          )}
      </div>
    </Block>
  );
}

/* ── Where the AI money goes, and what we can honestly say ───────────────── */

export function AiUsageByArea({ rows, period }: { rows: AiUsageRow[]; period: Period }) {
  const busiest = [...rows].sort((a, b) => b.count - a.count)[0];
  return (
    <Block
      id="ai-usage"
      title="What the AI did"
      lede={
        busiest && busiest.count > 0
          ? (
            <>
              The busiest AI surface {period.phrase} was <Fig>{busiest.surface}</Fig>, at{' '}
              <Fig>{fmtInt(busiest.count)}</Fig> {busiest.countLabel}.
            </>
          )
          : <>No AI surface was used {period.phrase}.</>
      }
      hint="Each surface is reported on its own, because what we can honestly say about the money behind it is different in every case."
      footer={
        <>
          {rows.map(row => (
            <span key={row.surface} className="block">
              <span className="text-ink-700">{row.surface}:</span> {row.money}
            </span>
          ))}
        </>
      }
    >
      <ul className="divide-y divide-canvas-border border-t border-canvas-border">
        {rows.map(row => (
          <li key={row.surface} className="py-2.5 flex items-baseline justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-[0.875rem] text-ink-800">{row.surface}</span>
              {/* The reason this count differs from the same thing counted
                  elsewhere, on screen rather than folded away. */}
              {row.note && <span className="block mt-0.5 text-[0.75rem] text-ink-500 leading-relaxed">{row.note}</span>}
            </span>
            <span className="text-[0.875rem] font-semibold text-ink-900 tabular-nums shrink-0">
              {fmtInt(row.count)} {row.countLabel}
            </span>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/* ── The limits that travel with the finding counts ──────────────────────── */

export function DeduplicationLimits({ beforeDeduplication }: { beforeDeduplication: number }) {
  return (
    <div className="text-[0.75rem] text-ink-500 leading-relaxed space-y-1">
      {DEDUPLICATION_LIMITS.map(line => <p key={line}>{line}</p>)}
      {beforeDeduplication > 0 && (
        <p>
          {fmtInt(beforeDeduplication)} of the findings in this window predate de-duplication and are
          counted apart from the rest.
        </p>
      )}
    </div>
  );
}
