import { useEffect, useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Search, Plus, Building2, Rows3, MessageSquare,
  Star, FileText, X, Send, LayoutGrid, List, StickyNote,
} from 'lucide-react';
import { FilterSelect, HeaderFilter, triggerCls } from '../shared/FilterSelect';
import { useAuditControls } from './useAuditControls';
import { useIcfr } from './store';
import { defWord } from './flow';
import {
  conclusionOf, controlCode, courtFor, operatingApplies, designProgress, designStarted, isAwaitingReview, isControlFinal, isEngagementLocked, openDiscussionCount,
  operatingProgress, operatingStarted, isTestDueNow, pendingReviewNoteCount, testDueDisplay, testsDueNow, trackResult,
} from './helpers';
import { ConclusionPill, NatureChip, Th, Tickmark } from './parts';
import NewControlPanel from './NewControlPanel';
import WorkingPaperModal from './WorkingPaperModal';
import { useToast } from '../shared/Toast';
import { cn } from '../../lib/cn';
import { GROUP_OPTIONS, groupKeyOf, useColumnWidths, type GroupBy } from './registerColumns';
import { isOwnerOf, ownersOf } from './auditScope';
import type { Conclusion, Control } from './types';

type SavedView = 'all' | 'due' | 'court' | 'design' | 'design-done' | 'operating' | 'operating-done'
  | 'effective' | 'exceptions' | 'review' | 'owner' | 'open' | 'papers' | 'key';
