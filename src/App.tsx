import { useRef, useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useAppState } from './hooks/useAppState';
import { ToastProvider } from './components/shared/Toast';
import { BulkRunProgressProvider } from './components/shared/BulkRunProgress';
import { GENERATED_REPORTS } from './data/mockData';
import Sidebar from './components/sidebar/Sidebar';
import ChatView from './components/chat/ChatView';
import ArtifactPanel from './components/artifacts/ArtifactPanel';
import ChatWorkflowWorkspace from './components/chat/ChatWorkflowWorkspace';
import WorkflowTemplates from './components/workflow/WorkflowTemplates';
import WorkflowDetail from './components/workflow/WorkflowDetail';
import WorkflowLibraryView from './components/workflow/WorkflowLibraryView';
import BusinessProcesses from './components/audit/BusinessProcesses';
import RiskRegister from './components/audit/RiskRegister';
import AuditExecution from './components/audit/AuditExecution';
import DashboardView from './components/dashboard/DashboardView';
import DashboardListPage from './components/dashboard/DashboardListPage';
import ReportsView, { CUSTOM_TEMPLATES } from './components/reports/ReportsView';
import { REPORT_TEMPLATES } from './data/mockData';
import HomeView from './components/home/HomeView';
import RecentsView from './components/recents/RecentsView';
import KnowledgeHubView from './components/knowledge/KnowledgeHubView';
import ExceptionManagementModal from './components/modals/ExceptionManagementModal';
import EmailPreviewModal from './components/modals/EmailPreviewModal';
import ShareModal from './components/modals/ShareModal';
import PowerBIImportWizard from './components/modals/PowerBIImportWizard';
import ReportBuilder from './components/reports/ReportBuilder';
import AuditPlanningView from './components/audit/AuditPlanningView';
import AuditPlanningPage from './components/audit/AuditPlanningPage';
import EngagementsView from './components/audit/EngagementsView';
import EngagementOverviewView from './components/audit/EngagementOverviewView';
import ClosedCaseSamplingView from './components/audit/ClosedCaseSamplingView';
import MyQueueView from './components/audit/MyQueueView';
import Vendor360View from './components/audit/Vendor360View';
import EngagementCompareView from './components/audit/EngagementCompareView';
import CaseManagementWorkspace from './components/audit/CaseManagementWorkspace';
import ProgramsView from './components/audit/ProgramsView';
// New pages
import RACMView from './components/governance/RACMView';
import RacmFullPageEditor from './components/audit/RacmFullPageEditor';
import ControlLibraryView from './components/governance/ControlLibraryView';
import ControlTestingView from './components/execution/ControlTestingView';
import EvidenceView from './components/execution/EvidenceView';
import AIConciergeView from './components/intelligence/AIConciergeView';
import WorkflowBuilderJourney from './components/concierge-workflow-builder/WorkflowBuilderJourney';
import AdminView from './components/admin/AdminView';
import PlatformUsageView from './components/admin/PlatformUsageView';
import FindingsView from './components/execution/FindingsView';
import WorkflowExecutor from './components/workflow/WorkflowExecutor';
import WorkflowEditInChatJourney from './components/workflow-edit-in-chat/WorkflowEditInChatJourney';
import EngagementDetailView from './components/engagement/EngagementDetailView';
import ControlDetailDrawer from './components/engagement/ControlDetailDrawer';
// V2 Execution placeholder — old execution UI detached from main flow
import EngagementExecutionV2Placeholder from './components/engagement-execution-v2/EngagementExecutionV2Placeholder';
import EngagementExecutionV2 from './components/engagement-execution-v2/EngagementExecutionV2';
import ManageExceptionsView from './components/exceptions/ManageExceptionsView';
import WorkingPaperPanel from './components/execution/WorkingPaperPanel';
import WorkflowExecutionPanel from './components/execution/WorkflowExecutionPanel';
import TraceabilityPanel from './components/execution/TraceabilityPanel';
import NotificationDrawer from './components/notifications/NotificationDrawer';
import { createNotification, type PlatformNotification } from './data/notifications';

const LAUNCHED_FROM_REPORT =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('from') &&
  new URLSearchParams(window.location.search).get('view') === 'manage-exceptions';

