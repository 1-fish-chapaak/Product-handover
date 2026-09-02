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
import { Bars, Block, CountWithList, DataTable, Drill, Empty, Fig, Fold, MadeList, MadeRow, Stat, StatRow } from './usageKit';

/**
 * A count that opens its list, or one quiet line saying there was nothing.
 *
 * These blocks list several kinds of thing at once, and a window that produced
 * two of five kinds rendered two links and three padded empty-state boxes. The
 * boxes read as a page half loaded. A kind that produced nothing gets the same
 * sentence it always had, at the size of a footnote, on one line.
 */
function CountOrLine({
  label, items, emptyTitle,
}: {
  label: string;
  items: { name: string; by: string | null; at: number; note?: string }[];
  emptyTitle: string;
}) {
  if (items.length === 0) return <p className="text-[0.75rem] text-ink-500">{emptyTitle}</p>;
  return <CountWithList label={label} items={items} emptyTitle={emptyTitle} />;
}

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

  /*
   * The head splits the runs into parts that add up to it.
   *
   * It used to say "359 checks ran, 340 passed and 18 failed", which is 358.
   * The missing one was the run stopped waiting on a person. A reader who does
   * that subtraction and comes up short stops trusting every other figure on
   * the page, so the split is whole and the stat row below drops the tile that
   * used to carry the third part on its own.
   */
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
      code="RUN-VOLUME"
      figure={fmtInt(volume.runs)}
      context={
        <>
          checks ran {period.phrase}, {fmtInt(volume.passed)} passed, {fmtInt(volume.failed)} failed
          {volume.blocked > 0 && <> and {fmtInt(volume.blocked)} stopped waiting on a person</>}
        </>
      }
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
          {volume.lookupCalls > 0 && (
            <> The <Fig>{fmtInt(volume.lookupCalls)}</Fig> paid lookup calls are every attempt.
              {volume.lookupCallsFailed > 0 && (
                <> <Fig>{fmtInt(volume.lookupCallsFailed)}</Fig> of them came back with nothing.</>
              )}{' '}
              The cost block charges only for the calls on a contract price, so its figure is smaller
              and it shows the split.</>
          )}
        </>
      }
    >
      <div className="mb-4">
        <StatRow>
          {/* The card's own head says how the runs came out, so this row keeps
              the figures it has not got: the rate, and the three surfaces that
              are not workflow runs at all. */}
          <Stat value={fmtPct(volume.runs ? (volume.passed / volume.runs) * 100 : 0)} label="pass rate" />
          <Stat value={fmtInt(volume.chat)} label="questions asked in chat" />
          <Stat value={fmtInt(volume.concierge)} label="concierge jobs" />
          <Stat value={fmtInt(volume.lookupCalls)} label="paid lookup calls" />
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
  const made = groups.filter(g => g.items.length > 0);
  const missing = groups.filter(g => g.items.length === 0);

  return (
    <Block
      id="created"
      title="What was created"
      code="NEW-RECORDS"
      figure={fmtInt(total)}
      context={<>things created {period.phrase}</>}
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
              {made.map((g, i) => (
                <span key={g.key}>
                  <Fig>{fmtInt(g.items.length)}</Fig> {g.items.length === 1 ? g.label : g.plural}
                  {i === made.length - 2 ? ' and ' : i === made.length - 1 ? '.' : ', '}
                </span>
              ))}
            </>
          )
      }
    >
      {/*
        * Only the kinds that happened get a row.
        *
        * Every kind used to render whether or not anything was created, so a
        * month with one engagement and one dashboard in it printed two links
        * and three empty states, each with its own box and its own gap. The
        * kinds with nothing are worth one line at the end, not three blocks in
        * the middle.
        */}
      <div className="space-y-3">
        {made.map(g => (
          <CountWithList
            key={g.key}
            label={openLabel(g.items.length, g.label, g.plural)}
            items={g.items}
            emptyTitle={`No ${g.label} was created in this window.`}
          />
        ))}
        {total === 0 && <Empty kind="quiet" title={`Nothing new was created ${period.phrase}.`} />}
        {made.length > 0 && missing.length > 0 && (
          <p className="text-[0.75rem] text-ink-500">
            No {missing.map(g => g.label).join(', ').replace(/, ([^,]*)$/, ' or $1')} was created{' '}
            {period.phrase}.
          </p>
        )}
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
      code="DASH-ALERTS"
      figure={fmtInt(product.alertsFired)}
      context={<>alert fires {period.phrase}, across {fmtInt(product.dashboardsBuilt.length)} dashboards built</>}
      hint="This page reports on alerts. It does not send them, and there is nothing here to configure."
      lede={
        product.dashboardsBuilt.length === 0 && product.alertsFired === 0
          ? <>No dashboard was built and no alert fired {period.phrase}.</>
          : (
            <>
              <Fig>{fmtInt(product.dashboardsBuilt.length)}</Fig>{' '}
              {product.dashboardsBuilt.length === 1 ? 'dashboard was' : 'dashboards were'} built and{' '}
              <Fig>{fmtInt(product.widgetsAdded)}</Fig>{' '}
              {product.widgetsAdded === 1 ? 'widget' : 'widgets'} added {period.phrase}. Alerts fired{' '}
              <Fig>{fmtInt(product.alertsFired)}</Fig> {product.alertsFired === 1 ? 'time' : 'times'}
              {product.alertsFired > 0 && product.alertsConfigured.length === 0
                && <>, all of them from alerts set up before this window</>}.
            </>
          )
      }
    >
      {/* An absent kind is a line, not a box. See "What was created" above. */}
      <div className="space-y-3">
        <CountOrLine
          label={openLabel(product.dashboardsBuilt.length, 'dashboard', 'dashboards')}
          items={product.dashboardsBuilt}
          emptyTitle="No dashboard was built in this window."
        />
        <CountOrLine
          label={openLabel(product.alertsConfigured.length, 'alert set up in this window', 'alerts set up in this window')}
          items={product.alertsConfigured}
          emptyTitle={product.alertsFired > 0
            ? 'No new alert was set up in this window. The ones that fired were set up before it.'
            : 'No alert was set up in this window.'}
        />
        <CountOrLine
          label={openLabel(product.alertsFired, 'alert fire', 'alert fires')}
          items={product.alertsFiredList}
          emptyTitle="No alert fired in this window."
        />
      </div>
    </Block>
  );
}

