// Generate-from-template wizard — the ATR wizard pattern generalized to every
// template. Step 1 assembles the report body from the queries (and, for Bulk
// Audit sources, the workflow runs) that live in the user's reports; Step 2
// previews the arrangement with an editable executive-summary rollup. Create
// hands a payload back to ReportsView, which owns report construction.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Reorder, useReducedMotion } from 'motion/react';
import {
  X, FileText, Search, SearchX, Check, Minus, ArrowRight, ArrowLeft,
  Loader2, GripVertical, Sparkles, Workflow, CalendarRange, ChevronDown, ArrowLeftRight,
  Minimize2, Maximize2,
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import ColumnFilter from '../shared/ColumnFilter';
import { ReportPill } from './ReportPill';
import type { Tone } from '../shared/StatusBadge';
import {
  toGeneratedQuery, arrangeForTemplate, composeExecSummary, workflowToQueryDef,
  type PickableQuery, type GeneratedQueryDef,
} from './templateQueryPool';
import type { WorkflowResult } from './reportShared';

export type WizardCreatePayload = {
  /** Report title shown on the cover. */
  reportName: string;
  /** Ordered, arranged query blocks. */
  queries: GeneratedQueryDef[];
  /** Ordered workflow result blocks (Bulk Audit sources). */
  workflows: WorkflowResult[];
  execSummary: string;
  /** Audit coverage window stated on the report cover (e.g. "FY26 Q2"). */
  reportPeriod: string;
};

/** Sensible default coverage window — the current fiscal quarter. */
const currentPeriod = () => {
  const now = new Date();
  return `FY${String(now.getFullYear()).slice(-2)} Q${Math.floor(now.getMonth() / 3) + 1}`;
};

// Severity → shared ReportPill tone, so the wizard's chips match the rest of
// the Reports area instead of carrying their own geometry.
const sevTone = (sev: string): Tone =>
  sev === 'High' ? 'risk' : sev === 'Medium' ? 'mitigated' : 'compliant';

// Generation choreography — the "assembling your report" progress run shown as a
// full-modal experience (minimizable to a floating card).
const GEN_STEPS = [
  'Gathering your selected queries',
  'Arranging report sections',
  'Composing the executive summary',
  'Finalizing your report',
];
const GEN_DURATION_MS = 2600;

export default function GenerateReportWizard({ template, onClose, onCreate, suppressed = false, sources = [] }: {
  template: { id: string; name: string; desc: string };
  onClose: () => void;
  onCreate: (payload: WizardCreatePayload) => void;
  /** Reserved: hide + inert the wizard while another modal stacks above it. */
  suppressed?: boolean;
  /** The full pickable pool — rows derived from the user's live reports
   *  (newest first). There is no static catalog. */
  sources?: PickableQuery[];
}) {
  const reduce = useReducedMotion();
  const ease = [0.2, 0, 0, 1] as const;
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [sevFilters, setSevFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<'All' | 'Queries' | 'Bulk Audit'>('All');
  const [selected, setSelected] = useState<PickableQuery[]>([]);
  // Report groups can be collapsed so a long list of source reports stays
  // scannable while assembling a report from several of them.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroupCollapse = (name: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });
  const [ordered, setOrdered] = useState<GeneratedQueryDef[]>([]);
  const [orderedWorkflows, setOrderedWorkflows] = useState<WorkflowResult[]>([]);
  const [execSummary, setExecSummary] = useState('');
  const [summaryEdited, setSummaryEdited] = useState(false);
  const [reportName, setReportName] = useState(() => `${currentPeriod()} ${template.name}`);
  const [reportPeriod, setReportPeriod] = useState(currentPeriod);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  // Quick-pick coverage windows so most users never have to type a period.
  // The input stays editable for a custom range; this just seeds the common ones.
  const periodOptions = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const q = Math.floor(now.getMonth() / 3) + 1;
    const fy = String(y).slice(-2);
    const prevQ = q === 1 ? 4 : q - 1;
    const prevQfy = q === 1 ? String(y - 1).slice(-2) : fy;
    return [
      { label: 'This quarter', value: `FY${fy} Q${q}` },
      { label: 'Last quarter', value: `FY${prevQfy} Q${prevQ}` },
      { label: 'This fiscal year', value: `FY${fy}` },
      { label: 'Last fiscal year', value: `FY${String(y - 1).slice(-2)}` },
    ];
  }, []);

  // Close the period menu on an outside click.
  useEffect(() => {
    if (!periodMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setPeriodMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [periodMenuOpen]);
  // Generation run — a full-modal progress experience that can be minimized to a
  // floating bottom-right card (mirrors the ATR upload flow). Progress is driven
  // by rAF (below) so it keeps advancing while minimized.
  const [genState, setGenState] = useState<'idle' | 'running' | 'done'>('idle');
  const [genProgress, setGenProgress] = useState(0);
  const [genStepIdx, setGenStepIdx] = useState(0);
  const [genMinimized, setGenMinimized] = useState(false);
  const genDone = genState === 'done';
  const isCreating = genState !== 'idle';
  const payloadRef = useRef<WizardCreatePayload | null>(null);
  const finishedRef = useRef(false);
  const minimizedRef = useRef(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const attemptClose = () => {
    if (isCreating) return;
    if (selected.length > 0) setConfirmAbandon(true);
    else onClose();
  };
  useFocusTrap(containerRef, !suppressed && !genMinimized, attemptClose);

  // Make the wizard fully `inert` (out of the tab order) once the suppress
  // fade-out finishes — set by the panel's onAnimationComplete. Cleared the
  // instant we un-suppress so the fade-in is interactive again.
  const [suppressedSettled, setSuppressedSettled] = useState(false);
  // Intentional reset-on-prop-change: clear the settled flag the instant the
  // wizard un-suppresses, so the fade-in is interactive again.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!suppressed) setSuppressedSettled(false); }, [suppressed]);

  useEffect(() => { minimizedRef.current = genMinimized; }, [genMinimized]);

  const finishNow = () => {
    if (finishedRef.current || !payloadRef.current) return;
    finishedRef.current = true;
    onCreate(payloadRef.current);
  };

  // Drive the mock generation with rAF so it keeps advancing even when the wizard
  // is minimized. On completion, finish (open the report) unless minimized — then
  // hold on a "ready" state in the floating card until the user reopens it.
  useEffect(() => {
    if (genState !== 'running') return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / GEN_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setGenProgress(eased * 100);
      setGenStepIdx(Math.min(GEN_STEPS.length - 1, Math.floor(eased * GEN_STEPS.length)));
      if (t < 1) { raf = requestAnimationFrame(tick); return; }
      setGenProgress(100);
      setGenStepIdx(GEN_STEPS.length - 1);
      if (minimizedRef.current) setGenState('done'); else finishNow();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genState]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sources.filter(r => {
      const typeLabel = r.kind === 'workflow' ? 'Bulk Audit' : 'Queries';
      if (typeFilter !== 'All' && typeLabel !== typeFilter) return false;
      if (sevFilters.length && !sevFilters.includes(r.severity)) return false;
      if (!q) return true;
      return r.label.toLowerCase().includes(q) || r.sourceLabel.toLowerCase().includes(q);
    });
  }, [sources, search, sevFilters, typeFilter]);

  const toggle = (item: PickableQuery) => {
    setSelected(prev => {
      const exact = prev.find(p => p.uid === item.uid);
      if (exact) return prev.filter(p => p.uid !== item.uid);
      // Same underlying query already picked from another source — swap the
      // selection onto the clicked row (drop the old one, keep its position).
      const sameKey = prev.find(p => p.key === item.key);
      if (sameKey) return prev.map(p => (p.key === item.key ? item : p));
      return [...prev, item];
    });
  };

  // Report group header checkbox: all selected → drop the report's queries;
  // otherwise add every query in the report not already covered.
  const toggleReportGroup = (items: PickableQuery[]) => {
    setSelected(prev => {
      const selCount = items.filter(i => prev.some(p => p.uid === i.uid)).length;
      if (selCount === items.length) {
        return prev.filter(p => !items.some(i => i.uid === p.uid));
      }
      const additions = items.filter(i =>
        !prev.some(p => p.uid === i.uid) && !prev.some(p => p.key === i.key)
      );
      return [...prev, ...additions];
    });
  };

  const goPreview = () => {
    const queryDefs = arrangeForTemplate(
      template.id,
      selected.filter(s => s.kind === 'query').map(s => toGeneratedQuery(s, 'You')),
    );
    const workflows = selected.filter(s => s.kind === 'workflow').map(s => s.workflow!);
    setOrdered(queryDefs);
    setOrderedWorkflows(workflows);
    // Exec summary rolls up both kinds — workflows are projected to query-shaped
    // defs purely for the count/severity prose; the body still renders them as
    // workflow result blocks.
    if (!summaryEdited) {
      const combined = [...queryDefs, ...workflows.map(workflowToQueryDef)];
      setExecSummary(composeExecSummary(template.name, combined));
    }
    setStep(2);
  };

  const summaryFallback = () =>
    composeExecSummary(template.name, [...ordered, ...orderedWorkflows.map(workflowToQueryDef)]);

  const handleCreate = () => {
    if (genState !== 'idle') return;
    payloadRef.current = {
      reportName: reportName.trim() || template.name,
      queries: ordered,
      workflows: orderedWorkflows,
      execSummary: execSummary.trim() || summaryFallback(),
      reportPeriod: reportPeriod.trim() || currentPeriod(),
    };
    finishedRef.current = false;
    setGenProgress(0);
    setGenStepIdx(0);
    setGenMinimized(false);
    setGenState('running');
  };

  const selectedKeyCount = selected.length;
  const selWfCount = selected.filter(s => s.kind === 'workflow').length;
  const selQCount = selectedKeyCount - selWfCount;
  const selectedSummary =
    selWfCount === 0 ? `${selQCount} ${selQCount === 1 ? 'query' : 'queries'} selected`
    : selQCount === 0 ? `${selWfCount} ${selWfCount === 1 ? 'workflow' : 'workflows'} selected`
    : `${selQCount} ${selQCount === 1 ? 'query' : 'queries'} · ${selWfCount} ${selWfCount === 1 ? 'workflow' : 'workflows'} selected`;

  // ── Generation experience ────────────────────────────────────────────────
  // Once "Generate report" starts a run, the modal becomes a progress screen.
  // Minimize collapses it to a bottom-right floating card while the run keeps
  // advancing; on completion it opens the report (or waits, if minimized).
  if (genState !== 'idle') {
    return (
      <>
        {/* Scrim — dropped while minimized so the app behind stays usable. */}
        <motion.div
          initial={false}
          animate={{ opacity: genMinimized ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease }}
          className={`fixed inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] z-50 ${genMinimized ? 'pointer-events-none' : ''}`}
        />
        <motion.div
          ref={containerRef}
          initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.2, ease }}
          className={genMinimized
            ? 'fixed bottom-4 right-4 w-[400px] max-w-[92vw] bg-canvas-elevated rounded-[14px] shadow-xl border border-canvas-border z-[60] overflow-hidden'
            : 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1040px] max-w-[95vw] h-[662px] max-h-[90vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col overflow-hidden'}
          role="dialog" aria-modal={!genMinimized} aria-label={`Generating ${template.name}`}
          aria-busy={!genDone}
        >
          {genMinimized ? (
            /* Minimized floating card */
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                  {genDone ? <Check size={16} /> : <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">{genDone ? 'Report ready' : 'Generating your report'}</div>
                  <div className="text-[0.71875rem] text-ink-500 truncate mt-0.5">{genDone ? 'Ready to open.' : `${GEN_STEPS[genStepIdx]}…`}</div>
                </div>
                {!genDone && <span className="text-[0.8125rem] font-bold tabular-nums text-brand-700 shrink-0">{Math.round(genProgress)}%</span>}
              </div>
              {!genDone && (
                <div className="mt-3 h-1.5 rounded-full bg-brand-50 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500 transition-[width]" style={{ width: `${genProgress}%` }} />
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] text-ink-400">{genDone ? 'Your report is ready.' : 'Running in the background.'}</span>
                <button
                  onClick={genDone ? finishNow : () => setGenMinimized(false)}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] text-[0.75rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors"
                >
                  <Maximize2 size={13} aria-hidden="true" /> {genDone ? 'Open report' : 'Open'}
                </button>
              </div>
            </div>
          ) : (
            /* Full-modal generating experience */
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-10 py-12">
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease }}
                className="w-full max-w-[520px]"
              >
                <div className="flex items-center gap-4">
                  <span className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-brand-50 to-brand-100 ring-1 ring-brand-200/60 text-brand-700 flex items-center justify-center shrink-0">
                    {genDone ? <Check size={22} /> : <Loader2 size={22} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">{genDone ? 'Report ready' : 'Generating your report'}</h2>
                    <p className="text-[0.8125rem] text-ink-500 mt-0.5 truncate">{genDone ? 'Everything is composed and ready to open.' : `${GEN_STEPS[genStepIdx]}…`}</p>
                  </div>
                  <span className="text-[1.0625rem] font-bold tabular-nums text-brand-700 shrink-0">{Math.round(genProgress)}%</span>
                </div>

                <div className="mt-5 h-2 rounded-full bg-brand-50 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500 transition-[width] duration-150 ease-out" style={{ width: `${genProgress}%` }} />
                </div>

                <ul className="mt-6 space-y-2.5">
                  {GEN_STEPS.map((m, i) => {
                    const done = genDone || i < genStepIdx;
                    const active = !genDone && i === genStepIdx;
                    return (
                      <li key={m} className="flex items-center gap-3 text-[0.8125rem]">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-compliant text-white' : active ? 'bg-brand-600 text-white' : 'bg-canvas-border text-white'}`}>
                          {done ? <Check size={12} strokeWidth={3} /> : active ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                        </span>
                        <span className={done || active ? 'text-ink-700' : 'text-ink-400'}>{m}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-8 pt-5 border-t border-canvas-border flex items-center justify-between gap-3">
                  <span className="text-[0.75rem] text-ink-400">Running in the background. Keep working.</span>
                  {genDone ? (
                    <button
                      onClick={finishNow}
                      className="inline-flex items-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-[8px] text-[0.8125rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer"
                    >
                      Open report <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setGenMinimized(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-canvas rounded-[8px] transition-colors cursor-pointer"
                    >
                      <Minimize2 size={14} /> Minimize
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: suppressed ? 0 : 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
        className={`fixed inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] z-50 ${suppressed ? 'pointer-events-none' : ''}`}
        onClick={attemptClose}
      />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={suppressed ? { opacity: 0, scale: 0.96, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        onAnimationComplete={() => { if (suppressed) setSuppressedSettled(true); }}
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1040px] max-w-[95vw] h-[662px] max-h-[90vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col ${suppressed ? 'pointer-events-none' : ''}`}
        role="dialog" aria-modal="true" aria-label={`Generate ${template.name}`}
        aria-hidden={suppressed}
        inert={suppressedSettled}
      >
        {/* Title bar + inline stepper — one compact row so a long template name
            never balloons the header. Title truncates; the step indicator and
            close stay pinned right. */}
        <header className="shrink-0 px-6 py-3 border-b border-canvas-border flex items-center gap-4">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 flex items-center justify-center shrink-0 ring-1 ring-brand-200/60">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight truncate">Generate {template.name}</h2>
            <p className="text-[0.75rem] text-ink-500 leading-snug truncate">
              {step === 1 ? 'Pick the queries this report is built from' : 'Review arrangement & executive summary'}
            </p>
          </div>
          {/* Compact two-step progress — dots + labels, no heavy pill chrome. */}
          <nav aria-label="Progress" className="hidden md:flex items-center gap-2.5 shrink-0">
            {['Pick queries', 'Review'].map((label, i) => {
              const activeIdx = step - 1;
              const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'todo';
              return (
                <div key={label} className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-[0.75rem] whitespace-nowrap transition-colors ${
                    state === 'active' ? 'font-semibold text-brand-700' : state === 'done' ? 'font-medium text-ink-600' : 'font-medium text-ink-400'
                  }`} aria-current={state === 'active' ? 'step' : undefined}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.625rem] font-semibold transition-colors ${
                      state === 'active' ? 'bg-brand-600 text-white' : state === 'done' ? 'bg-compliant text-white' : 'bg-white text-ink-400 ring-1 ring-canvas-border'
                    }`}>
                      {state === 'done' ? <Check size={11} strokeWidth={3} /> : i + 1}
                    </span>
                    {label}
                  </span>
                  {i < 1 && <span className="w-6 h-px bg-canvas-border" aria-hidden="true" />}
                </div>
              );
            })}
          </nav>
          <button
            onClick={attemptClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {step === 1 ? (
          <>
            <div className="flex-1 min-h-0 flex">
              <div className="flex-1 min-w-0 flex flex-col md:border-r border-canvas-border">
            {/* Search + severity filter */}
            <div className="shrink-0 px-6 pt-4 pb-1 flex items-center justify-between gap-3">
              <div className="relative w-[260px] shrink-0">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search queries…"
                  className="w-full h-8 pl-8 pr-8 rounded-[8px] border border-canvas-border text-[0.75rem] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                />
                <AnimatePresence>
                  {search && (
                    <motion.button
                      key="clear-search"
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.12, ease }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-draft-50 cursor-pointer"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Type — a content-kind switch (single choice, always visible) */}
                <div className="inline-flex items-center rounded-[8px] border border-canvas-border bg-canvas p-0.5" role="tablist" aria-label="Filter by type">
                  {(['All', 'Queries', 'Bulk Audit'] as const).map(t => {
                    const active = typeFilter === t;
                    return (
                      <button
                        key={t}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTypeFilter(t)}
                        className={`relative h-7 px-2.5 rounded-[6px] text-[0.75rem] whitespace-nowrap cursor-pointer transition-colors active:scale-[0.97] ${active ? 'text-brand-700 font-semibold' : 'text-ink-500 font-medium hover:text-ink-800'}`}
                      >
                        {active && (
                          <motion.span
                            layoutId="typeFilterPill"
                            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 38 }}
                            className="absolute inset-0 rounded-[6px] bg-white shadow-[0_1px_2px_rgba(15,8,30,0.08)] ring-1 ring-brand-200/60"
                          />
                        )}
                        <span className="relative z-10">{t}</span>
                      </button>
                    );
                  })}
                </div>
                <ColumnFilter
                  label="Severity"
                  options={['High', 'Medium', 'Low']}
                  value={sevFilters}
                  onChange={setSevFilters}
                  variant="button"
                  size="sm"
                  icon
                  selectIndicator="checkbox"
                  align="end"
                />
              </div>
            </div>

            {/* Query rows */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
              {rows.length === 0 ? (() => {
                const hasSearch = !!search.trim();
                const hasFilters = sevFilters.length > 0 || typeFilter !== 'All';
                return (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease }}
                    className="h-full flex flex-col items-center justify-center text-center px-6 gap-4"
                  >
                    <motion.span
                      className="w-12 h-12 rounded-full bg-draft-50 ring-1 ring-canvas-border flex items-center justify-center"
                      initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.04 }}
                    >
                      <SearchX size={20} className="text-ink-400" aria-hidden="true" />
                    </motion.span>
                    <div className="space-y-1">
                      <p className="text-[0.875rem] font-semibold text-ink-800">No matching queries</p>
                      <p className="text-[0.75rem] text-ink-400 leading-relaxed max-w-[300px]">
                        {hasSearch ? (
                          <>Nothing matches “<span className="font-medium text-ink-600">{search.trim()}</span>”{hasFilters ? ' with the current filters' : ''}. Try a different term{hasFilters ? ' or clear your filters' : ''}.</>
                        ) : (
                          <>No queries match the current filters. Try widening them.</>
                        )}
                      </p>
                    </div>
                  </motion.div>
                );
              })() : (() => {
                const checkbox = (state: 'on' | 'off' | 'some') => (
                  <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${state !== 'off' ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-white'}`}>
                    {state !== 'off' && (
                      <motion.span
                        className="flex"
                        initial={reduce ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                      >
                        {state === 'on' ? <Check size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                      </motion.span>
                    )}
                  </span>
                );
                const rowState = (item: PickableQuery) => {
                  const isSelected = selected.some(p => p.uid === item.uid);
                  const takenBy = isSelected ? undefined : selected.find(p => p.key === item.key);
                  return { isSelected, keyTaken: !!takenBy, takenFrom: takenBy?.sourceLabel };
                };
                const sevPill = (severity: PickableQuery['severity']) => (
                  <span className="shrink-0">
                    <ReportPill tone={sevTone(severity)}>{severity}</ReportPill>
                  </span>
                );

                // Reports — queries grouped under the report they live in;
                // the header checkbox takes or drops the whole report.
                const groups: [string, PickableQuery[]][] = [];
                  rows.forEach(r => {
                    const g = groups.find(([name]) => name === r.sourceLabel);
                    if (g) g[1].push(r); else groups.push([r.sourceLabel, [r]]);
                  });
                  return (
                    <div className="space-y-3">
                      {groups.map(([name, items]) => {
                        const selCount = items.filter(i => selected.some(p => p.uid === i.uid)).length;
                        const groupState = selCount === items.length ? 'on' : selCount > 0 ? 'some' : 'off';
                        const isWfGroup = items.every(i => i.kind === 'workflow');
                        const isCollapsed = collapsedGroups.has(name);
                        return (
                          <div className="border border-canvas-border rounded-[12px] bg-white overflow-hidden" key={name}>
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 bg-canvas ${isCollapsed ? '' : 'border-b border-canvas-border'}`}
                            >
                              <button
                                onClick={() => toggleReportGroup(items)}
                                aria-label={`Select all in ${name}`}
                                className="shrink-0 cursor-pointer"
                              >
                                {checkbox(groupState)}
                              </button>
                              <button
                                onClick={() => toggleGroupCollapse(name)}
                                aria-expanded={!isCollapsed}
                                className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer hover:opacity-80 transition-opacity"
                              >
                                <ChevronDown size={14} className={`shrink-0 text-ink-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                <span className="min-w-0 text-[0.8125rem] font-semibold text-ink-900 truncate">{name}</span>
                              </button>
                              {isWfGroup && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded-full border border-brand-200 bg-brand-50 text-[0.625rem] font-semibold text-brand-700"
                                  title="A Bulk Audit — these rows are completed workflow runs"
                                >
                                  <Workflow size={10} /> Bulk Audit
                                </span>
                              )}
                              <span className="font-mono text-[0.6875rem] tabular-nums text-ink-500 shrink-0">
                                {items.length} {isWfGroup ? (items.length === 1 ? 'workflow' : 'workflows') : (items.length === 1 ? 'query' : 'queries')}
                              </span>
                            </div>
                            <AnimatePresence initial={false}>
                            {!isCollapsed && (
                            <motion.div
                              key="body"
                              initial={reduce ? false : { height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.24, ease }}
                              className="divide-y divide-border-light/70 overflow-hidden"
                            >
                              {items.map(item => {
                                const { isSelected, keyTaken, takenFrom } = rowState(item);
                                return (
                                  <button
                                    key={item.uid}
                                    onClick={() => toggle(item)}
                                    className="w-full flex items-center gap-3 pl-5 pr-3.5 py-2.5 text-left transition-colors cursor-pointer bg-white hover:bg-canvas"
                                  >
                                    {checkbox(isSelected ? 'on' : 'off')}
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-[0.8125rem] font-medium text-ink-800 truncate">{item.label}</span>
                                      {keyTaken ? (
                                        <span className="flex items-center gap-1 text-[0.6875rem] text-brand-600 truncate">
                                          <ArrowLeftRight size={11} className="shrink-0" />
                                          Selected in {takenFrom} — click to swap
                                        </span>
                                      ) : item.kind === 'workflow' ? (
                                        <span className="block text-[0.6875rem] text-ink-400 truncate">{item.wfMeta}</span>
                                      ) : null}
                                    </span>
                                    {sevPill(item.severity)}
                                  </button>
                                );
                              })}
                            </motion.div>
                            )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  );
              })()}
            </div>
              </div>
              {/* Selection panel — the rail analog: the report assembles here as
                  you pick, so step 1 is no longer a blind pick before review. */}
              <aside className="hidden md:flex w-[312px] shrink-0 flex-col bg-canvas">
                <div className="shrink-0 px-4 pt-4 pb-3 flex items-center gap-2">
                  <FileText size={13} className="text-brand-500" />
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-500">In this report</span>
                  <span className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[0.6875rem] font-semibold tabular-nums overflow-hidden transition-colors ${selectedKeyCount > 0 ? 'bg-brand-600 text-white' : 'bg-draft-50 text-ink-400'}`}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={selectedKeyCount}
                        initial={reduce ? false : { y: -8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { y: 8, opacity: 0 }}
                        transition={{ duration: 0.16, ease }}
                      >
                        {selectedKeyCount}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
                  {selected.length === 0 ? (
                    <motion.div
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, ease }}
                      className="h-full flex flex-col items-center justify-center px-6 text-center gap-3"
                    >
                      <motion.span
                        className="w-11 h-11 rounded-full bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center"
                        initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.04 }}
                      >
                        <FileText size={18} className="text-brand-300" aria-hidden="true" />
                      </motion.span>
                      <p className="text-[0.75rem] text-ink-400 leading-relaxed">Nothing selected yet. Pick queries from the left and they'll line up here in order.</p>
                    </motion.div>
                  ) : (
                    <motion.ul layout className="space-y-1">
                      <AnimatePresence initial={false}>
                      {selected.map((s, i) => (
                        <motion.li
                          key={s.uid}
                          layout
                          initial={reduce ? false : { opacity: 0, x: 10, scale: 0.98 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, x: 10, scale: 0.96, transition: { duration: 0.13, ease } }}
                          transition={{ duration: 0.2, ease }}
                          className="group/sel flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] bg-white border border-canvas-border hover:border-brand-200 transition-colors"
                        >
                          <span className="w-5 h-5 shrink-0 rounded-[6px] bg-brand-50 text-brand-700 text-[0.625rem] font-bold font-mono tabular-nums flex items-center justify-center">{String(i + 1).padStart(2, '0')}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[0.75rem] font-medium text-ink-800 truncate">{s.label}</span>
                            <span className="block text-[0.625rem] text-ink-400 truncate">{s.kind === 'workflow' ? 'Workflow' : 'Query'} · {s.sourceLabel}</span>
                          </span>
                          <button
                            onClick={() => toggle(s)}
                            aria-label={`Remove ${s.label}`}
                            className="shrink-0 w-6 h-6 rounded-[6px] flex items-center justify-center text-ink-400 hover:text-risk-700 hover:bg-risk-50 opacity-0 group-hover/sel:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </motion.li>
                      ))}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </div>
              </aside>
            </div>

            {/* Footer — left: live selection count + a clear-all reset once
                anything is picked; right: the primary Continue action. (The
                "what to do" instruction lives in the header subtitle, so the
                footer only reports status — no duplicate guidance.) */}
            <div className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`text-[0.75rem] truncate ${selectedKeyCount > 0 ? 'font-medium text-ink-600' : 'text-ink-400'}`}>{selectedSummary}</span>
                {selectedKeyCount > 0 && (
                  <button
                    onClick={() => setSelected([])}
                    className="shrink-0 inline-flex items-center gap-1 h-7 px-2 text-[0.75rem] font-medium text-ink-500 hover:text-brand-600 rounded-[6px] hover:bg-brand-600/[0.06] transition-colors cursor-pointer"
                  >
                    <X size={12} /> Clear all
                  </button>
                )}
              </div>
              <button
                onClick={goPreview}
                disabled={selectedKeyCount === 0 || isCreating}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-[8px] text-[0.8125rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight size={13} />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 — preview */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 bg-draft-50/60">
              {/* Report setup — flat layout (no card chrome) to stay compact. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="report-name" className="text-[0.75rem] font-semibold text-ink-900 shrink-0">Report name</label>
                      <span className="text-ink-300 shrink-0" aria-hidden="true">·</span>
                      <span className="text-[0.75rem] text-ink-400 truncate">Shown as the report title.</span>
                    </div>
                    <input
                      id="report-name"
                      value={reportName}
                      onChange={e => setReportName(e.target.value)}
                      placeholder={`${currentPeriod()} ${template.name}`}
                      className="w-full h-10 px-3.5 rounded-[8px] border border-canvas-border bg-white text-[0.8125rem] text-ink-800 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="report-period" className="text-[0.75rem] font-semibold text-ink-900 shrink-0">Audit period</label>
                      <span className="text-ink-300 shrink-0" aria-hidden="true">·</span>
                      <span className="text-[0.75rem] text-ink-400 truncate">Preset or custom range.</span>
                    </div>
                    <div className="relative" ref={periodRef}>
                      <CalendarRange size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                      <input
                        id="report-period"
                        value={reportPeriod}
                        onChange={e => setReportPeriod(e.target.value)}
                        onFocus={() => setPeriodMenuOpen(false)}
                        placeholder="e.g. FY26 Q2"
                        className="w-full h-10 pl-9 pr-10 rounded-[8px] border border-canvas-border bg-white text-[0.8125rem] text-ink-800 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                      />
                      <button
                        type="button"
                        aria-label="Choose a preset period"
                        aria-expanded={periodMenuOpen}
                        onClick={() => setPeriodMenuOpen(o => !o)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-[6px] flex items-center justify-center text-ink-400 hover:text-ink-800 hover:bg-canvas transition-colors cursor-pointer"
                      >
                        <ChevronDown size={15} className={`transition-transform ${periodMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {periodMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
                            className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 rounded-[8px] border border-canvas-border bg-white shadow-lg py-1"
                            role="listbox"
                          >
                            {periodOptions.map(o => {
                              const active = reportPeriod.trim() === o.value;
                              return (
                                <button
                                  key={o.value}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  onClick={() => { setReportPeriod(o.value); setPeriodMenuOpen(false); }}
                                  className={`w-full flex items-center justify-between gap-3 px-3 h-9 text-left transition-colors cursor-pointer ${active ? 'bg-brand-600/[0.04]' : 'hover:bg-canvas'}`}
                                >
                                  <span className={`text-[0.8125rem] ${active ? 'text-brand-600 font-medium' : 'text-ink-800'}`}>{o.label}</span>
                                  <span className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-[0.6875rem] tabular-nums text-ink-400">{o.value}</span>
                                    {active && <Check size={13} className="text-brand-600" />}
                                  </span>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="exec-summary" className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-900 shrink-0">
                    <Sparkles size={13} className="text-brand-600" /> Executive summary
                  </label>
                  <span className="text-ink-300 shrink-0" aria-hidden="true">·</span>
                  <span className="text-[0.75rem] text-ink-400 truncate">Rolled up from your selection. Editable now and after generation; regenerates unless you've edited it.</span>
                </div>
                <textarea
                  id="exec-summary"
                  value={execSummary}
                  onChange={e => { setExecSummary(e.target.value); setSummaryEdited(true); }}
                  rows={4}
                  className="w-full px-3.5 py-3 rounded-[8px] border border-canvas-border bg-white text-[0.8125rem] leading-relaxed text-ink-500 resize-none focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                />
              </div>

              {ordered.length > 0 && (
                <div className="bg-white rounded-[12px] border border-canvas-border p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[0.75rem] font-semibold text-ink-800">Query order — drag to rearrange</label>
                    <span className="text-[0.6875rem] text-ink-400">{ordered.length} {ordered.length === 1 ? 'query' : 'queries'}</span>
                  </div>
                  <Reorder.Group axis="y" values={ordered} onReorder={setOrdered} as="div" className="space-y-1.5">
                    {ordered.map((q, i) => (
                      <Reorder.Item key={q.id} value={q} as="div"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-canvas-border bg-white cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical size={14} className="text-ink-300 shrink-0" />
                        <span className="w-5 h-5 shrink-0 rounded-[6px] bg-brand-50 text-brand-700 text-[0.625rem] font-bold font-mono tabular-nums flex items-center justify-center">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[0.8125rem] font-medium text-ink-800 truncate">{q.title}</span>
                          <span className="block text-[0.6875rem] text-ink-400 truncate">{q.risk}</span>
                        </span>
                        <span className="shrink-0">
                          <ReportPill tone={sevTone(q.severity)}>{q.severity}</ReportPill>
                        </span>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
              )}

              {orderedWorkflows.length > 0 && (
                <div className="bg-white rounded-[12px] border border-canvas-border p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-800">
                      <Workflow size={13} className="text-brand-600" /> Workflow results — drag to rearrange
                    </label>
                    <span className="text-[0.6875rem] text-ink-400">{orderedWorkflows.length} {orderedWorkflows.length === 1 ? 'workflow' : 'workflows'}</span>
                  </div>
                  <Reorder.Group axis="y" values={orderedWorkflows} onReorder={setOrderedWorkflows} as="div" className="space-y-1.5">
                    {orderedWorkflows.map((w, i) => {
                      const n = w.outputTable?.rows.length ?? 0;
                      return (
                        <Reorder.Item key={w.id} value={w} as="div"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-canvas-border bg-white cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical size={14} className="text-ink-300 shrink-0" />
                          <span className="w-5 h-5 shrink-0 rounded-[6px] bg-brand-50 text-brand-700 text-[0.625rem] font-bold font-mono tabular-nums flex items-center justify-center">{String(ordered.length + i + 1).padStart(2, '0')}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[0.8125rem] font-medium text-ink-800 truncate">{w.name}</span>
                            <span className="block text-[0.6875rem] text-ink-400 truncate font-mono tabular-nums">{w.workflowId} · {w.businessProcess ?? '—'} · {n} flagged {n === 1 ? 'record' : 'records'}</span>
                          </span>
                          <span className="shrink-0">
                            <ReportPill tone={sevTone(w.severity)}>{w.severity}</ReportPill>
                          </span>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center justify-between gap-3">
              <button
                onClick={() => setStep(1)}
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-canvas rounded-[8px] transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft size={13} /> Back
              </button>
              <button
                onClick={() => handleCreate()}
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-[8px] text-[0.8125rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isCreating ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : <>Generate report <ArrowRight size={13} /></>}
              </button>
            </div>
          </>
        )}

        {/* Confirm abandon */}
        <AnimatePresence>
          {confirmAbandon && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-ink-900/30 rounded-[16px] flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.97, y: 4 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 4 }}
                className="bg-white rounded-[12px] border border-canvas-border shadow-xl p-5 w-[340px]"
                role="alertdialog" aria-label="Discard selection?"
              >
                <h3 className="text-[0.875rem] font-semibold text-ink-800 mb-1">Discard selection?</h3>
                <p className="text-[0.75rem] text-ink-500 leading-relaxed mb-4">
                  You've picked {selectedSummary.replace(' selected', '')}. Closing the wizard will discard them.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmAbandon(false)}
                    className="h-8 px-3.5 text-[0.75rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-canvas rounded-[8px] transition-colors cursor-pointer"
                  >
                    Keep editing
                  </button>
                  <button
                    onClick={onClose}
                    className="h-8 px-3.5 text-[0.75rem] font-semibold text-white bg-risk hover:bg-risk-700 rounded-[8px] transition-colors cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
