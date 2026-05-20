import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronDown, FileCode,
  Database, BarChart3, Sparkles, Copy, Download,
  AlertTriangle, LayoutDashboard, Wand2, HelpCircle,
  FileSpreadsheet, ExternalLink, RefreshCw, Check,
} from 'lucide-react';
import type { ArtifactTab } from '../../hooks/useAppState';
import OutputConfigTab from './OutputConfigTab';
import { useToast } from '../shared/Toast';
import { KpiTile } from '../shared/KpiTile';

interface ArtifactPanelProps {
  activeTab: ArtifactTab;
  setActiveTab: (t: ArtifactTab) => void;
  onClose: () => void;
  onManageExceptions?: () => void;
  onAddToReport?: () => void;
  onShareResults?: () => void;
  /** Navigate to the Knowledge Hub (data sources) — invoked from the Open
   *  action on a Source card. Hooked from App to setView('data-sources'). */
  onOpenInKnowledgeHub?: (sourceName: string) => void;
}

const TABS: { id: ArtifactTab; label: string; icon: React.ElementType; count?: number }[] = [
  { id: 'plan', label: 'Plan', icon: Sparkles, count: 7 },
  { id: 'code', label: 'Code', icon: FileCode },
  { id: 'sources', label: 'Sources', icon: Database, count: 2 },
  { id: 'output', label: 'Output', icon: LayoutDashboard },
];

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children, actions }: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode; actions?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]">
      <div className="flex items-center px-4 py-3 hover:bg-paper-50/60 transition-colors">
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          aria-expanded={open}
          className="flex-1 flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink-900 cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Icon size={14} className="text-primary shrink-0" />
          <span className="flex-1 text-left">{title}</span>
        </button>
        {actions && <div className="flex items-center gap-1 ml-2">{actions}</div>}
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          aria-label={open ? 'Collapse section' : 'Expand section'}
          aria-expanded={open}
          className="ml-1 p-1 text-ink-400 hover:text-ink-700 hover:bg-brand-50 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <ChevronDown size={14} className={`transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-canvas-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Production data contract for a query execution plan step. Status maps
// 1:1 to backend states; no client-side decoration beyond that.
type PlanStepStatus = 'pending' | 'running' | 'done' | 'failed';
interface PlanStep {
  id: string;
  title: string;
  detail: string;
  status: PlanStepStatus;
}

interface PlanAssumption {
  key: string;
  value: string;
}

const PLAN_STEPS: PlanStep[] = [
  { id: 'parse',   title: 'Parse user query',      detail: 'Identified intent: risk analysis query for P2P process',           status: 'done' },
  { id: 'sources', title: 'Identify data sources', detail: 'Selected: SAP ERP AP Module, Vendor Master Data',                  status: 'done' },
  { id: 'plan',    title: 'Generate query plan',   detail: 'Built SQL joins across 3 tables with risk severity filter',        status: 'done' },
  { id: 'execute', title: 'Execute query',         detail: 'Processed 1.2M records, filtered to 9 matching risks',             status: 'done' },
  { id: 'format',  title: 'Format results',        detail: 'Generated table view with severity indicators and control mapping', status: 'done' },
];

const PLAN_ASSUMPTIONS: PlanAssumption[] = [
  { key: 'Date range',       value: 'Full FY26 (Apr 2025 – Mar 2026)' },
  { key: 'Amount tolerance', value: '± 5% on invoice amounts' },
  { key: 'Vendor scope',     value: 'All vendors in SAP AP Module' },
  { key: 'Matching logic',   value: 'Fuzzy match on invoice number + vendor + amount' },
  { key: 'Excluded',         value: 'Voided and reversed invoices' },
  { key: 'Currency',         value: 'INR (converted at booking rate)' },
];

function PlanStepNode({ status, index }: { status: PlanStepStatus; index: number }) {
  if (status === 'done') {
    return <Check size={12} strokeWidth={2.75} className="text-compliant-700" aria-hidden />;
  }
  if (status === 'running') {
    return (
      <span className="relative inline-flex size-2.5 rounded-full bg-brand-600" aria-hidden>
        <span className="absolute inset-0 rounded-full ring-2 ring-brand-400/40 motion-safe:animate-ping" />
      </span>
    );
  }
  if (status === 'failed') {
    return <X size={12} strokeWidth={2.75} className="text-risk-700" aria-hidden />;
  }
  return (
    <span className="text-[10px] font-mono tabular-nums text-ink-400" aria-hidden>{index + 1}</span>
  );
}

