// Four self-contained aesthetic treatments of the Bulk Audit detail page.
// Each variant owns its own cover, stats, and workflow-card style — the goal
// is direct side-by-side comparison from the report listing.
//
// Shared brand contract: purple primary, paper-50 background option, severity
// palette inherited from the rest of the report system. Variants differ in
// typography, rhythm, and information density — never in the underlying data.

import { useEffect, useRef, useState, type ElementType } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import { ArrowLeft, Download, History, MoreVertical, ExternalLink, Trash2, Plus, X, BarChart3, Table as TableIcon, AlertTriangle, CheckCircle2, Check, TrendingUp, Shield, Layers, List, FileText, Lightbulb, BookOpen, Share2, ChevronDown, Layout, Loader2, GripVertical, Edit3, StickyNote, Sparkles } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import EmptyState from '../shared/EmptyState';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import { ReportBrandBanner, ReportMetaPanel, ReportNumberedHeading, ReportKpiTiles } from './ReportDocumentChrome';
import { statTone } from './reportTones';
import { exportReportWord, exportReportPpt, exportReportPdf, exportReportHtml, exportBulkAuditExcel } from './reportExport';
import type { DownloadPreviewSection } from './ReportDownloadModal';
import { REPORT_TEMPLATES } from '../../data/mockData';
import type { WorkflowResult } from './reportShared';
import AddObservationModal, {
  computeNextObservationId,
  type EditingObservationInput,
  type ObservationAttachment,
} from './AddObservationModal';
import ObservationCard, { type ObservationCardData } from './ObservationCard';
import GenerateATRModal from '../exceptions/GenerateATRModal';

// ─────────────────────────────────────────────────────────────────────
// Output catalog — what the "Add output" modal can attach to a workflow.
// KPIs and graphs are computed from the workflow's data so the demo feels
// alive without wiring real analytics.
// ─────────────────────────────────────────────────────────────────────

type AttachedOutput =
  | { kind: 'kpi'; id: string }
  | { kind: 'graph'; id: string }
  | { kind: 'table'; id: string };

const KPI_CATALOG = [
  { id: 'kpi-flagged',  label: 'Records flagged',  icon: AlertTriangle, color: 'text-high-700 bg-high-50', compute: (w: WorkflowResult) => String(w.outputTable?.rows.length ?? 0) },
  { id: 'kpi-severity', label: 'Severity',         icon: Shield,        color: 'text-risk-700 bg-risk-50', compute: (w: WorkflowResult) => w.severity },
  { id: 'kpi-findings', label: 'Findings logged',  icon: CheckCircle2,  color: 'text-compliant-700 bg-compliant-50', compute: (w: WorkflowResult) => String(w.findings.length) },
  { id: 'kpi-runtime',  label: 'Avg breach value', icon: TrendingUp,    color: 'text-brand-700 bg-brand-50', compute: (w: WorkflowResult) => avgAmount(w) },
] as const;

function avgAmount(w: WorkflowResult): string {
  const rows = w.outputTable?.rows ?? [];
  const amounts = rows
    .map(r => String(r[3] ?? '').replace(/[^\d]/g, ''))
    .map(n => parseInt(n, 10))
    .filter(n => !isNaN(n) && n > 0);
  if (amounts.length === 0) return '—';
  const avg = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
  return `₹${avg.toLocaleString('en-IN')}`;
}

const GRAPH_CATALOG = [
  { id: 'graph-by-severity', title: 'Flagged records by severity', chartType: 'bar' as const, xAxis: 'Severity', yAxis: 'Count', color: '#6a12cd' },
  { id: 'graph-by-vendor',   title: 'Top vendors by flagged amount', chartType: 'bar' as const, xAxis: 'Vendor', yAxis: 'Amount (₹)', color: '#BF2E84' },
  { id: 'graph-by-date',     title: 'Flagged records over time', chartType: 'line' as const, xAxis: 'Date', yAxis: 'Records', color: '#A74108' },
];

const TABLE_CATALOG = [
  { id: 'table-vendor-summary', title: 'Vendor summary',  description: 'Records grouped by vendor with totals.' },
  { id: 'table-severity-split', title: 'Severity split',  description: 'Records broken out by severity tier.' },
];

type Report = {
  id: string;
  name: string;
  generatedBy: string;
  generatedAt: string;
  tag?: string;
  pages?: number;
  workflowResults?: WorkflowResult[];
  aestheticVariant?: 'editorial';
};

