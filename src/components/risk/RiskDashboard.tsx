/**
 * Risk Dashboard — the enterprise view of the register, in the shape of an
 * offsite risk assessment's risk overview: the rating each tier sets in
 * motion, how the mix and the score moved month by month, where the risk sits,
 * what moved and why, the risks at the top, the actions against them, and
 * where indicators cluster into a thematic review.
 *
 * The register holds the records; this page reads them. Every number opens
 * the risks behind it in the Risk Register.
 */
import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowRight, Check, Printer } from 'lucide-react';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { PROCESS_LONG, type FileSourceChoice } from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { AS_OF, MONTHS, NOW, TIERS, TIERS_DESC, TIER_ACTION, ragOf, type Tier } from '../../data/erm/model';
import type { RiskRating } from '../../data/erm/score';
import { toggleAction, useRiskRatings } from '../../data/erm/store';
import AdaptDataModal from '../audit-plan/AdaptDataModal';
import RiskOverview from './RiskOverview';
import { Delta, HeatCell, Panel, Spark, TierChip } from './riskUi';
import { TIER_FILL } from './riskTheme';
import type { RiskNav } from './RiskRegisterPage';
import type { ListFilter } from './RiskList';

/** Hand-offs into the Risk Register (it reads these on mount). */
export const REGISTER_FILTER_KEY = 'risk-register.list-filter';
export const REGISTER_TAB_KEY = 'risk-register.tab';
const OPEN_RISK_KEY = 'risk-register.open-risk';

const PROCESSES: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];
const DAY = 86_400_000;
const TODAY = new Date('2026-10-15T00:00:00');
const parseDue = (d: string) => { const t = Date.parse(d); return Number.isFinite(t) ? t : Infinity; };

