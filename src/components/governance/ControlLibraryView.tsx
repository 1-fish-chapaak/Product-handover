import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Plus, Download, Star, Workflow, Share2, Search, Check, Minus, ArrowRight, FileSearch, CircleDashed, Database,
  Sparkles, ShieldAlert, Pencil, Trash2, CircleCheck, Clock3, CircleSlash, PenLine, UserRound, Repeat, ListChecks, ChevronDown,
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
import { type ControlRow, BP_COLORS, ASSERTION_LABELS, SEED_WORKFLOW_ATTRIBUTES } from './controlTypes';
import { CONTROL_LIBRARY } from '../../data/controlLibrary';
import {
  CHECK_CATALOG, PROCESS_BLURB, PROCESS_LONG, filesForEntry, standardControlRows, useStdState, useFreshWorkspace,
  readinessOf, hoursPerMonthFor, fmtHours, valueOfKey, type FileSourceChoice, type StdState,
} from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { Button } from '../shared/Button';
import AdaptDataModal from '../audit-plan/AdaptDataModal';
import CircularCarousel from '../shared/carousel/CircularCarousel';
import { PROCESS_CARD_ASPECT, processCardImage } from './processCards';
import ControlLibraryWelcome from './ControlLibraryWelcome';

/* ─── Control Library ───────────────────────────────────────────────────────
 * Processes first: a carousel of process cards (live coverage and counts on
 * each), and the selected process's controls underneath. Every control is
 * complete — description, risk, assertions, owner and test attributes — and
 * is either Standard (preloaded, with a standard workflow that needs the
 * client's data) or Custom (the client's own). A new client lands on a
 * first-time panel listing the reports Ira needs to bring it all live.
 * ──────────────────────────────────────────────────────────────────────── */

interface ControlLibraryProps {
  /** When set, filters controls to this process and pre-fills create drawer */
  processFilter?: string;
  /** Adapt standard controls: the chosen keys and where each file comes from. */
  onAdapt?: (keys: string[], choices: Record<string, FileSourceChoice | null>) => void;
  /** Built workflows waiting for review live in Builds & reviews. */
  onOpenBuilds?: () => void;
}

type LibTab = 'all' | 'standard' | 'custom';
type RowStatus = 'live' | 'awaiting-review' | 'needs-data' | 'manual' | 'no-workflow' | 'draft';
type StatusFilter = 'all' | RowStatus;

const PROCESS_ORDER: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];
const WELCOME_KEY = 'irame.controlLibrary.welcomeDismissed';

