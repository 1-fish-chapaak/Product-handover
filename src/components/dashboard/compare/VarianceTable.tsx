import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import DeltaChip from '../../shared/DeltaChip';
import { Pill } from '../../shared/StatusBadge';
import { formatDelta, formatPct, formatSigned, formatValue } from './compareEngine';
import { plainSeries } from './compareSummary';
import type { CompareResult, CompareSide } from './compareTypes';

type SortKey = 'label' | 'a' | 'b' | 'delta' | 'pct';
type Dir = 'asc' | 'desc';

/**
 * label · A · B · Δ · Δ% for one measure, biggest movers first. Tone appears
 * only on the Δ% chip — never as a row fill — so the table reads as a table.
 */
export default function VarianceTable({ result, a, b, series: seriesProp, compact = false }: {
  result: CompareResult; a: CompareSide; b: CompareSide;
  /** Which measure (defaults to the first). */
  series?: string;
  compact?: boolean;
}) {
  const series = seriesProp ?? result.series[0];
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: 'pct', dir: 'desc' });
  const rows = useMemo(() => {
    if (!series) return [];
    const list = result.merged.map(m => ({ m, s: m.values[series] }));
    const val = (r: typeof list[number]) => sort.key === 'label' ? r.m.label : sort.key === 'a' ? r.s.a : sort.key === 'b' ? r.s.b : sort.key === 'delta' ? Math.abs(r.s.delta) : Math.abs(r.s.pct ?? -Infinity);
    return list.sort((x, y) => { const vx = val(x), vy = val(y); const c = typeof vx === 'string' && typeof vy === 'string' ? vx.localeCompare(vy) : Number(vx) - Number(vy); return sort.dir === 'asc' ? c : -c; });
  }, [result.merged, series, sort]);
  if (!series) return <p className="text-[0.75rem] text-ink-500 text-center py-6">Nothing to compare — this widget has no measure.</p>;
  if (rows.length === 0) return <p className="text-[0.75rem] text-ink-500 text-center py-6">No overlapping categories between {a.label} and {b.label}.</p>;

  const total = result.kpi[series];
  const th = (key: SortKey, label: string, align: 'left' | 'right' = 'right') => {
    const on = sort.key === key;
    const Icon = on ? (sort.dir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th scope="col" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${compact ? 'px-3 py-2' : 'px-4 py-3'} ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <button type="button" onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))} aria-label={`Sort by ${label}`} className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wider cursor-pointer ${on ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'}`}>
          {label} <Icon size={10} aria-hidden="true" />
        </button>
      </th>
    );
  };
  const cell = compact ? 'px-3 py-2 text-[0.75rem]' : 'px-4 py-2.5 text-[0.75rem]';
  return (
    <div className="w-full overflow-auto">
      <table className="w-full border-collapse">
        <thead className="border-b border-canvas-border">
          <tr>{th('label', result.a.xLabel || 'Category', 'left')}{th('a', a.label)}{th('b', b.label)}{th('delta', 'Δ')}{th('pct', 'Δ%')}</tr>
        </thead>
        <tbody>
          {rows.map(({ m, s }) => {
            const f = formatDelta(s, series);
            const dir: 'up' | 'down' | 'flat' = s.delta > 0 ? 'up' : s.delta < 0 ? 'down' : 'flat';
            return (
              <tr key={m.label} className="border-b border-canvas-border/60 last:border-b-0">
                <td className={`${cell} text-left font-medium text-ink-800`}>
                  <span className="inline-flex items-center gap-2">{m.label}{m.presentIn !== 'both' && <Pill tone="draft">Only in {m.presentIn.toUpperCase()}</Pill>}</span>
                </td>
                <td className={`${cell} text-right tabular-nums text-ink-900`}>{m.presentIn === 'b' ? '—' : f.a}</td>
                <td className={`${cell} text-right tabular-nums text-ink-500`}>{m.presentIn === 'a' ? '—' : f.b}</td>
                <td className={`${cell} text-right tabular-nums text-ink-700`}>{f.delta}</td>
                <td className={`${cell} text-right`}><DeltaChip text={f.pct} tone={s.tone} direction={dir} isNew={s.a === 0 && s.b !== 0} /></td>
              </tr>
            );
          })}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t-2 border-brand-600/20 bg-brand-50/40 font-semibold">
              <td className={`${cell} text-left text-ink-800`}>Total · {plainSeries(series)}</td>
              <td className={`${cell} text-right tabular-nums text-ink-900`}>{formatValue(total.a, series)}</td>
              <td className={`${cell} text-right tabular-nums text-ink-600`}>{formatValue(total.b, series)}</td>
              <td className={`${cell} text-right tabular-nums text-ink-700`}>{formatSigned(total.delta, series)}</td>
              <td className={`${cell} text-right`}><DeltaChip text={formatPct(total.pct, total.a)} tone={total.tone} direction={total.delta > 0 ? 'up' : total.delta < 0 ? 'down' : 'flat'} isNew={total.a === 0 && total.b !== 0} /></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
