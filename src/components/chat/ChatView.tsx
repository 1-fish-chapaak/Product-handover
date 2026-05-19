import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Send, Paperclip, Sparkles, History, X, FileText,
  Workflow, BarChart3, ChevronDown, ChevronLeft, ChevronRight,
  MessageSquare, ArrowRight, Plus, Lightbulb,
  Save, CheckCircle, Maximize2, Lock, Calendar,
  ExternalLink, Download, MoreHorizontal, Pencil, CornerDownLeft, ArrowUpRight,
  Square, ArrowDown, Copy, RotateCcw, ThumbsUp, ThumbsDown, Check,
  Bookmark, BookmarkCheck,
  Search, GitCompare, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { CHAT_HISTORY, CHAT_CONVERSATIONS, CLARIFICATION_STEPS, BUSINESS_PROCESSES, SOPS } from '../../data/mockData';
import {
  readBookmarkedMessages, writeBookmarkedMessages, type BookmarkedMessage,
} from '../../utils/bookmarkedMessages';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import type { WorkflowTypeId } from '../../data/mockData';
import type { ArtifactTab } from '../../hooks/useAppState';
import { TextShimmer } from '../shared/TextShimmer';
import { AuditifyHelloEffect } from '../shared/HelloEffect';
import FloatingLines from '../shared/FloatingLines';
// Persona removed — Rive WebGL crashes in some browsers
import ClarificationCard from './ClarificationCard';
import DataPickerModal, { type AttachmentSelection } from './DataPickerModal';
import { AddToDashboardModal } from './AddToDashboardModal';
import { AddToReportModal } from './AddToReportModal';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import { useDialogA11y } from './useModalA11y';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: string[];
  hasArtifact?: boolean;
  artifactType?: 'workflow' | 'query' | 'report';
  followUps?: string[];
  timestamp: Date;
  // Rich inline components
  richType?: 'summary-kpi' | 'audit-result' | 'audit-loading' | 'clarification' | 'save-workflow-prompt' | 'workflow-checkpoint' | 'qna-plan' | 'error';
  richData?: Record<string, unknown>;
  // Tracks which dashboards/reports this result was added to
  addedTo?: {
    dashboards?: { id: string; name: string }[];
    reports?: { id: string; name: string }[];
  };
  // Marks an assistant message whose generation was halted before completion.
  // Renders a "Stopped" badge under the message body.
  stopped?: boolean;
}

// Clarification interaction shape (one per IRA message of richType 'clarification')
interface ClarificationData {
  intro: string;
  questions: { question: string; options: string[] }[];
  answers: Record<number, string>;
  status: 'open' | 'submitted'; // 'submitted' freezes the UI into a recap
  // 'audit-query' (default) feeds the audit run; 'save-workflow' captures
  // tolerance/threshold config and then opens the Save-as-Workflow modal.
  purpose?: 'audit-query' | 'save-workflow';
}

// ─── Audit-query result fixture ──────────────────────────────────────────────
// KPIs render in the dashboard's widget pattern: 4 across on lg, 2 on mobile,
// with a hard cap of 8 (two full rows on lg). Values stay neutral ink-900 —
// magnitude + label carries the story, the chart + table fill in the rest.
const AUDIT_RESULT = {
  kpis: [
    { label: 'Records scanned',  value: '1.2M',   color: 'text-ink-900' },
    { label: 'Duplicates found', value: '8',      color: 'text-ink-900' },
    { label: 'Total amount',     value: '₹6.16L', color: 'text-ink-900' },
    { label: 'Highest match',    value: '96%',    color: 'text-ink-900' },
    { label: 'Vendors flagged',  value: '4',      color: 'text-ink-900' },
    { label: 'Days covered',     value: '90',     color: 'text-ink-900' },
    { label: 'Avg confidence',   value: '91%',    color: 'text-ink-900' },
    { label: 'Cross-checks',     value: '24',     color: 'text-ink-900' },
  ],
  charts: [
    {
      id: 'confidence',
      label: 'By confidence',
      // Single-hue (brand) ramp — opacity falls with the bucket. The eye
      // reads rank without learning a 4-color legend.
      data: [
        { bucket: '90–100%', count: 5, tone: 'bg-ink-800' },
        { bucket: '80–89%', count: 2, tone: 'bg-ink-800/70' },
        { bucket: '70–79%', count: 1, tone: 'bg-ink-800/50' },
        { bucket: '60–69%', count: 0, tone: 'bg-ink-800/30' },
      ],
    },
    {
      id: 'vendor',
      label: 'By vendor',
      data: [
        { bucket: 'Acme Corp', count: 4, tone: 'bg-ink-800' },
        { bucket: 'Global Supplies', count: 2, tone: 'bg-ink-800/70' },
        { bucket: 'TechParts Ltd', count: 1, tone: 'bg-ink-800/50' },
        { bucket: 'FastShip Logistics', count: 1, tone: 'bg-ink-800/50' },
      ],
    },
  ],
  table: {
    columns: ['Invoice A', 'Invoice B', 'Vendor', 'Amount', 'Match %'],
    rows: [
      ['INV-2024-8821', 'INV-2024-8847', 'Acme Corp', '₹1,42,500', '96%'],
      ['INV-2024-8910', 'INV-2024-9001', 'Acme Corp', '₹89,200', '94%'],
      ['INV-2024-9112', 'INV-2024-9183', 'Global Supplies', '₹2,18,400', '92%'],
      ['INV-2024-9245', 'INV-2024-9301', 'Acme Corp', '₹54,000', '91%'],
      ['INV-2024-9377', 'INV-2024-9420', 'Global Supplies', '₹76,800', '90%'],
    ],
    totalRows: 8,
  },
};

const AUDIT_FOLLOWUPS = [
  'Show match-method breakdown for the top 3 flags',
  'Drill into Acme Corp’s flagged invoices',
  'Build a recurring duplicate-invoice monitoring workflow',
  'Compare these flags against last quarter’s run',
  'Generate a report draft for the audit committee',
  'Cross-check against vendor master changes in the same window',
];

interface ChatViewProps {
  showChatHistory: boolean;
  toggleChatHistory: () => void;
  setShowArtifacts: (v: boolean) => void;
  showArtifacts?: boolean;
  setActiveArtifactTab: (t: ArtifactTab) => void;
  setArtifactMode: (m: 'query' | 'workflow') => void;
  setWorkflowCanvasStage?: (stage: number) => void;
  setWorkflowType?: (type: WorkflowTypeId | null) => void;
  setQueryAssumptions?: (assumptions: string[]) => void;
  initialQuery?: string;
  onInitialQueryProcessed?: () => void;
  /** When set, ChatView loads CHAT_CONVERSATIONS[selectedChatId] on mount/change. */
  selectedChatId?: string | null;
  /** Called once the selected chat has been loaded so the parent can clear the id. */
  onChatLoaded?: () => void;
  /** Optional view router so the slide-out can deep-link to /recents. */
  setView?: (v: import('../../hooks/useAppState').View) => void;
  /** Pending dashboard waiting for chat data */
  pendingDashboard?: { name: string; description: string } | null;
  /** Create dashboard with fields from chat */
  onAddToDashboard?: (fields: string[]) => void;
  /** Dismiss the pending dashboard banner */
  onDismissPendingDashboard?: () => void;
  /**
   * Hand the typed prompt to the AI Concierge workflow builder. Invoked from
   * the empty-state Submit when the "Build a workflow" toggle is on — the
   * builder opens directly on the clarification screen.
   */
  onLaunchWorkflowBuilder?: (prompt: string) => void;
  /** Available dashboards for "Add to Dashboard" modal */
  availableDashboards?: import('./AddToDashboardModal').DashboardOption[];
  /** Available reports for "Add to Report" modal */
  availableReports?: import('./AddToReportModal').ReportOption[];
  /** Called when user adds result to a dashboard */
  onAddResultToDashboard?: (payload: {
    dashboardId: string;
    dashboardName: string;
    isNew: boolean;
    newName?: string;
    newDescription?: string;
    selection: import('./AddToDashboardModal').GranularSelection;
  }) => void;
  /** Called when user adds result to a report */
  onAddResultToReport?: (payload: {
    reportId: string;
    reportName: string;
    isNew: boolean;
    newName?: string;
    newDescription?: string;
    selection: import('./AddToDashboardModal').GranularSelection;
  }) => void;
  /** Navigate to a dashboard detail view */
  onViewDashboard?: (dashboardId: string) => void;
  /** Navigate to a report view */
  onViewReport?: (reportId: string) => void;
}

// Step labels for the subtle inline audit loader. The artifact panel renders
// the full Plan / Code / Sources detail; here we only narrate progress as a
// single shimmering line and sync the active artifact tab.
const LOADING_STEPS: { label: string; tab: ArtifactTab | null }[] = [
  { label: 'Generating execution plan…',  tab: 'plan' },
  { label: 'Writing SQL query…',          tab: 'code' },
  { label: 'Connecting data sources…',    tab: 'sources' },
  { label: 'Processing 1.2M records…',    tab: null },
];

const WORKFLOW_TYPE_NAMES: Record<WorkflowTypeId, string> = {
  reconciliation: 'Three-Way Reconciliation',
  detection: 'Duplicate Detection',
  monitoring: 'Vendor Master Monitoring',
  compliance: 'Segregation of Duties Compliance',
};

const detectWorkflowType = (msg: string): WorkflowTypeId => {
  const lower = msg.toLowerCase();
  if (lower.includes('reconciliation') || lower.includes('3-way') || lower.includes('po match')) return 'reconciliation';
  if (lower.includes('duplicate') || lower.includes('detection')) return 'detection';
  if (lower.includes('monitor') || lower.includes('vendor master') || lower.includes('change')) return 'monitoring';
  if (lower.includes('sod') || lower.includes('segregation') || lower.includes('compliance')) return 'compliance';
  return 'detection';
};

