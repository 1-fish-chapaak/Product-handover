import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import {
  FileText, Shield, AlertTriangle, CheckCircle2, BarChart3,
  TrendingUp, Download, Share2, ArrowRight, ArrowLeft, ChevronDown,
  ChevronLeft, ChevronRight,
  Sparkles, Settings, Palette, Type,
  Image, Layout, X, Edit3, BookOpen, Upload, Lightbulb, Loader2, Trash2,
  List, LayoutGrid, GripVertical, Plus, StickyNote, PanelLeftClose, PanelLeftOpen,
  ShieldAlert, MoreVertical, Eye, EyeOff, Database, Search, PackageOpen, ExternalLink, Copy,
  MessageSquare, Paperclip, Send, Clock as ClockIcon, History,
  Star, Layers, Check, CloudUpload,
} from 'lucide-react';
import { REPORT_TEMPLATES, GENERATED_REPORTS, SHARED_REPORTS } from '../../data/mockData';
import { REPORT_QUERIES_ATR, type ReportQueryAtr } from '../../data/reportQueries';
import { QUERY_SESSIONS, FAVOURITES } from '../../data/queryHistory';
import { QUERY_GRAPHS, type QueryGraph } from '../../data/queryGraphs';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import { StatusBadge } from '../shared/StatusBadge';
import SmartTable from '../shared/SmartTable';
import { useToast } from '../shared/Toast';
import FloatingLines from '../shared/FloatingLines';
import ReportBuilder from './ReportBuilder';
import { BulkAuditVariantView } from './BulkAuditVariants';
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
};

// Four design treatments for the bulk audit report detail page, exposed as
// side-by-side demos in My Reports so we can compare against the default.
export type BulkAuditAestheticVariant = 'editorial' | 'forensic' | 'minimal' | 'architectural';

type GeneratedReport = typeof GENERATED_REPORTS[number] & {
  isEmpty?: boolean;
  attachedQueries?: AttachedQuery[];
  description?: string;
  workflowResults?: WorkflowResult[];
  aestheticVariant?: BulkAuditAestheticVariant;
};

