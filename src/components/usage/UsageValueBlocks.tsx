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
import { ArrowUpRight } from 'lucide-react';
import ChartAutoSizer from './ChartAutoSizer';
import { AccuracyTag, Block, DataTable, Empty, RestsOn, Stat } from './usageKit';
import {
  deltaPct, fmtDuration, fmtHours, fmtInt, fmtMoney, fmtPeople, fmtUsd, plural,
  type AiAreaRow, type CostResult, type CreatedArea, type SensitivityRow, type UsageSettings,
  type ValuePoint, type ValueResult, type VolumeUnit,
} from '../../data/platform-usage-metrics';

const AXIS = { fontSize: 12, fill: '#6B5D82' };
const GRID = '#E7E2EE';
const BRAND = '#6A12CD';

/* ── PU-01 to PU-03, and PU-05 ───────────────────────────────────────────── */

export function HeadlineValue({
  value,
  prior,
  periodLabel,
  priorLabel,
  settings,
  showMoney,
  wasted,
  netValue,
  compact = false,
  onEditSettings,
}: {
  value: ValueResult;
  prior: ValueResult | null;
  periodLabel: string;
  priorLabel: string | null;
  settings: UsageSettings;
  /** An auditor reads their own work in hours. Rupees read as being priced. */
  showMoney: boolean;
  wasted: { hours: number; runs: number };
  /** null while the cost side is unknown, which is most of the time. */
  netValue: number | null;
  compact?: boolean;
  onEditSettings?: () => void;
}) {
  if (value.hours <= 0) {
    return (
      <Block title="What the platform got through">
        <Empty kind="quiet" title="No completed runs in this window." />
      </Block>
    );
  }

  const hoursDelta = deltaPct(value.hours, prior?.hours ?? null);

  return (
    <Block
      title={netValue === null ? 'Work avoided' : 'Net value'}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <RestsOn
            settings={settings}
            keys={showMoney
              ? ['manualReviewRate', 'hourlyRate', 'hoursPerPersonPerMonth']
              : ['manualReviewRate']}
            onEdit={onEditSettings}
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
          label={`saved ${periodLabel.toLowerCase()}`}
          delta={hoursDelta}
          deltaLabel={priorLabel}
        />
        {showMoney && (
          <>
            <Stat size={compact ? 'sm' : 'md'} value={fmtMoney(value.money)} label="at the hourly rate you set" />
            <Stat size={compact ? 'sm' : 'md'} value={fmtPeople(value.people)} label="the equivalent of this many people" />
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
 * loaded the price list, and those are not the same sentence.
 */
export function CostToRun({ cost }: { cost: CostResult }) {
  return (
    <Block
      title="Cost to run"
      footer="Concierge is the one exact cost figure in the product. Chat, the RACM generator and the workflow engine record nothing about what they consumed."
    >
      {cost.complete ? (
        <div className="flex flex-wrap items-end gap-x-12 gap-y-5 py-1">
          <Stat size="md" value={fmtMoney(cost.lookupMoney ?? 0)} label={`paid vendor lookups, over ${plural(cost.lookupRuns, 'run', 'runs')}`} />
          <Stat size="md" value={fmtUsd(cost.conciergeUsd)} label={`Concierge job cost, over ${plural(cost.conciergeJobs, 'job', 'jobs')}`} />
        </div>
      ) : (
        <>
          <Empty
            kind="unmeasured"
            title="Price list not yet loaded."
            detail="A workflow counts as billable exactly when the price list names it. The runs are all recorded, so the day it lands, past periods price themselves."
          />
          {/* The one cost figure that does exist. It is not a total and it is
              never labelled as one. */}
          <div className="mt-4">
            <Stat
              size="sm"
              value={fmtUsd(cost.conciergeUsd)}
              label={`Concierge job cost, over ${plural(cost.conciergeJobs, 'job', 'jobs')}`}
            />
          </div>
        </>
      )}
    </Block>
  );
}

/* ── Value over time ─────────────────────────────────────────────────────── */

export function ValueOverTime({ points, showMoney }: { points: ValuePoint[]; showMoney: boolean }) {
  const has = points.some(p => p.hours > 0);

  return (
    <Block
      title="Hours saved over time"
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
          head={showMoney ? ['Period', 'Hours saved', 'Worth'] : ['Period', 'Hours saved']}
          rows={points.map(p => (showMoney ? [p.label, fmtHours(p.hours), fmtMoney(p.money)] : [p.label, fmtHours(p.hours)]))}
        />
      }
    />
  );
}

/* ── PU-09 · Work volume, four units, never summed ───────────────────────── */

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
      title="Work volume"
      hint="Four units of work. Not addable."
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
  return (
    <Block
      title="Created this period"
      hint="Records made in this window. Not edits, reviews or time spent."
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
        {areas.map(a => (
          <Stat key={a.key} size="sm" value={fmtInt(a.count)} label={a.label} />
        ))}
      </div>
    </Block>
  );
}

/* ── PU-12 · AI usage by area ────────────────────────────────────────────── */

export function AiUsageByArea({ rows }: { rows: AiAreaRow[] }) {
  return (
    <Block
      title="AI usage by area"
      hint="No total: one figure is exact, one is an estimate, two areas record nothing."
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

/* ── How much one setting matters ────────────────────────────────────────── */

/**
 * The same runs, at four review rates.
 *
 * One setting swings the headline eightfold. Most products hide that; showing it
 * is what makes the rest of the page believable, and it is why the person who
 * signs off the rate has to be a named person.
 */
export function SettingSensitivity({ rows, onEdit }: { rows: SensitivityRow[]; onEdit?: () => void }) {
  return (
    <Block
      title="How much that assumption matters"
      hint="The same runs, at other review rates."
      action={onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-600 hover:text-brand-700 hover:border-brand-200"
        >
          Change the rate <ArrowUpRight size={13} />
        </button>
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[0.875rem]">
          <thead>
            <tr className="border-b border-canvas-border">
              {['If a person checks', 'Hours saved', 'Worth', 'People'].map((h, i) => (
                <th key={h} scope="col" className={`py-2 text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 ${i === 0 ? 'text-left' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.rate} className={`border-b border-canvas-border last:border-0 ${r.isCurrent ? 'bg-brand-50/50' : ''}`}>
                <td className="py-2 text-ink-800">
                  {fmtInt(r.rate)} rows an hour
                  {r.isCurrent && <span className="ml-2 text-[0.75rem] text-brand-700 font-medium">what you have set</span>}
                </td>
                <td className="py-2 text-right tabular-nums text-ink-800">{fmtHours(r.hours)}</td>
                <td className="py-2 text-right tabular-nums text-ink-800">{fmtMoney(r.money)}</td>
                <td className="py-2 text-right tabular-nums text-ink-800">{fmtPeople(r.people)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}
