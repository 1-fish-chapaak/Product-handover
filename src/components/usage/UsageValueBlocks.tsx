/**
 * What the work was worth, and what it cost.
 *
 * PU-01 hours saved · PU-02 money · PU-03 people · PU-04 cost to run ·
 * PU-05 net value · PU-09 work volume · PU-12 AI usage by area ·
 * PU-19 lookup volume · PU-21 created this period.
 *
 * Two rules run through all of it. Every value figure is an estimate and says
 * so, with the assumptions it rests on printed underneath. And the cost side
 * shows what the vendor actually billed or nothing at all: a partial total under
 * a complete-sounding label is a defect, not a rounding.
 */

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { formatDate } from '../../data/platform-usage';
import {
  fmtHours, fmtInt, fmtMoney, fmtMoneyExact, fmtOneDp, fmtPaise, fmtRate, fmtUsd,
  deltaPct, grainFor, priorLabel,
  type AiUsageRow, type ChangeHistory, type CostToRun, type CreatedCount, type LookupVolume,
  type NetValue, type Period, type Scope, type TimeBucket, type UsageSettings, type ValueFigures,
  type WorkVolume as WorkVolumeFigures,
} from '../../data/platform-usage-metrics';
import ChartAutoSizer from './ChartAutoSizer';
import { AccuracyTag, Bars, Block, DataTable, Drill, Empty, Fig, MadeList, MadeRow, RestsOn, Stat, StatRow } from './usageKit';

const BRAND = '#6A12CD';
const BRAND_SOFT = '#DCBBFD';
const HAIRLINE = '#E5E7EB';
const INK_MUTED = '#6B5D82';

/* ──────────────────────────────────────────────────────────────────────────
 * PU-01 · PU-02 · PU-03 · PU-05 — the headline
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The hero.
 *
 * While the cost is unknown the hero is called "Work avoided" and shows what the
 * work was worth. It becomes "Net value" only when every month in the window has
 * its bill, because "net value" over one real number minus an unknown is not a
 * net of anything.
 *
 * The auditor's view shows hours and never rupees. "You saved 84 hours" reads as
 * an achievement; "you saved ₹1,00,800" reads as somebody pricing your work.
 */
