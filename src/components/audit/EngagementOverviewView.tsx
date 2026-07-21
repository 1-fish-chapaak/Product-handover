import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  ArrowLeft, ArrowUpRight, AlertTriangle, Calendar,
  CheckCircle2, Clock, FileText, FolderOpen, Layers, Play,
  Shield, ShieldCheck, Sparkles, User, Workflow, Zap, Upload,
  ChevronRight, Plus, Activity, MessageSquare, ListChecks,
  RefreshCw, X, Settings, Database, BookOpen, Search, ArrowUpDown,
  LayoutDashboard, Table2, GripHorizontal, Eye, EyeOff, Share2,
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import Gated from '../shared/Gated';
import InsightGenerator from '../shared/InsightGenerator';
import AIRecommendsPopover from '../shared/AIRecommendsPopover';
import { actionableWorkflowRecs, isPricingSubject, type BuildInsightInput } from '../../data/layeredInsights';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import {
  ENGAGEMENTS,
  PROCESS_COLORS,
  type AutomationSubtype,
  type Engagement,
  type EngType,
  type EngStatus,
  type ProcessCode,
} from '../../data/engagements';
import {
  ENGAGEMENT_ACTIVITY,
  AVG_TIME_TO_CLOSE,
  dailyCounts,
  formatDay,
  formatChartDay,
  type ActivityEvent,
  type ActivityType,
} from '../../data/engagement-activity';
import {
  exceptionsForEngagement,
  groupByWorkflow,
  type EngagementException,
  type Severity,
} from '../../data/engagement-exceptions';
import EngagementExceptionDrawer from './EngagementExceptionDrawer';
import RACMTab from './RACMTab';
import ControlsTab from './ControlsTab';
import EvidenceTab from './EvidenceTab';
import WorkingPaperTab from './WorkingPaperTab';
import { BulkExecuteModal, Checkbox } from '../workflow/BulkExecuteModal';
import type { LibraryWorkflow } from '../workflow/WorkflowLibraryView';
import LinkWorkflowModal from './LinkWorkflowModal';
import { EngagementWorkspaceProvider, useEngagementWorkspace } from './engagementWorkspace';
import ActionTrailReportModal from './ActionTrailReportModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'racm' | 'controls' | 'workflows' | 'evidence' | 'exceptions' | 'trail' | 'working-paper' | 'config';

interface Props {
  engagementId: string;
  onBack: () => void;
  onOpenExecution: (engagementId: string) => void;
  onOpenCaseManagement: (engagementId: string) => void;
  onOpenRacmFullEditor?: (override?: { racmName?: string; processLabel?: string }) => void;
  onLaunchWorkflowBuilder?: (seedPrompt: string) => void;
  /** Open a workflow's detail page (same route the Workflow Library uses). */
  onOpenWorkflow?: (libraryWorkflowId: string) => void;
  /** Open the Workflow Executor for a workflow (used to test an automated control attribute). */
  onRunWorkflow?: (workflowId: string) => void;
  /** Launch the Ask IRA workflow-builder chat scoped to this engagement. */
  onCreateWorkflowForEngagement?: (engagementName: string) => void;
}

// ─── Tabs per engagement type ─────────────────────────────────────────────────

/**
 * Per-sub-page icon + a bright, business-colorful chip class. The chip is a
 * literal Tailwind string (no interpolation) so the classes survive purge.
 */
const TAB_META: Record<TabId, { icon: React.ElementType; chip: string }> = {
  overview:        { icon: LayoutDashboard, chip: 'bg-blue-50 text-blue-600' },
  racm:            { icon: Table2,          chip: 'bg-violet-50 text-violet-600' },
  controls:        { icon: ShieldCheck,     chip: 'bg-emerald-50 text-emerald-600' },
  workflows:       { icon: Workflow,        chip: 'bg-cyan-50 text-cyan-600' },
  evidence:        { icon: FolderOpen,      chip: 'bg-amber-50 text-amber-600' },
  exceptions:      { icon: AlertTriangle,   chip: 'bg-rose-50 text-rose-600' },
  'working-paper': { icon: BookOpen,        chip: 'bg-teal-50 text-teal-600' },
  trail:           { icon: Activity,        chip: 'bg-fuchsia-50 text-fuchsia-600' },
  config:          { icon: Settings,        chip: 'bg-slate-100 text-slate-600' },
};

function tabsForType(type: EngType): { id: TabId; label: string; icon: React.ElementType }[] {
  const mk = (id: TabId, label: string) => ({ id, label, icon: TAB_META[id].icon });
  switch (type) {
    case 'Automation':
      return [mk('overview', 'Overview'), mk('workflows', 'Workflows'), mk('exceptions', 'Exception Management'), mk('trail', 'Action Trail'), mk('config', 'Configuration')];
    case 'Compliance':
    case 'SOX / ICFR':
      // SOX/ICFR opens its own dedicated experience; this fallback keeps the type exhaustive.
      // Workflows tab removed — attribute→workflow mapping now lives inline on the Controls tab.
      return [mk('overview', 'Overview'), mk('racm', 'RACM'), mk('controls', 'Controls'), mk('evidence', 'Evidence'), mk('working-paper', 'Working Paper'), mk('trail', 'Action Trail'), mk('config', 'Configuration')];
    case 'Internal Audit':
      return [mk('overview', 'Overview'), mk('racm', 'RACM'), mk('controls', 'Controls'), mk('workflows', 'Workflows'), mk('exceptions', 'Exception Management'), mk('working-paper', 'Audit Report'), mk('trail', 'Action Trail'), mk('config', 'Configuration')];
  }
}

/** Per-engagement-type tab order + hidden set, persisted in localStorage. */
type TabPrefs = { order: TabId[]; hidden: TabId[] };

function loadTabPrefs(type: EngType): TabPrefs {
  const canonical = tabsForType(type).map(t => t.id);
  try {
    const raw = localStorage.getItem(`eng-tab-prefs:${type}`);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TabPrefs>;
      const stored = Array.isArray(p.order) ? p.order : [];
      // Keep stored order, drop ids no longer valid, append any newly-added tabs.
      const order = [...stored.filter(id => canonical.includes(id)), ...canonical.filter(id => !stored.includes(id))];
      // Configuration can never be hidden (it's where you re-enable the others).
      const hidden = (Array.isArray(p.hidden) ? p.hidden : []).filter(id => canonical.includes(id) && id !== 'config');
      return { order, hidden };
    }
  } catch { /* ignore malformed prefs */ }
  return { order: canonical, hidden: [] };
}

// ─── Mock content (per type — kept small + realistic) ─────────────────────────

const MOCK_CONTROLS: Record<string, { id: string; ref: string; name: string; status: 'Effective' | 'In Test' | 'Failed' | 'Pending'; key: boolean }[]> = {
  default: [
    { id: 'c1', ref: 'P2P-C-01', name: 'Vendor master add/change requires dual approval', status: 'Effective', key: true },
    { id: 'c2', ref: 'P2P-C-02', name: 'PO approval threshold enforced by amount tier', status: 'Effective', key: true },
    { id: 'c3', ref: 'P2P-C-03', name: 'Three-way match (PO · GRN · Invoice) before payment', status: 'In Test', key: true },
    { id: 'c4', ref: 'P2P-C-04', name: 'Duplicate invoice prevention check on AP posting', status: 'Failed', key: false },
    { id: 'c5', ref: 'P2P-C-05', name: 'Segregation of duties between PO creator and approver', status: 'Effective', key: true },
    { id: 'c6', ref: 'P2P-C-06', name: 'Payment release dual sign-off above ₹10L threshold', status: 'Pending', key: true },
    { id: 'c7', ref: 'P2P-C-07', name: 'Bank account change call-back verification', status: 'Effective', key: true },
    { id: 'c8', ref: 'P2P-C-08', name: 'GRN quantity tolerance check at receipt', status: 'Effective', key: false },
    { id: 'c9', ref: 'P2P-C-09', name: 'Non-PO spend coding review before posting', status: 'Failed', key: false },
    { id: 'c10', ref: 'P2P-C-10', name: 'Month-end AP accrual completeness review', status: 'In Test', key: false },
    { id: 'c11', ref: 'P2P-C-11', name: 'One-time vendor usage monitoring', status: 'Effective', key: false },
    { id: 'c12', ref: 'P2P-C-12', name: 'Credit note matched to original before refund', status: 'Pending', key: false },
  ],
};

type InputSource = 'Excel' | 'PDF' | 'SQL';
type Cadence = { kind: 'Frequency'; label: string } | { kind: 'Ad-hoc' };

interface MockWorkflow {
  id: string;
  code: string;
  name: string;
  type: string;
  inputs: InputSource[];
  cadence: Cadence;
  lastRun: string;
  status: 'Success' | 'Failed' | 'Running';
  /** Sub-process within the engagement's process. */
  subProcess: string;
  /** True positives / total fires over 90 days — for effectiveness scoring. */
  truePositives: number;
  totalFires: number;
  /** Library workflow id this engagement workflow corresponds to — opens the same detail page as the Workflow Library. */
  libraryId: string;
}

const MOCK_WORKFLOWS: MockWorkflow[] = [
  { id: 'wf1', code: 'WF-P2P-001', name: 'Three-Way Match (PO · GRN · Invoice)', type: 'Reconciliation', inputs: ['Excel', 'PDF'], cadence: { kind: 'Frequency', label: 'Daily 6 AM' }, lastRun: '2h ago', status: 'Success', subProcess: 'Invoice Processing', truePositives: 38, totalFires: 47, libraryId: 'lw-006' },
  { id: 'wf2', code: 'WF-P2P-002', name: 'Duplicate Invoice Detector',           type: 'Detection',      inputs: ['SQL'],          cadence: { kind: 'Frequency', label: 'Hourly' },    lastRun: '8m ago',  status: 'Success', subProcess: 'Invoice Processing',         truePositives: 52, totalFires: 84, libraryId: 'lw-010' },
  { id: 'wf3', code: 'WF-P2P-003', name: 'PO Approval Threshold Scan',           type: 'Compliance',     inputs: ['SQL'],          cadence: { kind: 'Ad-hoc' },                       lastRun: '12h ago', status: 'Running', subProcess: 'Purchase Order Management',  truePositives: 12, totalFires: 28, libraryId: 'lw-009' },
  { id: 'wf4', code: 'WF-P2P-004', name: 'Vendor Master Change Monitor',          type: 'Monitoring',     inputs: ['Excel', 'SQL'], cadence: { kind: 'Frequency', label: 'Hourly' },    lastRun: '34m ago', status: 'Success', subProcess: 'Vendor Onboarding',          truePositives: 14, totalFires: 22, libraryId: 'lw-001' },
];

/** Engagement workflow set shared with the Controls/RACM tabs via the workspace store. */
const WORKSPACE_WORKFLOWS = MOCK_WORKFLOWS.map(w => ({ id: w.id, code: w.code, name: w.name }));

function effectivenessTier(pct: number): { label: string; tone: string; bar: string } {
  if (pct >= 80) return { label: 'High', tone: 'text-compliant-700', bar: 'bg-compliant' };
  if (pct >= 60) return { label: 'Medium', tone: 'text-mitigated-700', bar: 'bg-mitigated-500' };
  return { label: 'Low signal', tone: 'text-risk-700', bar: 'bg-risk' };
}

/** Visual style per input source. SQL gets a distinct evidence-blue treatment because it's the live/connected source. */
const INPUT_BADGE_CLS: Record<InputSource, string> = {
  Excel: 'bg-surface-2 text-text-secondary border-border-light',
  PDF:   'bg-surface-2 text-text-secondary border-border-light',
  SQL:   'bg-evidence-50 text-evidence-700 border-evidence-100',
};

const MOCK_EVIDENCE: { id: string; name: string; kind: 'PDF' | 'XLSX' | 'CSV' | 'IMG'; size: string; uploaded: string; uploader: string }[] = [
  { id: 'e1', name: 'Walkthrough notes — P2P FY26.pdf', kind: 'PDF', size: '1.4 MB', uploaded: '2d ago', uploader: 'Tushar Goel' },
  { id: 'e2', name: 'Control testing sample — Q4.xlsx', kind: 'XLSX', size: '320 KB', uploaded: '4d ago', uploader: 'Neha Joshi' },
  { id: 'e3', name: 'Vendor master extract.csv', kind: 'CSV', size: '12 MB', uploaded: '1w ago', uploader: 'Priya Singh' },
  { id: 'e4', name: 'PO approval screenshot.png', kind: 'IMG', size: '480 KB', uploaded: '1w ago', uploader: 'Tushar Goel' },
];

// ─── Visual maps ──────────────────────────────────────────────────────────────

