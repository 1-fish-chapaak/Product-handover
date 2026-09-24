import { KpiTile } from '../../shared/KpiTile';
import DeltaChip from '../../shared/DeltaChip';
import { formatDelta } from './compareEngine';
import { POLARITY_LABEL } from './polarity';
import { plainSeries } from './compareSummary';
import type { CompareResult, CompareSide } from './compareTypes';

/**
 * A KPI in compare mode: the label, A big, "vs B · <B label>" beside it, and a
 * delta chip whose colour follows the metric's polarity. Same tile shell as
 * every other KPI so the row stays one family.
 */
export default function CompareKpiTile({ label, result, a, b, index = 0, onClick, footer }: {
  label: string;
  result: CompareResult;
  a: CompareSide;
  b: CompareSide;
  index?: number;
  onClick?: () => void;
  footer?: React.ReactNode;
}) {
  const series = result.series[0];
  const stat = series ? result.kpi[series] : undefined;
  const noA = result.caveats.some(c => c.kind === 'no-data' && c.side === 'a');
  const noB = result.caveats.some(c => c.kind === 'no-data' && c.side === 'b');
  if (!stat) return <KpiTile label={label} value="—" index={index} instant onClick={onClick} footer={footer} />;

  const f = formatDelta(stat, series);
  const direction: 'up' | 'down' | 'flat' = stat.delta > 0 ? 'up' : stat.delta < 0 ? 'down' : 'flat';
  const isNew = stat.a === 0 && stat.b !== 0;
  const polarityHint = POLARITY_LABEL[stat.polarity].toLowerCase();
  const words = isNew ? `new in ${b.label}` : direction === 'flat' ? 'no change' : `${direction} ${f.pct.replace(/^[+−]/, '')}`;

  return (
    <KpiTile
      label={label}
      value={noA ? '—' : f.a}
      index={index}
      instant
      onClick={onClick}
      ariaLabel={`${label}: ${noA ? 'no data' : f.a} in ${a.label}, ${noB ? 'no data' : f.b} in ${b.label}, ${words} (${polarityHint})`}
      aside={noB ? (
        <span className="inline-flex items-center h-5 px-1.5 rounded-xs border border-dashed border-canvas-border text-ink-400 text-[0.6875rem] font-medium" title={`No rows fall in ${b.label}`}>No B data</span>
      ) : (
        <DeltaChip text={f.pct} tone={stat.tone} direction={direction} isNew={isNew} polarityHint={polarityHint} />
      )}
      secondary={(
        <span className="inline-flex items-baseline gap-1.5 min-w-0">
          <span className="text-[0.8125rem] font-medium text-ink-400 tabular-nums">vs {noB ? '—' : f.b}</span>
          <span className="text-[0.6875rem] text-ink-400 truncate">· {b.label}</span>
        </span>
      )}
      footer={(
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.625rem] text-ink-400 tabular-nums">Δ {f.delta} · {plainSeries(series)}</span>
          {footer}
        </div>
      )}
    />
  );
}
