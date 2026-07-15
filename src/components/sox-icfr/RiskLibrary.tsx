import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListFilter, MoveRight, Search, ShieldCheck, X } from 'lucide-react';
import { useIcfr } from './store';
import { controlConclusion } from './helpers';
import { Pill, type Tone } from '../shared/StatusBadge';
import { Tickmark } from './parts';
import { cn } from '../../lib/cn';
import type { Control } from './types';

/**
 * Risk Library — the engagement's risk register with inherent / residual
 * heatmaps. Risks are derived from the RACM (one row per risk id); residual
 * scores move with control test results, so the two heatmaps show how far
 * testing has actually pulled exposure down. Clicking a heatmap cell filters
 * the register beneath it.
 */

const L_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
const I_LABELS = ['Minimal', 'Minor', 'Moderate', 'Major', 'Severe'];

type RiskStatus = 'Exception' | 'Mitigated' | 'In testing' | 'Untested';
const STATUS_TONE: Record<RiskStatus, Tone> = { Exception: 'risk', Mitigated: 'compliant', 'In testing': 'evidence', Untested: 'draft' };

interface RiskRow {
  id: string;
  description: string;
  process: string;
  subProcess: string;
  owner: string;
  controls: Control[];
  l: number; i: number;         // inherent likelihood / impact (1–5)
  rl: number; ri: number;       // residual after control testing
  status: RiskStatus;
}

function hash(s: string): number { let h = 0; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0; return h; }

function buildRisks(controls: Control[]): RiskRow[] {
  const map = new Map<string, Control[]>();
  for (const c of controls) { if (!map.has(c.riskId)) map.set(c.riskId, []); map.get(c.riskId)!.push(c); }
  return Array.from(map, ([id, cs]) => {
    const first = cs[0]!;
    const h = hash(id + first.process);
    // inherent — deterministic from the risk id; key-control risks skew severe
    const l = 2 + (h % 4);                     // 2–5
    let i = 2 + ((h >>> 4) % 4);               // 2–5
    if (cs.some(c => c.isKey)) i = Math.max(i, 3);
    const concl = cs.map(controlConclusion);
    const exception = concl.includes('Ineffective');
    const allEffective = cs.length > 0 && concl.every(x => x === 'Effective');
    const anyTested = concl.some(x => x !== 'Not started');
    // residual — effective controls pull likelihood (and a little impact) down;
    // an exception leaves residual at inherent until remediation is retested
    let rl = l, ri = i;
    if (!exception && allEffective) { rl = Math.max(1, l - 2); ri = Math.max(1, i - 1); }
    else if (!exception && anyTested) rl = Math.max(1, l - 1);
    const status: RiskStatus = exception ? 'Exception' : allEffective ? 'Mitigated' : anyTested ? 'In testing' : 'Untested';
    return { id, description: first.riskDescription, process: first.process, subProcess: first.subProcess, owner: first.owner, controls: cs, l, i, rl, ri, status };
  }).sort((a, b) => (b.rl * b.ri) - (a.rl * a.ri) || (b.l * b.i) - (a.l * a.i));
}

function band(score: number): { color: string; label: string } {
  if (score >= 15) return { color: 'var(--color-risk-600)', label: 'Critical' };
  if (score >= 10) return { color: 'var(--color-high-500)', label: 'High' };
  if (score >= 5) return { color: 'var(--color-mitigated-500)', label: 'Moderate' };
  return { color: 'var(--color-compliant-600)', label: 'Low' };
}

function ScoreBadge({ l, i }: { l: number; i: number }) {
  const b = band(l * i);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-6 h-6 rounded-md inline-flex items-center justify-center text-[11px] font-bold text-white tabular-nums" style={{ background: b.color }}>{l * i}</span>
      <span className="flex flex-col leading-none">
        <span className="text-[11px] font-semibold text-ink-700">{b.label}</span>
        <span className="text-[9.5px] text-ink-400 mt-0.5">L{l} × I{i}</span>
      </span>
    </span>
  );
}

type CellSel = { kind: 'inherent' | 'residual'; l: number; i: number } | null;

