import { KpiTile } from '../../shared/KpiTile';
import DeltaChip from '../../shared/DeltaChip';
import { formatDelta, formatValue } from './compareEngine';
import { plainSeries } from './compareSummary';
import { periodColors } from './periodColors';
import { POLARITY_LABEL } from './polarity';
import type { SeriesCompareResult } from './compareTypes';

/**
 * A KPI across many periods: the latest value big, its move against the period
 * before it, and every period as a bar so the shape of the run is visible
 * inside the tile. The strip scrolls when the span is long.
 */
export default function SeriesKpiTile({ label, result, index = 0, onClick, footer }: {
  label: string;
  result: SeriesCompareResult;
  index?: number;
  onClick?: () => void;
  footer?: React.ReactNode;
}) {
  const series = result.series[0];
  const totals = series ? result.totals[series] ?? [] : [];
  const sides = result.sides;
  if (!series || totals.length === 0) return <KpiTile label={label} value="—" index={index} instant onClick={onClick} footer={footer} />;

  const last = totals.length - 1;
  const step = result.steps[series]?.[last] ?? null;
  const span = result.span[series];
  const colors = periodColors(sides.length);
  const max = Math.max(...totals.map(v => Math.abs(v)), 1);
  const f = step ? formatDelta(step, series) : null;
  const direction: 'up' | 'down' | 'flat' = !step ? 'flat' : step.delta > 0 ? 'up' : step.delta < 0 ? 'down' : 'flat';
  const polarityHint = POLARITY_LABEL[span.polarity].toLowerCase();

  return (
    <KpiTile
      label={label}
      value={formatValue(totals[last], series)}
      index={index}
      instant
      onClick={onClick}
      ariaLabel={`${label}: ${formatValue(totals[last], series)} in ${sides[last].label}, ${step ? `${direction === 'flat' ? 'no change' : `${direction} ${f!.pct.replace(/^[+−]/, '')}`} against ${sides[last - 1].label}` : ''}; ${formatPctSpan(span.pct)} across ${sides.length} periods (${polarityHint})`}
      aside={step ? <DeltaChip text={f!.pct} tone={step.tone} direction={direction} isNew={step.a === 0 && step.b !== 0} polarityHint={polarityHint} /> : undefined}
      secondary={step ? (
        <span className="inline-flex items-baseline gap-1.5 min-w-0">
          <span className="text-[0.8125rem] font-medium text-ink-400 tabular-nums">vs {formatValue(step.a, series)}</span>
          <span className="text-[0.6875rem] text-ink-400 truncate">· {sides[last - 1].label}</span>
        </span>
      ) : undefined}
      footer={(
        <div className="space-y-1.5">
          <div className="flex items-end gap-[2px] h-6 overflow-x-auto" aria-hidden="true">
            {totals.map((v, i) => (
              <span
                key={i}
                title={`${sides[i].label}: ${formatValue(v, series)}`}
                className="w-[6px] min-w-[6px] rounded-t-xs"
                style={{ height: `${Math.max(8, (Math.abs(v) / max) * 100)}%`, background: colors[i] }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.625rem] text-ink-400 tabular-nums truncate">
              {sides[0].label} → {sides[last].label} · {formatDelta(span, series).pct} · {plainSeries(series)}
            </span>
            {footer}
          </div>
        </div>
      )}
    />
  );
}

const formatPctSpan = (pct: number | null) => (pct === null ? 'no baseline' : `${pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'} ${Math.abs(pct)} percent`);
