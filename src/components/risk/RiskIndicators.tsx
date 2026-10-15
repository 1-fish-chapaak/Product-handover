/**
 * Indicators — every KRI and KCI on the register against its thresholds, and
 * where they cluster: a process with many indicators in the red points at the
 * process, not one risk, and earns a thematic review.
 */
import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../shared/Button';
import { PROCESS_LONG } from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { MONTHS, NOW, fmtKri, ragOf } from '../../data/erm/model';
import type { KriLine, RiskRating } from '../../data/erm/score';
import { Delta, Kpi, Panel, RagChip, RagStrip } from './riskUi';
import KriDrawer from './KriDrawer';
import type { RiskNav } from './RiskRegisterPage';

type Show = 'red' | 'breach' | 'all';
const PROCESSES: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];

export default function RiskIndicators({ ratings, nav }: { ratings: RiskRating[]; nav: RiskNav }) {
  const [show, setShow] = useState<Show>('breach');
  const [type, setType] = useState<'' | 'KRI' | 'KCI'>('');
  // Ids, not objects — the drawer reads the live risk, so a threshold save shows at once.
  const [open, setOpen] = useState<{ riskId: string; kriId: string } | null>(null);
  const openRisk = open ? ratings.find(x => x.risk.id === open.riskId) : undefined;
  const openKri = openRisk?.risk.kris.find(k => k.id === open?.kriId);

  const all = ratings.flatMap(r => r.kris.map(k => ({ r, k })));
  const prevRag = (k: KriLine) => ragOf(k.kri, k.kri.values[NOW - 1] ?? 0);
  const reds = all.filter(x => x.k.rag === 2);
  const ambers = all.filter(x => x.k.rag === 1);
  const running = all.filter(x => x.k.repeat);
  const newRed = reds.filter(x => prevRag(x.k) !== 2);

  // Hotspots: processes where most of the indicators are breaching.
  const hotspots = PROCESSES.map(p => {
    const ks = all.filter(x => x.r.risk.businessProcess === p);
    const breaching = ks.filter(x => x.k.rag > 0);
    return { p, total: ks.length, breaching, red: breaching.filter(x => x.k.rag === 2).length, share: ks.length ? breaching.length / ks.length : 0 };
  }).filter(h => h.total > 0 && h.breaching.length >= 2).sort((a, b) => b.share - a.share || b.red - a.red).slice(0, 3);

  const list = all
    .filter(x => (show === 'red' ? x.k.rag === 2 : show === 'breach' ? x.k.rag > 0 : true) && (!type || x.k.kri.type === type))
    .sort((a, b) => b.k.rag - a.k.rag || b.k.points - a.k.points);
  const byProcess = PROCESSES.map(p => ({ p, xs: list.filter(x => x.r.risk.businessProcess === p) })).filter(g => g.xs.length);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Indicators tracked" value={all.length} sub={`${all.filter(x => x.k.kri.type === 'KRI').length} risk · ${all.filter(x => x.k.kri.type === 'KCI').length} control indicators`} />
        <Kpi label="Red" swatch="#D92D20" value={<>{reds.length} <Delta d={reds.length - all.filter(x => prevRag(x.k) === 2).length} digits={0} /></>} sub={newRed.length ? `${newRed.length} new this month` : 'None new this month'} onClick={() => setShow('red')} active={show === 'red'} />
        <Kpi label="Amber" swatch="#FEC84B" value={ambers.length} sub="Past amber, short of red" onClick={() => setShow('breach')} active={show === 'breach'} />
        <Kpi label="Red three months running" value={running.length} sub="Count 1.25× — a persistent breach" />
      </div>

      {hotspots.length > 0 && (
        <Panel title="Where indicators cluster" tip="Processes where most indicators are amber or red. The same problem across several risks points to the process — a candidate for a thematic review.">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {hotspots.map(h => (
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
                  {h.breaching.slice(0, 3).map(x => <li key={x.k.kri.id} className="truncate"><span className={x.k.rag === 2 ? 'text-risk-700' : 'text-mitigated-700'}>●</span> {x.k.kri.name}</li>)}
                </ul>
                <Button variant="secondary" size="sm" className="mt-3 self-start" rightIcon={<ArrowRight size={12} />} onClick={() => nav.goTo('audit-with-ai')}>Plan a thematic review</Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-100" role="group" aria-label="Which indicators">
          {([['red', 'Red only'], ['breach', 'Red or amber'], ['all', 'All']] as [Show, string][]).map(([id, l]) => (
            <button key={id} aria-pressed={show === id} onClick={() => setShow(id)} className={`h-7 px-3 rounded-md text-[0.75rem] font-medium cursor-pointer ${show === id ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>{l}</button>
          ))}
        </div>
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-100" role="group" aria-label="Indicator type">
          {([['', 'Both'], ['KRI', 'Risk (KRI)'], ['KCI', 'Control (KCI)']] as ['' | 'KRI' | 'KCI', string][]).map(([id, l]) => (
            <button key={id || 'both'} aria-pressed={type === id} onClick={() => setType(id)} className={`h-7 px-3 rounded-md text-[0.75rem] font-medium cursor-pointer ${type === id ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>{l}</button>
          ))}
        </div>
        <span className="ml-auto text-[0.75rem] text-ink-500 tabular-nums">{list.length} indicators · {MONTHS[0]}–{MONTHS[NOW]}</span>
      </div>

      {byProcess.length === 0 ? (
        <div className="rounded-xl border border-dashed border-canvas-border px-6 py-14 text-center text-[0.8125rem] text-ink-500">No indicator is in the red.</div>
      ) : byProcess.map(g => (
        <section key={g.p} aria-label={PROCESS_LONG[g.p]}>
          <header className="flex items-center gap-3 mb-2">
            <h3 className="text-[0.875rem] font-semibold text-ink-900">{PROCESS_LONG[g.p]}</h3>
            <span className="text-[0.75rem] text-ink-400 tabular-nums">{g.xs.length}</span>
            <span className="flex-1 h-px bg-canvas-border" aria-hidden />
          </header>
          <ul className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border">
            {g.xs.map(({ r, k }) => (
              <li key={k.kri.id}>
                <button onClick={() => setOpen({ riskId: r.risk.id, kriId: k.kri.id })} className="w-full grid grid-cols-[4rem_minmax(0,1.6fr)_minmax(0,1.2fr)_6.5rem_8rem_auto] items-center gap-4 px-5 py-3 text-left hover:bg-paper-50/60 cursor-pointer">
                  <RagChip rag={k.rag} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[0.8125rem] font-semibold text-ink-900 truncate">{k.kri.name}</span>
                      <span className="shrink-0 inline-flex items-center h-4 px-1 rounded bg-brand-50 text-brand-700 text-[0.5625rem] font-bold">{k.kri.type}</span>
                    </span>
                    <span className="block text-[0.6875rem] text-ink-500 truncate">{k.kri.source}{k.repeat ? ' · red three months running' : ''}</span>
                  </span>
                  <span className="min-w-0 text-[0.75rem] text-ink-600 truncate"><span className="font-mono text-ink-400">{r.risk.id}</span> {r.risk.name}</span>
                  <span className="text-right">
                    <span className="block font-mono text-[0.9375rem] font-semibold text-ink-900 tabular-nums">{fmtKri(k.kri, k.value)}</span>
                    <span className="block text-[0.625rem] text-ink-400 tabular-nums">amber {k.kri.amber} · red {k.kri.red}</span>
                  </span>
                  <RagStrip kri={k.kri} />
                  <span className="text-right font-mono text-[0.75rem] text-ink-500 tabular-nums">{k.points ? `+${k.points.toFixed(1)}` : '0'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <AnimatePresence>
        {openRisk && openKri && (
          <KriDrawer
            key={`${openKri.id}-${openKri.amber}-${openKri.red}`}
            riskId={openRisk.risk.id}
            riskName={openRisk.risk.name}
            kri={openKri}
            onClose={() => setOpen(null)}
            onOpenRisk={() => { const id = openRisk.risk.id; setOpen(null); nav.openRisk(id); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
