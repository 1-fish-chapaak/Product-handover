/**
 * Usage and cost — the Administration tab.
 *
 * One row per metered turn: a chat turn, a workflow run, a file ingestion, with
 * the model tokens it spent and the registry lookups it bought.
 *
 * It sits in Administration rather than beside Platform Usage because it is an
 * account question, not an adoption one: who is spending what, on this
 * workspace's bill. Platform Usage counts what the platform did and prints no
 * money, because none of that work carries a price. This is the half that does.
 *
 * The totals and the rows read the same filters, so the band at the top always
 * describes exactly the turns listed below it.
 */

import { useMemo, useState } from 'react';
import { Coins, Cpu, Landmark, MessagesSquare } from 'lucide-react';
import {
  RATE_CARD_AS_OF,
  USAGE_TURNS,
  filterTurns,
  formatTokens,
  formatUsageAmount,
  summarize,
  type UsageFilters,
} from '../../../data/usage/metering';
import { AdminKpiRow } from '../AdminPrimitives';
import type { Stat } from '../adminTokens';
import UsageFilterBar from './UsageFilterBar';
import UsageTable from './UsageTable';

export default function UsageCostSection() {
  const [filters, setFilters] = useState<UsageFilters>({});

  const rows = useMemo(() => filterTurns(USAGE_TURNS, filters), [filters]);
  const summary = useMemo(() => summarize(rows), [rows]);

  const stats: Stat[] = [
    { key: 'turns', label: 'Turns', value: summary.turns.toLocaleString(), icon: MessagesSquare },
    { key: 'tokens', label: 'Tokens', value: formatTokens(summary.tokens_total), icon: Cpu },
    {
      key: 'llm',
      label: 'Model cost',
      // null when NOTHING in scope could be priced. It reads "Not priced"
      // rather than 0.00, so the gap reads as a gap.
      value: formatUsageAmount(summary.llm_cost, summary.llm_currency),
      icon: Coins,
    },
    {
      key: 'govt',
      label: 'Lookup cost',
      value: formatUsageAmount(summary.govt_cost, summary.govt_currency),
      icon: Landmark,
    },
  ];

  /* What qualifies the two money figures, said under the band that prints them.
     Never "total": some models have no rate at all, which makes the figure a
     floor, and the rates are published list prices rather than our contract,
     which makes it an estimate even when complete. Both are different claims
     and both have to be readable next to the number. */
  const modelCaveat =
    summary.llm_cost == null
      ? 'No model on this workspace has a rate on file, so there is no model cost to show.'
      : summary.has_unpriced_llm
        ? `Model cost is a floor, because some turns used a model with no rate on file. What is priced is priced off published list prices as of ${RATE_CARD_AS_OF}, not a contracted rate, so it is an estimate.`
        : `Model cost is an estimate, priced off published list prices as of ${RATE_CARD_AS_OF} rather than a contracted rate.`;

  return (
    <>
      <AdminKpiRow stats={stats} />

      <p className="mb-4 max-w-4xl text-[0.75rem] leading-relaxed text-ink-500">
        {modelCaveat} Lookup cost is the catalogue price of the registry calls a run actually made,
        counted over {summary.govt_calls.toLocaleString()} billed calls.
        {summary.has_unpriced
          ? ' Some of those calls ran against a lookup with no price on file, so that figure is a floor too.'
          : ''}
      </p>

      <div className="space-y-4">
        <UsageFilterBar value={filters} onChange={setFilters} />
        <UsageTable rows={rows} />
      </div>
    </>
  );
}