// Built-in dashboards exposed to the "Add to Dashboard" modal in ChatView
const BUILTIN_DASHBOARDS = [
  { id: 'p2p', name: 'Procurement (P2P)', description: 'Procure-to-Pay analytics', accent: 'bg-brand-50 text-brand-700' },
  { id: 'grc', name: 'GRC Overview', description: 'Governance, risk & compliance', accent: 'bg-brand-50 text-brand-700' },
  { id: 'o2c', name: 'Order to Cash (O2C)', description: 'Revenue & collections overview', accent: 'bg-brand-50 text-brand-700' },
  { id: 's2c', name: 'Source to Contract (S2C)', description: 'Sourcing & contract management', accent: 'bg-brand-50 text-brand-700' },
];

const SHARED_DASHBOARD_OPTIONS = [
  { id: 'shared-1', name: 'Vendor Risk Assessment', description: 'Evaluation of vendor risk profiles', accent: 'bg-brand-50 text-brand-700', sharedBy: 'Sarah Johnson' },
  { id: 'shared-2', name: 'SOX Compliance Tracker', description: 'SOX compliance progress and control testing', accent: 'bg-brand-50 text-brand-700', sharedBy: 'Michael Chen' },
  { id: 'shared-3', name: 'GL Reconciliation Monitor', description: 'General Ledger reconciliation status', accent: 'bg-brand-50 text-brand-700', sharedBy: 'Sneha Desai' },
];

