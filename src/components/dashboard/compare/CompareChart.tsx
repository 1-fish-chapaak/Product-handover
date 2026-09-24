import { useReducedMotion } from 'motion/react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import DeltaChip from '../../shared/DeltaChip';
import { fmtAxis, fmtNumber } from '../model/chartTokens';
import { formatDelta } from './compareEngine';
import type { CompareChartMode, CompareResult, CompareSide, DeltaStat } from './compareTypes';

import type { SeriesShown } from './useSeriesShown';

/** B is a lighter brand — and dashed on lines — so the pair never relies on hue alone. */
export const COLOR_B = '#C393FA';
const GRID = '#EEEEF1', AXIS = '#6B5D82', AXIS_LINE = '#E5E7EB';

/** Legend swatches + the A | B | Both toggle. Stops clicks so the card does not expand. */
export function CompareLegend({ a, b, shown, onShown, dashed = false }: {
  a: CompareSide; b: CompareSide; shown: SeriesShown; onShown: (s: SeriesShown) => void; dashed?: boolean;
}) {
  const opt = (k: SeriesShown, label: string) => (
    <button key={k} type="button" role="radio" aria-checked={shown === k} onClick={() => onShown(k)}
      className={`h-6 px-2 rounded-sm text-[0.6875rem] font-semibold cursor-pointer transition-colors ${shown === k ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-800'}`}>{label}</button>
  );
  return (
    <div className="flex items-center justify-between gap-3 px-3 pt-2 shrink-0" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 min-w-0 text-[0.6875rem] text-ink-600 tabular-nums">
        <span className={`inline-flex items-center gap-1.5 min-w-0 ${shown === 'b' ? 'opacity-40' : ''}`}><span className="size-2.5 rounded-xs bg-brand-600 shrink-0" aria-hidden="true" /><span className="truncate">{a.label}</span></span>
        <span className={`inline-flex items-center gap-1.5 min-w-0 ${shown === 'a' ? 'opacity-40' : ''}`}>
          {dashed ? <span className="w-3 border-t-2 border-dashed border-brand-300 shrink-0" aria-hidden="true" /> : <span className="size-2.5 rounded-xs bg-brand-300 shrink-0" aria-hidden="true" />}
          <span className="truncate">{b.label}</span>
        </span>
      </div>
      <div role="radiogroup" aria-label="Series shown" className="inline-flex p-0.5 rounded-md border border-canvas-border bg-canvas-elevated shrink-0">
        {opt('a', 'A')}{opt('b', 'B')}{opt('both', 'Both')}
      </div>
    </div>
  );
}

/** A · B · Δ for the hovered category. */
function CompareTooltip({ active, payload, label, a, b, series, statsByLabel }: {
  active?: boolean; payload?: readonly unknown[]; label?: string | number;
  a: CompareSide; b: CompareSide; series: string; statsByLabel: Map<string, DeltaStat>;
}) {
  if (!active || !payload?.length) return null;
  const stat = statsByLabel.get(String(label));
  if (!stat) return null;
  const f = formatDelta(stat, series);
  const dir: 'up' | 'down' | 'flat' = stat.delta > 0 ? 'up' : stat.delta < 0 ? 'down' : 'flat';
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 shadow-[0_8px_24px_rgba(15,8,30,0.08)] text-[0.6875rem]">
      <p className="font-semibold text-ink-900 mb-1">{String(label)}</p>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
        <span className="inline-flex items-center gap-1.5 text-ink-500"><span className="size-2 rounded-xs bg-brand-600" aria-hidden="true" />{a.label}</span><span className="text-ink-900 text-right">{f.a}</span>
        <span className="inline-flex items-center gap-1.5 text-ink-500"><span className="size-2 rounded-xs bg-brand-300" aria-hidden="true" />{b.label}</span><span className="text-ink-900 text-right">{f.b}</span>
        <span className="text-ink-500">Δ</span><span className="text-right inline-flex items-center justify-end gap-1.5"><span className="text-ink-700">{f.delta}</span><DeltaChip text={f.pct} tone={stat.tone} direction={dir} isNew={stat.a === 0 && stat.b !== 0} /></span>
      </div>
    </div>
  );
}

/**
 * Two answers on one chart. Bars: grouped A/B. Lines/areas: overlaid (B
 * dashed / lighter) or side by side with a shared Y domain. Pie: twin donuts.
 * Only the first series is drawn — a compare chart is one measure, two sides.
 */
