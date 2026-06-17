// Generate-from-template wizard — the ATR wizard pattern generalized to every
// template. Step 1 assembles the report body from the queries (and, for Bulk
// Audit sources, the workflow runs) that live in the user's reports; Step 2
// previews the arrangement with an editable executive-summary rollup. Create
// hands a payload back to ReportsView, which owns report construction.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  X, FileText, Search, Check, Minus, ArrowRight, ArrowLeft,
  Loader2, GripVertical, Sparkles, Workflow, CalendarRange, ChevronDown, ArrowLeftRight,
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
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [sevFilters, setSevFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<'All' | 'Queries' | 'Bulk Audit'>('All');
  const [selected, setSelected] = useState<PickableQuery[]>([]);
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
  const [isCreating, setIsCreating] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const attemptClose = () => {
    if (isCreating) return;
    if (selected.length > 0) setConfirmAbandon(true);
    else onClose();
  };
  useFocusTrap(containerRef, !suppressed, attemptClose);

  // Make the wizard fully `inert` (out of the tab order) once the suppress
  // fade-out finishes — set by the panel's onAnimationComplete. Cleared the
  // instant we un-suppress so the fade-in is interactive again.
  const [suppressedSettled, setSuppressedSettled] = useState(false);
  useEffect(() => { if (!suppressed) setSuppressedSettled(false); }, [suppressed]);

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
    if (isCreating) return;
    setIsCreating(true);
    const payload: WizardCreatePayload = {
      reportName: reportName.trim() || template.name,
      queries: ordered,
      workflows: orderedWorkflows,
      execSummary: execSummary.trim() || summaryFallback(),
      reportPeriod: reportPeriod.trim() || currentPeriod(),
    };
    window.setTimeout(() => onCreate(payload), 650);
  };

  const selectedKeyCount = selected.length;
  const selWfCount = selected.filter(s => s.kind === 'workflow').length;
  const selQCount = selectedKeyCount - selWfCount;
  const selectedSummary =
    selWfCount === 0 ? `${selQCount} ${selQCount === 1 ? 'query' : 'queries'} selected`
    : selQCount === 0 ? `${selWfCount} ${selWfCount === 1 ? 'workflow' : 'workflows'} selected`
    : `${selQCount} ${selQCount === 1 ? 'query' : 'queries'} · ${selWfCount} ${selWfCount === 1 ? 'workflow' : 'workflows'} selected`;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: suppressed ? 0 : 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
        className={`fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50 ${suppressed ? 'pointer-events-none' : ''}`}
        onClick={attemptClose}
      />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={suppressed ? { opacity: 0, scale: 0.96, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        onAnimationComplete={() => { if (suppressed) setSuppressedSettled(true); }}
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[840px] max-w-[94vw] h-[78vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col ${suppressed ? 'pointer-events-none' : ''}`}
        role="dialog" aria-modal="true" aria-label={`Generate ${template.name}`}
        aria-hidden={suppressed}
        inert={suppressedSettled}
      >
        {/* Title bar */}
        <header className="shrink-0 px-6 py-3 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Generate {template.name}</h2>
              <p className="text-[0.75rem] text-ink-500 leading-snug">
                Step {step} of 2 — {step === 1 ? 'pick the queries this report is built from' : 'review arrangement & executive summary'}
              </p>
            </div>
          </div>
          <button
            onClick={attemptClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {step === 1 ? (
          <>
            {/* Search + severity filter */}
            <div className="shrink-0 px-6 pt-4 pb-1 border-t border-canvas-border flex items-center justify-between gap-3">
              <div className="relative w-[260px] shrink-0">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search queries…"
                  className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-canvas-border text-[12px] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Type — a content-kind switch (single choice, always visible) */}
                <div className="inline-flex items-center rounded-[8px] border border-canvas-border bg-paper-50/60 p-0.5" role="tablist" aria-label="Filter by type">
                  {(['All', 'Queries', 'Bulk Audit'] as const).map(t => {
                    const active = typeFilter === t;
                    return (
                      <button
                        key={t}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTypeFilter(t)}
                        className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer ${active ? 'bg-white text-brand-600 shadow-[0_1px_2px_rgba(15,8,30,0.08)]' : 'text-ink-500 hover:text-ink-800'}`}
                      >
                        {t}
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
                  icon
                  selectIndicator="checkbox"
                  align="end"
                />
              </div>
            </div>

            {/* Query rows */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
              {rows.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[13px] text-ink-400">
                    No items match {search ? `“${search}”` : 'your filters'}.
                  </p>
                </div>
              ) : (() => {
                const checkbox = (state: 'on' | 'off' | 'some') => (
                  <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${state !== 'off' ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-white'}`}>
                    {state === 'on' && <Check size={12} strokeWidth={3} />}
                    {state === 'some' && <Minus size={12} strokeWidth={3} />}
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
                        return (
                          <div key={name} className="border border-canvas-border rounded-[12px] bg-white overflow-hidden">
                            <button
                              onClick={() => toggleReportGroup(items)}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-paper-50/60 border-b border-canvas-border text-left cursor-pointer hover:bg-paper-50 transition-colors"
                            >
                              {checkbox(groupState)}
                              <span className="flex-1 min-w-0 text-[13px] font-semibold text-ink-900 truncate">{name}</span>
                              {isWfGroup && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded-full border border-brand-200 bg-brand-50 text-[10px] font-semibold text-brand-700"
                                  title="A Bulk Audit — these rows are completed workflow runs"
                                >
                                  <Workflow size={10} /> Bulk Audit
                                </span>
                              )}
                              <span className="font-mono text-[11px] tabular-nums text-ink-500 shrink-0">
                                {items.length} {isWfGroup ? (items.length === 1 ? 'workflow' : 'workflows') : (items.length === 1 ? 'query' : 'queries')}
                              </span>
                            </button>
                            <div className="divide-y divide-border-light/70">
                              {items.map(item => {
                                const { isSelected, keyTaken, takenFrom } = rowState(item);
                                return (
                                  <button
                                    key={item.uid}
                                    onClick={() => toggle(item)}
                                    className={`w-full flex items-center gap-3 pl-5 pr-3.5 py-2.5 text-left transition-colors cursor-pointer ${isSelected ? 'bg-brand-600/[0.04]' : 'bg-white hover:bg-canvas'}`}
                                  >
                                    {checkbox(isSelected ? 'on' : 'off')}
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-[13px] font-medium text-ink-800 truncate">{item.label}</span>
                                      {keyTaken ? (
                                        <span className="flex items-center gap-1 text-[11px] text-brand-600 truncate">
                                          <ArrowLeftRight size={11} className="shrink-0" />
                                          Selected in {takenFrom} — click to swap
                                        </span>
                                      ) : item.kind === 'workflow' ? (
                                        <span className="block text-[11px] text-ink-400 truncate">{item.wfMeta}</span>
                                      ) : null}
                                    </span>
                                    {sevPill(item.severity)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
              })()}
            </div>

            {/* Footer — left: live selection status + a clear-all reset once
                anything is picked; right: the primary Continue action. */}
            <div className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedKeyCount > 0 ? (
                  <>
                    <span className="text-[12px] font-medium text-ink-600 truncate">{selectedSummary}</span>
                    <button
                      onClick={() => setSelected([])}
                      className="shrink-0 inline-flex items-center gap-1 h-7 px-2 text-[12px] font-medium text-ink-500 hover:text-brand-600 rounded-[6px] hover:bg-brand-600/[0.06] transition-colors cursor-pointer"
                    >
                      <X size={12} /> Clear all
                    </button>
                  </>
                ) : (
                  <span className="text-[12px] text-ink-400">Pick the queries and workflows to include</span>
                )}
              </div>
              <button
                onClick={goPreview}
                disabled={selectedKeyCount === 0 || isCreating}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-[8px] text-[13px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight size={13} />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 — preview */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 bg-[#F4F2F7]/60">
              {/* Report setup — flat layout (no card chrome) to stay compact. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="report-name" className="text-[12px] font-semibold text-ink-900 shrink-0">Report name</label>
                      <span className="text-ink-300 shrink-0" aria-hidden="true">·</span>
                      <span className="text-[12px] text-ink-400 truncate">Shown as the report title.</span>
                    </div>
                    <input
                      id="report-name"
                      value={reportName}
                      onChange={e => setReportName(e.target.value)}
                      placeholder={`${currentPeriod()} ${template.name}`}
                      className="w-full h-10 px-3.5 rounded-[8px] border border-canvas-border bg-white text-[12.5px] text-ink-800 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="report-period" className="text-[12px] font-semibold text-ink-900 shrink-0">Audit period</label>
                      <span className="text-ink-300 shrink-0" aria-hidden="true">·</span>
                      <span className="text-[12px] text-ink-400 truncate">Preset or custom range.</span>
                    </div>
                    <div className="relative" ref={periodRef}>
                      <CalendarRange size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                      <input
                        id="report-period"
                        value={reportPeriod}
                        onChange={e => setReportPeriod(e.target.value)}
                        onFocus={() => setPeriodMenuOpen(false)}
                        placeholder="e.g. FY26 Q2"
                        className="w-full h-10 pl-9 pr-10 rounded-[8px] border border-canvas-border bg-white text-[12.5px] text-ink-800 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
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
                                  <span className={`text-[12.5px] ${active ? 'text-brand-600 font-medium' : 'text-ink-800'}`}>{o.label}</span>
                                  <span className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-[11px] tabular-nums text-ink-400">{o.value}</span>
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
                  <label htmlFor="exec-summary" className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-900 shrink-0">
                    <Sparkles size={13} className="text-brand-600" /> Executive summary
                  </label>
                  <span className="text-ink-300 shrink-0" aria-hidden="true">·</span>
                  <span className="text-[12px] text-ink-400 truncate">Rolled up from your selection. Editable now and after generation; regenerates unless you've edited it.</span>
                </div>
                <textarea
                  id="exec-summary"
                  value={execSummary}
                  onChange={e => { setExecSummary(e.target.value); setSummaryEdited(true); }}
                  rows={4}
                  className="w-full px-3.5 py-3 rounded-[8px] border border-canvas-border bg-white text-[12.5px] leading-relaxed text-ink-500 resize-none focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                />
              </div>

              {ordered.length > 0 && (
                <div className="bg-white rounded-[12px] border border-canvas-border p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[12px] font-semibold text-ink-800">Query order — drag to rearrange</label>
                    <span className="text-[11px] text-ink-400">{ordered.length} {ordered.length === 1 ? 'query' : 'queries'}</span>
                  </div>
                  <Reorder.Group axis="y" values={ordered} onReorder={setOrdered} as="div" className="space-y-1.5">
                    {ordered.map((q, i) => (
                      <Reorder.Item key={q.id} value={q} as="div"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-canvas-border bg-white cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical size={14} className="text-ink-300 shrink-0" />
                        <span className="text-[10px] font-bold text-brand-600/60 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12.5px] font-medium text-ink-800 truncate">{q.title}</span>
                          <span className="block text-[11px] text-ink-400 truncate">{q.risk}</span>
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
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-800">
                      <Workflow size={13} className="text-brand-600" /> Workflow results — drag to rearrange
                    </label>
                    <span className="text-[11px] text-ink-400">{orderedWorkflows.length} {orderedWorkflows.length === 1 ? 'workflow' : 'workflows'}</span>
                  </div>
                  <Reorder.Group axis="y" values={orderedWorkflows} onReorder={setOrderedWorkflows} as="div" className="space-y-1.5">
                    {orderedWorkflows.map((w, i) => {
                      const n = w.outputTable?.rows.length ?? 0;
                      return (
                        <Reorder.Item key={w.id} value={w} as="div"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-canvas-border bg-white cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical size={14} className="text-ink-300 shrink-0" />
                          <span className="text-[10px] font-bold text-brand-600/60 w-5 shrink-0">{String(ordered.length + i + 1).padStart(2, '0')}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[12.5px] font-medium text-ink-800 truncate">{w.name}</span>
                            <span className="block text-[11px] text-ink-400 truncate font-mono tabular-nums">{w.workflowId} · {w.businessProcess ?? '—'} · {n} flagged {n === 1 ? 'record' : 'records'}</span>
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
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft size={13} /> Back
              </button>
              <button
                onClick={() => handleCreate()}
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-[8px] text-[13px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
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
                <h3 className="text-[14px] font-semibold text-ink-800 mb-1">Discard selection?</h3>
                <p className="text-[12px] text-ink-500 leading-relaxed mb-4">
                  You've picked {selectedSummary.replace(' selected', '')}. Closing the wizard will discard them.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmAbandon(false)}
                    className="h-8 px-3.5 text-[12px] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer"
                  >
                    Keep editing
                  </button>
                  <button
                    onClick={onClose}
                    className="h-8 px-3.5 text-[12px] font-semibold text-white bg-risk hover:bg-risk-700 rounded-[8px] transition-colors cursor-pointer"
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
