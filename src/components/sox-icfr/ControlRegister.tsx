import { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, FileSpreadsheet, Layers, Rows3, MessageSquare,
  Star, FileText, X, Send, LayoutGrid, Table2, FlaskConical, StickyNote,
} from 'lucide-react';
import { HeaderFilter } from '../shared/FilterSelect';
import { useAuditControls } from './useAuditControls';
import { useIcfr } from './store';
import { defWord } from './flow';
import {
  controlConclusion, courtFor, designProgress, designStarted, isAwaitingReview, isControlFinal, isEngagementLocked, openDiscussionCount,
  operatingProgress, operatingStarted, isTestDueNow, pendingReviewNoteCount, testDueDisplay, testsDueNow, trackResult,
} from './helpers';
import { ConclusionPill, CourtBadge, NatureChip, Tickmark } from './parts';
import BulkTestModal from './BulkTestModal';
import NewControlPanel from './NewControlPanel';
import WorkingPaperModal from './WorkingPaperModal';
import { useToast } from '../shared/Toast';
import { cn } from '../../lib/cn';
import type { Control } from './types';

type SavedView = 'all' | 'due' | 'court' | 'design' | 'design-done' | 'operating' | 'operating-done'
  | 'effective' | 'exceptions' | 'review' | 'owner' | 'open' | 'papers' | 'key';
const VIEWS: { id: SavedView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due now' },
  { id: 'court', label: 'My court' },
  { id: 'design', label: 'Design' },
  { id: 'design-done', label: 'Design concluded' },
  { id: 'operating', label: 'Operating' },
  { id: 'operating-done', label: 'Operating concluded' },
  { id: 'effective', label: 'Effective' },
  { id: 'exceptions', label: 'Exceptions' },  // relabelled per engagement — see viewOptions below
  { id: 'review', label: 'Awaiting review' },
  { id: 'owner', label: 'Waiting on owner' },
  { id: 'open', label: 'Not concluded' },
  { id: 'papers', label: 'Awaiting sign-off' },
  { id: 'key', label: 'Key' },
];

// binding colours, one per process — drawn from the brand purple + evidence blue families (on-theme, no brown)
const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]; }

function CardTrack({ label, res, started }: { label: string; res: ReturnType<typeof trackResult>; started: boolean }) {
  const dot = res === 'Effective' ? 'ok' : res === 'Ineffective' ? 'ko' : started ? 'prog' : 'none';
  const word = res === 'Not tested' ? (started ? 'In progress' : 'Not tested') : res;
  return (
    <div className="flex items-center gap-2.5 text-[11.5px]">
      <span className="text-ink-400 w-[58px] shrink-0">{label}</span>
      <span className={cn('ac-dot', dot)} />
      <span className="font-medium text-ink-700">{word}</span>
    </div>
  );
}

function ControlCard({ c, discN, noteN, onOpen, selectable, selected, onToggle }: { c: Control; discN: number; noteN: number; onOpen: () => void; selectable?: boolean; selected?: boolean; onToggle?: () => void }) {
  return (
    <div role="button" tabIndex={0} className={cn('ac-card text-left', selected && 'ring-2 ring-brand-200 border-brand-300')}
      onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen(); }} aria-label={`Open ${c.id} — ${c.description}`}>
      <div className="flex items-center gap-2">
        {selectable && (
          <input type="checkbox" checked={!!selected} onClick={e => e.stopPropagation()} onChange={onToggle}
            className="cursor-pointer accent-brand-600 shrink-0" aria-label={`Select ${c.id}`} />
        )}
        <span className="ac-eyebrow"><span className="dot" style={{ background: spineColor(c.process) }} /><span className="lbl">{c.process}</span></span>
        <span className="ml-auto inline-flex items-center gap-2 shrink-0">
          {c.isKey && <Star size={11} className="text-mitigated-500 fill-mitigated-100" />}
          {discN > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-700"><MessageSquare size={9} />{discN}</span>}
          {noteN > 0 && <span title={`${noteN} review note${noteN === 1 ? '' : 's'} pending`} className="inline-flex items-center gap-0.5 text-[10px] font-bold text-high-700"><StickyNote size={9} />{noteN}</span>}
          <span className="font-mono text-[10.5px] text-ink-400">{c.wpRef}</span>
        </span>
      </div>
      <h3 className="ac-title mt-2">{c.description}</h3>
      <div className="ac-meta">
        {c.id} · {c.nature} ·{' '}
        {(() => { const dd = testDueDisplay(c); return <span className={dd.cls}>{dd.label}</span>; })()}
      </div>
      <div className="ac-div" />
      <div className="space-y-1.5">
        <CardTrack label="Design" res={trackResult(c.design)} started={designStarted(c)} />
        <CardTrack label="Operating" res={trackResult(c.operating)} started={operatingStarted(c)} />
      </div>
      <div className="mt-3"><ConclusionPill c={controlConclusion(c)} /></div>
    </div>
  );
}

