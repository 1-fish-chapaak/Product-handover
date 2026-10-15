/**
 * Risk overview — where the risk sits and what it is setting in motion.
 * Enterprise first (processes as tiles); click a process to see its risks.
 */
import { useState, type ReactNode } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { PROCESS_LONG } from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { APPETITE, CATEGORIES, MONTHS, NOW, TIERS_DESC, TIER_ACTION, type Tier } from '../../data/erm/model';
import { moveReason, type RiskRating } from '../../data/erm/score';
import type { RiskCategory } from '../../data/riskRegister';
import { Delta, HeatCell, Kpi, MixBar, Panel, TierChip, Treemap, type TreeItem } from './riskUi';
import { TIER_FILL, heatFill } from './riskTheme';
import type { RiskNav } from './RiskRegisterPage';

const PROCESS_ORDER: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const tierCounts = (rs: RiskRating[], prev = false) =>
  Object.fromEntries(TIERS_DESC.map(t => [t, rs.filter(r => (prev ? r.prevTier : r.tier) === t).length])) as Record<Tier, number>;

export default function RiskOverview({ ratings, nav, afterKpis, footer }: {
  ratings: RiskRating[]; nav: RiskNav;
  /** Extra panels for the dashboard, drawn for the current scope. */
  afterKpis?: (scoped: RiskRating[]) => ReactNode;
  footer?: (scoped: RiskRating[]) => ReactNode;
}) {
  const [scope, setScope] = useState<ProcessCode | null>(null);
  const rs = scope ? ratings.filter(r => r.risk.businessProcess === scope) : ratings;
  const now = tierCounts(rs);
  const prev = tierCounts(rs, true);
  const outside = rs.filter(r => r.outsideAppetite);
  const moved = rs.filter(r => r.tier !== r.prevTier).sort((a, b) => b.score - a.score);
  const gaps = rs.filter(r => r.overrides.includes('No operating key control') || r.controls.length === 0).sort((a, b) => b.score - a.score);
  const processes = PROCESS_ORDER.filter(p => ratings.some(r => r.risk.businessProcess === p));

  // Treemap: processes at enterprise level, risks inside a process.
  const tiles: TreeItem[] = scope
    ? rs.map(r => ({
      id: r.risk.id, label: r.risk.name, sub: `${r.score.toFixed(1)} · ${r.tier}`,
      value: r.inherent, fill: TIER_FILL[r.tier][0], ink: TIER_FILL[r.tier][1],
      title: `${r.risk.id} ${r.risk.name}\nResidual ${r.score.toFixed(1)} — ${r.tier}\n${TIER_ACTION[r.tier]}`,
    }))
    : processes.map(p => {
      const ps = ratings.filter(r => r.risk.businessProcess === p);
      const a = avg(ps.map(r => r.score));
      const [fill, ink] = heatFill(a);
      const hi = ps.filter(r => ['Critical', 'Very High', 'High'].includes(r.tier)).length;
      return {
        id: p, label: PROCESS_LONG[p], sub: `${ps.length} risks · ${hi} High or above · avg ${a.toFixed(0)}`,
        value: ps.reduce((s, r) => s + r.inherent, 0), fill, ink,
        title: `${PROCESS_LONG[p]}\n${ps.length} risks, average residual ${a.toFixed(1)}\nClick to see its risks`,
      };
    });

  // One level down.
  const down = scope
    ? Array.from(new Set(rs.map(r => r.risk.subProcess))).map(sp => ({ key: sp, label: sp, rs: rs.filter(r => r.risk.subProcess === sp) }))
    : processes.map(p => ({ key: p, label: PROCESS_LONG[p], rs: ratings.filter(r => r.risk.businessProcess === p) }));
  const cats = CATEGORIES.filter(c => rs.some(r => r.risk.category === c));

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav aria-label="Scope" className="flex items-center gap-1.5 text-[0.8125rem]">
        <button onClick={() => setScope(null)} className={`cursor-pointer ${scope ? 'text-brand-700 hover:underline' : 'font-semibold text-ink-900'}`}>Enterprise</button>
        {scope && (
          <>
            <ChevronRight size={13} className="text-ink-300" aria-hidden />
            <span className="font-semibold text-ink-900">{PROCESS_LONG[scope]}</span>
          </>
        )}
      </nav>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Risks rated" value={rs.length} sub={scope ? `${new Set(rs.map(r => r.risk.subProcess)).size} sub-processes` : `${processes.length} processes · ${rs.reduce((a, r) => a + r.kris.length, 0)} indicators`} />
        {(['Critical', 'Very High', 'High'] as Tier[]).map(t => (
          <Kpi
            key={t}
            label={t}
            swatch={TIER_FILL[t][0]}
            value={<>{now[t]} <Delta d={now[t] - prev[t]} digits={0} /></>}
            sub={TIER_ACTION[t]}
            onClick={() => nav.showList({ tiers: [t], process: scope ?? undefined })}
          />
        ))}
        <Kpi label="Medium and Low" swatch={TIER_FILL.Medium[0]} value={now.Medium + now.Low} sub="Monitored — within the regular cycle" onClick={() => nav.showList({ tiers: ['Medium', 'Low'], process: scope ?? undefined })} />
        <Kpi label="Outside appetite" value={outside.length} sub="Residual above what the category tolerates" onClick={() => nav.showList({ outside: true, process: scope ?? undefined })} />
      </div>

      {afterKpis?.(rs)}

      {/* Where the risk sits + mix + categories */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
        <Panel
          title={scope ? `${PROCESS_LONG[scope]} — its risks` : 'Where the risk sits'}
          tip={scope
            ? 'Tile size is inherent exposure; colour is the rating. Click a risk to open it.'
            : 'Tile size is the inherent exposure of the process’s risks; colour is their average residual score. Click a process to go one level down.'}
          right={<Legend scope={!!scope} />}
        >
          <Treemap items={tiles} height={560} onPick={id => (scope ? nav.openRisk(id) : setScope(id as ProcessCode))} />
        </Panel>

        <div className="space-y-5 min-w-0">
          <Panel title="Rating mix" right={<span className="text-[0.6875rem] text-ink-400">vs {MONTHS[NOW - 1]}</span>}>
            <ul className="space-y-2.5">
              {TIERS_DESC.map(t => (
                <li key={t}>
                  <button onClick={() => nav.showList({ tiers: [t], process: scope ?? undefined })} className="w-full grid grid-cols-[6.5rem_minmax(0,1fr)_2rem_2.5rem] items-center gap-3 cursor-pointer group">
                    <TierChip tier={t} size="sm" />
                    <span className="h-2 rounded-full bg-paper-100 overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${(100 * now[t]) / Math.max(1, ...Object.values(now))}%`, background: TIER_FILL[t][0] }} />
                    </span>
                    <span className="text-right font-mono text-[0.8125rem] font-semibold text-ink-900 tabular-nums group-hover:text-brand-700">{now[t]}</span>
                    <span className="text-right"><Delta d={now[t] - prev[t]} digits={0} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Categories against appetite" tip="Average residual score per category, against the residual the category tolerates. Click a category to list its risks.">
            <ul className="space-y-1">
              {cats.map(c => {
                const cr = rs.filter(r => r.risk.category === c);
                const a = avg(cr.map(r => r.score));
                const out = cr.filter(r => r.outsideAppetite).length;
                return (
                  <li key={c}>
                    <button onClick={() => nav.showList({ category: c, process: scope ?? undefined })} className="w-full flex items-center gap-3 py-1.5 cursor-pointer group text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.8125rem] font-medium text-ink-900 group-hover:text-brand-700">{c}</span>
                        <span className="block text-[0.6875rem] text-ink-500">{APPETITE[c].level} appetite · up to {APPETITE[c].max} · {cr.length} risk{cr.length === 1 ? '' : 's'}</span>
                      </span>
                      {out > 0 && <span className="text-[0.6875rem] font-semibold text-risk-700 whitespace-nowrap">{out} outside</span>}
                      <HeatCell v={a} title={`Average residual ${a.toFixed(1)}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      {/* One level down */}
      <Panel
        title={scope ? 'Sub-processes' : 'Processes'}
        tip="Average residual score by category. Click a row to go one level down, or a cell to list those risks."
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
                <th className="text-left font-semibold px-5 py-2.5">{scope ? 'Sub-process' : 'Process'}</th>
                <th className="text-right font-semibold px-3 py-2.5">Risks</th>
                <th className="text-left font-semibold px-3 py-2.5 w-[14rem]">Rating mix</th>
                <th className="text-right font-semibold px-3 py-2.5">Critical</th>
                <th className="text-right font-semibold px-3 py-2.5">Very High</th>
                <th className="text-right font-semibold px-3 py-2.5">Avg score</th>
                {cats.map(c => <th key={c} className="text-center font-semibold px-1.5 py-2.5">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {down.sort((a, b) => avg(b.rs.map(r => r.score)) - avg(a.rs.map(r => r.score))).map(row => {
                const counts = tierCounts(row.rs);
                const pick = () => (scope ? nav.showList({ process: scope, subProcess: row.key }) : setScope(row.key as ProcessCode));
                return (
                  <tr key={row.key} className="border-t border-canvas-border hover:bg-paper-50/60">
                    <td className="px-5 py-2.5">
                      <button onClick={pick} className="font-semibold text-ink-900 hover:text-brand-700 cursor-pointer text-left">{row.label}</button>
                      {!scope && <span className="ml-2 font-mono text-[0.6875rem] text-ink-400">{row.key}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.rs.length}</td>
                    <td className="px-3 py-2.5"><MixBar counts={counts} total={row.rs.length} /></td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{counts.Critical || <span className="text-ink-300">0</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{counts['Very High'] || <span className="text-ink-300">0</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{avg(row.rs.map(r => r.score)).toFixed(1)}</td>
                    {cats.map(c => {
                      const cr = row.rs.filter(r => r.risk.category === c);
                      return (
                        <td key={c} className="px-1.5 py-2 text-center">
                          <HeatCell
                            v={cr.length ? avg(cr.map(r => r.score)) : null}
                            title={cr.length ? `${row.label} · ${c}: ${cr.map(r => r.risk.id).join(', ')}` : undefined}
                            onClick={cr.length ? () => nav.showList({ process: scope ?? (row.key as string), subProcess: scope ? row.key : undefined, category: c as RiskCategory }) : undefined}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* What moved + control gaps */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title={`Rating moved since ${MONTHS[NOW - 1]}`} tip="Risks whose rating changed this month, with what moved it" flush>
          {moved.length === 0 ? <p className="px-5 py-6 text-[0.8125rem] text-ink-500">No rating changed this month.</p> : (
            <ul className="divide-y divide-canvas-border">
              {moved.map(r => (
                <li key={r.risk.id}>
                  <button onClick={() => nav.openRisk(r.risk.id)} className="w-full grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-5 py-3 text-left hover:bg-paper-50/60 cursor-pointer">
                    <span className="min-w-0">
                      <span className="block text-[0.8125rem] font-semibold text-ink-900 truncate">{r.risk.name}</span>
                      <span className="block text-[0.6875rem] text-ink-500"><span className="font-mono">{r.risk.id}</span> · {PROCESS_LONG[r.risk.businessProcess as ProcessCode] ?? r.risk.businessProcess}</span>
                    </span>
                    <span className="flex items-center gap-1.5 self-center">
                      <TierChip tier={r.prevTier} size="sm" />
                      <ArrowRight size={12} className="text-ink-400" aria-hidden />
                      <TierChip tier={r.tier} size="sm" />
                    </span>
                    <span className="col-span-2 text-[0.75rem] text-ink-600">{moveReason(r)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Control gaps" tip="Risks with no key control operating effectively — usually a standard control still waiting for your data, or no control at all" flush>
          {gaps.length === 0 ? <p className="px-5 py-6 text-[0.8125rem] text-ink-500">Every risk has a key control operating.</p> : (
            <ul className="divide-y divide-canvas-border">
              {gaps.map(r => {
                const waiting = r.controls.filter(c => c.effect?.status === 'needs-data').length;
                const drafts = r.controls.filter(c => c.effect?.status === 'draft').length;
                return (
                  <li key={r.risk.id}>
                    <button onClick={() => nav.openRisk(r.risk.id)} className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-paper-50/60 cursor-pointer">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.8125rem] font-semibold text-ink-900 truncate">{r.risk.name}</span>
                        <span className="block text-[0.75rem] text-ink-600">
                          {r.controls.length === 0
                            ? 'No control mapped'
                            : [waiting && `${waiting} standard control${waiting === 1 ? '' : 's'} waiting for your data`, drafts && `${drafts} in draft`].filter(Boolean).join(' · ') || 'Controls not operating effectively'}
                        </span>
                      </span>
                      <span className="font-mono text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{r.score.toFixed(1)}</span>
                      <TierChip tier={r.tier} size="sm" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {footer?.(rs)}
    </div>
  );
}

function Legend({ scope }: { scope: boolean }) {
  return scope ? (
    <span className="flex items-center gap-2.5 text-[0.6875rem] text-ink-500">
      {TIERS_DESC.map(t => <span key={t} className="inline-flex items-center gap-1"><i className="size-2.5 rounded-sm" style={{ background: TIER_FILL[t][0] }} />{t}</span>)}
    </span>
  ) : (
    <span className="flex items-center gap-2 text-[0.6875rem] text-ink-500">
      {[15, 30, 45, 60].map(v => <span key={v} className="inline-flex items-center gap-1"><i className="size-2.5 rounded-sm" style={{ background: heatFill(v)[0] }} />{v}</span>)}
      <span>avg residual</span>
    </span>
  );
}
