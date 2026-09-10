/**
 * Usage and cost — the Administration tab.
 *
 * One row per activity: a question in chat, a workflow run, a file read, with the
 * model tokens it spent and the registry lookups it bought.
 *
 * A row is an ACTIVITY here and on Platform Value, in those words. It was a
 * metered turn on this tab and a piece of work on that one, and one thing with
 * two names is one name too many. The word is the platform's own: it is what
 * the Admin audit log calls a row.
 *
 * It sits in Administration rather than beside Platform Usage because it is an
 * account question, not an adoption one: who is spending what, on this
 * workspace's bill. Platform Usage counts what the platform did and prints no
 * money, because none of that work carries a price. This is the half that does.
 *
 * The totals and the rows read the same filters, so the band at the top always
 * describes exactly the activities listed below it.
 */

import { useMemo, useState } from 'react';
import { Coins, Cpu, Landmark, MessagesSquare } from 'lucide-react';
import { USD_TO_INR, effectiveAt, formatRupees } from '../../../data/usage/timings';
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

  /* The model bill arrives in dollars, so it is printed in dollars: converting
     it here would hide which currency the workspace is actually billed in.
     Platform Value adds it to the lookup cost, which means it has to convert,
     and the two tabs then print the same figure in two currencies. So the rate
     and the converted amount are said here, once, and the reader can tie the
     tabs together without doing the sum themselves. */
  const fx = useMemo(() => {
    const newest = rows.reduce<string | null>(
      (d, r) => (d == null || r.created_at > d ? r.created_at : d),
      null,
    );
    // The same constant Platform Value resolves against, so the two tabs
    // always convert the bill at the same rate and keep reconciling.
    return newest ? effectiveAt(USD_TO_INR, newest.slice(0, 10)) : null;
  }, [rows]);

  /* These four print their settled figures rather than counting up to them.
     The caption under the band quotes the same numbers and does not animate,
     so a ramping counter puts the tiles and the line below them at odds for a
     second and a half, and anybody who glances at the page in that window, or
     screenshots it, carries away a total that was never true. */
  const stats: Stat[] = [
    { key: 'turns', label: 'Activities', value: summary.turns.toLocaleString(), icon: MessagesSquare, instant: true },
    { key: 'tokens', label: 'Tokens', value: formatTokens(summary.tokens_total), icon: Cpu, instant: true },
    {
      key: 'llm',
      label: 'Model cost',
      instant: true,
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
      instant: true,
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
        ? `Model cost is a floor, because some activities used a model with no rate on file. What is priced is priced off published list prices as of ${RATE_CARD_AS_OF}, not a contracted rate, so it is an estimate.`
        : `Model cost is an estimate, priced off published list prices as of ${RATE_CARD_AS_OF} rather than a contracted rate.`;

  /* Why this tab prints dollars and the next one prints rupees. */
  const currencyNote =
    summary.llm_cost == null || fx == null
      ? ''
      : ` Model cost stays in dollars because that is the currency the bill arrives in. At ₹${fx.value.toFixed(2)} to the dollar it is ${formatRupees(Math.round(summary.llm_cost * fx.value))}, which is the figure Platform Value adds to the lookup cost.`;

  return (
    <>
      <AdminKpiRow stats={stats} />

      <p className="mb-4 max-w-4xl text-[0.75rem] leading-relaxed text-ink-500">
        {modelCaveat} Lookup cost is the catalogue price of the registry calls a run actually made,
        counted over {summary.govt_calls.toLocaleString()} billed calls.
        {summary.has_unpriced
          ? ' Some of those calls ran against a lookup with no price on file, so that figure is a floor too.'
          : ''}
        {currencyNote}
      </p>

      <UsageTable rows={rows} toolbar={<UsageFilterBar value={filters} onChange={setFilters} />} />
    </>
  );
}
