// Query widget picker modal — choose which KPIs / charts / table from a query
// to surface as a widget. Extracted from the report reader.

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, FileText, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import EmptyState from '../shared/EmptyState';
import { SectionHeader, Checkbox, KpiPreviewRow, TablePreviewRow } from '../chat/WidgetPickerParts';
import { setAll, toggleIn } from '../chat/widgetPickerHelpers';
import type { QueryGraph, QueryTable } from '../../data/queryGraphs';

export default function QueryWidgetModal({
  queryId,
  queryTitle,
  kpis,
  charts,
  table,
  initialKpis,
  initialCharts,
  initialTable,
  onConfirm,
  onClose,
}: {
  queryId: string;
  queryTitle: string;
  kpis: { label: string; value: string }[];
  charts: QueryGraph[];
  table?: QueryTable;
  initialKpis: Set<string>;
  initialCharts: Set<string>;
  initialTable: boolean;
  onConfirm: (sel: { kpis: Set<string>; charts: Set<string>; table: boolean }) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onClose);

  const [selKpis, setSelKpis] = useState<Set<string>>(() => new Set(initialKpis));
  const [selCharts, setSelCharts] = useState<Set<string>>(() => new Set(initialCharts));
  const [selTable, setSelTable] = useState(initialTable);
  const [collapsed, setCollapsed] = useState({ kpis: false, charts: false, table: false });

  const hasTable = !!table && table.columns.length > 0;
  const totalSelected = selKpis.size + selCharts.size + (selTable ? 1 : 0);
  const totalItems = kpis.length + charts.length + (hasTable ? 1 : 0);

  const selectAll = () => {
    setAll(kpis.map(k => k.label), true, setSelKpis);
    setAll(charts.map(c => c.id), true, setSelCharts);
    if (hasTable) setSelTable(true);
  };
  const clearAll = () => {
    setSelKpis(new Set());
    setSelCharts(new Set());
    setSelTable(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-6"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="query-widget-title"
          className="relative bg-white rounded-[16px] border border-canvas-border shadow-xl w-[1040px] max-w-[95vw] h-[662px] max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-canvas-border">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-[8px] bg-brand-50 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-brand-600" />
              </div>
              <div className="min-w-0">
                <h3 id="query-widget-title" className="text-[1rem] font-bold text-ink-800 tracking-tight">
                  Choose What to Include
                </h3>
                <p className="text-[0.75rem] text-ink-500 mt-0.5 truncate">
                  <span className="font-mono text-[0.6875rem] text-brand-600">{queryId}</span>
                  <span className="mx-1.5 text-ink-400">·</span>
                  {queryTitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 inline-flex items-center justify-center rounded-[8px] text-ink-400 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {totalItems === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Nothing to add yet"
                body="Attach a graph, KPI or table to start building insights."
                size="compact"
              />
            ) : (
              <div className="space-y-5">
                {/* Selection summary + all/none */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[0.75rem] text-ink-400" aria-live="polite">
                    {totalSelected === 0
                      ? 'Select what to show on the card.'
                      : `${totalSelected} item${totalSelected === 1 ? '' : 's'} selected`}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-[0.6875rem] font-semibold text-brand-600 hover:text-brand-500 cursor-pointer"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-[0.6875rem] font-semibold text-ink-400 hover:text-ink-800 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* KPI Cards */}
                {kpis.length > 0 && (
                  <div className="space-y-1.5" role="group" aria-label="KPI Cards">
                    <SectionHeader
                      title="KPI Cards"
                      count={selKpis.size}
                      total={kpis.length}
                      collapsed={collapsed.kpis}
                      onToggle={() => setCollapsed(c => ({ ...c, kpis: !c.kpis }))}
                      onToggleAll={(all) => setAll(kpis.map(k => k.label), all, setSelKpis)}
                      accent="brand"
                    />
                    {!collapsed.kpis && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
                        {kpis.map(k => (
                          <KpiPreviewRow
                            key={k.label}
                            kpi={{ label: k.label, value: k.value, color: 'text-ink-900' }}
                            checked={selKpis.has(k.label)}
                            onChange={() => toggleIn(selKpis, k.label, setSelKpis)}
                            accent="brand"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Charts */}
                {charts.length > 0 && (
                  <div className="space-y-1.5" role="group" aria-label="Charts">
                    <SectionHeader
                      title="Charts"
                      count={selCharts.size}
                      total={charts.length}
                      collapsed={collapsed.charts}
                      onToggle={() => setCollapsed(c => ({ ...c, charts: !c.charts }))}
                      onToggleAll={(all) => setAll(charts.map(c => c.id), all, setSelCharts)}
                      accent="brand"
                    />
                    {!collapsed.charts && (
                      <div className="grid grid-cols-2 gap-3 pl-1">
                        {charts.map(g => {
                          const on = selCharts.has(g.id);
                          return (
                            <button
                              key={g.id}
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              aria-label={g.title}
                              onClick={() => toggleIn(selCharts, g.id, setSelCharts)}
                              className={`text-left bg-white border-2 rounded-[12px] p-3 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                                on
                                  ? 'border-brand-600 shadow-[0_0_0_3px_rgba(106,18,205,0.12)]'
                                  : 'border-canvas-border hover:border-brand-600/40'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Checkbox checked={on} accent="brand" />
                                <span className="text-[0.75rem] font-semibold text-ink-800 truncate">{g.title}</span>
                              </div>
                              <div className="h-[150px] bg-canvas-elevated rounded-[12px] p-1.5 pointer-events-none">
                                <ConfigurableChart
                                  type={g.type}
                                  xAxis={g.xAxis}
                                  yAxis={g.yAxis}
                                  color={g.color ?? '#6a12cd'}
                                  showTarget={false}
                                  showLegend={false}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Results Table */}
                {hasTable && (
                  <div className="space-y-1.5" role="group" aria-label="Results Table">
                    <SectionHeader
                      title="Results Table"
                      count={selTable ? 1 : 0}
                      total={1}
                      collapsed={collapsed.table}
                      onToggle={() => setCollapsed(c => ({ ...c, table: !c.table }))}
                      onToggleAll={(all) => setSelTable(all)}
                      accent="brand"
                    />
                    {!collapsed.table && (
                      <div className="pl-1">
                        <TablePreviewRow
                          columns={table!.columns}
                          sampleRows={table!.rows}
                          checked={selTable}
                          onChange={() => setSelTable(v => !v)}
                          accent="brand"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-canvas-border bg-paper-50/40">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm({ kpis: selKpis, charts: selCharts, table: selTable })}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] transition-colors cursor-pointer"
            >
              <FileText size={14} />
              Add to Card
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
