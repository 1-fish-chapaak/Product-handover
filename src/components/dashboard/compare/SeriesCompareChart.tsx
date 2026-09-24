import { useReducedMotion } from 'motion/react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Cell as PieCell,
} from 'recharts';
import DeltaChip from '../../shared/DeltaChip';
import { fmtAxis, fmtNumber } from '../model/chartTokens';
import { formatDelta, formatValue } from './compareEngine';
import { periodColors } from './periodColors';
import type { SeriesCompareResult } from './compareTypes';

const GRID = '#EEEEF1', AXIS = '#6B5D82', AXIS_LINE = '#E5E7EB';
/** A chart of many periods is wider than its card — it scrolls rather than
 *  squeezing thirty-six months into 300px of unreadable slivers. */
const MIN_BAR = 13, GROUP_PAD = 22, MIN_POINT = 34, MIN_DONUT = 150;

/** One period per key so Recharts can draw them as separate series. Recharts 3
 *  identifies a series by its React key, and a *numeric* key renders nothing at
 *  all — so every series and cell below is keyed by this string. */
const pKey = (i: number) => `p${i}`;

function ScrollX({ minWidth, children }: { minWidth: number; children: React.ReactNode }) {
  return (
    <div className="h-full w-full overflow-x-auto overflow-y-hidden" onClick={e => e.stopPropagation()}>
      <div style={{ minWidth: `max(100%, ${minWidth}px)`, height: '100%' }}>{children}</div>
    </div>
  );
}

/** Every visible period's value for the hovered category, plus the span delta. */
function SeriesTooltip({ active, label, result, series, visible }: {
  active?: boolean; label?: string | number; result: SeriesCompareResult; series: string; visible: number[];
}) {
  if (!active) return null;
  const row = result.rows.find(r => r.label === String(label));
  if (!row) return null;
  const colors = periodColors(result.sides.length);
  const span = row.span[series];
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 shadow-[0_8px_24px_rgba(15,8,30,0.08)] text-[0.6875rem] max-h-[14rem] overflow-y-auto">
      <p className="font-semibold text-ink-900 mb-1">{String(label)}</p>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
        {visible.map(i => (
          <span key={i} className="contents">
            <span className="inline-flex items-center gap-1.5 text-ink-500"><span className="size-2 rounded-xs" style={{ background: colors[i] }} aria-hidden="true" />{result.sides[i].label}</span>
            <span className="text-ink-900 text-right">{row.values[series]?.[i] == null ? '—' : formatValue(row.values[series][i] as number, series)}</span>
          </span>
        ))}
      </div>
      {span && visible.length > 1 && (
        <div className="mt-1.5 pt-1.5 border-t border-canvas-border flex items-center justify-between gap-3">
          <span className="text-ink-500">First → last</span>
          <DeltaChip text={formatDelta(span, series).pct} tone={span.tone} direction={span.delta > 0 ? 'up' : span.delta < 0 ? 'down' : 'flat'} isNew={span.a === 0 && span.b !== 0} />
        </div>
      )}
    </div>
  );
}

/** The period axis: one bar (or point) per period, coloured along the ramp. */
function PeriodAxisTooltip({ active, label, result, series }: { active?: boolean; label?: string | number; result: SeriesCompareResult; series: string }) {
  if (!active) return null;
  const i = result.sides.findIndex(s => s.label === String(label));
  if (i < 0) return null;
  const step = result.steps[series]?.[i];
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 shadow-[0_8px_24px_rgba(15,8,30,0.08)] text-[0.6875rem]">
      <p className="font-semibold text-ink-900 mb-1">{String(label)}</p>
      <p className="tabular-nums text-ink-700">{formatValue(result.totals[series]?.[i] ?? 0, series)}</p>
      {step && (
        <div className="mt-1.5 pt-1.5 border-t border-canvas-border flex items-center gap-2">
          <span className="text-ink-500">vs {result.sides[i - 1].label}</span>
          <DeltaChip text={formatDelta(step, series).pct} tone={step.tone} direction={step.delta > 0 ? 'up' : step.delta < 0 ? 'down' : 'flat'} isNew={step.a === 0 && step.b !== 0} />
        </div>
      )}
    </div>
  );
}

