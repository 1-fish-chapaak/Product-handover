/**
 * The volume of work, what was created in the window, and the surfaces people
 * built with it: dashboards, alerts, reports, engagements.
 *
 * Every count here opens its list, with the name, who made it and when. A reader
 * cannot check a count they cannot open.
 */

import { formatDate } from '../../data/platform-usage';
import {
  fmtInt, fmtPct, openLabel, opening,
  type CreatedFigures, type Period, type PortfolioFigures, type ProductFigures,
  type ReportFigures, type VolumeFigures,
} from '../../data/platform-usage-metrics';
import { Bars, Block, CountWithList, DataTable, Drill, Empty, Fig, MadeList, MadeRow, Stat, StatRow } from './usageKit';

/* ── Work volume ─────────────────────────────────────────────────────────── */

export function WorkVolume({
  volume, period, subject, onOpenRuns,
}: {
  volume: VolumeFigures;
  period: Period;
  subject: string;
  onOpenRuns: () => void;
}) {
  if (volume.runs === 0 && volume.chat === 0 && volume.concierge === 0) {
    return (
      <Block id="volume" title="Work volume" lede={null}>
        <Empty kind="quiet" title={`Nothing ran ${period.phrase}.`} />
      </Block>
    );
  }

  const rows = [
    { label: 'Workflow runs', value: volume.runs },
    { label: 'Chat questions', value: volume.chat },
    { label: 'Concierge jobs', value: volume.concierge },
    { label: 'SOP to RACM jobs', value: volume.sopJobs },
    { label: 'Paid lookup calls', value: volume.lookupCalls },
  ];

  return (
    <Block
      id="volume"
      title="Work volume"
      lede={
        <>
          {opening(subject)} ran <Fig>{fmtInt(volume.runs)}</Fig> checks {period.phrase}:{' '}
          <Fig>{fmtInt(volume.passed)}</Fig> passed, <Fig>{fmtInt(volume.failed)}</Fig> failed and{' '}
          <Fig>{fmtInt(volume.blocked)}</Fig> stopped waiting on a person.
        </>
      }
      action={
        <button type="button" onClick={onOpenRuns} className="text-[0.75rem] font-medium text-brand-700 hover:underline">
          Open the library
        </button>
      }
      table={<DataTable head={['Surface', 'Count']} rows={rows.map(r => [r.label, fmtInt(r.value)])} />}
      footer={
        <>
          <Fig>{fmtInt(volume.chatVerified)}</Fig> of the chat answers were re-run and checked.{' '}
          <Fig>{fmtInt(volume.conciergeTimedOut)}</Fig> Concierge jobs were killed for running past
          their time limit: there is no retry and no switch to another model, by design, because a
          silent switch would change the result.
        </>
      }
    >
      <div className="mb-4">
        <StatRow>
          <Stat value={fmtInt(volume.passed)} label="runs that passed" />
          <Stat value={fmtInt(volume.failed)} label="runs that failed" />
          <Stat value={fmtInt(volume.checksPerformed)} label="row checks performed" sub="repeats included" />
          <Stat value={fmtPct(volume.runs ? (volume.passed / volume.runs) * 100 : 0)} label="pass rate" />
        </StatRow>
      </div>
    </Block>
  );
}

/* ── What was created ────────────────────────────────────────────────────── */

export function CreatedThisPeriod({ created, period }: { created: CreatedFigures; period: Period }) {
  const groups = [
    { key: 'engagements', label: 'engagement', plural: 'engagements', items: created.engagements },
    { key: 'controls', label: 'control', plural: 'controls', items: created.controls },
    { key: 'risks', label: 'risk', plural: 'risks', items: created.risks },
    { key: 'dashboards', label: 'dashboard', plural: 'dashboards', items: created.dashboards },
    { key: 'reports', label: 'report', plural: 'reports', items: created.reports },
  ];
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Block
      id="created"
      title="What was created"
      hint="Created, not activity. Edits, reviews and time spent are a different question and this block does not claim to answer it."
      lede={
        total === 0
          // A quiet window is a designed zero rather than the unmeasured empty
          // state: the count is real, it is just nought.
          ? <>Nothing new was created {period.phrase}.</>
          : (
            <>
              <Fig>{fmtInt(total)}</Fig> {total === 1 ? 'thing was' : 'things were'} created{' '}
              {period.phrase}:{' '}
              {groups.map((g, i) => (
                <span key={g.key}>
                  <Fig>{fmtInt(g.items.length)}</Fig> {g.items.length === 1 ? g.label : g.plural}
                  {i === groups.length - 2 ? ' and ' : i === groups.length - 1 ? '.' : ', '}
                </span>
              ))}
            </>
          )
      }
    >
      <div className="space-y-3">
        {groups.map(g => (
          <CountWithList
            key={g.key}
            label={openLabel(g.items.length, g.label, g.plural)}
            items={g.items}
            emptyTitle={`No ${g.label} was created in this window.`}
          />
        ))}
      </div>
    </Block>
  );
}

