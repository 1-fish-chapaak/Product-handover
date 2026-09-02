/**
 * What the platform did over the window, and what the contract charged for it.
 *
 * There is no money on this page except the charge. The net value hero, the
 * headline saving, the sensitivity table and the assumptions reference all
 * rested on a rate for an auditor hour that nothing in a customer tenant
 * records, so they are gone and the rate with them. What is left is recorded
 * volume, hours the team did not spend, and a price that is a term of the
 * contract rather than an estimate of ours.
 */

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import {
  DEDUPLICATION_LIMITS,
  fmtDuration, fmtInt, fmtMoneyExact, fmtPrice, plural,
  type AiUsageRow, type Bucket, type CostFigures, type Period,
} from '../../data/platform-usage-metrics';
import ChartAutoSizer from './ChartAutoSizer';
import { Block, DataTable, Drill, Empty, Fig } from './usageKit';

/**
 * What ran, week by week.
 *
 * It used to carry an hours avoided column and the by-hand rate that produced
 * it. Hours saved mixes a stock derived baseline with a flow, which is what
 * made a year to date come out smaller than the quarter inside it, so it is off
 * the page entirely and lives in the annual export. What is left is recorded
 * volume: runs, row checks and rows newly covered.
 */
export function ValueOverTime({
  buckets, period,
}: {
  buckets: Bucket[];
  period: Period;
}) {
  const active = buckets.filter(b => b.runs > 0);
  if (active.length === 0) {
    return (
      <Block id="over-time" title="What ran, week by week" lede={null}>
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
      title="What ran, week by week"
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
          head={['Window', 'Runs', 'Row checks performed', 'Rows newly covered', 'Machine time']}
          rows={buckets.map(b => [
            b.label, fmtInt(b.runs), fmtInt(b.checks), fmtInt(b.newRows),
            b.machineHours > 0 ? fmtDuration(b.machineHours) : '—',
          ])}
        />
      }
    />
  );
}

/* ── What it cost under the contract ─────────────────────────────────────── */

/**
 * The one money figure on the page, and the reason it may stay.
 *
 * It is not an estimate and it is not a saving. It is the sum the contract
 * charged for recorded volume, at prices our operations team seeded when the
 * deal was signed, so every rupee here is a term somebody signed rather than a
 * rate we picked.
 */
export function ContractCost({
  cost, period,
}: {
  cost: CostFigures;
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
      context={<>charged by the contract {period.phrase}</>}
      title="What it cost under the contract"
      lede={
        anyPriced
          ? (
            <>
              The paid lookups cost <Fig>{fmtMoneyExact(rupees)}</Fig> {period.phrase}. That is what
              the contract charged for recorded volume, so it is a price somebody signed rather than
              a figure worked out here.
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
          {/* The count sits in the body rather than in the fold, because the
              activity tab prints its own larger count and a reader has to be
              able to see both without opening anything. */}
          <p className="text-[0.875rem] text-ink-600">
            <Fig>{fmtInt(calls)}</Fig> calls on a contract price
            {cost.unpriced.length > 0 && (
              <>, and {fmtInt(cost.unpriced.length)}{' '}
                {cost.unpriced.length === 1 ? 'lookup with' : 'lookups with'} no price yet</>
            )}.
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