function TrackCell({ result, a, b, label }: { result: ReturnType<typeof trackResult>; a: number; b: number; label: string }) {
  const pct = b === 0 ? 0 : Math.round((a / b) * 100);
  const tone = result === 'Effective' ? 'var(--color-compliant-500)' : result === 'Ineffective' ? 'var(--color-risk-500)' : 'var(--color-ink-300)';
  return (
    <span className="cell-track">
      <Tickmark result={result === 'Effective' ? 'Pass' : result === 'Ineffective' ? 'Fail' : 'Not tested'} size={16} />
      <span className="flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold text-ink-600 leading-none">{result}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="meter"><span style={{ width: `${pct}%`, background: tone }} /></span>
          <span className="text-[10px] tabular-nums text-ink-400">{label}</span>
        </span>
      </span>
    </span>
  );
}

export default function ControlRegister() {
  const { eng, role, meOwner, openControl, requestDesignDocs, registerPreset, clearRegisterPreset } = useIcfr();
  const { addToast } = useToast();
  const [bulkTestIds, setBulkTestIds] = useState<string[] | null>(null);
  const [creating, setCreating] = useState(false);
  // The register shows what the OPEN audit covers — its entities' processes.
  const auditScoped = useAuditControls(eng.controls);
  // Classic engagements still say Exceptions; the rework renamed them.
  const viewOptions = useMemo(
    () => VIEWS.map(v => ({ ...v, label: v.id === 'exceptions' ? defWord(eng.id).Many : v.label })),
    [eng.id],
  );
  // preview-before-download for the consolidated working paper
  const [wpPreview, setWpPreview] = useState(false);
  // roll-forward is one-way — confirm before it fires
  const [savedView, setSavedView] = useState<SavedView>('all');
  const [q, setQ] = useState('');
  const [process, setProcess] = useState('All');
  // An Overview count arrives with intent — apply its exact view/filter once,
  // then the register owns its own filters again.
  useEffect(() => {
    if (!registerPreset) return;
    if (registerPreset.view) setSavedView(registerPreset.view as SavedView);
    if (registerPreset.process) setProcess(registerPreset.process);
    clearRegisterPreset();
  }, [registerPreset, clearRegisterPreset]);
  const [nature, setNature] = useState('All');
  const [grouped, setGrouped] = useState(true);
  const [dense, setDense] = useState(false);
  const [layout, setLayout] = useState<'cards' | 'table'>('cards');
  const [sel, setSel] = useState<Set<string>>(new Set());

  // Person-lane: the owner's register is their own controls, never the engagement's.
  const scoped = useMemo(
    () => (role === 'risk-owner' ? auditScoped.filter(c => c.owner === meOwner) : auditScoped),
    [auditScoped, role, meOwner],
  );
  const stats = useMemo(() => ({
    effective: scoped.filter(c => controlConclusion(c) === 'Effective').length,
    awaitingReview: scoped.filter(isAwaitingReview).length,
    waitingOnOwner: scoped.filter(c => courtFor(c, eng.tasks, eng.reviewNotes) === 'risk-owner').length,
  }), [scoped, eng.tasks, eng.reviewNotes]);
  const processes = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.process)))], [scoped]);

  const matchesView = (c: Control, v: SavedView): boolean => {
    if (v === 'due') return isTestDueNow(c);
    if (v === 'court') return courtFor(c, eng.tasks, eng.reviewNotes) === role;
    if (v === 'design') return trackResult(c.design) === 'Not tested';
    if (v === 'design-done') return trackResult(c.design) !== 'Not tested';
    if (v === 'operating') return trackResult(c.operating) === 'Not tested';
    if (v === 'operating-done') return trackResult(c.operating) !== 'Not tested';
    if (v === 'effective') return controlConclusion(c) === 'Effective';
    if (v === 'exceptions') return controlConclusion(c) === 'Ineffective';
    if (v === 'review') return isAwaitingReview(c);
    if (v === 'owner') return courtFor(c, eng.tasks, eng.reviewNotes) === 'risk-owner';
    if (v === 'open') return controlConclusion(c) === 'In progress';
    if (v === 'papers') return controlConclusion(c) !== 'In progress' && !isControlFinal(c);
    if (v === 'key') return c.isKey;
    return true;
  };
  // search + process + nature first — the Status dropdown's counts read from this base
  const base = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scoped.filter(c => {
      if (process !== 'All' && c.process !== process) return false;
      if (nature !== 'All' && c.nature !== nature) return false;
      if (term && !(`${c.id} ${c.wpRef} ${c.description} ${c.process} ${c.subProcess} ${c.owner}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [scoped, q, process, nature]);
  const filtered = useMemo(() => base.filter(c => matchesView(c, savedView)), [base, savedView, eng.tasks, eng.reviewNotes, role]);
  const viewCounts = useMemo(
    () => Object.fromEntries(VIEWS.map(v => [v.id, base.filter(c => matchesView(c, v.id)).length])) as Record<SavedView, number>,
    [base, eng.tasks, eng.reviewNotes, role],
  );

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
      {/* toolbar — first, matching the sibling tabs (RACM, Risk Register), so the
          filters sit directly under the tab bar. Status folds the saved views in. */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search controls, owners, W/P…" className="h-9 w-64 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        {/* Toolbar filter dropdowns — COMMENTED OUT by user instruction
            (Jul 24): filtering moved into the table's column headers
            (HeaderFilter on Control / Nature / Conclusion). Resurrect by
            restoring the FilterSelect import alongside HeaderFilter.
        <FilterSelect prefix="Status" engaged={savedView !== 'all'} value={savedView}
          options={viewOptions.map(v => ({ value: v.id, label: `${v.label} (${viewCounts[v.id]})` }))}
          onChange={v => setSavedView(v as SavedView)} ariaLabel="Filter by status" />
        <FilterSelect value={process} options={processes} allLabel="All processes" onChange={setProcess} ariaLabel="Filter by process" />
        <FilterSelect value={nature} options={['All', 'Manual', 'Automated', 'IT-dependent']} allLabel="All natures" onChange={setNature} ariaLabel="Filter by nature" />
        */}
        <div className="flex-1" />
        <button onClick={() => setGrouped(g => !g)} className={cn('filter-pill', grouped && 'on')}><Layers size={13} /> Group</button>
        {layout === 'table' && <button onClick={() => setDense(d => !d)} className={cn('filter-pill', dense && 'on')}><Rows3 size={13} /> Dense</button>}
        {/* view toggle — icon-only, matching Reports' ToolbarViewToggle. Sized to
            this toolbar's h-9 rhythm rather than the h-10 the Reports toolbar runs. */}
        <div className="flex items-center gap-0.5 p-1 h-9 rounded-lg border border-canvas-border bg-canvas-elevated">
          <button onClick={() => setLayout('cards')} title="Card view" aria-label="Card view" aria-pressed={layout === 'cards'}
            className={cn('p-1.5 rounded-[7px] cursor-pointer transition-colors', layout === 'cards' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600')}><LayoutGrid size={15} /></button>
          <button onClick={() => setLayout('table')} title="Table view" aria-label="Table view" aria-pressed={layout === 'table'}
            className={cn('p-1.5 rounded-[7px] cursor-pointer transition-colors', layout === 'table' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600')}><Table2 size={15} /></button>
        </div>
        {/* the register's actions — view controls to their left, primary CTA last */}
        <span className="w-px h-6 bg-canvas-border mx-0.5" aria-hidden />
          {/* the consolidated paper carries materiality & the opinion — audit-side only */}
          {role !== 'risk-owner' && <button onClick={() => setWpPreview(true)} title="Export working paper" aria-label="Export working paper" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-canvas-border text-ink-500 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><FileSpreadsheet size={15} /></button>}
          {role === 'auditor' && !isEngagementLocked(eng) && <button onClick={() => setCreating(true)} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><Plus size={15} /> New control</button>}
      </div>

      {/* KPI rail — the summary band above the list (Overview's tile language) */}
      <div className="flex items-stretch gap-3 mb-4 flex-wrap">
        {[
          { k: role === 'risk-owner' ? 'Controls in your name' : 'Controls', v: scoped.length, t: 'text-ink-900' },
          { k: 'Tests due now', v: testsDueNow(scoped).length, t: 'text-mitigated-700' },
          { k: 'Effective', v: stats.effective, t: 'text-compliant-700' },
          { k: 'Awaiting review', v: stats.awaitingReview, t: 'text-evidence-700' },
          { k: role === 'risk-owner' ? 'Waiting on you' : 'Waiting on owner', v: stats.waitingOnOwner, t: 'text-mitigated-700' },
        ].map(s => (
          <div key={s.k} className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-2.5">
            <div className={cn('text-[20px] font-bold tabular-nums leading-6', s.t)}>{s.v}</div>
            <div className="text-[11.5px] text-ink-500 font-medium mt-0.5">{s.k}</div>
          </div>
        ))}
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
                {g.rows.map(c => (
                  <ControlCard key={c.id} c={c} discN={openDiscussionCount(eng, c.id)} noteN={pendingReviewNoteCount(eng, c.id)} onOpen={() => openControl(c.id)}
                    selectable={role === 'auditor'} selected={sel.has(c.id)} onToggle={() => toggle(c.id)} />
                ))}
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
              {/* column filters — the toolbar dropdowns moved up here */}
              <th><HeaderFilter label="Control" value={process} options={processes} allLabel="All processes" onChange={setProcess} ariaLabel="Filter by process" /></th>
              <th style={{ width: 96 }}><HeaderFilter label="Nature" value={nature} options={['All', 'Manual', 'Automated', 'IT-dependent']} allLabel="All natures" onChange={setNature} ariaLabel="Filter by nature" /></th>
              <th style={{ width: 150 }}>① Design</th>
              <th style={{ width: 168 }}>② Operating</th>
              <th style={{ width: 116 }}>
                <HeaderFilter label="Conclusion" value={savedView} engaged={savedView !== 'all'}
                  options={viewOptions.map(v => ({ value: v.id, label: `${v.label} (${viewCounts[v.id]})` }))}
                  onChange={v => setSavedView(v as SavedView)} ariaLabel="Filter by status" />
              </th>
              <th style={{ width: 116 }} title="Whose move it is — the auditor tests, the risk owner evidences and remediates, the reviewer countersigns">Court</th>
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
                  const noteN = pendingReviewNoteCount(eng, c.id);
                  return (
                    <tr key={c.id} className={cn('reg-row', sel.has(c.id) && 'sel')} onClick={() => openControl(c.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openControl(c.id); }} role="button" aria-label={`Open ${c.id} — ${c.description}`}>
                      <td onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) toggle(c.id); }}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="cursor-pointer accent-brand-600" aria-label={`Select ${c.id}`} /></td>
                      <td><span className="wp-ref">{c.wpRef}</span></td>
                      <td className="tight">
                        <div className="flex items-center gap-1.5">
                          {c.isKey && <Star size={12} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                          <span className="font-semibold text-ink-900 text-[12.5px] truncate max-w-[420px]">{c.description}</span>
                          {discN > 0 && <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-brand-700 bg-brand-50 px-1.5 h-[17px] rounded-full"><MessageSquare size={9} />{discN}</span>}
                          {noteN > 0 && <span title={`${noteN} review note${noteN === 1 ? '' : 's'} pending`} className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-high-700 bg-high-50 px-1.5 h-[17px] rounded-full"><StickyNote size={9} />{noteN}</span>}
                        </div>
                        <div className="text-[11px] text-ink-400 mt-0.5">
                          {c.id} · {c.subProcess} · {c.owner} ·{' '}
                          {(() => { const dd = testDueDisplay(c); return <span className={dd.cls}>{dd.label}</span>; })()}
                        </div>
                      </td>
                      <td><NatureChip nature={c.nature} small /></td>
                      <td><TrackCell result={trackResult(c.design)} a={dp.docsReceived} b={dp.docsTotal} label={`${dp.docsReceived}/${dp.docsTotal} docs`} /></td>
                      <td><TrackCell result={trackResult(c.operating)} a={op.passed} b={op.total} label={`${op.tested}/${op.total} · ${c.operating.method === 'Automated' ? 'auto' : 'manual'}`} /></td>
                      <td><ConclusionPill c={controlConclusion(c)} /></td>
                      <td><CourtBadge court={courtFor(c, eng.tasks, eng.reviewNotes)} fromRole={role} /></td>
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
      <div className="mt-3 text-[11.5px] text-ink-400">Showing {filtered.length} of {scoped.length} controls</div>

      {/* bulk bar */}
      {sel.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-ink-900 text-white rounded-2xl pl-4 pr-2.5 py-2.5 shadow-[0_12px_40px_-12px_rgba(15,8,30,0.6)]">
          <span className="text-[12.5px] font-semibold">{sel.size} selected</span>
          <span className="w-px h-5 bg-white/20" />
          {role === 'auditor' && <button onClick={() => { setBulkTestIds(Array.from(sel)); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><FlaskConical size={14} /> Test controls</button>}
          {role === 'auditor' && <button onClick={() => { requestDesignDocs(Array.from(sel)); addToast({ type: 'success', title: 'Requests sent', message: `Document requests raised on ${sel.size} control${sel.size === 1 ? '' : 's'} — the owners see them as tasks.` }); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><FileText size={14} /> Request design documents</button>}
          <button onClick={() => { openControl(Array.from(sel)[0]); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><Send size={14} /> Open first</button>
          <button onClick={() => setSel(new Set())} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      {/* bulk test — compile files → attach unique datasets → execute */}
      {bulkTestIds && <BulkTestModal controlIds={bulkTestIds} onClose={() => setBulkTestIds(null)} />}

      {/* create control — the focused form */}
      {creating && <NewControlPanel onClose={() => setCreating(false)} />}
      {/* the paper follows the filters — only the visible controls' data goes in */}
      {wpPreview && <WorkingPaperModal eng={eng} controls={filtered} onClose={() => setWpPreview(false)} />}

    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) { return <>{children}</>; }
