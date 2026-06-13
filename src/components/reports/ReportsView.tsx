import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import {
  FileText, FileSpreadsheet, Shield, AlertTriangle, CheckCircle2, BarChart3,
  TrendingUp, Download, Share2, ArrowRight, ArrowLeft, ChevronDown,
  ChevronLeft, ChevronRight,
  Sparkles, Settings, Palette, Type,
  Image, Layout, X, Edit3, BookOpen, Upload, Lightbulb, Loader2, Trash2,
  List, LayoutGrid, GripVertical, Plus, StickyNote, PanelLeftClose, PanelLeftOpen,
  MoreVertical, Eye, EyeOff, Database, Search, PackageOpen, ExternalLink,
  MessageSquare, Paperclip, Send, Clock as ClockIcon, History,
  Star, Layers, Check, CloudUpload, RefreshCw, Lock, WifiOff,
  FileCheck2, FolderArchive,
} from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import { SkeletonRow } from '../shared/Skeleton';
import { ChromaGrid, handleChromaCardMove } from './ChromaGrid';
import { ManageExceptionsLaunchButton } from './ManageExceptionsLaunchButton';
import UploadReportModal from './UploadReportModal';
import GenerateATRModal from '../exceptions/GenerateATRModal';
import AtrReportView from './AtrReportView';
import type { AtrMeta, AtrObservation, AtrInsight, AtrReportData } from './atrTypes';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES, GENERATED_REPORTS, SHARED_REPORTS } from '../../data/mockData';
import { ATR_LIBRARY, EVIDENCE_LIBRARY, type AtrLibraryReport } from '../../data/atrLibrary';
import AtrReportsLibrary from './AtrReportsLibrary';
import EvidenceRepository from './EvidenceRepository';
import { REPORT_QUERIES_ATR, type ReportQueryAtr } from '../../data/reportQueries';
import { QUERY_SESSIONS, FAVOURITES } from '../../data/queryHistory';
import { QUERY_GRAPHS, QUERY_TABLES, type QueryGraph, type QueryTable } from '../../data/queryGraphs';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import { SectionHeader, Checkbox, KpiPreviewRow, TablePreviewRow } from '../chat/WidgetPickerParts';
import { setAll, toggleIn } from '../chat/widgetPickerHelpers';
import { StatusBadge } from '../shared/StatusBadge';
import SmartTable from '../shared/SmartTable';
import { useToast, type ToastType } from '../shared/Toast';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { useCan } from '../../context/CurrentUserContext';
import FloatingLines from '../shared/FloatingLines';
import { KpiCountUp } from '../shared/KpiTile';
import { renderAssistantText } from '../shared/AssistantMarkdown';
import ReportBuilder from './ReportBuilder';
import { BulkAuditVariantView } from './BulkAuditVariants';
import ReportDownloadModal, { type DownloadPreviewSection } from './ReportDownloadModal';
import AddObservationModal, {
  computeNextObservationId,
  isImageMime,
  formatFileSize,
  attachmentVisual,
  type EditingObservationInput,
  type ObservationAttachment,
} from './AddObservationModal';
import { SEED, TYPE_META, formatDate } from '../data-sources/sources';

const ICON_MAP: Record<string, React.ElementType> = {
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

// Observation attachment type + helpers live in AddObservationModal.

// Report tag chip — maps the freeform tag string to the GRC semantic
// palette instead of one-off hex pairs. Keeps the colour vocabulary the
// same one used everywhere else in the product.
function reportTagChip(tag: string): { classes: string; label: string } {
  if (tag === 'Internal Audit') {
    return { classes: 'bg-evidence-50 text-evidence-700', label: tag };
  }
  if (tag === 'Bulk Audit') {
    return { classes: 'bg-brand-50 text-brand-700', label: tag };
  }
  return { classes: 'bg-paper-100 text-ink-600', label: tag };
}

/** Which of the three report types a generated report belongs to. ATR reports
 *  carry atrData; SOX reports are identified by name; everything else is treated
 *  as Internal Audit. Drives the segmented sub-tabs inside My Reports. */
function reportKind(r: { name?: string; atrData?: unknown }): 'atr' | 'sox' | 'ia' {
  if (r.atrData) return 'atr';
  if (/\bsox\b/i.test(r.name ?? '')) return 'sox';
  return 'ia';
}

type AttachedQuery = {
  id: string;
  kind: 'query' | 'source' | 'upload';
  label: string;
  attachedAt: string;
  attachedBy: string;
};

// Shared shape used by Bulk Audit reports. A workflow result is the bulk-run
// counterpart of a saved query — same place in the report, different content.
export type WorkflowResult = {
  id: string;
  workflowId: string;        // display id, e.g. "P2P-001"
  name: string;
  businessProcess?: string;
  severity: 'High' | 'Medium' | 'Low';
  riskOwner?: string;        // optional — empty until the user fills it in
  findings: string[];
  observations: string[];
  outputTable?: {
    columns: string[];
    rows: (string | number)[][];
  };
  /** Run-time status. Missing = treated as 'succeeded' for back-compat with
   *  pre-existing reports. Failed runs are excluded from the report body and
   *  only acknowledged via a callout in the Executive Summary. */
  runStatus?: 'succeeded' | 'failed';
  /** Why the run failed. Only set when runStatus === 'failed'. */
  failureReason?: 'errored' | 'skipped';
};

// The bulk audit report detail page renders in a single editorial treatment.
export type BulkAuditAestheticVariant = 'editorial';

type GeneratedReport = typeof GENERATED_REPORTS[number] & {
  isEmpty?: boolean;
  attachedQueries?: AttachedQuery[];
  description?: string;
  workflowResults?: WorkflowResult[];
  aestheticVariant?: BulkAuditAestheticVariant;
  /** Explicit override for read-only state (Shared with me, archived). */
  isReadOnly?: boolean;
  /** Display name of the user who shared the report — surfaces in the chip. */
  sharedByName?: string;
  /** Present when this report is a generated Action Taken Report (renders via
   *  AtrReportView instead of the standard template/query report layout). */
  atrData?: AtrReportData;
};

// Dummy user-created templates. Replace with real data when the create-custom-template flow lands.
export const CUSTOM_TEMPLATES = [
  {
    id: 'ct-custom-01',
    name: 'Third-Party Vendor Risk Scorecard',
    desc: 'Custom scorecard for third-party vendors with risk tiers, control gaps, and remediation SLAs.',
    category: 'Risk',
    icon: 'alert-triangle',
    sections: [
      { name: 'Vendor Overview', icon: 'file-text' },
      { name: 'Risk Tier Summary', icon: 'alert-triangle' },
      { name: 'Control Gaps', icon: 'shield' },
      { name: 'Remediation Plan', icon: 'check-circle' },
    ],
  },
  {
    id: 'ct-custom-02',
    name: 'Quarterly Audit Snapshot',
    desc: 'One-page executive snapshot of quarterly audit findings and status.',
    category: 'Audit',
    icon: 'file-text',
    sections: [
      { name: 'Quarter Summary', icon: 'file-text' },
      { name: 'Key Findings', icon: 'alert-triangle' },
      { name: 'Status & Owners', icon: 'check-circle' },
    ],
  },
  {
    id: 'ct-003',
    name: 'Internal Controls Health Report',
    desc: 'Tracks control design effectiveness and operating effectiveness across business processes.',
    category: 'Controls',
    icon: 'check-circle',
    sections: [
      { name: 'Scope', icon: 'file-text' },
      { name: 'Design Effectiveness', icon: 'shield' },
      { name: 'Operating Effectiveness', icon: 'check-circle' },
      { name: 'Recommendations', icon: 'trending-up' },
    ],
  },
  {
    id: 'ct-004',
    name: 'Board Slide Deck',
    desc: 'Executive board-ready deck with headline metrics, risk heatmap, and narrative commentary.',
    category: 'Executive',
    icon: 'trending-up',
    sections: [
      { name: 'Headline Metrics', icon: 'bar-chart' },
      { name: 'Risk Heatmap', icon: 'alert-triangle' },
      { name: 'Narrative', icon: 'file-text' },
      { name: 'Outlook', icon: 'trending-up' },
    ],
  },
  {
    id: 'ct-005',
    name: 'Ad-hoc Exception Summary',
    desc: 'Quick exception digest grouped by owner with action taken and resolution status.',
    category: 'Risk',
    icon: 'alert-triangle',
    sections: [
      { name: 'Exception List', icon: 'alert-triangle' },
      { name: 'Owner Responses', icon: 'file-text' },
      { name: 'Resolution Status', icon: 'check-circle' },
    ],
  },
  {
    id: 'ct-006',
    name: 'Finance Close Checklist',
    desc: 'Period-close checklist with reconciliation status, journal review, and sign-offs.',
    category: 'Audit',
    icon: 'clipboard-check',
    sections: [
      { name: 'Reconciliations', icon: 'check-circle' },
      { name: 'Journal Review', icon: 'file-text' },
      { name: 'Sign-offs', icon: 'shield' },
    ],
  },
];


const SECTION_ICONS: Record<string, React.ElementType> = {
  'file-text': FileText,
  'alert-triangle': AlertTriangle,
  'shield': Shield,
  'check-circle': CheckCircle2,
  'bar-chart': BarChart3,
  'trending-up': TrendingUp,
  'clipboard-check': CheckCircle2,
  'lightbulb': Lightbulb,
  'book-open': BookOpen,
};

interface ReportsViewProps {
  onOpenBuilder?: () => void;
  onShare?: (id: string) => void;
  onManageExceptions?: () => void;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  customTemplates?: typeof REPORT_TEMPLATES[number][];
  onAddCustomTemplate?: (template: typeof REPORT_TEMPLATES[number]) => void;
  /** When set, ReportsView opens that report in the full detail view. Cleared by the parent after consumption. */
  focusReportId?: string | null;
  onFocusReportConsumed?: () => void;
}

function TemplateCarousel({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollButtons);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = dir === 'left' ? -el.clientWidth * 0.8 : el.clientWidth * 0.8;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="relative group/carousel">
      <button
        type="button"
        onClick={() => scroll('left')}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white border border-border shadow-md flex items-center justify-center text-text hover:bg-surface-2 hover:border-primary/40 disabled:invisible disabled:pointer-events-none transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
      >
        <ChevronLeft size={16} />
      </button>
      <div
        ref={scrollRef}
        onScroll={updateScrollButtons}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-3 items-stretch"
      >
        {children}
      </div>
      {/* Right-edge fade — only when more content sits past the viewport. */}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-3 w-12 bg-gradient-to-l from-white to-transparent"
        />
      )}
      <button
        type="button"
        onClick={() => scroll('right')}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white border border-border shadow-md flex items-center justify-center text-text hover:bg-surface-2 hover:border-primary/40 disabled:invisible disabled:pointer-events-none transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─── Upload Template Modal ───
