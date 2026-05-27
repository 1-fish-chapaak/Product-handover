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
import { ArrowLeft, Download, History, Sparkles, MoreVertical, ExternalLink, Trash2, Plus, X, BarChart3, Table as TableIcon, AlertTriangle, CheckCircle2, Check, TrendingUp, Shield, Layers, List, FileText, Lightbulb, BookOpen, Share2, ChevronDown, Layout, Loader2, GripVertical, Edit3, StickyNote } from 'lucide-react';
import FloatingLines from '../shared/FloatingLines';
import { useToast, type ToastType } from '../shared/Toast';
import EmptyState from '../shared/EmptyState';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { KpiCountUp } from '../shared/KpiTile';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import { REPORT_TEMPLATES } from '../../data/mockData';
import type { WorkflowResult } from './ReportsView';
import AddObservationModal, {
  computeNextObservationId,
  type EditingObservationInput,
  type ObservationAttachment,
} from './AddObservationModal';
import ObservationCard, { type ObservationCardData } from './ObservationCard';

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
  aestheticVariant?: 'editorial' | 'forensic' | 'minimal' | 'architectural';
};

export function BulkAuditVariantView({
  report,
  onBack,
  onShare,
}: {
  report: Report;
  onBack: () => void;
  onShare?: () => void;
}) {
  const variant = report.aestheticVariant ?? 'editorial';
  const { addToast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowResult[]>(report.workflowResults ?? []);
  const [pendingDelete, setPendingDelete] = useState<WorkflowResult | null>(null);

  // ─── Report-level observations (parity with Internal Audit reports) ───
  const [observations, setObservations] = useState<ObservationCardData[]>([]);
  const [showAddObservation, setShowAddObservation] = useState(false);
  const [editingObservation, setEditingObservation] = useState<EditingObservationInput | null>(null);
  const [pendingDeleteObs, setPendingDeleteObs] = useState<ObservationCardData | null>(null);

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
      className={`h-full overflow-y-auto ${backgroundClass(variant)}`}
    >
      <BulkReportHeader onBack={onBack} onShare={onShare} reportName={report.name} variant={variant} />
      {allFailed ? (
        <AllFailedEmpty report={report} failedWorkflows={failedWorkflows} />
      ) : (
        <>
          {variant === 'editorial' && (
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
            />
          )}
          {variant === 'forensic' && <ForensicLayout report={report} workflows={successfulWorkflows} totals={totals} />}
          {variant === 'minimal' && <MinimalLayout report={report} workflows={successfulWorkflows} totals={totals} />}
          {variant === 'architectural' && <ArchitecturalLayout report={report} workflows={successfulWorkflows} totals={totals} />}
        </>
      )}

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
        className="fixed inset-0 z-[1050] bg-ink-900/55 backdrop-blur-[2px] flex items-center justify-center p-6"
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
          className="w-full max-w-[420px] bg-white border border-border-light rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 pt-6 pb-5">
            <h3 id="delete-obs-title" className="text-[15px] font-semibold text-text mb-2">Remove observation?</h3>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              <span className="font-semibold text-text">{obsId}</span> · {title} will be removed from this report.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-white bg-risk-600 hover:bg-risk-700 rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
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
        className="fixed inset-0 z-[1050] bg-ink-900/55 backdrop-blur-[2px] flex items-center justify-center p-6"
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
          className="w-full max-w-[420px] bg-white border border-border-light rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 pt-6 pb-5">
            <h3 id="delete-wf-title" className="text-[15px] font-semibold text-text mb-2">Remove workflow from this report?</h3>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              <span className="font-semibold text-text">{workflow.workflowId}</span> · {workflow.name} will be removed from the report.
              The underlying workflow definition is not affected.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-white bg-risk-600 hover:bg-risk-700 rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
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

function backgroundClass(variant: NonNullable<Report['aestheticVariant']>) {
  switch (variant) {
    case 'editorial': return 'bg-surface-2';
    case 'forensic': return 'bg-white';
    case 'minimal': return 'bg-white';
    case 'architectural': return 'bg-paper-50';
  }
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

// Simulated report download — a 'loading' toast that resolves to 'success'
// after a short "preparing" delay. No real file is produced (the prototype's
// report exports are all mock).
function startReportDownload(
  addToast: (t: { type: ToastType; message: string }) => string,
  updateToast: (id: string, patch: { type: ToastType; message: string }) => void,
  reportName: string,
  ext = 'pdf',
) {
  const file = `${reportName}.${ext}`;
  const id = addToast({ type: 'loading', message: `Preparing ${file}…` });
  window.setTimeout(() => {
    updateToast(id, { type: 'success', message: `${file} downloaded.` });
  }, 1800);
}

// ─── Apply Template Dropdown ───
function ApplyTemplateDropdown({ onSelect, onClose }: { onSelect: (template: typeof REPORT_TEMPLATES[0]) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.97 }}
      className="absolute right-0 top-full mt-1 w-[280px] bg-white rounded-xl shadow-xl border border-border-light z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border-light">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Select Template</span>
      </div>
      <div className="max-h-[260px] overflow-y-auto p-1.5">
        {REPORT_TEMPLATES.map(rt => {
          const Icon = ICON_MAP[rt.icon] || FileText;
          return (
            <button
              key={rt.id}
              onClick={() => { onSelect(rt); onClose(); }}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary-xlight transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <div className={`p-1.5 rounded-md ${CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50'}`}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-text truncate">{rt.name}</div>
                <div className="text-[10px] text-text-muted">{rt.category}</div>
              </div>
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
function BulkReportHeader({ onBack, onShare, reportName, variant }: {
  onBack: () => void;
  onShare?: () => void;
  reportName: string;
  variant: NonNullable<Report['aestheticVariant']>;
}) {
  const { addToast, updateToast } = useToast();
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const isMono = variant === 'forensic';

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
      <div className={`mx-auto px-8 pt-6 pb-4 max-w-[1100px] ${isMono ? 'font-mono' : ''}`}>
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded"
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
                className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                style={{ borderRadius: '8px' }}
              >
                {applyingTemplate ? (
                  <Loader2 size={13} className="animate-spin text-primary" />
                ) : (
                  <Layout size={13} />
                )}
                <span className="truncate max-w-[220px]">
                  {applyingTemplate ? 'Applying…' : (appliedTemplate?.name ?? 'Apply Template')}
                </span>
                <motion.span
                  animate={{ rotate: showApplyTemplate ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex"
                >
                  <ChevronDown size={13} />
                </motion.span>
              </button>
              <AnimatePresence>
                {showApplyTemplate && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowApplyTemplate(false)} />
                    <ApplyTemplateDropdown
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
                className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                style={{ borderRadius: '8px' }}
              >
                <Share2 size={13} /> Share
              </button>
            )}
            {/* Download */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadDropdown(p => !p)}
                className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                style={{ borderRadius: '8px' }}
              >
                <Download size={13} /> Download <ChevronDown size={11} className={`transition-transform ${showDownloadDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showDownloadDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-border-light shadow-xl z-50 py-1 w-36" style={{ borderRadius: '8px' }}>
                  {[
                    { label: 'PDF', ext: 'pdf' },
                    { label: 'Word (DOC)', ext: 'doc' },
                    { label: 'PowerPoint', ext: 'ppt' },
                    { label: 'Excel', ext: 'xlsx' },
                  ].map(({ label, ext }) => (
                    <button
                      key={ext}
                      onClick={() => { startReportDownload(addToast, updateToast, reportName, ext); setShowDownloadDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-primary-xlight hover:text-primary transition-colors cursor-pointer"
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
              className="flex items-center gap-3 px-6 py-4 glass-card-strong rounded-2xl shadow-lg"
            >
              <Loader2 size={20} className="text-primary animate-spin" />
              <span className="text-[14px] font-semibold text-text">Applying template...</span>
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
    <div className="mx-auto px-8 pt-2 pb-24 max-w-[1100px]">
      {/* Cover — same purple gradient as the editorial layout, but slimmer */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]">
        <div className="relative z-10 px-8 py-7">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{report.name}</h1>
          <p className="text-white/65 text-[13px] leading-snug">
            All {failedWorkflows.length} {failedWorkflows.length === 1 ? 'workflow' : 'workflows'} failed during this run.
          </p>
        </div>
      </div>

      {/* Empty-state body */}
      <div className="bg-white border border-border-light rounded-2xl mt-5 p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={20} className="text-brand-700" />
        </div>
        <h2 className="text-[18px] font-bold text-text mb-2">Nothing to report on the audit itself</h2>
        <p className="text-[13.5px] text-text-secondary mb-6 max-w-[540px] mx-auto">
          None of the {failedWorkflows.length} workflows in this run produced results — the report has no audit content. The failed runs are listed below for reference.
        </p>
        <div className="text-left max-w-[640px] mx-auto rounded-xl border border-brand-200 bg-brand-50/40 px-5 py-4">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Failed runs</p>
          <ul className="space-y-1.5">
            {failedWorkflows.map(w => (
              <li key={w.id} className="text-[13px] text-text">
                <span className="font-medium text-ink-900">{w.name}</span>
                <span className="text-text-muted"> ({w.workflowId}, {w.failureReason ?? 'errored'})</span>
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
  contentsEditingId, contentsDraft, onDraftChange, onStartContentsRename, onSaveContentsRename, onCancelContentsRename, onScrollToContent,
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
}) {
  const { addToast } = useToast();
  return (
    <div className="mx-auto px-8 pt-2 pb-24 max-w-[1100px]">
      {/* Cover — rounded top only so the white body below attaches cleanly */}
      <div className="relative rounded-t-2xl overflow-hidden bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]">
        <div className="absolute inset-0 z-0" style={{ maskImage: 'linear-gradient(to right, transparent 35%, white 70%)', WebkitMaskImage: 'linear-gradient(to right, transparent 35%, white 70%)' }}>
          <FloatingLines
            enabledWaves={['top', 'middle']}
            lineCount={6}
            lineDistance={6}
            bendRadius={4}
            bendStrength={-0.3}
            interactive={true}
            parallax={false}
            color="#e879f9"
            opacity={0.3}
          />
        </div>
        <div className="relative z-10 px-8 py-7">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{report.name}</h1>
          {report.pages != null && (
            <p className="text-white/65 text-[13px] leading-snug mb-3">
              {totals.workflows} {totals.workflows === 1 ? 'workflow' : 'workflows'} · {totals.records} flagged records
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-white">{report.generatedBy}</span>
              <span className="text-white/30 mx-0.5">|</span>
              <span className="text-white/70">{report.generatedAt}</span>
              <span className="text-white/30 mx-0.5">|</span>
              <span className="text-white/70">
                {totals.workflows} {totals.workflows === 1 ? 'workflow' : 'workflows'}
              </span>
              {report.tag && (
                <span
                  className="inline-flex items-center px-2 h-5 ml-1 text-[10px] font-semibold whitespace-nowrap"
                  style={{
                    borderRadius: '8px',
                    background: report.tag === 'Internal Audit' ? '#FFE8F6' : '#FFFAEB',
                    color: report.tag === 'Internal Audit' ? '#BF2E84' : '#A74108',
                  }}
                >
                  {report.tag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => addToast({ type: 'info', message: 'Activity log coming soon for bulk audit.' })}
                title="View this report's activity log"
                aria-label="View report activity log"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
              >
                <History size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editorial body — white card attached to the header (no gap) */}
      <article className="bg-white border-x border-b border-border-light rounded-b-2xl px-8 py-8">
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
          <List size={16} className="text-primary" />
          <h3 className="text-[15px] leading-[20px] font-bold text-text">Contents</h3>
        </div>
        <button
          onClick={onAddObservation}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-primary bg-primary-xlight border border-primary/15 rounded-[8px] hover:bg-primary-xlight/70 hover:border-primary/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
        >
          <Plus size={13} />
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
              className="flex items-center gap-2 w-full py-2.5 pl-1 pr-1 rounded-lg hover:bg-primary-xlight/30 transition-colors text-left cursor-pointer"
            >
              <span className="shrink-0 w-6 text-[10.5px] text-text-muted/70 font-mono tabular-nums text-right">{String(fixedStart + i + 1).padStart(2, '0')}</span>
              <span className="flex-1 min-w-0 text-[12.5px] text-text-secondary truncate">{r.label}</span>
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
      className="group/crow relative flex items-center gap-2 py-2.5 pl-1 pr-1 rounded-lg hover:bg-primary-xlight/30 transition-colors list-none cursor-default"
    >
      <button
        onPointerDown={(e) => { controls.start(e); }}
        aria-label="Drag to reorder"
        className="shrink-0 p-1 text-text-muted/40 hover:text-text-muted cursor-grab active:cursor-grabbing opacity-20 group-hover/crow:opacity-100 transition-opacity touch-none"
      >
        <GripVertical size={13} />
      </button>
      <span className="shrink-0 w-6 text-[10.5px] text-text-muted/70 font-mono tabular-nums text-right">{String(displayId).padStart(2, '0')}</span>
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
          className="flex-1 min-w-0 bg-white border border-primary/40 rounded-md px-2 py-1 text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
      ) : (
        <button
          onClick={onScroll}
          className="flex-1 min-w-0 text-left text-[12.5px] text-text-secondary truncate transition-colors cursor-pointer"
        >
          {label}
        </button>
      )}
      {!isEditing && (
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/crow:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            aria-label="Edit"
            className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer"
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete"
            className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </Reorder.Item>
  );
}

function EditorialSummary({ totals }: { totals: Totals }) {
  const stats = [
    { label: 'Workflows Run', value: String(totals.workflows), icon: Layers, color: 'text-brand-700 bg-brand-50' },
    { label: 'Records Flagged', value: String(totals.records), icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-10 pb-5 border-b border-ink-900/15">
        {stats.map((stat, si) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18, mass: 0.7, delay: 0.08 + si * 0.08 }}
            className="flex items-center gap-3"
          >
            <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon size={16} /></div>
            <div>
              <div className="text-xl font-bold text-text leading-none mb-1">
                <KpiCountUp value={stat.value} delay={120 + si * 80} />
              </div>
              <div className="text-[11px] text-text-muted tracking-wide">{stat.label}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-[15.5px] leading-[1.75] text-text">
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
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Workflow ID</th>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Workflow Name</th>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Result / Summary</th>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Status</th>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Audit Date</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map(w => {
            const isFailed = w.runStatus === 'failed';
            return (
              <tr key={w.id} className="border-b border-ink-900/10">
                <td className="py-3 align-baseline font-bold text-primary uppercase tracking-wider text-[11px]">
                  {w.workflowId}
                </td>
                <td className="py-3 align-baseline">
                  {isFailed ? (
                    <span className="text-[13px] font-semibold text-text">{w.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => scrollToWorkflow(w.id)}
                      className="text-left text-[13px] font-semibold text-text hover:text-primary transition-colors cursor-pointer"
                    >
                      {w.name}
                    </button>
                  )}
                </td>
                <td className="py-3 align-baseline text-[13px] text-text">
                  {isFailed
                    ? <span className="text-text-muted">Run failed — no result.</span>
                    : resultSummary(w)}
                </td>
                <td className="py-3 align-baseline">
                  {isFailed ? (
                    <span className="font-semibold text-risk-700">failed ({w.failureReason ?? 'errored'})</span>
                  ) : (
                    <span className="font-semibold text-compliant-700">completed</span>
                  )}
                </td>
                <td className="py-3 align-baseline text-[13px] text-text tabular-nums">
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
  const sevDot = workflow.severity === 'High' ? 'bg-risk-500' : workflow.severity === 'Medium' ? 'bg-high-500' : 'bg-compliant-500';
  const sevText = workflow.severity === 'High' ? 'text-risk-700' : workflow.severity === 'Medium' ? 'text-high-700' : 'text-compliant-700';
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
          <span className="font-bold text-primary uppercase tracking-wider shrink-0">Workflow · {workflow.workflowId}</span>
          {workflow.businessProcess && (
            <>
              <span className="w-px h-3 bg-border-light shrink-0" />
              <span className="font-medium text-text-muted uppercase tracking-wider shrink-0">{workflow.businessProcess}</span>
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
            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-[200px] bg-white border border-border-light rounded-[10px] shadow-xl py-1">
              <button
                onClick={() => { setMenuOpen(false); onOpenWorkflow(); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
              >
                <ExternalLink size={13} />
                Open workflow
              </button>
              <button
                onClick={() => { setMenuOpen(false); setOutputModalOpen(true); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
              >
                <Plus size={13} />
                Add output
              </button>
              <div className="my-1 border-t border-border-light/60" />
              <button
                onClick={() => { setMenuOpen(false); onRequestDelete(); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-risk-700 hover:bg-risk-50 cursor-pointer"
              >
                <Trash2 size={13} />
                Delete workflow
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title — same as QueryCard h3 */}
      <h2 className="text-[15px] font-semibold text-text leading-[1.5] mb-3">
        {workflow.name}
      </h2>

      {workflow.riskOwner && (
        <p className="text-[12px] text-text-muted mb-5">
          Risk owner · <span className="text-text font-medium">{workflow.riskOwner}</span>
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
                    className={`text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 ${ci === workflow.outputTable!.columns.length - 1 ? 'text-right' : 'text-left'}`}
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
                        className={`py-3 align-baseline text-[13px] text-text ${isLast ? 'text-right' : ''}`}
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
        <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-3">Findings</h4>
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
              <li key={i} className="flex gap-2.5 text-[13px] text-text leading-relaxed">
                <div className="w-1 h-1 rounded-full mt-2 shrink-0 bg-primary/60" />
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Observations */}
      <div className="mb-6">
        <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-3">Observations</h4>
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
              <li key={i} className="flex gap-2.5 text-[13px] text-text leading-relaxed">
                <div className="w-1 h-1 rounded-full mt-2 shrink-0 bg-primary/60" />
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
                className="group relative bg-white border border-border-light rounded-xl p-3.5 flex items-center gap-3"
              >
                <div className={`p-2 rounded-lg ${kpi.color}`}><Icon size={15} /></div>
                <div className="min-w-0">
                  <div className="text-[18px] font-bold text-text leading-tight tabular-nums">{kpi.compute(workflow)}</div>
                  <div className="text-[10.5px] text-text-muted tracking-wide truncate">{kpi.label}</div>
                </div>
                <button
                  onClick={() => onRemove(k)}
                  aria-label="Remove KPI"
                  className="absolute top-1.5 right-1.5 w-5 h-5 inline-flex items-center justify-center rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-risk-700 hover:bg-risk-50 transition-all cursor-pointer"
                >
                  <X size={11} />
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
          <div key={g.id} className="group relative bg-canvas-elevated border border-border-light rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                <BarChart3 size={12} />
                {graph.title}
              </div>
              <button
                onClick={() => onRemove(g)}
                aria-label="Remove graph"
                className="w-6 h-6 inline-flex items-center justify-center rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={13} />
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
              <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{table.title}</h4>
              <button
                onClick={() => onRemove(t)}
                aria-label="Remove table"
                className="w-6 h-6 inline-flex items-center justify-center rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={13} />
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
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Vendor</th>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-right">Records</th>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-right">Total amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(totals.entries()).map(([vendor, v]) => (
            <tr key={vendor} className="border-b border-ink-900/10">
              <td className="py-3 text-text">{vendor}</td>
              <td className="py-3 text-right text-text tabular-nums">{v.count}</td>
              <td className="py-3 text-right text-text tabular-nums">₹{v.amount.toLocaleString('en-IN')}</td>
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
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-left">Severity</th>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-right">Records</th>
            <th className="text-[10.5px] font-bold text-text-secondary uppercase tracking-wider pb-2 border-b border-ink-900/30 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {(['High', 'Medium', 'Low'] as const).map(sev => {
            const count = split[sev];
            const pct = rows.length > 0 ? Math.round((count * 100) / rows.length) : 0;
            return (
              <tr key={sev} className="border-b border-ink-900/10">
                <td className="py-3"><SeverityWord severity={sev} /></td>
                <td className="py-3 text-right text-text tabular-nums">{count}</td>
                <td className="py-3 text-right text-text tabular-nums">{pct}%</td>
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
        className="fixed inset-0 z-[1050] bg-ink-900/55 backdrop-blur-[2px] flex items-center justify-center p-6"
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
          className="w-full max-w-[840px] max-h-[calc(100vh-48px)] bg-white border border-border-light rounded-[16px] shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border-light">
            <div>
              <h3 id="add-output-title" className="text-[16px] font-bold text-text tracking-tight">Add output to report</h3>
              <p className="text-[12.5px] text-text-secondary mt-1">
                <span className="font-bold text-primary uppercase tracking-wider text-[11px]">Workflow · {workflow.workflowId}</span>
                <span className="mx-1.5 text-text-muted">·</span>
                {workflow.name}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              <X size={17} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-border-light">
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative pb-3 pt-1 px-2 mr-2 text-[13px] font-semibold transition-colors cursor-pointer ${active ? 'text-primary' : 'text-text-muted hover:text-text'}`}
                >
                  <span>{t.label}</span>
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold tabular-nums ${active ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-text-muted'}`}>
                    {t.count}
                  </span>
                  {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />}
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
                      className={`text-left bg-white border-2 rounded-xl p-3.5 transition-all cursor-pointer focus:outline-none ${picked ? 'border-primary shadow-[0_0_0_3px_rgba(106,18,205,0.12)]' : 'border-border-light hover:border-primary/40'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${picked ? 'bg-primary border-primary text-white' : 'bg-white border-border-light text-transparent'}`}>
                          <Check size={11} />
                        </span>
                        <div className={`p-2 rounded-lg ${kpi.color}`}><Icon size={15} /></div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-text">{kpi.label}</div>
                          <div className="text-[11px] text-text-muted">Current value · <span className="text-text tabular-nums font-medium">{kpi.compute(workflow)}</span></div>
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
                      className={`text-left bg-white border-2 rounded-xl p-3 transition-all cursor-pointer focus:outline-none ${picked ? 'border-primary shadow-[0_0_0_3px_rgba(106,18,205,0.12)]' : 'border-border-light hover:border-primary/40'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${picked ? 'bg-primary border-primary text-white' : 'bg-white border-border-light text-transparent'}`}>
                          <Check size={11} />
                        </span>
                        <span className="text-[12.5px] font-semibold text-text">{g.title}</span>
                      </div>
                      <div className="h-[160px] bg-canvas-elevated rounded-lg p-1.5 pointer-events-none">
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
                      className={`text-left bg-white border-2 rounded-xl p-4 transition-all cursor-pointer focus:outline-none ${picked ? 'border-primary shadow-[0_0_0_3px_rgba(106,18,205,0.12)]' : 'border-border-light hover:border-primary/40'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${picked ? 'bg-primary border-primary text-white' : 'bg-white border-border-light text-transparent'}`}>
                          <Check size={11} />
                        </span>
                        <div className="p-2 rounded-lg text-text-secondary bg-paper-50"><TableIcon size={15} /></div>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-text">{t.title}</div>
                          <div className="text-[11.5px] text-text-secondary mt-0.5">{t.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border-light bg-paper-50/40">
            <span className="text-[12px] text-text-muted">
              {selection.size === 0 ? 'Nothing selected' : `${selection.size} selected`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAttach}
                disabled={selection.size === 0}
                className={`inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${selection.size === 0 ? 'bg-primary/40 text-white/85 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover text-white'}`}
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
  const color = severity === 'High' ? 'text-risk-700' : severity === 'Medium' ? 'text-high-700' : 'text-compliant-700';
  return <span className={`font-semibold ${color}`}>{severity.toLowerCase()}</span>;
}

// ─────────────────────────────────────────────────────────────────────
// FORENSIC — terminal-native density, mono IDs, severity-coded grid
// ─────────────────────────────────────────────────────────────────────

function ForensicLayout({ report, workflows, totals }: { report: Report; workflows: WorkflowResult[]; totals: Totals }) {
  const hPct = totals.records > 0 ? Math.round((totals.high * 100) / Math.max(1, totals.high + totals.medium + totals.low)) : 0;
  const mPct = totals.records > 0 ? Math.round((totals.medium * 100) / Math.max(1, totals.high + totals.medium + totals.low)) : 0;
  const lPct = totals.records > 0 ? Math.max(0, 100 - hPct - mPct) : 0;

  return (
    <div className="max-w-[1100px] mx-auto px-8 pt-6 pb-24 font-mono">
      <div className="flex items-baseline justify-between text-[11px] tracking-tight text-text-muted mb-3 uppercase">
        <span>RUN_LOG · {report.generatedAt.replace(/, /g, '·').replace(/ /g, '_').toUpperCase()}</span>
        <span>OPERATOR · {report.generatedBy.toUpperCase()}</span>
      </div>

      <h1 className="font-sans text-[28px] leading-[1.15] font-semibold text-ink-900 tracking-[-0.015em] mb-4">
        {report.name.replace(/ · Forensic$/, '')}
      </h1>

      <div className="flex flex-wrap items-center gap-2 mb-7 text-[11px]">
        <Pill mono>{totals.workflows} workflows</Pill>
        <Pill mono>{totals.records} records</Pill>
        {totals.bps.map(bp => (
          <Pill key={bp} mono>{bp}</Pill>
        ))}
      </div>

      {/* Severity distribution as a stacked bar */}
      <div className="border border-ink-900/15 rounded-sm p-4 mb-8">
        <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.18em] text-text-muted mb-2">
          <span>Severity distribution</span>
          <span>{totals.workflows} {totals.workflows === 1 ? 'workflow' : 'workflows'}</span>
        </div>
        <div className="flex h-6 overflow-hidden rounded-sm">
          <div className="bg-risk-500 flex items-center justify-center text-[10.5px] text-white font-semibold" style={{ width: `${hPct}%` }}>
            {hPct > 8 ? `${totals.high} HIGH` : ''}
          </div>
          <div className="bg-high-500 flex items-center justify-center text-[10.5px] text-white font-semibold" style={{ width: `${mPct}%` }}>
            {mPct > 8 ? `${totals.medium} MED` : ''}
          </div>
          <div className="bg-compliant-500 flex items-center justify-center text-[10.5px] text-white font-semibold" style={{ width: `${lPct}%` }}>
            {lPct > 8 ? `${totals.low} LOW` : ''}
          </div>
        </div>
      </div>

      {/* Workflow strips */}
      <div className="border-t border-ink-900/20">
        {workflows.map((w, i) => (
          <ForensicWorkflowStrip key={w.id} workflow={w} index={i} />
        ))}
      </div>
    </div>
  );
}

function Pill({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm bg-ink-900/[0.04] border border-ink-900/15 text-text-secondary ${mono ? 'font-mono text-[10.5px] tracking-tight' : 'text-[11px]'}`}>
      {children}
    </span>
  );
}

function ForensicWorkflowStrip({ workflow, index }: { workflow: WorkflowResult; index: number }) {
  const sev = workflow.severity;
  const sevBar = sev === 'High' ? 'bg-risk-500' : sev === 'Medium' ? 'bg-high-500' : 'bg-compliant-500';
  const sevText = sev === 'High' ? 'text-risk-700' : sev === 'Medium' ? 'text-high-700' : 'text-compliant-700';

  return (
    <section className="border-b border-ink-900/20">
      <header className="grid grid-cols-[64px_1fr_auto] items-center gap-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className={`block w-1 h-9 ${sevBar}`} />
          <span className="font-mono text-[10.5px] tracking-tight text-text-muted tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] tracking-tight text-primary font-semibold">{workflow.workflowId}</span>
            <span className="font-sans text-[14px] font-semibold text-ink-900 truncate">{workflow.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-text-muted">
            <span className="uppercase tracking-tight">{workflow.businessProcess ?? 'General'}</span>
            <span className="text-text-muted/40">·</span>
            <span className={`uppercase tracking-tight font-semibold ${sevText}`}>{sev}</span>
            {workflow.riskOwner && (
              <>
                <span className="text-text-muted/40">·</span>
                <span>{workflow.riskOwner}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-[10.5px] text-text-muted tabular-nums">
          {(workflow.outputTable?.rows.length ?? 0).toString().padStart(3, '0')} rec
        </div>
      </header>

      {/* Findings / observations as compact two-column block */}
      <div className="grid grid-cols-2 gap-6 pb-4 text-[12px] text-text-secondary leading-relaxed">
        <div>
          <div className="text-[10px] tracking-[0.22em] uppercase text-text-muted mb-1.5">Findings</div>
          <ul className="space-y-1">
            {workflow.findings.map((f, i) => (<li key={i}>· {f}</li>))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.22em] uppercase text-text-muted mb-1.5">Observations</div>
          <ul className="space-y-1">
            {workflow.observations.map((o, i) => (<li key={i}>· {o}</li>))}
          </ul>
        </div>
      </div>

      {/* Output table — the body */}
      {workflow.outputTable && workflow.outputTable.rows.length > 0 && (
        <div className="pb-5">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-ink-900/[0.025]">
                {workflow.outputTable.columns.map((col, ci) => (
                  <th
                    key={col}
                    className={`px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-text-muted font-semibold border-y border-ink-900/15 ${ci === workflow.outputTable!.columns.length - 1 ? 'text-right' : 'text-left'}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workflow.outputTable.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-ink-900/10 hover:bg-primary-xlight/30 transition-colors">
                  {row.map((cell, ci) => {
                    const cellStr = String(cell);
                    const isSeverity = cellStr === 'High' || cellStr === 'Medium' || cellStr === 'Low';
                    const isLast = ci === row.length - 1;
                    const isId = ci === 0;
                    return (
                      <td
                        key={ci}
                        className={`px-2 py-1.5 text-ink-900 tabular-nums ${isLast ? 'text-right' : ''} ${isId ? 'text-primary font-semibold' : ''}`}
                      >
                        {isSeverity ? (
                          <span className={`uppercase tracking-tight font-semibold ${cellStr === 'High' ? 'text-risk-700' : cellStr === 'Medium' ? 'text-high-700' : 'text-compliant-700'}`}>
                            {cellStr}
                          </span>
                        ) : cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MINIMAL — whitespace-led, large display type, no borders
// ─────────────────────────────────────────────────────────────────────

function MinimalLayout({ report, workflows, totals }: { report: Report; workflows: WorkflowResult[]; totals: Totals }) {
  return (
    <div className="max-w-[760px] mx-auto px-10 pt-16 pb-32">
      <p className="text-[10.5px] tracking-[0.3em] uppercase text-text-muted mb-10">Report</p>

      <h1 className="font-display text-[clamp(48px,6.4vw,72px)] leading-[1.0] font-[300] text-ink-900 tracking-[-0.02em] mb-12">
        {report.name.replace(/ · Minimal$/, '')}
      </h1>

      <div className="flex flex-wrap gap-x-10 gap-y-2 text-[12px] text-text-muted mb-24">
        <div>
          <div className="text-[10px] tracking-[0.22em] uppercase mb-0.5">Filed</div>
          <div className="text-text">{report.generatedAt}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.22em] uppercase mb-0.5">By</div>
          <div className="text-text">{report.generatedBy}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.22em] uppercase mb-0.5">Scope</div>
          <div className="text-text">{totals.bps.length > 0 ? totals.bps.join(' · ') : 'All processes'}</div>
        </div>
      </div>

      {/* Big numbers, tiny labels */}
      <div className="grid grid-cols-4 gap-8 mb-32">
        <MinimalStat label="Workflows" value={totals.workflows} />
        <MinimalStat label="Records" value={totals.records} accent />
        <MinimalStat label="High" value={totals.high} severity="High" />
        <MinimalStat label="Medium" value={totals.medium} severity="Medium" />
      </div>

      {workflows.map((w, i) => (
        <MinimalChapter key={w.id} workflow={w} index={i} />
      ))}
    </div>
  );
}

function MinimalStat({ label, value, accent = false, severity }: { label: string; value: number; accent?: boolean; severity?: 'High' | 'Medium' | 'Low' }) {
  const color = severity === 'High'
    ? 'text-risk-700'
    : severity === 'Medium'
      ? 'text-high-700'
      : severity === 'Low'
        ? 'text-compliant-700'
        : accent ? 'text-primary' : 'text-ink-900';
  return (
    <div>
      <div className={`font-display text-[56px] leading-none font-[300] ${color} tabular-nums tracking-[-0.03em]`}>
        {value}
      </div>
      <div className="mt-3 text-[10px] tracking-[0.3em] uppercase text-text-muted">{label}</div>
    </div>
  );
}

function MinimalChapter({ workflow, index }: { workflow: WorkflowResult; index: number }) {
  const sevDot = workflow.severity === 'High' ? 'bg-risk-500' : workflow.severity === 'Medium' ? 'bg-high-500' : 'bg-compliant-500';

  return (
    <section className="mt-24 first:mt-0">
      <div className="flex items-start gap-8">
        <div className="shrink-0 pt-2">
          <span className="font-display text-[20px] text-text-muted/60 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10.5px] tracking-[0.22em] uppercase text-text-muted mb-3">
            <span className={`w-1.5 h-1.5 rounded-full ${sevDot}`} />
            <span>{workflow.businessProcess ?? 'General'}</span>
            <span className="text-text-muted/40">·</span>
            <span>{workflow.workflowId}</span>
            <span className="text-text-muted/40">·</span>
            <span>{workflow.severity}</span>
          </div>

          <h2 className="font-display text-[clamp(28px,3.5vw,40px)] leading-[1.1] font-[300] text-ink-900 tracking-[-0.015em] mb-6">
            {workflow.name}
          </h2>

          {workflow.riskOwner && (
            <p className="text-[12px] text-text-muted mb-8">Risk owner — {workflow.riskOwner}</p>
          )}

          <div className="space-y-10">
            <MinimalProseBlock label="Findings" items={workflow.findings} />
            <MinimalProseBlock label="Observations" items={workflow.observations} />

            {workflow.outputTable && workflow.outputTable.rows.length > 0 && (
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-text-muted mb-4">Output</p>
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      {workflow.outputTable.columns.map((col, ci) => (
                        <th
                          key={col}
                          className={`pb-3 text-[10px] tracking-[0.22em] uppercase font-semibold text-text-muted border-b border-ink-900/20 ${ci === workflow.outputTable!.columns.length - 1 ? 'text-right' : 'text-left'}`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workflow.outputTable.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => {
                          const cellStr = String(cell);
                          const isSeverity = cellStr === 'High' || cellStr === 'Medium' || cellStr === 'Low';
                          const isLast = ci === row.length - 1;
                          return (
                            <td
                              key={ci}
                              className={`py-3 align-baseline text-text ${isLast ? 'text-right' : ''}`}
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
          </div>
        </div>
      </div>
    </section>
  );
}

function MinimalProseBlock({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] tracking-[0.3em] uppercase text-text-muted mb-3">{label}</p>
      <div className="space-y-2 text-[15.5px] leading-[1.7] text-text">
        {items.map((it, i) => (<p key={i}>{it}</p>))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ARCHITECTURAL — rigid grid, numbered chapters, sparse color
// ─────────────────────────────────────────────────────────────────────

function ArchitecturalLayout({ report, workflows, totals }: { report: Report; workflows: WorkflowResult[]; totals: Totals }) {
  return (
    <div className="max-w-[1000px] mx-auto px-8 pt-8 pb-24">
      {/* Cover — 8/4 split */}
      <header className="grid grid-cols-12 gap-6 pb-6 border-b-2 border-ink-900">
        <div className="col-span-12 md:col-span-8">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-text-muted mb-3">
            Bulk Audit · 00
          </p>
          <h1 className="font-display text-[clamp(34px,4.2vw,48px)] leading-[1.05] font-[420] text-ink-900 tracking-[-0.015em]">
            {report.name.replace(/ · Architectural$/, '')}
          </h1>
        </div>
        <div className="col-span-12 md:col-span-4 grid grid-cols-2 gap-y-4 text-[11px] self-end">
          <MetaCell label="Generated" value={report.generatedAt} />
          <MetaCell label="Author" value={report.generatedBy} />
          <MetaCell label="Workflows" value={String(totals.workflows)} />
          <MetaCell label="Processes" value={totals.bps.length > 0 ? totals.bps.join(' / ') : '—'} />
        </div>
      </header>

      {/* Overview section — keyed numbers in a tight row */}
      <section className="grid grid-cols-12 gap-6 py-10 border-b border-ink-900/30">
        <div className="col-span-12 md:col-span-3">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-text-muted mb-1">§ 00</p>
          <h2 className="font-display text-[22px] leading-tight font-[420] text-ink-900">Overview</h2>
        </div>
        <div className="col-span-12 md:col-span-9 grid grid-cols-4 gap-6">
          <BigNumber label="Records" value={totals.records} hint="flagged total" />
          <BigNumber label="High" value={totals.high} severity="High" />
          <BigNumber label="Medium" value={totals.medium} severity="Medium" />
          <BigNumber label="Low" value={totals.low} severity="Low" />
        </div>
      </section>

      {workflows.map((w, i) => (
        <ArchitecturalChapter key={w.id} workflow={w} index={i} total={workflows.length} />
      ))}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-text-muted">{label}</div>
      <div className="text-[12.5px] text-ink-900 mt-0.5">{value}</div>
    </div>
  );
}

function BigNumber({ label, value, hint, severity }: { label: string; value: number; hint?: string; severity?: 'High' | 'Medium' | 'Low' }) {
  const color = severity === 'High'
    ? 'text-risk-700'
    : severity === 'Medium'
      ? 'text-high-700'
      : severity === 'Low'
        ? 'text-compliant-700'
        : 'text-ink-900';
  return (
    <div>
      <div className={`font-display text-[44px] leading-none font-[420] ${color} tabular-nums`}>
        {value}
      </div>
      <div className="mt-2 font-mono text-[10px] tracking-[0.22em] uppercase text-text-muted">{label}</div>
      {hint && <div className="text-[11px] text-text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

function ArchitecturalChapter({ workflow, index, total }: { workflow: WorkflowResult; index: number; total: number }) {
  const sevDot = workflow.severity === 'High' ? 'bg-risk-500' : workflow.severity === 'Medium' ? 'bg-high-500' : 'bg-compliant-500';
  const sevText = workflow.severity === 'High' ? 'text-risk-700' : workflow.severity === 'Medium' ? 'text-high-700' : 'text-compliant-700';

  return (
    <section className="grid grid-cols-12 gap-6 py-10 border-b border-ink-900/30 last:border-b-0">
      <aside className="col-span-12 md:col-span-3">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-text-muted mb-1">
          § {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>
        <h2 className="font-display text-[20px] leading-tight font-[420] text-ink-900">
          {workflow.businessProcess ?? 'General'}
        </h2>
        <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-text-muted">
          <span className={`w-2 h-2 rounded-full ${sevDot}`} />
          <span className={`uppercase tracking-tight font-semibold ${sevText}`}>{workflow.severity}</span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-primary tracking-tight">{workflow.workflowId}</div>
        {workflow.riskOwner && (
          <div className="mt-4 pt-4 border-t border-ink-900/20">
            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-text-muted mb-0.5">Owner</div>
            <div className="text-[12px] text-ink-900">{workflow.riskOwner}</div>
          </div>
        )}
      </aside>

      <div className="col-span-12 md:col-span-9">
        <h3 className="font-display text-[24px] leading-[1.15] font-[420] text-ink-900 tracking-[-0.01em] mb-5">
          {workflow.name}
        </h3>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-text-muted mb-2">Findings</div>
            <ul className="space-y-1.5 text-[13.5px] text-text leading-relaxed">
              {workflow.findings.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-text-muted/60 tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-text-muted mb-2">Observations</div>
            <ul className="space-y-1.5 text-[13.5px] text-text leading-relaxed">
              {workflow.observations.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-text-muted/60 tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {workflow.outputTable && workflow.outputTable.rows.length > 0 && (
          <ArchitecturalTable table={workflow.outputTable} />
        )}
      </div>
    </section>
  );
}

function ArchitecturalTable({ table }: { table: NonNullable<WorkflowResult['outputTable']> }) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? table.rows : table.rows.slice(0, 5);

  return (
    <div className="border border-ink-900/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-ink-900/30">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-text-muted">
          Output · {table.rows.length} {table.rows.length === 1 ? 'record' : 'records'}
        </div>
        <button className="font-mono text-[10px] tracking-[0.22em] uppercase text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
          <Download size={11} />
          CSV
        </button>
      </div>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-paper-50">
            {table.columns.map((col, ci) => (
              <th
                key={col}
                className={`px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted font-semibold border-b border-ink-900/30 ${ci === table.columns.length - 1 ? 'text-right' : 'text-left'}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, ri) => (
            <tr key={ri} className="border-b border-ink-900/15 last:border-b-0">
              {row.map((cell, ci) => {
                const cellStr = String(cell);
                const isSeverity = cellStr === 'High' || cellStr === 'Medium' || cellStr === 'Low';
                const isLast = ci === row.length - 1;
                const isId = ci === 0;
                return (
                  <td
                    key={ci}
                    className={`px-3 py-2 text-ink-900 ${isLast ? 'text-right' : ''} ${isId ? 'font-mono text-[11.5px] text-primary tabular-nums' : ''}`}
                  >
                    {isSeverity ? (
                      <span className={`font-mono text-[10.5px] uppercase tracking-tight font-semibold ${cellStr === 'High' ? 'text-risk-700' : cellStr === 'Medium' ? 'text-high-700' : 'text-compliant-700'}`}>
                        {cellStr}
                      </span>
                    ) : cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > 5 && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="w-full px-3 py-2 border-t border-ink-900/30 bg-paper-50/50 font-mono text-[10px] tracking-[0.22em] uppercase text-text-secondary hover:bg-paper-50 hover:text-primary cursor-pointer transition-colors"
        >
          {showAll ? `Show first 5` : `Show all ${table.rows.length} records`}
        </button>
      )}
    </div>
  );
}

