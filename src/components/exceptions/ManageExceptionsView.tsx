import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  AlertTriangle,
  Tag,
  Clock,
  CheckCircle2,
  FlaskConical,
  FileBarChart,
  Layers,
  ChevronDown,
  FileText,
  History,
  UserPlus,
} from 'lucide-react';
import { GRC_EXCEPTIONS, GRC_CASE_DETAILS, ACTION_HUB_SUMMARY, type GrcException, type GrcExceptionSeverity, type GrcExceptionStatus, type GrcActivityEntry } from '../../data/mockData';
import { REPORT_QUERIES_ATR } from '../../data/reportQueries';
import { QUERY_TABLES } from '../../data/queryGraphs';
import type { ExceptionRole } from '../../hooks/useAppState';
import {
  ReviewClassificationDrawer,
  ReviewCaseDrawer,
  BulkActionGroupModal,
  ClassifyExceptionDrawer,
} from './ReviewDrawers';
import ActionHubView, { CircularProgress } from './ActionHubView';
import GenerateATRModal from './GenerateATRModal';
import ExceptionsTable from './ExceptionsTable';
import SampleDataModal, { type SampleDataPayload } from './SampleDataModal';
import BulkClassifyModal, { type BulkClassifyPayload } from './BulkClassifyModal';
import BulkAssignDrawer, { type BulkAssignPayload } from './BulkAssignDrawer';
import ExceptionDetailDrawer from './ExceptionDetailDrawer';
import ActivityTimelineDrawer from './ActivityTimelineDrawer';
import { useToast } from '../shared/Toast';

type DrawerState =
  | { type: 'classification'; exceptionId: string }
  | { type: 'action'; exceptionId: string }
  | { type: 'classify'; exceptionId: string }
  | null;

interface ManageExceptionsViewProps {
  role: ExceptionRole;
  setRole: (role: ExceptionRole) => void;
  onBack: () => void;
  embedded?: boolean;
  /** When provided, use this data instead of default GRC_EXCEPTIONS. */
  exceptions?: GrcException[];
  /** Called when exception state changes (classification, bulk actions, etc.). */
  onExceptionsChange?: (exceptions: GrcException[]) => void;
  /** Optional label shown in breadcrumb/header context. */
  contextLabel?: string;
  /** Callback for bulk assign action — when provided, shows "Mark as Case & Assign" button. */
  onBulkAssign?: (selectedExceptionIds: string[]) => void;
}

// ─── Editorial KPI bar ────────────────────────────────────────────────
// One unified surface holding all four KPI cells, separated by 1px
// vertical hairlines. No per-cell background tints — semantic tone is
// reserved for a single 4px leading dot in the label row, never the
// whole tile. Honors the No-RAG rule (no four-tone heatmap strip).

type KpiTone = 'default' | 'info' | 'warning' | 'alert';
type KpiCell = {
  key: string;
  label: string;
  value: number;
  icon: React.ElementType;
  tone: KpiTone;
  active?: boolean;
  onClick?: () => void;
};

const TONE_DOT: Record<KpiTone, string> = {
  default: 'bg-ink-300',
  info: 'bg-brand-500',
  warning: 'bg-mitigated',
  alert: 'bg-high',
};

function KpiBar({ cells, bare = false }: { cells: KpiCell[]; bare?: boolean }) {
  const chrome = bare ? '' : 'border border-canvas-border rounded-[12px] overflow-hidden';
  return (
    <div
      role="group"
      aria-label="Exception KPIs"
      className={`grid grid-cols-4 divide-x divide-canvas-border ${chrome}`}
    >
      {cells.map(cell => (
        <KpiCell key={cell.key} cell={cell} />
      ))}
    </div>
  );
}

