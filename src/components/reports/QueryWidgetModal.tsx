// Query widget picker modal — choose which KPIs / charts / table from a query
// to surface as a widget. Mirrors the platform's canonical AddOutputModal
// (BulkAuditVariants): KPI / Graph / Table tabs, radio-select cards, a
// content-height 840px panel, and the "Nothing selected" footer.

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, FileText, X, Check } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import { KpiTile } from '../shared/KpiTile';
import EmptyState from '../shared/EmptyState';
import { toggleIn } from '../chat/widgetPickerHelpers';
import { cellRender } from './queryTableCell';
import type { QueryGraph, QueryTableDef } from '../../data/queryGraphs';

type TabId = 'kpi' | 'graph' | 'table';

// Dashboard selection idiom: a 2px brand outline on the bordered card (same as
// KpiTile's KPI-as-filter selected state) — borders first, no heavy glow.
const SELECTED = '[outline:2px_solid_var(--color-brand-500)] [outline-offset:-1px]';

/** Selection tick — brand dot when picked, hollow ring when not. */
function PickTick({ picked }: { picked: boolean }) {
  return picked ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white shrink-0">
      <Check size={12} />
    </span>
  ) : (
    <span className="inline-flex w-5 h-5 rounded-full border border-canvas-border shrink-0" />
  );
}

