import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  Send, Paperclip, Sparkles, History, X, FileText, FileSpreadsheet, PanelRightOpen, PanelRightClose,
  Workflow, BarChart3, PieChart, LineChart, ChevronDown, ChevronLeft, ChevronRight,
  MessageSquare, ArrowRight, Plus, Lightbulb,
  Save, CheckCircle, Maximize2, Lock, Calendar,
  ExternalLink, Download, MoreHorizontal, Pencil, CornerDownLeft, ArrowUpRight,
  Square, ArrowDown, ArrowUp, Copy, RotateCcw, ThumbsUp, ThumbsDown, Check,
  Bookmark, BookmarkCheck,
  Search, GitCompare, ShieldCheck, Info, Loader2, AlertTriangle, type LucideIcon,
} from 'lucide-react';
import { CHAT_HISTORY, CHAT_CONVERSATIONS, CLARIFICATION_STEPS, BUSINESS_PROCESSES, SOPS } from '../../data/mockData';
import {
  readBookmarkedMessages, writeBookmarkedMessages, type BookmarkedMessage,
} from '../../utils/bookmarkedMessages';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import { KpiTile } from '../shared/KpiTile';
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
// Workflow build runs inline inside this chat thread via rich-type messages.
import StepUploadFiles from '../concierge-workflow-builder/StepUploadFiles';
import StepMapData from '../concierge-workflow-builder/StepMapData';
import StepReviewRun from '../concierge-workflow-builder/StepReviewRun';
import StepOutputView from '../concierge-workflow-builder/StepOutputView';
import UploadDataModal from '../concierge-workflow-builder/UploadDataModal';
import SaveWorkflowModal from '../concierge-workflow-builder/SaveWorkflowModal';
import Stepper, { type JourneyStep } from '../concierge-workflow-builder/Stepper';
import { ToleranceAdjustCard, ViewPreviewCard, type ToleranceCardState } from '../concierge-workflow-builder/AIAssistantPanel';
import {
  generateWorkflow as wfGenerate,
  getClarifyQuestions as wfGetClarify,
  runWorkflow as wfRun,
  seedAlignments as wfSeedAlignments,
  tolerancePctFromAnswer,
} from '../concierge-workflow-builder/mockApi';
import type {
  WorkflowDraft,
  JourneyFiles,
  JourneyMappings,
  JourneyAlignments,
  RunResult,
  ClarifyQuestion,
  UploadedFile,
} from '../concierge-workflow-builder/types';

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
  richType?:
    | 'summary-kpi'
    | 'audit-result'
    | 'audit-loading'
    | 'clarification'
    | 'save-workflow-prompt'
    | 'workflow-checkpoint'
    | 'qna-plan'
    | 'error'
    // Workflow-build rich types — render inside this same chat thread,
    // not in a separate journey body. Driven by ChatView state.
    | 'workflow-clarify'
    | 'workflow-upload'
    | 'workflow-map'
    | 'workflow-review'
    | 'workflow-tolerance'
    | 'workflow-view-preview'
    | 'workflow-output';
  richData?: Record<string, unknown>;
  // Tracks which dashboards/reports this result was added to
  addedTo?: {
    dashboards?: { id: string; name: string }[];
    reports?: { id: string; name: string }[];
  };
  // Marks an assistant message whose generation was halted before completion.
  // Renders a "Stopped" badge under the message body.
  stopped?: boolean;
  // Conversation-branching history (user messages only). Each entry holds
  // a saved version of the message text PLUS the downstream messages that
  // followed it (assistant replies, follow-ups, etc.). Switching branches
  // swaps both the user text and the entire downstream conversation.
  branches?: { text: string; downstream: ChatMessage[] }[];
  branchIndex?: number;
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
      label: 'Findings by Confidence',
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
      label: 'Findings by Vendor',
      data: [
        { bucket: 'Acme Corp', count: 4, tone: 'bg-ink-800' },
        { bucket: 'Global Supplies', count: 2, tone: 'bg-ink-800/70' },
        { bucket: 'TechParts Ltd', count: 1, tone: 'bg-ink-800/50' },
        { bucket: 'FastShip Logistics', count: 1, tone: 'bg-ink-800/50' },
      ],
    },
    // High-data stress test: 12 monthly buckets with thousands-scale values
    // and long category labels. Confirms y-axis formatting + x-axis label
    // overflow handling under realistic enterprise data sizes.
    {
      id: 'monthly-high',
      label: 'Findings by Month',
      data: [
        { bucket: 'Jan 2026', count: 11_842, tone: 'bg-ink-800/70' },
        { bucket: 'Feb 2026', count: 9_405, tone: 'bg-ink-800/60' },
        { bucket: 'Mar 2026', count: 14_207, tone: 'bg-ink-800/80' },
        { bucket: 'Apr 2026', count: 12_661, tone: 'bg-ink-800/75' },
        { bucket: 'May 2026', count: 15_904, tone: 'bg-ink-800/85' },
        { bucket: 'Jun 2026', count: 17_532, tone: 'bg-ink-800/90' },
        { bucket: 'Jul 2026', count: 13_088, tone: 'bg-ink-800/75' },
        { bucket: 'Aug 2026', count: 8_270, tone: 'bg-ink-800/55' },
        { bucket: 'Sep 2026', count: 10_410, tone: 'bg-ink-800/65' },
        { bucket: 'Oct 2026', count: 16_741, tone: 'bg-ink-800/85' },
        { bucket: 'Nov 2026', count: 18_220, tone: 'bg-ink-800' },
        { bucket: 'Dec 2026', count: 21_350, tone: 'bg-ink-800' },
      ],
    },
    // Additional cuts of the same flagged-pair population. Together with the
    // first three this brings the chart count to 7, which trips the picker
    // from segmented control to dropdown (CHART_TAB_LIMIT = 4).
    {
      id: 'region',
      label: 'Findings by Region',
      data: [
        { bucket: 'India',  count: 6, tone: 'bg-ink-800'    },
        { bucket: 'UAE',    count: 4, tone: 'bg-ink-800/75' },
        { bucket: 'EMEA',   count: 3, tone: 'bg-ink-800/60' },
        { bucket: 'APAC',   count: 2, tone: 'bg-ink-800/45' },
      ],
    },
    {
      id: 'match-method',
      label: 'Findings by Match Method',
      data: [
        { bucket: 'Exact + ±2d',  count: 5, tone: 'bg-ink-800'    },
        { bucket: 'Fuzzy name',   count: 4, tone: 'bg-ink-800/75' },
        { bucket: 'Exact amount', count: 4, tone: 'bg-ink-800/70' },
        { bucket: 'Fuzzy + ±2d',  count: 2, tone: 'bg-ink-800/55' },
      ],
    },
    {
      id: 'status',
      label: 'Status Distribution',
      data: [
        { bucket: 'Open',      count: 10, tone: 'bg-ink-800'    },
        { bucket: 'In review', count: 3,  tone: 'bg-ink-800/65' },
        { bucket: 'Resolved',  count: 2,  tone: 'bg-ink-800/45' },
      ],
    },
    {
      id: 'amount-band',
      label: 'Findings by Amount Band',
      data: [
        { bucket: '< ₹50K',       count: 3, tone: 'bg-ink-800/50' },
        { bucket: '₹50K – ₹1L',   count: 5, tone: 'bg-ink-800/70' },
        { bucket: '₹1L – ₹2L',    count: 5, tone: 'bg-ink-800/85' },
        { bucket: '> ₹2L',         count: 2, tone: 'bg-ink-800'    },
      ],
    },
  ],
  table: {
    columns: ['Invoice A', 'Invoice B', 'Vendor', 'Amount', 'Date A', 'Date B', 'PO Ref', 'Match Method', 'Match %', 'Status'],
    rows: [
      ['INV-2024-8821', 'INV-2024-8847', 'Acme Corp',          '₹1,42,500', '2026-01-12', '2026-01-18', 'PO-AC-44102', 'Exact + ±2d',    '96%', 'Open'],
      ['INV-2024-8910', 'INV-2024-9001', 'Acme Corp',          '₹89,200',   '2026-02-03', '2026-02-09', 'PO-AC-44210', 'Fuzzy name',     '94%', 'Open'],
      ['INV-2024-9112', 'INV-2024-9183', 'Global Supplies',    '₹2,18,400', '2026-02-15', '2026-02-22', 'PO-GS-12044', 'Exact amount',   '92%', 'Open'],
      ['INV-2024-9245', 'INV-2024-9301', 'Acme Corp',          '₹54,000',   '2026-03-02', '2026-03-08', 'PO-AC-44318', 'Fuzzy + ±2d',    '91%', 'In review'],
      ['INV-2024-9377', 'INV-2024-9420', 'Global Supplies',    '₹76,800',   '2026-03-11', '2026-03-15', 'PO-GS-12099', 'Exact + ±2d',    '90%', 'Open'],
      ['INV-2024-9501', 'INV-2024-9544', 'TechParts Ltd',      '₹38,200',   '2026-03-22', '2026-03-29', 'PO-TP-08815', 'Fuzzy name',     '89%', 'Open'],
      ['INV-2024-9612', 'INV-2024-9655', 'FastShip Logistics', '₹1,02,400', '2026-04-01', '2026-04-07', 'PO-FS-22041', 'Exact amount',   '88%', 'In review'],
      ['INV-2024-9728', 'INV-2024-9760', 'Acme Corp',          '₹47,950',   '2026-04-09', '2026-04-14', 'PO-AC-44502', 'Fuzzy + ±2d',    '87%', 'Open'],
      ['INV-2024-9841', 'INV-2024-9879', 'Global Supplies',    '₹1,68,300', '2026-04-15', '2026-04-21', 'PO-GS-12188', 'Exact + ±5d',    '86%', 'Open'],
      ['INV-2024-9955', 'INV-2024-9998', 'TechParts Ltd',      '₹62,150',   '2026-04-22', '2026-04-28', 'PO-TP-08920', 'Fuzzy name',     '85%', 'In review'],
      ['INV-2025-0042', 'INV-2025-0089', 'Acme Corp',          '₹1,21,400', '2026-05-04', '2026-05-09', 'PO-AC-44612', 'Exact amount',   '84%', 'Open'],
      ['INV-2025-0155', 'INV-2025-0202', 'FastShip Logistics', '₹58,700',   '2026-05-12', '2026-05-18', 'PO-FS-22158', 'Fuzzy + ±2d',    '83%', 'Open'],
      ['INV-2025-0287', 'INV-2025-0334', 'Global Supplies',    '₹2,04,800', '2026-05-21', '2026-05-26', 'PO-GS-12257', 'Exact + ±2d',    '82%', 'Resolved'],
      ['INV-2025-0411', 'INV-2025-0456', 'Acme Corp',          '₹73,250',   '2026-06-02', '2026-06-07', 'PO-AC-44720', 'Fuzzy name',     '81%', 'Open'],
      ['INV-2025-0533', 'INV-2025-0579', 'TechParts Ltd',      '₹49,800',   '2026-06-10', '2026-06-16', 'PO-TP-09042', 'Exact + ±5d',    '80%', 'Resolved'],
    ],
    totalRows: 15,
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
  /** Pre-fill text dropped into the composer (no auto-submit). Used by the
   *  workspace panel's "Edit assumptions" affordance. */
  composerDraft?: string | null;
  onComposerDraftConsumed?: () => void;
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
   *
   * After the ChatView convergence this still exists but is wired to
   * `launchWorkflowBuilderWithPrompt`, which now routes to `view='chat'` +
   * `workflowBuilderSeedPrompt`. The journey renders embedded inside this
   * ChatView instance.
   */
  onLaunchWorkflowBuilder?: (prompt: string) => void;
  /**
   * Seed prompt for an inline workflow build. When non-null, ChatView
   * boots into workflow mode on first render and (if the seed is
   * non-empty) auto-starts a workflow-build thread with that prompt.
   * Empty string just pre-toggles Workflow mode on the empty-state pill.
   */
  workflowBuilderSeedPrompt?: string | null;
  /** Called once the seed prompt has been consumed; clears global state. */
  onWorkflowBuilderSeedConsumed?: () => void;
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
  // Map each chart id to a (type, xAxis) tuple the shared
  // ConfigurableChart understands. Palette inherits the brand purple
  // ramp so visuals are consistent across surfaces.
  const config: Record<string, { type: 'bar' | 'pie'; xAxis: string; showLegend: boolean }> = {
    confidence:     { type: 'bar', xAxis: 'Quarter',    showLegend: false },
    vendor:         { type: 'pie', xAxis: 'Department', showLegend: true  },
    'monthly-high': { type: 'bar', xAxis: 'Month',      showLegend: false },
    region:         { type: 'pie', xAxis: 'Region',     showLegend: true  },
    'match-method': { type: 'pie', xAxis: 'Method',     showLegend: true  },
    status:         { type: 'bar', xAxis: 'Status',     showLegend: false },
    'amount-band':  { type: 'bar', xAxis: 'Band',       showLegend: false },
  };
  const cfg = config[chart.id] ?? { type: 'bar' as const, xAxis: 'Quarter', showLegend: false };
  // Pie charts in the audit-result card: legend on top + inline labels +
  // bigger outer radius (75% vs the dashboard default 58%) so the circle
  // fills this taller card instead of floating in whitespace. Bar charts
  // already fill width naturally.
  const isPie = cfg.type === 'pie';
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ConfigurableChart
        type={cfg.type}
        xAxis={cfg.xAxis}
        showTarget={false}
        showLegend={cfg.showLegend}
        legendPosition={isPie ? 'top' : 'bottom'}
        showLabels={isPie}
        pieOuterRadius={isPie ? '75%' : undefined}
      />
    </div>
  );
}

// ─── ChartGroup with chip toggle + fullscreen ────────────────────────────────

// Threshold for switching the chart selector from segmented control to
// dropdown. Up to 4 charts → segmented (scannable). 5+ → dropdown so the
// header never overflows.
const CHART_TAB_LIMIT = 4;

// Icon by chart id — keep in sync with the `config` map in renderChart so
// the picker shows the right glyph for each chart's actual visual type.
function chartIcon(id: string) {
  if (id === 'vendor' || id === 'region' || id === 'match-method') return PieChart;
  return BarChart3;
}

