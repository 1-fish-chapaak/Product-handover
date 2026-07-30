import { Lock, Target } from 'lucide-react';
import { BENCHMARK_META, clearlyTrivialOf, formatINR, overallMateriality, performanceMaterialityOf } from './helpers';
import { cn } from '../../lib/cn';
import type { BenchmarkKey, MaterialityBasis } from './types';

const fmtFull = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

/**
 * The materiality worksheet — one component for both moments in its life:
 * editable inside the engagement drawer before go-live, and rendered read-only
 * with a lock badge on the Configuration page after. Benchmark amounts come
 * from the uploaded one-month GL (P&L annualized ×12, balance sheet as at date).
 */
export default function MaterialityWorksheet({ basis, locked, onChange }: {
  basis: MaterialityBasis;
  locked: boolean;
  onChange?: (b: MaterialityBasis) => void;
}) {
  const M = overallMateriality(basis);
  const pm = performanceMaterialityOf(basis);
  const ct = clearlyTrivialOf(basis);
  const set = (patch: Partial<MaterialityBasis>) => { if (!locked && onChange) onChange({ ...basis, ...patch }); };

  return (
    <div className="space-y-4">
      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-canvas-border bg-paper-50/60 px-3 py-2">
          <Lock size={13} className="text-ink-500" />
          <span className="text-[12px] text-ink-600"><b>Materiality is locked</b> — set at go-live{basis.lockedAt ? ` on ${basis.lockedAt}` : ''} and cannot be changed for the life of the engagement.</span>
        </div>
      )}

      {/* benchmark table */}
      <div className="rounded-xl border border-canvas-border overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-paper-50/60 border-b border-canvas-border text-[10px] uppercase tracking-wide text-ink-500">
              <th className="text-left font-semibold px-3.5 py-2">Benchmark</th>
              <th className="text-right font-semibold px-3.5 py-2">Amount</th>
              <th className="text-left font-semibold px-3.5 py-2">Typical</th>
              <th className="text-left font-semibold px-3.5 py-2">%</th>
              <th className="text-right font-semibold px-3.5 py-2">Materiality</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(BENCHMARK_META) as BenchmarkKey[]).map(k => {
              const meta = BENCHMARK_META[k];
              const on = basis.benchmark === k;
              return (
                <tr key={k} className={cn('border-b border-canvas-border/60 last:border-0 transition-colors', on && 'bg-brand-50/40', !locked && 'cursor-pointer hover:bg-paper-50/60')}
                  onClick={() => set({ benchmark: k })}>
                  <td className="px-3.5 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn('w-[15px] h-[15px] rounded-full border-2 inline-flex items-center justify-center shrink-0', on ? 'border-brand-600' : 'border-ink-300')}>{on && <span className="w-[7px] h-[7px] rounded-full bg-brand-600" />}</span>
                      <span>
                        <span className={cn('block font-semibold', on ? 'text-brand-800' : 'text-ink-800')}>{meta.label}</span>
                        <span className="block text-[10.5px] text-ink-400">{meta.note}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums text-ink-700">{formatINR(basis.amounts[k])}</td>
                  <td className="px-3.5 py-2.5 text-ink-400 text-[11.5px]">{meta.range[0]}–{meta.range[1]}%</td>
                  <td className="px-3.5 py-2.5" onClick={e => e.stopPropagation()}>
                    {on ? (
                      <input type="number" step={0.1} min={0.1} max={15} value={basis.pct} disabled={locked}
                        onChange={e => set({ pct: Math.max(0.1, Math.min(15, +e.target.value || 0.1)) })}
                        className="h-7 w-16 px-2 rounded-md border border-brand-200 bg-canvas-elevated text-[12px] tabular-nums font-semibold text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-70" />
                    ) : <span className="text-ink-300">—</span>}
                  </td>
                  <td className={cn('px-3.5 py-2.5 text-right tabular-nums font-semibold', on ? 'text-brand-800' : 'text-ink-400')}>
                    {on ? formatINR(M) : formatINR(Math.round(basis.amounts[k] * ((meta.range[0] + meta.range[1]) / 2) / 100))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-3.5 py-2 bg-paper-50/40 border-t border-canvas-border text-[11px] text-ink-400">Source: {basis.source}</div>
      </div>

      {/* the three figures */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-3.5 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-brand-700 inline-flex items-center gap-1"><Target size={11} /> Overall materiality</div>
          <div className="text-[20px] font-bold tabular-nums text-brand-900 mt-1">{formatINR(M)}</div>
          <div className="text-[10.5px] text-ink-500 mt-0.5">{basis.pct}% of {BENCHMARK_META[basis.benchmark].label.toLowerCase()}</div>
        </div>
        <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">Performance materiality</div>
          <div className="text-[20px] font-bold tabular-nums text-ink-900 mt-1">{formatINR(pm)}</div>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="range" min={50} max={75} step={5} value={basis.pmPct} disabled={locked}
              onChange={e => set({ pmPct: +e.target.value })} aria-label="Performance materiality percentage"
              className="flex-1 accent-brand-600 disabled:opacity-60" />
            <span className="text-[11px] font-semibold tabular-nums text-ink-600 w-9">{basis.pmPct}%</span>
          </div>
        </div>
        <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">Clearly trivial</div>
          <div className="text-[20px] font-bold tabular-nums text-ink-900 mt-1">{fmtFull(ct)}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-500">
            <input type="number" min={1} max={10} value={basis.ctPct} disabled={locked}
              onChange={e => set({ ctPct: Math.max(1, Math.min(10, +e.target.value || 5)) })} aria-label="Clearly trivial percentage"
              className="h-6 w-12 px-1.5 rounded-md border border-canvas-border text-[11px] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-70" />
            % of overall — logged, not evaluated
          </div>
        </div>
      </div>

      {/* allocation — the detailed asset / cash / revenue breakdown */}
      <div className="rounded-xl border border-canvas-border overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-canvas-border bg-paper-50/40 flex items-center justify-between">
          <span className="text-[11.5px] font-bold text-ink-700">Allocation to significant account groups</span>
          <span className="text-[10.5px] text-ink-400">performance materiality {formatINR(pm)} spread by balance</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-canvas-border text-[10px] uppercase tracking-wide text-ink-500">
              <th className="text-left font-semibold px-3.5 py-1.5">Account group</th>
              <th className="text-right font-semibold px-3.5 py-1.5">Balance</th>
              <th className="text-left font-semibold px-3.5 py-1.5 w-[140px]">Share</th>
              <th className="text-right font-semibold px-3.5 py-1.5">Allocated PM</th>
            </tr>
          </thead>
          <tbody>
            {basis.allocation.map(a => (
              <tr key={a.group} className="border-b border-canvas-border/60 last:border-0">
                <td className="px-3.5 py-2 font-medium text-ink-800">{a.group}</td>
                <td className="px-3.5 py-2 text-right tabular-nums text-ink-600">{formatINR(a.balance)}</td>
                <td className="px-3.5 py-2">
                  <span className="flex items-center gap-1.5">
                    <span className="meter flex-1"><span style={{ width: `${a.sharePct}%`, background: 'var(--color-brand-500)' }} /></span>
                    <span className="text-[10.5px] tabular-nums text-ink-500 w-8 text-right">{a.sharePct}%</span>
                  </span>
                </td>
                <td className="px-3.5 py-2 text-right tabular-nums font-semibold text-ink-800">{formatINR(Math.round(pm * a.sharePct / 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
