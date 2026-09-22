/**
 * One row per activity.
 *
 * The columns are the record: who ran it, on which surface, what it spent in
 * tokens and in registry calls, and what both cost. Nothing is derived here
 * that the row does not carry.
 */

import type { ReactNode } from 'react';
import SmartTable, { type Column } from '../../shared/SmartTable';
import {
  formatDuration,
  formatTokens,
  formatUsageAmount,
  statusLabel,
  surfaceLabel,
  turnKindLabel,
  type UsageTurn,
} from '../../../data/usage/metering';
import UsageLlmCostCell from './UsageLlmCostCell';
import UsageLookupsCell from './UsageLookupsCell';
import UsageModelsCell from './UsageModelsCell';
import UsageSessionCell from './UsageSessionCell';

// SmartTable's generic is constrained to Record<string, unknown>, which an
// interface does not satisfy (no implicit index signature). A type alias does.
type UsageRow = UsageTurn & Record<string, unknown>;

interface Props {
  rows: UsageTurn[];
  /** The filter strip, rendered as the card's toolbar the way Administration
   *  and every other list on the platform carries its filters. */
  toolbar?: ReactNode;
}

const COLUMNS: Column<UsageRow>[] = [
  {
    key: 'created_at',
    label: 'When',
    sortable: true,
    width: '150px',
    render: r => (
      <span className="text-[0.75rem] text-text-secondary">
        {new Date(r.created_at).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'run_by_email',
    label: 'Run by',
    sortable: true,
    width: '190px',
    render: r => (
      <div>
        <div className="text-[0.8125rem] text-ink-900">{r.run_by_name ?? '—'}</div>
        <div className="text-[0.6875rem] text-text-muted">{r.run_by_email ?? '—'}</div>
      </div>
    ),
  },
  {
    key: 'surface',
    label: 'Surface',
    sortable: true,
    width: '95px',
    render: r => <span className="text-[0.8125rem]">{surfaceLabel(r.surface)}</span>,
  },
  {
    key: 'turn_kind',
    label: 'Kind',
    width: '160px',
    render: r => (
      <div>
        <div className="whitespace-nowrap text-[0.8125rem]">{turnKindLabel(r.turn_kind)}</div>
        {r.workflow_name ? (
          <div title={r.workflow_name} className="truncate text-[0.6875rem] text-text-muted">
            {r.workflow_name}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    key: 'session_id',
    label: 'Reference',
    width: '135px',
    render: r => <UsageSessionCell turn={r} />,
  },
  { key: 'llm_calls', label: 'Calls', align: 'right', sortable: true, width: '70px' },
  {
    key: 'tokens_total',
    label: 'Tokens',
    align: 'right',
    sortable: true,
    width: '100px',
    render: r => (
      <span
        title={`${r.tokens_in.toLocaleString()} in, ${r.tokens_out.toLocaleString()} out`}
        className="tabular-nums"
      >
        {formatTokens(r.tokens_total)}
      </span>
    ),
  },
  {
    key: 'tokens_thinking',
    label: 'Reasoning',
    align: 'right',
    width: '95px',
    // A dash, not 0: Anthropic and Bedrock bill reasoning inside their output
    // count and report no separate figure, so a zero here would claim no
    // reasoning happened on turns where it certainly did.
    render: r => (
      <span
        title={
          r.tokens_thinking > 0
            ? `${r.tokens_thinking.toLocaleString()} of ${r.tokens_out.toLocaleString()} output tokens were reasoning`
            : 'Not reported by this provider'
        }
        className={r.tokens_thinking > 0 ? 'tabular-nums' : 'text-text-muted'}
      >
        {r.tokens_thinking > 0 ? formatTokens(r.tokens_thinking) : '—'}
      </span>
    ),
  },
  {
    key: 'models',
    label: 'Models',
    width: '160px',
    render: r => <UsageModelsCell turn={r} />,
  },
  {
    key: 'llm_cost',
    label: 'Model cost',
    align: 'right',
    sortable: true,
    width: '110px',
    render: r => <UsageLlmCostCell turn={r} />,
  },
  {
    key: 'govt_calls',
    label: 'Lookups',
    align: 'right',
    sortable: true,
    width: '120px',
    render: r => <UsageLookupsCell turn={r} />,
  },
  {
    key: 'govt_cost',
    label: 'Lookup cost',
    align: 'right',
    sortable: true,
    width: '115px',
    render: r => (
      <span className="tabular-nums">
        {r.govt_calls === 0 ? '—' : formatUsageAmount(r.govt_cost, r.govt_currency)}
      </span>
    ),
  },
  {
    key: 'duration_ms',
    label: 'Took',
    align: 'right',
    width: '80px',
    render: r => <span className="tabular-nums">{formatDuration(r.duration_ms)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '85px',
    // Stopped is not failed. A run somebody halted did what it did and then
    // stopped, so it reads in the neutral colour a failure does not get.
    render: r => (
      <span
        className={
          r.status === 'failed'
            ? 'text-risk-700'
            : r.status === 'stopped'
              ? 'text-ink-700'
              : 'text-text-secondary'
        }
      >
        {statusLabel(r.status)}
      </span>
    ),
  },
];

export default function UsageTable({ rows, toolbar }: Props) {
  return (
    <SmartTable<UsageRow>
      columns={COLUMNS}
      data={rows as UsageRow[]}
      keyField="id"
      // Search is off because the filter bar above already narrows the same set,
      // and a second search box that narrows it differently is two answers to
      // one question.
      searchable={false}
      headerExtra={toolbar}
      paginated
      pageSize={25}
      variant="modern"
      dense
      emptyMessage="No activities match. Questions in chat, workflow runs and file reads are metered from the moment they run, and there is no backfill behind them."
    />
  );
}