const TYPE_CLS: Record<EngType, string> = {
  Compliance: 'bg-brand-50 text-brand-700 border-brand-100',
  'Internal Audit': 'bg-evidence-50 text-evidence-700 border-evidence-100',
  Automation: 'bg-compliant-50 text-compliant-700 border-compliant-100',
  'SOX / ICFR': 'bg-brand-100 text-brand-800 border-brand-200',
};
const TYPE_LABEL: Record<EngType, string> = {
  Compliance: 'Compliance',
  'Internal Audit': 'Internal Audit',
  Automation: 'Automation',
  'SOX / ICFR': 'SOX / ICFR',
};
const SUBTYPE_LABEL: Record<AutomationSubtype, string> = {
  CCM: 'CCM',
  Reconciliation: 'Reconciliation',
  MIS: 'MIS',
  Forensic: 'Forensic',
  'Image Analytics': 'Image Analytics',
  Custom: 'Custom',
};
const STATUS_CLS: Record<Engagement['status'], string> = {
  Active: 'bg-compliant-50 text-compliant-700',
  'In Progress': 'bg-evidence-50 text-evidence-700',
  Review: 'bg-mitigated-50 text-mitigated-700',
  Planned: 'bg-brand-50 text-brand-700',
  Draft: 'bg-draft-50 text-draft-700',
  Closed: 'bg-canvas text-ink-600',
};
const CONTROL_STATUS_CLS: Record<string, string> = {
  Effective: 'bg-compliant-50 text-compliant-700',
  'In Test': 'bg-evidence-50 text-evidence-700',
  Failed: 'bg-risk-50 text-risk-700',
  Pending: 'bg-draft-50 text-draft-700',
};

