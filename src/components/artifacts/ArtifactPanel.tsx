import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronDown, FileCode,
  Database, BarChart3, Sparkles, Copy, Download,
  AlertTriangle, LayoutDashboard
} from 'lucide-react';
import type { ArtifactTab } from '../../hooks/useAppState';
import OutputConfigTab from './OutputConfigTab';

interface ArtifactPanelProps {
  activeTab: ArtifactTab;
  setActiveTab: (t: ArtifactTab) => void;
  onClose: () => void;
  onManageExceptions?: () => void;
  onAddToReport?: () => void;
  onShareResults?: () => void;
}

const TABS: { id: ArtifactTab; label: string; icon: React.ElementType }[] = [
  { id: 'plan', label: 'Plan', icon: Sparkles },
  { id: 'code', label: 'Code', icon: FileCode },
  { id: 'sources', label: 'Sources', icon: Database },
  { id: 'output', label: 'Output', icon: LayoutDashboard },
];

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children, actions }: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode; actions?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-canvas-border rounded-xl bg-canvas-elevated overflow-hidden transition-colors hover:border-brand-200">
      <div className="flex items-center px-4 py-3 hover:bg-paper-50/60 transition-colors">
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          aria-expanded={open}
          className="flex-1 flex items-center gap-2 text-[14px] font-serif tracking-tight text-ink-900 cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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

