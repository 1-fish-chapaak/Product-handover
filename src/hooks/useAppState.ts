import { useState, useCallback, useEffect } from 'react';
import type { WorkflowTypeId } from '../data/mockData';
import {
  loadPersistedNotifications,
  persistNotifications,
  type PlatformNotification,
  type NotificationActionState,
} from '../data/notifications';

export type View =
  | 'home'
  | 'recents'
  | 'chat'
  | 'workflow-templates'
  | 'workflow-detail'
  | 'workflow-library'
  | 'workflow-executor'
  | 'workflow-edit-in-chat'
  // Governance
  | 'business-processes'
  | 'bp-detail'
  | 'governance-racm'
  | 'governance-racm-detail'
  | 'governance-racm-generate'
  | 'governance-controls'
  | 'governance-control-detail'
  | 'audit-risk-register'
  | 'audit-planning'
  | 'programs'
  // Engagements
  | 'engagements'
  | 'engagement-overview'
  | 'engagement-case-management'
  | 'my-queue'
  | 'closed-case-sampling'
  | 'vendor-360'
  | 'engagement-compare'
  // Execution
  | 'audit-execution'
  | 'engagement-detail'
  | 'execution-testing'
  | 'execution-evidence'
  // Intelligence
  | 'dashboards'
  | 'dashboard-detail'
  | 'reports'
  | 'report-history'
  | 'report-builder'
  | 'ai-concierge'
  | 'ai-concierge-forensics'
  | 'ai-concierge-table-extractor'
  | 'ai-concierge-workflow-builder'
  | 'findings'
  // System
  | 'configuration'
  | 'data-sources'
  | 'knowledge-hub'
  | 'admin-users'
  | 'admin-roles'
  | 'admin-settings'
  | 'admin-integrations'
  | 'admin-logs'
  // One-Click Audit
  | 'one-click-audit'
  // Case Management
  | 'manage-exceptions'
  // Chat trash
  | 'chat-trash'
  // Dev-only preview routes
  | 'dev-configurable-engagement-v3'
  // Platform
  | 'platform-usage'
  | 'racm-full-editor'
  // Engagement Config (under Programs)
  | 'engagement-config';

export type ChatMode = 'chat' | 'workflow';
export type ExceptionRole = 'risk-owner' | 'auditor';
export type ArtifactTab = 'plan' | 'code' | 'sources' | 'output' | 'flow' | 'preview';
export type ArtifactMode = 'query' | 'workflow';
export type ExecutionPanel = 'working-paper' | 'workflow-execution' | 'traceability' | null;

export interface AppState {
  view: View;
  sidebarExpanded: boolean;
  chatMode: ChatMode;
  activeArtifactTab: ArtifactTab;
  artifactMode: ArtifactMode;
  showArtifacts: boolean;
  showChatHistory: boolean;
  selectedWorkflowId: string | null;
  selectedBPId: string | null;
  selectedEngagementId: string | null;
  selectedRiskId: string | null;
  // Modal states
  showExceptionModal: boolean;
  showEmailPreviewModal: boolean;
  showShareModal: boolean;
  showPowerBIWizard: boolean;
  shareContext: { type: 'report' | 'dashboard' | 'workflow-output'; id: string } | null;
  emailPreviewRecipient: string | null;
  // Report builder
  reportBuilderContext: 'new' | 'action-report' | 'from-template' | null;
  // Unified workflow canvas
  workflowCanvasStage: number; // 0=waiting, 1=input, 2=output, 3=preview
  workflowType: WorkflowTypeId | null;
  // Chat initial context (for workflow mode entry)
  chatInitialQuery: string | null;
  chatWorkflowContext: { templateId?: string; workflowId?: string } | null;
  // Seed prompt handed off from chat → AI Concierge workflow builder.
  // Consumed once on the journey's first render, then cleared by the parent.
  workflowBuilderSeedPrompt: string | null;
  // Selected chat to load into ChatView (e.g. from Recents); null = fresh chat
  selectedChatId: string | null;
  // Query assumptions
  queryAssumptions: string[];
  // Dashboard detail
  selectedDashboardId: string | null;
  dashboardCustomFields: string[] | null;
  // Persisted widgets per custom dashboard
  dashboardWidgets: Record<string, Array<{ chartType: string; title: string; xField: string; yField: string }>>;
  // User-created dashboards (persisted across navigation)
  createdDashboards: Array<{
    id: string;
    name: string;
    description: string;
    timeAgo: string;
    creator: string;
    accent: string;
    dataSource?: 'excel' | 'csv' | 'sql' | 'query' | 'combo';
    dataSourceNames?: string[];
    /** SEED id of the picked source — required for live-SQL dashboards. */
    sourceId?: string;
  }>;
  // Pending dashboard — saved while user is in chat before creating
  pendingDashboard: { name: string; description: string } | null;
  // Execution panels
  executionPanel: ExecutionPanel;
  executionPanelControlId: string | null;
  // Manage Exceptions (Case Mgmt) active role
  exceptionRole: ExceptionRole;
  // When the user navigates to Knowledge Hub from a dashboard chip / Add
  // Widget empty state, this carries the sourceId they came from so the
  // Knowledge Hub view can highlight / scroll to that connection. Cleared
  // when the user navigates away.
  knowledgeHubFocusSourceId: string | null;
  // Platform notification center
  notifications: PlatformNotification[];
  notificationDrawerOpen: boolean;
  /** Set when the user clicks a notification with a `link.ref.id`. The
   *  target view reads this on mount and highlights/scrolls the matching
   *  row. Auto-cleared after the view consumes it (or after a navigation). */
  focusedNotificationRefId: string | null;
}

