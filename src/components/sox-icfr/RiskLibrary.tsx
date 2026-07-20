import { useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronRight, MousePointerClick, MoveRight, Search, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useIcfr } from './store';
import { controlConclusion } from './helpers';
import { Pill, type Tone } from '../shared/StatusBadge';
import { FilterSelect, POP_ANIM, triggerCls } from '../shared/FilterSelect';
import DatePicker from '../shared/DatePicker';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Engagement period bounds, ISO-keyed for date-input comparison. */
interface PeriodBounds { from: string; to: string; start: Date; days: number }

const monthIndex = (s: string) => MONTHS.findIndex(x => x.toLowerCase() === s.slice(0, 3).toLowerCase());

/** Parses the engagement's period dates — either 'DD Mon YYYY' ('01 Apr 2025') or the
 *  engagement-list 'Mon YYYY' ('Apr 2025'), which snaps to the first/last day of the month. */
function parsePeriodDate(s: string, edge: 'start' | 'end'): Date | null {
  const t = s.trim();
  let m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/.exec(t);
  if (m) {
    const mon = monthIndex(m[2]!);
    return mon < 0 ? null : new Date(Number(m[3]), mon, Number(m[1]));
  }
  m = /^([A-Za-z]{3,})\.?\s+(\d{4})$/.exec(t);
  if (!m) return null;
  const mon = monthIndex(m[1]!);
  if (mon < 0) return null;
  return edge === 'start' ? new Date(Number(m[2]), mon, 1) : new Date(Number(m[2]), mon + 1, 0);
}

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function fmtISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

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
  identified: string | null;    // ISO date the risk entered the register (within the engagement period)
}

function hash(s: string): number { let h = 0; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0; return h; }