function ChartGroup({ charts, embedded = false }: { charts: typeof AUDIT_RESULT.charts; embedded?: boolean }) {
  const [activeId, setActiveId] = useState(charts[0].id);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const active = charts.find(c => c.id === activeId) ?? charts[0];
  const useDropdown = charts.length > CHART_TAB_LIMIT;

  useEffect(() => {
    if (!selectorOpen) return;
    const onDoc = (e: MouseEvent) => {
      const r = selectorRef.current;
      if (r && !r.contains(e.target as Node)) setSelectorOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectorOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [selectorOpen]);

  return (
    <>
      <div className="group rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-[0_1px_2px_rgba(15,8,30,0.04)] transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.16)]">
        {/* Header — Claude-style layout in our theme:
              LEFT  → series legend (color dot + active chart name).
              RIGHT → bordered segmented control switching between
                      datasets, each tab carrying a chart-type icon so
                      the user knows what they're picking before
                      clicking. Expand sits at the far right. Padding
                      matches the table card (px-5 py-3.5). */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-canvas-border/70">
          <div className="min-w-0 flex items-center gap-2">
            <span className="size-2 rounded-sm bg-brand-600 shrink-0" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-ink-800 truncate">{active.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {charts.length > 1 && !useDropdown && (
              <div className="inline-flex items-center gap-1" role="tablist">
                {charts.map(c => {
                  const isActive = c.id === activeId;
                  const Icon = chartIcon(c.id);
                  return (
                    <button
                      key={c.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveId(c.id)}
                      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 border-brand-200'
                          : 'bg-canvas-elevated text-ink-700 border-canvas-border hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200'
                      }`}
                    >
                      <Icon size={13} className={isActive ? 'text-brand-600' : 'text-ink-400'} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Dropdown variant — used when there are more than CHART_TAB_LIMIT
                charts to keep the header from overflowing. */}
            {charts.length > 1 && useDropdown && (
              <div ref={selectorRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSelectorOpen(o => !o)}
                  aria-haspopup="menu"
                  aria-expanded={selectorOpen}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 max-w-[220px]"
                >
                  {(() => { const I = chartIcon(active.id); return <I size={13} className="text-brand-600 shrink-0" />; })()}
                  <span className="truncate">{active.label}</span>
                  <ChevronDown size={12} className={`text-brand-600 shrink-0 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {selectorOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_12px_28px_-12px_rgba(15,8,30,0.22)] overflow-hidden py-1 max-h-80 overflow-y-auto"
                  >
                    {charts.map(c => {
                      const isActive = c.id === activeId;
                      const Icon = chartIcon(c.id);
                      return (
                        <button
                          key={c.id}
                          role="menuitemradio"
                          aria-checked={isActive}
                          onClick={() => { setActiveId(c.id); setSelectorOpen(false); }}
                          title={c.label}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-left transition-colors cursor-pointer ${
                            isActive ? 'bg-brand-50/60 text-brand-700 font-medium' : 'text-ink-800 hover:bg-paper-50'
                          }`}
                        >
                          <Icon size={13} className={`shrink-0 ${isActive ? 'text-brand-600' : 'text-ink-500'}`} />
                          <span className="flex-1 min-w-0 truncate">{c.label}</span>
                          {isActive && <Check size={12} strokeWidth={3} className="text-brand-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setFullscreen(true)}
              className="inline-flex items-center justify-center size-8 rounded-lg text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Expand chart"
              title="Expand chart"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
        {/* Body — total height matches the table card's body + footer
            (390px body + 50px footer = 440px) so the two cards read as
            identical pairs when stacked. Height bumped from 370 → 440 so
            the pie chart's outer radius (58% of min(w,h)) grows from
            ~215px to ~255px diameter — visibly larger circle. */}
        <div className="px-5 py-4" style={{ height: 440 }}>{renderChart(active, 'inline')}</div>
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
        {/* Header — same layout as the embedded chart card: legend dot
            + active chart name on the left, bordered segmented control
            on the right, close X at the far right. */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border shrink-0">
          <div className="min-w-0 flex items-center gap-2">
            <span className="size-2 rounded-sm bg-brand-600 shrink-0" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-ink-800 truncate">{active.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {charts.length > 1 && (
              <div className="inline-flex items-center gap-1" role="tablist">
                {charts.map(c => {
                  const isActive = c.id === activeId;
                  const Icon = c.id === 'vendor' ? PieChart : BarChart3;
                  return (
                    <button
                      key={c.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => onActiveChange(c.id)}
                      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 border-brand-200'
                          : 'bg-canvas-elevated text-ink-700 border-canvas-border hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200'
                      }`}
                    >
                      <Icon size={13} className={isActive ? 'text-brand-600' : 'text-ink-400'} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center size-8 rounded-lg text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Close fullscreen"
            >
              <X size={16} />
            </button>
          </div>
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

// Number of preview rows shown inside the in-thread card. Tuned to fill
// the 390px body (matching the chart card body 440 - 50 footer) at the
// `py-2.5` row padding. Header (~34px) + 9 rows (~37px each) ≈ 367px →
// ~23px of natural bottom padding without empty whitespace dominating
// the card.
const PREVIEW_ROW_COUNT = 9;

function ResultsTable({
  columns, rows, totalRows, onOpen, onDownload,
}: {
  columns: string[];
  rows: string[][];
  totalRows: number;
  /** Caller can fire side-effects (toast) when the table is opened in a
   *  new tab. The fullscreen / expand path is handled locally. */
  onOpen: () => void;
  onDownload: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const openFullscreen = () => { setFullscreen(true); };

  // Standalone HTML page built from the data, opened in a fresh tab. Cells
  // are HTML-escaped so user data can never inject markup; the page styles
  // match the in-app table for visual continuity.
  const handleOpenInNewTab = () => {
    const esc = (s: string) => s.replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));
    // Mirror the in-app card dimensions: same max-width (52.5rem), same
    // rounded card chrome, same border + spacing tokens. Tab gets a clean
    // centered card on the off-white canvas, identical to the embedded
    // surface.
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flagged duplicate pairs · Auditify</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; --ink-900:#1a1124; --ink-800:#3a2f4a; --ink-700:#52456a; --ink-500:#7b6f8c; --ink-400:#9d92ab; --canvas-border:#ebe7f0; --canvas-elevated:#ffffff; --paper-50:#faf9fc; --brand-600:#6a12cd; --brand-50:#f4edff; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-size: 13px; line-height: 1.5; color: var(--ink-800); background: var(--paper-50); -webkit-font-smoothing: antialiased; }
  .wrap { max-width: min(1280px, calc(100% - 48px)); margin: 32px auto; padding: 0; }
  .card { background: var(--canvas-elevated); border: 1px solid var(--canvas-border); border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,8,30,0.04); }
  .card-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--canvas-border); }
  .dot { width: 8px; height: 8px; border-radius: 2px; background: var(--brand-600); flex: 0 0 8px; }
  .title { margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-800); }
  .meta { color: var(--ink-400); font-size: 11px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { background: rgba(245,243,248,0.6); text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; color: var(--ink-500); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--canvas-border); white-space: nowrap; }
  thead th.num { text-align: left; }
  tbody td { padding: 10px 16px; color: var(--ink-700); border-bottom: 1px solid rgba(235,231,240,0.6); white-space: nowrap; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: rgba(244,237,255,0.45); }
  .num { font-variant-numeric: tabular-nums; }
  .card-footer { padding: 8px 16px; border-top: 1px solid var(--canvas-border); font-size: 11px; color: var(--ink-500); font-variant-numeric: tabular-nums; }
</style></head><body>
<div class="wrap">
  <div class="card">
    <div class="card-header">
      <span class="dot" aria-hidden="true"></span>
      <h1 class="title">Flagged duplicate pairs</h1>
      <span class="meta">· ${totalRows}</span>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>${columns.map((c, j) => `<th class="${j >= 3 ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map((c, j) => `<td class="${j >= 3 ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="card-footer">Showing ${rows.length} of ${totalRows}</div>
  </div>
</div>
</body></html>`;
    // Use a programmatic anchor click with target="_blank" — this opens
    // in a new tab even when window.open is rerouted to the same tab by
    // popup blockers, browser settings, or extensions. The anchor must be
    // attached to the DOM before .click() for Safari to honor the target.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    onOpen();
  };

  // CSV file built from the visible rows on click. Same blob-download
  // pattern as the SQL Copy/Download in the workspace panel — no server
  // round-trip, no library, just real file output.
  // Trigger a download from a Blob — used by both CSV and Excel paths.
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvDownload = () => {
    const esc = (v: string) =>
      /["\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = [columns, ...rows].map(r => r.map(esc).join(',')).join('\n');
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'flagged-duplicate-pairs.csv');
    onDownload();
  };

  // Real .xlsx workbook with a single "Flagged duplicates" sheet, built
  // via SheetJS. Lazy-loaded so the ~400KB lib only ships when a user
  // actually clicks Excel. Replaces the HTML-as-Excel hack that modern
  // Excel and Google Sheets refused to open as a real workbook.
  const handleExcelDownload = async () => {
    try {
      const mod = await import('xlsx');
      const XLSX = ((mod as unknown as { default?: typeof mod }).default ?? mod);
      const wb = XLSX.utils.book_new();
      const sheetRows: (string | number)[][] = [columns, ...rows];
      const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
      sheet['!cols'] = columns.map(() => ({ wch: 16 }));
      XLSX.utils.book_append_sheet(wb, sheet, 'Flagged duplicates');
      // Build the blob ourselves — see handleExcel for why writeFile is avoided.
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      triggerDownload(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        'flagged-duplicate-pairs.xlsx',
      );
      onDownload();
    } catch (err) {
      console.error('Excel export failed', err);
    }
  };

  const [downloadOpen, setDownloadOpen] = useState(false);
  useEffect(() => {
    if (!downloadOpen) return;
    const onDoc = (e: MouseEvent) => {
      const root = downloadMenuRef.current;
      if (root && !root.contains(e.target as Node)) setDownloadOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDownloadOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [downloadOpen]);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  return (
    <>
      <div className="group rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-[0_1px_2px_rgba(15,8,30,0.04)] transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.16)]">
        {/* Card header — title + actions. Padding bumped from py-3 → py-3.5
            and px-4 → px-5 so the title sits in a proper card head, not a
            tight strip. */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-canvas-border/70">
          <div className="min-w-0 flex items-center gap-2">
            <span className="size-2 rounded-sm bg-brand-600 shrink-0" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-ink-800 truncate">Flagged duplicate pairs</span>
            <span className="font-mono text-[11px] tabular-nums text-ink-400 shrink-0">· {totalRows}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1">
              <button
                onClick={handleOpenInNewTab}
                title="Open in new tab"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border bg-canvas-elevated text-ink-700 border-canvas-border hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <ExternalLink size={13} className="text-ink-400" />
                <span>Open</span>
              </button>
              <div ref={downloadMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setDownloadOpen(o => !o)}
                  aria-haspopup="menu"
                  aria-expanded={downloadOpen}
                  title="Download"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border bg-canvas-elevated text-ink-700 border-canvas-border hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <Download size={13} className="text-ink-400" />
                  <span>Download</span>
                  <ChevronDown size={12} className={`text-ink-400 transition-transform ${downloadOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {downloadOpen && (
                    <motion.div
                      role="menu"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: [0.16, 1, 0.3, 1] }}
                      // min-w-full pins the menu to the Download trigger's width.
                      // origin-top-right matches the dropdown's anchor for the
                      // subtle scale-in motion.
                      className="absolute right-0 top-full mt-1.5 z-50 min-w-full origin-top-right rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_10px_24px_-14px_rgba(15,8,30,0.20)] overflow-hidden py-1"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setDownloadOpen(false); handleCsvDownload(); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-left text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer focus:outline-none focus-visible:bg-brand-50"
                      >
                        <FileText size={13} className="text-ink-400 shrink-0" />
                        <span>CSV</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setDownloadOpen(false); handleExcelDownload(); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-left text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer focus:outline-none focus-visible:bg-brand-50"
                      >
                        <FileSpreadsheet size={13} className="text-ink-400 shrink-0" />
                        <span>Excel</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <button
              onClick={openFullscreen}
              className="inline-flex items-center justify-center size-8 rounded-lg text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Expand to full view"
              title="Expand to full view"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Body — fixed 390px height. Combined with the ~50px footer this
            gives a total of 440px, identical to the chart card body so
            both cards read as a matched pair. Horizontal scroll only for
            the 10-column table; vertical overflow is clipped (no scrollbar).
            Only the first PREVIEW_ROW_COUNT rows render — any additional
            rows live in the fullscreen modal / new tab. */}
        <div className="overflow-x-auto overflow-y-hidden" style={{ height: 390 }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-canvas-border/70 bg-paper-50/40">
                {columns.map(c => (
                  <th key={c} className="text-left px-5 py-2.5 font-medium text-ink-500 uppercase tracking-[0.06em] text-[10.5px] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PREVIEW_ROW_COUNT).map((row, i) => (
                <tr key={i} className="border-b border-canvas-border/40 last:border-b-0 hover:bg-brand-50/40 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-5 py-2.5 text-ink-700 whitespace-nowrap ${j >= 3 ? 'tabular-nums' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer — visual progress + CTA. The progress bar gives the
            5/8 ratio at a glance; the right-side pill is the action. */}
        {(() => {
          const visible = Math.min(PREVIEW_ROW_COUNT, rows.length);
          const hidden = Math.max(0, totalRows - visible);
          return (
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-canvas-border/70 bg-paper-50/40">
              <span className="text-[11px] text-ink-500 tabular-nums">
                Showing <span className="font-medium text-ink-800">{visible}</span>
                <span className="text-ink-400"> of {totalRows}</span>
              </span>
              {hidden > 0 && (
                <button
                  onClick={openFullscreen}
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100 hover:border-brand-200 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 shrink-0"
                >
                  View all
                  <ArrowRight size={11} strokeWidth={2.5} />
                </button>
              )}
            </div>
          );
        })()}
      </div>

      <AnimatePresence>
        {fullscreen && (
          <FullscreenTableModal
            title="Flagged duplicate pairs"
            columns={columns}
            rows={rows}
            totalRows={totalRows}
            onDownloadCsv={handleCsvDownload}
            onDownloadExcel={handleExcelDownload}
            onClose={() => setFullscreen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Mirrors FullscreenChartModal — same dimensions and chrome, but renders
// the full result table with all rows + a Download dropdown in the header.
function FullscreenTableModal({
  title, columns, rows, totalRows, onDownloadCsv, onDownloadExcel, onClose,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  totalRows: number;
  onDownloadCsv: () => void;
  onDownloadExcel: () => void;
  onClose: () => void;
}) {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!downloadOpen) return;
    const onDoc = (e: MouseEvent) => {
      const root = downloadMenuRef.current;
      if (root && !root.contains(e.target as Node)) setDownloadOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [downloadOpen]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
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
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border shrink-0">
          <div className="min-w-0 flex items-center gap-2">
            <span className="size-2 rounded-sm bg-brand-600 shrink-0" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-ink-800 truncate">{title}</span>
            <span className="font-mono text-[11px] tabular-nums text-ink-400 shrink-0">· {totalRows}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div ref={downloadMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setDownloadOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={downloadOpen}
                title="Download"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border bg-canvas-elevated text-ink-700 border-canvas-border hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Download size={13} className="text-ink-400" />
                <span>Download</span>
                <ChevronDown size={12} className={`text-ink-400 transition-transform ${downloadOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {downloadOpen && (
                  <motion.div
                    role="menu"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-1.5 z-50 min-w-full origin-top-right rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_10px_24px_-14px_rgba(15,8,30,0.20)] overflow-hidden py-1"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setDownloadOpen(false); onDownloadCsv(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-left text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      <FileText size={13} className="text-ink-400 shrink-0" />
                      <span>CSV</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setDownloadOpen(false); onDownloadExcel(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-left text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet size={13} className="text-ink-400 shrink-0" />
                      <span>Excel</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center size-8 rounded-lg text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Close fullscreen"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Table body — full row set, sticky header */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-canvas-elevated">
              <tr className="border-b border-canvas-border/80 bg-paper-50/60">
                {columns.map(c => (
                  <th key={c} className="text-left px-5 py-3 font-semibold text-ink-500 uppercase tracking-wide text-[11px] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-canvas-border/40 last:border-b-0 hover:bg-brand-50/60 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-5 py-2.5 text-ink-700 whitespace-nowrap ${j >= 3 ? 'tabular-nums' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-canvas-border/60 shrink-0">
          <span className="text-[11px] text-ink-500 tabular-nums">
            Showing <span className="font-medium text-ink-700">{rows.length}</span> of <span className="font-medium text-ink-700">{totalRows}</span>
          </span>
          <span className="text-[11px] text-ink-400">Press Esc to close</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Code block — Claude-style toolbar wrapper ─────────────────────────────
// Always-visible header strip: language label on the left, Copy button on
// the right. Copy flips to ✓ + "Copied" for ~2s, no global toast. The block
// itself uses a dark editorial panel for legibility (Claude pattern even
// inside a light page).

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const onCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopied(true);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current); }, []);
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-ink-700 bg-ink-900">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink-800 border-b border-ink-700">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-400">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="inline-flex items-center gap-1 px-1.5 h-6 rounded text-[11px] font-medium text-ink-400 hover:text-canvas-elevated hover:bg-ink-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto text-[13px] leading-[1.55] text-canvas-elevated font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── ReactMarkdown render for assistant prose ───────────────────────────────
// Renders **bold**, `inline code` as a styled chip, paragraphs with proper
// spacing, lists with prose indents, and ```fenced``` blocks via CodeBlock.
// Plain text without any markdown still renders identically — react-markdown
// just wraps it in a <p>.

function renderAssistantText(text: string): React.ReactNode {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="mb-5 last:mb-0 leading-[1.7] text-[14px] text-ink-800">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-ink-900">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-400 transition-colors">
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="my-5 pl-6 space-y-2 list-disc marker:text-ink-400 text-[14px]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-5 pl-6 space-y-2 list-decimal marker:text-ink-400 text-[14px]">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-[1.7] pl-1">{children}</li>
        ),
        h1: ({ children }) => (
          <h1 className="mt-5 mb-2 text-[18px] font-bold leading-tight text-ink-900">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-5 mb-2 text-[16px] font-bold leading-tight text-ink-900">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-4 mb-1.5 text-[14px] font-bold leading-tight text-ink-900">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="mt-4 mb-1.5 text-[13px] font-bold leading-tight text-ink-900">{children}</h4>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 pl-3 border-l-2 border-brand-200 text-ink-700 italic">{children}</blockquote>
        ),
        // Inline code: styled chip with mono font, hairline border, light bg.
        // Block code (triple-backtick) is delegated to <CodeBlock> via `pre`.
        code: (props) => {
          const { className, children, ...rest } = props as { className?: string; children?: React.ReactNode };
          const isBlock = /language-/.test(className || '');
          if (isBlock) {
            return <code className={className}>{children}</code>;
          }
          return (
            <code
              {...rest}
              className="inline-flex items-center px-1.5 py-px mx-px rounded-md bg-canvas border border-canvas-border font-mono text-[0.85em] text-ink-800 align-baseline"
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => {
          // children should be a <code> element with language-* class + text.
          const child = (children as { props?: { className?: string; children?: React.ReactNode } })?.props;
          const className = child?.className || '';
          const langMatch = /language-([\w+-]+)/.exec(className);
          const lang = langMatch ? langMatch[1] : '';
          const raw = typeof child?.children === 'string'
            ? child.children
            : Array.isArray(child?.children) ? child!.children.join('') : '';
          return <CodeBlock language={lang} code={String(raw).replace(/\n$/, '')} />;
        },
      }}
    >
      {text}
    </ReactMarkdown>
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

  // Back/forward navigation removed — Claude's pattern is one question
  // at a time, auto-advance on pick. canGoBack / canGoForward / etc.
  // remain in scope for the keyboard handler effect but no UI calls them.

  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        {/* Header — question on the left, close X on the right. No
            pagination chip, no Back/Next buttons. Auto-advance handles
            most navigation; footer carries the chip + nav as quieter
            chrome. */}
        <div className="px-5 pt-4 pb-3.5 flex items-start justify-between gap-3">
          {/* Question — always reserves space for 2 lines so short and
              long questions sit at the same height. Clamps at 2 lines
              with an ellipsis for very long content; full text in the
              native tooltip. */}
          <p
            className="text-[15px] font-semibold leading-[1.4] text-ink-900 flex-1 min-w-0 break-words line-clamp-2"
            title={viewQ.question}
          >
            {viewQ.question}
          </p>
          <button
            type="button"
            onClick={onSkipAll}
            aria-label="Close clarification"
            title="Close — skip the rest"
            className="inline-flex items-center justify-center size-7 rounded-md text-ink-500 hover:bg-brand-50 hover:text-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Numbered options — refined: compact badges, brand-tinted hover,
            picked state gets a left brand accent rail + soft fill. Hairline
            dividers hide around active rows so the wash reads as one block. */}
        <div role="listbox" aria-label={viewQ.question} className="py-1">
          {viewQ.options.map((opt, idx) => {
            const isHighlighted = highlighted === idx;
            const isPicked = data.answers[viewIndex] === opt;
            const prevIsHighlighted = highlighted === idx - 1;
            const prevIsPicked = idx > 0 && data.answers[viewIndex] === viewQ.options[idx - 1];
            const showDivider = idx > 0 && !isHighlighted && !prevIsHighlighted && !isPicked && !prevIsPicked;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlighted(idx)}
                className={`group/opt relative w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset ${
                  isPicked
                    ? 'bg-brand-50'
                    : isHighlighted
                      ? 'bg-brand-50/50'
                      : 'hover:bg-brand-50/30'
                } ${showDivider ? 'before:absolute before:left-5 before:right-5 before:top-0 before:h-px before:bg-canvas-border/60' : ''}`}
              >
                {/* Left accent rail — brand-600 when picked, faint brand-300 on hover */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-sm transition-all duration-200 ${
                    isPicked ? 'h-[60%] bg-brand-600' : isHighlighted ? 'h-[40%] bg-brand-300' : 'h-0 bg-transparent'
                  }`}
                />
                <span
                  className={`inline-flex items-center justify-center size-6 rounded-md text-[11.5px] font-semibold tabular-nums shrink-0 transition-colors ${
                    isPicked
                      ? 'bg-brand-600 text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.10)]'
                      : isHighlighted
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-brand-50 text-brand-500 group-hover/opt:bg-brand-100 group-hover/opt:text-brand-700'
                  }`}
                  aria-hidden="true"
                >
                  {isPicked ? <Check size={12} strokeWidth={2.75} /> : idx + 1}
                </span>
                <span className={`flex-1 text-[14px] leading-snug transition-colors ${
                  isPicked ? 'text-ink-900 font-medium' : isHighlighted ? 'text-ink-900' : 'text-ink-800'
                }`}>
                  {opt}
                </span>
                {isHighlighted && !isPicked && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ink-400 shrink-0">
                    <kbd className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded bg-canvas-elevated border border-canvas-border text-ink-600 font-mono text-[10px] leading-none">
                      <CornerDownLeft size={11} strokeWidth={2.25} />
                    </kbd>
                  </span>
                )}
              </button>
            );
          })}

          {/* Custom input row — visually distinct from the numbered options:
              dashed pencil chip, thicker divider above, primary CTA appears
              once the user has typed. */}
          <div className="relative flex items-center gap-3 px-5 py-2.5 before:absolute before:left-5 before:right-5 before:top-0 before:h-px before:bg-canvas-border">
            <span
              className="inline-flex items-center justify-center size-6 rounded-md bg-canvas-elevated border border-dashed border-canvas-border text-ink-400 shrink-0"
              aria-hidden="true"
            >
              <Pencil size={11} strokeWidth={2.25} />
            </span>
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
              placeholder="Type something else…"
              className="no-focus-ring flex-1 bg-transparent text-[14px] text-ink-800 placeholder:text-ink-400 outline-none h-7"
            />
            {customInput.trim() ? (
              <button
                onClick={() => selectOption(customInput.trim())}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[12px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Use this
                <CornerDownLeft size={11} strokeWidth={2.25} />
              </button>
            ) : (
              <button
                onClick={skipCurrent}
                className="h-7 px-2.5 text-[12px] font-medium text-ink-500 hover:text-ink-800 hover:bg-brand-50 rounded-md transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Skip
              </button>
            )}
          </div>
        </div>
      </div>

      {/* No footer inside this card — the hint row below the composer
          handles navigation hints (Claude pattern). Submission is
          handled by the parent: once all questions are answered it
          fires onSubmit automatically. */}
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
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  // Pin the loader near the top of the chat viewport on every step change.
  // The loader bubble has a tall `paddingBottom: 50vh` buffer (see render
  // site), so scrolling the container to scrollHeight puts the buffer at
  // the bottom of the viewport and the loader text well above it. Parent
  // ResizeObserver is gated on showProgressiveLoader so it won't override.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const findScrollParent = (node: HTMLElement | null): HTMLElement | null => {
      let p = node?.parentElement ?? null;
      while (p) {
        const oy = window.getComputedStyle(p).overflowY;
        if (oy === 'auto' || oy === 'scroll') return p;
        p = p.parentElement;
      }
      return null;
    };
    const scrollable = findScrollParent(el);
    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollable) {
          scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: 'smooth' });
        } else {
          el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      });
    });
    return () => cancelAnimationFrame(r1);
  }, [stepIdx]);

  const active = steps[Math.min(stepIdx, steps.length - 1)];
  return (
    <div
      ref={rootRef}
      style={{ scrollMarginBottom: 24 }}
      className="flex items-center gap-2 text-[13px] text-ink-600"
    >
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
  const [bpOpen, setBpOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const bpRef = useRef<HTMLDivElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
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
      setBpOpen(false);
      setSubOpen(false);
      setFrequency('Daily');
      setRunTime('06:00');
      setDayOfWeek('Mon');
      setMonthlyDate('');
      setTriggerOn('Schedule');
      setRetry('3x');
    }
  }, [open, defaultName, defaultDescription]);

  // Click-outside + Escape close for the two custom dropdowns
  useEffect(() => {
    if (!bpOpen && !subOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (bpOpen && bpRef.current && !bpRef.current.contains(e.target as Node)) setBpOpen(false);
      if (subOpen && subRef.current && !subRef.current.contains(e.target as Node)) setSubOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (bpOpen) setBpOpen(false);
      if (subOpen) setSubOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [bpOpen, subOpen]);

  const pillCls = (active: boolean) =>
    `inline-flex items-center h-7 px-3 rounded-full text-[11.5px] font-medium border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
      active
        ? 'bg-brand-600 border-brand-600 text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]'
        : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/60'
    }`;

  // Sub-process options derived from SOPs filtered by selected BP
  const subProcessOptions = bpId ? SOPS.filter(s => s.bpId === bpId) : [];
  const selectedBp = BUSINESS_PROCESSES.find(b => b.id === bpId);
  const selectedSub = subProcessOptions.find(s => s.id === subProcessId);

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
            <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
              <Save size={16} className="text-brand-600" />
            </div>
            <div>
              <h2 id="save-as-wf-title" className="text-[15px] font-semibold text-ink-900">Save as workflow</h2>
              <p className="text-[12px] text-ink-500 mt-0.5">Turn this query result into a re-runnable workflow.</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="inline-flex items-center justify-center size-8 rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning */}
        <div className="mx-6 mb-4 px-3 py-2.5 rounded-lg bg-brand-50 border border-brand-200/60 flex gap-2 items-start">
          <Lightbulb size={13} className="text-brand-600 mt-0.5 shrink-0" />
          <p className="text-[12px] leading-relaxed text-ink-700">
            This chat will switch to <strong className="text-brand-700">workflow mode</strong>. You won't be able to switch back to query mode in this chat. Start a new chat for that.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 pb-5 flex-1 overflow-y-auto space-y-4">
          {/* Workflow name */}
          <div>
            <label className="block text-[12px] font-semibold text-ink-900 mb-1.5">
              Workflow name <span className="text-brand-500" aria-hidden>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="no-focus-ring w-full h-10 px-3 text-[13px] text-ink-800 border border-canvas-border hover:border-ink-300 rounded-lg bg-canvas-elevated focus:border-brand-400 outline-none transition-colors"
              placeholder="e.g., Duplicate Invoice Detection: Q1 ±3 days"
            />
            <p className="text-[11px] text-ink-500 mt-1">IRA pre-filled this from your query. Edit if needed.</p>
          </div>

          {/* Two-column row: BP + Sub-process (custom dropdowns matching app theme) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wf-bp-trigger" className="block text-[12px] font-semibold text-ink-900 mb-1.5">
                Business process <span className="text-brand-500" aria-hidden>*</span>
              </label>
              <div ref={bpRef} className="relative">
                <button
                  id="wf-bp-trigger"
                  type="button"
                  onClick={() => { setBpOpen(o => !o); setSubOpen(false); }}
                  aria-haspopup="listbox"
                  aria-expanded={bpOpen}
                  className={`w-full h-10 px-3 inline-flex items-center justify-between gap-2 text-[13px] text-left border rounded-lg bg-canvas-elevated transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    bpOpen ? 'border-brand-400' : 'border-canvas-border hover:border-ink-300'
                  }`}
                >
                  <span className={selectedBp ? 'text-ink-800 truncate' : 'text-ink-400 truncate'}>
                    {selectedBp ? `${selectedBp.name} (${selectedBp.abbr})` : 'Select…'}
                  </span>
                  <motion.span
                    animate={{ rotate: bpOpen ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 28 }}
                    className="inline-flex shrink-0"
                  >
                    <ChevronDown size={14} strokeWidth={2.25} className={bpOpen ? 'text-brand-500' : 'text-ink-400'} />
                  </motion.span>
                </button>
                <AnimatePresence>
                  {bpOpen && (
                    <motion.div
                      role="listbox"
                      aria-labelledby="wf-bp-trigger"
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                      style={{ transformOrigin: 'top center' }}
                      className="absolute z-20 left-0 right-0 top-full mt-1.5 rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_16px_36px_-16px_rgba(15,8,30,0.22),0_4px_10px_-4px_rgba(15,8,30,0.08)] overflow-hidden py-1 max-h-64 overflow-y-auto"
                    >
                      {BUSINESS_PROCESSES.map(bp => {
                        const isSelected = bpId === bp.id;
                        return (
                          <button
                            key={bp.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => { setBpId(bp.id); setSubProcessId(''); setBpOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 h-9 text-left text-[13px] transition-colors cursor-pointer focus:outline-none ${
                              isSelected ? 'bg-brand-50 text-brand-800 font-medium' : 'text-ink-800 hover:bg-brand-50/60 hover:text-ink-900'
                            }`}
                          >
                            <span className="flex-1 truncate">{bp.name} <span className="text-ink-400 font-normal">({bp.abbr})</span></span>
                            {isSelected && <Check size={13} strokeWidth={2.5} className="text-brand-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div>
              <label htmlFor="wf-sub-trigger" className="block text-[12px] font-semibold text-ink-900 mb-1.5">
                Sub-process <span className="text-brand-500" aria-hidden>*</span>
              </label>
              <div ref={subRef} className="relative">
                <button
                  id="wf-sub-trigger"
                  type="button"
                  disabled={!bpId}
                  onClick={() => { setSubOpen(o => !o); setBpOpen(false); }}
                  aria-haspopup="listbox"
                  aria-expanded={subOpen}
                  className={`w-full h-10 px-3 inline-flex items-center justify-between gap-2 text-[13px] text-left border rounded-lg bg-canvas-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    !bpId
                      ? 'border-canvas-border text-ink-400 cursor-not-allowed bg-paper-50/40'
                      : subOpen
                        ? 'border-brand-400 cursor-pointer'
                        : 'border-canvas-border hover:border-ink-300 cursor-pointer'
                  }`}
                >
                  <span className={selectedSub ? 'text-ink-800 truncate' : 'text-ink-400 truncate'}>
                    {selectedSub ? selectedSub.name.replace(/\s*SOP$/i, '').trim() : bpId ? 'Select…' : 'Pick a business process first'}
                  </span>
                  <motion.span
                    animate={{ rotate: subOpen ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 28 }}
                    className="inline-flex shrink-0"
                  >
                    <ChevronDown size={14} strokeWidth={2.25} className={subOpen ? 'text-brand-500' : 'text-ink-400'} />
                  </motion.span>
                </button>
                <AnimatePresence>
                  {subOpen && subProcessOptions.length > 0 && (
                    <motion.div
                      role="listbox"
                      aria-labelledby="wf-sub-trigger"
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                      style={{ transformOrigin: 'top center' }}
                      className="absolute z-20 left-0 right-0 top-full mt-1.5 rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_16px_36px_-16px_rgba(15,8,30,0.22),0_4px_10px_-4px_rgba(15,8,30,0.08)] overflow-hidden py-1 max-h-64 overflow-y-auto"
                    >
                      {subProcessOptions.map(sp => {
                        const isSelected = subProcessId === sp.id;
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => { setSubProcessId(sp.id); setSubOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 h-9 text-left text-[13px] transition-colors cursor-pointer focus:outline-none ${
                              isSelected ? 'bg-brand-50 text-brand-800 font-medium' : 'text-ink-800 hover:bg-brand-50/60 hover:text-ink-900'
                            }`}
                          >
                            <span className="flex-1 truncate">{sp.name.replace(/\s*SOP$/i, '').trim()}</span>
                            {isSelected && <Check size={13} strokeWidth={2.5} className="text-brand-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-semibold text-ink-900 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="no-focus-ring w-full px-3 py-2 text-[13px] text-ink-800 border border-canvas-border hover:border-ink-300 rounded-lg bg-canvas-elevated focus:border-brand-400 outline-none transition-colors resize-none"
              placeholder="One-line summary of what this workflow does."
            />
            <p className="text-[11px] text-ink-500 mt-1">Optional. IRA pre-filled this from your query.</p>
          </div>

          {/* Audit run frequency — mirrors Workflow Library > Configuration tab */}
          <div>
            <label className="text-[12px] font-semibold text-ink-900 mb-2 inline-flex items-center gap-1.5">
              <Calendar size={12} className="text-brand-600" />
              Audit run frequency
            </label>
            <div className="rounded-xl border border-canvas-border bg-paper-50/40 p-4 grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-500 block mb-1.5">Frequency</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Hourly', 'Daily', 'Weekly', 'Monthly'] as const).map(f => (
                    <button key={f} type="button" onClick={() => setFrequency(f)} className={pillCls(frequency === f)}>{f}</button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="wf-run-time" className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-500 block mb-1.5">Run Time</label>
                <input
                  id="wf-run-time"
                  type="time"
                  value={runTime}
                  onChange={e => setRunTime(e.target.value)}
                  className="no-focus-ring w-full h-9 px-3 rounded-lg border border-canvas-border hover:border-ink-300 bg-canvas-elevated text-[13px] text-ink-800 focus:border-brand-400 outline-none transition-colors"
                />
              </div>

              {frequency === 'Weekly' && (
                <div className="col-span-2">
                  <label className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-500 block mb-1.5">Day of the week</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map(d => (
                      <button key={d} type="button" onClick={() => setDayOfWeek(d)} className={pillCls(dayOfWeek === d)}>{d}</button>
                    ))}
                  </div>
                </div>
              )}

              {frequency === 'Monthly' && (
                <div>
                  <label htmlFor="wf-monthly-date" className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-500 block mb-1.5">Date</label>
                  <input
                    id="wf-monthly-date"
                    type="date"
                    value={monthlyDate}
                    onChange={e => setMonthlyDate(e.target.value)}
                    className="no-focus-ring w-full h-9 px-3 rounded-lg border border-canvas-border hover:border-ink-300 bg-canvas-elevated text-[13px] text-ink-800 focus:border-brand-400 outline-none transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-500 block mb-1.5">Trigger On</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Schedule', 'Data Change', 'Manual'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTriggerOn(t)} className={pillCls(triggerOn === t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-500 block mb-1.5">Retry on Failure</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Off', '1x', '3x', '5x'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setRetry(r)} className={pillCls(retry === r)}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-canvas-border px-6 py-3.5 flex items-center justify-end gap-2 bg-canvas-elevated">
          <button
            onClick={onCancel}
            className="inline-flex items-center h-9 px-4 rounded-lg text-[13px] font-medium text-ink-700 hover:text-ink-900 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
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
            className="inline-flex items-center gap-1.5 h-9 px-4 bg-primary hover:bg-primary-hover disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Save size={13} strokeWidth={2.25} /> Save & switch to workflow
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
  // Auto-focus with caret at the END of the text — no pre-selection. The
  // previous select-all blanketed the bubble with a selection highlight on
  // open, which read as "the whole answer is staged for delete" instead of
  // "edit here". Resize the textarea to fit its content.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
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
    // Claude-style edit card with smooth open/close. Outer tinted container
    // carries the brand focus border; inner panel stays white with a
    // hairline border. The message text (now stored as a Q:/A: transcript
    // for clarification turns) is editable directly in the textarea.
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -2 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="w-[40rem] max-w-full rounded-2xl bg-canvas border border-canvas-border focus-within:border-brand-400 transition-colors duration-150 p-3"
    >
      <div className="rounded-xl bg-canvas-elevated border border-canvas-border">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => { onChange(e.target.value); onInput(); }}
          onKeyDown={onKey}
          rows={1}
          aria-label="Edit message"
          className="no-focus-ring w-full bg-transparent border-none outline-none resize-none px-3.5 py-2.5 text-[15px] leading-[1.55] text-ink-800 placeholder:text-ink-400 min-h-[24px] max-h-[240px]"
        />
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="flex items-start gap-1.5 text-[12px] text-ink-500 leading-snug min-w-0 pt-1.5">
          <Info size={13} className="shrink-0 mt-0.5 text-ink-400" aria-hidden="true" />
          <span>Saving will start a new conversation from here. Use the arrows below the message to switch between versions.</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center h-8 px-3 rounded-md text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border hover:bg-canvas hover:text-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex items-center h-8 px-3.5 rounded-md text-[13px] font-semibold bg-primary text-white hover:bg-primary-hover active:bg-brand-800 disabled:bg-ink-300 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            Save
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Export report button ───────────────────────────────────────────────────
// Distinct from the per-table Download button on ResultsTable. Export bundles
// the WHOLE audit result (KPIs + table + assumptions) into a deliverable:
//   - PDF  → fires the browser's native print-preview over a hidden iframe;
//            user picks "Save as PDF" in the native dialog.
//   - XLSX → builds a real .xlsx workbook via SheetJS with three sheets:
//            Summary (KPIs), Flagged pairs (full table), Transcript (chat thread).
// Single source of truth for "the full result", separate from per-artifact
// downloads.

function ExportReportButton({
  messages,
  upToMessageId,
  chatTitle,
}: {
  messages: ChatMessage[];
  upToMessageId: string;
  /** Drives the print-dialog default filename. The browser picks up the
   *  iframe's <title>, sanitizes it, and uses that as the suggested PDF name. */
  chatTitle: string;
}) {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Brief "Building…" state on the trigger while the hidden print iframe
  // mounts and srcdoc loads. The print dialog itself is the preview UI.
  const [pdfBuilding, setPdfBuilding] = useState(false);

  // Pull only THIS query + answer pair — the user message that triggered
  // the export plus the assistant message the Export button sits on. We
  // walk backwards from upToMessageId to the nearest preceding user msg,
  // so earlier Q&A in the same thread are NOT included. Empty / system
  // bubbles (loading placeholders) are skipped.
  const getTranscript = (): ChatMessage[] => {
    const idx = messages.findIndex(m => m.id === upToMessageId);
    if (idx < 0) return [];
    const assistant = messages[idx];
    let userMsg: ChatMessage | undefined;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].text && messages[i].text.trim().length > 0) {
        userMsg = messages[i];
        break;
      }
    }
    const pair = [userMsg, assistant].filter(Boolean) as ChatMessage[];
    return pair.filter(m => m.text && m.text.trim().length > 0);
  };
  const fmtTime = (d: Date) =>
    d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const r = rootRef.current;
      if (r && !r.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const escHtml = (s: string) => s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

  // PDF — open the browser's native print preview (Cmd/Ctrl-P) over a hidden
  // iframe that holds a CHAT export (not a report). The user gets the OS
  // native preview pane + "Save as PDF" destination, with no new tab and no
  // localhost URL ever surfaced. The iframe is removed after the print
  // dialog closes.
  const handlePdf = () => {
    const transcript = getTranscript();
    // Filename hygiene — browsers use the iframe's <title> as the suggested
    // Save-as-PDF filename. Strip filesystem-hostile chars, collapse runs of
    // whitespace into "-", and fall back to "query-result" when the chat is
    // still unnamed ("New chat") so the user never sees a blank suggestion.
    const safeTitle = (chatTitle && chatTitle.trim() && chatTitle.trim() !== 'New chat'
      ? chatTitle.trim()
      : 'query-result'
    )
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80);
    const displayTitle = chatTitle && chatTitle.trim() && chatTitle.trim() !== 'New chat'
      ? chatTitle.trim()
      : 'Exported chat';

    // If the assistant message in this pair carries rich result data
    // (audit-result), inline KPIs + chart + table INSIDE its bubble — they
    // belong to the answer, not a separate "report" section.
    const assistantMsg = transcript.find(m => m.role === 'assistant');
    const includeRichResult = !!assistantMsg && (assistantMsg as ChatMessage).richType === 'audit-result';

    const kpiGridHtml = !includeRichResult ? '' : `<div class="kpi-grid">${AUDIT_RESULT.kpis.map(k => `<div class="kpi"><div class="kpi-value">${escHtml(k.value)}</div><div class="kpi-label">${escHtml(k.label)}</div></div>`).join('')}</div>`;

    // Every chart in AUDIT_RESULT.charts rendered as a real SVG — vertical
    // bar with axis ticks + value labels, or pie with legend. Chart type per
    // id mirrors the in-chat picker's config (see `renderChart` above). Fully
    // static, print-perfect, no library required.
    const CHART_TYPE: Record<string, 'bar' | 'pie'> = {
      confidence: 'bar', vendor: 'pie', 'monthly-high': 'bar',
      region: 'pie', 'match-method': 'pie', status: 'bar', 'amount-band': 'bar',
    };
    const PIE_COLORS = ['#6a12cd', '#8845d9', '#a474e3', '#bea2ed', '#d8d0f7', '#ecdcff'];
    const fmtCount = (n: number) => n >= 1000 ? n.toLocaleString() : String(n);
    const niceMax = (m: number) => {
      if (m <= 0) return 1;
      const pow = Math.pow(10, Math.floor(Math.log10(m)));
      const norm = m / pow;
      const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
      return nice * pow;
    };
    type ChartData = typeof AUDIT_RESULT.charts[number];
    const barChartSVG = (chart: ChartData) => {
      const W = 600, H = 220, PAD_L = 56, PAD_R = 16, PAD_T = 14, PAD_B = 60;
      const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
      const n = chart.data.length;
      const dataMax = Math.max(...chart.data.map(d => d.count));
      const yMax = niceMax(dataMax * 1.1);
      const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(yMax * t));
      const slotW = plotW / n;
      const barW = slotW * 0.62;
      const longLabels = n > 6 || chart.data.some(d => d.bucket.length > 7);
      const gridAndAxis = ticks.map(t => {
        const y = PAD_T + plotH - (t / yMax) * plotH;
        return `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#ebe7f0" stroke-width="0.6"/>` +
          `<text x="${PAD_L - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#7b6f8c" font-family="Inter, system-ui, sans-serif">${escHtml(fmtCount(t))}</text>`;
      }).join('');
      const bars = chart.data.map((d, i) => {
        const x = PAD_L + slotW * i + (slotW - barW) / 2;
        const h = (d.count / yMax) * plotH;
        const y = PAD_T + plotH - h;
        const cx = x + barW / 2;
        const valY = y - 4;
        const xLabel = longLabels
          ? `<text transform="translate(${cx} ${PAD_T + plotH + 10}) rotate(-28)" text-anchor="end" font-size="9" fill="#5a4a72" font-family="Inter, system-ui, sans-serif">${escHtml(d.bucket)}</text>`
          : `<text x="${cx}" y="${PAD_T + plotH + 16}" text-anchor="middle" font-size="9.5" fill="#5a4a72" font-family="Inter, system-ui, sans-serif">${escHtml(d.bucket)}</text>`;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 0.5)}" fill="#6a12cd" rx="2"/>` +
          `<text x="${cx}" y="${valY}" text-anchor="middle" font-size="9" fill="#3a2f4a" font-family="Inter, system-ui, sans-serif" font-weight="500">${escHtml(fmtCount(d.count))}</text>` +
          xLabel;
      }).join('');
      const axisBaseline = `<line x1="${PAD_L}" y1="${PAD_T + plotH}" x2="${W - PAD_R}" y2="${PAD_T + plotH}" stroke="#d8d3e0" stroke-width="0.8"/>`;
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${gridAndAxis}${axisBaseline}${bars}</svg>`;
    };
    const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
      const rad = (deg - 90) * Math.PI / 180;
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    };
    const pieChartSVG = (chart: ChartData) => {
      const W = 600, H = 220;
      const cx = 130, cy = 110, r = 88;
      const total = chart.data.reduce((s, d) => s + d.count, 0) || 1;
      let angle = 0;
      const slices = chart.data.map((d, i) => {
        const sweep = (d.count / total) * 360;
        const a0 = angle, a1 = angle + sweep;
        angle = a1;
        if (sweep >= 359.99) {
          return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PIE_COLORS[i % PIE_COLORS.length]}" stroke="#ffffff" stroke-width="2"/>`;
        }
        const [x0, y0] = polar(cx, cy, r, a0);
        const [x1, y1] = polar(cx, cy, r, a1);
        const largeArc = sweep > 180 ? 1 : 0;
        return `<path d="M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${PIE_COLORS[i % PIE_COLORS.length]}" stroke="#ffffff" stroke-width="2"/>`;
      }).join('');
      const legendX = 250;
      const rowH = 22;
      const startY = Math.max(10, (H - chart.data.length * rowH) / 2);
      const legend = chart.data.map((d, i) => {
        const ly = startY + i * rowH;
        const pct = ((d.count / total) * 100).toFixed(1);
        return `<rect x="${legendX}" y="${ly}" width="11" height="11" fill="${PIE_COLORS[i % PIE_COLORS.length]}" rx="2"/>` +
          `<text x="${legendX + 18}" y="${ly + 9}" font-size="10" fill="#3a2f4a" font-family="Inter, system-ui, sans-serif" font-weight="500">${escHtml(d.bucket)}</text>` +
          `<text x="${legendX + 18}" y="${ly + 20}" font-size="9" fill="#7b6f8c" font-family="Inter, system-ui, sans-serif">${escHtml(fmtCount(d.count))} · ${pct}%</text>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${slices}${legend}</svg>`;
    };
    const chartHtml = !includeRichResult ? '' : AUDIT_RESULT.charts.map(c => {
      const type = CHART_TYPE[c.id] ?? 'bar';
      const svg = type === 'pie' ? pieChartSVG(c) : barChartSVG(c);
      return `<div class="chart"><div class="chart-title">${escHtml(c.label)}</div>${svg}</div>`;
    }).join('');

    const tableHtml = !includeRichResult ? '' : `<div class="data-table"><div class="data-table-title">Flagged duplicate pairs · ${AUDIT_RESULT.table.totalRows}</div><table><thead><tr>${AUDIT_RESULT.table.columns.map(c => `<th>${escHtml(c)}</th>`).join('')}</tr></thead><tbody>${AUDIT_RESULT.table.rows.map(r =>
      `<tr>${r.map((c, j) => `<td class="${j === 3 || j === 8 ? 'num' : ''}">${escHtml(c)}</td>`).join('')}</tr>`
    ).join('')}</tbody></table></div>`;

    const renderMsg = (m: ChatMessage) => {
      const isAssistant = m.role === 'assistant';
      const attachRich = isAssistant && includeRichResult && m.id === assistantMsg!.id;
      return `<div class="msg msg-${m.role}">
    <div class="msg-head"><span class="role">${isAssistant ? 'Ira' : 'You'}</span><span class="ts">${escHtml(fmtTime(m.timestamp))}</span></div>
    <div class="text">${escHtml(m.text).replace(/\n/g, '<br>')}</div>
    ${attachRich ? kpiGridHtml + chartHtml + tableHtml : ''}
  </div>`;
    };
    const transcriptHtml = transcript.length === 0
      ? '<p class="empty">No messages to export.</p>'
      : transcript.map(renderMsg).join('\n');

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${escHtml(safeTitle)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.55 -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; color: #1a1124; background: #ffffff; }
  h1 { font-size: 18px; margin: 0 0 4px; font-weight: 600; }
  .meta { color: #7b6f8c; font-size: 11px; margin-bottom: 22px; }
  .msg { padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; page-break-inside: auto; }
  .msg-user { background: #f3eefb; border: 1px solid #e4d8f4; page-break-inside: avoid; }
  .msg-assistant { background: #f8f6fb; border: 1px solid #ebe7f0; }
  .msg-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .role { font-size: 10px; font-weight: 600; color: #6a12cd; text-transform: uppercase; letter-spacing: 0.06em; }
  .msg-assistant .role { color: #5a4a72; }
  .ts { font-size: 10px; color: #9d92ab; font-variant-numeric: tabular-nums; }
  .text { white-space: normal; word-wrap: break-word; }
  .empty { color: #9d92ab; font-style: italic; }

  /* KPI grid — inline inside the assistant bubble. */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 0 4px; }
  .kpi { background: #ffffff; border: 1px solid #ebe7f0; border-radius: 6px; padding: 8px 10px; }
  .kpi-value { font-size: 14px; font-weight: 600; color: #1a1124; font-variant-numeric: tabular-nums; }
  .kpi-label { font-size: 9.5px; color: #7b6f8c; margin-top: 2px; }

  /* SVG charts — each chart keeps together across page breaks. The SVG
     scales to the bubble width via width:100%, viewBox preserves the
     400×600-ish aspect ratio so axes + labels stay legible. */
  .chart { margin: 14px 0 4px; page-break-inside: avoid; break-inside: avoid; }
  .chart-title { font-size: 11px; font-weight: 600; color: #3a2f4a; margin-bottom: 6px; }

  /* Data table — full rows, page-break friendly. */
  .data-table { margin: 14px 0 0; }
  .data-table-title { font-size: 11px; font-weight: 600; color: #3a2f4a; margin-bottom: 6px; }
  .data-table table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  .data-table thead th { text-align: left; padding: 6px 8px; font-weight: 600; color: #7b6f8c; text-transform: uppercase; letter-spacing: 0.04em; font-size: 9px; border-bottom: 1px solid #d8d3e0; background: #f8f6fb; }
  .data-table tbody td { padding: 5px 8px; border-bottom: 1px solid #ebe7f0; }
  .data-table tbody tr { page-break-inside: avoid; }
  .data-table td.num { font-variant-numeric: tabular-nums; }
</style></head><body>
<h1>${escHtml(displayTitle)}</h1>
<div class="meta">Exported ${escHtml(new Date().toLocaleString())}</div>
${transcriptHtml}
</body></html>`;

    // Hidden iframe — positioned off-screen (not display:none, since some
    // browsers won't render content for printing on a hidden iframe). The
    // print dialog is fired on the iframe's contentWindow so the parent
    // page's URL never leaves the chat surface.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.srcdoc = html;

    // Some browsers (Chrome / Edge) use the TOP document.title — not the
    // iframe's — as the Save-as-PDF suggested filename. Temporarily swap
    // document.title to the chat name while the dialog is open, restore it
    // after. This is the load-bearing fix; the iframe <title> only covers
    // the Firefox path.
    const previousDocTitle = document.title;
    let restored = false;
    const restoreDocTitle = () => {
      if (restored) return;
      restored = true;
      document.title = previousDocTitle;
    };

    const cleanup = () => {
      // Defer so Safari has time to close the dialog before we yank the doc.
      window.setTimeout(() => {
        iframe.remove();
        window.removeEventListener('focus', onFocusBack);
        restoreDocTitle();
      }, 600);
    };
    const onFocusBack = () => {
      // Fallback exit hatch — print dialogs that don't fire afterprint
      // (some Safari builds) still return focus to the parent window.
      cleanup();
    };

    setPdfBuilding(true);
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        setPdfBuilding(false);
        iframe.remove();
        restoreDocTitle();
        addToast({ type: 'error', message: 'Could not open print preview — please try again.' });
        return;
      }
      // afterprint fires when the native print dialog closes (Save or Cancel).
      win.addEventListener('afterprint', cleanup, { once: true });
      window.addEventListener('focus', onFocusBack, { once: true });
      try {
        // Swap title now — must happen BEFORE win.print() so the dialog
        // captures the chat name as the suggested filename.
        document.title = safeTitle;
        win.focus();
        win.print();
      } catch (err) {
        console.error('Print preview failed', err);
        addToast({ type: 'error', message: 'Could not open print preview — please try again.' });
        iframe.remove();
        restoreDocTitle();
      } finally {
        setPdfBuilding(false);
      }
    };
    document.body.appendChild(iframe);
  };

  // Real .xlsx workbook with three sheets (Summary / Flagged pairs /
  // Transcript), built via SheetJS. Lazy-loaded so the lib (~400KB
  // minified) only ships to users who actually export. Replaces the prior
  // HTML-as-Excel hack that modern Excel + Google Sheets opened as raw
  // markup instead of a real workbook.
  const handleExcel = async () => {
    const transcript = getTranscript();
    try {
      // SheetJS ships both CJS + ESM; under Vite, dynamic import can land
      // its helpers either on the namespace or under `.default`. Unwrap
      // defensively so we work in both shapes.
      const mod = await import('xlsx');
      const XLSX = ((mod as unknown as { default?: typeof mod }).default ?? mod);
      const wb = XLSX.utils.book_new();

      // Sheet 1 — Summary (KPI table).
      const summaryRows: (string | number)[][] = [
        ['Metric', 'Value'],
        ...AUDIT_RESULT.kpis.map(k => [k.label, k.value]),
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 28 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Sheet 2 — Flagged pairs (full table — header + rows).
      const tableRows: (string | number)[][] = [
        AUDIT_RESULT.table.columns,
        ...AUDIT_RESULT.table.rows,
      ];
      const tableSheet = XLSX.utils.aoa_to_sheet(tableRows);
      tableSheet['!cols'] = AUDIT_RESULT.table.columns.map(() => ({ wch: 16 }));
      XLSX.utils.book_append_sheet(wb, tableSheet, 'Flagged pairs');

      // Sheet 3 — Transcript (chat thread up to this assistant message).
      const transcriptRows: (string | number)[][] = transcript.length === 0
        ? [['Time', 'Role', 'Message'], ['—', '—', 'No messages.']]
        : [
            ['Time', 'Role', 'Message'],
            ...transcript.map(m => [
              fmtTime(m.timestamp),
              m.role === 'user' ? 'You' : 'Ira',
              m.text,
            ]),
          ];
      const transcriptSheet = XLSX.utils.aoa_to_sheet(transcriptRows);
      transcriptSheet['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 90 }];
      XLSX.utils.book_append_sheet(wb, transcriptSheet, 'Transcript');

      const safeTitle = (chatTitle && chatTitle.trim() && chatTitle.trim() !== 'New chat'
        ? chatTitle.trim()
        : 'query-result'
      )
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80);
      // Use XLSX.write → Blob → anchor-download instead of XLSX.writeFile.
      // writeFile's internal browser-vs-Node detection trips under Vite's
      // ESM dynamic-import path and throws "fs.writeFileSync is not a
      // function". Building the blob ourselves bypasses that entirely.
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      addToast({ type: 'success', message: `Query result downloaded as ${safeTitle}.xlsx` });
    } catch (err) {
      console.error('Excel export failed', err);
      const detail = err instanceof Error ? err.message : String(err);
      addToast({ type: 'error', message: `Could not generate Excel — ${detail}` });
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="md"
        leftIcon={pdfBuilding ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        rightIcon={<ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pdfBuilding}
      >
        {pdfBuilding ? 'Building…' : 'Export'}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            // min-w-full pins the menu to the Export trigger's width, matching
            // the platform Download menu's chrome (brand hover, subtle scale-in,
            // refined shadow). Labels are short ("PDF" / "Excel") so the menu
            // can actually sit at trigger width — the footer line carries the
            // longer-form context.
            className="absolute left-0 top-full mt-1.5 z-50 min-w-full origin-top-left rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_10px_24px_-14px_rgba(15,8,30,0.20)] overflow-hidden py-1"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); handlePdf(); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-left text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer focus:outline-none focus-visible:bg-brand-50"
            >
              <FileText size={13} className="text-ink-400 shrink-0" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); handleExcel(); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-left text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer focus:outline-none focus-visible:bg-brand-50"
            >
              <FileSpreadsheet size={13} className="text-ink-400 shrink-0" />
              <span>Excel</span>
            </button>
            <div className="border-t border-canvas-border/70 mt-1 pt-1 px-2.5 pb-1 text-[10.5px] text-ink-400 whitespace-nowrap">
              Full query result
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function ChatView({ showChatHistory, toggleChatHistory, setShowArtifacts, showArtifacts, setActiveArtifactTab, setArtifactMode, setWorkflowType, initialQuery, onInitialQueryProcessed, composerDraft, onComposerDraftConsumed, selectedChatId, onChatLoaded, setView, pendingDashboard, onAddToDashboard, onDismissPendingDashboard, onLaunchWorkflowBuilder, workflowBuilderSeedPrompt, onWorkflowBuilderSeedConsumed, availableDashboards, availableReports, onAddResultToDashboard, onAddResultToReport, onViewDashboard, onViewReport }: ChatViewProps) {
  const { addToast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  // Workflow-build seed handoff. Non-empty string = the chat starts in
  // workflow mode and auto-pushes the prompt as a user message (kicking
  // off the in-thread workflow build). Empty string = chat starts with
  // the Workflow pill pre-toggled but no auto-build. Null = query default.
  const [journeySeed, setJourneySeed] = useState<string | null>(
    workflowBuilderSeedPrompt ?? null,
  );
  useEffect(() => {
    if (workflowBuilderSeedPrompt != null) {
      setJourneySeed(workflowBuilderSeedPrompt);
      onWorkflowBuilderSeedConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowBuilderSeedPrompt]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Tracks the saved-conversation id that is currently loaded — drives the
  // active row highlight in the chat-history sidebar. Cleared by resetChat
  // and by sending the first message in a fresh thread.
  const [activeChatHistoryId, setActiveChatHistoryId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const processingRef = useRef(false);

  // New flow state
  const [showClarificationCard, setShowClarificationCard] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<Array<{ question: string; options: string[] }>>([]);
  const [showProgressiveLoader, setShowProgressiveLoader] = useState(false);
  // Ref mirror of showProgressiveLoader — read inside the ResizeObserver
  // closure (which would otherwise capture stale state) to gate the auto-
  // snap-to-bottom while the InlineAuditLoader is in charge of positioning.
  const progressiveLoaderRef = useRef(false);
  useEffect(() => { progressiveLoaderRef.current = showProgressiveLoader; }, [showProgressiveLoader]);

  // Workflow build flow state
  const [workflowBuildPhase, setWorkflowBuildPhase] = useState(0); // 0=idle, 1=asking-files, 2=asking-logic, 3=confirming, 4=input-config, 5=freeze-confirm, 6=output-config, 7=save
  const [currentWorkflowType, setCurrentWorkflowType] = useState<WorkflowTypeId | null>(null);

  // ── Converged workflow-build state ──
  // The standalone WorkflowBuilderJourney is gone; its state lives here so
  // workflow-build cards can render inside this chat thread.
  const [wfWorkflow, setWfWorkflow] = useState<WorkflowDraft | null>(null);
  const [wfFiles, setWfFiles] = useState<JourneyFiles>({});
  const [wfMappings, setWfMappings] = useState<JourneyMappings>({});
  const [wfAlignments, setWfAlignments] = useState<JourneyAlignments>({});
  const [wfRunning, setWfRunning] = useState(false);
  const [wfResult, setWfResult] = useState<RunResult | null>(null);
  const [wfSaved, setWfSaved] = useState(false);
  const [wfMapExpanded, setWfMapExpanded] = useState<string | null>(null);
  const [wfSaveModalOpen, setWfSaveModalOpen] = useState(false);
  const [wfUploadModalOpen, setWfUploadModalOpen] = useState(false);
  const [wfDraftAttachments, setWfDraftAttachments] = useState<UploadedFile[]>([]);
  // Amount tolerance used by the run — populated by the validate-phase
  // clarify, then surfaced as an inline ToleranceAdjustCard. Mirrors the
  // original WorkflowBuilderJourney's tolerance state.
  const [wfTolerance, setWfTolerance] = useState<ToleranceCardState>({
    mode: 'percentage', percentage: 5, absolute: 100, enabled: true,
  });
  // Tracks the latest workflow-clarify card id so we can advance it from
  // user keyboard input (option submit / skip).
  const wfClarifyMsgIdRef = useRef<string | null>(null);
  // Guards the once-per-workflow effects (validate clarify finish, view-preview
  // push, upload-modal auto-open) so they don't re-fire when messages mutate.
  const wfValidateCompleteRef = useRef<string | null>(null);
  const wfUploadModalSeededFor = useRef<string | null>(null);
  const wfViewPreviewRevealedRef = useRef<string | null>(null);

  // Composer mode toggle — drives whether a Submit routes to query or workflow flow.
  // Default is query (toggle off); user opts into workflow build by toggling the pill on.
  const [buildWorkflowMode, setBuildWorkflowMode] = useState(false);

  // Save-as-workflow flow state (Path 3 — query → workflow flip)
  const [showSaveAsWfModal, setShowSaveAsWfModal] = useState(false);
  const [lockedAsWorkflow, setLockedAsWorkflow] = useState(false);
  // Dismissible state for the workflow-mode banner. Lock persists; banner
  // is just the one-time post-save notice the user can clear.
  const [lockedBannerDismissed, setLockedBannerDismissed] = useState(false);
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

  // Track scroll INTENT, not position. The old logic flipped "scrolled up"
  // any time `distanceFromBottom > 100`, which mis-fired during streaming —
  // when assistant content grows, scrollTop stays put but scrollHeight
  // grows, so distanceFromBottom grows, so the flag flipped to "scrolled
  // up" → ResizeObserver stopped following → user saw half the chat.
  //
  // Now: the flag only flips TRUE when scrollTop actually decreases (user
  // dragged upward), and flips back FALSE when scrollTop reaches near the
  // bottom. Content growth doesn't change the flag.
  const lastScrollTopRef = useRef(0);
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const last = lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    // User actively scrolled up
    if (scrollTop < last - 5) {
      isUserScrolledUp.current = true;
    }
    // User is back near the bottom — re-enable auto-follow
    const distanceFromBottom = container.scrollHeight - scrollTop - container.clientHeight;
    if (distanceFromBottom < 80) {
      isUserScrolledUp.current = false;
    }
    setShowScrollToBottom(prev => prev === isUserScrolledUp.current ? prev : isUserScrolledUp.current);
  }, []);

  // Smooth-scroll-in-flight gate. When a smooth `scrollTo` is animating,
  // the streaming-time ResizeObserver follow must stand down — otherwise
  // its instant snap mid-animation cancels the smooth glide and the user
  // sees a jarring jump instead of an animated transition.
  const smoothScrollTimerRef = useRef<number | null>(null);

  // Snap to the absolute bottom of the messages container — including the
  // "What next?" heading and the follow-up chip row, since those sit just
  // above the inner wrapper's padding. The scroll-intent refs are synced so
  // the subsequent scroll event from this programmatic move isn't mis-read
  // as the user dragging upward.
  const snapToBottom = useCallback((smooth: boolean = false) => {
    const container = messagesContainerRef.current;
    if (!container) return false;
    const target = container.scrollHeight;
    if (smooth && !prefersReducedMotion) {
      // Mark smooth scroll in flight for ~650ms (typical browser smooth-
      // scroll duration plus a small buffer). Successive smooth snaps reset
      // the window so the RO stays muted through the whole post-gen burst.
      if (smoothScrollTimerRef.current !== null) {
        window.clearTimeout(smoothScrollTimerRef.current);
      }
      smoothScrollTimerRef.current = window.setTimeout(() => {
        smoothScrollTimerRef.current = null;
      }, 650);
      container.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      container.scrollTop = target;
    }
    lastScrollTopRef.current = container.scrollTop;
    isUserScrolledUp.current = false;
    return true;
  }, [prefersReducedMotion]);

  const scrollToBottom = useCallback(() => {
    snapToBottom(true);
  }, [snapToBottom]);

  // Scroll-to-bottom policy:
  //  • Continuous follow during generation — a ResizeObserver watches the
  //    messages container's height. Every growth event snaps the viewport
  //    to the bottom IF the user is already near the bottom.
  //  • If the user scrolled up to re-read, we leave them alone.
  //  • rAF-debounced so multiple height changes in the same frame coalesce
  //    into one scroll.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const followIfAtBottom = () => {
      if (isUserScrolledUp.current) return;
      // Stand down while the InlineAuditLoader is running — it owns the
      // scroll position during loading (it pins the active step in view
      // using a tall bottom buffer on the loader bubble). Snapping to
      // scrollHeight here would yank the loader text down behind the
      // composer.
      if (progressiveLoaderRef.current) return;
      // Stand down while a smooth scroll is animating — otherwise our
      // instant snap would cancel the animation and the user sees a jump.
      if (smoothScrollTimerRef.current !== null) return;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        snapToBottom(false);
        rafId = null;
      });
    };
    const ro = new ResizeObserver(followIfAtBottom);
    ro.observe(container);
    const inner = container.firstElementChild;
    if (inner) ro.observe(inner);
    return () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [snapToBottom]);

  // Boundary snaps + post-generation settle window. When isTyping flips to
  // false, rich cards (action bar, follow-up chips, feedback row) often
  // mount in subsequent ticks via state updates the ResizeObserver may
  // catch a frame too late. We fire several extra snaps over ~400ms to
  // guarantee the final bottom — including the very last follow-up chip —
  // sits in view when the user is at the bottom.
  const prevMsgCountRef = useRef(messages.length);
  const prevTypingRef = useRef(isTyping);
  useEffect(() => {
    const prevCount = prevMsgCountRef.current;
    const prevTyping = prevTypingRef.current;
    prevMsgCountRef.current = messages.length;
    prevTypingRef.current = isTyping;

    const lastMsg = messages[messages.length - 1];
    const userMessageJustAdded = messages.length > prevCount && lastMsg?.role === 'user';
    const generationJustFinished = prevTyping && !isTyping;

    if (!userMessageJustAdded && !generationJustFinished) return;
    if (generationJustFinished && isUserScrolledUp.current) return;

    // User just sent a message → smooth scroll the new bubble into view.
    // Smooth (not instant) so the transition reads as a controlled glide
    // instead of a jarring jump.
    snapToBottom(true);
    if (generationJustFinished) {
      // Re-fire across ~900ms so the "What next?" heading + follow-up chip
      // row both end up flush at the bottom of view. The chip row staggers
      // its children (320ms base delay + 40ms per chip + 300ms duration ≈
      // 820ms for 6 chips), and the feedback / "Thanks" rows can mount in
      // delayed ticks — repeated snaps cover all of those. Each smooth
      // re-fire smoothly redirects the prior in-flight scroll.
      const t1 = setTimeout(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 80);
      const t2 = setTimeout(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 200);
      const t3 = setTimeout(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 450);
      const t4 = setTimeout(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 700);
      const t5 = setTimeout(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 900);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
    }
  }, [messages, isTyping, snapToBottom]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      if (smoothScrollTimerRef.current !== null) {
        window.clearTimeout(smoothScrollTimerRef.current);
      }
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

  // Composer draft handoff — when another surface (e.g. the workspace
  // panel's "Edit assumptions") seeds a prompt, drop it into the textarea,
  // size the row, focus, and place the caret at the end so the user can
  // immediately keep typing. Does NOT auto-submit.
  useEffect(() => {
    if (!composerDraft) return;
    setInput(composerDraft);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 260) + 'px';
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
    onComposerDraftConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerDraft]);

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
    setLockedBannerDismissed(false);
    setAttachedSources([]);
    setFiles([]);
    clearTimers();
    setShowArtifacts(false);
    setArtifactMode('query');
    setActiveArtifactTab('sources');
    setBuildWorkflowMode(false);
    setChatTitleOverride(null);
    setEditingTitle(false);
    setActiveChatHistoryId(null);
  }, [setShowArtifacts, setArtifactMode, setActiveArtifactTab]);

  // Confirmation gate for New chat — when a generation is in flight
  // (assistant typing or audit loader running), starting a new chat would
  // discard the in-progress response. We surface a confirm dialog before
  // proceeding so the user doesn't accidentally lose work.
  const [newChatConfirmAfter, setNewChatConfirmAfter] = useState<null | (() => void)>(null);
  const isGenerating = isTyping || showProgressiveLoader;
  const requestNewChat = useCallback((after?: () => void) => {
    if (isGenerating) {
      // Stash the post-reset callback so the confirmation dialog can run it
      // on confirm (e.g. closing the chat-history sidebar).
      setNewChatConfirmAfter(() => () => { resetChat(); after?.(); });
      return;
    }
    resetChat();
    after?.();
  }, [isGenerating, resetChat]);

  // ─── Global keyboard shortcuts (Claude-aligned) ─────────────────────────
  // Cmd/Ctrl + .       → toggle the chat-history sidebar
  // Cmd/Ctrl + Shift + O → start a new chat (clears thread)
  // Cmd/Ctrl + /       → show the keyboard-shortcuts help modal
  // Esc inside the modal also closes it (the modal handles that itself).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      // Don't hijack shortcuts while the user is typing into a field —
      // except for Cmd+/ which is a global help shortcut.
      const target = e.target as HTMLElement | null;
      const inTextField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        setShowShortcutsModal((v) => !v);
        return;
      }
      if (inTextField) return;
      if (e.key === '.') {
        e.preventDefault();
        toggleChatHistory();
        return;
      }
      if (e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault();
        requestNewChat();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resetChat, toggleChatHistory]);

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
    setActiveChatHistoryId(chatId);
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
      // Claude-style Q/A transcript: each clarification pair on its own
      // pair of lines so the user pill (and the edit textarea) reads as
      // a structured transcript, not a bare bullet list.
      const userText = consolidated.length
        ? consolidated.map(c => `Q: ${c.question}\nA: ${c.answer}`).join('\n\n')
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
        text: `## Duplicate invoice detection — Q1 FY26

Scanned **1.2M invoice records** across the last **90 days** and surfaced **8 high-confidence duplicates** totalling **₹6.16L** in exposure. The strongest pair sits at a **96% match** on **Acme Corp**, which alone accounts for *half of the flags*.

> Sample-data preview: this run used the connected sandbox source. Re-run against your production SAP AP module before promoting any flag to a finding.

### Where to look first

- **Acme Corp** — 4 of 8 flags. Two invoices were posted **3 days apart** for identical amounts under near-identical PO references.
  - One pair was approved by the same AP clerk; check whether the duplicate-payment control failed open.
  - The other pair crossed an approval-limit boundary; payment may have already cleared.
- **Bluepeak Logistics** — 2 flags, both at month-end, both **₹84,000** exactly. Confirm whether one is a credit-note reversal.
- **Two tail vendors** — single flags each, lower priority but worth a glance before sign-off.

The full plan, SQL, and sources are in the Workspace on the right. Promote any pair to a formal finding from the \`Flagged pairs\` table, or open the [duplicate-payment SOP](https://docs.auditify.example/sops/duplicate-payment) for the standard remediation path.`,
        followUps: AUDIT_FOLLOWUPS,
        richType: 'audit-result',
        richData: AUDIT_RESULT,
      };
    }));

    // Claude-aligned scroll behavior: drive the same multi-fire snap-to-
    // bottom window here as the regular post-generation path. The
    // audit-result mount swaps the message in place (no isTyping toggle),
    // so the messages/isTyping effect doesn't fire — we kick off the
    // snaps directly so the "What next?" chip row at the bottom of the
    // (often tall) audit-result message lands in view once its rich
    // content + chip stagger has settled.
    if (!isUserScrolledUp.current) {
      schedule(() => snapToBottom(true), 0);
      schedule(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 120);
      schedule(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 280);
      schedule(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 500);
      schedule(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 750);
      schedule(() => { if (!isUserScrolledUp.current) snapToBottom(true); }, 1000);
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
  // Path 3 entry — open the metadata modal directly. The previous flow
  // posted an inline clarification asking for tolerance / threshold config
  // first, but those choices are already captured by the assumptions on
  // the audit result; re-asking before every save felt repetitive. The
  // tolerance config can be edited inside the modal's Description (or by
  // running a new query) instead.
  const openSaveAsWorkflowModal = () => {
    setShowSaveAsWfModal(true);
  };

  // Path 3 commit — modal confirmed. Lock the thread into workflow mode,
  // swap the IRA Workspace canvas (parent App.tsx handles the Y-spin), and
  // post the inline checkpoint message asking which params to make configurable.
  const handleSaveAsWorkflowConfirm = (data: { name: string; bpId: string; subProcessId: string; description: string; frequencyConfig: WorkflowFrequencyConfig }) => {
    setShowSaveAsWfModal(false);

    // Lock the composer pill — visual signal that mode is irreversible per thread.
    setLockedAsWorkflow(true);
    setLockedBannerDismissed(false);
    setBuildWorkflowMode(true);

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

  // ─── Workflow build orchestration (in-thread) ───────────────────────────
  // Push helpers + step-card pushers. Replaces the standalone journey's
  // applyWorkflow/pushStepCardOnce/finishClarifying machinery, scoped to
  // ChatView's own messages array.
  const wfMakeId = () => `msg-wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const wfPushAssistant = useCallback((text: string) => {
    setMessages(m => [...m, { id: wfMakeId(), role: 'assistant', text, timestamp: new Date() }]);
  }, []);
  const wfPushClarify = useCallback((questions: ClarifyQuestion[], phase: 'initial' | 'validate', stepLabel?: string) => {
    const id = wfMakeId();
    wfClarifyMsgIdRef.current = id;
    setMessages(m => [...m, {
      id,
      role: 'assistant',
      text: '',
      timestamp: new Date(),
      richType: 'workflow-clarify',
      richData: { questions, phase, stepLabel, index: 0, answers: {} as Record<string, string> },
    }]);
  }, []);
  const wfPushCard = useCallback((cardType: 'workflow-upload' | 'workflow-map' | 'workflow-review' | 'workflow-tolerance' | 'workflow-view-preview' | 'workflow-output') => {
    // Phase-aware quick-reply chips that surface beneath the card.
    // Routed through wfQuickReplies so the click pushes a canned assistant
    // reply rather than starting a brand-new build via simulateResponse.
    const phaseFollowUps: Record<string, string[]> = {
      'workflow-upload': ['What columns do I need?', 'Link a data source', 'Show a sample format'],
      'workflow-map': ['Recommend columns', 'Explain a column', 'Preview sample rows'],
      'workflow-review': ['Check data quality', 'Preview schema', 'Explain extraction logic'],
    };
    setMessages(m => {
      if (m.length > 0 && m[m.length - 1].richType === cardType) return m;
      return [...m, {
        id: wfMakeId(),
        role: 'assistant',
        text: '',
        timestamp: new Date(),
        richType: cardType,
        followUps: phaseFollowUps[cardType],
      }];
    });
  }, []);

  // Canned assistant replies for workflow quick-reply chips. Mirrors the
  // original AIAssistantPanel's quickReply onClick payloads.
  const WF_QUICK_REPLIES: Record<string, string> = {
    'What columns do I need?': 'For most inputs you\'ll want the join keys (PO #, Invoice #, Vendor ID), the amount column, and a date column to anchor the period. I\'ll flag any column whose type or distribution looks off.',
    'Link a data source': 'Use the **+ Attach** button in the upload modal — you can pick from existing files, databases, APIs, cloud connectors, or last session\'s artefacts.',
    'Show a sample format': 'Each required input has a sample row strip on the upload card. Hover the input name to see the expected column types and a 5-row preview from the most recent run.',
    'Recommend columns': 'Keep all join keys, amount, and date by default. Toggle off only optional columns that aren\'t referenced by downstream steps — I\'ve marked those with a dim badge.',
    'Explain a column': 'Pick any column in the mapping card and I\'ll describe what it holds, its inferred type, and how confidently it aligns with the target field.',
    'Preview sample rows': 'Click **Preview** on a mapped input to inspect the first few rows alongside the alignment confidence.',
    'Check data quality': 'I\'ll surface null ratios, duplicate rates, and out-of-range outliers per source — anything above 5% triggers a warning badge on the review card.',
    'Preview schema': 'The review card lists every data source with its column roles (join key / amount / date / dimension). Expand a source to see the column-by-column type and example value.',
    'Explain extraction logic': 'Each step on the review card shows the extraction it runs (type, description, dependencies). Expand a step to see the SQL-equivalent pseudocode I\'ll execute.',
  };

  // Kick off a workflow build from a typed prompt. Mirrors the journey's
  // applyWorkflow but pushes everything into ChatView's messages array.
  const startWorkflowBuild = useCallback(async (prompt: string, attachments: UploadedFile[] = []) => {
    // Push the user's prompt as the opening message of the thread.
    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'user', text: prompt, timestamp: new Date() }]);
    setIsTyping(true);
    // Generate the workflow draft (mock). Keep a brief "thinking" beat
    // so the assistant turn has shape.
    await new Promise(r => setTimeout(r, 600));
    const draft = wfGenerate(prompt);
    setWfWorkflow(draft);

    // Carry-forward Step 1 attachments into required inputs.
    const seededFiles: JourneyFiles = {};
    if (attachments.length > 0) {
      const reqInputs = draft.inputs.filter(i => i.required);
      const fallback = draft.inputs[0]?.id ?? '';
      for (const f of attachments) {
        let target = '';
        for (const inp of reqInputs) {
          if ((seededFiles[inp.id] ?? []).length === 0) { target = inp.id; break; }
        }
        if (!target) target = fallback;
        if (target) seededFiles[target] = [...(seededFiles[target] ?? []), f];
      }
    }
    setWfFiles(seededFiles);
    setWfMappings({});
    setWfAlignments(wfSeedAlignments(draft));
    setWfResult(null);
    setWfSaved(false);
    setWfDraftAttachments([]);

    // Upload-first flow: introduce the workflow, push the Upload card,
    // and auto-open the data picker. Clarification only happens AFTER the
    // user has attached files — that way the questions are answered with
    // real source context, not abstract guesses.
    const intro = `I've analyzed your prompt and built the **${draft.name}** workflow. To begin, drop the required data files in the upload window — I'll ask a few quick clarifications right after.`;
    setIsTyping(false);
    wfPushAssistant(intro);
    wfPushCard('workflow-upload');
    if (wfUploadModalSeededFor.current !== draft.id) {
      wfUploadModalSeededFor.current = draft.id;
      window.setTimeout(() => setWfUploadModalOpen(true), 400);
    }
  }, [wfPushAssistant, wfPushCard]);

  // Upload → Clarify advance — once every required input has at least
  // one file, push the 4 initial clarify questions. The previous order
  // (Clarify-then-Upload) was inverted on user feedback so the user
  // answers questions with the actual data context already attached.
  // This is also where the workspace artifact panel auto-opens so the
  // user can see the workflow's data shape while answering clarify.
  const wfHasPushedClarifyRef = useRef(false);
  useEffect(() => {
    if (!wfWorkflow) { wfHasPushedClarifyRef.current = false; return; }
    if (wfHasPushedClarifyRef.current) return;
    const hasUploadCard = messages.some(m => m.richType === 'workflow-upload');
    if (!hasUploadCard) return;
    const required = wfWorkflow.inputs.filter(i => i.required);
    const allFilled = required.every(i => (wfFiles[i.id] ?? []).length > 0);
    if (!allFilled) return;
    wfHasPushedClarifyRef.current = true;
    wfPushAssistant('Got it — files received. Now a few quick clarifications before I map and run.');
    const questions = wfGetClarify(wfWorkflow);
    wfPushClarify(questions, 'initial', 'Asking a few clarifying questions');
    // Open the workspace artifact panel as soon as the files land. The
    // panel shows the per-source schema + plan, which helps the user
    // ground their clarify answers against the actual data shape.
    setArtifactMode('workflow');
    setWorkflowType?.(detectWorkflowType(wfWorkflow.name));
    setShowArtifacts(true);
  }, [wfWorkflow, wfFiles, messages, wfPushAssistant, wfPushClarify, setArtifactMode, setWorkflowType, setShowArtifacts]);

  // If the user closes the upload modal WITHOUT attaching anything for
  // any required input, surface a gentle nudge prompting them to upload.
  // Fires once per workflow.id and only when the modal transitions from
  // open → closed with empty required inputs.
  const wfNudgeUploadRef = useRef<string | null>(null);
  const wfPrevModalOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wfPrevModalOpenRef.current;
    wfPrevModalOpenRef.current = wfUploadModalOpen;
    if (!wfWorkflow) return;
    if (!wasOpen || wfUploadModalOpen) return; // only on open → closed transition
    if (wfNudgeUploadRef.current === wfWorkflow.id) return;
    const required = wfWorkflow.inputs.filter(i => i.required);
    const anyFilled = required.some(i => (wfFiles[i.id] ?? []).length > 0);
    if (anyFilled) return; // user attached something; no nudge needed
    wfNudgeUploadRef.current = wfWorkflow.id;
    wfPushAssistant("Looks like nothing was attached — pick at least one source per required input via **Open upload window** so I can move to the next step.");
  }, [wfUploadModalOpen, wfWorkflow, wfFiles, wfPushAssistant]);

  // Clarify → Map advance — fires once the initial clarify card has
  // been fully answered/skipped (index >= questions.length). Pushes the
  // Map card + opens the workspace artifact panel.
  const wfHasPushedMapRef = useRef(false);
  useEffect(() => {
    if (!wfWorkflow) { wfHasPushedMapRef.current = false; return; }
    if (wfHasPushedMapRef.current) return;
    const clarifyMsg = [...messages].reverse().find(m => {
      if (m.richType !== 'workflow-clarify') return false;
      const d = m.richData as { phase?: string; questions?: ClarifyQuestion[]; index?: number };
      return d.phase === 'initial' && (d.questions?.length ?? 0) > 0 && (d.index ?? 0) >= (d.questions?.length ?? 0);
    });
    if (!clarifyMsg) return;
    wfHasPushedMapRef.current = true;
    wfPushAssistant('Clarifications locked in — moving to data mapping.');
    wfPushCard('workflow-map');
  }, [wfWorkflow, messages, wfPushAssistant, wfPushCard]);

  // Validate-phase completion — fires after the user finishes the
  // matching-logic + tolerance clarify cards pushed from StepReviewRun.
  // Derives a percentage from the tolerance-preset answer, narrates the
  // run, and pushes the interactive ToleranceAdjustCard. The card's
  // onRun handler executes runWorkflow + cascades to view-preview/output.
  useEffect(() => {
    if (!wfWorkflow) return;
    const validateMsg = [...messages].reverse().find(m => {
      if (m.richType !== 'workflow-clarify') return false;
      const d = m.richData as { phase?: string; questions?: ClarifyQuestion[]; index?: number };
      return d.phase === 'validate' && (d.questions?.length ?? 0) > 0 && (d.index ?? 0) >= (d.questions?.length ?? 0);
    });
    if (!validateMsg) return;
    if (wfValidateCompleteRef.current === validateMsg.id) return;
    wfValidateCompleteRef.current = validateMsg.id;
    const data = validateMsg.richData as { answers: Record<string, string> };
    const pct = tolerancePctFromAnswer(data.answers?.['tolerance-preset']);
    setWfTolerance(prev => ({ ...prev, mode: 'percentage', percentage: pct, enabled: true }));
    wfPushAssistant(`Got it — running with **±${pct}%** amount tolerance.`);
    wfPushCard('workflow-tolerance');
    // Auto-fire the run after a short beat so the user sees the card
    // settle before the run kicks off. The card's onRun handler also
    // works manually for re-runs at different tolerances. NOTE: do NOT
    // return a cleanup that clearTimeout's this — pushing the tolerance
    // card above triggers a messages-change re-render, and the cleanup
    // would cancel the run before it ever fires. The ref guard handles
    // dedup.
    window.setTimeout(async () => {
      if (!wfWorkflow) return;
      setWfRunning(true);
      const res = await wfRun(wfWorkflow, wfFiles, wfMappings);
      setWfRunning(false);
      setWfResult(res);
      wfPushAssistant(`Finished. The **${res.title}** is ready — ${res.rows.length} rows, ${res.stats.find(s => s.label === 'Records Scanned')?.value ?? '—'} records scanned.`);
      wfPushCard('workflow-view-preview');
    }, 700);
  }, [messages, wfWorkflow, wfFiles, wfMappings, wfPushAssistant, wfPushCard]);

  const wfAnswerClarify = useCallback((msgId: string, answerOrSkip: string | null) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'workflow-clarify') return m;
      const data = m.richData as { questions: ClarifyQuestion[]; phase: 'initial' | 'validate'; index: number; answers: Record<string, string>; stepLabel?: string };
      const q = data.questions[data.index];
      if (!q) return m;
      const nextAnswers = { ...data.answers };
      if (answerOrSkip != null) nextAnswers[q.id] = answerOrSkip;
      return { ...m, richData: { ...data, answers: nextAnswers, index: data.index + 1 } };
    }));
    if (answerOrSkip != null) {
      setMessages(prev => [...prev, { id: `msg-${Date.now()}-ans`, role: 'user', text: answerOrSkip, timestamp: new Date() }]);
    }
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
    let text = trimmed;
    const attachmentLabels = [
      ...attachedSources.map(s => s.kind === 'source' ? s.name : ''),
      ...files.map(f => f.name),
    ].filter(Boolean);
    if (attachmentLabels.length > 0) text += `\n[Attached: ${attachmentLabels.join(', ')}]`;

    // Workflow mode pill + no active workflow yet → start the inline
    // workflow build in THIS chat thread (same composer, same chrome,
    // same prose). Workflow cards render as assistant rich-type messages.
    // Previously gated on messages.length === 0, but that meant any prior
    // chat content silently downgraded the Workflow toggle to the old
    // keyword-driven query/workflow router. The right signal is "no
    // workflow in progress", which is wfWorkflow being null.
    if (buildWorkflowMode && !wfWorkflow && trimmed) {
      const attachmentsForWorkflow: UploadedFile[] = files.map(f => ({ name: f.name, size: f.size }));
      setInput('');
      setFiles([]);
      setAttachedSources([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      startWorkflowBuild(trimmed, attachmentsForWorkflow);
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
    // BUT: if a workflow build is already in progress (wfWorkflow set), pass
    // 'query' so the auto-detect router doesn't keyword-spin off a *second*
    // workflow build on top of the active one.
    const explicit: 'query' | 'workflow' | undefined =
      buildWorkflowMode ? (wfWorkflow ? 'query' : undefined) : 'query';
    simulateResponse(text, explicit);
  };

  const handleFollowUpClick = (question: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'user', text: question, timestamp: new Date() }]);
    // Workflow quick-reply chips short-circuit the standard simulateResponse
    // path — they just push a canned assistant reply so the in-thread build
    // doesn't get reset by keyword-detection on the chip text.
    const cannedReply = WF_QUICK_REPLIES[question];
    if (cannedReply) {
      setTimeout(() => {
        wfPushAssistant(cannedReply);
        processingRef.current = false;
      }, 300);
      return;
    }
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

  // Long-paste threshold per Claude's interaction spec — pastes over this
  // length get auto-attached as a Pasted-N.txt chip instead of stuffing the
  // textarea. Keeps the composer scannable for short replies and treats
  // dumped logs / docs as the attachments they really are.
  const PASTE_AS_FILE_THRESHOLD = 2500;
  const pastedCounterRef = useRef(0);

  const handleComposerPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const cb = e.clipboardData;
    if (cb?.files && cb.files.length > 0) {
      e.preventDefault();
      ingestFiles(cb.files);
      return;
    }
    const pasted = cb?.getData('text');
    if (!pasted) return;

    // Long-paste auto-attach (Claude pattern): if the paste is large, drop
    // it into the attachments row as a Pasted-N.txt file rather than the
    // textarea. The user can still remove it via the chip's X button.
    if (pasted.length >= PASTE_AS_FILE_THRESHOLD) {
      e.preventDefault();
      pastedCounterRef.current += 1;
      const name = `Pasted-${pastedCounterRef.current}.txt`;
      const blob = new Blob([pasted], { type: 'text/plain' });
      const file = new File([blob], name, { type: 'text/plain', lastModified: Date.now() });
      ingestFiles([file]);
      return;
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

  // ── Message-level actions (Copy / Retry / Feedback) ────────────────────────
  // Bound to the hover-revealed action bar under each assistant text message.

  // Tracks which assistant message just got "Copied" so the icon flashes a
  // check briefly. Keyed by message id so multiple copies stay independent.
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  // Tracks 👍 / 👎 selection per message. Mock-only — no backend persistence.
  const [feedbackByMsgId, setFeedbackByMsgId] = useState<Record<string, 'up' | 'down'>>({});
  // Open feedback popover: tracks which message+kind is showing the
  // "Tell us more" form. Closed when null.
  const [feedbackPopover, setFeedbackPopover] = useState<{ msgId: string; kind: 'up' | 'down' } | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [feedbackReason, setFeedbackReason] = useState<string>('');
  // Custom-dropdown open state for the feedback "type of issue" picker.
  const [feedbackReasonOpen, setFeedbackReasonOpen] = useState(false);
  const feedbackReasonRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!feedbackReasonOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (feedbackReasonRef.current && !feedbackReasonRef.current.contains(e.target as Node)) {
        setFeedbackReasonOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFeedbackReasonOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [feedbackReasonOpen]);
  const [feedbackSubmittedIds, setFeedbackSubmittedIds] = useState<Set<string>>(new Set());
  // Keyboard-shortcuts help modal — opens on Cmd/Ctrl + /.
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

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

  // Branch-arrow navigation on edited user messages. Swaps the user text
  // AND the full downstream conversation to the prev/next saved version.
  // Before switching, we snapshot the current downstream into the active
  // branch so anything that happened since landing on it (e.g. follow-up
  // chips picked, dashboards added) is preserved when we return.
  const switchBranch = useCallback((msgId: string, direction: -1 | 1) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId);
      if (idx === -1) return prev;
      const target = prev[idx];
      if (!target.branches || target.branches.length <= 1) return prev;
      const current = target.branchIndex ?? (target.branches.length - 1);
      const nextIdx = Math.max(0, Math.min(target.branches.length - 1, current + direction));
      if (nextIdx === current) return prev;
      const downstreamBefore = prev.slice(idx + 1);
      const refreshedBranches = target.branches.map((b, i) =>
        i === current ? { ...b, downstream: downstreamBefore } : b
      );
      const incomingBranch = refreshedBranches[nextIdx];
      const updatedTarget: ChatMessage = {
        ...target,
        text: incomingBranch.text,
        branches: refreshedBranches,
        branchIndex: nextIdx,
      };
      return [...prev.slice(0, idx), updatedTarget, ...incomingBranch.downstream];
    });
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

    // Update the user message text + trim everything after it. Branching:
    // snapshot the OLD text + the downstream messages it produced into the
    // branches array, then add the NEW text with an empty downstream
    // (simulateResponse will populate it). Switching branches restores
    // the full conversation under that branch.
    setMessages(prev => {
      const current = prev[idx];
      const downstreamBefore = prev.slice(idx + 1);
      const previousBranches: { text: string; downstream: ChatMessage[] }[] =
        current.branches ?? [{ text: current.text, downstream: downstreamBefore }];
      // If branches already existed, refresh the active branch's downstream
      // snapshot so it reflects any in-thread state changes (added-to-dashboard,
      // bookmarks, etc.) before we move off it.
      const refreshedBranches = previousBranches.map((b, i) =>
        i === (current.branchIndex ?? previousBranches.length - 1)
          ? { ...b, downstream: downstreamBefore }
          : b
      );
      const updatedBranches = [...refreshedBranches, { text: trimmed, downstream: [] as ChatMessage[] }];
      const next = prev.slice(0, idx + 1);
      next[idx] = {
        ...current,
        text: trimmed,
        branches: updatedBranches,
        branchIndex: updatedBranches.length - 1,
        timestamp: new Date(),
      };
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
    // Open the inline "tell us more" popover (Claude pattern). Always
    // opens fresh — re-clicking the same icon re-arms the form.
    setFeedbackPopover({ msgId, kind });
    setFeedbackDraft('');
    setFeedbackReason('');
  }, []);

  const submitFeedback = useCallback(() => {
    if (!feedbackPopover) return;
    // Mark as submitted so the action bar can swap the icon to a check
    // and the popover collapses into a quiet "Thanks" confirmation.
    setFeedbackSubmittedIds(prev => new Set(prev).add(feedbackPopover.msgId));
    setFeedbackPopover(null);
    setFeedbackDraft('');
    setFeedbackReason('');
    addToast({ type: 'success', message: 'Feedback sent. Thanks for telling Ira.' });
  }, [feedbackPopover, addToast]);

  const cancelFeedback = useCallback(() => {
    setFeedbackPopover(null);
    setFeedbackDraft('');
    setFeedbackReason('');
  }, []);

  // Claude's negative-feedback reason taxonomy (with one tweak — "Inaccurate
  // citations" — for our auditor context). Used in the 👎 popover dropdown.
  const FEEDBACK_REASONS = [
    'Not factually correct',
    "Didn't follow my instructions",
    'Inaccurate citations or sources',
    'Refused when it should not have',
    'Too verbose / not detailed enough',
    'Style or tone issue',
    'Other',
  ];

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
      // Cap matches the textarea's visual ceiling (260px in-thread, 280px
      // empty state). Past this the textarea internally scrolls instead of
      // pushing the chat composer off-screen. Using the higher of the two
      // here is safe because CSS max-h enforces the per-surface limit.
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 260) + 'px';
    }
  };

  const isEmpty = messages.length === 0;

  // Workspace panel is contextual to a query — it shows the plan, sources,
  // code, and output of an in-flight or completed run. On an empty chat
  // there's nothing meaningful to display, so force-close any panel state
  // inherited from a previous session. The empty-state header below also
  // omits the workspace toggle, so the panel can't be re-opened until the
  // user actually asks something.
  useEffect(() => {
    if (isEmpty && showArtifacts) setShowArtifacts(false);
  }, [isEmpty, showArtifacts, setShowArtifacts]);

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

  // Most-recent open workflow clarify (initial + validate phases) — same docked
  // pattern as the query clarification, so the UI/placement matches.
  const openWorkflowClarify = [...messages].reverse().find(m => {
    if (m.richType !== 'workflow-clarify') return false;
    const d = m.richData as { questions?: ClarifyQuestion[]; index?: number };
    return (d.questions?.length ?? 0) > 0 && (d.index ?? 0) < (d.questions?.length ?? 0);
  });
  const openWorkflowClarifyData: ClarificationData | null = openWorkflowClarify ? (() => {
    const d = openWorkflowClarify.richData as { questions: ClarifyQuestion[]; answers: Record<string, string>; index: number; stepLabel?: string; phase?: string };
    const numericAnswers: Record<number, string> = {};
    d.questions.forEach((q, i) => {
      const a = d.answers?.[q.id];
      if (a) numericAnswers[i] = a;
    });
    return {
      intro: d.stepLabel ?? 'Asking a few clarifying questions',
      questions: d.questions.map(q => ({ question: q.title, options: q.options })),
      answers: numericAnswers,
      status: 'open',
      purpose: 'workflow-build',
    } as unknown as ClarificationData;
  })() : null;

  /* ────────────────────── CHAT HISTORY SIDEBAR ────────────────────── */
  // Outer motion.div animates the column width; inner content stays pinned
  // at 280px so rows don't squish during open/close.
  const CHAT_HISTORY_W = 280;
  const handleNewChatFromSidebar = () => {
    requestNewChat(() => toggleChatHistory());
  };
  const chatHistoryPanel = (
    <AnimatePresence initial={false}>
      {showChatHistory && (
        <motion.aside
          aria-label="Chat history"
          initial={{ width: 0 }}
          animate={{ width: CHAT_HISTORY_W }}
          exit={{ width: 0 }}
          transition={{ type: 'spring', stiffness: 460, damping: 38, mass: 0.7 }}
          className="h-full overflow-hidden shrink-0 border-r border-canvas-border bg-canvas-elevated"
        >
          <div style={{ width: CHAT_HISTORY_W }} className="h-full flex flex-col">
            {/* Header */}
            <div className="h-12 shrink-0 px-4 flex items-center justify-between border-b border-canvas-border">
              <h3 className="text-[13px] font-semibold text-ink-900 tracking-tight">Chat history</h3>
              <button
                type="button"
                onClick={toggleChatHistory}
                aria-label="Close chat history"
                title="Close (⌘.)"
                className="size-7 inline-flex items-center justify-center text-ink-400 hover:text-brand-700 hover:bg-brand-50 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <X size={15} />
              </button>
            </div>

            {/* New chat */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <button
                type="button"
                onClick={handleNewChatFromSidebar}
                title="New chat (⌘⇧O)"
                className="w-full inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] font-medium text-ink-700 hover:text-brand-700 hover:bg-brand-50 hover:border-brand-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Plus size={14} strokeWidth={2.25} />
                New chat
              </button>
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
              {CHAT_HISTORY.map(chat => {
                const isActive = activeChatHistoryId === chat.id;
                return (
                  <motion.button
                    key={chat.id}
                    type="button"
                    onClick={() => loadChatById(chat.id)}
                    aria-current={isActive ? 'true' : undefined}
                    whileTap={{ scale: 0.985 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`w-full text-left px-2.5 py-2.5 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      isActive
                        ? 'bg-canvas-elevated border border-brand-300 shadow-[0_2px_4px_-1px_rgba(106,18,205,0.18),0_10px_24px_-8px_rgba(106,18,205,0.32)]'
                        : 'border border-transparent hover:bg-brand-50/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`size-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isActive ? 'bg-brand-100 text-brand-700' : 'bg-brand-50/70 text-ink-500'
                      }`}>
                        <MessageSquare size={12} strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] truncate tracking-tight ${
                          isActive ? 'font-semibold text-brand-800' : 'font-medium text-ink-900'
                        }`}>
                          {chat.title}
                        </div>
                        <div className="text-[11.5px] text-ink-500 truncate mt-0.5">{chat.preview}</div>
                        <div className="text-[11px] text-ink-400 mt-1 tabular-nums">{chat.timestamp}</div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Slide-out is a quick switcher for the last 5; canonical browser is /recents. */}
            {setView && (
              <div className="border-t border-canvas-border p-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { toggleChatHistory(); setView('recents'); }}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold text-ink-700 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Browse all in Recents
                  <ArrowRight size={12} strokeWidth={2.25} />
                </button>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );

  // When a workflow build is kicked off via a non-empty seed from Path 1
  // (Home / AI Concierge → Build a workflow), bootstrap the workflow build
  // in this thread on first render. Empty seed = open chat in workflow
  // mode but don't auto-build; user types their prompt and we start.
  useEffect(() => {
    if (journeySeed == null) return;
    if (journeySeed.trim().length > 0 && messages.length === 0) {
      const seed = journeySeed;
      setJourneySeed(null);
      setBuildWorkflowMode(true);
      // defer so the state flush has settled before pushing messages
      queueMicrotask(() => startWorkflowBuild(seed));
    } else {
      // Empty seed: just preset workflow mode and clear.
      setBuildWorkflowMode(true);
      setJourneySeed(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeySeed]);

  /* ────────────────────── EMPTY STATE ────────────────────── */
  if (isEmpty) {
    return (
      <>
      <div className="flex h-full w-full">
        {chatHistoryPanel}

        <div className="flex-1 min-w-0 h-full flex flex-col chat-canvas-mesh relative">
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
            <button onClick={toggleChatHistory} className="p-2.5 text-text-muted hover:text-text-secondary hover:bg-brand-50 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label="Chat history" title="Chat history (⌘.)">
              <History size={18} />
            </button>
            <button onClick={() => requestNewChat()} className="p-2.5 text-text-muted hover:text-text-secondary hover:bg-brand-50 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label="New chat" title="New chat (⌘⇧O)">
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
              className="w-[52.5rem] max-w-full text-center"
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
                className="text-[15px] text-ink-500 mb-10"
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
                {/* Drop overlay — only renders during an active file drag.
                    Reveals on a 120ms fade so it doesn't snap in. */}
                <AnimatePresence>
                  {isDragging && (
                    <motion.div
                      key="hero-composer-drop-overlay"
                      aria-hidden="true"
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-brand-50/85 border-2 border-dashed border-brand-300 pointer-events-none"
                    >
                      <div className="flex items-center gap-2 text-[13px] font-medium text-brand-700">
                        <Paperclip size={14} />
                        <span>Drop to attach</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Attachment chips — picked sources + fresh uploads. */}
                {(files.length > 0 || attachedSources.length > 0) && (
                  <div className="composer-chips-row flex items-center gap-1.5 overflow-x-auto px-4 pt-3 pb-1 text-left">
                    {attachedSources.map((s, i) => (
                      s.kind === 'source' && (
                        <div
                          key={`src-${i}`}
                          title={s.name}
                          className="flex items-center gap-1.5 bg-brand-50 text-ink-700 text-[12px] px-2 py-1 rounded-md font-medium border border-brand-100 shrink-0 transition-colors duration-150 hover:border-brand-200"
                        >
                          <span className="text-[10px] uppercase font-semibold tracking-[0.06em] text-ink-500">{s.type === 'database' ? 'DB' : s.type === 'api' ? 'API' : s.type === 'cloud' ? 'CLOUD' : s.type === 'session' ? 'SESS' : 'FILE'}</span>
                          <span className="truncate max-w-[10rem]">{s.name}</span>
                          <button
                            type="button"
                            onClick={() => setAttachedSources(prev => prev.filter((_, j) => j !== i))}
                            className="text-ink-400 hover:text-ink-800 hover:bg-brand-100 ml-0.5 p-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-full transition-colors"
                            aria-label={`Remove ${s.name}`}
                          ><X size={11} /></button>
                        </div>
                      )
                    ))}
                    {files.map((f, i) => (
                      <div
                        key={`file-${i}`}
                        title={f.name}
                        className="flex items-center gap-1.5 bg-brand-50 text-ink-700 text-[12px] px-2 py-1 rounded-md font-medium border border-brand-100 shrink-0 transition-colors duration-150 hover:border-brand-200"
                      >
                        <FileText size={12} className="text-ink-500" />
                        <span className="truncate max-w-[6.25rem]">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-ink-400 hover:text-ink-800 hover:bg-brand-100 ml-0.5 p-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-full transition-colors"
                          aria-label={`Remove ${f.name}`}
                        ><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Textarea — empty-state slightly taller than the in-chat
                    composer because this is the hero entry point and the
                    surface should feel inviting. Claude-aligned 15px body,
                    1.55 line-height; padding tighter than before to match
                    Claude's compact composer (px-3.5 / pt-3.5 / pb-1). */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); handleTextareaInput(); }}
                  onKeyDown={handleKeyDown}
                  onPaste={handleComposerPaste}
                  placeholder={buildWorkflowMode ? 'Describe the workflow you want to build…' : 'Message Ira…'}
                  aria-label="Message IRA"
                  className="no-focus-ring w-full bg-transparent border-none outline-none resize-none px-4 pt-4 pb-2 text-[15px] leading-[1.55] text-ink-800 placeholder:text-ink-400 min-h-[88px] max-h-[260px] text-left"
                  rows={1}
                />

                {/* Action row — input affordances on the LEFT (attach + mode
                    picker), output action (Send) on the RIGHT. Grouping
                    follows the Claude pattern: "what's coming in" stacked
                    together, "what's going out" isolated. */}
                <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowDataPicker(true)}
                      aria-label="Attach data sources or files"
                      title="Attach data or files"
                      className="inline-flex items-center justify-center size-8 rounded-full text-ink-500 hover:bg-brand-50 hover:text-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <Plus size={18} strokeWidth={2} />
                    </button>

                    {/* Mode segmented control — BOTH options visible, BOTH
                        selection states identical (brand-600 fill) so they
                        read as peers, not Query-as-default + Workflow-as-
                        special. Symmetric pill = clean toggle. */}
                    <div
                      role="radiogroup"
                      aria-label="Composer mode"
                      className="inline-flex items-center rounded-full bg-canvas p-0.5"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!buildWorkflowMode}
                        onClick={() => setBuildWorkflowMode(false)}
                        title="Query — ask Ira a question, get an answer"
                        className={`inline-flex items-center h-7 px-3 rounded-full text-[13px] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                          !buildWorkflowMode
                            ? 'bg-brand-600 text-white'
                            : 'text-ink-500 hover:text-ink-800'
                        }`}
                      >
                        Query
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={buildWorkflowMode}
                        onClick={() => setBuildWorkflowMode(true)}
                        title="Workflow — build a re-runnable audit workflow"
                        className={`inline-flex items-center h-7 px-3 rounded-full text-[13px] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                          buildWorkflowMode
                            ? 'bg-brand-600 text-white'
                            : 'text-ink-500 hover:text-ink-800'
                        }`}
                      >
                        Workflow
                      </button>
                    </div>
                  </div>

                  {(input.trim() || files.length > 0 || attachedSources.length > 0) && (
                    <button
                      type="button"
                      onClick={handleSend}
                      aria-label="Send message"
                      title="Send · Enter to send, Shift+Enter for new line"
                      className="inline-flex items-center justify-center size-8 rounded-full bg-primary text-white hover:bg-primary-hover active:bg-brand-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <ArrowUp size={16} strokeWidth={2.25} />
                    </button>
                  )}
                </div>
              </div>

              {/* Starter prompts — mode-aware. Click fills the composer
                  (no auto-send) so the user can edit before sending.
                  Removes the blank-page anxiety on first visit. */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {(buildWorkflowMode
                  ? [
                      'Duplicate invoice detection',
                      'Three-way match (PO / GRN / Invoice)',
                      'Vendor master change monitoring',
                      'Aged AP balances over 90 days',
                    ]
                  : [
                      'Find duplicate invoices in Q1',
                      'Top 5 vendors by spend YTD',
                      'GL postings outside business hours',
                      'Approvals above ₹1L without backup',
                    ]
                ).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                      requestAnimationFrame(() => handleTextareaInput());
                    }}
                    className="inline-flex items-center h-8 px-3 rounded-full border border-canvas-border bg-canvas-elevated text-[13px] font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {prompt}
                  </button>
                ))}
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
        className="flex flex-col h-full chat-canvas-mesh"
        style={{ flex: '1 1 0%', minWidth: 0 }}
      >
        {/* Claude-style header — title + chevron on left (opens chat history),
            separate icon buttons on the right (no merged chip background).
            Height matches the chat-history sidebar header and the artifact
            panel tab strip so the top chrome reads as one row. */}
        <header className="h-12 shrink-0 flex items-center justify-between px-4 sm:px-6">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              autoFocus
              defaultValue={currentChatTitle === 'New chat' ? '' : currentChatTitle}
              placeholder="Rename chat"
              onFocus={(e) => {
                const len = e.currentTarget.value.length;
                e.currentTarget.setSelectionRange(len, len);
              }}
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
              className="max-w-[280px] sm:max-w-[340px] text-[16px] font-normal tracking-normal text-ink-900 bg-white border border-brand-200 rounded-md px-2 py-1 -mx-2 outline-none focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <button
              onClick={toggleChatHistory}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
              title="Click for history · Double-click to rename"
              aria-label="Chat history"
              aria-expanded={showChatHistory}
              className="group flex items-center gap-2.5 max-w-[280px] sm:max-w-[340px] text-[16px] font-normal tracking-normal text-ink-900 hover:bg-brand-50 rounded-md px-2 py-1 -mx-2 transition-colors cursor-pointer"
            >
              <span className="truncate">{currentChatTitle || 'New chat'}</span>
              <motion.span
                animate={{
                  rotate: showChatHistory ? -180 : 0,
                  scale: showChatHistory ? 1.05 : 1,
                }}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="inline-flex shrink-0 text-ink-500 group-hover:text-ink-700"
              >
                <History size={14} />
              </motion.span>
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
              aria-expanded={showArtifacts}
            >
              <motion.span
                key={showArtifacts ? 'open' : 'closed'}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className="inline-flex"
              >
                {showArtifacts ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </motion.span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              shape="md"
              onClick={() => requestNewChat()}
              title="New chat"
              aria-label="New chat"
            >
              <Plus size={14} />
            </Button>
          </div>
        </header>

        {/* Pending Dashboard Banner */}
        {pendingDashboard && (
          <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-brand-50 border-b border-canvas-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-canvas-elevated border border-brand-200 flex items-center justify-center shrink-0">
                <BarChart3 size={14} className="text-brand-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink-800 truncate">Creating: {pendingDashboard.name}</p>
                <p className="text-[12px] text-ink-500">Run a query, then add results to your dashboard.</p>
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
          className="h-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
        >
          <div className={`max-w-[52.5rem] mx-auto w-full px-4 sm:px-6 pb-10 space-y-10 ${pendingDashboard ? 'pt-4' : 'pt-8'}`}>
            {/* Workflow journey stepper — visible whenever a workflow build
                is underway in this thread. Mirrors the original
                WorkflowBuilderJourney's Stepper, mapping the in-thread cards
                pushed so far to Step 1 (Describe/Clarify) → Step 4 (Review). */}
            {buildWorkflowMode && wfWorkflow && (() => {
              const has = (t: string) => messages.some(m => m.richType === t);
              const completed = new Set<JourneyStep>();
              let current: JourneyStep = 1;
              if (has('workflow-upload')) { completed.add(1); current = 2; }
              if (has('workflow-map')) { completed.add(2); current = 3; }
              if (has('workflow-review')) { completed.add(3); current = 4; }
              if (has('workflow-output')) { completed.add(4); }
              return (
                <div className="sticky top-0 z-10 -mt-8 -mx-4 sm:-mx-6 mb-2 px-4 sm:px-6 pt-3 pb-3 bg-canvas/95 backdrop-blur-sm border-b border-canvas-border/60">
                  <div className="flex items-center justify-center">
                    <Stepper current={current} completed={completed} />
                  </div>
                </div>
              );
            })()}
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
                  <div className={msg.role === 'user' ? 'flex flex-col items-end w-fit max-w-[80%] ml-auto' : 'w-full'}>
                    <div className={msg.role === 'user' ? 'flex flex-col items-end w-full group/msg' : 'w-full group/msg'}>
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

                    {/* No assistant avatar / no brand dot — Claude-style.
                        Identity is carried by alignment (left-flush prose
                        vs. right-side pill) and by the unique typography
                        of each voice. */}

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
                      // ~40px of breathing room directly below the loader.
                      // Combined with the parent's pb-10 (40px), the active
                      // shimmering line lands ~80px above the composer when
                      // auto-scroll snaps to scrollHeight — comfortable
                      // without floating the loader off the top.
                      <div className="w-full" style={{ paddingBottom: 40 }}>
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
                          <div className="text-[15px] leading-[1.65] text-ink-800 max-w-[66ch]">{renderAssistantText(msg.text)}</div>
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

                        {/* KPI scoreboard — mirrors DashboardView's KPI grid
                            exactly: glass-cards (rounded-xl, hairline border,
                            brand-200 hover) in a 2/4-col grid. 11px uppercase
                            label over a 26px bold ink-900 value. Scales to N
                            rows when the result carries many KPIs — same
                            widget, same typography on both surfaces. */}
                        <div role="list" aria-label="Key results" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          {AUDIT_RESULT.kpis.map((kpi, ki) => (
                            <KpiTile key={kpi.label} label={kpi.label} value={kpi.value} index={ki} />
                          ))}
                        </div>

                        {/* Chart — ChartGroup carries its own widget shell
                            (title, toggle, expand button), matched to the
                            ResultsTable below so they read as a pair. */}
                        <ChartGroup charts={AUDIT_RESULT.charts} embedded />

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
                            visual; Save-as-workflow is the only primary CTA. Wraps
                            to multi-row when the chat column narrows (e.g. with both
                            side panels open) — each button keeps its single-line
                            label instead of squeezing into a 2-line text block. */}
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-canvas-border">
                          <ExportReportButton messages={messages} upToMessageId={msg.id} chatTitle={currentChatTitle} />
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
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {((msg.richData?.kpis as { label: string; value: string; color: string }[] | undefined) || []).map((kpi, ki) => (
                          <KpiTile key={kpi.label} label={kpi.label} value={kpi.value} index={ki} />
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
                    ) : msg.richType === 'workflow-clarify' ? (
                      (() => {
                        const data = msg.richData as { questions: ClarifyQuestion[]; phase: 'initial' | 'validate'; index: number; answers: Record<string, string>; stepLabel?: string };
                        const done = data.index >= data.questions.length;
                        // Active state: card is docked above the composer
                        // (matches query clarification placement) — render
                        // nothing inline. Once all answered, leave a quiet
                        // recap so the thread has a trace.
                        if (!done) return null;
                        return (
                          <div className="text-[13px] text-ink-500 leading-relaxed max-w-[66ch]">
                            {data.phase === 'validate' ? 'Validation answers locked in.' : 'Clarifications locked in.'}
                          </div>
                        );
                      })()
                    ) : msg.richType === 'workflow-upload' ? (
                      wfWorkflow ? (
                        <StepUploadFiles
                          workflow={wfWorkflow}
                          files={wfFiles}
                          setFiles={setWfFiles}
                          view="list-only"
                          onOpenUploadModal={() => setWfUploadModalOpen(true)}
                          onViewWorkspace={() => { setArtifactMode("workflow"); setShowArtifacts(true); }}
                        />
                      ) : null
                    ) : msg.richType === 'workflow-map' ? (
                      wfWorkflow ? (
                        <StepMapData
                          workflow={wfWorkflow}
                          files={wfFiles}
                          setFiles={setWfFiles}
                          alignments={wfAlignments}
                          expandedInputId={wfMapExpanded}
                          onToggleExpand={(id) => setWfMapExpanded(prev => prev === id ? null : id)}
                          onConfirm={() => {
                            wfPushAssistant('Mappings confirmed — opening review.');
                            wfPushCard('workflow-review');
                          }}
                          onViewWorkspace={() => { setArtifactMode("workflow"); setShowArtifacts(true); }}
                        />
                      ) : null
                    ) : msg.richType === 'workflow-review' ? (
                      wfWorkflow ? (
                        <StepReviewRun
                          workflow={wfWorkflow}
                          running={wfRunning}
                          result={wfResult}
                          mappings={wfMappings}
                          setMappings={setWfMappings}
                          onValidate={() => {
                            // Mirror the original journey: clicking Validate
                            // opens a brief inline clarify (matching logic +
                            // tolerance) BEFORE the run kicks off. The
                            // validate-phase effect picks up the answers and
                            // pushes the tolerance card + run.
                            if (!wfWorkflow) return;
                            wfPushAssistant("Before I kick off the run, I've spotted a couple of ambiguities — pick what fits below.");
                            wfPushClarify([
                              {
                                id: 'matching-logic',
                                title: 'What matching logic should I use?',
                                options: [
                                  'Exact field matching',
                                  'Fuzzy match with tolerance',
                                  'AI-powered pattern detection',
                                  "Custom rules (I'll define)",
                                ],
                              },
                              {
                                id: 'tolerance-preset',
                                title: 'What tolerance should I apply for amount comparisons?',
                                options: ['Strict (±1%)', 'Moderate (±5%)', 'Relaxed (±10%)', 'Custom'],
                              },
                            ], 'validate', 'Step 4 · Validate Workflow');
                          }}
                          validateDisabled={wfRunning || !!wfResult}
                          onViewWorkspace={() => { setArtifactMode("workflow"); setShowArtifacts(true); }}
                        />
                      ) : null
                    ) : msg.richType === 'workflow-tolerance' ? (
                      <ToleranceAdjustCard
                        state={wfTolerance}
                        onChange={setWfTolerance}
                        onRun={async (next) => {
                          if (!wfWorkflow) return;
                          setWfTolerance(next);
                          setWfRunning(true);
                          const res = await wfRun(wfWorkflow, wfFiles, wfMappings);
                          setWfRunning(false);
                          setWfResult(res);
                          wfPushAssistant(`Finished. The **${res.title}** is ready — ${res.rows.length} rows, ${res.stats.find(s => s.label === 'Records Scanned')?.value ?? '—'} records scanned.`);
                          wfPushCard('workflow-view-preview');
                        }}
                        onReset={() => setWfTolerance({ mode: 'percentage', percentage: 5, absolute: 100, enabled: true })}
                        running={wfRunning}
                        locked={!!wfResult}
                      />
                    ) : msg.richType === 'workflow-view-preview' ? (
                      <ViewPreviewCard
                        revealed={wfViewPreviewRevealedRef.current === msg.id}
                        onClick={() => {
                          wfViewPreviewRevealedRef.current = msg.id;
                          // Force a re-render so revealed=true sticks; flip the
                          // id ref via setMessages no-op (cheap nudge).
                          setMessages(prev => [...prev]);
                          wfPushCard('workflow-output');
                        }}
                      />
                    ) : msg.richType === 'workflow-output' ? (
                      wfWorkflow ? (
                        <StepOutputView
                          workflow={wfWorkflow}
                          running={wfRunning}
                          result={wfResult}
                          onSave={() => setWfSaveModalOpen(true)}
                          saved={wfSaved}
                        />
                      ) : null
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
                        // Editorial margin-note — no pill, no fill, no chrome.
                        // Right-aligned italic prose anchored to the chat
                        // column by a 1px brand-300 vertical rule. Reads as
                        // marginalia in the auditor's own hand, not as a
                        // chat-app bubble. The rule is the entire visual
                        // identity of the user voice; everything else is
                        // type and alignment. Hover row beneath carries
                        // Edit / Copy / Bookmark + the timestamp. Edit mode
                        // promotes the line into an inline textarea (which
                        // does carry a soft fill, since interactive surfaces
                        // need an affordance).
                        editingMsgId === msg.id ? (
                          <AnimatePresence mode="wait">
                            <InlineEditBubble
                              key="edit-bubble"
                              value={editingDraft}
                              onChange={setEditingDraft}
                              onSave={saveEditingMessage}
                              onCancel={cancelEditingMessage}
                            />
                          </AnimatePresence>
                        ) : (
                          <>
                            <div className="px-4 py-2.5 rounded-2xl bg-brand-50 text-ink-800 text-[14px] leading-[1.6] whitespace-pre-wrap break-words">
                              {msg.text}
                            </div>
                            {/* Below the pill: branch arrows + edit pencil.
                                Arrows render only when the user has edited
                                this message at least once (branches.length > 1).
                                Edit pencil is persistent on hover. */}
                            <div className="mt-1.5 flex items-center gap-1 self-end">
                              {msg.branches && msg.branches.length > 1 && (() => {
                                const total = msg.branches.length;
                                const current = msg.branchIndex ?? (total - 1);
                                const atStart = current <= 0;
                                const atEnd = current >= total - 1;
                                return (
                                  <div className="inline-flex items-center gap-0.5 mr-0.5 text-ink-400" role="group" aria-label="Switch between edited versions">
                                    <button
                                      type="button"
                                      onClick={() => switchBranch(msg.id, -1)}
                                      disabled={atStart}
                                      aria-label="Previous version"
                                      title="Previous version"
                                      className="inline-flex items-center justify-center size-6 rounded text-ink-400 hover:text-brand-700 hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                    >
                                      <ChevronLeft size={13} />
                                    </button>
                                    <span className="px-0.5 text-[11px] tabular-nums font-medium text-ink-500" aria-live="polite">
                                      {current + 1} / {total}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => switchBranch(msg.id, 1)}
                                      disabled={atEnd}
                                      aria-label="Next version"
                                      title="Next version"
                                      className="inline-flex items-center justify-center size-6 rounded text-ink-400 hover:text-brand-700 hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                    >
                                      <ChevronRight size={13} />
                                    </button>
                                  </div>
                                );
                              })()}
                              <span className="relative group/edit">
                                <button
                                  type="button"
                                  onClick={() => startEditingMessage(msg.id, msg.text)}
                                  aria-label="Edit message"
                                  className="inline-flex items-center justify-center size-7 rounded-lg text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100"
                                >
                                  <Pencil size={13} />
                                </button>
                                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-brand-900 text-canvas-elevated text-[12px] font-medium whitespace-nowrap opacity-0 delay-300 group-hover/edit:opacity-100 transition-opacity z-10">
                                  Edit
                                </span>
                              </span>
                              {/* Bookmark — persistent when starred (filled),
                                  hover-revealed otherwise. */}
                              <span className="relative group/bookmark">
                                <button
                                  type="button"
                                  onClick={() => toggleBookmark(msg.id, msg.text)}
                                  aria-label={bookmarkedMsgIds.has(msg.id) ? 'Remove bookmark' : 'Bookmark message'}
                                  aria-pressed={bookmarkedMsgIds.has(msg.id)}
                                  className={`inline-flex items-center justify-center size-7 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                                    bookmarkedMsgIds.has(msg.id)
                                      ? 'text-brand-700 hover:bg-brand-50'
                                      : 'text-ink-400 hover:text-brand-700 hover:bg-brand-50 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100'
                                  }`}
                                >
                                  {bookmarkedMsgIds.has(msg.id) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                                </button>
                                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-brand-900 text-canvas-elevated text-[12px] font-medium whitespace-nowrap opacity-0 delay-300 group-hover/bookmark:opacity-100 transition-opacity z-10">
                                  {bookmarkedMsgIds.has(msg.id) ? 'Bookmarked, click to remove' : 'Bookmark'}
                                </span>
                              </span>
                              {/* Copy — hover-revealed; flips to a check for ~1.5s. */}
                              <span className="relative group/usercopy">
                                <button
                                  type="button"
                                  onClick={() => copyMessage(msg)}
                                  aria-label={copiedMsgId === msg.id ? 'Copied' : 'Copy message'}
                                  className="inline-flex items-center justify-center size-7 rounded-lg text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100"
                                >
                                  {copiedMsgId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-brand-900 text-canvas-elevated text-[12px] font-medium whitespace-nowrap opacity-0 delay-300 group-hover/usercopy:opacity-100 transition-opacity z-10">
                                  {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                                </span>
                              </span>
                              {/* Timestamp — sits at the far right, hover-only.
                                  Hovering it reveals the full date+time in a
                                  tooltip below (matches Claude's date-tooltip
                                  direction). */}
                              <span className="relative group/ts ml-1 inline-flex items-center opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity">
                                <span className="text-[11px] tabular-nums text-ink-400 cursor-default">
                                  {formatChatTime(msg.timestamp)}
                                </span>
                                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-brand-900 text-canvas-elevated text-[12px] font-medium whitespace-nowrap opacity-0 delay-300 group-hover/ts:opacity-100 transition-opacity z-10">
                                  {msg.timestamp.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </span>
                              </span>
                            </div>
                          </>
                        )
                      ) : (
                        // Editorial: AI response is prose, not a bubble. No
                        // border, no shadow, no avatar gutter. 15px body /
                        // 1.65 leading per DESIGN.md, capped at 66ch so prose
                        // reads as conversation, not document. Any ```fenced```
                        // code segments are extracted into a CodeBlock toolbar
                        // panel by renderAssistantText.
                        <div className="text-[15px] leading-[1.65] text-ink-800 max-w-[66ch]">
                          {renderAssistantText(msg.text)}
                        </div>
                      )
                    ) : null}

                    {/* Stopped marker — Inter 11px uppercase, matches the
                        follow-up category-label system. No side-stripe.
                        Mono is reserved for verifiable atoms; status is not
                        an atom, so it gets sans like every other state label.
                        Renders only on assistant messages whose generation
                        was halted by the user via Esc / Stop. */}
                    {msg.role === 'assistant' && msg.stopped && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                        <Square size={9} className="text-ink-500" fill="currentColor" />
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
                    ) && (() => {
                      // Claude pattern: action bar is hover-only for older
                      // assistant turns but PERMANENTLY visible on the most
                      // recent one (the message the user is most likely to
                      // act on — copy / rate / retry).
                      const isLastAssistant = msgIdx === messages.length - 1;
                      const visibilityClass = isLastAssistant
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity';
                      return (
                      <div className={`mt-1.5 flex items-center gap-1 ${visibilityClass}`}>
                        {/* Copy */}
                        <span className="relative group/copy">
                          <button
                            type="button"
                            onClick={() => copyMessage(msg)}
                            aria-label={copiedMsgId === msg.id ? 'Copied' : 'Copy message'}
                            className="inline-flex items-center justify-center size-7 rounded-lg text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            {copiedMsgId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                          <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-brand-900 text-canvas-elevated text-[12px] font-medium whitespace-nowrap opacity-0 delay-300 group-hover/copy:opacity-100 transition-opacity z-10">
                            {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                          </span>
                        </span>

                        {/* Thumbs up */}
                        <span className="relative group/up">
                          <button
                            type="button"
                            onClick={() => setFeedback(msg.id, 'up')}
                            aria-label="Mark response as helpful"
                            aria-pressed={feedbackByMsgId[msg.id] === 'up'}
                            className={`inline-flex items-center justify-center size-7 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                              feedbackByMsgId[msg.id] === 'up'
                                ? 'text-brand-700 bg-brand-50'
                                : 'text-ink-400 hover:text-brand-700 hover:bg-brand-50'
                            }`}
                          >
                            <ThumbsUp size={13} />
                          </button>
                          <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-brand-900 text-canvas-elevated text-[12px] font-medium whitespace-nowrap opacity-0 delay-300 group-hover/up:opacity-100 transition-opacity z-10">
                            Give positive feedback
                          </span>
                        </span>

                        {/* Thumbs down */}
                        <span className="relative group/down">
                          <button
                            type="button"
                            onClick={() => setFeedback(msg.id, 'down')}
                            aria-label="Mark response as unhelpful"
                            aria-pressed={feedbackByMsgId[msg.id] === 'down'}
                            className={`inline-flex items-center justify-center size-7 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                              feedbackByMsgId[msg.id] === 'down'
                                ? 'text-brand-700 bg-brand-50'
                                : 'text-ink-400 hover:text-brand-700 hover:bg-brand-50'
                            }`}
                          >
                            <ThumbsDown size={13} />
                          </button>
                          <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-brand-900 text-canvas-elevated text-[12px] font-medium whitespace-nowrap opacity-0 delay-300 group-hover/down:opacity-100 transition-opacity z-10">
                            Give negative feedback
                          </span>
                        </span>

                        {/* Retry */}
                        <span className="relative group/retry">
                          <button
                            type="button"
                            onClick={() => retryFromMessage(msgIdx)}
                            disabled={isTyping}
                            aria-label="Retry response"
                            className="inline-flex items-center justify-center size-7 rounded-lg text-ink-400 hover:text-brand-700 hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <RotateCcw size={13} />
                          </button>
                          <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-brand-900 text-canvas-elevated text-[12px] font-medium whitespace-nowrap opacity-0 delay-300 group-hover/retry:opacity-100 transition-opacity z-10">
                            Retry
                          </span>
                        </span>
                      </div>
                      );
                    })()}

                    {/* Feedback form renders as a centered modal (see the
                        Feedback modal block down by the other modals). The
                        only thing this message still owns is the quiet
                        post-submission "Thanks" confirmation below. */}

                    {/* "Thanks" confirmation after feedback submitted. */}
                    {msg.role === 'assistant' && feedbackSubmittedIds.has(msg.id) && (!feedbackPopover || feedbackPopover.msgId !== msg.id) && (
                      <p className="mt-1.5 text-[11px] text-ink-400">Feedback sent. Thank you.</p>
                    )}
                    </div>

                    {/* Follow-up suggestions — wrapping horizontal flex of
                        small rounded pills under a quiet "What next?" label.
                        Hover lifts the chip to brand-50 and tints the border
                        to brand-200. In our theme: canvas-elevated fill +
                        canvas-border at rest, brand-50 + brand-200 on hover. */}
                    {msg.role === 'assistant' && msg.followUps && msg.followUps.length > 0 && (
                      <div
                        role="region"
                        aria-labelledby={`followups-heading-${msg.id}`}
                        className="mt-3"
                      >
                        <motion.h3
                          key={`${msg.id}-followups-heading`}
                          id={`followups-heading-${msg.id}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                          className="mb-2 text-[12px] font-medium tracking-normal text-ink-900"
                        >
                          What next?
                        </motion.h3>
                        <div className="flex flex-wrap gap-2">
                        {msg.followUps.map((q, i) => {
                          const isSelected = selectedFollowUpByMsgId[msg.id] === q;
                          return (
                            <motion.button
                              key={`${msg.id}-followup-${i}`}
                              type="button"
                              onClick={() => {
                                setSelectedFollowUpByMsgId(prev => ({ ...prev, [msg.id]: q }));
                                handleFollowUpClick(q);
                              }}
                              aria-pressed={isSelected}
                              // Mount cascade — runs every time the chip mounts.
                              // NOT gated on prefersReducedMotion: the user
                              // explicitly asked for the popup animation to
                              // play on chat generation; the cascade is the
                              // signal that "follow-up suggestions arrived".
                              initial={{ opacity: 0, y: 12, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{
                                // Modern one-by-one popup cascade. Each chip
                                // scales + rises over ~480ms with a 130ms
                                // stagger so the eye can clearly track each
                                // chip as it appears. Vercel/Linear expo-out
                                // curve, no spring on entrance so it lands
                                // clean (no wobble at rest).
                                delay: 0.4 + i * 0.13,
                                duration: 0.48,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              whileHover={prefersReducedMotion ? undefined : {
                                y: -1,
                                scale: 1.012,
                                // Featherweight — near-zero mass + very high
                                // stiffness means the chip is at its hover
                                // state almost instantly, like there's nothing
                                // to move. Heavy damping kills any wobble.
                                transition: { type: 'spring', stiffness: 700, damping: 32, mass: 0.12 },
                              }}
                              whileTap={prefersReducedMotion ? undefined : {
                                scale: 0.985,
                                transition: { type: 'spring', stiffness: 800, damping: 34, mass: 0.12 },
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] leading-tight cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                                isSelected
                                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                                  : 'bg-canvas-elevated text-ink-700 border border-canvas-border hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200'
                              }`}
                            >
                              <span>{q}</span>
                            </motion.button>
                          );
                        })}
                        </div>
                      </div>
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
                    {/* No avatar, no dot — Claude-style. The signal is
                        carried by a single quiet beat: either the
                        live-thinking trail (when reasoning steps stream
                        through) or three pulsing dots. Claude never
                        doubles up indicators; the previous skeleton bars
                        competed with the dot pulse and made the surface
                        read as "loading" rather than "thinking". */}

                      {thinkingSteps.length > 0 ? (
                        <div className="mb-2">
                          <div className="pl-3 border-l border-canvas-border space-y-1">
                            {thinkingSteps.map((step, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-[12px] text-ink-500 flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${i === thinkingSteps.length - 1 ? 'bg-primary' : 'bg-brand-200'}`} />
                                {step}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 py-1.5" aria-label="Thinking">
                          <div className="flex gap-1.5 items-center h-5">
                            <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0, ease: 'easeInOut' }} className="w-1.5 h-1.5 rounded-full bg-ink-400" />
                            <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2, ease: 'easeInOut' }} className="w-1.5 h-1.5 rounded-full bg-ink-400" />
                            <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4, ease: 'easeInOut' }} className="w-1.5 h-1.5 rounded-full bg-ink-400" />
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Inline rich messages render the loader + clarification — no global panel */}
        </div>
          {/* Fade removed — the tinted chat-canvas mesh already provides
              ambient separation between the message stream and the composer,
              so a hard-edged gradient strip was just visual noise. */}
          {/* Scroll-to-bottom pill — appears when the user has scrolled up
              more than 100px from the bottom. Click jumps back to the latest.
              z-20 keeps it above any rich result content (action bars,
              hover-action rows) so it never clips on overlap. */}
          <AnimatePresence>
            {showScrollToBottom && (
              <motion.button
                key="scroll-to-bottom"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={scrollToBottom}
                aria-label="Scroll to latest message"
                title="Scroll to latest"
                className="absolute left-1/2 -translate-x-1/2 bottom-5 z-20 inline-flex items-center justify-center size-9 rounded-full bg-canvas-elevated border border-canvas-border text-ink-600 hover:bg-brand-50 hover:text-ink-800 hover:border-brand-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <ArrowDown size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Input area — full 52.5rem column at desktop. Matches the
            messages column's true 52.5rem width so both surfaces span
            edge-to-edge identically. px-4 retained on mobile only. */}
        <div className="shrink-0 pb-2 max-w-[52.5rem] mx-auto w-full px-4 sm:px-0">
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

          {openClarification && (
            // Audit-query clarification — Claude pattern: sits ABOVE the
            // chat composer so the user can either pick an option or
            // bypass the form and reply directly via the composer below.
            <div className="mb-2">
              <ClarificationBlock
                data={openClarification.richData as unknown as ClarificationData}
                onAnswer={(qi, ans) => updateClarificationAnswer(openClarification.id, qi, ans)}
                onSubmit={() => submitClarification(openClarification.id)}
                onSkipAll={() => submitClarification(openClarification.id, true)}
                onSkipCurrent={(qi) => skipClarificationQuestion(openClarification.id, qi)}
              />
            </div>
          )}
          {openWorkflowClarify && openWorkflowClarifyData && (
            // Workflow clarify — same docked treatment as the query
            // clarification above. Mirrors UI + placement so the user
            // doesn't see two different patterns in the same surface.
            <div className="mb-2">
              <ClarificationBlock
                data={openWorkflowClarifyData}
                onAnswer={(_qi, ans) => wfAnswerClarify(openWorkflowClarify.id, ans)}
                onSubmit={() => { /* advancement is driven by wfAnswerClarify; no submit step */ }}
                onSkipAll={() => {
                  // Skip every remaining question by passing null until exhausted.
                  const d = openWorkflowClarify.richData as { questions: ClarifyQuestion[]; index: number };
                  const remaining = (d.questions?.length ?? 0) - (d.index ?? 0);
                  for (let i = 0; i < remaining; i++) wfAnswerClarify(openWorkflowClarify.id, null);
                }}
                onSkipCurrent={() => wfAnswerClarify(openWorkflowClarify.id, null)}
              />
            </div>
          )}
          {(
            <>
              {/* Workflow-mode notice — Claude-style horizontal banner above
                  the composer. Appears once Path 3 has flipped the thread,
                  fades out automatically the moment the user starts typing
                  (input.trim() becomes truthy). No dismiss button — the
                  banner gets out of the way on its own. */}
              <AnimatePresence initial={false}>
                {lockedAsWorkflow && !lockedBannerDismissed && !input.trim() && (
                  <motion.div
                    key="locked-workflow-banner"
                    initial={{ opacity: 0, y: 4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 4, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mb-2 flex items-center gap-2.5 px-1">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 uppercase tracking-[0.08em] shrink-0">
                        <Lock size={11} strokeWidth={2.5} />
                        Workflow mode
                      </span>
                      <span className="text-[12.5px] text-ink-500 flex-1 truncate">
                        Switched at save. Start a new chat for a query.
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Workflow context chip — surfaces the active build (workflow
                  name + current journey step) above the composer so the user
                  always knows where they are in the multi-step flow. Mirrors
                  the original AIAssistantPanel ContextChip. Dismissing clears
                  the workflow state and exits build mode. */}
              {buildWorkflowMode && wfWorkflow && !lockedAsWorkflow && (() => {
                const has = (t: string) => messages.some(m => m.richType === t);
                const stepLabel = has('workflow-output') ? 'Output'
                  : has('workflow-review') ? 'Step 4 · Review'
                  : has('workflow-map') ? 'Step 3 · Map'
                  : has('workflow-upload') ? 'Step 2 · Upload'
                  : 'Step 1 · Clarify';
                return (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-50 text-brand-600 shrink-0">
                      <Workflow size={13} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink-800 truncate">{wfWorkflow.name}</div>
                      <div className="text-[11.5px] text-ink-500 truncate">{stepLabel}</div>
                    </div>
                    <button
                      type="button"
                      aria-label="Exit workflow build"
                      title="Exit workflow build"
                      onClick={() => {
                        setWfWorkflow(null);
                        setWfFiles({});
                        setWfMappings({});
                        setWfAlignments({});
                        setWfResult(null);
                        setWfSaved(false);
                        wfHasPushedClarifyRef.current = false;
                        wfHasPushedMapRef.current = false;
                        wfValidateCompleteRef.current = null;
                        wfUploadModalSeededFor.current = null;
                        wfNudgeUploadRef.current = null;
                      }}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-ink-400 hover:text-ink-700 hover:bg-canvas transition-colors cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })()}

              <div
                className="ai-border relative"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Drop overlay — only renders during an active file drag.
                    Covers the entire composer with a brand-tinted veil + a
                    dashed border so the drop affordance reads at a glance.
                    Reveals on a 120ms fade so it doesn't snap in. */}
                <AnimatePresence>
                  {isDragging && (
                    <motion.div
                      key="composer-drop-overlay"
                      aria-hidden="true"
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-brand-50/85 border-2 border-dashed border-brand-300 pointer-events-none"
                    >
                      <div className="flex items-center gap-2 text-[13px] font-medium text-brand-700">
                        <Paperclip size={14} />
                        <span>Drop to attach</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="rounded-2xl">
                  {/* Attachment chips — picked sources + fresh uploads. Single
                      horizontally-scrolling row inside the composer surface so
                      they read as part of the message you're composing, not
                      as a separate tray. */}
                  {(files.length > 0 || attachedSources.length > 0) && (
                    <div className="composer-chips-row flex items-center gap-1.5 overflow-x-auto px-3 pt-3 pb-1">
                      {attachedSources.map((s, i) => (
                        <div
                          key={`src-${i}`}
                          title={s.kind === 'source' ? s.name : undefined}
                          className="flex items-center gap-1.5 bg-brand-50 text-ink-700 text-[12px] px-2 py-1 rounded-md font-medium border border-brand-100 shrink-0 transition-colors duration-150 hover:border-brand-200"
                        >
                          {s.kind === 'source' && (
                            <>
                              <span className="text-[10px] uppercase font-semibold tracking-[0.06em] text-ink-500">{s.type === 'database' ? 'DB' : s.type === 'api' ? 'API' : s.type === 'cloud' ? 'CLOUD' : s.type === 'session' ? 'SESS' : 'FILE'}</span>
                              <span className="truncate max-w-[10rem]">{s.name}</span>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setAttachedSources(prev => prev.filter((_, j) => j !== i))}
                            className="text-ink-400 hover:text-ink-800 hover:bg-brand-100 ml-0.5 p-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-full transition-colors"
                            aria-label={`Remove ${s.kind === 'source' ? s.name : 'attachment'}`}
                          ><X size={11} /></button>
                        </div>
                      ))}
                      {files.map((f, i) => (
                        <div
                          key={`file-${i}`}
                          title={f.name}
                          className="flex items-center gap-2 bg-canvas-elevated text-ink-800 text-[13px] pl-2 pr-1.5 py-1.5 rounded-lg font-medium border border-canvas-border shrink-0 transition-colors duration-150 hover:border-brand-200"
                        >
                          <span className="inline-flex items-center justify-center size-6 rounded bg-brand-50 text-brand-700 shrink-0">
                            <FileText size={13} />
                          </span>
                          <span className="truncate max-w-[10rem]">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                            className="text-ink-400 hover:text-brand-700 hover:bg-brand-50 ml-0.5 p-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-full transition-colors"
                            aria-label={`Remove ${f.name}`}
                          ><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Textarea — Claude-aligned. Generous side padding so
                      the text reads inside a roomy pill, not against the
                      edge. min-h kept tight so the empty pill stays compact. */}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); handleTextareaInput(); }}
                    onKeyDown={handleKeyDown}
                    onPaste={handleComposerPaste}
                    placeholder={buildWorkflowMode ? 'Describe the workflow you want to build…' : 'Reply to Ira…'}
                    aria-label="Message IRA"
                    className="no-focus-ring w-full bg-transparent border-none outline-none resize-none px-5 pt-4 pb-2 text-[15px] leading-[1.5] text-ink-800 placeholder:text-ink-400 min-h-[24px] max-h-[240px]"
                    rows={1}
                  />

                  {/* Action row — Claude exact shape: single "+" attach on
                      the left; quiet text+chevron "Query / Workflow" picker
                      on the right; Send button ONLY when there is input or
                      an attachment. Empty composer hides Send entirely. */}
                  <div className="flex items-center justify-between gap-2 px-3 pb-4">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowDataPicker(true)}
                        aria-label="Attach data sources or files"
                        title="Attach data or files"
                        className="inline-flex items-center justify-center size-8 rounded-lg text-ink-500 hover:bg-brand-50 hover:text-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <Plus size={18} strokeWidth={2} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Mode is locked for any started thread — query chats
                          must go through Save-as-workflow, workflow chats
                          can't switch back to query. Either way: in-thread
                          toggle is read-only. The hero-composer version
                          (empty state) stays toggleable. */}
                      {(() => {
                        const modeLocked = true;
                        const isWorkflow = buildWorkflowMode;
                        return (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={buildWorkflowMode}
                            aria-label={lockedAsWorkflow ? 'Workflow mode (locked for this thread)' : 'Query mode (locked — use Save as workflow to convert)'}
                            aria-disabled={modeLocked}
                            title={
                              lockedAsWorkflow
                                ? 'Workflow mode — locked for this thread. Start a new chat for a query.'
                                : 'Query mode — locked. Use Save as workflow to convert this chat.'
                            }
                            onClick={() => { /* locked; no-op */ }}
                            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[13px] font-semibold cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                              isWorkflow
                                ? 'bg-brand-600 text-white'
                                : 'bg-canvas border border-canvas-border text-ink-500'
                            }`}
                          >
                            <Lock size={11} strokeWidth={2.5} className="shrink-0" />
                            {isWorkflow ? 'Workflow' : 'Query'}
                          </button>
                        );
                      })()}

                      {isTyping ? (
                        <button
                          type="button"
                          onClick={stopGenerating}
                          aria-label="Stop generating"
                          title="Stop generating (Esc)"
                          className="inline-flex items-center justify-center size-8 rounded-lg bg-ink-900 text-canvas-elevated hover:bg-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <Square size={11} fill="currentColor" />
                        </button>
                      ) : (input.trim() || files.length > 0 || attachedSources.length > 0) ? (
                        <button
                          type="button"
                          onClick={handleSend}
                          aria-label="Send message"
                          title="Send · Enter to send, Shift+Enter for new line"
                          className="inline-flex items-center justify-center size-8 rounded-lg bg-primary text-white hover:bg-primary-hover active:bg-brand-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <ArrowUp size={16} strokeWidth={2.25} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Below the composer: when clarification is open, surface the
              keyboard-hint trio centered (Claude pattern). Otherwise the
              standard "may display inaccurate info" disclaimer. */}
          {openClarification ? (
            <div className="mt-2 flex items-center justify-center gap-2 text-[12px] text-ink-400">
              <span><span className="text-ink-500">↑↓</span> to navigate</span>
              <span aria-hidden="true" className="text-canvas-border">·</span>
              <span><span className="text-ink-500">Enter</span> to select</span>
              <span aria-hidden="true" className="text-canvas-border">·</span>
              <span>or type below</span>
            </div>
          ) : (
            <p className="mt-2 text-center text-[12px] leading-tight text-ink-300">
              Irame.ai may display inaccurate info, including about people, so double-check its responses.
            </p>
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

      {/* Feedback modal — centered, opens on click of 👍 / 👎 on any
          assistant message. Carries a reason dropdown for 👎 (Claude
          pattern) and a textarea for the open-ended note. */}
      <AnimatePresence>
        {feedbackPopover && (
          <motion.div
            key="feedback-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={cancelFeedback}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px]"
          >
            <motion.div
              key="feedback-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-modal-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); cancelFeedback(); }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitFeedback(); }
              }}
              className="w-[32rem] max-w-[92vw] rounded-2xl bg-canvas-elevated border border-canvas-border p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 id="feedback-modal-title" className="text-[15px] font-semibold text-ink-800 mb-1">
                    {feedbackPopover.kind === 'up' ? 'What did you like about this response?' : 'What was unsatisfying about this response?'}
                  </h2>
                  <p className="text-[12px] text-ink-500">Your feedback helps Ira improve. Optional.</p>
                </div>
                <button
                  type="button"
                  onClick={cancelFeedback}
                  aria-label="Close"
                  className="inline-flex items-center justify-center size-7 rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
              {feedbackPopover.kind === 'down' && (
                <div className="mb-3">
                  <label
                    htmlFor="feedback-reason-trigger"
                    className="block text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] mb-1.5"
                  >
                    What type of issue do you wish to report?
                  </label>
                  {/* Custom dropdown replacing the native <select> so the
                      open panel matches the app theme (light surface, brand
                      hover, rounded corners) instead of the OS-default dark
                      popover. Click-outside / Escape close handled by the
                      effect on feedbackReasonOpen. */}
                  <div ref={feedbackReasonRef} className="relative">
                    <button
                      id="feedback-reason-trigger"
                      type="button"
                      onClick={() => setFeedbackReasonOpen(o => !o)}
                      aria-haspopup="listbox"
                      aria-expanded={feedbackReasonOpen}
                      className={`w-full flex items-center justify-between gap-2 bg-canvas-elevated border rounded-lg px-3 h-10 text-[13px] text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        feedbackReasonOpen ? 'border-brand-400' : 'border-canvas-border hover:border-ink-300'
                      }`}
                    >
                      <span className={feedbackReason ? 'text-ink-800 truncate' : 'text-ink-400 truncate'}>
                        {feedbackReason || 'Select an issue…'}
                      </span>
                      <motion.span
                        animate={{ rotate: feedbackReasonOpen ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 480, damping: 28 }}
                        className="inline-flex shrink-0"
                      >
                        <ChevronDown
                          size={14}
                          strokeWidth={2.25}
                          className={feedbackReasonOpen ? 'text-brand-500' : 'text-ink-400'}
                        />
                      </motion.span>
                    </button>
                    <AnimatePresence>
                      {feedbackReasonOpen && (
                        <motion.div
                          role="listbox"
                          aria-labelledby="feedback-reason-trigger"
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                          style={{ transformOrigin: 'top center' }}
                          className="absolute z-10 left-0 right-0 top-full mt-1.5 rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_16px_36px_-16px_rgba(15,8,30,0.22),0_4px_10px_-4px_rgba(15,8,30,0.08)] overflow-hidden py-1 max-h-72 overflow-y-auto"
                        >
                          {FEEDBACK_REASONS.map((r) => {
                            const isSelected = feedbackReason === r;
                            return (
                              <button
                                key={r}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setFeedbackReason(r);
                                  setFeedbackReasonOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 h-9 text-left text-[13px] transition-colors cursor-pointer focus:outline-none ${
                                  isSelected
                                    ? 'bg-brand-50 text-brand-800 font-medium'
                                    : 'text-ink-800 hover:bg-brand-50/60 hover:text-ink-900'
                                }`}
                              >
                                <span className="flex-1 truncate">{r}</span>
                                {isSelected && (
                                  <Check size={13} strokeWidth={2.5} className="text-brand-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              <textarea
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                autoFocus
                rows={4}
                placeholder={feedbackPopover.kind === 'up' ? 'Was it accurate? Well-explained? Saved you time?' : 'Describe what was wrong (optional)'}
                className="no-focus-ring w-full bg-canvas-elevated border border-canvas-border hover:border-ink-300 rounded-lg px-3 py-2.5 text-[13px] leading-[1.5] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors resize-none"
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelFeedback}
                  className="inline-flex items-center h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-700 hover:text-ink-800 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitFeedback}
                  className="inline-flex items-center h-9 px-4 rounded-lg text-[13px] font-semibold bg-primary text-white hover:bg-primary-hover active:bg-brand-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Send feedback
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New-chat confirmation — appears when the user tries to start a
          fresh chat while a generation is in flight. Guards against losing
          the in-progress response by accident. */}
      <AnimatePresence>
        {newChatConfirmAfter && (
          <motion.div
            key="new-chat-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={() => setNewChatConfirmAfter(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px]"
          >
            <motion.div
              key="new-chat-confirm-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="new-chat-confirm-title"
              aria-describedby="new-chat-confirm-body"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); setNewChatConfirmAfter(null); }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  newChatConfirmAfter?.();
                  setNewChatConfirmAfter(null);
                }
              }}
              className="w-[28rem] max-w-[92vw] rounded-2xl bg-canvas-elevated border border-canvas-border p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="size-9 rounded-lg bg-risk-50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={16} className="text-risk-700" />
                </div>
                <div>
                  <h2 id="new-chat-confirm-title" className="text-[15px] font-semibold text-ink-900 mb-1">
                    Discard in-progress response?
                  </h2>
                  <p id="new-chat-confirm-body" className="text-[12.5px] text-ink-500 leading-relaxed">
                    Ira is still generating. Starting a new chat will stop this response and clear the thread.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewChatConfirmAfter(null)}
                  className="inline-flex items-center h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-700 hover:text-ink-900 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Keep generating
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    newChatConfirmAfter?.();
                    setNewChatConfirmAfter(null);
                  }}
                  className="inline-flex items-center h-9 px-4 rounded-lg text-[13px] font-semibold bg-risk text-white hover:bg-risk-600 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-risk/40"
                >
                  Discard & start new
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard-shortcuts help modal — opens on Cmd/Ctrl + /. Lists the
          Claude-aligned shortcuts the chat surface supports. */}
      <AnimatePresence>
        {showShortcutsModal && (
          <motion.div
            key="shortcuts-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={() => setShowShortcutsModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px]"
          >
            <motion.div
              key="shortcuts-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="shortcuts-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowShortcutsModal(false); }}
              className="w-[28rem] max-w-[92vw] rounded-2xl bg-canvas-elevated border border-canvas-border p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="shortcuts-title" className="text-[15px] font-semibold text-ink-800">Keyboard shortcuts</h2>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  aria-label="Close"
                  className="inline-flex items-center justify-center size-7 rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <X size={14} />
                </button>
              </div>
              <ul className="space-y-2.5">
                {[
                  { label: 'New chat', keys: ['⌘', '⇧', 'O'] },
                  { label: 'Toggle chat history', keys: ['⌘', '.'] },
                  { label: 'Show this shortcuts panel', keys: ['⌘', '/'] },
                  { label: 'Send message', keys: ['↵'] },
                  { label: 'New line in composer', keys: ['⇧', '↵'] },
                  { label: 'Stop generating', keys: ['Esc'] },
                  { label: 'Edit last message (when composer empty)', keys: ['↑'] },
                ].map(({ label, keys }) => (
                  <li key={label} className="flex items-center justify-between gap-4">
                    <span className="text-[13px] text-ink-700">{label}</span>
                    <span className="inline-flex items-center gap-1">
                      {keys.map((k, i) => (
                        <kbd key={i} className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-canvas border border-canvas-border text-[11px] font-medium font-mono text-ink-700 tabular-nums">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-ink-400">Cmd on Mac, Ctrl on Windows / Linux.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data picker modal — attach existing sources or upload fresh files */}
      <DataPickerModal
        open={showDataPicker}
        onClose={() => setShowDataPicker(false)}
        onConfirm={handleDataPickerConfirm}
      />

      {/* Workflow build — upload modal (auto-opens once at Step 2 / Upload) */}
      <UploadDataModal
        open={wfUploadModalOpen}
        onClose={() => {
          setWfUploadModalOpen(false);
          // If all required inputs are now filled, advance to map step.
          if (wfWorkflow) {
            const required = wfWorkflow.inputs.filter(i => i.required);
            const allFilled = required.every(i => (wfFiles[i.id] ?? []).length > 0);
            if (allFilled) {
              wfPushAssistant('Files verified — moving to data mapping.');
              wfPushCard('workflow-map');
            }
          }
        }}
        workflow={wfWorkflow ?? null}
        files={wfFiles}
        setFiles={setWfFiles}
        onAttachDraft={({ files: pickedFiles }) => {
          setWfDraftAttachments(prev => [...prev, ...pickedFiles]);
        }}
      />

      {/* Workflow build — save modal (terminal step) */}
      {wfWorkflow && (
        <SaveWorkflowModal
          open={wfSaveModalOpen}
          onClose={() => setWfSaveModalOpen(false)}
          workflow={wfWorkflow}
          onConfirm={(payload) => {
            setWfSaveModalOpen(false);
            setWfSaved(true);
            wfPushAssistant(`**${payload.name}** saved to **${payload.businessProcess} · ${payload.racm}**.`);
          }}
        />
      )}

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
