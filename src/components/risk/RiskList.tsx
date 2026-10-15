/**
 * The register — every risk as an entry: its score and rating up front, what
 * the rating sets in motion, and the three things behind it (exposure,
 * controls, indicators) in one quiet line. Grouped by rating by default.
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ChevronDown, Link2, Search, X } from 'lucide-react';
import { Button } from '../shared/Button';
import ControlAccordion from './ControlAccordion';
import { PROCESS_LONG } from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { CATEGORIES, TIERS_DESC, TIER_ACTION, fmtKri, type Tier } from '../../data/erm/model';
import type { RiskRating } from '../../data/erm/score';
import type { RiskCategory } from '../../data/riskRegister';
import { ControlGlyph, Delta, RagChip, RagStrip, Spark, TierChip } from './riskUi';
import { TIER_FILL } from './riskTheme';
import type { RiskNav } from './RiskRegisterPage';

export interface ListFilter {
  /** One or more ratings (the overview's "Medium and Low" is two). */
  tiers?: Tier[];
  category?: RiskCategory;
  process?: string;
  subProcess?: string;
  outside?: boolean;
}
type Sort = 'score' | 'change' | 'inherent' | 'id';
type Group = 'tier' | 'process' | 'category' | 'none';

const PROCESSES: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];

export default function RiskList({ ratings, nav, filter, onFilter, lockedProcess }: {
  ratings: RiskRating[]; nav: RiskNav; filter: ListFilter; onFilter: (f: ListFilter) => void; lockedProcess?: string;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('score');
  const [group, setGroup] = useState<Group>('tier');
  const [expanded, setExpanded] = useState<string | null>(null);

  const base = ratings.filter(r =>
    (!filter.process || r.risk.businessProcess === filter.process) &&
    (!filter.subProcess || r.risk.subProcess === filter.subProcess) &&
    (!filter.category || r.risk.category === filter.category) &&
    (!filter.outside || r.outsideAppetite) &&
    (!q.trim() || [r.risk.id, r.risk.name, r.risk.owner, r.risk.subProcess, r.risk.description].some(v => v.toLowerCase().includes(q.trim().toLowerCase()))));
  const visible = base.filter(r => !filter.tiers?.length || filter.tiers.includes(r.tier));
  const sorted = [...visible].sort((a, b) =>
    sort === 'score' ? b.score - a.score : sort === 'change' ? b.delta - a.delta : sort === 'inherent' ? b.inherent - a.inherent : a.risk.id.localeCompare(b.risk.id));

  const groups = (() => {
    if (group === 'none') return [{ key: 'all', label: '', rs: sorted }];
    const keyOf = (r: RiskRating) => (group === 'tier' ? r.tier : group === 'process' ? r.risk.businessProcess : r.risk.category);
    const order: string[] = group === 'tier' ? TIERS_DESC : group === 'process' ? PROCESSES : CATEGORIES;
    return order
      .map(k => ({ key: k, label: group === 'process' ? `${PROCESS_LONG[k as ProcessCode] ?? k}` : k, rs: sorted.filter(r => keyOf(r) === k) }))
      .filter(g => g.rs.length > 0);
  })();

  const active = (Object.keys(filter) as (keyof ListFilter)[]).filter(k => filter[k] != null && !(k === 'process' && lockedProcess));
  const set = (patch: Partial<ListFilter>) => onFilter({ ...filter, ...patch });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by rating">
          <Chip on={!filter.tiers?.length} onClick={() => set({ tiers: undefined })}>Any rating</Chip>
          {TIERS_DESC.map(t => {
            const n = base.filter(r => r.tier === t).length;
            return n > 0 ? (
              <Chip key={t} on={!!filter.tiers?.includes(t)} onClick={() => set({ tiers: filter.tiers?.includes(t) ? filter.tiers.filter(x => x !== t) : [...(filter.tiers ?? []), t] })}>
                <i className="size-2 rounded-full" style={{ background: TIER_FILL[t][0] }} aria-hidden />{t}<span className="text-ink-400 tabular-nums">{n}</span>
              </Chip>
            ) : null;
          })}
          <Chip on={!!filter.outside} onClick={() => set({ outside: filter.outside ? undefined : true })}>Outside appetite</Chip>
        </div>
        <div className="relative ml-auto w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter this list" aria-label="Filter risks" className="w-full h-8 pl-9 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] outline-none focus:border-brand-300" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-6 text-[0.75rem] text-ink-500">
        {!lockedProcess && (
          <Select label="Process" value={filter.process ?? ''} onChange={v => set({ process: v || undefined, subProcess: undefined })} options={[['', 'All processes'], ...PROCESSES.map(p => [p, PROCESS_LONG[p]] as [string, string])]} />
        )}
        <Select label="Category" value={filter.category ?? ''} onChange={v => set({ category: (v || undefined) as RiskCategory | undefined })} options={[['', 'All categories'], ...CATEGORIES.map(c => [c, c] as [string, string])]} />
        <Select label="Group by" value={group} onChange={v => setGroup(v as Group)} options={[['tier', 'Rating'], ['process', 'Process'], ['category', 'Category'], ['none', 'Nothing']]} />
        <Select label="Sort" value={sort} onChange={v => setSort(v as Sort)} options={[['score', 'Residual score'], ['change', 'Change this month'], ['inherent', 'Inherent exposure'], ['id', 'Risk ID']]} />
        {filter.subProcess && <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-brand-50 text-brand-700">{filter.subProcess}<button aria-label="Clear sub-process" onClick={() => set({ subProcess: undefined })} className="size-5 rounded-full hover:bg-brand-100 flex items-center justify-center cursor-pointer"><X size={11} /></button></span>}
        {active.length > 0 && (
          <button onClick={() => onFilter(lockedProcess ? { process: lockedProcess } : {})} className="text-brand-700 font-medium hover:underline cursor-pointer">Clear filters</button>
        )}
        <span className="ml-auto tabular-nums">{sorted.length} of {ratings.length} risks</span>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-canvas-border px-6 py-16 text-center">
          <p className="text-[0.875rem] font-medium text-ink-800">No risks match</p>
          <p className="mt-1 text-[0.8125rem] text-ink-500">Try another rating or clear the filters.</p>
        </div>
      ) : (
        <div className="space-y-9">
          {groups.map(g => (
            <section key={g.key} aria-label={g.label || 'Risks'}>
              {g.label && (
                <header className="flex items-center gap-3 mb-3">
                  {group === 'tier' ? <TierChip tier={g.key as Tier} /> : <h3 className="text-[0.875rem] font-semibold text-ink-900">{g.label}</h3>}
                  <span className="text-[0.75rem] text-ink-400 tabular-nums">{g.rs.length} risk{g.rs.length === 1 ? '' : 's'}</span>
                  {group === 'tier' && <span className="text-[0.75rem] text-ink-500">· {TIER_ACTION[g.key as Tier]}</span>}
                  <span className="flex-1 h-px bg-canvas-border" aria-hidden />
                </header>
              )}
              <ul className="space-y-3">
                {g.rs.map(r => <li key={r.risk.id}><RiskEntryCard r={r} open={expanded === r.risk.id} onToggle={() => setExpanded(expanded === r.risk.id ? null : r.risk.id)} nav={nav} /></li>)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** One risk as an accordion: closed, the rating and what is behind it at a
 *  glance; open, every linked control in full, the indicators and how the
 *  score adds up — with the full risk one click further. */
function RiskEntryCard({ r, open, onToggle, nav }: { r: RiskRating; open: boolean; onToggle: () => void; nav: RiskNav }) {
  const reduced = useReducedMotion();
  const [bg, fg] = TIER_FILL[r.tier];
  const reds = r.kris.filter(k => k.rag === 2).length;
  const ambers = r.kris.filter(k => k.rag === 1).length;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <article className={`group rounded-xl border bg-canvas-elevated transition-[border-color,box-shadow] duration-150 ${open ? 'border-brand-200 shadow-[0_8px_24px_rgba(15,8,30,0.04)]' : 'border-canvas-border hover:border-brand-200'}`}>
      <div className="flex items-start gap-5 px-5 py-4 cursor-pointer" onClick={onToggle}>
        {/* Score medallion */}
        <div className="w-[4.5rem] shrink-0 text-center">
          <div className="h-14 rounded-lg flex flex-col items-center justify-center" style={{ background: bg, color: fg }}>
            <span className="font-mono text-[1.25rem] font-semibold leading-none tabular-nums">{r.score.toFixed(1)}</span>
            <span className="mt-1 text-[0.5625rem] font-semibold uppercase tracking-wider opacity-80">residual</span>
          </div>
          <div className="mt-1.5"><Delta d={r.delta} /></div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-ink-400">
            <span className="font-mono text-ink-500">{r.risk.id}</span>
            <span aria-hidden>·</span><span className="font-mono">{r.risk.businessProcess}</span>
            <span aria-hidden>·</span><span>{r.risk.subProcess}</span>
            <span aria-hidden>·</span><span>{r.risk.category}</span>
            <span aria-hidden>·</span><span>{r.risk.owner}</span>
          </div>
          <h4 className="mt-1 flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold leading-snug text-ink-900">
            <button type="button" aria-expanded={open} onClick={e => { stop(e); onToggle(); }} className="text-left cursor-pointer group-hover:text-brand-700 transition-colors">{r.risk.name}</button>
            {r.outsideAppetite && <span className="inline-flex items-center h-5 px-1.5 rounded bg-risk-50 text-risk-700 text-[0.6875rem] font-semibold">Outside appetite</span>}
            {r.overrides.filter(o => o !== 'Score jump').map(o => <span key={o} className="inline-flex items-center h-5 px-1.5 rounded border border-canvas-border text-ink-600 text-[0.6875rem] font-medium">{o}</span>)}
          </h4>
          <p className={`mt-1 max-w-[80ch] text-[0.8125rem] leading-relaxed text-ink-500 ${open ? '' : 'line-clamp-1'}`}>{r.risk.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.75rem] text-ink-500">
            <span>Inherent <span className="font-mono font-semibold text-ink-800 tabular-nums">{r.inherent}</span> <span className="text-ink-400">(L{r.risk.likelihood} × I{r.risk.impact})</span></span>
            <span>Controls <span className="font-semibold text-ink-800 tabular-nums">{r.effectiveControls} of {r.controls.length}</span> effective</span>
            <span>
              Indicators{' '}
              {reds + ambers === 0
                ? <span className="text-ink-700">all green</span>
                : <>{reds > 0 && <span className="font-semibold text-risk-700">{reds} red</span>}{reds > 0 && ambers > 0 && ' · '}{ambers > 0 && <span className="font-semibold text-mitigated-700">{ambers} amber</span>}</>}
            </span>
            <span className="inline-flex items-center gap-2">Apr–Oct <Spark values={r.history} width={72} height={18} color={r.delta > 0 ? '#B42318' : '#3B0764'} /></span>
            <span>{r.risk.treatment}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-ink-400 group-hover:text-brand-700 transition-colors" aria-hidden>
              {open ? 'Less' : `${r.controls.length} control${r.controls.length === 1 ? '' : 's'}`}
              <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </span>
          </div>

          {/* Collapsed: the linked controls at a glance — each opens in the Control Library. */}
          {!open && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" onClick={stop}>
              {r.controls.length === 0 && <span className="text-[0.75rem] text-high-700">No control linked yet</span>}
              {r.controls.map(c => c.row && c.effect ? (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => nav.openControl(c.row!.id)}
                  title={`${c.row.name} — ${c.effect.label}. Takes ${c.points.toFixed(1)} off the score. Open in the Control Library`}
                  className="inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2 rounded-md border border-canvas-border bg-canvas text-[0.6875rem] cursor-pointer transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <ControlGlyph status={c.effect.status} />
                  <span className="font-mono text-ink-500">{c.id}</span>
                  <span className="max-w-[14rem] truncate text-ink-800">{c.row.name}</span>
                </button>
              ) : null)}
            </div>
          )}
        </div>

        <div className="w-56 shrink-0 text-right">
          <TierChip tier={r.tier} />
          <p className="mt-2 text-[0.75rem] leading-snug text-ink-600">{TIER_ACTION[r.tier]}</p>
          {r.tier !== r.scoreTier && <p className="mt-1 text-[0.6875rem] text-ink-400">Score alone gives {r.scoreTier}</p>}
          <button type="button" onClick={e => { stop(e); nav.openRisk(r.risk.id); }} className="mt-2 inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline cursor-pointer">
            Open risk <ArrowRight size={12} aria-hidden />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-5 border-t border-canvas-border pt-4 pb-5 pl-[5.75rem] space-y-5">
              {/* Controls */}
              <section aria-label="Linked controls">
                <header className="flex flex-wrap items-center gap-3 mb-2">
                  <h5 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">Linked controls · {r.controls.length}</h5>
                  <span className="text-[0.75rem] text-ink-500 tabular-nums">{r.effectiveControls} effective · take <span className="font-mono text-compliant-700">{r.mitigation.toFixed(1)}</span> off an inherent {r.inherent}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" leftIcon={<Link2 size={12} />} onClick={() => nav.linkControls(r.risk.id)}>Link a control</Button>
                  </span>
                </header>
                <ControlAccordion
                  riskId={r.risk.id}
                  controls={r.controls}
                  actions={{ openControl: nav.openControl, adapt: nav.adapt, review: () => nav.goTo('builds') }}
                />
              </section>

              {/* Indicators */}
              {r.kris.length > 0 && (
                <section aria-label="Key risk indicators">
                  <h5 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">Key risk indicators · {r.kris.length}</h5>
                  <ul className="rounded-xl border border-canvas-border divide-y divide-canvas-border">
                    {r.kris.map(k => (
                      <li key={k.kri.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)_6rem_auto_3rem] items-center gap-4 px-4 py-2.5">
                        <RagChip rag={k.rag} />
                        <span className="min-w-0">
                          <span className="block text-[0.8125rem] font-medium text-ink-900 truncate">{k.kri.name} <span className="text-[0.625rem] font-bold text-brand-700">{k.kri.type}</span></span>
                          <span className="block text-[0.6875rem] text-ink-500 truncate">amber {k.kri.amber} · red {k.kri.red} · {k.kri.source}</span>
                        </span>
                        <span className="text-right font-mono text-[0.875rem] font-semibold text-ink-900 tabular-nums">{fmtKri(k.kri, k.value)}</span>
                        <RagStrip kri={k.kri} />
                        <span className="text-right font-mono text-[0.75rem] text-ink-500 tabular-nums">{k.points ? `+${k.points.toFixed(1)}` : '0'}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* How the score adds up */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-ink-600 tabular-nums">
                <span className="text-ink-400">Score</span>
                <span>inherent <b className="font-mono text-ink-900">{r.inherent}</b></span>
                <span>− controls <b className="font-mono text-compliant-700">{r.mitigation.toFixed(1)}</b></span>
                <span>+ indicators <b className="font-mono text-ink-900">{r.kriPoints.toFixed(1)}</b></span>
                {r.eventPoints > 0 && <span>+ events <b className="font-mono text-ink-900">{r.eventPoints.toFixed(1)}</b></span>}
                <span>= <b className="font-mono text-ink-900">{r.score.toFixed(1)}</b></span>
                <Button variant="primary" size="sm" className="ml-auto" rightIcon={<ArrowRight size={12} />} onClick={() => nav.openRisk(r.risk.id)}>Open full risk</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-[0.75rem] cursor-pointer transition-colors ${on ? 'border-brand-300 bg-brand-50 text-brand-700 font-medium' : 'border-canvas-border text-ink-600 hover:border-brand-200'}`}
    >
      {children}
    </button>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="h-7 pl-2 pr-6 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 cursor-pointer outline-none focus:border-brand-300">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
