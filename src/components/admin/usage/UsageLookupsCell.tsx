/**
 * The lookups a turn made, by type.
 *
 * A count on its own cannot explain the cost beside it: one run shows 8 lookups
 * at ₹120 and another 124 at ₹1,240, and only a per type rate produces both.
 * The type is already on the row underneath, so this cell prints it rather than
 * leaving the reader to work backwards from a total.
 *
 * The top type leads and the rest ride in the title, because a run that swept
 * three registries would otherwise push every row in the table three lines tall.
 */

import type { UsageTurn } from '../../../data/usage/metering';
import { formatUsageAmount } from '../../../data/usage/metering';

/** `govt.gst_basic` reads as `gst basic`. The catalogue's own titles are full
 *  sentences and far too long for a cell. */
function opLabel(opKey: string): string {
  return opKey.replace(/^govt\./, '').replace(/_/g, ' ');
}

export default function UsageLookupsCell({ turn }: { turn: UsageTurn }) {
  const entries = Object.entries(turn.by_operation).sort((a, b) => b[1].calls - a[1].calls);
  if (entries.length === 0) return <span className="text-text-muted">—</span>;

  const [topKey, top] = entries[0];
  const rest = entries.length - 1;
  const full = entries
    .map(([key, op]) => `${op.calls} × ${opLabel(key)} at ${formatUsageAmount(op.cost, turn.govt_currency)}`)
    .join('\n');

  return (
    <div title={full} className="text-right">
      <div className="text-[0.8125rem] tabular-nums text-ink-900">{turn.govt_calls}</div>
      <div className="truncate text-[0.6875rem] text-text-muted">
        {top.calls} {opLabel(topKey)}
        {rest > 0 ? ` and ${rest} more` : ''}
      </div>
    </div>
  );
}
