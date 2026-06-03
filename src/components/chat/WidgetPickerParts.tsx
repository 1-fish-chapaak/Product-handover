/**
 * Shared sub-components for AddToDashboardModal & AddToReportModal.
 * Accept an `accent` prop ('brand' | 'violet') to theme consistently.
 */
import { Check, ChevronDown } from 'lucide-react';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import type { AuditResultData } from './AddToDashboardModal';

// ─── Accent helpers ───────────────────────────────────────────────────────────

type Accent = 'brand' | 'violet';

const ACCENT = {
  brand: {
    toggle: 'text-brand-600 hover:text-brand-700',
    checkbox: 'bg-brand-600 border-brand-600',
    rowOn: 'border-brand-200 bg-brand-50/40',
    rowHover: 'hover:border-brand-200',
    ring: 'ring-2 ring-brand-400/40 border-brand-200',
  },
  violet: {
    toggle: 'text-violet-600 hover:text-violet-700',
    checkbox: 'bg-violet-600 border-violet-600',
    rowOn: 'border-violet-200 bg-violet-50/40',
    rowHover: 'hover:border-violet-200',
    ring: 'ring-2 ring-violet-400/40 border-violet-200',
  },
};

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ title, count, total, collapsed, onToggle, onToggleAll, accent = 'brand' }: {
  title: string; count: number; total: number; collapsed: boolean;
  onToggle: () => void; onToggleAll: (all: boolean) => void; accent?: Accent;
}) {
  const allSelected = count === total;
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-700 cursor-pointer min-h-[32px] px-1 -mx-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <ChevronDown size={14} className={`transition-transform motion-reduce:transition-none ${collapsed ? '-rotate-90' : ''}`} />
        {title}
        <span className="text-ink-400 font-normal">({count}/{total})</span>
      </button>
      <button
        type="button"
        onClick={() => onToggleAll(!allSelected)}
        title={allSelected ? `Deselect all ${title.toLowerCase()}` : `Select all ${title.toLowerCase()}`}
        className={`text-[0.6875rem] font-medium cursor-pointer min-h-[32px] px-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${ACCENT[accent].toggle}`}
      >
        {allSelected ? 'None' : 'All'}
      </button>
    </div>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export function Checkbox({ checked, accent = 'brand' }: { checked: boolean; accent?: Accent }) {
  return (
    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
      checked ? ACCENT[accent].checkbox : 'border-ink-300'
    }`}>
      {checked && <Check size={10} className="text-white" />}
    </div>
  );
}

// ─── KPI preview row ──────────────────────────────────────────────────────────

export function KpiPreviewRow({ kpi, checked, onChange, accent = 'brand' }: {
  kpi: AuditResultData['kpis'][number]; checked: boolean; onChange: () => void; accent?: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${kpi.label}: ${kpi.value}`}
      onClick={onChange}
      className={`w-full flex items-center gap-2 min-h-[40px] px-2.5 py-2 rounded-lg border transition-all cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        checked ? a.rowOn : `border-canvas-border ${a.rowHover}`
      }`}
    >
      <Checkbox checked={checked} accent={accent} />
      <span className="text-[0.6875rem] text-ink-500 flex-1 truncate">{kpi.label}</span>
      <span className={`text-[0.8125rem] font-bold tabular-nums shrink-0 ${kpi.color}`}>{kpi.value}</span>
    </button>
  );
}

// ─── Chart preview row ────────────────────────────────────────────────────────

const CHART_PREVIEW_CONFIG: Record<string, { type: 'bar' | 'pie' | 'area' | 'line'; xAxis?: string; color?: string; description: string }> = {
  confidence: { type: 'bar', xAxis: 'Quarter', color: '#7C3AED', description: 'Match-score distribution across confidence bands' },
  vendor: { type: 'pie', xAxis: 'Department', color: '#3d68ee', description: 'Flagged duplicates breakdown by vendor' },
};

export function ChartPreviewRow({ chart, checked, onChange, accent = 'brand' }: {
  chart: AuditResultData['charts'][number]; checked: boolean; onChange: () => void; accent?: Accent;
}) {
  const cfg = CHART_PREVIEW_CONFIG[chart.id] || { type: 'bar' as const, description: '' };
  const a = ACCENT[accent];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={chart.label}
      onClick={onChange}
      className={`w-full glass-card rounded-xl overflow-hidden transition-all cursor-pointer text-left flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        checked ? a.ring : ''
      }`}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 shrink-0">
        <Checkbox checked={checked} accent={accent} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.8125rem] font-semibold text-ink-900 truncate">{chart.label}</h3>
          <p className="text-[0.625rem] text-ink-500 truncate mt-0.5">{cfg.description}</p>
        </div>
      </div>
      <div className="pointer-events-none relative flex-1 overflow-hidden" style={{ minHeight: 180 }}>
        <ConfigurableChart
          type={cfg.type}
          xAxis={cfg.xAxis}
          color={cfg.color}
          showTarget={false}
          showLegend={false}
        />
      </div>
    </button>
  );
}

// ─── Table preview row ────────────────────────────────────────────────────────

export function TablePreviewRow({ columns, sampleRows, checked, onChange, accent = 'brand' }: {
  columns: string[]; sampleRows: string[][]; checked: boolean; onChange: () => void; accent?: Accent;
}) {
  const a = ACCENT[accent];
  const cols = columns.slice(0, 4);
  const rows = sampleRows.slice(0, 2);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Results table: ${columns.length} columns, ${sampleRows.length} rows`}
      onClick={onChange}
      className={`w-full rounded-lg border transition-all cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        checked ? a.rowOn : `border-canvas-border ${a.rowHover}`
      }`}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <Checkbox checked={checked} accent={accent} />
        <span className="text-[0.6875rem] font-medium text-ink-700">Results Table</span>
        <span className="text-[0.625rem] text-ink-400">{columns.length} columns &middot; {sampleRows.length} rows</span>
      </div>
      <div className="px-3 pb-3">
        <div className="rounded-md border border-canvas-border overflow-hidden">
          <div className="flex bg-paper-50">
            {cols.map(c => (
              <div key={c} className="flex-1 px-2 py-1 text-[0.5625rem] font-semibold text-ink-500 truncate border-r border-canvas-border last:border-r-0">{c}</div>
            ))}
            {columns.length > 4 && <div className="w-8 px-1 py-1 text-[0.5625rem] text-ink-400 text-center shrink-0">+{columns.length - 4}</div>}
          </div>
          {rows.map((row, ri) => (
            <div key={ri} className="flex border-t border-canvas-border">
              {cols.map((c, ci) => (
                <div key={c} className="flex-1 px-2 py-1 text-[0.5625rem] text-ink-600 truncate border-r border-canvas-border last:border-r-0">{row[ci] || ''}</div>
              ))}
              {columns.length > 4 && <div className="w-8 px-1 py-1 text-[0.5625rem] text-ink-400 text-center shrink-0">…</div>}
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

// Helpers moved to ./widgetPickerHelpers (kept this file component-only for Fast Refresh).
