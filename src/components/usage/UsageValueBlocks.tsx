/**
 * What the work was worth — PU-01 to PU-05, PU-09 and PU-12.
 *
 * The hero is the one place on this page where a number is allowed to be large,
 * and it is careful about what it claims. Until the vendor price list is loaded
 * there is no cost, so there is no net value, so the hero says "work avoided" —
 * which is exactly what has been measured — rather than putting a complete-
 * sounding label over an incomplete sum.
 */

import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { AccuracyTag, Block, ChangeList, DataTable, Drill, Empty, Fig, MadeRow, RestsOn, Stat } from './usageKit';
import { formatWhen } from './usageFormat';
import {
  deltaPct, fmtDuration, fmtHours, fmtInt, fmtMoney, fmtPeople, fmtUsd, plural,
  type AiAreaRow, type CostResult, type CreatedArea, type InvoiceLedger, type UsageSettings,
  type ValuePoint, type ValueResult, type VolumeUnit,
} from '../../data/platform-usage-metrics';

const AXIS = { fontSize: 12, fill: '#6B5D82' };
const GRID = '#E7E2EE';
const BRAND = '#6A12CD';

/* ── PU-01 to PU-03, and PU-05 ───────────────────────────────────────────── */

export function HeadlineValue({
  value,
  prior,
  subject,
  periodLabel,
  priorLabel,
  settings,
  showMoney,
  wasted,
  netValue,
  history,
  compact = false,
  onOpenWorkflows,
}: {
  value: ValueResult;
  prior: ValueResult | null;
  /** Whose saving it is, in the sentence: the company, a team, or you. */
  subject: string;
  periodLabel: string;
  priorLabel: string | null;
  settings: UsageSettings;
  /** An auditor reads their own work in hours. Rupees read as being priced. */
  showMoney: boolean;
  wasted: { hours: number; runs: number };
  /** null while the cost side is unknown, which is most of the time. */
  netValue: number | null;
  /** The changes to the assumptions this figure rests on. */
  history?: { inPeriod: number; rows: { field: string; from: string | null; to: string | null; source: string | null; by: string; when: string }[] };
  compact?: boolean;
  /** Where a reader with no runs goes to start one. */
  onOpenWorkflows?: () => void;
}) {
  if (value.hours <= 0) {
    return (
      <Block title="What the platform got through" lede={null}>
        <Empty
          kind="quiet"
          title="No completed runs in this window."
          detail="Nothing has been valued because nothing finished, which is a different fact from a saving of zero."
          action={onOpenWorkflows ? { label: 'Open the Workflow Library', onClick: onOpenWorkflows } : undefined}
        />
      </Block>
    );
  }

  const hoursDelta = deltaPct(value.hours, prior?.hours ?? null);
  const move = hoursDelta === null
    ? null
    : Math.abs(hoursDelta) < 0.5
      ? `level with ${priorLabel?.toLowerCase() ?? 'the window before'}`
      : `${hoursDelta > 0 ? 'up' : 'down'} ${Math.abs(hoursDelta).toFixed(0)}% on ${priorLabel?.toLowerCase() ?? 'the window before'}`;

  return (
    <Block
      title={netValue === null ? 'Work avoided' : 'Net value'}
      lede={
        <>
          The platform saved {subject} an estimated <Fig>{fmtHours(value.hours)} hours</Fig>{' '}
          {periodLabel.toLowerCase()}
          {move && <>, {move}</>}
          {showMoney && <>, worth <Fig>{fmtMoney(value.money)}</Fig> at the rate in your settings</>}.
          {showMoney && netValue !== null && (
            <> After what the paid lookups cost, that is <Fig>{fmtMoney(netValue)}</Fig> of net value.</>
          )}
        </>
      }
      footer={
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
          <RestsOn
            settings={settings}
            keys={showMoney
              ? ['manualReviewRate', 'hourlyRate', 'hoursPerPersonPerMonth']
              : ['manualReviewRate']}
            history={history}
            periodLabel={periodLabel}
          />
          {wasted.runs > 0 && (
            <span className="tabular-nums">
              {fmtDuration(wasted.hours)} lost to {plural(wasted.runs, 'failed run', 'failed runs')}, never counted as saved
            </span>
          )}
        </div>
      }
    >
      <div className={`flex flex-wrap items-end gap-x-12 gap-y-5 ${compact ? 'py-1' : 'py-2'}`}>
        <Stat
          size={compact ? 'md' : 'lg'}
          value={`${fmtHours(value.hours)} hours`}
          label={`estimated, saved ${periodLabel.toLowerCase()}`}
          delta={hoursDelta}
          deltaLabel={priorLabel}
        />
        {showMoney && (
          <>
            <Stat size={compact ? 'sm' : 'md'} value={fmtMoney(value.money)} label="estimated, at the hourly rate in your settings" />
            <Stat size={compact ? 'sm' : 'md'} value={fmtPeople(value.people)} label="estimated, the equivalent of this many people" />
            {/* PU-05. The title only reads "net value" when there is one, and
                when there is one the figure itself is on the hero. */}
            {netValue !== null && (
              <Stat size={compact ? 'sm' : 'md'} value={fmtMoney(netValue)} label="net of what the lookups cost" />
            )}
          </>
        )}
      </div>

      {/* The measured inputs, as a meta line rather than a sentence. */}
      <p className="mt-3 text-[0.75rem] text-ink-500 tabular-nums">
        {plural(value.runsCounted, 'run', 'runs')} · {fmtInt(value.rowsProcessed)} rows
        {value.controlTests > 0 && <> · {plural(value.controlTests, 'control test', 'control tests')}</>}
        {' '}· {fmtDuration(value.machineHours)} of machine time
      </p>
    </Block>
  );
}