export function BulkAuditVariantView({
  report,
  templates = REPORT_TEMPLATES,
  onBack,
  onShare,
}: {
  report: Report;
  /** Options listed in the Apply Template dropdown (standard + custom). */
  templates?: typeof REPORT_TEMPLATES[number][];
  onBack: () => void;
  onShare?: () => void;
}) {
  const { addToast } = useToast();
  const { can } = useCan();
  const [workflows, setWorkflows] = useState<WorkflowResult[]>(report.workflowResults ?? []);
  const [pendingDelete, setPendingDelete] = useState<WorkflowResult | null>(null);

  // ─── Report-level observations (parity with Internal Audit reports) ───
  const [observations, setObservations] = useState<ObservationCardData[]>([]);
  const [showAddObservation, setShowAddObservation] = useState(false);
  const [editingObservation, setEditingObservation] = useState<EditingObservationInput | null>(null);
  const [pendingDeleteObs, setPendingDeleteObs] = useState<ObservationCardData | null>(null);
  const [atrModalOpen, setAtrModalOpen] = useState(false);

  // Track the index of the most recently removed observation / workflow so
  // that "Undo" on the success toast restores them to their original slot in
  // the report rather than appending to the tail.
  const removedObsIndexRef = useRef<number | null>(null);
  const removedWfIndexRef = useRef<number | null>(null);

  const nextObservationId = () => computeNextObservationId(observations.map(o => o.obsId));

  const openAddObservation = () => {
    setEditingObservation(null);
    setShowAddObservation(true);
  };
  const openEditObservation = (obs: ObservationCardData) => {
    setEditingObservation({
      id: obs.id,
      obsId: obs.obsId,
      name: obs.title,
      description: obs.description,
      attachments: obs.attachments,
    });
    setShowAddObservation(true);
  };
  const closeAddObservation = () => {
    setShowAddObservation(false);
    setEditingObservation(null);
  };

  const handleObservationSave = ({ name, description, attachments }: { name: string; description: string; attachments?: ObservationAttachment[] }) => {
    if (editingObservation) {
      setObservations(prev => prev.map(o =>
        o.id === editingObservation.id
          ? { ...o, title: name, description, attachments }
          : o
      ));
      addToast({ type: 'success', message: `${editingObservation.obsId} updated.` });
    } else {
      const obsId = nextObservationId();
      const newObs: ObservationCardData = {
        id: `bulk-obs-${Date.now()}`,
        obsId,
        title: name,
        description,
        attachments,
      };
      setObservations(prev => [...prev, newObs]);
      addToast({ type: 'success', message: `${obsId} added.` });
    }
    closeAddObservation();
  };

  const toggleObservationAttachment = (id: string) => {
    setObservations(prev => prev.map(o =>
      o.id === id ? { ...o, attachmentHidden: !o.attachmentHidden } : o
    ));
  };

  const confirmDeleteObservation = () => {
    if (!pendingDeleteObs) return;
    const removed = pendingDeleteObs;
    let restored = false;
    setObservations(prev => {
      const idx = prev.findIndex(o => o.id === removed.id);
      // Remember position so undo restores order, not appends to the tail.
      removedObsIndexRef.current = idx >= 0 ? idx : prev.length;
      return prev.filter(o => o.id !== removed.id);
    });
    addToast({
      type: 'success',
      message: `${removed.obsId} removed.`,
      action: {
        label: 'Undo',
        onClick: () => {
          if (restored) return;
          restored = true;
          setObservations(prev => {
            if (prev.some(o => o.id === removed.id)) return prev;
            const insertAt = Math.min(removedObsIndexRef.current ?? prev.length, prev.length);
            const next = [...prev];
            next.splice(insertAt, 0, removed);
            return next;
          });
        },
      },
    });
    setPendingDeleteObs(null);
  };

  // ─── Contents inline rename ───
  const [contentsEditingId, setContentsEditingId] = useState<string | null>(null);
  const [contentsDraft, setContentsDraft] = useState('');

  const handleStartContentsRename = (id: string, current: string) => {
    setContentsEditingId(id);
    setContentsDraft(current);
  };
  const handleCancelContentsRename = () => {
    setContentsEditingId(null);
    setContentsDraft('');
  };
  const handleSaveContentsRename = () => {
    if (!can('rp_edit')) { handleCancelContentsRename(); return; }
    const id = contentsEditingId;
    const newTitle = contentsDraft.trim();
    if (!id || !newTitle) {
      handleCancelContentsRename();
      return;
    }
    // Try workflow first, then observation.
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, name: newTitle } : w));
    setObservations(prev => prev.map(o => o.id === id ? { ...o, title: newTitle } : o));
    handleCancelContentsRename();
  };

  const scrollToContent = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Failed runs (errored / skipped) are excluded from the report body and only
  // surfaced via a callout in the Executive Summary. The body renders the
  // successful runs. When *every* run failed, swap the layout for a dedicated
  // empty state since there's nothing to report on the audit itself.
  const successfulWorkflows = workflows.filter(w => (w.runStatus ?? 'succeeded') !== 'failed');
  const failedWorkflows = workflows.filter(w => w.runStatus === 'failed');
  const allFailed = successfulWorkflows.length === 0 && failedWorkflows.length > 0;
  const totals = computeTotals(successfulWorkflows);

  // Real exports — same composers as standard reports, so the downloaded
  // document mirrors the on-screen ATR-style layout.
  const handleExport = (ext: 'pdf' | 'doc' | 'ppt' | 'html' | 'xlsx') => {
    if (ext === 'xlsx') {
      exportBulkAuditExcel(report.name, successfulWorkflows);
      addToast({ type: 'success', message: `${report.name}.xlsx downloaded.` });
      return;
    }
    const sections: DownloadPreviewSection[] = [
      {
        id: 'bulk-exec-summary',
        kind: 'summary',
        title: 'Executive Summary',
        content: `This audit returned ${totals.records} flagged records across ${totals.workflows} ${totals.workflows === 1 ? 'workflow' : 'workflows'}. High-severity items should be triaged first; the remainder are queued for AP review.`,
        stats: bulkSummaryStats(totals).map(s => ({ label: s.label, value: s.value, accent: statTone(s.color).hex })),
      },
      ...successfulWorkflows.map(w => ({
        id: w.id,
        kind: 'workflow' as const,
        title: `Workflow · ${w.workflowId}`,
        workflowId: w.workflowId,
        workflowName: w.name,
        severity: w.severity,
        summary: resultSummary(w),
        findings: w.findings,
        observations: w.observations,
      })),
      ...observations.map(o => ({
        id: o.id,
        kind: 'observation' as const,
        title: o.title,
        obsId: o.obsId,
        description: o.description,
      })),
    ];
    const ctx = {
      reportName: report.name,
      reportTag: report.tag,
      reportId: report.id?.toUpperCase(),
      generatedBy: report.generatedBy,
      generatedAt: report.generatedAt,
      sections,
    };
    if (ext === 'doc') {
      exportReportWord(ctx);
      addToast({ type: 'success', message: `${report.name}.doc downloaded.` });
    } else if (ext === 'ppt') {
      exportReportPpt(ctx);
      addToast({ type: 'success', message: `${report.name}.ppt downloaded.` });
    } else if (ext === 'html') {
      exportReportHtml(ctx);
      addToast({ type: 'success', message: `${report.name}.html downloaded.` });
    } else if (exportReportPdf(ctx)) {
      addToast({ type: 'info', message: 'Opening print dialog — choose “Save as PDF”.' });
    } else {
      addToast({ type: 'error', message: 'Pop-up blocked — allow pop-ups to export the PDF.' });
    }
  };

  const handleOpenWorkflow = (w: WorkflowResult) => {
    addToast({ type: 'info', message: `Opening ${w.workflowId} — ${w.name}…` });
  };
  const handleRequestDelete = (w: WorkflowResult) => setPendingDelete(w);
  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const removed = pendingDelete;
    let restored = false;
    setWorkflows(prev => {
      const idx = prev.findIndex(w => w.id === removed.id);
      removedWfIndexRef.current = idx >= 0 ? idx : prev.length;
      return prev.filter(w => w.id !== removed.id);
    });
    addToast({
      type: 'success',
      message: `${removed.workflowId} removed from report.`,
      action: {
        label: 'Undo',
        onClick: () => {
          if (restored) return;
          restored = true;
          setWorkflows(prev => {
            if (prev.some(w => w.id === removed.id)) return prev;
            const insertAt = Math.min(removedWfIndexRef.current ?? prev.length, prev.length);
            const next = [...prev];
            next.splice(insertAt, 0, removed);
            return next;
          });
        },
      },
    });
    setPendingDelete(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="h-full overflow-y-auto bg-canvas"
    >
      <BulkReportHeader onBack={onBack} onShare={onShare} onExport={handleExport} templates={templates} />
      {allFailed ? (
        <AllFailedEmpty report={report} failedWorkflows={failedWorkflows} />
      ) : (
        <EditorialLayout
          report={report}
          workflows={successfulWorkflows}
          failedWorkflows={failedWorkflows}
          totals={totals}
          onOpenWorkflow={handleOpenWorkflow}
          onRequestDelete={handleRequestDelete}
          onReorderWorkflows={setWorkflows}
          observations={observations}
          onAddObservation={openAddObservation}
          onEditObservation={openEditObservation}
          onToggleObservationAttachment={toggleObservationAttachment}
          onDeleteObservation={(obs) => setPendingDeleteObs(obs)}
          onReorderObservations={setObservations}
          contentsEditingId={contentsEditingId}
          contentsDraft={contentsDraft}
          onDraftChange={setContentsDraft}
          onStartContentsRename={handleStartContentsRename}
          onSaveContentsRename={handleSaveContentsRename}
          onCancelContentsRename={handleCancelContentsRename}
          onScrollToContent={scrollToContent}
          onGenerateAtr={() => setAtrModalOpen(true)}
        />
      )}

      {atrModalOpen && <GenerateATRModal onClose={() => setAtrModalOpen(false)} />}

      {pendingDelete && createPortal(
        <DeleteWorkflowConfirm
          workflow={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />,
        document.body,
      )}

      {pendingDeleteObs && createPortal(
        <DeleteObservationConfirm
          obsId={pendingDeleteObs.obsId}
          title={pendingDeleteObs.title}
          onCancel={() => setPendingDeleteObs(null)}
          onConfirm={confirmDeleteObservation}
        />,
        document.body,
      )}

      <AddObservationModal
        open={showAddObservation}
        editing={editingObservation}
        nextObsId={nextObservationId()}
        onClose={closeAddObservation}
        onSave={handleObservationSave}
      />
    </motion.div>
  );
}

