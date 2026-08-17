/**
 * The audit itself: risks, engagements, and what runs continuously.
 *
 * PU-26 risks · PU-27 the engagement portfolio and its motion ·
 * PU-28 continuous monitoring.
 *
 * The one number a CFO acts on in this group is the audit gap: severe risks with
 * no control covering them. It is a hand countable fact off the register, it
 * rests on no assumption, and it is the most useful sentence on the page.
 */

import { ArrowRight } from 'lucide-react';
import { formatDate } from '../../data/platform-usage';
import {
  fmtInt, fmtPct,
  type Ccm, type Period, type Portfolio, type RiskPicture, type Scope,
} from '../../data/platform-usage-metrics';
import { Bars, Block, DataTable, Drill, Empty, Fig, Meter, Stat, StatRow } from './usageKit';

/* ──────────────────────────────────────────────────────────────────────────
 * PU-26 — the risk picture
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Risks recorded, prioritised, and not covered.
 *
 * Two stories from one register: the shape of the risk register, and the gap in
 * it. The share the AI wrote is labelled as a share, because that is a fact
 * worth knowing in both directions.
 */
export function RiskPictureBlock({
  risks,
  scope,
  onOpenRisks,
}: {
  risks: RiskPicture;
  scope: Scope;
  onOpenRisks: () => void;
}) {
  if (risks.total === 0) {
    return (
      <Block id="risks" title="Risks" lede={null}>
        <Empty
          kind="quiet"
          title="No risks are recorded for this scope."
          detail="Without a register there is no coverage to claim, so this block claims none."
        />
      </Block>
    );
  }

  const whose = scope.persona === 'head_of_team' ? "your team's" : 'the';

  return (
    <Block
      id="risks"
      title="Risks"
      lede={
        risks.unmappedSevere.length === 0 ? (
          <>
            Every critical and high risk in {whose} register has at least one control covering it.{' '}
            <Fig>{fmtInt(risks.unmapped)}</Fig> lower risks are still uncovered, and{' '}
            <Fig>{fmtPct(risks.aiGeneratedShare)}</Fig> of the register was written by the AI.
          </>
        ) : (
          <>
            <Fig>{fmtInt(risks.unmappedSevere.length)}</Fig> critical and high risks in {whose} register have no
            control covering them at all. In total <Fig>{fmtInt(risks.unmapped)}</Fig> of{' '}
            <Fig>{fmtInt(risks.total)}</Fig> risks are unmapped, and{' '}
            <Fig>{fmtPct(risks.aiGeneratedShare)}</Fig> of the register was written by the AI rather than typed
            or imported.
          </>
        )
      }
      hint="Mapped and unmapped are read from the control library's own risk links, so this page and the library cannot disagree."
      action={
        <button type="button" onClick={onOpenRisks} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline">
          Open the register <ArrowRight size={12} />
        </button>
      }
      chart={
        <div className="space-y-4">
          <StatRow>
            <Stat value={fmtInt(risks.unmappedSevere.length)} label="Severe risks with no control" />
            <Stat value={fmtInt(risks.mapped)} label="Risks with a control" sub={`of ${fmtInt(risks.total)} recorded`} />
            <Stat value={fmtPct(risks.aiGeneratedShare)} label="Written by the AI" />
            <Stat value={fmtInt(risks.createdInPeriod)} label="Added in this window" />
          </StatRow>

          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">By priority</p>
            <Bars
              rows={risks.byPriority.map(row => ({ label: row.priority, value: row.count }))}
              tone="risk"
            />
          </div>

          {risks.unmappedSevere.length > 0 && (
            <Drill label={`Name the ${fmtInt(risks.unmappedSevere.length)} with no control`} hideLabel="Hide the risks">
              <DataTable
                head={['Risk', 'Priority', 'Owner']}
                rows={risks.unmappedSevere.map(row => [`${row.id} ${row.name}`, row.priority, row.owner])}
                numericFrom={99}
              />
            </Drill>
          )}
        </div>
      }
      table={
        <div className="space-y-4">
          <DataTable
            head={['Priority', 'Risks']}
            rows={risks.byPriority.map(row => [row.priority, fmtInt(row.count)])}
          />
          <DataTable
            head={['Category', 'Risks']}
            rows={risks.byCategory.map(row => [row.category, fmtInt(row.count)])}
          />
        </div>
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-27 — the engagement portfolio
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The portfolio and its motion.
 *
 * The status tiles say what the portfolio is. The strip underneath says where
 * each live engagement has got to, one row each, sorted by the date its audit
 * period ends. Sorted by a date, never by a person.
 */
export function EngagementPortfolioBlock({
  portfolio,
  period,
  onOpenEngagement,
}: {
  portfolio: Portfolio;
  period: Period;
  onOpenEngagement: (id: string) => void;
}) {
  if (portfolio.total === 0) {
    return (
      <Block id="engagements" title="Engagements" lede={null}>
        <Empty kind="quiet" title="No engagements are recorded for this scope yet." />
      </Block>
    );
  }

  const strip = portfolio.strip.slice(0, 5);

  return (
    <Block
      id="engagements"
      title="Engagements"
      lede={
        <>
          <Fig>{fmtInt(portfolio.total)}</Fig> engagements are on the books, of which{' '}
          <Fig>{fmtInt(portfolio.strip.length)}</Fig> are live.{' '}
          {portfolio.slipping.length > 0
            ? <><Fig>{fmtInt(portfolio.slipping.length)}</Fig> are past the date they were planned to finish. </>
            : 'None is past the date it was planned to finish. '}
          Their records were changed <Fig>{fmtInt(portfolio.changes)}</Fig> times {period.phrase},
          each change recorded with who made it and what it was.
        </>
      }
      hint="Every cell on the strip reconciles with its own source table and opens it."
      chart={
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-5">
            {portfolio.byStatus.map(row => (
              <Stat key={row.status} value={fmtInt(row.count)} label={row.status} size="sm" />
            ))}
          </div>

          {strip.length > 0 && (
            <div>
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">
                Where each live engagement has got to
              </p>
              <ul className="divide-y divide-canvas-border border-t border-canvas-border">
                {strip.map(row => (
                  <li key={row.id} className="py-3">
                    <button type="button" onClick={() => onOpenEngagement(row.id)} className="text-left w-full group">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[0.875rem] font-medium text-ink-900 group-hover:text-brand-700 truncate">
                          {row.code} {row.name}
                        </span>
                        <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">
                          {row.periodEndAt === null ? 'no period end' : `period ends ${formatDate(row.periodEndAt)}`}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.75rem] text-ink-500">
                        {fmtInt(row.controlsTested)} of {fmtInt(row.controlsTotal)} controls tested ·{' '}
                        {fmtInt(row.exceptionsOpen)} exceptions open · {fmtInt(row.actionPlansOpen)} action plans open ·{' '}
                        report {row.report} · {row.owner}
                        {row.reviewer ? `, reviewed by ${row.reviewer}` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              {portfolio.strip.length > strip.length && (
                <p className="mt-2 text-[0.75rem] text-ink-500">
                  Showing the {strip.length} whose period ends soonest. The table behind this block holds all{' '}
                  {fmtInt(portfolio.strip.length)}.
                </p>
              )}
            </div>
          )}

          {portfolio.slipping.length > 0 && (
            <Drill label={`Which ${fmtInt(portfolio.slipping.length)} are late`} hideLabel="Hide the late ones">
              <DataTable
                head={['Engagement', 'Owner', 'Planned to finish']}
                rows={portfolio.slipping.map(row => [`${row.code} ${row.name}`, row.owner, formatDate(row.plannedEndAt)])}
                numericFrom={99}
              />
            </Drill>
          )}
        </div>
      }
      table={
        <DataTable
          head={['Engagement', 'Controls tested', 'Exceptions open', 'Action plans', 'Report']}
          rows={portfolio.strip.map(row => [
            `${row.code} ${row.name}`,
            `${fmtInt(row.controlsTested)} of ${fmtInt(row.controlsTotal)}`,
            fmtInt(row.exceptionsOpen),
            fmtInt(row.actionPlansOpen),
            row.report,
          ])}
        />
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-28 — continuous monitoring
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * How much of the auditing runs on a schedule.
 *
 * Continuous monitoring is a mode an engagement runs in rather than a separate
 * feature, so this reads each engagement's automation config. The threshold line
 * uses the same pass and fail data as the sampling block, never a second
 * computation, so the two can never disagree.
 */
export function CcmCoverage({ ccm, period }: { ccm: Ccm; period: Period }) {
  if (ccm.engagementsOn === 0) {
    return (
      <Block id="ccm" title="Continuous monitoring" lede={null}>
        <Empty
          kind="quiet"
          title="No engagement is set to monitor continuously."
          detail="Every audit here runs once rather than on a schedule. That is a setting on the engagement, not a gap in what the platform records."
        />
      </Block>
    );
  }

  const pct = (ccm.engagementsOn * 100) / Math.max(1, ccm.engagementsTotal);
  const below = ccm.thresholdRows.filter(row => row.actual !== null && row.actual < row.threshold);

  return (
    <Block
      id="ccm"
      title="Continuous monitoring"
      lede={
        <>
          <Fig>{fmtInt(ccm.engagementsOn)}</Fig> of <Fig>{fmtInt(ccm.engagementsTotal)}</Fig> engagements run
          their checks on a schedule rather than once, which is <Fig>{fmtPct(pct)}</Fig> of the portfolio.
          {below.length > 0
            ? <> <Fig>{fmtInt(below.length)}</Fig> of them {below.length === 1 ? 'is' : 'are'} passing below the rate {below.length === 1 ? 'it' : 'they'} {below.length === 1 ? 'was' : 'were'} set to hold.</>
            : ' All of them are passing at or above the rate they were set to hold.'}
        </>
      }
      hint="Read from each engagement's automation config: the mode, the schedule, the pass rate it must hold."
      chart={
        <div className="space-y-4">
          <div className="max-w-xl">
            <Meter pct={pct} label={`${fmtInt(ccm.engagementsOn)} monitoring continuously, ${fmtInt(ccm.engagementsTotal - ccm.engagementsOn)} running once`} />
          </div>

          <StatRow>
            <Stat value={fmtInt(ccm.bulkRuns)} label="Bulk runs in this window" />
            <Stat value={fmtInt(ccm.gateVerdicts)} label="Exceptions through an approval gate" />
            {ccm.schedules.map(row => (
              <Stat key={row.frequency} value={fmtInt(row.count)} label={`On a ${row.frequency.toLowerCase()} schedule`} size="sm" />
            ))}
          </StatRow>

          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">
              The rate each one holds, against what it is actually passing
            </p>
            <DataTable
              head={['Engagement', 'Schedule', 'Must hold', 'Actually passing']}
              rows={ccm.thresholdRows.map(row => [
                row.engagement,
                row.frequency,
                fmtPct(row.threshold),
                row.actual === null ? 'too few tests to say' : fmtPct(row.actual),
              ])}
              numericFrom={2}
            />
          </div>
        </div>
      }
      table={
        <DataTable
          head={['Engagement', 'Schedule', 'Must hold', 'Actually passing']}
          rows={ccm.thresholdRows.map(row => [
            row.engagement,
            row.frequency,
            fmtPct(row.threshold),
            row.actual === null ? 'too few tests to say' : fmtPct(row.actual),
          ])}
          numericFrom={2}
        />
      }
      footer={`The pass rate is the same pass and fail data the sampling block counts, ${period.phrase}.`}
    />
  );
}