export default function CompareChart({ result, type, mode, a, b, color = '#6a12cd', shown = 'both', onSelect }: {
  result: CompareResult;
  type: string;
  mode: CompareChartMode;
  a: CompareSide; b: CompareSide;
  color?: string;
  shown?: SeriesShown;
  onSelect?: (label: string) => void;
}) {
  const reduce = useReducedMotion();
  const t = type.toLowerCase();
  const series = result.series[0];
  if (!series) return <div className="h-full w-full flex items-center justify-center text-[0.75rem] text-ink-500">No measure to compare.</div>;
  if (result.merged.length === 0) return <div className="h-full w-full flex items-center justify-center text-[0.75rem] text-ink-500">No data in either {a.kind === 'period' ? 'period' : 'selection'}.</div>;

  const rows = result.merged.map(m => ({ label: m.label, a: m.presentIn === 'b' ? null : m.values[series].a, b: m.presentIn === 'a' ? null : m.values[series].b }));
  const statsByLabel = new Map(result.merged.map(m => [m.label, m.values[series]]));
  const max = Math.max(0, ...rows.flatMap(r => [r.a ?? 0, r.b ?? 0]));
  const showA = shown !== 'b', showB = shown !== 'a';
  const anim = !reduce;
  const tooltip = <Tooltip content={(p) => <CompareTooltip active={p.active} payload={p.payload} label={p.label as string | number | undefined} a={a} b={b} series={series} statsByLabel={statsByLabel} />} cursor={{ fill: 'rgba(106,18,205,0.06)' }} />;
  const pick = (label: unknown) => onSelect?.(String(label));

  if (t.includes('pie')) {
    const donut = (key: 'a' | 'b', side: CompareSide, fill: string) => (
      <div className="flex flex-col min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows.filter(r => r[key] != null)} dataKey={key} nameKey="label" cx="50%" cy="50%" outerRadius="78%" innerRadius="48%" isAnimationActive={anim} animationDuration={300} animationBegin={key === 'b' ? 150 : 0}>
              {rows.map((_, i) => <Cell key={i} fill={fill} fillOpacity={1 - Math.min(i, 5) * 0.12} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtNumber(Number(v) || 0, key)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        <p className="text-center text-[0.6875rem] text-ink-500 -mt-1 truncate">{side.label}</p>
      </div>
    );
    return <div className={`h-full w-full grid gap-2 ${showA && showB ? 'grid-cols-2' : 'grid-cols-1'}`}>{showA && donut('a', a, color)}{showB && donut('b', b, COLOR_B)}</div>;
  }

  const isLine = t.includes('line'), isArea = t.includes('area');
  const Cartesian = isLine ? LineChart : isArea ? AreaChart : BarChart;
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: AXIS_LINE }} />
      <YAxis domain={[0, max]} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={fmtAxis} width={48} />
    </>
  );
  const seriesEl = (key: 'a' | 'b', fill: string, delay: number) => isLine
    ? <Line key={key} name={key === 'a' ? a.label : b.label} type="monotone" dataKey={key} stroke={fill} strokeWidth={2} strokeDasharray={key === 'b' ? '4 4' : undefined} dot={rows.length <= 3 ? { r: 4, strokeWidth: 0, fill } : false} connectNulls isAnimationActive={anim} animationDuration={300} animationBegin={delay} />
    : isArea
      ? <Area key={key} name={key === 'a' ? a.label : b.label} type="monotone" dataKey={key} stroke={fill} strokeDasharray={key === 'b' ? '4 4' : undefined} fill={fill} fillOpacity={key === 'a' ? 0.18 : 0.10} strokeWidth={2} dot={rows.length <= 3 ? { r: 4, strokeWidth: 0, fill } : false} connectNulls isAnimationActive={anim} animationDuration={300} animationBegin={delay} />
      : <Bar key={key} name={key === 'a' ? a.label : b.label} dataKey={key} fill={fill} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={anim} animationDuration={300} animationBegin={delay} onClick={onSelect ? (_e: unknown, i: number) => pick(rows[i]?.label) : undefined} className={onSelect ? 'cursor-pointer' : ''} />;

  // Lines / areas side by side: two panels, shared Y domain.
  if ((isLine || isArea) && mode === 'side-by-side' && showA && showB) {
    const panel = (key: 'a' | 'b', side: CompareSide, fill: string) => (
      <div className="flex flex-col min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <Cartesian data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>{axes}{tooltip}{seriesEl(key, fill, key === 'b' ? 150 : 0)}</Cartesian>
        </ResponsiveContainer>
        <p className="text-center text-[0.6875rem] text-ink-500 truncate">{side.label}</p>
      </div>
    );
    return <div className="h-full w-full grid grid-cols-2 gap-3">{panel('a', a, color)}{panel('b', b, COLOR_B)}</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Cartesian data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} onClick={onSelect && (isLine || isArea) ? (s: { activeLabel?: string | number } | null) => { if (s?.activeLabel != null) pick(s.activeLabel); } : undefined}>
        {axes}{tooltip}
        {showA && seriesEl('a', color, 0)}
        {showB && seriesEl('b', COLOR_B, showA ? 150 : 0)}
      </Cartesian>
    </ResponsiveContainer>
  );
}
