// Generate-from-template wizard — the ATR wizard pattern generalized to every
// template. Step 1 assembles the report body from the queries (and, for Bulk
// Audit sources, the workflow runs) that live in the user's reports; Step 2
// previews the arrangement with an editable executive-summary rollup. Create
// hands a payload back to ReportsView, which owns report construction.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  X, FileText, Search, Check, Minus, ArrowRight, ArrowLeft,
  Loader2, GripVertical, Sparkles, Settings, Workflow,
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import ColumnFilter from '../shared/ColumnFilter';
import {
  toGeneratedQuery, arrangeForTemplate, composeExecSummary, workflowToQueryDef,
  type PickableQuery, type GeneratedQueryDef,
} from './templateQueryPool';
import type { WorkflowResult } from './ReportsView';

export type WizardCreatePayload = {
  /** Ordered, arranged query blocks. */
  queries: GeneratedQueryDef[];
  /** Ordered workflow result blocks (Bulk Audit sources). */
  workflows: WorkflowResult[];
  execSummary: string;
};

const sevChip = (sev: string) =>
  sev === 'High' ? 'text-risk-700 bg-risk-50 border-risk-200'
  : sev === 'Medium' ? 'text-mitigated-700 bg-mitigated-50 border-mitigated-200'
  : 'text-compliant-700 bg-compliant-50 border-compliant-200';

