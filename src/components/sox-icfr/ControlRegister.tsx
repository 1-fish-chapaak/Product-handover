import { useMemo, useState } from 'react';
import {
  Search, Plus, FileSpreadsheet, Layers, Rows3, MessageSquare,
  Star, RefreshCw, ListFilter, FileText, X, Send, LayoutGrid, Table2, FlaskConical,
} from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import {
  controlConclusion, courtFor, designProgress, designStarted, engagementProgress, openDiscussionCount,
  operatingProgress, operatingStarted, trackResult,
} from './helpers';
import { ConclusionPill, CourtBadge, NatureChip, Tickmark } from './parts';
import BulkTestModal from './BulkTestModal';
import { downloadIcfrWorkingPaper } from './icfrWorkingPaper';
import { cn } from '../../lib/cn';
import type { Control } from './types';

type SavedView = 'all' | 'court' | 'design' | 'operating' | 'exceptions' | 'key';
const VIEWS: { id: SavedView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'court', label: 'My court' },
  { id: 'design', label: 'Design' },
  { id: 'operating', label: 'Operating' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'key', label: 'Key' },
];

// binding colours, one per process — drawn from the brand purple + evidence blue families (on-theme, no brown)
const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]; }

function CardTrack({ label, res, started }: { label: string; res: ReturnType<typeof trackResult>; started: boolean }) {
  const dot = res === 'Effective' ? 'ok' : res === 'Ineffective' ? 'ko' : started ? 'prog' : 'none';
  const word = res === 'Not tested' ? (started ? 'In progress' : 'Not started') : res;
  return (
    <div className="flex items-center gap-2.5 text-[11.5px]">
      <span className="text-ink-400 w-[58px] shrink-0">{label}</span>
      <span className={cn('ac-dot', dot)} />
      <span className="font-medium text-ink-700">{word}</span>
    </div>
  );
}

function ControlCard({ c, discN, onOpen }: { c: Control; discN: number; onOpen: () => void }) {
  return (
    <button className="ac-card" onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen(); }} aria-label={`Open ${c.id} — ${c.description}`}>
      <div className="flex items-center gap-2">
        <span className="ac-eyebrow"><span className="dot" style={{ background: spineColor(c.process) }} /><span className="lbl">{c.process}</span></span>
        <span className="ml-auto inline-flex items-center gap-2 shrink-0">
          {c.isKey && <Star size={11} className="text-mitigated-500 fill-mitigated-100" />}
          {discN > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-700"><MessageSquare size={9} />{discN}</span>}
          <span className="font-mono text-[10.5px] text-ink-400">{c.wpRef}</span>
        </span>
      </div>
      <h3 className="ac-title mt-2">{c.description}</h3>
      <div className="ac-meta">{c.id} · {c.nature}</div>
      <div className="ac-div" />
      <div className="space-y-1.5">
        <CardTrack label="Design" res={trackResult(c.design)} started={designStarted(c)} />
        <CardTrack label="Operating" res={trackResult(c.operating)} started={operatingStarted(c)} />
      </div>
      <div className="mt-3"><ConclusionPill c={controlConclusion(c)} /></div>
    </button>
  );
}

function TrackCell({ result, a, b, label }: { result: ReturnType<typeof trackResult>; a: number; b: number; label: string }) {
  const pct = b === 0 ? 0 : Math.round((a / b) * 100);
  const tone = result === 'Effective' ? 'var(--color-compliant-500)' : result === 'Ineffective' ? 'var(--color-risk-500)' : 'var(--color-ink-300)';
  return (
    <span className="cell-track">
      <Tickmark result={result === 'Effective' ? 'Pass' : result === 'Ineffective' ? 'Fail' : 'Not tested'} size={16} />
      <span className="flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold text-ink-600 leading-none">{result === 'Not tested' ? 'Not started' : result}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="meter"><span style={{ width: `${pct}%`, background: tone }} /></span>
          <span className="text-[10px] tabular-nums text-ink-400">{label}</span>
        </span>
      </span>
    </span>
  );
}