const getInitialView = (): View => {
  if (typeof window === 'undefined') return 'home';
  const params = new URLSearchParams(window.location.search);
  const v = params.get('view');
  if (v === 'reports') return 'reports';
  if (v === 'manage-exceptions') return 'manage-exceptions';
  if (v === 'dev-configurable-engagement-v3') return 'dev-configurable-engagement-v3';
  return 'home';
};

const INITIAL_STATE: AppState = {
  view: getInitialView(),
  sidebarExpanded: false,
  chatMode: 'chat',
  activeArtifactTab: 'plan',
  artifactMode: 'query',
  showArtifacts: false,
  showChatHistory: false,
  selectedWorkflowId: null,
  selectedBPId: null,
  selectedEngagementId: null,
  selectedRiskId: null,
  showExceptionModal: false,
  showEmailPreviewModal: false,
  showShareModal: false,
  showPowerBIWizard: false,
  shareContext: null,
  emailPreviewRecipient: null,
  reportBuilderContext: null,
  workflowCanvasStage: 0,
  workflowType: null,
  chatInitialQuery: null,
  chatWorkflowContext: null,
  workflowBuilderSeedPrompt: null,
  selectedChatId: null,
  queryAssumptions: [],
  selectedDashboardId: null,
  dashboardCustomFields: null,
  dashboardWidgets: {},
  createdDashboards: [],
  pendingDashboard: null,
  executionPanel: null,
  executionPanelControlId: null,
  exceptionRole: 'risk-owner',
  knowledgeHubFocusSourceId: null,
  // Initialised lazily from localStorage in `useAppState` below; the empty
  // array here is just a type-correct placeholder the lazy init replaces.
  notifications: [],
  notificationDrawerOpen: false,
  focusedNotificationRefId: null,
};