/* ── PU-04 · Cost to run ─────────────────────────────────────────────────── */

/**
 * The cost tile is complete or it is honest about why it is not.
 *
 * It is never hidden. Somebody who cannot see a cost figure needs to know
 * whether that is because the platform costs nothing or because nobody has
 * entered a bill, and those are not the same sentence.
 *
 * A bill is optional, forever. Without one the block still says how many paid
 * lookups ran, because that is recorded already, and simply does not claim a
 * cost. Nothing above it depends on a bill: the hours and rupees saved are
 * computed from runs, not from what anybody paid.
 */
export function CostToRun({
  cost,
  ledger,
  periodLabel,
  changes,
  onEnterInvoice,
}: {
  cost: CostResult;
  /** Month by month: what was billed, and what was recorded. */
  ledger: InvoiceLedger;
  periodLabel: string;
  /** Who entered which bill, and when. */
  changes: { field: string; from: string | null; to: string | null; source: string | null; by: string; when: string }[];
  /** Only offered to somebody the tenant has given invoice entry to. */
  onEnterInvoice?: () => void;
}) {
  return (
    <Block
      title="Cost to run"
      lede={
        cost.complete
          ? (
            <>
              The paid lookups cost <Fig>{fmtMoney(cost.lookupMoney ?? 0)}</Fig> {periodLabel.toLowerCase()}, from{' '}
              {plural(cost.invoices, 'bill', 'bills')} entered, and Concierge jobs cost{' '}
              <Fig>{fmtUsd(cost.conciergeUsd)}</Fig>.
            </>
          )
          : (
            <>
              <Fig>{plural(cost.lookupRuns, 'paid lookup ran', 'paid lookups ran')}</Fig> {periodLabel.toLowerCase()}
              {cost.lookupRows > 0 && <> across <Fig>{fmtInt(cost.lookupRows)}</Fig> rows</>}, and no bill has been
              entered for {ledger.missing.length === 1 ? ledger.missing[0].label : 'every month in this window'}, so
              the page does not claim a cost. Concierge jobs cost <Fig>{fmtUsd(cost.conciergeUsd)}</Fig>.
            </>
          )
      }
      action={onEnterInvoice && (
        <button
          type="button"
          onClick={onEnterInvoice}
          className="h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-600 hover:text-brand-700 hover:border-brand-200"
        >
          Enter a bill in Administration
        </button>
      )}
      footer="Concierge is the one exact cost figure the product records by itself. Chat, the RACM generator and the workflow engine record nothing about what they consumed."
    >
      {cost.complete ? (
        <>
          <div className="flex flex-wrap items-end gap-x-12 gap-y-5 py-1">
            <Stat
              size="md"
              value={fmtMoney(cost.lookupMoney ?? 0)}
              label={`paid vendor lookups, from ${plural(cost.invoices, 'invoice', 'invoices')}`}
            />
            <Stat
              size="md"
              value={fmtUsd(cost.conciergeUsd)}
              label={`Concierge job cost, over ${plural(cost.conciergeJobs, 'job', 'jobs')}`}
            />
          </div>

          {/* Context, not a rate card. It says where it came from every time. */}
          {cost.effectiveRate !== null && (
            <p className="mt-4 text-[0.75rem] text-ink-500 tabular-nums">
              That works out at {fmtMoney(cost.effectiveRate)} per recorded call across{' '}
              {fmtInt(cost.recordedCalls)} {cost.callsAreAllRuns ? 'completed runs' : 'runs of the priced workflows'},
              derived from your invoices. It is not a price anybody quoted.
            </p>
          )}

          {/* Layer 3 against Layer 2. A gap is shown, never reconciled away. */}
          {cost.split !== null && (
            <p className="mt-1 text-[0.75rem] tabular-nums text-ink-500">
              Priced per API the same runs come to {fmtMoney(cost.split.total)},{' '}
              {Math.abs(cost.split.gap) < 1
                ? 'which matches the bill.'
                : <span className="text-high-700">
                    {fmtMoney(Math.abs(cost.split.gap))} {cost.split.gap > 0 ? 'more' : 'less'} than the bill. Worth a look.
                  </span>}
            </p>
          )}
        </>
      ) : (
        <>
          <Empty
            kind="unmeasured"
            title={
              ledger.missing.length === 1
                ? `${ledger.missing[0].label} has ${plural(ledger.missing[0].recordedCalls, 'recorded call', 'recorded calls')} and no bill entered yet.`
                : cost.missing ?? 'No invoice entered for this period.'
            }
            detail="A bill is optional. Nothing above this block depends on one, and if finance does enter it in Administration the period is costed exactly, backwards through every month entered."
            action={onEnterInvoice ? { label: "Enter the month's bill in Administration", onClick: onEnterInvoice } : undefined}
          />
          {/* Layer 1 needs nothing entered: the calls are counted already. The
              one cost figure that does exist sits beside them, and it is not a
              total and is never labelled as one. */}
          <div className="mt-4 flex flex-wrap items-end gap-x-12 gap-y-5">
            <Stat
              size="sm"
              value={fmtInt(cost.lookupRuns)}
              label={cost.callsAreAllRuns ? 'completed runs, none of them priced yet' : 'runs of the priced workflows'}
            />
            <Stat
              size="sm"
              value={fmtUsd(cost.conciergeUsd)}
              label={`Concierge job cost, over ${plural(cost.conciergeJobs, 'job', 'jobs')}`}
            />
          </div>
        </>
      )}

      {/* The entry manages itself: the tile opens the bills behind it, and the
          months with recorded calls and no bill are named rather than quietly
          missing from a total. */}
      <div className="mt-4 space-y-2">
        <Drill
          label={ledger.months.length === 1 ? 'Show the month behind this' : `Show the ${fmtInt(ledger.months.length)} months behind this`}
          hideLabel="Hide the months"
        >
          <ul className="divide-y divide-canvas-border border-t border-canvas-border">
            {ledger.months.map(m => (
              <li key={m.month} className="py-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[0.875rem] text-ink-800">{m.label}</span>
                  <span className={`text-[0.875rem] shrink-0 tabular-nums ${m.amount === null ? 'text-ink-400' : 'text-ink-900 font-medium'}`}>
                    {m.amount === null ? 'no bill yet' : fmtMoney(m.amount)}
                  </span>
                </div>
                <p className="text-[0.75rem] text-ink-500 tabular-nums">
                  {plural(m.recordedCalls, 'recorded call', 'recorded calls')}
                  {m.invoices.map(i => (
                    <span key={`${i.vendor}-${i.enteredAt}`}> · {i.vendor}, entered by {i.enteredBy}{i.note ? ` · ${i.note}` : ''}</span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </Drill>

        {changes.length > 0 && (
          <Drill label={`Show who entered what (${fmtInt(changes.length)})`} hideLabel="Hide the entries">
            <ChangeList rows={changes} />
          </Drill>
        )}
      </div>
    </Block>
  );
}

/* ── Value over time ─────────────────────────────────────────────────────── */

export function ValueOverTime({ points, showMoney }: { points: ValuePoint[]; showMoney: boolean }) {
  const has = points.some(p => p.hours > 0);
  const busiest = has ? points.reduce((a, b) => (b.hours > a.hours ? b : a)) : null;
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <Block
      title="Value over time"
      lede={
        has && busiest && first && last ? (
          <>
            The estimated saving ran from <Fig>{fmtHours(first.hours)} hours</Fig> ({first.label}) to{' '}
            <Fig>{fmtHours(last.hours)}</Fig> ({last.label}), and {busiest.label} was the strongest of them at{' '}
            <Fig>{fmtHours(busiest.hours)}</Fig>.
          </>
        ) : null
      }
      chart={
        has ? (
          <ChartAutoSizer height={220}>
            {({ width, height }) => (
              <LineChart width={width} height={height} data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={v => fmtInt(v)} />
                <Tooltip
                  formatter={value => `${fmtHours(Number(value))} hours saved`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
                />
                <Line type="monotone" dataKey="hours" stroke={BRAND} strokeWidth={2} dot={{ r: 2.5, fill: BRAND }} name="Hours saved" />
              </LineChart>
            )}
          </ChartAutoSizer>
        ) : (
          <Empty kind="quiet" title="Nothing completed in this window yet." />
        )
      }
      table={
        <DataTable
          head={showMoney ? ['Period', 'Hours saved', 'Money saved'] : ['Period', 'Hours saved']}
          rows={points.map(p => (showMoney ? [p.label, fmtHours(p.hours), fmtMoney(p.money)] : [p.label, fmtHours(p.hours)]))}
        />
      }
    />
  );
}

/* ── PU-09 · Work volume, four units, never summed ───────────────────────── */

/** What one of each unit is called, so a count of one reads as English. */
const UNIT_ONE: Record<string, string> = {
  runs: 'workflow run',
  bulk: 'bulk run',
  chat: 'question asked',
  concierge: 'Concierge job',
};

export function WorkVolume({
  units,
  series,
}: {
  units: VolumeUnit[];
  series: { label: string; runs: number; bulk: number; chat: number; concierge: number }[];
}) {
  const keyOf: Record<string, 'runs' | 'bulk' | 'chat' | 'concierge'> = {
    runs: 'runs', bulk: 'bulk', chat: 'chat', concierge: 'concierge',
  };

  return (
    <Block
      title="Work volume by unit"
      hint="Four units of work. Not addable."
      lede={
        <>
          {units.map((u, i) => (
            <span key={u.key}>
              {i > 0 && (i === units.length - 1 ? ' and ' : ', ')}
              <Fig>{fmtInt(u.count)}</Fig> {u.count === 1 ? (UNIT_ONE[u.key] ?? u.label.toLowerCase()) : u.label.toLowerCase()}
            </span>
          ))}
          . Four different units of work, so nothing here adds up to a total.
        </>
      }
      chart={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {units.map(u => (
            <div key={u.key}>
              <Stat size="sm" value={fmtInt(u.count)} label={u.label} />
              <ChartAutoSizer height={56} className="mt-2">
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <Tooltip
                      cursor={{ fill: 'rgba(106,18,205,0.06)' }}
                      formatter={value => `${fmtInt(Number(value))} ${u.label.toLowerCase()}`}
                      labelFormatter={l => String(l)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
                    />
                    <Bar dataKey={keyOf[u.key]} fill={BRAND} radius={[2, 2, 0, 0]} />
                  </BarChart>
                )}
              </ChartAutoSizer>
            </div>
          ))}
        </div>
      }
      table={
        <DataTable
          head={['Unit of work', 'Count', 'What it is']}
          rows={units.map(u => [u.label, fmtInt(u.count), u.note])}
          numericFrom={1}
        />
      }
    />
  );
}

/* ── PU-21 · Created this period ─────────────────────────────────────────── */

/**
 * How much was built on the platform in this window.
 *
 * These five areas write no usage event, so this block cannot say how often
 * anything was opened, edited or reviewed. What it can say is how many records
 * were made, because every one of them stamps who made it and when. The caption
 * says created for that reason, and never activity.
 *
 * A zero here is a real zero: nothing was created. It is not the "we do not
 * measure this" state, and it never renders as one.
 */
export function CreatedThisPeriod({ areas }: { areas: CreatedArea[] }) {
  // One list across the five areas, in date order, each row saying which area it
  // belongs to. Five separate lists would be five clicks to answer one question.
  const made = areas
    .flatMap(a => a.items.map(i => ({ ...i, area: a.label.replace(/s$/, '').toLowerCase() })))
    .sort((x, z) => z.at - x.at);
  const total = areas.reduce((n, a) => n + a.count, 0);

  return (
    <Block
      title="Created this period"
      hint="Records made in this window. Not edits, reviews or time spent."
      lede={
        total > 0 ? (
          <>
            <Fig>{plural(total, 'record was', 'records were')}</Fig> created in this window, across{' '}
            <Fig>{plural(areas.filter(a => a.count > 0).length, 'area', 'areas')}</Fig> of the product. Every one of
            them stamps who made it and when, so the list behind this count names them.
          </>
        ) : (
          <>Nothing was created in this window. That is a real zero, not a gap in what the platform records.</>
        )
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
        {areas.map(a => (
          <Stat key={a.key} size="sm" value={fmtInt(a.count)} label={a.label} />
        ))}
      </div>

      {made.length > 0 && (
        <div className="mt-4">
          <Drill label={`Name the ${plural(made.length, 'record', 'records')}`}>
            <ul className="divide-y divide-canvas-border border-t border-canvas-border">
              {made.slice(0, 24).map((m, i) => (
                <MadeRow key={`${m.name}-${m.at}-${i}`} name={m.name} madeBy={m.madeBy} when={formatWhen(m.at)} note={m.area} />
              ))}
            </ul>
            {made.length > 24 && (
              <p className="mt-2 text-[0.75rem] text-ink-400 tabular-nums">24 newest of {fmtInt(made.length)}.</p>
            )}
          </Drill>
        </div>
      )}
    </Block>
  );
}

/* ── PU-12 · AI usage by area ────────────────────────────────────────────── */

export function AiUsageByArea({ rows }: { rows: AiAreaRow[] }) {
  return (
    <Block
      title="AI usage by area"
      hint="No total: one figure is exact, one is an estimate, two areas record nothing."
      lede={
        <>
          The AI did work in <Fig>{fmtInt(rows.filter(r => (r.volume ?? 0) > 0).length)}</Fig> of the{' '}
          {fmtInt(rows.length)} areas this window. Only Concierge records what a job cost, so there is no
          total on this table and never will be one until the rest of the product measures its own usage.
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[0.875rem]">
          <thead>
            <tr className="border-b border-canvas-border">
              {['Area', 'Volume', 'What was recorded', 'Cost', 'Known'].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`py-2 pr-4 last:pr-0 text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 ${i === 1 || i === 3 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.area} className="border-b border-canvas-border last:border-0 align-top">
                <td className="py-2.5 pr-4 text-ink-900 font-medium whitespace-nowrap">{r.area}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-ink-800 whitespace-nowrap">
                  {r.volume === null ? '—' : `${fmtInt(r.volume)} ${r.volumeUnit}`}
                </td>
                {/* The caveat is on the row as a title, not as a paragraph
                    under every line. The accuracy tag is what carries it. */}
                <td className="py-2.5 pr-4 text-ink-600" title={r.note}>{r.detail}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-ink-800 whitespace-nowrap">
                  {r.costUsd === null ? '—' : `${fmtUsd(r.costUsd)} Concierge job cost`}
                </td>
                <td className="py-2.5"><AccuracyTag value={r.accuracy} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}