function Heatmap({ title, subtitle, risks, kind, sel, onSelect }: {
  title: string; subtitle: string; risks: RiskRow[]; kind: 'inherent' | 'residual';
  sel: CellSel; onSelect: (s: CellSel) => void;
}) {
  const at = (l: number, i: number) => risks.filter(r => (kind === 'inherent' ? r.l === l && r.i === i : r.rl === l && r.ri === i));
  return (
    <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-[13.5px] font-semibold text-ink-900">{title}</h3>
        <span className="text-[11px] text-ink-400">{subtitle}</span>
      </div>
      <div className="flex gap-1.5">
        {/* impact axis */}
        <div className="flex flex-col justify-between py-0.5 pr-1 text-right shrink-0 w-[64px]">
          {[...I_LABELS].reverse().map(lb => <span key={lb} className="h-11 flex items-center justify-end text-[9.5px] font-semibold text-ink-400 leading-tight">{lb}</span>)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-5 gap-1">
            {[5, 4, 3, 2, 1].map(i => [1, 2, 3, 4, 5].map(l => {
              const rs = at(l, i);
              const b = band(l * i);
              const active = sel?.kind === kind && sel.l === l && sel.i === i;
              return (
                <button key={`${l}-${i}`}
                  onClick={() => onSelect(active ? null : { kind, l, i })}
                  title={`${I_LABELS[i - 1]} impact · ${L_LABELS[l - 1]?.toLowerCase()} — ${rs.length} risk${rs.length === 1 ? '' : 's'}`}
                  className={cn('h-11 rounded-lg flex items-center justify-center transition-all cursor-pointer', active && 'ring-2 ring-ink-900 ring-offset-1')}
                  style={{ background: `color-mix(in srgb, ${b.color} ${rs.length > 0 ? 82 : 16}%, ${rs.length > 0 ? 'transparent' : 'var(--color-canvas-elevated)'})` }}>
                  {rs.length > 0 && <span className="text-[13px] font-bold text-white tabular-nums drop-shadow-sm">{rs.length}</span>}
                </button>
              );
            }))}
          </div>
          <div className="grid grid-cols-5 gap-1 mt-1">
            {L_LABELS.map(lb => <span key={lb} className="text-center text-[9.5px] font-semibold text-ink-400 leading-tight">{lb}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RiskLibrary() {
  const { eng, openControl } = useIcfr();
  const [q, setQ] = useState('');
  const [process, setProcess] = useState('All');
  const [cell, setCell] = useState<CellSel>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const risks = useMemo(() => buildRisks(eng.controls), [eng.controls]);
  const processes = useMemo(() => ['All', ...Array.from(new Set(risks.map(r => r.process)))], [risks]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return risks.filter(r => {
      if (process !== 'All' && r.process !== process) return false;
      if (cell) {
        if (cell.kind === 'inherent' && !(r.l === cell.l && r.i === cell.i)) return false;
        if (cell.kind === 'residual' && !(r.rl === cell.l && r.ri === cell.i)) return false;
      }
      if (term && !(`${r.id} ${r.description} ${r.process} ${r.subProcess} ${r.owner}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [risks, q, process, cell]);

  return (
    <div>
      {/* heatmaps — inherent vs residual */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Heatmap title="Inherent risk" subtitle="before controls" risks={risks} kind="inherent" sel={cell} onSelect={setCell} />
        <Heatmap title="Residual risk" subtitle="after control testing" risks={risks} kind="residual" sel={cell} onSelect={setCell} />
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {cell && (
          <button onClick={() => setCell(null)} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-ink-900 text-white text-[12px] font-semibold cursor-pointer">
            {cell.kind === 'inherent' ? 'Inherent' : 'Residual'} · {I_LABELS[cell.i - 1]} × {L_LABELS[cell.l - 1]} <X size={13} />
          </button>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search risks, owners…" className="h-9 w-64 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated">
          <ListFilter size={13} className="text-ink-400" />
          <select value={process} onChange={e => setProcess(e.target.value)} className="bg-transparent text-[12.5px] font-semibold text-ink-700 focus:outline-none cursor-pointer">
            {processes.map(p => <option key={p} value={p}>{p === 'All' ? 'All processes' : p}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <span className="text-[11.5px] text-ink-400">Showing {filtered.length} of {risks.length} risks</span>
      </div>

      {/* register */}
      <div className="reg-wrap">
        <table className="w-full border-collapse">
          <thead className="reg-head">
            <tr>
              <th style={{ width: 34 }} />
              <th style={{ width: 64 }}>Risk</th>
              <th>Description</th>
              <th style={{ width: 130 }}>Process</th>
              <th style={{ width: 128 }}>Inherent</th>
              <th style={{ width: 158 }}>Residual</th>
              <th style={{ width: 96 }}>Controls</th>
              <th style={{ width: 104 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const open = expanded === r.id;
              const moved = r.rl !== r.l || r.ri !== r.i;
              return (
                <FragmentGroup key={r.id}>
                  <tr className="reg-row" onClick={() => setExpanded(open ? null : r.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setExpanded(open ? null : r.id); }} role="button" aria-label={`${open ? 'Collapse' : 'Expand'} ${r.id}`}>
                    <td>{open ? <ChevronDown size={14} className="text-ink-400" /> : <ChevronRight size={14} className="text-ink-400" />}</td>
                    <td><span className="wp-ref">{r.id}</span></td>
                    <td className="tight">
                      <span className="font-semibold text-ink-900 text-[12.5px] leading-snug line-clamp-2">{r.description}</span>
                      <span className="block text-[11px] text-ink-400 mt-0.5">{r.subProcess} · {r.owner}</span>
                    </td>
                    <td><span className="text-[11.5px] text-ink-600 font-medium">{r.process}</span></td>
                    <td><ScoreBadge l={r.l} i={r.i} /></td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <ScoreBadge l={r.rl} i={r.ri} />
                        {moved && <MoveRight size={12} className="text-compliant-600 -order-1 rotate-180" aria-label="reduced by controls" />}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-600 font-medium">
                        <ShieldCheck size={12} className="text-ink-400" /> {r.controls.filter(c => controlConclusion(c) === 'Effective').length}/{r.controls.length}
                      </span>
                    </td>
                    <td><Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill></td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={8} className="!p-0">
                        <div className="bg-paper-50/50 border-b border-canvas-border px-5 py-3">
                          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400 mb-2">Mitigating controls · {r.controls.length}</div>
                          <div className="space-y-1.5">
                            {r.controls.map(c => (
                              <button key={c.id} onClick={e => { e.stopPropagation(); openControl(c.id); }}
                                className="w-full flex items-center gap-3 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-left hover:border-brand-300 transition-colors cursor-pointer">
                                <span className="wp-ref shrink-0">{c.wpRef}</span>
                                <span className="flex-1 min-w-0 text-[12px] font-medium text-ink-800 truncate">{c.description}</span>
                                <Tickmark result={controlConclusion(c) === 'Effective' ? 'Pass' : controlConclusion(c) === 'Ineffective' ? 'Fail' : 'Not tested'} size={15} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentGroup>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-16 text-ink-400 text-[13px]">
                No risks match these filters. <button onClick={() => { setQ(''); setProcess('All'); setCell(null); }} className="text-brand-700 font-semibold hover:underline">Clear filters</button>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) { return <>{children}</>; }
