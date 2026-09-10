/**
 * The models one turn used: top model by tokens, with the rest in a tooltip.
 *
 * Its own file rather than a helper inside the table, because a function
 * returning JSX is a component and this repo keeps components one per file.
 */

import { modelsUsed, type UsageTurn } from '../../../data/usage/metering';

export default function UsageModelsCell({ turn }: { turn: UsageTurn }) {
  const models = modelsUsed(turn);
  if (models.length === 0) return <span className="text-text-secondary">—</span>;
  return (
    <span title={models.join(', ')} className="block truncate font-mono text-[0.6875rem]">
      {models[0]}
      {models.length > 1 ? (
        <span className="text-text-secondary"> +{models.length - 1}</span>
      ) : null}
    </span>
  );
}
