import { useMemo, useState } from 'react';
import SeriesCompareChart, { SeriesLegend } from './SeriesCompareChart';
import SeriesKpiTile from './SeriesKpiTile';
import SeriesVarianceTable from './SeriesVarianceTable';
import WhatChangedSummary from './WhatChangedSummary';
import { summarizeSeries } from './seriesSummary';
import type { SeriesCompareResult } from './compareTypes';

/**
 * What a widget shows when the comparison spans three periods or more. Same
 * shapes as the two-sided body — KPI tile, "what changed" + variance table,
 * chart with a legend — read across N periods instead of A and B.
 */
export default function SeriesCompareBody({ result, chartType, title, onSelect }: {
  result: SeriesCompareResult;
  chartType: string;
  title?: string;
  onSelect?: (label: string) => void;
}) {
  const t = chartType.toLowerCase();
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const summary = useMemo(() => summarizeSeries(result, { title }), [result, title]);
  const toggle = (i: number) => setHidden(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  if (result.error) {
    return <div className="h-full w-full flex items-center justify-center text-center text-[0.75rem] text-ink-500 px-4">{result.error} Connect the tables to compare this widget.</div>;
  }
  if (t.includes('kpi')) {
    return <div className="h-full w-full p-3 flex items-center"><div className="w-full"><SeriesKpiTile label={title ?? result.series[0] ?? 'Metric'} result={result} /></div></div>;
  }
  if (t.includes('table')) {
    return (
      <div className="h-full w-full overflow-auto p-3 space-y-3" onClick={e => e.stopPropagation()}>
        <WhatChangedSummary summary={summary} compact />
        <SeriesVarianceTable result={result} compact />
      </div>
    );
  }
  return (
    <div className="h-full w-full flex flex-col min-h-0" onClick={e => e.stopPropagation()}>
      {result.axis === 'category' && <SeriesLegend result={result} hidden={hidden} onToggle={toggle} onReset={() => setHidden(new Set())} />}
      <div className="flex-1 min-h-0 p-3 pt-1">
        <SeriesCompareChart result={result} type={chartType} hidden={hidden} onSelect={onSelect} />
      </div>
    </div>
  );
}
