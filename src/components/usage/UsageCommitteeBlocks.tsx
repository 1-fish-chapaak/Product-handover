/**
 * What the audit committee asks, on the page that already holds the records.
 *
 * These two blocks came out of the research in `PLATFORM-USAGE-RESEARCH.md`:
 * the profession's own reporting standards say the recurring artifact is the
 * committee pack, and the first things it carries are how much of the plan
 * closed, and what is past a date somebody agreed to. Both are answerable from
 * this customer's own records, with no assumed rate anywhere near them.
 *
 * They sit on the Coverage tab of the CFO view only, and deliberately not on
 * the head-of-team view: these figures are the whole company's, and that view
 * may never look sideways at another team's work.
 */

import { useMemo } from 'react';
import { Pill, type Tone } from '../shared/StatusBadge';
import SmartTable, { type Column } from '../shared/SmartTable';
import { CalendarClock } from 'lucide-react';
import { formatDate } from '../../data/platform-usage';
import { fmtInt, type Period } from '../../data/platform-usage-metrics';
import { type CoveragePack } from '../../data/audit-coverage';
import { Block, Empty, Fig, Stat, StatRow, useUsageLayout } from './usageKit';

/** Severity through the shared pill's vocabulary, never a bespoke colour. */
const SEVERITY_TONE: Record<string, Tone> = {
  Critical: 'risk',
  High: 'high',
  Medium: 'mitigated',
  Low: 'draft',
};

interface LateRow extends Record<string, unknown> {
  id: string;
  kind: string;
  title: string;
  detail: string;
  severity: string | null;
  dueAt: number;
  view: string;
  targetId: string;
}

/**
 * Everything past a date, in one list.
 *
 * Engagements, findings and action plans are three records in three screens,
 * and a reader preparing for a meeting has to hold all three at once. Sorted
 * oldest first, because that is the order the questions come in.
 */