export default function QueryWidgetModal({
  queryId,
  queryTitle,
  kpis,
  charts,
  tables,
  initialKpis,
  initialCharts,
  initialTables,
  onConfirm,
  onClose,
  heading = 'Choose What to Include',
  eyebrowLabel = 'Query',
  confirmLabel = 'Add to Card',
}: {
  queryId: string;
  queryTitle: string;
  kpis: { label: string; value: string }[];
  charts: QueryGraph[];
  tables: QueryTableDef[];
  initialKpis: Set<string>;
  initialCharts: Set<string>;
  initialTables: Set<string>;
  onConfirm: (sel: { kpis: Set<string>; charts: Set<string>; tables: Set<string> }) => void;
  onClose: () => void;
  /** Header title (default "Choose What to Include"). */
  heading?: string;
  /** Eyebrow before the id, e.g. "Query" or "Workflow". */
  eyebrowLabel?: string;
  /** Primary button label (default "Add to Card"). */
  confirmLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onClose);

  const [selKpis, setSelKpis] = useState<Set<string>>(() => new Set(initialKpis));
  const [selCharts, setSelCharts] = useState<Set<string>>(() => new Set(initialCharts));
  const [selTables, setSelTables] = useState<Set<string>>(() => new Set(initialTables));

  const totalSelected = selKpis.size + selCharts.size + selTables.size;
  const totalItems = kpis.length + charts.length + tables.length;

  const tabs: { id: TabId; label: string; count: number; selected: number }[] = [
    kpis.length > 0 && { id: 'kpi' as const, label: 'KPI', count: kpis.length, selected: selKpis.size },
    charts.length > 0 && { id: 'graph' as const, label: 'Graph', count: charts.length, selected: selCharts.size },
    tables.length > 0 && { id: 'table' as const, label: 'Table', count: tables.length, selected: selTables.size },
  ].filter(Boolean) as { id: TabId; label: string; count: number; selected: number }[];

  const [tab, setTab] = useState<TabId>(() => tabs[0]?.id ?? 'kpi');

  // One-click select-all / clear across every tab — the main click reducer.
  const allSelected = totalItems > 0 && totalSelected === totalItems;
  const selectAll = () => {
    setSelKpis(new Set(kpis.map(k => k.label)));
    setSelCharts(new Set(charts.map(c => c.id)));
    setSelTables(new Set(tables.map(t => t.id)));
  };
  const clearAll = () => { setSelKpis(new Set()); setSelCharts(new Set()); setSelTables(new Set()); };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] flex items-center justify-center p-6"
      >
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="query-widget-title"
          tabIndex={-1}
          className="w-full max-w-[840px] h-[640px] max-h-[calc(100vh-48px)] bg-white border border-canvas-border rounded-xl shadow-xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-canvas-border">
            <div className="min-w-0">
              <h3 id="query-widget-title" className="text-[1rem] font-bold text-ink-800 tracking-tight">
                {heading}
              </h3>
              <p className="text-[0.75rem] text-ink-500 mt-1 truncate">
                <span className="font-bold text-brand-600 uppercase tracking-wider text-[0.6875rem]">{eyebrowLabel} · {queryId}</span>
                <span className="mx-1.5 text-ink-400">·</span>
                {queryTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {totalItems === 0 ? (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <EmptyState
                icon={BarChart3}
                title="Nothing to add yet"
                body="Attach a graph, KPI or table to start building insights."
                size="compact"
              />
            </div>
          ) : (
            <>
              {/* Tabs + one-click Select all / Clear */}
              <div className="flex items-center justify-between gap-2 px-6 pt-3 border-b border-canvas-border">
                <div className="flex items-center gap-1">
                  {tabs.map(t => {
                    const active = tab === t.id;
                    const allInTab = t.selected === t.count && t.count > 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`relative pb-3 pt-1 px-2 mr-2 text-[0.8125rem] font-semibold transition-colors cursor-pointer ${active ? 'text-brand-600' : 'text-ink-400 hover:text-ink-800'}`}
                      >
                        <span>{t.label}</span>
                        {/* Badge turns brand-filled when the whole tab is selected, so
                            the user sees what's already included without switching. */}
                        <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[0.625rem] font-semibold tabular-nums ${active ? 'bg-brand-600/10 text-brand-600' : allInTab ? 'bg-brand-600 text-white' : 'bg-paper-50 text-ink-400'}`}>
                          {t.count}
                        </span>
                        {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => (allSelected ? clearAll() : selectAll())}
                  className="mb-3 shrink-0 text-[0.75rem] font-semibold text-brand-600 hover:text-brand-700 px-2.5 py-1 rounded-md hover:bg-brand-50 transition-colors cursor-pointer"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>

              {/* Tab body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {tab === 'kpi' && (
                  <div className="grid grid-cols-2 gap-4">
                    {kpis.map((k, i) => {
                      const picked = selKpis.has(k.label);
                      return (
                        <div key={k.label} className="relative">
                          {/* The dashboard's own KpiTile — label + big bold value,
                              brand-outline when selected. */}
                          <KpiTile
                            label={k.label}
                            value={k.value}
                            index={i}
                            selected={picked}
                            onClick={() => toggleIn(selKpis, k.label, setSelKpis)}
                          />
                          {picked && (
                            <span className="absolute top-3 right-3">
                              <PickTick picked />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab === 'graph' && (
                  <div className="grid grid-cols-2 gap-4">
                    {charts.map(g => {
                      const picked = selCharts.has(g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => toggleIn(selCharts, g.id, setSelCharts)}
                          className={`glass-card p-4 text-left w-full cursor-pointer transition-[border-color,box-shadow] duration-300 ${picked ? SELECTED : 'hover:border-brand-200'}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="text-[0.9375rem] font-semibold text-ink-900 truncate">{g.title}</h3>
                            <PickTick picked={picked} />
                          </div>
                          {/* Same render as the dashboard widget: ConfigurableChart sits
                              directly in the card with dashboard height + legend/target. */}
                          <div className="h-[260px] pointer-events-none">
                            <ConfigurableChart
                              type={g.type}
                              xAxis={g.xAxis}
                              yAxis={g.yAxis}
                              color={g.color ?? '#6a12cd'}
                              showLegend
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {tab === 'table' && (
                  <div className="space-y-4">
                    {tables.map(t => {
                      const picked = selTables.has(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleIn(selTables, t.id, setSelTables)}
                          className={`glass-card p-4 text-left w-full block cursor-pointer transition-[border-color,box-shadow] duration-300 ${picked ? SELECTED : 'hover:border-brand-200'}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <h3 className="text-[0.9375rem] font-semibold text-ink-900">{t.title}</h3>
                              <p className="text-[0.6875rem] text-ink-500 mt-0.5">{t.columns.length} columns · {t.rows.length} rows</p>
                            </div>
                            <PickTick picked={picked} />
                          </div>
                          {/* The dashboard table styling — surface-2 uppercase headers,
                              brand-700 first column, severity pills via cellRender. */}
                          <div className="overflow-x-auto rounded-lg border border-canvas-border pointer-events-none">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-canvas-border bg-surface-2/50">
                                  {t.columns.map(c => (
                                    <th
                                      key={c}
                                      className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                                    >
                                      {c}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {t.rows.map((row, ri) => (
                                  <tr key={ri} className="border-b border-canvas-border/50 last:border-0 hover:bg-brand-50/30 transition-colors">
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="px-4 py-3 text-[0.75rem] whitespace-nowrap">
                                        {cellRender(cell, t.columns[ci] || '', ci === 0)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-canvas-border bg-paper-50/40">
            <span className="text-[0.75rem] text-ink-400" aria-live="polite">
              {totalSelected === 0 ? 'Nothing selected' : `${totalSelected} of ${totalItems} selected`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border rounded-md hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm({ kpis: selKpis, charts: selCharts, tables: selTables })}
                disabled={totalSelected === 0}
                className={`inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[0.8125rem] font-semibold rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${totalSelected === 0 ? 'bg-brand-600/40 text-white/85 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}
              >
                <FileText size={14} />
                {confirmLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