export default function App() {
  const {
    state,
    setView,
    toggleSidebar,
    setSidebarExpanded,
    setActiveArtifactTab,
    setArtifactMode,
    setShowArtifacts,
    toggleChatHistory,
    setSelectedWorkflow,
    setSelectedBP,
    openAuditExecution,
    openEngagement,
    openCaseManagement,
    setShowExceptionModal,
    setShowEmailPreviewModal,
    setShowShareModal,
    setShowPowerBIWizard,
    openReportBuilder,
    setWorkflowCanvasStage,
    setWorkflowType,
    setChatInitialQuery,
    setChatComposerDraft,
    setQueryAssumptions,
    enterWorkflowMode,
    openWorkflowExecutor,
    openChat,
    setSelectedChatId,
    openDashboard,
    saveDashboardWidgets,
    addCreatedDashboard,
    deleteCreatedDashboard,
    updateDashboardSource,
    openKnowledgeHub,
    setPendingDashboard,
    openExecutionPanel,
    closeExecutionPanel,
    setExceptionRole,
    launchWorkflowBuilderWithPrompt,
    setWorkflowBuilderSeedPrompt,
    openNotificationDrawer,
    closeNotificationDrawer,
    markNotificationRead,
    markAllNotificationsRead,
    setNotificationActionState,
    restoreNotification,
    setFocusedNotificationRefId,
    addNotification,
  } = useAppState();

  const unreadNotifications = state.notifications.filter(n => !n.read).length;

  const handleNotificationSelect = (n: PlatformNotification) => {
    markNotificationRead(n.id);
    closeNotificationDrawer();
    // Tell the target view which item to focus. Set BEFORE setView so the
    // view's first render can read it.
    setFocusedNotificationRefId(n.link?.ref?.id ?? null);
    if (n.link?.view) setView(n.link.view);
  };

  const mainScrollRef = useRef<HTMLDivElement>(null);
  const chatSplitContainerRef = useRef<HTMLDivElement>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Artifact panel width in pixels (only meaningful when both panes are
  // visible). Persisted to localStorage so the user's resize choice survives
  // reloads. Default 464px; clamped at drag time so neither pane collapses.
  const ARTIFACT_PANEL_PX_KEY = 'artifact-panel-px';
  const ARTIFACT_PANEL_DEFAULT_PX = 464;
  const ARTIFACT_PANEL_MIN_PX = 360;
  const CHAT_MIN_PX = 480;
  const [artifactPanelPx, setArtifactPanelPx] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(ARTIFACT_PANEL_PX_KEY);
      const n = raw ? parseFloat(raw) : ARTIFACT_PANEL_DEFAULT_PX;
      return Number.isFinite(n) && n >= ARTIFACT_PANEL_MIN_PX ? n : ARTIFACT_PANEL_DEFAULT_PX;
    } catch { return ARTIFACT_PANEL_DEFAULT_PX; }
  });
  useEffect(() => {
    try { localStorage.setItem(ARTIFACT_PANEL_PX_KEY, String(artifactPanelPx)); } catch { /* ignore */ }
  }, [artifactPanelPx]);

  const startSplitDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const containerW = chatSplitContainerRef.current?.offsetWidth ?? 1;
    const startX = e.clientX;
    const startWidth = artifactPanelPx;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: MouseEvent) => {
      // Splitter sits to the left of the artifact panel — dragging right
      // shrinks the panel.
      const delta = ev.clientX - startX;
      const maxPx = Math.max(ARTIFACT_PANEL_MIN_PX, containerW - CHAT_MIN_PX);
      const next = Math.max(ARTIFACT_PANEL_MIN_PX, Math.min(maxPx, startWidth - delta));
      setArtifactPanelPx(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [artifactPanelPx]);
  const [controlDrawerId, setControlDrawerId] = useState<string | null>(null);
  const [controlDrawerData, setControlDrawerData] = useState<any>(null);
  const [engagementBackView, setEngagementBackView] = useState<'programs' | 'audit-planning' | 'business-processes'>('programs');
  // Local context for the full-page RACM editor: which RACM, what process, where to go back to.
  type RacmEditorContext = { racmId: string; racmName: string; processLabel: string; backView: 'engagement-overview' | 'business-processes' | 'bp-detail' };
  const [racmEditorContext, setRacmEditorContext] = useState<RacmEditorContext | null>(null);
  const openRacmFullEditor = (ctx: RacmEditorContext) => {
    setRacmEditorContext(ctx);
    setView('racm-full-editor');
  };
  type CustomTemplate = typeof CUSTOM_TEMPLATES[number];
  const CUSTOM_TEMPLATES_KEY = 'irame.reports.customTemplates.v1';
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as CustomTemplate[];
      }
    } catch { /* ignore */ }
    return CUSTOM_TEMPLATES;
  });
  useEffect(() => {
    try { localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(customTemplates)); } catch { /* ignore */ }
  }, [customTemplates]);
  const addCustomTemplate = (t: CustomTemplate) => setCustomTemplates(prev => [t, ...prev]);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [state.view]);

  // Auto-clear the deep-link focus a few seconds after the user lands on
  // the target view. The brief highlight draws the eye; clearing prevents
  // the row from staying perma-highlighted.
  useEffect(() => {
    if (!state.focusedNotificationRefId) return;
    const t = setTimeout(() => setFocusedNotificationRefId(null), 3000);
    return () => clearTimeout(t);
  }, [state.focusedNotificationRefId, setFocusedNotificationRefId]);

  useEffect(() => {
    if (state.view === 'chat' || state.view === 'home') return;
    setViewLoading(true);
    const t = setTimeout(() => setViewLoading(false), 400);
    return () => clearTimeout(t);
  }, [state.view]);

  // ⌘\ (mac) / Ctrl+\ (win/linux) toggles the sidebar pin state. Skips when the
  // user is typing in an input/textarea/contenteditable so it doesn't fight
  // with the chat composer.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '\\' || !(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar]);

  // Ask AI removed from all pages per PRD 2026-04-06 decision
  // IRA AI is accessed exclusively via sidebar navigation to /chat

  const renderArtifactPanel = () => {
    if (!state.showArtifacts) return null;

    const inner = state.artifactMode === 'workflow' ? (
      <ChatWorkflowWorkspace
        onClose={() => setShowArtifacts(false)}
        workflowType={state.workflowType ?? undefined}
      />
    ) : (
      <ArtifactPanel
        activeTab={state.activeArtifactTab}
        setActiveTab={setActiveArtifactTab}
        onClose={() => setShowArtifacts(false)}
        onManageExceptions={() => setShowExceptionModal(true)}
        onAddToReport={() => openReportBuilder('new')}
        onShareResults={() => setShowShareModal(true, { type: 'workflow-output', id: 'result-1' })}
        onOpenInKnowledgeHub={() => { setShowArtifacts(false); setView('knowledge-hub'); }}
        onComposeInChat={(draft) => { setShowArtifacts(false); setChatComposerDraft(draft); }}
      />
    );

    // Mode-flip rotation: Y-axis full spin (0 → 360°). Content swaps at 180°
    // via AnimatePresence mode="wait" + key on artifactMode. perspective applied
    // to wrapper for proper 3D feel; transformStyle preserve-3d on the spinning
    // element so the back face renders correctly.
    return (
      <div style={{ perspective: '1400px' }} className="h-full w-full min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.artifactMode}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 360 }}
            exit={{ rotateY: 360 }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            className="h-full w-full"
          >
            {inner}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  const renderMainView = () => {
    if (viewLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Sparkles size={24} className="text-brand-600" />
            </motion.div>
            <span className="text-[13px] text-ink-500">Loading…</span>
          </div>
        </div>
      );
    }

    switch (state.view) {
      case 'home':
        return (
          <HomeView
            setView={setView}
            notifications={state.notifications}
            onSelectNotification={handleNotificationSelect}
            onOpenNotificationDrawer={openNotificationDrawer}
            setChatInitialQuery={setChatInitialQuery}
            setSelectedWorkflow={setSelectedWorkflow}
            openAuditExecution={openAuditExecution}
            setSelectedBP={setSelectedBP}
          />
        );

      case 'recents':
        return <RecentsView setView={setView} openChat={openChat} openWorkflowExecutor={openWorkflowExecutor} />;

      case 'chat':
        return (
          <div ref={chatSplitContainerRef} className="flex flex-1 h-full overflow-hidden">
            <div
              className="h-full min-w-0"
              style={{ flex: '1 1 0%' }}
            ><ChatView
              showChatHistory={state.showChatHistory}
              toggleChatHistory={toggleChatHistory}
              setShowArtifacts={setShowArtifacts}
              showArtifacts={state.showArtifacts}
              setActiveArtifactTab={setActiveArtifactTab}
              setArtifactMode={setArtifactMode}
              setWorkflowCanvasStage={setWorkflowCanvasStage}
              setWorkflowType={setWorkflowType}
              setQueryAssumptions={setQueryAssumptions}
              initialQuery={state.chatInitialQuery ?? undefined}
              onInitialQueryProcessed={() => setChatInitialQuery(null)}
              composerDraft={state.chatComposerDraft}
              onComposerDraftConsumed={() => setChatComposerDraft(null)}
              selectedChatId={state.selectedChatId}
              onChatLoaded={() => setSelectedChatId(null)}
              setView={setView}
              pendingDashboard={state.pendingDashboard}
              onAddToDashboard={(fields) => {
                const pending = state.pendingDashboard;
                if (!pending) return;
                const newId = `custom-${Date.now()}`;
                addCreatedDashboard({
                  id: newId,
                  name: pending.name,
                  description: pending.description || 'Custom dashboard',
                  timeAgo: 'Just now',
                  creator: 'You',
                  accent: 'bg-brand-50 text-brand-700',
                });
                setPendingDashboard(null);
                openDashboard(newId, fields);
              }}
              onDismissPendingDashboard={() => setPendingDashboard(null)}
              onLaunchWorkflowBuilder={launchWorkflowBuilderWithPrompt}
              availableDashboards={[
                ...state.createdDashboards.map(d => ({ id: d.id, name: d.name, description: d.description, accent: d.accent })),
                ...BUILTIN_DASHBOARDS,
                ...SHARED_DASHBOARD_OPTIONS,
              ]}
              availableReports={GENERATED_REPORTS.map(r => ({ id: r.id, name: r.name, status: r.status as 'draft' | 'final', generatedBy: r.generatedBy }))}
              onAddResultToDashboard={(payload) => {
                if (payload.isNew && payload.newName) {
                  addCreatedDashboard({
                    id: payload.dashboardId,
                    name: payload.newName,
                    description: payload.newDescription || 'Created from chat',
                    timeAgo: 'Just now',
                    creator: 'You',
                    accent: 'bg-brand-50 text-brand-700',
                  });
                }
                // Build widget stubs from granular selection
                const widgetStubs: { chartType: string; title: string; xField: string; yField: string }[] = [];
                if (payload.selection.kpis.length > 0) {
                  widgetStubs.push({ chartType: 'kpi', title: 'Query KPIs', xField: 'Category', yField: 'Value' });
                }
                for (const chartId of payload.selection.charts) {
                  widgetStubs.push({ chartType: 'bar', title: chartId, xField: 'Category', yField: 'Count' });
                }
                if (payload.selection.columns.length > 0) {
                  widgetStubs.push({ chartType: 'table', title: 'Query Results', xField: payload.selection.columns[0], yField: payload.selection.columns[1] || payload.selection.columns[0] });
                }
                const existing = state.dashboardWidgets[payload.dashboardId] || [];
                saveDashboardWidgets(payload.dashboardId, [...existing, ...widgetStubs]);
              }}
              onAddResultToReport={(payload) => {
                // Report builder doesn't have widget persistence yet — for hackathon
                // the message-level addedTo state (handled in ChatView) is sufficient.
                // In production, this would append sections to the report draft.
                if (payload.isNew) {
                  // Could add to a reports list — skipped for hackathon scope
                }
              }}
              onViewDashboard={(id) => openDashboard(id)}
              onViewReport={() => setView('reports')}
            /></div>
            {state.showArtifacts && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize chat / Workspace"
                onMouseDown={startSplitDrag}
                className="group relative w-px shrink-0 cursor-col-resize bg-canvas-border z-10"
              >
                {/* Wider hit target than the visible 1px line */}
                <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-10 rounded-full bg-canvas-border group-hover:bg-brand-300 transition-colors"
                />
              </div>
            )}
            {state.showArtifacts && (
              <div
                className="h-full min-w-0"
                style={{ width: `${artifactPanelPx}px`, flex: '0 0 auto' }}
              >
                {renderArtifactPanel()}
              </div>
            )}
          </div>
        );

      case 'workflow-templates':
        return (
          <WorkflowTemplates
            onSelectWorkflow={(id) => setSelectedWorkflow(id)}
            onBuildNew={() => enterWorkflowMode()}
            onRunWorkflow={(id) => openWorkflowExecutor(id)}
          />
        );

      case 'workflow-detail': {
        const fromLibrary = state.selectedWorkflowId?.startsWith('lw-');
        return (
          <WorkflowDetail
            workflowId={state.selectedWorkflowId!}
            onBack={() => fromLibrary ? setView('workflow-library') : setSelectedWorkflow(null)}
            onOpenExecutor={() => openWorkflowExecutor(state.selectedWorkflowId!)}
            onEditInChat={() => enterWorkflowMode({ workflowId: state.selectedWorkflowId! })}
          />
        );
      }

      case 'workflow-library':
        return (
          <WorkflowLibraryView
            onCreateWorkflow={() => enterWorkflowMode()}
            onSelectWorkflow={(id) => setSelectedWorkflow(id)}
          />
        );

      case 'workflow-executor':
        return (
          <WorkflowExecutor
            workflowId={state.selectedWorkflowId!}
            onBack={() => setSelectedWorkflow(null)}
            onRunComplete={(workflowId) => {
              // Phase 3 producer: push a notification when a workflow run
              // finishes. Same pattern as ShareModal.
              addNotification(createNotification({
                category: 'workflow',
                severity: 'info',
                title: 'Workflow run completed',
                message: `Run finished successfully. Review the output for any flagged exceptions.`,
                actor: 'Ira (AI)',
                link: { view: 'workflow-detail', ref: { kind: 'workflow', id: workflowId } },
              }));
            }}
          />
        );

      case 'workflow-edit-in-chat':
        return (
          <WorkflowEditInChatJourney
            workflowId={state.selectedWorkflowId!}
            onBack={() => setView('workflow-detail')}
          />
        );

      case 'programs':
        return (
          <ProgramsView
            selectedBPId={state.selectedBPId}
            onSelectBP={setSelectedBP}
          />
        );

      case 'business-processes':
      case 'bp-detail':
        return (
          <BusinessProcesses
            selectedBPId={state.selectedBPId}
            onSelectBP={setSelectedBP}
            onOpenEngagement={(engId) => {
              setEngagementBackView('business-processes');
              openAuditExecution(engId);
              setView('engagement-detail' as any);
            }}
            onOpenRacmEditor={(racm) => openRacmFullEditor({
              racmId: racm.id,
              racmName: racm.name,
              processLabel: racm.process,
              backView: 'bp-detail',
            })}
          />
        );

      case 'audit-risk-register':
        return (
          <RiskRegister
            onNavigate={(v) => setView(v as any)}
          />
        );

      case 'audit-execution':
        return <AuditExecution />;

      case 'engagement-detail':
        // Old execution UI detached — routed to Execution V2.
        // Old EngagementDetailView + placeholder kept in repo but no longer rendered.
        return (
          <EngagementExecutionV2
            engagementId={state.selectedEngagementId ?? undefined}
            onBack={() => setView(engagementBackView)}
            onLaunchWorkflowBuilder={launchWorkflowBuilderWithPrompt}
          />
        );

      case 'dashboards':
        return (
          <DashboardListPage
            onDashboardClick={(id, customFields) => openDashboard(id, customFields)}
            onImportPowerBI={() => setShowPowerBIWizard(true)}
            createdDashboards={state.createdDashboards}
            onCreateDashboard={addCreatedDashboard}
            onDeleteDashboard={deleteCreatedDashboard}
            onUpdateDashboardSource={updateDashboardSource}
            onOpenChat={(pending) => {
              if (pending) setPendingDashboard(pending);
              setView('chat');
            }}
            focusedDashboardId={state.focusedNotificationRefId}
          />
        );

      case 'dashboard-detail': {
        const created = state.createdDashboards.find(d => d.id === state.selectedDashboardId);
        return (
          <DashboardView
            initialDashboardId={state.selectedDashboardId}
            initialDashboardName={created?.name}
            initialCustomFields={state.dashboardCustomFields}
            initialDataSource={created?.dataSource ? {
              type: created.dataSource,
              sourceId: created.sourceId,
              sourceName: created.dataSourceNames?.[0],
            } : undefined}
            initialDataSourceNames={created?.dataSourceNames}
            savedWidgets={state.dashboardWidgets[state.selectedDashboardId || ''] || []}
            onSaveWidgets={(widgets) => saveDashboardWidgets(state.selectedDashboardId || '', widgets)}
            onUpdateDashboardSource={(patch) => {
              if (state.selectedDashboardId) updateDashboardSource(state.selectedDashboardId, patch);
            }}
            onOpenKnowledgeHub={openKnowledgeHub}
            onBack={() => setView('dashboards')}
            onImportPowerBI={() => setShowPowerBIWizard(true)}
            onShare={() => setShowShareModal(true, { type: 'dashboard', id: state.selectedDashboardId || 'dash-1' })}
          />
        );
      }

      case 'reports':
      case 'report-history':
        return (
          <ReportsView
            onOpenBuilder={() => openReportBuilder('new')}
            onShare={(id) => setShowShareModal(true, { type: 'report', id })}
            onManageExceptions={() => setView('manage-exceptions')}
            onOpenQuery={(q) => {
              setChatInitialQuery(`Open ${q.id}: ${q.title}`);
              setView('chat');
            }}
            customTemplates={customTemplates}
            onAddCustomTemplate={addCustomTemplate}
          />
        );

      case 'manage-exceptions':
        return (
          <ManageExceptionsView
            role={state.exceptionRole}
            setRole={setExceptionRole}
            onBack={() => setView('reports')}
            embedded={LAUNCHED_FROM_REPORT}
          />
        );

      case 'report-builder':
        return (
          <ReportBuilder
            context={state.reportBuilderContext}
            onBack={() => setView('reports')}
            onSaveAsTemplate={addCustomTemplate}
            existingTemplateNames={[...REPORT_TEMPLATES.map(t => t.name), ...customTemplates.map(t => t.name)]}
          />
        );

      case 'engagements':
        return (
          <EngagementsView
            onOpenAuditPlanning={() => setView('audit-planning')}
            onOpenEngagement={openEngagement}
          />
        );

      case 'engagement-overview':
        return (
          <EngagementOverviewView
            engagementId={state.selectedEngagementId ?? ''}
            onBack={() => setView('engagements')}
            onOpenExecution={(engId) => {
              setEngagementBackView('audit-planning');
              openAuditExecution(engId);
              setView('engagement-detail' as any);
            }}
            onOpenCaseManagement={openCaseManagement}
            onOpenRacmFullEditor={() => openRacmFullEditor({
              racmId: 'racm-procurement-fy26',
              racmName: 'Procurement SOP · Budget to Payment RACM',
              processLabel: 'P2P',
              backView: 'engagement-overview',
            })}
            onLaunchWorkflowBuilder={launchWorkflowBuilderWithPrompt}
          />
        );

      case 'engagement-case-management':
        return (
          <CaseManagementWorkspace
            engagementId={state.selectedEngagementId ?? ''}
            onBack={() => setView('engagement-overview')}
          />
        );

      case 'my-queue':
        return (
          <MyQueueView
            onOpenException={(engagementId) => openCaseManagement(engagementId)}
          />
        );

      case 'closed-case-sampling':
        return <ClosedCaseSamplingView onBack={() => setView('engagements')} />;

      case 'vendor-360':
        return <Vendor360View onBack={() => setView('engagements')} />;

      case 'engagement-compare':
        return <EngagementCompareView onBack={() => setView('engagements')} />;

      case 'audit-planning':
        return <AuditPlanningPage
          onOpenEngagements={() => setView('engagements')}
          onNavigateToExecution={(engId) => {
            setEngagementBackView('audit-planning');
            openAuditExecution(engId);
            setView('engagement-detail' as any);
          }}
        />;

      case 'knowledge-hub':
        return <KnowledgeHubView />;

      case 'data-sources':
      case 'configuration':
        // Legacy routes — all roads now go through Knowledge Hub so users
        // never land on a headerless orphan DataSourcesView.
        return <KnowledgeHubView />;

      // Governance — new pages
      case 'governance-racm':
      case 'governance-racm-detail':
      case 'governance-racm-generate':
        return <RACMView />;

      case 'racm-full-editor':
        return (
          <RacmFullPageEditor
            onBack={() => setView(racmEditorContext?.backView ?? 'engagement-overview')}
            racmName={racmEditorContext?.racmName ?? 'Procurement SOP · Budget to Payment RACM'}
            racmId={racmEditorContext?.racmId}
            processLabel={racmEditorContext?.processLabel}
          />
        );

      case 'governance-controls':
      case 'governance-control-detail':
        return <ControlLibraryView />;

      // Execution — new pages
      case 'execution-testing':
        return (
          <ControlTestingView
            onOpenWorkingPaper={(id) => openExecutionPanel('working-paper', id)}
            onOpenWorkflow={(id) => openExecutionPanel('workflow-execution', id)}
            onOpenTrace={(id) => openExecutionPanel('traceability', id)}
          />
        );

      case 'execution-evidence':
        return (
          <EvidenceView
            onOpenWorkingPaper={(id) => openExecutionPanel('working-paper', id)}
            onOpenWorkflow={(id) => openExecutionPanel('workflow-execution', id)}
            onOpenTrace={(id) => openExecutionPanel('traceability', id)}
          />
        );

      // Intelligence — AI Concierge
      case 'ai-concierge':
      case 'ai-concierge-forensics':
      case 'ai-concierge-table-extractor':
        return <AIConciergeView setView={setView} />;

      case 'ai-concierge-workflow-builder':
        return (
          <WorkflowBuilderJourney
            onBack={() => setView('ai-concierge')}
            initialPrompt={state.workflowBuilderSeedPrompt ?? undefined}
            onInitialPromptConsumed={() => setWorkflowBuilderSeedPrompt(null)}
          />
        );

      // Execution — Findings
      case 'findings':
        return (
          <FindingsView
            onOpenWorkingPaper={(id) => openExecutionPanel('working-paper', id)}
            onOpenWorkflow={(id) => openExecutionPanel('workflow-execution', id)}
            onOpenTrace={(id) => openExecutionPanel('traceability', id)}
          />
        );

      // System
      case 'platform-usage':
        return <PlatformUsageView />;

      // Admin
      case 'admin-users':
        return <AdminView activeTab="users" />;
      case 'admin-roles':
        return <AdminView activeTab="roles" />;
      case 'admin-settings':
        return <AdminView activeTab="settings" />;
      case 'admin-integrations':
        return <AdminView activeTab="integrations" />;
      case 'admin-logs':
        return <AdminView activeTab="logs" />;

      default:
        return (
          <ChatView
            showChatHistory={state.showChatHistory}
            toggleChatHistory={toggleChatHistory}
            setShowArtifacts={setShowArtifacts}
            setActiveArtifactTab={setActiveArtifactTab}
            setArtifactMode={setArtifactMode}
          />
        );
    }
  };

  return (
    <ToastProvider>
      <BulkRunProgressProvider>
      <div className="flex h-screen w-full bg-canvas overflow-hidden">
        {!(LAUNCHED_FROM_REPORT && state.view === 'manage-exceptions') && (
          <Sidebar
            view={state.view}
            setView={setView}
            expanded={state.sidebarExpanded}
            toggleSidebar={toggleSidebar}
            setSidebarExpanded={setSidebarExpanded}
            unreadNotifications={unreadNotifications}
            notificationDrawerOpen={state.notificationDrawerOpen}
            onOpenNotifications={openNotificationDrawer}
          />
        )}
        <main ref={mainScrollRef} className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {renderMainView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Modal Layer */}
        <AnimatePresence>
          {state.showExceptionModal && (
            <ExceptionManagementModal
              onClose={() => setShowExceptionModal(false)}
              onGenerateReport={() => { setShowExceptionModal(false); openReportBuilder('action-report'); }}
              onViewEmail={(recipient) => setShowEmailPreviewModal(true, recipient)}
            />
          )}
          {state.showEmailPreviewModal && (
            <EmailPreviewModal
              recipientName={state.emailPreviewRecipient}
              onClose={() => setShowEmailPreviewModal(false)}
            />
          )}
          {state.showShareModal && (
            <ShareModal
              onClose={() => setShowShareModal(false)}
              onShare={(recipients) => {
                // Phase 3 producer: push a notification when reports or
                // dashboards are shared. Single hook, both surfaces.
                const ctx = state.shareContext;
                if (!ctx) return;
                const isReport    = ctx.type === 'report';
                const isDashboard = ctx.type === 'dashboard';
                if (!isReport && !isDashboard) return;
                addNotification(createNotification({
                  category: 'report',
                  severity: 'info',
                  title: isReport ? 'Report shared' : 'Dashboard shared',
                  message: `Shared with ${recipients.length === 1 ? recipients[0] : `${recipients.length} people`}.`,
                  actor: 'You',
                  link: {
                    view: isReport ? 'reports' : 'dashboards',
                    ref: { kind: isReport ? 'report' : 'dashboard', id: ctx.id },
                  },
                }));
              }}
            />
          )}
          {state.showPowerBIWizard && (
            <PowerBIImportWizard onClose={() => setShowPowerBIWizard(false)} />
          )}
        </AnimatePresence>

        {/* Execution Panels */}
        <AnimatePresence>
          {state.executionPanel === 'working-paper' && (
            <WorkingPaperPanel
              controlId={state.executionPanelControlId ?? undefined}
              onClose={closeExecutionPanel}
              onViewWorkflow={() => openExecutionPanel('workflow-execution', state.executionPanelControlId ?? undefined)}
              onViewTrace={() => openExecutionPanel('traceability', state.executionPanelControlId ?? undefined)}
            />
          )}
          {state.executionPanel === 'workflow-execution' && (
            <WorkflowExecutionPanel
              controlId={state.executionPanelControlId ?? undefined}
              onClose={closeExecutionPanel}
              onViewWorkingPaper={() => openExecutionPanel('working-paper', state.executionPanelControlId ?? undefined)}
              onViewTrace={() => openExecutionPanel('traceability', state.executionPanelControlId ?? undefined)}
            />
          )}
          {state.executionPanel === 'traceability' && (
            <TraceabilityPanel
              controlId={state.executionPanelControlId ?? undefined}
              onClose={closeExecutionPanel}
              onOpenWorkingPaper={() => openExecutionPanel('working-paper', state.executionPanelControlId ?? undefined)}
              onOpenWorkflow={() => openExecutionPanel('workflow-execution', state.executionPanelControlId ?? undefined)}
            />
          )}
        </AnimatePresence>

        {/* Control Detail Drawer */}
        <AnimatePresence>
          {controlDrawerId && (
            <ControlDetailDrawer
              controlId={controlDrawerId}
              controlData={controlDrawerData}
              onClose={() => { setControlDrawerId(null); setControlDrawerData(null); }}
            />
          )}
        </AnimatePresence>

        {/* Notification Drawer */}
        <AnimatePresence>
          {state.notificationDrawerOpen && (
            <NotificationDrawer
              notifications={state.notifications}
              onClose={closeNotificationDrawer}
              onSelect={handleNotificationSelect}
              onMarkAllRead={markAllNotificationsRead}
              onSetActionState={setNotificationActionState}
              onRestore={restoreNotification}
            />
          )}
        </AnimatePresence>
      </div>
      </BulkRunProgressProvider>
    </ToastProvider>
  );
}