// Dummy user-created templates. Replace with real data when the create-custom-template flow lands.
export const CUSTOM_TEMPLATES = [
  {
    id: 'ct-custom-01',
    name: 'Custom Template - 01',
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
    name: 'Custom Template - 02',
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
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white border border-border shadow-md flex items-center justify-center text-text hover:bg-surface-2 hover:border-primary/40 disabled:opacity-0 disabled:pointer-events-none transition-all cursor-pointer"
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
      <button
        type="button"
        onClick={() => scroll('right')}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white border border-border shadow-md flex items-center justify-center text-text hover:bg-surface-2 hover:border-primary/40 disabled:opacity-0 disabled:pointer-events-none transition-all cursor-pointer"
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
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Upload Template"
        className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl"><Upload size={16} /></div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">Upload Template</h3>
              <p className="text-[11px] text-text-muted">Convert a document into a report template</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-lg transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Drop Zone */}
          {step === 'upload' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <button
                onClick={() => setStep('selected')}
                className="w-full border-2 border-dashed border-border-light hover:border-primary/40 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:bg-primary/[0.02] cursor-pointer group"
              >
                <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors">
                  <Upload size={28} className="text-primary/50 group-hover:text-primary transition-colors" />
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
              <div className="flex items-center gap-3 p-4 bg-primary/[0.03] border border-primary/10 rounded-xl">
                <div className="p-2 bg-primary/10 rounded-lg"><FileText size={18} className="text-primary" /></div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-text">SOX_Report_Template.docx</p>
                  <p className="text-[11px] text-text-muted">2.4 MB</p>
                </div>
                <CheckCircle2 size={18} className="text-compliant-700" />
              </div>
              <button
                onClick={() => setStep('converting')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-primary-medium text-white text-[13px] font-semibold hover:from-primary-hover hover:to-primary transition-all cursor-pointer" style={{ borderRadius: '8px' }}
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
              <div className="flex items-center gap-3 p-4 bg-compliant-50 border border-compliant rounded-xl">
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
                      className="flex items-center gap-2.5 px-3 py-2 bg-surface-2 rounded-lg"
                    >
                      <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
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
                  className="w-full px-3 py-2.5 border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" style={{ borderRadius: '8px' }}
                />
              </div>
            </motion.div>
          )}
        </div>

        {step === 'converted' && (
          <div className="px-6 py-4 border-t border-border-light flex justify-end gap-2 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-text-secondary border border-border hover:bg-paper-50 transition-colors cursor-pointer" style={{ borderRadius: '8px' }}>Cancel</button>
            <button
              onClick={() => { addToast({ type: 'success', message: `"${templateName}" saved to template library!` }); onClose(); }}
              className="px-5 py-2 bg-primary text-white text-[12px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer" style={{ borderRadius: '8px' }}
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Template Preview"
        className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${color}`}><Icon size={16} /></div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">{template.name}</h3>
              <p className="text-[11px] text-text-muted">{template.category} template</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-lg transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <p className="text-[12.5px] text-text-secondary leading-relaxed">{template.desc}</p>

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
                    className="flex items-center gap-3 px-4 py-3 bg-surface-2 rounded-xl hover:bg-primary/[0.03] transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-white border border-border-light shadow-sm">
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
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-text-secondary border border-border-light hover:border-primary/30 hover:bg-primary-xlight rounded-lg transition-colors cursor-pointer"
          >
            <Edit3 size={12} /> Edit Template
          </button>
          <button
            onClick={onUse}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-xl text-[12px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
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
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = reports.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = reports.find(r => r.id === selectedId) || null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Choose Report"
        className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl"><PackageOpen size={16} /></div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">Choose Report</h3>
              <p className="text-[12px] text-text-muted">Select an existing report or create a new report</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-lg transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border-light focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
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
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
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
          <button
            onClick={onAddNew}
            className="w-full px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-[13px] font-semibold transition-colors cursor-pointer"
          >
            + Add New Report
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light flex items-center gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-2.5 rounded-lg border border-border-light text-text-secondary text-[13px] font-semibold hover:bg-paper-50 hover:text-text transition-colors cursor-pointer"
          >
            Back
          </button>
          <button
            onClick={() => { if (selected) onContinue(selected); }}
            disabled={!selected}
            className="flex-1 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:bg-primary/40 disabled:cursor-not-allowed"
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
      className="group flex items-center gap-2.5 px-3 py-2 bg-surface-2 rounded-lg"
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag ${section.name} to reorder`}
        className="text-text-muted hover:text-primary cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical size={12} />
      </button>
      <div className="p-1 rounded-md bg-white border border-border-light shadow-sm">
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
  const [brand, setBrand] = useState('Auditify');
  const [theme, setTheme] = useState('Purple & White');
  const [headerText, setHeaderText] = useState('Confidential — For Internal Use Only');
  const [footerText, setFooterText] = useState('Generated by Auditify Copilot');
  const [sections, setSections] = useState(template.sections || []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Edit Template"
        className="relative bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl"><Settings size={16} /></div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">Edit Template</h3>
              <p className="text-[11px] text-text-muted">{isCopy ? `Copy of ${template.name}` : template.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-lg transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Template Name (Copy flow) + Brand */}
          {isCopy ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><FileText size={13} /> Template Name</label>
                <input value={copyName} onChange={e => setCopyName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Image size={13} /> Brand Name</label>
                <input value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
              </div>
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Image size={13} /> Brand Name</label>
              <input value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </div>
          )}

          {/* Theme */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Palette size={13} /> Color Theme</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { name: 'Purple & White', colors: ['#6a12cd', '#f8f9fc'] },
                { name: 'Navy & Gold', colors: ['#1a2744', '#c5a55a'] },
                { name: 'Teal & Light', colors: ['#0d9488', '#f0fdfa'] },
                { name: 'Slate & Blue', colors: ['#334155', '#3b82f6'] },
              ].map(t => (
                <button key={t.name} onClick={() => setTheme(t.name)} className={`p-2.5 rounded-lg border-2 text-center transition-all cursor-pointer ${theme === t.name ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'}`}>
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
            <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Type size={13} /> Header Text</label>
            <input value={headerText} onChange={e => setHeaderText(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
          </div>

          {/* Footer */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><Layout size={13} /> Footer Text</label>
            <input value={footerText} onChange={e => setFooterText(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border-light text-[13px] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
          </div>

          {/* Page Layout Preview */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-text mb-2"><FileText size={13} /> Page Layout Preview</label>
            <div className="border border-border-light rounded-xl p-4 bg-surface-2">
              <div className="bg-white rounded-lg shadow-sm border border-border-light overflow-hidden flex flex-col">
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
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-paper-50 rounded-lg transition-colors cursor-pointer">Cancel</button>
          <button
            onClick={() => {
              if (isCopy && onSaveCopy) {
                const finalName = copyName.trim() || `Copy of ${template.name}`;
                if (existingTemplateNames.some(n => n.toLowerCase() === finalName.toLowerCase())) {
                  addToast({ type: 'error', message: `A template named "${finalName}" already exists. Choose a different name.` });
                  return;
                }
                onSaveCopy({
                  ...template,
                  id: `ct-copy-${Date.now()}`,
                  name: finalName,
                  sections,
                });
                addToast({ type: 'success', message: 'Copy saved to Custom Templates!' });
              } else {
                addToast({ type: 'success', message: 'Template saved!' });
              }
              onClose();
            }}
            className="px-5 py-2 bg-primary text-white rounded-xl text-[12px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
          >{isCopy ? 'Save Copy' : 'Save Template'}</button>
        </div>
      </motion.div>
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
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Executive Summary */}
        <div className="bg-white rounded-xl border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-2 flex items-center gap-2"><FileText size={14} className="text-primary" /> Executive Summary</h3>
          <p className="text-[12px] text-text-secondary leading-relaxed">FY26 Q1 SOX compliance audit covered 87 controls across 4 business processes (P2P, O2C, R2R, S2C). 54 controls tested to date with 89% effectiveness rate. 2 material weaknesses identified requiring remediation before March 31 deadline. Overall compliance score: 94.2% — improved from 91.8% prior quarter.</p>
        </div>
        {/* Control Testing Results — Excel-style */}
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
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
        <div className="bg-white rounded-xl border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-risk-700" /> Deficiency Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'DEF-001', control: 'CTR-003', title: 'Vendor Master Change — Missing Dual Approval', severity: 'Significant', status: 'In Remediation', due: 'Mar 31, 2026', owner: 'Deepak Bansal', desc: '7 vendor master changes processed without dual-approval. Includes 3 bank account modifications.' },
              { id: 'DEF-002', control: 'CTR-008', title: 'Journal Entry Override — Approval Bypass', severity: 'Material Weakness', status: 'Evidence Submitted', due: 'Mar 31, 2026', owner: 'Rohan Patel', desc: '7 journal entries posted bypassing approval workflow. Total value: 12.4L. Root cause: system configuration gap.' },
            ].map(d => (
              <div key={d.id} className="rounded-xl border border-border-light p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-md bg-risk">{d.id}</span>
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
      if (score >= 8) return 'bg-high';
      if (score >= 4) return 'bg-mitigated';
      return 'bg-compliant';
    };
    return (
      <div className="space-y-5">
        <div className="flex gap-2 flex-wrap">
          {sections.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Risk Heatmap */}
        <div className="bg-white rounded-xl border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-4 flex items-center gap-2"><Shield size={14} className="text-primary" /> Risk Matrix</h3>
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-2 text-center">Impact →</div>
              <div className="grid grid-cols-5 gap-1">
                {[5,4,3,2,1].map(likelihood => (
                  [1,2,3,4,5].map(impact => {
                    const risksInCell = risks.filter(r => r.likelihood === likelihood && r.impact === impact);
                    return (
                      <div key={`${likelihood}-${impact}`} className={`aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold text-white ${riskColor(likelihood, impact)} ${risksInCell.length > 0 ? 'ring-2 ring-white shadow-md' : 'opacity-30'}`}>
                        {risksInCell.length > 0 ? risksInCell.map(r => r.id.split('-')[1]).join(',') : ''}
                      </div>
                    );
                  })
                ))}
              </div>
              <div className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mt-1 -rotate-0">↑ Likelihood</div>
            </div>
            <div className="w-48">
              <div className="text-[10px] font-semibold text-text mb-2">Legend</div>
              <div className="space-y-1.5">
                {[{ c: 'bg-risk', l: 'Critical (12-25)' }, { c: 'bg-high', l: 'High (8-11)' }, { c: 'bg-mitigated', l: 'Medium (4-7)' }, { c: 'bg-compliant', l: 'Low (1-3)' }].map(item => (
                  <div key={item.l} className="flex items-center gap-2 text-[10px] text-text-secondary"><div className={`w-3 h-3 rounded ${item.c}`} /> {item.l}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Risk Register */}
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
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
                  <td className="px-4 py-2.5 text-center"><span className={`inline-flex w-6 h-6 items-center justify-center rounded-md text-[10px] font-bold text-white ${riskColor(r.likelihood, r.impact)}`}>{r.likelihood * r.impact}</span></td>
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
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Effectiveness Scorecards */}
        <div className="grid grid-cols-4 gap-3">
          {processes.map(p => (
            <div key={p.name} className="bg-white rounded-xl border border-border-light p-4 hover:shadow-primary/5 transition-all">
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
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
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
        <div className="bg-white rounded-xl border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-primary" /> Improvement Plan</h3>
          <div className="space-y-2">
            {['Automate 5 manual detective controls in P2P — target: 98% effectiveness', 'Accelerate S2C control testing — hire 1 contractor for April-June sprint', 'Deploy AI anomaly detection on R2R reconciliation — reduce deficiency rate by 50%', 'Implement continuous monitoring for all preventive controls by Q2'].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2 bg-primary/[0.02] rounded-lg">
                <span className="text-[9px] font-bold text-primary bg-primary/10 w-5 h-5 rounded-md flex items-center justify-center shrink-0">{i + 1}</span>
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
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
            </div>
          ))}
        </div>
        {/* Workflow Performance Cards */}
        <div className="grid grid-cols-2 gap-3">
          {workflows.map(w => (
            <div key={w.name} className="bg-white rounded-xl border border-border-light p-4 hover:shadow-primary/5 transition-all">
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
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
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
            <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
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
            <div key={m.label} className="bg-white rounded-xl border border-border-light p-5 text-center">
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">{m.label}</div>
              <div className={`text-[32px] font-bold leading-none ${m.color}`}>{m.value}</div>
              <div className="text-[11px] font-semibold text-compliant-700 mt-1">{m.delta}</div>
              <div className="text-[10px] text-text-muted">{m.sub}</div>
            </div>
          ))}
        </div>
        {/* Process Breakdown */}
        <div className="bg-white rounded-xl border border-border-light p-5">
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
        <div className="bg-white rounded-xl border border-border-light p-5">
          <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Strategic Recommendations</h3>
          <div className="space-y-2">
            {['Approve additional AI workflow investment for S2C process — projected 3x ROI based on P2P results', 'Remediate DEF-002 (journal entry override) before March 31 — material weakness impacting filing', 'Reallocate Tushar Goel from P2P to S2C support in April — P2P is 72% complete, S2C needs acceleration', 'Expand vendor master monitoring to O2C process — similar risk profile to P2P where it saved 2.4L'].map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 bg-primary/[0.02] rounded-lg border border-primary/5">
                <span className="text-[9px] font-bold text-white bg-primary w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
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
          <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-border-light text-[11px] font-medium text-text-secondary shadow-sm">
            <span className="text-[9px] font-bold text-primary/50">{i + 1}</span> {s.name}
          </div>
        ))}
      </div>
      {sections.map((s) => {
        const SIcon = SECTION_ICONS[s.icon] || FileText;
        return (
          <div key={s.name} className="bg-white rounded-xl border border-border-light p-5">
            <h3 className="text-[13px] font-bold text-text mb-2 flex items-center gap-2"><SIcon size={14} className="text-primary" /> {s.name}</h3>
            <div className="h-16 bg-paper-50 rounded-lg flex items-center justify-center text-[11px] text-text-muted border border-dashed border-border-light">
              Section content generated from {report.name} data
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Query Card Component ───
type QueryShape = { id: string; status: string; risk: string; severity: string; title: string; addedBy: string; kpis: { label: string; value: string; color: string }[]; summary: string; findings: string[]; observations: string[]; chartData: number[] };

function parseNumeric(v: string): number {
  const match = String(v).match(/-?\d[\d,.]*/);
  if (!match) return 0;
  return Number(match[0].replace(/[,\s]/g, '')) || 0;
}

function computeQueryKpis(query: QueryShape) {
  const firstVal = parseNumeric(query.kpis[0]?.value ?? '0');
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

/**
 * Modern launch-in-new-tab CTA for "Manage Exceptions". On click:
 *   1. A brand-tinted ripple radiates from the click point (tactile feedback).
 *   2. A short shimmer sweeps left→right across the button (state change signal).
 *   3. The trailing arrow "ejects" right and fades (directional cue → new tab).
 *   4. A tiny "Opening in new tab…" pill pops above the button (context hint
 *      so the user is never surprised by the new tab).
 *   5. After 340ms, window.open fires with a URL (?view=manage-exceptions)
 *      that the SPA reads on load to land directly on the Manage Exceptions view.
 *   6. Button is locked during the 340ms window to prevent double-fire.
 *
 * The whole interaction lives under 500ms, respects prefers-reduced-motion
 * (the keyframes auto-shorten to 10ms via the global reduced-motion rule in
 * index.css), and has no dependency on external animation libraries.
 */
function ManageExceptionsLaunchButton({ queryId }: { queryId: string }) {
  const [launching, setLaunching] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (launching) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() });
    setLaunching(true);
    // Kick off a page-level LTR launch pulse so the whole shell nudges right
    // in sync with the button — reinforces the "content is ejecting" metaphor.
    window.dispatchEvent(new CustomEvent('app:launch-pulse'));
    // Fire the new tab just after the user's eye has locked onto the hint.
    window.setTimeout(() => {
      const url = `${window.location.pathname}?view=manage-exceptions&from=${encodeURIComponent(queryId)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }, 340);
    // Reset state so the button becomes re-usable (same tab stays open).
    window.setTimeout(() => {
      setLaunching(false);
      setRipple(null);
    }, 700);
  };

  return (
    <button
      onClick={handleClick}
      disabled={launching}
      title="Review & classify exceptions · opens in a new tab"
      aria-label={`Review & classify exceptions for ${queryId} — opens in a new tab`}
      className={`group relative overflow-hidden inline-flex items-center gap-1.5 h-8 pl-3 pr-2.5 text-[12px] font-semibold text-white rounded-[8px] cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(106,18,205,0.25)] hover:shadow-[0_4px_14px_rgba(106,18,205,0.35)] ${
        launching ? 'scale-[0.97] shadow-[0_0_0_4px_rgba(106,18,205,0.25),0_4px_14px_rgba(106,18,205,0.35)]' : 'hover:-translate-y-[1px] active:translate-y-0'
      }`}
      style={{ background: 'linear-gradient(135deg, #6A12CD 0%, #A366F0 100%)' }}
    >
      <ShieldAlert size={13} className="shrink-0 relative z-10" />
      <span className="relative z-10">Manage Exceptions</span>
      <ArrowRight
        size={13}
        className={`shrink-0 relative z-10 ${launching ? '' : 'transition-transform duration-200 group-hover:translate-x-0.5'}`}
        style={launching ? { animation: 'launch-arrow-eject 340ms cubic-bezier(0.2, 0, 0, 1) forwards' } : undefined}
      />

      {/* Ripple from click point */}
      {ripple && (
        <span
          key={ripple.id}
          aria-hidden="true"
          className="absolute pointer-events-none rounded-full bg-white/50"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 8,
            height: 8,
            animation: 'launch-ripple 620ms cubic-bezier(0.2, 0, 0, 1) forwards',
          }}
        />
      )}

      {/* Shimmer sweep */}
      {launching && (
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.38) 50%, transparent 100%)',
            animation: 'launch-shimmer 420ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }}
        />
      )}

      {/* Context hint — "Opening in new tab…" */}
      {launching && (
        <span
          aria-hidden="true"
          className="absolute -top-[32px] left-1/2 text-[10.5px] font-semibold text-primary bg-white border border-primary/25 px-2 h-6 rounded-full shadow-md whitespace-nowrap flex items-center gap-1 pointer-events-none"
          style={{ animation: 'launch-hint-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
        >
          <ArrowRight size={10} className="-rotate-45" />
          Opening in new tab…
        </span>
      )}
    </button>
  );
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
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="relative bg-white rounded-[16px] border border-border-light shadow-2xl w-[440px] max-w-[calc(100vw-32px)] p-6"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-paper-50 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
          <h3 id={titleId} className="text-[16px] font-bold text-text tracking-tight mb-2">{title}</h3>
          <div id={descId} className="text-[13px] text-text-secondary leading-relaxed mb-6 pr-4">{description}</div>
          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer"
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

function QueryCard({ query, index, onManageExceptions, onOpenQuery, onDelete, comments = [], onAddComment, casesPhase, onCasesPhaseChange, title }: { query: QueryShape; index: number; onManageExceptions?: () => void; onOpenQuery?: (query: { id: string; title: string }) => void; onDelete?: () => void; comments?: QueryComment[]; onAddComment?: (queryId: string, queryTitle: string, text: string, attachment?: string) => void; casesPhase: CasesPhase; onCasesPhaseChange: (phase: CasesPhase) => void; title?: string }) {
  const { addToast } = useToast();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'comments' | 'source-files' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [graphModalOpen, setGraphModalOpen] = useState(false);
  const [attachedGraphId, setAttachedGraphId] = useState<string | null>(null);
  const availableGraphs = QUERY_GRAPHS[query.id] ?? [];
  const attachedGraph = availableGraphs.find(g => g.id === attachedGraphId) ?? null;
  const menuRef = useRef<HTMLDivElement>(null);
  const baseDelay = index * 0.08;

  const statusStyle = query.status === 'Completed'
    ? { pill: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-500' }
    : { pill: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated-500' };

  const severityStyle = query.severity === 'Critical'
    ? { pill: 'bg-risk-50 text-risk-700', dot: 'bg-risk-500' }
    : { pill: 'bg-high-50 text-high-700', dot: 'bg-high-500' };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -2 }}
      style={{
        boxShadow: hovered
          ? '0 6px 20px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -2px rgba(15, 23, 42, 0.04)'
          : '0 0 0 rgba(0,0,0,0)',
        transition: 'box-shadow 220ms ease',
      }}
      className="relative border-y border-border-light bg-white overflow-hidden"
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
            <span className="font-bold text-primary uppercase tracking-wider shrink-0">{title ?? `Query · ${query.id}`}</span>
            <span className="w-px h-3 bg-border-light shrink-0" />
            <span className="font-medium text-text-muted uppercase tracking-wider shrink-0">{query.risk}</span>
            <span className="w-px h-3 bg-border-light shrink-0" />
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="relative inline-flex">
                <span className={`w-1.5 h-1.5 rounded-full ${severityStyle.dot}`} />
                {query.severity === 'Critical' && (
                  <motion.span
                    className={`absolute inset-0 rounded-full ${severityStyle.dot}`}
                    animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
              </span>
              <span className={`font-semibold uppercase tracking-wider ${query.severity === 'Critical' ? 'text-risk-700' : 'text-high-700'}`}>{query.severity}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${statusStyle.pill}`} style={{ borderRadius: '6px' }}>
              <span className={`w-1 h-1 rounded-full ${statusStyle.dot}`} />
              {query.status}
            </span>
            <GenerateCasesGate queryId={query.id} phase={casesPhase} onPhaseChange={onCasesPhaseChange} />
            {(() => {
              const myComments = comments.filter(c => c.queryId === query.id).length;
              return (
                <button
                  onClick={() => setDrawerTab('comments')}
                  title="Comments on this query"
                  aria-label="Comments on this query"
                  className="relative inline-flex items-center justify-center w-8 h-8 text-primary bg-white border border-primary/25 rounded-[8px] cursor-pointer hover:bg-primary-xlight hover:border-primary/40 transition-colors"
                >
                  <MessageSquare size={14} className="shrink-0" />
                  {myComments > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9.5px] font-semibold bg-primary text-white rounded-full tabular-nums border border-white">
                      {myComments}
                    </span>
                  )}
                </button>
              );
            })()}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                title="More options"
                aria-label="More options"
                className="w-8 h-8 flex items-center justify-center rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer"
              >
                <MoreVertical size={15} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-10 w-[200px] bg-white border border-border-light rounded-[10px] shadow-xl py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenQuery?.({ id: query.id, title: query.title });
                    }}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    Open Query
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigator.clipboard?.writeText(query.id);
                      addToast({ type: 'success', message: `Copied ${query.id}` });
                    }}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
                  >
                    <Copy size={13} />
                    Copy Card ID
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setGraphModalOpen(true); }}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
                  >
                    <BarChart3 size={13} />
                    Add Graph
                  </button>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
                  >
                    <Download size={13} />
                    Download
                  </button>
                  <div className="my-1 border-t border-border-light" />
                  <button
                    onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-risk-700 hover:bg-risk-50 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="text-[15px] font-semibold text-text leading-[1.5] mb-5"
        >
          {query.title}
        </motion.h3>

        {/* KPI strip — populated only after cases generate; placeholder otherwise so users know why metrics are missing */}
        {casesPhase === 'ready' ? (() => {
          const kpis = computeQueryKpis(query);
          if (kpis.length === 0) {
            return (
              <div className="border border-dashed border-border-light rounded-xl px-4 py-5 mb-5 text-center">
                <p className="text-[12px] text-text-muted">No metrics available for this query yet.</p>
              </div>
            );
          }
          return (
            <div className="grid grid-cols-4 gap-3 mb-5">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="bg-canvas-elevated border border-border-light rounded-xl p-4 flex items-center gap-3"
                >
                  <div className={`p-2 rounded-lg ${k.color}`}><k.icon size={16} /></div>
                  <div>
                    <div className="text-xl font-bold text-text tabular-nums">{k.value}</div>
                    <div className="text-[10px] text-text-muted tracking-wide">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })() : casesPhase === 'generating' ? (
          <div className="border border-dashed border-border-light rounded-xl px-4 py-5 mb-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-paper-50 flex items-center justify-center shrink-0">
              <Loader2 size={15} className="text-primary animate-spin" />
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-text">Generating cases…</p>
              <p className="text-[11.5px] text-text-muted leading-snug">
                Cases are being created — KPIs will appear here in a moment.
              </p>
            </div>
          </div>
        ) : null}

        {/* Attached graph (selected from Add Graph modal) */}
        {attachedGraph && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="bg-canvas-elevated border border-border-light rounded-xl p-4 mb-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                <BarChart3 size={12} />
                {attachedGraph.title}
              </div>
              <button
                onClick={() => setAttachedGraphId(null)}
                title="Remove graph"
                aria-label="Remove graph"
                className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
            <div className="h-[200px]">
              <ConfigurableChart
                type={attachedGraph.type}
                xAxis={attachedGraph.xAxis}
                yAxis={attachedGraph.yAxis}
                color={attachedGraph.color ?? '#6a12cd'}
                showTarget={false}
                showLegend
              />
            </div>
          </motion.div>
        )}

        {/* Summary */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: baseDelay + 0.6, duration: 0.4 }}
          className="text-[13px] text-text-secondary leading-relaxed mb-4"
        >
          {query.summary}
        </motion.p>

        {/* Findings & observations (always visible) */}
        <div className="space-y-6 pt-2">
          {[
            { title: 'Findings', items: query.findings, emptyCopy: 'No findings recorded for this query yet.' },
            { title: 'Observations', items: query.observations, emptyCopy: 'No observations recorded for this query yet.' },
          ].map(section => (
            <div key={section.title}>
              <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-3">{section.title}</h4>
              {section.items.length === 0 ? (
                <p className="text-[12.5px] text-text-muted italic">{section.emptyCopy}</p>
              ) : (
                <ul className="space-y-2.5">
                  {section.items.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: baseDelay + 0.7 + i * 0.05, duration: 0.3 }}
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
        </div>
      </div>

      {drawerTab && createPortal(
        <CommentDrawer
          query={query}
          comments={comments}
          onAddComment={onAddComment}
          initialTab={drawerTab}
          onClose={() => setDrawerTab(null)}
        />,
        document.body,
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Remove Query Card?"
        description="This will permanently remove this query card from the report. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete?.();
          addToast({ type: 'success', message: 'Query card removed.' });
        }}
      />

      {graphModalOpen && createPortal(
        <AddGraphModal
          queryId={query.id}
          queryTitle={query.title}
          graphs={availableGraphs}
          attachedGraphId={attachedGraphId}
          onSelect={(id) => {
            setAttachedGraphId(id);
            setGraphModalOpen(false);
            addToast({ type: 'success', message: 'Graph added to query card.' });
          }}
          onClose={() => setGraphModalOpen(false)}
        />,
        document.body,
      )}
    </motion.div>
  );
}

// ─── "Add Graph" modal — pick from query's available chat-session graphs ───
function AddGraphModal({
  queryId,
  queryTitle,
  graphs,
  attachedGraphId,
  onSelect,
  onClose,
}: {
  queryId: string;
  queryTitle: string;
  graphs: QueryGraph[];
  attachedGraphId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [pickedId, setPickedId] = useState<string | null>(attachedGraphId);

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
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="add-graph-title"
          className="relative bg-white rounded-[16px] border border-border-light shadow-2xl w-[820px] max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)] flex flex-col overflow-hidden"
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border-light">
            <div>
              <h3 id="add-graph-title" className="text-[16px] font-bold text-text tracking-tight">
                Add Graph
              </h3>
              <p className="text-[12.5px] text-text-secondary mt-1">
                <span className="font-mono text-[11px] text-primary">{queryId}</span>
                <span className="mx-1.5 text-text-muted">·</span>
                {queryTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-paper-50 transition-colors cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {graphs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-paper-50 flex items-center justify-center mb-3">
                  <BarChart3 size={20} className="text-text-muted" />
                </div>
                <p className="text-[13px] font-semibold text-text mb-1">No graphs available for this query yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {graphs.map((g) => {
                  const isPicked = pickedId === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setPickedId(g.id)}
                      className={`text-left bg-white border-2 rounded-xl p-3 transition-all cursor-pointer focus:outline-none ${
                        isPicked
                          ? 'border-primary shadow-[0_0_0_3px_rgba(106,18,205,0.12)]'
                          : 'border-border-light hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                            isPicked
                              ? 'bg-primary border-primary text-white'
                              : 'bg-white border-border-light text-transparent'
                          }`}
                        >
                          <Check size={12} />
                        </span>
                        <span className="text-[12.5px] font-semibold text-text">{g.title}</span>
                      </div>
                      <div className="h-[160px] bg-canvas-elevated rounded-lg p-1.5 pointer-events-none">
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

          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border-light bg-paper-50/40">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => pickedId && onSelect(pickedId)}
              disabled={!pickedId}
              className="inline-flex items-center justify-center h-9 px-5 text-[13px] font-semibold text-white bg-primary hover:bg-primary-hover rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Graph
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Query side-sheet — tabs: Comments + Source Files ───
function CommentDrawer({
  query,
  comments,
  onAddComment,
  onClose,
  initialTab = 'comments',
}: {
  query: QueryShape;
  comments: QueryComment[];
  onAddComment?: (queryId: string, queryTitle: string, text: string, attachment?: string) => void;
  onClose: () => void;
  initialTab?: 'comments' | 'source-files';
}) {
  const [activeTab, setActiveTab] = useState<'comments' | 'source-files'>(initialTab);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const seed = query.id.charCodeAt(query.id.length - 1);
  const sourceFiles = [
    { name: `${query.id}_invoices_raw.xlsx`,    type: 'excel' as const, size: '2.4 MB',  rows: 12480, modified: 'Mar 18, 2026', source: 'SAP · AP Ledger' },
    { name: `${query.id}_vendor_master.xlsx`,   type: 'excel' as const, size: '780 KB',  rows: 1843,  modified: 'Mar 12, 2026', source: 'Vendor Master · Oracle' },
    { name: `${query.id}_controls_catalog.csv`, type: 'csv'   as const, size: '144 KB',  rows: 312,   modified: 'Feb 28, 2026', source: 'GRC · Control Library' },
    { name: `${query.id}_po_grn_trail.xlsx`,    type: 'excel' as const, size: `${(1.2 + (seed % 5) * 0.3).toFixed(1)} MB`, rows: 5612, modified: 'Mar 20, 2026', source: 'Procurement · P2P' },
  ];

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
    if (!body) return;
    onAddComment?.(query.id, query.title, body, attachment ?? undefined);
    setText('');
    setAttachment(null);
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
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-white shadow-xl border-l border-border-light flex flex-col z-[60]"
        role="dialog"
        aria-label={activeTab === 'comments' ? 'Comments' : 'Data Source Files'}
      >
        {/* Tab strip + close */}
        <div className="shrink-0 flex items-end justify-between gap-4 px-6 pt-4 border-b border-border-light bg-white">
          <div role="tablist" aria-label="Query side-sheet tabs" className="flex items-center gap-1">
            {[
              { id: 'comments' as const, label: 'Comments', count: totalComments, icon: MessageSquare },
              { id: 'source-files' as const, label: 'Source Files', count: sourceFiles.length, icon: Database },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium cursor-pointer transition-colors ${
                    isActive ? 'text-primary' : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  {tab.label}
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 text-[10.5px] font-semibold rounded-full tabular-nums ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-text-muted'
                  }`}>
                    {tab.count}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="comment-drawer-tab-indicator"
                      className="absolute left-0 right-0 -bottom-px h-[2px] bg-primary rounded-t"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="mb-1 w-8 h-8 rounded-full text-text-muted hover:text-text hover:bg-primary-xlight flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab header (title + sub-text) */}
        <header className="shrink-0 px-6 py-5 border-b border-border-light">
          <h2 className="text-[16px] font-semibold text-text leading-tight">
            {activeTab === 'comments' ? 'Comments' : 'Data Source Files'}
          </h2>
          <p className="text-[12.5px] text-text-muted mt-0.5 leading-snug">
            {activeTab === 'comments' ? 'Commenting on ' : 'Files used to build '}
            <span className="font-mono font-semibold text-primary">{query.id}</span> — {query.title}
          </p>
        </header>

        {activeTab === 'comments' ? (
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
                    disabled={!text.trim()}
                    className={`w-7 h-7 flex items-center justify-center rounded-[6px] transition-colors ${
                      text.trim()
                        ? 'bg-[#6a12cd] text-white hover:bg-primary-hover cursor-pointer'
                        : 'text-text-muted/50 cursor-not-allowed'
                    }`}
                    aria-label="Post comment"
                    title="Post comment"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
              {attachment && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 h-6 px-2 bg-primary/10 text-primary text-[11.5px] font-medium rounded-full">
                    <Paperclip size={11} />
                    {attachment}
                  </span>
                  <button onClick={() => setAttachment(null)} className="text-[11px] text-text-muted hover:text-risk-700 cursor-pointer">remove</button>
                </div>
              )}
            </section>

            {/* Shared activity log */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Activity log</h3>
                <span className="text-[11px] text-text-muted tabular-nums">
                  {totalComments} {totalComments === 1 ? 'comment' : 'comments'} across {queryGroups.length} {queryGroups.length === 1 ? 'query' : 'queries'}
                </span>
              </div>
              {queryGroups.length === 0 ? (
                <p className="text-[13px] text-text-muted italic">No comments yet. Be the first to share a note.</p>
              ) : (
                <div className="space-y-4">
                  {queryGroups.map(group => (
                    <section key={group.queryId} className="border border-border-light rounded-[10px] overflow-hidden">
                      <header className={`px-3 py-2 bg-paper-50 border-b border-border-light flex items-center justify-between ${group.queryId === query.id ? 'bg-primary/5' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11.5px] font-bold text-primary shrink-0">{group.queryId}</span>
                          <span className="text-[11.5px] text-text-muted truncate">{group.queryTitle}</span>
                        </div>
                        <span className="text-[10.5px] text-text-muted tabular-nums shrink-0">
                          {group.items.length} {group.items.length === 1 ? 'comment' : 'comments'}
                        </span>
                      </header>
                      <ol className="divide-y divide-border-light">
                        {group.items.slice().reverse().map(c => (
                          <li key={c.id} className="px-3 py-3">
                            <div className="flex items-start gap-2.5">
                              <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold tracking-wider">
                                {c.initials}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                  <span className="text-[12.5px] font-semibold text-text">{c.author}</span>
                                  <span className="inline-flex items-center gap-1 text-[11px] text-text-muted tabular-nums whitespace-nowrap">
                                    <ClockIcon size={10} />
                                    {c.timestamp}
                                  </span>
                                </div>
                                <p className="text-[12.5px] text-text leading-relaxed">{c.text}</p>
                                {c.attachment && (
                                  <span className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 bg-primary/10 text-primary text-[11px] font-medium rounded-full">
                                    <Paperclip size={10} />
                                    {c.attachment}
                                  </span>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {sourceFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12">
                  <div className="w-10 h-10 rounded-xl bg-paper-50 flex items-center justify-center mb-3">
                    <FileText size={18} className="text-text-muted/50" />
                  </div>
                  <p className="text-[13px] font-medium text-text-secondary">No source files attached to this query yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border-light border border-border-light rounded-[10px] overflow-hidden">
                  {sourceFiles.map(f => {
                    const pillClass = f.type === 'excel'
                      ? 'bg-compliant-50 text-compliant-700'
                      : 'bg-brand-50 text-brand-700';
                    return (
                      <li key={f.name} className="flex items-center gap-3 px-4 py-3 hover:bg-paper-50 transition-colors">
                        <div className="w-9 h-9 rounded-[8px] bg-paper-50 border border-border-light flex items-center justify-center shrink-0">
                          <FileText size={16} className={f.type === 'excel' ? 'text-compliant-700' : 'text-brand-700'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[12.5px] font-semibold text-text truncate">{f.name}</span>
                            <span className={`inline-flex items-center h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wider rounded ${pillClass}`}>{f.type}</span>
                          </div>
                          <div className="text-[11.5px] text-text-muted tabular-nums">
                            {f.size} · {f.rows.toLocaleString()} rows · {f.source} · {f.modified}
                          </div>
                        </div>
                        <button
                          className="inline-flex items-center justify-center w-8 h-8 text-text-secondary bg-white border border-border-light rounded-[8px] hover:border-primary/30 hover:text-primary cursor-pointer"
                          title={`Preview ${f.name}`}
                          aria-label={`Preview ${f.name}`}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="inline-flex items-center justify-center w-8 h-8 text-text-secondary bg-white border border-border-light rounded-[8px] hover:border-primary/30 hover:text-primary cursor-pointer"
                          title={`Download ${f.name}`}
                          aria-label={`Download ${f.name}`}
                        >
                          <Download size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <footer className="shrink-0 px-6 py-3 border-t border-border-light text-right text-[11.5px] text-text-muted tabular-nums">
              {sourceFiles.length} files
            </footer>
          </>
        )}
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Newest first.
  const sorted = [...comments].reverse();

  const handlePost = () => {
    const body = text.trim();
    if (!body) return;
    // Report-level entries are tagged as global so they show across all surfaces.
    onAddComment?.('REPORT', `${reportName} — Report-level note`, body, attachment ?? undefined);
    setText('');
    setAttachment(null);
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
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-white shadow-xl border-l border-border-light flex flex-col z-[60]"
        role="dialog"
        aria-label="Report activity log"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-border-light">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <History size={18} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-text leading-tight">Report Activity Log</h2>
              <p className="text-[12.5px] text-text-muted mt-0.5 leading-snug">
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
            <div className="mt-2 inline-flex items-center gap-1.5 h-6 px-2 bg-primary/5 text-primary text-[11.5px] font-medium rounded-full">
              <Paperclip size={11} />
              {attachment}
              <button onClick={() => setAttachment(null)} className="hover:text-primary/70 cursor-pointer" aria-label="Remove attachment">
                <X size={11} />
              </button>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              onClick={handlePost}
              disabled={!text.trim()}
              className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-semibold rounded-[8px] transition-colors ${
                text.trim()
                  ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
                  : 'bg-primary/40 text-white/80 cursor-not-allowed'
              }`}
            >
              <Send size={12} />
              Post
            </button>
          </div>
        </section>

        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {sorted.length === 0 ? (
            <p className="text-center text-[12.5px] text-text-muted py-10">No activity recorded yet.</p>
          ) : (
            <ol className="space-y-4">
              {sorted.map(c => (
                <li key={c.id} className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold">
                    {c.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 mb-0.5">
                      <span className="text-[12.5px] font-semibold text-text">{c.author}</span>
                      <span className="text-[11px] text-text-muted tabular-nums whitespace-nowrap">{c.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mb-1.5">
                      <span className="inline-flex items-center h-4 px-1.5 font-mono font-medium bg-primary/5 text-primary rounded">
                        {c.queryId}
                      </span>{' '}
                      <span className="ml-1 line-clamp-1">{c.queryTitle}</span>
                    </div>
                    <p className="text-[12.5px] text-text leading-relaxed">{c.text}</p>
                    {c.attachment && (
                      <button className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 bg-primary/5 text-primary text-[11.5px] font-medium rounded-full hover:bg-primary/10 cursor-pointer">
                        <Paperclip size={11} />
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
      className="group/crow relative flex items-center gap-2 py-2.5 pl-1 pr-1 rounded-lg hover:bg-primary-xlight/30 transition-colors list-none cursor-default"
    >
      <button
        onPointerDown={(e) => { controls.start(e); }}
        aria-label="Drag to reorder"
        className="shrink-0 p-1 text-text-muted/40 hover:text-text-muted cursor-grab active:cursor-grabbing opacity-20 group-hover/crow:opacity-100 transition-opacity touch-none"
      >
        <GripVertical size={13} />
      </button>
      <span className="shrink-0 w-6 text-[10.5px] text-text-muted/70 font-mono tabular-nums text-right">{String(index).padStart(2, '0')}</span>
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
          {section.title}
        </button>
      )}
      {!isEditing && (
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/crow:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            aria-label="Rename section"
            className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer"
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete section"
            className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
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
        <MoreVertical size={15} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="w-[210px] bg-white border border-border-light rounded-[10px] shadow-xl py-1"
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
          >
            <Edit3 size={13} />
            Edit observation
          </button>
          {hasAttachment && (
            <button
              onClick={() => { setOpen(false); onToggleAttachment(); }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
            >
              {attachmentHidden ? <Eye size={13} /> : <EyeOff size={13} />}
              {attachmentHidden ? 'Show attachment' : 'Hide attachment'}
            </button>
          )}
          <div className="my-1 border-t border-border-light/60" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-risk-700 hover:bg-risk-50 cursor-pointer"
          >
            <Trash2 size={13} />
            Delete observation
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// Visual twin of QueryCard — same motion timing, hover lift, shadow, type scale.
// Renders an observation as a continuous-report card so it sits naturally beside
// QueryCards without looking like a different control.
function ObservationCard({
  obs,
  index,
  onEdit,
  onToggleAttachment,
  onDelete,
}: {
  obs: { id: string; obsId: string; title: string; description: string; attachmentDataUrl?: string; attachmentHidden?: boolean };
  index: number;
  onEdit: () => void;
  onToggleAttachment: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const baseDelay = index * 0.08;

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -2 }}
      style={{
        boxShadow: hovered
          ? '0 6px 20px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -2px rgba(15, 23, 42, 0.04)'
          : '0 0 0 rgba(0,0,0,0)',
        transition: 'box-shadow 220ms ease',
      }}
      className="relative border-y border-border-light bg-white overflow-hidden"
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
            hasAttachment={!!obs.attachmentDataUrl}
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

        {/* Attachment — click to open lightbox */}
        {obs.attachmentDataUrl && !obs.attachmentHidden && (
          <motion.button
            type="button"
            onClick={() => setLightboxOpen(true)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: baseDelay + 0.5, duration: 0.35 }}
            whileHover={{ scale: 1.02 }}
            title="Click to view full size"
            aria-label="Open attachment in full screen"
            className="block w-[100px] h-[100px] rounded-lg border border-border-light overflow-hidden bg-paper-50 cursor-zoom-in hover:border-primary/40 transition-colors"
          >
            <img src={obs.attachmentDataUrl} alt={obs.title} className="w-full h-full object-cover" />
          </motion.button>
        )}
      </div>

      {/* Fullscreen lightbox */}
      {lightboxOpen && obs.attachmentDataUrl && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[1100] bg-ink-900/85 flex items-center justify-center p-8 cursor-zoom-out"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            aria-label="Close preview"
            className="absolute top-5 right-5 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm"
          >
            <X size={18} />
          </button>
          <motion.img
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            src={obs.attachmentDataUrl}
            alt={obs.title}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] text-white/70 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm">
            {obs.obsId} · {obs.title}
          </div>
        </motion.div>,
        document.body,
      )}
    </motion.div>
  );
}

// Bulk-audit counterpart of QueryCard. Same chrome (border-y, hover lift,
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
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState(workflow.riskOwner ?? '');
  const menuRef = useRef<HTMLDivElement>(null);
  const baseDelay = index * 0.08;

  const severityStyle = workflow.severity === 'High'
    ? { pill: 'bg-risk-50 text-risk-700', dot: 'bg-risk-500' }
    : workflow.severity === 'Medium'
      ? { pill: 'bg-high-50 text-high-700', dot: 'bg-high-500' }
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
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -2 }}
      style={{
        boxShadow: hovered
          ? '0 6px 20px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -2px rgba(15, 23, 42, 0.04)'
          : '0 0 0 rgba(0,0,0,0)',
        transition: 'box-shadow 220ms ease',
      }}
      className="relative border-y border-border-light bg-white overflow-hidden"
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
              <span className={`font-semibold uppercase tracking-wider ${workflow.severity === 'High' ? 'text-risk-700' : workflow.severity === 'Medium' ? 'text-high-700' : 'text-compliant-700'}`}>{workflow.severity}</span>
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
                <MoreVertical size={15} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-10 w-[200px] bg-white border border-border-light rounded-[10px] shadow-xl py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigator.clipboard?.writeText(workflow.workflowId);
                      addToast({ type: 'success', message: `Copied ${workflow.workflowId}` });
                    }}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer"
                  >
                    <Copy size={13} />
                    Copy Workflow ID
                  </button>
                  {onDelete && (
                    <>
                      <div className="my-1 border-t border-border-light" />
                      <button
                        onClick={() => { setMenuOpen(false); onDelete(); }}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-risk-700 hover:bg-risk-50 cursor-pointer"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </>
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
                className="flex-1 max-w-[280px] px-2 py-1 text-[12px] text-text border border-primary/40 rounded-md focus:outline-none focus:border-primary"
              />
            ) : workflow.riskOwner ? (
              <button
                onClick={() => { setOwnerDraft(workflow.riskOwner ?? ''); setEditingOwner(true); }}
                className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-primary-xlight transition-colors cursor-pointer"
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
                <p className="text-[12.5px] text-text-muted italic">{section.emptyCopy}</p>
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
              <div className="border border-border-light rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-paper-50/70">
                      {workflow.outputTable.columns.map((col, ci) => (
                        <th
                          key={col}
                          className={`px-3 py-2 text-[10.5px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-light ${ci === workflow.outputTable!.columns.length - 1 ? 'text-right' : 'text-left'}`}
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
                                  className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold ${
                                    cellStr === 'High'
                                      ? 'bg-risk-50 text-risk-700'
                                      : cellStr === 'Medium'
                                        ? 'bg-high-50 text-high-700'
                                        : 'bg-compliant-50 text-compliant-700'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      cellStr === 'High'
                                        ? 'bg-risk-500'
                                        : cellStr === 'Medium'
                                          ? 'bg-high-500'
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
                    <Download size={11} />
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
  onManageExceptions,
  onOpenQuery,
  onDelete,
  comments,
  onAddComment,
  casesPhase,
  onCasesPhaseChange,
}: {
  section: { id: string; kind: 'query'; title: string; query: QueryShape };
  index: number;
  sectionProps: SectionProps;
  onManageExceptions?: () => void;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  onDelete: () => void;
  comments: QueryComment[];
  onAddComment: (queryId: string, queryTitle: string, text: string, attachment?: string) => void;
  casesPhase: CasesPhase;
  onCasesPhaseChange: (phase: CasesPhase) => void;
}) {
  return (
    <Reorder.Item {...sectionProps} className={`${sectionProps.className} relative`}>
      <QueryCard
        query={section.query}
        index={index}
        title={section.title}
        onManageExceptions={onManageExceptions}
        onOpenQuery={onOpenQuery}
        onDelete={onDelete}
        comments={comments}
        onAddComment={onAddComment}
        casesPhase={casesPhase}
        onCasesPhaseChange={onCasesPhaseChange}
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
      className="bg-white border border-border-light rounded-2xl px-6 py-5"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-[10px] bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
          <KindIcon size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-primary/80">{kindLabel}</span>
            <span className="text-[10.5px] text-text-muted">·</span>
            <span className="text-[10.5px] text-text-muted">Attached {query.attachedAt} by {query.attachedBy}</span>
          </div>
          <h3 className="text-[14.5px] font-bold text-text tracking-tight leading-snug">{query.label}</h3>
        </div>
        <button
          onClick={() => onRemove(query.id)}
          aria-label="Remove attached query"
          className="p-1.5 rounded-lg text-text-muted hover:text-high-700 hover:bg-high-50 transition-colors cursor-pointer shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'syncing' && (
          <motion.div
            key="syncing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 border border-dashed border-brand-200 rounded-[10px] bg-brand-50/40 px-5 py-4 flex items-center gap-3"
          >
            <Loader2 size={14} className="text-primary animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-primary mb-0.5">Data syncing</p>
              <p className="text-[11.5px] text-text-muted">Running query against your data — preview will appear in a moment.</p>
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
              <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-text-muted mb-1.5">Summary</div>
              <p className="text-[12.5px] leading-relaxed text-text">{resolved.summary}</p>
            </div>

            {/* Findings */}
            {resolved.findings.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb size={12} className="text-evidence-700" />
                  <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-text-muted">Findings</span>
                  <span className="text-[10.5px] text-text-muted">·</span>
                  <span className="text-[10.5px] text-text-muted">{resolved.findings.length}</span>
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
                  <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-text-muted">Observations</span>
                  <span className="text-[10.5px] text-text-muted">·</span>
                  <span className="text-[10.5px] text-text-muted">{resolved.observations.length}</span>
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
            className="mt-4 border border-dashed border-border-light rounded-[10px] bg-paper-50/40 px-5 py-4 flex items-center gap-3"
          >
            <PackageOpen size={14} className="text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-text mb-0.5">Preview not available</p>
              <p className="text-[11.5px] text-text-muted">
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
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl flex flex-col overflow-hidden w-[820px] h-[600px]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-4 border-b border-canvas-border">
              <h2 className="text-[16px] font-bold text-ink-900 shrink-0">Add Query</h2>
              <div className="flex-1 mx-5 relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={activeTab === 'upload' ? 'Drop files below to upload...' : 'Search...'}
                  className="w-full pl-10 pr-4 py-2 text-[13px] border border-canvas-border rounded-full bg-canvas-elevated text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors"
                />
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer shrink-0">
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
                                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
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
                      className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-all min-h-[300px] ${
                        dragging
                          ? 'border-brand-500 bg-brand-50'
                          : uploadedFile
                            ? 'border-compliant bg-green-50/30 cursor-default'
                            : 'border-ink-200 bg-surface-2/30 cursor-pointer hover:border-brand-300 hover:bg-brand-50/20'
                      }`}
                    >
                      {uploadedFile ? (
                        <div>
                          <CloudUpload size={28} className="text-green-600 mx-auto mb-3" />
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
                          <Upload size={28} className="text-ink-300 mb-3" />
                          <h3 className="text-[14px] font-semibold text-ink-800 mb-1">Drop files here</h3>
                          <p className="text-[13px] text-ink-400 mb-4">or pick from your computer</p>
                          <button
                            onClick={e => { e.stopPropagation(); document.getElementById('add-query-file-input')?.click(); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-[13px] font-semibold rounded-lg transition-colors cursor-pointer"
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
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
                                  isSelected ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                                }`}
                              >
                                <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${meta.tone}`}>
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
              <button onClick={handleClose} className="px-5 py-2.5 text-[13px] font-semibold text-ink-600 hover:text-ink-800 transition-colors cursor-pointer">
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
                    disabled={!enabled}
                    className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer ${
                      enabled ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                    }`}
                  >
                    <Check size={14} />
                    Attach
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
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(initialTemplate ?? null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
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

  const handleApplyTemplate = (template: typeof REPORT_TEMPLATES[0]) => {
    setApplyingTemplate(true);
    setTimeout(() => {
      setAppliedTemplate(template);
      setApplyingTemplate(false);
      addToast({ type: 'success', message: `Template "${template.name}" applied!` });
    }, 800);
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
            className="w-full bg-white/10 border border-white/25 rounded-lg px-3 py-2 text-white text-[13px] leading-snug placeholder:text-white/50 focus:outline-none focus:border-white/55 focus:bg-white/15 transition-colors resize-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={saveEditDesc}
              className="inline-flex items-center gap-1 h-7 px-3 bg-white text-primary text-[11.5px] font-semibold rounded-md hover:bg-white/90 transition-colors cursor-pointer"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={cancelEditDesc}
              className="h-7 px-2.5 text-white/75 text-[11.5px] font-medium hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <span className="text-white/40 text-[10.5px] ml-auto hidden sm:inline">⌘↵ Save · Esc Cancel</span>
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
          className="shrink-0 p-1 -mt-0.5 rounded-md text-white/55 hover:text-white hover:bg-white/15 opacity-0 group-hover/desc:opacity-100 focus-visible:opacity-100 transition-all duration-150 cursor-pointer"
        >
          <Edit3 size={11} />
        </button>
      </div>
    );
  };

  const DEFAULT_QUERIES = [
    {
      id: 'Q01', status: 'In Review', risk: 'Financial Risk', severity: 'High',
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
      id: 'Q02', status: 'Completed', risk: 'Compliance Risk', severity: 'Critical',
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
        id: 'RA01', status: 'Completed', risk: 'Aggregate Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.RA01,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Total Risks', value: '12', color: 'text-primary' },
          { label: 'Critical', value: '2', color: 'text-risk-700' },
          { label: 'High', value: '5', color: 'text-high-700' },
          { label: 'Mitigated', value: '5', color: 'text-compliant-700' },
        ],
        chartData: [12, 10, 11, 9, 12, 10, 8, 12, 11, 12],
      },
      {
        id: 'RA02', status: 'In Review', risk: 'Mitigation Gap', severity: 'Critical',
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
        id: 'CE01', status: 'Completed', risk: 'Control Gap', severity: 'High',
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
        id: 'WA01', status: 'Completed', risk: 'Operational Risk', severity: 'High',
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
        id: 'WA02', status: 'In Review', risk: 'Processing Risk', severity: 'High',
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
        id: 'EX01', status: 'Completed', risk: 'Strategic Risk', severity: 'High',
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
    | { id: string; kind: 'observation'; title: string; obsId: string; description: string; attachmentDataUrl?: string; attachmentHidden?: boolean };

  type ObservationItem = {
    id: string;
    kind: 'observation';
    title: string;
    obsId: string;
    description: string;
    attachmentDataUrl?: string;
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

  useEffect(() => {
    const queries = appliedTemplateId && TEMPLATE_QUERIES[appliedTemplateId]
      ? TEMPLATE_QUERIES[appliedTemplateId]
      : DEFAULT_QUERIES;
    setSections(buildInitialSections(queries));
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
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [editingObservationObsId, setEditingObservationObsId] = useState<string | null>(null);
  const [obsForm, setObsForm] = useState<{ name: string; description: string; attachmentDataUrl: string }>({ name: '', description: '', attachmentDataUrl: '' });
  // Separate stream of observations added to applied-template view (where the body is template-driven)
  const [appliedObservations, setAppliedObservations] = useState<ObservationItem[]>([]);

  // Auto-generate next sequential OBS ID across both streams + existing sections
  const nextObservationId = () => {
    const inSections = sections
      .filter((s): s is Extract<SectionItem, { kind: 'observation' }> => s.kind === 'observation')
      .map(s => s.obsId);
    const inApplied = appliedObservations.map(o => o.obsId);
    const all = [...inSections, ...inApplied];
    const maxN = all.reduce((max, id) => {
      const m = id.match(/^OBS-(\d+)$/i);
      const n = m ? parseInt(m[1], 10) : 0;
      return n > max ? n : max;
    }, 0);
    return `OBS-${String(maxN + 1).padStart(3, '0')}`;
  };

  const openAddObservation = () => {
    setEditingObservationId(null);
    setEditingObservationObsId(null);
    setObsForm({ name: '', description: '', attachmentDataUrl: '' });
    setShowAddObservation(true);
  };
  const openEditObservation = (obs: { id: string; obsId: string; title: string; description: string; attachmentDataUrl?: string }) => {
    setEditingObservationId(obs.id);
    setEditingObservationObsId(obs.obsId);
    setObsForm({
      name: obs.title,
      description: obs.description,
      attachmentDataUrl: obs.attachmentDataUrl ?? '',
    });
    setShowAddObservation(true);
  };
  const closeAddObservation = () => {
    setShowAddObservation(false);
    setEditingObservationId(null);
    setEditingObservationObsId(null);
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

  const handleObservationAttachment = (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg)$/.test(file.type)) {
      addToast({ type: 'info', message: 'Only PNG or JPG images are supported.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setObsForm(prev => ({ ...prev, attachmentDataUrl: String(e.target?.result ?? '') }));
    };
    reader.readAsDataURL(file);
  };

  const saveObservation = () => {
    const name = obsForm.name.trim();
    if (!name) return;
    const description = obsForm.description.trim();
    const attachmentDataUrl = obsForm.attachmentDataUrl || undefined;
    if (editingObservationId) {
      setSections(prev => prev.map(s =>
        s.id === editingObservationId && s.kind === 'observation'
          ? { ...s, title: name, description, attachmentDataUrl }
          : s
      ));
      setAppliedObservations(prev => prev.map(o =>
        o.id === editingObservationId
          ? { ...o, title: name, description, attachmentDataUrl }
          : o
      ));
      addToast({ type: 'success', message: `${editingObservationObsId ?? 'Observation'} updated.` });
    } else {
      const obsId = nextObservationId();
      const newItem: ObservationItem = {
        id: `sec-obs-${Date.now()}`,
        kind: 'observation',
        title: name,
        obsId,
        description,
        attachmentDataUrl,
      };
      if (appliedTemplate) {
        setAppliedObservations(prev => [...prev, newItem]);
      } else {
        setSections(prev => [...prev, newItem]);
      }
      addToast({ type: 'success', message: `${obsId} added.` });
    }
    setShowAddObservation(false);
    setEditingObservationId(null);
    setEditingObservationObsId(null);
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
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-2">
            <List size={16} className="text-primary" />
            <h3 className="text-[15px] leading-[20px] font-bold text-text">Contents</h3>
          </div>
          <button
            onClick={openAddObservation}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-primary bg-primary-xlight border border-primary/15 rounded-[8px] hover:bg-primary-xlight/70 hover:border-primary/30 transition-colors cursor-pointer"
          >
            <Plus size={13} />
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

  // Add Query modal — shown from the empty-state report layout.
  const [addQueryOpen, setAddQueryOpen] = useState(false);

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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={launching ? { opacity: 0.88, x: 16 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="h-full overflow-y-auto bg-surface-2"
    >
      <div className="mx-auto px-8 py-6 max-w-6xl">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-primary transition-colors cursor-pointer">
            <ArrowLeft size={14} /> Back to Reports
          </button>
          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <button
                onClick={() => setShowApplyTemplate(p => !p)}
                className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white" style={{ borderRadius: '8px' }}
              >
                <Layout size={13} />
                <span className="truncate max-w-[220px]">{appliedTemplate?.name ?? 'Apply Template'}</span>
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
            {onShare && (
              <button onClick={onShare} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white" style={{ borderRadius: '8px' }}>
                <Share2 size={13} /> Share
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowDownloadDropdown(p => !p)}
                className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white" style={{ borderRadius: '8px' }}
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
                      onClick={() => { addToast({ type: 'success', message: `Downloading ${report.name}.${ext}...` }); setShowDownloadDropdown(false); }}
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

        {report.isEmpty ? (
          <>
            {/* Empty-state Cover — same chrome, simpler body */}
            <div className="relative rounded-2xl overflow-hidden mb-5 bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]" style={{ boxShadow: '0 4px 24px rgba(106,18,205,0.35)' }}>
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
                  <button
                    onClick={() => setAddQueryOpen(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-semibold text-primary bg-white rounded-[10px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                  >
                    <Plus size={13} />
                    Add Query
                  </button>
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
                            <h3 className="text-[14.5px] font-bold text-text tracking-tight">{section.name}</h3>
                            <span className="text-[10.5px] text-text-muted">·</span>
                            <span className="text-[10.5px] text-text-muted">{attached.length}</span>
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
                        className="bg-white border border-border-light rounded-2xl px-6 py-5"
                      >
                        <div className="flex items-center gap-2.5 mb-3">
                          <Icon size={16} className="text-primary" />
                          <h3 className="text-[14.5px] font-bold text-text tracking-tight">{section.name}</h3>
                        </div>
                        <div className="border border-dashed border-border-light rounded-[10px] bg-paper-50/40 px-6 py-7 text-center">
                          <p className="text-[12.5px] text-text-muted/80">
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
                        <h3 className="text-[14.5px] font-bold text-text tracking-tight">Attached Queries</h3>
                        <span className="text-[10.5px] text-text-muted">·</span>
                        <span className="text-[10.5px] text-text-muted">{attached.length}</span>
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
                    <div className="bg-white border border-border-light rounded-2xl px-6 py-12 text-center">
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
            <div className="relative rounded-2xl overflow-hidden mb-5 bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]" style={{ boxShadow: '0 4px 24px rgba(106,18,205,0.35)' }}>
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
                    <span className="inline-flex items-center h-6 px-2.5 ml-1 text-[11px] font-medium text-white bg-white/15 border border-white/25 rounded-full whitespace-nowrap">
                      {appliedTemplate.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActivityLogOpen(true)}
                      title="View this report's activity log"
                      aria-label="View report activity log"
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                    >
                      <History size={15} />
                    </button>
                    <button
                      onClick={() => addToast({ type: 'success', message: 'Generating report summary…' })}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-semibold text-primary bg-white rounded-[10px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                    >
                      <Sparkles size={13} />
                      Generate Summary
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Contents — read-only list of template-defined sections */}
            {appliedTemplate.sections && appliedTemplate.sections.length > 0 && (
              <div className="border border-border-light rounded-2xl bg-white p-6 mb-5">
                <div className="flex items-center justify-between gap-3 mb-8">
                  <div className="flex items-center gap-2">
                    <List size={16} className="text-primary" />
                    <h3 className="text-[15px] leading-[20px] font-bold text-text">Contents</h3>
                  </div>
                  <button
                    onClick={openAddObservation}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-primary bg-primary-xlight border border-primary/15 rounded-[8px] hover:bg-primary-xlight/70 hover:border-primary/30 transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    Add Observation
                  </button>
                </div>
                <Reorder.Group
                  axis="y"
                  values={appliedObservations}
                  onReorder={setAppliedObservations}
                  as="ol"
                  className="list-none p-0 m-0 space-y-0.5"
                >
                  {appliedTemplate.sections.map((s, i) => (
                    <li key={`${s.name}-${i}`} className="flex items-center gap-2 py-2.5 pl-1 pr-1 rounded-lg hover:bg-primary-xlight/30 transition-colors">
                      <span className="shrink-0 w-6 text-[10.5px] text-text-muted/70 font-mono tabular-nums text-right">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex-1 min-w-0 text-[12.5px] text-text-secondary truncate">{s.name}</span>
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
            <div className="grid grid-cols-4 gap-3 mb-5">
              {activeStats.map(stat => (
                <div key={stat.label} className="glass-card rounded-xl p-4 flex items-center gap-3 hover:shadow-md hover:shadow-primary/5 transition-all">
                  <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon size={16} /></div>
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
              <Reorder.Group axis="y" values={sections} onReorder={setSections} as="div" className="list-none p-0 m-0">
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
                        <div className="relative rounded-t-2xl overflow-hidden bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]" style={{ boxShadow: '0 4px 24px rgba(106,18,205,0.35)' }}>
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
                                  onClick={() => setActivityLogOpen(true)}
                                  title="View this report's activity log"
                                  aria-label="View report activity log"
                                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                                >
                                  <History size={15} />
                                </button>
                                <button
                                  onClick={() => addToast({ type: 'success', message: 'Generating report summary…' })}
                                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-semibold text-primary bg-white rounded-[10px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                                >
                                  <Sparkles size={13} />
                                  Generate Summary
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
                    return (
                      <Reorder.Item {...sectionProps}>
                        <div className="border-x border-b border-border-light bg-white p-6">
                          <div className="flex items-center gap-2 mb-8">
                            <FileText size={16} className="text-primary" />
                            <h3 className="text-[15px] leading-[20px] font-bold text-text">{section.title}</h3>
                          </div>
                          <div className="grid grid-cols-4 gap-3 pb-5 border-b border-border-light mb-5">
                            {activeStats.map(stat => (
                              <div key={stat.label} className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon size={16} /></div>
                                <div>
                                  <div className="text-xl font-bold text-text leading-none mb-1">{stat.value}</div>
                                  <div className="text-[11px] text-text-muted tracking-wide">{stat.label}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[13px] text-text-secondary leading-relaxed">{section.content}</p>
                        </div>
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'stats') {
                    return (
                      <Reorder.Item {...sectionProps}>
                        <div className="grid grid-cols-4 gap-3">
                          {activeStats.map(stat => (
                            <div key={stat.label} className="glass-card rounded-xl p-4 flex items-center gap-3 hover:shadow-md hover:shadow-primary/5 transition-all">
                              <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon size={16} /></div>
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
                        onManageExceptions={onManageExceptions}
                        onOpenQuery={onOpenQuery}
                        onDelete={() => removeSection(section.id)}
                        comments={comments}
                        onAddComment={addComment}
                        casesPhase={casesPhases[section.query.id] ?? 'idle'}
                        onCasesPhaseChange={(p) => setCasesPhase(section.query.id, p)}
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

      {/* Add Observation modal */}
      {showAddObservation && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
            onClick={closeAddObservation}
          >
            <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="add-observation-title"
              className="relative bg-white rounded-[16px] border border-border-light shadow-2xl w-[520px] max-w-[calc(100vw-32px)] p-6"
            >
              <button
                onClick={closeAddObservation}
                aria-label="Close"
                className="absolute top-4 right-4 w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-paper-50 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
              <h3 id="add-observation-title" className="text-[16px] font-bold text-text tracking-tight mb-5">{editingObservationId ? 'Edit observation' : 'Add observation'}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Observation ID</label>
                  <input
                    type="text"
                    value={editingObservationObsId ?? nextObservationId()}
                    readOnly
                    className="w-full bg-paper-50 border border-border-light rounded-[8px] px-3 py-2 text-[13px] font-mono text-text tabular-nums cursor-default"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Name <span className="text-risk normal-case font-normal">*</span></label>
                  <input
                    type="text"
                    value={obsForm.name}
                    onChange={(e) => setObsForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Vendor master review gap"
                    autoFocus
                    className="w-full bg-white border border-border-light rounded-[8px] px-3 py-2 text-[13px] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Description</label>
                  <div className="bg-white border border-border-light rounded-[8px] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition-all overflow-hidden">
                    <textarea
                      value={obsForm.description}
                      onChange={(e) => setObsForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Add observation details, evidence, and recommended actions."
                      rows={4}
                      className="w-full bg-transparent border-0 px-3 pt-2 pb-1 text-[13px] text-text focus:outline-none focus:ring-0 resize-none"
                    />
                    {obsForm.attachmentDataUrl && (
                      <div className="px-3 pb-2">
                        <div className="relative inline-block w-20 h-20 rounded-lg border border-border-light overflow-hidden bg-paper-50">
                          <img src={obsForm.attachmentDataUrl} alt="Attachment preview" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setObsForm(prev => ({ ...prev, attachmentDataUrl: '' }))}
                            aria-label="Remove attachment"
                            className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 rounded-md bg-ink-900/75 text-white hover:bg-ink-900 transition-colors cursor-pointer"
                          >
                            <X size={9} />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center px-2 py-1.5 border-t border-border-light/60 bg-paper-50/40">
                      <label
                        title={obsForm.attachmentDataUrl ? 'Change attachment' : 'Attach image (PNG / JPG)'}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer"
                      >
                        <Paperclip size={14} />
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) => handleObservationAttachment(e.target.files?.[0] ?? null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6">
                <button
                  onClick={closeAddObservation}
                  className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveObservation}
                  disabled={!obsForm.name.trim()}
                  className="inline-flex items-center justify-center h-9 px-5 text-[13px] font-semibold text-white bg-primary rounded-[8px] hover:bg-primary-hover disabled:bg-primary/40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {editingObservationId ? 'Update observation' : 'Save observation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}
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
  const [activeTab, setActiveTab] = useState<'templates' | 'my-reports' | 'shared-reports'>(() => {
    if (typeof window === 'undefined') return 'my-reports';
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'shared-reports' || t === 'templates' || t === 'my-reports') return t;
    return 'my-reports';
  });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [gridSearch, setGridSearch] = useState('');
  const [sharedGridSearch, setSharedGridSearch] = useState('');
  const [viewingReport, setViewingReport] = useState<GeneratedReport | null>(null);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [editingAsCopy, setEditingAsCopy] = useState(false);
  const [customTemplatesLocal, setCustomTemplatesLocal] = useState<typeof REPORT_TEMPLATES[number][]>(CUSTOM_TEMPLATES as typeof REPORT_TEMPLATES[number][]);
  const customTemplates = customTemplatesProp ?? customTemplatesLocal;
  const addCustomTemplate = (t: typeof REPORT_TEMPLATES[number]) => {
    if (onAddCustomTemplate) onAddCustomTemplate(t);
    else setCustomTemplatesLocal(prev => [t, ...prev]);
  };
  const GENERATED_REPORTS_KEY = 'irame.reports.generatedReports.v6';
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(() => {
    try {
      const raw = localStorage.getItem(GENERATED_REPORTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as GeneratedReport[];
      }
    } catch { /* ignore */ }
    return [...GENERATED_REPORTS];
  });
  useEffect(() => {
    try { localStorage.setItem(GENERATED_REPORTS_KEY, JSON.stringify(generatedReports)); } catch { /* ignore */ }
  }, [generatedReports]);

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
  useEffect(() => {
    if (!focusReportId) return;
    const report = generatedReports.find(r => r.id === focusReportId);
    if (report) {
      setActiveTab('my-reports');
      setViewingReport(report);
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
  const { addToast } = useToast();

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
    const byTag = tagFilter === 'All'
      ? generatedReports
      : generatedReports.filter(r => r.tag === tagFilter);
    return q ? byTag.filter(r => r.name.toLowerCase().includes(q)) : byTag;
  })();

  const TAG_FILTER_OPTIONS = ['All', 'Internal Audit', 'Bulk Audit'];

  const TagFilterDropdown = () => (
    <div className="relative">
      <button
        onClick={() => setShowTagDropdown(p => !p)}
        className="h-7 flex items-center gap-1.5 px-2.5 text-[11px] font-medium text-text-secondary bg-paper-50 border border-border-light hover:border-primary/30 transition-colors cursor-pointer"
        style={{ borderRadius: '8px' }}
      >
        {tagFilter === 'All' ? 'All Tags' : tagFilter}
        <ChevronDown size={10} className={`text-text-muted transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
      </button>
      {showTagDropdown && (
        <div className="absolute left-0 top-full mt-1 w-40 bg-white shadow-xl border border-border-light z-50 overflow-hidden py-1" style={{ borderRadius: '8px' }}>
          {TAG_FILTER_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => { setTagFilter(t); setShowTagDropdown(false); }}
              className={`w-full text-left px-3 py-2 text-[12px] hover:bg-primary-xlight transition-colors cursor-pointer flex items-center gap-2 ${tagFilter === t ? 'text-primary font-semibold' : 'text-text-secondary'}`}
            >
              {tagFilter === t && <span className="text-primary">✓</span>}
              {tagFilter !== t && <span className="w-3" />}
              {t === 'All' ? 'All Tags' : t}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const ActionTooltip = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <span className="relative group/tt inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 px-2 py-1 bg-ink-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/tt:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </span>
  );


  if (viewingReport) {
    // All Bulk Audit reports now render as Editorial (chosen treatment) unless
    // an explicit aestheticVariant overrides it. Internal Audit reports keep
    // the default ReportView.
    if (viewingReport.aestheticVariant || viewingReport.tag === 'Bulk Audit') {
      return (
        <BulkAuditVariantView
          report={{ ...viewingReport, aestheticVariant: viewingReport.aestheticVariant ?? 'editorial' }}
          onBack={() => setViewingReport(null)}
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
      <div className="px-[124px] py-8 relative flex flex-col min-h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="font-mono text-[11px] text-ink-500 mb-2 tracking-tight">
              Reports · {activeTab === 'my-reports' ? 'My Reports' : activeTab === 'shared-reports' ? 'Shared Reports' : 'Templates'}
            </div>
            <h1 className="font-display text-[34px] font-[420] tracking-tight text-ink-900 leading-[1.15]">Reports</h1>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-border-light hover:border-primary/30 text-text-secondary hover:text-primary bg-white text-[13px] font-medium transition-colors cursor-pointer" style={{ borderRadius: '8px' }}
            >
              <Upload size={14} /> Upload Template
            </button>
            <button onClick={openNewReportModal} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold transition-colors cursor-pointer" style={{ borderRadius: '8px' }}>
              <FileText size={14} /> Create Report
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
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

        {/* My Reports */}
        {activeTab === 'my-reports' && viewMode === 'list' && (
          <SmartTable
            className="flex-1"
            data={filteredReports as unknown as Record<string, unknown>[]}
            keyField="id"
            searchPlaceholder="Search reports..."
            searchKeys={['name', 'generatedBy']}
            paginated={false}
            emptyMessage={
              generatedReports.length === 0
                ? 'No reports yet. Create your first report to see it here.'
                : tagFilter !== 'All'
                  ? `No reports match the "${tagFilter}" filter.`
                  : 'No reports match your search.'
            }
            headerExtra={
              <div className="flex items-center gap-2">
                <TagFilterDropdown />
                <div className="flex items-center gap-0.5 p-0.5 bg-paper-50 rounded-[8px]">
                  <button onClick={() => setViewMode('list')} className="p-1.5 rounded-md bg-white shadow-sm text-primary cursor-pointer" title="List view"><List size={15} /></button>
                  <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-md text-text-muted hover:text-text-secondary cursor-pointer" title="Grid view"><LayoutGrid size={15} /></button>
                </div>
              </div>
            }
            columns={[
              { key: 'name', label: 'Report', render: (item) => (
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                  const report = generatedReports.find(r => r.id === item.id);
                  if (report) setViewingReport(report);
                }}>
                  <div className="flex items-center justify-center w-8 h-8 shrink-0" style={{ background: 'rgba(106,18,205,0.04)', borderRadius: '8px' }}>
                    <FileText size={16} style={{ color: '#6a12cd' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const n = String(item.name);
                        const truncated = n.length > 100 ? n.slice(0, 100) + '…' : n;
                        return (
                          <span className="relative group/nt inline-flex">
                            <span className="text-text font-medium hover:text-primary transition-colors">{truncated}</span>
                            {n.length > 100 && (
                              <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 px-3 py-2 bg-ink-900 text-white text-[11px] font-normal leading-snug rounded-md max-w-[480px] whitespace-normal break-words opacity-0 group-hover/nt:opacity-100 transition-opacity z-50 shadow-lg">
                                {n}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                      {Boolean(item.tag) && (() => { const t = String(item.tag); return <span className="inline-flex items-center px-2 h-5 text-[10px] font-semibold whitespace-nowrap shrink-0" style={{ borderRadius: '8px', background: t === 'Internal Audit' ? '#FFE8F6' : '#FFFAEB', color: t === 'Internal Audit' ? '#BF2E84' : '#A74108' }}>{t}</span>; })()}
                      {reportAppliedTemplates[String(item.id)] && (
                        <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Layout size={8} /> {reportAppliedTemplates[String(item.id)].name}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-muted">{String(item.queries)} queries · {String(item.pages)} pages</div>
                  </div>
                </div>
              )},
              { key: 'generatedAt', label: 'Date', width: '120px', render: (item) => (
                <span className="text-text-muted text-[12px]">{String(item.generatedAt)}</span>
              )},
              { key: 'status', label: 'Status', width: '100px', render: (item) => <StatusBadge status={String(item.status)} /> },
              { key: 'actions', label: '', width: '110px', sortable: false, align: 'right', render: (item) => (
                <div className="flex items-center justify-end gap-1">
                  <ActionTooltip label="Download"><button onClick={() => addToast({ type: 'success', message: `Downloading ${item.name}...` })} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-xlight rounded-md transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>
                  <ActionTooltip label="Share"><button onClick={() => onShare ? onShare(String(item.id)) : addToast({ type: 'info', message: `Sharing ${item.name}...` })} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-xlight rounded-md transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>
                  <ActionTooltip label="Delete"><button onClick={() => setReportToDelete({ id: String(item.id), name: String(item.name) })} className="p-1.5 text-text-muted hover:text-risk-700 hover:bg-risk-50 rounded-md transition-colors cursor-pointer" aria-label="Delete"><Trash2 size={14} /></button></ActionTooltip>
                </div>
              )},
            ]}
          />
        )}

        {activeTab === 'my-reports' && viewMode === 'grid' && (
          <div className="w-full flex-1 bg-white rounded-xl border border-border-light overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light bg-surface-2/50">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={gridSearch}
                  onChange={e => setGridSearch(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full pl-8 pr-8 py-1.5 border border-border bg-white text-[12px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" style={{ borderRadius: '8px' }}
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
                  <button onClick={() => setViewMode('list')} className="p-1.5 rounded-md text-text-muted hover:text-text-secondary cursor-pointer" title="List view"><List size={15} /></button>
                  <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-md bg-white shadow-sm text-primary cursor-pointer" title="Grid view"><LayoutGrid size={15} /></button>
                </div>
              </div>
            </div>
            {filteredReports.length === 0 ? (
              <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center mb-3">
                  <FileText size={18} className="text-text-muted/50" />
                </div>
                <div className="text-[13px] font-medium text-text-secondary">
                  {generatedReports.length === 0
                    ? 'No reports yet. Create your first report to see it here.'
                    : tagFilter !== 'All'
                      ? `No reports match the "${tagFilter}" filter.`
                      : 'No reports match your search.'}
                </div>
                {generatedReports.length === 0 && (
                  <button
                    onClick={openNewReportModal}
                    className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-semibold text-white bg-primary hover:bg-primary/90 rounded-[8px] cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                    Create Report
                  </button>
                )}
              </div>
            ) : (
            <div className="w-full p-4 grid grid-cols-3 gap-4 items-start">
              {filteredReports.map((r, i) => {
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="glass-card rounded-xl p-4 hover:border-primary/20 transition-all group cursor-pointer flex flex-col"
                    onClick={() => setViewingReport(r)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center justify-center shrink-0" style={{ width: '42px', height: '42px', background: 'rgba(106,18,205,0.04)', borderRadius: '8px' }}><FileText size={20} style={{ color: '#6a12cd' }} /></div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); addToast({ type: 'success', message: `Downloading ${r.name}...` }); }} className="hover:text-primary transition-colors cursor-pointer" style={{ color: 'rgba(38,6,74,0.4)' }} title="Download"><Download size={15} /></button>
                        <button onClick={(e) => { e.stopPropagation(); onShare ? onShare(r.id) : addToast({ type: 'info', message: `Sharing ${r.name}...` }); }} className="hover:text-primary transition-colors cursor-pointer" style={{ color: 'rgba(38,6,74,0.4)' }} title="Share"><Share2 size={15} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setReportToDelete({ id: r.id, name: r.name }); }} className="hover:text-risk transition-colors cursor-pointer" style={{ color: 'rgba(38,6,74,0.4)' }} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className="font-medium text-text group-hover:text-primary transition-colors mb-1 line-clamp-2 min-h-[40px]" style={{ fontSize: '14px', lineHeight: '20px' }} title={r.name}>{r.name}</div>
                    <div className="text-[11px] text-text-muted mb-3">{r.queries} queries · {r.pages} pages · {r.generatedAt}</div>
                    <div className="mt-auto">
                      {r.tag && (
                        <span className="inline-flex items-center px-2 h-5 text-[10px] font-semibold whitespace-nowrap" style={{ borderRadius: '8px', background: r.tag === 'Internal Audit' ? '#FFE8F6' : '#FFFAEB', color: r.tag === 'Internal Audit' ? '#BF2E84' : '#A74108' }}>{r.tag}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* Shared Reports */}
        {activeTab === 'shared-reports' && viewMode === 'list' && (
          <SmartTable
            className="flex-1"
            data={SHARED_REPORTS as unknown as Record<string, unknown>[]}
            keyField="id"
            searchPlaceholder="Search shared reports..."
            searchKeys={['name', 'sharedBy', 'sharedWith']}
            paginated={false}
            emptyMessage={
              SHARED_REPORTS.length === 0
                ? 'No reports have been shared with you yet.'
                : 'No shared reports match your search.'
            }
            headerExtra={
              <div className="flex items-center gap-0.5 p-0.5 bg-paper-50 rounded-[8px]">
                <button onClick={() => setViewMode('list')} className="p-1.5 rounded-md bg-white shadow-sm text-primary cursor-pointer" title="List view"><List size={15} /></button>
                <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-md text-text-muted hover:text-text-secondary cursor-pointer" title="Grid view"><LayoutGrid size={15} /></button>
              </div>
            }
            columns={[
              { key: 'name', label: 'Report', render: (item) => (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 shrink-0" style={{ background: 'rgba(106,18,205,0.04)', borderRadius: '8px' }}>
                    <FileText size={16} style={{ color: '#6a12cd' }} />
                  </div>
                  <div>
                    <div className="text-text font-medium">{String(item.name)}</div>
                    <div className="text-[10px] text-text-muted">{String(item.queries)} queries · {String(item.pages)} pages · shared with {String(item.sharedWith)}</div>
                  </div>
                </div>
              )},
              { key: 'sharedBy', label: 'Shared By', render: (item) => (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[8px] font-bold flex items-center justify-center">
                    {String(item.sharedBy).split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <span className="text-text-secondary text-[12px]">{String(item.sharedBy)}</span>
                </div>
              )},
              { key: 'sharedAt', label: 'Date', width: '120px', render: (item) => (
                <span className="text-text-muted text-[12px]">{String(item.sharedAt)}</span>
              )},
              { key: 'actions', label: '', width: '110px', sortable: false, align: 'right', render: (item) => (
                <div className="flex items-center justify-end gap-1">
                  <ActionTooltip label="Download"><button onClick={() => addToast({ type: 'success', message: `Downloading ${item.name}...` })} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-xlight rounded-md transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>
                  <ActionTooltip label="Share"><button onClick={() => addToast({ type: 'info', message: `Sharing ${item.name}...` })} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-xlight rounded-md transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>
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
          <div className="w-full flex-1 bg-white rounded-xl border border-border-light overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light bg-surface-2/50">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={sharedGridSearch}
                  onChange={e => setSharedGridSearch(e.target.value)}
                  placeholder="Search shared reports..."
                  className="w-full pl-8 pr-8 py-1.5 border border-border bg-white text-[12px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" style={{ borderRadius: '8px' }}
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
                <button onClick={() => setViewMode('list')} className="p-1.5 rounded-md text-text-muted hover:text-text-secondary cursor-pointer" title="List view"><List size={15} /></button>
                <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-md bg-white shadow-sm text-primary cursor-pointer" title="Grid view"><LayoutGrid size={15} /></button>
              </div>
            </div>
            {filteredSharedReports.length === 0 ? (
              <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center mb-3">
                  <Share2 size={18} className="text-text-muted/50" />
                </div>
                <div className="text-[13px] font-medium text-text-secondary">
                  {SHARED_REPORTS.length === 0
                    ? 'No reports have been shared with you yet.'
                    : 'No shared reports match your search.'}
                </div>
              </div>
            ) : (
            <div className="w-full p-4 grid grid-cols-3 gap-4 items-start">
              {filteredSharedReports.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-xl p-4 hover:border-primary/20 transition-all group cursor-pointer flex flex-col"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center justify-center shrink-0" style={{ width: '42px', height: '42px', background: 'rgba(106,18,205,0.04)', borderRadius: '8px' }}><FileText size={20} style={{ color: '#6a12cd' }} /></div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); addToast({ type: 'success', message: `Downloading ${r.name}...` }); }} className="hover:text-primary transition-colors cursor-pointer" style={{ color: 'rgba(38,6,74,0.4)' }} title="Download"><Download size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); addToast({ type: 'info', message: `Sharing ${r.name}...` }); }} className="hover:text-primary transition-colors cursor-pointer" style={{ color: 'rgba(38,6,74,0.4)' }} title="Share"><Share2 size={15} /></button>
                    </div>
                  </div>
                  <div className="font-medium text-[13px] text-text group-hover:text-primary transition-colors leading-snug mb-1 line-clamp-2 min-h-[36px]" title={r.name}>{r.name}</div>
                  <div className="text-[11px] text-text-muted mb-3">{r.queries} queries · {r.pages} pages · {r.sharedAt}</div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-2 h-5 text-[10px] font-semibold whitespace-nowrap" style={{ borderRadius: '8px', background: 'rgba(106,18,205,0.08)', color: '#6a12cd' }}>{r.sharedWith}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(106,18,205,0.12)', color: '#6a12cd' }}>
                        {r.sharedBy.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-[11px] text-text-secondary truncate">{r.sharedBy}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            )}
          </div>
          );
        })()}

        {activeTab === 'templates' && (() => {
          const renderCard = (rt: typeof REPORT_TEMPLATES[0], i: number, fixedWidth?: boolean) => {
            const Icon = ICON_MAP[rt.icon] || FileText;
            const color = CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50';
            return (
              <motion.div
                key={rt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-card rounded-2xl p-5 hover:shadow-primary/5 hover:border-primary/20 active:scale-[0.98] transition-all duration-300 group cursor-pointer flex flex-col ${fixedWidth ? 'w-[200px] shrink-0' : ''}`}
                onClick={() => setPreviewingTemplate(rt)}
              >
                <div className="mb-3 flex-1">
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className={`p-2 shrink-0 ${color} transition-colors`} style={{ borderRadius: '8px' }}><Icon size={16} /></div>
                    <h3 className="font-semibold text-text group-hover:text-primary transition-colors flex-1 min-w-0" style={{ fontSize: '13px', lineHeight: '18px' }}>{rt.name}</h3>
                  </div>
                  <p className="text-[12px] text-text-secondary leading-relaxed">{rt.desc}</p>
                </div>
                <div className="flex items-center justify-start pt-3 border-t border-border-light">
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setEditingAsCopy(true); setEditingTemplate(rt); }} className="text-text-muted hover:text-primary font-medium flex items-center gap-0.5 cursor-pointer" style={{ fontSize: '12px', lineHeight: '20px' }}>
                      <Settings size={11} /> Customize
                    </button>
                    <span className="text-border-light mx-1">|</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
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
                          addToast({ type: 'success', message: 'Report generated!' });
                        }, 1200);
                      }}
                      className="text-primary font-semibold flex items-center gap-0.5 cursor-pointer"
                      style={{ fontSize: '12px', lineHeight: '20px' }}
                    >
                      Generate <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          };

          return (
            <div className="space-y-8">
              <section>
                <h2 className="font-display text-[20px] font-[420] tracking-tight text-ink-900 leading-[1.2] mb-3">Standard Templates</h2>
                <div className="grid grid-cols-3 gap-4">
                  {REPORT_TEMPLATES.map((rt, i) => renderCard(rt, i, false))}
                </div>
              </section>

              <section>
                <h2 className="font-display text-[20px] font-[420] tracking-tight text-ink-900 leading-[1.2] mb-3">Custom Templates</h2>
                {customTemplates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-light p-8 text-center text-[13px] text-text-muted">
                    No custom templates yet. Create one from an existing report or upload a file.
                  </div>
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
              className="relative bg-white shadow-2xl w-[560px] overflow-hidden flex flex-col" style={{ borderRadius: '16px' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl"><FileText size={16} /></div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-text">New Report</h3>
                    <p className="text-[11px] text-text-muted">Set up your report</p>
                  </div>
                </div>
                <button onClick={closeNewReportModal} className="p-1.5 hover:bg-paper-50 rounded-lg transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-[12px] font-semibold text-text mb-1.5">Report <span className="text-risk">*</span></label>
                  <input
                    value={newReportName}
                    onChange={e => setNewReportName(e.target.value)}
                    placeholder="Report 01 — April 23, 2026"
                    className="w-full px-3 py-2.5 border border-border-light text-[13px] text-text placeholder:text-text-muted/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" style={{ borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text mb-1.5">Description</label>
                  <textarea
                    value={newReportDesc}
                    onChange={e => setNewReportDesc(e.target.value)}
                    placeholder="Report Description goes here"
                    rows={3}
                    className="w-full px-3 py-2.5 border border-border-light text-[13px] text-text placeholder:text-text-muted/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none" style={{ borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[12px] font-semibold text-text">Template</label>
                    {newReportTemplatePrefilled && newReportTemplate && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                        <Sparkles size={10} /> Pre-filled from selection
                      </span>
                    )}
                  </div>
                  <select
                    value={newReportTemplate}
                    onChange={e => { setNewReportTemplate(e.target.value); setNewReportTemplatePrefilled(false); }}
                    className={`w-full px-3 py-2.5 border text-[13px] text-text appearance-none outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer bg-white ${
                      newReportTemplatePrefilled && newReportTemplate ? 'border-primary/50' : 'border-border-light'
                    }`}
                    style={{ borderRadius: '8px', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a12cd' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
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
                      addToast({ type: 'success', message: 'Report generated!' });
                    }, 1200);
                  }}
                  disabled={!newReportName.trim() || !newReportTemplate}
                  className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer" style={{ borderRadius: '8px' }}
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
              className="relative bg-white overflow-hidden shadow-2xl flex flex-col w-[560px] max-h-[80vh]" style={{ borderRadius: '16px' }}
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
        title="Delete File?"
        description={reportToDelete && (
          <>Are you sure you want to delete <span className="font-semibold text-text">{reportToDelete.name}</span>? This action cannot be undone.</>
        )}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!reportToDelete) return;
          const name = reportToDelete.name;
          setGeneratedReports(prev => prev.filter(r => r.id !== reportToDelete.id));
          setReportToDelete(null);
          addToast({ type: 'success', message: `${name} deleted.` });
        }}
      />
    </div>
  );
}