const VIEWS: { id: SavedView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due now' },
  { id: 'court', label: 'My court' },
  { id: 'design', label: 'TOD' },
  { id: 'design-done', label: 'TOD concluded' },
  { id: 'operating', label: 'TOE' },
  { id: 'operating-done', label: 'TOE concluded' },
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

// ── Columns ─────────────────────────────────────────────────────────────────────
//
// Order and starting width, in one place, because three things read it: the
// <colgroup> that lays the table out, the drag handles that resize it, and the
// group row's colSpan. `table-layout: fixed` makes the colgroup authoritative —
// content no longer votes on width, which is what lets a drag actually hold.
const REG_COLS = [
  { key: 'process', w: 130 },
  { key: 'control', w: 330 },
  { key: 'entity', w: 160 },
  { key: 'type', w: 124 },
  { key: 'frequency', w: 116 },
  { key: 'owner', w: 144 },
  { key: 'objective', w: 250 },
  { key: 'nature', w: 108 },
  { key: 'design', w: 150 },
  { key: 'operating', w: 168 },
  { key: 'conclusion', w: 126 },
  // Court removed Aug 2026 (Step-2 action item 3). Whose move it is still drives
  // the 'My court' saved view and the badge in the control-page header — only the
  // register column went.
] as const;
/** Widths are the reader's, not ours — they survive the session. */
const COLW_KEY = 'sox-register-colw';

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

function ControlCard({ c, concl, discN, noteN, onOpen, selectable, selected, onToggle }: { c: Control; concl: Conclusion; discN: number; noteN: number; onOpen: () => void; selectable?: boolean; selected?: boolean; onToggle?: () => void }) {
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
        </span>
      </div>
      <h3 className="ac-title mt-2">{c.description}</h3>
      <div className="ac-meta">
        {controlCode(c)} · {c.nature} ·{' '}
        {(() => { const dd = testDueDisplay(c); return <span className={dd.cls}>{dd.label}</span>; })()}
      </div>
      {/* The company this row is tested at, on its own line — a company name and
          a process name side by side in the eyebrow left neither of them
          readable, and in a group audit the entity is the stronger identity: the
          same control number at another company is a different card, with its own
          design, its own sample and its own conclusion. */}
      {c.entity && (
        <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-ink-600 min-w-0" title={c.entity}>
          <Building2 size={11} className="text-ink-300 shrink-0" />
          <span className="truncate font-medium">{c.entity}</span>
        </div>
      )}
      <div className="ac-div" />
      <div className="space-y-1.5">
        <CardTrack label="TOD" res={trackResult(c.design)} started={designStarted(c)} />
        <CardTrack label="TOE" res={trackResult(c.operating)} started={operatingStarted(c)} />
      </div>
      <div className="mt-3"><ConclusionPill c={concl} /></div>
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
  const [creating, setCreating] = useState(false);
  // The register shows what the OPEN audit covers — its entities' processes.
  const auditScoped = useAuditControls(eng.controls);
  // Classic engagements still say Exceptions; the rework renamed them.
  const viewOptions = useMemo(
    () => VIEWS.map(v => ({ ...v, label: v.id === 'exceptions' ? defWord(eng.id).Many : v.label })),
    [eng.id],
  );
  // preview-before-download for the consolidated working paper, and for the audit
  // report — the deliverable the paper isn't. Same modal, same block format.
  const [wpPreview, setWpPreview] = useState(false);
  const [reportPreview, setReportPreview] = useState(false);
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
  const [entity, setEntity] = useState('All');
  const [ctype, setCtype] = useState('All');
  const [frequency, setFrequency] = useState('All');
  const [owner, setOwner] = useState('All');

  const { widthOf, totalWidth, th } = useColumnWidths(COLW_KEY, REG_COLS);
  // What the register is stacked by. Process is how an audit is planned; entity is
  // how a group audit is reported ("is Solar done?"), and the register carries one
  // row per control per company, so both are real ways to read the same list.
  const [groupBy, setGroupBy] = useState<GroupBy>('process');
  const [dense, setDense] = useState(false);
  // Inside an audit the register is a working list, not a browse surface — open on the
  // table so every control's state is legible in one scan. The card view stays a click away.
  const [layout, setLayout] = useState<'cards' | 'table'>('table');
  const [sel, setSel] = useState<Set<string>>(new Set());

  // Person-lane: the owner's register is their own controls, never the engagement's.
  // Either capacity counts — accountable for it, or running it. See ownersOf.
  const scoped = useMemo(
    () => (role === 'risk-owner' ? auditScoped.filter(c => isOwnerOf(c, meOwner)) : auditScoped),
    [auditScoped, role, meOwner],
  );
  const stats = useMemo(() => ({
    effective: scoped.filter(c => conclusionOf(eng, c) === 'Effective').length,
    awaitingReview: scoped.filter(isAwaitingReview).length,
    waitingOnOwner: scoped.filter(c => courtFor(c, eng.tasks, eng.reviewNotes) === 'risk-owner').length,
  }), [scoped, eng.tasks, eng.reviewNotes]);
  // Column-filter option lists — built from what is actually in front of you, so a
  // filter can never offer a value that returns nothing.
  const processes = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.process)))], [scoped]);
  const entities = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.entity).filter(Boolean) as string[])).sort()], [scoped]);
  const frequencies = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.frequency)))], [scoped]);
  const owners = useMemo(() => ['All', ...Array.from(new Set(scoped.flatMap(c => { const o = ownersOf(c); return o.single ? [o.controlOwner] : [o.controlOwner, o.processOwner]; }))).sort()], [scoped]);
  const ctypes = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.type))).sort()], [scoped]);

  const matchesView = (c: Control, v: SavedView): boolean => {
    if (v === 'due') return isTestDueNow(c);
    if (v === 'court') return courtFor(c, eng.tasks, eng.reviewNotes) === role;
    if (v === 'design') return trackResult(c.design) === 'Not tested';
    if (v === 'design-done') return trackResult(c.design) !== 'Not tested';
    if (v === 'operating') return trackResult(c.operating) === 'Not tested';
    if (v === 'operating-done') return trackResult(c.operating) !== 'Not tested';
    if (v === 'effective') return conclusionOf(eng, c) === 'Effective';
    if (v === 'exceptions') return conclusionOf(eng, c) === 'Ineffective';
    if (v === 'review') return isAwaitingReview(c);
    if (v === 'owner') return courtFor(c, eng.tasks, eng.reviewNotes) === 'risk-owner';
    if (v === 'open') return conclusionOf(eng, c) === 'In progress';
    if (v === 'papers') return conclusionOf(eng, c) !== 'In progress' && !isControlFinal(c);
    if (v === 'key') return c.isKey;
    return true;
  };
  // search + process + nature first — the Status dropdown's counts read from this base
  const base = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scoped.filter(c => {
      if (process !== 'All' && c.process !== process) return false;
      if (nature !== 'All' && c.nature !== nature) return false;
      if (entity !== 'All' && c.entity !== entity) return false;
      if (ctype !== 'All' && c.type !== ctype) return false;
      if (frequency !== 'All' && c.frequency !== frequency) return false;
      if (owner !== 'All' && !isOwnerOf(c, owner)) return false;
      if (term && !(`${controlCode(c)} ${c.description} ${c.entity ?? ''} ${c.process} ${c.subProcess} ${c.owner}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [scoped, q, process, nature, entity, ctype, frequency, owner]);
  const filtered = useMemo(() => base.filter(c => matchesView(c, savedView)), [base, savedView, eng.tasks, eng.reviewNotes, role]);
  const viewCounts = useMemo(
    () => Object.fromEntries(VIEWS.map(v => [v.id, base.filter(c => matchesView(c, v.id)).length])) as Record<SavedView, number>,
    [base, eng.tasks, eng.reviewNotes, role],
  );

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', rows: filtered }];
    const map = new Map<string, Control[]>();
    for (const c of filtered) {
      const k = groupKeyOf(c, groupBy);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    return Array.from(map, ([key, rows]) => ({ key, rows: rows.sort((a, b) => controlCode(a).localeCompare(controlCode(b))) }));
  }, [filtered, groupBy]);

  // PARKED (Aug 2026) — select-all went with the checkbox column. `toggle` stays:
  // the card view still selects, and that is what feeds the bulk bar.
  //   const allVisible = filtered.map(c => c.id);
  //   const allSelected = allVisible.length > 0 && allVisible.every(id => sel.has(id));
  //   const toggleAll = () => setSel(allSelected ? new Set() : new Set(allVisible));
  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const colSpan = REG_COLS.length;

  return (
    <div>
      {/* toolbar — first, matching the sibling tabs (RACM, Risk Register), so the
          filters sit directly under the tab bar. Status folds the saved views in. */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search controls and owners…" className="h-9 w-64 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
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
        {/* No "GROUP" prefix — the value says it ("Process", "Entity", "No
            grouping") and the label was doing nothing the words don't. */}
        <FilterSelect value={groupBy} options={GROUP_OPTIONS} engaged={groupBy !== 'none'}
          onChange={v => setGroupBy(v as GroupBy)} ariaLabel="Group the register by" align="right" />
        {/* Dense wears the dropdown's trigger shape, not `.filter-pill` — that
            class is 28px tall and everything else on this row is 36px. */}
        {layout === 'table' && (
          <button onClick={() => setDense(d => !d)} className={triggerCls(dense, false)} aria-pressed={dense}>
            <Rows3 size={13} className={dense ? 'text-brand-600' : 'text-ink-400'} /> Dense
          </button>
        )}
        {/* view toggle — the platform's ToolbarViewToggle (shared/ListToolbar.tsx) to the
            letter: list on the left, grid on the right, same icons and active chip. Only the
            shell height follows this toolbar's h-9 rhythm instead of the Reports h-10. */}
        {/* p-0.5, not p-1: the 16px icons in p-1.5 buttons are 28px tall, which
            overflowed a p-1 wrapper's 26px content box and left the active chip
            kissing the border. */}
        <div className="flex items-center gap-0.5 p-0.5 h-9 rounded-lg border border-canvas-border bg-canvas-elevated">
          <button onClick={() => setLayout('table')} title="List view" aria-label="List view" aria-pressed={layout === 'table'}
            className={cn('p-1.5 rounded-sm cursor-pointer transition-colors', layout === 'table' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600')}><List size={16} /></button>
          <button onClick={() => setLayout('cards')} title="Grid view" aria-label="Grid view" aria-pressed={layout === 'cards'}
            className={cn('p-1.5 rounded-sm cursor-pointer transition-colors', layout === 'cards' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600')}><LayoutGrid size={16} /></button>
        </div>
        {/* the register's actions — view controls to their left, primary CTA last */}
        <span className="w-px h-6 bg-canvas-border mx-0.5" aria-hidden />
          {/* The working paper, back on the toolbar (Aug 2026). It was parked as
              clutter, but parking it took the ENGAGEMENT paper's only door with
              it: buildIcfrPaper still assembles Index, Control Summary, TOE and
              Scope, and nothing opened them. Audit report is a different
              document — what management reads, not the evidence file — so it was
              never a substitute. Labelled rather than icon-only this time, so it
              reads as its own deliverable beside the report.
              Absent for the risk owner: see the note on the control page. */}
          {role !== 'risk-owner' && <button onClick={() => setWpPreview(true)} title="The audit's evidence file — every control the filters leave visible" aria-label="Export working paper" className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><FileSpreadsheet size={14} /> Working paper</button>}
          {/* the audit report — what management and the board actually read: the
              observations, what they are worth, and who has committed to the fix */}
          {role !== 'risk-owner' && <button onClick={() => setReportPreview(true)} title="Audit report — observations and the management action plan" className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><FileText size={14} /> Audit report</button>}
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

      {/* register body — table (default) or cards */}
      {layout === 'cards' ? (
        <div>
          {groups.map(g => (
            <div key={g.key || 'flat'} className="shelf">
              {g.key && (
                <div className="shelf-head">
                  <span className="shelf-swatch" style={{ background: spineColor(g.key) }} />
                  <span className="shelf-title">{g.key}</span>
                  <span className="text-[11.5px] text-ink-400 font-medium">· {g.rows.length}</span>
                  <span className="text-[10.5px] font-semibold text-ink-400 hidden md:inline">{g.rows.filter(c => trackResult(c.design) !== 'Not tested').length} TOD · {g.rows.filter(c => trackResult(c.operating) !== 'Not tested').length} TOE concluded</span>
                  <span className="shelf-board" />
                </div>
              )}
              <div className="card-grid">
                {g.rows.map(c => (
                  <ControlCard key={c.id} c={c} concl={conclusionOf(eng, c)} discN={openDiscussionCount(eng, c.id)} noteN={pendingReviewNoteCount(eng, c.id)} onOpen={() => openControl(c.id)}
                    selectable={role === 'auditor'} selected={sel.has(c.id)} onToggle={() => toggle(c.id)} />
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-ink-400 text-[13px] rounded-2xl border border-dashed border-canvas-border">No controls match these filters. <button onClick={() => { setQ(''); setProcess('All'); setNature('All'); setEntity('All'); setCtype('All'); setFrequency('All'); setOwner('All'); setSavedView('all'); }} className="text-brand-700 font-semibold hover:underline">Clear filters</button></div>
          )}
        </div>
      ) : (
      <div className={cn('reg-wrap', dense && 'reg-dense')}>
        {/* The register carries the RACM's own columns now, so it is wider than a
            screen — the wrapper scrolls sideways rather than crushing the text.
            Fixed layout + a colgroup means the widths are the ones on record, not
            whatever the longest cell argued for, which is what makes a drag hold. */}
        <table className="border-collapse" style={{ tableLayout: 'fixed', width: totalWidth }}>
          <colgroup>{REG_COLS.map(c => <col key={c.key} style={{ width: widthOf(c.key) }} />)}</colgroup>
          <thead className="reg-head">
            <tr>
              {/* Column filters live in the headers — the toolbar dropdowns moved
                  up here (Jul 24), and Entity / Control type / Frequency / Owner
                  joined them once the register went one-row-per-company. */}
              <Th {...th('process')}><HeaderFilter label="Process" value={process} options={processes} allLabel="All processes" onChange={setProcess} ariaLabel="Filter by process" /></Th>
              <Th {...th('control')}>Control</Th>
              <Th {...th('entity')}><HeaderFilter label="Entity" value={entity} options={entities} allLabel="All entities" onChange={setEntity} ariaLabel="Filter by entity" /></Th>
              <Th {...th('type')} title="Preventive controls stop it happening; detective controls find it after it has">
                <HeaderFilter label="Control type" value={ctype} options={ctypes} allLabel="All types" onChange={setCtype} ariaLabel="Filter by control type" />
              </Th>
              <Th {...th('frequency')}><HeaderFilter label="Frequency" value={frequency} options={frequencies} allLabel="All frequencies" onChange={setFrequency} ariaLabel="Filter by frequency" /></Th>
              <Th {...th('owner')}><HeaderFilter label="Control Owner" value={owner} options={owners} allLabel="All control owners" onChange={setOwner} ariaLabel="Filter by control owner" /></Th>
              <Th {...th('objective')} title="What the control is for — the outcome it secures">Objective</Th>
              <Th {...th('nature')}><HeaderFilter label="Nature" value={nature} options={['All', 'Manual', 'Automated', 'IT-dependent']} allLabel="All natures" onChange={setNature} ariaLabel="Filter by nature" /></Th>
              <Th {...th('design')}>① TOD</Th>
              <Th {...th('operating')}>② TOE</Th>
              <Th {...th('conclusion')}>
                <HeaderFilter label="Conclusion" value={savedView} engaged={savedView !== 'all'}
                  options={viewOptions.map(v => ({ value: v.id, label: `${v.label} (${viewCounts[v.id]})` }))}
                  onChange={v => setSavedView(v as SavedView)} ariaLabel="Filter by status" />
              </Th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <FragmentGroup key={g.key || 'flat'}>
                {g.key && (
                  <tr className="reg-group-row"><td colSpan={colSpan}>
                    <span className="inline-flex items-center gap-2">{g.key}<span className="text-ink-400 font-medium">· {g.rows.length}</span>
                      <span className="ml-2 text-[10.5px] font-semibold text-ink-400">
                        {g.rows.filter(c => trackResult(c.design) !== 'Not tested').length} TOD · {g.rows.filter(c => trackResult(c.operating) !== 'Not tested').length} TOE concluded
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
                      {/* PARKED (Aug 2026) — the select-all / per-row checkbox column.
                          Selection still runs on the CARD view, which is what feeds the
                          bulk bar, so nothing downstream is dead.
                      <td onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) toggle(c.id); }}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="cursor-pointer accent-brand-600" aria-label={`Select ${c.id}`} /></td>
                      */}
                      <td className="text-[0.71875rem] text-ink-600"><span className="truncate block" title={c.process}>{c.process}</span></td>
                      <td className="tight">
                        <div className="flex items-center gap-1.5">
                          {c.isKey && <Star size={12} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                          <span className="font-semibold text-ink-900 text-[12.5px] truncate min-w-0">{c.description}</span>
                          {discN > 0 && <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-brand-700 bg-brand-50 px-1.5 h-[17px] rounded-full"><MessageSquare size={9} />{discN}</span>}
                          {noteN > 0 && <span title={`${noteN} review note${noteN === 1 ? '' : 's'} pending`} className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-high-700 bg-high-50 px-1.5 h-[17px] rounded-full"><StickyNote size={9} />{noteN}</span>}
                        </div>
                        {/* process and owner have their own columns now — saying
                            them twice on the same row is noise. */}
                        <div className="text-[11px] text-ink-400 mt-0.5">
                          {controlCode(c)} · {c.subProcess} ·{' '}
                          {(() => { const dd = testDueDisplay(c); return <span className={dd.cls}>{dd.label}</span>; })()}
                        </div>
                      </td>
                      <td className="text-[0.71875rem] text-ink-700">
                        {c.entity
                          ? <span className="inline-flex items-center gap-1.5 min-w-0" title={c.entity}><Building2 size={12} className="text-ink-300 shrink-0" /><span className="truncate">{c.entity}</span></span>
                          : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="text-[0.71875rem] text-ink-600">{c.type}</td>
                      <td className="text-[0.71875rem] text-ink-600">{c.frequency}</td>
                      <td className="text-[0.71875rem] text-ink-600"><span className="truncate block" title={c.owner}>{c.owner}</span></td>
                      <td className="text-[0.71875rem] text-ink-500">
                        <span className="reg-clamp" title={c.objective ?? undefined}>{c.objective ?? '—'}</span>
                      </td>
                      <td><NatureChip nature={c.nature} small /></td>
                      <td><TrackCell result={trackResult(c.design)} a={dp.docsReceived} b={dp.docsTotal} label={`${dp.docsReceived}/${dp.docsTotal} docs`} /></td>
                      {/* An automated control with its ITGCs holding never gets a
                          TOE, so the cell says so rather than reading "Not tested"
                          — which would put it on the auditor's list forever. */}
                      <td>{operatingApplies(eng, c)
                        ? <TrackCell result={trackResult(c.operating)} a={op.passed} b={op.total} label={`${op.tested}/${op.total} · ${c.operating.method === 'Automated' ? 'auto' : 'manual'}`} />
                        : <span className="text-[0.6875rem] text-ink-400" title="Automated control — the design test is the whole test while the ITGCs hold">n/a · automated</span>}</td>
                      <td><ConclusionPill c={conclusionOf(eng, c)} /></td>
                    </tr>
                  );
                })}
              </FragmentGroup>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={colSpan} className="text-center py-16 text-ink-400 text-[13px]">No controls match these filters. <button onClick={() => { setQ(''); setProcess('All'); setNature('All'); setEntity('All'); setCtype('All'); setFrequency('All'); setOwner('All'); setSavedView('all'); }} className="text-brand-700 font-semibold hover:underline">Clear filters</button></td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      <div className="mt-3 text-[11.5px] text-ink-400">Showing {filtered.length} of {scoped.length} controls</div>

      {/* bulk bar — no bulk TEST here (user ask, 30 Jul: SOX controls aren't
          bulk-tested) */}
      {sel.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-ink-900 text-white rounded-2xl pl-4 pr-2.5 py-2.5 shadow-[0_12px_40px_-12px_rgba(15,8,30,0.6)]">
          <span className="text-[12.5px] font-semibold">{sel.size} selected</span>
          <span className="w-px h-5 bg-white/20" />
          {role === 'auditor' && <button onClick={() => { requestDesignDocs(Array.from(sel)); addToast({ type: 'success', title: 'Requests sent', message: `Document requests raised on ${sel.size} control${sel.size === 1 ? '' : 's'} — the owners see them as tasks.` }); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><FileText size={14} /> Request design documents</button>}
          <button onClick={() => { openControl(Array.from(sel)[0]); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><Send size={14} /> Open first</button>
          <button onClick={() => setSel(new Set())} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      {/* create control — the focused form */}
      {creating && <NewControlPanel onClose={() => setCreating(false)} />}
      {/* the paper follows the filters — only the visible controls' data goes in */}
      {wpPreview && <WorkingPaperModal eng={eng} controls={filtered} onClose={() => setWpPreview(false)} />}
      {reportPreview && <WorkingPaperModal eng={eng} controls={filtered} report onClose={() => setReportPreview(false)} />}

    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) { return <>{children}</>; }
