/**
 * One turn's LLM cost, with what qualifies it.
 *
 * The qualification is the load-bearing part rather than decoration: this
 * figure is an estimate from published list prices, and when some model in the
 * turn had no rate on file it is a floor as well. A bare number here would be
 * read as an invoice line, which is the one thing it is not.
 *
 * An unpriced turn reads "Not priced", never 0.00, for the same reason the govt
 * column does: unknown and free must not look alike.
 */

import { formatUsageAmount, llmCostCaveat, type UsageTurn } from '../../../data/usage/metering';

export default function UsageLlmCostCell({ turn }: { turn: UsageTurn }) {
  const unpriced = turn.llm_unpriced_models;
  const partial = turn.llm_cost != null && unpriced.length > 0;
  return (
    <span title={llmCostCaveat(unpriced)} className="tabular-nums">
      {formatUsageAmount(turn.llm_cost, turn.llm_currency)}
      {partial ? <span className="text-mitigated-700">&nbsp;+</span> : null}
    </span>
  );
}