function PlanTab({ steps = PLAN_STEPS, assumptions = PLAN_ASSUMPTIONS }: { steps?: PlanStep[]; assumptions?: PlanAssumption[] } = {}) {
  const { addToast } = useToast();
  const [planOpen, setPlanOpen] = useState(true);
  const [assumptionsOpen, setAssumptionsOpen] = useState(true);

  const doneCount = steps.filter(s => s.status === 'done').length;
  const allDone = doneCount === steps.length;
  const hasRunning = steps.some(s => s.status === 'running');
  const hasFailed = steps.some(s => s.status === 'failed');

  return (
    <div className="space-y-4 pt-4">
      {/* ─────── Plan card ─────── */}
      <section
        aria-label="Query execution plan"
        className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]"
      >

        {/* Header — clickable to toggle */}
        <button
          type="button"
          onClick={() => setPlanOpen(o => !o)}
          aria-expanded={planOpen}
          aria-controls="plan-steps"
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-paper-50/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
        >
          <div className="size-7 rounded-lg bg-brand-50 ring-1 ring-inset ring-brand-100 flex items-center justify-center shrink-0">
            <Sparkles size={13} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <h3 className="text-[13.5px] font-semibold text-ink-900 leading-tight tracking-tight">Query Execution Plan</h3>
            <p className="text-[11.5px] text-ink-500 mt-px leading-tight">
              {steps.length} steps · {hasFailed ? 'failed' : hasRunning ? 'in progress' : allDone ? 'completed' : `${doneCount} done`}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-medium tabular-nums ${
              hasFailed ? 'bg-risk-50 text-risk-700'
                : hasRunning ? 'bg-brand-50 text-brand-700'
                  : allDone ? 'bg-compliant-50 text-compliant-700'
                    : 'bg-paper-100 text-ink-600'
            }`}
            aria-label={`${doneCount} of ${steps.length} complete`}
          >
            <span className={`size-1.5 rounded-full ${
              hasFailed ? 'bg-risk' : hasRunning ? 'bg-brand-500' : allDone ? 'bg-compliant' : 'bg-ink-400'
            }`} aria-hidden />
            {doneCount}/{steps.length}
          </span>
          <motion.span
            animate={{ rotate: planOpen ? 0 : -90 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="inline-flex items-center justify-center size-6 -mr-1 text-ink-400"
            aria-hidden
          >
            <ChevronDown size={14} />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {planOpen && (
            <motion.div
              key="plan-body"
              id="plan-steps"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <ol className="px-3 pb-3 border-t border-canvas-border/70 pt-2" role="list">
                {steps.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-2.5 px-2 py-1.5 rounded-md hover:bg-paper-50/70 transition-colors min-w-0"
                    aria-label={`${s.title} — ${s.status}`}
                  >
                    <span className="inline-flex items-center justify-center w-4 h-[18px] shrink-0">
                      <PlanStepNode status={s.status} index={i} />
                    </span>
                    <p className="text-[12.5px] leading-[18px] min-w-0 flex-1">
                      <span className="font-medium text-ink-900">{s.title}</span>
                      <span className="text-ink-300 mx-1.5" aria-hidden>—</span>
                      <span className="text-ink-500">{s.detail}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─────── Assumptions card ─────── */}
      {assumptions.length > 0 && (
        <section
          aria-label="Assumptions"
          className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]"
        >

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setAssumptionsOpen(o => !o)}
              aria-expanded={assumptionsOpen}
              aria-controls="assumptions-list"
              className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-paper-50/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
            >
              <div className="size-7 rounded-lg bg-brand-50 ring-1 ring-inset ring-brand-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={13} className="text-brand-600" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <h3 className="text-[13.5px] font-semibold text-ink-900 leading-tight tracking-tight">Assumptions</h3>
                <p className="text-[11.5px] text-ink-500 mt-px leading-tight">
                  {assumptions.length} defaults applied to this query
                </p>
              </div>
            </button>
            <div className="flex items-center pr-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addToast({ type: 'info', message: 'Edit assumptions — opening modifier' });
                }}
                className="text-[11px] font-medium text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded px-2 py-1"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setAssumptionsOpen(o => !o)}
                aria-expanded={assumptionsOpen}
                aria-label={assumptionsOpen ? 'Collapse assumptions' : 'Expand assumptions'}
                className="inline-flex items-center justify-center size-6 text-ink-400 hover:text-ink-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
              >
                <motion.span
                  animate={{ rotate: assumptionsOpen ? 0 : -90 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                  className="inline-flex"
                  aria-hidden
                >
                  <ChevronDown size={14} />
                </motion.span>
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {assumptionsOpen && (
              <motion.div
                key="assumptions-body"
                id="assumptions-list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <dl className="px-3 pb-3 border-t border-canvas-border/70 pt-2">
                  {assumptions.map((a) => (
                    <div
                      key={a.key}
                      className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-2 py-1.5 rounded-md hover:bg-paper-50/70 transition-colors"
                    >
                      <dt className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-400 truncate self-start pt-px">
                        {a.key}
                      </dt>
                      <dd className="text-[12.5px] text-ink-800 leading-snug">{a.value}</dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

function CodeTab() {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  const sql = `SELECT
  r.id AS risk_id,
  r.name AS risk_name,
  r.severity,
  COUNT(c.id) AS control_count,
  SUM(CASE WHEN c.is_key THEN 1 ELSE 0 END) AS key_controls
FROM risks r
LEFT JOIN controls c ON c.risk_id = r.id
WHERE r.bp_id = 'p2p'
  AND r.severity IN ('critical', 'high')
GROUP BY r.id, r.name, r.severity
ORDER BY
  CASE r.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
  END;`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast({ type: 'error', message: 'Could not copy SQL to clipboard' });
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'query.sql';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ type: 'success', message: 'SQL downloaded as query.sql' });
    } catch {
      addToast({ type: 'error', message: 'Download failed' });
    }
  };

  return (
    <div className="space-y-3 pt-4">
      <CollapsibleSection title="Generated SQL Query" icon={FileCode}>
        <div className="mt-3 relative">
          <pre className="bg-ink-900 text-paper-50 rounded-lg p-4 text-[12px] font-mono overflow-x-auto leading-relaxed">
            <code>{sql}</code>
          </pre>
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Download SQL"
              title="Download as query.sql"
              className="p-1.5 bg-ink-700 hover:bg-ink-600 text-paper-50 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Download size={12} />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : 'Copy SQL'}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
              className={`p-1.5 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                copied ? 'bg-brand-600 text-white' : 'bg-ink-700 hover:bg-ink-600 text-paper-50'
              }`}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Execution Stats" icon={BarChart3} defaultOpen={false}>
        <div className="grid grid-cols-3 gap-3 pt-3">
          <KpiTile label="Records scanned" value="1.2M" index={0} />
          <KpiTile label="Query time"      value="0.3s" index={1} />
          <KpiTile label="Results"          value="9"    index={2} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function SourcesTab({ onOpenInKnowledgeHub }: { onOpenInKnowledgeHub?: (name: string) => void } = {}) {
  const sources: {
    name: string;
    type: string;
    records: string;
    tables: string[];
    syncedAt: string;
    status: 'synced' | 'stale';
    color: 'evidence' | 'mitigated';
  }[] = [
    {
      name: 'SAP ERP: AP Module',
      type: 'SQL Database',
      records: '1.2M rows',
      tables: ['risks', 'controls', 'risk_control_map'],
      syncedAt: '2 min ago',
      status: 'synced',
      color: 'evidence',
    },
    {
      name: 'Vendor Master Data',
      type: 'CSV File',
      records: '892 vendors',
      tables: ['vendor_master.csv'],
      syncedAt: 'Mar 20',
      status: 'synced',
      color: 'mitigated',
    },
  ];

  return (
    // Auto-fit grid: each card is ~min 320px wide and expands to share the
    // available width equally. The panel resizes; this grid reflows from
    // 1 to N columns without viewport breakpoints — fits the resizable
    // workspace pane cleanly.
    <div
      className="grid gap-3 pt-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}
    >
      {sources.map((src, i) => (
        <SourceCard key={i} index={i} {...src} onOpenInKnowledgeHub={onOpenInKnowledgeHub} />
      ))}
    </div>
  );
}

function SourceCard({
  name, type, records, tables, syncedAt, status, color, index, onOpenInKnowledgeHub,
}: {
  name: string;
  type: string;
  records: string;
  tables: string[];
  syncedAt: string;
  status: 'synced' | 'stale';
  color: 'evidence' | 'mitigated';
  index: number;
  onOpenInKnowledgeHub?: (name: string) => void;
}) {
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isCsv = type.toLowerCase().includes('csv');
  const TypeIcon = isCsv ? FileSpreadsheet : Database;

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    // Mock refresh — in production this would call the data source connector
    setTimeout(() => {
      setRefreshing(false);
      addToast({ type: 'success', message: `${name} schema refreshed` });
    }, 900);
  };
  // Open the source in the Knowledge Hub if the host wired a navigation
  // handler; otherwise fall back to a toast (e.g. when the panel is used
  // outside the main app shell).
  const handleOpen = () => {
    if (onOpenInKnowledgeHub) {
      onOpenInKnowledgeHub(name);
    } else {
      addToast({ type: 'info', message: `Opening ${name} in source viewer…` });
    }
  };
  const handlePreview = () => {
    addToast({ type: 'info', message: `Preview of ${name} loading…` });
  };
  // Unified treatment across every source — same icon-tile tint, same hairline
  // accent. The TypeIcon (Database vs FileSpreadsheet) is the only signal
  // of source kind. `color` is accepted for backward compatibility with
  // existing payloads but no longer drives styling.
  void color;
  const unitLabel = records.replace(/^\S+\s/, '');
  const unitValue = records.replace(/\s.*$/, '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.05, duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-brand-200 hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]"
    >
      {/* Header */}
      <div className="relative flex items-start gap-3 px-4 pt-3.5 pb-3">
        <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 ring-1 ring-inset ring-brand-100">
          <TypeIcon size={15} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0 pr-12">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[13.5px] font-semibold text-ink-900 truncate leading-snug" title={name}>{name}</h3>
            <span
              className="inline-flex items-center shrink-0"
              aria-label={status === 'synced' ? 'Synced' : 'Stale'}
              title={status === 'synced' ? 'Live · synced' : 'Stale · needs refresh'}
            >
              <span className="relative inline-flex size-1.5">
                <span className={`absolute inline-flex h-full w-full rounded-full ${status === 'synced' ? 'bg-brand-400/55' : 'bg-mitigated/55'} motion-safe:animate-ping`} />
                <span className={`relative inline-flex size-1.5 rounded-full ${status === 'synced' ? 'bg-brand-500' : 'bg-mitigated'}`} />
              </span>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[10.5px] text-ink-500">
            <span className="font-medium uppercase tracking-[0.06em] whitespace-nowrap">{type}</span>
            <span className="size-0.5 rounded-full bg-ink-300 shrink-0" aria-hidden />
            <span className="font-mono text-ink-400 tabular-nums truncate">{syncedAt}</span>
          </div>
        </div>

        {/* Action rail — absolutely positioned so it never steals title width */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 rounded-md bg-canvas-elevated/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={`Refresh ${name}`}
            title={refreshing ? 'Refreshing…' : 'Refresh'}
            className="size-7 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <RefreshCw size={12.5} className={refreshing ? 'motion-safe:animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleOpen}
            aria-label={`Open ${name}`}
            title="Open source"
            className="size-7 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ExternalLink size={12.5} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(p => !p)}
            aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
            aria-expanded={expanded}
            className="size-7 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ChevronDown size={13} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Records — featured metric */}
              <div className="flex items-end justify-between gap-3 pb-3 border-b border-canvas-border/70">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-[22px] font-semibold text-ink-900 tabular-nums leading-none tracking-tight">
                    {unitValue}
                  </span>
                  <span className="text-[12px] text-ink-500 truncate">{unitLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="text-[11px] font-medium text-ink-400 hover:text-brand-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
                >
                  Preview →
                </button>
              </div>

              {/* Tables / files */}
              <div className="pt-3">
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-[10.5px] font-medium text-ink-500 uppercase tracking-[0.08em]">
                    {isCsv ? 'Files' : 'Tables'}
                  </span>
                  <span className="font-mono text-[10.5px] text-ink-400 tabular-nums">· {tables.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tables.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addToast({ type: 'info', message: `Inspecting ${t}…` })}
                      title={`Inspect ${t}`}
                      className="inline-flex items-center gap-1 text-[11.5px] font-mono px-2 py-[3px] rounded-md border border-canvas-border bg-paper-50 text-ink-700 hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-700 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Claude-style highlight-to-improve toolbar. Lives at the panel root and
// watches text selections inside the panel content area. When the user
// selects ≥3 chars, a small floating toolbar appears above the selection
// with two actions: Improve (regenerate just this selection) and Explain
// (clarify what this means). Wired to toasts in this build — actual model
// regeneration is a future scope.
function HighlightToolbar({ scopeRef }: { scopeRef: React.RefObject<HTMLDivElement | null> }) {
  const { addToast } = useToast();
  const [popover, setPopover] = useState<{ x: number; y: number; text: string } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setPopover(null); return; }
      const text = sel.toString().trim();
      if (text.length < 3) { setPopover(null); return; }
      const range = sel.getRangeAt(0);
      // Only react when selection is inside our scope (the artifact panel
      // content area). Selections elsewhere (chat, sidebar) are ignored.
      if (!scope.contains(range.commonAncestorContainer)) { setPopover(null); return; }
      const rect = range.getBoundingClientRect();
      const scopeRect = scope.getBoundingClientRect();
      setPopover({
        x: rect.left - scopeRect.left + rect.width / 2,
        y: rect.top - scopeRect.top,
        text,
      });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [scopeRef]);

  // Dismiss on outside click / Escape.
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopover(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popover]);

  if (!popover) return null;
  const preview = popover.text.length > 60 ? popover.text.slice(0, 57) + '…' : popover.text;
  return (
    <div
      ref={popoverRef}
      role="toolbar"
      aria-label="Selection actions"
      style={{ left: popover.x, top: popover.y }}
      className="absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+8px)] flex items-center gap-0.5 px-1 py-1 rounded-lg bg-ink-900 text-canvas-elevated shadow-lg shadow-ink-900/20"
    >
      <button
        type="button"
        onClick={() => { addToast({ type: 'info', message: `Improving: "${preview}"` }); setPopover(null); window.getSelection()?.removeAllRanges(); }}
        className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[12px] font-medium hover:bg-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <Wand2 size={13} />
        <span>Improve</span>
      </button>
      <button
        type="button"
        onClick={() => { addToast({ type: 'info', message: `Explaining: "${preview}"` }); setPopover(null); window.getSelection()?.removeAllRanges(); }}
        className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[12px] font-medium hover:bg-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <HelpCircle size={13} />
        <span>Explain</span>
      </button>
    </div>
  );
}

export default function ArtifactPanel({ activeTab, setActiveTab, onClose, onOpenInKnowledgeHub }: ArtifactPanelProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="h-full w-full bg-canvas-elevated flex flex-col overflow-hidden"
    >
      {/* Tab strip — modern Linear/Vercel-style tabs with animated underline.
          Container-query aware: at narrow widths the count chips hide first,
          then labels collapse to icon-only. As a last resort the tablist
          scrolls horizontally so nothing is ever clipped off-screen. */}
      <div className="@container h-12 shrink-0 px-2 sm:px-4 border-b border-canvas-border flex items-end justify-between gap-2 bg-canvas-elevated">
        <div
          role="tablist"
          aria-label="Workspace"
          className="relative flex items-end gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                role="tab"
                onClick={() => setActiveTab(tab.id)}
                aria-selected={isActive}
                aria-controls={`artifact-panel-${tab.id}`}
                whileHover={!isActive ? { y: -1 } : undefined}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                title={tab.label}
                className={`group relative flex items-center gap-1.5 h-9 px-2.5 @[480px]:px-3 rounded-t-lg text-[13px] shrink-0 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  isActive
                    ? 'text-brand-700 font-semibold'
                    : 'text-ink-500 font-medium hover:text-ink-900 hover:bg-paper-50/70'
                }`}
              >
                <motion.span
                  animate={{ scale: isActive ? 1.06 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="inline-flex"
                >
                  <tab.icon
                    size={14}
                    strokeWidth={isActive ? 2.25 : 2}
                    className={isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-700 transition-colors'}
                  />
                </motion.span>
                <span className={`leading-none tracking-tight ${isActive ? 'inline' : 'hidden @[360px]:inline'}`}>
                  {tab.label}
                </span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`hidden @[440px]:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-mono tabular-nums leading-none transition-colors ${
                      isActive
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-paper-100 text-ink-500 group-hover:bg-paper-200 group-hover:text-ink-700'
                    }`}
                    aria-label={`${tab.count} items`}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="workspace-tab-underline"
                    aria-hidden="true"
                    className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500"
                    transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.55 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
          className="size-8 mb-1 inline-flex items-center justify-center shrink-0 text-ink-400 hover:text-ink-900 rounded-md hover:bg-paper-100 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content — wrapped in a relative ref'd container so the
          HighlightToolbar can position itself against selections inside. */}
      <div ref={contentRef} className="relative flex-1 overflow-y-auto px-5 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'plan' && <PlanTab />}
            {activeTab === 'code' && <CodeTab />}
            {activeTab === 'sources' && <SourcesTab onOpenInKnowledgeHub={onOpenInKnowledgeHub} />}
            {activeTab === 'output' && <OutputConfigTab />}
          </motion.div>
        </AnimatePresence>
        <HighlightToolbar scopeRef={contentRef} />
      </div>
    </motion.div>
  );
}
