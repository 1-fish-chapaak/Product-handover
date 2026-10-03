import { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Plus, Download, Star, Link2, Eye, Pencil, Trash2, Workflow, Share2, Search, ChevronRight,
  Check, Minus, ArrowRight, FileSearch, CircleDashed, Database, ChevronsUpDown, Sparkles,
} from 'lucide-react';
import AIRecommendsPopover from '../shared/AIRecommendsPopover';
import { actionableRecs } from '../../data/layeredInsights';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { useAuditLog } from '../../context/AdminDataContext';
import { WORKFLOWS } from '../../data/mockData';
import CreateControlDrawer, { type NewControlData } from './CreateControlDrawer';
import { useCreatedControls } from '../../data/createdControlsStore';
import ControlDetailView from './ControlDetailView';
import { LinkWorkflowToControlDrawer, type ControlWorkflow } from '../audit/RacmMappingWorkspace';
import { type ControlRow, BP_COLORS } from './controlTypes';
import { CONTROL_LIBRARY } from '../../data/controlLibrary';
import {
  CHECK_CATALOG, PROCESS_LONG, filesForEntry, standardControlRows, useAdaptedKeys, readinessOf,
  type FileSourceChoice,
} from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { Button } from '../shared/Button';
import AdaptDataModal from '../audit-plan/AdaptDataModal';

/* ─── Control Library ───────────────────────────────────────────────────────
 * Dense, grouped register. Two kinds of control live here:
 *   • Standard library — preloaded in every account, each with a standard
 *     workflow. "Needs data" until adapted to the client's files; adapting
 *     keeps it Standard and makes it Ready.
 *   • Custom — the client's own controls.
 * One line per control so a screen holds ~15 of them; a row expands in
 * place for the detail that used to need its own column.
 * ──────────────────────────────────────────────────────────────────────── */

interface ControlLibraryProps {
  /** When set, filters controls to this process and pre-fills create drawer */
  processFilter?: string;
  /** Adapt standard controls: the chosen keys and where each file comes from. */
  onAdapt?: (keys: string[], choices: Record<string, FileSourceChoice | null>) => void;
}

type LibTab = 'all' | 'standard' | 'custom';
type RowStatus = 'ready' | 'needs-data' | 'manual' | 'no-workflow' | 'draft';
type StatusFilter = 'all' | RowStatus;

const PROCESS_ORDER: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];