export function PastTheirDate({
  coverage,
  period,
  onOpen,
}: {
  coverage: CoveragePack;
  period: Period;
  onOpen: (view: string, id: string) => void;
}) {
  const { plan, findings, actions } = coverage;
  // The dense layout pads its blocks, so the table pulls out to the card's own
  // edge. The report layout has no padding to pull out of.
  const bleed = useUsageLayout() === 'report' ? 'mt-4' : '-mx-5 -mb-5';

  const rows: LateRow[] = useMemo(() => [
    ...plan.slipping.map(e => ({
      id: e.id,
      kind: 'Engagement',
      title: `${e.code} · ${e.name}`,
      detail: `${e.status} · ${e.owner}`,
      severity: null,
      dueAt: e.plannedEnd,
      view: 'engagements',
      targetId: e.id,
    })),
    ...findings.overdue.map(ex => ({
      id: ex.id,
      kind: 'Finding',
      title: ex.title,
      detail: `${ex.ref} · ${ex.assignee.name}`,
      severity: ex.severity as string,
      dueAt: ex.dueAt,
      view: 'engagements',
      targetId: ex.id,
    })),
    ...actions.overdue.map(a => ({
      id: a.id,
      kind: 'Action plan',
      title: a.title,
      detail: `${a.owner.name} · opened ${formatDate(a.openedAt)}`,
      severity: a.severity,
      dueAt: a.dueAt,
      view: 'engagements',
      targetId: a.engagementId,
    })),
  ].sort((a, b) => a.dueAt - b.dueAt), [plan.slipping, findings.overdue, actions.overdue]);

  const columns: Column<LateRow>[] = [
    {
      key: 'kind',
      label: 'Type',
      width: '130px',
      render: row => <span className="text-[0.75rem] text-ink-500">{row.kind}</span>,
    },
    {
      key: 'title',
      label: 'Item',
      truncate: true,
      render: row => (
        <div className="min-w-0">
          <p className="text-[0.875rem] text-ink-900 truncate">{row.title}</p>
          <p className="text-[0.75rem] text-ink-500 truncate">{row.detail}</p>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Risk',
      width: '110px',
      render: row => (row.severity
        ? <Pill tone={SEVERITY_TONE[row.severity] ?? 'draft'}>{row.severity}</Pill>
        : <span className="text-ink-400">—</span>),
    },
    {
      key: 'dueAt',
      label: 'Due',
      width: '140px',
      sortable: true,
      render: row => (
        <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-risk-700 tabular-nums">
          <CalendarClock size={12} className="shrink-0" />
          {formatDate(row.dueAt)}
        </span>
      ),
    },
    {
      key: 'open',
      label: 'Action',
      width: '100px',
      align: 'right',
      render: row => (
        <button
          type="button"
          onClick={() => onOpen(row.view, row.targetId)}
          className="text-[0.75rem] font-medium text-brand-700 hover:underline"
        >
          Open →
        </button>
      ),
    },
  ];

  return (
    <Block
      id="past-date"
      title="Past the date somebody agreed to"
      /* With nothing past its date the empty state is the whole message, so the
         sentence stands down rather than saying it a second time above it. */
      lede={rows.length === 0
        ? null
        : (
          <>
            <Fig>{fmtInt(rows.length)}</Fig> things are past a date: <Fig>{fmtInt(plan.slipping.length)}</Fig>{' '}
            engagements, <Fig>{fmtInt(findings.overdue.length)}</Fig> findings and{' '}
            <Fig>{fmtInt(actions.overdue.length)}</Fig> action plans. The oldest was due on{' '}
            {formatDate(rows[0].dueAt)}.
          </>
        )}
      hint="Three records in three screens, read as one list because somebody preparing for a committee has to hold all three at once. Oldest first. Overdue is the date on the record itself passing, not a threshold of ours."
    >
      {rows.length > 0
        ? (
          <>
            <StatRow>
              <Stat value={fmtInt(plan.slipping.length)} label="engagements past their date" sub={`of ${fmtInt(plan.onTheBooks)} on the books`} />
              <Stat value={fmtInt(findings.overdue.length)} label="findings past their date" sub={`of ${fmtInt(findings.open)} open`} />
              <Stat value={fmtInt(actions.overdue.length)} label="action plans past their date" sub={`of ${fmtInt(actions.open)} open`} />
              <Stat
                value={coverage.detection.medianDays !== null ? `${Math.round(coverage.detection.medianDays * 10) / 10}` : '—'}
                label="days to catch a problem"
                sub={coverage.detection.medianDays !== null ? `middle of ${fmtInt(coverage.detection.sample)} findings` : 'nothing caught in this window'}
              />
            </StatRow>

            {/* The stat strip above already closes with a hairline, so the table
                opens straight under it rather than drawing a second one. */}
            <div className={bleed}>
              <SmartTable
                columns={columns}
                data={rows}
                keyField="id"
                searchable={false}
                paginated
                pageSize={8}
                hideResultCount
              />
            </div>
          </>
        )
        : (
          <Empty
            kind="quiet"
            title="Nothing is past its date."
            detail="Every engagement, finding and action plan is inside the date it was given."
          />
        )}
    </Block>
  );
}

/**
 * Plan completion, and why it is absent.
 *
 * The first line of every committee pack, and the one line this product cannot
 * produce: no engagement in the records carries a completion date. A nought
 * here would read as a failing audit function when the truth is that we never
 * wrote the date down, so the block shows the unmeasured state and says which
 * of the two it is.
 */
export function PlanCompletion({ coverage, period }: { coverage: CoveragePack; period: Period }) {
  const { plan } = coverage;
  return (
    <Block
      id="plan-completion"
      title="How much of the plan closed"
      lede={plan.completionPct !== null
        ? (
          <>
            <Fig>{fmtInt(plan.closed)}</Fig> of <Fig>{fmtInt(plan.onTheBooks)}</Fig> engagements closed{' '}
            {period.phrase}, <Fig>{fmtInt(plan.closedOnTime)}</Fig> of them on or before the date they
            planned.
          </>
        )
        /* The unmeasured state below says this in its own words, so the
           sentence stands down rather than printing it twice. */
        : null}
      hint="Completion counts engagements whose close falls inside the window against everything on the books by the end of it. On time compares that close against the date the engagement planned for itself."
    >
      {plan.completionPct !== null
        ? <StatRow><Stat value={`${plan.completionPct}%`} label="of the plan closed" /></StatRow>
        : <Empty kind="unmeasured" title="Not measurable yet." detail={plan.blocked ?? undefined} />}
    </Block>
  );
}