export function useAppState() {
  // Lazy init: hydrate notifications from localStorage on first mount only.
  const [state, setState] = useState<AppState>(() => ({
    ...INITIAL_STATE,
    notifications: loadPersistedNotifications(),
  }));

  // Persist notifications to localStorage whenever they change. Read flags,
  // dismissals, and (Phase 2+) action state / snooze / archive all flow
  // through here so reload preserves the user's progress.
  useEffect(() => {
    persistNotifications(state.notifications);
  }, [state.notifications]);

  const setView = useCallback((view: View) => {
    setState(prev => ({ ...prev, view, showChatHistory: false }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, sidebarExpanded: !prev.sidebarExpanded }));
  }, []);

  const setSidebarExpanded = useCallback((expanded: boolean) => {
    setState(prev => ({ ...prev, sidebarExpanded: expanded }));
  }, []);

  const setActiveArtifactTab = useCallback((tab: ArtifactTab) => {
    setState(prev => ({ ...prev, activeArtifactTab: tab }));
  }, []);

  const setArtifactMode = useCallback((mode: ArtifactMode) => {
    setState(prev => ({ ...prev, artifactMode: mode }));
  }, []);

  const setShowArtifacts = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showArtifacts: show }));
  }, []);

  const toggleChatHistory = useCallback(() => {
    setState(prev => ({ ...prev, showChatHistory: !prev.showChatHistory }));
  }, []);

  const setSelectedWorkflow = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedWorkflowId: id, view: id ? 'workflow-detail' : 'workflow-templates' }));
  }, []);

  const setSelectedBP = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedBPId: id, view: id ? 'bp-detail' : 'programs' }));
  }, []);

  const setSelectedEngagement = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedEngagementId: id }));
  }, []);

  const openAuditExecution = useCallback((engagementId: string) => {
    setState(prev => ({ ...prev, view: 'audit-execution' as View, selectedEngagementId: engagementId }));
  }, []);

  const openEngagement = useCallback((engagementId: string) => {
    setState(prev => ({ ...prev, view: 'engagement-overview' as View, selectedEngagementId: engagementId }));
  }, []);

  const openCaseManagement = useCallback((engagementId: string) => {
    setState(prev => ({ ...prev, view: 'engagement-case-management' as View, selectedEngagementId: engagementId }));
  }, []);

  // Modal controls
  const setShowExceptionModal = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showExceptionModal: show }));
  }, []);

  const setShowEmailPreviewModal = useCallback((show: boolean, recipient?: string | null) => {
    setState(prev => ({ ...prev, showEmailPreviewModal: show, emailPreviewRecipient: recipient ?? null }));
  }, []);

  const setShowShareModal = useCallback((show: boolean, context?: AppState['shareContext']) => {
    setState(prev => ({ ...prev, showShareModal: show, shareContext: context ?? null }));
  }, []);

  const setShowPowerBIWizard = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showPowerBIWizard: show }));
  }, []);

  const openReportBuilder = useCallback((context: AppState['reportBuilderContext']) => {
    setState(prev => ({ ...prev, view: 'report-builder', reportBuilderContext: context }));
  }, []);

  // Unified workflow canvas
  const setWorkflowCanvasStage = useCallback((stage: number) => {
    setState(prev => ({ ...prev, workflowCanvasStage: stage }));
  }, []);

  const setWorkflowType = useCallback((type: WorkflowTypeId | null) => {
    setState(prev => ({ ...prev, workflowType: type }));
  }, []);

  const setChatInitialQuery = useCallback((query: string | null) => {
    setState(prev => ({ ...prev, chatInitialQuery: query }));
  }, []);

  const openChat = useCallback((chatId: string | null) => {
    setState(prev => ({ ...prev, view: 'chat' as View, selectedChatId: chatId, showChatHistory: false }));
  }, []);

  const setSelectedChatId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedChatId: id }));
  }, []);

  const setQueryAssumptions = useCallback((assumptions: string[]) => {
    setState(prev => ({ ...prev, queryAssumptions: assumptions }));
  }, []);

  const enterWorkflowMode = useCallback((context?: { templateId?: string; workflowId?: string }) => {
    // Editing an existing workflow → dedicated edit-in-chat journey with
    // its own clarification phase + 4-tab workspace. Building from scratch
    // keeps the inline chat artifact flow.
    if (context?.workflowId) {
      setState(prev => ({
        ...prev,
        view: 'workflow-edit-in-chat' as View,
        selectedWorkflowId: context.workflowId!,
        chatWorkflowContext: context,
      }));
      return;
    }
    setState(prev => ({
      ...prev,
      view: 'chat' as View,
      chatMode: 'workflow' as ChatMode,
      artifactMode: 'workflow' as ArtifactMode,
      showArtifacts: true,
      chatWorkflowContext: context ?? null,
    }));
  }, []);

  const openWorkflowExecutor = useCallback((workflowId: string) => {
    setState(prev => ({ ...prev, view: 'workflow-executor' as View, selectedWorkflowId: workflowId }));
  }, []);

  const openDashboard = useCallback((dashboardId: string, customFields?: string[]) => {
    setState(prev => ({ ...prev, view: 'dashboard-detail' as View, selectedDashboardId: dashboardId, dashboardCustomFields: customFields || null }));
  }, []);

  const saveDashboardWidgets = useCallback((dashboardId: string, widgets: Array<{ chartType: string; title: string; xField: string; yField: string }>) => {
    setState(prev => ({ ...prev, dashboardWidgets: { ...prev.dashboardWidgets, [dashboardId]: widgets } }));
  }, []);

  const addCreatedDashboard = useCallback((dashboard: AppState['createdDashboards'][number]) => {
    setState(prev => ({ ...prev, createdDashboards: [dashboard, ...prev.createdDashboards] }));
  }, []);

  const deleteCreatedDashboard = useCallback((id: string) => {
    setState(prev => ({ ...prev, createdDashboards: prev.createdDashboards.filter(d => d.id !== id) }));
  }, []);

  /** Update the source binding of an already-created dashboard. Caller passes
   *  any subset of `dataSource | sourceId | dataSourceNames`; missing fields
   *  are left as-is. Used by the kebab "Change data source" action and by
   *  AddDataModal's onAttach / onSetPrimary. */
  const updateDashboardSource = useCallback((
    id: string,
    patch: Partial<Pick<AppState['createdDashboards'][number], 'dataSource' | 'sourceId' | 'dataSourceNames'>>,
  ) => {
    setState(prev => ({
      ...prev,
      createdDashboards: prev.createdDashboards.map(d => d.id === id ? { ...d, ...patch } : d),
    }));
  }, []);

  /** Navigate to Knowledge Hub, optionally focusing a connection. The view
   *  reads `knowledgeHubFocusSourceId` to highlight / scroll to the right
   *  connection if present. */
  const openKnowledgeHub = useCallback((sourceId?: string) => {
    setState(prev => ({
      ...prev,
      view: 'knowledge-hub' as View,
      knowledgeHubFocusSourceId: sourceId ?? null,
    }));
  }, []);

  const setPendingDashboard = useCallback((pending: AppState['pendingDashboard']) => {
    setState(prev => ({ ...prev, pendingDashboard: pending }));
  }, []);

  const openExecutionPanel = useCallback((panel: ExecutionPanel, controlId?: string) => {
    setState(prev => ({ ...prev, executionPanel: panel, executionPanelControlId: controlId ?? null }));
  }, []);

  const closeExecutionPanel = useCallback(() => {
    setState(prev => ({ ...prev, executionPanel: null, executionPanelControlId: null }));
  }, []);

  const setExceptionRole = useCallback((role: ExceptionRole) => {
    setState(prev => ({ ...prev, exceptionRole: role }));
  }, []);

  // Hand off a prompt typed in chat (with the "Build a workflow" toggle on)
  // to the AI Concierge workflow builder. Sets the seed and routes to the
  // builder view in a single transition; the journey consumes the seed on
  // mount, generates the workflow, and lands the user on the clarification
  // screen — skipping the prompt page entirely.
  const launchWorkflowBuilderWithPrompt = useCallback((prompt: string) => {
    setState(prev => ({
      ...prev,
      view: 'ai-concierge-workflow-builder' as View,
      workflowBuilderSeedPrompt: prompt,
      showChatHistory: false,
    }));
  }, []);

  const setWorkflowBuilderSeedPrompt = useCallback((prompt: string | null) => {
    setState(prev => ({ ...prev, workflowBuilderSeedPrompt: prompt }));
  }, []);

  // ── Notifications ──
  const openNotificationDrawer = useCallback(() => {
    setState(prev => ({ ...prev, notificationDrawerOpen: true }));
  }, []);

  const closeNotificationDrawer = useCallback(() => {
    setState(prev => ({ ...prev, notificationDrawerOpen: false }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.read ? n : { ...n, read: true }),
    }));
  }, []);

  // Extension point: module actions push real events into the feed.
  // Not wired anywhere in v1 — left intentionally for follow-up PRs.
  const addNotification = useCallback((n: PlatformNotification) => {
    setState(prev => ({ ...prev, notifications: [n, ...prev.notifications] }));
  }, []);

  // ── Phase 2: action lifecycle ──────────────────────────────────────────
  // Notifications are no longer destructively dismissed on action. Instead
  // the row records its `actionState` (and gets a confirmation pill in the
  // UI), or is moved to Snoozed / Archived. Every mutation is reversible
  // via undoLastAction(id, snapshot).

  /** Record the user's response (Accept / Decline / Comment). The row stays
   *  in the list but renders a pill instead of action buttons. */
  const setNotificationActionState = useCallback((id: string, actionState: NotificationActionState | undefined) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === id ? { ...n, actionState, read: true } : n,
      ),
    }));
  }, []);

  /** Restore a notification to a previous snapshot — used by Undo on toasts.
   *  The snapshot is captured before the mutation; this overwrites the
   *  current entry with the prior state. */
  const restoreNotification = useCallback((snapshot: PlatformNotification) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === snapshot.id ? snapshot : n,
      ),
    }));
  }, []);

  /** Set the focused ref id when a user clicks a notification. The matching
   *  target view reads this on mount and highlights/scrolls the row. */
  const setFocusedNotificationRefId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, focusedNotificationRefId: id }));
  }, []);

  return {
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
    setShowExceptionModal,
    setShowEmailPreviewModal,
    setShowShareModal,
    setShowPowerBIWizard,
    openReportBuilder,
    setWorkflowCanvasStage,
    setWorkflowType,
    setChatInitialQuery,
    setQueryAssumptions,
    enterWorkflowMode,
    openWorkflowExecutor,
    openAuditExecution,
    openEngagement,
    openCaseManagement,
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
    addNotification,
    setNotificationActionState,
    restoreNotification,
    setFocusedNotificationRefId,
  };
}