// Compact chat timestamp: "3:08 PM" today, "Fri 3:08 PM" within this week,
// "May 18, 3:08 PM" older. Used as the meta line under the assistant's
// follow-up block and under each user bubble — matches the reference where
// both speakers carry a small day+time muted footer.
const formatChatTime = (date: Date) => {
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) {
    const wd = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `${wd} ${time}`;
  }
  const md = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${md}, ${time}`;
};

// Classify a follow-up suggestion by its leading verb so each chip carries
// a contextual icon + tiny category label. Keeps the chip color family
// unchanged (DESIGN.md: no RAG-style category tinting); variety comes from
// the icon, not from chip hue. Falls back to ArrowRight for unmatched text.
type FollowUpKind = {
  Icon: LucideIcon;
  category: string;
};
const classifyFollowUp = (text: string): FollowUpKind => {
  const t = text.toLowerCase();
  if (/^(show|view|see|reveal|display|breakdown)\b/.test(t)) return { Icon: BarChart3,   category: 'Analyze' };
  if (/^(drill|filter|narrow|focus on|find|search)\b/.test(t) || t.includes('drill into')) return { Icon: Search,      category: 'Drill-down' };
  if (/^(build|create|automate|design|set up|configure)\b/.test(t) || t.includes('workflow')) return { Icon: Workflow,    category: 'Workflow' };
  if (/^(compare|contrast|diff|benchmark|against)\b/.test(t) || t.includes('against')) return { Icon: GitCompare,  category: 'Compare' };
  if (/^(generate|draft|export|share|send|prepare)\b/.test(t) || t.includes('report')) return { Icon: FileText,    category: 'Report' };
  if (/^(cross-check|verify|validate|check|confirm|audit)\b/.test(t)) return { Icon: ShieldCheck, category: 'Verify' };
  if (/^(summari[sz]e|highlight|recap|review)\b/.test(t)) return { Icon: Lightbulb,   category: 'Summarize' };
  return { Icon: ArrowRight, category: 'Ask' };
};

// ─── Chart rendering (reuses dashboard ConfigurableChart) ─────────────────────

function renderChart(chart: typeof AUDIT_RESULT.charts[number], variant: 'inline' | 'fullscreen') {
  const isConfidence = chart.id === 'confidence';
  // Inherit the dashboard ConfigurableChart palette (PURPLE default) so chart
  // visuals match across surfaces — when an auditor takes a query result and
  // adds it to a dashboard, the bars don't change color.
  return (
    <div style={variant === 'fullscreen' ? { width: '100%', height: '100%' } : { height: 240 }}>
      <ConfigurableChart
        type={isConfidence ? 'bar' : 'pie'}
        xAxis={isConfidence ? 'Quarter' : 'Department'}
        showTarget={false}
        showLegend={!isConfidence}
      />
    </div>
  );
}

// ─── ChartGroup with chip toggle + fullscreen ────────────────────────────────

function ChartGroup({ charts, embedded = false }: { charts: typeof AUDIT_RESULT.charts; embedded?: boolean }) {
  const [activeId, setActiveId] = useState(charts[0].id);
  const [fullscreen, setFullscreen] = useState(false);
  const active = charts.find(c => c.id === activeId) ?? charts[0];

  return (
    <>
      <div className={embedded
        ? 'bg-canvas-elevated overflow-hidden'
        : 'rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-sm shadow-ink-900/[0.04]'}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-canvas-border bg-canvas-elevated">
          {charts.length > 1 ? (
            <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-brand-50">
              {charts.map(c => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`px-2.5 h-7 rounded text-xs font-medium transition-colors ${
                      isActive ? 'bg-canvas-elevated text-text shadow-sm' : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-xs font-medium text-ink-700">{active.label}</span>
          )}
          <button
            onClick={() => setFullscreen(true)}
            className="p-1.5 rounded-md text-ink-500 hover:text-ink-700 hover:bg-brand-50 transition-colors cursor-pointer"
            aria-label="Expand chart"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div>{renderChart(active, 'inline')}</div>
      </div>
      <AnimatePresence>
        {fullscreen && (
          <FullscreenChartModal
            charts={charts}
            activeId={activeId}
            onActiveChange={setActiveId}
            onClose={() => setFullscreen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FullscreenChartModal({
  charts, activeId, onActiveChange, onClose,
}: {
  charts: typeof AUDIT_RESULT.charts;
  activeId: string;
  onActiveChange: (id: string) => void;
  onClose: () => void;
}) {
  const active = charts.find(c => c.id === activeId) ?? charts[0];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop — same as dashboard */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Dialog — same ratio as dashboard ExpandedWidgetModal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '96vw', height: '94vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-canvas-border shrink-0">
          {charts.length > 1 ? (
            <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-brand-50">
              {charts.map(c => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => onActiveChange(c.id)}
                    className={`px-3 h-7 rounded text-[12px] font-medium transition-colors cursor-pointer ${
                      isActive ? 'bg-canvas-elevated text-text shadow-sm' : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-[13px] font-semibold text-ink-800">{active.label}</span>
          )}
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-500 hover:text-ink-700 hover:bg-brand-50 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Chart — fills remaining space, same as dashboard */}
        <div className="relative flex-1 overflow-hidden" style={{ minHeight: 200 }}>
          {renderChart(active, 'fullscreen')}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Results table preview ───────────────────────────────────────────────────

function ResultsTable({
  columns, rows, totalRows, onOpen, onDownload,
}: {
  columns: string[];
  rows: string[][];
  totalRows: number;
  onOpen: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-sm shadow-ink-900/[0.04]">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-canvas-border bg-canvas-elevated">
              {columns.map(c => (
                <th key={c} className="text-left px-3 py-2.5 font-semibold text-ink-500 uppercase tracking-wide text-xs">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-canvas-border last:border-b-0 hover:bg-brand-50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className={`px-3 py-2.5 text-ink-700 ${j >= 3 ? 'tabular-nums' : ''}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-canvas-border bg-canvas-elevated">
        <span className="text-xs text-ink-500">Preview · <span className="tabular-nums">{rows.length}</span> of <span className="tabular-nums">{totalRows}</span> results</span>
        <div className="flex items-center gap-1">
          <button onClick={onOpen} className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-ink-600 hover:text-text hover:bg-brand-50 transition-colors cursor-pointer">
            <ExternalLink size={12} /> Open in new view
          </button>
          <button onClick={onDownload} className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-ink-600 hover:text-text hover:bg-brand-50 transition-colors cursor-pointer">
            <Download size={12} /> Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible thinking trail (one per IRA message) ───────────────────────

function ThinkingTrail({ summary, steps, defaultOpen = false }: {
  summary: string;
  steps: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!steps.length) return null;
  return (
    <button
      onClick={() => setOpen(p => !p)}
      className="group inline-flex items-start gap-1.5 text-left text-[12px] text-ink-500 hover:text-ink-700 transition-colors cursor-pointer mb-2"
    >
      <ChevronRight size={12} className={`mt-0.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      <span className="flex-1">
        <span className="block">{summary}</span>
        {open && (
          <span className="mt-1.5 block pl-2 border-l border-canvas-border space-y-0.5">
            {steps.map((s, i) => (
              <span key={i} className="block text-ink-500">· {s}</span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

// ─── Clarification block (interactive, lives inside an IRA message) ────────

function ClarificationBlock({
  data, onAnswer, onSubmit, onSkipAll, onSkipCurrent,
}: {
  data: ClarificationData;
  onAnswer: (qIndex: number, answer: string) => void;
  onSubmit: () => void;
  onSkipAll: () => void;
  onSkipCurrent: (qIndex: number) => void;
}) {
  const total = data.questions.length;
  const answeredCount = Object.keys(data.answers).length;
  const activeIndex = data.questions.findIndex((_, i) => data.answers[i] === undefined);

  // displayIndex lets the user navigate back to already-answered questions to
  // change their picks. `null` = follow the natural flow (next-unanswered =
  // activeIndex). Back/Forward chevrons set it explicitly.
  const [displayIndex, setDisplayIndex] = useState<number | null>(null);
  const viewIndex = displayIndex ?? (activeIndex !== -1 ? activeIndex : total - 1);
  const viewQ = viewIndex >= 0 && viewIndex < total ? data.questions[viewIndex] : null;
  const optionCount = viewQ?.options.length ?? 0;
  const canGoBack = viewIndex > 0;
  const canGoForward =
    viewIndex < total - 1 &&
    (data.answers[viewIndex] !== undefined || viewIndex < activeIndex || activeIndex === -1);

  const [highlighted, setHighlighted] = useState(0);
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef(customInput);
  customInputRef.current = customInput;

  // Reset highlight + input when viewed question changes
  useEffect(() => {
    setHighlighted(0);
    setCustomInput('');
  }, [viewIndex]);

  // Keyboard navigation — only fires while clarification is open and active
  useEffect(() => {
    if (data.status === 'submitted' || !viewQ) return;
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inMainTextarea =
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement && active !== inputRef.current);
      const inOurInput = active === inputRef.current;

      if (e.key === 'ArrowDown') {
        if (inMainTextarea) return;
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, optionCount - 1));
      } else if (e.key === 'ArrowUp') {
        if (inMainTextarea) return;
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
      } else if (e.key === 'Enter' && !inMainTextarea && !inOurInput) {
        e.preventDefault();
        selectOption(viewQ.options[highlighted]);
      } else if (e.key === 'Escape') {
        if (inMainTextarea) return;
        e.preventDefault();
        skipCurrent();
      } else if (/^[1-9]$/.test(e.key) && !inMainTextarea && !inOurInput) {
        const num = parseInt(e.key, 10) - 1;
        if (num < optionCount) {
          e.preventDefault();
          selectOption(viewQ.options[num]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // selectOption / skipCurrent close over highlighted + viewIndex; we want fresh ones
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, viewIndex, optionCount, data.status]);

  if (data.status === 'submitted') {
    return (
      <div className="text-[13px] text-ink-700 leading-relaxed">
        Got it. Running with these inputs.
      </div>
    );
  }

  if (!viewQ) {
    return null;
  }

  function selectOption(opt: string) {
    if (!viewQ) return;
    const isReAnswering = data.answers[viewIndex] !== undefined;
    const willBeLast =
      !isReAnswering && answeredCount === total - 1 && viewIndex === activeIndex;
    onAnswer(viewIndex, opt);
    if (willBeLast) setTimeout(() => onSubmit(), 80);
    // When the user is answering the question they're naturally on (viewIndex
    // tracking activeIndex), resume auto-follow so the next render advances to
    // the new first-unanswered. When they back-navigated to re-answer, stay put
    // so they can confirm the change before moving on.
    if (!isReAnswering && viewIndex === activeIndex) {
      setDisplayIndex(null);
    }
  }

  function skipCurrent() {
    if (!viewQ) return;
    const wasLast = viewIndex === total - 1;
    onSkipCurrent(viewIndex);
    if (wasLast) setTimeout(() => onSubmit(), 80);
    if (viewIndex === activeIndex) setDisplayIndex(null);
  }

  function goBack() {
    if (canGoBack) setDisplayIndex(viewIndex - 1);
  }
  function goForward() {
    if (canGoForward) setDisplayIndex(viewIndex + 1);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        {/* Header — question on its own row so multi-clause questions don't
            truncate alongside Back/Next. Pagination + nav controls sit
            beneath in a dedicated control row with their own meta typography. */}
        <div className="px-4 pt-3.5 pb-2.5 border-b border-canvas-border/60 bg-canvas-elevated">
          <p className="text-[14px] font-semibold leading-snug text-ink-800">
            {viewQ.question}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[0.06em] text-ink-400 tabular-nums">
              Question {viewIndex + 1} of {total}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={goBack}
                disabled={!canGoBack}
                aria-label="Previous question"
                className="flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium text-ink-500 hover:bg-brand-50 hover:text-ink-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <ChevronLeft size={13} />
                Back
              </button>
              <button
                type="button"
                onClick={goForward}
                disabled={!canGoForward}
                aria-label="Next question"
                className="flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium text-ink-500 hover:bg-brand-50 hover:text-ink-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Next
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Numbered options */}
        <div role="listbox" aria-label={viewQ.question}>
          {viewQ.options.map((opt, idx) => {
            const isHighlighted = highlighted === idx;
            const isPicked = data.answers[viewIndex] === opt;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlighted(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-canvas-border/60 first:border-t-0 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset ${
                  isPicked ? 'bg-brand-50' : isHighlighted ? 'bg-brand-50/60' : 'hover:bg-brand-50/40'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-mono tabular-nums shrink-0 transition-colors ${
                  isPicked
                    ? 'bg-brand-600 text-white font-semibold'
                    : isHighlighted
                      ? 'bg-brand-100 text-brand-700 font-semibold'
                      : 'bg-canvas-border/60 text-ink-400'
                }`}>
                  {idx + 1}
                </span>
                <span className={`flex-1 text-[13px] leading-snug ${isPicked ? 'text-ink-900 font-medium' : 'text-ink-800'}`}>{opt}</span>
                {isHighlighted && !isPicked && (
                  <CornerDownLeft size={12} className="text-brand-600 shrink-0" />
                )}
              </button>
            );
          })}

          {/* Submit row — surfaces user's progress and lets them commit early */}
          {answeredCount > 0 && (
            <div className="border-t border-canvas-border/60 flex items-center justify-between gap-3 px-4 py-2.5 bg-brand-50">
              <span className="text-[12px] text-ink-500 tabular-nums">
                {answeredCount} of {total} answered
              </span>
              <button
                onClick={onSubmit}
                className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors cursor-pointer"
              >
                Submit {answeredCount} answer{answeredCount === 1 ? '' : 's'}
              </button>
            </div>
          )}

          {/* Custom input row */}
          <div className="border-t border-canvas-border/60 flex items-center gap-3 px-4 py-2">
            <Pencil size={13} className="text-ink-400 shrink-0" />
            <input
              ref={inputRef}
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customInputRef.current.trim()) {
                  e.preventDefault();
                  e.stopPropagation();
                  selectOption(customInputRef.current.trim());
                }
              }}
              placeholder="Something else"
              className="flex-1 bg-transparent text-[13px] text-ink-800 placeholder:text-ink-400 outline-none h-8"
            />
            <button
              onClick={skipCurrent}
              className="px-3 h-7 text-[12px] font-medium text-ink-600 hover:text-ink-800 border border-canvas-border bg-canvas-elevated hover:bg-brand-50 rounded-md transition-colors cursor-pointer shrink-0"
            >
              Skip
            </button>
          </div>
        </div>
      </div>

      {/* Footer — kbd hints in mono on the left, progress tally on the right.
          Mono framing reads as "shortcut atoms" rather than prose, so the eye
          doesn't try to parse them as a sentence. */}
      <div className="flex items-center justify-between gap-4 text-[11px] text-ink-400 px-1">
        <div className="flex items-center gap-2 font-mono">
          <span><kbd className="text-ink-500">↑↓</kbd> navigate</span>
          <span aria-hidden="true" className="text-canvas-border">·</span>
          <span><kbd className="text-ink-500">↵</kbd> select</span>
          <span aria-hidden="true" className="text-canvas-border">·</span>
          <span><kbd className="text-ink-500">esc</kbd> skip</span>
        </div>
        <span className="tabular-nums text-ink-500">{answeredCount} of {total} answered</span>
      </div>
    </div>
  );
}

// ─── Subtle inline audit loader ───────────────────────────────────────────────
// Single shimmering line that cycles through LOADING_STEPS, syncs the active
// artifact tab as it advances, and fires onComplete when done. The artifact
// panel carries the heavy detail (Plan / Code / Sources); inline stays quiet.
function InlineAuditLoader({
  steps,
  onTabSwitch,
  onComplete,
  stepDurationMs = 1700,
}: {
  steps: { label: string; tab: ArtifactTab | null }[];
  onTabSwitch?: (tab: ArtifactTab) => void;
  onComplete: () => void;
  stepDurationMs?: number;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onTabSwitchRef = useRef(onTabSwitch);
  onCompleteRef.current = onComplete;
  onTabSwitchRef.current = onTabSwitch;

  useEffect(() => {
    if (completedRef.current) return;
    if (stepIdx >= steps.length) {
      completedRef.current = true;
      onCompleteRef.current();
      return;
    }
    const tab = steps[stepIdx].tab;
    if (tab) onTabSwitchRef.current?.(tab);
    const t = setTimeout(() => setStepIdx(i => i + 1), stepDurationMs);
    return () => clearTimeout(t);
  }, [stepIdx, steps, stepDurationMs]);

  const active = steps[Math.min(stepIdx, steps.length - 1)];
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-600">
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
      </span>
      <TextShimmer as="span" duration={2} spread={1.5}>
        {active.label}
      </TextShimmer>
    </div>
  );
}

function SaveWorkflowButton() {
  const [saved, setSaved] = useState(false);
  if (saved) {
    return (
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 px-3 py-2 bg-primary-xlight text-brand-700 rounded-lg text-xs font-semibold">
        <CheckCircle size={12} /> Saved to Library
      </motion.div>
    );
  }
  return (
    <button onClick={() => setSaved(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer">
      <Save size={12} /> Save to Library
    </button>
  );
}

// ─── Save-as-Workflow Modal ─────────────────────────────────────────────────
// Path 3 commit moment: turning a query thread into a workflow thread is
// irreversible per PRD, so the modal captures metadata (name, BP, sub-process,
// description) and surfaces the warning copy before flipping artifactMode.

type WorkflowFrequencyConfig = {
  frequency: 'Hourly' | 'Daily' | 'Weekly' | 'Monthly';
  runTime: string;
  dayOfWeek?: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  monthlyDate?: string;
  triggerOn: 'Schedule' | 'Data Change' | 'Manual';
  retry: 'Off' | '1x' | '3x' | '5x';
};

interface SaveAsWorkflowModalProps {
  open: boolean;
  defaultName: string;
  defaultDescription: string;
  onCancel: () => void;
  onConfirm: (data: {
    name: string;
    bpId: string;
    subProcessId: string;
    description: string;
    frequencyConfig: WorkflowFrequencyConfig;
  }) => void;
}

function SaveAsWorkflowModal({ open, defaultName, defaultDescription, onCancel, onConfirm }: SaveAsWorkflowModalProps) {
  // Wire shared modal a11y: focus trap, Escape, autofocus, restore focus, scroll lock.
  // Matches AddToDashboard / AddToReport so keyboard users get one consistent contract.
  const dialogRef = useDialogA11y(open, onCancel);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [bpId, setBpId] = useState<string>('');
  const [subProcessId, setSubProcessId] = useState<string>('');
  // Audit run frequency — same shape as Workflow Library > Configuration tab
  // (WorkflowDetail.tsx). Defaults match the canonical "Daily 06:00 Schedule 3x".
  const [frequency, setFrequency] = useState<WorkflowFrequencyConfig['frequency']>('Daily');
  const [runTime, setRunTime] = useState('06:00');
  const [dayOfWeek, setDayOfWeek] = useState<NonNullable<WorkflowFrequencyConfig['dayOfWeek']>>('Mon');
  const [monthlyDate, setMonthlyDate] = useState('');
  const [triggerOn, setTriggerOn] = useState<WorkflowFrequencyConfig['triggerOn']>('Schedule');
  const [retry, setRetry] = useState<WorkflowFrequencyConfig['retry']>('3x');

  // Reset form when modal opens with fresh defaults
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription(defaultDescription);
      setBpId('');
      setSubProcessId('');
      setFrequency('Daily');
      setRunTime('06:00');
      setDayOfWeek('Mon');
      setMonthlyDate('');
      setTriggerOn('Schedule');
      setRetry('3x');
    }
  }, [open, defaultName, defaultDescription]);

  const pillCls = (active: boolean) =>
    `px-3 py-1 rounded-full text-[11.5px] font-medium border transition-colors cursor-pointer ${
      active
        ? 'bg-primary border-primary text-white'
        : 'bg-white border-border-light text-text-muted hover:border-primary/40 hover:text-text'
    }`;

  // Sub-process options derived from SOPs filtered by selected BP
  const subProcessOptions = bpId ? SOPS.filter(s => s.bpId === bpId) : [];

  const canConfirm = name.trim() && bpId && subProcessId;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="save-as-wf-title">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[4px]"
        onClick={onCancel}
      />
      {/* Modal */}
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="relative bg-white rounded-2xl shadow-2xl border border-border-light w-[800px] max-w-[92vw] max-h-[88vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-xlight flex items-center justify-center shrink-0">
              <Save size={16} className="text-primary" />
            </div>
            <div>
              <h2 id="save-as-wf-title" className="text-[15px] font-semibold text-text">Save as workflow</h2>
              <p className="text-[12px] text-text-muted mt-0.5">Turn this query result into a re-runnable workflow.</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 text-text-muted hover:text-text-secondary rounded-md hover:bg-brand-50 transition-colors cursor-pointer" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Warning */}
        <div className="mx-6 mb-4 px-3 py-2.5 rounded-lg bg-mitigated-50 border border-mitigated/10 flex gap-2 items-start">
          <Lightbulb size={13} className="text-mitigated-700 mt-0.5 shrink-0" />
          <p className="text-[12px] leading-relaxed text-mitigated-700">
            This chat will switch to <strong>workflow mode</strong>. You won't be able to switch back to query mode in this chat. Start a new chat for that.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 pb-5 flex-1 overflow-y-auto space-y-4">
          {/* Workflow name */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1.5">Workflow name <span className="text-risk">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 text-[13px] text-text border border-border-light rounded-lg bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              placeholder="e.g., Duplicate Invoice Detection: Q1 ±3 days"
            />
            <p className="text-[11px] text-text-muted mt-1">IRA pre-filled this from your query. Edit if needed.</p>
          </div>

          {/* Two-column row: BP + Sub-process */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1.5">Business process <span className="text-risk">*</span></label>
              <select
                value={bpId}
                onChange={e => { setBpId(e.target.value); setSubProcessId(''); }}
                className="w-full h-10 px-3 text-[13px] text-text border border-border-light rounded-lg bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
              >
                <option value="">Select…</option>
                {BUSINESS_PROCESSES.map(bp => (
                  <option key={bp.id} value={bp.id}>{bp.name} ({bp.abbr})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1.5">Sub-process <span className="text-risk">*</span></label>
              <select
                value={subProcessId}
                onChange={e => setSubProcessId(e.target.value)}
                disabled={!bpId}
                className="w-full h-10 px-3 text-[13px] text-text border border-border-light rounded-lg bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer disabled:bg-brand-50 disabled:text-text-muted disabled:cursor-not-allowed"
              >
                <option value="">{bpId ? 'Select…' : 'Pick a business process first'}</option>
                {subProcessOptions.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.name.replace(/\s*SOP$/i, '').trim()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-[13px] text-text border border-border-light rounded-lg bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none"
              placeholder="One-line summary of what this workflow does."
            />
            <p className="text-[11px] text-text-muted mt-1">Optional. IRA pre-filled this from your query.</p>
          </div>

          {/* Audit run frequency — mirrors Workflow Library > Configuration tab */}
          <div>
            <label className="text-[12px] font-semibold text-text mb-2 inline-flex items-center gap-1.5">
              <Calendar size={12} className="text-primary" />
              Audit run frequency
            </label>
            <div className="rounded-lg border border-border-light bg-brand-50 p-3.5 grid grid-cols-2 gap-x-4 gap-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">Frequency</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Hourly', 'Daily', 'Weekly', 'Monthly'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={pillCls(frequency === f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">Run Time</label>
                <input
                  type="time"
                  value={runTime}
                  onChange={e => setRunTime(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border-light text-[13px] bg-white text-text focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              {frequency === 'Weekly' && (
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">Select day of the week</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDayOfWeek(d)}
                        className={pillCls(dayOfWeek === d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {frequency === 'Monthly' && (
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">Select date</label>
                  <input
                    type="date"
                    value={monthlyDate}
                    onChange={e => setMonthlyDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-border-light text-[13px] bg-white text-text focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">Trigger On</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Schedule', 'Data Change', 'Manual'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTriggerOn(t)}
                      className={pillCls(triggerOn === t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">Retry on Failure</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Off', '1x', '3x', '5x'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRetry(r)}
                      className={pillCls(retry === r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border-light px-6 py-3 flex items-center justify-end gap-2 bg-brand-50">
          <button onClick={onCancel} className="px-4 py-2 text-[12px] font-semibold text-text-muted hover:text-text-secondary hover:bg-white rounded-lg transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm({
              name: name.trim(),
              bpId,
              subProcessId,
              description: description.trim(),
              frequencyConfig: {
                frequency,
                runTime,
                dayOfWeek: frequency === 'Weekly' ? dayOfWeek : undefined,
                monthlyDate: frequency === 'Monthly' ? monthlyDate : undefined,
                triggerOn,
                retry,
              },
            })}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-canvas-border disabled:text-text-muted disabled:cursor-not-allowed text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
          >
            <Save size={12} /> Save & switch to workflow
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Inline-edit user-message bubble ─────────────────────────────────────────
// Drops in where the user-pill normally renders. Wears the same shape and
// brand-tint as the pill so the in-place edit reads as "the same message,
// just opened up", not as a foreign control.

function InlineEditBubble({
  value, onChange, onSave, onCancel,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Auto-focus + select-all on mount so the user can immediately retype or
  // tweak. Resize the textarea to fit its content.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, []);
  const onInput = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
  const canSave = value.trim().length > 0;
  return (
    <div className="w-full max-w-[66ch]">
      <div className="rounded-2xl bg-canvas-elevated border border-canvas-border px-4 py-2.5 shadow-sm shadow-ink-900/[0.03] focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-300/20 transition-[border-color,box-shadow] duration-200">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => { onChange(e.target.value); onInput(); }}
          onKeyDown={onKey}
          rows={1}
          aria-label="Edit message"
          className="no-focus-ring w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-ink-800 placeholder:text-ink-400 min-h-[20px] max-h-[240px]"
        />
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-2.5 rounded-md text-[12px] font-medium text-ink-500 hover:text-ink-800 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="h-7 px-3 rounded-md text-[12px] font-semibold bg-primary text-white hover:bg-primary-hover active:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1"
        >
          Save & resend
        </button>
      </div>
    </div>
  );
}

export default function ChatView({ showChatHistory, toggleChatHistory, setShowArtifacts, showArtifacts, setActiveArtifactTab, setArtifactMode, setWorkflowType, initialQuery, onInitialQueryProcessed, selectedChatId, onChatLoaded, setView, pendingDashboard, onAddToDashboard, onDismissPendingDashboard, onLaunchWorkflowBuilder, availableDashboards, availableReports, onAddResultToDashboard, onAddResultToReport, onViewDashboard, onViewReport }: ChatViewProps) {
  const { addToast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const processingRef = useRef(false);

  // New flow state
  const [showClarificationCard, setShowClarificationCard] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<Array<{ question: string; options: string[] }>>([]);
  const [showProgressiveLoader, setShowProgressiveLoader] = useState(false);

  // Workflow build flow state
  const [workflowBuildPhase, setWorkflowBuildPhase] = useState(0); // 0=idle, 1=asking-files, 2=asking-logic, 3=confirming, 4=input-config, 5=freeze-confirm, 6=output-config, 7=save
  const [currentWorkflowType, setCurrentWorkflowType] = useState<WorkflowTypeId | null>(null);

  // Composer mode toggle — drives whether a Submit routes to query or workflow flow.
  // Default is query (toggle off); user opts into workflow build by toggling the pill on.
  const [buildWorkflowMode, setBuildWorkflowMode] = useState(false);

  // Save-as-workflow flow state (Path 3 — query → workflow flip)
  const [showSaveAsWfModal, setShowSaveAsWfModal] = useState(false);
  const [lockedAsWorkflow, setLockedAsWorkflow] = useState(false);
  // Captured tolerance/threshold config from the pre-modal clarification —
  // drives the modal's prefilled name + description so the user sees their
  // choices reflected before they commit to the workflow.
  const saveWorkflowConfigRef = useRef<{ amount: string; date: string; threshold: string }>({
    amount: '', date: '', threshold: '',
  });

  // Data picker modal — replaces the raw file-input click on the upload buttons.
  // attachedSources are picks from existing data (files / DBs / APIs / cloud / session)
  // and live alongside the legacy `files` array (raw fresh uploads).
  const [showDataPicker, setShowDataPicker] = useState(false);
  const [attachedSources, setAttachedSources] = useState<AttachmentSelection[]>([]);

  // Add-to-dashboard / add-to-report modals
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  // Which message's result we're adding (tracks the message id)
  const [activeAddMsgId, setActiveAddMsgId] = useState<string | null>(null);
  // Dropdown on already-added buttons: "msg-id:dashboard" or "msg-id:report"
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Track whether the progressive loader is rendering an audit-query response
  const activeQueryFlowRef = useRef<'audit-query' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const scrolledUp = distanceFromBottom > threshold;
    isUserScrolledUp.current = scrolledUp;
    // Mirror to React state so the floating "scroll-to-bottom" pill can render.
    // Ref drives auto-scroll behavior (no re-render); state drives the pill.
    setShowScrollToBottom(prev => prev === scrolledUp ? prev : scrolledUp);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!isUserScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }, [messages, isTyping, thinkingSteps, showClarificationCard, showProgressiveLoader, prefersReducedMotion]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // Support for "Ask AI about risk" context — auto-send initialQuery when it appears
  useEffect(() => {
    if (initialQuery) {
      setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'user', text: initialQuery, timestamp: new Date() }]);
      simulateResponse(initialQuery);
      onInitialQueryProcessed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Clear all pending timers
  const clearTimers = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  };

  // Schedule a callback after ms — stored in ref for cleanup
  const schedule = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  };

  // Cancel an in-flight typing simulation. Clears pending timers, hides the
  // thinking trail, and flips isTyping off so the composer returns to Send.
  // If an audit run was mid-flight, tag its message so the UI shows "Stopped"
  // instead of leaving the loader frozen in place.
  const stopGenerating = useCallback(() => {
    clearTimers();
    setIsTyping(false);
    setThinkingSteps([]);
    setShowProgressiveLoader(false);
    const haltedId = auditRunMsgIdRef.current;
    auditRunMsgIdRef.current = null;
    activeQueryFlowRef.current = null;
    if (haltedId) {
      setMessages(prev => prev.map(m => {
        if (m.id !== haltedId) return m;
        // Drop the audit-loading richType so the loader unmounts; keep the
        // thinking trail and mark the message as stopped for the badge.
        return { ...m, richType: undefined, stopped: true };
      }));
    }
    addToast({ type: 'info', message: 'Stopped generating.' });
  }, [addToast]);

  // Reset the entire conversation. Wired to: the header's "+ New chat" button
  // (was the floating chip's button) and the locked-workflow inline link
  // ("Start a new chat for a query"). Keeping this in one place prevents the
  // 14-setter chain from drifting between callsites.
  const resetChat = useCallback(() => {
    setMessages([]);
    setInput('');
    setShowClarificationCard(false);
    setShowProgressiveLoader(false);
    setWorkflowBuildPhase(0);
    setCurrentWorkflowType(null);
    setLockedAsWorkflow(false);
    setAttachedSources([]);
    setFiles([]);
    clearTimers();
    setShowArtifacts(false);
    setArtifactMode('query');
    setActiveArtifactTab('sources');
    setBuildWorkflowMode(false);
    setChatTitleOverride(null);
    setEditingTitle(false);
  }, [setShowArtifacts, setArtifactMode, setActiveArtifactTab]);

  // ─── Load a saved conversation by id (used by slide-out + Recents) ───
  const loadChatById = useCallback((chatId: string) => {
    const convo = CHAT_CONVERSATIONS[chatId];
    if (!convo) return false;
    const msgs: ChatMessage[] = convo.map((m, idx) => ({
      id: `history-${chatId}-${idx}`,
      role: m.role,
      text: m.text,
      timestamp: new Date(),
    }));
    setMessages(msgs);
    setShowClarificationCard(false);
    setShowProgressiveLoader(false);
    setIsTyping(false);
    setThinkingSteps([]);
    setWorkflowBuildPhase(0);
    setCurrentWorkflowType(null);
    setLockedAsWorkflow(false);
    clearTimers();
    return true;
  }, []);

  // Honor selectedChatId from app state (Recents → Chats deep-link).
  // Always clear the selection after the effect runs — even when the id has
  // no matching CHAT_CONVERSATIONS entry — so a stale id never sticks.
  useEffect(() => {
    if (!selectedChatId) return;
    loadChatById(selectedChatId);
    onChatLoaded?.();
  }, [selectedChatId, loadChatById, onChatLoaded]);

  // ─── Query Clarification Complete Handler ───
  // ─── Start the audit run as ONE IRA message that hosts the loader inline ───
  const auditRunMsgIdRef = useRef<string | null>(null);
  const startAuditQueryRun = () => {
    activeQueryFlowRef.current = 'audit-query';
    const msgId = `msg-audit-run-${Date.now()}`;
    auditRunMsgIdRef.current = msgId;

    setMessages(prev => [...prev, {
      id: msgId,
      role: 'assistant',
      text: '',
      thinking: [
        'Generating execution plan',
        'Writing SQL query',
        'Connecting to data sources',
        'Processing 1.2M records',
      ],
      timestamp: new Date(),
      richType: 'audit-loading',
    }]);

    setShowProgressiveLoader(true);
    setArtifactMode('query');
    setShowArtifacts(true);
    setActiveArtifactTab('plan');
  };

  // ─── Update an answer for the active clarification message ───
  const updateClarificationAnswer = (msgId: string, qIndex: number, answer: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'clarification') return m;
      const data = m.richData as unknown as ClarificationData;
      return {
        ...m,
        richData: { ...data, answers: { ...data.answers, [qIndex]: answer } } as unknown as Record<string, unknown>,
      };
    }));
  };

  // ─── Skip a single clarification question — sentinel '' marks "skipped but acknowledged" ───
  const skipClarificationQuestion = (msgId: string, qIndex: number) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'clarification') return m;
      const data = m.richData as unknown as ClarificationData;
      return {
        ...m,
        richData: { ...data, answers: { ...data.answers, [qIndex]: '' } } as unknown as Record<string, unknown>,
      };
    }));
  };

  // ─── Submit the clarification — freeze it, drop a single user msg, start the run ───
  const submitClarification = (msgId: string, fromSkip = false) => {
    let consolidated: { question: string; answer: string }[] = [];
    // Holder object — TS narrows bare `let` initialized to a literal, but
    // assignments inside the setMessages callback aren't visible to its flow
    // analysis. Wrapping in an object property defeats that narrowing.
    const flow: { purpose: 'audit-query' | 'save-workflow' } = { purpose: 'audit-query' };
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'clarification') return m;
      const data = m.richData as unknown as ClarificationData;
      flow.purpose = data.purpose ?? 'audit-query';
      consolidated = data.questions
        .map((q, qi) => ({ question: q.question, answer: data.answers[qi] }))
        .filter(p => !!p.answer);
      return {
        ...m,
        richData: { ...data, status: 'submitted' } as unknown as Record<string, unknown>,
      };
    }));

    schedule(() => {
      const userText = consolidated.length
        ? consolidated.map(c => `• ${c.answer}`).join('\n')
        : (fromSkip ? 'Skip: use sensible defaults.' : 'Run with the inputs above.');
      setMessages(prev => [...prev, {
        id: `msg-user-clarify-${Date.now()}`,
        role: 'user',
        text: userText,
        timestamp: new Date(),
      }]);
    }, 80);

    if (flow.purpose === 'save-workflow') {
      // Stash answers so the Save-as-Workflow modal's prefilled name/description
      // echo them. Defaults match the question's "(current)" option.
      const findAnswer = (kw: string) =>
        consolidated.find(c => c.question.toLowerCase().includes(kw))?.answer ?? '';
      saveWorkflowConfigRef.current = {
        amount: findAnswer('amount') || '±₹1,000',
        date: findAnswer('date') || '±3 days',
        threshold: findAnswer('threshold') || '≥90%',
      };
      schedule(() => setShowSaveAsWfModal(true), 360);
      return;
    }

    schedule(() => {
      if (buildWorkflowMode) {
        // Workflow-mode plan-approve gate (ported from auditify-app aa19493).
        // In workflow mode, surface the plan and wait for explicit Approve / Revise
        // before kicking off the audit run. Query mode auto-approves below.
        setMessages(prev => [...prev, {
          id: `msg-qna-plan-${Date.now()}`,
          role: 'assistant',
          text: '',
          timestamp: new Date(),
          richType: 'qna-plan',
          richData: {
            planText: 'Plan ready. Review the steps in the Workspace, then approve to run the audit or revise to adjust your inputs.',
          },
        }]);
      } else {
        startAuditQueryRun();
      }
    }, 240);
  };

  // ─── Approve / Revise the workflow-mode plan-gate (qna-plan messages) ───
  const handleApprovePlan = (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    startAuditQueryRun();
  };

  const handleRevisePlan = (msgId: string) => {
    setMessages(prev => [
      ...prev.filter(m => m.id !== msgId),
      {
        id: `msg-plan-revise-${Date.now()}`,
        role: 'assistant',
        text: 'Got it. Revise your inputs in the message box and re-send.',
        timestamp: new Date(),
      },
    ]);
  };

  // ─── Workflow Clarification Complete Handler ───
  const handleWorkflowClarificationComplete = (answers: Record<number, string>) => {
    setShowClarificationCard(false);

    if (workflowBuildPhase === 1) {
      // Phase 1 complete — summarize and move to Phase 2 (logic)
      const format = answers[0] || 'Mixed sources';
      const count = answers[1] || '3+ sources';
      setMessages(prev => [...prev, {
        id: `msg-wf-files-summary-${Date.now()}`,
        role: 'assistant',
        text: `Got it: **${format}** with **${count}**. Now let me understand the matching logic.`,
        timestamp: new Date(),
      }]);
      setWorkflowBuildPhase(2);

      // Show logic clarification card after brief delay
      schedule(() => {
        setClarificationQuestions([
          { question: 'What matching logic should I use?', options: ['Exact field matching', 'Fuzzy match with tolerance', 'AI-powered pattern detection', 'Custom rules (I\'ll define)'] },
          { question: 'What should happen with mismatches?', options: ['Flag for manual review', 'Auto-reject and notify', 'Quarantine for investigation', 'Score and prioritize'] },
        ]);
        setShowClarificationCard(true);
      }, 800);
    }
    else if (workflowBuildPhase === 2) {
      // Phase 2 complete — summarize and wait for user confirmation before opening canvas
      const logic = answers[0] || 'Fuzzy match';
      const action = answers[1] || 'Flag for review';
      setMessages(prev => [...prev, {
        id: `msg-wf-logic-summary-${Date.now()}`,
        role: 'assistant',
        text: `Perfect. **${logic}** with **${action}** for mismatches.\n\nHere's what I'll build:\n\n• **Data sources:** Mixed format (SQL + file upload)\n• **Matching:** ${logic}\n• **Mismatches:** ${action}\n\nShall I open the workflow canvas and configure the inputs? Type **"go"** or **"looks good"** to proceed.`,
        timestamp: new Date(),
        followUps: ['Looks good, build it', 'Change the matching logic', 'Add more data sources'],
      }]);
      setWorkflowBuildPhase(3);
    }
  };

  // ─── Clarification Card Complete Router (workflow flow only — audit-query is inline now) ───
  const handleClarificationCardComplete = (answers: Record<number, string>) => {
    setShowClarificationCard(false);
    if (workflowBuildPhase > 0) {
      handleWorkflowClarificationComplete(answers);
    }
  };

  // ─── Inline Query Clarification Flow ───
  // ONE IRA message holds: thinking summary + intro + 4 stacked questions + submit row.
  // User answers via clicking options or typing in the main chat box (routed to first
  // unanswered question while a clarification is open).
  const startQueryClarificationFlow = () => {
    clearTimers();
    setIsTyping(true);

    schedule(() => {
      setIsTyping(false);
      const questions = CLARIFICATION_STEPS.map(step => ({
        question: step.question,
        options: step.options,
      }));
      const data: ClarificationData = {
        intro: "One quick check before I run. Pick what fits, or type your own.",
        questions,
        answers: {},
        status: 'open',
      };
      setMessages(prev => [...prev, {
        id: `msg-clarify-${Date.now()}`,
        role: 'assistant',
        text: '',
        thinking: [
          'Parsed intent: invoice duplicate detection',
          'Identified 4 underspecified parameters',
          'Selected highest-impact prompts for clarification',
        ],
        timestamp: new Date(),
        richType: 'clarification',
        richData: data as unknown as Record<string, unknown>,
      }]);
    }, 600);
  };

  // ─── Progressive Loading Complete — swap the SAME IRA msg from loading → result ───
  const handleProgressiveLoadingComplete = () => {
    setShowProgressiveLoader(false);
    activeQueryFlowRef.current = null;

    const targetId = auditRunMsgIdRef.current;
    auditRunMsgIdRef.current = null;

    setMessages(prev => prev.map(m => {
      if (m.id !== targetId) return m;
      return {
        ...m,
        text: "Done. I scanned 1.2M invoice records and surfaced 8 potential duplicates. Total exposure ₹6.16L, with the highest-confidence pair at 96% match (Acme Corp). Acme accounts for half of the flags and is the first place I'd look.",
        followUps: AUDIT_FOLLOWUPS,
        richType: 'audit-result',
        richData: AUDIT_RESULT,
      };
    }));

    // ─── Two-pass scroll: keep chat-fluency default (auto-scroll-to-bottom
    //     fires on render via the messages effect), then once the rich result
    //     has mounted and its motion-reveal has settled, re-position the
    //     container so the headline body + KPI scoreboard sit ~12px from the
    //     viewport top. Without this, tall results bury their headline numbers
    //     above the fold.
    //
    //     Implementation notes (the first attempt got the cropped-top bug):
    //     • Skip when the user has manually scrolled up — never yank them.
    //     • Use container.scrollTo (NOT element.scrollIntoView) — scrollIntoView
    //       walks ancestors and can bubble to window scroll in some browsers,
    //       which pushed the message above the viewport last time.
    //     • Wait 320 ms (past the 200 ms component-reveal + KPI 50 ms × 4 stagger
    //       and chart paint) so the node is in its final layout when measured.
    //     • Compute the node's top relative to the container's scroll origin,
    //       not via offsetTop (which is relative to nearest positioned ancestor
    //       and varies with flex/grid containers).
    if (targetId && !isUserScrolledUp.current) {
      schedule(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const node = container.querySelector<HTMLElement>(`[data-msg-id="${targetId}"]`);
        if (!node) return;
        const containerRect = container.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const offsetFromTop = nodeRect.top - containerRect.top + container.scrollTop;
        const target = Math.max(0, offsetFromTop - 12);
        container.scrollTo({
          top: target,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      }, 320);
    }
  };

  // ─── Conversational Workflow Flow ───
  const startConversationalWorkflowFlow = (userMsg: string) => {
    clearTimers();
    const wfType = detectWorkflowType(userMsg);
    const wfName = WORKFLOW_TYPE_NAMES[wfType];
    setCurrentWorkflowType(wfType);
    setWorkflowBuildPhase(1);

    // Brief thinking animation
    setIsTyping(true);
    schedule(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `msg-wf-intro-${Date.now()}`,
        role: 'assistant',
        text: `Great, I'll help you build a **${wfName}** workflow. Let me understand your data sources first.`,
        timestamp: new Date(),
      }]);
      // Show file type clarification card
      setClarificationQuestions([
        { question: 'What data format are your source files?', options: ['CSV / Excel upload', 'Direct SQL connection', 'User uploads in chat', 'Mixed (SQL + file upload)'] },
        { question: 'How many data sources will this workflow need?', options: ['1 source (single file)', '2 sources (input + reference)', '3+ sources (multi-way match)', 'Not sure \u2014 recommend for me'] },
      ]);
      setShowClarificationCard(true);
    }, 1200);
  };

  // ─── Open Canvas After User Confirms (workflow phase 3) ───
  const openCanvasAfterConfirmation = () => {
    setIsTyping(true);
    schedule(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `msg-wf-opening-canvas-${Date.now()}`,
        role: 'assistant',
        text: `Setting up your workflow canvas now...`,
        timestamp: new Date(),
      }]);
    }, 600);

    schedule(() => {
      setArtifactMode('workflow');
      setWorkflowType?.(currentWorkflowType);
      setShowArtifacts(true);
    }, 1200);

    schedule(() => {
      setMessages(prev => [...prev, {
        id: `msg-wf-canvas-ready-${Date.now()}`,
        role: 'assistant',
        text: `I've configured the input sources based on your selections. Review and customize the input configuration in the canvas.\n\nTake your time. Click **'Confirm Inputs'** when ready.`,
        timestamp: new Date(),
      }]);
      setWorkflowBuildPhase(4);
    }, 2500);

    // Tip messages
    const freezeHintId = 'msg-wf-freeze-hint';
    schedule(() => {
      setMessages(prev => {
        if (prev.some(m => m.id === freezeHintId)) return prev;
        return [...prev, {
          id: freezeHintId,
          role: 'assistant' as const,
          text: `**Tip:** I've frozen the **Vendor Master Data** by default (last refreshed Mar 20). Toggle freeze on any other source that doesn't change between runs.`,
          timestamp: new Date(),
        }];
      });
    }, 8000);

    schedule(() => {
      setMessages(prev => {
        if (prev.some(m => m.id === 'msg-wf-save-prompt')) return prev;
        return [...prev, {
          id: 'msg-wf-save-prompt',
          role: 'assistant' as const,
          text: '',
          richType: 'save-workflow-prompt',
          timestamp: new Date(),
        }];
      });
    }, 20000);
  };

  const handleAuditAction = (action: 'workflow' | 'report' | 'dashboard', msgId?: string) => {
    if (action === 'dashboard') {
      setActiveAddMsgId(msgId || null);
      setShowDashboardModal(true);
      return;
    }
    if (action === 'report') {
      setActiveAddMsgId(msgId || null);
      setShowReportModal(true);
      return;
    }
    // workflow — keep existing toast behaviour
    addToast({ type: 'info', message: 'Adding to workflow library…' });
    setTimeout(() => {
      addToast({ type: 'success', message: 'Saved as workflow “AQ-2026-04-24”.' });
    }, 1200);
  };

  // Callback: user confirmed “Add to Dashboard” from modal
  const handleDashboardConfirm = (payload: Parameters<NonNullable<ChatViewProps['onAddResultToDashboard']>>[0]) => {
    if (activeAddMsgId) {
      setMessages(prev => prev.map(m => {
        if (m.id !== activeAddMsgId) return m;
        const existing = m.addedTo?.dashboards || [];
        return {
          ...m,
          addedTo: {
            ...m.addedTo,
            dashboards: [...existing, { id: payload.dashboardId, name: payload.dashboardName }],
          },
        };
      }));
    }
    onAddResultToDashboard?.(payload);
    const itemCount = payload.selection.kpis.length + payload.selection.charts.length + payload.selection.columns.length;
    // No Undo on dashboard toast: removeFromDashboard would only clear the
    // chat pill, leaving the persisted widgets orphaned on the dashboard.
    // Users remove widgets from the dashboard view itself.
    addToast({
      type: 'success',
      message: `Added ${itemCount} item${itemCount === 1 ? '' : 's'} to dashboard “${payload.dashboardName}”.`,
      action: { label: 'View Dashboard', onClick: () => onViewDashboard?.(payload.dashboardId) },
    });
    setActiveAddMsgId(null);
  };

  // Callback: user confirmed “Add to Report” from modal
  const handleReportConfirm = (payload: Parameters<NonNullable<ChatViewProps['onAddResultToReport']>>[0]) => {
    if (activeAddMsgId) {
      setMessages(prev => prev.map(m => {
        if (m.id !== activeAddMsgId) return m;
        const existing = m.addedTo?.reports || [];
        return {
          ...m,
          addedTo: {
            ...m.addedTo,
            reports: [...existing, { id: payload.reportId, name: payload.reportName }],
          },
        };
      }));
    }
    onAddResultToReport?.(payload);
    const undoMsgId = activeAddMsgId;
    const itemCount = payload.selection.kpis.length + payload.selection.charts.length + payload.selection.columns.length;
    addToast({
      type: 'success',
      message: `Added ${itemCount} item${itemCount === 1 ? '' : 's'} to report “${payload.reportName}”.`,
      action: { label: 'View Report', onClick: () => onViewReport?.(payload.reportId) },
      secondaryAction: undoMsgId
        ? { label: 'Undo', onClick: () => removeFromReport(undoMsgId, payload.reportId) }
        : undefined,
    });
    setActiveAddMsgId(null);
  };

  // Remove a dashboard/report link from a message
  const removeFromDashboard = (msgId: string, dashId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return {
        ...m,
        addedTo: {
          ...m.addedTo,
          dashboards: (m.addedTo?.dashboards || []).filter(d => d.id !== dashId),
        },
      };
    }));
    addToast({ type: 'info', message: 'Removed from dashboard.' });
  };

  const removeFromReport = (msgId: string, rptId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return {
        ...m,
        addedTo: {
          ...m.addedTo,
          reports: (m.addedTo?.reports || []).filter(r => r.id !== rptId),
        },
      };
    }));
    addToast({ type: 'info', message: 'Removed from report.' });
  };

  // Path 3 entry — open the Save-as-Workflow modal from the audit-result action bar.
  // Path 3 entry — instead of jumping straight to the metadata modal, IRA first
  // posts an inline clarification asking for tolerance / threshold config.
  // submitClarification (purpose: 'save-workflow') opens the modal once
  // those choices are captured.
  const openSaveAsWorkflowModal = () => {
    const hasOpenSaveClarify = messages.some(
      m => m.richType === 'clarification' &&
        (m.richData as unknown as ClarificationData)?.purpose === 'save-workflow' &&
        (m.richData as unknown as ClarificationData)?.status === 'open'
    );
    if (hasOpenSaveClarify) return;

    const data: ClarificationData = {
      intro: "Before I save this as a re-runnable workflow, let me confirm the matching tolerances and thresholds. Pick what fits, or type your own.",
      questions: [
        {
          question: 'Amount tolerance for duplicate matching',
          options: ['Exact match (₹0)', '±₹1,000', '±₹5,000', '±2% of invoice value'],
        },
        {
          question: 'Date tolerance for duplicate matching',
          options: ['Same day only', '±3 days (current)', '±7 days', '±14 days'],
        },
        {
          question: 'Match-score threshold to flag',
          options: ['≥90% (current)', '≥85%', '≥80%', '≥95%'],
        },
      ],
      answers: {},
      status: 'open',
      purpose: 'save-workflow',
    };
    setMessages(prev => [...prev, {
      id: `msg-clarify-savewf-${Date.now()}`,
      role: 'assistant',
      text: '',
      thinking: [
        'User asked to save as workflow',
        'Identified tolerances + threshold as configurable parameters',
        'Asking before locking the workflow definition',
      ],
      timestamp: new Date(),
      richType: 'clarification',
      richData: data as unknown as Record<string, unknown>,
    }]);
  };

  // Path 3 commit — modal confirmed. Lock the thread into workflow mode,
  // swap the IRA Workspace canvas (parent App.tsx handles the Y-spin), and
  // post the inline checkpoint message asking which params to make configurable.
  const handleSaveAsWorkflowConfirm = (data: { name: string; bpId: string; subProcessId: string; description: string; frequencyConfig: WorkflowFrequencyConfig }) => {
    setShowSaveAsWfModal(false);

    // Lock the composer pill — visual signal that mode is irreversible per thread.
    setLockedAsWorkflow(true);

    // Toast the save intent immediately so the user sees commit feedback
    // independently of the canvas-flip animation.
    addToast({ type: 'success', message: `Workflow draft "${data.name}" created.` });

    // Flip the right pane to workflow mode. App.tsx wraps the canvas in an
    // AnimatePresence Y-spin keyed on artifactMode, so this triggers the rotation.
    setArtifactMode('workflow');
    setWorkflowType?.('detection'); // duplicate-invoice query → detection workflow
    setShowArtifacts(true);
    // The "which params should be configurable?" checkpoint message used to
    // post here, but the tolerance/threshold clarification (PR#55) already
    // captures those choices before the modal opens — so showing it again is
    // redundant. Render handlers + branch for `workflow-checkpoint` are kept
    // so existing post-save hint messages (freeze tip, save-prompt) still fire.
  };

  // Toggle a checkpoint chip selection (multi-select).
  const toggleCheckpointParam = (msgId: string, paramId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'workflow-checkpoint') return m;
      const data = m.richData as { selected: string[] };
      const isSelected = data.selected.includes(paramId);
      return {
        ...m,
        richData: {
          ...m.richData,
          selected: isSelected ? data.selected.filter(p => p !== paramId) : [...data.selected, paramId],
        },
      };
    }));
  };

  // Confirm checkpoint selections — freeze the chip group + post follow-up.
  const submitCheckpoint = (msgId: string) => {
    let pickedLabels: string[] = [];
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'workflow-checkpoint') return m;
      const data = m.richData as { selected: string[]; options: { id: string; label: string }[] };
      pickedLabels = data.options.filter(o => data.selected.includes(o.id)).map(o => o.label);
      return { ...m, richData: { ...m.richData, status: 'submitted' as const } };
    }));
    schedule(() => {
      setMessages(prev => [...prev, {
        id: `msg-wf-config-update-${Date.now()}`,
        role: 'assistant',
        text: pickedLabels.length
          ? `Got it. I've marked **${pickedLabels.join(', ')}** as configurable. Review the input + output config in the Workspace, then click **'Save to Library'** when ready.`
          : `Okay. Keeping all parameters fixed for this workflow. Review the input + output config in the Workspace, then click **'Save to Library'** when ready.`,
        timestamp: new Date(),
      }]);
    }, 600);
  };

  // Post a terminal error message into the thread and clear all in-flight
  // flags. Used by simulateResponse's safety net and available for any
  // future real-backend stream-failure path. retryQuery is the user query
  // string the error should re-run when the user clicks "Try again".
  const postErrorMessage = useCallback((errText: string, retryQuery?: string) => {
    clearTimers();
    setIsTyping(false);
    setShowProgressiveLoader(false);
    setThinkingSteps([]);
    const haltedId = auditRunMsgIdRef.current;
    auditRunMsgIdRef.current = null;
    activeQueryFlowRef.current = null;
    setMessages(prev => {
      const filtered = haltedId ? prev.filter(m => m.id !== haltedId) : prev;
      return [...filtered, {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        text: '',
        timestamp: new Date(),
        richType: 'error',
        richData: { message: errText, retryQuery },
      }];
    });
  }, []);

  const simulateResponse = (userMsg: string, explicitMode?: 'query' | 'workflow') => {
    clearTimers();

    try {
      // If workflow is awaiting user confirmation (phase 3), any positive reply opens canvas
      if (workflowBuildPhase === 3) {
        openCanvasAfterConfirmation();
        return;
      }

      if (explicitMode === 'workflow') {
        startConversationalWorkflowFlow(userMsg);
        return;
      }
      if (explicitMode === 'query') {
        startQueryClarificationFlow();
        return;
      }

      const lower = userMsg.toLowerCase();
      if (lower.includes('workflow') || lower.includes('build a') || lower.includes('build me') || lower.includes('create a') || lower.includes('design a') || lower.includes('reconciliation')) {
        startConversationalWorkflowFlow(userMsg);
        return;
      }

      // Default — audit query flow with clarification → assumptions → loader → inline rich response
      startQueryClarificationFlow();
    } catch (err) {
      // Safety net: if routing throws synchronously, the user must not see a
      // stuck spinner. Convert to a friendly error message with retry.
      console.error('simulateResponse failed', err);
      postErrorMessage("Something went wrong while preparing that response.", userMsg);
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && files.length === 0) return;
    // Block send when the message exceeds the hard cap. The counter already
    // shows red past MAX_INPUT_CHARS — this catches keyboard-Enter users who
    // haven't looked at the counter.
    if (trimmed.length > MAX_INPUT_CHARS) {
      addToast({
        type: 'info',
        message: `Trim your message to ${MAX_INPUT_CHARS.toLocaleString()} characters or fewer to send.`,
      });
      return;
    }
    let text = trimmed;
    const attachmentLabels = [
      ...attachedSources.map(s => s.kind === 'source' ? s.name : ''),
      ...files.map(f => f.name),
    ].filter(Boolean);
    if (attachmentLabels.length > 0) text += `\n[Attached: ${attachmentLabels.join(', ')}]`;

    // Empty-state Submit with the "Build a workflow" toggle on hands the
    // typed prompt off to the AI Concierge workflow builder, which opens on
    // the clarification screen. The chat thread isn't started — the user
    // continues the conversation inside the journey.
    if (buildWorkflowMode && messages.length === 0 && trimmed && onLaunchWorkflowBuilder) {
      onLaunchWorkflowBuilder(trimmed);
      setInput('');
      setFiles([]);
      setAttachedSources([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    // If a clarification message is open, route the typed text to its first
    // unanswered question instead of starting a new chat turn.
    const openClarify = [...messages].reverse().find(
      m => m.richType === 'clarification' && (m.richData as unknown as ClarificationData)?.status === 'open'
    );
    if (openClarify && trimmed) {
      const data = openClarify.richData as unknown as ClarificationData;
      const firstUnanswered = data.questions.findIndex((_, i) => !data.answers[i]);
      if (firstUnanswered !== -1) {
        updateClarificationAnswer(openClarify.id, firstUnanswered, trimmed);
        setInput('');
        setFiles([]);
        setAttachedSources([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
    }

    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'user', text, timestamp: new Date() }]);
    setInput('');
    setFiles([]);
    setAttachedSources([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Keep keyboard users in flow: focus stays on the composer after send so
      // they can keep typing without reaching for the mouse. Skip if focus has
      // already moved elsewhere (modal open, follow-up clicked).
      const active = document.activeElement;
      if (!active || active === document.body || active === textareaRef.current) {
        textareaRef.current.focus();
      }
    }
    // Workflow mode: don't force 'workflow' explicit (which routes straight to
    // the canvas builder); fall through to the keyword router so non-workflow
    // queries reach clarification → the qna-plan approve/revise gate.
    simulateResponse(text, buildWorkflowMode ? undefined : 'query');
  };

  const handleFollowUpClick = (question: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'user', text: question, timestamp: new Date() }]);
    simulateResponse(question);
    setTimeout(() => { processingRef.current = false; }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Skip Enter-to-send while an IME composition is in flight (CJK input).
    // Without this, Enter commits the composition AND submits the message,
    // losing the in-progress character.
    const isComposing = (e.nativeEvent as KeyboardEvent).isComposing
      || (e as React.KeyboardEvent & { keyCode?: number }).keyCode === 229;
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) { e.preventDefault(); handleSend(); }
    // Esc while generating stops the stream — mirrors ChatGPT/Claude.
    // Esc while typing clears the textarea (only when there's content).
    if (e.key === 'Escape') {
      if (isTyping) {
        e.preventDefault();
        stopGenerating();
      } else if (input.length > 0) {
        e.preventDefault();
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    }
  };

  // ── Composer file ingestion ─────────────────────────────────────────────────
  // Shared by paste (Cmd+V with files in clipboard) and drag-and-drop. Cap at
  // 8 attached files so we don't choke the chip row or blow past mock limits.
  // Char counter — soft cap (warn) and hard cap (block send / truncate paste).
  // Hoisted above ingestFiles/handleComposerPaste so paste can validate length.
  const MAX_INPUT_CHARS = 4000;
  const WARN_INPUT_CHARS = 3000;
  const MAX_FILES = 8;
  const ingestFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const list = Array.from(incoming);
    if (list.length === 0) return;
    setFiles(prev => {
      const available = MAX_FILES - prev.length;
      if (available <= 0) {
        addToast({ type: 'info', message: `Attachment limit reached (${MAX_FILES} files).` });
        return prev;
      }
      const accepted = list.slice(0, available);
      if (list.length > accepted.length) {
        addToast({ type: 'info', message: `Attached ${accepted.length} of ${list.length}. Limit is ${MAX_FILES}.` });
      } else {
        addToast({ type: 'success', message: `Attached ${accepted.length} ${accepted.length === 1 ? 'file' : 'files'}.` });
      }
      return [...prev, ...accepted];
    });
  };

  const handleComposerPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const cb = e.clipboardData;
    if (cb?.files && cb.files.length > 0) {
      e.preventDefault();
      ingestFiles(cb.files);
      return;
    }
    // Truncate text pastes that would push the input past the hard limit, so
    // a 10k-char paste doesn't silently overrun the counter cap. The textarea
    // has maxLength=MAX_INPUT_CHARS+200 (slack), but a single paste can still
    // exceed that; intercept and clip.
    const pasted = cb?.getData('text');
    if (!pasted) return;
    const room = MAX_INPUT_CHARS - input.length;
    if (pasted.length > room) {
      e.preventDefault();
      const accepted = room > 0 ? pasted.slice(0, room) : '';
      const next = input + accepted;
      setInput(next);
      // Restore caret to the end after React commits.
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.selectionStart = ta.selectionEnd = next.length;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 240) + 'px';
      });
      addToast({
        type: 'info',
        message: room > 0
          ? `Trimmed paste to the ${MAX_INPUT_CHARS.toLocaleString()}-character limit.`
          : `Message is already at the ${MAX_INPUT_CHARS.toLocaleString()}-character limit.`,
      });
    }
  };

  // Drag-and-drop state lives at the wrapper level. Use a counter for enter /
  // leave so child elements bubbling up don't toggle the highlight on/off
  // (the classic "drag over a child fires dragleave on parent" gotcha).
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    ingestFiles(e.dataTransfer.files);
  };

  // Char counter — MAX_INPUT_CHARS / WARN_INPUT_CHARS hoisted above for paste use.
  const inputCount = input.length;
  const overLimit = inputCount > MAX_INPUT_CHARS;

  // ── Message-level actions (Copy / Retry / Feedback) ────────────────────────
  // Bound to the hover-revealed action bar under each assistant text message.

  // Tracks which assistant message just got "Copied" so the icon flashes a
  // check briefly. Keyed by message id so multiple copies stay independent.
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  // Tracks 👍 / 👎 selection per message. Mock-only — no backend persistence.
  const [feedbackByMsgId, setFeedbackByMsgId] = useState<Record<string, 'up' | 'down'>>({});

  // Which "What next?" card the user picked for each assistant message — so the
  // selected card stays highlighted in the conversation history after the click
  // (instead of vanishing because the message is no longer the latest).
  const [selectedFollowUpByMsgId, setSelectedFollowUpByMsgId] = useState<Record<string, string>>({});

  // User-message bookmarks — persisted to localStorage and surfaced in
  // Recents · Favourites. Hydrate the in-memory Set from storage on mount so
  // the bookmark icon state is correct when a previously-bookmarked thread
  // is reopened.
  const [bookmarkedMsgIds, setBookmarkedMsgIds] = useState<Set<string>>(() => {
    return new Set(readBookmarkedMessages().map(b => b.msgId));
  });
  // Cross-component sync: another surface (Recents) may remove a bookmark.
  // Listen for our custom event + the native storage event (other tabs).
  useEffect(() => {
    const rehydrate = () => {
      setBookmarkedMsgIds(new Set(readBookmarkedMessages().map(b => b.msgId)));
    };
    window.addEventListener('chat-bookmarks-updated', rehydrate);
    window.addEventListener('storage', rehydrate);
    return () => {
      window.removeEventListener('chat-bookmarks-updated', rehydrate);
      window.removeEventListener('storage', rehydrate);
    };
  }, []);

  // Inline edit of a user message: the bubble itself becomes editable; on
  // save, the message is updated in place, everything after it is dropped,
  // and a fresh assistant response is regenerated. Cancel restores the
  // original. (ChatGPT / Claude pattern.)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const startEditingMessage = useCallback((msgId: string, text: string) => {
    setEditingMsgId(msgId);
    setEditingDraft(text);
  }, []);
  const cancelEditingMessage = useCallback(() => {
    setEditingMsgId(null);
    setEditingDraft('');
  }, []);
  const saveEditingMessage = useCallback(() => {
    if (!editingMsgId) return;
    const trimmed = editingDraft.trim();
    if (!trimmed) return;
    const idx = messages.findIndex(m => m.id === editingMsgId);
    if (idx === -1) return;
    const original = messages[idx];
    if (original.role !== 'user') return;
    const wasUnchanged = original.text === trimmed;

    // Exit edit mode first so the regular bubble renders the new text
    // immediately when React commits the next batch.
    setEditingMsgId(null);
    setEditingDraft('');

    // Update the user message text + trim everything after it. The previous
    // assistant reply is stale once the question changed, so we drop it.
    setMessages(prev => {
      const next = prev.slice(0, idx + 1);
      next[idx] = { ...next[idx], text: trimmed, timestamp: new Date() };
      return next;
    });

    if (wasUnchanged) return;

    // Reset any flow flags left over from the previous response so
    // simulateResponse can't be short-circuited by stale state
    // (e.g. workflowBuildPhase=3 → openCanvasAfterConfirmation).
    clearTimers();
    setIsTyping(false);
    setThinkingSteps([]);
    setShowClarificationCard(false);
    setShowProgressiveLoader(false);
    setWorkflowBuildPhase(0);
    activeQueryFlowRef.current = null;
    auditRunMsgIdRef.current = null;

    processingRef.current = true;
    simulateResponse(trimmed, buildWorkflowMode ? undefined : 'query');
    setTimeout(() => { processingRef.current = false; }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMsgId, editingDraft, messages, buildWorkflowMode]);

  // Inline-editable chat title — double-click toggles edit mode (matches the
  // Claude UX). `chatTitleOverride` persists the renamed value for this session
  // (mock-only — no backend). Reset via resetChat() so a new chat goes back to
  // the derived title from the first user message.
  const [editingTitle, setEditingTitle] = useState(false);
  const [chatTitleOverride, setChatTitleOverride] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const copyMessage = useCallback(async (msg: ChatMessage) => {
    // For plain text, copy the body. For audit-result, copy a KPI summary so
    // pasting into Slack/email gives a useful one-liner.
    let payload = msg.text || '';
    if (!payload && msg.richType === 'audit-result') {
      payload = AUDIT_RESULT.kpis.map(k => `${k.label}: ${k.value}`).join(' · ');
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedMsgId(msg.id);
      setTimeout(() => setCopiedMsgId(prev => (prev === msg.id ? null : prev)), 1500);
    } catch {
      addToast({ message: 'Could not copy to clipboard', type: 'error' });
    }
  }, [addToast]);

  const retryFromMessage = useCallback((msgIdx: number) => {
    if (processingRef.current) return;
    // Walk back to find the user query that produced this assistant message.
    let userIdx = -1;
    for (let i = msgIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { userIdx = i; break; }
    }
    if (userIdx === -1) return;
    const userText = messages[userIdx].text;
    processingRef.current = true;
    // Drop the previous assistant turn(s) and re-simulate from the same query.
    setMessages(prev => prev.slice(0, userIdx + 1));
    simulateResponse(userText, buildWorkflowMode ? undefined : 'query');
    setTimeout(() => { processingRef.current = false; }, 2000);
  }, [messages, buildWorkflowMode]);

  const setFeedback = useCallback((msgId: string, kind: 'up' | 'down') => {
    setFeedbackByMsgId(prev => {
      const current = prev[msgId];
      if (current === kind) {
        const { [msgId]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [msgId]: kind };
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  // Picker → composer: source picks become labelled chips; fresh uploads
  // become a stub File so the existing `files` chip rendering picks them up.
  const handleDataPickerConfirm = (selections: AttachmentSelection[]) => {
    // Exhaustive over AttachmentSelection.kind. 'connect-db' is a Knowledge Hub-
    // only variant and unreachable here (chat opens the picker without `mode`,
    // so the Connect tab isn't rendered) — narrowing it explicitly keeps the
    // type contract honest if the picker is ever embedded differently.
    const sources:  Extract<AttachmentSelection, { kind: 'source' }>[] = [];
    const uploads:  Extract<AttachmentSelection, { kind: 'upload' }>[] = [];
    for (const s of selections) {
      switch (s.kind) {
        case 'source':     sources.push(s);  break;
        case 'upload':     uploads.push(s);  break;
        case 'connect-db': /* not reachable in chat mode; intentionally ignored */ break;
      }
    }
    if (sources.length > 0) setAttachedSources(prev => [...prev, ...sources]);
    if (uploads.length > 0) {
      const stubFiles = uploads.map(u => new File([''], u.name, { type: 'application/octet-stream' }));
      setFiles(prev => [...prev, ...stubFiles]);
    }
    setShowDataPicker(false);
    addToast({ type: 'success', message: `Attached ${selections.length} ${selections.length === 1 ? 'item' : 'items'}.` });
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Cap matches the textarea's max-h-[240px] visual cap. Past this the
      // textarea internally scrolls instead of pushing the chat composer
      // off-screen.
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 240) + 'px';
    }
  };

  const isEmpty = messages.length === 0;

  // Derive a chat title from the first user message — truncated for the top bar.
  // User can override via double-click-to-edit (mock-only — no backend persist).
  const firstUserMessage = messages.find(m => m.role === 'user')?.text?.trim() ?? '';
  const derivedChatTitle = firstUserMessage.length > 60
    ? firstUserMessage.slice(0, 57).trimEnd() + '…'
    : firstUserMessage || 'New chat';
  const currentChatTitle = chatTitleOverride ?? derivedChatTitle;

  // Bookmark toggle — writes through to localStorage so the message lands in
  // Recents · Favourites (or removes it). Defined after currentChatTitle so
  // it can stash a fresh title with each new bookmark.
  const toggleBookmark = useCallback((msgId: string, text: string) => {
    const existing = readBookmarkedMessages();
    const isBookmarked = existing.some(b => b.msgId === msgId);
    let next: BookmarkedMessage[];
    if (isBookmarked) {
      next = existing.filter(b => b.msgId !== msgId);
      addToast({ type: 'info', message: 'Removed from bookmarks.' });
    } else {
      next = [
        ...existing,
        {
          msgId,
          chatId: selectedChatId ?? null,
          chatTitle: currentChatTitle,
          text,
          timestamp: new Date().toISOString(),
        },
      ];
      addToast({ type: 'success', message: 'Bookmarked. Find it in Recents · Favourites.' });
    }
    writeBookmarkedMessages(next);
    setBookmarkedMsgIds(new Set(next.map(b => b.msgId)));
  }, [addToast, selectedChatId, currentChatTitle]);

  // Most-recent open clarification — drives the docked picker at the bottom of the chat.
  const openClarification = [...messages].reverse().find(
    m => m.richType === 'clarification' && (m.richData as unknown as ClarificationData)?.status === 'open'
  );

  /* ────────────────────── CHAT HISTORY SIDEBAR ────────────────────── */
  const chatHistoryPanel = (
    <AnimatePresence>
      {showChatHistory && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full bg-white border-r border-border-light overflow-hidden shrink-0"
        >
          <div className="p-4 border-b border-border-light flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Chat History</h3>
            <button onClick={toggleChatHistory} className="text-text-muted hover:text-text-secondary p-1 rounded-md hover:bg-brand-50 cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="p-3">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-text-secondary font-medium hover:bg-brand-50 hover:text-text transition-colors cursor-pointer">
              <Plus size={14} />
              New Chat
            </button>
          </div>
          <div className="overflow-y-auto flex-1" style={{ height: 'calc(100% - 150px)' }}>
            {CHAT_HISTORY.map(chat => (
              <button
                key={chat.id}
                className="w-full text-left px-4 py-3 border-b border-border-light hover:bg-brand-50 transition-colors group cursor-pointer"
                onClick={() => loadChatById(chat.id)}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare size={12} className="text-text-muted" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text truncate transition-colors">{chat.title}</div>
                    <div className="text-[12px] text-text-muted truncate mt-0.5">{chat.preview}</div>
                    <div className="text-[12px] text-text-muted/60 mt-1">{chat.timestamp}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Slide-out is a quick switcher for the last 5; canonical browser is /recents. */}
          {setView && (
            <div className="border-t border-border-light p-3">
              <button
                onClick={() => { toggleChatHistory(); setView('recents'); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-text hover:bg-brand-50 transition-colors cursor-pointer"
              >
                Browse all in Recents
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ────────────────────── EMPTY STATE ────────────────────── */
  if (isEmpty) {
    return (
      <>
      <div className="flex h-full w-full">
        {chatHistoryPanel}

        <div className="flex-1 min-w-0 h-full flex flex-col bg-hero-pattern bg-grid-subtle relative" style={{ background: 'var(--color-canvas)' }}>
          <FloatingLines
            enabledWaves={['top', 'middle', 'bottom']}
            lineCount={5}
            lineDistance={5}
            bendRadius={5}
            bendStrength={-0.5}
            interactive={true}
            parallax={true}
            color="#6a12cd"
            opacity={0.06}
          />

          <div className="relative z-10 flex justify-between px-5 py-3">
            <button onClick={toggleChatHistory} className="p-2.5 text-text-muted hover:text-text-secondary hover:bg-brand-50 rounded-lg transition-colors cursor-pointer" aria-label="Chat History">
              <History size={18} />
            </button>
            <button className="p-2.5 text-text-muted hover:text-text-secondary hover:bg-brand-50 rounded-lg transition-colors cursor-pointer" aria-label="New Chat">
              <Plus size={18} />
            </button>
          </div>

          {pendingDashboard && (
            <div className="shrink-0 mx-5 mb-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-xl border border-brand-200 flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-brand-600 flex items-center justify-center">
                  <BarChart3 size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-brand-900">Creating: {pendingDashboard.name}</p>
                  <p className="text-[11px] text-brand-600">Run a query, then add results to your dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const mockFields = ['Date', 'Region', 'Category', 'Vendor Name', 'Invoice Amount (₹)', 'Status', 'Department', 'Quantity'];
                    onAddToDashboard?.(mockFields);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <BarChart3 size={12} />
                  Add to Dashboard
                </button>
                <button
                  onClick={onDismissPendingDashboard}
                  className="p-1 rounded-md text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 flex justify-center items-center overflow-auto px-6 pb-[60px]">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
              className="w-[720px] max-w-full text-center"
            >
              <div className="mb-4">
                <AuditifyHelloEffect
                  className="text-primary h-14 mx-auto"
                  speed={0.7}
                />
              </div>

              <h1 className="text-[34px] font-medium tracking-[-0.02em] mb-2 text-ink-900/85">
                Audit smarter.{' '}
                <TextShimmer as="span" className="font-bold" duration={3} spread={2}>
                  Not harder.
                </TextShimmer>
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5, duration: 0.6 }}
                className="text-[15px] text-text-muted mb-10"
              >
                Your AI copilot already knows what to look for. Just ask.
              </motion.p>

              <div
                className="ai-border relative mb-6"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Drop overlay — only renders during an active file drag. */}
                {isDragging && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 z-20 flex items-center justify-center rounded-[1.5rem] bg-brand-50/85 border-2 border-dashed border-brand-300 pointer-events-none"
                  >
                    <div className="flex items-center gap-2 text-[13px] font-medium text-brand-700">
                      <Paperclip size={14} />
                      <span>Drop to attach</span>
                    </div>
                  </div>
                )}

                {/* Attachment chips — picked sources + fresh uploads. */}
                {(files.length > 0 || attachedSources.length > 0) && (
                  <div className="composer-chips-row flex items-center gap-1.5 overflow-x-auto px-4 pt-3 pb-1 text-left">
                    {attachedSources.map((s, i) => (
                      s.kind === 'source' && (
                        <div key={`src-${i}`} title={s.name} className="flex items-center gap-1 bg-brand-50 text-ink-700 text-xs px-2 py-1 rounded-md font-medium border border-canvas-border shrink-0">
                          <span className="text-[10px] uppercase font-bold tracking-[0.06em] text-ink-400">{s.type === 'database' ? 'DB' : s.type === 'api' ? 'API' : s.type === 'cloud' ? 'CLOUD' : s.type === 'session' ? 'SESS' : 'FILE'}</span>
                          <span className="truncate max-w-[10rem]">{s.name}</span>
                          <button
                            type="button"
                            onClick={() => setAttachedSources(prev => prev.filter((_, j) => j !== i))}
                            className="text-ink-400 hover:text-ink-700 ml-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm"
                            aria-label={`Remove ${s.name}`}
                          ><X size={12} /></button>
                        </div>
                      )
                    ))}
                    {files.map((f, i) => (
                      <div key={`file-${i}`} title={f.name} className="flex items-center gap-1 bg-brand-50 text-ink-700 text-xs px-2 py-1 rounded-md font-medium border border-canvas-border shrink-0">
                        <FileText size={12} className="text-ink-400" />
                        <span className="truncate max-w-[6.25rem]">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-ink-400 hover:text-ink-700 ml-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm"
                          aria-label={`Remove ${f.name}`}
                        ><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Textarea — empty-state slightly taller than the in-chat
                    composer (60px vs 44px) because this is the hero entry
                    point and the surface should feel inviting. 15px body
                    line-height 1.5 for cozy single-line, grows to 240px. */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); handleTextareaInput(); }}
                  onKeyDown={handleKeyDown}
                  onPaste={handleComposerPaste}
                  placeholder={buildWorkflowMode ? 'Describe the workflow you want to build…' : 'Ask a question or run a query…'}
                  aria-label="Message IRA"
                  maxLength={MAX_INPUT_CHARS + 200}
                  className="no-focus-ring w-full bg-transparent border-none outline-none resize-none px-5 pt-5 pb-1 text-[15px] leading-[1.5] text-ink-800 placeholder:text-ink-400 min-h-[60px] max-h-[240px] text-left"
                  rows={1}
                />

                {/* Action row — attach + mode toggle on the left, char counter
                    + primary CTA on the right. The primary CTA carries a
                    text label here (vs icon-only in the in-chat composer)
                    because this is the first-time-user surface and the verb
                    should be explicit. */}
                <div className="flex items-center justify-between gap-2 px-3 pb-3">
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="md"
                      iconOnly
                      onClick={() => setShowDataPicker(true)}
                      aria-label="Attach data sources or files"
                      title="Attach data or files"
                    >
                      <Plus size={16} />
                    </Button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={buildWorkflowMode}
                      aria-label="Build a workflow"
                      title={buildWorkflowMode ? 'Workflow mode (click for query)' : 'Query mode (click for workflow)'}
                      onClick={() => setBuildWorkflowMode(v => !v)}
                      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        buildWorkflowMode
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-500 hover:bg-brand-50 hover:text-ink-800'
                      }`}
                    >
                      <Workflow size={12} className={buildWorkflowMode ? 'text-brand-600' : 'text-ink-400'} />
                      Build a workflow
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {inputCount >= WARN_INPUT_CHARS && (
                      <span
                        aria-live="polite"
                        className={`text-[11px] tabular-nums font-medium ${overLimit ? 'text-risk' : 'text-mitigated-700'}`}
                      >
                        {inputCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
                      </span>
                    )}
                    <Button
                      variant="primary"
                      size="md"
                      shape="lg"
                      leftIcon={buildWorkflowMode ? <Workflow size={14} /> : <Send size={14} />}
                      onClick={handleSend}
                      disabled={(!input.trim() && files.length === 0 && attachedSources.length === 0) || overLimit}
                      aria-label={overLimit ? `Message too long (${inputCount.toLocaleString()} / ${MAX_INPUT_CHARS.toLocaleString()} max)` : (buildWorkflowMode ? 'Build workflow' : 'Run a query')}
                      title={overLimit ? 'Message too long' : 'Enter to send · Shift+Enter for new line'}
                    >
                      {buildWorkflowMode ? 'Build workflow' : 'Run a query'}
                    </Button>
                  </div>
                </div>
              </div>

            </motion.div>
          </div>
        </div>
      </div>
        {/* Modals must mount in this branch too — empty state is the most likely
            place a user opens the data picker (before sending the first message). */}
        <DataPickerModal
          open={showDataPicker}
          onClose={() => setShowDataPicker(false)}
          onConfirm={handleDataPickerConfirm}
        />
      </>
    );
  }

  /* ────────────────────── MESSAGES STATE ────────────────────── */
  return (
    <div className="flex h-full w-full" style={{ flex: '1 1 0%', minWidth: 0 }}>
      {chatHistoryPanel}
      <div
        className="flex flex-col h-full bg-hero-pattern bg-grid-subtle"
        style={{ flex: '1 1 0%', minWidth: 0, background: 'var(--color-canvas)' }}
      >
        {/* Claude-style header — title + chevron on left (opens chat history),
            separate icon buttons on the right (no merged chip background). */}
        <header className="h-10 shrink-0 flex items-center justify-between px-4 sm:px-6">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              autoFocus
              defaultValue={currentChatTitle === 'New chat' ? '' : currentChatTitle}
              placeholder="Rename chat"
              onBlur={(e) => {
                const v = e.target.value.trim();
                setChatTitleOverride(v ? v : null);
                setEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingTitle(false);
                }
              }}
              className="max-w-[60%] text-[16px] font-semibold tracking-tight text-ink-900 bg-white border border-brand-200 rounded-md px-2 py-1 -mx-2 outline-none focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <button
              onClick={toggleChatHistory}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
              title="Click for history · Double-click to rename"
              aria-label="Chat history"
              className="flex items-center gap-1.5 max-w-[60%] text-[16px] font-semibold tracking-tight text-ink-900 hover:bg-brand-50 rounded-md px-2 py-1 -mx-2 transition-colors cursor-pointer"
            >
              <span className="truncate">{currentChatTitle || 'New chat'}</span>
              <History size={14} className="text-ink-500 shrink-0" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              shape="md"
              pressed={showArtifacts}
              onClick={() => setShowArtifacts(!showArtifacts)}
              title={showArtifacts ? 'Close Workspace' : 'Open Workspace'}
              aria-label={showArtifacts ? 'Close Workspace' : 'Open Workspace'}
            >
              <FileText size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              shape="md"
              onClick={resetChat}
              title="New chat"
              aria-label="New chat"
            >
              <Plus size={14} />
            </Button>
          </div>
        </header>

        {/* Pending Dashboard Banner */}
        {pendingDashboard && (
          <div className="shrink-0 px-4 py-2.5 bg-brand-50 border-b border-border-light flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-ink-900 flex items-center justify-center">
                <BarChart3 size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">Creating: {pendingDashboard.name}</p>
                <p className="text-xs text-text-muted">Run a query, then add results to your dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<BarChart3 size={12} />}
                onClick={() => {
                  const mockFields = ['Date', 'Region', 'Category', 'Vendor Name', 'Invoice Amount (₹)', 'Status', 'Department', 'Quantity'];
                  onAddToDashboard?.(mockFields);
                }}
              >
                Add to Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onDismissPendingDashboard}
                aria-label="Dismiss"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* Messages — relative wrapper so scroll-to-bottom pill anchors to
            the viewport edge rather than the scrolling content. */}
        <div className="flex-1 min-h-0 relative">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          // role=log + aria-live=polite so screen readers announce new
          // assistant messages as the conversation grows. aria-atomic=false
          // means each new node is read on its own, not the whole transcript.
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions"
          aria-label="Chat conversation"
          className="h-full overflow-y-auto [scrollbar-gutter:stable]"
        >
          <div className={`max-w-[45rem] mx-auto w-full px-4 sm:px-6 pb-8 space-y-6 ${pendingDashboard ? 'pt-4' : 'pt-8'}`}>
            <AnimatePresence initial={false}>
              {messages.map((msg, msgIdx) => (
                <motion.div
                  key={msg.id}
                  data-msg-id={msg.id}
                  data-rich-type={msg.richType ?? undefined}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={msg.role === 'user' ? 'flex flex-col items-end w-fit max-w-[85%] ml-auto' : 'w-full'}>
                    {/* Single thinking trail per IRA message */}
                    {msg.role === 'assistant' && msg.thinking && msg.thinking.length > 0 && (
                      <ThinkingTrail
                        summary={
                          msg.richType === 'clarification'
                            ? ((msg.richData as unknown as ClarificationData)?.purpose === 'save-workflow'
                                ? 'Confirming tolerances and threshold before saving'
                                : 'Asking a few clarifying questions')
                            : msg.richType === 'audit-loading' ? 'Running through plan → SQL → sources → results' :
                          msg.richType === 'audit-result' ? 'Ran through plan → SQL → sources → results' :
                          `Reasoned in ${msg.thinking.length} steps`
                        }
                        steps={msg.thinking}
                      />
                    )}

                    {/* IRA mark — single brand dot replaces the old uppercase
                        ALL-CAPS byline. Identity stays, chrome dies. */}
                    {msg.role === 'assistant' && (msg.text || msg.richType) && (
                      <div className="size-1.5 rounded-full bg-primary mb-2" aria-label="IRA" />
                    )}

                    {/* Rich inline components */}
                    {msg.richType === 'clarification' ? (
                      <div className="max-w-[66ch]">
                        {(msg.richData as unknown as ClarificationData).status === 'submitted' ? (
                          <div className="text-[13px] text-ink-700 leading-relaxed">
                            {(msg.richData as unknown as ClarificationData).purpose === 'save-workflow'
                              ? 'Got it. Saving as workflow with these settings.'
                              : 'Got it. Running with these inputs.'}
                          </div>
                        ) : (
                          <div className="text-[15px] leading-[1.65] text-ink-800">
                            {(msg.richData as unknown as ClarificationData).intro}
                          </div>
                        )}
                      </div>
                    ) : msg.richType === 'qna-plan' ? (
                      // Workflow-mode plan-approve gate — Approve runs the audit,
                      // Revise drops the plan and returns control to the composer.
                      <div className="space-y-3 w-full">
                        {(msg.richData as { planText?: string })?.planText && (
                          <div className="text-[14px] leading-[1.6] text-ink-700">
                            {(msg.richData as { planText?: string }).planText}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleApprovePlan(msg.id)}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors cursor-pointer"
                          >
                            <CheckCircle size={13} /> Approve & run
                          </button>
                          <button
                            onClick={() => handleRevisePlan(msg.id)}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-canvas-elevated border border-canvas-border text-[12px] font-semibold text-ink-700 hover:border-brand-200 transition-colors cursor-pointer"
                          >
                            <Pencil size={12} /> Revise
                          </button>
                        </div>
                      </div>
                    ) : msg.richType === 'audit-loading' ? (
                      <div className="w-full">
                        {showProgressiveLoader && msg.id === auditRunMsgIdRef.current && (
                          <InlineAuditLoader
                            steps={LOADING_STEPS}
                            onTabSwitch={setActiveArtifactTab}
                            onComplete={handleProgressiveLoadingComplete}
                          />
                        )}
                      </div>
                    ) : msg.richType === 'audit-result' ? (
                      <div className="space-y-4 w-full">
                        {/* Body text */}
                        {msg.text && (
                          <div className="text-[15px] leading-[1.65] text-ink-800 max-w-[66ch]">{msg.text}</div>
                        )}

                        {/* Affordance: link inline result to the auto-opened panel.
                            Hidden when the panel is already open (the link would
                            no-op against itself and duplicates what's already
                            on screen). */}
                        {!showArtifacts && (
                          <button
                            onClick={() => setShowArtifacts(true)}
                            className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm"
                          >
                            <span>Plan, query, and sources are in the Workspace</span>
                            <ArrowUpRight size={12} />
                          </button>
                        )}

                        {/* KPI scoreboard — mirrors the dashboard widget grid:
                            4 separate glass-cards (rounded-xl, hairline border,
                            brand-200 hover) in a 2/4-col grid. Typography matches
                            DashboardView's KPI block exactly: 26px bold ink-900
                            value over an 11px uppercase tracking-wide label.
                            Same widget, same color, both surfaces. */}
                        {/* Evidence ledger — inline metrics, no cards.
                            Source Serif numerals + Inter labels, separated
                            by hairline vertical rules. Reads as the auditor's
                            scoreboard sitting in the prose, not as a hero-
                            metric template. Layout: 4 cells per row, wraps
                            to 2 rows on narrow widths. */}
                        <div
                          role="list"
                          aria-label="Key results"
                          className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 divide-x divide-canvas-border border-y border-canvas-border py-4"
                        >
                          {AUDIT_RESULT.kpis.slice(0, 8).map((kpi, ki) => (
                            <motion.div
                              key={kpi.label}
                              role="listitem"
                              aria-label={`${kpi.label}: ${kpi.value}`}
                              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                delay: prefersReducedMotion ? 0 : 0.1 + ki * 0.04,
                                duration: prefersReducedMotion ? 0 : 0.42,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className="px-4 first:pl-0 [&:nth-child(4n+1)]:sm:pl-0 [&:nth-child(odd)]:pl-0 sm:[&:nth-child(odd)]:pl-4"
                            >
                              <div
                                className="font-display text-[28px] leading-none tracking-tight text-ink-900 tabular-nums"
                                aria-hidden="true"
                              >
                                {kpi.value}
                              </div>
                              <div
                                className="mt-1.5 text-[12px] text-ink-500 leading-snug"
                                aria-hidden="true"
                              >
                                {kpi.label}
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Chart — clean white card sitting on the paper
                            canvas. Subtle hairline border, no shadow. The
                            ledger above carries the data, the chart adds
                            shape. */}
                        <section
                          aria-label="Audit result chart"
                          className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden"
                        >
                          <ChartGroup charts={AUDIT_RESULT.charts} embedded />
                        </section>

                        {/* Table preview */}
                        <ResultsTable
                          columns={AUDIT_RESULT.table.columns}
                          rows={AUDIT_RESULT.table.rows}
                          totalRows={AUDIT_RESULT.table.totalRows}
                          onOpen={() => addToast({ type: 'info', message: 'Opening full results in a new view…' })}
                          onDownload={() => addToast({ type: 'success', message: 'CSV download started.' })}
                        />

                        {/* Action bar — explicit row of actions per PRD action-bar spec.
                            All buttons share the same outline-default / pressed-linked
                            visual; Save-as-workflow is the only primary CTA. The
                            previous mix of brand-50 + violet-50 + red-600 hover
                            spread across this row read as 3+ palettes; this row
                            now sits firmly in the chat's send/receive two-tone. */}
                        <div className="flex items-center gap-2 pt-3 border-t border-canvas-border">
                          <Button
                            variant="outline"
                            size="md"
                            leftIcon={<Download size={14} />}
                            onClick={() => addToast({ type: 'success', message: 'CSV download started.' })}
                          >
                            Export
                          </Button>
                          {/* Dashboard button — pressed when one or more dashboards linked. */}
                          {(() => {
                            const dashLinks = msg.addedTo?.dashboards || [];
                            const hasDash = dashLinks.length > 0;
                            const dropKey = `${msg.id}:dashboard`;
                            const isOpen = openDropdown === dropKey;
                            return (
                              <div className="relative">
                                <Button
                                  variant="outline"
                                  size="md"
                                  pressed={hasDash}
                                  leftIcon={hasDash ? <CheckCircle size={14} /> : <BarChart3 size={14} />}
                                  rightIcon={hasDash ? <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /> : undefined}
                                  onClick={() => hasDash ? setOpenDropdown(isOpen ? null : dropKey) : handleAuditAction('dashboard', msg.id)}
                                >
                                  {hasDash
                                    ? dashLinks.length === 1
                                      ? `In "${dashLinks[0].name}"`
                                      : `In ${dashLinks.length} dashboards`
                                    : 'Add to dashboard'}
                                </Button>
                                {isOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                                    <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1 z-50 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-canvas-border py-1">
                                      {dashLinks.map(d => (
                                        <div key={d.id} className="px-3 py-1.5 flex items-center gap-2 text-xs text-text">
                                          <BarChart3 size={12} className="text-text-muted shrink-0" />
                                          <span className="flex-1 truncate font-medium">{d.name}</span>
                                          <button onClick={() => { onViewDashboard?.(d.id); setOpenDropdown(null); }} className="text-text-muted hover:text-text cursor-pointer" title="View">
                                            <ExternalLink size={12} />
                                          </button>
                                          <button onClick={() => { removeFromDashboard(msg.id, d.id); setOpenDropdown(null); }} className="text-text-muted hover:text-text cursor-pointer" title="Remove">
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="border-t border-canvas-border mt-1 pt-1">
                                        <button
                                          onClick={() => { setOpenDropdown(null); handleAuditAction('dashboard', msg.id); }}
                                          className="w-full px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-text hover:bg-brand-50 cursor-pointer"
                                        >
                                          <Plus size={12} /> Add to another
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          {/* Report button — same outline/pressed pattern as Dashboard. */}
                          {(() => {
                            const rptLinks = msg.addedTo?.reports || [];
                            const hasRpt = rptLinks.length > 0;
                            const dropKey = `${msg.id}:report`;
                            const isOpen = openDropdown === dropKey;
                            return (
                              <div className="relative">
                                <Button
                                  variant="outline"
                                  size="md"
                                  pressed={hasRpt}
                                  leftIcon={hasRpt ? <CheckCircle size={14} /> : <FileText size={14} />}
                                  rightIcon={hasRpt ? <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /> : undefined}
                                  onClick={() => hasRpt ? setOpenDropdown(isOpen ? null : dropKey) : handleAuditAction('report', msg.id)}
                                >
                                  {hasRpt
                                    ? rptLinks.length === 1
                                      ? `In "${rptLinks[0].name}"`
                                      : `In ${rptLinks.length} reports`
                                    : 'Add to report'}
                                </Button>
                                {isOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                                    <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1 z-50 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-canvas-border py-1">
                                      {rptLinks.map(r => (
                                        <div key={r.id} className="px-3 py-1.5 flex items-center gap-2 text-xs text-text">
                                          <FileText size={12} className="text-text-muted shrink-0" />
                                          <span className="flex-1 truncate font-medium">{r.name}</span>
                                          <button onClick={() => { onViewReport?.(r.id); setOpenDropdown(null); }} className="text-text-muted hover:text-text cursor-pointer" title="View">
                                            <ExternalLink size={12} />
                                          </button>
                                          <button onClick={() => { removeFromReport(msg.id, r.id); setOpenDropdown(null); }} className="text-text-muted hover:text-text cursor-pointer" title="Remove">
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="border-t border-canvas-border mt-1 pt-1">
                                        <button
                                          onClick={() => { setOpenDropdown(null); handleAuditAction('report', msg.id); }}
                                          className="w-full px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-text hover:bg-brand-50 cursor-pointer"
                                        >
                                          <Plus size={12} /> Add to another
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          <div className="ml-auto">
                            <Button
                              variant="primary"
                              size="md"
                              leftIcon={<Workflow size={14} />}
                              onClick={openSaveAsWorkflowModal}
                            >
                              Save as workflow
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : msg.richType === 'summary-kpi' ? (
                      <div className="grid grid-cols-4 gap-2">
                        {((msg.richData?.kpis as { label: string; value: string; color: string }[] | undefined) || []).map((kpi, ki) => (
                          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ki * 0.1 }}
                            className="rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-center"
                          >
                            <div className={`text-lg font-semibold tabular-nums ${kpi.color}`}>{kpi.value}</div>
                            <div className="text-[12px] text-ink-500 mt-0.5">{kpi.label}</div>
                          </motion.div>
                        ))}
                      </div>
                    ) : msg.richType === 'workflow-checkpoint' ? (
                      // Path 3 inline checkpoint: IRA asks which params to make
                      // configurable for the saved workflow. Multi-select chips,
                      // freeze on submit, then post a follow-up message.
                      (() => {
                        const data = msg.richData as {
                          intro: string;
                          options: { id: string; label: string; detail: string }[];
                          selected: string[];
                          status: 'open' | 'submitted';
                        };
                        return (
                          <div>
                            <div className="text-[15px] leading-[1.65] text-ink-800 max-w-[66ch]">
                              {data.intro.split('**').map((part, i) =>
                                i % 2 === 1 ? <strong key={i} className="font-semibold text-text">{part}</strong> : part
                              )}
                            </div>
                            {/* Cap the param grid so long lists scroll rather than
                                push Confirm off-screen. Only enables the cap when
                                there's actually enough content to overflow — short
                                lists keep their natural height. */}
                            <div
                              className={`mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[66ch]${
                                data.options.length > 8 ? ' max-h-[26rem] overflow-y-auto pr-1 [scrollbar-gutter:stable]' : ''
                              }`}
                            >
                              {data.options.map(opt => {
                                const isSelected = data.selected.includes(opt.id);
                                const disabled = data.status === 'submitted';
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => !disabled && toggleCheckpointParam(msg.id, opt.id)}
                                    disabled={disabled}
                                    className={`text-left rounded-xl border px-3 py-2.5 transition-all ${
                                      isSelected
                                        ? 'bg-primary-xlight border-primary text-primary'
                                        : 'bg-white border-border-light text-text hover:border-primary/40 hover:bg-brand-50'
                                    } ${disabled ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                        isSelected ? 'bg-primary border-primary' : 'bg-white border-border-light'
                                      }`}>
                                        {isSelected && <CheckCircle size={10} className="text-white" />}
                                      </div>
                                      <span className="text-[12.5px] font-semibold">{opt.label}</span>
                                    </div>
                                    <p className={`text-[11.5px] mt-1 ml-6 ${isSelected ? 'text-primary/80' : 'text-text-muted'}`}>{opt.detail}</p>
                                  </button>
                                );
                              })}
                            </div>
                            {data.status === 'open' ? (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  onClick={() => submitCheckpoint(msg.id)}
                                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors cursor-pointer"
                                >
                                  <CheckCircle size={13} /> Confirm parameters
                                </button>
                                <button
                                  onClick={() => submitCheckpoint(msg.id)}
                                  className="text-[12px] font-medium text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                                >
                                  Skip: keep all fixed
                                </button>
                              </div>
                            ) : (
                              <div className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-text-muted">
                                <CheckCircle size={12} className="text-primary" /> Parameters confirmed
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : msg.richType === 'save-workflow-prompt' ? (
                      <div className="mt-1">
                        <div className="glass-card rounded-xl p-4 border border-primary/10 max-w-md">
                          <div className="flex items-center gap-2 mb-2">
                            <Save size={13} className="text-primary" />
                            <span className="text-[12px] font-semibold text-text">Save Workflow</span>
                          </div>
                          <p className="text-[12px] text-text-muted mb-3">Ready to save this workflow to your library for recurring use?</p>
                          <div className="flex gap-2">
                            <SaveWorkflowButton />
                            <button className="px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text-secondary hover:bg-surface-2 rounded-lg transition-colors cursor-pointer">
                              Continue editing
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : msg.richType === 'error' ? (
                      // Terminal error state. Single icon + label (no side-stripe) per
                      // DESIGN.md alert-card scoping; the risk token names the kind,
                      // not the chrome. Retry pulls the original query from richData
                      // and re-runs the simulate path.
                      (() => {
                        const data = (msg.richData as { message?: string; retryQuery?: string }) || {};
                        return (
                          <div className="max-w-[66ch] rounded-lg border border-canvas-border bg-canvas-elevated p-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 size-6 rounded-md bg-risk/10 flex items-center justify-center shrink-0">
                                <X size={14} className="text-risk" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold text-ink-800">Couldn't finish that one</div>
                                <p className="mt-1 text-[13px] text-ink-600 leading-relaxed">
                                  {data.message || "Something went wrong on our end."}
                                </p>
                                {data.retryQuery && (
                                  <div className="mt-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      leftIcon={<RotateCcw size={12} />}
                                      onClick={() => {
                                        setMessages(prev => prev.filter(m => m.id !== msg.id));
                                        simulateResponse(data.retryQuery!, buildWorkflowMode ? undefined : 'query');
                                      }}
                                    >
                                      Try again
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : msg.text ? (
                      msg.role === 'user' ? (
                        // Purple pill — matches the reference (soft brand-xlight
                        // fill, brand-700 text, fully-rounded). Single-line
                        // messages read as a pill; longer ones become elongated
                        // capsules and still feel cohesive.
                        // Hover row beneath the bubble carries Edit / Copy /
                        // Bookmark + the timestamp. When edit is active for
                        // this message, the bubble becomes an in-place
                        // textarea with Save/Cancel — no composer trip.
                        editingMsgId === msg.id ? (
                          <InlineEditBubble
                            value={editingDraft}
                            onChange={setEditingDraft}
                            onSave={saveEditingMessage}
                            onCancel={cancelEditingMessage}
                          />
                        ) : (
                          <>
                            <div className="px-4 py-2.5 rounded-2xl bg-canvas-elevated text-ink-800 text-sm leading-relaxed max-w-[66ch] border border-canvas-border shadow-sm shadow-ink-900/[0.03]">
                              {msg.text}
                            </div>
                            {/* Hover-revealed footer: Edit / Copy / Bookmark
                                actions + the timestamp. Hidden by default
                                so the user bubble reads as a clean pill;
                                hover or keyboard-focus inside the message
                                wrapper reveals the whole row at once. */}
                            <div className="mt-1.5 flex items-center justify-end gap-1.5 text-xs text-text-muted opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  iconOnly
                                  onClick={() => startEditingMessage(msg.id, msg.text)}
                                  title="Edit message"
                                  aria-label="Edit message"
                                >
                                  <Pencil size={13} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  iconOnly
                                  onClick={() => copyMessage(msg)}
                                  title={copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                                  aria-label={copiedMsgId === msg.id ? 'Copied' : 'Copy message'}
                                >
                                  {copiedMsgId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  iconOnly
                                  pressed={bookmarkedMsgIds.has(msg.id)}
                                  onClick={() => toggleBookmark(msg.id, msg.text)}
                                  title={bookmarkedMsgIds.has(msg.id) ? 'Bookmarked, click to remove' : 'Bookmark'}
                                  aria-label={bookmarkedMsgIds.has(msg.id) ? 'Remove bookmark' : 'Bookmark message'}
                                >
                                  {bookmarkedMsgIds.has(msg.id) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                                </Button>
                              </div>
                              <span className="tabular-nums">{formatChatTime(msg.timestamp)}</span>
                            </div>
                          </>
                        )
                      ) : (
                        // Editorial: AI response is prose, not a bubble. No border, no shadow, no avatar gutter.
                        // 66ch cap per DESIGN.md "66ch Response Rule" so prose reads as conversation, not document.
                        <div className="text-base leading-[1.65] text-ink-800 max-w-[66ch]">
                          {msg.text}
                        </div>
                      )
                    ) : null}

                    {/* Stopped marker — JetBrains Mono meta line, no side-stripe.
                        Renders only on assistant messages whose generation was
                        halted by the user via Esc / Stop. */}
                    {msg.role === 'assistant' && msg.stopped && (
                      <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-500">
                        <Square size={10} className="text-ink-500" fill="currentColor" />
                        <span>Stopped</span>
                      </div>
                    )}

                    {/* Hover-revealed message actions — Copy / Retry / 👍 / 👎.
                        Renders on terminal assistant responses (plain text or
                        completed audit-result). Skipped for in-flight rich
                        types (clarification, audit-loading, save-prompt,
                        checkpoint, qna-plan) — those carry their own controls. */}
                    {msg.role === 'assistant' && (
                      (msg.text && !msg.richType) || msg.richType === 'audit-result' || msg.stopped
                    ) && (
                      <div className="mt-2 -ml-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          onClick={() => copyMessage(msg)}
                          title={copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                          aria-label={copiedMsgId === msg.id ? 'Copied' : 'Copy message'}
                        >
                          {copiedMsgId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          onClick={() => retryFromMessage(msgIdx)}
                          disabled={isTyping}
                          title="Retry"
                          aria-label="Retry response"
                        >
                          <RotateCcw size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          pressed={feedbackByMsgId[msg.id] === 'up'}
                          onClick={() => setFeedback(msg.id, 'up')}
                          title="Good response"
                          aria-label="Mark response as helpful"
                        >
                          <ThumbsUp size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          pressed={feedbackByMsgId[msg.id] === 'down'}
                          onClick={() => setFeedback(msg.id, 'down')}
                          title="Bad response"
                          aria-label="Mark response as unhelpful"
                        >
                          <ThumbsDown size={14} />
                        </Button>
                      </div>
                    )}

                    {/* Follow-up suggestions — single-column editorial
                        list. Each row is a verb-prefixed text link, no
                        cards, no borders, no shadows. Hover shifts the
                        ink color and slides the chevron. Reads as prose-
                        adjacent next steps, not as a UI panel. */}
                    {msg.role === 'assistant' && msg.followUps && msg.followUps.length > 0 && (
                      <motion.div
                        role="region"
                        aria-label="Follow-up suggestions"
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: prefersReducedMotion ? 0 : 0.3, duration: prefersReducedMotion ? 0 : 0.2 }}
                        className="mt-1"
                      >
                        <div className="text-[12px] text-ink-500 mb-2">What next?</div>
                        <ul role="list" className="divide-y divide-canvas-border/70 border-y border-canvas-border/70">
                          {msg.followUps.map((q, i) => {
                            const isSelected = selectedFollowUpByMsgId[msg.id] === q;
                            const { category } = classifyFollowUp(q);
                            return (
                              <motion.li
                                key={i}
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  delay: prefersReducedMotion ? 0 : 0.32 + i * 0.04,
                                  duration: prefersReducedMotion ? 0 : 0.3,
                                  ease: [0.16, 1, 0.3, 1],
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFollowUpByMsgId(prev => ({ ...prev, [msg.id]: q }));
                                    handleFollowUpClick(q);
                                  }}
                                  aria-pressed={isSelected}
                                  aria-label={`${category}: ${q}`}
                                  className={`group/row w-full flex items-baseline gap-3 text-left py-2.5 px-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm transition-colors duration-200 ${
                                    isSelected ? 'text-brand-700' : 'text-ink-800 hover:text-brand-700'
                                  }`}
                                >
                                  <span
                                    className={`shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] w-[88px] transition-colors duration-200 ${
                                      isSelected ? 'text-brand-500' : 'text-ink-400 group-hover/row:text-brand-500'
                                    }`}
                                    aria-hidden="true"
                                  >
                                    {category}
                                  </span>
                                  <span className="flex-1 text-[14px] leading-snug">{q}</span>
                                  <ArrowRight
                                    size={14}
                                    aria-hidden="true"
                                    className={`shrink-0 self-center transition-[opacity,transform,color] duration-200 ${
                                      isSelected
                                        ? 'opacity-100 text-brand-500 translate-x-0'
                                        : 'opacity-0 -translate-x-1 text-ink-400 group-hover/row:opacity-100 group-hover/row:translate-x-0 group-hover/row:text-brand-500'
                                    }`}
                                  />
                                </button>
                              </motion.li>
                            );
                          })}
                        </ul>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking animation */}
            {isTyping && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                className="flex justify-start"
              >
                <div className="w-full">
                  <div className="flex-1 min-w-0">
                    <div className="size-1.5 rounded-full bg-primary mb-2" aria-label="IRA" />
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-text">IRA</span>
                      <span className="text-xs text-text-muted">is thinking…</span>
                    </div>

                      {thinkingSteps.length > 0 && (
                        <div className="mb-2">
                          <div className="pl-3 border-l-2 border-primary/20 space-y-1">
                            {thinkingSteps.map((step, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-xs text-text-muted flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${i === thinkingSteps.length - 1 ? 'bg-primary' : 'bg-primary/30'}`} />
                                {step}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {thinkingSteps.length === 0 && (
                        <div className="inline-flex items-center gap-1.5 px-1 py-2">
                          <div className="flex gap-1.5 items-center h-5">
                            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-ink-300" />
                            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="w-1.5 h-1.5 rounded-full bg-ink-300" />
                            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="w-1.5 h-1.5 rounded-full bg-ink-300" />
                          </div>
                        </div>
                      )}

                      {/* Response-slot skeleton — three shimmer bars showing
                          where the assistant text will land. Gives the eye a
                          stable anchor instead of jumping when content arrives.
                          Pulse gated by motion-safe so reduced-motion users see a static placeholder. */}
                      <div className="space-y-2 max-w-[66ch] mt-1" aria-hidden="true">
                        <div className="h-3 w-[92%] rounded-md bg-brand-50 motion-safe:animate-pulse" />
                        <div className="h-3 w-[76%] rounded-md bg-brand-50 motion-safe:animate-pulse" style={{ animationDelay: '120ms' }} />
                        <div className="h-3 w-[60%] rounded-md bg-brand-50 motion-safe:animate-pulse" style={{ animationDelay: '240ms' }} />
                      </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Inline rich messages render the loader + clarification — no global panel */}
        </div>
          {/* Soft fade — the last message tucks under a faint gradient before
              the composer, so content slides under chrome rather than meeting
              it at a hard seam. Rendered FIRST so the scroll-to-bottom pill
              stacks above it. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-canvas to-transparent z-[1]" aria-hidden="true" />
          {/* Scroll-to-bottom pill — appears when the user has scrolled up
              more than 100px from the bottom. Click jumps back to the latest.
              z-20 keeps it above any rich result content (action bars,
              hover-action rows) so it never clips on overlap. */}
          <AnimatePresence>
            {showScrollToBottom && (
              <motion.button
                key="scroll-to-bottom"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                onClick={scrollToBottom}
                aria-label="Scroll to latest message"
                title="Scroll to latest"
                className="absolute left-1/2 -translate-x-1/2 bottom-5 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-canvas-elevated border border-canvas-border text-xs font-medium text-ink-600 shadow-md shadow-ink-900/[0.08] hover:bg-brand-50 hover:text-ink-800 hover:border-brand-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <ArrowDown size={14} />
                Latest
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Input area */}
        <div className="shrink-0 px-4 sm:px-6 pb-5 max-w-[45rem] mx-auto w-full">
          {/* Workflow clarification (legacy ClarificationCard kept for the workflow flow only) */}
          <AnimatePresence>
            {showClarificationCard && workflowBuildPhase > 0 && (
              <div className="mb-0">
                <ClarificationCard
                  questions={clarificationQuestions}
                  onComplete={handleClarificationCardComplete}
                  onSkipAll={() => {
                    setShowClarificationCard(false);
                    handleWorkflowClarificationComplete({});
                  }}
                />
              </div>
            )}
          </AnimatePresence>

          {openClarification ? (
            // Audit-query clarification — docked picker replaces the chat input until submitted/dismissed
            <ClarificationBlock
              data={openClarification.richData as unknown as ClarificationData}
              onAnswer={(qi, ans) => updateClarificationAnswer(openClarification.id, qi, ans)}
              onSubmit={() => submitClarification(openClarification.id)}
              onSkipAll={() => submitClarification(openClarification.id, true)}
              onSkipCurrent={(qi) => skipClarificationQuestion(openClarification.id, qi)}
            />
          ) : (
            <>
              {/* Locked Workflow-mode pill — appears once Path 3 has flipped the
                  thread. Non-clickable on purpose: PRD says toggle is irreversible
                  per thread. To do a query again, user starts + New chat. */}
              {lockedAsWorkflow && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-text text-xs font-semibold cursor-default select-none">
                    <Lock size={12} /> Workflow mode
                  </div>
                  <span className="text-xs text-text-muted">
                    Switched at save. Start a <button onClick={resetChat} className="underline hover:text-primary cursor-pointer">new chat</button> for a query.
                  </span>
                </div>
              )}
              <div
                className="ai-border relative"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Drop overlay — only renders during an active file drag.
                    Covers the entire composer with a brand-tinted veil + a
                    dashed border so the drop affordance reads at a glance. */}
                {isDragging && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 z-20 flex items-center justify-center rounded-[1.5rem] bg-brand-50/85 border-2 border-dashed border-brand-300 pointer-events-none"
                  >
                    <div className="flex items-center gap-2 text-[13px] font-medium text-brand-700">
                      <Paperclip size={14} />
                      <span>Drop to attach</span>
                    </div>
                  </div>
                )}

                <div className="rounded-[1.5rem]">
                  {/* Attachment chips — picked sources + fresh uploads. Single
                      horizontally-scrolling row inside the composer surface so
                      they read as part of the message you're composing, not
                      as a separate tray. */}
                  {(files.length > 0 || attachedSources.length > 0) && (
                    <div className="composer-chips-row flex items-center gap-1.5 overflow-x-auto px-3 pt-3 pb-1">
                      {attachedSources.map((s, i) => (
                        <div key={`src-${i}`} title={s.kind === 'source' ? s.name : undefined} className="flex items-center gap-1 bg-brand-50 text-ink-700 text-xs px-2 py-1 rounded-md font-medium border border-canvas-border shrink-0">
                          {s.kind === 'source' && (
                            <>
                              <span className="text-[10px] uppercase font-bold tracking-[0.06em] text-ink-400">{s.type === 'database' ? 'DB' : s.type === 'api' ? 'API' : s.type === 'cloud' ? 'CLOUD' : s.type === 'session' ? 'SESS' : 'FILE'}</span>
                              <span className="truncate max-w-[10rem]">{s.name}</span>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setAttachedSources(prev => prev.filter((_, j) => j !== i))}
                            className="text-ink-400 hover:text-ink-700 ml-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm"
                            aria-label={`Remove ${s.kind === 'source' ? s.name : 'attachment'}`}
                          ><X size={12} /></button>
                        </div>
                      ))}
                      {files.map((f, i) => (
                        <div key={`file-${i}`} title={f.name} className="flex items-center gap-1 bg-brand-50 text-ink-700 text-xs px-2 py-1 rounded-md font-medium border border-canvas-border shrink-0">
                          <FileText size={12} className="text-ink-400" />
                          <span className="truncate max-w-[6.25rem]">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                            className="text-ink-400 hover:text-ink-700 ml-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm"
                            aria-label={`Remove ${f.name}`}
                          ><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Textarea — 15px body, 1.5 line-height. Empty state stays
                      compact (44px min) so the composer doesn't read as a
                      half-empty room; grows to ~12 rows for multi-paragraph
                      drafts, then scrolls internally. */}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); handleTextareaInput(); }}
                    onKeyDown={handleKeyDown}
                    onPaste={handleComposerPaste}
                    placeholder={buildWorkflowMode ? 'Describe the workflow you want to build…' : 'Ask anything or run a query…'}
                    aria-label="Message IRA"
                    maxLength={MAX_INPUT_CHARS + 200}
                    className="no-focus-ring w-full bg-transparent border-none outline-none resize-none px-4 pt-3 pb-1 text-[15px] leading-[1.5] text-ink-800 placeholder:text-ink-400 min-h-[44px] max-h-[240px]"
                    rows={1}
                  />

                  {/* Action row — attach + mode toggle on the left;
                      char counter (only near the limit) + send/stop on the
                      right. The keyboard hint moved to the send button's
                      tooltip so the row reads quieter at rest. */}
                  <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="md"
                        iconOnly
                        onClick={() => setShowDataPicker(true)}
                        aria-label="Attach data sources or files"
                        title="Attach data or files"
                      >
                        <Paperclip size={15} />
                      </Button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={buildWorkflowMode}
                        aria-label="Build a workflow"
                        title={buildWorkflowMode ? 'Workflow mode (click for query)' : 'Query mode (click for workflow)'}
                        onClick={() => setBuildWorkflowMode(v => !v)}
                        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                          buildWorkflowMode
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-ink-500 hover:bg-brand-50 hover:text-ink-800'
                        }`}
                      >
                        <Workflow size={12} className={buildWorkflowMode ? 'text-brand-600' : 'text-ink-400'} />
                        Build a workflow
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Char counter — soft warn at 3000, red at 4000+. Only
                          surfaces when there's something worth surfacing. */}
                      {inputCount >= WARN_INPUT_CHARS && (
                        <span
                          aria-live="polite"
                          className={`text-[11px] tabular-nums font-medium ${
                            overLimit ? 'text-risk' : 'text-mitigated-700'
                          }`}
                        >
                          {inputCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
                        </span>
                      )}

                      {isTyping ? (
                        <Button
                          variant="stop"
                          size="md"
                          iconOnly
                          shape="full"
                          onClick={stopGenerating}
                          aria-label="Stop generating"
                          title="Stop generating (Esc)"
                        >
                          <Square size={13} fill="currentColor" />
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="md"
                          iconOnly
                          shape="full"
                          onClick={handleSend}
                          disabled={(!input.trim() && files.length === 0 && attachedSources.length === 0) || overLimit}
                          aria-label={overLimit ? `Message too long (${inputCount.toLocaleString()} / ${MAX_INPUT_CHARS.toLocaleString()} max)` : 'Send message'}
                          title={overLimit ? 'Message too long' : 'Send · Enter for send, Shift+Enter for new line'}
                        >
                          <Send size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save-as-Workflow modal — Path 3 commit step. Defaults pull from the
          tolerance/threshold answers captured in the pre-modal clarification
          so the prefilled name + description echo what the user just chose. */}
      <AnimatePresence>
        {showSaveAsWfModal && (() => {
          const cfg = saveWorkflowConfigRef.current;
          const dateShort = (cfg.date || '±3 days').replace(/\s*\(current\)\s*/i, '').trim();
          const amountShort = (cfg.amount || '±₹1,000').replace(/\s*\(current\)\s*/i, '').trim();
          const thresholdShort = (cfg.threshold || '≥90%').replace(/\s*\(current\)\s*/i, '').trim();
          const defaultName = `Duplicate Invoice Detection: Q1 ${dateShort}`;
          const defaultDescription = `Detects duplicate invoices in Q1 2026 with same vendor, ${amountShort} amount tolerance, and ${dateShort} date tolerance at ${thresholdShort} match threshold.`;
          return (
            <SaveAsWorkflowModal
              open={showSaveAsWfModal}
              defaultName={defaultName}
              defaultDescription={defaultDescription}
              onCancel={() => setShowSaveAsWfModal(false)}
              onConfirm={handleSaveAsWorkflowConfirm}
            />
          );
        })()}
      </AnimatePresence>

      {/* Data picker modal — attach existing sources or upload fresh files */}
      <DataPickerModal
        open={showDataPicker}
        onClose={() => setShowDataPicker(false)}
        onConfirm={handleDataPickerConfirm}
      />

      {/* Add to Dashboard modal */}
      <AddToDashboardModal
        open={showDashboardModal}
        onClose={() => { setShowDashboardModal(false); setActiveAddMsgId(null); }}
        dashboards={availableDashboards || []}
        alreadyAddedIds={activeAddMsgId ? (messages.find(m => m.id === activeAddMsgId)?.addedTo?.dashboards || []).map(d => d.id) : []}
        resultData={{
          kpis: AUDIT_RESULT.kpis,
          charts: AUDIT_RESULT.charts,
          table: { columns: AUDIT_RESULT.table.columns, rows: AUDIT_RESULT.table.rows },
        }}
        onConfirm={handleDashboardConfirm}
      />

      {/* Add to Report modal */}
      <AddToReportModal
        open={showReportModal}
        onClose={() => { setShowReportModal(false); setActiveAddMsgId(null); }}
        reports={availableReports || []}
        alreadyAddedIds={activeAddMsgId ? (messages.find(m => m.id === activeAddMsgId)?.addedTo?.reports || []).map(r => r.id) : []}
        resultData={{
          kpis: AUDIT_RESULT.kpis,
          charts: AUDIT_RESULT.charts,
          table: { columns: AUDIT_RESULT.table.columns, rows: AUDIT_RESULT.table.rows },
        }}
        onConfirm={handleReportConfirm}
      />
    </div>
  );
}
