import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ToolbarChips } from '../../shared/ListToolbar';
import { POLARITY_LABEL, polarityFor } from './polarity';
import type { MetricKey, Polarity } from './compareTypes';

export interface PolarityMetric { key: MetricKey; label: string }

/** Which way is "good", per metric. Defaults come from the model; the user
 *  can overrule any of them — a KPI's colour must never assume up is progress. */
export default function PolarityEditor({ metrics, overrides, onChange, onReset }: {
  metrics: PolarityMetric[];
  overrides: Record<MetricKey, Polarity>;
  onChange: (key: MetricKey, p: Polarity) => void;
  onReset: () => void;
}) {
  const customised = Object.keys(overrides).length;
  return (
    <div className="space-y-1">
      {metrics.length === 0 && <p className="text-[0.75rem] text-ink-400">No metrics on this dashboard yet.</p>}
      {metrics.map(m => {
        const value = polarityFor(m.key, overrides, m.label);
        return (
          <div key={m.key} className="grid grid-cols-[1fr_auto] items-center gap-3 py-1.5">
            <span className="text-[0.75rem] text-ink-700 truncate" title={m.key}>{m.label}{overrides[m.key] && <span className="ml-1.5 text-[0.625rem] font-semibold text-brand-600 uppercase tracking-wide">custom</span>}</span>
            <ToolbarChips<Polarity>
              size="sm"
              semantics="radio"
              ariaLabel={`Polarity for ${m.label}`}
              layoutId={`polarity-${m.key}`}
              value={value}
              onChange={p => onChange(m.key, p)}
              options={[
                { key: 'higherBetter', label: 'Higher', icon: TrendingUp },
                { key: 'lowerBetter', label: 'Lower', icon: TrendingDown },
                { key: 'neutral', label: 'Neutral', icon: Minus },
              ]}
            />
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1.5">
        <p className="text-[0.6875rem] text-ink-400">{POLARITY_LABEL.higherBetter} · {POLARITY_LABEL.lowerBetter} · {POLARITY_LABEL.neutral}</p>
        <button type="button" onClick={onReset} disabled={customised === 0} className="text-[0.6875rem] font-medium text-ink-500 hover:text-ink-800 disabled:text-ink-300 disabled:cursor-default cursor-pointer">Reset to defaults</button>
      </div>
    </div>
  );
}
