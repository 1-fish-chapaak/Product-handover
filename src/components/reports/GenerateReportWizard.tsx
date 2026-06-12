// Generate-from-template wizard — the ATR wizard pattern generalized to every
// template. Step 1 assembles queries from three sources (freely mixable,
// deduped by underlying query); Step 2 previews the template's arrangement
// with an editable executive-summary rollup. Create hands a payload back to
// ReportsView, which owns report construction and state.

import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  X, FileText, MessageSquare, Workflow, Search, Check, Minus, ArrowRight, ArrowLeft,
  Loader2, GripVertical, Sparkles, BookOpen, Settings,
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  QUERY_POOL, toGeneratedQuery, arrangeForTemplate, composeExecSummary,
  defForKey, BULK_ROLLUP_KEY,
  type PickableQuery, type QuerySource, type GeneratedQueryDef,
} from './templateQueryPool';

export type WizardCreatePayload = {
  /** Ordered, arranged query blocks — always at least one. */
  queries: GeneratedQueryDef[];
  execSummary: string;
};

const SOURCE_TABS: { id: QuerySource; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'report', label: 'Reports', icon: BookOpen, desc: 'The most used source — take single queries or a whole generated report.' },
  { id: 'ira', label: 'Recent Chats', icon: MessageSquare, desc: 'Queries you asked IRA, the AI assistant, in recent chats.' },
  { id: 'workflow', label: 'Workflows', icon: Workflow, desc: 'Workflows that finished a run with query results. 2+ make a bulk audit.' },
];

const sevChip = (sev: string) =>
  sev === 'High' ? 'text-risk-700 bg-risk-50 border-risk-200'
  : sev === 'Medium' ? 'text-mitigated-700 bg-mitigated-50 border-mitigated-200'
  : 'text-compliant-700 bg-compliant-50 border-compliant-200';