export function HeadlineValue({
  value,
  priorValue,
  net,
  cost,
  settings,
  period,
  scope,
  subject,
  changes,
  showMoney,
  onOpenCost,
}: {
  value: ValueFigures;
  priorValue: ValueFigures | null;
  net: NetValue;
  cost: CostToRun;
  settings: UsageSettings;
  period: Period;
  scope: Scope;
  subject: string;
  changes: ChangeHistory;
  showMoney: boolean;
  onOpenCost: () => void;
}) {
  const hoursDelta = deltaPct(value.hours, priorValue?.hours ?? null);
  const hoursPerWindow = settings.hoursPerPersonPerMonth * period.months;

  if (value.hours <= 0) {
    return (
      <Block
        id="value"
        title={showMoney ? 'Work avoided' : 'Time saved'}
        lede={null}
        hint="What the platform did instead of a person, priced at the assumptions below."
      >
        <Empty
          kind="quiet"
          title={`No completed runs for ${subject} in this window.`}
          detail="A run has to finish and report the rows it worked through before there is anything to value. Nothing is being estimated here in the meantime."
        />
      </Block>
    );
  }

  return (
    <Block
      id="value"
      title={showMoney ? net.headline : 'Time saved'}
      lede={
        <>
          The platform saved {subject} <Fig>{fmtHours(value.hours)}</Fig> {period.phrase}
          {hoursDelta !== null && <>, {hoursDelta >= 0 ? 'up' : 'down'} <Fig>{fmtOneDp(Math.abs(hoursDelta))}%</Fig> on {priorLabel(period)}</>}
          {'. '}
          It came from <Fig>{fmtInt(value.rowRuns)}</Fig> runs over <Fig>{fmtInt(value.rows)}</Fig> rows
          {value.testRuns > 0 && <> and <Fig>{fmtInt(value.testRuns)}</Fig> control tests the platform ran instead of a person</>}.
        </>
      }
      hint="Every figure here is an estimate, built from the assumptions printed underneath."
      footer={<RestsOn settings={settings} keys={showMoney ? ['manualReviewRate', 'manualControlTestHours', 'hourlyRate'] : ['manualReviewRate', 'manualControlTestHours']} history={changes} periodLabel={period.phrase} />}
    >
      {showMoney && (
        <div className="mb-5 rounded-lg bg-brand-50 px-5 py-4">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-brand-700">
            {net.headline} · {period.label}
          </p>
          <p className="mt-1.5 text-[2.5rem] font-semibold leading-none text-ink-900 tabular-nums">
            {fmtMoney(net.net ?? net.workAvoided)}
          </p>
          <p className="mt-2 text-[0.875rem] text-ink-700">
            {net.cost === null ? (
              <>
                {fmtMoney(net.workAvoided)} of work avoided. Nothing is deducted yet: your contract prices have
                not been loaded, so the page will not print a cost it does not have.
              </>
            ) : (
              <>
                {fmtMoney(net.workAvoided)} of work avoided, less {fmtMoneyExact(net.cost)} the paid lookups cost
                as per your contract
                {cost.unpriced.length > 0 && (
                  <>. {fmtInt(cost.unpriced.reduce((sum, row) => sum + row.calls, 0))} calls sit on APIs your
                    contract does not price yet, so they are counted and charged nothing</>
                )}
                .
              </>
            )}
          </p>
        </div>
      )}

      <StatRow>
        <Stat
          value={fmtHours(value.hours)}
          label="Time saved"
          delta={hoursDelta}
          deltaLabel={priorLabel(period)}
          size="md"
        />
        {showMoney && (
          <Stat
            value={fmtMoney(value.money)}
            label="Money saved"
            sub={`at ${fmtMoneyExact(settings.hourlyRate)} an hour`}
            delta={deltaPct(value.money, priorValue?.money ?? null)}
            deltaLabel={priorLabel(period)}
          />
        )}
        {scope.persona === 'cfo' && (
          <Stat
            value={fmtOneDp(value.people)}
            label="People equivalent"
            sub={`of a ${fmtInt(hoursPerWindow)}-hour window each`}
          />
        )}
        {showMoney && (
          <div className="min-w-0">
            <Stat
              value={cost.lookupRupees === null ? '—' : fmtMoneyExact(cost.lookupRupees)}
              label="Cost to run"
              sub={cost.lookupRupees === null
                ? `${fmtInt(cost.lookupCalls)} paid lookups recorded, contract not loaded`
                : `${fmtInt(cost.lookupCalls)} paid lookups, at your contract price`}
            />
            <button type="button" onClick={onOpenCost} className="mt-1.5 inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline">
              What this covers <ArrowRight size={12} />
            </button>
          </div>
        )}
      </StatRow>
    </Block>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Value over time
 * ────────────────────────────────────────────────────────────────────────── */

/** Hours saved per bucket, priced at the hourly rate. */
export function ValueOverTime({
  buckets,
  period,
  settings,
  showMoney,
}: {
  buckets: TimeBucket[];
  period: Period;
  settings: UsageSettings;
  showMoney: boolean;
}) {
  const grain = grainFor(period);
  const best = buckets.reduce((a, b) => (b.hours > a.hours ? b : a), buckets[0]);
  const total = buckets.reduce((s, b) => s + b.hours, 0);

  if (buckets.length === 0 || total <= 0) {
    return (
      <Block title="Value over time" lede={null}>
        <Empty kind="quiet" title="No completed runs in this window, so there is no shape to draw yet." />
      </Block>
    );
  }

  return (
    <Block
      title="Value over time"
      lede={
        <>
          Hours saved {grain === 'week' ? 'each week' : 'each month'} in this window, priced at{' '}
          <Fig>{fmtMoneyExact(settings.hourlyRate)}</Fig> an hour. The strongest {grain} was{' '}
          <Fig>{best.label}</Fig> at <Fig>{fmtHours(best.hours)}</Fig>
          {showMoney && <> ({fmtMoney(best.money)})</>}.
        </>
      }
      chart={
        <ChartAutoSizer height={230}>
          {({ width, height }) => (
            <BarChart width={width} height={height} data={buckets} margin={{ top: 22, right: 4, bottom: 4, left: 4 }}>
              <CartesianGrid stroke={HAIRLINE} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: INK_MUTED }} axisLine={{ stroke: HAIRLINE }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: INK_MUTED }} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => fmtInt(v)} />
              <Tooltip
                formatter={(v) => [fmtHours(Number(v)), 'Time saved']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${HAIRLINE}` }}
              />
              <Bar dataKey="hours" radius={[3, 3, 0, 0]} maxBarSize={64}>
                {/* Every bar carries its own figure, so nothing on this page
                    relies on colour or on a hover to be read. */}
                <LabelList
                  dataKey="hours"
                  position="top"
                  formatter={(v) => fmtInt(Number(v))}
                  style={{ fontSize: 12, fill: INK_MUTED, fontVariantNumeric: 'tabular-nums' }}
                />
                {buckets.map(b => (
                  <Cell key={b.at} fill={b.label === best.label ? BRAND : BRAND_SOFT} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ChartAutoSizer>
      }
      table={
        <DataTable
          head={grain === 'week' ? ['Week', 'Runs', 'Rows', 'Hours saved', showMoney ? 'Worth' : 'Rows per run'] : ['Month', 'Runs', 'Rows', 'Hours saved', showMoney ? 'Worth' : 'Rows per run']}
          rows={buckets.map(b => [
            b.label,
            fmtInt(b.runs),
            fmtInt(b.rows),
            fmtHours(b.hours),
            showMoney ? fmtMoney(b.money) : fmtInt(b.runs === 0 ? 0 : b.rows / b.runs),
          ])}
        />
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-04 · PU-19 — what it costs to run
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Cost to run.
 *
 * The volume the platform recorded, priced at the customer's own contract. Those
 * prices are set by irame when the deal is signed, so the figure simply appears
 * and says where it came from: as per your contract. There is no price form, no
 * bill screen and no override anywhere in the product, because none of these
 * numbers is the customer's to type.
 *
 * Where the contract does not price an API yet, those calls are named rather than
 * charged at a guess, and the total says it is short. With no contract loaded at
 * all the figure is absent rather than zero.
 *
 * The Concierge job cost is the one price the product records by itself. It is in
 * dollars, and it is shown as itself, added to nothing: a rupee total with a
 * silent conversion in it would be the blended figure this page refuses to draw.
 */
export function CostToRunBlock({
  cost,
  lookups,
  period,
}: {
  cost: CostToRun;
  lookups: LookupVolume;
  period: Period;
}) {
  if (cost.noContract) {
    return (
      <Block id="cost" title="Cost to run" lede={null}>
        <Empty
          kind="unmeasured"
          title="Your contract prices have not been loaded yet."
          detail={`The platform recorded ${fmtInt(cost.lookupCalls)} paid lookups ${period.phrase}. What they cost is set in your contract, and it is seeded by irame rather than entered here, so this stays empty until it arrives. Nothing on the value side of this page depends on it.`}
        />
      </Block>
    );
  }

  return (
    <Block
      id="cost"
      title="Cost to run"
      lede={
        <>
          The <Fig>{fmtInt(cost.lookupCalls)}</Fig> paid lookups {period.phrase} cost{' '}
          <Fig>{fmtMoneyExact(cost.lookupRupees ?? 0)}</Fig> as per your contract, which works out at{' '}
          <Fig>{lookups.effectiveRatePaise === null ? 'nothing we can divide yet' : fmtRate(lookups.effectiveRatePaise)}</Fig>{' '}
          a lookup across every API.
          {cost.unpriced.length > 0 && (
            <>
              {' '}
              <Fig>{fmtInt(cost.unpriced.reduce((sum, row) => sum + row.calls, 0))}</Fig> of those calls are on
              APIs your contract does not price yet, so they are counted here and charged nothing.
            </>
          )}
        </>
      }
      hint="The paid lookups are the platform's most literal cost: an outside vendor bills for each successful verification, at the price agreed in your contract."
      footer="Prices and billing units are contract terms, set by irame when the deal is signed and versioned every time they change. The Concierge job cost is recorded in dollars by the tools themselves and is shown as itself, never converted into this total at a rate nobody agreed."
    >
      <StatRow>
        <Stat
          value={fmtMoneyExact(cost.lookupRupees ?? 0)}
          label="Charged by your contract"
          sub={cost.complete
            ? `every recorded call is priced`
            : `${fmtInt(cost.unpriced.reduce((sum, row) => sum + row.calls, 0))} calls not priced by the contract yet`}
        />
        <Stat value={fmtInt(cost.lookupCalls)} label="Paid lookups recorded" sub={`${fmtInt(lookups.failed)} failed, which are not charged`} />
        <Stat value={fmtUsd(cost.conciergeUsd)} label="Concierge job cost" sub={`${fmtInt(cost.conciergeJobs)} jobs, ${fmtInt(cost.conciergeUnpriced)} of which record no cost`} />
        <Stat value={fmtInt(lookups.personalDataCalls)} label="Lookups touching personal data" sub="passports, PAN, provident fund, driving licences" />
      </StatRow>

      {cost.unpriced.length > 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-canvas-border bg-canvas px-4 py-3">
          <p className="text-[0.875rem] text-ink-700">
            Not priced by your contract yet:{' '}
            {cost.unpriced.map(row => `${row.name}, ${fmtInt(row.calls)} calls`).join(' · ')}.
          </p>
          <p className="mt-1 text-[0.75rem] text-ink-500">
            Those calls are counted and charged nothing. Adding them is a contract change on our side, so there
            is nothing for you to enter.
          </p>
        </div>
      )}

      {lookups.rows.length > 0 && (
        <div className="mt-4">
          <Drill label={`What each API charged: ${fmtInt(lookups.rows.length)} APIs`} hideLabel="Hide the APIs">
            <DataTable
              head={['API', 'Successful calls', 'Runs', 'Your contract price', 'Charged']}
              rows={lookups.rows.map(row => [
                row.name,
                fmtInt(row.calls),
                fmtInt(row.batches),
                row.pricePaise === null
                  ? 'not in your contract'
                  : `${fmtRate(row.pricePaise)} per ${row.billingUnit}`,
                row.chargedPaise === null ? 'nothing' : fmtPaise(row.chargedPaise),
              ])}
            />
            <p className="mt-2 text-[0.75rem] text-ink-500">
              An API charged per row charges for every successful call. One charged per run charges once for the
              whole run, however many rows it checked. Which of the two applies is a contract term, verified once
              against the workflow's own program.
            </p>
          </Drill>
        </div>
      )}

      {cost.prices.length > 0 && (
        <div className="mt-3">
          <Drill label={`The contract rows behind this figure: ${fmtInt(cost.prices.length)}`} hideLabel="Hide the contract">
            <MadeList>
              {cost.prices.map(row => (
                <MadeRow
                  key={`${row.lookupId}-${row.effectiveFrom}`}
                  name={`${row.apiName}, ${fmtRate(row.pricePaise)} per ${row.billingUnit}`}
                  madeBy={row.setBy}
                  when={formatDate(row.effectiveFrom)}
                  note={row.effectiveTo === null
                    ? `${row.vendor} · in force`
                    : `${row.vendor} · until ${formatDate(row.effectiveTo)}`}
                />
              ))}
            </MadeList>
            <p className="mt-2 text-[0.75rem] text-ink-500">
              A renegotiation opens a new row rather than rewriting the old one, so a price change this month
              never moves last month's figure.
            </p>
          </Drill>
        </div>
      )}
    </Block>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-12 — AI usage by area
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * AI usage by area.
 *
 * Volume for every area, and an accuracy label on every row: exact, estimated,
 * not measured, or no record. The words "AI cost" appear nowhere on this page,
 * because four of the five areas record nothing about what they consumed and a
 * total assembled from one real number and three blanks is worse than no total.
 */
export function AiUsageByArea({ rows }: { rows: AiUsageRow[] }) {
  const exact = rows.filter(r => r.accuracy === 'exact');
  return (
    <Block
      title="AI usage by area"
      lede={
        <>
          Five areas of the product use AI, and the platform records what each one did.
          Only <Fig>{fmtInt(exact.length)}</Fig> of them records what it consumed, so the rest carry a label
          saying so rather than a figure that looks measured.
        </>
      }
      hint="Nothing here is added into one AI spend figure. The Concierge job cost is the only money any of these areas records by itself."
      table={
        <ul className="divide-y divide-canvas-border border-t border-canvas-border">
          {rows.map(row => (
            <li key={row.area} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[0.875rem] text-ink-900 font-medium">{row.area}</p>
                <p className="text-[0.75rem] text-ink-500">{row.detail}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[0.875rem] text-ink-800 tabular-nums">
                  {fmtInt(row.volume)} <span className="text-ink-400">{row.volumeUnit}</span>
                </span>
                {row.conciergeUsd !== undefined && (
                  <span className="text-[0.875rem] text-ink-800 tabular-nums">{fmtUsd(row.conciergeUsd)}</span>
                )}
                <AccuracyTag value={row.accuracy} />
              </div>
            </li>
          ))}
        </ul>
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-09 — work volume, four units
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Work volume by unit.
 *
 * Four counts, never summed — on screen or in the export. A chat question and a
 * bulk job are not the same kind of thing, and a single "42,000 actions" number
 * would be four incompatible units pretending to be one.
 */
export function WorkVolume({
  volume,
  overTime,
  subject,
  period,
  onOpenRuns,
}: {
  volume: WorkVolumeFigures;
  overTime: { at: number; label: string; runs: number; chat: number }[];
  subject: string;
  period: Period;
  onOpenRuns: () => void;
}) {
  const rows: { label: string; value: number; note?: string }[] = [
    { label: 'Workflow runs', value: volume.workflowRuns, note: 'single executions, bulk runs counted separately' },
    { label: 'Bulk runs', value: volume.bulkRuns, note: 'one bulk run fires several workflows' },
    { label: 'Chat questions', value: volume.chatQuestions, note: volume.savedAsWorkflow > 0 ? `${fmtInt(volume.savedAsWorkflow)} were frozen into the workflow library` : undefined },
    { label: 'Concierge jobs', value: volume.conciergeJobs, note: 'background jobs on the AI tools' },
  ];

  if (rows.every(r => r.value === 0)) {
    return (
      <Block title="Work volume by unit" lede={null}>
        <Empty kind="quiet" title={`Nothing ran for ${subject} in this window.`} />
      </Block>
    );
  }

  return (
    <Block
      title="Work volume by unit"
      lede={
        <>
          {subject === 'the company' ? 'The company' : subject} ran <Fig>{fmtInt(volume.workflowRuns)}</Fig> workflows {period.phrase},{' '}
          <Fig>{fmtInt(volume.bulkRuns)}</Fig> bulk runs, asked <Fig>{fmtInt(volume.chatQuestions)}</Fig> questions
          and started <Fig>{fmtInt(volume.conciergeJobs)}</Fig> Concierge jobs. Four kinds of work, four counts:
          they are never added together.
        </>
      }
      action={
        <button type="button" onClick={onOpenRuns} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline">
          Open the workflow library <ArrowRight size={12} />
        </button>
      }
      chart={
        <div className="space-y-4">
          <Bars rows={rows} />
          {volume.newestRuns.length > 0 && (
            <Drill label={`Name the runs behind that count: the newest ${fmtInt(volume.newestRuns.length)}`} hideLabel="Hide the runs">
              <MadeList>
                {volume.newestRuns.map(run => (
                  <MadeRow
                    key={run.id}
                    name={run.workflow}
                    madeBy={run.ranBy}
                    when={formatDate(run.at)}
                    note={`${run.id}${run.rows === null ? ', a control test' : `, ${fmtInt(run.rows)} rows`}`}
                  />
                ))}
              </MadeList>
              <p className="mt-2 text-[0.75rem] text-ink-500">
                The workflow library holds every run, with its full record.
              </p>
            </Drill>
          )}
        </div>
      }
      table={
        <DataTable
          head={['Bucket', 'Workflow runs', 'Chat questions']}
          rows={overTime.map(b => [b.label, fmtInt(b.runs), fmtInt(b.chat)])}
        />
      }
      footer="Every answer the assistant gives stores the program behind it, so any answer on this page can be re-run against fresh data and checked."
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-21 — created this period
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Created this period.
 *
 * Five tables, one pattern, real numbers on day one and history included: every
 * one of these already stamps when a record was saved and who saved it. What it
 * deliberately does not show is edits, reviews, views or time spent — the caption
 * says "created" because that is exactly what is countable today.
 */
/** "1 audit programme", not "1 audit programmes". */
function countedLabel(created: CreatedCount): string {
  const plural = created.label.toLowerCase();
  return created.count === 1 ? plural.replace(/s$/, '') : plural;
}

export function CreatedThisPeriod({ created, period, subject }: { created: CreatedCount[]; period: Period; subject: string }) {
  const total = created.reduce((s, c) => s + c.count, 0);

  return (
    <Block
      title="Created this period"
      lede={
        total === 0 ? (
          <>Nothing new was created by {subject} {period.phrase}. This is a real zero rather than a gap in what the platform records.</>
        ) : (
          <>
            {subject === 'the company' ? 'The company' : subject} created <Fig>{fmtInt(total)}</Fig> things{' '}
            {period.phrase}: {created.filter(c => c.count > 0).map(c => `${fmtInt(c.count)} ${countedLabel(c)}`).join(', ')}.
          </>
        )
      }
      hint="Counts what was created. Edits, reviews and views need the wider event log and are not counted here."
      table={
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-5">
            {created.map(c => (
              <Stat key={c.kind} value={fmtInt(c.count)} label={c.label} size="sm" />
            ))}
          </div>
          {created.filter(c => c.count > 0).map(c => (
            <Drill key={c.kind} label={`${c.label}: name the ${fmtInt(c.count)}`} hideLabel={`Hide the ${c.label.toLowerCase()}`}>
              <MadeList>
                {c.rows.map(row => (
                  <MadeRow key={row.id} name={row.name} madeBy={row.createdBy} when={formatDate(row.createdAt)} />
                ))}
              </MadeList>
            </Drill>
          ))}
        </div>
      }
    />
  );
}