function KpiCell({ cell }: { cell: KpiCell }) {
  const { label, value, icon: Icon, tone, active, onClick } = cell;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      // Suppress the global 4px focus-ring halo (would float the cell off the row);
      // the inline accent rule + number color shift carry the active state on their own.
      className={`relative text-left px-6 py-5 transition-colors cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:shadow-none ${
        active ? 'bg-brand-50/40' : 'hover:bg-paper-50/70'
      }`}
    >
      <div className="flex items-center gap-2 mb-3 text-ink-500">
        <Icon size={13} strokeWidth={1.75} className="shrink-0" aria-hidden />
        <span className="text-[11px] uppercase tracking-[0.12em] font-medium leading-none">{label}</span>
        {tone !== 'default' && (
          <span aria-hidden className={`w-1 h-1 rounded-full ${TONE_DOT[tone]} ml-0.5`} />
        )}
      </div>
      <div className={`font-display text-[30px] leading-none tabular-nums tracking-tight ${active ? 'text-brand-700' : 'text-ink-900'}`}>
        {value}
      </div>
      {active && (
        <motion.span
          layoutId="kpi-active-accent"
          className="absolute left-4 right-4 bottom-0 h-[2px] bg-brand-600 rounded-t"
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      )}
    </button>
  );
}

// Inline variant — used inside the sourceQuery context card. Same
// editorial logic, more compact for a horizontal embed.
function KpiBarInline({ cells }: { cells: KpiCell[] }) {
  return (
    <div
      role="group"
      aria-label="Exception KPIs"
      className="grid grid-cols-4 divide-x divide-canvas-border"
    >
      {cells.map(cell => {
        const { label, value, icon: Icon, tone, active, onClick } = cell;
        return (
          <button
            key={cell.key}
            type="button"
            onClick={onClick}
            aria-pressed={!!active}
            className={`relative text-left px-5 py-3 transition-colors cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:shadow-none ${
              active ? 'bg-brand-50/40' : 'hover:bg-paper-50/70'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5 text-ink-500">
              <Icon size={12} strokeWidth={1.75} className="shrink-0" aria-hidden />
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-medium leading-none">{label}</span>
              {tone !== 'default' && (
                <span aria-hidden className={`w-1 h-1 rounded-full ${TONE_DOT[tone]} ml-0.5`} />
              )}
            </div>
            <div className={`font-display text-[22px] leading-none tabular-nums tracking-tight ${active ? 'text-brand-700' : 'text-ink-900'}`}>
              {value}
            </div>
            {active && (
              <motion.span
                layoutId="kpi-inline-active-accent"
                className="absolute left-3 right-3 bottom-0 h-[2px] bg-brand-600 rounded-t"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Derive exceptions from a query's output table ───────────────────────
// When the user lands on Manage Exceptions via ?from=Q01 we don't want to
// show the generic GRC_EXCEPTIONS mock — we want the actual rows from
// QUERY_TABLES[Q01] so the data columns (Vendor, Invoice Date, Match %, …)
// align row-for-row with the cells the auditor saw in the query result.
function deriveExceptionsFromOutputTable(
  table: { columns: string[]; rows: string[][] },
  riskCategory = 'Financial Controls',
): GrcException[] {
  const idxOf = (re: RegExp) => table.columns.findIndex(c => re.test(c));
  const statusCol = idxOf(/^status$/i);
  const matchCol = idxOf(/match|score|similarity/i);
  const dateCol  = idxOf(/date/i);
  const labelCol = table.columns.findIndex((c, i) => i > 0 && !/^status$/i.test(c));

  return table.rows.map((row, i): GrcException => {
    let severity: GrcExceptionSeverity = 'Medium';
    if (matchCol >= 0) {
      const pct = parseFloat(String(row[matchCol]).replace('%', ''));
      if (!Number.isNaN(pct)) severity = pct >= 95 ? 'High' : pct >= 85 ? 'Medium' : 'Low';
    }
    let status: GrcExceptionStatus = 'Open';
    if (statusCol >= 0) {
      const raw = String(row[statusCol]).toLowerCase();
      if (raw.includes('review')) status = 'Under Review';
      else if (raw.includes('resolved') || raw.includes('closed')) status = 'Closed';
    }

    // Seed flags + dueDate on a few rows so the demo shows Overdue/Bulk chips
    // the same way the default GRC_EXCEPTIONS mock does.
    const flags: Array<'Overdue' | 'Bulk'> = [];
    let bulkId: string | undefined;
    let dueDate: string | undefined;
    if (i % 3 === 0) {
      flags.push('Bulk');
      bulkId = i % 6 === 0 ? 'ACT001' : 'ACT002';
    }
    if (i % 5 === 0) {
      // Past due date so the dynamic Overdue chip renders via the dueDate path.
      dueDate = '2026-04-15';
    } else if (i % 7 === 0) {
      // Future due date so the chip stays hidden (sanity check).
      dueDate = '2026-08-30';
    }

    return {
      id: `EXC${String(i + 1).padStart(3, '0')}`,
      riskCategory,
      severity,
      status,
      classification: 'Unclassified',
      classificationReview: 'Pending',
      actionReview: 'Pending',
      lastUpdated: dateCol >= 0 ? String(row[dateCol]) : '—',
      title: labelCol >= 0 ? `Case — ${row[labelCol]}` : `Case ${row[0]}`,
      flags: flags.length ? flags : undefined,
      bulkId,
      dueDate,
    };
  });
}

function RoleToggle({ role, setRole }: { role: ExceptionRole; setRole: (r: ExceptionRole) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-canvas-elevated border border-canvas-border rounded-full">
      <button
        onClick={() => setRole('risk-owner')}
        className={`flex items-center gap-1.5 px-3 h-7 text-[12px] font-medium rounded-full transition-colors cursor-pointer ${
          role === 'risk-owner' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${role === 'risk-owner' ? 'bg-brand-600' : 'bg-ink-300'}`} />
        Risk Owner
      </button>
      <button
        onClick={() => setRole('auditor')}
        className={`flex items-center gap-1.5 px-3 h-7 text-[12px] font-medium rounded-full transition-colors cursor-pointer ${
          role === 'auditor' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${role === 'auditor' ? 'bg-brand-600' : 'bg-ink-300'}`} />
        Auditor
      </button>
    </div>
  );
}

export default function ManageExceptionsView({ role, setRole, onBack, embedded = false, exceptions: propsExceptions, onExceptionsChange, contextLabel, onBulkAssign }: ManageExceptionsViewProps) {
  const [activeNav, setActiveNav] = useState<'exceptions' | 'action-hub'>('exceptions');
  const [atrModalOpen, setAtrModalOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [bulkModalId, setBulkModalId] = useState<string | null>(null);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleCountLeft, setSampleCountLeft] = useState(5);
  const [sampleSheets, setSampleSheets] = useState<{ id: string; name: string; payload: SampleDataPayload }[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('all');
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
  const { addToast } = useToast();
  const [bulkClassifyOpen, setBulkClassifyOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  /** When set, opens the BulkAssignDrawer scoped to just this one case
   *  (from a per-row "Assign" click). Mutually exclusive with bulkAssignOpen
   *  at the UI level — closing either clears both. */
  const [singleAssignCase, setSingleAssignCase] = useState<GrcException | null>(null);
  const [detailExceptionId, setDetailExceptionId] = useState<string | null>(null);
  const [nextActionableNum, setNextActionableNum] = useState(2);
  const [atrExpanded, setAtrExpanded] = useState(false);

  const sourceQuery = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const fromId = new URLSearchParams(window.location.search).get('from');
    if (!fromId) return null;
    return REPORT_QUERIES_ATR[fromId] ? { id: fromId, ...REPORT_QUERIES_ATR[fromId] } : null;
  }, []);

  // Local exception state — when the user landed via a source query we derive
  // exceptions from that query's output table so the IDs and data columns
  // match exactly. Props win when explicitly supplied by an embedded host.
  const [localExceptions, setLocalExceptions] = useState<GrcException[]>(() => {
    if (propsExceptions) return propsExceptions;
    if (sourceQuery) {
      const table = QUERY_TABLES[sourceQuery.id];
      if (table) return deriveExceptionsFromOutputTable(table);
    }
    return GRC_EXCEPTIONS;
  });
  // Sync if props change (e.g. new run generates more exceptions)
  const propsKey = propsExceptions?.map(e => e.id).join(',') || '';
  const [prevPropsKey, setPrevPropsKey] = useState(propsKey);
  if (propsKey !== prevPropsKey) {
    setPrevPropsKey(propsKey);
    if (propsExceptions) setLocalExceptions(propsExceptions);
  }
  const exceptions = localExceptions;

  const updateExceptions = (updater: (prev: GrcException[]) => GrcException[]) => {
    setLocalExceptions(prev => {
      const next = updater(prev);
      onExceptionsChange?.(next);
      return next;
    });
  };

  const drawerException = useMemo(
    () => (drawer ? exceptions.find(e => e.id === drawer.exceptionId) ?? null : null),
    [drawer, exceptions],
  );

  const stats = useMemo(() => {
    const total = exceptions.length;
    const classified = exceptions.filter(e => e.classification !== 'Unclassified').length;
    const unclassified = exceptions.filter(e => e.classification === 'Unclassified').length;
    const actionReviewPending = exceptions.filter(e => e.actionReview === 'Pending' && e.classification !== 'Unclassified').length;
    return { total, classified, unclassified, actionReviewPending };
  }, [exceptions]);

  // KPI-driven filter — clicking a tile narrows the table; clicking the active tile clears.
  type KpiFilter = 'total' | 'classified' | 'unclassified' | 'actionReviewPending' | null;
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);

  // Sample-sheet view — narrows rows to the configured sample/filter rules.
  const sheetExceptions = useMemo(() => {
    if (activeSheetId === 'all') return exceptions;
    const sheet = sampleSheets.find(s => s.id === activeSheetId);
    if (!sheet) return exceptions;
    const { mode, filterRows, samplePct } = sheet.payload;
    if (mode === 'sample' && typeof samplePct === 'number') {
      const n = Math.max(1, Math.ceil((exceptions.length * samplePct) / 100));
      const seed = sheet.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const start = seed % Math.max(1, exceptions.length);
      return Array.from({ length: n }, (_, i) => exceptions[(start + i) % exceptions.length]);
    }
    if (mode === 'filter' && filterRows) {
      const valid = filterRows.filter(r => r.columnKey && r.condition);
      if (valid.length === 0) return exceptions;
      const ratio = Math.max(0.25, 1 - valid.length * 0.25);
      const n = Math.max(1, Math.ceil(exceptions.length * ratio));
      const seed = sheet.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      return [...exceptions]
        .sort((a, b) => ((a.id.charCodeAt((seed) % a.id.length) || 0) - (b.id.charCodeAt((seed) % b.id.length) || 0)))
        .slice(0, n);
    }
    return exceptions;
  }, [exceptions, activeSheetId, sampleSheets]);

  const visibleExceptions = useMemo(() => {
    switch (kpiFilter) {
      case 'classified':           return sheetExceptions.filter(e => e.classification !== 'Unclassified');
      case 'unclassified':         return sheetExceptions.filter(e => e.classification === 'Unclassified');
      case 'actionReviewPending':  return sheetExceptions.filter(e => e.actionReview === 'Pending' && e.classification !== 'Unclassified');
      default:                     return sheetExceptions;
    }
  }, [sheetExceptions, kpiFilter]);
  const toggleKpiFilter = (k: Exclude<KpiFilter, null>) => setKpiFilter(prev => (prev === k ? null : k));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };


  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-canvas">
      {/* Top chrome — only shown when standalone (Back button); hidden when embedded */}
      {!embedded && (
        <header className="shrink-0 h-[60px] px-6 flex items-center gap-4 bg-canvas-elevated border-b border-canvas-border">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-700 transition-colors cursor-pointer pr-2 border-r border-canvas-border mr-1"
            aria-label="Back to reports"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex-1" />
        </header>
      )}

      {/* Page header — title + subtitle + tabs (Knowledge Hub pattern) */}
      <div className="border-b border-canvas-border bg-canvas-elevated">
        <div className={`max-w-[1600px] mx-auto px-8 ${embedded ? 'pt-4 pb-0' : 'pt-8 pb-0'}`}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              {!embedded && <h1 className="font-display text-[34px] font-[420] tracking-tight text-ink-900 leading-[1.15]">Manage Exceptions</h1>}
              {embedded ? (
                <h2 className="text-[16px] font-semibold text-ink-900 mb-3">Exceptions & Cases</h2>
              ) : (
                <p className="text-[14px] text-ink-500 mt-1 mb-6">
                  {contextLabel
                    ? `Triage and resolve exceptions for ${contextLabel}.`
                    : 'Triage and resolve exceptions surfaced from audit queries.'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActivityDrawerOpen(true)}
                title="View activity timeline"
                aria-label="View activity timeline"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-500 bg-canvas-elevated border border-canvas-border hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer"
              >
                <History size={15} />
              </button>
              <RoleToggle role={role} setRole={setRole} />
            </div>
          </div>

          {/* Tabs row — left: tab buttons; right (Action Hub only): Report Health + Generate ATR */}
          <div className="flex items-center justify-between gap-6 -mb-px">
            <div className="flex items-center gap-0 border-b border-transparent">
              {([
                { id: 'exceptions' as const, label: 'Exceptions', icon: Layers },
                { id: 'action-hub' as const, label: 'Action Hub', icon: FileBarChart },
              ] as const).map(t => {
                const Icon = t.icon;
                const isActive = activeNav === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveNav(t.id)}
                    className={`relative flex items-center gap-2 px-4 h-11 text-[13px] font-medium transition-colors cursor-pointer ${
                      isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                    {isActive && (
                      <motion.div
                        layoutId="exceptions-tab-bar"
                        className="absolute left-0 right-0 -bottom-px h-[2px] bg-brand-600"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {activeNav === 'action-hub' && (
              <div className="flex items-center gap-4 shrink-0 pb-2">
                <div className="flex items-baseline gap-1.5 leading-none">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-ink-500 font-medium">Report health</span>
                  <span className="text-[13px] text-ink-900 font-medium">{ACTION_HUB_SUMMARY.reportHealthLabel}</span>
                  <span className="text-[12px] text-ink-500 tabular-nums">· {ACTION_HUB_SUMMARY.reportHealthPct}%</span>
                </div>
                <div className="h-5 w-px bg-canvas-border" aria-hidden="true" />
                <button
                  onClick={() => setAtrModalOpen(true)}
                  className="h-9 px-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer transition-colors"
                >
                  <FileText size={14} />
                  Generate ATR
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeNav === 'action-hub' ? (
        <ActionHubView />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-auto"
        >
          <div className="px-8 pt-4 pb-8 max-w-[1600px] mx-auto min-h-full flex flex-col">

            {/* Single outer card holds KPI bar, optional sourceQuery summary, and the table — one continuous editorial surface, no center divisions. */}
            <div className="bg-canvas-elevated border border-canvas-border rounded-[12px] overflow-hidden flex-1 flex flex-col min-h-0">
              {/* KPI bar — neutral surface, hairline-separated cells, tone-as-dot. Wrapped with pt so it doesn't sit flush against the card's top border. */}
              <div className="pt-4">
              {sourceQuery ? (
                <KpiBarInline
                  cells={[
                    { key: 'total',          label: 'Total Exceptions',        value: stats.total,                icon: AlertTriangle, tone: 'default', active: kpiFilter === null,                  onClick: () => setKpiFilter(null) },
                    { key: 'classified',     label: 'Exceptions Classified',   value: stats.classified,           icon: Tag,            tone: 'info',    active: kpiFilter === 'classified',          onClick: () => toggleKpiFilter('classified') },
                    { key: 'unclassified',   label: 'Unclassified Exceptions', value: stats.unclassified,         icon: Clock,          tone: 'warning', active: kpiFilter === 'unclassified',        onClick: () => toggleKpiFilter('unclassified') },
                    { key: 'actionPending',  label: 'Action Review Pending',   value: stats.actionReviewPending,  icon: CheckCircle2,   tone: 'alert',   active: kpiFilter === 'actionReviewPending', onClick: () => toggleKpiFilter('actionReviewPending') },
                  ]}
                />
              ) : (
                <KpiBar
                  bare
                  cells={[
                    { key: 'total',          label: 'Total Exceptions',        value: stats.total,                icon: AlertTriangle, tone: 'default', active: kpiFilter === null,                  onClick: () => setKpiFilter(null) },
                    { key: 'classified',     label: 'Exceptions Classified',   value: stats.classified,           icon: Tag,            tone: 'info',    active: kpiFilter === 'classified',          onClick: () => toggleKpiFilter('classified') },
                    { key: 'unclassified',   label: 'Unclassified Exceptions', value: stats.unclassified,         icon: Clock,          tone: 'warning', active: kpiFilter === 'unclassified',        onClick: () => toggleKpiFilter('unclassified') },
                    { key: 'actionPending',  label: 'Action Review Pending',   value: stats.actionReviewPending,  icon: CheckCircle2,   tone: 'alert',   active: kpiFilter === 'actionReviewPending', onClick: () => toggleKpiFilter('actionReviewPending') },
                  ]}
                />
              )}
              </div>

              {sourceQuery && (
                <>
                  {/* Source query ATR — flows directly under the KPI bar */}
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-2 mb-3 text-[11px]">
                      <span className="font-bold text-brand-700 uppercase tracking-wider">Query · {sourceQuery.id}</span>
                    </div>
                    <button
                      onClick={() => setAtrExpanded(p => !p)}
                      className="flex items-start gap-2 text-left w-full mb-4 cursor-pointer focus:outline-none focus-visible:outline-none focus:ring-0 group"
                    >
                      <motion.span
                        animate={{ rotate: atrExpanded ? 0 : -90 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="inline-flex mt-1 text-brand-700"
                      >
                        <ChevronDown size={14} />
                      </motion.span>
                      <p className="text-[14px] text-ink-700 leading-relaxed transition-colors group-hover:text-ink-900">
                        {sourceQuery.title}
                      </p>
                    </button>
                    <p className="text-[13px] text-ink-500 leading-relaxed">{sourceQuery.summary}</p>
                  </div>
                  <AnimatePresence initial={false}>
                    {atrExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-1">
                          <div className="space-y-6">
                            {[
                              { title: 'Findings', items: sourceQuery.findings },
                              { title: 'Observations', items: sourceQuery.observations },
                            ].map(section => (
                              <div key={section.title}>
                                <h4 className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-3">{section.title}</h4>
                                <ul className="space-y-2.5">
                                  {section.items.map((item, i) => (
                                    <motion.li
                                      key={i}
                                      initial={{ opacity: 0, x: -4 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
                                      className="flex gap-2.5 text-[13px] text-ink-700 leading-relaxed"
                                    >
                                      <div className="w-1 h-1 rounded-full mt-2 shrink-0 bg-brand-600/60" />
                                      {item}
                                    </motion.li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* Table — nested inside the same card, bare (no own border) */}
              <ExceptionsTable
                bare
              exceptions={visibleExceptions}
              role={role}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={(ids) => {
                const allSelected = ids.every(id => selected.has(id));
                if (allSelected) {
                  setSelected(prev => {
                    const next = new Set(prev);
                    ids.forEach(id => next.delete(id));
                    return next;
                  });
                } else {
                  setSelected(prev => {
                    const next = new Set(prev);
                    ids.forEach(id => next.add(id));
                    return next;
                  });
                }
              }}
              onOpenClassification={(ex) => {
                if (role === 'risk-owner' && ex.classification === 'Unclassified') {
                  setDrawer({ type: 'classify', exceptionId: ex.id });
                } else {
                  setDrawer({ type: 'classification', exceptionId: ex.id });
                }
              }}
              onOpenAction={(ex) => setDrawer({ type: 'action', exceptionId: ex.id })}
              onOpenActionable={(bulkId) => setBulkModalId(bulkId)}
              onAssign={(ex) => {
                setSingleAssignCase(ex);
              }}
              extraColumns={sourceQuery ? QUERY_TABLES[sourceQuery.id] : undefined}
              onOpenDetail={(ex) => setDetailExceptionId(ex.id)}
              headerLeading={
                <div className="flex items-center gap-1.5">
                  {/* Risk owner role: Bulk Classify only. */}
                  {role === 'risk-owner' && selected.size > 0 && (
                    <button
                      onClick={() => setBulkClassifyOpen(true)}
                      title={`Bulk classify ${selected.size} selected case${selected.size === 1 ? '' : 's'}`}
                      className="flex items-center gap-1.5 h-8 px-2.5 text-[12px] font-medium rounded-[8px] border text-white bg-brand-600 border-brand-600 hover:bg-brand-500 cursor-pointer transition-colors"
                    >
                      <Tag size={13} />
                      Bulk Classify
                      <span className="inline-flex items-center h-5 min-w-5 px-1 text-[10.5px] font-semibold bg-white/20 rounded-full tabular-nums">
                        {selected.size}
                      </span>
                    </button>
                  )}
                  {/* Auditor role: Bulk Assign only. */}
                  {role !== 'risk-owner' && selected.size > 0 && (
                    <button
                      onClick={() => setBulkAssignOpen(true)}
                      title={`Bulk assign ${selected.size} selected case${selected.size === 1 ? '' : 's'}`}
                      className="flex items-center gap-1.5 h-8 px-2.5 text-[12px] font-medium rounded-[8px] border text-white bg-brand-600 border-brand-600 hover:bg-brand-500 cursor-pointer transition-colors"
                    >
                      <UserPlus size={13} />
                      Bulk Assign
                      <span className="inline-flex items-center h-5 min-w-5 px-1 text-[10.5px] font-semibold bg-white/20 rounded-full tabular-nums">
                        {selected.size}
                      </span>
                    </button>
                  )}
                </div>
              }
              headerExtras={
                <button
                  onClick={() => setSampleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer"
                >
                  <FlaskConical size={13} />
                  Sample Data
                </button>
              }
              sampleSheets={sampleSheets}
              activeSheetId={activeSheetId}
              onChangeSheet={setActiveSheetId}
            />
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {drawer?.type === 'classify' && drawerException && (
          <ClassifyExceptionDrawer
            key="classify-drawer"
            exception={drawerException}
            onClose={() => setDrawer(null)}
            onSave={(payload) => {
              updateExceptions(prev => prev.map(e =>
                e.id === drawerException.id
                  ? {
                      ...e,
                      severity: payload.severity,
                      classification: payload.classification as GrcException['classification'],
                      classificationReview: 'Approved' as const,
                      dueDate: payload.dueDate ?? e.dueDate,
                      lastUpdated: new Date().toISOString().slice(0, 10),
                    }
                  : e
              ));
              setDrawer(null);
            }}
          />
        )}
        {drawer?.type === 'classification' && drawerException && (
          <ReviewClassificationDrawer
            key="classification-drawer"
            exception={drawerException}
            role={role}
            onClose={() => setDrawer(null)}
            onDecision={() => setDrawer(null)}
          />
        )}
        {drawer?.type === 'action' && drawerException && (
          <ReviewCaseDrawer
            key="action-drawer"
            exception={drawerException}
            role={role}
            onClose={() => setDrawer(null)}
            onDecision={() => setDrawer(null)}
            onViewBulk={(bulkId) => setBulkModalId(bulkId)}
          />
        )}
        {bulkModalId && (
          <BulkActionGroupModal
            key="bulk-modal"
            bulkId={bulkModalId}
            onClose={() => setBulkModalId(null)}
          />
        )}
        {sampleModalOpen && (
          <SampleDataModal
            key="sample-modal"
            defaultName={`Sample Data ${6 - sampleCountLeft}`}
            availableCount={sampleCountLeft}
            totalCount={5}
            onClose={() => setSampleModalOpen(false)}
            onCreate={(payload) => {
              const id = `sheet-${Date.now()}`;
              setSampleSheets(prev => [...prev, { id, name: payload.name, payload }]);
              setActiveSheetId(id);
              setSampleCountLeft(c => Math.max(0, c - 1));
              setSampleModalOpen(false);
              addToast({ type: 'success', message: `Sample sheet "${payload.name}" has been created` });
            }}
          />
        )}
        {bulkClassifyOpen && (
          <BulkClassifyModal
            key="bulk-classify-modal"
            selectedCases={exceptions.filter(e => selected.has(e.id))}
            actionableId={`ACT${String(nextActionableNum).padStart(3, '0')}`}
            onClose={() => setBulkClassifyOpen(false)}
            onApply={(payload: BulkClassifyPayload) => {
              updateExceptions(prev => prev.map(e =>
                payload.caseIds.includes(e.id)
                  ? {
                      ...e,
                      severity: payload.severity,
                      classification: payload.classification,
                      classificationReview: 'Approved' as const,
                      status: 'Under Review' as const,
                      dueDate: payload.dueDate ?? e.dueDate,
                      lastUpdated: new Date().toISOString().slice(0, 10),
                    }
                  : e
              ));
              setNextActionableNum(n => n + 1);
              setSelected(new Set());
              setBulkClassifyOpen(false);
            }}
          />
        )}
        {(bulkAssignOpen || singleAssignCase) && (
          <BulkAssignDrawer
            key={singleAssignCase ? `single-assign-${singleAssignCase.id}` : 'bulk-assign-drawer'}
            cases={singleAssignCase ? [singleAssignCase] : exceptions.filter(e => selected.has(e.id))}
            onClose={() => { setBulkAssignOpen(false); setSingleAssignCase(null); }}
            onApply={(payload: BulkAssignPayload) => {
              if (payload.assignees.length === 0) return;
              const today = new Date().toISOString().slice(0, 10);
              // Update the exceptions — assignees only; assignedTo is no longer
              // written by new flows (kept on the type for back-compat reads).
              updateExceptions(prev => prev.map(e =>
                payload.caseIds.includes(e.id)
                  ? {
                      ...e,
                      assignees: payload.assignees,
                      lastUpdated: today,
                    }
                  : e
              ));
              // Append an activity-log entry per assigned case so the
              // assignment + note are auditable in the Review drawer's
              // Activity Log.
              const assigneeNames = payload.assignees.map(a => a.name).join(', ');
              const nowIso = new Date().toISOString();
              payload.caseIds.forEach(caseId => {
                const detail = GRC_CASE_DETAILS[caseId];
                if (!detail) return;
                const entry: GrcActivityEntry = {
                  id: `act-assign-${caseId}-${Date.now()}`,
                  author: 'You',
                  role: 'Auditor',
                  timestamp: nowIso,
                  message: `Assigned to ${assigneeNames}`,
                  comment: payload.note,
                };
                detail.activityLog = [entry, ...detail.activityLog];
              });
              const firstName = payload.assignees[0].name;
              const assigneeLabel =
                payload.assignees.length === 1
                  ? firstName
                  : `${firstName} and ${payload.assignees.length - 1} other${payload.assignees.length - 1 === 1 ? '' : 's'}`;
              addToast({
                type: 'success',
                message: `${payload.caseIds.length} case${payload.caseIds.length === 1 ? '' : 's'} assigned to ${assigneeLabel}`,
              });
              // Only clear the selection set when the bulk drawer was the one
              // that opened — single-row assigns don't touch the selection.
              if (!singleAssignCase) setSelected(new Set());
              setBulkAssignOpen(false);
              setSingleAssignCase(null);
            }}
          />
        )}
        {detailExceptionId && (() => {
          const ex = exceptions.find(e => e.id === detailExceptionId);
          if (!ex) return null;
          return (
            <ExceptionDetailDrawer
              key="exception-detail-drawer"
              exception={ex}
              extraColumns={sourceQuery ? QUERY_TABLES[sourceQuery.id] : undefined}
              onClose={() => setDetailExceptionId(null)}
            />
          );
        })()}
        {activityDrawerOpen && (
          <ActivityTimelineDrawer
            key="activity-timeline-drawer"
            onClose={() => setActivityDrawerOpen(false)}
          />
        )}
        {atrModalOpen && (
          <GenerateATRModal
            key="atr-modal"
            onClose={() => setAtrModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