export default function RiskDashboard({ onNavigate, onAdapt }: {
  onNavigate: (view: string) => void;
  onAdapt?: (keys: string[], choices: Record<string, FileSourceChoice | null>) => void;
}) {
  const { ratings } = useRiskRatings();
  const [adaptKeys, setAdaptKeys] = useState<string[] | null>(null);

  const toRegister = (opts: { risk?: string; filter?: ListFilter; tab?: string }) => {
    try {
      if (opts.risk) window.sessionStorage.setItem(OPEN_RISK_KEY, opts.risk);
      if (opts.filter) window.sessionStorage.setItem(REGISTER_FILTER_KEY, JSON.stringify(opts.filter));
      if (opts.tab) window.sessionStorage.setItem(REGISTER_TAB_KEY, opts.tab);
    } catch { /* ignore */ }
    onNavigate('audit-risk-register');
  };
  const nav: RiskNav = {
    openRisk: id => toRegister({ risk: id }),
    openControl: rowId => {
      try { window.sessionStorage.setItem('control-library.open-control-id', rowId); } catch { /* ignore */ }
      onNavigate('governance-controls');
    },
    showList: f => toRegister({ filter: f }),
    goTo: onNavigate,
    adapt: keys => setAdaptKeys(keys),
    linkControls: id => toRegister({ risk: id }),
  };

  const hiNow = ratings.filter(r => ['Critical', 'Very High', 'High'].includes(r.tier)).length;

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="max-w-[96rem] mx-auto px-8 pt-7 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">Risk and controls</div>
            <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight text-ink-900 leading-tight">Risk Dashboard</h1>
            <p className="mt-1 text-[0.8125rem] text-ink-500">
              {ratings.length} risks across {new Set(ratings.map(r => r.risk.businessProcess)).size} processes · {hiNow} rated High or above
              <span className="text-ink-400"> · assessed {AS_OF} · {MONTHS[0]}–{MONTHS[NOW]} trend</span>
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" leftIcon={<Printer size={14} />} onClick={() => window.print()}>Print</Button>
            <Button variant="primary" rightIcon={<ArrowRight size={14} />} onClick={() => onNavigate('audit-risk-register')}>Open the register</Button>
          </div>
        </div>

        <RiskOverview
          ratings={ratings}
          nav={nav}
          afterKpis={rs => (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <MixByMonth ratings={rs} />
              <ScoreTrend ratings={rs} />
            </div>
          )}
          footer={rs => (
            <div className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-5">
                <TopRisks ratings={rs} nav={nav} />
                <ActionPlans ratings={rs} nav={nav} />
              </div>
              <Thematic ratings={rs} nav={nav} />
              <BreachMatrix ratings={rs} onOpen={() => toRegister({ tab: 'indicators' })} />
            </div>
          )}
        />
      </div>

      <AnimatePresence>
        {adaptKeys && onAdapt && (
          <AdaptDataModal keys={adaptKeys} onClose={() => setAdaptKeys(null)} onContinue={c => { const k = adaptKeys; setAdaptKeys(null); onAdapt(k, c); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Tier mix by month — stacked columns, highest tier on top. */
function MixByMonth({ ratings }: { ratings: RiskRating[] }) {
  const W = 560, H = 210, padL = 28, padB = 24, padT = 22;
  const n = Math.max(1, ratings.length);
  const colW = (W - padL - 16) / MONTHS.length;
  const h = H - padT - padB;
  const counts = MONTHS.map((_, m) => Object.fromEntries(TIERS.map(t => [t, ratings.filter(r => r.tierHistory[m] === t).length])) as Record<Tier, number>);
  return (
    <Panel title="Rating mix by month" tip="How many risks sat in each rating, month by month. The number above each column is High or above.">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Rating mix by month">
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={padL} x2={W - 8} y1={padT + h - f * h} y2={padT + h - f * h} stroke="#EFEBF3" />
            <text x={padL - 6} y={padT + h - f * h + 3} fontSize="10" fill="#9A8FAE" textAnchor="end">{Math.round(f * n)}</text>
          </g>
        ))}
        {counts.map((c, m) => {
          let y = padT + h;
          const x = padL + m * colW + colW * 0.2;
          const w = colW * 0.6;
          const hi = c.Critical + c['Very High'] + c.High;
          return (
            <g key={m}>
              {TIERS.map(t => {
                const bh = (c[t] / n) * h;
                y -= bh;
                return bh > 0 ? <rect key={t} x={x} y={y} width={w} height={bh} fill={TIER_FILL[t][0]} rx={1.5}><title>{`${MONTHS[m]} · ${t}: ${c[t]}`}</title></rect> : null;
              })}
              <text x={x + w / 2} y={y - 5} fontSize="10" fontWeight="600" fill="#1F1433" textAnchor="middle">{hi}</text>
              <text x={x + w / 2} y={H - 6} fontSize="10" fill="#9A8FAE" textAnchor="middle">{MONTHS[m]}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[0.6875rem] text-ink-500">
        {TIERS_DESC.map(t => <span key={t} className="inline-flex items-center gap-1"><i className="size-2.5 rounded-sm" style={{ background: TIER_FILL[t][0] }} />{t}</span>)}
      </div>
    </Panel>
  );
}

/** Average residual score, with the spread of the top and bottom quarter. */
function ScoreTrend({ ratings }: { ratings: RiskRating[] }) {
  const W = 560, H = 210, padL = 30, padR = 16, padT = 18, padB = 24;
  const w = W - padL - padR, h = H - padT - padB;
  const per = MONTHS.map((_, m) => ratings.map(r => r.history[m]).sort((a, b) => a - b));
  const avg = per.map(xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0));
  const q = (xs: number[], f: number) => xs[Math.min(xs.length - 1, Math.max(0, Math.round(f * (xs.length - 1))))] ?? 0;
  const lo = per.map(xs => q(xs, 0.25)), hi = per.map(xs => q(xs, 0.75));
  const top = Math.max(60, Math.ceil(Math.max(...hi, ...avg) / 15) * 15);
  const x = (i: number) => padL + (i / (MONTHS.length - 1)) * w;
  const y = (v: number) => padT + h - (v / top) * h;
  const band = [...hi.map((v, i) => `${x(i)},${y(v)}`), ...lo.map((v, i) => `${x(i)},${y(v)}`).reverse()].join(' ');
  const d = avg[NOW] - avg[0];
  return (
    <Panel
      title="Enterprise residual score"
      tip="Average residual score across the risks in scope; the band is the middle half of the register."
      right={<span className="text-[0.75rem] text-ink-500 tabular-nums">{avg[NOW].toFixed(1)} now · <Delta d={d} /> since {MONTHS[0]}</span>}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Average residual score by month">
        {[0, 15, 30, 45, 60].filter(v => v <= top).map(v => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#EFEBF3" />
            <text x={padL - 6} y={y(v) + 3} fontSize="10" fill="#9A8FAE" textAnchor="end">{v}</text>
          </g>
        ))}
        <polygon points={band} fill="#E4D4FB" opacity={0.7} />
        <polyline points={avg.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#3B0764" strokeWidth={2} />
        {avg.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={3.5} fill="#FFFFFF" stroke="#3B0764" strokeWidth={1.5} />
            <text x={x(i)} y={y(v) - 8} fontSize="10" fontWeight="600" fill="#1F1433" textAnchor="middle">{v.toFixed(1)}</text>
            <text x={x(i)} y={H - 6} fontSize="10" fill="#9A8FAE" textAnchor="middle">{MONTHS[i]}</text>
          </g>
        ))}
      </svg>
    </Panel>
  );
}

function TopRisks({ ratings, nav }: { ratings: RiskRating[]; nav: RiskNav }) {
  const top = [...ratings].sort((a, b) => b.score - a.score).slice(0, 6);
  return (
    <Panel title="Top risks" tip="The highest residual scores, with what each rating sets in motion" right={<button onClick={() => nav.showList({})} className="text-[0.75rem] text-brand-700 hover:underline cursor-pointer">All risks</button>} flush>
      <ol className="divide-y divide-canvas-border">
        {top.map((r, i) => (
          <li key={r.risk.id}>
            <button onClick={() => nav.openRisk(r.risk.id)} className="w-full grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_4.5rem_6.5rem] items-center gap-3 px-5 py-3 text-left hover:bg-paper-50/60 cursor-pointer">
              <span className="font-mono text-[0.75rem] text-ink-300">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-semibold text-ink-900 truncate">{r.risk.name}</span>
                <span className="block text-[0.6875rem] text-ink-500 truncate"><span className="font-mono">{r.risk.id}</span> · {PROCESS_LONG[r.risk.businessProcess as ProcessCode] ?? r.risk.businessProcess} · {TIER_ACTION[r.tier]}</span>
              </span>
              <Spark values={r.history} width={64} height={18} color={r.delta > 0 ? '#B42318' : '#3B0764'} />
              <span className="text-right">
                <span className="block font-mono text-[0.875rem] font-semibold text-ink-900 tabular-nums">{r.score.toFixed(1)}</span>
                <Delta d={r.delta} />
              </span>
              <span className="text-right"><TierChip tier={r.tier} size="sm" /></span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function ActionPlans({ ratings, nav }: { ratings: RiskRating[]; nav: RiskNav }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const all = ratings.flatMap(r => r.risk.actions.map(a => ({ r, a })));
  const open = all.filter(x => !x.a.done).sort((a, b) => parseDue(a.a.due) - parseDue(b.a.due));
  const overdue = open.filter(x => parseDue(x.a.due) < TODAY.getTime());
  const dueSoon = open.filter(x => { const t = parseDue(x.a.due); return t >= TODAY.getTime() && t - TODAY.getTime() <= 14 * DAY; });
  const done = all.filter(x => x.a.done).length;
  return (
    <Panel title="Action plans" tip="Actions agreed against the risks in scope, earliest due first. Tick one off here.">
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[['Open', open.length, 'text-ink-900'], ['Overdue', overdue.length, overdue.length ? 'text-risk-700' : 'text-ink-900'], ['Due in 14 days', dueSoon.length, 'text-ink-900'], ['Done', done, 'text-compliant-700']].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg border border-canvas-border px-3 py-2">
            <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400">{l}</div>
            <div className={`font-mono text-[1.125rem] font-semibold tabular-nums ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      {open.length === 0 ? <p className="text-[0.8125rem] text-ink-500">No open action.</p> : (
        <ul className="space-y-2">
          {open.slice(0, 6).map(({ r, a }) => {
            const late = parseDue(a.due) < TODAY.getTime();
            return (
              <li key={a.id} className="flex items-start gap-3">
                <button
                  role="checkbox"
                  aria-checked={false}
                  aria-label={`Mark ${a.title} done`}
                  onClick={() => {
                    toggleAction(r.risk.id, a.id);
                    addToast({ message: 'Action marked done', type: 'success' });
                    logEvent({ action: 'Update', description: `Completed action "${a.title}" on ${r.risk.id}`, module: 'Risk Register', entity: 'Action' });
                  }}
                  className="mt-0.5 size-4 rounded border border-ink-300 hover:border-brand-600 flex items-center justify-center cursor-pointer shrink-0 group"
                ><Check size={10} strokeWidth={3} className="text-brand-600 opacity-0 group-hover:opacity-60" /></button>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] text-ink-900">{a.title}</span>
                  <button onClick={() => nav.openRisk(r.risk.id)} className="text-[0.6875rem] text-ink-500 hover:text-brand-700 cursor-pointer"><span className="font-mono">{r.risk.id}</span> · {a.owner}</button>
                </span>
                <span className={`text-[0.75rem] tabular-nums whitespace-nowrap ${late ? 'font-semibold text-risk-700' : 'text-ink-500'}`}>{late ? 'Overdue · ' : ''}{a.due}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Where indicators cluster — candidates for a thematic review. */
function Thematic({ ratings, nav }: { ratings: RiskRating[]; nav: RiskNav }) {
  const all = ratings.flatMap(r => r.kris.map(k => ({ r, k })));
  const spots = PROCESSES.map(p => {
    const ks = all.filter(x => x.r.risk.businessProcess === p);
    const breaching = ks.filter(x => x.k.rag > 0);
    return { p, total: ks.length, breaching, red: breaching.filter(x => x.k.rag === 2).length, share: ks.length ? breaching.length / ks.length : 0 };
  }).filter(h => h.total > 0 && h.breaching.length >= 2).sort((a, b) => b.share - a.share || b.red - a.red).slice(0, 3);
  if (spots.length === 0) return null;
  return (
    <Panel title="Thematic review candidates" tip="Processes where most indicators are amber or red. The same problem across several risks points to the process — review it once, as a theme.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {spots.map(h => (
          <div key={h.p} className="rounded-xl border border-canvas-border bg-canvas p-4 flex flex-col">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[0.875rem] font-semibold text-ink-900">{PROCESS_LONG[h.p]}</span>
              <span className="font-mono text-[0.6875rem] text-ink-400">{h.p}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-[1.5rem] font-semibold text-ink-900 tabular-nums leading-none">{h.breaching.length}</span>
              <span className="text-[0.75rem] text-ink-500">of {h.total} indicators breaching · {h.red} red</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-paper-100 overflow-hidden"><div className="h-full rounded-full bg-brand-600" style={{ width: `${h.share * 100}%` }} /></div>
            <ul className="mt-3 space-y-1 text-[0.75rem] text-ink-600 flex-1">
              {h.breaching.slice(0, 3).map(x => (
                <li key={x.k.kri.id} className="truncate"><span className={x.k.rag === 2 ? 'text-risk-700' : 'text-mitigated-700'}>●</span> {x.k.kri.name}</li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="secondary" size="sm" rightIcon={<ArrowRight size={12} />} onClick={() => nav.goTo('audit-with-ai')}>Plan a thematic review</Button>
              <button onClick={() => nav.showList({ process: h.p })} className="text-[0.75rem] text-brand-700 hover:underline cursor-pointer">Its risks</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Red indicators by process and month — where breaches build up. */
function BreachMatrix({ ratings, onOpen }: { ratings: RiskRating[]; onOpen: () => void }) {
  const procs = PROCESSES.filter(p => ratings.some(r => r.risk.businessProcess === p));
  const cell = (p: ProcessCode, m: number) => {
    const ks = ratings.filter(r => r.risk.businessProcess === p).flatMap(r => r.risk.kris);
    const reds = ks.filter(k => ragOf(k, k.values[m]) === 2).length;
    const ambers = ks.filter(k => ragOf(k, k.values[m]) === 1).length;
    return { reds, ambers, total: ks.length };
  };
  return (
    <Panel title="Indicators in the red, by process and month" tip="Count of indicators past their red threshold. Click to see every indicator." right={<button onClick={onOpen} className="text-[0.75rem] text-brand-700 hover:underline cursor-pointer">All indicators</button>} flush>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
              <th className="text-left font-semibold px-5 py-2.5">Process</th>
              {MONTHS.map(m => <th key={m} className="text-center font-semibold px-1 py-2.5">{m}</th>)}
              <th className="text-right font-semibold px-5 py-2.5">Now</th>
            </tr>
          </thead>
          <tbody>
            {procs.map(p => {
              const now = cell(p, NOW);
              return (
                <tr key={p} className="border-t border-canvas-border">
                  <td className="px-5 py-2"><span className="font-semibold text-ink-900">{PROCESS_LONG[p]}</span> <span className="font-mono text-[0.6875rem] text-ink-400">{p}</span></td>
                  {MONTHS.map((m, i) => {
                    const c = cell(p, i);
                    return (
                      <td key={m} className="px-1 py-1.5 text-center">
                        <HeatCell v={c.total ? (c.reds / c.total) * 100 : 0} display={String(c.reds)} title={`${PROCESS_LONG[p]} · ${m}: ${c.reds} red, ${c.ambers} amber of ${c.total}`} onClick={onOpen} />
                      </td>
                    );
                  })}
                  <td className="px-5 py-2 text-right text-[0.75rem] text-ink-600 tabular-nums whitespace-nowrap"><span className="font-semibold text-risk-700">{now.reds} red</span> · {now.ambers} amber</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