export default function ControlRegister() {
  const { eng, role, openControl, setView, rollForward, requestDesignDocs } = useIcfr();
  const logEvent = useAuditLog();
  const [bulkTestIds, setBulkTestIds] = useState<string[] | null>(null);
  const [savedView, setSavedView] = useState<SavedView>('all');
  const [q, setQ] = useState('');
  const [process, setProcess] = useState('All');
  const [nature, setNature] = useState('All');
  const [grouped, setGrouped] = useState(true);
  const [dense, setDense] = useState(false);
  const [layout, setLayout] = useState<'cards' | 'table'>('cards');
  const [sel, setSel] = useState<Set<string>>(new Set());

  const stats = engagementProgress(eng);
  const processes = useMemo(() => ['All', ...Array.from(new Set(eng.controls.map(c => c.process)))], [eng.controls]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return eng.controls.filter(c => {
      if (process !== 'All' && c.process !== process) return false;
      if (nature !== 'All' && c.nature !== nature) return false;
      if (term && !(`${c.id} ${c.wpRef} ${c.description} ${c.process} ${c.subProcess} ${c.owner}`.toLowerCase().includes(term))) return false;
      const concl = controlConclusion(c);
      if (savedView === 'court' && courtFor(c, eng.tasks) !== role) return false;
      if (savedView === 'design' && trackResult(c.design) !== 'Not tested') return false;
      if (savedView === 'operating' && trackResult(c.operating) !== 'Not tested') return false;
      if (savedView === 'exceptions' && concl !== 'Ineffective') return false;
      if (savedView === 'key' && !c.isKey) return false;
      return true;
    });
  }, [eng.controls, eng.tasks, q, process, nature, savedView, role]);

  const groups = useMemo(() => {
    if (!grouped) return [{ key: '', rows: filtered }];
    const map = new Map<string, Control[]>();
    for (const c of filtered) { const k = c.process; if (!map.has(k)) map.set(k, []); map.get(k)!.push(c); }
    return Array.from(map, ([key, rows]) => ({ key, rows: rows.sort((a, b) => a.wpRef.localeCompare(b.wpRef)) }));
  }, [filtered, grouped]);

  const allVisible = filtered.map(c => c.id);
  const allSelected = allVisible.length > 0 && allVisible.every(id => sel.has(id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(allVisible));
  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const colSpan = 8;

  return (
    <div>
      {/* header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>Control library</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">{eng.controls.length} controls · {stats.effective} effective · {stats.waitingOnOwner} waiting on owner</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { downloadIcfrWorkingPaper(eng); logEvent({ action: 'Export', description: `Exported ICFR working paper (${eng.controls.length} controls)`, module: 'SOX ICFR', entity: 'Engagement' }); }} title="Export working paper" aria-label="Export working paper" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-canvas-border text-ink-500 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><FileSpreadsheet size={15} /></button>
          {role === 'auditor' && <button onClick={() => { rollForward(); logEvent({ action: 'Update', description: 'Rolled engagement forward to year-end', module: 'SOX ICFR', entity: 'Engagement' }); }} title="Roll forward to year-end" aria-label="Roll forward to year-end" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-canvas-border text-ink-500 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><RefreshCw size={15} /></button>}
          {role === 'auditor' && (
            <button onClick={() => setBulkTestIds(sel.size ? Array.from(sel) : filtered.map(c => c.id))}
              title={sel.size ? `Bulk test the ${sel.size} selected controls` : 'Bulk test all controls in view'}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] font-semibold text-ink-700 hover:text-brand-700 hover:border-brand-300 transition-colors cursor-pointer">
              <FlaskConical size={14} /> Bulk test{sel.size > 0 && <span className="tabular-nums text-brand-700">({sel.size})</span>}
            </button>
          )}
          {role === 'auditor' && <button onClick={() => setView('setup')} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><Plus size={15} /> New</button>}
        </div>
      </div>

      {/* saved views */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setSavedView(v.id)} className={cn('view-chip', savedView === v.id && 'on')}>
            {v.id === 'court' && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}{v.label}
            <span className="tabular-nums opacity-60">{v.id === savedView ? filtered.length : ''}</span>
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search controls, owners, W/P…" className="h-9 w-64 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated">
          <ListFilter size={13} className="text-ink-400" />
          <select value={process} onChange={e => setProcess(e.target.value)} className="bg-transparent text-[12.5px] font-semibold text-ink-700 focus:outline-none cursor-pointer">
            {processes.map(p => <option key={p} value={p}>{p === 'All' ? 'All processes' : p}</option>)}
          </select>
        </div>
        <div className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated">
          <select value={nature} onChange={e => setNature(e.target.value)} className="bg-transparent text-[12.5px] font-semibold text-ink-700 focus:outline-none cursor-pointer">
            {['All', 'Manual', 'Automated', 'IT-dependent'].map(p => <option key={p} value={p}>{p === 'All' ? 'All natures' : p}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <button onClick={() => setGrouped(g => !g)} className={cn('filter-pill', grouped && 'on')}><Layers size={13} /> Group</button>
        {layout === 'table' && <button onClick={() => setDense(d => !d)} className={cn('filter-pill', dense && 'on')}><Rows3 size={13} /> Dense</button>}
        <div className="inline-flex items-center p-0.5 rounded-lg border border-canvas-border bg-canvas-elevated">
          <button onClick={() => setLayout('cards')} title="Card view" className={cn('h-8 px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors', layout === 'cards' ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800')}><LayoutGrid size={13} /> Cards</button>
          <button onClick={() => setLayout('table')} title="Table view" className={cn('h-8 px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors', layout === 'table' ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800')}><Table2 size={13} /> Table</button>
        </div>
      </div>

      {/* register body — cards (default) or table */}
      {layout === 'cards' ? (
        <div>
          {groups.map(g => (
            <div key={g.key || 'flat'} className="shelf">
              {g.key && (
                <div className="shelf-head">
                  <span className="shelf-swatch" style={{ background: spineColor(g.key) }} />
                  <span className="shelf-title">{g.key}</span>
                  <span className="text-[11.5px] text-ink-400 font-medium">· {g.rows.length}</span>
                  <span className="text-[10.5px] font-semibold text-ink-400 hidden md:inline">{g.rows.filter(c => trackResult(c.design) !== 'Not tested').length} design · {g.rows.filter(c => trackResult(c.operating) !== 'Not tested').length} operating concluded</span>
                  <span className="shelf-board" />
                </div>
              )}
              <div className="card-grid">
                {g.rows.map(c => <ControlCard key={c.id} c={c} discN={openDiscussionCount(eng, c.id)} onOpen={() => openControl(c.id)} />)}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-ink-400 text-[13px] rounded-2xl border border-dashed border-canvas-border">No controls match these filters. <button onClick={() => { setQ(''); setProcess('All'); setNature('All'); setSavedView('all'); }} className="text-brand-700 font-semibold hover:underline">Clear filters</button></div>
          )}
        </div>
      ) : (
      <div className={cn('reg-wrap', dense && 'reg-dense')}>
        <table className="w-full border-collapse">
          <thead className="reg-head">
            <tr>
              <th style={{ width: 34 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer accent-brand-600" aria-label="Select all" /></th>
              <th style={{ width: 64 }}>W/P</th>
              <th>Control</th>
              <th style={{ width: 96 }}>Nature</th>
              <th style={{ width: 150 }}>① Design</th>
              <th style={{ width: 168 }}>② Operating</th>
              <th style={{ width: 116 }}>Conclusion</th>
              <th style={{ width: 116 }}>Court</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <FragmentGroup key={g.key || 'flat'}>
                {g.key && (
                  <tr className="reg-group-row"><td colSpan={colSpan}>
                    <span className="inline-flex items-center gap-2">{g.key}<span className="text-ink-400 font-medium">· {g.rows.length}</span>
                      <span className="ml-2 text-[10.5px] font-semibold text-ink-400">
                        {g.rows.filter(c => trackResult(c.design) !== 'Not tested').length} design · {g.rows.filter(c => trackResult(c.operating) !== 'Not tested').length} operating concluded
                      </span>
                    </span>
                  </td></tr>
                )}
                {g.rows.map(c => {
                  const dp = designProgress(c); const op = operatingProgress(c);
                  const discN = openDiscussionCount(eng, c.id);
                  return (
                    <tr key={c.id} className={cn('reg-row', sel.has(c.id) && 'sel')} onClick={() => openControl(c.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openControl(c.id); }} role="button" aria-label={`Open ${c.id} — ${c.description}`}>
                      <td onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) toggle(c.id); }}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="cursor-pointer accent-brand-600" aria-label={`Select ${c.id}`} /></td>
                      <td><span className="wp-ref">{c.wpRef}</span></td>
                      <td className="tight">
                        <div className="flex items-center gap-1.5">
                          {c.isKey && <Star size={12} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                          <span className="font-semibold text-ink-900 text-[12.5px] truncate max-w-[420px]">{c.description}</span>
                          {discN > 0 && <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-brand-700 bg-brand-50 px-1.5 h-[17px] rounded-full"><MessageSquare size={9} />{discN}</span>}
                        </div>
                        <div className="text-[11px] text-ink-400 mt-0.5">{c.id} · {c.subProcess} · {c.owner}</div>
                      </td>
                      <td><NatureChip nature={c.nature} small /></td>
                      <td><TrackCell result={trackResult(c.design)} a={dp.docsReceived} b={dp.docsTotal} label={`${dp.docsReceived}/${dp.docsTotal} docs`} /></td>
                      <td><TrackCell result={trackResult(c.operating)} a={op.passed} b={op.total} label={`${op.tested}/${op.total} · ${c.operating.method === 'Automated' ? 'auto' : 'manual'}`} /></td>
                      <td><ConclusionPill c={controlConclusion(c)} /></td>
                      <td><CourtBadge court={courtFor(c, eng.tasks)} fromRole={role} /></td>
                    </tr>
                  );
                })}
              </FragmentGroup>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={colSpan} className="text-center py-16 text-ink-400 text-[13px]">No controls match these filters. <button onClick={() => { setQ(''); setProcess('All'); setNature('All'); setSavedView('all'); }} className="text-brand-700 font-semibold hover:underline">Clear filters</button></td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      <div className="mt-3 text-[11.5px] text-ink-400">Showing {filtered.length} of {eng.controls.length} controls</div>

      {/* bulk bar */}
      {sel.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-ink-900 text-white rounded-2xl pl-4 pr-2.5 py-2.5 shadow-[0_12px_40px_-12px_rgba(15,8,30,0.6)]">
          <span className="text-[12.5px] font-semibold">{sel.size} selected</span>
          <span className="w-px h-5 bg-white/20" />
          {role === 'auditor' && <button onClick={() => { setBulkTestIds(Array.from(sel)); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><FlaskConical size={14} /> Test controls</button>}
          {role === 'auditor' && <button onClick={() => { logEvent({ action: 'Share', description: `Requested design documents for ${sel.size} control(s)`, module: 'SOX ICFR', entity: 'Control' }); requestDesignDocs(Array.from(sel)); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><FileText size={14} /> Request design documents</button>}
          <button onClick={() => { openControl(Array.from(sel)[0]); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><Send size={14} /> Open first</button>
          <button onClick={() => setSel(new Set())} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      {/* bulk test — compile files → attach unique datasets → execute */}
      {bulkTestIds && <BulkTestModal controlIds={bulkTestIds} onClose={() => setBulkTestIds(null)} />}
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) { return <>{children}</>; }