function healthTier(pct: number): { bar: string; text: string } {
  if (pct >= 85) return { bar: 'bg-compliant', text: 'text-compliant-700' };
  if (pct >= 65) return { bar: 'bg-mitigated-500', text: 'text-mitigated-700' };
  return { bar: 'bg-risk', text: 'text-risk-700' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EngagementDetailView({ engagementId, onBack, onOpenExecution, onOpenRacmFullEditor, onLaunchWorkflowBuilder, onOpenWorkflow, onRunWorkflow, onCreateWorkflowForEngagement }: Props) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { openShare } = useShare();
  const engagement = useMemo(() => ENGAGEMENTS.find(e => e.id === engagementId), [engagementId]);

  // Default the tab to overview; pick the first tab for the type once we know the engagement.
  const tabs = useMemo(() => engagement ? tabsForType(engagement.type) : [], [engagement]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [configWorkflow, setConfigWorkflow] = useState<string | null>(null);
  // Control to auto-open in the Evidence tab's Attribute Testing step (from Controls → "Test evidence").
  const [evidenceTarget, setEvidenceTarget] = useState<string | null>(null);

  // Tab order + hidden set — drag to reorder, toggle visibility from Configuration; persisted per type.
  const [tabPrefs, setTabPrefs] = useState<TabPrefs>(() => engagement ? loadTabPrefs(engagement.type) : { order: [], hidden: [] });
  const engType = engagement?.type;
  useEffect(() => { if (engType) setTabPrefs(loadTabPrefs(engType)); }, [engType]);
  useEffect(() => { if (engType) localStorage.setItem(`eng-tab-prefs:${engType}`, JSON.stringify(tabPrefs)); }, [engType, tabPrefs]);
  // If the active tab gets hidden, fall back to the first visible tab.
  useEffect(() => {
    if (tabPrefs.hidden.includes(activeTab)) {
      const firstVisible = tabPrefs.order.find(id => !tabPrefs.hidden.includes(id));
      if (firstVisible) setActiveTab(firstVisible);
    }
  }, [tabPrefs, activeTab]);

  if (!engagement) {
    return (
      <div className="h-full overflow-y-auto bg-white">
        <div className="p-8">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
            <ArrowLeft size={14} />Back to Engagements
          </button>
          <div className="glass-card p-12 text-center">
            <p className="text-[0.875rem] font-semibold text-text mb-1">Engagement not found</p>
            <p className="text-[0.75rem] text-text-muted">It may have been deleted or moved.</p>
          </div>
        </div>
      </div>
    );
  }

  const eng = engagement;
  const health = healthTier(eng.health);
  const notStarted = eng.health === 0 && (eng.status === 'Planned' || eng.status === 'Draft');
  const processColor = PROCESS_COLORS[eng.process];

  // Visible, ordered tabs (honoring drag order + hidden set).
  const tabDefById = new Map(tabs.map(t => [t.id, t]));
  const visibleTabIds = tabPrefs.order.filter(id => !tabPrefs.hidden.includes(id) && tabDefById.has(id));
  const visibleTabs = visibleTabIds.map(id => tabDefById.get(id)!);

  // Map a reorder of the visible subset back onto the full order (hidden tabs keep their slots).
  const reorderVisibleTabs = (newVisible: TabId[]) => {
    setTabPrefs(prev => {
      const order = [...prev.order];
      let vi = 0;
      for (let i = 0; i < order.length; i += 1) {
        if (!prev.hidden.includes(order[i]!) && tabDefById.has(order[i]!)) order[i] = newVisible[vi++]!;
      }
      return { ...prev, order };
    });
  };
  const toggleTabHidden = (id: TabId) => {
    if (id === 'config') return; // never hide the tab that re-enables the others
    setTabPrefs(prev => ({
      ...prev,
      hidden: prev.hidden.includes(id) ? prev.hidden.filter(x => x !== id) : [...prev.hidden, id],
    }));
  };

  /**
   * Open the full Case Management workspace in a NEW browser tab, deep-linked to
   * this engagement and optionally pre-filtered. Used ONLY from the Exception
   * Management sub-tab — the deep triage surface genuinely belongs in its own tab.
   */
  const openCaseWorkspace = (filter?: { severity?: Severity; workflowId?: string; status?: EngagementException['status'] }) => {
    const params = new URLSearchParams();
    params.set('view', 'engagement-case-management');
    params.set('eng', eng.id);
    if (filter?.severity) params.set('severity', filter.severity);
    if (filter?.workflowId) params.set('workflow', filter.workflowId);
    if (filter?.status) params.set('status', filter.status);
    window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
  };

  // Overview drill-downs navigate to the relevant SUB-TAB in this same browser
  // tab (a dashboard should route you deeper into the engagement, not pop a new
  // window). Compliance has no exceptions tab, so it falls back to the workspace.
  const hasExceptionsTab = visibleTabIds.includes('exceptions');
  // Compliance has no Workflows tab — its overview "Controls in Scope" KPI lands on Controls instead.
  const goToWorkflowsTab = () => setActiveTab(eng?.type === 'Compliance' ? 'controls' : 'workflows');
  const goToExceptionsTab = () => {
    if (hasExceptionsTab) setActiveTab('exceptions');
    else openCaseWorkspace();
  };

  // KPI strip — adapt the secondary numbers to the engagement type.
  const tested = Math.round(eng.controls * (eng.health > 0 ? eng.health / 100 : 0));
  const failed = eng.openIssues;
  const effective = Math.max(0, tested - failed);

  // Non-Automation types keep the engagement-level 6-card grid.
  const kpis = [
    { label: 'Controls in Scope', value: eng.controls, icon: Shield },
    { label: 'Tested', value: notStarted ? '—' : tested, icon: CheckCircle2 },
    { label: 'Effective', value: notStarted ? '—' : effective, icon: ShieldCheck },
    { label: 'Failed', value: notStarted ? '—' : failed, icon: AlertTriangle },
    { label: 'Workflows', value: MOCK_WORKFLOWS.length, icon: Workflow },
    { label: 'Evidence', value: MOCK_EVIDENCE.length, icon: FolderOpen },
  ];

  // Overview checklist — universal but slightly adapted per type.
  const checklist = eng.type === 'Automation'
    ? [
        { key: 'scope',    label: 'Define scope',               desc: 'Identify the data streams, controls, or accounts this automation covers.', done: true,  icon: Layers },
        { key: 'workflows',label: 'Configure workflows',        desc: 'Set up the workflow(s) and their input sources.',                          done: true,  icon: Workflow },
        { key: 'rules',    label: 'Tune detection rules',       desc: 'Calibrate thresholds and business rules to balance signal vs. noise.',     done: true,  icon: Zap },
        { key: 'routing',  label: 'Configure exception routing',desc: 'Assign owners and escalation rules for triggered exceptions.',             done: eng.health > 70, icon: AlertTriangle },
        { key: 'live',     label: 'Go live',                    desc: 'Activate the automation so it runs on its scheduled or ad-hoc cadence.',   done: eng.status === 'Active' || eng.status === 'In Progress', icon: Play },
      ]
    : [
        { key: 'scope',    label: 'Confirm engagement scope',    desc: 'Lock the controls and processes in scope for this engagement.',  done: true,  icon: Layers },
        { key: 'racm',     label: 'Map RACM',                    desc: 'Link the RACM version being tested for this engagement.',        done: true,  icon: FileText },
        { key: 'team',     label: 'Assign owner and reviewer',   desc: 'Owner runs testing; reviewer signs off on conclusions.',         done: true,  icon: User },
        { key: 'workflows',label: 'Link test workflows',         desc: 'Workflows automate sampling and evidence collection.',           done: eng.health > 0, icon: Workflow },
        { key: 'testing',  label: 'Complete testing',            desc: 'Test every key control and record results.',                     done: eng.health >= 95, icon: CheckCircle2 },
        { key: 'evidence', label: 'Attach evidence',             desc: 'Upload working papers, walkthroughs, and supporting docs.',      done: eng.health > 50, icon: Upload },
        { key: 'signoff',  label: 'Sign-off',                    desc: 'Reviewer signs off when testing is complete and evidence sufficient.', done: eng.status === 'Closed', icon: ShieldCheck },
      ];
  const completedCount = checklist.filter(c => c.done).length;
  const completedPct = Math.round((completedCount / checklist.length) * 100);

  return (
    <EngagementWorkspaceProvider engagement={eng} workflows={WORKSPACE_WORKFLOWS}>
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
          <ArrowLeft size={14} />Back to Engagements
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-[0.8125rem] font-bold shrink-0" style={{ background: processColor }}>
                {eng.process}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-text">{eng.name}</h1>
                  <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${STATUS_CLS[eng.status]}`}>{eng.status}</span>
                  <span className={`inline-flex items-center px-2.5 h-5 rounded-md text-[0.65625rem] font-semibold border ${TYPE_CLS[eng.type]}`}>
                    {TYPE_LABEL[eng.type]}
                  </span>
                  {eng.type === 'Automation' && eng.subtype && (
                    <span className="inline-flex items-center px-1.5 h-5 rounded text-[0.625rem] font-bold uppercase tracking-wide bg-compliant-50/60 text-compliant-700 border border-compliant-100/70">
                      {SUBTYPE_LABEL[eng.subtype]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-[0.75rem] text-text-muted mt-1 flex-wrap">
                  <span className="font-mono tracking-tight">{eng.code}</span>
                  <span className="text-border-light" aria-hidden="true">·</span>
                  <button
                    onClick={() => setActiveTab('config')}
                    className="inline-flex items-center gap-1 text-text-muted hover:text-primary font-medium transition-colors cursor-pointer"
                    title="Owner, planned dates, framework & more"
                  >
                    <Settings size={11} /> Configuration
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[0.8125rem] text-text-secondary mt-2 max-w-3xl">{eng.description}</p>
          </div>

          {/* Health */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center min-w-[80px]">
              <div className={`text-3xl font-bold tabular-nums ${notStarted ? 'text-text-muted' : health.text}`}>
                {notStarted ? '—' : `${eng.health}%`}
              </div>
              <div className="text-[0.625rem] text-text-muted uppercase tracking-wide mt-0.5">
                {eng.type === 'Automation' ? 'Pass Rate' : 'Effective'}
              </div>
              {!notStarted && (
                <div className="mt-2 w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden mx-auto">
                  <div className={`h-full ${health.bar} rounded-full transition-all duration-500`} style={{ width: `${eng.health}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI strip — Internal Audit only. Automation owns per-tab KPIs; Compliance's
            numbers live on the Overview tab, so the header stays clutter-free. */}
        {eng.type === 'Internal Audit' && (
          <div className="grid gap-3 mb-6 grid-cols-6">
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card p-3 text-center"
              >
                <kpi.icon size={14} className="mx-auto text-text-muted mb-1" />
                <div className="text-[0.9375rem] font-bold text-text tabular-nums truncate">{kpi.value}</div>
                <div className="text-[0.625rem] text-text-muted leading-tight">{kpi.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tabs — colorful icons + drag horizontally to reorder (Configuration → show/hide).
            Share sits on the right of the tab line, sharing the same divider. */}
        <div className="flex items-center gap-3 border-b border-border-light mb-5">
        <Reorder.Group
          as="div"
          axis="x"
          values={visibleTabIds}
          onReorder={reorderVisibleTabs}
          className="flex items-center flex-1 min-w-0 overflow-x-auto"
        >
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <Reorder.Item
                as="div"
                key={tab.id}
                value={tab.id}
                title="Drag to reorder"
                className="shrink-0 cursor-grab active:cursor-grabbing"
              >
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex items-center gap-2 px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap select-none ${
                    active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${TAB_META[tab.id].chip}`}>
                    <Icon size={13} />
                  </span>
                  {tab.label}
                  <GripHorizontal size={12} className="text-text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
          <Gated permission="eng_share">
            <button
              onClick={(e) => { e.stopPropagation(); openShare({ type: 'engagement', id: eng.id, anchor: rectFromEvent(e) }); }}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-white text-[0.8125rem] font-semibold text-text-secondary hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
            >
              <Share2 size={14} /> Share
            </button>
          </Gated>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {/* ═══ OVERVIEW — Health dashboard for all three engagement types ═══ */}
            {activeTab === 'overview' && (
              <HealthOverviewTab
                eng={eng}
                onDrillToExceptions={goToExceptionsTab}
                onGoToWorkflows={goToWorkflowsTab}
                onConfigureWorkflow={(wfId) => setConfigWorkflow(wfId)}
                onOpenWorkflow={onOpenWorkflow}
                hideWorkflowConfig={eng.type === 'Automation'}
              />
            )}
            {/* ═══ RACM (Compliance / IA) ═══ */}
            {activeTab === 'racm' && (
              <RACMTab engagement={eng} onOpenFullEditor={onOpenRacmFullEditor} />
            )}

            {/* ═══ CONTROLS (Compliance / IA) ═══ */}
            {activeTab === 'controls' && (
              <ControlsTab
                engagement={eng}
                onCreateWorkflow={() => onCreateWorkflowForEngagement?.(eng.name)}
                onTestEvidence={(controlId) => { setEvidenceTarget(controlId); setActiveTab('evidence'); }}
                onRunWorkflow={onRunWorkflow}
              />
            )}

            {/* ═══ WORKFLOWS (all types) — grouped by sub-process accordion ═══ */}
            {activeTab === 'workflows' && (
              <WorkflowsBySubProcess
                workflows={MOCK_WORKFLOWS}
                engagementId={eng.id}
                engagementName={eng.name}
                onOpenWorkflow={onOpenWorkflow}
                onConfigureWorkflow={(wfId) => setConfigWorkflow(wfId)}
                onCreateWorkflow={() => onCreateWorkflowForEngagement?.(eng.name)}
              />
            )}

            {/* ═══ EVIDENCE (Compliance / IA) ═══ */}
            {activeTab === 'evidence' && (
              <EvidenceTab engagement={eng} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} openControlId={evidenceTarget} onOpened={() => setEvidenceTarget(null)} />
            )}

            {/* ═══ EXCEPTION MANAGEMENT (Automation) — slim summary; full workspace lives at /case-management ═══ */}
            {activeTab === 'exceptions' && (
              <ExceptionManagementTab eng={eng} onOpenWorkspace={openCaseWorkspace} />
            )}
            {/* ═══ WORKING PAPER (Compliance) / AUDIT REPORT (IA) ═══ */}
            {activeTab === 'working-paper' && (
              <WorkingPaperTab engagement={eng} />
            )}

            {/* ═══ ACTION TRAIL (all types) ═══ */}
            {activeTab === 'trail' && (
              <ActionTrailTab eng={eng} />
            )}

            {/* ═══ CONFIGURATION (all types) — editable engagement details ═══ */}
            {activeTab === 'config' && (
              <EngagementConfigTab key={eng.id} eng={eng} onSaved={() => { addToast({ message: 'Engagement configuration saved', type: 'success' }); logEvent({ action: 'Update', description: `Saved engagement configuration for "${eng.name}"`, module: 'Engagements', entity: 'Engagement' }); }}
                tabs={tabs} hiddenTabs={tabPrefs.hidden} onToggleTab={toggleTabHidden} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Per-workflow configuration drawer */}
      <AnimatePresence>
        {configWorkflow && (
          <WorkflowConfigDrawer
            workflowId={configWorkflow}
            onClose={() => setConfigWorkflow(null)}
            onSaved={() => {
              setConfigWorkflow(null);
              addToast({ message: 'Workflow configuration saved', type: 'success' });
              logEvent({ action: 'Update', description: `Saved workflow configuration on engagement "${eng.name}"`, module: 'Engagements', entity: 'Workflow' });
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </EngagementWorkspaceProvider>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Configuration Tab — editable engagement details (owner, planned dates, …)
// ═════════════════════════════════════════════════════════════════════════════

const ENG_STATUS_OPTIONS: EngStatus[] = ['Active', 'In Progress', 'Planned', 'Review', 'Draft', 'Closed'];
const ENG_PROCESS_OPTIONS: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'ITGC'];
const CONFIG_INPUT_CLS = 'w-full px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';

function ConfigField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function EngagementConfigTab({ eng, onSaved, tabs, hiddenTabs, onToggleTab }: {
  eng: Engagement;
  onSaved: () => void;
  tabs: { id: TabId; label: string; icon: React.ElementType }[];
  hiddenTabs: TabId[];
  onToggleTab: (id: TabId) => void;
}) {
  const initial = {
    name: eng.name,
    owner: eng.owner,
    status: eng.status,
    process: eng.process,
    framework: eng.framework,
    periodStart: eng.periodStart,
    periodEnd: eng.periodEnd,
    description: eng.description,
  };
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const ownerOptions = OWNER_LIST.includes(form.owner) ? OWNER_LIST : [form.owner, ...OWNER_LIST];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
      <div className="rounded-lg border border-border-light bg-white p-5">
        <h3 className="text-[0.8125rem] font-semibold text-text">Engagement details</h3>
        <p className="text-[0.75rem] text-text-muted mt-0.5 mb-4">Owner, planned schedule, and framework for this engagement.</p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <ConfigField label="Name" full>
            <input value={form.name} onChange={e => set('name', e.target.value)} className={CONFIG_INPUT_CLS} />
          </ConfigField>
          <ConfigField label="Owner">
            <select value={form.owner} onChange={e => set('owner', e.target.value)} className={`${CONFIG_INPUT_CLS} cursor-pointer`}>
              {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </ConfigField>
          <ConfigField label="Status">
            <select value={form.status} onChange={e => set('status', e.target.value as EngStatus)} className={`${CONFIG_INPUT_CLS} cursor-pointer`}>
              {ENG_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </ConfigField>
          <ConfigField label="Process">
            <select value={form.process} onChange={e => set('process', e.target.value as ProcessCode)} className={`${CONFIG_INPUT_CLS} cursor-pointer`}>
              {ENG_PROCESS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </ConfigField>
          <ConfigField label="Framework">
            <input value={form.framework} onChange={e => set('framework', e.target.value)} className={CONFIG_INPUT_CLS} />
          </ConfigField>
          <ConfigField label="Planned start">
            <input value={form.periodStart} onChange={e => set('periodStart', e.target.value)} placeholder="e.g. Apr 2025" className={CONFIG_INPUT_CLS} />
          </ConfigField>
          <ConfigField label="Planned end">
            <input value={form.periodEnd} onChange={e => set('periodEnd', e.target.value)} placeholder="e.g. Mar 2026" className={CONFIG_INPUT_CLS} />
          </ConfigField>
          <ConfigField label="Description" full>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={`${CONFIG_INPUT_CLS} resize-none leading-relaxed`} />
          </ConfigField>
        </div>
      </div>

      {/* Sub-pages — show/hide which tabs appear; drag the headers to reorder. */}
      <div className="rounded-lg border border-border-light bg-white p-5">
        <h3 className="text-[0.8125rem] font-semibold text-text">Sub-pages</h3>
        <p className="text-[0.75rem] text-text-muted mt-0.5 mb-4">
          Choose which tabs appear for this engagement. Drag the tab headers left/right to change their order.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const locked = tab.id === 'config';
            const visible = !hiddenTabs.includes(tab.id);
            return (
              <label
                key={tab.id}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
                  locked ? 'border-border-light bg-surface-1/40 cursor-default'
                    : visible ? 'border-border-light bg-white hover:bg-surface-1/40 cursor-pointer'
                      : 'border-dashed border-border-light bg-surface-1/30 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={visible}
                  disabled={locked}
                  onChange={() => onToggleTab(tab.id)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer disabled:cursor-default"
                />
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${TAB_META[tab.id].chip} ${visible ? '' : 'opacity-50'}`}>
                  <Icon size={13} />
                </span>
                <span className={`text-[0.78125rem] font-medium ${visible ? 'text-text' : 'text-text-muted'}`}>{tab.label}</span>
                {locked
                  ? <span className="ml-auto text-[0.625rem] uppercase tracking-wider font-semibold text-text-muted">Always on</span>
                  : <span className="ml-auto text-text-muted">{visible ? <Eye size={13} /> : <EyeOff size={13} />}</span>}
              </label>
            );
          })}
        </div>
      </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Gated permission="eng_edit" mode="disable" title="You don't have permission to edit this engagement">
        <button
          onClick={() => { setSaved(form); onSaved(); }}
          disabled={!dirty}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover disabled:bg-text-muted/30 disabled:cursor-not-allowed text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
        >
          <CheckCircle2 size={14} /> Save changes
        </button>
        </Gated>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Exception Management Tab — workflow-grouped sections + flat-list toggle
// ═════════════════════════════════════════════════════════════════════════════

const STATUS_PILL_CLS: Record<EngagementException['status'], string> = {
  Open: 'bg-risk-50 text-risk-700',
  Triaging: 'bg-mitigated-50 text-mitigated-700',
  Resolved: 'bg-compliant-50 text-compliant-700',
};

const SEV_BADGE_CLS: Record<Severity, string> = {
  Critical: 'bg-risk-50 text-risk-700',
  High: 'bg-high-50 text-high-700',
  Medium: 'bg-mitigated-50 text-mitigated-700',
  Low: 'bg-compliant-50 text-compliant-700',
};

const SEV_DOT_CLS: Record<Severity, string> = {
  Critical: 'bg-risk',
  High: 'bg-high',
  Medium: 'bg-mitigated',
  Low: 'bg-compliant',
};

function ExceptionManagementTab({
  eng,
  onOpenWorkspace,
}: {
  eng: Engagement;
  onOpenWorkspace: (filter?: { severity?: Severity; workflowId?: string; status?: EngagementException['status'] }) => void;
}) {
  const allExceptions = useMemo(() => exceptionsForEngagement(eng.id), [eng.id]);
  const groups = useMemo(() => groupByWorkflow(allExceptions), [allExceptions]);

  const totals = useMemo(() => {
    const t = { open: 0, triaging: 0, resolved: 0 };
    allExceptions.forEach(e => {
      if (e.status === 'Open') t.open++;
      else if (e.status === 'Triaging') t.triaging++;
      else t.resolved++;
    });
    return t;
  }, [allExceptions]);

  const [wfSearch, setWfSearch] = useState('');
  const [sortByOpen, setSortByOpen] = useState(false);
  const [sevFilter, setSevFilter] = useState<'All' | Severity>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | EngagementException['status']>('All');
  const filtersActive = sevFilter !== 'All' || statusFilter !== 'All';

  /**
   * Show *every* workflow tied to this engagement — even ones that haven't fired
   * exceptions yet — so the section reads as the live exception inventory rather
   * than a partial list. Workflows with exceptions keep their breakdown; quiet
   * ones get a clear "no exceptions yet" marker. Severity/status filters narrow
   * the exceptions counted per workflow.
   */
  const allWorkflowsView = useMemo(() => {
    const byId = new Map(groups.map(g => [g.workflowId, g]));
    return MOCK_WORKFLOWS.map(wf => {
      const grp = byId.get(wf.id);
      const exceptions = (grp?.exceptions ?? []).filter(e =>
        (sevFilter === 'All' || e.severity === sevFilter) &&
        (statusFilter === 'All' || e.status === statusFilter)
      );
      const total = exceptions.length;
      const openCount = exceptions.filter(e => e.status !== 'Resolved').length;
      const severityCounts: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      for (const e of exceptions) severityCounts[e.severity] += 1;
      return {
        workflowId: wf.id,
        workflowName: wf.name,
        code: wf.code,
        cadence: wf.cadence,
        exceptions,
        total,
        openCount,
        openPct: total > 0 ? Math.round((openCount / total) * 100) : 0,
        severityCounts,
      };
    });
  }, [groups, sevFilter, statusFilter]);

  const visibleWorkflows = useMemo(() => {
    const q = wfSearch.trim().toLowerCase();
    let list = allWorkflowsView.filter(w =>
      !q || w.workflowName.toLowerCase().includes(q) || w.code.toLowerCase().includes(q)
    );
    // When a severity/status filter is active, hide workflows with no matching exceptions.
    if (filtersActive) list = list.filter(w => w.total > 0);
    if (sortByOpen) {
      // Highest open % first; ties broken by open count.
      return [...list].sort((a, b) => b.openPct - a.openPct || b.openCount - a.openCount);
    }
    return list;
  }, [allWorkflowsView, wfSearch, sortByOpen, filtersActive]);

  return (
    <div className="space-y-4">
      {/* Exception signals — borderless inline stats (out of the box); each drills into the workspace. */}
      <div className="flex flex-wrap items-center gap-y-3 px-1 py-1">
        {([
          { label: 'All Exceptions', value: allExceptions.length, sub: `Across ${allWorkflowsView.length} workflows`, tone: 'text-text', onClick: () => onOpenWorkspace() },
          { label: 'Open', value: totals.open, sub: 'Awaiting triage', tone: 'text-risk-700', onClick: () => onOpenWorkspace({ status: 'Open' }) },
          { label: 'In Progress', value: totals.triaging, sub: 'Owner assigned', tone: 'text-mitigated-700', onClick: () => onOpenWorkspace({ status: 'Triaging' }) },
          { label: 'Resolved', value: totals.resolved, sub: 'Closed this engagement', tone: 'text-compliant-700', onClick: () => onOpenWorkspace({ status: 'Resolved' }) },
        ] as { label: string; value: number; sub: string; tone: string; onClick: () => void }[]).map(k => (
          <button
            key={k.label}
            onClick={k.onClick}
            className="text-left pl-7 ml-7 border-l border-border-light first:pl-0 first:ml-0 first:border-l-0 hover:opacity-60 transition-opacity cursor-pointer"
          >
            <div className="text-[0.625rem] uppercase tracking-wider font-bold text-text-muted">{k.label}</div>
            <div className={`text-[1.3125rem] font-bold tabular-nums leading-tight ${k.tone}`}>{k.value}</div>
            <div className="text-[0.65625rem] text-text-muted">{k.sub}</div>
          </button>
        ))}
      </div>

      {/* Compact toolbar — title, search, sort, workspace link. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 shrink-0">
          <h4 className="text-[0.8125rem] font-semibold text-text">Exceptions by workflow</h4>
          <span className="text-[0.6875rem] text-text-muted">{visibleWorkflows.length} of {allWorkflowsView.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={wfSearch}
              onChange={e => setWfSearch(e.target.value)}
              placeholder="Search workflows..."
              className="w-48 pl-8 pr-2.5 py-1.5 text-[0.75rem] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'All' | EngagementException['status'])}
            className={`py-1.5 px-2.5 rounded-lg border text-[0.71875rem] font-semibold outline-none cursor-pointer transition-colors ${
              statusFilter !== 'All' ? 'border-primary/40 text-primary bg-primary-xlight/30' : 'border-border bg-white text-text-secondary hover:border-primary/30'
            }`}
            title="Filter by status"
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            <option value="Open">Open</option>
            <option value="Triaging">Triaging</option>
            <option value="Resolved">Resolved</option>
          </select>
          <select
            value={sevFilter}
            onChange={e => setSevFilter(e.target.value as 'All' | Severity)}
            className={`py-1.5 px-2.5 rounded-lg border text-[0.71875rem] font-semibold outline-none cursor-pointer transition-colors ${
              sevFilter !== 'All' ? 'border-primary/40 text-primary bg-primary-xlight/30' : 'border-border bg-white text-text-secondary hover:border-primary/30'
            }`}
            title="Filter by severity"
            aria-label="Filter by severity"
          >
            <option value="All">All severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <button
            onClick={() => setSortByOpen(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[0.71875rem] font-semibold transition-colors cursor-pointer ${
              sortByOpen
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text-secondary border-border hover:border-primary/30 hover:text-primary'
            }`}
            title="Sort by open %"
          >
            <ArrowUpDown size={12} />
            Open %
          </button>
          {filtersActive && (
            <button
              onClick={() => { setSevFilter('All'); setStatusFilter('All'); }}
              className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-text-muted hover:text-primary px-2 py-1 rounded-md hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Per-workflow breakdown — one clean line per workflow */}
      <div className="rounded-xl border border-border-light bg-white divide-y divide-border-light overflow-hidden">
        {visibleWorkflows.length === 0 ? (
          <div className="px-4 py-10 text-center text-[0.75rem] text-text-muted">
            {wfSearch.trim()
              ? <>No workflows match “{wfSearch}”.</>
              : 'No workflows match the selected filters.'}
          </div>
        ) : visibleWorkflows.map(group => {
          const hasNone = group.total === 0;
          return (
            <button
              key={group.workflowId}
              onClick={() => onOpenWorkspace({ workflowId: group.workflowId })}
              disabled={hasNone}
              className={`group/row w-full px-5 py-4 flex items-center gap-3 text-left transition-colors ${
                hasNone ? 'cursor-default' : 'hover:bg-primary-xlight/25 cursor-pointer'
              }`}
            >
              <Workflow size={15} className={`shrink-0 ${hasNone ? 'text-text-muted/60' : 'text-brand-600'}`} />
              <span className={`text-[0.8125rem] font-semibold truncate ${hasNone ? 'text-text-muted' : 'text-text'}`}>{group.workflowName}</span>
              <span className="hidden md:inline px-1.5 h-4 rounded text-[0.59375rem] font-bold bg-surface-2 text-text-secondary font-mono shrink-0">{group.code}</span>

              <div className="ml-auto flex items-center gap-4 shrink-0">
                {hasNone ? (
                  <span className="text-[0.6875rem] text-text-muted/70 italic">No open exceptions</span>
                ) : (
                  /* Single signal per workflow: open exceptions */
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className={`text-[1.125rem] font-bold tabular-nums leading-none ${group.openCount > 0 ? 'text-risk-700' : 'text-compliant-700'}`}>{group.openCount}</span>
                    <span className="text-[0.6875rem] text-text-muted">open exception{group.openCount === 1 ? '' : 's'}</span>
                  </span>
                )}
                <ArrowUpRight size={14} className={hasNone ? 'text-transparent' : 'text-text-muted group-hover/row:text-primary transition-colors'} aria-label="Opens in a new tab" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExceptionRow({ ex, onClick, showWorkflow }: { ex: EngagementException; onClick: () => void; showWorkflow?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-surface-2/30 transition-colors cursor-pointer text-left"
    >
      <span className={`inline-flex items-center px-1.5 h-5 rounded text-[0.625rem] font-bold uppercase tracking-wide ${SEV_BADGE_CLS[ex.severity]} shrink-0`}>
        {ex.severity}
      </span>
      <span className="font-mono text-[0.71875rem] text-text-secondary tabular-nums shrink-0 w-20">{ex.ref}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[0.8125rem] text-text truncate">{ex.title}</div>
        <div className="text-[0.6875rem] text-text-muted mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{ex.assignee}</span>
          <span className="text-border">·</span>
          <span>{ex.opened}</span>
          {showWorkflow && (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1"><Workflow size={10} />{ex.workflowName}</span>
            </>
          )}
          {ex.amount && (
            <>
              <span className="text-border">·</span>
              <span className="font-medium text-text-secondary">{ex.amount}</span>
            </>
          )}
        </div>
      </div>
      <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center shrink-0 ${STATUS_PILL_CLS[ex.status]}`}>
        {ex.status}
      </span>
      <ChevronRight size={14} className="text-text-muted shrink-0" />
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Action Trail Tab — engagement-level activity feed + daily new/closed chart
// ═════════════════════════════════════════════════════════════════════════════

const EVENT_ICON: Record<ActivityType, React.ElementType> = {
  workflow_run: Workflow,
  exception_fired: AlertTriangle,
  exception_assigned: User,
  exception_classified: ListChecks,
  exception_closed: CheckCircle2,
  evidence_uploaded: Upload,
  control_tested: ShieldCheck,
  comment_added: MessageSquare,
  status_changed: RefreshCw,
  signoff: Shield,
};

const EVENT_ICON_CLS: Record<ActivityType, string> = {
  workflow_run: 'bg-evidence-50 text-evidence-700',
  exception_fired: 'bg-risk-50 text-risk-700',
  exception_assigned: 'bg-mitigated-50 text-mitigated-700',
  exception_classified: 'bg-brand-50 text-brand-700',
  exception_closed: 'bg-compliant-50 text-compliant-700',
  evidence_uploaded: 'bg-brand-50 text-brand-700',
  control_tested: 'bg-compliant-50 text-compliant-700',
  comment_added: 'bg-surface-2 text-text-secondary',
  status_changed: 'bg-mitigated-50 text-mitigated-700',
  signoff: 'bg-compliant-50 text-compliant-700',
};

type EventCategory = 'All' | 'Exceptions' | 'Workflow runs' | 'Other';

function categorize(t: ActivityType): EventCategory {
  if (t === 'workflow_run') return 'Workflow runs';
  if (t.startsWith('exception_')) return 'Exceptions';
  return 'Other';
}

export function ActionTrailTab({ eng }: { eng: Engagement }) {
  const allEvents = ENGAGEMENT_ACTIVITY[eng.id] || [];

  const [workflowFilter, setWorkflowFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory>('All');
  const [reportOpen, setReportOpen] = useState(false);

  // Unique workflows referenced in this engagement's events.
  const workflowOptions = useMemo(() => {
    const m = new Map<string, string>();
    allEvents.forEach(e => { if (e.workflowId && e.workflowName) m.set(e.workflowId, e.workflowName); });
    return Array.from(m.entries()); // [[id, name], ...]
  }, [allEvents]);

  const filtered = useMemo(() => allEvents.filter(e => {
    if (workflowFilter !== 'All' && e.workflowId !== workflowFilter) return false;
    if (categoryFilter !== 'All' && categorize(e.type) !== categoryFilter) return false;
    return true;
  }), [allEvents, workflowFilter, categoryFilter]);

  // KPIs (use full event list for the engagement-wide pending; new/closed week from filtered)
  const newThisWeek = filtered.filter(e => e.type === 'exception_fired' && e.dayOffset < 7).length;
  const closedThisWeek = filtered.filter(e => e.type === 'exception_closed' && e.dayOffset < 7).length;
  const avgClose = AVG_TIME_TO_CLOSE[eng.id] ?? '—';

  // Daily chart
  const daily = useMemo(() => dailyCounts(filtered, 30), [filtered]);
  const maxBar = Math.max(1, ...daily.map(d => d.created + d.closed));

  // Group filtered events by day for the feed (most recent first).
  const grouped = useMemo(() => {
    const map = new Map<number, ActivityEvent[]>();
    filtered.forEach(e => {
      const arr = map.get(e.dayOffset) ?? [];
      arr.push(e);
      map.set(e.dayOffset, arr);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayOffset, evs]) => ({
        dayOffset,
        events: evs.slice().sort((a, b) => b.hour - a.hour), // newest first within the day
      }));
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header — title + generate report */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[0.8125rem] font-semibold text-text">Action Trail</h3>
          <p className="text-[0.6875rem] text-text-muted mt-0.5">Every event on this engagement — runs, exceptions, evidence, and sign-offs.</p>
        </div>
        <button
          onClick={() => setReportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary-xlight/40 text-primary hover:bg-primary/10 text-[0.75rem] font-semibold transition-colors cursor-pointer"
          title="Generate an AI-summarised report for a chosen period"
        >
          <Sparkles size={13} />Generate Report
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Pending', value: eng.openIssues, icon: AlertTriangle, tone: 'text-risk-700' },
          { label: 'New This Week', value: newThisWeek,    icon: Activity,       tone: 'text-evidence-700' },
          { label: 'Closed This Week', value: closedThisWeek, icon: CheckCircle2, tone: 'text-compliant-700' },
          { label: 'Avg Time to Close', value: avgClose,   icon: Clock,          tone: 'text-text' },
        ].map(kpi => (
          <div key={kpi.label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.65625rem] uppercase tracking-wide font-semibold text-text-muted">{kpi.label}</span>
              <kpi.icon size={13} className="text-text-muted" />
            </div>
            <div className={`text-[1.375rem] font-bold tabular-nums ${kpi.tone}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Daily new/closed chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-text">Daily new vs closed</h3>
            <p className="text-[0.6875rem] text-text-muted mt-0.5">Last 30 days — exceptions opened (top) and closed (bottom).</p>
          </div>
          <div className="flex items-center gap-3 text-[0.6875rem] text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-risk-500" />New</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-compliant" />Closed</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-24 mt-1">
          {daily.map((d, i) => {
            const total = d.created + d.closed;
            const newH = total > 0 ? (d.created / maxBar) * 100 : 0;
            const closedH = total > 0 ? (d.closed / maxBar) * 100 : 0;
            const isToday = d.dayOffset === 0;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end items-center min-w-0"
                title={`${formatChartDay(d.dayOffset)} — ${d.created} new · ${d.closed} closed`}
              >
                <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                  {d.created > 0 && (
                    <div className="w-full bg-risk-500/85 rounded-t-sm" style={{ height: `${newH}%`, minHeight: '2px' }} />
                  )}
                  {d.closed > 0 && (
                    <div className={`w-full bg-compliant/85 ${d.created === 0 ? 'rounded-t-sm' : ''}`} style={{ height: `${closedH}%`, minHeight: '2px' }} />
                  )}
                  {total === 0 && (
                    <div className="w-full bg-surface-3/60 rounded-sm" style={{ height: '2px' }} />
                  )}
                </div>
                {isToday && <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-primary mt-1">Now</div>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[0.625rem] text-text-muted mt-2 tabular-nums">
          <span>{formatChartDay(29)}</span>
          <span>{formatChartDay(15)}</span>
          <span>{formatChartDay(0)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap text-[0.6875rem]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-muted uppercase tracking-wide">Workflow</span>
          <select
            value={workflowFilter}
            onChange={e => setWorkflowFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-border bg-white text-[0.6875rem] text-text outline-none focus:border-primary/40 cursor-pointer"
          >
            <option value="All">All workflows</option>
            {workflowOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div className="w-px h-5 bg-border-light" />
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-muted uppercase tracking-wide">Type</span>
          <div className="flex gap-1">
            {(['All', 'Exceptions', 'Workflow runs', 'Other'] as EventCategory[]).map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                  categoryFilter === c
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-[0.6875rem] text-text-muted tabular-nums">
          {filtered.length} of {allEvents.length} events
        </div>
      </div>

      {/* Activity feed */}
      {grouped.length === 0 ? (
        <div className="border border-border-light rounded-xl p-12 text-center bg-white">
          <Activity size={28} className="text-text-muted mx-auto mb-3" />
          <p className="text-[0.875rem] font-semibold text-text mb-1">No activity for these filters</p>
          <p className="text-[0.75rem] text-text-muted">Try clearing the workflow or type filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.dayOffset}>
              <div className="text-[0.65625rem] uppercase tracking-wider font-semibold text-text-muted mb-2 sticky top-0 bg-white/80 backdrop-blur-sm py-1">
                {formatDay(group.dayOffset)}
                <span className="ml-2 text-text-muted/60 normal-case font-normal tracking-normal">{formatChartDay(group.dayOffset)}</span>
              </div>
              <div className="space-y-1.5 border-l-2 border-border-light pl-4 ml-1">
                {group.events.map(ev => {
                  const Icon = EVENT_ICON[ev.type];
                  const iconCls = EVENT_ICON_CLS[ev.type];
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-surface-2/40 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconCls}`}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.8125rem] text-text leading-snug">{ev.title}</div>
                        {ev.detail && <div className="text-[0.75rem] text-text-muted mt-0.5">{ev.detail}</div>}
                        <div className="flex items-center gap-2 text-[0.6875rem] text-text-muted mt-1 flex-wrap">
                          <span>{ev.actor}</span>
                          {ev.workflowName && (
                            <>
                              <span className="text-border">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Workflow size={10} />{ev.workflowName}
                              </span>
                            </>
                          )}
                          {ev.refId && (
                            <>
                              <span className="text-border">·</span>
                              <span className="font-mono tracking-tight">{ev.refId}</span>
                            </>
                          )}
                          <span className="text-border">·</span>
                          <span className="tabular-nums">{String(ev.hour).padStart(2, '0')}:00</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {reportOpen && (
          <ActionTrailReportModal eng={eng} events={allEvents} onClose={() => setReportOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Automation Overview Tab — KPIs + severity donut + workflow bar + heatmap +
// per-workflow configuration list. Replaces the setup-checklist overview for
// Automation engagements only; Compliance / Internal Audit keep the checklist.
// ═════════════════════════════════════════════════════════════════════════════

const SEVERITY_FILL: Record<Severity, string> = {
  Critical: '#b91c1c',
  High: '#ea580c',
  Medium: '#d97706',
  Low: '#16a34a',
};

function heatmapCellCls(count: number): string {
  if (count === 0) return 'bg-surface-2/40 border-border-light/30';
  if (count === 1) return 'bg-mitigated-50 border-mitigated-100';
  if (count === 2) return 'bg-mitigated-100 border-mitigated-100/80';
  if (count <= 4) return 'bg-high-50 border-high-100';
  return 'bg-risk-100 border-risk-100/80';
}

export function HealthOverviewTab({
  eng,
  onDrillToExceptions,
  onGoToWorkflows,
  onConfigureWorkflow,
  onOpenWorkflow,
  hideWorkflowConfig,
}: {
  eng: Engagement;
  /** Navigate to the Exception Management sub-tab (same browser tab). */
  onDrillToExceptions: () => void;
  /** Navigate to the Workflows sub-tab (same browser tab). */
  onGoToWorkflows: () => void;
  onConfigureWorkflow: (workflowId: string) => void;
  onOpenWorkflow?: (libraryWorkflowId: string) => void;
  hideWorkflowConfig?: boolean;
}) {
  // ─── Type-aware copy + funnel stages ────────────────────────────────────
  const isAutomation = eng.type === 'Automation';
  const isCompliance = eng.type === 'Compliance';
  const isIA = eng.type === 'Internal Audit';
  const issueWord = isAutomation ? 'exception' : 'finding';
  const issueWordCap = isAutomation ? 'Exceptions' : 'Findings';
  const labels = {
    kpi1Label: isAutomation ? 'Total Workflows' : 'Controls in Scope',
    kpi1Sub: isAutomation
      ? `${MOCK_WORKFLOWS.filter(wf => wf.cadence.kind === 'Frequency').length} live · ${MOCK_WORKFLOWS.filter(wf => wf.cadence.kind === 'Ad-hoc').length} ad-hoc`
      : `${MOCK_WORKFLOWS.length} test workflows linked`,
    kpi1Value: isAutomation ? MOCK_WORKFLOWS.length : eng.controls,
    kpi2Label: `Open ${issueWordCap}`,
    kpi3Label: isIA ? 'Action Plans Open' : 'In Progress',
    kpi4Label: isAutomation ? 'Health' : (isCompliance ? 'Pass Rate' : 'Coverage'),
    donutHeader: `${issueWordCap} by severity`,
    barHeader: isAutomation ? 'Exceptions by workflow' : `${issueWordCap} by workflow`,
    heatmapHeader: isAutomation ? 'Exception heatmap — last 14 days' : `${issueWordCap} activity — last 14 days`,
    funnelHeader: isAutomation
      ? 'Exception lifecycle funnel'
      : isCompliance
        ? 'Control testing pipeline'
        : 'Internal audit pipeline',
    effectivenessHeader: isAutomation ? 'Workflow effectiveness · 90d' : 'Linked workflow effectiveness · 90d',
    workflowConfigHeader: isAutomation ? 'Workflow configuration' : 'Linked workflows',
    workflowConfigSub: isAutomation
      ? 'Tune schedules, thresholds, and routing for each workflow on this automation. Grouped by sub-process.'
      : 'Test and supporting workflows linked to this engagement, grouped by sub-process.',
    drillCtaPlural: isAutomation ? 'Manage Exceptions' : `Manage ${issueWordCap}`,
  };

  const exceptions = useMemo(() => exceptionsForEngagement(eng.id), [eng.id]);
  const openExceptions = useMemo(() => exceptions.filter(e => e.status !== 'Resolved'), [exceptions]);

  const totalCount = exceptions.length;
  const openCount = exceptions.filter(e => e.status === 'Open').length;
  const inProgressCount = exceptions.filter(e => e.status === 'Triaging').length;
  const resolvedCount = exceptions.filter(e => e.status === 'Resolved').length;
  const pct = (n: number) => totalCount === 0 ? 0 : Math.round((n / totalCount) * 100);

  // ─── Pipeline funnel stages per engagement type ─────────────────────────
  const funnelSteps = useMemo(() => {
    if (isAutomation) {
      const fired = exceptions.length;
      const triaged = exceptions.filter(e => e.status !== 'Open').length;
      const classified = exceptions.filter(e => e.classification).length;
      const closed = exceptions.filter(e => e.status === 'Resolved').length;
      return [
        { label: 'Fired',      count: fired,      bar: 'bg-evidence-500/85' },
        { label: 'Triaged',    count: triaged,    bar: 'bg-mitigated-500/85' },
        { label: 'Classified', count: classified, bar: 'bg-brand-500/85' },
        { label: 'Closed',     count: closed,     bar: 'bg-compliant/85' },
      ];
    }
    if (isCompliance) {
      // Demo: derive progress through pipeline from engagement.health (0–100).
      const h = eng.health;
      const total = eng.controls;
      const scoped       = total;
      const walkthrough  = Math.round(total * Math.min(1, h / 100 + 0.05));
      const sampled      = Math.round(total * (h / 100));
      const tested       = Math.round(total * Math.max(0, h / 100 - 0.05));
      const workingPaper = Math.round(total * Math.max(0, h / 100 - 0.1));
      const reviewed     = Math.round(total * Math.max(0, h / 100 - 0.18));
      const signedOff    = h >= 95 ? total : 0;
      return [
        { label: 'Scoped',         count: scoped,       bar: 'bg-evidence-500/85' },
        { label: 'Walkthrough',    count: walkthrough,  bar: 'bg-evidence-600/85' },
        { label: 'Sampled',        count: sampled,      bar: 'bg-mitigated-500/85' },
        { label: 'Tested',         count: tested,       bar: 'bg-mitigated-600/85' },
        { label: 'Working paper',  count: workingPaper, bar: 'bg-brand-500/85' },
        { label: 'Reviewed',       count: reviewed,     bar: 'bg-brand-600/85' },
        { label: 'Signed-off',     count: signedOff,    bar: 'bg-compliant/85' },
      ];
    }
    // Internal Audit — 8-step pipeline derived from engagement status / health.
    const planned = ['Draft', 'Planned'].includes(eng.status);
    const active = ['Active', 'In Progress'].includes(eng.status);
    const review = eng.status === 'Review';
    const closed = eng.status === 'Closed';
    return [
      { label: 'Planning',         count: 1,                                  bar: 'bg-evidence-500/85' },
      { label: 'Announcement',     count: planned || active || review || closed ? 1 : 0, bar: 'bg-evidence-600/85' },
      { label: 'IDR',              count: active || review || closed ? 1 : 0, bar: 'bg-mitigated-500/85' },
      { label: 'Analysis',         count: active || review || closed ? 1 : 0, bar: 'bg-mitigated-600/85' },
      { label: 'Issues sheet',     count: review || closed ? 1 : 0,           bar: 'bg-brand-500/85' },
      { label: 'Discussion',       count: review || closed ? 1 : 0,           bar: 'bg-brand-600/85' },
      { label: 'Final report',     count: closed ? 1 : 0,                     bar: 'bg-compliant/85' },
      { label: 'Audit Committee',  count: closed ? 1 : 0,                     bar: 'bg-compliant/85' },
    ];
  }, [eng, exceptions, isAutomation, isCompliance]);

  // Severity distribution of currently-open (non-resolved) exceptions.
  const severityData = useMemo(() => {
    const counts: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    openExceptions.forEach(e => { counts[e.severity] += 1; });
    return (['Critical', 'High', 'Medium', 'Low'] as Severity[])
      .map(sev => ({ name: sev, value: counts[sev], color: SEVERITY_FILL[sev] }))
      .filter(d => d.value > 0);
  }, [openExceptions]);
  const totalOpenForDonut = severityData.reduce((s, d) => s + d.value, 0);

  // Exceptions per workflow (open + triaging).
  const workflowData = useMemo(() => {
    const map = new Map<string, { workflowId: string; name: string; count: number }>();
    openExceptions.forEach(e => {
      const prev = map.get(e.workflowId);
      map.set(e.workflowId, { workflowId: e.workflowId, name: e.workflowName, count: (prev?.count ?? 0) + 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [openExceptions]);

  // 14-day heatmap: workflows (rows) × dayOffset 13..0 (cols). Source: ENGAGEMENT_ACTIVITY.
  const heatmapDays = 14;
  const heatmapData = useMemo(() => {
    const events = ENGAGEMENT_ACTIVITY[eng.id] || [];
    type Row = { workflowId: string; name: string; counts: number[]; total: number };
    const rows = new Map<string, Row>();
    MOCK_WORKFLOWS.forEach(wf => {
      rows.set(wf.id, { workflowId: wf.id, name: wf.name, counts: Array(heatmapDays).fill(0), total: 0 });
    });
    events.forEach(ev => {
      if (ev.type !== 'exception_fired' || ev.dayOffset >= heatmapDays || !ev.workflowId) return;
      const row = rows.get(ev.workflowId);
      if (row) {
        const idx = heatmapDays - 1 - ev.dayOffset;
        row.counts[idx] += 1;
        row.total += 1;
      }
    });
    return Array.from(rows.values());
  }, [eng.id]);
  const heatmapHasData = heatmapData.some(r => r.total > 0);

  // Per-workflow exception counts for the config list cards.
  const exceptionsByWorkflow = useMemo(() => {
    const map = new Map<string, number>();
    openExceptions.forEach(e => map.set(e.workflowId, (map.get(e.workflowId) ?? 0) + 1));
    return map;
  }, [openExceptions]);

  const tier = healthTier(eng.health);

  // The engine's multi-insight roll-up for this engagement: the escalation, its
  // pricing risk (when the engagement carries the chargeback thread), and one
  // insight per in-scope control — statuses map to Pass / Fail / Not tested so
  // each card reasons distinctly. One Generate builds them all into a stack.
  const insightSubjects = useMemo<BuildInsightInput[]>(() => {
    const isPricing = /p2p|procure|vendor|invoice|pricing|chargeback/i.test(`${eng.name} ${eng.process ?? ''} ${eng.subtype ?? ''}`);
    const controls = MOCK_CONTROLS[eng.id] ?? MOCK_CONTROLS.default;
    const mapStatus = (s: string): string => (s === 'Failed' ? 'Fail' : s === 'Effective' ? 'Pass' : 'Not tested');
    const subs: BuildInsightInput[] = [
      { layer: 'engagement', subjectId: eng.id, subjectLabel: eng.name, status: eng.status, flagship: isPricing },
    ];
    if (isPricing) {
      subs.push(
        { layer: 'control', subjectId: 'C-CHARGEBACK-PRICING', subjectLabel: 'Chargeback Pricing Validation', status: 'Fail', isKey: true, flagship: true },
        { layer: 'risk', subjectId: 'R-PRICING', subjectLabel: 'Pricing accuracy risk', priority: 'High', flagship: true },
      );
    } else {
      subs.push({ layer: 'risk', subjectId: `${eng.id}-risk`, subjectLabel: `${eng.process ?? 'Process'} control risk`, priority: eng.openIssues > 0 ? 'High' : 'Low' });
    }
    for (const c of controls) {
      // Skip a control whose name would re-trigger the flagship pricing card —
      // the stack already carries that thread once.
      if (isPricing && isPricingSubject(c.name)) continue;
      subs.push({ layer: 'control', subjectId: c.ref, subjectLabel: c.name, status: mapStatus(c.status), isKey: c.key });
    }
    return subs;
  }, [eng]);

  return (
    <div className="space-y-5">
      {/* ─── AI insights · engagement roll-up (generate-on-demand, stacked) ─── */}
      <InsightGenerator
        layer="engagement"
        subjectId={eng.id}
        subjectLabel={eng.name}
        status={eng.status}
        labelOverride={eng.name}
        subjects={insightSubjects}
        stackScopeLabel="across this engagement"
      />

      {/* ─── KPI strip ─── */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label={labels.kpi1Label}
          value={labels.kpi1Value}
          sub={labels.kpi1Sub}
          icon={Workflow}
          tone="text-text"
          onClick={onGoToWorkflows}
        />
        <KpiCard
          label={labels.kpi2Label}
          value={openCount}
          sub={totalCount > 0 ? `${pct(openCount)}% of ${totalCount}` : '—'}
          icon={AlertTriangle}
          tone="text-risk-700"
          onClick={onDrillToExceptions}
        />
        <KpiCard
          label={labels.kpi3Label}
          value={inProgressCount}
          sub={totalCount > 0 ? `${pct(inProgressCount)}% of ${totalCount}` : '—'}
          icon={Clock}
          tone="text-mitigated-700"
          onClick={onDrillToExceptions}
        />
        <KpiCard
          label={labels.kpi4Label}
          value={`${eng.health}%`}
          sub={`${resolvedCount} resolved · ${openCount + inProgressCount} active`}
          icon={CheckCircle2}
          tone={tier.text}
          progress={eng.health}
          progressCls={tier.bar}
          onClick={onDrillToExceptions}
        />
      </div>

      {/* ─── Charts row ─── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Severity donut */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[0.8125rem] font-semibold text-text">{labels.donutHeader}</h3>
              <p className="text-[0.6875rem] text-text-muted mt-0.5">Click a slice to drill into Exception Management.</p>
            </div>
            <span className="text-[0.6875rem] text-text-muted">{totalOpenForDonut} open</span>
          </div>
          {severityData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-[0.75rem] text-text-muted">No open exceptions</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-[180px] h-[180px] shrink-0 relative">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={severityData}
                      dataKey="value"
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={75}
                      paddingAngle={2}
                      onClick={() => onDrillToExceptions()}
                    >
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="white" strokeWidth={2} className="cursor-pointer hover:opacity-80 transition-opacity" />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, padding: '6px 10px' }}
                      formatter={(value, name) => [`${value as number} exception${value === 1 ? '' : 's'}`, name as string]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[1.375rem] font-bold text-text tabular-nums leading-none">{totalOpenForDonut}</div>
                  <div className="text-[0.625rem] text-text-muted uppercase tracking-wide mt-1">Open</div>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {severityData.map(d => (
                  <button
                    key={d.name}
                    onClick={() => onDrillToExceptions()}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface-2/40 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2 text-[0.75rem] text-text">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="text-[0.75rem] font-bold text-text tabular-nums">{d.value}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Workflow exception bar */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[0.8125rem] font-semibold text-text">{labels.barHeader}</h3>
              <p className="text-[0.6875rem] text-text-muted mt-0.5">Click a bar to filter the Exception Management tab.</p>
            </div>
          </div>
          {workflowData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-[0.75rem] text-text-muted">No exception activity</div>
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer>
                <BarChart data={workflowData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, padding: '6px 10px' }}
                    cursor={{ fill: 'rgba(106, 18, 205, 0.06)' }}
                    formatter={(value) => [`${value as number} open`, 'Exceptions']}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    fill="#6a12cd"
                    className="cursor-pointer"
                    onClick={(data) => {
                      const wfId = (data as { workflowId?: string }).workflowId;
                      if (wfId) onDrillToExceptions();
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ─── Heatmap ─── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-text">{labels.heatmapHeader.replace('14', String(heatmapDays))}</h3>
            <p className="text-[0.6875rem] text-text-muted mt-0.5">Rows are workflows; each cell is a day. Click a cell to drill into that workflow.</p>
          </div>
          <div className="flex items-center gap-2 text-[0.65625rem] text-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-surface-2/40 border border-border-light/30" />0
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-mitigated-50 border border-mitigated-100" />1
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-high-50 border border-high-100" />3+
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-risk-100 border border-risk-100/80" />5+
            </span>
          </div>
        </div>
        {!heatmapHasData ? (
          <div className="h-[120px] flex items-center justify-center text-[0.75rem] text-text-muted">No exception activity in the last {heatmapDays} days</div>
        ) : (
          <div className="space-y-1.5">
            {heatmapData.map(row => (
              <div key={row.workflowId} className="flex items-center gap-3">
                <button
                  onClick={() => onDrillToExceptions()}
                  className="w-[180px] text-left text-[0.71875rem] text-text font-medium truncate hover:text-primary transition-colors cursor-pointer shrink-0"
                  title={row.name}
                >
                  {row.name}
                </button>
                <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmapDays}, minmax(0, 1fr))` }}>
                  {row.counts.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => onDrillToExceptions()}
                      title={`${formatChartDay(heatmapDays - 1 - idx)} — ${c} exception${c === 1 ? '' : 's'}`}
                      className={`h-6 rounded-sm border transition-transform hover:scale-110 cursor-pointer ${heatmapCellCls(c)}`}
                    >
                      {c > 0 && <span className="text-[0.5625rem] font-bold text-text/70">{c}</span>}
                    </button>
                  ))}
                </div>
                <span className="text-[0.6875rem] font-bold text-text tabular-nums w-8 text-right shrink-0">{row.total}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1.5">
              <div className="w-[180px] text-[0.625rem] text-text-muted shrink-0" />
              <div className="flex-1 grid gap-1 text-[0.5625rem] text-text-muted tabular-nums" style={{ gridTemplateColumns: `repeat(${heatmapDays}, minmax(0, 1fr))` }}>
                {Array.from({ length: heatmapDays }).map((_, idx) => {
                  const offset = heatmapDays - 1 - idx;
                  // Label every 2nd day to avoid crowding.
                  return (
                    <div key={idx} className="text-center">
                      {offset % 2 === 0 ? formatChartDay(offset).split(' ')[1] : ''}
                    </div>
                  );
                })}
              </div>
              <div className="w-8 shrink-0" />
            </div>
          </div>
        )}
      </div>

      {/* ─── Auditor intelligence strip — effectiveness + pattern + anomaly + lifecycle funnel ─── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Workflow effectiveness */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[0.8125rem] font-semibold text-text">{labels.effectivenessHeader}</h3>
              <p className="text-[0.6875rem] text-text-muted mt-0.5">True positives / total fires per workflow. Click a workflow to see its past runs.</p>
            </div>
          </div>
          <div className="space-y-1">
            {MOCK_WORKFLOWS.map(wf => {
              const eff = wf.totalFires > 0 ? Math.round((wf.truePositives / wf.totalFires) * 100) : 0;
              const tier = effectivenessTier(eff);
              return (
                <button
                  key={wf.id}
                  onClick={() => onOpenWorkflow?.(wf.libraryId)}
                  disabled={!onOpenWorkflow}
                  className={`w-full space-y-1 text-left px-2 py-1.5 -mx-2 rounded-lg transition-colors ${onOpenWorkflow ? 'hover:bg-surface-2/50 cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.75rem] text-text truncate">{wf.name}</span>
                    <span className={`text-[0.75rem] font-bold tabular-nums shrink-0 ${tier.tone}`}>{eff}% · {tier.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full ${tier.bar} transition-all`} style={{ width: `${eff}%` }} />
                    </div>
                    <span className="text-[0.65625rem] text-text-muted tabular-nums shrink-0 w-12 text-right">{wf.truePositives}/{wf.totalFires}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lifecycle funnel */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[0.8125rem] font-semibold text-text">{labels.funnelHeader}</h3>
              <p className="text-[0.6875rem] text-text-muted mt-0.5">
                {isAutomation
                  ? 'Where exceptions sit in the resolution pipeline. Bottlenecks become visible.'
                  : isCompliance
                    ? 'Where controls sit in the test pipeline. Big drop = bottleneck.'
                    : 'Stage the engagement is currently at in the IA pipeline.'}
              </p>
            </div>
          </div>
          {(() => {
            const max = Math.max(1, ...funnelSteps.map(s => s.count));
            return (
              <div className="space-y-2">
                {funnelSteps.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="text-[0.6875rem] text-text-muted w-24 shrink-0 truncate">{s.label}</span>
                    <div className="flex-1 h-7 bg-surface-2/40 rounded-md overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.count / max) * 100}%` }}
                        transition={{ delay: 0.05 + i * 0.06, duration: 0.4 }}
                        className={`h-full ${s.bar} flex items-center px-2`}
                      >
                        {s.count > 0 && <span className="text-[0.6875rem] font-bold text-white tabular-nums">{s.count}</span>}
                      </motion.div>
                    </div>
                    <span className="text-[0.6875rem] text-text-muted tabular-nums w-12 text-right shrink-0">
                      {max === 0 ? '—' : `${Math.round((s.count / max) * 100)}%`}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Pattern detection + anomaly strip */}
      <div className="space-y-2">
        {(() => {
          // Pattern: vendor clustering — find a vendor reference appearing in multiple exception titles
          const vendorPattern = (() => {
            const counts = new Map<string, number>();
            exceptions.forEach(e => {
              const m = e.title.match(/V-\d{4}/);
              if (m) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
            });
            const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
            return top && top[1] >= 2 ? { vendor: top[0], count: top[1] } : null;
          })();
          // Anomaly: a frequency workflow whose last run is older than 24h (silent failure)
          const silentMonitor = MOCK_WORKFLOWS.find(wf => wf.cadence.kind === 'Frequency' && /(\d+)d ago/.test(wf.lastRun));
          return (
            <>
              {vendorPattern && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-mitigated-50/40 border border-mitigated-100/60">
                  <Sparkles size={14} className="text-mitigated-700 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[0.78125rem] text-text font-medium">
                      Pattern detected — exceptions clustering on vendor <span className="font-mono font-bold">{vendorPattern.vendor}</span> ({vendorPattern.count} cases this engagement).
                    </div>
                    <div className="text-[0.6875rem] text-text-muted mt-0.5">Open the Vendor 360 view to see this vendor's full risk profile across engagements.</div>
                  </div>
                </div>
              )}
              {silentMonitor && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-risk-50/40 border border-risk-100/60">
                  <AlertTriangle size={14} className="text-risk-700 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[0.78125rem] text-text font-medium">
                      Possible silent failure — <span className="font-semibold">{silentMonitor.name}</span> hasn't fired exceptions in {silentMonitor.lastRun} despite a frequency schedule.
                    </div>
                    <div className="text-[0.6875rem] text-text-muted mt-0.5">Check the data feed / connector status.</div>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* ─── Workflow Configuration list ─── */}
      {!hideWorkflowConfig && <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-text">{labels.workflowConfigHeader}</h3>
            <p className="text-[0.6875rem] text-text-muted mt-0.5">{labels.workflowConfigSub}</p>
          </div>
        </div>
        <div className="space-y-4">
          {groupBySubProcess(MOCK_WORKFLOWS).map(group => (
            <div key={group.subProcess}>
              <div className="flex items-center gap-2 mb-2">
                <Layers size={12} className="text-text-muted" />
                <span className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider">{group.subProcess}</span>
                <span className="text-[0.6875rem] text-text-muted">· {group.items.length}</span>
              </div>
              <div className="space-y-2 ml-5">
                {group.items.map(wf => {
                  const exCount = exceptionsByWorkflow.get(wf.id) ?? 0;
                  return (
                    <div key={wf.id} className="flex items-center gap-3 p-3 rounded-lg border border-border-light hover:border-primary/20 transition-colors">
                      <div className="p-2 rounded-lg bg-brand-50 shrink-0"><Workflow size={14} className="text-brand-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[0.8125rem] font-semibold text-text">{wf.name}</span>
                          <span className="px-1.5 h-4 rounded text-[0.59375rem] font-bold bg-surface-2 text-text-secondary font-mono">{wf.code}</span>
                          {wf.inputs.map(src => (
                            <span key={src} className={`inline-flex items-center gap-1 px-1.5 h-4 rounded text-[0.59375rem] font-bold uppercase tracking-wide border ${INPUT_BADGE_CLS[src]}`}>
                              {src === 'SQL' && <span className="w-1 h-1 rounded-full bg-evidence-600" aria-hidden="true" />}
                              {src}
                            </span>
                          ))}
                        </div>
                        <div className="text-[0.6875rem] text-text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                          {wf.cadence.kind === 'Ad-hoc' ? (
                            <span className="inline-flex items-center px-1.5 h-4 rounded text-[0.625rem] font-semibold italic bg-mitigated-50/60 text-mitigated-700 border border-mitigated-100/60">Ad-hoc</span>
                          ) : (
                            <span className="text-text-secondary font-medium">{wf.cadence.label}</span>
                          )}
                          <span className="text-border">·</span>
                          <span>Last run {wf.lastRun}</span>
                          <span className="text-border">·</span>
                          <span className={exCount > 0 ? 'text-risk-700 font-semibold' : 'text-text-muted'}>
                            {exCount} open exception{exCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onConfigureWorkflow(wf.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[0.6875rem] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer shrink-0"
                      >
                        <Settings size={11} />
                        Configure
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* ─── Engagement at a glance + recent activity (kept) ─── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-3">Engagement at a glance</h3>
          <dl className="space-y-2.5 text-[0.78125rem]">
            <div className="flex items-center justify-between"><dt className="text-text-muted">Type</dt><dd className="text-text font-medium">Automation{eng.subtype ? ` · ${eng.subtype}` : ''}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-text-muted">Process</dt><dd className="text-text font-medium">{eng.process}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-text-muted">Framework</dt><dd className="text-text font-medium">{eng.framework}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-text-muted">Period</dt><dd className="text-text font-medium">{eng.periodStart} – {eng.periodEnd}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-text-muted">Owner</dt><dd className="text-text font-medium">{eng.owner}</dd></div>
          </dl>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-3">Recent activity</h3>
          <ul className="space-y-3 text-[0.78125rem]">
            <li className="flex items-start gap-2.5">
              <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-compliant shrink-0" />
              <div>
                <div className="text-text">Workflow run completed — {eng.lastActivity}</div>
                <div className="text-[0.6875rem] text-text-muted">{eng.owner}</div>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-evidence-500 shrink-0" />
              <div>
                <div className="text-text">
                  {openCount + inProgressCount > 0
                    ? `${openCount + inProgressCount} open / in-progress exception(s)`
                    : 'No open exceptions'}
                </div>
                <div className="text-[0.6875rem] text-text-muted">Updated {eng.lastActivity}</div>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-mitigated-500 shrink-0" />
              <div>
                <div className="text-text">Next run: {eng.nextScheduled}</div>
                <div className="text-[0.6875rem] text-text-muted">On schedule</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, tone, onClick, progress, progressCls,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  tone: string;
  onClick?: () => void;
  progress?: number;
  progressCls?: string;
}) {
  const isClickable = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={`text-left glass-card p-4 transition-all ${isClickable ? 'cursor-pointer hover:border-primary/30 hover:shadow-sm' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.65625rem] uppercase tracking-wide font-semibold text-text-muted">{label}</span>
        <Icon size={13} className="text-text-muted" />
      </div>
      <div className={`text-[1.375rem] font-bold tabular-nums leading-none ${tone}`}>{value}</div>
      {sub && <div className="text-[0.6875rem] text-text-muted mt-1.5">{sub}</div>}
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${progressCls ?? 'bg-primary'}`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Per-workflow Configuration Drawer
// ═════════════════════════════════════════════════════════════════════════════

const OWNER_LIST = ['Tushar Goel', 'Neha Joshi', 'Karan Mehta', 'Sneha Desai', 'Rohan Patel', 'Priya Singh', 'Deepak Bansal'];
const SCHEDULE_OPTIONS = ['Hourly', 'Daily 6 AM', 'Daily 9 AM', 'Weekly Mon 6 AM', 'Ad-hoc'] as const;
const RETRY_OPTIONS = ['Off', '1x', '3x', '5x'] as const;
const SEVERITY_MIN_OPTIONS: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

function WorkflowConfigDrawer({
  workflowId,
  onClose,
  onSaved,
}: {
  workflowId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const wf = MOCK_WORKFLOWS.find(w => w.id === workflowId);
  const initialSchedule: string = wf?.cadence.kind === 'Ad-hoc' ? 'Ad-hoc' : wf?.cadence.label ?? 'Daily 6 AM';
  const [schedule, setSchedule] = useState<string>(initialSchedule);
  const [threshold, setThreshold] = useState<string>('0.85');
  const [retry, setRetry] = useState<string>('3x');
  const [owner, setOwner] = useState<string>(OWNER_LIST[0]);
  const [minSeverity, setMinSeverity] = useState<Severity>('Medium');

  if (!wf) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog"
        aria-label="Workflow configuration"
      >
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Settings size={16} className="text-brand-600 shrink-0" />
              <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight truncate">{wf.name}</h2>
            </div>
            <p className="text-[0.75rem] text-ink-500">
              <span className="font-mono">{wf.code}</span>
              <span className="mx-1.5 text-ink-300">·</span>
              {wf.type}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close drawer"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Schedule */}
          <div>
            <label className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-2 block">Schedule</label>
            <div className="grid grid-cols-2 gap-2">
              {SCHEDULE_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setSchedule(s)}
                  className={`px-3 py-2 rounded-lg border text-[0.75rem] font-medium transition-all cursor-pointer ${
                    schedule === s
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                      : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'
                  }`}
                >
                  {s === 'Ad-hoc' ? <span className="italic">{s}</span> : s}
                </button>
              ))}
            </div>
          </div>

          {/* Detection threshold */}
          <div>
            <label className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-2 block">Detection threshold</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min="0.5" max="1" step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="flex-1 accent-brand-500"
              />
              <span className="w-12 text-right text-[0.875rem] font-bold text-ink-900 tabular-nums">{(parseFloat(threshold) * 100).toFixed(0)}%</span>
            </div>
            <p className="text-[0.6875rem] text-ink-500 mt-1.5">Minimum confidence required to raise an exception. Higher = fewer false positives.</p>
          </div>

          {/* Retry */}
          <div>
            <label className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-2 block">Retry policy</label>
            <div className="flex gap-2">
              {RETRY_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => setRetry(r)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-[0.75rem] font-medium transition-all cursor-pointer ${
                    retry === r
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                      : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Owner */}
          <div>
            <label className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-2 block">Owner</label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 cursor-pointer"
            >
              {OWNER_LIST.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Min severity to alert */}
          <div>
            <label className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-2 block">Minimum severity to alert</label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITY_MIN_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setMinSeverity(s)}
                  className={`px-2 py-2 rounded-lg border text-[0.6875rem] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                    minSeverity === s
                      ? `${SEV_BADGE_CLS[s]} ring-2 ring-brand-500/20`
                      : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Data source preview */}
          <div className="rounded-lg border border-border-light bg-canvas/60 p-3 flex items-start gap-2.5">
            <Database size={13} className="text-text-muted mt-0.5 shrink-0" />
            <div className="text-[0.6875rem] text-text-muted leading-relaxed">
              <span className="font-semibold text-text">Inputs:</span> {wf.inputs.join(' · ')}
              {wf.inputs.includes('SQL') && (
                <div className="mt-1">SQL queries reuse the engagement's connected data source. Edit the source in Knowledge Hub.</div>
              )}
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <Gated permission="eng_edit" mode="disable" title="You don't have permission to edit this engagement">
          <button
            onClick={onSaved}
            className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
          >
            Save configuration
          </button>
          </Gated>
        </footer>
      </motion.aside>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Sub-process accordion for the Workflows tab + Overview workflow config list
// ═════════════════════════════════════════════════════════════════════════════

function groupBySubProcess<T extends { subProcess: string }>(items: T[]): { subProcess: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  items.forEach(it => {
    const arr = map.get(it.subProcess) ?? [];
    arr.push(it);
    map.set(it.subProcess, arr);
  });
  return Array.from(map.entries()).map(([subProcess, items]) => ({ subProcess, items }));
}

function toLibraryShape(wf: MockWorkflow): LibraryWorkflow {
  return {
    id: wf.libraryId,
    name: wf.name,
    description: wf.type,
    tags: [wf.subProcess],
    businessProcess: wf.subProcess,
    controlId: wf.code,
    live: wf.cadence.kind === 'Frequency',
  };
}

function linkedToMockWorkflow(w: LibraryWorkflow): MockWorkflow {
  return {
    id: `linked-${w.id}`,
    code: w.controlId,
    name: w.name,
    type: 'Linked',
    inputs: ['SQL'],
    cadence: w.live ? { kind: 'Frequency', label: 'Daily 6 AM' } : { kind: 'Ad-hoc' },
    lastRun: 'Not run yet',
    status: 'Success',
    subProcess: w.businessProcess,
    truePositives: 0,
    totalFires: 0,
    libraryId: w.id,
  };
}

/** Parse a "2h ago" / "8m ago" / "12h ago" / "Not run yet" string to minutes-ago for sorting (older = larger). */
function lastRunMinutes(s: string): number {
  const m = s.match(/(\d+)\s*(m|h|d)\b/);
  if (!m) return Number.POSITIVE_INFINITY; // "Not run yet" sorts last
  const n = parseInt(m[1], 10);
  return m[2] === 'm' ? n : m[2] === 'h' ? n * 60 : n * 1440;
}

type WorkflowSort = 'default' | 'open' | 'lastRun';
const WF_SORT_OPTIONS: { value: WorkflowSort; label: string }[] = [
  { value: 'default', label: 'Default order' },
  { value: 'open', label: 'Open exceptions' },
  { value: 'lastRun', label: 'Last run' },
];

function WorkflowsBySubProcess({
  workflows,
  engagementId,
  engagementName,
  onOpenWorkflow,
  onConfigureWorkflow,
  onCreateWorkflow,
}: {
  workflows: MockWorkflow[];
  engagementId: string;
  engagementName: string;
  onOpenWorkflow?: (libraryWorkflowId: string) => void;
  onConfigureWorkflow?: (workflowId: string) => void;
  onCreateWorkflow?: () => void;
}) {
  const [linked, setLinked] = useState<MockWorkflow[]>([]);
  const allWorkflows = useMemo(() => [...workflows, ...linked], [workflows, linked]);
  const ws = useEngagementWorkspace();

  /** Control-attributes linked to a workflow (shared with the Controls tab). */
  const linkedAttributesFor = (workflowId: string): { id: string; description: string }[] =>
    ws.attributeIdsForWorkflow(workflowId).map(id => ({ id, description: ws.attributeById(id)?.description ?? id }));

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<WorkflowSort>('default');

  /** Open (non-resolved) exception count per workflow for this engagement — powers the count badge + "Open exceptions" sort. */
  const openByWorkflow = useMemo(() => {
    const m = new Map<string, number>();
    for (const ex of exceptionsForEngagement(engagementId)) {
      if (ex.status === 'Resolved') continue;
      m.set(ex.workflowId, (m.get(ex.workflowId) ?? 0) + 1);
    }
    return m;
  }, [engagementId]);

  const visibleWorkflows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allWorkflows.filter(w =>
      !q || w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q)
         || w.type.toLowerCase().includes(q) || w.subProcess.toLowerCase().includes(q)
    );
    if (sortBy === 'open') {
      list = [...list].sort((a, b) => (openByWorkflow.get(b.id) ?? 0) - (openByWorkflow.get(a.id) ?? 0));
    } else if (sortBy === 'lastRun') {
      list = [...list].sort((a, b) => lastRunMinutes(a.lastRun) - lastRunMinutes(b.lastRun));
    }
    return list;
  }, [allWorkflows, query, sortBy, openByWorkflow]);

  const groups = useMemo(() => groupBySubProcess(visibleWorkflows), [visibleWorkflows]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [grouped, setGrouped] = useState(false); // flat list by default; grouping is opt-in
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const { addToast } = useToast();
  const logEvent = useAuditLog();

  const toggle = (sp: string) => setCollapsed(prev => {
    const n = new Set(prev);
    if (n.has(sp)) n.delete(sp); else n.add(sp);
    return n;
  });

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const enterBulkMode = () => { setBulkMode(true); setSelectedIds(new Set()); };
  const exitBulkMode = () => { setBulkMode(false); setSelectedIds(new Set()); };
  const selectAll = () => setSelectedIds(new Set(allWorkflows.map(w => w.id)));
  const allSelected = allWorkflows.length > 0 && selectedIds.size === allWorkflows.length;

  const selectedLibraryWorkflows = useMemo(
    () => allWorkflows.filter(w => selectedIds.has(w.id)).map(toLibraryShape),
    [allWorkflows, selectedIds]
  );

  const handleLink = (picked: LibraryWorkflow[]) => {
    setLinked(prev => {
      const have = new Set([...workflows, ...prev].map(w => w.libraryId));
      const fresh = picked.filter(w => !have.has(w.id)).map(linkedToMockWorkflow);
      return [...prev, ...fresh];
    });
    setLinkModalOpen(false);
    addToast({ message: `Linked ${picked.length} workflow${picked.length === 1 ? '' : 's'} to ${engagementName}`, type: 'success' });
    logEvent({ action: 'Update', description: `Linked ${picked.length} workflow${picked.length === 1 ? '' : 's'} to engagement "${engagementName}"`, module: 'Engagements', entity: 'Workflow' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-[0.8125rem] font-semibold text-text shrink-0">
            Workflows
            {grouped && <span className="text-text-muted font-normal ml-2">· grouped by process</span>}
          </h3>
          {!bulkMode && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search workflows..."
                className="w-52 pl-8 pr-2.5 py-1.5 text-[0.75rem] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {bulkMode && (
            <>
              <span className="text-[0.75rem] text-text-secondary">
                <span className="font-semibold text-text">{selectedIds.size}</span> selected
              </span>
              <button
                onClick={allSelected ? () => setSelectedIds(new Set()) : selectAll}
                className="text-[0.71875rem] font-semibold text-text-secondary hover:text-primary px-2 py-1 cursor-pointer"
              >
                {allSelected ? 'Clear' : 'Select all'}
              </button>
              <button
                onClick={() => setBulkModalOpen(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:bg-text-muted/30 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
              >
                <Play size={12} />Execute {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
              <button
                onClick={exitBulkMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-surface-2 text-[0.75rem] font-semibold text-text-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
          {!bulkMode && (
            <>
              <div className="relative flex items-center">
                <ArrowUpDown size={13} className="absolute left-2.5 text-text-muted pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as WorkflowSort)}
                  className="pl-8 pr-2.5 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] font-semibold text-text-secondary outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 cursor-pointer"
                  title="Sort workflows"
                  aria-label="Sort workflows"
                >
                  {WF_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
                </select>
              </div>
              <button
                onClick={() => setGrouped(g => !g)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.75rem] font-semibold transition-colors cursor-pointer ${
                  grouped
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-secondary border-border hover:border-primary/30 hover:text-primary'
                }`}
                title="Group workflows by process"
              >
                <Layers size={12} />Group by process
              </button>
              <button
                onClick={enterBulkMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-[#6a12cd] hover:text-white hover:border-[#6a12cd] text-[0.75rem] font-semibold text-text-secondary transition-colors cursor-pointer"
              >
                <Play size={12} />Execute Workflows
              </button>
              <button
                onClick={() => setLinkModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[0.75rem] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
              >
                <Plus size={12} />Add Workflows
              </button>
            </>
          )}
        </div>
      </div>

      {visibleWorkflows.length === 0 ? (
        <div className="glass-card px-4 py-10 text-center text-[0.75rem] text-text-muted">
          No workflows match “{query}”.
        </div>
      ) : grouped ? (
        <div className="space-y-3">
          {groups.map(group => {
            const isCollapsed = collapsed.has(group.subProcess);
            return (
              <div key={group.subProcess} className="glass-card overflow-hidden">
                <button
                  onClick={() => toggle(group.subProcess)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors cursor-pointer text-left"
                >
                  <div className="p-1.5 rounded-lg bg-brand-50 shrink-0"><Layers size={13} className="text-brand-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[0.8125rem] font-semibold text-text">{group.subProcess}</span>
                      <span className="text-[0.6875rem] text-text-muted">{group.items.length} workflow{group.items.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className={`text-text-muted transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-90'}`} />
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden border-t border-border-light"
                    >
                      <div className="space-y-2 p-2.5">
                        {group.items.map(wf => (
                          <WorkflowRow
                            key={wf.id}
                            wf={wf}
                            openCount={openByWorkflow.get(wf.id) ?? 0}
                            linkedAttributes={linkedAttributesFor(wf.id)}
                            bulkMode={bulkMode}
                            selected={selectedIds.has(wf.id)}
                            onToggleSelect={() => toggleSelect(wf.id)}
                            onOpen={() => onOpenWorkflow?.(wf.libraryId)}
                            onConfigure={() => onConfigureWorkflow?.(wf.id)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleWorkflows.map(wf => (
            <WorkflowRow
              key={wf.id}
              wf={wf}
              openCount={openByWorkflow.get(wf.id) ?? 0}
              linkedAttributes={linkedAttributesFor(wf.id)}
              bulkMode={bulkMode}
              selected={selectedIds.has(wf.id)}
              onToggleSelect={() => toggleSelect(wf.id)}
              onOpen={() => onOpenWorkflow?.(wf.libraryId)}
              onConfigure={() => onConfigureWorkflow?.(wf.id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {bulkModalOpen && (
          <BulkExecuteModal
            selectedWorkflows={selectedLibraryWorkflows}
            onClose={() => setBulkModalOpen(false)}
            onContinue={() => { setBulkModalOpen(false); exitBulkMode(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {linkModalOpen && (
          <LinkWorkflowModal
            engagementName={engagementName}
            alreadyLinkedIds={allWorkflows.map(w => w.libraryId)}
            onClose={() => setLinkModalOpen(false)}
            onLink={handleLink}
            onCreateNew={() => { setLinkModalOpen(false); onCreateWorkflow?.(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkflowRow({
  wf, openCount, linkedAttributes, bulkMode, selected, onToggleSelect, onOpen, onConfigure,
}: {
  wf: MockWorkflow;
  openCount: number;
  linkedAttributes: { id: string; description: string }[];
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onConfigure: () => void;
}) {
  const eff = wf.totalFires > 0 ? Math.round((wf.truePositives / wf.totalFires) * 100) : 0;
  const tier = effectivenessTier(eff);
  const wfRecs = actionableWorkflowRecs({ subjectLabel: wf.name, effectivePct: eff, openExceptions: openCount, cadence: wf.cadence.kind === 'Ad-hoc' ? 'Ad-hoc' : wf.cadence.label, status: wf.status, category: wf.type });
  const handleRowClick = () => {
    if (bulkMode) onToggleSelect();
    else onOpen();
  };
  return (
    <div
      onClick={handleRowClick}
      className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all cursor-pointer group ${
        selected
          ? 'border-primary/40 bg-primary-xlight/30'
          : 'border-border-light bg-white hover:border-primary/50 hover:shadow-sm'
      }`}
    >
      {bulkMode ? (
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Checkbox checked={selected} onChange={onToggleSelect} ariaLabel={`Select ${wf.name}`} />
        </div>
      ) : (
        <div className="p-2.5 rounded-xl bg-brand-50 shrink-0"><Workflow size={16} className="text-brand-600" /></div>
      )}
      <div className="flex-1 min-w-0">
        {/* Title line */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-text leading-snug">{wf.name}</span>
          <span className="px-1.5 h-[18px] rounded text-[10px] font-bold bg-surface-2 text-text-secondary font-mono inline-flex items-center">{wf.code}</span>
          {wfRecs.length > 0 && (
            <span onClick={(e) => e.stopPropagation()} className="shrink-0 inline-flex">
              <AIRecommendsPopover recs={wfRecs} subjectLabel={wf.code} subjectSub={wf.name} />
            </span>
          )}
        </div>
        {/* Meta line — generous spacing, input badges grouped here */}
        <div className="text-[0.71875rem] text-text-muted mt-2 flex items-center gap-x-2.5 gap-y-1.5 flex-wrap">
          <span className="font-medium text-text-secondary">{wf.type}</span>
          <span className="text-border-light">·</span>
          {wf.cadence.kind === 'Ad-hoc' ? (
            <span className="inline-flex items-center px-1.5 h-[18px] rounded text-[0.625rem] font-semibold italic bg-mitigated-50/60 text-mitigated-700">Ad-hoc</span>
          ) : (
            <span className="text-text-secondary font-medium">{wf.cadence.label}</span>
          )}
          <span className="text-border-light">·</span>
          <span>Last run {wf.lastRun}</span>
          <span className="text-border-light">·</span>
          <span className={`${tier.tone} font-semibold`}>{eff}% effective</span>
          <span className="text-text-muted/80">({wf.truePositives}/{wf.totalFires} · 90d)</span>
          {openCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 h-[18px] rounded text-[0.625rem] font-bold bg-risk-50 text-risk-700">
              <AlertTriangle size={9} />{openCount} open
            </span>
          )}
          {/* Input source badges */}
          {wf.inputs.map(src => (
            <span key={src} className={`inline-flex items-center gap-1 px-1.5 h-[18px] rounded text-[0.59375rem] font-bold uppercase tracking-wide border ${INPUT_BADGE_CLS[src]}`}>
              {src === 'SQL' && <span className="w-1 h-1 rounded-full bg-evidence-600" aria-hidden="true" />}
              {src}
            </span>
          ))}
        </div>
        {/* Linked control-attributes (shared with the Controls tab) */}
        {linkedAttributes.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold uppercase tracking-wider text-text-muted shrink-0">
              <ListChecks size={11} /> Controls
            </span>
            {linkedAttributes.slice(0, 4).map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 px-1.5 h-[18px] rounded-md text-[0.625rem] font-medium bg-brand-50 text-brand-700 border border-brand-100 max-w-[220px]">
                <span className="font-mono text-[0.5625rem] opacity-70 shrink-0">{a.id}</span>
                <span className="truncate">{a.description}</span>
              </span>
            ))}
            {linkedAttributes.length > 4 && (
              <span className="text-[0.625rem] font-semibold text-text-muted">+{linkedAttributes.length - 4} more</span>
            )}
          </div>
        )}
      </div>
      <span className={`px-2.5 h-6 rounded-full text-[0.65625rem] font-semibold inline-flex items-center shrink-0 ${
        wf.status === 'Success' ? 'bg-compliant-50 text-compliant-700'
        : wf.status === 'Running' ? 'bg-evidence-50 text-evidence-700'
        : 'bg-risk-50 text-risk-700'
      }`}>{wf.status}</span>
      {!bulkMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onConfigure(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[0.6875rem] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
          title="Configure workflow"
        >
          <Settings size={11} />
          Configure
        </button>
      )}
      <ChevronRight size={15} className="text-text-muted shrink-0" />
    </div>
  );
}