function UploadTemplateModal({ onClose }: { onClose: () => void }) {
  const { addToast } = useToast();
  const [step, setStep] = useState<'upload' | 'selected' | 'converting' | 'converted'>('upload');
  const [templateName, setTemplateName] = useState('SOX Report Template');
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onClose);

  const DETECTED_SECTIONS = [
    'Executive Summary', 'Findings', 'Risk Assessment',
    'Control Testing Results', 'Recommendations', 'Appendix'
  ];

  useEffect(() => {
    if (step === 'converting') {
      const timer = setTimeout(() => setStep('converted'), 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Upload Template"
        className="relative bg-white rounded-[16px] shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-[8px]"><Upload size={16} /></div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">Upload Template</h3>
              <p className="text-[11px] text-text-muted">Convert a document into a report template</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Drop Zone */}
          {step === 'upload' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <button
                onClick={() => setStep('selected')}
                className="w-full border-2 border-dashed border-border-light hover:border-primary/40 rounded-[12px] p-10 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:bg-primary/[0.02] cursor-pointer group"
              >
                <div className="p-3 bg-primary/5 rounded-[8px] group-hover:bg-primary/10 transition-colors">
                  <Upload size={32} className="text-primary/50 group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium text-text">Drop your template file here or click to browse</p>
                  <p className="text-[11px] text-text-muted mt-1">Supports .docx, .pdf, .xlsx</p>
                </div>
              </button>
            </motion.div>
          )}

          {/* File Selected */}
          {step === 'selected' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-primary/[0.03] border border-primary/10 rounded-[12px]">
                <div className="p-2 bg-primary/10 rounded-[8px]"><FileText size={20} className="text-primary" /></div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-text">SOX_Report_Template.docx</p>
                  <p className="text-[11px] text-text-muted">2.4 MB</p>
                </div>
                <CheckCircle2 size={20} className="text-compliant-700" />
              </div>
              <button
                onClick={() => setStep('converting')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white text-[13px] font-semibold hover:bg-primary-hover transition-all cursor-pointer rounded-[8px]"
              >
                <Sparkles size={14} /> Convert to Template
              </button>
            </motion.div>
          )}

          {/* Converting Animation */}
          {step === 'converting' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles size={32} className="text-primary" />
              </motion.div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-text">Analyzing document structure...</p>
                <p className="text-[11px] text-text-muted mt-1">Detecting sections, headers, and formatting</p>
              </div>
              <div className="w-48 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary-medium rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          )}

          {/* Conversion Complete */}
          {step === 'converted' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-3 p-4 bg-compliant-50 border border-compliant rounded-[12px]">
                <CheckCircle2 size={20} className="text-compliant-700" />
                <div>
                  <p className="text-[13px] font-semibold text-primary">Template converted!</p>
                  <p className="text-[11px] text-primary/70">6 sections detected</p>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-text mb-2 block">Detected Sections</label>
                <div className="space-y-1.5">
                  {DETECTED_SECTIONS.map((section, i) => (
                    <motion.div
                      key={section}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-center gap-2.5 px-3 py-2 bg-surface-2 rounded-[8px]"
                    >
                      <div className="w-5 h-5 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
                      <span className="text-[12px] text-text font-medium">{section}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-text mb-2 block">Template Name</label>
                <input
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 rounded-[8px]"
                />
              </div>
            </motion.div>
          )}
        </div>

        {step === 'converted' && (
          <div className="px-6 py-4 border-t border-border-light flex justify-end gap-2 shrink-0">
            <button onClick={onClose} className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-text bg-white border border-border-light hover:bg-paper-50 transition-colors cursor-pointer rounded-[8px]">Cancel</button>
            <button
              onClick={() => { addToast({ type: 'success', message: `"${templateName}" saved to template library.` }); onClose(); }}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-primary text-white text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer rounded-[8px]"
            >
              Save Template
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Template Preview Modal ───
function TemplatePreviewModal({ template, onClose, onEdit, onUse }: { template: typeof REPORT_TEMPLATES[0]; onClose: () => void; onEdit: () => void; onUse: () => void }) {
  const Icon = ICON_MAP[template.icon] || FileText;
  const color = CATEGORY_COLORS[template.category] || 'text-ink-500 bg-paper-50';
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onClose);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Template Preview"
        className="relative bg-white rounded-[16px] shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-[8px] ${color}`}><Icon size={16} /></div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">{template.name}</h3>
              <p className="text-[11px] text-text-muted">{template.category} template</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <p className="text-[12px] text-text-secondary leading-relaxed">{template.desc}</p>

          <div>
            <label className="text-[12px] font-semibold text-text mb-3 block">Template Structure</label>
            <div className="space-y-2">
              {(template.sections || []).map((section, i) => {
                const SectionIcon = SECTION_ICONS[section.icon] || FileText;
                return (
                  <motion.div
                    key={section.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 px-4 py-3 bg-surface-2 rounded-[12px] hover:bg-primary/[0.03] transition-colors"
                  >
                    <div className="p-1.5 rounded-[8px] bg-white border border-border-light shadow-sm">
                      <SectionIcon size={14} className="text-primary" />
                    </div>
                    <span className="text-[13px] text-text font-medium">{section.name}</span>
                    <span className="ml-auto text-[10px] text-text-muted font-medium">Section {i + 1}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border-light flex justify-between shrink-0">
          <button
            onClick={() => { onClose(); onEdit(); }}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-text bg-white border border-border-light hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer"
          >
            <Edit3 size={12} /> Edit Template
          </button>
          <button
            onClick={onUse}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Sparkles size={12} /> Use This Template
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Choose Report Modal ───
function ChooseReportModal({
  template,
  reports,
  onCancel,
  onClose,
  onContinue,
  onAddNew,
}: {
  template: typeof REPORT_TEMPLATES[0];
  reports: typeof GENERATED_REPORTS;
  onCancel: () => void;
  onClose: () => void;
  onContinue: (report: typeof GENERATED_REPORTS[0]) => void;
  onAddNew: () => void;
}) {
  const { can } = useCan();
  const canAddReport = can('rp_edit');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onClose);

  const filtered = reports.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = reports.find(r => r.id === selectedId) || null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Choose Report"
        className="relative bg-white rounded-[16px] shadow-2xl w-[560px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-[8px]"><PackageOpen size={16} /></div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">Choose Report</h3>
              <p className="text-[12px] text-text-muted">Select an existing report or create a new report</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] border border-border-light focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Report"
              className="flex-1 bg-transparent text-[13px] text-text placeholder:text-text-muted focus:outline-none"
            />
          </div>

          {/* Report list */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-[12px] text-text-muted">No reports match your search</div>
            )}
            {filtered.map(r => {
              const isSelected = selectedId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-[12px] border transition-colors cursor-pointer ${
                    isSelected ? 'border-primary bg-primary/[0.04]' : 'border-border-light hover:border-primary/30 hover:bg-surface-2'
                  }`}
                >
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                    isSelected ? 'border-primary' : 'border-border'
                  }`}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-text truncate">{r.name}</span>
                      <span className="text-[11px] text-text-muted shrink-0">{r.generatedAt}</span>
                    </div>
                    <div className="text-[11px] text-text-muted truncate mt-0.5">{r.tag}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Add New Report */}
          {canAddReport && (
            <button
              onClick={onAddNew}
              className="w-full px-4 py-3 rounded-[8px] bg-primary/10 hover:bg-primary/15 text-primary text-[13px] font-semibold transition-colors cursor-pointer"
            >
              + Add New Report
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light flex items-center gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] border border-border-light text-text bg-white text-[13px] font-semibold hover:bg-paper-50 transition-colors cursor-pointer"
          >
            Back
          </button>
          <button
            onClick={() => { if (selected) onContinue(selected); }}
            disabled={!selected}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:bg-primary/40 disabled:cursor-not-allowed"
            title={`Apply "${template.name}"`}
          >
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Apply Template Dropdown ───
function ApplyTemplateDropdown({ onSelect, onClose }: { onSelect: (template: typeof REPORT_TEMPLATES[0]) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.97 }}
      className="absolute right-0 top-full mt-1 w-[280px] bg-white rounded-[8px] shadow-xl border border-border-light z-50 overflow-hidden"
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
              className="w-full text-left px-3 py-2.5 rounded-[8px] hover:bg-primary-xlight transition-colors cursor-pointer flex items-center gap-2.5"
            >
              <div className={`p-1.5 rounded-[8px] ${CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50'}`}>
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

// ─── Template Editor Modal ───
function TemplateSectionRow({
  section,
  index,
  onDelete,
}: {
  section: { name: string; icon: string };
  index: number;
  onDelete: () => void;
}) {
  const SectionIcon = SECTION_ICONS[section.icon] || FileText;
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={controls}
      className="group flex items-center gap-2.5 px-3 py-2 bg-surface-2 rounded-[8px]"
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag ${section.name} to reorder`}
        className="text-text-muted hover:text-primary cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical size={12} />
      </button>
      <div className="p-1 rounded-[8px] bg-white border border-border-light shadow-sm">
        <SectionIcon size={12} className="text-primary" />
      </div>
      <span className="text-[12px] text-text font-medium">{section.name}</span>
      <span className="ml-auto text-[10px] text-text-muted font-medium">Section {index + 1}</span>
      <button
        onClick={onDelete}
        aria-label={`Delete ${section.name}`}
        className="text-text-muted hover:text-risk-700 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={12} />
      </button>
    </Reorder.Item>
  );
}

function TemplateEditor({ template, onClose, isCopy = false, onSaveCopy, existingTemplateNames = [] }: { template: typeof REPORT_TEMPLATES[0]; onClose: () => void; isCopy?: boolean; onSaveCopy?: (copy: typeof REPORT_TEMPLATES[0]) => void; existingTemplateNames?: string[] }) {
  const { addToast } = useToast();
  const [copyName, setCopyName] = useState(`Copy of ${template.name}`);
  const [brand, setBrand] = useState('Irame');
  const [theme, setTheme] = useState('Purple & White');
  const [headerText, setHeaderText] = useState('Confidential — For Internal Use Only');
  const [footerText, setFooterText] = useState('Generated by Auditify Copilot');
  const [sections, setSections] = useState(template.sections || []);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ field: 'copyName' | 'brand' | 'sections'; label: string }[]>([]);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  const copyNameRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initial state captured at mount for dirty-detection.
  const initialRef = useRef({
    copyName: `Copy of ${template.name}`,
    brand: 'Auditify',
    theme: 'Purple & White',
    headerText: 'Confidential — For Internal Use Only',
    footerText: 'Generated by Auditify Copilot',
    sections: template.sections || [],
  });
  const isDirty =
    (isCopy && copyName !== initialRef.current.copyName) ||
    brand !== initialRef.current.brand ||
    theme !== initialRef.current.theme ||
    headerText !== initialRef.current.headerText ||
    footerText !== initialRef.current.footerText ||
    sections !== initialRef.current.sections;

  const attemptClose = () => {
    if (isDirty && !isSaving) {
      setShowAbandonConfirm(true);
    } else {
      onClose();
    }
  };
  useFocusTrap(containerRef, true, attemptClose);

  const fieldRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    copyName: copyNameRef,
    brand: brandRef,
    sections: sectionsRef,
  };

  const handleSave = () => {
    // Required-field validation: brand is always required; copyName is
    // required in the Copy flow; sections must be non-empty.
    const next: { field: 'copyName' | 'brand' | 'sections'; label: string }[] = [];
    if (isCopy && !copyName.trim()) next.push({ field: 'copyName', label: 'Template Name' });
    if (!brand.trim()) next.push({ field: 'brand', label: 'Brand Name' });
    if (!sections || sections.length === 0) next.push({ field: 'sections', label: 'At least one section' });
    if (next.length > 0) {
      setErrors(next);
      const first = fieldRefs[next[0].field]?.current;
      first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      first?.focus?.();
      return;
    }
    setErrors([]);
    setIsSaving(true);
    // Simulate an async save so the spinner is observable.
    window.setTimeout(() => {
      if (isCopy && onSaveCopy) {
        const finalName = copyName.trim() || `Copy of ${template.name}`;
        if (existingTemplateNames.some(n => n.toLowerCase() === finalName.toLowerCase())) {
          setIsSaving(false);
          addToast({ type: 'error', message: `A template named "${finalName}" already exists. Choose a different name.` });
          return;
        }
        onSaveCopy({
          ...template,
          id: `ct-copy-${Date.now()}`,
          name: finalName,
          sections,
        });
        addToast({ type: 'success', message: 'Copy saved to Custom Templates.' });
      } else {
        addToast({ type: 'success', message: 'Template saved.' });
      }
      setIsSaving(false);
      onClose();
    }, 320);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" onClick={attemptClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Edit Template"
        className="relative bg-white rounded-[16px] shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-[8px]"><Settings size={16} /></div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">Edit Template</h3>
              <p className="text-[11px] text-text-muted">{isCopy ? `Copy of ${template.name}` : template.name}</p>
            </div>
          </div>
          <button onClick={attemptClose} aria-label="Close" className="p-1.5 hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={16} className="text-text-muted" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errors.length > 0 && (
            <div
              role="alert"
              className="border border-risk-200 bg-risk-50 rounded-[8px] px-3 py-2 text-[12px] text-risk-800"
            >
              <div className="font-semibold mb-1">Please complete the following before saving:</div>
              <ul className="space-y-0.5">
                {errors.map(err => (
                  <li key={err.field}>
                    <button
                      type="button"
                      onClick={() => {
                        const el = fieldRefs[err.field]?.current;
                        el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                        el?.focus?.();
                      }}
                      className="underline hover:text-risk-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded"
                    >
                      {err.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Template Name (Copy flow) + Brand */}
          {isCopy ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><FileText size={14} /> Template Name</label>
                <input ref={copyNameRef} value={copyName} onChange={e => setCopyName(e.target.value)} className="w-full px-3 py-2.5 rounded-[8px] border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Image size={14} /> Brand Name</label>
                <input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-3 py-2.5 rounded-[8px] border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
              </div>
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Image size={14} /> Brand Name</label>
              <input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-3 py-2.5 rounded-[8px] border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </div>
          )}

          {/* Theme */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Palette size={14} /> Color Theme</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { name: 'Purple & White', colors: ['#6a12cd', '#f8f9fc'] },
                { name: 'Navy & Gold', colors: ['#1a2744', '#c5a55a'] },
                { name: 'Teal & Light', colors: ['#0d9488', '#f0fdfa'] },
                { name: 'Slate & Blue', colors: ['#334155', '#3b82f6'] },
              ].map(t => (
                <button key={t.name} onClick={() => setTheme(t.name)} className={`p-2.5 rounded-[12px] border-2 text-center transition-all cursor-pointer ${theme === t.name ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'}`}>
                  <div className="flex gap-1 justify-center mb-1.5">
                    {t.colors.map((c, i) => <div key={i} className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ background: c }} />)}
                  </div>
                  <span className="text-[9px] font-medium text-text">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Header */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Type size={14} /> Header Text</label>
            <input value={headerText} onChange={e => setHeaderText(e.target.value)} className="w-full px-3 py-2.5 rounded-[8px] border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
          </div>

          {/* Footer */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Layout size={14} /> Footer Text</label>
            <input value={footerText} onChange={e => setFooterText(e.target.value)} className="w-full px-3 py-2.5 rounded-[8px] border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
          </div>

          {/* Page Layout Preview */}
          <div ref={sectionsRef} tabIndex={-1}>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><FileText size={14} /> Page Layout Preview</label>
            <div className="border border-border-light rounded-[12px] p-4 bg-surface-2">
              <div className="bg-white rounded-[12px] shadow-sm border border-border-light overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-4 py-2.5 bg-primary/5 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-primary">{brand}</span>
                  <span className="text-[10px] text-text-muted">{headerText}</span>
                </div>
                {/* Section list */}
                <Reorder.Group axis="y" values={sections} onReorder={setSections} className="p-3 space-y-1.5 flex-1">
                  {sections.map((section, i) => (
                    <TemplateSectionRow
                      key={section.name}
                      section={section}
                      index={i}
                      onDelete={() => setSections(prev => prev.filter(s => s.name !== section.name))}
                    />
                  ))}
                </Reorder.Group>
                {/* Footer */}
                <div className="px-4 py-2 bg-surface-2 flex items-center justify-center border-t border-border-light">
                  <span className="text-[10px] text-text-muted">{footerText}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border-light flex justify-end gap-2 shrink-0">
          <button
            onClick={attemptClose}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-text bg-white border border-border-light hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >
            {isSaving && <Loader2 size={12} className="animate-spin" />}
            {isSaving ? 'Saving…' : isCopy ? 'Save Copy' : 'Save Template'}
          </button>
        </div>
      </motion.div>
      <ConfirmDialog
        open={showAbandonConfirm}
        onClose={() => setShowAbandonConfirm(false)}
        onConfirm={() => { setShowAbandonConfirm(false); onClose(); }}
        title="Discard changes?"
        description={<>You have unsaved changes to this template. Closing now will discard them.</>}
        confirmLabel="Discard"
        destructive
      />
    </motion.div>
  );
}

// ─── Template Layout Component — renders actual report layouts per template ───
function TemplateLayout({ templateId, template, report }: { templateId: string; template: typeof REPORT_TEMPLATES[0]; report: typeof GENERATED_REPORTS[0] }) {
  const sections = template.sections || [];

  // SOX Compliance — Excel-style control testing table
  if (templateId === 'rt-001') {
    const controls = [
      { id: 'CTR-001', name: 'Invoice Approval Workflow', process: 'P2P', type: 'Preventive', freq: 'Per Transaction', owner: 'Tushar Goel', result: 'Effective', exceptions: 0 },
      { id: 'CTR-002', name: 'Three-Way PO Match', process: 'P2P', type: 'Detective', freq: 'Daily', owner: 'AP Module', result: 'Effective', exceptions: 2 },
      { id: 'CTR-003', name: 'Vendor Master Change Approval', process: 'P2P', type: 'Preventive', freq: 'Per Change', owner: 'Deepak Bansal', result: 'Deficient', exceptions: 7 },
      { id: 'CTR-004', name: 'Duplicate Invoice Detection', process: 'P2P', type: 'Detective', freq: 'Real-time', owner: 'AI Workflow', result: 'Effective', exceptions: 0 },
      { id: 'CTR-005', name: 'Payment Batch Authorization', process: 'P2P', type: 'Preventive', freq: 'Per Batch', owner: 'Tushar Goel', result: 'Effective', exceptions: 1 },
      { id: 'CTR-006', name: 'Revenue Recognition Cutoff', process: 'O2C', type: 'Detective', freq: 'Monthly', owner: 'Neha Joshi', result: 'Pending', exceptions: 0 },
      { id: 'CTR-007', name: 'GL Reconciliation Review', process: 'R2R', type: 'Detective', freq: 'Monthly', owner: 'Karan Mehta', result: 'Effective', exceptions: 3 },
      { id: 'CTR-008', name: 'Journal Entry Approval', process: 'R2R', type: 'Preventive', freq: 'Per Entry', owner: 'Sneha Desai', result: 'Deficient', exceptions: 7 },
      { id: 'CTR-009', name: 'SOD Rule Enforcement', process: 'ALL', type: 'Preventive', freq: 'Continuous', owner: 'GRC Module', result: 'Effective', exceptions: 4 },
      { id: 'CTR-010', name: 'Intercompany Elimination', process: 'R2R', type: 'Detective', freq: 'Quarterly', owner: 'Karan Mehta', result: 'Effective', exceptions: 0 },
    ];
    const resultColor = (r: string) => r === 'Effective' ? 'text-compliant-700 bg-compliant-50' : r === 'Deficient' ? 'text-risk-700 bg-risk-50' : 'text-mitigated-700 bg-mitigated-50';
    return (
      <div className="space-y-5">
        {/* Section nav */}
        <div className="flex gap-2 flex-wrap">
          {sections.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-[8px] border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Executive Summary */}
        <div className="bg-white rounded-[12px] border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-2 flex items-center gap-2"><FileText size={14} className="text-primary" /> Executive Summary</h3>
          <p className="text-[12px] text-text-secondary leading-relaxed">FY26 Q1 SOX compliance audit covered 87 controls across 4 business processes (P2P, O2C, R2R, S2C). 54 controls tested to date with 89% effectiveness rate. 2 material weaknesses identified requiring remediation before March 31 deadline. Overall compliance score: 94.2% — improved from 91.8% prior quarter.</p>
        </div>
        {/* Control Testing Results — Excel-style */}
        <div className="bg-white rounded-[12px] border border-border-light overflow-hidden">
          <div className="px-5 py-3 border-b border-border-light flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-text flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> Control Testing Results</h3>
            <span className="text-[10px] text-text-muted">{controls.length} controls · {report.generatedAt}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-paper-50 border-b border-border-light">
                  {['Control ID', 'Control Name', 'Process', 'Type', 'Frequency', 'Owner', 'Result', 'Exceptions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {controls.map((c, i) => (
                  <tr key={c.id} className={`border-b border-border-light/60 hover:bg-primary/[0.015] transition-colors ${i % 2 === 0 ? '' : 'bg-paper-50/40'}`}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-primary">{c.id}</td>
                    <td className="px-4 py-2.5 font-medium text-text">{c.name}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{c.process}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.type === 'Preventive' ? 'text-evidence-700 bg-evidence-50' : 'text-brand-700 bg-brand-50'}`}>{c.type}</span></td>
                    <td className="px-4 py-2.5 text-text-secondary">{c.freq}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{c.owner}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${resultColor(c.result)}`}>{c.result}</span></td>
                    <td className="px-4 py-2.5 text-center font-semibold">{c.exceptions > 0 ? <span className="text-risk-700">{c.exceptions}</span> : <span className="text-text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border-light bg-paper-50/50 flex items-center justify-between text-[10px] text-text-muted">
            <span>Showing {controls.length} of 54 tested controls</span>
            <span>8 Effective · 2 Deficient · 0 Pending</span>
          </div>
        </div>
        {/* Deficiency Detail */}
        <div className="bg-white rounded-[12px] border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-risk-700" /> Deficiency Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'DEF-001', control: 'CTR-003', title: 'Vendor Master Change — Missing Dual Approval', severity: 'Significant', status: 'In Remediation', due: 'Mar 31, 2026', owner: 'Deepak Bansal', desc: '7 vendor master changes processed without dual-approval. Includes 3 bank account modifications.' },
              { id: 'DEF-002', control: 'CTR-008', title: 'Journal Entry Override — Approval Bypass', severity: 'Material Weakness', status: 'Evidence Submitted', due: 'Mar 31, 2026', owner: 'Rohan Patel', desc: '7 journal entries posted bypassing approval workflow. Total value: 12.4L. Root cause: system configuration gap.' },
            ].map(d => (
              <div key={d.id} className="rounded-[12px] border border-border-light p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-[8px] bg-risk">{d.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.severity === 'Material Weakness' ? 'text-risk-700 bg-risk-50' : 'text-high-700 bg-high-50'}`}>{d.severity}</span>
                  <span className="text-[10px] font-semibold text-evidence-700 bg-evidence-50 px-2 py-0.5 rounded-full">{d.status}</span>
                </div>
                <h4 className="text-[12px] font-semibold text-text mb-1">{d.title}</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed mb-2">{d.desc}</p>
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  <span>Control: <span className="font-mono font-semibold text-primary">{d.control}</span></span>
                  <span>Due: <span className="font-semibold">{d.due}</span></span>
                  <span>Owner: {d.owner}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Risk Assessment — Risk matrix + risk register
  if (templateId === 'rt-002') {
    const risks = [
      { id: 'RSK-001', name: 'Unauthorized vendor payments', process: 'P2P', likelihood: 3, impact: 4, controls: 3, status: 'Mitigated' },
      { id: 'RSK-002', name: 'Revenue recognition errors', process: 'O2C', likelihood: 2, impact: 4, controls: 2, status: 'Mitigated' },
      { id: 'RSK-003', name: 'Duplicate payments', process: 'P2P', likelihood: 4, impact: 3, controls: 3, status: 'Partial' },
      { id: 'RSK-004', name: 'Fictitious vendor registration', process: 'P2P', likelihood: 3, impact: 5, controls: 0, status: 'Uncontrolled' },
      { id: 'RSK-005', name: 'GL misstatement', process: 'R2R', likelihood: 2, impact: 5, controls: 4, status: 'Mitigated' },
      { id: 'RSK-006', name: 'Inventory discrepancy', process: 'O2C', likelihood: 3, impact: 2, controls: 2, status: 'Mitigated' },
      { id: 'RSK-007', name: 'Malware via vendor portals', process: 'P2P', likelihood: 2, impact: 5, controls: 0, status: 'Uncontrolled' },
    ];
    const riskColor = (l: number, i: number) => {
      const score = l * i;
      if (score >= 12) return 'bg-risk';
      if (score >= 5) return 'bg-mitigated';
      return 'bg-compliant';
    };
    return (
      <div className="space-y-5">
        <div className="flex gap-2 flex-wrap">
          {sections.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-[8px] border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Risk Heatmap */}
        <div className="bg-white rounded-[12px] border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-4 flex items-center gap-2"><Shield size={14} className="text-primary" /> Risk Matrix</h3>
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 text-center">Impact →</div>
              <div className="grid grid-cols-5 gap-1">
                {[5,4,3,2,1].map(likelihood => (
                  [1,2,3,4,5].map(impact => {
                    const risksInCell = risks.filter(r => r.likelihood === likelihood && r.impact === impact);
                    return (
                      <div key={`${likelihood}-${impact}`} className={`aspect-square rounded-[8px] flex items-center justify-center text-[12px] font-bold text-white ${riskColor(likelihood, impact)} ${risksInCell.length > 0 ? 'ring-2 ring-white shadow-md' : 'opacity-30'}`}>
                        {risksInCell.length > 0 ? risksInCell.map(r => r.id.split('-')[1]).join(',') : ''}
                      </div>
                    );
                  })
                ))}
              </div>
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mt-1 -rotate-0">↑ Likelihood</div>
            </div>
            <div className="w-48">
              <div className="text-[11px] font-semibold text-text mb-2">Legend</div>
              <div className="space-y-1.5">
                {[{ c: 'bg-risk', l: 'High (12-25)' }, { c: 'bg-mitigated', l: 'Medium (5-11)' }, { c: 'bg-compliant', l: 'Low (1-4)' }].map(item => (
                  <div key={item.l} className="flex items-center gap-2 text-[11px] text-text-secondary"><div className={`w-3 h-3 rounded ${item.c}`} /> {item.l}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Risk Register */}
        <div className="bg-white rounded-[12px] border border-border-light overflow-hidden">
          <div className="px-5 py-3 border-b border-border-light">
            <h3 className="text-[13px] font-bold text-text flex items-center gap-2"><AlertTriangle size={14} className="text-high-700" /> Risk Register</h3>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-paper-50 border-b border-border-light">
                {['Risk ID', 'Description', 'Process', 'L', 'I', 'Score', 'Controls', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={r.id} className={`border-b border-border-light/60 hover:bg-primary/[0.015] transition-colors ${i % 2 === 0 ? '' : 'bg-paper-50/40'}`}>
                  <td className="px-4 py-2.5 font-mono font-semibold text-primary">{r.id}</td>
                  <td className="px-4 py-2.5 font-medium text-text">{r.name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.process}</td>
                  <td className="px-4 py-2.5 text-center">{r.likelihood}</td>
                  <td className="px-4 py-2.5 text-center">{r.impact}</td>
                  <td className="px-4 py-2.5 text-center"><span className={`inline-flex w-6 h-6 items-center justify-center rounded-[8px] text-[10px] font-bold text-white ${riskColor(r.likelihood, r.impact)}`}>{r.likelihood * r.impact}</span></td>
                  <td className="px-4 py-2.5 text-center font-semibold">{r.controls}</td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Mitigated' ? 'text-compliant-700 bg-compliant-50' : r.status === 'Partial' ? 'text-mitigated-700 bg-mitigated-50' : 'text-risk-700 bg-risk-50'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Control Effectiveness — Scorecard layout
  if (templateId === 'rt-003') {
    const processes = [
      { name: 'P2P', total: 24, tested: 17, effective: 15, deficient: 2, rate: 88 },
      { name: 'O2C', total: 18, tested: 8, effective: 7, deficient: 1, rate: 88 },
      { name: 'R2R', total: 31, tested: 26, effective: 23, deficient: 3, rate: 88 },
      { name: 'S2C', total: 14, tested: 3, effective: 3, deficient: 0, rate: 100 },
    ];
    return (
      <div className="space-y-5">
        <div className="flex gap-2 flex-wrap">
          {sections.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-[8px] border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Effectiveness Scorecards */}
        <div className="grid grid-cols-4 gap-3">
          {processes.map(p => (
            <div key={p.name} className="bg-white rounded-[12px] border border-border-light p-4 hover:shadow-primary/5 transition-all">
              <div className="text-[11px] font-semibold text-text-muted mb-2">{p.name}</div>
              <div className="text-[28px] font-bold text-text leading-none">{p.rate}%</div>
              <div className="text-[10px] text-text-muted mt-1 mb-3">Effectiveness Rate</div>
              {/* Progress bar */}
              <div className="h-2 bg-paper-50 rounded-full overflow-hidden mb-2">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(p.tested / p.total) * 100}%` }} transition={{ delay: 0.3, duration: 0.6 }} className="h-full rounded-full bg-primary" />
              </div>
              <div className="flex justify-between text-[9px] text-text-muted">
                <span>{p.tested}/{p.total} tested</span>
                <span>{p.deficient} deficient</span>
              </div>
            </div>
          ))}
        </div>
        {/* Gap Analysis Table */}
        <div className="bg-white rounded-[12px] border border-border-light overflow-hidden">
          <div className="px-5 py-3 border-b border-border-light">
            <h3 className="text-[13px] font-bold text-text flex items-center gap-2"><AlertTriangle size={14} className="text-high-700" /> Gap Analysis — Untested Controls</h3>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-paper-50 border-b border-border-light">
                {['Process', 'Untested', 'Deadline', 'Priority', 'Assigned To'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { process: 'P2P', untested: 7, deadline: 'Mar 31', priority: 'High', assignee: 'Tushar Goel' },
                { process: 'O2C', untested: 10, deadline: 'Mar 31', priority: 'High', assignee: 'Neha Joshi' },
                { process: 'R2R', untested: 5, deadline: 'Mar 31', priority: 'Medium', assignee: 'Karan Mehta' },
                { process: 'S2C', untested: 11, deadline: 'Jun 30', priority: 'Medium', assignee: 'Rohan Patel' },
              ].map((g, i) => (
                <tr key={g.process} className={`border-b border-border-light/60 hover:bg-primary/[0.015] transition-colors ${i % 2 === 0 ? '' : 'bg-paper-50/40'}`}>
                  <td className="px-4 py-2.5 font-semibold text-text">{g.process}</td>
                  <td className="px-4 py-2.5 font-bold text-risk-700">{g.untested}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{g.deadline}</td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${g.priority === 'High' ? 'text-risk-700 bg-risk-50' : 'text-mitigated-700 bg-mitigated-50'}`}>{g.priority}</span></td>
                  <td className="px-4 py-2.5 text-text-secondary">{g.assignee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Improvement Plan */}
        <div className="bg-white rounded-[12px] border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-primary" /> Improvement Plan</h3>
          <div className="space-y-2">
            {['Automate 5 manual detective controls in P2P — target: 98% effectiveness', 'Accelerate S2C control testing — hire 1 contractor for April-June sprint', 'Deploy AI anomaly detection on R2R reconciliation — reduce deficiency rate by 50%', 'Implement continuous monitoring for all preventive controls by Q2'].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2 bg-primary/[0.02] rounded-[8px]">
                <span className="text-[9px] font-bold text-primary bg-primary/10 w-5 h-5 rounded-[8px] flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="text-[11px] text-text-secondary leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Workflow Analytics — Dashboard-style with charts
  if (templateId === 'rt-004') {
    const workflows = [
      { name: 'Duplicate Invoice Detector', runs: 45, accuracy: 96, savings: '2.4L', trend: [82, 88, 91, 94, 96] },
      { name: 'Three-Way PO Match', runs: 28, accuracy: 87, savings: '1.1L', trend: [78, 80, 83, 85, 87] },
      { name: 'Vendor Master Monitor', runs: 24, accuracy: 98, savings: '0.8L', trend: [92, 94, 95, 97, 98] },
      { name: 'SOD Violation Detector', runs: 18, accuracy: 94, savings: '0.5L', trend: [88, 90, 91, 93, 94] },
    ];
    return (
      <div className="space-y-5">
        <div className="flex gap-2 flex-wrap">
          {sections.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-[8px] border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Workflow Performance Cards */}
        <div className="grid grid-cols-2 gap-3">
          {workflows.map(w => (
            <div key={w.name} className="bg-white rounded-[12px] border border-border-light p-4 hover:shadow-primary/5 transition-all">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[12px] font-semibold text-text">{w.name}</h4>
                <span className="text-[10px] font-bold text-compliant-700 bg-compliant-50 px-2 py-0.5 rounded-full">{w.accuracy}% accuracy</span>
              </div>
              <div className="flex items-end gap-4 mb-3">
                <div>
                  <div className="text-[20px] font-bold text-text">{w.runs}</div>
                  <div className="text-[9px] text-text-muted uppercase">Runs</div>
                </div>
                <div>
                  <div className="text-[20px] font-bold text-compliant-700">{w.savings}</div>
                  <div className="text-[9px] text-text-muted uppercase">Saved</div>
                </div>
                <div className="flex-1">
                  <svg width="100%" height="28" viewBox="0 0 100 28" preserveAspectRatio="none">
                    <polyline points={w.trend.map((v, i) => `${i * 25},${28 - ((v - 75) / 25) * 28}`).join(' ')} fill="none" stroke="#6a12cd" strokeWidth="1.5" strokeLinecap="round" />
                    <polyline points={`0,28 ${w.trend.map((v, i) => `${i * 25},${28 - ((v - 75) / 25) * 28}`).join(' ')} 100,28`} fill="rgba(106,18,205,0.06)" stroke="none" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Exception Breakdown */}
        <div className="bg-white rounded-[12px] border border-border-light overflow-hidden">
          <div className="px-5 py-3 border-b border-border-light">
            <h3 className="text-[13px] font-bold text-text flex items-center gap-2"><AlertTriangle size={14} className="text-high-700" /> Exception Breakdown</h3>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-paper-50 border-b border-border-light">
                {['Exception', 'Workflow', 'Type', 'Resolution', 'Time', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { id: 'EXC-001', workflow: 'Duplicate Detector', type: 'High-value match', resolution: 'Auto-resolved', time: '0.5h', status: 'Closed' },
                { id: 'EXC-002', workflow: 'PO Match', type: 'Variance > 5%', resolution: 'Manual review', time: '4.2h', status: 'Closed' },
                { id: 'EXC-003', workflow: 'Vendor Monitor', type: 'Bank account change', resolution: 'Escalated', time: '12h', status: 'Open' },
                { id: 'EXC-004', workflow: 'SOD Detector', type: 'Critical SOD', resolution: 'Under review', time: '—', status: 'Open' },
                { id: 'EXC-005', workflow: 'Duplicate Detector', type: 'Cross-vendor match', resolution: 'Auto-resolved', time: '0.3h', status: 'Closed' },
              ].map((e, i) => (
                <tr key={e.id} className={`border-b border-border-light/60 hover:bg-primary/[0.015] transition-colors ${i % 2 === 0 ? '' : 'bg-paper-50/40'}`}>
                  <td className="px-4 py-2.5 font-mono font-semibold text-primary">{e.id}</td>
                  <td className="px-4 py-2.5 text-text">{e.workflow}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{e.type}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{e.resolution}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{e.time}</td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.status === 'Closed' ? 'text-compliant-700 bg-compliant-50' : 'text-mitigated-700 bg-mitigated-50'}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Executive Dashboard — Board-ready KPI summary
  if (templateId === 'rt-006') {
    return (
      <div className="space-y-5">
        <div className="flex gap-2 flex-wrap">
          {sections.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-[8px] border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Compliance Score', value: '94.2%', delta: '+2.4%', sub: 'vs prior quarter', color: 'text-primary' },
            { label: 'Controls Effective', value: '48/54', delta: '89%', sub: 'effectiveness rate', color: 'text-compliant-700' },
            { label: 'Audit Progress', value: '58%', delta: 'On track', sub: '54 of 87 controls tested', color: 'text-evidence-700' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-[12px] border border-border-light p-5 text-center">
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">{m.label}</div>
              <div className={`text-[32px] font-bold leading-none ${m.color}`}>{m.value}</div>
              <div className="text-[11px] font-semibold text-compliant-700 mt-1">{m.delta}</div>
              <div className="text-[10px] text-text-muted">{m.sub}</div>
            </div>
          ))}
        </div>
        {/* Process Breakdown */}
        <div className="bg-white rounded-[12px] border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-primary" /> Process Performance</h3>
          <div className="space-y-3">
            {[
              { name: 'P2P — Procure to Pay', progress: 72, controls: '17/24', risk: 'High' },
              { name: 'O2C — Order to Cash', progress: 44, controls: '8/18', risk: 'Medium' },
              { name: 'R2R — Record to Report', progress: 85, controls: '26/31', risk: 'Low' },
              { name: 'S2C — Source to Contract', progress: 21, controls: '3/14', risk: 'Medium' },
            ].map(p => (
              <div key={p.name} className="flex items-center gap-4">
                <div className="w-48 text-[11px] font-medium text-text">{p.name}</div>
                <div className="flex-1 h-3 bg-paper-50 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${p.progress}%` }} transition={{ delay: 0.2, duration: 0.6 }} className="h-full rounded-full bg-primary" />
                </div>
                <span className="text-[11px] font-bold text-text w-10 text-right">{p.progress}%</span>
                <span className="text-[10px] text-text-muted w-12">{p.controls}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.risk === 'High' ? 'text-risk-700 bg-risk-50' : p.risk === 'Medium' ? 'text-mitigated-700 bg-mitigated-50' : 'text-compliant-700 bg-compliant-50'}`}>{p.risk}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Strategic Recommendations */}
        <div className="bg-white rounded-[12px] border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Strategic Recommendations</h3>
          <div className="space-y-2">
            {['Approve additional AI workflow investment for S2C process — projected 3x ROI based on P2P results', 'Remediate DEF-002 (journal entry override) before March 31 — material weakness impacting filing', 'Reallocate Tushar Goel from P2P to S2C support in April — P2P is 72% complete, S2C needs acceleration', 'Expand vendor master monitoring to O2C process — similar risk profile to P2P where it saved 2.4L'].map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 bg-primary/[0.02] rounded-[8px] border border-primary/5">
                <span className="text-[9px] font-bold text-white bg-primary w-5 h-5 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-[11px] text-text leading-relaxed">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default/fallback — just show sections with placeholder
  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {sections.map((s, i) => (
          <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-[8px] border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
            <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
          </div>
        ))}
      </div>
      {sections.map((s) => {
        const SIcon = SECTION_ICONS[s.icon] || FileText;
        return (
          <div key={s.name} className="bg-white rounded-[12px] border border-border-light p-5">
            <h3 className="text-[13px] font-bold text-text mb-2 flex items-center gap-2"><SIcon size={14} className="text-primary" /> {s.name}</h3>
            <div className="h-16 bg-paper-50 rounded-[12px] flex items-center justify-center text-[11px] text-text-muted border border-dashed border-border-light">
              Section content generated from {report.name} data
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Query Card Component ───
type QueryShape = { id: string; risk: string; severity: string; title: string; addedBy: string; kpis: { label: string; value: string; color: string }[]; summary: string; findings: string[]; observations: string[]; answer: string; chartData: number[] };

function parseNumeric(v: string): number {
  const match = String(v).match(/-?\d[\d,.]*/);
  if (!match) return 0;
  return Number(match[0].replace(/[,\s]/g, '')) || 0;
}

function computeQueryKpis(query: QueryShape) {
  const firstVal = parseNumeric((query.kpis ?? [])[0]?.value ?? '0');
  const total = firstVal > 0 ? firstVal : 40 + (query.id.charCodeAt(query.id.length - 1) % 120);
  const closed = Math.max(0, Math.round(total * (0.45 + ((query.id.charCodeAt(0) % 10) / 40))));
  const open = Math.max(0, total - closed);
  const healthPct = total > 0 ? Math.round((closed / total) * 100) : 0;
  return [
    { label: 'Total Exceptions', value: total.toLocaleString(),  icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
    { label: 'Open',             value: open.toLocaleString(),   icon: Loader2,       color: 'text-mitigated-700 bg-mitigated-50' },
    { label: 'Closed',           value: closed.toLocaleString(), icon: CheckCircle2,  color: 'text-compliant-700 bg-compliant-50' },
    { label: 'Check Health',     value: `${healthPct}%`,         icon: TrendingUp,    color: 'text-evidence-700 bg-evidence-50' },
  ];
}

// Simulated report download — shows a 'loading' toast that resolves to a
// 'success' toast after a short "preparing" delay. No real file is produced
// (the prototype's report exports are all mock).
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

/**
 * Gates the "Manage Exceptions" CTA behind an explicit "Generate Cases" toggle.
 * idle → switch off; user flips it on → brief generating state; once ready the
 * toggle is replaced inline by the existing ManageExceptionsLaunchButton.
 */
type CasesPhase = 'idle' | 'generating' | 'ready';

function GenerateCasesGate({ queryId, phase, onPhaseChange }: { queryId: string; phase: CasesPhase; onPhaseChange: (p: CasesPhase) => void }) {
  const handleToggle = () => {
    if (phase !== 'idle') return;
    onPhaseChange('generating');
    window.setTimeout(() => onPhaseChange('ready'), 1400);
  };

  if (phase === 'ready') {
    return <ManageExceptionsLaunchButton queryId={queryId} />;
  }

  const isOn = phase === 'generating';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={isOn ? 'Generating cases' : 'Generate cases'}
      onClick={handleToggle}
      disabled={isOn}
      className="inline-flex items-center gap-2 h-8 pl-2.5 pr-3 text-[12px] font-semibold text-text-secondary bg-white border border-border rounded-[8px] cursor-pointer hover:border-primary/40 hover:text-primary transition-colors"
    >
      <span
        className={`relative inline-flex w-8 h-[18px] rounded-full transition-colors duration-200 ${
          isOn ? 'bg-primary' : 'bg-border'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={`absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white shadow-sm ${
            isOn ? 'right-0.5' : 'left-0.5'
          }`}
        />
      </span>
      {isOn ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Generating cases…
        </span>
      ) : (
        'Generate Cases'
      )}
    </button>
  );
}

// ─── Reusable confirm dialog (delete/destructive prompts) ───
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, open, onClose);
  if (!open) return null;
  const titleId = `confirm-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const descId = `${titleId}-desc`;
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="relative bg-white rounded-[16px] border border-border-light shadow-2xl w-[440px] max-w-[calc(100vw-32px)] p-6"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-7 h-7 inline-flex items-center justify-center rounded-[8px] text-text-muted hover:text-text hover:bg-paper-50 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
          <h3 id={titleId} className="text-[16px] font-bold text-text tracking-tight mb-2">{title}</h3>
          <div id={descId} className="text-[13px] text-text-secondary leading-relaxed mb-6 pr-4">{description}</div>
          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`inline-flex items-center justify-center h-9 px-5 text-[13px] font-semibold text-white rounded-[8px] transition-colors cursor-pointer ${
                destructive ? 'bg-risk hover:bg-risk-700' : 'bg-primary hover:bg-primary-hover'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function QueryCard({ query, index, onOpenQuery, onDelete, comments = [], onAddComment, title }: { query: QueryShape; index: number; onOpenQuery?: (query: { id: string; title: string }) => void; onDelete?: () => void; comments?: QueryComment[]; onAddComment?: (queryId: string, queryTitle: string, text: string, attachment?: string) => void; title?: string }) {
  const { addToast } = useToast();
  const { can } = useCan();
  const safeQuery = query ?? { id: '', risk: '', severity: '', title: '', addedBy: '', kpis: [], summary: '', findings: [], observations: [], answer: '', chartData: [] } as QueryShape;
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const availableGraphs = QUERY_GRAPHS[safeQuery.id] ?? [];
  const queryTable = QUERY_TABLES[safeQuery.id];
  const queryKpis = computeQueryKpis(safeQuery);
  const [selectedKpis, setSelectedKpis] = useState<Set<string>>(() => new Set(queryKpis.map(k => k.label)));
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
  const [tableAttached, setTableAttached] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const baseDelay = index * 0.08;

  const severityStyle = safeQuery.severity === 'High'
    ? { pill: 'bg-risk-50 text-risk-700', dot: 'bg-risk-500' }
    : safeQuery.severity === 'Medium'
      ? { pill: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated-500' }
      : { pill: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-500' };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!query || !query.id) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-white border border-border-light overflow-hidden"
    >

      <div className="px-7 py-6">
        {/* Meta band — type-only line: Q01 · risk · severity · status on the left;
            Manage Exceptions (text-link), Comments, 3-dots on the right. */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="mb-4"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap text-[10px] font-semibold uppercase tracking-wider">
              <span className="font-mono text-[12px] text-primary tabular-nums shrink-0 normal-case tracking-normal">{query.id}</span>
              <span aria-hidden className="text-ink-300 select-none">·</span>
              <span className="text-text-muted shrink-0">{query.risk}</span>
              <span aria-hidden className="text-ink-300 select-none">·</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${severityStyle.dot}`} />
                <span className={query.severity === 'High' ? 'text-risk-700' : query.severity === 'Medium' ? 'text-mitigated-700' : 'text-compliant-700'}>{query.severity}</span>
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <ManageExceptionsLaunchButton queryId={query.id} compact />
              {can('rp_comment') && (() => {
                const myComments = comments.filter(c => c.queryId === query.id).length;
                return (
                  <button
                    onClick={() => setCommentsOpen(true)}
                    title="Comments on this query"
                    aria-label="Comments on this query"
                    className="relative inline-flex items-center justify-center w-7 h-7 -mx-1 text-text-muted rounded-[8px] cursor-pointer hover:text-primary hover:bg-primary-xlight/50 transition-colors"
                  >
                    <MessageSquare size={16} className="shrink-0" />
                    {myComments > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 text-[9px] font-semibold bg-primary text-white rounded-full tabular-nums border border-white">
                        {myComments}
                      </span>
                    )}
                  </button>
                );
              })()}
              <div className="relative -ml-1" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  title="More options"
                  aria-label="More options"
                  className="w-7 h-7 flex items-center justify-center rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-xlight/50 transition-colors cursor-pointer"
                >
                  <MoreVertical size={16} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 z-10 w-[200px] bg-white border border-border-light rounded-[8px] shadow-xl py-1">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenQuery?.({ id: query.id, title: query.title });
                      }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
                    >
                      <ExternalLink size={14} />
                      Open Query
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setWidgetModalOpen(true); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
                    >
                      <LayoutGrid size={14} />
                      Add Widgets
                    </button>
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
                    >
                      <Download size={14} />
                      Download
                    </button>
                    {can('rp_delete') && <>
                    <div className="my-1 border-t border-border-light" />
                    <button
                      onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-risk-700 hover:bg-risk-50 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      Delete Query
                    </button>
                    </>}
                  </div>
                )}
              </div>
            </div>
          </div>

        </motion.div>

        {/* Title — the question. Set in Source Serif 4 so it reads like an
            audit prompt on a printed page rather than a UI label. */}
        <motion.h3
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="text-[20px] font-semibold text-text leading-[1.3] tracking-[-0.005em] mb-4"
        >
          {query.title}
        </motion.h3>

        {/* Inline metrics — sit directly below the query title so the numbers
            read as the answer to the question above. Driven by the "Add
            Widgets" modal selection. */}
        {(() => {
          const kpis = queryKpis.filter(k => selectedKpis.has(k.label));
          if (kpis.length === 0) return null;
          return (
            <div className="flex items-baseline flex-wrap gap-x-6 gap-y-1.5 tabular-nums mb-5">
              {kpis.map((k, ki) => (
                <motion.span
                  key={k.label}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: baseDelay + 0.3 + ki * 0.05, duration: 0.3 }}
                  className="flex items-baseline gap-2"
                >
                  <span className="text-[16px] font-semibold text-text leading-none">
                    <KpiCountUp value={k.value} delay={120 + ki * 80} />
                  </span>
                  <span className="text-[12px] text-text-muted font-medium">{k.label}</span>
                </motion.span>
              ))}
            </div>
          );
        })()}

        {/* Attached charts — selected via the "Add Widgets" modal */}
        {availableGraphs.filter(g => selectedCharts.has(g.id)).map(g => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="bg-canvas-elevated border border-border-light rounded-[12px] p-4 mb-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                <BarChart3 size={12} />
                {g.title}
              </div>
              <button
                onClick={() => setSelectedCharts(prev => { const n = new Set(prev); n.delete(g.id); return n; })}
                title="Remove graph"
                aria-label="Remove graph"
                className="w-6 h-6 flex items-center justify-center rounded-[8px] text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="h-[200px]">
              <ConfigurableChart
                type={g.type}
                xAxis={g.xAxis}
                yAxis={g.yAxis}
                color={g.color ?? '#6a12cd'}
                showTarget={false}
                showLegend
              />
            </div>
          </motion.div>
        ))}

        {/* Attached results table — selected via the "Add Widgets" modal */}
        {tableAttached && queryTable && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="bg-canvas-elevated border border-border-light rounded-[12px] p-4 mb-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                <LayoutGrid size={12} />
                Results Table
              </div>
              <button
                onClick={() => setTableAttached(false)}
                title="Remove table"
                aria-label="Remove table"
                className="w-6 h-6 flex items-center justify-center rounded-[8px] text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="overflow-x-auto rounded-[12px] border border-border-light">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-paper-50">
                    {queryTable.columns.map(c => (
                      <th
                        key={c}
                        className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border-light whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryTable.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border-light last:border-b-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-[12px] text-text-secondary whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Answer — rendered in the chat's rich markdown format (shared renderer) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: baseDelay + 0.6, duration: 0.4 }}
        >
          {renderAssistantText(query.answer)}
        </motion.div>
      </div>

      {commentsOpen && createPortal(
        <CommentDrawer
          query={query}
          comments={comments}
          onAddComment={onAddComment}
          onClose={() => setCommentsOpen(false)}
        />,
        document.body,
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Remove Query Card?"
        description="Remove this query card from the report?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete?.();
        }}
      />

      {widgetModalOpen && createPortal(
        <QueryWidgetModal
          queryId={query.id}
          queryTitle={query.title}
          kpis={queryKpis}
          charts={availableGraphs}
          table={queryTable}
          initialKpis={selectedKpis}
          initialCharts={selectedCharts}
          initialTable={tableAttached}
          onConfirm={(sel) => {
            setSelectedKpis(sel.kpis);
            setSelectedCharts(sel.charts);
            setTableAttached(sel.table);
            setWidgetModalOpen(false);
            addToast({ type: 'success', message: 'Query card updated.' });
          }}
          onClose={() => setWidgetModalOpen(false)}
        />,
        document.body,
      )}
    </motion.div>
  );
}

// ─── "Choose What to Include" modal — multi-select KPIs, charts & table ───
// Mirrors the chat's Add-to-Report section picker so a query card is built
// from the same surface. Selection-driven: re-opening shows the current card
// state, and confirming applies it.
function QueryWidgetModal({
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
        className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]" />
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
          className="relative bg-white rounded-[16px] border border-border-light shadow-2xl w-[840px] max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border-light">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-[8px] bg-primary-xlight flex items-center justify-center shrink-0">
                <FileText size={16} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h3 id="query-widget-title" className="text-[16px] font-bold text-text tracking-tight">
                  Choose What to Include
                </h3>
                <p className="text-[12px] text-text-secondary mt-0.5 truncate">
                  <span className="font-mono text-[11px] text-primary">{queryId}</span>
                  <span className="mx-1.5 text-text-muted">·</span>
                  {queryTitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 inline-flex items-center justify-center rounded-[8px] text-text-muted hover:text-text hover:bg-paper-50 transition-colors cursor-pointer shrink-0"
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
                  <p className="text-[12px] text-text-muted" aria-live="polite">
                    {totalSelected === 0
                      ? 'Select what to show on the card.'
                      : `${totalSelected} item${totalSelected === 1 ? '' : 's'} selected`}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-[11px] font-semibold text-primary hover:text-primary-hover cursor-pointer"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-[11px] font-semibold text-text-muted hover:text-text cursor-pointer"
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
                                  ? 'border-primary shadow-[0_0_0_3px_rgba(106,18,205,0.12)]'
                                  : 'border-border-light hover:border-primary/40'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Checkbox checked={on} accent="brand" />
                                <span className="text-[12px] font-semibold text-text truncate">{g.title}</span>
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
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border-light bg-paper-50/40">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm({ kpis: selKpis, charts: selCharts, table: selTable })}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-white bg-primary hover:bg-primary-hover rounded-[8px] transition-colors cursor-pointer"
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

// ─── Query side-sheet — Comments ───
function CommentDrawer({
  query,
  comments,
  onAddComment,
  onClose,
}: {
  query: QueryShape;
  comments: QueryComment[];
  onAddComment?: (queryId: string, queryTitle: string, text: string, attachment?: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(containerRef, true, onClose);

  // Show only comments belonging to the query the user clicked from.
  const queryComments = comments.filter(c => c.queryId === query.id);
  const grouped = queryComments.reduce<Record<string, { queryId: string; queryTitle: string; items: QueryComment[] }>>((acc, c) => {
    if (!acc[c.queryId]) acc[c.queryId] = { queryId: c.queryId, queryTitle: c.queryTitle, items: [] };
    acc[c.queryId].items.push(c);
    return acc;
  }, {});
  const queryGroups = Object.values(grouped);
  const totalComments = queryComments.length;

  const handlePost = () => {
    const body = text.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    // Optimistic — clear inputs immediately so the new entry appears posted.
    onAddComment?.(query.id, query.title, body, attachment ?? undefined);
    setText('');
    setAttachment(null);
    // Release the busy state on the next frame; the parent state update has
    // already flushed by then.
    window.setTimeout(() => setIsPosting(false), 120);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.aside
        ref={(el) => { containerRef.current = el as HTMLElement | null; }}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-white shadow-xl border-l border-border-light flex flex-col z-[60]"
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
      >
        {/* Header strip + close */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-border-light bg-white">
          <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
            <MessageSquare size={14} className="shrink-0" />
            Comments
            <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 text-[10px] font-semibold rounded-full tabular-nums bg-primary/10 text-primary">
              {totalComments}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-text-muted hover:text-text hover:bg-primary-xlight flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Header (title + sub-text) */}
        <header className="shrink-0 px-6 py-5 border-b border-border-light">
          <h2 className="text-[16px] font-semibold text-text leading-tight">
            Comments
          </h2>
          <p className="text-[12px] text-text-muted mt-0.5 leading-snug">
            Commenting on{' '}
            <span className="font-mono font-semibold text-primary">{query.id}</span> — {query.title}
          </p>
        </header>

        <>
            {/* Comment input */}
            <section className="shrink-0 px-6 py-4 border-b border-border-light">
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Leave a comment on ${query.id}…`}
                  rows={3}
                  className="w-full resize-none p-3 pr-[72px] bg-white border border-border-light rounded-[8px] text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachment(f.name);
                  }}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-primary cursor-pointer"
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    <Paperclip size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handlePost}
                    disabled={!text.trim() || isPosting}
                    className={`w-7 h-7 flex items-center justify-center rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${
                      text.trim() && !isPosting
                        ? 'bg-[#6a12cd] text-white hover:bg-primary-hover cursor-pointer'
                        : 'text-text-muted/50 cursor-not-allowed'
                    }`}
                    aria-label="Post comment"
                    title="Post comment"
                  >
                    {isPosting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
              {attachment && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 h-6 px-2 bg-primary/10 text-primary text-[11px] font-medium rounded-full">
                    <Paperclip size={12} />
                    {attachment}
                  </span>
                  <button onClick={() => setAttachment(null)} className="text-[11px] text-text-muted hover:text-risk-700 cursor-pointer">remove</button>
                </div>
              )}
            </section>

            {/* Shared activity log */}
            <div className="flex-1 overflow-y-auto px-6 py-4" aria-live="polite">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Activity log</h3>
                <span className="text-[11px] text-text-muted tabular-nums">
                  {totalComments} {totalComments === 1 ? 'comment' : 'comments'} across {queryGroups.length} {queryGroups.length === 1 ? 'query' : 'queries'}
                </span>
              </div>
              {queryGroups.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No comments yet"
                  body="Notes, questions, and decisions on this query will appear here."
                  size="compact"
                />
              ) : (
                <div className="space-y-4">
                  {queryGroups.map(group => (
                    <section key={group.queryId} className="border border-border-light rounded-[12px] overflow-hidden">
                      <header className={`px-3 py-2 bg-paper-50 border-b border-border-light flex items-center justify-between ${group.queryId === query.id ? 'bg-primary/5' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] font-bold text-primary shrink-0">{group.queryId}</span>
                          <span className="text-[11px] text-text-muted truncate">{group.queryTitle}</span>
                        </div>
                        <span className="text-[10px] text-text-muted tabular-nums shrink-0">
                          {group.items.length} {group.items.length === 1 ? 'comment' : 'comments'}
                        </span>
                      </header>
                      <ol className="divide-y divide-border-light">
                        {group.items.slice().reverse().map(c => {
                          const isLong = c.text.length > 1000;
                          const isExpanded = expandedComments.has(c.id);
                          const displayText = isLong && !isExpanded ? c.text.slice(0, 1000) + '…' : c.text;
                          return (
                            <li key={c.id} className="px-3 py-3">
                              <div className="flex items-start gap-2.5">
                                <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold tracking-wider">
                                  {c.initials}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="text-[12px] font-semibold text-text">{c.author}</span>
                                    <span className="inline-flex items-center gap-1 text-[11px] text-text-muted tabular-nums whitespace-nowrap">
                                      <ClockIcon size={12} />
                                      {c.timestamp}
                                    </span>
                                  </div>
                                  <p className="text-[12px] text-text leading-relaxed whitespace-pre-wrap break-words">{displayText}</p>
                                  {isLong && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedComments(prev => {
                                        const next = new Set(prev);
                                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                                        return next;
                                      })}
                                      className="mt-1 text-[11px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded"
                                    >
                                      {isExpanded ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                  {c.attachment && (
                                    <span className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 bg-primary/10 text-primary text-[11px] font-medium rounded-full">
                                      <Paperclip size={12} />
                                      {c.attachment}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </>
      </motion.aside>
    </>
  );
}

// ─── Draggable query section (main content area reorder) ───
type SectionProps = {
  key: string;
  value: unknown;
  id: string;
  layout: true;
  initial: { opacity: number; y: number };
  animate: { opacity: number; y: number };
  exit: { opacity: number; y: number; scale: number };
  transition: { duration: number; ease: [number, number, number, number] };
  className: string;
  dragListener: false;
};

type QueryComment = { id: string; queryId: string; queryTitle: string; author: string; initials: string; timestamp: string; text: string; attachment?: string };

// ─── Report-level Activity Log Drawer ───
// Shows every comment / action across every query card on the report,
// chronologically, with a comment box at the top for new entries.
function ReportActivityLogDrawer({
  reportName,
  comments,
  onAddComment,
  onClose,
}: {
  reportName: string;
  comments: QueryComment[];
  onAddComment?: (queryId: string, queryTitle: string, text: string, attachment?: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(containerRef, true, onClose);

  // Newest first.
  const sorted = [...comments].reverse();

  const handlePost = () => {
    const body = text.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    // Report-level entries are tagged as global so they show across all surfaces.
    onAddComment?.('REPORT', `${reportName} — Report-level note`, body, attachment ?? undefined);
    setText('');
    setAttachment(null);
    window.setTimeout(() => setIsPosting(false), 120);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.aside
        ref={(el) => { containerRef.current = el as HTMLElement | null; }}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-white shadow-xl border-l border-border-light flex flex-col z-[60]"
        role="dialog"
        aria-modal="true"
        aria-label="Report activity log"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-border-light">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-text leading-tight">Report Activity Log</h2>
              <p className="text-[12px] text-text-muted mt-0.5 leading-snug">
                All actions and comments across every query card on this report.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-text-muted hover:text-text hover:bg-primary-xlight flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Comment input with attachment */}
        <section className="shrink-0 px-6 py-4 border-b border-border-light bg-paper-50">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment to the report activity log…"
              rows={3}
              className="w-full resize-none p-3 pr-10 bg-white border border-border-light rounded-[8px] text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAttachment(f.name);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-text-muted hover:text-primary cursor-pointer"
              aria-label="Attach file"
              title="Attach file"
            >
              <Paperclip size={14} />
            </button>
          </div>
          {attachment && (
            <div className="mt-2 inline-flex items-center gap-1.5 h-6 px-2 bg-primary/5 text-primary text-[11px] font-medium rounded-full">
              <Paperclip size={12} />
              {attachment}
              <button onClick={() => setAttachment(null)} className="hover:text-primary/70 cursor-pointer" aria-label="Remove attachment">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              onClick={handlePost}
              disabled={!text.trim() || isPosting}
              className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${
                text.trim() && !isPosting
                  ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
                  : 'bg-primary/40 text-white/80 cursor-not-allowed'
              }`}
            >
              {isPosting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {isPosting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </section>

        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto px-6 py-4" aria-live="polite">
          {sorted.length === 0 ? (
            <EmptyState
              icon={History}
              title="No activity yet"
              body="Edits, comments, and downloads will be tracked here."
              size="compact"
            />
          ) : (
            <ol className="space-y-4">
              {sorted.map(c => (
                <li key={c.id} className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold">
                    {c.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 mb-0.5">
                      <span className="text-[12px] font-semibold text-text">{c.author}</span>
                      <span className="text-[11px] text-text-muted tabular-nums whitespace-nowrap">{c.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mb-1.5">
                      <span className="inline-flex items-center h-4 px-1.5 font-mono font-medium bg-primary/5 text-primary rounded">
                        {c.queryId}
                      </span>{' '}
                      <span className="ml-1 line-clamp-1">{c.queryTitle}</span>
                    </div>
                    <p className="text-[12px] text-text leading-relaxed">{c.text}</p>
                    {c.attachment && (
                      <button className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 bg-primary/5 text-primary text-[11px] font-medium rounded-full hover:bg-primary/10 cursor-pointer">
                        <Paperclip size={12} />
                        {c.attachment}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </motion.aside>
    </>
  );
}

// Single row in the Contents table-of-contents block.
// Owns its own dragControls so each row is drag-handle-driven (not drag-on-row).
function ContentsRow({
  section,
  index,
  isEditing,
  draftValue,
  onDraftChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onScroll,
  onDelete,
}: {
  section: { id: string; title: string; kind: string };
  index: number;
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
      value={section}
      dragControls={controls}
      dragListener={false}
      className="group/crow relative flex items-center gap-2 py-2.5 pl-1 pr-1 rounded-[8px] hover:bg-primary-xlight/30 transition-colors list-none cursor-default"
    >
      <button
        onPointerDown={(e) => { controls.start(e); }}
        aria-label="Drag to reorder"
        className="shrink-0 p-1 text-text-muted/40 hover:text-text-muted cursor-grab active:cursor-grabbing opacity-20 group-hover/crow:opacity-100 transition-opacity touch-none"
      >
        <GripVertical size={14} />
      </button>
      <span className="shrink-0 w-6 text-[10px] text-text-muted/70 font-mono tabular-nums text-right">{String(index).padStart(2, '0')}</span>
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
          className="flex-1 min-w-0 bg-white border border-primary/40 rounded-[8px] px-2 py-1 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
      ) : (
        <button
          onClick={onScroll}
          className="flex-1 min-w-0 text-left text-[12px] text-text-secondary truncate transition-colors cursor-pointer"
        >
          {section.title}
        </button>
      )}
      {!isEditing && (
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/crow:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            aria-label="Rename section"
            className="p-1.5 rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete section"
            className="p-1.5 rounded-[8px] text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </Reorder.Item>
  );
}

function ObservationActionsMenu({
  hasAttachment,
  attachmentHidden,
  onEdit,
  onToggleAttachment,
  onDelete,
}: {
  hasAttachment: boolean;
  attachmentHidden: boolean;
  onEdit: () => void;
  onToggleAttachment: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Portal-positioned menu — escapes ancestor `overflow-hidden` + stacking contexts,
  // and flips up when the trigger is too close to the viewport bottom.
  const handleToggle = () => {
    const next = !open;
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = hasAttachment ? 160 : 120;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < estimatedHeight + 16;
      const style: React.CSSProperties = {
        position: 'fixed',
        right: window.innerWidth - rect.right,
        zIndex: 1000,
      };
      if (flipUp) {
        style.bottom = window.innerHeight - rect.top + 6;
      } else {
        style.top = rect.bottom + 6;
      }
      setMenuStyle(style);
    }
    setOpen(next);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        title="More options"
        aria-label="More options"
        className="w-8 h-8 flex items-center justify-center rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer"
      >
        <MoreVertical size={16} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="w-[210px] bg-white border border-border-light rounded-[8px] shadow-xl py-1"
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
          >
            <Edit3 size={14} />
            Edit observation
          </button>
          {hasAttachment && (
            <button
              onClick={() => { setOpen(false); onToggleAttachment(); }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
            >
              {attachmentHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {attachmentHidden ? 'Show attachment' : 'Hide attachment'}
            </button>
          )}
          <div className="my-1 border-t border-border-light/60" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-risk-700 hover:bg-risk-50 cursor-pointer"
          >
            <Trash2 size={14} />
            Delete observation
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// Visual twin of QueryCard — same motion timing and type scale. Renders an
// observation as a flush continuous-sheet block when `attached` (the default,
// sitting beside QueryCards) or as a standalone bordered card otherwise.
function ObservationCard({
  obs,
  index,
  onEdit,
  onToggleAttachment,
  onDelete,
  attached = true,
}: {
  obs: { id: string; obsId: string; title: string; description: string; attachments?: ObservationAttachment[]; attachmentHidden?: boolean };
  index: number;
  onEdit: () => void;
  onToggleAttachment: () => void;
  onDelete: () => void;
  attached?: boolean;
}) {
  const attachments = obs.attachments ?? [];
  const visibleAttachments = obs.attachmentHidden ? [] : attachments;
  const imageAttachments = visibleAttachments.filter(a => isImageMime(a.mimeType));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const baseDelay = index * 0.08;

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex(i => (i === null ? i : (i + 1) % imageAttachments.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex(i => (i === null ? i : (i - 1 + imageAttachments.length) % imageAttachments.length));
      }
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, imageAttachments.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative bg-white overflow-hidden ${attached ? 'border-x border-b border-border-light' : 'border border-border-light rounded-[12px]'}`}
    >
      <div className="px-6 py-5">
        {/* Meta row — mirrors QueryCard */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="flex items-center justify-between mb-4 gap-4"
        >
          <div className="flex items-center gap-2.5 text-[11px] min-w-0">
            <span className="font-bold text-primary uppercase tracking-wider shrink-0">{obs.obsId}</span>
            <span className="w-px h-3 bg-border-light shrink-0" />
            <span className="font-medium text-text-muted uppercase tracking-wider shrink-0">Observation</span>
          </div>
          <ObservationActionsMenu
            hasAttachment={attachments.length > 0}
            attachmentHidden={!!obs.attachmentHidden}
            onEdit={onEdit}
            onToggleAttachment={onToggleAttachment}
            onDelete={onDelete}
          />
        </motion.div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="text-[15px] font-semibold text-text leading-[1.5] mb-5"
        >
          {obs.title}
        </motion.h3>

        {/* Description */}
        {obs.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: baseDelay + 0.4, duration: 0.4 }}
            className="text-[13px] text-text-secondary leading-relaxed mb-4 whitespace-pre-wrap"
          >
            {obs.description}
          </motion.p>
        )}

        {/* Attachments — images as thumbnails (open lightbox with prev/next
            across image siblings), non-images as chip rows that open the
            data URL in a new tab so the browser previews / downloads. */}
        {visibleAttachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: baseDelay + 0.5, duration: 0.35 }}
            className="flex flex-wrap gap-2.5"
          >
            {visibleAttachments.map((att) => {
              if (isImageMime(att.mimeType)) {
                const imageIdx = imageAttachments.findIndex(a => a.id === att.id);
                return (
                  <motion.button
                    key={att.id}
                    type="button"
                    onClick={() => setLightboxIndex(imageIdx)}
                    whileHover={{ scale: 1.02 }}
                    title={`${att.name} — click to view full size`}
                    aria-label={`Open ${att.name} in full screen`}
                    className="block w-[88px] h-[88px] rounded-[12px] border border-border-light overflow-hidden bg-paper-50 cursor-zoom-in hover:border-primary/40 transition-colors"
                  >
                    <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                  </motion.button>
                );
              }
              const { Icon, tone } = attachmentVisual(att.mimeType);
              const inlineMime = att.mimeType === 'application/pdf';
              return (
                <a
                  key={att.id}
                  href={att.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={inlineMime ? undefined : att.name}
                  title={`${att.name} — ${formatFileSize(att.size)}`}
                  className="inline-flex items-center gap-2 max-w-[260px] h-[36px] px-2.5 bg-paper-50 border border-border-light rounded-[8px] hover:border-primary/40 hover:bg-white transition-colors group"
                >
                  <Icon size={14} className={`shrink-0 ${tone}`} />
                  <span className="text-[12px] text-text font-medium truncate group-hover:text-primary">{att.name}</span>
                  <span className="text-[10px] text-text-muted tabular-nums shrink-0">{formatFileSize(att.size)}</span>
                </a>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Fullscreen lightbox — only fires for image attachments. */}
      {lightboxIndex !== null && imageAttachments[lightboxIndex] && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-[1100] bg-ink-900/85 flex items-center justify-center p-8 cursor-zoom-out"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            aria-label="Close preview"
            className="absolute top-5 right-5 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm"
          >
            <X size={20} />
          </button>
          {imageAttachments.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(i => (i === null ? i : (i - 1 + imageAttachments.length) % imageAttachments.length));
                }}
                aria-label="Previous image"
                className="absolute left-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(i => (i === null ? i : (i + 1) % imageAttachments.length));
                }}
                aria-label="Next image"
                className="absolute right-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <motion.img
            key={imageAttachments[lightboxIndex].id}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            src={imageAttachments[lightboxIndex].dataUrl}
            alt={imageAttachments[lightboxIndex].name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-[12px] shadow-2xl cursor-default"
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[12px] text-white/80 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm">
            <span>{obs.obsId}</span>
            <span className="text-white/40">·</span>
            <span>{imageAttachments[lightboxIndex].name}</span>
            {imageAttachments.length > 1 && (
              <>
                <span className="text-white/40">·</span>
                <span className="tabular-nums">{lightboxIndex + 1} / {imageAttachments.length}</span>
              </>
            )}
          </div>
        </motion.div>,
        document.body,
      )}
    </motion.div>
  );
}

// Bulk-audit counterpart of QueryCard. Same chrome (continuous-sheet block,
// motion stagger, meta row with primary id, generate-cases gate) but the body
// is workflow-shaped: severity, optional risk owner, findings, observations,
// and an output data table from the run.
function WorkflowResultCard({
  workflow,
  index,
  casesPhase,
  onCasesPhaseChange,
  onUpdateRiskOwner,
  onDelete,
}: {
  workflow: WorkflowResult;
  index: number;
  casesPhase: CasesPhase;
  onCasesPhaseChange: (phase: CasesPhase) => void;
  onUpdateRiskOwner?: (owner: string) => void;
  onDelete?: () => void;
}) {
  const { addToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState(workflow.riskOwner ?? '');
  const menuRef = useRef<HTMLDivElement>(null);
  const baseDelay = index * 0.08;

  const severityStyle = workflow.severity === 'High'
    ? { pill: 'bg-risk-50 text-risk-700', dot: 'bg-risk-500' }
    : workflow.severity === 'Medium'
      ? { pill: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated-500' }
      : { pill: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-500' };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const commitOwner = () => {
    const trimmed = ownerDraft.trim();
    onUpdateRiskOwner?.(trimmed);
    setEditingOwner(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative border-x border-b border-border-light bg-white overflow-hidden"
    >
      <div className="px-6 py-5">
        {/* Meta row */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="flex items-center justify-between mb-4 gap-4"
        >
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
              <span className={`w-1.5 h-1.5 rounded-full ${severityStyle.dot}`} />
              <span className={`font-semibold uppercase tracking-wider ${workflow.severity === 'High' ? 'text-risk-700' : workflow.severity === 'Medium' ? 'text-mitigated-700' : 'text-compliant-700'}`}>{workflow.severity}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <GenerateCasesGate queryId={workflow.id} phase={casesPhase} onPhaseChange={onCasesPhaseChange} />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                title="More options"
                aria-label="More options"
                className="w-8 h-8 flex items-center justify-center rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-10 w-[200px] bg-white border border-border-light rounded-[8px] shadow-xl py-1">
                  {onDelete && (
                    <button
                      onClick={() => { setMenuOpen(false); onDelete(); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-risk-700 hover:bg-risk-50 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Title row: workflow name + inline risk owner */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="mb-5"
        >
          <h3 className="text-[15px] font-semibold text-text leading-[1.5] mb-2">
            {workflow.name}
          </h3>

          {/* Risk owner — inline editable. Filled state renders as initials chip + name; empty state stays understated. */}
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-text-muted">Risk owner</span>
            {editingOwner ? (
              <input
                autoFocus
                value={ownerDraft}
                onChange={(e) => setOwnerDraft(e.target.value)}
                onBlur={commitOwner}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitOwner();
                  if (e.key === 'Escape') { setOwnerDraft(workflow.riskOwner ?? ''); setEditingOwner(false); }
                }}
                placeholder="e.g., Priya Mehta"
                className="flex-1 max-w-[280px] px-2 py-1 text-[12px] text-text border border-primary/40 rounded-[8px] focus:outline-none focus:border-primary"
              />
            ) : workflow.riskOwner ? (
              <button
                onClick={() => { setOwnerDraft(workflow.riskOwner ?? ''); setEditingOwner(true); }}
                className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[8px] hover:bg-primary-xlight transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold tabular-nums">
                  {workflow.riskOwner.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="text-text font-medium">{workflow.riskOwner}</span>
              </button>
            ) : (
              <button
                onClick={() => { setOwnerDraft(''); setEditingOwner(true); }}
                className="text-text-muted hover:text-primary transition-colors cursor-pointer"
              >
                Unassigned · <span className="underline">assign</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Findings + Observations */}
        <div className="space-y-6 pt-1">
          {[
            { title: 'Findings', items: workflow.findings, emptyCopy: 'No findings recorded for this workflow yet.' },
            { title: 'Observations', items: workflow.observations, emptyCopy: 'No observations recorded for this workflow yet.' },
          ].map(section => (
            <div key={section.title}>
              <h4 className="flex items-center gap-2 text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-3">
                <span>{section.title}</span>
                {section.items.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-paper-50 text-text-muted text-[10px] font-semibold tabular-nums">
                    {section.items.length}
                  </span>
                )}
              </h4>
              {section.items.length === 0 ? (
                <p className="text-[12px] text-text-muted italic">{section.emptyCopy}</p>
              ) : (
                <ul className="space-y-2.5">
                  {section.items.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: baseDelay + 0.4 + i * 0.05, duration: 0.3 }}
                      className="flex gap-2.5 text-[13px] text-text leading-relaxed"
                    >
                      <div className="w-1 h-1 rounded-full mt-2 shrink-0 bg-primary/60" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* Output table */}
          {workflow.outputTable && workflow.outputTable.rows.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-3">
                <span>Output</span>
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-paper-50 text-text-muted text-[10px] font-semibold tabular-nums">
                  {workflow.outputTable.rows.length}
                </span>
              </h4>
              <div className="border border-border-light rounded-[12px] overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-paper-50/70">
                      {workflow.outputTable.columns.map((col, ci) => (
                        <th
                          key={col}
                          className={`px-3 py-2 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-light ${ci === workflow.outputTable!.columns.length - 1 ? 'text-right' : 'text-left'}`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workflow.outputTable.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="hover:bg-primary-xlight/30 transition-colors"
                      >
                        {row.map((cell, ci) => {
                          const cellStr = String(cell);
                          const isSeverity = cellStr === 'High' || cellStr === 'Medium' || cellStr === 'Low';
                          const isLast = ci === row.length - 1;
                          const isId = ci === 0;
                          return (
                            <td
                              key={ci}
                              className={`px-3 py-2 text-text border-b border-border-light/60 last:border-b-0 ${isLast ? 'text-right' : ''} ${isId ? 'font-mono text-[12px] text-text-secondary tabular-nums' : ''}`}
                            >
                              {isSeverity ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[8px] text-[10px] font-semibold ${
                                    cellStr === 'High'
                                      ? 'bg-risk-50 text-risk-700'
                                      : cellStr === 'Medium'
                                        ? 'bg-mitigated-50 text-mitigated-700'
                                        : 'bg-compliant-50 text-compliant-700'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      cellStr === 'High'
                                        ? 'bg-risk-500'
                                        : cellStr === 'Medium'
                                          ? 'bg-mitigated-500'
                                          : 'bg-compliant-500'
                                    }`}
                                  />
                                  {cellStr}
                                </span>
                              ) : (
                                cell
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-3 py-2 bg-paper-50/40 border-t border-border-light/60 text-[11px] text-text-muted">
                  <span>{workflow.outputTable.rows.length} {workflow.outputTable.rows.length === 1 ? 'record' : 'records'}</span>
                  <button
                    onClick={() => addToast({ type: 'success', message: `Exporting ${workflow.workflowId} output as CSV…` })}
                    className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                  >
                    <Download size={12} />
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DraggableQuerySection({
  section,
  index,
  sectionProps,
  onOpenQuery,
  onDelete,
  comments,
  onAddComment,
}: {
  section: { id: string; kind: 'query'; title: string; query: QueryShape };
  index: number;
  sectionProps: SectionProps;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  onDelete: () => void;
  comments: QueryComment[];
  onAddComment: (queryId: string, queryTitle: string, text: string, attachment?: string) => void;
}) {
  return (
    <Reorder.Item {...sectionProps} className={`${sectionProps.className} relative`}>
      <QueryCard
        query={section.query}
        index={index}
        title={section.title}
        onOpenQuery={onOpenQuery}
        onDelete={onDelete}
        comments={comments}
        onAddComment={onAddComment}
      />
    </Reorder.Item>
  );
}

// ─── Attached Query Card — compact pending card for queries the user just attached ───

function AttachedQueryCard({ query, index, onRemove }: {
  query: AttachedQuery;
  index: number;
  onRemove: (id: string) => void;
}) {
  const KindIcon = query.kind === 'query' ? MessageSquare : query.kind === 'upload' ? Upload : Database;
  const kindLabel = query.kind === 'query' ? 'Saved Query' : query.kind === 'upload' ? 'Uploaded File' : 'Data Source';
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Resolve the modal label to a REPORT_QUERIES_ATR entry. Only saved queries
  // map to canned data; uploads and ad-hoc data sources have no preview.
  const resolved: ReportQueryAtr | null =
    query.kind === 'query' && QUERY_LABEL_TO_KEY[query.label]
      ? REPORT_QUERIES_ATR[QUERY_LABEL_TO_KEY[query.label]]
      : null;

  type Phase = 'syncing' | 'ready' | 'noPreview';
  const [phase, setPhase] = useState<Phase>('syncing');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase(resolved ? 'ready' : 'noPreview');
    }, 1500);
    return () => clearTimeout(timer);
  }, [resolved]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white border border-border-light rounded-[12px] px-6 py-5"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-[8px] bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
          <KindIcon size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-primary/80">{kindLabel}</span>
            <span className="text-[10px] text-text-muted">·</span>
            <span className="text-[10px] text-text-muted">Attached {query.attachedAt} by {query.attachedBy}</span>
          </div>
          <h3 className="text-[14px] font-bold text-text tracking-tight leading-snug">{query.label}</h3>
        </div>
        <button
          onClick={() => setShowRemoveConfirm(true)}
          aria-label="Remove attached query"
          className="p-1.5 rounded-[8px] text-text-muted hover:text-high-700 hover:bg-high-50 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
        >
          <X size={14} />
        </button>
      </div>
      <ConfirmDialog
        open={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={() => { setShowRemoveConfirm(false); onRemove(query.id); }}
        title="Remove attached query?"
        description={<>This will detach <span className="font-semibold text-text">{query.label}</span> from the report. You can re-attach it later.</>}
        confirmLabel="Remove"
        destructive
      />

      <AnimatePresence mode="wait">
        {phase === 'syncing' && (
          <motion.div
            key="syncing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 border border-dashed border-brand-200 rounded-[12px] bg-brand-50/40 px-5 py-4 flex items-center gap-3"
          >
            <Loader2 size={14} className="text-primary animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-primary mb-0.5">Data syncing</p>
              <p className="text-[11px] text-text-muted">Running query against your data — preview will appear in a moment.</p>
            </div>
          </motion.div>
        )}

        {phase === 'ready' && resolved && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-4"
          >
            {/* Summary */}
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-text-muted mb-1.5">Summary</div>
              <p className="text-[12px] leading-relaxed text-text">{resolved.summary}</p>
            </div>

            {/* Findings */}
            {resolved.findings.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb size={12} className="text-evidence-700" />
                  <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-text-muted">Findings</span>
                  <span className="text-[10px] text-text-muted">·</span>
                  <span className="text-[10px] text-text-muted">{resolved.findings.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {resolved.findings.map((f, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-text leading-relaxed">
                      <span className="text-evidence-700 shrink-0 mt-1">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Observations */}
            {resolved.observations.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Eye size={12} className="text-primary" />
                  <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-text-muted">Observations</span>
                  <span className="text-[10px] text-text-muted">·</span>
                  <span className="text-[10px] text-text-muted">{resolved.observations.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {resolved.observations.map((o, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-text leading-relaxed">
                      <span className="text-primary shrink-0 mt-1">•</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {phase === 'noPreview' && (
          <motion.div
            key="noPreview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 border border-dashed border-border-light rounded-[12px] bg-paper-50/40 px-5 py-4 flex items-center gap-3"
          >
            <PackageOpen size={14} className="text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-text mb-0.5">Preview not available</p>
              <p className="text-[11px] text-text-muted">
                {query.kind === 'upload'
                  ? 'Uploaded files render once the parser finishes — wire your data pipeline to enable preview.'
                  : query.kind === 'source'
                    ? 'Connected data sources render once a query is run against them.'
                    : 'This query has no canned preview yet — connect it to your data to see results.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ─── Add Query Modal — picker for attaching a query/source to a report ───

// Maps modal labels to REPORT_QUERIES_ATR keys so the AttachedQueryCard can
// resolve to real summary/findings/observations after the simulated sync.
const QUERY_LABEL_TO_KEY: Record<string, keyof typeof REPORT_QUERIES_ATR> = {
  'Detect duplicate invoice entries across vendors': 'Q01',
  'Duplicate invoice detection summary': 'Q01',
  'Show unauthorized vendor master changes — last 90 days': 'Q02',
  'Unauthorized vendor master changes — quarterly review': 'Q02',
  'Risk identification across P2P, O2C, R2R, S2C processes': 'RA01',
  'Risk register — 12 critical risks across processes': 'RA01',
  'Mitigation strategy effectiveness — partially mitigated high risks': 'RA02',
  'Control testing results — effectiveness across 87 controls': 'CE01',
  'Control testing — effective vs requires remediation': 'CE01',
  'Workflow execution performance — runs and accuracy': 'WA01',
  'Exception trend analysis — flagged vs resolved': 'WA02',
  'Board-level GRC posture summary': 'EX01',
  'GRC posture for board reporting': 'EX01',
};

type AddQueryTab = 'recent' | 'saved' | 'upload' | 'all' | 'files' | 'db';

function AddQueryModal({ open, onClose, onAttach }: {
  open: boolean;
  onClose: () => void;
  onAttach: (selection: { kind: 'query' | 'source' | 'upload'; label: string }) => void;
}) {
  const [activeTab, setActiveTab] = useState<AddQueryTab>('recent');
  const [search, setSearch] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, open, onClose);

  if (!open) return null;

  const allSources = SEED;
  const fileSources = allSources.filter(s => s.type === 'file');
  const dbSources = allSources.filter(s => s.type === 'database' || s.type === 'api' || s.type === 'cloud');

  const handleClose = () => {
    setActiveTab('recent');
    setSearch('');
    setSelectedQuery(null);
    setSelectedSource(null);
    setUploadedFile(null);
    setDragging(false);
    onClose();
  };

  const handleAttach = () => {
    if (isAttaching) return;
    setIsAttaching(true);
    // Resolve once parent state has settled.
    window.setTimeout(() => {
      if ((activeTab === 'recent' || activeTab === 'saved') && selectedQuery) {
        onAttach({ kind: 'query', label: selectedQuery });
        handleClose();
      } else if (activeTab === 'upload' && uploadedFile) {
        onAttach({ kind: 'upload', label: uploadedFile.name });
        handleClose();
      } else if ((activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && selectedSource) {
        const src = allSources.find(s => s.id === selectedSource);
        if (src) {
          onAttach({ kind: 'source', label: src.name });
          handleClose();
        }
      }
      setIsAttaching(false);
    }, 120);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label="Add Query"
            className="relative bg-canvas-elevated rounded-[16px] border border-canvas-border shadow-2xl flex flex-col overflow-hidden w-[840px] h-[600px]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-4 border-b border-canvas-border">
              <h2 className="text-[16px] font-bold text-ink-900 shrink-0">Add Query</h2>
              <div className="flex-1 mx-5 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={activeTab === 'upload' ? 'Drop files below to upload...' : 'Search...'}
                  className="w-full pl-10 pr-4 py-2 text-[13px] border border-canvas-border rounded-full bg-canvas-elevated text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors"
                />
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-[8px] hover:bg-surface-2 transition-colors cursor-pointer shrink-0">
                <X size={20} className="text-ink-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-5 px-7 border-b border-canvas-border">
              {([
                { id: 'recent' as AddQueryTab, label: 'Recent Chats', icon: MessageSquare, count: QUERY_SESSIONS.reduce((n, g) => n + g.items.length, 0) },
                { id: 'saved' as AddQueryTab, label: 'Favourites', icon: Star, count: FAVOURITES.reduce((n, g) => n + g.items.length, 0) },
                { id: 'upload' as AddQueryTab, label: 'Upload', icon: Upload, count: 0 },
                { id: 'all' as AddQueryTab, label: 'All Data', icon: Layers, count: allSources.length },
                { id: 'files' as AddQueryTab, label: 'Files', icon: FileText, count: fileSources.length },
                { id: 'db' as AddQueryTab, label: 'DB', icon: Database, count: dbSources.length },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedQuery(null); setSelectedSource(null); }}
                  className={`flex items-center gap-1.5 pb-3 pt-3 text-[13px] font-semibold transition-colors cursor-pointer relative whitespace-nowrap ${
                    activeTab === tab.id ? 'text-brand-700' : 'text-ink-400 hover:text-ink-600'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                  {tab.count > 0 && <span className="text-[11px] text-ink-400 font-normal">{tab.count}</span>}
                  {activeTab === tab.id && (
                    <motion.div layoutId="add-query-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-7 py-6">
              <AnimatePresence mode="wait">
                {(activeTab === 'recent' || activeTab === 'saved') && (() => {
                  const groups = activeTab === 'recent' ? QUERY_SESSIONS : FAVOURITES;
                  const hasResults = groups.some(g => g.items.some(q => q.toLowerCase().includes(search.toLowerCase())));
                  return (
                    <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      {hasResults ? (
                        <div className="space-y-4">
                          {groups.map(group => {
                            const filtered = group.items.filter(q => q.toLowerCase().includes(search.toLowerCase()));
                            if (filtered.length === 0) return null;
                            return (
                              <div key={group.group || 'ungrouped'}>
                                {group.group && <div className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-2">{group.group}</div>}
                                <div className="space-y-2">
                                  {filtered.map(q => (
                                    <button
                                      key={q}
                                      onClick={() => setSelectedQuery(q)}
                                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] border transition-all cursor-pointer text-left ${
                                        selectedQuery === q ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                                      }`}
                                    >
                                      {activeTab === 'recent'
                                        ? <MessageSquare size={14} className={selectedQuery === q ? 'text-brand-600' : 'text-ink-400'} />
                                        : <Star size={14} className={selectedQuery === q ? 'text-brand-600' : 'text-ink-400'} />}
                                      <span className={`text-[13px] ${selectedQuery === q ? 'text-brand-700 font-medium' : 'text-ink-700'}`}>{q}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          {activeTab === 'recent' ? <MessageSquare size={32} className="text-ink-200 mb-3" /> : <Star size={32} className="text-ink-200 mb-3" />}
                          <p className="text-[14px] font-medium text-ink-500 mb-1">
                            {activeTab === 'recent' ? 'No chats found' : 'No favourites found'}
                          </p>
                          <p className="text-[12px] text-ink-400">
                            {search ? 'Try a different search term.' : activeTab === 'recent' ? 'Start a new chat to see it here.' : 'Star a chat to add it to favourites.'}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  );
                })()}

                {activeTab === 'upload' && (
                  <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                    <input
                      id="add-query-file-input"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f); }}
                    />
                    <div
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setUploadedFile(f); }}
                      onClick={() => !uploadedFile && document.getElementById('add-query-file-input')?.click()}
                      className={`border-2 border-dashed rounded-[12px] p-12 flex flex-col items-center justify-center text-center transition-all min-h-[300px] ${
                        dragging
                          ? 'border-brand-500 bg-brand-50'
                          : uploadedFile
                            ? 'border-compliant bg-green-50/30 cursor-default'
                            : 'border-ink-200 bg-surface-2/30 cursor-pointer hover:border-brand-300 hover:bg-brand-50/20'
                      }`}
                    >
                      {uploadedFile ? (
                        <div>
                          <CloudUpload size={32} className="text-green-600 mx-auto mb-3" />
                          <h3 className="text-[15px] font-bold text-ink-900 mb-1">{uploadedFile.name}</h3>
                          <p className="text-[13px] text-compliant font-medium mb-1">
                            {(uploadedFile.size / 1024).toFixed(1)} KB — File ready
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); setUploadedFile(null); }}
                            className="text-[12px] text-ink-400 hover:text-red-500 transition-colors cursor-pointer mt-1"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload size={32} className="text-ink-300 mb-3" />
                          <h3 className="text-[14px] font-semibold text-ink-800 mb-1">Drop files here</h3>
                          <p className="text-[13px] text-ink-400 mb-4">or pick from your computer</p>
                          <button
                            onClick={e => { e.stopPropagation(); document.getElementById('add-query-file-input')?.click(); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold rounded-[8px] transition-colors cursor-pointer"
                          >
                            <Upload size={14} />
                            Choose files
                          </button>
                          <p className="text-[11px] text-ink-400 mt-3">CSV · Excel · ≤ 50 MB each</p>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {(activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && (() => {
                  const sources = (activeTab === 'all' ? allSources : activeTab === 'files' ? fileSources : dbSources)
                    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
                  const tabLabel = activeTab === 'all' ? 'data sources' : activeTab === 'files' ? 'files' : 'databases';
                  return (
                    <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      {sources.length > 0 ? (
                        <div className="space-y-1.5">
                          {sources.map(source => {
                            const meta = TYPE_META[source.type];
                            const Icon = meta.icon;
                            const isSelected = selectedSource === source.id;
                            return (
                              <button
                                key={source.id}
                                onClick={() => setSelectedSource(isSelected ? null : source.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] border transition-all cursor-pointer text-left ${
                                  isSelected ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                                }`}
                              >
                                <div className={`size-8 rounded-[8px] flex items-center justify-center shrink-0 ${meta.tone}`}>
                                  <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-ink-900 truncate">{source.name}</div>
                                  <div className="text-[11px] text-ink-400">{source.subtype} · {formatDate(source.createdAt)}</div>
                                </div>
                                {isSelected && <Check size={16} className="text-brand-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Search size={32} className="text-ink-200 mb-3" />
                          <p className="text-[14px] font-medium text-ink-500 mb-1">No {tabLabel} found</p>
                          <p className="text-[12px] text-ink-400">
                            {search ? 'Try a different search term.' : `No ${tabLabel} available.`}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-canvas-border">
              <p className="text-[12px] text-ink-400 mr-auto">Pick a saved query, file, or data source to attach.</p>
              <button onClick={handleClose} className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold text-text bg-white border border-border-light hover:bg-paper-50 transition-colors cursor-pointer">
                Cancel
              </button>
              {(() => {
                const enabled =
                  ((activeTab === 'recent' || activeTab === 'saved') && !!selectedQuery) ||
                  (activeTab === 'upload' && !!uploadedFile) ||
                  ((activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && !!selectedSource);
                return (
                  <button
                    onClick={handleAttach}
                    disabled={!enabled || isAttaching}
                    className={`inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${
                      enabled && !isAttaching ? 'bg-primary hover:bg-primary-hover text-white' : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                    }`}
                  >
                    {isAttaching ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {isAttaching ? 'Attaching…' : 'Attach'}
                  </button>
                );
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Report View (with multiple queries) ───
function ReportView({ report, onBack, onShare, onManageExceptions, onOpenQuery, initialTemplate, customTemplates = [], onAddQuery, onRemoveQuery, onUpdateDescription }: {
  report: GeneratedReport;
  onAddQuery: (reportId: string, query: AttachedQuery) => void;
  onRemoveQuery: (reportId: string, queryId: string) => void;
  onBack: () => void;
  onShare?: () => void;
  onManageExceptions?: () => void;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  initialTemplate?: typeof REPORT_TEMPLATES[0] | null;
  customTemplates?: typeof REPORT_TEMPLATES[number][];
  onUpdateDescription?: (reportId: string, description: string) => void;
}) {
  const { addToast } = useToast();
  const { can } = useCan();
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(initialTemplate ?? null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  // QueryCard "Generate Cases" phase, lifted up so it survives template
  // switches that re-mount QueryCards. Keyed by query.id.
  const [casesPhases, setCasesPhases] = useState<Record<string, CasesPhase>>({});
  const setCasesPhase = (queryId: string, phase: CasesPhase) =>
    setCasesPhases(prev => ({ ...prev, [queryId]: phase }));
  // Local launch pulse — the whole report surface nudges right + dims when
  // the Manage Exceptions CTA fires, mirroring the new-tab launch.
  const [launching, setLaunching] = useState(false);
  useEffect(() => {
    const handler = () => {
      setLaunching(true);
      window.setTimeout(() => setLaunching(false), 420);
    };
    window.addEventListener('app:launch-pulse', handler);
    return () => window.removeEventListener('app:launch-pulse', handler);
  }, []);

  const applyTemplateNow = (template: typeof REPORT_TEMPLATES[0]) => {
    setApplyingTemplate(true);
    setTimeout(() => {
      setAppliedTemplate(template);
      setApplyingTemplate(false);
      addToast({ type: 'success', message: `Template "${template.name}" applied.` });
    }, 800);
  };

  const handleApplyTemplate = (template: typeof REPORT_TEMPLATES[0]) => {
    setShowApplyTemplate(false);
    // Switching away from a template that's already applied replaces the
    // current layout and its sections, so confirm first. The first-time
    // apply (nothing applied yet, or re-picking the same one) is harmless.
    if (appliedTemplate && appliedTemplate.id !== template.id) {
      setPendingTemplate(template);
      return;
    }
    applyTemplateNow(template);
  };

  const reportTemplate =
    REPORT_TEMPLATES.find(t => t.id === report.templateId) ??
    customTemplates.find(t => t.id === report.templateId) ??
    null;

  const displayDescription = report.description ?? reportTemplate?.desc ?? '';
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(displayDescription);

  const startEditDesc = () => {
    setDescDraft(displayDescription);
    setIsEditingDesc(true);
  };
  const cancelEditDesc = () => {
    setDescDraft(displayDescription);
    setIsEditingDesc(false);
  };
  const saveEditDesc = () => {
    const next = descDraft.trim();
    if (next !== displayDescription && onUpdateDescription) {
      onUpdateDescription(report.id, next);
    }
    setIsEditingDesc(false);
  };

  const EditableDescription = () => {
    if (isEditingDesc) {
      return (
        <div className="mb-3">
          <textarea
            value={descDraft}
            onChange={e => setDescDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); cancelEditDesc(); }
              else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveEditDesc(); }
            }}
            rows={2}
            placeholder="Add a description for this report…"
            autoFocus
            className="w-full bg-white/10 border border-white/25 rounded-[8px] px-3 py-2 text-white text-[13px] leading-snug placeholder:text-white/50 focus:outline-none focus:border-white/55 focus:bg-white/15 transition-colors resize-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={saveEditDesc}
              className="inline-flex items-center gap-1 h-7 px-3 bg-white text-primary text-[11px] font-semibold rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={cancelEditDesc}
              className="h-7 px-2.5 text-white/75 text-[11px] font-medium hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <span className="text-white/40 text-[10px] ml-auto hidden sm:inline">⌘↵ Save · Esc Cancel</span>
          </div>
        </div>
      );
    }
    return (
      <div className="group/desc flex items-start gap-1.5 mb-3 -ml-0.5">
        <p className="text-white/65 text-[13px] leading-snug pl-0.5">
          {displayDescription || <span className="italic text-white/40">No description</span>}
        </p>
        <button
          onClick={startEditDesc}
          aria-label="Edit description"
          className="shrink-0 p-1 -mt-0.5 rounded-[8px] text-white/55 hover:text-white hover:bg-white/15 opacity-0 group-hover/desc:opacity-100 focus-visible:opacity-100 transition-all duration-150 cursor-pointer"
        >
          <Edit3 size={12} />
        </button>
      </div>
    );
  };

  const DEFAULT_QUERIES = [
    {
      id: 'Q01', risk: 'Financial Risk', severity: 'High',
      ...REPORT_QUERIES_ATR.Q01,
      addedBy: report.generatedBy,
      kpis: [
        { label: 'Flagged By AI', value: '140', color: 'text-primary' },
        { label: 'Manually Flagged', value: '1', color: 'text-high-700' },
        { label: 'Resolved', value: '3', color: 'text-compliant-700' },
        { label: 'Pending', value: '136', color: 'text-risk-700' },
      ],
      chartData: [40, 55, 80, 65, 90, 75, 95, 70, 85, 100],
    },
    {
      id: 'Q02', risk: 'Compliance Risk', severity: 'High',
      ...REPORT_QUERIES_ATR.Q02,
      addedBy: 'AI Copilot',
      kpis: [
        { label: 'Changes Found', value: '47', color: 'text-primary' },
        { label: 'Unauthorized', value: '12', color: 'text-risk-700' },
        { label: 'Verified', value: '35', color: 'text-compliant-700' },
        { label: 'Pending', value: '8', color: 'text-high-700' },
      ],
      chartData: [20, 35, 25, 50, 40, 30, 45, 60, 55, 47],
    },
  ];

  // Template-specific report structures — each template reshapes the report content
  const TEMPLATE_QUERIES: Record<string, typeof DEFAULT_QUERIES> = {
    'rt-002': [ // Risk Assessment Summary
      {
        id: 'RA01', risk: 'Aggregate Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.RA01,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Total Risks', value: '12', color: 'text-primary' },
          { label: 'High', value: '7', color: 'text-risk-700' },
          { label: 'Mitigated', value: '5', color: 'text-compliant-700' },
        ],
        chartData: [12, 10, 11, 9, 12, 10, 8, 12, 11, 12],
      },
      {
        id: 'RA02', risk: 'Mitigation Gap', severity: 'High',
        ...REPORT_QUERIES_ATR.RA02,
        addedBy: 'AI Copilot',
        kpis: [
          { label: 'Strategies Reviewed', value: '18', color: 'text-primary' },
          { label: 'Effective', value: '10', color: 'text-compliant-700' },
          { label: 'Partial', value: '5', color: 'text-mitigated-700' },
          { label: 'Ineffective', value: '3', color: 'text-risk-700' },
        ],
        chartData: [18, 16, 17, 15, 18, 14, 16, 18, 17, 18],
      },
    ],
    'rt-003': [ // Control Effectiveness Report
      {
        id: 'CE01', risk: 'Control Gap', severity: 'High',
        ...REPORT_QUERIES_ATR.CE01,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Controls Tested', value: '54', color: 'text-primary' },
          { label: 'Effective', value: '48', color: 'text-compliant-700' },
          { label: 'Deficient', value: '4', color: 'text-risk-700' },
          { label: 'Pending Test', value: '33', color: 'text-mitigated-700' },
        ],
        chartData: [48, 46, 47, 48, 45, 48, 47, 48, 46, 48],
      },
    ],
    'rt-004': [ // Workflow Analytics Report
      {
        id: 'WA01', risk: 'Operational Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.WA01,
        addedBy: 'AI Copilot',
        kpis: [
          { label: 'Total Runs', value: '115', color: 'text-primary' },
          { label: 'Accuracy', value: '94.2%', color: 'text-compliant-700' },
          { label: 'Exceptions', value: '23', color: 'text-high-700' },
          { label: 'Avg Runtime', value: '1.8d', color: 'text-evidence-700' },
        ],
        chartData: [85, 88, 90, 87, 92, 94, 91, 93, 95, 94],
      },
      {
        id: 'WA02', risk: 'Processing Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.WA02,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Exceptions', value: '23', color: 'text-primary' },
          { label: 'Auto-Resolved', value: '8', color: 'text-compliant-700' },
          { label: 'Manual Review', value: '12', color: 'text-mitigated-700' },
          { label: 'Escalated', value: '3', color: 'text-risk-700' },
        ],
        chartData: [5, 3, 6, 4, 2, 3, 5, 7, 4, 3],
      },
    ],
    'rt-006': [ // Executive Dashboard Export
      {
        id: 'EX01', risk: 'Strategic Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.EX01,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Compliance', value: '94.2%', color: 'text-primary' },
          { label: 'Material Weakness', value: '2', color: 'text-risk-700' },
          { label: 'Cost Saved', value: '24L', color: 'text-compliant-700' },
          { label: 'Exposure', value: '18L', color: 'text-high-700' },
        ],
        chartData: [91, 91.5, 92, 92.3, 93, 93.2, 93.5, 93.8, 94, 94.2],
      },
    ],
  };

  const TEMPLATE_STATS: Record<string, { label: string; value: string; icon: React.ElementType; color: string }[]> = {
    'rt-002': [
      { label: 'Total Risks', value: '12', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { label: 'Uncontrolled', value: '2', icon: Shield, color: 'text-risk-700 bg-risk-50' },
      { label: 'Mitigated', value: '5', icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'Exposure', value: '18L', icon: TrendingUp, color: 'text-evidence-700 bg-evidence-50' },
    ],
    'rt-003': [
      { label: 'Controls Tested', value: '54', icon: Shield, color: 'text-evidence-700 bg-evidence-50' },
      { label: 'Effective', value: '48', icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'Deficient', value: '4', icon: AlertTriangle, color: 'text-risk-700 bg-risk-50' },
      { label: 'Effectiveness Rate', value: '89%', icon: TrendingUp, color: 'text-brand-700 bg-brand-50' },
    ],
    'rt-004': [
      { label: 'Workflow Runs', value: '115', icon: TrendingUp, color: 'text-evidence-700 bg-evidence-50' },
      { label: 'Accuracy', value: '94.2%', icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'Exceptions', value: '23', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { label: 'Cost Saved', value: '24L', icon: Shield, color: 'text-brand-700 bg-brand-50' },
    ],
    'rt-006': [
      { label: 'Compliance Score', value: '94.2%', icon: Shield, color: 'text-brand-700 bg-brand-50' },
      { label: 'Material Weakness', value: '2', icon: AlertTriangle, color: 'text-risk-700 bg-risk-50' },
      { label: 'Cost Saved', value: '24L', icon: TrendingUp, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'Risk Exposure', value: '18L', icon: FileText, color: 'text-high-700 bg-high-50' },
    ],
  };

  const activeQueries = appliedTemplate && TEMPLATE_QUERIES[appliedTemplate.id]
    ? TEMPLATE_QUERIES[appliedTemplate.id]
    : DEFAULT_QUERIES;

  const activeStats = (() => {
    if (appliedTemplate && TEMPLATE_STATS[appliedTemplate.id]) return TEMPLATE_STATS[appliedTemplate.id];
    if (report.tag === 'Bulk Audit' && (report.workflowResults?.length ?? 0) > 0) {
      const wr = report.workflowResults!;
      const totalRecords = wr.reduce((sum, w) => sum + (w.outputTable?.rows.length ?? 0), 0);
      const highCount = wr.filter(w => w.severity === 'High').length;
      const mediumCount = wr.filter(w => w.severity === 'Medium').length;
      return [
        { label: 'Workflows Run', value: String(wr.length), icon: Layers, color: 'text-brand-700 bg-brand-50' },
        { label: 'Records Flagged', value: String(totalRecords), icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
        { label: 'High Severity', value: String(highCount), icon: Shield, color: 'text-risk-700 bg-risk-50' },
        { label: 'Medium Severity', value: String(mediumCount), icon: TrendingUp, color: 'text-mitigated-700 bg-mitigated-50' },
      ];
    }
    return [
      { label: 'Total Exceptions', value: '187', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { label: 'Closed', value: '38', icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'High Risk', value: '12', icon: Shield, color: 'text-risk-700 bg-risk-50' },
      { label: 'Report Health', value: '78%', icon: TrendingUp, color: 'text-evidence-700 bg-evidence-50' },
    ];
  })();

  // Sections — reorderable / add / remove
  type SectionItem =
    | { id: string; kind: 'cover'; title: string }
    | { id: string; kind: 'summary'; title: string; content: string }
    | { id: string; kind: 'stats'; title: string }
    | { id: string; kind: 'query'; title: string; query: typeof DEFAULT_QUERIES[0] }
    | { id: string; kind: 'workflow'; title: string; workflow: WorkflowResult }
    | { id: string; kind: 'note'; title: string; content: string }
    | { id: string; kind: 'observation'; title: string; obsId: string; description: string; attachments?: ObservationAttachment[]; attachmentHidden?: boolean };

  type ObservationItem = {
    id: string;
    kind: 'observation';
    title: string;
    obsId: string;
    description: string;
    attachments?: ObservationAttachment[];
    attachmentHidden?: boolean;
  };

  const isBulkAudit = report.tag === 'Bulk Audit';
  const reportWorkflows: WorkflowResult[] = report.workflowResults ?? [];

  const buildInitialSections = (queries: typeof DEFAULT_QUERIES): SectionItem[] => {
    const head: SectionItem[] = [
      { id: 'sec-cover', kind: 'cover', title: 'Cover' },
      {
        id: 'sec-summary',
        kind: 'summary',
        title: 'Executive Summary',
        content: isBulkAudit
          ? `Bulk audit ran ${reportWorkflows.length} ${reportWorkflows.length === 1 ? 'workflow' : 'workflows'} across the supplied datasets. Flagged records have been grouped by severity for review; high-severity items should be triaged first.`
          : 'FY26 Q1 SOX compliance audit covered 87 controls across 4 business processes (P2P, O2C, R2R, S2C). 54 controls tested to date with 89% effectiveness rate. 2 material weaknesses identified requiring remediation before March 31 deadline. Overall compliance score: 94.2% — improved from 91.8% prior quarter.',
      },
    ];
    if (isBulkAudit) {
      return [
        ...head,
        ...reportWorkflows.map(w => ({
          id: `sec-workflow-${w.id}`,
          kind: 'workflow' as const,
          title: `Workflow · ${w.workflowId}`,
          workflow: w,
        })),
      ];
    }
    return [
      ...head,
      ...queries.map(q => ({
        id: `sec-query-${q.id}`,
        kind: 'query' as const,
        title: `Query · ${q.id}`,
        query: q,
      })),
    ];
  };

  const [sections, setSections] = useState<SectionItem[]>(() => buildInitialSections(DEFAULT_QUERIES));
  const appliedTemplateId = appliedTemplate?.id ?? null;

  // Regenerate summary mock — overrides the summary section's content with an
  // alternative blurb after a short simulated delay so the action feels real.
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  const ALT_SUMMARY = "Updated review identifies three additional control gaps in the vendor master review workflow, with proposed remediation owners. Findings reflect data through this morning's reconciliation cycle.";

  useEffect(() => {
    const queries = appliedTemplateId && TEMPLATE_QUERIES[appliedTemplateId]
      ? TEMPLATE_QUERIES[appliedTemplateId]
      : DEFAULT_QUERIES;
    setSections(buildInitialSections(queries));
    setSummaryOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedTemplateId, isBulkAudit, reportWorkflows.length]);

  // Update one workflow's risk owner across both state and the parent report.
  const updateWorkflowRiskOwner = (workflowId: string, owner: string) => {
    setSections(prev => prev.map(s =>
      s.kind === 'workflow' && s.workflow.id === workflowId
        ? { ...s, workflow: { ...s.workflow, riskOwner: owner || undefined } }
        : s
    ));
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  // ─── Add-Observation modal state ───
  const [showAddObservation, setShowAddObservation] = useState(false);
  const [editingObservation, setEditingObservation] = useState<EditingObservationInput | null>(null);
  // Separate stream of observations added to applied-template view (where the body is template-driven)
  const [appliedObservations, setAppliedObservations] = useState<ObservationItem[]>([]);

  // Auto-generate next sequential OBS ID across both streams + existing sections
  const nextObservationId = () => {
    const inSections = sections
      .filter((s): s is Extract<SectionItem, { kind: 'observation' }> => s.kind === 'observation')
      .map(s => s.obsId);
    const inApplied = appliedObservations.map(o => o.obsId);
    return computeNextObservationId([...inSections, ...inApplied]);
  };

  const openAddObservation = () => {
    setEditingObservation(null);
    setShowAddObservation(true);
  };
  const openEditObservation = (obs: { id: string; obsId: string; title: string; description: string; attachments?: ObservationAttachment[] }) => {
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

  const toggleObservationAttachment = (id: string) => {
    setSections(prev => prev.map(s =>
      s.id === id && s.kind === 'observation'
        ? { ...s, attachmentHidden: !s.attachmentHidden }
        : s
    ));
    setAppliedObservations(prev => prev.map(o =>
      o.id === id ? { ...o, attachmentHidden: !o.attachmentHidden } : o
    ));
  };

  const handleObservationSave = ({ name, description, attachments }: { name: string; description: string; attachments?: ObservationAttachment[] }) => {
    if (editingObservation) {
      setSections(prev => prev.map(s =>
        s.id === editingObservation.id && s.kind === 'observation'
          ? { ...s, title: name, description, attachments }
          : s
      ));
      setAppliedObservations(prev => prev.map(o =>
        o.id === editingObservation.id
          ? { ...o, title: name, description, attachments }
          : o
      ));
      addToast({ type: 'success', message: `${editingObservation.obsId} updated.` });
    } else {
      const obsId = nextObservationId();
      const newItem: ObservationItem = {
        id: `sec-obs-${Date.now()}`,
        kind: 'observation',
        title: name,
        obsId,
        description,
        attachments,
      };
      if (appliedTemplate) {
        setAppliedObservations(prev => [...prev, newItem]);
      } else {
        setSections(prev => [...prev, newItem]);
      }
      addToast({ type: 'success', message: `${obsId} added.` });
    }
    closeAddObservation();
  };

  // ─── Contents (table of contents) state + handlers ───
  const [contentsEditingId, setContentsEditingId] = useState<string | null>(null);
  const [contentsDraft, setContentsDraft] = useState('');
  const [sectionPendingDelete, setSectionPendingDelete] = useState<SectionItem | null>(null);

  const renameSection = (id: string, newTitle: string) => {
    setSections(prev => prev.map(s => s.id === id ? ({ ...s, title: newTitle } as SectionItem) : s));
  };
  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const handleStartContentsRename = (s: SectionItem) => {
    setContentsDraft(s.title);
    setContentsEditingId(s.id);
  };
  const handleSaveContentsRename = () => {
    if (!contentsEditingId) return;
    const trimmed = contentsDraft.trim();
    if (trimmed) renameSection(contentsEditingId, trimmed);
    setContentsEditingId(null);
  };
  const handleCancelContentsRename = () => {
    setContentsEditingId(null);
  };
  const confirmDeleteSection = () => {
    if (sectionPendingDelete) {
      const id = sectionPendingDelete.id;
      setSections(prev => prev.filter(s => s.id !== id));
      setAppliedObservations(prev => prev.filter(o => o.id !== id));
      addToast({ type: 'success', message: `"${sectionPendingDelete.title}" removed.` });
    }
    setSectionPendingDelete(null);
  };

  const ContentsBlock = () => {
    const coverSection = sections.find(s => s.kind === 'cover');
    const nonCoverSections = sections.filter(s => s.kind !== 'cover');
    if (nonCoverSections.length === 0) return null;
    return (
      <div className="border-x border-b border-border-light bg-white p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <List size={16} className="text-primary" />
            <h3 className="text-[15px] leading-[20px] font-bold text-text">Contents</h3>
          </div>
          <button
            onClick={openAddObservation}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-primary bg-primary-xlight border border-primary/15 rounded-[8px] hover:bg-primary-xlight/70 hover:border-primary/30 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add Observation
          </button>
        </div>
        <Reorder.Group
          axis="y"
          values={nonCoverSections}
          onReorder={(newOrder) => {
            setSections(coverSection ? [coverSection, ...newOrder] : newOrder);
          }}
          as="ol"
          className="list-none p-0 m-0 space-y-0.5"
        >
          {nonCoverSections.map((section, i) => (
            <ContentsRow
              key={section.id}
              section={section}
              index={i + 1}
              isEditing={contentsEditingId === section.id}
              draftValue={contentsDraft}
              onDraftChange={setContentsDraft}
              onStartEdit={() => handleStartContentsRename(section)}
              onSaveEdit={handleSaveContentsRename}
              onCancelEdit={handleCancelContentsRename}
              onScroll={() => scrollToSection(section.id)}
              onDelete={() => setSectionPendingDelete(section)}
            />
          ))}
        </Reorder.Group>
      </div>
    );
  };

  // Report-level activity log drawer (consolidates activity across all query cards).
  const [activityLogOpen, setActivityLogOpen] = useState(false);

  // Sync activity drawer state to the URL so a link can deep-link back to it.
  // No react-router in this app — use history.replaceState directly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (activityLogOpen) {
      url.searchParams.set('drawer', 'activity');
    } else if (url.searchParams.get('drawer') === 'activity') {
      url.searchParams.delete('drawer');
    }
    window.history.replaceState({}, '', url.toString());
  }, [activityLogOpen]);

  // Add Query modal — shown from the empty-state report layout.
  const [addQueryOpen, setAddQueryOpen] = useState(false);
  // Upload Report → Generate ATR flow — only offered on the ATR template (rt-007).
  const [uploadReportOpen, setUploadReportOpen] = useState(false);
  const isAtrReport = report.templateId === 'rt-007';
  // Report-level "Generate ATR" — same editable ATR preview as the Action Hub.
  const [atrModalOpen, setAtrModalOpen] = useState(false);

  // ─── Shared comments state (common activity log across all query cards) ───
  const [comments, setComments] = useState<QueryComment[]>([
    { id: 'c-1', queryId: 'Q01', queryTitle: 'Detects duplicate invoice entries by vendor, date, and amount', author: 'Priya Mehta',  initials: 'PM', timestamp: '2 days ago', text: 'Grouped cases by vendor and exported for AP review. Priority — largest 12 duplicates are all the same vendor.' },
    { id: 'c-2', queryId: 'Q01', queryTitle: 'Detects duplicate invoice entries by vendor, date, and amount', author: 'Karan Mehta',  initials: 'KM', timestamp: '1 day ago',  text: 'Flagged EX-2024-003 as a bulk case for remediation — MFA enforcement applied.', attachment: 'mfa_remediation_plan.pdf' },
    { id: 'c-3', queryId: 'Q02', queryTitle: 'Identifies unauthorized vendor master changes without proper approval workflow in the last 90 days', author: 'Ravi Kumar', initials: 'RK', timestamp: '5 hours ago', text: 'Control owner confirmed — vendor master workflow is being tightened; expect residual risk to drop next quarter.' },
  ]);
  const addComment = (queryId: string, queryTitle: string, text: string, attachment?: string) => {
    setComments(prev => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        queryId,
        queryTitle,
        author: report.generatedBy ?? 'You',
        initials: (report.generatedBy ?? 'You').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        timestamp: 'just now',
        text,
        attachment,
      },
    ]);
  };

  const isReadOnly = report.isReadOnly === true || report.tag === 'Shared';
  const sharedByName = report.sharedByName ?? (report as { sharedBy?: string }).sharedBy;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={launching ? { opacity: 0.88, x: 16 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="report-printable h-full overflow-y-auto bg-surface-2"
    >
      <div className="mx-auto px-8 py-6 max-w-6xl flex-col md:flex-row">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded">
              <ArrowLeft size={14} /> Back to Reports
            </button>
            {isReadOnly && (
              <span className="bg-paper-50 border border-canvas-border px-3 h-8 inline-flex items-center gap-2 rounded-full text-[11px] text-ink-500">
                <Lock size={12} aria-hidden="true" />
                <span>
                  View-only{sharedByName ? <> · shared by {sharedByName}</> : ''}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 relative">
            {!isReadOnly && (
              <div className="relative">
                <button
                  onClick={() => setShowApplyTemplate(p => !p)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded-[8px]"
                >
                  <Layout size={14} />
                  <span className="truncate max-w-[220px]">{appliedTemplate?.name ?? 'Apply Template'}</span>
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
                        onSelect={handleApplyTemplate}
                        onClose={() => setShowApplyTemplate(false)}
                      />
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            {onShare && can('rp_share') && (
              <button onClick={onShare} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-[8px]">
                <Share2 size={14} /> Share
              </button>
            )}
            <button
              onClick={() => setShowDownloadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-[8px]"
            >
              <Download size={14} /> Download
            </button>
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
                className="flex items-center gap-3 px-6 py-4 glass-card-strong rounded-[12px] shadow-lg"
              >
                <Loader2 size={20} className="text-primary animate-spin" />
                <span className="text-[14px] font-semibold text-text">Applying template...</span>
              </motion.div>
            </motion.div>
          )}
          {pendingTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-[2px]"
              onClick={() => setPendingTemplate(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="switch-template-title"
                className="relative bg-white rounded-[16px] border border-border-light shadow-2xl w-[320px] p-6"
                onClick={e => e.stopPropagation()}
              >
                <h3 id="switch-template-title" className="text-[15px] font-semibold text-text mb-2">Switch template?</h3>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-5">
                  Switching to “{pendingTemplate.name}” replaces the current layout and its sections. Some content may not carry over.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPendingTemplate(null)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold text-text bg-white border border-border-light hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { const t = pendingTemplate; setPendingTemplate(null); applyTemplateNow(t); }}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                  >
                    Switch
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {report.isEmpty ? (
          <>
            {/* Empty-state Cover — same chrome, simpler body */}
            <div className="relative rounded-[12px] overflow-hidden mb-5 bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]">
              <div className="relative z-10 px-8 py-7">
                <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{report.name}</h1>
                {reportTemplate && (
                  <p className="text-white/60 text-[13px] mb-3">{reportTemplate.desc}</p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-semibold text-white">{report.generatedBy}</span>
                    <span className="text-white/30 mx-0.5">|</span>
                    <span className="text-white/70">{report.generatedAt}</span>
                    <span className="text-white/30 mx-0.5">|</span>
                    <span className="text-white/70">{reportTemplate?.sections.length ?? 0} {reportTemplate?.sections.length === 1 ? 'section' : 'sections'}</span>
                    {report.tag && (() => {
                      const TagIcon = report.tag === 'Internal Audit' ? Shield : report.tag === 'Bulk Audit' ? Layers : Share2;
                      return (
                        <span
                          className="inline-flex items-center gap-1 px-2 h-5 ml-1 text-[10px] font-semibold whitespace-nowrap rounded-[8px]"
                          style={{
                            background: report.tag === 'Internal Audit' ? '#FFE8F6' : '#FFFAEB',
                            color: report.tag === 'Internal Audit' ? '#BF2E84' : '#A74108',
                          }}
                        >
                          <TagIcon size={12} aria-hidden="true" />
                          {report.tag}
                        </span>
                      );
                    })()}
                  </div>
                  {!isReadOnly && (
                    <div className="flex items-center gap-2">
                      {isAtrReport && (
                        <button
                          onClick={() => setUploadReportOpen(true)}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-white bg-white/15 border border-white/30 rounded-[8px] hover:bg-white/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                        >
                          <Upload size={14} />
                          Upload Report
                        </button>
                      )}
                      <button
                        onClick={() => setAddQueryOpen(true)}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-primary bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                      >
                        <Plus size={14} />
                        Add Query
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section blocks — render template sections with empty placeholders.
                When a section is the "queries" section (e.g., Audit Queries) and
                queries have been attached, the cards slot inside that section. */}
            {(() => {
              const sections = reportTemplate?.sections ?? [];
              const attached = report.attachedQueries ?? [];
              const queriesSectionIndex = sections.findIndex(s => /quer(y|ies)/i.test(s.name));
              const hasQueriesSection = queriesSectionIndex !== -1;

              return (
                <div className="space-y-4">
                  {sections.map((section, i) => {
                    const Icon = SECTION_ICONS[section.icon] || FileText;
                    const isQueriesSection = i === queriesSectionIndex;
                    const renderQueriesHere = isQueriesSection && attached.length > 0;

                    if (renderQueriesHere) {
                      return (
                        <motion.div
                          key={`${section.name}-${i}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="space-y-3"
                        >
                          <div className="flex items-center gap-2.5 px-1">
                            <Icon size={16} className="text-primary" />
                            <h3 className="text-[14px] font-bold text-text tracking-tight">{section.name}</h3>
                            <span className="text-[10px] text-text-muted">·</span>
                            <span className="text-[10px] text-text-muted">{attached.length}</span>
                          </div>
                          <AnimatePresence>
                            {attached.map((q, qi) => (
                              <AttachedQueryCard
                                key={q.id}
                                query={q}
                                index={qi}
                                onRemove={(id) => onRemoveQuery(report.id, id)}
                              />
                            ))}
                          </AnimatePresence>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.section
                        key={`${section.name}-${i}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-white border border-border-light rounded-[12px] px-6 py-5"
                      >
                        <div className="flex items-center gap-2.5 mb-3">
                          <Icon size={16} className="text-primary" />
                          <h3 className="text-[14px] font-bold text-text tracking-tight">{section.name}</h3>
                        </div>
                        <div className="border border-dashed border-border-light rounded-[12px] bg-paper-50/40 px-6 py-7 text-center">
                          <p className="text-[12px] text-text-muted/80">
                            {attached.length > 0
                              ? `${section.name} will be generated from your attached queries.`
                              : `Section content generated from ${report.name} data`}
                          </p>
                        </div>
                      </motion.section>
                    );
                  })}

                  {/* Fallback — template has no queries section, so render attached queries above remaining sections */}
                  {!hasQueriesSection && attached.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 px-1">
                        <MessageSquare size={16} className="text-primary" />
                        <h3 className="text-[14px] font-bold text-text tracking-tight">Attached Queries</h3>
                        <span className="text-[10px] text-text-muted">·</span>
                        <span className="text-[10px] text-text-muted">{attached.length}</span>
                      </div>
                      <AnimatePresence>
                        {attached.map((q, qi) => (
                          <AttachedQueryCard
                            key={q.id}
                            query={q}
                            index={qi}
                            onRemove={(id) => onRemoveQuery(report.id, id)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {(!reportTemplate || sections.length === 0) && (
                    <div className="bg-white border border-border-light rounded-[12px] px-6 py-12 text-center">
                      <p className="text-[13px] text-text-muted">This template has no sections defined.</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : appliedTemplate ? (
          <>
            {/* Report Cover */}
            <div className="relative rounded-[12px] overflow-hidden mb-5 bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]">
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
                <EditableDescription />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-semibold text-white">{report.generatedBy}</span>
                    <span className="text-white/30 mx-0.5">|</span>
                    <span className="text-white/70">{report.generatedAt}</span>
                    <span className="text-white/30 mx-0.5">|</span>
                    <span className="text-white/70">{activeQueries.length} {activeQueries.length === 1 ? 'query' : 'queries'}</span>
                    {/* When a template is applied, show only the applied-template chip — the default report.tag chip is hidden to avoid duplicate badges. */}
                    <span className="inline-flex items-center h-6 px-2.5 ml-1 text-[11px] font-medium text-white bg-white/15 border border-white/25 rounded-full whitespace-nowrap">
                      {appliedTemplate.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAtrModalOpen(true)}
                      title="Generate Action Taken Report"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-primary bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                    >
                      <FileText size={14} />
                      Generate ATR
                    </button>
                    <button
                      onClick={() => setActivityLogOpen(true)}
                      title="View this report's activity log"
                      aria-label="View report activity log"
                      className="w-9 h-9 rounded-[8px] flex items-center justify-center text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                    >
                      <History size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Contents — read-only list of template-defined sections */}
            {appliedTemplate.sections && appliedTemplate.sections.length > 0 && (
              <div className="border border-border-light rounded-[12px] bg-white p-6 mb-5">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <List size={16} className="text-primary" />
                    <h3 className="text-[15px] leading-[20px] font-bold text-text">Contents</h3>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={openAddObservation}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-primary bg-primary-xlight border border-primary/15 rounded-[8px] hover:bg-primary-xlight/70 hover:border-primary/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                    >
                      <Plus size={14} />
                      Add Observation
                    </button>
                  )}
                </div>
                <Reorder.Group
                  axis="y"
                  values={appliedObservations}
                  onReorder={setAppliedObservations}
                  as="ol"
                  className="list-none p-0 m-0 space-y-0.5"
                >
                  {appliedTemplate.sections.map((s, i) => (
                    <li key={`${s.name}-${i}`} className="flex items-center gap-2 py-2.5 pl-1 pr-1 rounded-[8px] hover:bg-primary-xlight/30 transition-colors">
                      <span className="shrink-0 w-6 text-[10px] text-text-muted/70 font-mono tabular-nums text-right">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex-1 min-w-0 text-[12px] text-text-secondary truncate">{s.name}</span>
                    </li>
                  ))}
                  {appliedObservations.map((o, i) => {
                    const idx = (appliedTemplate.sections?.length ?? 0) + i + 1;
                    return (
                      <ContentsRow
                        key={o.id}
                        section={o}
                        index={idx}
                        isEditing={contentsEditingId === o.id}
                        draftValue={contentsDraft}
                        onDraftChange={setContentsDraft}
                        onStartEdit={() => handleStartContentsRename(o as unknown as SectionItem)}
                        onSaveEdit={() => {
                          if (!contentsEditingId) return;
                          const trimmed = contentsDraft.trim();
                          if (trimmed) {
                            setAppliedObservations(prev => prev.map(x => x.id === contentsEditingId ? { ...x, title: trimmed } : x));
                          }
                          setContentsEditingId(null);
                        }}
                        onCancelEdit={handleCancelContentsRename}
                        onScroll={() => scrollToSection(o.id)}
                        onDelete={() => setAppliedObservations(prev => prev.filter(x => x.id !== o.id))}
                      />
                    );
                  })}
                </Reorder.Group>
              </div>
            )}

            {/* Summary Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {activeStats.map(stat => (
                <div key={stat.label} className="glass-card rounded-[12px] p-4 flex items-center gap-3 hover:shadow-md hover:shadow-primary/5 transition-all">
                  <div className={`p-2 rounded-[8px] ${stat.color}`}><stat.icon size={16} /></div>
                  <div>
                    <div className="text-xl font-bold text-text">{stat.value}</div>
                    <div className="text-[10px] text-text-muted tracking-wide">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={appliedTemplate.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <TemplateLayout templateId={appliedTemplate.id} template={appliedTemplate} report={report} />
              </motion.div>
            </AnimatePresence>

            {/* Observations added on top of the template — match Query Card UI */}
            {appliedObservations.length > 0 && (
              <div className="mt-5 space-y-3">
                {appliedObservations.map((o, i) => (
                  <div key={o.id} id={`section-${o.id}`}>
                    <ObservationCard
                      obs={o}
                      index={i}
                      attached={false}
                      onEdit={() => openEditObservation(o)}
                      onToggleAttachment={() => toggleObservationAttachment(o.id)}
                      onDelete={() => setSectionPendingDelete(o as unknown as SectionItem)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full">
            {/* Sections rendered as a continuous report (drag-to-reorder enabled for query cards) */}
            <main className="min-w-0">
              <Reorder.Group axis="y" values={sections} onReorder={setSections} as="div" className="list-none p-0 m-0 [&>*:last-child>*]:rounded-b-2xl">
                {sections.map((section, i) => {
                  const sectionProps = {
                    key: section.id,
                    value: section,
                    id: `section-${section.id}`,
                    layout: true as const,
                    initial: { opacity: 0, y: 8 },
                    animate: { opacity: 1, y: 0 },
                    exit: { opacity: 0, y: -4, scale: 0.98 },
                    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
                    className: 'scroll-mt-4 list-none',
                    dragListener: false as const,
                  };

                  if (section.kind === 'cover') {
                    return [
                      <Reorder.Item {...sectionProps} key={`${section.id}-item`}>
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
                            <EditableDescription />
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-[13px]">
                                <span className="font-semibold text-white">{report.generatedBy}</span>
                                <span className="text-white/30 mx-0.5">|</span>
                                <span className="text-white/70">{report.generatedAt}</span>
                                <span className="text-white/30 mx-0.5">|</span>
                                {(() => {
                                  if (isBulkAudit) {
                                    const n = sections.filter(s => s.kind === 'workflow').length;
                                    return <span className="text-white/70">{n} {n === 1 ? 'workflow' : 'workflows'}</span>;
                                  }
                                  const n = sections.filter(s => s.kind === 'query').length;
                                  return <span className="text-white/70">{n} {n === 1 ? 'query' : 'queries'}</span>;
                                })()}
                                {report.tag && (
                                  <span
                                    className="inline-flex items-center px-2 h-5 ml-1 text-[10px] font-semibold whitespace-nowrap rounded-[8px]"
                                    style={{
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
                                  onClick={() => setAtrModalOpen(true)}
                                  title="Generate Action Taken Report"
                                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-primary bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                                >
                                  <FileText size={14} />
                                  Generate ATR
                                </button>
                                <button
                                  onClick={() => setActivityLogOpen(true)}
                                  title="View this report's activity log"
                                  aria-label="View report activity log"
                                  className="w-9 h-9 rounded-[8px] flex items-center justify-center text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                                >
                                  <History size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Reorder.Item>,
                      <ContentsBlock key={`${section.id}-contents`} />,
                    ];
                  }

                  if (section.kind === 'summary') {
                    const hasQueries = sections.some(s => s.kind === 'query');
                    return (
                      <Reorder.Item {...sectionProps}>
                        <div className="border-x border-b border-border-light bg-white p-6">
                          <div className="flex items-center justify-between gap-3 mb-6">
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-primary" />
                              <h3 className="text-[15px] leading-[20px] font-bold text-text">{section.title}</h3>
                            </div>
                            {hasQueries && (
                              <button
                                onClick={() => {
                                  if (isRegeneratingSummary) return;
                                  setIsRegeneratingSummary(true);
                                  setTimeout(() => {
                                    setSummaryOverride(ALT_SUMMARY);
                                    setIsRegeneratingSummary(false);
                                    addToast({ type: 'success', message: 'Executive summary regenerated.' });
                                  }, 1200);
                                }}
                                disabled={isRegeneratingSummary}
                                aria-busy={isRegeneratingSummary || undefined}
                                title="Regenerate this summary with the latest queries"
                                className="group/regen inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-primary bg-primary-xlight border border-primary/20 rounded-[8px] hover:bg-primary-xlight/70 hover:border-primary/35 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {isRegeneratingSummary ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={12} className="transition-transform duration-300 group-hover/regen:rotate-180" />
                                )}
                                {isRegeneratingSummary ? 'Regenerating…' : 'Regenerate'}
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-3 pb-5 border-b border-border-light mb-5">
                            {activeStats.map((stat, si) => (
                              <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 18, mass: 0.7, delay: 0.08 + si * 0.08 }}
                                className="flex items-center gap-3"
                              >
                                <div className={`p-2 rounded-[8px] ${stat.color}`}><stat.icon size={16} /></div>
                                <div>
                                  <div className="text-xl font-bold text-text leading-none mb-1">
                                    <KpiCountUp value={stat.value} delay={120 + si * 80} />
                                  </div>
                                  <div className="text-[11px] text-text-muted tracking-wide">{stat.label}</div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                          <p className="text-[13px] text-text-secondary leading-relaxed">{summaryOverride ?? section.content}</p>
                        </div>
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'stats') {
                    return (
                      <Reorder.Item {...sectionProps}>
                        <div className="grid grid-cols-4 gap-3">
                          {activeStats.map(stat => (
                            <div key={stat.label} className="glass-card rounded-[12px] p-4 flex items-center gap-3 hover:shadow-md hover:shadow-primary/5 transition-all">
                              <div className={`p-2 rounded-[8px] ${stat.color}`}><stat.icon size={16} /></div>
                              <div>
                                <div className="text-xl font-bold text-text">{stat.value}</div>
                                <div className="text-[10px] text-text-muted tracking-wide">{stat.label}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'query') {
                    return (
                      <DraggableQuerySection
                        key={section.id}
                        section={section}
                        index={i}
                        sectionProps={sectionProps}
                        onOpenQuery={onOpenQuery}
                        onDelete={() => {
                          // Snapshot the card and its position so Undo restores both.
                          const snapshot = sections.find(s => s.id === section.id);
                          const snapshotIndex = sections.findIndex(s => s.id === section.id);
                          setSections(prev => prev.filter(s => s.id !== section.id));
                          addToast({
                            type: 'success',
                            message: 'Query card removed.',
                            action: snapshot ? {
                              label: 'Undo',
                              onClick: () => {
                                setSections(prev => {
                                  if (prev.some(s => s.id === snapshot.id)) return prev;
                                  const next = [...prev];
                                  next.splice(Math.max(0, snapshotIndex), 0, snapshot);
                                  return next;
                                });
                              },
                            } : undefined,
                          });
                        }}
                        comments={comments}
                        onAddComment={addComment}
                      />
                    );
                  }

                  if (section.kind === 'workflow') {
                    return (
                      <Reorder.Item {...sectionProps}>
                        <WorkflowResultCard
                          workflow={section.workflow}
                          index={i}
                          casesPhase={casesPhases[section.workflow.id] ?? 'idle'}
                          onCasesPhaseChange={(p) => setCasesPhase(section.workflow.id, p)}
                          onUpdateRiskOwner={(owner) => updateWorkflowRiskOwner(section.workflow.id, owner)}
                          onDelete={() => removeSection(section.id)}
                        />
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'note') {
                    return (
                      <Reorder.Item {...sectionProps}>
                        <div className="border-x border-b border-border-light bg-white p-5">
                          <div className="flex items-center gap-2 mb-2.5 text-[11px] text-text-muted font-semibold uppercase tracking-wider">
                            <StickyNote size={12} className="text-primary" /> {section.title}
                          </div>
                          <p className="text-[13px] text-text leading-relaxed">{section.content}</p>
                        </div>
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'observation') {
                    return (
                      <Reorder.Item {...sectionProps}>
                        <ObservationCard
                          obs={section}
                          index={i}
                          onEdit={() => openEditObservation(section)}
                          onToggleAttachment={() => toggleObservationAttachment(section.id)}
                          onDelete={() => setSectionPendingDelete(section)}
                        />
                      </Reorder.Item>
                    );
                  }

                  return null;
                })}
              </Reorder.Group>
            </main>
          </div>
        )}
      </div>

      {/* Report-level activity log drawer */}
      <AnimatePresence>
        {activityLogOpen && (
          <ReportActivityLogDrawer
            reportName={report.name}
            comments={comments}
            onAddComment={addComment}
            onClose={() => setActivityLogOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Download Preview Modal — PDF / PPT / DOCX tabs, preview before export */}
      <AnimatePresence>
        {showDownloadModal && (
          <ReportDownloadModal
            reportName={report.name}
            reportTag={report.tag}
            generatedBy={report.generatedBy}
            generatedAt={report.generatedAt}
            sections={sections.map((s): DownloadPreviewSection => {
              if (s.kind === 'query') {
                const q = s.query;
                const kpis = computeQueryKpis(q).map(k => ({ label: k.label, value: k.value }));
                const charts = QUERY_GRAPHS[q.id] ?? [];
                const table = QUERY_TABLES[q.id] ?? null;
                return {
                  id: s.id,
                  kind: 'query',
                  title: s.title,
                  queryId: q.id,
                  queryTitle: q.title,
                  severity: q.severity,
                  risk: q.risk,
                  summary: q.summary,
                  answer: q.answer,
                  findings: q.findings,
                  observations: q.observations,
                  kpis,
                  charts,
                  table,
                };
              }
              if (s.kind === 'workflow') {
                const w = s.workflow;
                return {
                  id: s.id,
                  kind: 'workflow',
                  title: s.title,
                  workflowId: w.workflowId,
                  workflowName: w.name,
                  severity: w.severity,
                  summary: w.findings[0] ?? '',
                  findings: w.findings,
                  observations: w.observations,
                };
              }
              if (s.kind === 'observation') {
                return {
                  id: s.id,
                  kind: 'observation',
                  title: s.title,
                  obsId: s.obsId,
                  description: s.description,
                };
              }
              if (s.kind === 'summary' || s.kind === 'note') {
                return { id: s.id, kind: s.kind, title: s.title, content: s.content };
              }
              return { id: s.id, kind: s.kind, title: s.title };
            })}
            onClose={() => setShowDownloadModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Add Query modal — opened from empty-state cover */}
      <AddQueryModal
        open={addQueryOpen}
        onClose={() => setAddQueryOpen(false)}
        onAttach={(selection) => {
          const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          onAddQuery(report.id, {
            id: `aq-${Date.now()}`,
            kind: selection.kind,
            label: selection.label,
            attachedAt: today,
            attachedBy: report.generatedBy,
          });
          const verb = selection.kind === 'upload' ? 'Uploaded' : 'Attached';
          addToast({ type: 'success', message: `${verb} "${selection.label}" — data syncing…` });
        }}
      />

      {/* Upload Report → Generate ATR modal — opened from the ATR report cover */}
      {uploadReportOpen && <UploadReportModal onClose={() => setUploadReportOpen(false)} />}

      {/* Generate ATR — editable Action Taken Report preview (same as Action Hub) */}
      {atrModalOpen && <GenerateATRModal onClose={() => setAtrModalOpen(false)} />}

      {/* Confirm dialog — section delete from Contents */}
      <ConfirmDialog
        open={!!sectionPendingDelete}
        onClose={() => setSectionPendingDelete(null)}
        onConfirm={confirmDeleteSection}
        title="Remove section?"
        description={sectionPendingDelete && (
          <>This will remove <span className="font-semibold text-text">{sectionPendingDelete.title}</span> from the report. This action cannot be undone.</>
        )}
        confirmLabel="Remove"
        destructive
      />

      {/* Add Observation modal — shared component */}
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

// ─── Main Reports View ───
export default function ReportsView({
  onShare,
  onManageExceptions,
  onOpenQuery,
  customTemplates: customTemplatesProp,
  onAddCustomTemplate,
  focusReportId,
  onFocusReportConsumed,
}: ReportsViewProps = {}) {
  const { addToast, updateToast } = useToast();
  const { openShare } = useShare();
  const { can } = useCan();
  const [activeTab, setActiveTab] = useState<'templates' | 'my-reports' | 'shared-reports'>(() => {
    if (typeof window === 'undefined') return 'my-reports';
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'shared-reports' || t === 'templates' || t === 'my-reports') return t;
    // Legacy deep-links to the old top-level ATR / Evidence tabs now land in My Reports.
    if (t === 'atr-reports' || t === 'evidence') return 'my-reports';
    return 'my-reports';
  });
  // Segmented sub-tabs inside My Reports: the 3 report types + the evidence repository.
  const [reportType, setReportType] = useState<'atr' | 'sox' | 'ia' | 'evidence'>(() => {
    if (typeof window === 'undefined') return 'ia';
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'evidence') return 'evidence';
    if (t === 'atr-reports') return 'atr';
    return 'ia';
  });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [gridSearch, setGridSearch] = useState('');
  const [sharedGridSearch, setSharedGridSearch] = useState('');
  const [viewingReport, setViewingReport] = useState<GeneratedReport | null>(null);
  // ATR template "Generate" opens the Generate-ATR-from-Observations wizard.
  const [atrWizardOpen, setAtrWizardOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [editingAsCopy, setEditingAsCopy] = useState(false);
  const [customTemplatesLocal, setCustomTemplatesLocal] = useState<typeof REPORT_TEMPLATES[number][]>(CUSTOM_TEMPLATES as typeof REPORT_TEMPLATES[number][]);
  const customTemplates = customTemplatesProp ?? customTemplatesLocal;
  const addCustomTemplate = (t: typeof REPORT_TEMPLATES[number]) => {
    if (onAddCustomTemplate) onAddCustomTemplate(t);
    else setCustomTemplatesLocal(prev => [t, ...prev]);
  };
  const GENERATED_REPORTS_KEY = 'irame.reports.generatedReports.v7';
  const [hydrationFailed, setHydrationFailed] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(() => {
    try {
      const raw = localStorage.getItem(GENERATED_REPORTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as GeneratedReport[];
      }
    } catch {
      // Defer to an effect so the toast call can happen after mount.
      setTimeout(() => setHydrationFailed(true), 0);
    }
    return [...GENERATED_REPORTS];
  });
  // Brief hydration flag — `true` for the first render only so list views can
  // show skeletons while the persisted blob is read. Flips after first paint.
  const [isHydrating, setIsHydrating] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setIsHydrating(false), 120);
    return () => window.clearTimeout(id);
  }, []);
  // Surface the rare read failure once.
  useEffect(() => {
    if (hydrationFailed) {
      addToast({
        type: 'error',
        message: "Couldn't load your saved reports — starting from defaults.",
      });
    }
  }, [hydrationFailed, addToast]);
  // Persist on change. If the write fails (quota, private mode), tell the
  // user once per session rather than swallowing it silently.
  const persistFailedOnceRef = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(GENERATED_REPORTS_KEY, JSON.stringify(generatedReports));
    } catch {
      if (persistFailedOnceRef.current) return;
      persistFailedOnceRef.current = true;
      addToast({
        type: 'error',
        message: "Couldn't save your work locally — your browser storage may be full.",
      });
    }
  }, [generatedReports, addToast]);

  // ── ATR library: the curated mock ATRs plus any the user generated (have atrData). ──
  const allAtrs = useMemo<AtrLibraryReport[]>(() => {
    const generated = generatedReports
      .filter(r => r.atrData)
      .map((r): AtrLibraryReport => ({
        id: r.id,
        templateId: r.templateId ?? 'rt-007',
        name: r.name,
        tag: 'Internal Audit',
        generatedBy: r.generatedBy,
        generatedAt: r.generatedAt,
        status: r.status === 'final' ? 'final' : 'draft',
        pages: r.pages ?? 1,
        queries: r.queries ?? 0,
        area: r.atrData!.meta.auditTitle ?? 'Custom ATR',
        atrData: r.atrData!,
      }));
    return [...generated, ...ATR_LIBRARY];
  }, [generatedReports]);
  // Per-type counts for the My Reports sub-tab badges (ATR uses allAtrs).
  const typeCounts = useMemo(() => {
    let sox = 0, ia = 0;
    generatedReports.forEach(r => {
      const k = reportKind(r);
      if (k === 'sox') sox++;
      else if (k === 'ia') ia++;
    });
    return { sox, ia };
  }, [generatedReports]);
  const openAtr = useCallback((atr: AtrLibraryReport) => {
    setViewingReport(atr as unknown as GeneratedReport);
  }, []);
  const openAtrById = useCallback((id: string) => {
    const atr = allAtrs.find(a => a.id === id);
    if (atr) setViewingReport(atr as unknown as GeneratedReport);
    else addToast({ type: 'info', message: 'Source report is not in your library.' });
  }, [allAtrs, addToast]);

  // Offline banner — listens to online/offline events.
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hot-receive new reports generated by a Bulk Run (BulkRunProgress dispatches
  // this when its run completes). Prepend so it appears at the top of My Reports.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<GeneratedReport>).detail;
      if (!detail || !detail.id) return;
      setGeneratedReports(prev => (prev.some(r => r.id === detail.id) ? prev : [detail, ...prev]));
    };
    window.addEventListener('irame:bulk-report-created', handler);
    return () => window.removeEventListener('irame:bulk-report-created', handler);
  }, []);

  // Toast "Open report" click flows through App.tsx, which sets focusReportId.
  // When it changes, jump into the full-page view of that report.
  const [missingFocusReport, setMissingFocusReport] = useState(false);
  useEffect(() => {
    if (!focusReportId) return;
    const report = generatedReports.find(r => r.id === focusReportId);
    if (report) {
      setActiveTab('my-reports');
      const k = reportKind(report);
      if (k === 'sox' || k === 'ia') setReportType(k);
      setViewingReport(report);
      setMissingFocusReport(false);
      onFocusReportConsumed?.();
    } else if (generatedReports.length > 0) {
      // Hydration has occurred but the requested id is absent.
      setMissingFocusReport(true);
      onFocusReportConsumed?.();
    }
  }, [focusReportId, generatedReports, onFocusReportConsumed]);

  const addQueryToReport = (reportId: string, query: AttachedQuery) => {
    setGeneratedReports(prev => prev.map(r =>
      r.id === reportId
        ? { ...r, attachedQueries: [...(r.attachedQueries ?? []), query] }
        : r
    ));
    setViewingReport(prev =>
      prev && prev.id === reportId
        ? { ...prev, attachedQueries: [...(prev.attachedQueries ?? []), query] }
        : prev
    );
  };

  const removeAttachedQuery = (reportId: string, queryId: string) => {
    setGeneratedReports(prev => prev.map(r =>
      r.id === reportId
        ? { ...r, attachedQueries: (r.attachedQueries ?? []).filter(q => q.id !== queryId) }
        : r
    ));
    setViewingReport(prev =>
      prev && prev.id === reportId
        ? { ...prev, attachedQueries: (prev.attachedQueries ?? []).filter(q => q.id !== queryId) }
        : prev
    );
  };

  const updateReportDescription = (reportId: string, description: string) => {
    setGeneratedReports(prev => prev.map(r =>
      r.id === reportId ? { ...r, description } : r
    ));
    setViewingReport(prev =>
      prev && prev.id === reportId ? { ...prev, description } : prev
    );
  };

  const [previewingTemplate, setPreviewingTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reportAppliedTemplates, setReportAppliedTemplates] = useState<Record<string, typeof REPORT_TEMPLATES[0]>>({});
  const [chooseReportFor, setChooseReportFor] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [showNewReportTemplateSelector, setShowNewReportTemplateSelector] = useState(false);
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [newReportName, setNewReportName] = useState('');
  const [newReportDesc, setNewReportDesc] = useState('');
  const [newReportTemplate, setNewReportTemplate] = useState('');
  const [newReportTemplatePrefilled, setNewReportTemplatePrefilled] = useState(false);

  const openNewReportModal = () => {
    setNewReportName('');
    setNewReportDesc('');
    setNewReportTemplate('');
    setNewReportTemplatePrefilled(false);
    setShowNewReportTemplateSelector(true);
  };
  const closeNewReportModal = () => {
    setShowNewReportTemplateSelector(false);
  };

  const filteredReports = (() => {
    const q = gridSearch.trim().toLowerCase();
    // Only the SOX / IA sub-tabs render this list; scope reports to the active type.
    const byType = generatedReports.filter(r => reportKind(r) === reportType);
    const byTag = tagFilter === 'All'
      ? byType
      : byType.filter(r => r.tag === tagFilter);
    return q ? byTag.filter(r => r.name.toLowerCase().includes(q)) : byTag;
  })();

  const TAG_FILTER_OPTIONS = ['All', 'Internal Audit', 'Bulk Audit'];

  const TagFilterDropdown = () => (
    <div className="relative">
      <button
        onClick={() => setShowTagDropdown(p => !p)}
        className="h-7 flex items-center gap-1.5 px-2.5 text-[11px] font-medium text-ink-700 bg-paper-50 border border-canvas-border hover:border-brand-200 transition-colors cursor-pointer rounded-[8px]"
      >
        {tagFilter === 'All' ? 'All Tags' : tagFilter}
        <ChevronDown size={12} className={`text-text-muted transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
      </button>
      {showTagDropdown && (
        <div className="absolute left-0 top-full mt-1 w-40 bg-canvas-elevated shadow-lg border border-canvas-border z-50 py-2 rounded-lg">
          <div className="px-1.5">
            {TAG_FILTER_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => { setTagFilter(t); setShowTagDropdown(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer transition-colors ${tagFilter === t ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-paper-50'}`}
              >
                {t === 'All' ? 'All Tags' : t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const ActionTooltip = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <span className="relative group/tt inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 px-2 py-1 bg-ink-900 text-white text-[10px] font-medium rounded-[8px] whitespace-nowrap opacity-0 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </span>
  );


  if (viewingReport) {
    // Generated Action Taken Reports render in their dedicated view (the same
    // content shown in the preview, with Manage Exceptions + Generate ATR).
    if (viewingReport.atrData) {
      return (
        <AtrReportView
          report={{ ...viewingReport, atrData: viewingReport.atrData }}
          onBack={() => setViewingReport(null)}
          onShare={onShare ? () => onShare(viewingReport.id) : undefined}
        />
      );
    }
    // All Bulk Audit reports now render as Editorial (chosen treatment) unless
    // an explicit aestheticVariant overrides it. Internal Audit reports keep
    // the default ReportView.
    if (viewingReport.aestheticVariant || viewingReport.tag === 'Bulk Audit') {
      return (
        <BulkAuditVariantView
          report={{ ...viewingReport, aestheticVariant: viewingReport.aestheticVariant ?? 'editorial' }}
          onBack={() => setViewingReport(null)}
          onShare={onShare ? () => onShare(viewingReport.id) : undefined}
        />
      );
    }
    return (
      <ReportView
        report={viewingReport}
        onBack={() => setViewingReport(null)}
        onShare={onShare ? () => onShare(viewingReport.id) : undefined}
        onManageExceptions={onManageExceptions}
        onOpenQuery={onOpenQuery}
        initialTemplate={reportAppliedTemplates[viewingReport.id] ?? null}
        customTemplates={customTemplates}
        onAddQuery={addQueryToReport}
        onRemoveQuery={removeAttachedQuery}
        onUpdateDescription={updateReportDescription}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      {isOffline && (
        <div
          role="status"
          aria-live="assertive"
          className="bg-mitigated-50 text-mitigated-800 border-y border-mitigated-200 px-4 h-8 flex items-center gap-2 text-[12px]"
        >
          <WifiOff size={14} aria-hidden="true" />
          <span>You're offline — recent changes will sync once you reconnect.</span>
        </div>
      )}
      {missingFocusReport && (
        <div className="px-[124px] py-12">
          <EmptyState
            icon={AlertTriangle}
            title="Report not found"
            body="It may have been deleted or moved. Return to the reports list."
            action={
              <button
                onClick={() => setMissingFocusReport(false)}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-white bg-primary hover:bg-primary-hover rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
              >
                <ArrowLeft size={14} /> Back to reports
              </button>
            }
          />
        </div>
      )}
      <div className="reports-focus-noring px-[124px] py-8 relative flex flex-col min-h-full">
        {/* Header + Tabs share a single full-bleed white strip — bg-white
            extends past the page's horizontal/top insets so the strip reads
            as the page's header section, separate from the content below. */}
        <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 mb-6 border-b border-border">
          {/* Header */}
          <div className="mb-6">
            <div className="font-mono text-[11px] text-ink-500 mb-2 tracking-tight">
              Reports · {activeTab === 'shared-reports' ? 'Shared Reports' : activeTab === 'templates' ? 'Templates' : `My Reports · ${reportType === 'atr' ? 'ATR' : reportType === 'sox' ? 'SOX' : reportType === 'ia' ? 'IA' : 'Evidence'}`}
            </div>
            <h1 className="font-display text-[34px] font-[420] tracking-tight text-ink-900 leading-[1.15]">Reports</h1>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-x-0 gap-y-2">
          <button
            onClick={() => setActiveTab('my-reports')}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'my-reports' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            <span className="flex items-center gap-2">
              <BookOpen size={14} />
              My Reports
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'my-reports' ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{generatedReports.length}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('shared-reports')}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'shared-reports' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            <span className="flex items-center gap-2">
              <Share2 size={14} />
              Shared Reports
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'shared-reports' ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{SHARED_REPORTS.length}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'templates' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            <span className="flex items-center gap-2">
              <FileText size={14} />
              Templates
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'templates' ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{REPORT_TEMPLATES.length + customTemplates.length}</span>
            </span>
          </button>
          </div>
        </div>

        {/* My Reports sub-tabs — segregated by report type (ATR · SOX · IA) plus
            the linked evidence repository. */}
        {activeTab === 'my-reports' && (
          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            {([
              { key: 'ia', label: 'IA', icon: BookOpen, count: typeCounts.ia },
              { key: 'atr', label: 'ATR', icon: FileCheck2, count: allAtrs.length },
              { key: 'sox', label: 'SOX', icon: Shield, count: typeCounts.sox },
              { key: 'evidence', label: 'Evidence', icon: FolderArchive, count: EVIDENCE_LIBRARY.length },
            ] as const).map(seg => {
              const SegIcon = seg.icon;
              const active = reportType === seg.key;
              return (
                <button
                  key={seg.key}
                  onClick={() => setReportType(seg.key)}
                  className={`h-9 px-3.5 inline-flex items-center gap-2 text-[13px] font-medium rounded-[10px] border transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-border-light text-ink-600 hover:border-primary/30 hover:text-text-secondary'
                  }`}
                >
                  <SegIcon size={14} />
                  {seg.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-paper-50 text-ink-500'}`}>{seg.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ATR — every generated Action Taken Report, browsable */}
        {activeTab === 'my-reports' && reportType === 'atr' && (
          <AtrReportsLibrary atrs={allAtrs} onOpen={openAtr} />
        )}

        {/* Evidence — segregated repository, each item linked to its source ATR */}
        {activeTab === 'my-reports' && reportType === 'evidence' && (
          <EvidenceRepository onOpenSource={openAtrById} />
        )}

        {/* My Reports — modern AI-SaaS table: minimal chrome, sentence-case
            headers, no grid lines, generous rows, very quiet hover. */}
        {activeTab === 'my-reports' && (reportType === 'sox' || reportType === 'ia') && viewMode === 'list' && isHydrating && (
          <div className="flex-1 px-5 py-6 space-y-4" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}
        {activeTab === 'my-reports' && (reportType === 'sox' || reportType === 'ia') && viewMode === 'list' && !isHydrating && (
          <SmartTable
            className="flex-1"
            variant="modern"
            searchBg="bg-paper-50"
            showSortHint
            data={filteredReports as unknown as Record<string, unknown>[]}
            keyField="id"
            searchPlaceholder="Search reports..."
            searchKeys={['name', 'generatedBy']}
            paginated
            pageSize={20}
            hideResultCount
            emptyContent={generatedReports.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No reports yet"
                body="Reports you generate from a template will appear here."
                size="compact"
              />
            ) : (
              ({ search, clearSearch }) => (
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <div className="w-10 h-10 rounded-[8px] bg-paper-50 flex items-center justify-center mb-1">
                    <Search size={20} className="text-ink-400" />
                  </div>
                  <div className="text-[13px] font-medium text-ink-700">
                    {tagFilter !== 'All' && search
                      ? `No reports match "${search}" in "${tagFilter}".`
                      : tagFilter !== 'All'
                        ? `No reports match the "${tagFilter}" filter.`
                        : 'No reports match your search.'}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {tagFilter !== 'All' && (
                      <button
                        type="button"
                        onClick={() => setTagFilter('All')}
                        className="text-[12px] text-brand-700 font-medium hover:underline cursor-pointer"
                      >
                        Clear filter
                      </button>
                    )}
                    {search && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="text-[12px] text-brand-700 font-medium hover:underline cursor-pointer"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
            headerExtra={
              <div className="flex items-center gap-2">
                <TagFilterDropdown />
                <div className="flex items-center gap-0.5 p-0.5 bg-paper-50 rounded-[8px]">
                  <button onClick={() => setViewMode('list')} className="p-1.5 rounded-[8px] bg-white shadow-sm text-primary cursor-pointer" title="List view"><List size={16} /></button>
                  <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-[8px] text-text-muted hover:text-text-secondary cursor-pointer" title="Grid view"><LayoutGrid size={16} /></button>
                </div>
              </div>
            }
            columns={[
              { key: 'index', label: 'No.', width: '52px', sortable: false, render: (_item, i) => (
                <span className="font-mono text-[11px] text-text-muted tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
              )},
              { key: 'name', label: 'Report', render: (item) => {
                return (
                  <div className="cursor-pointer min-w-0" onClick={() => {
                    const report = generatedReports.find(r => r.id === item.id);
                    if (report) setViewingReport(report);
                  }}>
                    <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                      {(() => {
                        const n = String(item.name);
                        const truncated = n.length > 100 ? n.slice(0, 100) + '…' : n;
                        return (
                          <span className="relative group/nt inline-flex min-w-0" title={n.length > 100 ? n : undefined}>
                            <span className="text-[16px] font-semibold tracking-[-0.005em] text-ink-800 truncate hover:text-primary transition-colors">{truncated}</span>
                            {n.length > 100 && (
                              <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 px-3 py-2 bg-ink-900 text-white text-[11px] font-normal leading-snug rounded-[8px] max-w-[480px] whitespace-normal break-words opacity-0 group-hover/nt:opacity-100 transition-opacity z-50 shadow-lg">
                                {n}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                      {reportAppliedTemplates[String(item.id)] && (
                        <span className="text-[10px] font-medium text-primary inline-flex items-center gap-1 shrink-0">
                          <Layout size={12} /> {reportAppliedTemplates[String(item.id)].name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-text-muted font-mono tabular-nums shrink-0">{String(item.queries)} {Number(item.queries) === 1 ? 'query' : 'queries'}</span>
                      {Boolean(item.tag) && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] ${reportTagChip(String(item.tag)).classes}`}>
                          {String(item.tag)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }},
              { key: 'generatedAt', label: 'Generated', width: '150px', render: (item) => (
                <span className="font-mono text-[12px] tabular-nums text-text-secondary">{String(item.generatedAt)}</span>
              )},
              { key: 'actions', label: '', width: '120px', sortable: false, align: 'right', render: (item) => (
                <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <ActionTooltip label="Download"><button onClick={(e) => { e.stopPropagation(); startReportDownload(addToast, updateToast, String(item.name)); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-primary hover:bg-primary-xlight rounded-[8px] transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>
                  {can('rp_share') && <ActionTooltip label="Share"><button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: String(item.id), anchor: rectFromEvent(e) }); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-primary hover:bg-primary-xlight rounded-[8px] transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>}
                  <ActionTooltip label="Delete"><button onClick={(e) => { e.stopPropagation(); setReportToDelete({ id: String(item.id), name: String(item.name) }); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-risk-700 hover:bg-risk-50 rounded-[8px] transition-colors cursor-pointer" aria-label="Delete"><Trash2 size={14} /></button></ActionTooltip>
                </div>
              )},
            ]}
          />
        )}

        {activeTab === 'my-reports' && (reportType === 'sox' || reportType === 'ia') && viewMode === 'grid' && (
          <div className="w-full flex-1">
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={gridSearch}
                  onChange={e => setGridSearch(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full pl-8 pr-8 py-1.5 border border-border bg-paper-50 text-[12px] rounded-[8px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                {gridSearch && (
                  <button
                    onClick={() => setGridSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TagFilterDropdown />
                <div className="flex items-center gap-0.5 p-0.5 bg-paper-50 rounded-[8px]">
                  <button onClick={() => setViewMode('list')} className="p-1.5 rounded-[8px] text-text-muted hover:text-text-secondary cursor-pointer" title="List view"><List size={16} /></button>
                  <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-[8px] bg-white shadow-sm text-primary cursor-pointer" title="Grid view"><LayoutGrid size={16} /></button>
                </div>
              </div>
            </div>
            {filteredReports.length === 0 ? (
              generatedReports.length === 0 ? (
                <div className="px-6 py-12">
                  <EmptyState
                    icon={FileText}
                    title="No reports yet"
                    body="Reports you generate from a template will appear here."
                  />
                </div>
              ) : (
                <div className="px-6 py-20 flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-[8px] bg-paper-50 flex items-center justify-center mb-1">
                    <Search size={20} className="text-ink-400" />
                  </div>
                  <div className="text-[13px] font-medium text-ink-700 max-w-[320px]">
                    {tagFilter !== 'All' && gridSearch
                      ? `No reports match "${gridSearch}" in "${tagFilter}".`
                      : tagFilter !== 'All'
                        ? `No reports match the "${tagFilter}" filter.`
                        : 'No reports match your search.'}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {tagFilter !== 'All' && (
                      <button
                        type="button"
                        onClick={() => setTagFilter('All')}
                        className="text-[12px] text-brand-700 font-medium hover:underline cursor-pointer"
                      >
                        Clear filter
                      </button>
                    )}
                    {gridSearch && (
                      <button
                        type="button"
                        onClick={() => setGridSearch('')}
                        className="text-[12px] text-brand-700 font-medium hover:underline cursor-pointer"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : (
            <ChromaGrid className="w-full p-5 grid grid-cols-3 gap-4 items-start" radius={320} damping={0.45} fadeOut={0.6}>
              {filteredReports.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="chroma-card-lite bg-white border border-border-light rounded-[12px] p-6 hover:border-primary/30 transition-colors group cursor-pointer flex flex-col min-h-[168px]"
                    onMouseMove={handleChromaCardMove}
                    onClick={() => setViewingReport(r)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h3 className="text-[16px] font-semibold leading-[1.3] tracking-[-0.005em] text-ink-800 group-hover:text-primary transition-colors line-clamp-2 min-w-0" title={r.name}>{r.name}</h3>
                      <div className="flex items-center gap-0.5 -mt-1.5 -mr-1.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <ActionTooltip label="Download"><button onClick={(e) => { e.stopPropagation(); startReportDownload(addToast, updateToast, r.name); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-primary hover:bg-primary-xlight rounded-[8px] transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>
                        {can('rp_share') && <ActionTooltip label="Share"><button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: r.id, anchor: rectFromEvent(e) }); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-primary hover:bg-primary-xlight rounded-[8px] transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>}
                        <ActionTooltip label="Delete"><button onClick={(e) => { e.stopPropagation(); setReportToDelete({ id: r.id, name: r.name }); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-risk-700 hover:bg-risk-50 rounded-[8px] transition-colors cursor-pointer" aria-label="Delete"><Trash2 size={14} /></button></ActionTooltip>
                      </div>
                    </div>
                    <div className="mt-auto pt-3.5 border-t border-border-light/70 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] tabular-nums text-ink-500 shrink-0">{r.queries} {Number(r.queries) === 1 ? 'query' : 'queries'}</span>
                        {r.tag && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] ${reportTagChip(r.tag).classes}`}>
                            {r.tag}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-ink-400 shrink-0">{r.generatedAt}</span>
                    </div>
                  </motion.div>
              ))}
            </ChromaGrid>
            )}
          </div>
        )}

        {/* Shared Reports — same modern table variant so tab switching
            doesn't change the visual grammar. */}
        {activeTab === 'shared-reports' && viewMode === 'list' && (
          <SmartTable
            className="flex-1"
            variant="modern"
            searchBg="bg-paper-50"
            showSortHint
            data={SHARED_REPORTS as unknown as Record<string, unknown>[]}
            keyField="id"
            searchPlaceholder="Search shared reports..."
            searchKeys={['name', 'sharedBy', 'sharedWith']}
            paginated
            pageSize={20}
            hideResultCount
            emptyContent={SHARED_REPORTS.length === 0 ? (
              <EmptyState
                icon={Share2}
                title="No shared reports"
                body="Reports shared with you by your team will appear here."
              />
            ) : (
              ({ search, clearSearch }) => (
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <div className="w-10 h-10 rounded-[8px] bg-paper-50 flex items-center justify-center mb-1">
                    <Search size={20} className="text-ink-400" />
                  </div>
                  <div className="text-[13px] font-medium text-ink-700">
                    No shared reports match your search.
                  </div>
                  {search && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="text-[12px] text-brand-700 font-medium hover:underline cursor-pointer mt-1"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )
            )}
            headerExtra={
              <div className="flex items-center gap-0.5 p-0.5 bg-paper-50 rounded-[8px]">
                <button onClick={() => setViewMode('list')} className="p-1.5 rounded-[8px] bg-white shadow-sm text-primary cursor-pointer" title="List view"><List size={16} /></button>
                <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-[8px] text-text-muted hover:text-text-secondary cursor-pointer" title="Grid view"><LayoutGrid size={16} /></button>
              </div>
            }
            columns={[
              { key: 'index', label: 'No.', width: '52px', sortable: false, render: (_item, i) => (
                <span className="font-mono text-[11px] text-text-muted tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
              )},
              { key: 'name', label: 'Report', render: (item) => (
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold tracking-[-0.005em] text-ink-800 truncate">{String(item.name)}</div>
                  <div className="text-[11px] text-text-muted font-mono tabular-nums mt-1">
                    {String(item.queries)} {Number(item.queries) === 1 ? 'query' : 'queries'}
                  </div>
                </div>
              )},
              { key: 'sharedBy', label: 'Shared by', render: (item) => (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[9px] font-semibold flex items-center justify-center">
                    {String(item.sharedBy).split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <span className="text-text-secondary text-[12px]">{String(item.sharedBy)}</span>
                </div>
              )},
              { key: 'sharedAt', label: 'Shared', width: '150px', render: (item) => (
                <span className="font-mono text-[12px] tabular-nums text-text-secondary">{String(item.sharedAt)}</span>
              )},
              { key: 'actions', label: '', width: '110px', sortable: false, align: 'right', render: (item) => (
                <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <ActionTooltip label="Download"><button onClick={(e) => { e.stopPropagation(); startReportDownload(addToast, updateToast, String(item.name)); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-primary hover:bg-primary-xlight rounded-[8px] transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>
                  {can('rp_share') && <ActionTooltip label="Share"><button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: String(item.id), anchor: rectFromEvent(e) }); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-primary hover:bg-primary-xlight rounded-[8px] transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>}
                </div>
              )},
            ]}
          />
        )}

        {activeTab === 'shared-reports' && viewMode === 'grid' && (() => {
          const q = sharedGridSearch.trim().toLowerCase();
          const filteredSharedReports = q
            ? SHARED_REPORTS.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.sharedBy.toLowerCase().includes(q) ||
                r.sharedWith.toLowerCase().includes(q)
              )
            : SHARED_REPORTS;
          return (
          <div className="w-full flex-1">
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={sharedGridSearch}
                  onChange={e => setSharedGridSearch(e.target.value)}
                  placeholder="Search shared reports..."
                  className="w-full pl-8 pr-8 py-1.5 border border-border bg-paper-50 text-[12px] rounded-[8px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                {sharedGridSearch && (
                  <button
                    onClick={() => setSharedGridSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-0.5 p-0.5 bg-paper-50 rounded-[8px]">
                <button onClick={() => setViewMode('list')} className="p-1.5 rounded-[8px] text-text-muted hover:text-text-secondary cursor-pointer" title="List view"><List size={16} /></button>
                <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-[8px] bg-white shadow-sm text-primary cursor-pointer" title="Grid view"><LayoutGrid size={16} /></button>
              </div>
            </div>
            {filteredSharedReports.length === 0 ? (
              SHARED_REPORTS.length === 0 ? (
                <div className="px-6 py-12">
                  <EmptyState
                    icon={Share2}
                    title="No shared reports"
                    body="Reports shared with you by your team will appear here."
                  />
                </div>
              ) : (
                <div className="px-6 py-20 flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-[8px] bg-paper-50 flex items-center justify-center mb-1">
                    <Search size={20} className="text-ink-400" />
                  </div>
                  <div className="text-[13px] font-medium text-ink-700 max-w-[320px]">
                    No shared reports match your search.
                  </div>
                  {sharedGridSearch && (
                    <button
                      type="button"
                      onClick={() => setSharedGridSearch('')}
                      className="text-[12px] text-brand-700 font-medium hover:underline cursor-pointer mt-1"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )
            ) : (
            <ChromaGrid className="w-full p-5 grid grid-cols-3 gap-4 items-start" radius={320} damping={0.45} fadeOut={0.6}>
              {filteredSharedReports.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="chroma-card-lite bg-white border border-border-light rounded-[12px] p-6 hover:border-primary/30 transition-colors group cursor-pointer flex flex-col min-h-[168px]"
                  onMouseMove={handleChromaCardMove}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <h3 className="text-[16px] font-semibold leading-[1.3] tracking-[-0.005em] text-ink-800 group-hover:text-primary transition-colors line-clamp-2 min-w-0" title={r.name}>{r.name}</h3>
                    <div className="flex items-center gap-0.5 -mt-1.5 -mr-1.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <ActionTooltip label="Download"><button onClick={(e) => { e.stopPropagation(); startReportDownload(addToast, updateToast, r.name); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-primary hover:bg-primary-xlight rounded-[8px] transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>
                      {can('rp_share') && <ActionTooltip label="Share"><button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: r.id, anchor: rectFromEvent(e) }); }} className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-primary hover:bg-primary-xlight rounded-[8px] transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>}
                    </div>
                  </div>
                  <div className="mt-auto pt-3.5 border-t border-border-light/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] tabular-nums text-ink-500 shrink-0">{r.queries} {Number(r.queries) === 1 ? 'query' : 'queries'}</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold bg-primary/10 text-primary shrink-0 tabular-nums">
                          {r.sharedBy.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-[12px] text-ink-600 truncate">{r.sharedBy}</span>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-ink-400 shrink-0">{r.sharedAt}</span>
                  </div>
                </motion.div>
              ))}
            </ChromaGrid>
            )}
          </div>
          );
        })()}

        {activeTab === 'templates' && (() => {
          const renderCard = (rt: typeof REPORT_TEMPLATES[0], i: number, fixedWidth?: boolean) => {
            const Icon = ICON_MAP[rt.icon] || FileText;
            const color = CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50';
            const eyebrowTone = color.split(' ')[0];
            const tintBg = color.split(' ')[1] ?? 'bg-paper-50';
            return (
              <motion.div
                key={rt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`bg-white border border-border-light rounded-[12px] p-6 shadow-[0_1px_2px_rgba(15,8,30,0.04)] hover:border-primary/30 hover:shadow-[0_8px_24px_rgba(15,8,30,0.06)] transition-[box-shadow,border-color] duration-200 group cursor-pointer flex flex-col min-h-[200px] ${fixedWidth ? 'w-[200px] shrink-0' : ''}`}
                onClick={() => setPreviewingTemplate(rt)}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`inline-flex items-center justify-center w-9 h-9 rounded-[8px] ${tintBg}`}>
                    <Icon size={16} className={eyebrowTone} strokeWidth={1.75} />
                  </div>
                  <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] mt-1 ${eyebrowTone}`}>
                    {rt.category}
                  </div>
                </div>
                <h3 className="text-[15px] leading-[1.35] font-semibold text-text group-hover:text-primary transition-colors mb-1.5">{rt.name}</h3>
                <p className="text-[12px] text-text-secondary leading-[1.55] line-clamp-3">{rt.desc}</p>
                <div className="mt-auto pt-5 flex items-center justify-between gap-3 border-t border-border-light/60">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingAsCopy(true); setEditingTemplate(rt); }}
                    className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors"
                  >
                    <Settings size={12} /> Customize
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // ATR template → open the Generate-ATR-from-Observations wizard
                      // (download template → upload → review → Add to Report).
                      if (rt.id === 'rt-007') { setAtrWizardOpen(true); return; }
                      addToast({ type: 'info', message: `Generating "${rt.name}"...` });
                      setTimeout(() => {
                        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const sectionsCount = rt.sections?.length ?? 0;
                        const tagFromTemplate = rt.category === 'Risk' ? 'Bulk Audit' : 'Internal Audit';
                        const newReport: GeneratedReport = {
                          id: `gr-gen-${Date.now()}`,
                          templateId: rt.id,
                          name: `${rt.name} — ${today}`,
                          tag: tagFromTemplate,
                          generatedBy: 'You',
                          generatedAt: today,
                          status: 'draft',
                          pages: Math.max(1, sectionsCount),
                          queries: 0,
                          isEmpty: true,
                        };
                        setGeneratedReports(prev => [newReport, ...prev]);
                        setViewingReport(newReport);
                        addToast({ type: 'success', message: 'Report generated.' });
                      }, 1200);
                    }}
                    className="group/gen inline-flex items-center gap-1.5 h-8 px-3.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-semibold rounded-[8px] cursor-pointer transition-colors shadow-[0_1px_2px_rgba(106,18,205,0.18)]"
                  >
                    Generate
                    <ArrowRight size={12} className="transition-transform duration-200 group-hover/gen:translate-x-[1.5px]" />
                  </button>
                </div>
              </motion.div>
            );
          };

          return (
            <div className="space-y-10">
              <section>
                <h2 className="font-display text-[20px] font-[420] tracking-tight text-ink-900 leading-[1.2] mb-4">Standard templates</h2>
                <div className="grid grid-cols-3 gap-4">
                  {REPORT_TEMPLATES.map((rt, i) => renderCard(rt, i, false))}
                </div>
              </section>

              <section>
                <h2 className="font-display text-[20px] font-[420] tracking-tight text-ink-900 leading-[1.2] mb-4">Custom templates</h2>
                {customTemplates.length === 0 ? (
                  <EmptyState
                    icon={Upload}
                    title="No custom templates"
                    body="Upload a template to reuse it across reports."
                    size="compact"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {customTemplates.map((rt, i) => renderCard(rt as any, i, false))}
                  </div>
                )}
              </section>
            </div>
          );
        })()}
      </div>

      {/* Template Editor Modal */}
      <AnimatePresence>
        {editingTemplate && (
          <TemplateEditor
            template={editingTemplate}
            isCopy={editingAsCopy}
            onClose={() => { setEditingTemplate(null); setEditingAsCopy(false); }}
            onSaveCopy={(copy) => addCustomTemplate(copy)}
            existingTemplateNames={[...REPORT_TEMPLATES.map(t => t.name), ...customTemplates.map(t => t.name)]}
          />
        )}
      </AnimatePresence>

      {/* Template Preview Modal */}
      <AnimatePresence>
        {previewingTemplate && (
          <TemplatePreviewModal
            template={previewingTemplate}
            onClose={() => setPreviewingTemplate(null)}
            onEdit={() => { setEditingAsCopy(false); setEditingTemplate(previewingTemplate); setPreviewingTemplate(null); }}
            onUse={() => { setChooseReportFor(previewingTemplate); setPreviewingTemplate(null); }}
          />
        )}
      </AnimatePresence>

      {/* Choose Report Modal */}
      <AnimatePresence>
        {chooseReportFor && (
          <ChooseReportModal
            template={chooseReportFor}
            reports={GENERATED_REPORTS}
            onClose={() => setChooseReportFor(null)}
            onCancel={() => { setPreviewingTemplate(chooseReportFor); setChooseReportFor(null); }}
            onContinue={(report) => {
              setReportAppliedTemplates(prev => ({ ...prev, [report.id]: chooseReportFor }));
              addToast({ type: 'success', message: `"${chooseReportFor.name}" applied to "${report.name}"` });
              setViewingReport(report);
              setChooseReportFor(null);
            }}
            onAddNew={() => {
              setNewReportName('');
              setNewReportDesc('');
              setNewReportTemplate(chooseReportFor.id);
              setNewReportTemplatePrefilled(true);
              setShowNewReportTemplateSelector(true);
              setChooseReportFor(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Upload Template Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <UploadTemplateModal onClose={() => setShowUploadModal(false)} />
        )}
      </AnimatePresence>

      {/* Generate ATR from Observations — opened by the ATR template "Generate".
          The review step's "Add to Report" saves the ATR into My Reports. */}
      {atrWizardOpen && (
        <UploadReportModal
          onClose={() => setAtrWizardOpen(false)}
          onAddToReport={(meta: AtrMeta, observations: AtrObservation[], insights: AtrInsight[]) => {
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const name = meta.auditTitle ? `ATR — ${meta.auditTitle}` : `Action Taken Report — ${today}`;
            const newReport: GeneratedReport = {
              id: `gr-atr-${Date.now()}`,
              templateId: 'rt-007',
              name,
              tag: 'Internal Audit',
              generatedBy: 'You',
              generatedAt: today,
              status: 'draft',
              pages: Math.max(1, observations.length),
              queries: observations.length,
              atrData: { meta, observations, insights },
            };
            setGeneratedReports(prev => [newReport, ...prev]);
            setViewingReport(newReport);
            setAtrWizardOpen(false);
            addToast({ type: 'success', message: 'Action Taken Report added to My Reports.' });
          }}
        />
      )}

      {/* New Report Modal */}
      <AnimatePresence>
        {showNewReportTemplateSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeNewReportModal}>
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              role="dialog" aria-modal="true" aria-label="New Report"
              className="relative bg-white shadow-2xl w-[560px] overflow-hidden flex flex-col rounded-[16px]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 text-primary rounded-[8px]"><FileText size={16} /></div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-text">New Report</h3>
                    <p className="text-[11px] text-text-muted">Set up your report</p>
                  </div>
                </div>
                <button onClick={closeNewReportModal} className="p-1.5 hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-[12px] font-semibold text-text mb-1.5">Report <span className="text-risk">*</span></label>
                  <input
                    value={newReportName}
                    onChange={e => setNewReportName(e.target.value)}
                    placeholder="Report 01 — April 23, 2026"
                    className="w-full px-3 py-2.5 border border-border-light text-[13px] text-text placeholder:text-text-muted/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all rounded-[8px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text mb-1.5">Description</label>
                  <textarea
                    value={newReportDesc}
                    onChange={e => setNewReportDesc(e.target.value)}
                    placeholder="Report Description goes here"
                    rows={3}
                    className="w-full px-3 py-2.5 border border-border-light text-[13px] text-text placeholder:text-text-muted/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none rounded-[8px]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[12px] font-semibold text-text">Template</label>
                    {newReportTemplatePrefilled && newReportTemplate && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                        <Sparkles size={12} /> Pre-filled from selection
                      </span>
                    )}
                  </div>
                  <select
                    value={newReportTemplate}
                    onChange={e => { setNewReportTemplate(e.target.value); setNewReportTemplatePrefilled(false); }}
                    className={`w-full px-3 py-2.5 border text-[13px] text-text appearance-none outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer bg-white rounded-[8px] ${
                      newReportTemplatePrefilled && newReportTemplate ? 'border-primary/50' : 'border-border-light'
                    }`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a12cd' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option value="">Select a template</option>
                    {REPORT_TEMPLATES.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                    <option value="__custom__">Custom Template</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border-light shrink-0 flex justify-end">
                <button
                  onClick={() => {
                    if (newReportTemplate === '__custom__') {
                      closeNewReportModal();
                      setShowBuilderModal(true);
                      return;
                    }
                    const template = REPORT_TEMPLATES.find(t => t.id === newReportTemplate);
                    if (!template) return;
                    closeNewReportModal();
                    addToast({ type: 'info', message: `Generating "${newReportName}"...` });
                    setTimeout(() => {
                      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const sectionsCount = template.sections?.length ?? 0;
                      const tagFromTemplate = template.category === 'Risk' ? 'Bulk Audit' : 'Internal Audit';
                      const newReport: GeneratedReport = {
                        id: `gr-gen-${Date.now()}`,
                        templateId: template.id,
                        name: newReportName.trim(),
                        tag: tagFromTemplate,
                        generatedBy: 'You',
                        generatedAt: today,
                        status: 'draft',
                        pages: Math.max(1, sectionsCount),
                        queries: 0,
                        isEmpty: true,
                      };
                      setGeneratedReports(prev => [newReport, ...prev]);
                      setViewingReport(newReport);
                      addToast({ type: 'success', message: 'Report generated.' });
                    }, 1200);
                  }}
                  disabled={!newReportName.trim() || !newReportTemplate}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer rounded-[8px]"
                >
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Builder Modal */}
      <AnimatePresence>
        {showBuilderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              className="relative bg-white overflow-hidden shadow-2xl flex flex-col w-[560px] max-h-[80vh] rounded-[16px]"
              onClick={e => e.stopPropagation()}
            >
              <ReportBuilder
                context="new"
                onBack={() => setShowBuilderModal(false)}
                initialTitle={newReportName.trim() || undefined}
                onSaveAsTemplate={(t) => addCustomTemplate(t as typeof REPORT_TEMPLATES[number])}
                existingTemplateNames={[...REPORT_TEMPLATES.map(t => t.name), ...customTemplates.map(t => t.name)]}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!reportToDelete}
        onClose={() => setReportToDelete(null)}
        title="Delete report?"
        description={reportToDelete && (
          <>This will remove <span className="font-semibold text-text">{reportToDelete.name}</span> from My Reports. You can undo this from the toast for a few seconds.</>
        )}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!reportToDelete) return;
          const name = reportToDelete.name;
          const id = reportToDelete.id;
          // Snapshot the report and its position so Undo restores both.
          const snapshot = generatedReports.find(r => r.id === id);
          const snapshotIndex = generatedReports.findIndex(r => r.id === id);
          setGeneratedReports(prev => prev.filter(r => r.id !== id));
          setReportToDelete(null);
          addToast({
            type: 'success',
            message: `${name} deleted.`,
            action: snapshot ? {
              label: 'Undo',
              onClick: () => {
                setGeneratedReports(prev => {
                  if (prev.some(r => r.id === id)) return prev;
                  const next = [...prev];
                  next.splice(Math.max(0, snapshotIndex), 0, snapshot);
                  return next;
                });
              },
            } : undefined,
          });
        }}
      />
    </div>
  );
}