/**
 * Many periods on one chart. Two shapes, chosen by the engine:
 *  · axis 'periods'  — the widget's own axis collapsed to a point per period,
 *    so the chart *is* the period axis (Jan 22 … Dec 24), coloured by age.
 *  · axis 'category' — the widget keeps its axis and every period is a series
 *    on it (three years of months as three lines).
 * Either way the plot scrolls horizontally rather than compressing.
 */
export default function SeriesCompareChart({ result, type, hidden, onSelect }: {
  result: SeriesCompareResult;
  type: string;
  /** Period indices toggled off in the legend. */
  hidden: Set<number>;
  onSelect?: (label: string) => void;
}) {
  const reduce = useReducedMotion();
  const t = type.toLowerCase();
  const series = result.series[0];
  if (!series) return <div className="h-full w-full flex items-center justify-center text-[0.75rem] text-ink-500">No measure to compare.</div>;
  const colors = periodColors(result.sides.length);
  const visible = result.sides.map((_, i) => i).filter(i => !hidden.has(i));
  // Many periods draw at once: a stagger of thirty-six would take two seconds
  // to settle, and the last series would arrive after the reader had moved on.
  const anim = !reduce && visible.length <= 8;
  const stagger = (k: number) => (anim ? Math.min(k, 4) * 70 : 0);
  if (visible.length === 0) return <div className="h-full w-full flex items-center justify-center text-[0.75rem] text-ink-500">Every period is hidden — switch one back on in the legend.</div>;

  // Pie: one donut per period, side by side, scrolling.
  if (t.includes('pie') || t.includes('doughnut')) {
    return (
      <ScrollX minWidth={visible.length * MIN_DONUT}>
        <div className="h-full grid gap-2" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(${MIN_DONUT}px, 1fr))` }}>
          {visible.map(i => {
            const rows = result.perPeriod[i]?.rows ?? [];
            return (
              <div key={pKey(i)} className="flex flex-col min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rows} dataKey={series} nameKey="label" cx="50%" cy="50%" outerRadius="76%" innerRadius="46%" isAnimationActive={anim} animationDuration={300}>
                      {rows.map((_, k) => <PieCell key={`c${k}`} fill={colors[i]} fillOpacity={1 - Math.min(k, 5) * 0.13} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtNumber(Number(v) || 0, series)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-center text-[0.6875rem] text-ink-500 -mt-1 truncate">{result.sides[i].label}</p>
              </div>
            );
          })}
        </div>
      </ScrollX>
    );
  }

  const isLine = t.includes('line'), isArea = t.includes('area');
  const Cartesian = isLine ? LineChart : isArea ? AreaChart : BarChart;
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: AXIS_LINE }} interval="preserveStartEnd" minTickGap={4} />
      <YAxis tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={fmtAxis} width={48} />
    </>
  );

  // ── The period axis itself ──
  if (result.axis === 'periods') {
    const data = result.sides.map((s, i) => ({ label: s.label, value: hidden.has(i) ? null : result.totals[series]?.[i] ?? 0, i }));
    const shown = data.filter(d => d.value !== null);
    const minWidth = shown.length * (isLine || isArea ? MIN_POINT : MIN_BAR + GROUP_PAD) + 60;
    const tooltip = <Tooltip content={(p) => <PeriodAxisTooltip active={p.active} label={p.label as string | number | undefined} result={result} series={series} />} cursor={{ fill: 'rgba(106,18,205,0.06)' }} />;
    return (
      <ScrollX minWidth={minWidth}>
        <ResponsiveContainer width="100%" height="100%">
          <Cartesian data={shown} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            {axes}{tooltip}
            {isLine ? <Line type="monotone" dataKey="value" name={series} stroke={colors[colors.length - 1]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: colors[colors.length - 1] }} isAnimationActive={anim} animationDuration={300} />
              : isArea ? <Area type="monotone" dataKey="value" name={series} stroke={colors[colors.length - 1]} fill={colors[colors.length - 1]} fillOpacity={0.16} strokeWidth={2} isAnimationActive={anim} animationDuration={300} />
                : (
                  <Bar dataKey="value" name={series} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={anim} animationDuration={300}
                    onClick={onSelect ? (_e: unknown, k: number) => onSelect(String(shown[k]?.label)) : undefined} className={onSelect ? 'cursor-pointer' : ''}>
                    {shown.map(d => <Cell key={pKey(d.i)} fill={colors[d.i]} />)}
                  </Bar>
                )}
          </Cartesian>
        </ResponsiveContainer>
      </ScrollX>
    );
  }

  // ── The widget's own axis, one series per period ──
  const data = result.rows.map(r => {
    const o: Record<string, string | number | null> = { label: r.label };
    visible.forEach(i => { o[pKey(i)] = r.values[series]?.[i] ?? null; });
    return o;
  });
  const minWidth = data.length * (isLine || isArea ? MIN_POINT : visible.length * MIN_BAR + GROUP_PAD) + 60;
  const tooltip = <Tooltip content={(p) => <SeriesTooltip active={p.active} label={p.label as string | number | undefined} result={result} series={series} visible={visible} />} cursor={{ fill: 'rgba(106,18,205,0.06)' }} />;
  return (
    <ScrollX minWidth={minWidth}>
      <ResponsiveContainer width="100%" height="100%">
        <Cartesian data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          {axes}{tooltip}
          {visible.map((i, k) => (isLine
            ? <Line key={pKey(i)} name={result.sides[i].label} type="monotone" dataKey={pKey(i)} stroke={colors[i]} strokeWidth={2} dot={data.length <= 12 ? { r: 3, strokeWidth: 0, fill: colors[i] } : false} connectNulls isAnimationActive={anim} animationDuration={300} animationBegin={stagger(k)} />
            : isArea
              ? <Area key={pKey(i)} name={result.sides[i].label} type="monotone" dataKey={pKey(i)} stroke={colors[i]} fill={colors[i]} fillOpacity={0.10} strokeWidth={2} connectNulls isAnimationActive={anim} animationDuration={300} animationBegin={stagger(k)} />
              : <Bar key={pKey(i)} name={result.sides[i].label} dataKey={pKey(i)} fill={colors[i]} radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={anim} animationDuration={300} animationBegin={stagger(k)}
                onClick={onSelect ? (_e: unknown, idx: number) => onSelect(String(data[idx]?.label)) : undefined} className={onSelect ? 'cursor-pointer' : ''} />
          ))}
        </Cartesian>
      </ResponsiveContainer>
    </ScrollX>
  );
}

/** Period swatches — each one toggles its series off and on. */
export function SeriesLegend({ result, hidden, onToggle, onReset }: {
  result: SeriesCompareResult; hidden: Set<number>; onToggle: (i: number) => void; onReset: () => void;
}) {
  const colors = periodColors(result.sides.length);
  return (
    <div className="flex items-center gap-2 px-3 pt-2 shrink-0 min-w-0" onClick={e => e.stopPropagation()}>
      <div role="group" aria-label="Periods shown" className="flex items-center gap-1.5 overflow-x-auto min-w-0 pb-0.5">
        {result.sides.map((s, i) => {
          const off = hidden.has(i);
          return (
            <button
              key={i} type="button" aria-pressed={!off} onClick={() => onToggle(i)}
              title={off ? `Show ${s.label}` : `Hide ${s.label}`}
              className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[0.6875rem] font-medium whitespace-nowrap cursor-pointer transition-colors ${off ? 'border-canvas-border text-ink-400 opacity-60' : 'border-canvas-border text-ink-700 hover:border-brand-200'}`}
            >
              <span className="size-2.5 rounded-xs shrink-0" style={{ background: off ? 'transparent' : colors[i], boxShadow: off ? `inset 0 0 0 1px ${colors[i]}` : undefined }} aria-hidden="true" />
              {s.label}
            </button>
          );
        })}
      </div>
      {hidden.size > 0 && (
        <button type="button" onClick={onReset} className="ml-auto shrink-0 text-[0.6875rem] font-medium text-brand-700 hover:underline cursor-pointer">Show all</button>
      )}
    </div>
  );
}
