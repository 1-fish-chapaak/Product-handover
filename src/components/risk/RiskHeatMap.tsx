/**
 * Heat map — three lenses on the same register:
 *  · Likelihood × impact: the classic 5×5, inherent or residual, cell → risks
 *  · Risk profile: every risk against the four parts of its score
 *  · Process × category: average residual where they meet
 */
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PROCESS_LONG } from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { CATEGORIES, TIERS_DESC, type Tier } from '../../data/erm/model';
import { residualCell, type RiskRating } from '../../data/erm/score';
import type { RiskCategory } from '../../data/riskRegister';
import { HeatCell, Panel, Spark, TierChip } from './riskUi';
import { heatFill } from './riskTheme';
import type { RiskNav } from './RiskRegisterPage';

type Lens = 'matrix' | 'profile' | 'process';
const L_LABEL = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
const I_LABEL = ['Minor', 'Moderate', 'Significant', 'Major', 'Severe'];
const PROCESSES: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];

export default function RiskHeatMap({ ratings, nav }: { ratings: RiskRating[]; nav: RiskNav }) {
  const [lens, setLens] = useState<Lens>('matrix');
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Heat map lens" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-100">
        {([['matrix', 'Likelihood × impact'], ['profile', 'Risk profile'], ['process', 'Process × category']] as [Lens, string][]).map(([id, l]) => (
          <button key={id} role="tab" aria-selected={lens === id} onClick={() => setLens(id)} className={`h-8 px-3.5 rounded-md text-[0.8125rem] font-medium cursor-pointer transition-colors ${lens === id ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>{l}</button>
        ))}
      </div>
      {lens === 'matrix' && <Matrix ratings={ratings} nav={nav} />}
      {lens === 'profile' && <Profile ratings={ratings} nav={nav} />}
      {lens === 'process' && <ProcessByCategory ratings={ratings} nav={nav} />}
    </div>
  );
}

function Matrix({ ratings, nav }: { ratings: RiskRating[]; nav: RiskNav }) {
  const [mode, setMode] = useState<'inherent' | 'residual'>('residual');
  const [cell, setCell] = useState<{ l: number; i: number } | null>(null);
  const pos = (r: RiskRating) => (mode === 'inherent' ? { l: r.risk.likelihood, i: r.risk.impact } : residualCell(r));
  const inCell = (l: number, i: number) => ratings.filter(r => { const p = pos(r); return p.l === l && p.i === i; });
  const picked = cell ? inCell(cell.l, cell.i) : [...ratings].sort((a, b) => b.score - a.score).slice(0, 8);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-5">
      <Panel
        title="Likelihood × impact"
        tip="Inherent places a risk by its assessed likelihood and impact. Residual moves it down the likelihood axis by what its controls take off. Click a cell to list its risks."
        right={
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-paper-100">
            {(['inherent', 'residual'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setCell(null); }} aria-pressed={mode === m} className={`h-6 px-2.5 rounded text-[0.6875rem] font-semibold capitalize cursor-pointer ${mode === m ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500'}`}>{m}</button>
            ))}
          </div>
        }
      >
        <div className="flex gap-3">
          <div className="flex flex-col justify-between py-1 text-right" aria-hidden>
            {[5, 4, 3, 2, 1].map(l => <span key={l} className="h-[4.75rem] flex flex-col justify-center text-[0.6875rem] text-ink-500 leading-tight"><span className="font-mono text-ink-800">{l}</span>{L_LABEL[l - 1]}</span>)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-5 gap-1.5">
              {[5, 4, 3, 2, 1].flatMap(l => [1, 2, 3, 4, 5].map(i => {
                const rs = inCell(l, i);
                const [bg, fg] = heatFill(l * i * 3);
                const on = cell?.l === l && cell?.i === i;
                return (
                  <button
                    key={`${l}-${i}`}
                    type="button"
                    onClick={() => setCell(on ? null : { l, i })}
                    aria-pressed={on}
                    aria-label={`Likelihood ${l}, impact ${i}: ${rs.length} risk${rs.length === 1 ? '' : 's'}`}
                    className={`relative h-[4.75rem] rounded-lg p-1.5 text-left cursor-pointer transition-shadow ${on ? 'ring-2 ring-offset-2 ring-brand-600' : 'hover:ring-2 hover:ring-brand-200'}`}
                    style={{ background: bg, color: fg }}
                  >
                    <span className="absolute top-1.5 right-2 font-mono text-[0.625rem] opacity-60">{l * i}</span>
                    {rs.length > 0 && (
                      <>
                        <span className="block font-mono text-[1.125rem] font-semibold leading-none tabular-nums">{rs.length}</span>
                        <span className="mt-1 flex flex-wrap gap-0.5">
                          {rs.slice(0, 3).map(r => <span key={r.risk.id} className="font-mono text-[0.5625rem] px-1 rounded bg-white/25">{r.risk.id.replace('RSK-', '')}</span>)}
                          {rs.length > 3 && <span className="font-mono text-[0.5625rem] px-1">+{rs.length - 3}</span>}
                        </span>
                      </>
                    )}
                  </button>
                );
              }))}
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-1.5" aria-hidden>
              {[1, 2, 3, 4, 5].map(i => <span key={i} className="text-center text-[0.6875rem] text-ink-500 leading-tight"><span className="font-mono text-ink-800">{i}</span> {I_LABEL[i - 1]}</span>)}
            </div>
            <div className="mt-2 flex items-center justify-between text-[0.6875rem] text-ink-400">
              <span>↑ Likelihood</span><span>Impact →</span>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title={cell ? `Likelihood ${cell.l} · impact ${cell.i}` : 'Highest residual'}
        right={cell ? <button onClick={() => setCell(null)} className="text-[0.75rem] text-brand-700 hover:underline cursor-pointer">Show highest</button> : undefined}
        flush
      >
        {picked.length === 0 ? <p className="px-5 py-6 text-[0.8125rem] text-ink-500">No risk sits here.</p> : (
          <ul className="divide-y divide-canvas-border">
            {picked.map(r => {
              const res = residualCell(r);
              return (
                <li key={r.risk.id}>
                  <button onClick={() => nav.openRisk(r.risk.id)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-paper-50/60 cursor-pointer">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-semibold text-ink-900 truncate">{r.risk.name}</span>
                      <span className="flex items-center gap-1.5 text-[0.6875rem] text-ink-500 font-mono">
                        {r.risk.id} · L{r.risk.likelihood}×I{r.risk.impact} <ArrowRight size={10} aria-hidden /> L{res.l}×I{res.i}
                      </span>
                    </span>
                    <span className="font-mono text-[0.8125rem] font-semibold tabular-nums">{r.score.toFixed(1)}</span>
                    <TierChip tier={r.tier} size="sm" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Profile({ ratings, nav }: { ratings: RiskRating[]; nav: RiskNav }) {
  const [tier, setTier] = useState<Tier | ''>('');
  const rows = [...ratings].filter(r => !tier || r.tier === tier).sort((a, b) => b.score - a.score);
  const parts = (r: RiskRating) => ({
    exposure: r.inherent,
    gap: r.inherent ? ((r.inherent - r.mitigation) / r.inherent) * 100 : 0,
    pressure: r.kris.length ? (r.kriPoints / (r.kris.length * 8.75)) * 100 : 0,
    events: (r.eventPoints / 15) * 100,
  });
  const COLS: [keyof ReturnType<typeof parts>, string, string][] = [
    ['exposure', 'Exposure', 'Inherent exposure — likelihood × impact × 4'],
    ['gap', 'Control gap', 'Share of the exposure still standing after controls (100 = no control operating)'],
    ['pressure', 'Indicators', 'Indicator pressure — how far its indicators are into amber and red'],
    ['events', 'Events', 'Loss events in the last three months'],
  ];
  return (
    <Panel
      title="Every risk against the parts of its score"
      tip="Each cell is 0–100 on the same scale. Click a row to open the risk."
      right={
        <select value={tier} onChange={e => setTier(e.target.value as Tier | '')} aria-label="Filter by rating" className="h-7 pl-2 pr-6 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] cursor-pointer">
          <option value="">Any rating</option>
          {TIERS_DESC.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      }
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
              <th className="text-left font-semibold px-5 py-2.5">Risk</th>
              <th className="text-left font-semibold px-3 py-2.5">Process</th>
              {COLS.map(([k, l, t]) => <th key={k} title={t} className="text-center font-semibold px-2 py-2.5 cursor-help">{l}</th>)}
              <th className="text-right font-semibold px-3 py-2.5">Residual</th>
              <th className="text-left font-semibold px-3 py-2.5">Rating</th>
              <th className="text-left font-semibold px-3 py-2.5">Apr–Oct</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const p = parts(r);
              return (
                <tr key={r.risk.id} onClick={() => nav.openRisk(r.risk.id)} className="border-t border-canvas-border hover:bg-paper-50/60 cursor-pointer">
                  <td className="px-5 py-2"><span className="font-semibold text-ink-900">{r.risk.name}</span> <span className="font-mono text-[0.6875rem] text-ink-400">{r.risk.id}</span></td>
                  <td className="px-3 py-2 font-mono text-[0.75rem] text-ink-600">{r.risk.businessProcess}</td>
                  {COLS.map(([k]) => <td key={k} className="px-2 py-1.5 text-center"><HeatCell v={p[k]} wide /></td>)}
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">{r.score.toFixed(1)}</td>
                  <td className="px-3 py-2"><TierChip tier={r.tier} size="sm" /></td>
                  <td className="px-3 py-2"><Spark values={r.history} width={70} height={18} color={r.delta > 0 ? '#B42318' : '#3B0764'} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ProcessByCategory({ ratings, nav }: { ratings: RiskRating[]; nav: RiskNav }) {
  const procs = PROCESSES.filter(p => ratings.some(r => r.risk.businessProcess === p));
  const cats = CATEGORIES.filter(c => ratings.some(r => r.risk.category === c));
  const avg = (rs: RiskRating[]) => rs.reduce((a, r) => a + r.score, 0) / rs.length;
  return (
    <Panel title="Average residual where process and category meet" tip="Click a cell to list its risks" flush>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
              <th className="text-left font-semibold px-5 py-2.5">Process</th>
              {cats.map(c => <th key={c} className="text-center font-semibold px-2 py-2.5">{c}</th>)}
              <th className="text-right font-semibold px-5 py-2.5">All</th>
            </tr>
          </thead>
          <tbody>
            {procs.map(p => {
              const prs = ratings.filter(r => r.risk.businessProcess === p);
              return (
                <tr key={p} className="border-t border-canvas-border">
                  <td className="px-5 py-2.5 font-semibold text-ink-900">{PROCESS_LONG[p]} <span className="font-mono text-[0.6875rem] text-ink-400">{p}</span></td>
                  {cats.map(c => {
                    const rs = prs.filter(r => r.risk.category === c);
                    return (
                      <td key={c} className="px-2 py-2 text-center">
                        <HeatCell v={rs.length ? avg(rs) : null} wide title={rs.map(r => `${r.risk.id} ${r.risk.name}`).join('\n')} onClick={rs.length ? () => nav.showList({ process: p, category: c as RiskCategory }) : undefined} />
                      </td>
                    );
                  })}
                  <td className="px-5 py-2.5 text-right font-mono font-semibold tabular-nums">{avg(prs).toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
