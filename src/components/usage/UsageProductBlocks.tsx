/**
 * The product being used, not just the AI — PU-22, PU-23, PU-24 and PU-25.
 *
 * Four areas of the product write down what happens in them well enough to be
 * reported on: dashboards and the alerts they fire, reports and their activity
 * trail, sample validations and their outcomes, and the insights the assistant
 * generates. None of these blocks needs anything invented, and each one holds a
 * distinction the reader would otherwise lose:
 *
 * · a dashboard alert fired by the scheduled worker says automatic, because
 *   nobody was there;
 * · a report made and a report worked on are two numbers that are never added,
 *   so fifty edits stay one report;
 * · a failed validation is a finding and an errored one is not, so they are
 *   counted and coloured apart;
 * · a consolidated insight summarises per-run insights already counted, so the
 *   two are shown side by side and never summed.
 */

import { Bars, Block, DataTable, Drill, Empty, Fig, MadeRow, Stat } from './usageKit';
import { fmtInt, fmtPct, plural, formatWhen } from './usageFormat';
import type { InsightsResult, ProductActivity, ReportsActivity, SamplingResult } from '../../data/platform-usage-metrics';

/* ── PU-22 · Dashboards, widgets and alerts ──────────────────────────────── */

export function DashboardsAndAlerts({
  data,
  periodLabel,
  onOpenDashboards,
}: {
  data: ProductActivity;
  periodLabel: string;
  onOpenDashboards: () => void;
}) {
  const nothing = data.dashboardsCreated === 0 && data.dashboardsChanged === 0 && data.alertsFired === 0;

  return (
    <Block
      title="Dashboards, widgets and alerts"
      hint="Built and firing. Every change to a dashboard is recorded, and alerts fire on a schedule with nobody watching."
      lede={
        nothing ? null : (
          <>
            <Fig>{plural(data.dashboardsCreated, 'dashboard was', 'dashboards were')}</Fig> built{' '}
            {periodLabel.toLowerCase()}, <Fig>{fmtInt(data.dashboardsChanged)}</Fig> changed or shared, and{' '}
            <Fig>{plural(data.alertsFired, 'alert', 'alerts')}</Fig> fired
            {data.alertsFired > 0 && <>, <Fig>{fmtInt(data.automaticFires)}</Fig> of them with nobody watching</>}.
          </>
        )
      }
    >
      {nothing ? (
        <Empty
          kind="quiet"
          title="No dashboard was built or changed in this window, and no alert fired."
          detail={`${plural(data.dashboardsTotal, 'dashboard', 'dashboards')} in the workspace, ${plural(data.alertRules, 'widget', 'widgets')} watching for something.`}
          action={{ label: 'Open Dashboards', onClick: onOpenDashboards }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <Stat size="md" value={fmtInt(data.dashboardsCreated)} label={`built ${periodLabel.toLowerCase()}`} />
            <Stat size="sm" value={fmtInt(data.dashboardsChanged)} label="changed or shared" />
            <Stat size="sm" value={fmtInt(data.alertsFired)} label="alerts fired" />
          </div>

          <p className="mt-3 text-[0.75rem] text-ink-500 tabular-nums">
            {fmtInt(data.dashboardsTotal)} dashboards in the workspace now, {fmtInt(data.alertRules)} of their
            widgets watching for something.
            {data.alertsFired > 0 && (
              <> {fmtInt(data.automaticFires)} of the {fmtInt(data.alertsFired)} fires were the scheduled worker,
              with nobody watching.</>
            )}
          </p>

          <div className="mt-4 space-y-3">
            {data.makers.length > 0 && (
              <Drill label={`Name the ${plural(data.makers.length, 'dashboard', 'dashboards')}`}>
                <ul className="divide-y divide-canvas-border border-t border-canvas-border">
                  {data.makers.map(m => (
                    <MadeRow key={`${m.name}-${m.at}`} name={m.name} madeBy={m.madeBy} when={formatWhen(m.at)} />
                  ))}
                </ul>
              </Drill>
            )}
            {data.fires.length > 0 && (
              <Drill label={`Show what fired (${fmtInt(data.fires.length)})`}>
                <ul className="divide-y divide-canvas-border border-t border-canvas-border">
                  {data.fires.slice(0, 20).map((f, i) => (
                    <MadeRow
                      key={`${f.widget}-${f.at}-${i}`}
                      name={`${f.widget} on ${f.dashboard}`}
                      madeBy={f.firedBy}
                      when={formatWhen(f.at)}
                      note={f.condition}
                    />
                  ))}
                </ul>
                {data.fires.length > 20 && (
                  <p className="mt-2 text-[0.75rem] text-ink-400 tabular-nums">
                    20 newest of {fmtInt(data.fires.length)}.
                  </p>
                )}
              </Drill>
            )}
          </div>
        </>
      )}
    </Block>
  );
}

/* ── PU-23 · Reports ─────────────────────────────────────────────────────── */

export function ReportsMade({
  data,
  periodLabel,
  onOpenReports,
}: {
  data: ReportsActivity;
  periodLabel: string;
  onOpenReports: () => void;
}) {
  return (
    <Block
      title="Reports"
      hint="Created, worked on, shared. A report edited fifty times is one report and fifty activities, and the two are never added together."
      lede={
        data.activity === 0 ? null : (
          <>
            <Fig>{plural(data.made, 'report was', 'reports were')}</Fig> made {periodLabel.toLowerCase()} and
            reports were worked on <Fig>{plural(data.activity, 'time', 'times')}</Fig>
            {data.shared > 0 && <>, with <Fig>{fmtInt(data.shared)}</Fig> shared out</>}.
          </>
        )
      }
      chart={
        data.activity === 0 ? (
          <Empty
            kind="quiet"
            title="Nobody touched a report in this window."
            action={{ label: 'Open Reports', onClick: onOpenReports }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <Stat size="md" value={fmtInt(data.made)} label={`made ${periodLabel.toLowerCase()}`} />
              <Stat size="sm" value={fmtInt(data.activity)} label="recorded activities" />
              <Stat size="sm" value={fmtInt(data.shared)} label="shared" />
            </div>

            <div className="mt-4">
              <Bars rows={data.byActivity.map(a => ({ label: a.label, value: a.count }))} />
            </div>

            <p className="mt-4 text-[0.75rem] text-ink-500 tabular-nums">
              Across every issued report, {fmtInt(data.actionPlansOpen)} action{' '}
              {data.actionPlansOpen === 1 ? 'plan is' : 'plans are'} still open and{' '}
              {fmtInt(data.actionPlansClosed)} {data.actionPlansClosed === 1 ? 'is' : 'are'} implemented.
              That is where they stand now, not a count for this window.
            </p>

            {data.list.length > 0 && (
              <div className="mt-3">
                <Drill label={`Name the ${plural(data.list.length, 'report', 'reports')}`}>
                  <ul className="divide-y divide-canvas-border border-t border-canvas-border">
                    {data.list.map(r => (
                      <MadeRow key={`${r.name}-${r.at}`} name={r.name} madeBy={r.madeBy} when={formatWhen(r.at)} />
                    ))}
                  </ul>
                </Drill>
              </div>
            )}
          </>
        )
      }
      table={
        <DataTable
          head={['Activity', 'Count']}
          rows={[
            ['reports made', fmtInt(data.made)],
            ...data.byActivity.map(a => [a.label, fmtInt(a.count)] as (string | number)[]),
            ['action plans open', fmtInt(data.actionPlansOpen)],
            ['action plans implemented', fmtInt(data.actionPlansClosed)],
          ]}
        />
      }
    />
  );
}

/* ── PU-24 · Sampling ────────────────────────────────────────────────────── */

export function SamplingOutcomes({ data }: { data: SamplingResult }) {
  const troubled = data.byControl.filter(c => c.failed + c.errored > 0);
  const clean = data.byControl.filter(c => c.failed + c.errored === 0 && c.passed > 0);

  return (
    <Block
      title="Sampling"
      hint="Validation runs and their outcomes. A failed one says the control did not hold; an errored one says nothing about the control, so somebody has to look."
      lede={
        data.total === 0 ? null : (
          <>
            <Fig>{plural(data.passed + data.failed + data.errored, 'validation', 'validations')}</Fig> landed in
            this window: <Fig>{fmtInt(data.passed)}</Fig> passed, <Fig>{fmtInt(data.failed)}</Fig> failed and{' '}
            <Fig>{fmtInt(data.errored)}</Fig> errored, which says nothing about the control until somebody looks.
          </>
        )
      }
      chart={
        data.total === 0 ? (
          <Empty kind="quiet" title="No sample was validated in this window." />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <Stat size="md" value={fmtInt(data.passed)} label="passed" />
              <Stat size="sm" value={fmtInt(data.failed)} label="failed" />
              <Stat size="sm" value={fmtInt(data.errored)} label="errored, needs a person" />
              {data.inFlight > 0 && <Stat size="sm" value={fmtInt(data.inFlight)} label="still running" />}
              {data.passRate !== null && (
                <Stat size="sm" value={fmtPct(data.passRate)} label="of the validations that landed" />
              )}
            </div>

            {/* Only the controls something went wrong on are charted. A bar of
                zero next to a bar of four says nothing and reads as a control
                that failed once, which it did not. */}
            {troubled.length > 0 && (
              <div className="mt-4">
                <Bars
                  rows={troubled.slice(0, 5).map(c => ({
                    label: c.control,
                    value: c.failed + c.errored,
                    note: `${fmtInt(c.passed)} passed, ${fmtInt(c.failed)} failed, ${fmtInt(c.errored)} errored · ${c.engagement}`,
                  }))}
                  tone="risk"
                />
                {troubled.length > 5 && (
                  <p className="mt-2 text-[0.75rem] text-ink-400 tabular-nums">
                    5 of {fmtInt(troubled.length)} with something to look at. The table has every one.
                  </p>
                )}
              </div>
            )}

            {clean.length > 0 && (
              <p className="mt-4 text-[0.75rem] text-ink-500 tabular-nums">
                {plural(clean.length, 'control passed', 'controls passed')} every validation in this window.
              </p>
            )}

            {data.errors.length > 0 && (
              <div className="mt-4">
                <Drill label={`Show the ${plural(data.errors.length, 'error', 'errors')}`}>
                  <ul className="divide-y divide-canvas-border border-t border-canvas-border">
                    {data.errors.slice(0, 10).map((e, i) => (
                      <li key={`${e.control}-${e.at}-${i}`} className="py-2">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-[0.875rem] text-ink-800 truncate">{e.control}</span>
                          <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">{formatWhen(e.at)}</span>
                        </div>
                        {/* Verbatim. A summarised reason is a validation nobody can rescue. */}
                        <p className="mt-1 text-[0.75rem] text-ink-700 font-mono break-words max-w-[80ch]">{e.note}</p>
                        <p className="text-[0.75rem] text-ink-500">{e.engagement}</p>
                      </li>
                    ))}
                  </ul>
                </Drill>
              </div>
            )}
          </>
        )
      }
      table={
        <DataTable
          head={['Control', 'Engagement', 'Passed', 'Failed', 'Errored']}
          numericFrom={2}
          rows={data.byControl.map(c => [c.control, c.engagement, fmtInt(c.passed), fmtInt(c.failed), fmtInt(c.errored)])}
        />
      }
    />
  );
}

/* ── PU-25 · AI insights ─────────────────────────────────────────────────── */

export function InsightsGenerated({ data }: { data: InsightsResult }) {
  const nothing = data.perRun === 0 && data.consolidated === 0;

  return (
    <Block
      title="AI insights"
      hint="Generated and by severity. Insights written off one run are kept apart from insights written across a whole engagement, because the second kind summarises the first."
      lede={
        nothing ? null : (
          <>
            The assistant wrote <Fig>{plural(data.perRun, 'insight', 'insights')}</Fig> off single runs and{' '}
            <Fig>{fmtInt(data.consolidated)}</Fig> across whole engagements. The two are kept apart because the
            second kind summarises the first.
          </>
        )
      }
      chart={
        nothing ? (
          <Empty kind="quiet" title="The assistant wrote nothing down in this window." />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <Stat size="md" value={fmtInt(data.perRun)} label="from a single run" />
              <Stat size="sm" value={fmtInt(data.consolidated)} label="across an engagement" />
            </div>

            <div className="mt-4">
              <Bars
                rows={data.bySeverity
                  .filter(s => s.perRun + s.consolidated > 0)
                  .map(s => ({
                    label: s.severity,
                    value: s.perRun,
                    note: s.consolidated > 0
                      ? `plus ${fmtInt(s.consolidated)} written across an engagement`
                      : undefined,
                  }))}
                tone="risk"
              />
            </div>

            {data.rows.length > 0 && (
              <div className="mt-4">
                {/* Never a total here: adding the two kinds together counts a
                    consolidated insight and the per-run insights it summarises
                    as separate findings. */}
                <Drill label="Read them">
                  <ul className="divide-y divide-canvas-border border-t border-canvas-border">
                    {data.rows.slice(0, 12).map((r, i) => (
                      <li key={`${r.title}-${r.at}-${i}`} className="py-2">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-[0.875rem] text-ink-800">{r.title}</span>
                          <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">{formatWhen(r.at)}</span>
                        </div>
                        <p className="text-[0.75rem] text-ink-500">
                          {r.severity} · {r.category} · {r.kind} · {r.engagement}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {data.rows.length > 12 && (
                    <p className="mt-2 text-[0.75rem] text-ink-400 tabular-nums">
                      12 newest of {fmtInt(data.rows.length)}.
                    </p>
                  )}
                </Drill>
              </div>
            )}
          </>
        )
      }
      table={
        <DataTable
          head={['Severity', 'From one run', 'Across an engagement']}
          rows={data.bySeverity.map(s => [s.severity, fmtInt(s.perRun), fmtInt(s.consolidated)])}
        />
      }
    />
  );
}