const STATUS_META: Record<RowStatus, { label: string; cls: string; dot: string }> = {
  ready:         { label: 'Ready',       cls: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-500' },
  'needs-data':  { label: 'Needs data',  cls: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated-500' },
  manual:        { label: 'Manual test', cls: 'bg-paper-100 text-ink-600',          dot: 'bg-ink-300' },
  'no-workflow': { label: 'No workflow', cls: 'bg-high-50 text-high-700',           dot: 'bg-high-500' },
  draft:         { label: 'Draft',       cls: 'bg-draft-50 text-draft-700',         dot: 'bg-ink-300' },
};

const isStd = (c: ControlRow) => c.library === 'standard';

function statusOf(c: ControlRow, adapted: string[]): RowStatus {
  if (isStd(c)) {
    const e = CHECK_CATALOG.find(x => x.key === c.stdKey);
    return e ? readinessOf(e, adapted) : 'needs-data';
  }
  if (c.status === 'Draft') return 'draft';
  return c.linkedWorkflows.length > 0 ? 'ready' : c.automation === 'Manual' ? 'manual' : 'no-workflow';
}

/** Grid shared by the column header and every row, so they line up. */
const GRID = 'grid grid-cols-[1.75rem_1.25rem_5.5rem_minmax(0,1fr)_5.5rem_minmax(0,15rem)_7.5rem_6.5rem] items-center gap-x-3';

export default function ControlLibraryView({ processFilter, onAdapt }: ControlLibraryProps) {
  const { addToast } = useToast();
  const { can } = useCan();
  const { openShare } = useShare();
  const logEvent = useAuditLog();
  const reduced = useReducedMotion();

  const [controls, setControls] = useState<ControlRow[]>(CONTROL_LIBRARY);
  const created = useCreatedControls();
  const adapted = useAdaptedKeys();

  // Controls created via the wizard (e.g. a risk's Link Control → Create Control)
  // are merged in — newest first — so they appear in the global library too.
  const createdRows: ControlRow[] = created.map(c => {
    const linkedWorkflows: string[] = [];
    const linkedWorkflowIds: string[] = [];
    if (c.workflowChoice === 'link' && c.linkedWorkflowId) {
      const wf = WORKFLOWS.find(w => w.id === c.linkedWorkflowId);
      if (wf) { linkedWorkflows.push(wf.name); linkedWorkflowIds.push(wf.id); }
    }
    return {
      id: c.id, controlId: c.id,
      name: c.name, description: c.description, objective: c.objective,
      businessProcess: c.businessProcess as ControlRow['businessProcess'],
      subProcess: c.subProcess,
      classification: c.classification, nature: c.nature, automation: c.automation,
      frequency: c.frequency, owner: c.owner,
      assertions: c.assertions, mappedRisks: c.mappedRisks,
      linkedWorkflows, linkedWorkflowIds,
      usedInRACMs: 0,
      status: (c.workflowChoice === 'link' && c.linkedWorkflowId) ? 'Active' : 'Draft',
      createdAt: c.createdAt, updatedAt: c.createdAt,
    };
  });
  const standardRows = useMemo(() => standardControlRows(adapted), [adapted]);
  const allControls = [...createdRows, ...controls, ...standardRows];

  // Detail view state. On mount, honour a sessionStorage hand-off so
  // deep-links from elsewhere (e.g. the homepage Control Breaks chip) can
  // land directly on a specific control's detail page.
  const [selectedControlId, setSelectedControlId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const pending = window.sessionStorage.getItem('control-library.open-control-id');
    if (pending) {
      window.sessionStorage.removeItem('control-library.open-control-id');
      return pending;
    }
    return null;
  });
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [linkWfControlId, setLinkWfControlId] = useState<string | null>(null);

  const [tab, setTab] = useState<LibTab>('all');
  const [groupByProcess, setGroupByProcess] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [keyOnly, setKeyOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adaptKeys, setAdaptKeys] = useState<string[] | null>(null);

  const selectedControl = selectedControlId ? allControls.find(c => c.id === selectedControlId) : null;
  if (selectedControl) {
    return (
      <ControlDetailView
        control={selectedControl}
        onBack={() => setSelectedControlId(null)}
        onUpdate={(updated) => setControls(prev => prev.map(c => (c.id === updated.id ? updated : c)))}
      />
    );
  }

  // ── Derivations ──
  const base = processFilter ? allControls.filter(c => c.businessProcess === processFilter) : allControls;
  const counts = {
    all: base.length,
    standard: base.filter(isStd).length,
    custom: base.filter(c => !isStd(c)).length,
  };
  const inTab = base.filter(c => (tab === 'all' ? true : tab === 'standard' ? isStd(c) : !isStd(c)));
  const q = query.trim().toLowerCase();
  const visible = inTab.filter(c => {
    if (keyOnly && c.classification !== 'Key') return false;
    if (statusFilter !== 'all' && statusOf(c, adapted) !== statusFilter) return false;
    if (q && ![c.controlId, c.name, c.businessProcess, c.subProcess, ...c.linkedWorkflows].some(v => v.toLowerCase().includes(q))) return false;
    return true;
  });
  const statusCount = (s: RowStatus) => inTab.filter(c => statusOf(c, adapted) === s).length;
  const adaptable = (c: ControlRow) => isStd(c) && statusOf(c, adapted) === 'needs-data';
  const needsDataAll = base.filter(adaptable);

  const groups: { key: string; label: string; process?: ProcessCode; rows: ControlRow[] }[] = groupByProcess
    ? PROCESS_ORDER
        .map(p => ({ key: p, label: PROCESS_LONG[p], process: p, rows: visible.filter(c => c.businessProcess === p) }))
        .filter(g => g.rows.length > 0)
    : [{ key: 'all', label: 'All controls', rows: visible }];

  const keysOf = (rows: ControlRow[]) => rows.filter(adaptable).map(c => c.stdKey!).filter(Boolean);
  const selectedKeys = [...selected];
  const selectedFileCount = new Set(
    selectedKeys.flatMap(k => { const e = CHECK_CATALOG.find(x => x.key === k); return e ? filesForEntry(e).map(f => f.id) : []; }),
  ).size;

  const toggleSel = (key: string) => setSelected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const setGroupSel = (keys: string[], on: boolean) => setSelected(s => {
    const n = new Set(s);
    keys.forEach(k => (on ? n.add(k) : n.delete(k)));
    return n;
  });
  const openAdapt = (keys: string[]) => { if (keys.length > 0) setAdaptKeys(keys); };

  // ── Create control (unchanged behaviour) ──
  const handleCreateControl = (data: NewControlData) => {
    const nextNum = controls.length + 1;
    const controlId = `C-${String(nextNum).padStart(3, '0')}`;
    const linkedWorkflowNames: string[] = [];
    const linkedWorkflowIds: string[] = [];
    if (data.workflowChoice === 'link' && data.linkedWorkflowId) {
      const wf = WORKFLOWS.find(w => w.id === data.linkedWorkflowId);
      if (wf) { linkedWorkflowNames.push(wf.name); linkedWorkflowIds.push(wf.id); }
    }
    const newControl: ControlRow = {
      id: controlId, controlId,
      name: data.name, description: data.description, objective: data.objective,
      businessProcess: data.businessProcess as ControlRow['businessProcess'],
      subProcess: data.subProcess,
      classification: data.classification, nature: data.nature, automation: data.automation,
      frequency: data.frequency, owner: data.owner,
      assertions: data.assertions, mappedRisks: data.mappedRisks,
      linkedWorkflows: linkedWorkflowNames, linkedWorkflowIds,
      usedInRACMs: 0,
      status: data.workflowChoice === 'link' && data.linkedWorkflowId ? 'Active' : 'Draft',
      createdAt: 'Apr 25, 2026', updatedAt: 'Apr 25, 2026',
    };
    setControls(prev => [newControl, ...prev]);
    setShowCreateDrawer(false);
    addToast({ message: `Control ${controlId} "${data.name}" created`, type: 'success' });
    logEvent({ action: 'Create', description: `Created control "${data.name}" (${controlId})`, module: 'Control Library', entity: 'Control' });
    setSelectedControlId(controlId);
  };

  const readyCount = base.filter(c => statusOf(c, adapted) === 'ready').length;

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="px-8 pt-7 pb-28 max-w-[96rem] mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[1.5rem] font-semibold tracking-tight text-ink-900">Control Library</h1>
            <p className="text-[0.8125rem] text-ink-500 mt-0.5">
              Your controls and the standard library — every control with the test that evidences it.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-ink-500 tabular-nums">
              <span><span className="font-semibold text-ink-900">{base.length}</span> controls</span>
              <span><span className="font-semibold text-ink-900">{readyCount}</span> ready</span>
              {needsDataAll.length > 0 && <span className="text-mitigated-700"><span className="font-semibold">{needsDataAll.length}</span> standard workflows need your data</span>}
              <span><span className="font-semibold text-ink-900">{base.filter(c => c.classification === 'Key').length}</span> key</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {can('ctrl_export') && (
              <Button
                variant="outline"
                leftIcon={<Download size={14} />}
                onClick={() => {
                  addToast({ message: 'Control library exported as CSV', type: 'success' });
                  logEvent({ action: 'Export', description: `Exported the control library (${base.length} controls) as CSV`, module: 'Control Library', entity: 'Control' });
                }}
              >
                Export
              </Button>
            )}
            {can('ctrl_create') && (
              <Button variant="outline" leftIcon={<Plus size={14} />} onClick={() => setShowCreateDrawer(true)}>Create control</Button>
            )}
            {needsDataAll.length > 0 && (
              <Button variant="primary" leftIcon={<Sparkles size={14} />} onClick={() => openAdapt(keysOf(needsDataAll))}>
                Adapt {needsDataAll.length} with your data
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Library" className="flex items-center gap-6 border-b border-canvas-border">
          {([
            { id: 'all', label: 'All' },
            { id: 'standard', label: 'Standard library' },
            { id: 'custom', label: 'Custom' },
          ] as { id: LibTab; label: string }[]).map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setStatusFilter('all'); }}
              className={`relative h-10 text-[0.8125rem] font-medium cursor-pointer transition-colors ${tab === t.id ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}
            >
              {t.label} <span className="ml-1 font-mono text-[0.6875rem] text-ink-400 tabular-nums">{counts[t.id]}</span>
              {tab === t.id && <motion.span layoutId="cl-tab" className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600" transition={reduced ? { duration: 0 } : { duration: 0.2 }} />}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 py-3">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ID, control, workflow…"
              aria-label="Search controls"
              className="w-full h-8 pl-8 pr-3 rounded-md border border-canvas-border text-[0.8125rem] outline-none focus:border-brand-300 focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Filter by status">
            {(['all', 'ready', 'needs-data', 'manual', 'no-workflow', 'draft'] as StatusFilter[])
              .filter(s => s === 'all' || statusCount(s as RowStatus) > 0)
              .map(s => (
                <button
                  key={s}
                  aria-pressed={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  className={`h-7 px-2.5 rounded-full text-[0.75rem] font-medium cursor-pointer transition-colors ${statusFilter === s ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-paper-100'}`}
                >
                  {s === 'all' ? 'Any status' : STATUS_META[s as RowStatus].label}
                  {s !== 'all' && <span className="ml-1 tabular-nums opacity-70">{statusCount(s as RowStatus)}</span>}
                </button>
              ))}
            <button
              aria-pressed={keyOnly}
              onClick={() => setKeyOnly(k => !k)}
              className={`h-7 px-2.5 rounded-full text-[0.75rem] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 ${keyOnly ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-paper-100'}`}
            >
              <Star size={11} className={keyOnly ? 'fill-white' : ''} /> Key only
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[0.75rem] text-ink-500 tabular-nums">{visible.length} shown</span>
            <label className="flex items-center gap-1.5 text-[0.75rem] text-ink-600">
              Group by
              <select
                value={groupByProcess ? 'process' : 'none'}
                onChange={e => setGroupByProcess(e.target.value === 'process')}
                className="h-8 rounded-md border border-canvas-border px-2 text-[0.75rem] text-ink-800 outline-none cursor-pointer"
              >
                <option value="process">Process</option>
                <option value="none">None</option>
              </select>
            </label>
            {groupByProcess && (
              <button
                onClick={() => setCollapsed(c => (c.size > 0 ? new Set() : new Set(groups.map(g => g.key))))}
                className="h-8 px-2 rounded-md text-[0.75rem] text-ink-600 hover:bg-paper-100 inline-flex items-center gap-1 cursor-pointer"
                title={collapsed.size > 0 ? 'Expand all groups' : 'Collapse all groups'}
              >
                <ChevronsUpDown size={13} /> {collapsed.size > 0 ? 'Expand' : 'Collapse'}
              </button>
            )}
          </div>
        </div>

        {/* Register */}
        <div className="rounded-lg border border-canvas-border overflow-hidden">
          <div className={`${GRID} h-8 px-3 bg-paper-50 border-b border-canvas-border text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400`}>
            <span /><span /><span>ID</span><span>Control</span><span>Library</span><span>Workflow</span><span>Status</span><span className="text-right">Actions</span>
          </div>

          {groups.length === 0 && (
            <div className="px-6 py-14 text-center text-[0.8125rem] text-ink-500">No controls match these filters.</div>
          )}

          {groups.map(g => {
            const isCollapsed = collapsed.has(g.key);
            const gKeys = keysOf(g.rows);
            const gSel = gKeys.filter(k => selected.has(k)).length;
            const gReady = g.rows.filter(c => statusOf(c, adapted) === 'ready').length;
            return (
              <section key={g.key} aria-label={g.label}>
                {groupByProcess && (
                  <div className="flex items-center gap-3 h-10 px-3 bg-white border-b border-canvas-border sticky top-0 z-[1]">
                    <span className="w-7 flex justify-center">
                      {gKeys.length > 0 && (
                        <TickBox
                          state={gSel === 0 ? false : gSel === gKeys.length ? true : 'mixed'}
                          label={`Select ${g.label} controls that need data`}
                          onClick={() => setGroupSel(gKeys, gSel !== gKeys.length)}
                        />
                      )}
                    </span>
                    <button
                      onClick={() => setCollapsed(c => { const n = new Set(c); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                      aria-expanded={!isCollapsed}
                      className="flex items-center gap-2 min-w-0 cursor-pointer"
                    >
                      <ChevronRight size={14} className={`text-ink-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                      {g.process && <span className="size-2 rounded-full shrink-0" style={{ background: BP_COLORS[g.process] }} />}
                      <span className="font-mono text-[0.75rem] font-semibold text-ink-900">{g.process}</span>
                      <span className="text-[0.8125rem] font-medium text-ink-800 truncate">{g.label}</span>
                    </button>
                    <span className="text-[0.75rem] text-ink-500 tabular-nums truncate">
                      {g.rows.length} · {gReady} ready{gKeys.length > 0 ? ` · ${gKeys.length} need data` : ''}
                    </span>
                    {gKeys.length > 0 && (
                      <button
                        onClick={() => openAdapt(gKeys)}
                        className="ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer whitespace-nowrap"
                      >
                        Adapt {gKeys.length} with your data <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                )}

                {!isCollapsed && g.rows.map(c => {
                  const st = statusOf(c, adapted);
                  const open = expanded === c.id;
                  const canSelect = adaptable(c);
                  const entry = isStd(c) ? CHECK_CATALOG.find(e => e.key === c.stdKey) : undefined;
                  const recs = isStd(c) ? [] : actionableRecs({ layer: 'control', subjectId: c.controlId, subjectLabel: c.name, status: '', isKey: c.classification === 'Key' });
                  return (
                    <div key={c.id} className="border-b border-canvas-border last:border-b-0">
                      <div
                        className={`${GRID} group h-11 px-3 cursor-pointer transition-colors ${open ? 'bg-brand-50/40' : 'hover:bg-paper-50'}`}
                        onClick={() => setExpanded(open ? null : c.id)}
                      >
                        <span className="flex justify-center" onClick={e => e.stopPropagation()}>
                          {canSelect && (
                            <TickBox state={selected.has(c.stdKey!)} label={`Select ${c.name}`} onClick={() => toggleSel(c.stdKey!)} />
                          )}
                        </span>
                        <ChevronRight size={14} className={`text-ink-400 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
                        <span className="font-mono text-[0.75rem] text-ink-500 truncate">{c.controlId}</span>
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[0.8125rem] font-medium text-ink-900 truncate" title={c.name}>{c.name}</span>
                          {c.classification === 'Key' && <Star size={11} className="shrink-0 fill-mitigated-500 text-mitigated-500" aria-label="Key control" />}
                          {!groupByProcess && <span className="font-mono text-[0.6875rem] text-ink-400 shrink-0">{c.businessProcess}</span>}
                          {recs.length > 0 && (
                            <span onClick={e => e.stopPropagation()} className="inline-flex shrink-0">
                              <AIRecommendsPopover recs={recs} subjectLabel={c.controlId} subjectSub={c.name} />
                            </span>
                          )}
                        </span>
                        <span>
                          {isStd(c)
                            ? <span className="inline-flex items-center h-5 px-1.5 rounded bg-brand-50 text-brand-700 text-[0.6875rem] font-medium">Standard</span>
                            : <span className="inline-flex items-center h-5 px-1.5 rounded bg-paper-100 text-ink-600 text-[0.6875rem] font-medium">Custom</span>}
                        </span>
                        <span className="flex items-center gap-1.5 min-w-0 text-[0.75rem]">
                          {c.linkedWorkflows.length > 0 ? (
                            <>
                              {st === 'needs-data'
                                ? <CircleDashed size={12} className="text-mitigated-700 shrink-0" aria-hidden />
                                : <Link2 size={12} className="text-ink-400 shrink-0" aria-hidden />}
                              <span className={`truncate ${st === 'needs-data' ? 'text-ink-500' : 'text-ink-700'}`} title={c.linkedWorkflows.join(', ')}>
                                {c.linkedWorkflows[0]}{c.linkedWorkflows.length > 1 ? ` +${c.linkedWorkflows.length - 1}` : ''}
                              </span>
                            </>
                          ) : st === 'manual' ? (
                            <span className="text-ink-400 inline-flex items-center gap-1"><FileSearch size={12} aria-hidden /> Walkthrough</span>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                        </span>
                        <span>
                          <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[0.6875rem] font-medium whitespace-nowrap ${STATUS_META[st].cls}`}>
                            <span className={`size-1.5 rounded-full ${STATUS_META[st].dot}`} aria-hidden />
                            {STATUS_META[st].label}
                          </span>
                        </span>
                        <span className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
                          {st === 'needs-data' ? (
                            <button
                              onClick={() => openAdapt([c.stdKey!])}
                              className="h-7 px-2 rounded-md text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer whitespace-nowrap"
                            >
                              Adapt
                            </button>
                          ) : (
                            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <IconBtn label="Open control" onClick={() => setSelectedControlId(c.id)}><Eye size={13} /></IconBtn>
                              {can('ctrl_share') && <IconBtn label="Share control" onClick={e => openShare({ type: 'control', id: c.id, anchor: rectFromEvent(e) })}><Share2 size={13} /></IconBtn>}
                              {!isStd(c) && can('ctrl_link') && <IconBtn label="Link workflow" onClick={() => setLinkWfControlId(c.id)}><Workflow size={13} /></IconBtn>}
                              {!isStd(c) && can('ctrl_edit') && (
                                <IconBtn label="Edit control" onClick={() => {
                                  addToast({ message: `Editing ${c.name}`, type: 'info' });
                                  logEvent({ action: 'Update', description: `Edited control "${c.name}" (${c.controlId})`, module: 'Control Library', entity: 'Control' });
                                }}><Pencil size={13} /></IconBtn>
                              )}
                              {!isStd(c) && can('ctrl_delete') && (
                                <IconBtn label="Delete control" danger onClick={() => {
                                  addToast({ message: `Deleted ${c.name}`, type: 'success' });
                                  logEvent({ action: 'Delete', description: `Deleted control "${c.name}" (${c.controlId})`, module: 'Control Library', entity: 'Control' });
                                }}><Trash2 size={13} /></IconBtn>
                              )}
                            </span>
                          )}
                        </span>
                      </div>

                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={reduced ? false : { height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={reduced ? undefined : { height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                            className="overflow-hidden"
                          >
                            <ExpandedDetail
                              control={c}
                              status={st}
                              entryFiles={entry ? filesForEntry(entry) : []}
                              onOpen={() => setSelectedControlId(c.id)}
                              onAdapt={st === 'needs-data' ? () => openAdapt([c.stdKey!]) : undefined}
                              onLink={!isStd(c) && can('ctrl_link') ? () => setLinkWfControlId(c.id) : undefined}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      {/* Selection bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="sticky bottom-4 z-10 mx-auto w-fit"
          >
            <div className="flex items-center gap-4 rounded-xl bg-ink-900 text-white pl-4 pr-2 py-2 shadow-xl">
              <span className="text-[0.8125rem] tabular-nums">
                <span className="font-semibold">{selected.size}</span> selected · needs <span className="font-semibold">{selectedFileCount}</span> file{selectedFileCount === 1 ? '' : 's'}
              </span>
              <button onClick={() => setSelected(new Set())} className="h-8 px-2.5 rounded-md text-[0.75rem] text-white/70 hover:text-white hover:bg-white/10 cursor-pointer">Clear</button>
              <button
                onClick={() => openAdapt(selectedKeys)}
                className="h-8 px-3 rounded-md bg-white text-ink-900 text-[0.8125rem] font-semibold inline-flex items-center gap-1.5 hover:bg-brand-50 cursor-pointer"
              >
                Adapt with your data <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adaptKeys && (
          <AdaptDataModal
            keys={adaptKeys}
            onClose={() => setAdaptKeys(null)}
            onContinue={(choices) => {
              const keys = adaptKeys;
              setAdaptKeys(null);
              setSelected(new Set());
              logEvent({ action: 'Update', description: `Started adapting ${keys.length} standard workflow(s) to client data`, module: 'Control Library', entity: 'Control' });
              onAdapt?.(keys, choices);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateDrawer && (
          <CreateControlDrawer onClose={() => setShowCreateDrawer(false)} onSave={handleCreateControl} defaultProcess={processFilter} />
        )}
      </AnimatePresence>

      {/* Link Workflow to Control — per-row action; links a workflow onto the control object */}
      <AnimatePresence>
        {linkWfControlId && (() => {
          const ctrl = controls.find(c => c.id === linkWfControlId);
          if (!ctrl) return null;
          return (
            <LinkWorkflowToControlDrawer
              control={{ name: ctrl.name, description: ctrl.description, isKey: ctrl.classification === 'Key', workflows: [] }}
              onClose={() => setLinkWfControlId(null)}
              onLink={(wf: ControlWorkflow) => {
                setControls(prev => prev.map(c => c.id === ctrl.id
                  ? {
                      ...c,
                      linkedWorkflows: c.linkedWorkflows.includes(wf.name) ? c.linkedWorkflows : [...c.linkedWorkflows, wf.name],
                      linkedWorkflowIds: c.linkedWorkflowIds.includes(wf.id) ? c.linkedWorkflowIds : [...c.linkedWorkflowIds, wf.id],
                    }
                  : c));
                addToast({ message: `Linked "${wf.name}" to ${ctrl.controlId}`, type: 'success' });
                logEvent({ action: 'Update', description: `Linked workflow "${wf.name}" to control "${ctrl.name}" (${ctrl.controlId})`, module: 'Control Library', entity: 'Control' });
                setLinkWfControlId(null);
              }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

/* ─── Parts ─── */

function TickBox({ state, label, onClick }: { state: boolean | 'mixed'; label: string; onClick: () => void }) {
  const filled = state === true || state === 'mixed';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'mixed' ? 'mixed' : state}
      aria-label={label}
      onClick={onClick}
      className={`size-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${filled ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-white hover:border-ink-400'}`}
    >
      {state === 'mixed' ? <Minus size={11} strokeWidth={3} /> : state ? <Check size={11} strokeWidth={3} /> : null}
    </button>
  );
}

function IconBtn({ label, onClick, children, danger }: {
  label: string; onClick: (e: React.MouseEvent<HTMLElement>) => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`size-7 rounded-md flex items-center justify-center text-ink-400 cursor-pointer transition-colors ${danger ? 'hover:bg-risk-50 hover:text-risk-700' : 'hover:bg-paper-100 hover:text-ink-800'}`}
    >
      {children}
    </button>
  );
}

function ExpandedDetail({ control: c, status, entryFiles, onOpen, onAdapt, onLink }: {
  control: ControlRow;
  status: RowStatus;
  entryFiles: { code: string; name: string; matches?: string }[];
  onOpen: () => void;
  onAdapt?: () => void;
  onLink?: () => void;
}) {
  const facts: [string, string][] = [
    ['Sub-process', c.subProcess],
    ['Nature', c.nature],
    ['Automation', c.automation],
    ['Frequency', c.frequency],
    ['Owner', c.owner],
    ...(c.usedInRACMs > 0 ? [['Used in', `${c.usedInRACMs} RACM${c.usedInRACMs === 1 ? '' : 's'}`] as [string, string]] : []),
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-6 pl-[4.5rem] pr-4 py-4 bg-paper-50/50 border-t border-canvas-border">
      <div className="min-w-0">
        <p className="text-[0.8125rem] text-ink-700 leading-relaxed">{c.description}</p>
        {c.objective && <p className="mt-1.5 text-[0.75rem] text-ink-500">{c.objective}</p>}
      </div>
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-1 text-[0.75rem]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-400">{k}</dt>
            <dd className="text-ink-700 truncate">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="min-w-0">
        {entryFiles.length > 0 ? (
          <>
            <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">
              {status === 'ready' ? 'Runs on' : 'Needs to adapt'}
            </div>
            <ul className="space-y-1">
              {entryFiles.map(f => (
                <li key={f.code} className="flex items-center gap-2 text-[0.75rem]">
                  <span className="font-mono font-semibold text-ink-800 w-14 shrink-0">{f.code}</span>
                  <span className="text-ink-600 truncate">{f.name}</span>
                  {f.matches
                    ? <span className="ml-auto inline-flex items-center gap-1 text-compliant-700 shrink-0"><Database size={11} aria-hidden />Connected</span>
                    : <span className="ml-auto text-ink-400 shrink-0">Upload</span>}
                </li>
              ))}
            </ul>
          </>
        ) : status === 'manual' ? (
          <p className="text-[0.75rem] text-ink-500">Judgement control — tested by walkthrough and inspection, not a workflow.</p>
        ) : (
          <p className="text-[0.75rem] text-ink-500">{c.linkedWorkflows.length > 0 ? `Tested by ${c.linkedWorkflows.join(', ')}.` : 'No workflow tests this control yet.'}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onAdapt && <Button variant="primary" size="sm" onClick={onAdapt}>Adapt with your data</Button>}
          {onLink && c.linkedWorkflows.length === 0 && <Button variant="secondary" size="sm" leftIcon={<Workflow size={12} />} onClick={onLink}>Link workflow</Button>}
          <Button variant="outline" size="sm" onClick={onOpen}>Open control</Button>
        </div>
      </div>
    </div>
  );
}
