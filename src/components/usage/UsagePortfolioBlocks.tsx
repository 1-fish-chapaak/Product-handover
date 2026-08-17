/**
 * The audit work itself — PU-26, PU-27 and PU-28.
 *
 * Three blocks about the shape of the audit rather than the machinery under it:
 * what risks are recorded and which severe ones nothing covers, where every
 * open engagement has got to, and how much of the auditing now runs
 * continuously instead of once.
 *
 * Two rules are held in the markup here. The engagement strip is sorted by the
 * end of the audit period, a date, never by owner, because a portfolio sorted by
 * person is a league table of people. And the risk block says out loud when a
 * team view could only be reached through the risk's owner, so a team reading
 * zero knows whether it means "none of ours" or "we cannot tell".
 */

import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Bars, Block, DataTable, Drill, Empty, Fig, Stat } from './usageKit';
import { fmtInt, fmtPct, plural } from './usageFormat';
import type { CcmResult, PortfolioResult, RiskPicture } from '../../data/platform-usage-metrics';

/* ── PU-26 · The risk picture ────────────────────────────────────────────── */

export function RiskPictureBlock({
  data,
  periodLabel,
  onOpenRisks,
}: {
  data: RiskPicture;
  periodLabel: string;
  onOpenRisks: () => void;
}) {
  return (
    <Block
      title="Risks"
      hint="Recorded, prioritised, and not covered. A risk is covered when some control in the library names it, and the number to act on is the severe ones nothing tests."
      lede={
        data.total === 0 ? null : (
          <>
            {data.unmappedSevere > 0
              ? <><Fig>{plural(data.unmappedSevere, 'critical or high risk has', 'critical and high risks have')}</Fig> no control covering {data.unmappedSevere === 1 ? 'it' : 'them'}</>
              : <>Every critical and high risk has a control covering it</>}
            , out of <Fig>{plural(data.total, 'risk', 'risks')}</Fig> recorded.
          </>
        )
      }
      chart={
        data.total === 0 ? (
          <Empty
            kind="quiet"
            title={data.ownerScoped
              ? 'No risk in the register is owned by anybody on this team.'
              : 'No risks are recorded yet.'}
            detail={data.ownerScoped
              ? 'The register records an owner, not a team, so a team view can only reach the risks somebody here owns.'
              : undefined}
            action={{ label: 'Open the Risk Register', onClick: onOpenRisks }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <Stat
                size="md"
                value={fmtInt(data.unmappedSevere)}
                label="critical or high risks no control covers"
              />
              <Stat size="sm" value={fmtInt(data.total)} label="risks recorded" />
              <Stat size="sm" value={fmtInt(data.mapped)} label="covered by a control" />
              <Stat size="sm" value={fmtInt(data.createdInPeriod)} label={`added ${periodLabel.toLowerCase()}`} />
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">By priority</h4>
                <Bars rows={data.byPriority.map(r => ({ label: r.label, value: r.count }))} tone="risk" />
              </div>
              <div>
                <h4 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">By category</h4>
                <Bars rows={data.byCategory.map(r => ({ label: r.label, value: r.count }))} />
              </div>
            </div>

            {data.unmappedList.length > 0 && (
              <div className="mt-4">
                <Drill label={`Name the ${plural(data.unmappedList.length, 'uncovered risk', 'uncovered risks')}`}>
                  <ul className="divide-y divide-canvas-border border-t border-canvas-border">
                    {data.unmappedList.map(r => (
                      <li key={r.id} className="py-2">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-[0.875rem] text-ink-800">{r.name}</span>
                          <span className="text-[0.75rem] text-ink-400 shrink-0">{r.priority}</span>
                        </div>
                        <p className="text-[0.75rem] text-ink-500">{r.id} · {r.category} · owned by {r.owner}</p>
                      </li>
                    ))}
                  </ul>
                </Drill>
              </div>
            )}

            {/* The register stores who owns a risk and how severe it is. It does
                not store whether a person or the assistant put it there, so the
                page does not claim an AI share it cannot count. */}
            <p className="mt-4 text-[0.75rem] text-ink-400">
              {data.ownerScoped && (
                <>Reached through the risk owner, because the register records an owner and not a team. </>
              )}
              The register does not record whether a risk was typed by a person or drafted by the assistant,
              so no split by origin is shown.
            </p>
          </>
        )
      }
      table={
        <DataTable
          head={['Priority', 'Risks']}
          rows={[
            ...data.byPriority.map(r => [r.label, fmtInt(r.count)] as (string | number)[]),
            ['covered by a control', fmtInt(data.mapped)],
            ['covered by nothing', fmtInt(data.unmapped)],
          ]}
        />
      }
    />
  );
}

/* ── PU-27 · The engagement portfolio ────────────────────────────────────── */

/** How many engagements the strip shows before it asks. */
const STRIP_VISIBLE = 5;

export function EngagementPortfolioBlock({
  data,
  periodLabel,
  onOpenEngagement,
  onOpenExceptions,
  onOpenReports,
}: {
  data: PortfolioResult;
  periodLabel: string;
  onOpenEngagement: (id: string) => void;
  onOpenExceptions: (id: string) => void;
  onOpenReports: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const strip = showAll ? data.strip : data.strip.slice(0, STRIP_VISIBLE);

  const reportLabel: Record<string, string> = {
    none: 'no report yet',
    draft: 'report in draft',
    final: 'report issued',
  };

  return (
    <Block
      title="Engagements"
      hint="The portfolio and its motion. Where every open engagement has got to, sorted by the end of its audit period, soonest first."
      lede={
        data.total === 0 ? null : (
          <>
            <Fig>{plural(data.total, 'engagement', 'engagements')}</Fig> at this scope:{' '}
            {data.byStatus.filter(s => s.count > 0).map((s, i, arr) => (
              <span key={s.label}>
                {i > 0 && (i === arr.length - 1 ? ' and ' : ', ')}
                <Fig>{fmtInt(s.count)}</Fig> {s.label.toLowerCase()}
              </span>
            ))}
            {data.slipping.length > 0 && <>. <Fig>{plural(data.slipping.length, 'one is', 'of them are')}</Fig> still open after the audit period ended</>}.
          </>
        )
      }
      chart={
        data.total === 0 ? (
          <Empty kind="quiet" title="No engagement sits at this scope." />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              {data.byStatus.map(s => (
                <Stat key={s.label} size="sm" value={fmtInt(s.count)} label={s.label.toLowerCase()} />
              ))}
              <Stat size="sm" value={fmtInt(data.changes)} label={`recorded changes ${periodLabel.toLowerCase()}`} />
            </div>

            {data.slipping.length > 0 && (
              <p className="mt-4 text-[0.75rem] text-ink-600 tabular-nums">
                {plural(data.slipping.length, 'engagement is', 'engagements are')} still open after the audit
                period ended, the oldest by {fmtInt(data.slipping[0].daysOver)} days. Nothing in the record says
                whether that is late, so the page does not.
              </p>
            )}

            {/* Every cell opens the thing it counts, not just the row: a reader
                who wants the two open exceptions should land on those two, not
                on the engagement and another three clicks. */}
            {data.strip.length > 0 && (
              <ul className="mt-4 divide-y divide-canvas-border border-t border-canvas-border">
                {strip.map(e => (
                  <li key={e.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenEngagement(e.id)}
                          className="text-[0.875rem] font-medium text-ink-900 hover:text-brand-700 text-left"
                        >
                          {e.name}
                        </button>
                        <p className="mt-1 text-[0.75rem] text-ink-600 tabular-nums">
                          <Cell onClick={() => onOpenEngagement(e.id)}>
                            {fmtInt(e.controlsTested)} of {fmtInt(e.controlsTotal)} controls tested
                          </Cell>
                          {' · '}
                          <Cell onClick={() => onOpenExceptions(e.id)}>
                            {fmtInt(e.exceptionsOpen)} open {e.exceptionsOpen === 1 ? 'exception' : 'exceptions'}
                          </Cell>
                          {' · '}
                          <Cell onClick={() => onOpenExceptions(e.id)}>
                            {fmtInt(e.actionPlansOpen)} in remediation
                          </Cell>
                          {' · '}
                          {e.report === 'none'
                            ? <span className="text-ink-400">{reportLabel[e.report]}</span>
                            : <Cell onClick={onOpenReports}>{reportLabel[e.report]}</Cell>}
                        </p>
                        <p className="mt-0.5 text-[0.75rem] text-ink-400">
                          {e.owner}
                          {e.reviewer && <> · reviewed by {e.reviewer}</>} · period ends {e.periodEnd}
                          {e.daysOver !== null && <> · still open {fmtInt(e.daysOver)} days after it</>}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenEngagement(e.id)}
                        aria-label={`Open ${e.name}`}
                        className="mt-1 shrink-0 text-ink-400 hover:text-brand-700"
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {data.strip.length > STRIP_VISIBLE && (
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="mt-3 text-[0.75rem] font-medium text-brand-700 hover:underline tabular-nums"
              >
                {showAll
                  ? `Show the ${STRIP_VISIBLE} soonest`
                  : `Show all ${fmtInt(data.strip.length)}, soonest first`}
              </button>
            )}
          </>
        )
      }
      table={
        <DataTable
          head={['Engagement', 'Controls tested', 'Of', 'Open exceptions']}
          rows={data.strip.map(e => [e.name, fmtInt(e.controlsTested), fmtInt(e.controlsTotal), fmtInt(e.exceptionsOpen)])}
        />
      }
    />
  );
}

/** One figure in the strip, and the thing it opens. */
function Cell({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-ink-600 hover:text-brand-700 hover:underline">
      {children}
    </button>
  );
}

/* ── PU-28 · Continuous monitoring ───────────────────────────────────────── */

export function CcmCoverage({ data }: { data: CcmResult }) {
  const short = data.rows.filter(r => r.actual !== null && r.actual < r.threshold).length;

  return (
    <Block
      title="CCM and automation"
      hint="Monitoring that runs on a schedule. Continuous monitoring is a mode on an engagement, not a separate feature, and the pass rate here is the same data as the sampling block."
      lede={
        data.engagementsOn === 0 ? null : (
          <>
            <Fig>{fmtInt(data.engagementsOn)}</Fig> of {fmtInt(data.engagementsTotal)} engagements are monitored
            continuously, so <Fig>{fmtPct(data.sharePct)}</Fig> of the portfolio re-checks itself on a schedule
            {short > 0 && <>, and <Fig>{plural(short, 'one is', 'of them are')}</Fig> under the pass rate it expects</>}.
          </>
        )
      }
      chart={
        data.engagementsOn === 0 ? (
          <Empty
            kind="quiet"
            title="No engagement is set up to monitor continuously."
            detail={`${plural(data.engagementsTotal, 'engagement runs', 'engagements run')} as a one off audit.`}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <Stat
                size="md"
                value={fmtInt(data.engagementsOn)}
                label="engagements monitored continuously"
                sub={`of ${fmtInt(data.engagementsTotal)}, so ${fmtPct(data.sharePct)} of the portfolio`}
              />
              <Stat size="sm" value={fmtInt(data.bulkRuns)} label="bulk runs in this window" />
            </div>

            <ul className="mt-4 divide-y divide-canvas-border border-t border-canvas-border">
              {data.rows.map(r => {
                const short = r.actual !== null && r.actual < r.threshold;
                return (
                  <li key={r.engagement} className="py-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[0.875rem] text-ink-800 truncate">{r.engagement}</span>
                      <span className={`text-[0.875rem] font-medium tabular-nums shrink-0 ${short ? 'text-risk-700' : 'text-ink-900'}`}>
                        {r.actual === null ? 'nothing landed yet' : fmtPct(r.actual)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[0.75rem] text-ink-500 tabular-nums">
                      expects {fmtInt(r.threshold)}% · runs {r.cadence.toLowerCase()} ·{' '}
                      {r.sampleN === 0 ? 'no validations in this window' : `${plural(r.sampleN, 'validation', 'validations')} counted`} ·{' '}
                      {r.approvals} to clear an exception
                      {r.inGate > 0 && <> · {fmtInt(r.inGate)} sitting in a gate now</>}
                      {short && <span className="text-risk-700"> · under its threshold</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )
      }
      table={
        <DataTable
          head={['Engagement', 'Expects', 'Actual', 'Validations']}
          rows={data.rows.map(r => [
            r.engagement,
            `${fmtInt(r.threshold)}%`,
            r.actual === null ? 'nothing landed' : fmtPct(r.actual),
            fmtInt(r.sampleN),
          ])}
        />
      }
    />
  );
}