/* ── Dashboards and alerts ───────────────────────────────────────────────── */

export function DashboardsAndAlerts({ product, period }: { product: ProductFigures; period: Period }) {
  return (
    <Block
      id="dashboards"
      title="Dashboards and alerts"
      lede={
        product.dashboardsBuilt.length === 0 && product.alertsFired === 0
          ? <>No dashboard was built and no alert fired {period.phrase}.</>
          : (
            <>
              <Fig>{fmtInt(product.dashboardsBuilt.length)}</Fig>{' '}
              {product.dashboardsBuilt.length === 1 ? 'dashboard was' : 'dashboards were'} built and{' '}
              <Fig>{fmtInt(product.widgetsAdded)}</Fig>{' '}
              {product.widgetsAdded === 1 ? 'widget' : 'widgets'} added {period.phrase}. Alerts fired{' '}
              <Fig>{fmtInt(product.alertsFired)}</Fig> {product.alertsFired === 1 ? 'time' : 'times'}.
            </>
          )
      }
    >
      <div className="space-y-3">
        <CountWithList
          label={openLabel(product.dashboardsBuilt.length, 'dashboard', 'dashboards')}
          items={product.dashboardsBuilt}
          emptyTitle="No dashboard was built in this window."
        />
        <CountWithList
          label={openLabel(product.alertsConfigured.length, 'alert that was configured', 'alerts that were configured')}
          items={product.alertsConfigured}
          emptyTitle="No alert was configured in this window."
        />
        <CountWithList
          label={openLabel(product.alertsFired, 'alert fire', 'alert fires')}
          items={product.alertsFiredList}
          emptyTitle="No alert fired in this window."
        />
      </div>
      <p className="mt-3 text-[0.75rem] text-ink-500 leading-relaxed">
        This page reports on alerts. It does not send them, and there is nothing here to configure.
      </p>
    </Block>
  );
}

/* ── Reports ─────────────────────────────────────────────────────────────── */

export function ReportsMade({ reports, period }: { reports: ReportFigures; period: Period }) {
  return (
    <Block
      id="reports"
      title="Reports made and shared"
      lede={
        reports.made.length === 0 && reports.shared.length === 0
          ? <>No report was created or shared {period.phrase}.</>
          : (
            <>
              <Fig>{fmtInt(reports.made.length)}</Fig>{' '}
              {reports.made.length === 1 ? 'report was' : 'reports were'} created {period.phrase},{' '}
              <Fig>{fmtInt(reports.finalised)}</Fig> moved to final and{' '}
              <Fig>{fmtInt(reports.shared.length)}</Fig>{' '}
              {reports.shared.length === 1 ? 'share' : 'shares'} went out.
            </>
          )
      }
    >
      <div className="space-y-3">
        <CountWithList
          label={openLabel(reports.made.length, 'report', 'reports')}
          items={reports.made}
          emptyTitle="No report was created in this window."
        />
        <CountWithList
          label={openLabel(reports.shared.length, 'share', 'shares')}
          items={reports.shared}
          emptyTitle="Nothing was shared in this window."
        />
      </div>
    </Block>
  );
}

/* ── The engagement portfolio ────────────────────────────────────────────── */