/* ── Reports ─────────────────────────────────────────────────────────────── */

export function ReportsMade({ reports, period }: { reports: ReportFigures; period: Period }) {
  return (
    <Block
      id="reports"
      title="Reports made and shared"
      code="REP-MADE"
      figure={fmtInt(reports.made.length)}
      context={<>reports created {period.phrase}, {fmtInt(reports.finalised)} moved to final</>}
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
        <CountOrLine
          label={openLabel(reports.made.length, 'report', 'reports')}
          items={reports.made}
          emptyTitle="No report was created in this window."
        />
        <CountOrLine
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
      code="ENG-PORTFOLIO"
      figure={fmtInt(portfolio.open)}
      /* "13 / 13" is a fraction that has nothing to say. When every engagement
         on the books is still open the denominator is dropped and the context
         line says it in words instead. */
      of={portfolio.open === portfolio.rows.length ? undefined : fmtInt(portfolio.rows.length)}
      context={portfolio.open === portfolio.rows.length
        ? 'engagements on the books, and every one of them is still open'
        : 'engagements still open, of everything on the books'}
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
      chart={
        <Bars
          rows={portfolio.byStatus}
          caption={portfolio.rows.length === 1
            ? <>The one engagement on the books, by the stage it has reached.</>
            : <>All {fmtInt(portfolio.rows.length)} engagements on the books, by the stage each has reached.</>}
        />
      }
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
      {/*
        * The status split is the chart above, and the chart has its table one
        * click away. A row of stats saying the same five numbers a second time
        * is the kind of repeat that makes a reader wonder which one to believe.
        */}
      {portfolio.strip.length > 0 && (
        <Fold label="Where each open engagement has got to">
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
        </Fold>
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