const STATUS_META: Record<RowStatus, { label: string; cls: string; dot: string }> = {
  live:              { label: 'Live',            cls: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-500' },
  'awaiting-review': { label: 'Awaiting review', cls: 'bg-evidence-50 text-evidence-700',   dot: 'bg-evidence-500' },
  'needs-data':      { label: 'Needs data',      cls: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated-500' },
  manual:            { label: 'Manual test',     cls: 'bg-paper-100 text-ink-600',          dot: 'bg-ink-300' },
  'no-workflow':     { label: 'No workflow',     cls: 'bg-high-50 text-high-700',           dot: 'bg-high-500' },
  draft:             { label: 'Draft',           cls: 'bg-draft-50 text-draft-700',         dot: 'bg-ink-300' },
};

const isStd = (c: ControlRow) => c.library === 'standard';

/** Custom and standard controls name a few sub-processes differently; one section each. */
const SUBPROCESS_ALIAS: Record<string, string> = {
  'Purchase Orders': 'Purchase Order Management',
  'Payment Execution': 'Payments',
  'Financial Close': 'Close & Reconciliation',
  'Contract Compliance': 'Contract Management',
};

function statusOf(c: ControlRow, std: StdState): RowStatus {
  if (isStd(c)) {
    const e = CHECK_CATALOG.find(x => x.key === c.stdKey);
    return e ? readinessOf(e, std) : 'needs-data';
  }
  if (c.status === 'Draft') return 'draft';
  return c.linkedWorkflows.length > 0 ? 'live' : c.automation === 'Manual' ? 'manual' : 'no-workflow';
}

/** A control's test attributes: its workflow's seeded set, else its own. */
const attributesOf = (c: ControlRow) =>
  (c.linkedWorkflowIds[0] && SEED_WORKFLOW_ATTRIBUTES[c.linkedWorkflowIds[0]]) || c.attributes || [];

function readDismissed(fresh: boolean): boolean {
  try { return localStorage.getItem(`${WELCOME_KEY}${fresh ? '.fresh' : ''}`) === '1'; } catch { return false; }
}

export default function ControlLibraryView({ processFilter, onAdapt, onOpenBuilds }: ControlLibraryProps) {
  const { addToast } = useToast();
  const { can } = useCan();
  const { openShare } = useShare();
  const logEvent = useAuditLog();
  const reduced = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);

  const [controls, setControls] = useState<ControlRow[]>(CONTROL_LIBRARY);
  const created = useCreatedControls();
  const adapted = useStdState();
  const fresh = useFreshWorkspace();

  // Controls created via the wizard (e.g. a risk's Link Control → Create Control).
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const standardRows = useMemo(() => standardControlRows(adapted), [adapted, fresh]);
  // A fresh workspace has no controls of its own yet — only the standard library.
  const allControls = fresh ? standardRows : [...createdRows, ...controls, ...standardRows];

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
  const [processIdx, setProcessIdx] = useState(() => {
    // Process Hub hands over the process it was opened from.
    // Read here, cleared in an effect — StrictMode runs initialisers twice.
    let handed: string | null = null;
    try { handed = window.sessionStorage.getItem('control-library.open-process'); } catch { /* ignore */ }
    return Math.max(0, PROCESS_ORDER.indexOf(((handed ?? processFilter) as ProcessCode) ?? 'P2P'));
  });
  const [tab, setTab] = useState<LibTab>('all');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [keyOnly, setKeyOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adaptKeys, setAdaptKeys] = useState<string[] | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => readDismissed(fresh));
  useEffect(() => {
    try { window.sessionStorage.removeItem('control-library.open-process'); } catch { /* ignore */ }
  }, []);

  // ── Per-process numbers (cards, header) ──
  const processStats = useMemo(() => PROCESS_ORDER.map(p => {
    const rows = allControls.filter(c => c.businessProcess === p);
    const st = rows.map(c => statusOf(c, adapted));
    const auto = rows.filter(c => c.automation !== 'Manual');
    const liveAuto = auto.filter(c => statusOf(c, adapted) === 'live').length;
    return {
      code: p,
      rows,
      total: rows.length,
      live: st.filter(s => s === 'live').length,
      awaiting: st.filter(s => s === 'awaiting-review').length,
      needs: st.filter(s => s === 'needs-data').length,
      manual: st.filter(s => s === 'manual').length,
      pct: auto.length ? Math.round((liveAuto / auto.length) * 100) : 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [allControls.length, adapted, fresh, created.length, controls]);

  const cards = useMemo(() => processStats.map(s => ({
    src: processCardImage({
      code: s.code, name: PROCESS_LONG[s.code], blurb: PROCESS_BLURB[s.code], color: BP_COLORS[s.code] ?? '#6a12cd',
      total: s.total, live: s.live, awaiting: s.awaiting, needs: s.needs, manual: s.manual, pct: s.pct,
    }),
    alt: `${PROCESS_LONG[s.code]}: ${s.pct}% live automated coverage, ${s.total} controls`,
    title: PROCESS_LONG[s.code],
    subtitle: `${s.live} of ${s.total} controls live`,
  })), [processStats]);

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
  const proc = PROCESS_ORDER[processIdx];
  const procStats = processStats[processIdx];
  const q = query.trim().toLowerCase();
  // Searching looks across every process; otherwise the selected one.
  const scope = q ? allControls : allControls.filter(c => c.businessProcess === proc);
  const counts = {
    all: scope.length,
    standard: scope.filter(isStd).length,
    custom: scope.filter(c => !isStd(c)).length,
  };
  const inTab = scope.filter(c => (tab === 'all' ? true : tab === 'standard' ? isStd(c) : !isStd(c)));
  const visible = inTab.filter(c => {
    if (keyOnly && c.classification !== 'Key') return false;
    if (statusFilter !== 'all' && statusOf(c, adapted) !== statusFilter) return false;
    if (q && ![c.controlId, c.name, c.businessProcess, c.subProcess, ...c.linkedWorkflows].some(v => v.toLowerCase().includes(q))) return false;
    return true;
  });
  // Sub-process sections for the selected process; process sections when searching.
  const groups: { key: string; label: string; rows: ControlRow[] }[] = [];
  for (const c of visible) {
    const key = q ? c.businessProcess : (SUBPROCESS_ALIAS[c.subProcess] ?? (c.subProcess || 'General'));
    let g = groups.find(x => x.key === key);
    if (!g) {
      g = { key, label: q ? `${c.businessProcess} · ${PROCESS_LONG[c.businessProcess as ProcessCode] ?? c.businessProcess}` : key, rows: [] };
      groups.push(g);
    }
    g.rows.push(c);
  }
  const statusCount = (s: RowStatus) => inTab.filter(c => statusOf(c, adapted) === s).length;
  const adaptable = (c: ControlRow) => isStd(c) && statusOf(c, adapted) === 'needs-data';
  const needsDataAll = allControls.filter(adaptable);
  const keysOf = (rows: ControlRow[]) => rows.filter(adaptable).map(c => c.stdKey!).filter(Boolean);
  const procKeys = keysOf(procStats.rows);
  const selectedKeys = [...selected];
  const selectedFileCount = new Set(
    selectedKeys.flatMap(k => { const e = CHECK_CATALOG.find(x => x.key === k); return e ? filesForEntry(e).map(f => f.id) : []; }),
  ).size;
  const readyCount = allControls.filter(c => statusOf(c, adapted) === 'live').length;
  const awaitingCount = allControls.filter(c => statusOf(c, adapted) === 'awaiting-review').length;
  const showWelcome = !processFilter && !welcomeDismissed && (fresh || adapted.built.length === 0) && needsDataAll.length > 0;

  const toggleSel = (key: string) => setSelected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const openAdapt = (keys: string[]) => { if (keys.length > 0) setAdaptKeys(keys); };
  const pickProcess = (i: number) => { setProcessIdx(i); setExpanded(null); setStatusFilter('all'); };

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

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="px-8 pt-7 pb-28 max-w-[96rem] mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[1.5rem] font-semibold tracking-tight text-ink-900">Control Library</h1>
            <p className="text-[0.8125rem] text-ink-500 mt-0.5">
              Every control with its test attributes and the workflow that evidences it — by process.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-ink-500 tabular-nums">
              <span><span className="font-semibold text-ink-900">{allControls.length}</span> controls</span>
              <span><span className="font-semibold text-ink-900">{readyCount}</span> live</span>
              {awaitingCount > 0 && (
                <button onClick={onOpenBuilds} className="text-evidence-700 hover:underline cursor-pointer"><span className="font-semibold">{awaitingCount}</span> awaiting review</button>
              )}
              {needsDataAll.length > 0 && <span className="text-mitigated-700"><span className="font-semibold">{needsDataAll.length}</span> need your data</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {can('ctrl_export') && (
              <Button variant="outline" leftIcon={<Download size={14} />} onClick={() => {
                addToast({ message: 'Control library exported as CSV', type: 'success' });
                logEvent({ action: 'Export', description: `Exported the control library (${allControls.length} controls) as CSV`, module: 'Control Library', entity: 'Control' });
              }}>Export</Button>
            )}
            {can('ctrl_create') && !fresh && (
              <Button variant="outline" leftIcon={<Plus size={14} />} onClick={() => setShowCreateDrawer(true)}>Create control</Button>
            )}
            {needsDataAll.length > 0 && !showWelcome && (
              <Button variant="primary" leftIcon={<Sparkles size={14} />} onClick={() => openAdapt(keysOf(needsDataAll))}>
                Adapt {needsDataAll.length} with your data · +{fmtHours(hoursPerMonthFor(keysOf(needsDataAll)))}/mo
              </Button>
            )}
          </div>
        </div>

        {showWelcome && (
          <ControlLibraryWelcome
            fresh={fresh}
            needsKeys={keysOf(needsDataAll)}
            liveCount={readyCount}
            totalStandard={standardRows.length}
            onAdaptAll={() => openAdapt(keysOf(needsDataAll))}
            onDismiss={() => {
              setWelcomeDismissed(true);
              try { localStorage.setItem(`${WELCOME_KEY}${fresh ? '.fresh' : ''}`, '1'); } catch { /* ignore */ }
            }}
          />
        )}

        {/* Processes */}
        {!processFilter && (
          <section aria-label="Processes" className="mb-6">
            <div role="tablist" aria-label="Process" className="relative z-10 flex flex-wrap items-center gap-1.5 mb-1">
              {processStats.map((s, i) => (
                <button
                  key={s.code}
                  role="tab"
                  aria-selected={i === processIdx}
                  onClick={() => pickProcess(i)}
                  className={`inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-full border text-[0.75rem] cursor-pointer transition-colors ${
                    i === processIdx ? 'border-ink-900 bg-ink-900 text-white' : 'border-canvas-border text-ink-700 hover:border-brand-200'
                  }`}
                >
                  <span className="size-2 rounded-full" style={{ background: BP_COLORS[s.code] }} aria-hidden />
                  <span className="font-mono font-semibold">{s.code}</span>
                  <span className={`tabular-nums ${i === processIdx ? 'text-white/70' : 'text-ink-400'}`}>{s.pct}%</span>
                </button>
              ))}
              <span className="ml-auto text-[0.6875rem] text-ink-400">Drag or use ← → to turn · click a card to open it</span>
            </div>
            <div className="relative h-[24rem] -mt-8">
              <CircularCarousel
                items={cards}
                preset="orbit"
                tilt={-4}
                intro="rise"
                cardWidth={236}
                aspectRatio={PROCESS_CARD_ASPECT}
                gap={64}
                autoplay="off"
                snap
                focusOnClick
                parallax={0.15}
                stretch={0.3}
                depthFade={0.7}
                fadeColor="#FFFFFF"
                cornerRadius={14}
                ariaLabel="Processes"
                focusIndex={processIdx}
                onChange={i => { if (i !== processIdx) pickProcess(i); }}
                onItemClick={(_, i) => {
                  pickProcess(i);
                  window.setTimeout(() => listRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }), 350);
                }}
                className="text-ink-900"
              />
            </div>
          </section>
        )}

        {/* Selected process */}
        <div ref={listRef} className="scroll-mt-4">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: BP_COLORS[proc] }} aria-hidden />
                <span className="font-mono text-[0.8125rem] font-semibold text-ink-900">{proc}</span>
                <h2 className="text-[1.125rem] font-semibold text-ink-900 truncate">{q ? 'Search results' : PROCESS_LONG[proc]}</h2>
              </div>
              <p className="text-[0.75rem] text-ink-500 mt-0.5 tabular-nums">
                {q
                  ? `${visible.length} control${visible.length === 1 ? '' : 's'} across every process match “${query.trim()}”`
                  : `${PROCESS_BLURB[proc]} · ${procStats.total} controls · ${procStats.live} live · ${procStats.awaiting} awaiting review · ${procStats.needs} need data · ${procStats.manual} manual`}
              </p>
            </div>
            {!q && (
              <div className="flex items-center gap-4">
                <div className="w-44">
                  <div className="flex items-baseline justify-between text-[0.6875rem] text-ink-500">
                    <span>Live coverage</span>
                    <span className="font-mono font-semibold text-ink-900 tabular-nums">{procStats.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-paper-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${procStats.pct}%`, background: BP_COLORS[proc] }} />
                  </div>
                </div>
                {procKeys.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => openAdapt(procKeys)}>
                    Adapt {procKeys.length} · +{fmtHours(hoursPerMonthFor(procKeys))}/mo
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4 mb-7">
            <div role="tablist" aria-label="Library" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-100">
              {([['all', 'All'], ['standard', 'Standard library'], ['custom', 'Custom']] as [LibTab, string][]).filter(([id]) => !(fresh && id === 'custom')).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => { setTab(id); setStatusFilter('all'); }}
                  className={`h-7 px-3 rounded-md text-[0.75rem] font-medium cursor-pointer transition-colors ${tab === id ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}
                >
                  {label} <span className="ml-0.5 text-ink-400 tabular-nums">{counts[id]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by status">
              {(['all', 'live', 'awaiting-review', 'needs-data', 'manual', 'no-workflow', 'draft'] as StatusFilter[])
                .filter(s => s === 'all' || statusCount(s as RowStatus) > 0)
                .map(s => (
                  <button
                    key={s}
                    aria-pressed={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                    className={`h-7 px-3 rounded-full border text-[0.75rem] cursor-pointer transition-colors ${statusFilter === s ? 'border-brand-300 bg-brand-50 text-brand-700 font-medium' : 'border-canvas-border text-ink-600 hover:border-brand-200'}`}
                  >
                    {s === 'all' ? 'Any status' : STATUS_META[s as RowStatus].label}
                    {s !== 'all' && <span className="ml-1.5 tabular-nums text-ink-400">{statusCount(s as RowStatus)}</span>}
                  </button>
                ))}
              <button
                aria-pressed={keyOnly}
                onClick={() => setKeyOnly(k => !k)}
                className={`h-7 px-3 rounded-full border text-[0.75rem] cursor-pointer transition-colors inline-flex items-center gap-1.5 ${keyOnly ? 'border-brand-300 bg-brand-50 text-brand-700 font-medium' : 'border-canvas-border text-ink-600 hover:border-brand-200'}`}
              >
                <Star size={11} className={keyOnly ? 'fill-mitigated-500 text-mitigated-500' : ''} aria-hidden /> Key controls
              </button>
            </div>
            <div className="relative ml-auto w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search every process…"
                aria-label="Search controls"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] outline-none focus:border-brand-300"
              />
            </div>
          </div>

          {/* Controls — one entry each, grouped by sub-process (by process when searching) */}
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-canvas-border px-6 py-16 text-center">
              <p className="text-[0.875rem] font-medium text-ink-800">No controls match</p>
              <p className="mt-1 text-[0.8125rem] text-ink-500">Try another status, or clear the search.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {groups.map(g => {
                const gLive = g.rows.filter(c => statusOf(c, adapted) === 'live').length;
                const gKeys = keysOf(g.rows);
                return (
                  <section key={g.key} aria-label={g.label}>
                    <header className="flex items-center gap-3 mb-3">
                      <h3 className="text-[0.875rem] font-semibold text-ink-900">{g.label}</h3>
                      <span className="text-[0.75rem] text-ink-400 tabular-nums">
                        {g.rows.length} control{g.rows.length === 1 ? '' : 's'} · {gLive} live
                      </span>
                      <span className="flex-1 h-px bg-canvas-border" aria-hidden />
                      {gKeys.length > 1 && (
                        <button onClick={() => openAdapt(gKeys)} className="text-[0.75rem] font-medium text-brand-700 hover:underline cursor-pointer">
                          Adapt all {gKeys.length}
                        </button>
                      )}
                    </header>
                    <ul className="space-y-3">
                      {g.rows.map(c => {
                        const st = statusOf(c, adapted);
                        const entry = isStd(c) ? CHECK_CATALOG.find(e => e.key === c.stdKey) : undefined;
                        const files = entry ? filesForEntry(entry) : [];
                        const recs = isStd(c) ? [] : actionableRecs({ layer: 'control', subjectId: c.controlId, subjectLabel: c.name, status: '', isKey: c.classification === 'Key' });
                        const open = expanded === c.id;
                        return (
                          <li key={c.id}>
                            <ControlEntry
                              control={c}
                              status={st}
                              open={open}
                              onToggle={() => setExpanded(open ? null : c.id)}
                              showProcess={!!q}
                              files={files}
                              selectable={adaptable(c)}
                              selected={!!c.stdKey && selected.has(c.stdKey)}
                              selecting={selected.size > 0}
                              onSelect={() => toggleSel(c.stdKey!)}
                              recs={recs.length > 0 ? <AIRecommendsPopover recs={recs} subjectLabel={c.controlId} subjectSub={c.name} /> : null}
                              action={
                                st === 'needs-data' ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <Button variant="secondary" size="sm" onClick={() => openAdapt([c.stdKey!])}>Adapt with your data</Button>
                                    <span className="text-[0.6875rem] text-ink-400 tabular-nums">~{fmtHours(valueOfKey(c.stdKey)?.hoursPerMonth ?? 0)} a month once live</span>
                                  </div>
                                ) : st === 'awaiting-review' ? (
                                  <Button variant="outline" size="sm" rightIcon={<ArrowRight size={12} />} onClick={() => onOpenBuilds?.()}>Review</Button>
                                ) : (
                                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={12} />} onClick={() => setSelectedControlId(c.id)}>Open</Button>
                                )
                              }
                              detail={
                                <ExpandedDetail
                                  control={c}
                                  status={st}
                                  entryFiles={files}
                                  onOpen={() => setSelectedControlId(c.id)}
                                  onLink={!isStd(c) && can('ctrl_link') ? () => setLinkWfControlId(c.id) : undefined}
                                  tools={
                                    <>
                                      {can('ctrl_share') && <IconBtn label="Share control" onClick={e => openShare({ type: 'control', id: c.id, anchor: rectFromEvent(e) })}><Share2 size={13} /></IconBtn>}
                                      {!isStd(c) && can('ctrl_link') && c.linkedWorkflows.length > 0 && <IconBtn label="Link another workflow" onClick={() => setLinkWfControlId(c.id)}><Workflow size={13} /></IconBtn>}
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
                                    </>
                                  }
                                />
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selection bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="sticky bottom-5 z-10 mx-auto w-fit"
          >
            <div className="flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated pl-4 pr-2 py-2 shadow-[0_8px_24px_rgba(15,8,30,0.08)]">
              <span className="text-[0.8125rem] text-ink-700 tabular-nums">
                <span className="font-semibold text-ink-900">{selected.size}</span> selected · needs <span className="font-semibold text-ink-900">{selectedFileCount}</span> report{selectedFileCount === 1 ? '' : 's'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={12} />} onClick={() => openAdapt(selectedKeys)}>Adapt with your data</Button>
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

const STATUS_ICON: Record<RowStatus, { icon: typeof CircleCheck; cls: string }> = {
  live:              { icon: CircleCheck,  cls: 'text-compliant-700' },
  'awaiting-review': { icon: Clock3,       cls: 'text-evidence-700' },
  'needs-data':      { icon: CircleDashed, cls: 'text-mitigated-700' },
  manual:            { icon: FileSearch,   cls: 'text-ink-400' },
  'no-workflow':     { icon: CircleSlash,  cls: 'text-high-700' },
  draft:             { icon: PenLine,      cls: 'text-ink-400' },
};

/** One control, as an entry rather than a row: who it is, what it does, how
 *  it's tested, and the one thing to do next. Opens in place for the rest. */
function ControlEntry({
  control: c, status, open, onToggle, showProcess, files, selectable, selected, selecting, onSelect, recs, action, detail,
}: {
  control: ControlRow;
  status: RowStatus;
  open: boolean;
  onToggle: () => void;
  showProcess: boolean;
  files: { code: string; name: string }[];
  selectable: boolean;
  selected: boolean;
  selecting: boolean;
  onSelect: () => void;
  recs: React.ReactNode;
  action: React.ReactNode;
  detail: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const Glyph = STATUS_ICON[status].icon;
  const attrs = attributesOf(c);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const workflow = c.linkedWorkflows.length > 0
    ? `${c.linkedWorkflows[0]}${c.linkedWorkflows.length > 1 ? ` +${c.linkedWorkflows.length - 1}` : ''}`
    : status === 'manual' ? 'Walkthrough and inspection' : 'No workflow yet';
  const tick = <TickBox state={selected} label={`Select ${c.name}`} onClick={onSelect} />;

  return (
    <article
      className={`group rounded-xl border bg-canvas-elevated transition-[border-color,box-shadow] duration-150 ${
        open ? 'border-brand-200 shadow-[0_8px_24px_rgba(15,8,30,0.04)]' : selected ? 'border-brand-300' : 'border-canvas-border hover:border-brand-200'
      }`}
    >
      <div className="flex items-start gap-4 px-5 py-4 cursor-pointer" onClick={onToggle}>
        {/* Status, or a tick box for controls that can be adapted */}
        <div className="w-5 shrink-0 mt-[1.3rem] flex justify-center" onClick={stop}>
          {selectable && (selecting || selected) ? tick : (
            <>
              <Glyph size={18} className={`${STATUS_ICON[status].cls} ${selectable ? 'group-hover:hidden group-focus-within:hidden' : ''}`} aria-hidden />
              {selectable && <span className="hidden group-hover:flex group-focus-within:flex">{tick}</span>}
            </>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-ink-400">
            <span className="font-mono text-ink-500 tabular-nums">{c.controlId}</span>
            {showProcess && <><span aria-hidden>·</span><span className="font-mono">{c.businessProcess}</span></>}
            <span aria-hidden>·</span>
            <span className={isStd(c) ? 'text-brand-700' : 'text-ink-500'}>{isStd(c) ? 'Standard library' : 'Custom'}</span>
            {c.classification === 'Key' && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 text-mitigated-700"><Star size={10} className="fill-mitigated-500 text-mitigated-500" aria-hidden />Key control</span>
              </>
            )}
          </div>
          <h4 className="mt-1 flex items-center gap-2 text-[0.9375rem] font-semibold leading-snug text-ink-900">
            <button type="button" aria-expanded={open} onClick={e => { stop(e); onToggle(); }} className="text-left cursor-pointer hover:text-brand-700 transition-colors">
              {c.name}
            </button>
            {recs && <span onClick={stop} className="inline-flex">{recs}</span>}
          </h4>
          <p className={`mt-1 max-w-[75ch] text-[0.8125rem] leading-relaxed text-ink-500 ${open ? '' : 'line-clamp-2'}`}>{c.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.75rem] text-ink-500">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Workflow size={12} className="text-ink-400 shrink-0" aria-hidden />
              <span className={`truncate max-w-[18rem] ${status === 'no-workflow' ? 'text-high-700' : 'text-ink-700'}`} title={c.linkedWorkflows.join(', ') || undefined}>{workflow}</span>
            </span>
            <span className="inline-flex items-center gap-1.5"><UserRound size={12} className="text-ink-400" aria-hidden />{c.owner}</span>
            <span className="inline-flex items-center gap-1.5"><Repeat size={12} className="text-ink-400" aria-hidden />{c.frequency}</span>
            {attrs.length > 0 && (
              <span className="inline-flex items-center gap-1.5"><ListChecks size={12} className="text-ink-400" aria-hidden /><span className="tabular-nums">{attrs.length}</span> test attribute{attrs.length === 1 ? '' : 's'}</span>
            )}
            {status === 'needs-data' && files.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span>Needs</span>
                {files.map(f => (
                  <span key={f.code} title={f.name} className="inline-flex items-center h-5 px-1.5 rounded bg-paper-100 font-mono text-[0.6875rem] text-ink-700">{f.code}</span>
                ))}
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-ink-400 group-hover:text-brand-700 transition-colors" aria-hidden>
              {open ? 'Less' : 'Details'}
              <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </span>
          </div>
        </div>

        <div className="w-48 shrink-0 flex flex-col items-end gap-3 pt-0.5" onClick={stop}>
          <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[0.6875rem] font-medium whitespace-nowrap ${STATUS_META[status].cls}`}>
            <span className={`size-1.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden />
            {STATUS_META[status].label}
          </span>
          {action}
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
            {detail}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">{children}</div>;
}

/** The rest of the definition, in place: what it covers, how it runs, the
 *  data behind it, and every test attribute. */
function ExpandedDetail({ control: c, status, entryFiles, onOpen, onLink, tools }: {
  control: ControlRow;
  status: RowStatus;
  entryFiles: { code: string; name: string; matches?: string }[];
  onOpen: () => void;
  onLink?: () => void;
  tools?: React.ReactNode;
}) {
  const attrs = attributesOf(c);
  const facts: [string, string][] = [
    ['Owner', c.owner],
    ['Sub-process', c.subProcess],
    ['Nature', c.nature],
    ['Automation', c.automation],
    ['Frequency', c.frequency],
    ...(c.usedInRACMs > 0 ? [['Used in', `${c.usedInRACMs} RACM${c.usedInRACMs === 1 ? '' : 's'}`] as [string, string]] : []),
  ];
  return (
    <div className="mx-5 border-t border-canvas-border pt-5 pb-5 pl-9 space-y-7">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="min-w-0">
          <Eyebrow>What it covers</Eyebrow>
          {c.objective && <p className="text-[0.8125rem] leading-relaxed text-ink-700">{c.objective}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {c.mappedRisks.map(r => (
              <span key={r} className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-risk-50 text-risk-700 text-[0.6875rem] font-mono"><ShieldAlert size={11} aria-hidden />{r}</span>
            ))}
            {c.assertions.map(a => (
              <span key={a} className="inline-flex items-center h-6 px-2 rounded-full border border-canvas-border text-ink-600 text-[0.6875rem]">{ASSERTION_LABELS[a] ?? a}</span>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <Eyebrow>How it runs</Eyebrow>
          <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-1.5 text-[0.8125rem]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-400">{k}</dt>
                <dd className="text-ink-800 truncate" title={v}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0">
          {entryFiles.length > 0 ? (
            <>
              <Eyebrow>{status === 'live' || status === 'awaiting-review' ? 'Runs on' : 'Needs these reports'}</Eyebrow>
              <ul className="space-y-1.5">
                {entryFiles.map(f => (
                  <li key={f.code} className="flex items-center gap-2.5 text-[0.8125rem]">
                    <span className="font-mono text-[0.75rem] font-semibold text-ink-800 w-14 shrink-0">{f.code}</span>
                    <span className="text-ink-600 truncate">{f.name}</span>
                    {f.matches
                      ? <span className="ml-auto inline-flex items-center gap-1 text-[0.75rem] text-compliant-700 shrink-0"><Database size={11} aria-hidden />Connected</span>
                      : <span className="ml-auto text-[0.75rem] text-ink-400 shrink-0">To request</span>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <Eyebrow>How it's tested</Eyebrow>
              <p className="text-[0.8125rem] leading-relaxed text-ink-600">
                {status === 'manual'
                  ? 'A judgement control — tested by walkthrough and inspection against the attributes below.'
                  : c.linkedWorkflows.length > 0
                    ? `Tested by ${c.linkedWorkflows.join(', ')}.`
                    : 'No workflow tests this control yet — the attributes below are tested by hand until one is linked.'}
              </p>
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {onLink && c.linkedWorkflows.length === 0 && <Button variant="secondary" size="sm" leftIcon={<Workflow size={12} />} onClick={onLink}>Link workflow</Button>}
            <Button variant="outline" size="sm" rightIcon={<ArrowRight size={12} />} onClick={onOpen}>Open control</Button>
            {tools && <span className="flex items-center gap-0.5">{tools}</span>}
          </div>
        </div>
      </div>

      {attrs.length > 0 && (
        <div>
          <Eyebrow>Test attributes · {attrs.length}</Eyebrow>
          <ol className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {attrs.map(a => (
              <li key={a.id} className="rounded-lg border border-canvas-border bg-canvas p-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.6875rem] text-ink-400">{a.label}</span>
                  <span className="text-[0.8125rem] font-semibold text-ink-900">{a.name}</span>
                  {a.mandatory && <span className="text-[0.625rem] font-medium uppercase tracking-wider text-ink-400">Required</span>}
                  {a.evidenceType && <span className="ml-auto text-[0.6875rem] text-ink-400 whitespace-nowrap">{a.evidenceType}</span>}
                </div>
                {a.description && <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-500">{a.description}</p>}
                <div className="mt-3 space-y-1 text-[0.75rem] leading-snug">
                  <p className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2"><span className="font-medium text-compliant-700">Pass</span><span className="text-ink-700">{a.passCriteria}</span></p>
                  <p className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2"><span className="font-medium text-risk-700">Fail</span><span className="text-ink-700">{a.failureCriteria}</span></p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