function buildRisks(controls: Control[], period: PeriodBounds | null): RiskRow[] {
  const map = new Map<string, Control[]>();
  for (const c of controls) { if (!map.has(c.riskId)) map.set(c.riskId, []); map.get(c.riskId)!.push(c); }
  return Array.from(map, ([id, cs]) => {
    const first = cs[0]!;
    const h = hash(id + first.process);
    // identified — deterministic from the risk id, spread across the engagement period
    const identified = period
      ? toISO(new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate() + ((h >>> 8) % period.days)))
      : null;
    // inherent — deterministic from the risk id, spread across the full 1–5 board;
    // key-control risks never rate below Moderate impact
    const l = 1 + (h % 5);                     // 1–5
    let i = 1 + ((h >>> 4) % 5);               // 1–5
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
    return { id, description: first.riskDescription, process: first.process, subProcess: first.subProcess, owner: first.owner, controls: cs, l, i, rl, ri, status, identified };
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

/** Date-range filter bounded to the engagement period — themed trigger + popover
 *  with the shared DatePicker calendars (native date inputs can't be themed). */
function DateRangeFilter({ bounds, from, to, active, onApply }: {
  bounds: PeriodBounds; from: string; to: string; active: boolean; onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dFrom, setDFrom] = useState(from);
  const [dTo, setDTo] = useState(to);
  const reduce = useReducedMotion();
  const openMenu = () => { setDFrom(from); setDTo(to); setOpen(true); };
  const canApply = dFrom !== '' && dTo !== '' && dFrom <= dTo;
  return (
    <div className="relative">
      <button onClick={() => open ? setOpen(false) : openMenu()} className={triggerCls(active, open)} aria-label="Filter by date identified" aria-expanded={open}
        title="Risks identified in this window — defaults to the full engagement period">
        <CalendarRange size={13} className={active ? 'text-brand-600' : 'text-ink-400'} />
        <span className="tabular-nums">{fmtISO(from)} – {fmtISO(to)}</span>
        <ChevronDown size={14} className={cn('transition-transform', open ? 'rotate-180 text-brand-600' : 'text-ink-400')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div {...(reduce ? {} : POP_ANIM)} transition={{ duration: reduce ? 0 : 0.14, ease: [0.2, 0, 0, 1] }}
              className="absolute right-0 top-full mt-1 origin-top-right z-20 w-[300px] bg-canvas-elevated border border-canvas-border rounded-lg p-3 shadow-lg">
              <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-500 mb-2">Identified between</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[0.75rem] font-medium text-ink-500 mb-1">From</label>
                  <DatePicker value={dFrom} min={bounds.from} max={dTo || bounds.to} today={bounds.start}
                    onChange={e => setDFrom(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-900 focus:outline-none focus:border-brand-600 transition-colors" />
                </div>
                <div>
                  <label className="block text-[0.75rem] font-medium text-ink-500 mb-1">To</label>
                  <DatePicker value={dTo} min={dFrom || bounds.from} max={bounds.to} today={bounds.start}
                    onChange={e => setDTo(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-900 focus:outline-none focus:border-brand-600 transition-colors" />
                </div>
              </div>
              <p className="text-[10.5px] text-ink-400 mt-2">Engagement period {fmtISO(bounds.from)} – {fmtISO(bounds.to)}</p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => { if (canApply) { onApply(dFrom, dTo); setOpen(false); } }} disabled={!canApply}
                  className="flex-1 h-8 rounded-md bg-brand-600 hover:bg-brand-500 disabled:bg-paper-200 disabled:text-ink-400 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold transition-colors cursor-pointer">
                  Apply range
                </button>
                {active && (
                  <button onClick={() => { onApply(bounds.from, bounds.to); setOpen(false); }}
                    className="h-8 px-3 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-700 hover:bg-canvas transition-colors cursor-pointer">
                    Reset
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
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
      {/* grid row — impact axis title · impact tick labels · the 5×5 cells */}
      <div className="flex gap-1.5">
        {/* impact axis title — rotated, centred on the grid */}
        <div className="flex items-center justify-center shrink-0 w-4">
          <span className="text-[9px] font-bold uppercase tracking-wider text-ink-500 -rotate-90 whitespace-nowrap">Impact</span>
        </div>
        {/* impact tick labels — severe (top) → minimal (bottom) */}
        <div className="flex flex-col gap-1 pr-1 text-right shrink-0 w-[64px]">
          {[...I_LABELS].reverse().map(lb => <span key={lb} className="h-11 flex items-center justify-end text-[9.5px] font-semibold text-ink-400 leading-tight">{lb}</span>)}
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-5 gap-1">
          {[5, 4, 3, 2, 1].map(i => [1, 2, 3, 4, 5].map(l => {
            const rs = at(l, i);
            const b = band(l * i);
            const active = sel?.kind === kind && sel.l === l && sel.i === i;
            return (
              <button key={`${l}-${i}`}
                onClick={() => onSelect(active ? null : { kind, l, i })}
                title={`${I_LABELS[i - 1]} impact · ${L_LABELS[l - 1]?.toLowerCase()} — ${rs.length} risk${rs.length === 1 ? '' : 's'}`}
                className={cn('h-11 rounded-lg flex items-center justify-center transition-all cursor-pointer hover:brightness-95', active && 'ring-2 ring-ink-900 ring-offset-1')}
                style={{ background: `color-mix(in srgb, ${b.color} ${rs.length > 0 ? 82 : 16}%, ${rs.length > 0 ? 'transparent' : 'var(--color-canvas-elevated)'})` }}>
                {rs.length > 0 && <span className="text-[13px] font-bold text-white tabular-nums drop-shadow-sm">{rs.length}</span>}
              </button>
            );
          }))}
        </div>
      </div>
      {/* likelihood tick labels + axis title — aligned under the grid via matching spacers */}
      <div className="flex gap-1.5">
        <div className="shrink-0 w-4" aria-hidden />
        <div className="shrink-0 w-[64px]" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-5 gap-1 mt-1">
            {L_LABELS.map(lb => <span key={lb} className="text-center text-[9.5px] font-semibold text-ink-400 leading-tight">{lb}</span>)}
          </div>
          <div className="text-center text-[9px] font-bold uppercase tracking-wider text-ink-500 mt-1.5">Likelihood</div>
        </div>
      </div>
    </div>
  );
}

export default function RiskLibrary() {
  const { eng, openControl } = useIcfr();
  const [q, setQ] = useState('');
  const [process, setProcess] = useState('All');
  const [status, setStatus] = useState<'All' | RiskStatus>('All');
  const [cell, setCell] = useState<CellSel>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const bounds = useMemo<PeriodBounds | null>(() => {
    const s = parsePeriodDate(eng.periodStart, 'start'), e = parsePeriodDate(eng.periodEnd, 'end');
    if (!s || !e || e <= s) return null;
    return { from: toISO(s), to: toISO(e), start: s, days: Math.round((e.getTime() - s.getTime()) / 86400000) + 1 };
  }, [eng.periodStart, eng.periodEnd]);
  const [from, setFrom] = useState(bounds?.from ?? '');
  const [to, setTo] = useState(bounds?.to ?? '');
  const dateActive = !!bounds && (from !== bounds.from || to !== bounds.to);
  const resetDates = () => { setFrom(bounds?.from ?? ''); setTo(bounds?.to ?? ''); };

  const risks = useMemo(() => buildRisks(eng.controls, bounds), [eng.controls, bounds]);
  const processes = useMemo(() => ['All', ...Array.from(new Set(risks.map(r => r.process)))], [risks]);

  // global filters — scope the heatmaps AND the register
  const scoped = useMemo(() => {
    const term = q.trim().toLowerCase();
    return risks.filter(r => {
      if (process !== 'All' && r.process !== process) return false;
      if (status !== 'All' && r.status !== status) return false;
      if (dateActive && r.identified) {
        if (from && r.identified < from) return false;
        if (to && r.identified > to) return false;
      }
      if (term && !(`${r.id} ${r.description} ${r.process} ${r.subProcess} ${r.owner}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [risks, q, process, status, dateActive, from, to]);

  // heatmap cell selection — narrows the register only
  const filtered = useMemo(() => scoped.filter(r => {
    if (!cell) return true;
    return cell.kind === 'inherent' ? r.l === cell.l && r.i === cell.i : r.rl === cell.l && r.ri === cell.i;
  }), [scoped, cell]);

  return (
    <div>
      {/* toolbar — filters here scope everything below: both heatmaps and the register */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {cell && (
          <button onClick={() => setCell(null)} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-ink-900 text-white text-[12px] font-semibold cursor-pointer">
            {cell.kind === 'inherent' ? 'Inherent' : 'Residual'} · {L_LABELS[cell.l - 1]} × {I_LABELS[cell.i - 1]} <X size={13} />
          </button>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search risks, owners…" className="h-9 w-64 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="flex-1" />
        <span className="text-[11.5px] text-ink-400">Showing {filtered.length} of {risks.length} risks</span>
        <FilterSelect value={process} options={processes} allLabel="All processes" onChange={setProcess} ariaLabel="Filter by process" align="right" />
        <FilterSelect value={status} options={['All', 'Exception', 'In testing', 'Mitigated', 'Untested']} allLabel="All statuses" onChange={v => setStatus(v as 'All' | RiskStatus)} ariaLabel="Filter by status" align="right" />
        {bounds && (
          <DateRangeFilter bounds={bounds} from={from} to={to} active={dateActive} onApply={(f, t) => { setFrom(f); setTo(t); }} />
        )}
      </div>

      {/* heatmaps — inherent vs residual, both scoped by the filters above */}
      <div className="grid lg:grid-cols-2 gap-4 mb-2">
        <Heatmap title="Inherent risk" subtitle="before controls" risks={scoped} kind="inherent" sel={cell} onSelect={setCell} />
        <Heatmap title="Residual risk" subtitle="after control testing" risks={scoped} kind="residual" sel={cell} onSelect={setCell} />
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-ink-400 mb-4">
        <MousePointerClick size={12} className="text-ink-400" aria-hidden /> Click any cell to filter the register below.
      </p>

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
              <th style={{ width: 118 }}>Controls</th>
              <th style={{ width: 104 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const open = expanded === r.id;
              const moved = r.rl !== r.l || r.ri !== r.i;
              const effective = r.controls.filter(c => controlConclusion(c) === 'Effective').length;
              return (
                <FragmentGroup key={r.id}>
                  <tr className="reg-row" onClick={() => setExpanded(open ? null : r.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setExpanded(open ? null : r.id); }} role="button" aria-label={`${open ? 'Collapse' : 'Expand'} ${r.id}`}>
                    <td>{open ? <ChevronDown size={14} className="text-ink-400" /> : <ChevronRight size={14} className="text-ink-400" />}</td>
                    <td><span className="wp-ref">{r.id}</span></td>
                    <td className="tight">
                      <span title={r.description} className="font-semibold text-ink-900 text-[12.5px] leading-snug line-clamp-2">{r.description}</span>
                      <span className="block text-[11px] text-ink-400 mt-0.5">{r.subProcess} · {r.owner}{r.identified && <> · Identified {fmtISO(r.identified)}</>}</span>
                    </td>
                    <td><span className="text-[11.5px] text-ink-600 font-medium">{r.process}</span></td>
                    <td><ScoreBadge l={r.l} i={r.i} /></td>
                    <td>
                      <span className="inline-flex flex-col items-start gap-1">
                        <ScoreBadge l={r.rl} i={r.ri} />
                        {moved && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-compliant-600 whitespace-nowrap" title="Residual risk reduced by effective controls">
                            <MoveRight size={10} className="rotate-90" aria-hidden /> reduced by controls
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-600 font-medium whitespace-nowrap" title={`${effective} of ${r.controls.length} controls tested effective`}>
                        <ShieldCheck size={12} className="text-ink-400" /> {effective}/{r.controls.length} <span className="text-[10px] text-ink-400 font-normal">effective</span>
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
                No risks match these filters. <button onClick={() => { setQ(''); setProcess('All'); setStatus('All'); setCell(null); resetDates(); }} className="text-brand-700 font-semibold hover:underline">Clear filters</button>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) { return <>{children}</>; }
