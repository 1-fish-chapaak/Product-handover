/**
 * What the platform was worth, what it cost, and what those numbers rest on.
 *
 * The headline is the guide's worked example rendered as a page. It prices the
 * same work done by hand, at the assumed pace and the assumed rate, less the
 * time the machine actually took. The cost block is the other column of that
 * table, and it appears on the owner's view only.
 */

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '../../data/platform-usage';
import {
  DEDUPLICATION_LIMITS, REVIEW_PROXY_NOTE, SETTING_SHORT, SOURCE_LABEL,
  fmtDuration, fmtHours, fmtInt, fmtMoney, fmtMoneyExact, fmtOneDp, fmtPeople, fmtPrice, plural, priorLabel,
  type AiUsageRow, type Bucket, type CostFigures, type NumericSetting, type Period, type Scope,
  type Sensitivity, type UsageSettings, type ValueChange, type ValueFigures,
} from '../../data/platform-usage-metrics';
import ChartAutoSizer from './ChartAutoSizer';
import { Block, DataTable, Drill, Empty, Estimated, Fig, MadeList, MadeRow, RestsOn, Stat, StatRow, Working } from './usageKit';

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

  return (
    <Block
      id="hero"
      title={net ? 'Net value' : 'Work avoided'}
      lede={null}
      hint={
        net
          ? 'What the work was worth, less what running the platform charged under your contract.'
          : 'What the work was worth. Not every lookup has a contract price yet, so nothing is subtracted from it.'
      }
    >
      <div className="rounded-lg bg-brand-50/60 border border-brand-100 px-5 py-5">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-brand-700">
          {net ? 'Net value' : 'Work avoided'} · {period.label}
        </p>
        <p className="mt-1.5 text-[2.5rem] font-semibold text-ink-900 leading-none tabular-nums">
          {fmtMoney(net ? netRupees : value.rupees)}
          <Estimated />
        </p>
        <p className="mt-2.5 text-[0.875rem] text-ink-600 leading-relaxed max-w-[76ch]">
          {net
            ? <>{fmtMoney(value.rupees)} of work avoided, less {fmtMoneyExact(costRupees)} spent running the platform.</>
            : <>{fmtMoney(value.rupees)} of work avoided. No lookup in this window has a contract price against it yet, so there is nothing to subtract and the figure is not called net value.</>}
        </p>
      </div>

      {/*
        * Each tile says where its own number came from, in the same arithmetic
        * a reader could do on a calculator. "Those hours at the assumed cost of
        * an auditor hour" tells nobody anything; "7,140 hours at ₹1,200 an
        * hour" can be checked, and argued with, which is the point.
        */}
      <div className="mt-4">
        <StatRow>
          <Stat
            value={<>{fmtHours(value.hoursSaved)}<Estimated /></>}
            label="hours saved"
            sub={<>{fmtHours(value.manualHours)} hours by hand, less {fmtDuration(value.machineHours)} of machine time.</>}
            delta={change.hours}
            deltaLabel={priorLabel(period)}
          />
          <Stat
            long
            value={<>{fmtMoney(value.rupees)}<Estimated /></>}
            label="money saved"
            sub={<>{fmtHours(value.manualHours)} hours at {fmtMoneyExact(settings.hourlyRate)} an hour.</>}
            delta={change.rupees}
            deltaLabel={priorLabel(period)}
          />
          <Stat
            value={<>{fmtPeople(value.people)}<Estimated /></>}
            label="people equivalent"
            sub={
              <>
                {fmtHours(value.manualHours)} hours over the{' '}
                {fmtInt(settings.hoursPerPersonPerMonth * period.months)} hours one person works in{' '}
                {period.label.toLowerCase().replace('this ', 'a ')}.
              </>
            }
            delta={change.people}
            deltaLabel={priorLabel(period)}
          />
          {cost.complete
            ? (
              <Stat
                long
                value={fmtMoneyExact(costRupees)}
                label="cost to run"
                sub={<>{plural(cost.lines.reduce((sum, l) => sum + l.calls, 0), 'verification lookup', 'verification lookups')}, at the price in your contract.</>}
              />
            )
            : (
              <Stat
                value="—"
                label="cost to run"
                sub="No lookup here has a contract price against it yet, so there is no total to show."
              />
            )}
        </StatRow>
      </div>

      {cost.unpriced.length > 0 && (
        <p className="mt-4 pt-3 border-t border-canvas-border text-[0.75rem] text-ink-500 leading-relaxed max-w-[80ch]">
          {plural(cost.unpriced.length, 'lookup ran', 'lookups ran')} that your contract does not
          price yet: {cost.unpriced.map(l => l.name).join(', ')}.{' '}
          {cost.unpriced.length === 1 ? 'Its calls are' : 'Their calls are'} counted and you are
          charged nothing for {cost.unpriced.length === 1 ? 'it' : 'them'}. Getting{' '}
          {cost.unpriced.length === 1 ? 'it' : 'them'} on the contract is our job, not yours.
        </p>
      )}
    </Block>
  );
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

  // "The platform" for the whole company, the team's own name for a team lead.
  const who = scope.subject === 'the company' ? 'The platform' : scope.subject;

  const lede = showMoney
    ? (
      <>
        {who} checked{' '}
        <Fig>{fmtInt(value.coveredRows)}</Fig> rows {period.phrase} across <Fig>{fmtInt(value.runs)}</Fig> successful
        runs. By hand that is about <Fig>{fmtHours(value.manualHours)}</Fig> hours and{' '}
        <Fig>{fmtMoney(value.rupees)}</Fig> of auditor time. The machine took{' '}
        <Fig>{fmtDuration(value.machineHours)}</Fig>.
      </>
    )
    : (
      <>
        You checked <Fig>{fmtInt(value.coveredRows)}</Fig> rows {period.phrase} across{' '}
        <Fig>{fmtInt(value.runs)}</Fig> successful runs. By hand that is about{' '}
        <Fig>{fmtHours(value.manualHours)}</Fig> hours of work. The machine took{' '}
        <Fig>{fmtDuration(value.machineHours)}</Fig>.
      </>
    );

  /*
   * The sum, written out.
   *
   * Every figure in the row above comes off the same chain, and the middle of
   * that chain (the hours by hand) is the one nobody can see on the tiles. So
   * the steps are printed under the row with the source of each input beside
   * it, and a reader can check the whole thing on a calculator.
   */
  const hoursPerWindow = settings.hoursPerPersonPerMonth * period.months;
  const source = (key: NumericSetting) => SOURCE_LABEL[settings.source[key]];

  const working = [
    {
      expr: `${fmtInt(value.coveredRows)} rows`,
      means: `checked ${period.phrase}, with each population counted once`,
      source: 'measured',
    },
    {
      expr: `÷ ${fmtInt(settings.manualReviewRate)} rows an hour`,
      means: 'what one person gets through by hand',
      source: source('manualReviewRate'),
    },
  ];

  // The other branch: a run that tested a control without producing rows is
  // priced as one manual test rather than as rows, so it only appears when
  // there was one.
  if (value.zeroRowRuns > 0) {
    working.push({
      expr: `+ ${fmtInt(value.zeroRowRuns)} × ${fmtOneDp(settings.manualControlTestHours)} hours`,
      means: 'runs that tested a control without producing rows',
      source: source('manualControlTestHours'),
    });
  }

  working.push(
    { expr: `= ${fmtHours(value.manualHours)} hours`, means: 'the same work done by hand', source: 'estimated' },
    { expr: `less ${fmtDuration(value.machineHours)}`, means: 'what the machine actually took', source: 'measured' },
    { expr: `= ${fmtHours(value.hoursSaved)} hours saved`, means: 'rounded down, so the saving is never overstated', source: 'estimated' },
  );

  if (showMoney) {
    working.push({
      expr: `${fmtHours(value.manualHours)} hours × ${fmtMoneyExact(settings.hourlyRate)} an hour`,
      means: `= ${fmtMoneyExact(value.rupees)}, the blended cost of an auditor hour`,
      source: source('hourlyRate'),
    });
  }

  working.push({
    expr: `${fmtHours(value.manualHours)} hours ÷ ${fmtInt(hoursPerWindow)} hours`,
    means: `= ${fmtPeople(value.people)} people, at ${fmtInt(settings.hoursPerPersonPerMonth)} working hours a month across this window`,
    source: source('hoursPerPersonPerMonth'),
  });

  return (
    <Block id="headline" title="What it was worth" lede={lede}>
      <StatRow>
        <Stat
          size="lg"
          value={<>{fmtHours(value.hoursSaved)}<Estimated /></>}
          label="hours saved"
          sub="What the work would have taken by hand, less the time the machine took."
          delta={change.hours}
          deltaLabel={priorLabel(period)}
        />
        {showMoney && (
          <Stat
            size="lg"
            long
            value={<>{fmtMoney(value.rupees)}<Estimated /></>}
            label="the same work by hand"
            sub="What those hours would have cost in auditor time."
            delta={change.rupees}
            deltaLabel={priorLabel(period)}
          />
        )}
        <Stat
          size="lg"
          value={<>{fmtPeople(value.people)}<Estimated /></>}
          label="people freed, full time"
          sub="How many full-time people those hours add up to over this window."
          delta={change.people}
          deltaLabel={priorLabel(period)}
        />
        <Stat
          value={fmtInt(value.runs)}
          label="successful runs"
          sub={`Every figure here is built from these, over ${fmtInt(value.populations)} populations. ${fmtInt(prior.runs)} in ${priorLabel(period)}.`}
        />
      </StatRow>

      <Working rows={working} />
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
  const runsAfter = buckets
    .filter(b => lastBought && b.from > lastBought.from)
    .reduce((s, b) => s + b.runs, 0);

  return (
    <Block
      id="over-time"
      title="Value over time"
      lede={
        <>
          The busiest stretch was <Fig>{busiest.label}</Fig>, at <Fig>{fmtInt(busiest.runs)}</Fig>{' '}
          {busiest.runs === 1 ? 'run' : 'runs'}.
          {lastBought && (
            <> All of the coverage {period.phrase} was reached by <Fig>{lastBought.label}</Fig>
              {runsAfter > 0 && (
                <>. The <Fig>{fmtInt(runsAfter)}</Fig> runs after that re-tested populations that
                  were already covered, which catches problems sooner without widening the coverage</>
              )}.
            </>
          )}
        </>
      }
      hint="Bars are runs. A population is credited to the window once, on the day it was first tested, so no two bars count the same rows."
      chart={
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
      }
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

  return (
    <Block
      id="cost"
      title="What it cost, and what is left"
      lede={
        anyPriced
          ? (
            <>
              The paid lookups cost <Fig>{fmtMoneyExact(rupees)}</Fig> {period.phrase}, as per your contract.
              Against <Fig>{fmtMoney(value.rupees)}</Fig> of work avoided, that leaves{' '}
              <Fig>{fmtMoney(netRupees)}</Fig>.
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
    >
      {anyPriced && (
        <>
          <StatRow>
            <Stat size="lg" long value={fmtMoneyExact(rupees)} label="charged by the contract" sub={`${fmtInt(cost.lines.reduce((s, l) => s + l.calls, 0))} recorded calls`} />
            <Stat size="lg" long value={fmtMoney(netRupees)} label="net value" sub="work avoided, less what was charged" />
            <Stat value={fmtInt(cost.lines.length)} label="lookups with a price" />
            <Stat value={fmtInt(cost.unpriced.length)} label="lookups not priced yet" />
          </StatRow>

          <div className="mt-4">
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
          </div>
        </>
      )}

      {cost.unpriced.length > 0 && (
        <div className="mt-4">
          <Empty
            kind="unmeasured"
            title={`${plural(cost.unpriced.length, 'lookup ran', 'lookups ran')} without a contract price: ${cost.unpriced.map(l => l.name).join(', ')}.`}
            detail="Their calls are counted and charged nothing. The reminder goes to our operations team rather than to you, which is why it does not appear as an attention card. There would be nothing on it for you to do."
          />
        </div>
      )}

      <div className="mt-4 space-y-2">
        <p className="text-[0.875rem] text-ink-700 leading-relaxed">
          Nothing else here is turned into money. The Concierge recorded{' '}
          <Fig>{fmtMoneyExact(cost.conciergePaise / 100)}</Fig> for itself across{' '}
          <Fig>{fmtInt(cost.conciergeJobsPriced)}</Fig> jobs, and{' '}
          <Fig>{fmtInt(cost.conciergeJobsUnpriceable)}</Fig> more have no cost code at all. Chat is
          estimated from text length. The SOP-to-RACM pipeline records nothing about what it
          consumes, and <Fig>{fmtInt(cost.sopCacheHits)}</Fig> of its{' '}
          <Fig>{fmtInt(cost.sopJobs)}</Fig> jobs were served from the cache and used no AI at all.
        </p>
        <p className="text-[0.75rem] text-ink-500 leading-relaxed">
          So there is no blended AI cost anywhere on this page. Half of it would be real and half a
          guess, and nobody could defend that number if somebody questioned it.
        </p>
      </div>
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
          Everything above rests on one number: how many rows a person checks by hand in an hour.
          At <Fig>{fmtInt(rows[0].rate)}</Fig> the saving is <Fig>{fmtMoney(rows[0].rupees)}</Fig>,
          and at <Fig>{fmtInt(rows[2].rate)}</Fig> it is <Fig>{fmtMoney(rows[2].rupees)}</Fig>. The
          same quarter is worth eight times as much at one end as the other, so every figure that
          rests on the assumption is printed next to it.
        </>
      }
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

const ASSUMPTION_ORDER: NumericSetting[] = ['manualReviewRate', 'manualControlTestHours', 'hourlyRate', 'hoursPerPersonPerMonth'];

/**
 * The four assumptions, their sources, and every change on the record.
 *
 * There is no editor and no input field, here or anywhere else in this feature.
 * The two measurable ones replace themselves from the customer's own recorded
 * history once both guards pass. The other two are labelled defaults and say why
 * they will stay that way.
 */
export function AssumptionsReference({ settings }: { settings: UsageSettings }) {
  const measured = ASSUMPTION_ORDER.filter(k => settings.source[k] === 'measured');
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
    >
      <ul className="divide-y divide-canvas-border border-t border-canvas-border">
        {ASSUMPTION_ORDER.map(key => (
          <li key={key} className="py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.875rem] text-ink-800">{SETTING_SHORT[key]}</span>
              <span className="text-[0.875rem] font-semibold text-ink-900 tabular-nums shrink-0">
                {key === 'hourlyRate' ? fmtMoneyExact(settings[key]) : key === 'manualControlTestHours' ? fmtOneDp(settings[key]) : fmtInt(settings[key])}
              </span>
            </div>
            <p className="mt-0.5 text-[0.75rem] text-ink-400">{SOURCE_LABEL[settings.source[key]]}</p>
            <p className="mt-1 text-[0.75rem] text-ink-500 max-w-[80ch] leading-relaxed">{settings.note[key]}</p>
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

      <p className="mt-4 text-[0.75rem] text-ink-500 max-w-[80ch] leading-relaxed">
        {REVIEW_PROXY_NOTE} Both guards have to pass before anything is replaced: at least 90 days
        of history and a large enough sample, with the outliers trimmed, because an exception left
        open over a weekend did not take 60 hours to review.
      </p>
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
              <Fig>{fmtInt(busiest.count)}</Fig> {busiest.countLabel}. Each one is reported on its
              own, because what we can honestly say about the money behind them is different in
              every case.
            </>
          )
          : <>No AI surface was used {period.phrase}.</>
      }
    >
      <ul className="divide-y divide-canvas-border border-t border-canvas-border">
        {rows.map(row => (
          <li key={row.surface} className="py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.875rem] text-ink-800">{row.surface}</span>
              <span className="text-[0.875rem] font-semibold text-ink-900 tabular-nums shrink-0">
                {fmtInt(row.count)} {row.countLabel}
              </span>
            </div>
            <p className="mt-1 text-[0.75rem] text-ink-500 max-w-[80ch] leading-relaxed">{row.money}</p>
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
