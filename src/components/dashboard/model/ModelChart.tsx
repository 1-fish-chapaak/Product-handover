import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import type { ModelChartData } from './relationshipTypes';

const PALETTE = ['#6a12cd', '#8838DE', '#A366F0', '#0d9488', '#C2410C', '#B45309', '#0369A1'];

/** Renders joined+aggregated multi-table data for a widget. Self-contained so
 *  the giant ConfigurableChart is untouched.
 *  - `onSelect(label)` fires when a bar/slice/point/row is clicked (cross-filter).
 *  - `highlight` emphasises one category and dims the rest (cross-filter source). */
export default function ModelChart({
  data, type, color = '#6a12cd', onSelect, highlight = null,
}: {
  data: ModelChartData;
  type: string;
  color?: string;
  onSelect?: (label: string) => void;
  highlight?: string | null;
}) {
  const t = type.toLowerCase();

  if (data.error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center gap-1.5 px-4">
        <AlertTriangle size={18} className="text-mitigated-700" />
        <p className="text-[12px] font-semibold text-text">Needs attention</p>
        <p className="text-[11px] text-text-muted">{data.error} Connect the tables to restore this widget.</p>
      </div>
    );
  }
  if (data.rows.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-[12px] text-text-muted">No data for this selection.</div>;
  }

  const series = data.series;
  const colorFor = (i: number) => (i === 0 ? color : PALETTE[i % PALETTE.length]);
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-IN') : String(v));
  const opacityFor = (label: string) => (highlight != null && label !== highlight ? 0.26 : 1);
  const clickable = !!onSelect;
  const pick = (label: string | number) => onSelect?.(String(label));

  if (t.includes('kpi')) {
    const key = series[0];
    const total = data.rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <div className="text-[28px] font-bold text-text tabular-nums">{fmt(total)}</div>
        <div className="text-[11px] text-text-muted mt-1">{key}</div>
      </div>
    );
  }

  if (t.includes('table')) {
    return (
      <div className="h-full w-full overflow-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="text-left text-text-muted border-b border-border-light">
              <th className="px-2 py-1.5 font-semibold">{data.xLabel}</th>
              {series.map(s => <th key={s} className="px-2 py-1.5 font-semibold text-right">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr
                key={i}
                onClick={clickable ? () => pick(r.label) : undefined}
                className={`border-b border-border-light/60 ${clickable ? 'cursor-pointer hover:bg-primary-xlight/40' : ''} ${highlight != null && r.label === highlight ? 'bg-primary-xlight/60' : ''}`}
                style={{ opacity: opacityFor(String(r.label)) }}
              >
                <td className="px-2 py-1.5 text-text">{r.label}</td>
                {series.map(s => <td key={s} className="px-2 py-1.5 text-right tabular-nums text-text-secondary">{fmt(Number(r[s]) || 0)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (t.includes('pie')) {
    const key = series[0];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.rows} dataKey={key} nameKey="label" cx="50%" cy="50%" outerRadius="78%" innerRadius="45%"
            onClick={clickable ? (_: unknown, index: number) => pick(data.rows[index].label) : undefined}
            className={clickable ? 'cursor-pointer outline-none' : ''}
          >
            {data.rows.map((r, i) => <Cell key={i} fill={colorFor(i)} fillOpacity={opacityFor(String(r.label))} />)}
          </Pie>
          <Tooltip formatter={(v) => fmt(Number(v) || 0)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const isLine = t.includes('line');
  const isArea = t.includes('area');
  const Cartesian = isLine ? LineChart : isArea ? AreaChart : BarChart;
  // Bars get a per-element onClick (fires on the exact bar without a prior
  // hover); line/area fall back to a chart-level click via the active label.
  const onChartClick = clickable && (isLine || isArea)
    ? (state: { activeLabel?: string | number } | null) => { if (state && state.activeLabel != null) pick(state.activeLabel); }
    : undefined;
  const onBarClick = clickable ? (_e: unknown, index: number) => { const row = data.rows[index]; if (row) pick(row.label); } : undefined;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Cartesian data={data.rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} onClick={onChartClick} className={clickable ? 'cursor-pointer' : ''}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF1" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B5D82' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
        <YAxis tick={{ fontSize: 10, fill: '#6B5D82' }} tickLine={false} axisLine={false} tickFormatter={fmt} width={48} />
        <Tooltip formatter={(v) => fmt(Number(v) || 0)} contentStyle={{ fontSize: 11, borderRadius: 8 }} cursor={{ fill: 'rgba(106,18,205,0.06)' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          isLine ? <Line key={s} type="monotone" dataKey={s} stroke={colorFor(i)} strokeWidth={2} dot={false} />
          : isArea ? <Area key={s} type="monotone" dataKey={s} stroke={colorFor(i)} fill={colorFor(i)} fillOpacity={0.18} strokeWidth={2} />
          : (
            <Bar key={s} dataKey={s} fill={colorFor(i)} radius={[4, 4, 0, 0]} maxBarSize={46} onClick={onBarClick} className={clickable ? 'cursor-pointer' : ''}>
              {highlight != null && data.rows.map((r, ri) => (
                <Cell key={ri} fill={colorFor(i)} fillOpacity={opacityFor(String(r.label))} />
              ))}
            </Bar>
          )
        ))}
      </Cartesian>
    </ResponsiveContainer>
  );
}
