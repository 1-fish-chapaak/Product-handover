import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import DeltaChip from '../../shared/DeltaChip';
import { formatDelta, formatPct, formatSigned, formatValue } from './compareEngine';
import { plainSeries } from './compareSummary';
import { periodColors } from './periodColors';
import type { SeriesCompareResult } from './compareTypes';

type SortKey = { kind: 'label' } | { kind: 'period'; i: number } | { kind: 'delta' } | { kind: 'pct' };
const sortId = (k: SortKey) => (k.kind === 'period' ? `p${k.i}` : k.kind);

/**
 * One column per period, then the span (first → last) and its percent. The
 * category column stays put while the periods scroll sideways, so a
 * thirty-six-month table is still readable.
 */
export default function SeriesVarianceTable({ result, series: seriesProp, compact = false }: {
  result: SeriesCompareResult;
  series?: string;
  compact?: boolean;
}) {
  const series = seriesProp ?? result.series[0];
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: { kind: 'pct' }, dir: 'desc' });
  const rows = useMemo(() => {
    if (!series) return [];
    const val = (r: typeof result.rows[number]): number | string => {
      switch (sort.key.kind) {
        case 'label': return r.label;
        case 'period': return r.values[series]?.[sort.key.i] ?? -Infinity;
        case 'delta': return Math.abs(r.span[series]?.delta ?? 0);
        case 'pct': return Math.abs(r.span[series]?.pct ?? -Infinity);
      }
    };
    return [...result.rows].sort((x, y) => {
      const vx = val(x), vy = val(y);
      const c = typeof vx === 'string' && typeof vy === 'string' ? vx.localeCompare(vy) : Number(vx) - Number(vy);
      return sort.dir === 'asc' ? c : -c;
    });
  }, [result, series, sort]);

  if (!series) return <p className="text-[0.75rem] text-ink-500 text-center py-6">Nothing to compare — this widget has no measure.</p>;
  if (rows.length === 0) return <p className="text-[0.75rem] text-ink-500 text-center py-6">No rows fall in any of these periods.</p>;

  const colors = periodColors(result.sides.length);
  const cell = compact ? 'px-3 py-2 text-[0.75rem]' : 'px-4 py-2.5 text-[0.75rem]';
  const headCell = compact ? 'px-3 py-2' : 'px-4 py-3';
  const stickyHead = 'sticky left-0 z-20 bg-canvas-elevated';
  const stickyCell = 'sticky left-0 z-10 bg-canvas-elevated';

  const th = (key: SortKey, label: string, align: 'left' | 'right', swatch?: string, sticky = false) => {
    const on = sortId(sort.key) === sortId(key);
    const Icon = on ? (sort.dir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th
        scope="col"
        aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`${headCell} ${align === 'right' ? 'text-right' : 'text-left'} ${sticky ? stickyHead : ''} whitespace-nowrap`}
      >
        <button
          type="button"
          onClick={() => setSort(s => ({ key, dir: sortId(s.key) === sortId(key) && s.dir === 'desc' ? 'asc' : 'desc' }))}
          aria-label={`Sort by ${label}`}
          className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wider cursor-pointer ${on ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'}`}
        >
          {swatch && <span className="size-2 rounded-xs shrink-0" style={{ background: swatch }} aria-hidden="true" />}
          {label} <Icon size={10} aria-hidden="true" />
        </button>
      </th>
    );
  };

  const total = result.span[series];
  return (
    <div className="w-full overflow-auto" onClick={e => e.stopPropagation()}>
      <table className="w-full border-collapse">
        <thead className="border-b border-canvas-border">
          <tr>
            {th({ kind: 'label' }, result.xLabel || 'Category', 'left', undefined, true)}
            {result.sides.map((s, i) => th({ kind: 'period', i }, s.label, 'right', colors[i]))}
            {th({ kind: 'delta' }, 'Δ span', 'right')}
            {th({ kind: 'pct' }, 'Δ%', 'right')}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const s = r.span[series];
            const dir: 'up' | 'down' | 'flat' = s.delta > 0 ? 'up' : s.delta < 0 ? 'down' : 'flat';
            const f = formatDelta(s, series);
            return (
              <tr key={r.label} className="border-b border-canvas-border/60 last:border-b-0">
                <td className={`${cell} text-left font-medium text-ink-800 whitespace-nowrap ${stickyCell}`}>{r.label}</td>
                {result.sides.map((_, i) => {
                  const v = r.values[series]?.[i];
                  return <td key={i} className={`${cell} text-right tabular-nums ${i === result.sides.length - 1 ? 'text-ink-900' : 'text-ink-600'}`}>{v == null ? '—' : formatValue(v, series)}</td>;
                })}
                <td className={`${cell} text-right tabular-nums text-ink-700`}>{f.delta}</td>
                <td className={`${cell} text-right`}><DeltaChip text={f.pct} tone={s.tone} direction={dir} isNew={s.a === 0 && s.b !== 0} /></td>
              </tr>
            );
          })}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t-2 border-brand-600/20 bg-brand-50/40 font-semibold">
              <td className={`${cell} text-left text-ink-800 whitespace-nowrap ${stickyCell} bg-brand-50/40`}>Total · {plainSeries(series)}</td>
              {result.sides.map((_, i) => (
                <td key={i} className={`${cell} text-right tabular-nums text-ink-800`}>{formatValue(result.totals[series]?.[i] ?? 0, series)}</td>
              ))}
              <td className={`${cell} text-right tabular-nums text-ink-700`}>{formatSigned(total.delta, series)}</td>
              <td className={`${cell} text-right`}><DeltaChip text={formatPct(total.pct, total.a)} tone={total.tone} direction={total.delta > 0 ? 'up' : total.delta < 0 ? 'down' : 'flat'} isNew={total.a === 0 && total.b !== 0} /></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