export default function GenerateReportWizard({ template, onClose, onCreate, onCustomize }: {
  template: { id: string; name: string; desc: string };
  onClose: () => void;
  onCreate: (payload: WizardCreatePayload) => void;
  /** Opens the template editor instead — closes the wizard. */
  onCustomize?: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [sourceTab, setSourceTab] = useState<QuerySource>('report');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PickableQuery[]>([]);
  const [dupNotice, setDupNotice] = useState<string | null>(null);
  const [ordered, setOrdered] = useState<GeneratedQueryDef[]>([]);
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
  useFocusTrap(containerRef, true, attemptClose);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = QUERY_POOL[sourceTab];
    if (!q) return list;
    return list.filter(r =>
      r.label.toLowerCase().includes(q) ||
      r.sourceLabel.toLowerCase().includes(q)
    );
  }, [sourceTab, search]);

  const toggle = (item: PickableQuery) => {
    setDupNotice(null);
    setSelected(prev => {
      const exact = prev.find(p => p.uid === item.uid);
      if (exact) return prev.filter(p => p.uid !== item.uid);
      const sameKey = prev.find(p => p.key === item.key);
      if (sameKey) {
        const from = SOURCE_TABS.find(t => t.id === sameKey.source)?.label ?? sameKey.source;
        setDupNotice(`Same underlying query already added from ${from} — it's included once.`);
        return prev;
      }
      return [...prev, item];
    });
  };

  // Reports-tab group header checkbox: all selected → drop the report's
  // queries; otherwise add every query not already covered from elsewhere.
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
      if (additions.length < items.length - selCount) {
        setDupNotice('Some queries were already added from another source — each is included once.');
      }
      return [...prev, ...additions];
    });
  };

  // 2+ workflows selected = a bulk audit: the cross-workflow rollup query is
  // appended at Continue (unless the same query is already in the selection).
  const wfSelectedCount = selected.filter(s => s.source === 'workflow').length;
  const isBulkAudit = wfSelectedCount >= 2;

  const goPreview = () => {
    let picked = selected.map(s => toGeneratedQuery(s, 'You'));
    if (isBulkAudit && !selected.some(s => s.key === BULK_ROLLUP_KEY)) {
      const rollup = defForKey(BULK_ROLLUP_KEY, 'You');
      if (rollup) picked = [...picked, rollup];
    }
    const defs = arrangeForTemplate(template.id, picked);
    setOrdered(defs);
    if (!summaryEdited) setExecSummary(composeExecSummary(template.name, defs));
    setStep(2);
  };

  const handleCreate = () => {
    if (isCreating) return;
    setIsCreating(true);
    const payload: WizardCreatePayload = {
      queries: ordered,
      execSummary: execSummary.trim() || composeExecSummary(template.name, ordered),
    };
    window.setTimeout(() => onCreate(payload), 650);
  };

  const selectedKeyCount = selected.length;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-50"
        onClick={attemptClose}
      />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[840px] max-w-[94vw] h-[78vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col"
        role="dialog" aria-modal="true" aria-label={`Generate ${template.name}`}
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
            {/* Source tabs — same underline pattern as the Reports page tabs */}
            <div className="shrink-0 px-6 pt-1 flex items-end border-b border-border-light">
              {SOURCE_TABS.map(t => {
                const Icon = t.icon;
                const active = sourceTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSourceTab(t.id)}
                    className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors cursor-pointer ${active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={14} />
                      {t.label}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{QUERY_POOL[t.id].length}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active-source caption + search */}
            <div className="shrink-0 px-6 pt-3 pb-1 flex items-center justify-between gap-4">
              <p className="text-[12px] text-text-muted truncate min-w-0">
                {SOURCE_TABS.find(t => t.id === sourceTab)?.desc}
              </p>
              <div className="relative w-[240px] shrink-0">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search queries…"
                  className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-border-light text-[12px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            {/* Query rows */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
              {rows.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[13px] text-text-muted">No queries match “{search}”.</p>
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
                if (sourceTab === 'report') {
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
                        return (
                          <div key={name} className="border border-border-light rounded-[12px] bg-white overflow-hidden">
                            <button
                              onClick={() => toggleReportGroup(items)}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-paper-50/60 border-b border-border-light text-left cursor-pointer hover:bg-paper-50 transition-colors"
                            >
                              {checkbox(groupState)}
                              <span className="flex-1 min-w-0 text-[13px] font-semibold text-ink-900 truncate">{name}</span>
                              <span className="font-mono text-[11px] tabular-nums text-ink-500 shrink-0">
                                {items.length} {items.length === 1 ? 'query' : 'queries'}
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
                                      {keyTaken && (
                                        <span className="block text-[11px] text-text-muted truncate">Already added from another source</span>
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
                }

                // Recent Chats — identical to the platform's Add Query picker:
                // TODAY / YESTERDAY / … buckets, plain prompt rows, selection
                // shown by the brand border (no checkbox).
                if (sourceTab === 'ira') {
                  const buckets: [string, PickableQuery[]][] = [];
                  rows.forEach(r => {
                    const g = buckets.find(([name]) => name === (r.chatGroup ?? ''));
                    if (g) g[1].push(r); else buckets.push([r.chatGroup ?? '', [r]]);
                  });
                  return (
                    <div className="space-y-4">
                      {buckets.map(([name, items]) => (
                        <div key={name || 'ungrouped'}>
                          {name && <div className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-2">{name}</div>}
                          <div className="space-y-2">
                            {items.map(item => {
                              const { isSelected, keyTaken } = rowState(item);
                              return (
                                <button
                                  key={item.uid}
                                  onClick={() => toggle(item)}
                                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] border transition-all cursor-pointer text-left ${
                                    isSelected ? 'border-brand-500 bg-brand-50' : keyTaken ? 'border-canvas-border bg-canvas-elevated opacity-60' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                                  }`}
                                >
                                  {checkbox(isSelected ? 'on' : 'off')}
                                  <span className={`flex-1 min-w-0 truncate text-[13px] ${isSelected ? 'text-brand-700 font-medium' : 'text-ink-700'}`}>{item.sourceLabel}</span>
                                  {keyTaken && <span className="text-[11px] text-ink-400 shrink-0">Already added</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Workflows — flat list + eligibility footnote.
                return (
                  <div className="space-y-1.5">
                    {rows.map(item => {
                      const { isSelected, keyTaken } = rowState(item);
                      return (
                        <button
                          key={item.uid}
                          onClick={() => toggle(item)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border text-left transition-colors cursor-pointer ${isSelected ? 'border-primary/40 bg-primary/[0.04]' : keyTaken ? 'border-border-light bg-paper-50/60 opacity-60' : 'border-border-light bg-white hover:bg-canvas'}`}
                        >
                          {checkbox(isSelected ? 'on' : 'off')}
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-medium text-text truncate">{item.label}</span>
                            <span className="block text-[11px] text-text-muted truncate">
                              {keyTaken ? 'Already added from another source' : (
                                <>
                                  <span className="font-mono tabular-nums text-ink-500">{item.wfId}</span>
                                  {' · '}{item.wfMeta}
                                </>
                              )}
                            </span>
                          </span>
                          {sevPill(item.severity)}
                        </button>
                      );
                    })}
                    {!search && (
                      <p className="px-1 pt-2 text-[11px] text-text-muted leading-relaxed">
                        Workflows without a finished run that produced query results aren’t listed.
                        Selecting more than one workflow rolls them into a bulk audit.
                      </p>
                    )}
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
                <AnimatePresence>
                  {isBulkAudit && (
                    <motion.span
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-[11px] font-medium text-brand-700"
                    >
                      Bulk audit — a cross-workflow rollup will be added.
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="text-[12px] text-text-muted">
                  {selectedKeyCount} {selectedKeyCount === 1 ? 'query' : 'queries'} selected
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
                  <Sparkles size={13} className="text-primary" /> Executive Summary — rolled up from your queries
                </label>
                <textarea
                  value={execSummary}
                  onChange={e => { setExecSummary(e.target.value); setSummaryEdited(true); }}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-[8px] border border-border-light text-[12.5px] leading-relaxed text-text-secondary resize-none focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
                <p className="text-[11px] text-text-muted mt-1.5">Editable now and after generation. Regenerates from queries unless you've edited it.</p>
              </div>

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
                  You've picked {selectedKeyCount} {selectedKeyCount === 1 ? 'query' : 'queries'}. Closing the wizard will discard them.
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
