/**
 * The product being used, not just the AI.
 *
 * PU-22 dashboards, widgets and alerts · PU-23 reports · PU-24 sampling ·
 * PU-25 insights.
 *
 * None of these needed anything built. The product already writes a before and
 * after event on every dashboard, widget and alert change, reports keep their
 * own activity trail, sample validations carry a lifecycle, and every generated
 * insight is a stored row. So these blocks read what is there, and each one says
 * which table it read.
 */

import { formatDate, formatDateTime } from '../../data/platform-usage';
import {
  fmtInt, fmtPct,
  type InsightSummary, type Period, type ProductActivity, type ReportsActivity, type Sampling,
} from '../../data/platform-usage-metrics';
import { Bars, Block, DataTable, Drill, Empty, Fig, MadeList, MadeRow, Stat, StatRow } from './usageKit';

/* ──────────────────────────────────────────────────────────────────────────
 * PU-22 — dashboards, widgets and alerts
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * What was built, and what fired.
 *
 * Every tile here opens the list behind it, with the name of each thing and who
 * made it. An alert fired by the scheduled worker has no person behind it, and
 * the list says "automatic" rather than leaving the column blank.
 */
export function DashboardsAndAlerts({ product, period, subject }: { product: ProductActivity; period: Period; subject: string }) {
  const nothing = product.dashboardsCreated === 0 && product.widgetsChanged === 0 && product.alertsFired === 0;

  if (nothing) {
    return (
      <Block id="dashboards" title="Dashboards, widgets and alerts" lede={null}>
        <Empty
          kind="quiet"
          title={`Nothing was built or fired for ${subject} in this window.`}
          detail="The event log was read and had nothing in it for this window. Dashboards built earlier still exist."
        />
      </Block>
    );
  }

  return (
    <Block
      id="dashboards"
      title="Dashboards, widgets and alerts"
      lede={
        <>
          {subject === 'the company' ? 'The company' : subject} built <Fig>{fmtInt(product.dashboardsCreated)}</Fig> dashboards
          and changed <Fig>{fmtInt(product.widgetsChanged)}</Fig> widgets {period.phrase}, and{' '}
          <Fig>{fmtInt(product.alertsFired)}</Fig> alerts fired,{' '}
          <Fig>{fmtInt(product.alertsAutomatic)}</Fig> of them with no person involved at all.
        </>
      }
      hint="Read from the product's own change log, which records a before and after on every create, update and delete."
      table={
        <div className="space-y-4">
          <StatRow>
            <Stat value={fmtInt(product.dashboardsCreated)} label="Dashboards built" />
            <Stat value={fmtInt(product.widgetsChanged)} label="Widgets created or changed" />
            <Stat value={fmtInt(product.alertsFired)} label="Alerts fired" sub={`${fmtInt(product.alertsAutomatic)} automatic`} />
            <Stat
              value={product.alertsFired === 0 ? '0%' : fmtPct((product.alertsAutomatic * 100) / product.alertsFired)}
              label="Fired without a person"
            />
          </StatRow>

          {product.dashboardsCreated > 0 && (
            <Drill label={`Name the ${fmtInt(product.dashboardsCreated)} dashboards`} hideLabel="Hide the dashboards">
              <MadeList>
                {product.dashboardRows.map(row => (
                  <MadeRow key={row.id} name={row.entityName} madeBy={row.actor} when={formatDate(row.at)} />
                ))}
              </MadeList>
            </Drill>
          )}

          {product.alertsFired > 0 && (
            <Drill label="See the alerts that fired" hideLabel="Hide the alerts">
              <MadeList>
                {product.alertRows.map(row => (
                  <MadeRow
                    key={row.id}
                    name={row.entityName}
                    madeBy={row.actor}
                    when={formatDateTime(row.at)}
                    note={row.actor === null ? 'fired by the scheduled worker' : undefined}
                  />
                ))}
              </MadeList>
            </Drill>
          )}
        </div>
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-23 — reports
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Reports made, worked on, shared.
 *
 * A report edited fifty times is one report and fifty activities. Both figures
 * are here, next to each other, and they are never added together.
 */
export function ReportsMade({ reports, period, subject }: { reports: ReportsActivity; period: Period; subject: string }) {
  if (reports.made === 0 && reports.activity === 0) {
    return (
      <Block id="reports" title="Reports" lede={null}>
        <Empty kind="quiet" title={`No report was made or worked on by ${subject} in this window.`} />
      </Block>
    );
  }

  return (
    <Block
      id="reports"
      title="Reports"
      lede={
        <>
          {subject === 'the company' ? 'The company' : subject} made <Fig>{fmtInt(reports.made)}</Fig> reports{' '}
          {period.phrase} and worked on them <Fig>{fmtInt(reports.activity)}</Fig> times.
          <Fig> {fmtInt(reports.shared)}</Fig> were shared outside the team. Made and worked on are two counts of
          two different things, so they are never added up.
        </>
      }
      hint="Made comes from the reports table. Worked on comes from the reports module's own activity trail."
      table={
        <div className="space-y-4">
          <StatRow>
            <Stat value={fmtInt(reports.made)} label="Reports made" />
            <Stat value={fmtInt(reports.activity)} label="Times worked on" />
            <Stat value={fmtInt(reports.shared)} label="Shared" />
            <Stat
              value={fmtInt(reports.actionPlansOpen)}
              label="Action plans open"
              sub={`${fmtInt(reports.actionPlansClosed)} closed`}
            />
          </StatRow>

          {reports.rows.length > 0 && (
            <Drill label={`Name the ${fmtInt(reports.made)} reports`} hideLabel="Hide the reports">
              <MadeList>
                {reports.rows.map(row => (
                  <MadeRow key={row.title} name={row.title} madeBy={row.by} when={formatDate(row.at)} note={row.status} />
                ))}
              </MadeList>
            </Drill>
          )}

          {reports.activityByType.length > 0 && (
            <Drill label="What the activity was" hideLabel="Hide the activity">
              <DataTable
                head={['Activity', 'Times']}
                rows={reports.activityByType.map(row => [row.type, fmtInt(row.count)])}
              />
            </Drill>
          )}
        </div>
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-24 — sampling
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Sample validation outcomes.
 *
 * Passed, failed and errored are three different facts and never share a bar. A
 * failed test is a finding. An errored one could not reach a verdict and needs a
 * person, which is work rather than a result.
 */
export function SamplingOutcomes({ sampling, period, subject }: { sampling: Sampling; period: Period; subject: string }) {
  if (sampling.total === 0) {
    return (
      <Block id="sampling" title="Sample validation" lede={null}>
        <Empty
          kind="quiet"
          title={`No samples were validated for ${subject} in this window.`}
          detail="Sampling runs are recorded with a full lifecycle, so this is a real zero rather than a gap."
        />
      </Block>
    );
  }

  const passRate = sampling.passed + sampling.failed === 0
    ? null
    : (sampling.passed * 100) / (sampling.passed + sampling.failed);

  return (
    <Block
      id="sampling"
      title="Sample validation"
      lede={
        <>
          <Fig>{fmtInt(sampling.total)}</Fig> sample validations ran for {subject} {period.phrase}:{' '}
          <Fig>{fmtInt(sampling.passed)}</Fig> passed, <Fig>{fmtInt(sampling.failed)}</Fig> failed and{' '}
          <Fig>{fmtInt(sampling.error)}</Fig> could not reach a verdict at all
          {sampling.error > 0 && <>, which is work waiting for a person rather than a result</>}
          {passRate !== null && <>. That is a pass rate of <Fig>{fmtPct(passRate)}</Fig> on the tests that concluded</>}.
        </>
      }
      hint="A pass flips its control to effective. A fail flips it to failed. An error flips nothing."
      chart={
        <div className="space-y-4">
          <Bars
            rows={[
              { label: 'Passed', value: sampling.passed },
              { label: 'Failed', value: sampling.failed },
              { label: 'Errored, needs a person', value: sampling.error },
              { label: 'Still queued or running', value: sampling.inFlight },
            ].filter(row => row.value > 0)}
          />
          {sampling.byControl.length > 0 && (
            <div>
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">
                The controls with something to look at
              </p>
              <DataTable
                head={['Control', 'Passed', 'Failed', 'Errored']}
                rows={sampling.byControl.map(row => [row.control, fmtInt(row.passed), fmtInt(row.failed), fmtInt(row.error)])}
              />
            </div>
          )}
        </div>
      }
      table={
        <DataTable
          head={['Outcome', 'Runs']}
          rows={[
            ['Passed', fmtInt(sampling.passed)],
            ['Failed', fmtInt(sampling.failed)],
            ['Errored, needs a person', fmtInt(sampling.error)],
            ['Queued or running', fmtInt(sampling.inFlight)],
            ['All validations', fmtInt(sampling.total)],
          ]}
        />
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-25 — insights
 * ────────────────────────────────────────────────────────────────────────── */

const SEVERITY_TONE: Record<string, string> = {
  Critical: 'text-risk-700',
  High: 'text-high-700',
  Medium: 'text-mitigated-700',
  Low: 'text-ink-600',
};

/**
 * Insights the platform generated.
 *
 * A consolidated insight summarises several per run ones, so the split between
 * them is on screen. Without it the same finding would be counted twice and
 * nobody looking at the number could tell.
 */
export function InsightsGenerated({ insights, period, subject }: { insights: InsightSummary; period: Period; subject: string }) {
  if (insights.total === 0) {
    return (
      <Block id="insights" title="Insights generated" lede={null}>
        <Empty kind="quiet" title={`The platform generated no insights for ${subject} in this window.`} />
      </Block>
    );
  }

  const severe = insights.bySeverity.find(s => s.severity === 'Critical')?.count ?? 0;

  return (
    <Block
      id="insights"
      title="Insights generated"
      lede={
        <>
          The platform generated <Fig>{fmtInt(insights.total)}</Fig> insights for {subject}{' '}
          {period.phrase}: <Fig>{fmtInt(insights.perRun)}</Fig> about a single run and{' '}
          <Fig>{fmtInt(insights.consolidated)}</Fig> that pull a whole engagement together
          {severe > 0 && <>, of which <Fig>{fmtInt(severe)}</Fig> {severe === 1 ? 'is' : 'are'} critical</>}.
        </>
      }
      hint="A consolidated insight summarises per run ones, so the two are counted apart and never added."
      chart={
        <div className="space-y-4">
          <Bars rows={insights.bySeverity.map(s => ({ label: s.severity, value: s.count }))} tone="risk" />
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">The newest</p>
            <MadeList>
              {insights.newest.map((row, i) => (
                <li key={`${row.headline}-${i}`} className="py-2">
                  <p className="text-[0.875rem] text-ink-800">{row.headline}</p>
                  <p className="text-[0.75rem] text-ink-500">
                    <span className={SEVERITY_TONE[row.severity]}>{row.severity}</span> · {row.engagement} · {formatDate(row.at)}
                  </p>
                </li>
              ))}
            </MadeList>
          </div>
        </div>
      }
      table={
        <DataTable
          head={['Severity', 'Insights']}
          rows={[
            ...insights.bySeverity.map(s => [s.severity, fmtInt(s.count)] as (string | number)[]),
            ['Per run', fmtInt(insights.perRun)],
            ['Consolidated', fmtInt(insights.consolidated)],
          ]}
        />
      }
    />
  );
}
