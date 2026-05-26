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
import { GRC_EXCEPTIONS, ACTION_HUB_SUMMARY, type GrcException } from '../../data/mockData';
import { REPORT_QUERIES_ATR } from '../../data/reportQueries';
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

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: 'default' | 'info' | 'warning' | 'alert';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneStyles = {
    default: { bg: 'bg-canvas-elevated', border: 'border-canvas-border', iconBg: 'bg-[#F4F2F7]', iconColor: 'text-ink-500', valueColor: 'text-ink-900' },
    info:    { bg: 'bg-brand-50/70',     border: 'border-brand-100',    iconBg: 'bg-brand-100',  iconColor: 'text-brand-700', valueColor: 'text-brand-700' },
    warning: { bg: 'bg-mitigated-50/60', border: 'border-mitigated-50', iconBg: 'bg-mitigated-50',iconColor: 'text-mitigated-700', valueColor: 'text-mitigated-700' },
    alert:   { bg: 'bg-high-50/60',      border: 'border-high-50',      iconBg: 'bg-high-50',    iconColor: 'text-high-700', valueColor: 'text-high-700' },
  }[tone];

  const interactive = Boolean(onClick);
  const activeRing = active ? 'ring-2 ring-brand-600 ring-offset-1' : '';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`${toneStyles.bg} border ${toneStyles.border} rounded-[12px] p-4 flex items-start justify-between text-left ${activeRing} ${
        interactive ? 'cursor-pointer hover:border-brand-300 transition-colors' : 'cursor-default'
      }`}
      aria-pressed={interactive ? !!active : undefined}
    >
      <div>
        <div className="text-[0.75rem] text-ink-500 mb-2">{label}</div>
        <div className={`text-[1.75rem] leading-none font-semibold tabular-nums ${toneStyles.valueColor}`}>{value}</div>
      </div>
      <div className={`w-8 h-8 ${toneStyles.iconBg} ${toneStyles.iconColor} rounded-full flex items-center justify-center shrink-0`}>
        <Icon size={16} strokeWidth={1.75} />
      </div>
    </button>
  );
}