export default function GenerateReportWizard({ template, onClose, onCreate, onCustomize, suppressed = false, sources = [] }: {
  template: { id: string; name: string; desc: string };
  onClose: () => void;
  onCreate: (payload: WizardCreatePayload) => void;
  /** Opens the template editor on top — the wizard stays mounted, suppressed. */
  onCustomize?: () => void;
  /** Hidden + inert while the template editor is stacked above it, so the
   *  wizard's selections survive the round-trip. */
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
  const [dupNotice, setDupNotice] = useState<string | null>(null);
  const [ordered, setOrdered] = useState<GeneratedQueryDef[]>([]);
  const [orderedWorkflows, setOrderedWorkflows] = useState<WorkflowResult[]>([]);
  const [execSummary, setExecSummary] = useState('');
  const [summaryEdited, setSummaryEdited] = useState(false);
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
    setDupNotice(null);
    setSelected(prev => {
      const exact = prev.find(p => p.uid === item.uid);
      if (exact) return prev.filter(p => p.uid !== item.uid);
      const sameKey = prev.find(p => p.key === item.key);
      if (sameKey) {
        setDupNotice('Same underlying query already added — it\'s included once.');
        return prev;
      }
      return [...prev, item];
    });
  };

  // Report group header checkbox: all selected → drop the report's queries;
  // otherwise add every query in the report not already covered.
  const toggleReportGroup = (items: PickableQuery[]) => {
    setDupNotice(null);
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
      queries: ordered,
      workflows: orderedWorkflows,
      execSummary: execSummary.trim() || summaryFallback(),
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
        className={`fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-50 ${suppressed ? 'pointer-events-none' : ''}`}
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
            <div className="shrink-0 px-6 pt-4 pb-1 border-t border-border-light flex items-center justify-between gap-3">
              <div className="relative w-[260px] shrink-0">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search queries…"
                  className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-border-light text-[12px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Type — a content-kind switch (single choice, always visible) */}
                <div className="inline-flex items-center rounded-[8px] border border-border-light bg-paper-50/60 p-0.5" role="tablist" aria-label="Filter by type">
                  {(['All', 'Queries', 'Bulk Audit'] as const).map(t => {
                    const active = typeFilter === t;
                    return (
                      <button
                        key={t}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTypeFilter(t)}
                        className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer ${active ? 'bg-white text-primary shadow-[0_1px_2px_rgba(15,8,30,0.08)]' : 'text-text-secondary hover:text-text'}`}
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
                  selectIndicator="checkbox"
                  align="end"
                />
              </div>
            </div>

            {/* Query rows */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
              {rows.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[13px] text-text-muted">
                    No items match {search ? `“${search}”` : 'your filters'}.
                  </p>
                </div>
              ) : (() => {
                const checkbox = (state: 'on' | 'off' | 'some') => (
                  <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${state !== 'off' ? 'bg-primary border-primary text-white' : 'border-ink-300 bg-white'}`}>
                    {state === 'on' && <Check size={12} strokeWidth={3} />}
                    {state === 'some' && <Minus size={12} strokeWidth={3} />}
                  </span>
                );
                const rowState = (item: PickableQuery) => {
                  const isSelected = selected.some(p => p.uid === item.uid);
                  return { isSelected, keyTaken: !isSelected && selected.some(p => p.key === item.key) };
                };
                const sevPill = (severity: PickableQuery['severity']) => (
                  <span className={`shrink-0 inline-flex items-center h-6 px-2 rounded-full border text-[11px] font-semibold ${sevChip(severity)}`}>
                    {severity}
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
                          <div key={name} className="border border-border-light rounded-[12px] bg-white overflow-hidden">
                            <button
                              onClick={() => toggleReportGroup(items)}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-paper-50/60 border-b border-border-light text-left cursor-pointer hover:bg-paper-50 transition-colors"
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
                                const { isSelected, keyTaken } = rowState(item);
                                return (
                                  <button
                                    key={item.uid}
                                    onClick={() => toggle(item)}
                                    className={`w-full flex items-center gap-3 pl-5 pr-3.5 py-2.5 text-left transition-colors cursor-pointer ${isSelected ? 'bg-primary/[0.04]' : keyTaken ? 'bg-paper-50/60 opacity-60' : 'bg-white hover:bg-canvas'}`}
                                  >
                                    {checkbox(isSelected ? 'on' : 'off')}
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-[13px] font-medium text-text truncate">{item.label}</span>
                                      {item.kind === 'workflow' ? (
                                        <span className="block text-[11px] text-text-muted truncate">
                                          {keyTaken ? 'Already added' : item.wfMeta}
                                        </span>
                                      ) : keyTaken && (
                                        <span className="block text-[11px] text-text-muted truncate">Already added</span>
                                      )}
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

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-border-light flex items-center justify-between gap-3">
              {onCustomize ? (
                <button
                  onClick={onCustomize}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-medium text-text-secondary bg-white border border-border-light hover:border-primary/40 hover:text-primary rounded-[8px] transition-colors cursor-pointer"
                >
                  <Settings size={13} /> Customize template
                </button>
              ) : <span />}
              <div className="flex items-center gap-3">
                <AnimatePresence>
                  {dupNotice && (
                    <motion.span
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-[11px] text-mitigated-700"
                    >
                      {dupNotice}
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="text-[12px] text-text-muted">
                  {selectedSummary}
                </span>
                <button
                  onClick={goPreview}
                  disabled={selectedKeyCount === 0 || isCreating}
                  className="inline-flex items-center gap-1.5 h-9 px-5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 — preview */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 bg-[#F4F2F7]/60">
              <div className="bg-white rounded-[12px] border border-border-light p-4">
                <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2">
                  <Sparkles size={13} className="text-primary" /> Executive Summary — rolled up from your selection
                </label>
                <textarea
                  value={execSummary}
                  onChange={e => { setExecSummary(e.target.value); setSummaryEdited(true); }}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-[8px] border border-border-light text-[12.5px] leading-relaxed text-text-secondary resize-none focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
                <p className="text-[11px] text-text-muted mt-1.5">Editable now and after generation. Regenerates from your selection unless you've edited it.</p>
              </div>

              {ordered.length > 0 && (
                <div className="bg-white rounded-[12px] border border-border-light p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[12px] font-semibold text-text">Query order — drag to rearrange</label>
                    <span className="text-[11px] text-text-muted">{ordered.length} {ordered.length === 1 ? 'query' : 'queries'}</span>
                  </div>
                  <Reorder.Group axis="y" values={ordered} onReorder={setOrdered} as="div" className="space-y-1.5">
                    {ordered.map((q, i) => (
                      <Reorder.Item key={q.id} value={q} as="div"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-border-light bg-white cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical size={14} className="text-ink-300 shrink-0" />
                        <span className="text-[10px] font-bold text-primary/60 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12.5px] font-medium text-text truncate">{q.title}</span>
                          <span className="block text-[11px] text-text-muted truncate">{q.risk}</span>
                        </span>
                        <span className={`shrink-0 inline-flex items-center h-6 px-2 rounded-full border text-[11px] font-semibold ${sevChip(q.severity)}`}>
                          {q.severity}
                        </span>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
              )}

              {orderedWorkflows.length > 0 && (
                <div className="bg-white rounded-[12px] border border-border-light p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-text">
                      <Workflow size={13} className="text-brand-600" /> Workflow results — drag to rearrange
                    </label>
                    <span className="text-[11px] text-text-muted">{orderedWorkflows.length} {orderedWorkflows.length === 1 ? 'workflow' : 'workflows'}</span>
                  </div>
                  <Reorder.Group axis="y" values={orderedWorkflows} onReorder={setOrderedWorkflows} as="div" className="space-y-1.5">
                    {orderedWorkflows.map((w, i) => {
                      const n = w.outputTable?.rows.length ?? 0;
                      return (
                        <Reorder.Item key={w.id} value={w} as="div"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-border-light bg-white cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical size={14} className="text-ink-300 shrink-0" />
                          <span className="text-[10px] font-bold text-brand-600/60 w-5 shrink-0">{String(ordered.length + i + 1).padStart(2, '0')}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[12.5px] font-medium text-text truncate">{w.name}</span>
                            <span className="block text-[11px] text-text-muted truncate font-mono tabular-nums">{w.workflowId} · {w.businessProcess ?? '—'} · {n} flagged {n === 1 ? 'record' : 'records'}</span>
                          </span>
                          <span className={`shrink-0 inline-flex items-center h-6 px-2 rounded-full border text-[11px] font-semibold ${sevChip(w.severity)}`}>
                            {w.severity}
                          </span>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-border-light flex items-center justify-between gap-3">
              <button
                onClick={() => setStep(1)}
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-text bg-white border border-border-light hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft size={13} /> Back
              </button>
              <button
                onClick={() => handleCreate()}
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 h-9 px-5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
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
                className="bg-white rounded-[12px] border border-border-light shadow-xl p-5 w-[340px]"
                role="alertdialog" aria-label="Discard selection?"
              >
                <h3 className="text-[14px] font-semibold text-text mb-1">Discard selection?</h3>
                <p className="text-[12px] text-text-secondary leading-relaxed mb-4">
                  You've picked {selectedSummary.replace(' selected', '')}. Closing the wizard will discard them.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmAbandon(false)}
                    className="h-8 px-3.5 text-[12px] font-semibold text-text bg-white border border-border-light hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer"
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