export function EngagementPortfolio({
  portfolio, period, onOpenEngagement,
}: {
  portfolio: PortfolioFigures;
  period: Period;
  onOpenEngagement: (id: string) => void;
}) {
  if (portfolio.rows.length === 0) {
    return (
      <Block id="portfolio" title="The engagement portfolio" lede={null}>
        <Empty kind="quiet" title="No engagement is on the books." />
      </Block>
    );
  }

  return (
    <Block
      id="portfolio"
      title="The engagement portfolio"
      hint="Each engagement locks its RACM version at creation, so a later edit to the library cannot quietly change a running audit."
      lede={
        <>
          <Fig>{fmtInt(portfolio.rows.length)}</Fig> engagements are on the books,{' '}
          <Fig>{fmtInt(portfolio.open)}</Fig> of them still open.{' '}
          {portfolio.slipping > 0
            ? (
              <>
                <Fig>{fmtInt(portfolio.slipping)}</Fig> plan to close more than six weeks after the
                period {portfolio.slipping === 1 ? 'it audits' : 'they audit'} ended.
              </>
            )
            : <>None plans to close long after the period it audits.</>}
        </>
      }
      chart={<Bars rows={portfolio.byStatus} />}
      table={
        <DataTable
          head={['Engagement', 'Status', 'Owner', 'Reviewer', 'RACM', 'Planned close', 'Changes']}
          numericFrom={6}
          rows={portfolio.rows.map(e => [
            e.name, e.status, e.owner, e.reviewer, e.lockedRacmVersion,
            formatDate(e.plannedEnd), fmtInt(e.changes),
          ])}
        />
      }
      footer={`${fmtInt(portfolio.changesInPeriod)} changes were recorded against these engagements ${period.phrase}. An engagement edited fifty times is one engagement and fifty changes.`}
    >
      <StatRow>
        {portfolio.byStatus.map(row => (
          <Stat key={row.label} label={row.label} value={fmtInt(row.value)} size="sm" />
        ))}
      </StatRow>

      {portfolio.strip.length > 0 && (
        <div className="mt-5 pt-4 border-t border-canvas-border">
          <h4 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-400 mb-1">
            Where each open engagement has got to
          </h4>
          <p className="text-[0.75rem] text-ink-500 mb-3 max-w-[76ch] leading-relaxed">
            Soonest audit period end first. Sorted by a date rather than by a person, because this is
            about the work and not about who is doing it.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.875rem]">
              <thead>
                <tr className="border-b border-canvas-border">
                  {['Engagement', 'Owner and reviewer', 'Controls tested', 'Findings open', 'Plans open', 'Report', 'Period ends'].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`py-2 pr-6 last:pr-0 whitespace-nowrap text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 ${i >= 2 && i <= 4 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.strip.map(row => (
                  <tr key={row.id} className="border-b border-canvas-border last:border-0">
                    <td className="py-2 pr-6">
                      <button
                        type="button"
                        onClick={() => onOpenEngagement(row.id)}
                        className="text-left text-ink-800 hover:text-brand-700 hover:underline"
                      >
                        {row.code} · {row.name}
                      </button>
                    </td>
                    <td className="py-2 pr-6 text-ink-600">{row.owner}, reviewed by {row.reviewer}</td>
                    <td className="py-2 pr-6 text-right tabular-nums text-ink-800 whitespace-nowrap">
                      {fmtInt(row.controlsTested)} of {fmtInt(row.controlsTotal)}
                    </td>
                    <td className="py-2 pr-6 text-right tabular-nums text-ink-800">{fmtInt(row.exceptionsOpen)}</td>
                    <td className="py-2 pr-6 text-right tabular-nums text-ink-800">{fmtInt(row.actionPlansOpen)}</td>
                    <td className="py-2 pr-6 text-ink-600 whitespace-nowrap">
                      {row.reportState === 'none' ? 'not started' : row.reportState}
                    </td>
                    <td className="py-2 text-ink-600 tabular-nums whitespace-nowrap">
                      {formatDate(row.auditPeriodEnd)}
                      {row.slipping && (
                        <span className="block text-risk-700">planning to close {formatDate(row.plannedEnd)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Drill label={openLabel(portfolio.rows.length, 'engagement', 'engagements')}>
          <MadeList>
            {portfolio.rows.map(e => (
              <MadeRow
                key={e.id}
                name={`${e.code} · ${e.name}`}
                madeBy={`${e.status} · owned by ${e.owner}`}
                when={formatDate(e.createdAt)}
                note={e.actualEnd === null ? `planned close ${formatDate(e.plannedEnd)}` : `closed ${formatDate(e.actualEnd)}`}
                onOpen={() => onOpenEngagement(e.id)}
              />
            ))}
          </MadeList>
        </Drill>
      </div>
    </Block>
  );
}