function InlineStatTile({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: 'default' | 'info' | 'warning' | 'alert';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneStyles = {
    default: { iconBg: 'bg-[#F4F2F7]',     iconColor: 'text-ink-500',       valueColor: 'text-ink-900' },
    info:    { iconBg: 'bg-brand-100',     iconColor: 'text-brand-700',     valueColor: 'text-brand-700' },
    warning: { iconBg: 'bg-mitigated-50',  iconColor: 'text-mitigated-700', valueColor: 'text-mitigated-700' },
    alert:   { iconBg: 'bg-high-50',       iconColor: 'text-high-700',      valueColor: 'text-high-700' },
  }[tone];
  const activeRing = active ? 'ring-2 ring-brand-600 ring-offset-1' : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 p-2 rounded-[10px] text-left cursor-pointer hover:bg-[#F4F2F7] transition-colors ${activeRing}`}
      aria-pressed={!!active}
    >
      <div className={`w-9 h-9 ${toneStyles.iconBg} ${toneStyles.iconColor} rounded-full flex items-center justify-center shrink-0`}>
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div>
        <div className={`text-[1.375rem] leading-none font-semibold tabular-nums ${toneStyles.valueColor} mb-1`}>{value}</div>
        <div className="text-[0.6875rem] text-ink-500 tracking-wide">{label}</div>
      </div>
    </button>
  );
}

function RoleToggle({ role, setRole }: { role: ExceptionRole; setRole: (r: ExceptionRole) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-canvas-elevated border border-canvas-border rounded-full">
      <button
        onClick={() => setRole('risk-owner')}
        className={`flex items-center gap-1.5 px-3 h-7 text-[0.75rem] font-medium rounded-full transition-colors cursor-pointer ${
          role === 'risk-owner' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${role === 'risk-owner' ? 'bg-brand-600' : 'bg-ink-300'}`} />
        Risk Owner
      </button>
      <button
        onClick={() => setRole('auditor')}
        className={`flex items-center gap-1.5 px-3 h-7 text-[0.75rem] font-medium rounded-full transition-colors cursor-pointer ${
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
  const [nextActionableNum, setNextActionableNum] = useState(2);
  const [atrExpanded, setAtrExpanded] = useState(false);

  const sourceQuery = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const fromId = new URLSearchParams(window.location.search).get('from');
    if (!fromId) return null;
    return REPORT_QUERIES_ATR[fromId] ? { id: fromId, ...REPORT_QUERIES_ATR[fromId] } : null;
  }, []);

  // Local exception state — initialized from props or default mock data
  const [localExceptions, setLocalExceptions] = useState<GrcException[]>(propsExceptions || GRC_EXCEPTIONS);
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
            className="flex items-center gap-1.5 text-[0.75rem] text-ink-500 hover:text-brand-700 transition-colors cursor-pointer pr-2 border-r border-canvas-border mr-1"
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
              {!embedded && <h1 className="font-display text-[2.125rem] font-[420] tracking-tight text-ink-900 leading-[1.15]">Manage Exceptions</h1>}
              {embedded ? (
                <h2 className="text-[1rem] font-semibold text-ink-900 mb-3">Exceptions & Cases</h2>
              ) : (
                <p className="text-[0.875rem] text-ink-500 mt-1 mb-6">Triage and resolve exceptions surfaced from audit queries.</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActivityDrawerOpen(true)}
                title="View activity timeline"
                aria-label="View activity timeline"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-brand-700 bg-brand-50/60 border border-brand-100 hover:bg-brand-50 hover:border-brand-200 transition-colors cursor-pointer"
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
                ...(!embedded ? [{ id: 'action-hub' as const, label: 'Action Hub', icon: FileBarChart }] : []),
              ] as const).map(t => {
                const Icon = t.icon;
                const isActive = activeNav === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveNav(t.id)}
                    className={`relative flex items-center gap-2 px-4 h-11 text-[0.8125rem] font-medium transition-colors cursor-pointer ${
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
                  <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-ink-500 font-medium">Report health</span>
                  <span className="text-[0.8125rem] text-ink-900 font-medium">{ACTION_HUB_SUMMARY.reportHealthLabel}</span>
                  <span className="text-[0.75rem] text-ink-500 tabular-nums">· {ACTION_HUB_SUMMARY.reportHealthPct}%</span>
                </div>
                <div className="h-5 w-px bg-canvas-border" aria-hidden="true" />
                <button
                  onClick={() => setAtrModalOpen(true)}
                  className="h-9 px-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer transition-colors"
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
          <div className="px-8 py-6 max-w-[1600px] mx-auto min-h-full flex flex-col">

            {sourceQuery ? (
              <div className="mb-6 bg-canvas-elevated border border-canvas-border rounded-[10px] overflow-hidden">
                {/* KPI strip */}
                <div className="grid grid-cols-4 gap-3 px-6 py-5">
                  <InlineStatTile label="Total Exceptions"        value={stats.total}                tone="default" icon={AlertTriangle} active={kpiFilter === null}                onClick={() => setKpiFilter(null)} />
                  <InlineStatTile label="Exceptions Classified"   value={stats.classified}           tone="info"    icon={Tag}            active={kpiFilter === 'classified'}          onClick={() => toggleKpiFilter('classified')} />
                  <InlineStatTile label="Unclassified Exceptions" value={stats.unclassified}         tone="warning" icon={Clock}          active={kpiFilter === 'unclassified'}        onClick={() => toggleKpiFilter('unclassified')} />
                  <InlineStatTile label="Action Review Pending"   value={stats.actionReviewPending}  tone="alert"   icon={CheckCircle2}   active={kpiFilter === 'actionReviewPending'} onClick={() => toggleKpiFilter('actionReviewPending')} />
                </div>
                {/* Divider + source query ATR */}
                <div className="px-6 py-5 border-t border-canvas-border">
                  <div className="flex items-center gap-2 mb-3 text-[0.6875rem]">
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
                    <p className="text-[0.875rem] text-ink-700 leading-relaxed transition-colors group-hover:text-ink-900">
                      {sourceQuery.title}
                    </p>
                  </button>
                  <p className="text-[0.8125rem] text-ink-500 leading-relaxed">{sourceQuery.summary}</p>
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
                      <div className="px-6 pb-6 border-t border-canvas-border pt-5">
                        <div className="space-y-6">
                          {[
                            { title: 'Findings', items: sourceQuery.findings },
                            { title: 'Observations', items: sourceQuery.observations },
                          ].map(section => (
                            <div key={section.title}>
                              <h4 className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-3">{section.title}</h4>
                              <ul className="space-y-2.5">
                                {section.items.map((item, i) => (
                                  <motion.li
                                    key={i}
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
                                    className="flex gap-2.5 text-[0.8125rem] text-ink-700 leading-relaxed"
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
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Exceptions"        value={stats.total}                tone="default" icon={AlertTriangle} active={kpiFilter === null}                onClick={() => setKpiFilter(null)} />
                <StatCard label="Exceptions Classified"   value={stats.classified}           tone="info"    icon={Tag}            active={kpiFilter === 'classified'}          onClick={() => toggleKpiFilter('classified')} />
                <StatCard label="Unclassified Exceptions" value={stats.unclassified}         tone="warning" icon={Clock}          active={kpiFilter === 'unclassified'}        onClick={() => toggleKpiFilter('unclassified')} />
                <StatCard label="Action Review Pending"   value={stats.actionReviewPending}  tone="alert"   icon={CheckCircle2}   active={kpiFilter === 'actionReviewPending'} onClick={() => toggleKpiFilter('actionReviewPending')} />
              </div>
            )}

            {/* Table card */}
            <ExceptionsTable
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
                addToast({ type: 'info', message: `Assigning ${ex.id}…` });
              }}
              headerLeading={
                <div className="flex items-center gap-1.5">
                  {/* Bulk Classify + Bulk Assign only appear once one or more
                      rows are checked; default toolbar stays uncluttered. */}
                  {role === 'risk-owner' && selected.size > 0 && (
                    <button
                      onClick={() => setBulkClassifyOpen(true)}
                      title={`Bulk classify ${selected.size} selected case${selected.size === 1 ? '' : 's'}`}
                      className="flex items-center gap-1.5 h-8 px-2.5 text-[0.75rem] font-medium rounded-[8px] border text-white bg-brand-600 border-brand-600 hover:bg-brand-500 cursor-pointer transition-colors"
                    >
                      <Tag size={13} />
                      Bulk Classify
                      <span className="inline-flex items-center h-5 min-w-5 px-1 text-[0.75rem] font-semibold bg-white/20 rounded-full tabular-nums">
                        {selected.size}
                      </span>
                    </button>
                  )}
                  {role === 'risk-owner' && selected.size > 0 && (
                    <button
                      onClick={() => {
                        if (onBulkAssign) {
                          onBulkAssign(Array.from(selected));
                        } else {
                          addToast({ type: 'info', message: `Assigning ${selected.size} case${selected.size === 1 ? '' : 's'}…` });
                        }
                      }}
                      title={`Bulk assign ${selected.size} selected case${selected.size === 1 ? '' : 's'}`}
                      className="flex items-center gap-1.5 h-8 px-2.5 text-[0.75rem] font-medium rounded-[8px] border text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100 hover:border-brand-300 cursor-pointer transition-colors"
                    >
                      <UserPlus size={13} />
                      Bulk Assign
                      <span className="inline-flex items-center h-5 min-w-5 px-1 text-[0.75rem] font-semibold bg-brand-100 rounded-full tabular-nums">
                        {selected.size}
                      </span>
                    </button>
                  )}
                  {onBulkAssign && role !== 'risk-owner' && (
                    <button
                      disabled={selected.size === 0}
                      onClick={() => onBulkAssign(Array.from(selected))}
                      title={selected.size === 0 ? 'Select exceptions first' : `Mark ${selected.size} as case${selected.size === 1 ? '' : 's'} & assign`}
                      className={`flex items-center gap-1.5 h-8 px-2.5 text-[0.75rem] font-medium rounded-[8px] border transition-colors ${
                        selected.size === 0
                          ? 'text-ink-400 bg-canvas-elevated border-canvas-border cursor-not-allowed'
                          : 'text-white bg-purple-600 border-purple-600 hover:bg-purple-500 cursor-pointer'
                      }`}
                    >
                      <UserPlus size={13} />
                      Mark as Case & Assign
                      {selected.size > 0 && (
                        <span className="inline-flex items-center h-5 min-w-5 px-1 text-[0.75rem] font-semibold bg-white/20 rounded-full tabular-nums">
                          {selected.size}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              }
              headerExtras={
                <button
                  onClick={() => setSampleModalOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-2.5 text-[0.75rem] text-ink-600 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer"
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
        </motion.div>
      )}

      <AnimatePresence>
        {drawer?.type === 'classify' && drawerException && (
          <ClassifyExceptionDrawer
            key="classify-drawer"
            exception={drawerException}
            onClose={() => setDrawer(null)}
            onSave={() => setDrawer(null)}
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
              addToast({ type: 'success', message: `Sample sheet "${payload.name}" has been created successfully` });
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
                  ? { ...e, severity: payload.severity, classification: payload.classification, classificationReview: 'Approved' as const, status: 'Under Review' as const, lastUpdated: new Date().toISOString().slice(0, 10) }
                  : e
              ));
              setNextActionableNum(n => n + 1);
              setSelected(new Set());
              setBulkClassifyOpen(false);
            }}
          />
        )}
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