function PlanTab() {
  const steps = [
    { step: 1, title: 'Parse user query', desc: 'Identified intent: risk analysis query for P2P process', status: 'done' },
    { step: 2, title: 'Identify data sources', desc: 'Selected: SAP ERP AP Module, Vendor Master Data', status: 'done' },
    { step: 3, title: 'Generate query plan', desc: 'Built SQL joins across 3 tables with risk severity filter', status: 'done' },
    { step: 4, title: 'Execute query', desc: 'Processed 1.2M records, filtered to 9 matching risks', status: 'done' },
    { step: 5, title: 'Format results', desc: 'Generated table view with severity indicators and control mapping', status: 'done' },
  ];

  return (
    <div className="space-y-3 pt-4">
      <CollapsibleSection title="Query Execution Plan" icon={Sparkles}>
        <div className="space-y-3 pt-3">
          {steps.map((s, i) => (
            <div key={s.step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                  s.status === 'done' ? 'bg-compliant-50 text-compliant-700' : 'bg-paper-50 text-ink-500'
                }`}>
                  {s.step}
                </div>
                {i < steps.length - 1 && <div className="w-px h-full bg-border-light mt-1" />}
              </div>
              <div className="pb-3">
                <div className="text-[13px] font-medium text-text">{s.title}</div>
                <div className="text-[12px] text-text-muted mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Assumptions Section */}
      <div className="mt-4 p-3 bg-mitigated-50/50 border border-mitigated/50 rounded-xl">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle size={12} className="text-mitigated-700" />
          <span className="text-[12px] font-bold text-mitigated-700">Assumptions Made</span>
        </div>
        <div className="space-y-1.5">
          {[
            'Date range: Full FY26 (Apr 2025 – Mar 2026)',
            'Amount tolerance: ± 5% on invoice amounts',
            'Vendor scope: All vendors in SAP AP Module',
            'Matching logic: Fuzzy match on invoice number + vendor + amount',
            'Excluded: Voided and reversed invoices',
            'Currency: INR (converted at booking rate)',
          ].map((assumption, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-mitigated mt-1.5 shrink-0" />
              <span className="text-[12px] text-mitigated-700">{assumption}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CodeTab() {
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

  return (
    <div className="space-y-3 pt-4">
      <CollapsibleSection title="Generated SQL Query" icon={FileCode}>
        <div className="mt-3 relative">
          <pre className="bg-ink-900 text-paper-50 rounded-lg p-4 text-[12px] font-mono overflow-x-auto leading-relaxed">
            <code>{sql}</code>
          </pre>
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              aria-label="Download SQL"
              className="p-1.5 bg-ink-700 hover:bg-ink-600 text-paper-50 rounded-md transition-colors cursor-pointer"
            >
              <Download size={12} />
            </button>
            <button
              aria-label="Copy SQL"
              className="p-1.5 bg-ink-700 hover:bg-ink-600 text-paper-50 rounded-md transition-colors cursor-pointer"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Execution Stats" icon={BarChart3} defaultOpen={false}>
        <div className="grid grid-cols-3 gap-3 pt-3">
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-text">1.2M</div>
            <div className="text-[12px] text-text-muted">Records Scanned</div>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-text">0.3s</div>
            <div className="text-[12px] text-text-muted">Query Time</div>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-text">9</div>
            <div className="text-[12px] text-text-muted">Results</div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function SourcesTab() {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
      {sources.map((src, i) => (
        <SourceCard key={i} index={i} {...src} />
      ))}
    </div>
  );
}

function SourceCard({
  name, type, records, tables, syncedAt, status, color, index,
}: {
  name: string;
  type: string;
  records: string;
  tables: string[];
  syncedAt: string;
  status: 'synced' | 'stale';
  color: 'evidence' | 'mitigated';
  index: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const accent = color === 'evidence'
    ? { iconBg: 'bg-evidence/10', icon: 'text-evidence', chip: 'bg-evidence/8 text-evidence-700 border-evidence/15', typeChip: 'bg-evidence/8 text-evidence-700' }
    : { iconBg: 'bg-mitigated/10', icon: 'text-mitigated', chip: 'bg-mitigated/8 text-mitigated-700 border-mitigated/15', typeChip: 'bg-mitigated/10 text-mitigated-700' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.05, duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]"
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${accent.iconBg}`}>
          <Database size={15} className={accent.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13.5px] font-semibold text-ink-900 truncate" title={name}>{name}</h3>
            {/* Live status dot */}
            <span className="relative inline-flex size-2 shrink-0" aria-label={status === 'synced' ? 'Synced' : 'Stale'}>
              <span className={`absolute inline-flex h-full w-full rounded-full ${status === 'synced' ? 'bg-compliant/50' : 'bg-mitigated/50'} motion-safe:animate-ping`} />
              <span className={`relative inline-flex size-2 rounded-full ${status === 'synced' ? 'bg-compliant' : 'bg-mitigated'}`} />
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`inline-flex items-center text-[10.5px] font-medium uppercase tracking-[0.06em] px-1.5 py-[2px] rounded ${accent.typeChip}`}>
              {type}
            </span>
            <span className="font-mono text-[10.5px] text-ink-400 tabular-nums">{syncedAt}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 -mr-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            aria-label={`Download ${name}`}
            className="size-7 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Download size={13} />
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
              <div className="flex items-baseline gap-2 pb-3 border-b border-canvas-border/70">
                <span className="text-[20px] font-bold text-ink-900 tabular-nums leading-none">
                  {records.replace(/\s.*$/, '')}
                </span>
                <span className="text-[12px] text-ink-500">
                  {records.replace(/^\S+\s/, '')}
                </span>
              </div>

              {/* Tables / files */}
              <div className="pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.06em]">
                    {type.includes('CSV') ? 'Files' : 'Tables'}
                  </span>
                  <span className="font-mono text-[10.5px] text-ink-400 tabular-nums">
                    {tables.length.toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tables.map(t => (
                    <span
                      key={t}
                      className={`group/chip inline-flex items-center gap-1 text-[11.5px] font-mono px-2 py-1 rounded-md border transition-colors duration-200 cursor-default ${accent.chip}`}
                    >
                      {t}
                    </span>
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

export default function ArtifactPanel({ activeTab, setActiveTab, onClose }: ArtifactPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="h-full w-full bg-canvas-elevated flex flex-col overflow-hidden"
    >
      {/* Tab strip — segmented control with an animated sliding indicator.
          The pill behind the active tab uses Framer's layoutId trick so it
          glides between tabs instead of jumping. Close X sits on the
          right with a hover chip. */}
      <div className="h-12 shrink-0 px-3 sm:px-4 border-b border-canvas-border flex items-center justify-between gap-2 bg-canvas-elevated/80 backdrop-blur-[2px]">
        <div
          role="tablist"
          aria-label="Workspace"
          className="relative flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-50/60 border border-canvas-border/60"
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                onClick={() => setActiveTab(tab.id)}
                aria-selected={isActive}
                aria-controls={`artifact-panel-${tab.id}`}
                className={`relative z-10 flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  isActive
                    ? 'text-brand-700'
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="workspace-tab-pill"
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-md bg-canvas-elevated border border-brand-200 shadow-[0_1px_2px_rgba(15,8,30,0.04),0_4px_12px_-6px_rgba(106,18,205,0.18)]"
                    transition={{ type: 'spring', stiffness: 460, damping: 38, mass: 0.6 }}
                  />
                )}
                <tab.icon size={14} className={isActive ? 'text-brand-600' : 'text-ink-400'} />
                <span className="leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
          className="size-8 inline-flex items-center justify-center shrink-0 text-ink-400 hover:text-ink-800 rounded-md hover:bg-brand-50 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
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
            {activeTab === 'sources' && <SourcesTab />}
            {activeTab === 'output' && <OutputConfigTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
