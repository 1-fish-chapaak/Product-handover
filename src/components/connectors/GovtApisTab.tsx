/**
 * The government registry catalogue, as a table.
 *
 * Every declared operation is listed, including the ones this environment has
 * not switched on. Someone deciding whether a lookup is worth buying needs to
 * see what it would give them, and a catalogue filtered down to what is already
 * enabled reads as an empty feature.
 *
 * The rows are whatever the catalogue declares, never a hand-kept copy. A table
 * that drifts from the operations the agent can actually call is worse than no
 * table: it promises lookups that fail at run time.
 */

import { useMemo } from 'react';
import SmartTable, { type Column } from '../shared/SmartTable';
import {
  CONNECTOR_OPERATIONS,
  govtOperations,
  operationBlockedReason,
  operationCostDetail,
  toGovtApiRow,
  type GovtApiRow,
} from '../../data/connectors/catalogue';

const COLUMNS: Column<GovtApiRow>[] = [
  {
    key: 'title',
    label: 'Lookup',
    sortable: true,
    width: '300px',
    render: row => {
      const blocked = operationBlockedReason(row.operation);
      return (
        <div>
          <div className="text-[0.8125rem] font-medium text-ink-900">{row.title}</div>
          <div className="mt-0.5 font-mono text-[0.6875rem] text-text-muted">{row.opKey}</div>
          {/* Which gate an operation sits behind decides who can clear it: an
              unverified response shape is waiting on us, a disabled kind is
              waiting on a deploy. Collapsing both into "unavailable" would send
              the reader to the wrong person. */}
          {blocked ? (
            <div className="mt-1 text-[0.6875rem] text-text-secondary">{blocked}</div>
          ) : null}
        </div>
      );
    },
  },
  {
    key: 'provides',
    label: 'You provide',
    width: '130px',
    render: row => <span className="text-[0.8125rem] text-text-secondary">{row.provides}</span>,
  },
  {
    key: 'returns',
    label: 'You get back',
    truncate: true,
    render: row => (
      <span title={row.returns} className="block truncate text-[0.8125rem] text-text-secondary">
        {row.returns}
      </span>
    ),
  },
  {
    key: 'cost',
    label: 'Cost',
    sortable: true,
    width: '210px',
    render: row => (
      <div>
        <div className="text-[0.8125rem] font-medium text-ink-900 tabular-nums">{row.cost}</div>
        {/* bill_on is the qualifier most likely to surprise: on most aggregator
            contracts a "no record found" still costs, which changes what a run
            over a dirty column is worth. */}
        <div className="mt-0.5 text-[0.6875rem] text-text-muted">
          {operationCostDetail(row.operation)}
        </div>
      </div>
    ),
  },
  {
    key: 'refresh',
    label: 'On re-run',
    width: '230px',
    render: row => <span className="text-[0.75rem] text-text-secondary">{row.refresh}</span>,
  },
];

export default function GovtApisTab() {
  const rows = useMemo(() => govtOperations(CONNECTOR_OPERATIONS).map(toGovtApiRow), []);

  return (
    <section className="space-y-3">
      <SmartTable<GovtApiRow>
        columns={COLUMNS}
        data={rows}
        keyField="id"
        searchable
        searchPlaceholder="Search lookups..."
        searchKeys={['title', 'opKey', 'provides', 'returns']}
        paginated={false}
        variant="modern"
        dense
        emptyMessage="This deployment declares no government lookups. They arrive with a release, not with a setting."
      />
      <p className="text-[0.75rem] leading-relaxed text-text-muted">
        A price here is what one call costs, read off the same declaration the run bills against. A
        lookup with no price on file reads as not priced rather than as free, so nobody approves a
        spend they were never shown.
      </p>
    </section>
  );
}
