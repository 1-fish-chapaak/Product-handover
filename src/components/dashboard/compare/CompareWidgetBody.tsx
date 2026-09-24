import { useMemo } from 'react';
import CompareChart, { CompareLegend } from './CompareChart';
import { useSeriesShown } from './useSeriesShown';
import CompareKpiTile from './CompareKpiTile';
import VarianceTable from './VarianceTable';
import WhatChangedSummary from './WhatChangedSummary';
import { summarizeCompare } from './compareSummary';
import type { CompareResult, ResolvedCompare } from './compareTypes';

/**
 * What a widget shows in compare mode, by shape: a KPI becomes the delta tile,
 * a table becomes "what changed" + the variance table, everything else a two-
 * sided chart with its legend and A | B | Both toggle.
 */
export default function CompareWidgetBody({ result, resolved, chartType, color, title, onSelect }: {
  result: CompareResult;
  resolved: ResolvedCompare;
  chartType: string;
  color?: string;
  title?: string;
  onSelect?: (label: string) => void;
}) {
  const t = chartType.toLowerCase();
  const [shown, setShown] = useSeriesShown();
  const summary = useMemo(() => summarizeCompare(result, { a: resolved.a, b: resolved.b, xLabel: result.a.xLabel, title }), [result, resolved, title]);

  if (result.error) {
    return <div className="h-full w-full flex items-center justify-center text-center text-[0.75rem] text-ink-500 px-4">{result.error} Connect the tables to compare this widget.</div>;
  }
  if (t.includes('kpi')) {
    return <div className="h-full w-full p-3 flex items-center"><div className="w-full"><CompareKpiTile label={title ?? result.series[0] ?? 'Metric'} result={result} a={resolved.a} b={resolved.b} /></div></div>;
  }
  if (t.includes('table')) {
    return (
      <div className="h-full w-full overflow-auto p-3 space-y-3" onClick={e => e.stopPropagation()}>
        <WhatChangedSummary summary={summary} compact />
        <VarianceTable result={result} a={resolved.a} b={resolved.b} compact />
      </div>
    );
  }
  const dashed = t.includes('line') || t.includes('area');
  return (
    <div className="h-full w-full flex flex-col min-h-0" onClick={e => e.stopPropagation()}>
      <CompareLegend a={resolved.a} b={resolved.b} shown={shown} onShown={setShown} dashed={dashed} />
      <div className="flex-1 min-h-0 p-3 pt-1">
        <CompareChart result={result} type={chartType} mode={resolved.chartMode} a={resolved.a} b={resolved.b} color={color} shown={shown} onSelect={onSelect} />
      </div>
    </div>
  );
}