function DeleteObservationConfirm({
  obsId,
  title,
  onCancel,
  onConfirm,
}: {
  obsId: string;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true, onCancel);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [onConfirm]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        className="fixed inset-0 z-[60] bg-ink-900/40 backdrop-blur-[2px] flex items-center justify-center p-6"
      >
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-obs-title"
          tabIndex={-1}
          className="w-full max-w-[320px] bg-white border border-canvas-border rounded-[16px] shadow-2xl overflow-hidden"
        >
          <div className="px-6 pt-6 pb-5">
            <h3 id="delete-obs-title" className="text-[15px] font-semibold text-ink-800 mb-2">Remove observation?</h3>
            <p className="text-[13px] text-ink-500 leading-relaxed">
              <span className="font-semibold text-ink-800">{obsId}</span> · {title} will be removed from this report.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-ink-800 bg-white border border-canvas-border rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-white bg-risk-600 hover:bg-risk-700 rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              Remove observation
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DeleteWorkflowConfirm({
  workflow,
  onCancel,
  onConfirm,
}: {
  workflow: WorkflowResult;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true, onCancel);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [onConfirm]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        className="fixed inset-0 z-[60] bg-ink-900/40 backdrop-blur-[2px] flex items-center justify-center p-6"
      >
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-wf-title"
          tabIndex={-1}
          className="w-full max-w-[320px] bg-white border border-canvas-border rounded-[16px] shadow-2xl overflow-hidden"
        >
          <div className="px-6 pt-6 pb-5">
            <h3 id="delete-wf-title" className="text-[15px] font-semibold text-ink-800 mb-2">Remove workflow from this report?</h3>
            <p className="text-[13px] text-ink-500 leading-relaxed">
              <span className="font-semibold text-ink-800">{workflow.workflowId}</span> · {workflow.name} will be removed from the report.
              The underlying workflow definition is not affected.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-ink-800 bg-white border border-canvas-border rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-white bg-risk-600 hover:bg-risk-700 rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              Remove workflow
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

type Totals = { workflows: number; records: number; high: number; medium: number; low: number; bps: string[] };

function computeTotals(workflows: WorkflowResult[]): Totals {
  const records = workflows.reduce((s, w) => s + (w.outputTable?.rows.length ?? 0), 0);
  const high = workflows.filter(w => w.severity === 'High').length;
  const medium = workflows.filter(w => w.severity === 'Medium').length;
  const low = workflows.filter(w => w.severity === 'Low').length;
  const bps = Array.from(new Set(workflows.map(w => w.businessProcess).filter(Boolean) as string[]));
  return { workflows: workflows.length, records, high, medium, low, bps };
}

const ICON_MAP: Record<string, ElementType> = {
  shield: Shield,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle2,
  'bar-chart': BarChart3,
  'file-text': FileText,
  'trending-up': TrendingUp,
  'clipboard-check': CheckCircle2,
  'lightbulb': Lightbulb,
  'book-open': BookOpen,
};

const CATEGORY_COLORS: Record<string, string> = {
  Compliance: 'text-evidence-700 bg-evidence-50',
  Risk: 'text-high-700 bg-high-50',
  Controls: 'text-brand-700 bg-brand-50',
  Analytics: 'text-brand-700 bg-brand-50',
  Audit: 'text-risk-700 bg-risk-50',
  Executive: 'text-indigo-600 bg-indigo-50',
};

// ─── Apply Template Dropdown ───
function ApplyTemplateDropdown({ templates = REPORT_TEMPLATES, activeId = null, onSelect, onClose }: { templates?: typeof REPORT_TEMPLATES[number][]; activeId?: string | null; onSelect: (template: typeof REPORT_TEMPLATES[0]) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.97 }}
      className="absolute right-0 top-full mt-1 w-[280px] bg-white rounded-[8px] shadow-xl border border-canvas-border z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-canvas-border">
        <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Select Template</span>
      </div>
      <div className="max-h-[260px] overflow-y-auto p-1.5">
        {templates.map(rt => {
          const Icon = ICON_MAP[rt.icon] || FileText;
          const isActive = rt.id === activeId;
          return (
            <button
              key={rt.id}
              onClick={() => { onSelect(rt); onClose(); }}
              aria-current={isActive || undefined}
              className={`w-full text-left px-3 py-2.5 rounded-[8px] transition-colors cursor-pointer flex items-center gap-2.5 ${isActive ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
            >
              <div className={`p-1.5 rounded-[8px] ${CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50'}`}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[12px] truncate ${isActive ? 'font-semibold text-brand-600' : 'font-medium text-ink-800'}`}>{rt.name}</div>
                <div className="text-[10px] text-ink-400">{rt.category}</div>
              </div>
              {isActive && <Check size={14} className="shrink-0 text-brand-600" />}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// Report top bar — back link + Apply Template / Share / Download, matching the
// internal audit report header. Apply Template is a UX match here: a bulk audit
// report has a fixed editorial layout, so applying a template animates + toasts
// without swapping sections.
function BulkReportHeader({ onBack, onShare, onExport, templates = REPORT_TEMPLATES }: {
  onBack: () => void;
  onShare?: () => void;
  onExport: (ext: 'pdf' | 'doc' | 'ppt' | 'html' | 'xlsx') => void;
  /** Options listed in the Apply Template dropdown (standard + custom). */
  templates?: typeof REPORT_TEMPLATES[number][];
}) {
  const { addToast } = useToast();
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  const handleApplyTemplate = (template: typeof REPORT_TEMPLATES[0]) => {
    setApplyingTemplate(true);
    window.setTimeout(() => {
      setAppliedTemplate(template);
      setApplyingTemplate(false);
      addToast({ type: 'success', message: `Template "${template.name}" applied.` });
    }, 800);
  };

  return (
    <>
      <div className="px-[124px] pt-8 pb-4">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-brand-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded"
          >
            <ArrowLeft size={14} /> Back to Reports
          </button>
          <div className="flex items-center gap-2 relative">
            {/* Apply Template */}
            <div className="relative">
              <button
                onClick={() => setShowApplyTemplate(p => !p)}
                disabled={applyingTemplate}
                aria-busy={applyingTemplate || undefined}
                className="flex items-center gap-1.5 px-3 py-2 border border-canvas-border text-[12px] font-medium text-ink-500 hover:bg-white hover:border-brand-600/30 transition-colors cursor-pointer bg-white disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded-[8px]"
              >
                {applyingTemplate ? (
                  <Loader2 size={14} className="animate-spin text-brand-600" />
                ) : (
                  <Layout size={14} />
                )}
                <span className="truncate max-w-[220px]">
                  {applyingTemplate ? 'Applying…' : (appliedTemplate?.name ?? 'Apply Template')}
                </span>
                <motion.span
                  animate={{ rotate: showApplyTemplate ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex"
                >
                  <ChevronDown size={14} />
                </motion.span>
              </button>
              <AnimatePresence>
                {showApplyTemplate && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowApplyTemplate(false)} />
                    <ApplyTemplateDropdown
                      templates={templates}
                      activeId={appliedTemplate?.id ?? null}
                      onSelect={handleApplyTemplate}
                      onClose={() => setShowApplyTemplate(false)}
                    />
                  </>
                )}
              </AnimatePresence>
            </div>
            {/* Share */}
            {onShare && (
              <button
                onClick={onShare}
                className="flex items-center gap-1.5 px-3 py-2 border border-canvas-border text-[12px] font-medium text-ink-500 hover:bg-white hover:border-brand-600/30 transition-colors cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded-[8px]"
              >
                <Share2 size={14} /> Share
              </button>
            )}
            {/* Download */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadDropdown(p => !p)}
                className="flex items-center gap-1.5 px-3 py-2 border border-canvas-border text-[12px] font-medium text-ink-500 hover:bg-white hover:border-brand-600/30 transition-colors cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded-[8px]"
              >
                <Download size={14} /> Download <ChevronDown size={12} className={`transition-transform ${showDownloadDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showDownloadDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-canvas-border shadow-xl z-50 py-1 w-48 rounded-[8px]">
                  {([
                    { label: 'Download as PDF', ext: 'pdf' },
                    { label: 'Download as DOCX', ext: 'doc' },
                    { label: 'Download as PPTX', ext: 'ppt' },
                    { label: 'Download as HTML', ext: 'html' },
                    { label: 'Download as Excel', ext: 'xlsx' },
                  ] as const).map(({ label, ext }) => (
                    <button
                      key={ext}
                      onClick={() => { onExport(ext); setShowDownloadDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-[12px] text-ink-500 hover:bg-brand-50 hover:text-brand-600 transition-colors cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Applying Template Overlay */}
      <AnimatePresence>
        {applyingTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-3 px-6 py-4 glass-card-strong rounded-[16px] shadow-lg"
            >
              <Loader2 size={20} className="text-brand-600 animate-spin" />
              <span className="text-[14px] font-semibold text-ink-800">Applying template...</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EDITORIAL — printed-page proportions, serif headlines, prose findings
// ─────────────────────────────────────────────────────────────────────

// Empty state shown when *every* workflow in the bulk run failed. Replaces the
// normal report layout — no audit content to show, just the cover and a list of
// the failed runs so the reader knows what was attempted.
function AllFailedEmpty({ report, failedWorkflows }: {
  report: Report;
  failedWorkflows: WorkflowResult[];
}) {
  return (
    <div className="px-[124px] pt-2 pb-24">
      {/* Cover — same light letterhead as the editorial layout, but slimmer */}
      <ReportBrandBanner
        title={report.name}
        className="rounded-[12px]"
      >
        <p className="text-[13px] leading-snug text-white/75">
          All {failedWorkflows.length} {failedWorkflows.length === 1 ? 'workflow' : 'workflows'} failed during this run.
        </p>
      </ReportBrandBanner>

      {/* Empty-state body */}
      <div className="bg-white border border-canvas-border rounded-[12px] mt-5 p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={20} className="text-brand-700" />
        </div>
        <h2 className="text-[18px] font-bold text-ink-800 mb-2">Nothing to report on the audit itself</h2>
        <p className="text-[13px] text-ink-500 mb-6 max-w-[540px] mx-auto">
          None of the {failedWorkflows.length} workflows in this run produced results — the report has no audit content. The failed runs are listed below for reference.
        </p>
        <div className="text-left max-w-[640px] mx-auto rounded-[12px] border border-brand-200 bg-brand-50/40 px-5 py-4">
          <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Failed runs</p>
          <ul className="space-y-1.5">
            {failedWorkflows.map(w => (
              <li key={w.id} className="text-[13px] text-ink-800">
                <span className="font-medium text-ink-900">{w.name}</span>
                <span className="text-ink-400"> ({w.workflowId}, {w.failureReason ?? 'errored'})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function EditorialLayout({
  report, workflows, failedWorkflows, totals, onOpenWorkflow, onRequestDelete, onReorderWorkflows,
  observations, onAddObservation, onEditObservation, onToggleObservationAttachment, onDeleteObservation, onReorderObservations,
  contentsEditingId, contentsDraft, onDraftChange, onStartContentsRename, onSaveContentsRename, onCancelContentsRename, onScrollToContent, onGenerateAtr,
}: {
  report: Report;
  workflows: WorkflowResult[];
  failedWorkflows: WorkflowResult[];
  totals: Totals;
  onOpenWorkflow: (w: WorkflowResult) => void;
  onRequestDelete: (w: WorkflowResult) => void;
  onReorderWorkflows: (next: WorkflowResult[]) => void;
  observations: ObservationCardData[];
  onAddObservation: () => void;
  onEditObservation: (obs: ObservationCardData) => void;
  onToggleObservationAttachment: (id: string) => void;
  onDeleteObservation: (obs: ObservationCardData) => void;
  onReorderObservations: (next: ObservationCardData[]) => void;
  contentsEditingId: string | null;
  contentsDraft: string;
  onDraftChange: (v: string) => void;
  onStartContentsRename: (id: string, current: string) => void;
  onSaveContentsRename: () => void;
  onCancelContentsRename: () => void;
  onScrollToContent: (id: string) => void;
  onGenerateAtr: () => void;
}) {
  const { addToast } = useToast();
  return (
    <div className="px-[124px] pt-2 pb-24">
      {/* Cover — light letterhead with theme accent + key facts, rounded top only so the white body below attaches cleanly */}
      <ReportBrandBanner
        title={report.name}
        className="rounded-t-[12px]"
        facts={[
          { value: totals.workflows, label: 'Workflows' },
          { value: totals.records, label: 'Flagged Records' },
          { value: observations.length, label: 'Observations' },
        ]}
        actions={
          <>
            <button
              onClick={onGenerateAtr}
              title="Generate Action Taken Report"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-white bg-white/10 border border-white/25 rounded-[8px] hover:bg-white/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <FileText size={14} />
              Generate ATR
            </button>
            <button
              onClick={() => addToast({ type: 'info', message: 'Activity log coming soon for bulk audit.' })}
              title="View this report's activity log"
              aria-label="View report activity log"
              className="w-9 h-9 rounded-[8px] flex items-center justify-center text-white/85 bg-white/10 border border-white/25 hover:bg-white/20 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <History size={16} />
            </button>
            <button
              onClick={() => addToast({ type: 'success', message: 'Generating report summary…' })}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-semibold text-brand-700 bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Sparkles size={13} />
              Generate Summary
            </button>
          </>
        }
      >
        {report.pages != null && (
          <p className="text-[13px] leading-snug text-white/75 mb-3">
            {totals.workflows} {totals.workflows === 1 ? 'workflow' : 'workflows'} · {totals.records} flagged records
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
          <span className="font-semibold text-white">{report.generatedBy}</span>
          <span className="text-white/30 mx-0.5">|</span>
          <span className="text-white/70">{report.generatedAt}</span>
          <span className="text-white/30 mx-0.5">|</span>
          <span className="text-white/70">
            {totals.workflows} {totals.workflows === 1 ? 'workflow' : 'workflows'}
          </span>
          {report.tag && (
            <span className="inline-flex items-center gap-1 px-2 h-5 ml-1 text-[10px] font-semibold whitespace-nowrap rounded-full bg-white/15 text-white border border-white/25">
              {report.tag}
            </span>
          )}
        </div>
      </ReportBrandBanner>

      {/* Metadata — structured report-facts panel, attached below the banner */}
      <div className="bg-white border-x border-b border-canvas-border px-9 py-6">
        <ReportMetaPanel
          items={[
            { label: 'Report ID', value: report.id?.toUpperCase() },
            { label: 'Report Type', value: report.tag ?? 'Bulk Audit' },
            { label: 'Scope', value: `${totals.workflows} ${totals.workflows === 1 ? 'workflow' : 'workflows'}` },
            { label: 'Prepared By', value: report.generatedBy },
            { label: 'Generated On', value: report.generatedAt },
            { label: 'Flagged Records', value: String(totals.records) },
          ]}
        />
      </div>

      {/* Editorial body — white card attached to the header (no gap) */}
      <article className="bg-white border-x border-b border-canvas-border rounded-b-[12px] px-8 py-8">
        <EditorialContents
          workflows={workflows}
          observations={observations}
          onAddObservation={onAddObservation}
          onReorderWorkflows={onReorderWorkflows}
          onRequestDeleteWorkflow={onRequestDelete}
          onReorderObservations={onReorderObservations}
          onEditObservation={onEditObservation}
          onDeleteObservation={onDeleteObservation}
          contentsEditingId={contentsEditingId}
          contentsDraft={contentsDraft}
          onDraftChange={onDraftChange}
          onStartContentsRename={onStartContentsRename}
          onSaveContentsRename={onSaveContentsRename}
          onCancelContentsRename={onCancelContentsRename}
          onScrollToContent={onScrollToContent}
        />

        <hr className="my-10 border-0 border-t border-ink-900/15" />

        <div id="bulk-exec-summary" className="scroll-mt-6">
          <EditorialSummary totals={totals} />
        </div>

        <hr className="my-10 border-0 border-t border-ink-900/15" />

        <div id="bulk-workflow-status" className="scroll-mt-6">
          <EditorialWorkflowStatus workflows={workflows} failedWorkflows={failedWorkflows} auditDate={report.generatedAt} />
        </div>

        <hr className="mt-10 mb-4 border-0 border-t border-ink-900/15" />

        {workflows.map((w, i) => (
          <EditorialChapter
            key={w.id}
            workflow={w}
            index={i}
            isLast={i === workflows.length - 1}
            onOpenWorkflow={() => onOpenWorkflow(w)}
            onRequestDelete={() => onRequestDelete(w)}
          />
        ))}

        {/* Observations — added at report level via the "Add Observation" button. */}
        {observations.length > 0 && (
          <>
            <hr className="mt-10 mb-4 border-0 border-t border-ink-900/15" />
            <div className="space-y-0">
              {observations.map((o, i) => (
                <div key={o.id} id={`bulk-observation-${o.id}`} className="scroll-mt-6">
                  <ObservationCard
                    obs={o}
                    index={i}
                    onEdit={() => onEditObservation(o)}
                    onToggleAttachment={() => onToggleObservationAttachment(o.id)}
                    onDelete={() => onDeleteObservation(o)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}

// Pass criterion for the demo: a workflow "passes" only when its severity is
// Low (no significant issues). Medium / High count as Fail — flagged records
// require triage. Keeping it derivable from existing severity so we don't
// need a separate status field on WorkflowResult.
function workflowStatus(w: WorkflowResult): 'pass' | 'fail' {
  return w.severity === 'Low' ? 'pass' : 'fail';
}

// Read-only table of contents for the editorial bulk-audit report. Lists the
// report's sections and smooth-scrolls to each on click. Anchors live on
// #bulk-exec-summary, #bulk-workflow-status, and #workflow-chapter-${id}
// (the per-chapter anchor EditorialChapter already renders).
function EditorialContents({
  workflows,
  observations,
  onAddObservation,
  onReorderWorkflows,
  onRequestDeleteWorkflow,
  onReorderObservations,
  onEditObservation,
  onDeleteObservation,
  contentsEditingId,
  contentsDraft,
  onDraftChange,
  onStartContentsRename,
  onSaveContentsRename,
  onCancelContentsRename,
  onScrollToContent,
}: {
  workflows: WorkflowResult[];
  observations: ObservationCardData[];
  onAddObservation: () => void;
  onReorderWorkflows: (next: WorkflowResult[]) => void;
  onRequestDeleteWorkflow: (w: WorkflowResult) => void;
  onReorderObservations: (next: ObservationCardData[]) => void;
  onEditObservation: (obs: ObservationCardData) => void;
  onDeleteObservation: (obs: ObservationCardData) => void;
  contentsEditingId: string | null;
  contentsDraft: string;
  onDraftChange: (v: string) => void;
  onStartContentsRename: (id: string, current: string) => void;
  onSaveContentsRename: () => void;
  onCancelContentsRename: () => void;
  onScrollToContent: (id: string) => void;
}) {
  // Pinned rows above the reorderable groups. Derived from workflow data so
  // they don't get drag/edit/delete chrome — same as IA reports treat their
  // cover/summary pins.
  const fixedRows: { id: string; label: string; anchor: string }[] = [
    { id: 'fixed-exec-summary', label: 'Executive Summary', anchor: 'bulk-exec-summary' },
    ...(workflows.length > 0
      ? [{ id: 'fixed-workflow-status', label: 'Workflow Status', anchor: 'bulk-workflow-status' }]
      : []),
  ];

  let runningIndex = 0;
  const fixedStart = runningIndex; runningIndex += fixedRows.length;
  const workflowsStart = runningIndex; runningIndex += workflows.length;
  const observationsStart = runningIndex;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <List size={16} className="text-brand-600" />
          <h3 className="text-[15px] leading-[20px] font-bold text-ink-800">Contents</h3>
        </div>
        <button
          onClick={onAddObservation}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-brand-600 bg-brand-50 border border-brand-600/15 rounded-[8px] hover:bg-brand-50/70 hover:border-brand-600/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
        >
          <Plus size={14} />
          Add Observation
        </button>
      </div>

      {/* Fixed header rows — Exec Summary, Workflow Status */}
      <ol className="list-none p-0 m-0 space-y-0.5">
        {fixedRows.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onScrollToContent(r.anchor)}
              className="flex items-center gap-2 w-full py-2.5 pl-1 pr-1 rounded-[8px] hover:bg-brand-50/30 transition-colors text-left cursor-pointer"
            >
              <span className="shrink-0 w-6 text-[10px] text-ink-400/70 font-mono tabular-nums text-right">{String(fixedStart + i + 1).padStart(2, '0')}</span>
              <span className="flex-1 min-w-0 text-[12px] text-ink-500 truncate">{r.label}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Workflow chapters — reorderable, inline rename, delete */}
      {workflows.length > 0 && (
        <Reorder.Group
          axis="y"
          values={workflows}
          onReorder={onReorderWorkflows}
          as="ol"
          className="list-none p-0 m-0 space-y-0.5"
        >
          {workflows.map((w, i) => (
            <BulkContentsRow
              key={w.id}
              value={w}
              displayId={workflowsStart + i + 1}
              label={`${w.workflowId} · ${w.name}`}
              isEditing={contentsEditingId === w.id}
              draftValue={contentsDraft}
              onDraftChange={onDraftChange}
              onStartEdit={() => onStartContentsRename(w.id, w.name)}
              onSaveEdit={onSaveContentsRename}
              onCancelEdit={onCancelContentsRename}
              onScroll={() => onScrollToContent(`workflow-chapter-${w.id}`)}
              onDelete={() => onRequestDeleteWorkflow(w)}
            />
          ))}
        </Reorder.Group>
      )}

      {/* Observations — reorderable, inline rename (modal also available via Edit button), delete */}
      {observations.length > 0 && (
        <Reorder.Group
          axis="y"
          values={observations}
          onReorder={onReorderObservations}
          as="ol"
          className="list-none p-0 m-0 space-y-0.5"
        >
          {observations.map((o, i) => (
            <BulkContentsRow
              key={o.id}
              value={o}
              displayId={observationsStart + i + 1}
              label={`${o.obsId} · ${o.title}`}
              isEditing={contentsEditingId === o.id}
              draftValue={contentsDraft}
              onDraftChange={onDraftChange}
              onStartEdit={() => onEditObservation(o)}
              onSaveEdit={onSaveContentsRename}
              onCancelEdit={onCancelContentsRename}
              onScroll={() => onScrollToContent(`bulk-observation-${o.id}`)}
              onDelete={() => onDeleteObservation(o)}
            />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}

// Reorderable contents row with drag handle, inline rename (active when
// `isEditing`), and hover-revealed edit + delete actions. Generic over the
// item type so workflows and observations share the same chrome.
function BulkContentsRow<T extends { id: string }>({
  value,
  displayId,
  label,
  isEditing,
  draftValue,
  onDraftChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onScroll,
  onDelete,
}: {
  value: T;
  displayId: number;
  label: string;
  isEditing: boolean;
  draftValue: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onScroll: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={value}
      dragControls={controls}
      dragListener={false}
      className="group/crow relative flex items-center gap-2 py-2.5 pl-1 pr-1 rounded-[8px] hover:bg-brand-50/30 transition-colors list-none cursor-default"
    >
      <button
        onPointerDown={(e) => { controls.start(e); }}
        aria-label="Drag to reorder"
        className="shrink-0 p-1 text-ink-400/40 hover:text-ink-400 cursor-grab active:cursor-grabbing opacity-20 group-hover/crow:opacity-100 transition-opacity touch-none"
      >
        <GripVertical size={14} />
      </button>
      <span className="shrink-0 w-6 text-[10px] text-ink-400/70 font-mono tabular-nums text-right">{String(displayId).padStart(2, '0')}</span>
      {isEditing ? (
        <input
          value={draftValue}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onSaveEdit(); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-white border border-brand-600/40 rounded-[8px] px-2 py-1 text-[12px] text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
        />
      ) : (
        <button
          onClick={onScroll}
          className="flex-1 min-w-0 text-left text-[12px] text-ink-500 truncate transition-colors cursor-pointer"
        >
          {label}
        </button>
      )}
      {!isEditing && (
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/crow:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            aria-label="Edit"
            className="p-1.5 rounded-[8px] text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete"
            className="p-1.5 rounded-[8px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </Reorder.Item>
  );
}

// The four exec-summary stats for a bulk audit — shared by the on-screen KPI
// tiles and the export composers.
function bulkSummaryStats(totals: Totals) {
  return [
    { label: 'Workflows Run', value: String(totals.workflows), icon: Layers, color: 'text-brand-700 bg-brand-50' },
    { label: 'Records Flagged', value: String(totals.records), icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
    { label: 'High Severity', value: String(totals.high), icon: Shield, color: 'text-risk-700 bg-risk-50' },
    { label: 'Medium Severity', value: String(totals.medium), icon: TrendingUp, color: 'text-mitigated-700 bg-mitigated-50' },
  ];
}

function EditorialSummary({ totals }: { totals: Totals }) {
  return (
    <div>
      <ReportNumberedHeading n={1} title="Executive Summary" subtitle="Overall workflow result rollup" />
      <div className="pb-5 border-b border-ink-900/15 mb-5">
        <ReportKpiTiles stats={bulkSummaryStats(totals)} animate />
      </div>
      <p className="text-[15px] leading-[1.75] text-ink-800">
        This audit returned <strong className="font-semibold text-ink-900">{totals.records} flagged records</strong> across{' '}
        <strong className="font-semibold text-ink-900">{totals.workflows} {totals.workflows === 1 ? 'workflow' : 'workflows'}</strong>.
        High-severity items should be triaged first; the remainder are queued for AP review.
      </p>
    </div>
  );
}

function resultSummary(w: WorkflowResult): string {
  const records = w.outputTable?.rows.length ?? 0;
  if (workflowStatus(w) === 'pass') {
    return records === 0 ? 'Ran clean. 0 records returned.' : `${records} ${records === 1 ? 'record' : 'records'} returned. No severity above Low.`;
  }
  if (w.severity === 'High') {
    return `${records} ${records === 1 ? 'record' : 'records'} flagged. Triage required.`;
  }
  return `${records} ${records === 1 ? 'record' : 'records'} flagged for review.`;
}

function scrollToWorkflow(id: string) {
  const el = document.getElementById(`workflow-chapter-${id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function EditorialWorkflowStatus({ workflows, failedWorkflows, auditDate }: {
  workflows: WorkflowResult[];
  failedWorkflows: WorkflowResult[];
  auditDate: string;
}) {
  // All workflows attempted in this bulk audit — successful first, failed last.
  // Successful rows scroll to their chapter; failed rows have no chapter and
  // render as plain text with a "failed (reason)" status.
  const allRows = [...workflows, ...failedWorkflows];
  if (allRows.length === 0) return null;
  return (
    <div>
      <ReportNumberedHeading n={2} title="Workflow Status" subtitle="All runs attempted in this audit" />
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Workflow ID</th>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Workflow Name</th>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Result / Summary</th>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Status</th>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Audit Date</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map(w => {
            const isFailed = w.runStatus === 'failed';
            return (
              <tr key={w.id} className="border-b border-ink-900/10">
                <td className="py-3 align-baseline font-bold text-brand-600 uppercase tracking-wider text-[11px]">
                  {w.workflowId}
                </td>
                <td className="py-3 align-baseline">
                  {isFailed ? (
                    <span className="text-[13px] font-semibold text-ink-800">{w.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => scrollToWorkflow(w.id)}
                      className="text-left text-[13px] font-semibold text-ink-800 hover:text-brand-600 transition-colors cursor-pointer"
                    >
                      {w.name}
                    </button>
                  )}
                </td>
                <td className="py-3 align-baseline text-[13px] text-ink-800">
                  {isFailed
                    ? <span className="text-ink-400">Run failed — no result.</span>
                    : resultSummary(w)}
                </td>
                <td className="py-3 align-baseline">
                  {isFailed ? (
                    <span className="font-semibold text-risk-700">failed ({w.failureReason ?? 'errored'})</span>
                  ) : (
                    <span className="font-semibold text-compliant-700">completed</span>
                  )}
                </td>
                <td className="py-3 align-baseline text-[13px] text-ink-800 tabular-nums">
                  {auditDate}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditorialChapter({ workflow, isLast, onOpenWorkflow, onRequestDelete }: {
  workflow: WorkflowResult;
  index: number;
  isLast: boolean;
  onOpenWorkflow: () => void;
  onRequestDelete: () => void;
}) {
  const sevDot = workflow.severity === 'High' ? 'bg-risk-500' : workflow.severity === 'Medium' ? 'bg-mitigated-500' : 'bg-compliant-500';
  const sevText = workflow.severity === 'High' ? 'text-risk-700' : workflow.severity === 'Medium' ? 'text-mitigated-700' : 'text-compliant-700';
  const [menuOpen, setMenuOpen] = useState(false);
  const [outputModalOpen, setOutputModalOpen] = useState(false);
  const [attached, setAttached] = useState<AttachedOutput[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleAttachOutputs = (next: AttachedOutput[]) => {
    setAttached(prev => {
      const map = new Map<string, AttachedOutput>(prev.map(o => [`${o.kind}:${o.id}`, o]));
      next.forEach(o => map.set(`${o.kind}:${o.id}`, o));
      return Array.from(map.values());
    });
    setOutputModalOpen(false);
  };
  const removeAttached = (item: AttachedOutput) => {
    setAttached(prev => prev.filter(o => !(o.kind === item.kind && o.id === item.id)));
  };

  return (
    <section id={`workflow-chapter-${workflow.id}`} className="mt-4 scroll-mt-6">
      {/* Meta row — fonts/treatment mirror QueryCard */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 text-[11px] min-w-0">
          <span className="font-bold text-brand-600 uppercase tracking-wider shrink-0">Workflow · {workflow.workflowId}</span>
          {workflow.businessProcess && (
            <>
              <span className="w-px h-3 bg-border-light shrink-0" />
              <span className="font-medium text-ink-400 uppercase tracking-wider shrink-0">{workflow.businessProcess}</span>
            </>
          )}
          <span className="w-px h-3 bg-border-light shrink-0" />
          <span className="flex items-center gap-1.5 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${sevDot}`} />
            <span className={`font-semibold uppercase tracking-wider ${sevText}`}>{workflow.severity}</span>
          </span>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            title="More options"
            aria-label="More options"
            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-[200px] bg-white border border-canvas-border rounded-[8px] shadow-xl py-1">
              <button
                onClick={() => { setMenuOpen(false); onOpenWorkflow(); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
              >
                <ExternalLink size={14} />
                Open workflow
              </button>
              <button
                onClick={() => { setMenuOpen(false); setOutputModalOpen(true); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
              >
                <Plus size={14} />
                Add output
              </button>
              <div className="my-1 border-t border-canvas-border/60" />
              <button
                onClick={() => { setMenuOpen(false); onRequestDelete(); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-risk-700 hover:bg-risk-50 cursor-pointer"
              >
                <Trash2 size={14} />
                Delete workflow
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title — same as QueryCard h3 */}
      <h2 className="text-[15px] font-semibold text-ink-800 leading-[1.5] mb-3">
        {workflow.name}
      </h2>

      {workflow.riskOwner && (
        <p className="text-[12px] text-ink-400 mb-5">
          Risk owner · <span className="text-ink-800 font-medium">{workflow.riskOwner}</span>
        </p>
      )}

      {/* Output table — sits above findings/observations now */}
      {workflow.outputTable && workflow.outputTable.rows.length > 0 && (
        <div className="mt-5 mb-6">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {workflow.outputTable.columns.map((col, ci) => (
                  <th
                    key={col}
                    className={`text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 ${ci === workflow.outputTable!.columns.length - 1 ? 'text-right' : 'text-left'}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workflow.outputTable.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-ink-900/10">
                  {row.map((cell, ci) => {
                    const cellStr = String(cell);
                    const isSeverity = cellStr === 'High' || cellStr === 'Medium' || cellStr === 'Low';
                    const isLast = ci === row.length - 1;
                    return (
                      <td
                        key={ci}
                        className={`py-3 align-baseline text-[13px] text-ink-800 ${isLast ? 'text-right' : ''}`}
                      >
                        {isSeverity ? <SeverityWord severity={cellStr as 'High' | 'Medium' | 'Low'} /> : cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Findings */}
      <div className="mb-6">
        <h4 className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-3">Findings</h4>
        {workflow.findings.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No findings"
            body="This workflow ran clean — no exceptions to record."
            size="compact"
          />
        ) : (
          <ul className="space-y-2.5">
            {workflow.findings.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] text-ink-800 leading-relaxed">
                <div className="w-1 h-1 rounded-full mt-2 shrink-0 bg-brand-600/60" />
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Observations */}
      <div className="mb-6">
        <h4 className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-3">Observations</h4>
        {workflow.observations.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title="No observations"
            body="Add an observation if there's something the team should know about this workflow."
            size="compact"
          />
        ) : (
          <ul className="space-y-2.5">
            {workflow.observations.map((o, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] text-ink-800 leading-relaxed">
                <div className="w-1 h-1 rounded-full mt-2 shrink-0 bg-brand-600/60" />
                {o}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Attached outputs (KPIs / Graphs / Tables added via "Add output") */}
      {attached.length > 0 && (
        <AttachedOutputsBlock workflow={workflow} attached={attached} onRemove={removeAttached} />
      )}

      {!isLast && <hr className="mt-10 border-0 border-t border-ink-900/15" />}

      {outputModalOpen && createPortal(
        <AddOutputModal
          workflow={workflow}
          attached={attached}
          onClose={() => setOutputModalOpen(false)}
          onAttach={handleAttachOutputs}
        />,
        document.body,
      )}
    </section>
  );
}

function AttachedOutputsBlock({
  workflow,
  attached,
  onRemove,
}: {
  workflow: WorkflowResult;
  attached: AttachedOutput[];
  onRemove: (item: AttachedOutput) => void;
}) {
  const kpis = attached.filter(a => a.kind === 'kpi');
  const graphs = attached.filter(a => a.kind === 'graph');
  const tables = attached.filter(a => a.kind === 'table');

  // Defensive empty state — if a query had outputs requested but everything
  // was removed, surface that instead of an empty rail of nothing.
  if (kpis.length === 0 && graphs.length === 0 && tables.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={BarChart3}
          title="No insights yet for this query."
          body="Add a KPI, graph, or table to surface what this run found."
          size="compact"
        />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {kpis.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {kpis.map(k => {
            const kpi = KPI_CATALOG.find(c => c.id === k.id);
            if (!kpi) return null;
            const Icon = kpi.icon;
            return (
              <div
                key={k.id}
                className="group relative bg-white border border-canvas-border rounded-[12px] p-3.5 flex items-center gap-3"
              >
                <div className={`p-2 rounded-[8px] ${kpi.color}`}><Icon size={16} /></div>
                <div className="min-w-0">
                  <div className="text-[18px] font-bold text-ink-800 leading-tight tabular-nums">{kpi.compute(workflow)}</div>
                  <div className="text-[10px] text-ink-400 tracking-wide truncate">{kpi.label}</div>
                </div>
                <button
                  onClick={() => onRemove(k)}
                  aria-label="Remove KPI"
                  className="absolute top-1.5 right-1.5 w-5 h-5 inline-flex items-center justify-center rounded-[8px] text-ink-400 opacity-0 group-hover:opacity-100 hover:text-risk-700 hover:bg-risk-50 transition-all cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {graphs.map(g => {
        const graph = GRAPH_CATALOG.find(c => c.id === g.id);
        if (!graph) return null;
        return (
          <div key={g.id} className="group relative bg-canvas-elevated border border-canvas-border rounded-[12px] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                <BarChart3 size={12} />
                {graph.title}
              </div>
              <button
                onClick={() => onRemove(g)}
                aria-label="Remove graph"
                className="w-6 h-6 inline-flex items-center justify-center rounded-[8px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="h-[200px]">
              <ConfigurableChart
                type={graph.chartType}
                xAxis={graph.xAxis}
                yAxis={graph.yAxis}
                color={graph.color}
                showTarget={false}
                showLegend
              />
            </div>
          </div>
        );
      })}

      {tables.map(t => {
        const table = TABLE_CATALOG.find(c => c.id === t.id);
        if (!table) return null;
        return (
          <div key={t.id} className="group relative">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">{table.title}</h4>
              <button
                onClick={() => onRemove(t)}
                aria-label="Remove table"
                className="w-6 h-6 inline-flex items-center justify-center rounded-[8px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <DerivedTable workflow={workflow} variant={t.id} />
          </div>
        );
      })}
    </div>
  );
}

// Computed alternate views over the same output rows — vendor totals or
// severity-split summary.
function DerivedTable({ workflow, variant }: { workflow: WorkflowResult; variant: string }) {
  const rows = workflow.outputTable?.rows ?? [];
  if (variant === 'table-vendor-summary') {
    const totals = new Map<string, { count: number; amount: number }>();
    rows.forEach(r => {
      const vendor = String(r[1] ?? '');
      const amt = parseInt(String(r[3] ?? '').replace(/[^\d]/g, ''), 10) || 0;
      const cur = totals.get(vendor) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += amt;
      totals.set(vendor, cur);
    });
    return (
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Vendor</th>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-right">Records</th>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-right">Total amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(totals.entries()).map(([vendor, v]) => (
            <tr key={vendor} className="border-b border-ink-900/10">
              <td className="py-3 text-ink-800">{vendor}</td>
              <td className="py-3 text-right text-ink-800 tabular-nums">{v.count}</td>
              <td className="py-3 text-right text-ink-800 tabular-nums">₹{v.amount.toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (variant === 'table-severity-split') {
    const split: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    rows.forEach(r => {
      const sev = String(r[2] ?? '');
      if (sev in split) split[sev] += 1;
    });
    return (
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Severity</th>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-right">Records</th>
            <th className="text-[10px] font-bold text-ink-500 uppercase tracking-wider pb-2 border-b border-ink-900/30 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {(['High', 'Medium', 'Low'] as const).map(sev => {
            const count = split[sev];
            const pct = rows.length > 0 ? Math.round((count * 100) / rows.length) : 0;
            return (
              <tr key={sev} className="border-b border-ink-900/10">
                <td className="py-3"><SeverityWord severity={sev} /></td>
                <td className="py-3 text-right text-ink-800 tabular-nums">{count}</td>
                <td className="py-3 text-right text-ink-800 tabular-nums">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  return null;
}

function AddOutputModal({
  workflow,
  attached,
  onClose,
  onAttach,
}: {
  workflow: WorkflowResult;
  attached: AttachedOutput[];
  onClose: () => void;
  onAttach: (items: AttachedOutput[]) => void;
}) {
  const [tab, setTab] = useState<'kpi' | 'graph' | 'table'>('kpi');
  const [selection, setSelection] = useState<Set<string>>(() => new Set(attached.map(a => `${a.kind}:${a.id}`)));
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toggle = (kind: AttachedOutput['kind'], id: string) => {
    const key = `${kind}:${id}`;
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const isPicked = (kind: AttachedOutput['kind'], id: string) => selection.has(`${kind}:${id}`);

  const handleAttach = () => {
    const items: AttachedOutput[] = Array.from(selection).map(key => {
      const [kind, ...rest] = key.split(':');
      return { kind: kind as AttachedOutput['kind'], id: rest.join(':') };
    });
    onAttach(items);
  };

  const tabs: { id: 'kpi' | 'graph' | 'table'; label: string; count: number }[] = [
    { id: 'kpi',   label: 'KPI',    count: KPI_CATALOG.length },
    { id: 'graph', label: 'Graph',  count: GRAPH_CATALOG.length },
    { id: 'table', label: 'Table',  count: TABLE_CATALOG.length },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-ink-900/40 backdrop-blur-[2px] flex items-center justify-center p-6"
      >
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-output-title"
          tabIndex={-1}
          className="w-full max-w-[840px] max-h-[calc(100vh-48px)] bg-white border border-canvas-border rounded-[16px] shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-canvas-border">
            <div>
              <h3 id="add-output-title" className="text-[16px] font-bold text-ink-800 tracking-tight">Add output to report</h3>
              <p className="text-[12px] text-ink-500 mt-1">
                <span className="font-bold text-brand-600 uppercase tracking-wider text-[11px]">Workflow · {workflow.workflowId}</span>
                <span className="mx-1.5 text-ink-400">·</span>
                {workflow.name}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 inline-flex items-center justify-center rounded-[8px] text-ink-400 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-canvas-border">
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative pb-3 pt-1 px-2 mr-2 text-[13px] font-semibold transition-colors cursor-pointer ${active ? 'text-brand-600' : 'text-ink-400 hover:text-ink-800'}`}
                >
                  <span>{t.label}</span>
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold tabular-nums ${active ? 'bg-brand-600/10 text-brand-600' : 'bg-paper-50 text-ink-400'}`}>
                    {t.count}
                  </span>
                  {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
                </button>
              );
            })}
          </div>

          {/* Tab body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'kpi' && (
              <div className="grid grid-cols-2 gap-3">
                {KPI_CATALOG.map(kpi => {
                  const picked = isPicked('kpi', kpi.id);
                  const Icon = kpi.icon;
                  return (
                    <button
                      key={kpi.id}
                      onClick={() => toggle('kpi', kpi.id)}
                      className={`text-left bg-white border-2 rounded-[12px] p-3.5 transition-all cursor-pointer focus:outline-none ${picked ? 'border-brand-600 shadow-[0_0_0_3px_rgba(106,18,205,0.12)]' : 'border-canvas-border hover:border-brand-600/40'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${picked ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-canvas-border text-transparent'}`}>
                          <Check size={12} />
                        </span>
                        <div className={`p-2 rounded-[8px] ${kpi.color}`}><Icon size={16} /></div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-ink-800">{kpi.label}</div>
                          <div className="text-[11px] text-ink-400">Current value · <span className="text-ink-800 tabular-nums font-medium">{kpi.compute(workflow)}</span></div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {tab === 'graph' && (
              <div className="grid grid-cols-2 gap-3">
                {GRAPH_CATALOG.map(g => {
                  const picked = isPicked('graph', g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggle('graph', g.id)}
                      className={`text-left bg-white border-2 rounded-[12px] p-3 transition-all cursor-pointer focus:outline-none ${picked ? 'border-brand-600 shadow-[0_0_0_3px_rgba(106,18,205,0.12)]' : 'border-canvas-border hover:border-brand-600/40'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${picked ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-canvas-border text-transparent'}`}>
                          <Check size={12} />
                        </span>
                        <span className="text-[12px] font-semibold text-ink-800">{g.title}</span>
                      </div>
                      <div className="h-[160px] bg-canvas-elevated rounded-[12px] p-1.5 pointer-events-none">
                        <ConfigurableChart
                          type={g.chartType}
                          xAxis={g.xAxis}
                          yAxis={g.yAxis}
                          color={g.color}
                          showTarget={false}
                          showLegend={false}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {tab === 'table' && (
              <div className="grid grid-cols-1 gap-3">
                {TABLE_CATALOG.map(t => {
                  const picked = isPicked('table', t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle('table', t.id)}
                      className={`text-left bg-white border-2 rounded-[12px] p-4 transition-all cursor-pointer focus:outline-none ${picked ? 'border-brand-600 shadow-[0_0_0_3px_rgba(106,18,205,0.12)]' : 'border-canvas-border hover:border-brand-600/40'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${picked ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-canvas-border text-transparent'}`}>
                          <Check size={12} />
                        </span>
                        <div className="p-2 rounded-[8px] text-ink-500 bg-paper-50"><TableIcon size={16} /></div>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-ink-800">{t.title}</div>
                          <div className="text-[11px] text-ink-500 mt-0.5">{t.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-canvas-border bg-paper-50/40">
            <span className="text-[12px] text-ink-400">
              {selection.size === 0 ? 'Nothing selected' : `${selection.size} selected`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-ink-800 bg-white border border-canvas-border rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAttach}
                disabled={selection.size === 0}
                className={`inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${selection.size === 0 ? 'bg-brand-600/40 text-white/85 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}
              >
                Add to report
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SeverityWord({ severity }: { severity: 'High' | 'Medium' | 'Low' }) {
  const color = severity === 'High' ? 'text-risk-700' : severity === 'Medium' ? 'text-mitigated-700' : 'text-compliant-700';
  return <span className={`font-semibold ${color}`}>{severity.toLowerCase()}</span>;
}
