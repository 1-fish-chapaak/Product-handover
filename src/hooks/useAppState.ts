import { useState, useCallback, useEffect } from 'react';
import { useCurrentUser } from '../context/CurrentUserContext';
import { findEngagement } from '../data/engagements';
import type { WorkflowTypeId } from '../data/mockData';
import type { WorkflowRunSeed } from '../components/workflow/workflowRunSeed';
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
  | 'sox-icfr'
  | 'compliance-engagement'
  | 'engagement-overview'
  | 'engagement-case-management'
  | 'my-queue'
  | 'closed-case-sampling'
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
  | 'ai-concierge-image'
  | 'ai-concierge-speech'
  | 'ai-concierge-medical'
  | 'ai-concierge-insights'
  | 'ai-concierge-racm'
  | 'ai-concierge-workflow-builder'
  // System
  | 'configuration'
  | 'data-sources'
  | 'knowledge-hub'
  | 'admin-users'
  | 'admin-roles'
  | 'admin-logs'
  // One-Click Audit
  | 'one-click-audit'
  // Case Management
  | 'manage-exceptions'
  // Chat trash
  | 'chat-trash'
  // Engagement Final
  | 'engagement-final'
  // Dev-only preview routes
  | 'dev-configurable-engagement-v3'
  // Platform
  | 'racm-full-editor'
  | 'control-detail'
  // Engagement Config (under Programs)
  | 'engagement-config';

export type ChatMode = 'chat' | 'workflow';
export type ExceptionRole = 'risk-owner' | 'auditor';
export type ArtifactTab = 'plan' | 'code' | 'sources' | 'output' | 'flow' | 'preview' | 'history';
export type ArtifactMode = 'query' | 'workflow';
export type ExecutionPanel = 'working-paper' | 'workflow-execution' | 'traceability' | null;

/** A business process the user created in Process Hub. Superset of the seed
 *  BUSINESS_PROCESSES shape, so the same detail page renders both. */
export interface UserProcess {
  id: string;
  name: string;
  abbr: string;
  color: string;
  risks: number;
  controls: number;
  coverage: number;
  sops: number;
  workflows: number;
  status?: 'Draft' | 'Active' | 'Archived';
  department?: string;
  owner?: string;
  fy?: string;
  description?: string;
  subProcesses?: { name: string; description: string }[];
}

export interface AppState {
  view: View;
  sidebarExpanded: boolean;
  chatMode: ChatMode;
  activeArtifactTab: ArtifactTab;
  artifactMode: ArtifactMode;
  showArtifacts: boolean;
  showChatHistory: boolean;
  selectedWorkflowId: string | null;
  /** Which tab WorkflowDetail should open on (e.g. 'runs' when drilled in from an engagement). */
  workflowDetailInitialTab: 'overview' | 'runs' | 'config';
  /** Where the executor's Back button returns to. 'business-processes' when launched
   *  from the Process Hub Workflows tab; null keeps the default (workflow-templates). */
  workflowExecutorBackView: 'business-processes' | null;
  selectedBPId: string | null;
  /** Business processes created by the user in Process Hub (persisted across navigation). */
  userProcesses: UserProcess[];
  selectedEngagementId: string | null;
  selectedRiskId: string | null;
  // Modal states
  showExceptionModal: boolean;
  showEmailPreviewModal: boolean;
  showShareModal: boolean;
  showPowerBIWizard: boolean;
  shareContext: { type: 'report' | 'dashboard' | 'workflow-output' | 'workspace' | 'process' | 'risk' | 'control' | 'engagement' | 'racm'; id: string } | null;
  /** Bounding rect of the element that opened the share popover, so it can
   *  anchor itself next to the trigger (Notion-style). Null → falls back to a
   *  top-right viewport position. */
  shareAnchor: { top: number; left: number; right: number; bottom: number; width: number; height: number } | null;
  emailPreviewRecipient: string | null;
  // Report builder
  reportBuilderContext: 'new' | 'action-report' | 'from-template' | null;
  // Unified workflow canvas
  workflowCanvasStage: number; // 0=waiting, 1=input, 2=output, 3=preview
  workflowType: WorkflowTypeId | null;
  // Chat initial context (for workflow mode entry)
  chatInitialQuery: string | null;
  // Completed workflow run handed off to chat as conversation history when the
  // user asks a follow-up from the executor output. Consumed once by ChatView.
  chatWorkflowRunSeed: WorkflowRunSeed | null;
  chatWorkflowContext: { templateId?: string; workflowId?: string } | null;
  /** Engagement name shown as a banner above the composer when building a workflow for a specific engagement. */
  workflowBuilderEngagementName: string | null;
  // Pre-fill text dropped into the chat composer (not auto-submitted). Used
  // when another surface — e.g. the workspace panel's "Edit assumptions"
  // action — wants to seed the textarea with a draft prompt.
  chatComposerDraft: string | null;
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
  if (v === 'racm-full-editor') return 'racm-full-editor';
  if (v === 'audit-risk-register') return 'audit-risk-register';
  if (v === 'control-detail' && params.get('controlId')) return 'control-detail';
  if (v === 'chat') return 'chat';
  if (v === 'bp-detail' && params.get('bp')) return 'bp-detail';
  if (v === 'engagement-detail') return 'engagement-detail';
  if (v === 'workflow-executor') return 'workflow-executor';
  if (v === 'engagement-case-management' && params.get('eng')) return 'engagement-case-management';
  if (v === 'dev-configurable-engagement-v3') return 'dev-configurable-engagement-v3';
  return 'home';
};

const getInitialWorkflowId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') !== 'workflow-executor') return null;
  return params.get('workflowId');
};

const getInitialEngagementId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('eng');
};

// New-tab deep links into the Process Hub BP detail (e.g. a control's risk/RACM
// opened in a new tab) carry ?view=bp-detail&bp=<id>; seed selectedBPId from it.
const getInitialBPId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') !== 'bp-detail') return null;
  return params.get('bp');
};

// New-tab deep links into the chat (e.g. an insight's "what to do next" step
// opened via ?view=chat&prompt=<text>) seed the composer draft — pre-filled,
// not auto-submitted, so the auditor edits and sends it themselves.
const getInitialChatDraft = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') !== 'chat') return null;
  return params.get('prompt');
};

const INITIAL_STATE: AppState = {
  view: getInitialView(),
  sidebarExpanded: false,
  chatMode: 'chat',
  activeArtifactTab: 'plan',
  artifactMode: 'query',
  showArtifacts: false,
  showChatHistory: false,
  selectedWorkflowId: getInitialWorkflowId(),
  workflowDetailInitialTab: 'runs',
  workflowExecutorBackView: null,
  selectedBPId: getInitialBPId(),
  userProcesses: [],
  selectedEngagementId: getInitialEngagementId(),
  selectedRiskId: null,
  showExceptionModal: false,
  showEmailPreviewModal: false,
  showShareModal: false,
  showPowerBIWizard: false,
  shareContext: null,
  shareAnchor: null,
  emailPreviewRecipient: null,
  reportBuilderContext: null,
  workflowCanvasStage: 0,
  workflowType: null,
  chatInitialQuery: null,
  chatWorkflowRunSeed: null,
  chatComposerDraft: getInitialChatDraft(),
  chatWorkflowContext: null,
  workflowBuilderEngagementName: null,
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
  // Placeholder only — `useAppState` derives the real initial value from the
  // signed-in user (risk owners → 'risk-owner', everyone else → 'auditor').
  // ManageExceptionsView's own toggle remains a demo affordance on top.
  exceptionRole: 'auditor',
  knowledgeHubFocusSourceId: null,
  // Initialised lazily from localStorage in `useAppState` below; the empty
  // array here is just a type-correct placeholder the lazy init replaces.
  notifications: [],
  notificationDrawerOpen: false,
  focusedNotificationRefId: null,
};

export function useAppState() {
  // `useAppState` is always called under CurrentUserProvider (App.tsx), so the
  // Manage Exceptions persona can be derived from the real login instead of a
  // hardcoded default. Risk owners get the Risk Owner lens; everyone else
  // (incl. signed-out) starts as Auditor. The in-view toggle still works as a
  // demo affordance via setExceptionRole.
  const { currentUser } = useCurrentUser();
  const authRoleId = currentUser?.roleId ?? null;

  // Lazy init: hydrate notifications from localStorage on first mount only.
  const [state, setState] = useState<AppState>(() => ({
    ...INITIAL_STATE,
    exceptionRole: authRoleId === 'role-risk' ? 'risk-owner' : 'auditor',
    notifications: loadPersistedNotifications(),
  }));

  // Re-sync the exception persona when the signed-in identity changes
  // (sign-in from the login gate, persona switch, sign-out). Render-time
  // derived-state pattern — see react.dev "storing information from previous
  // renders" — so no effect-driven cascading render.
  const [prevAuthRoleId, setPrevAuthRoleId] = useState<string | null>(authRoleId);
  if (prevAuthRoleId !== authRoleId) {
    setPrevAuthRoleId(authRoleId);
    const derived: ExceptionRole = authRoleId === 'role-risk' ? 'risk-owner' : 'auditor';
    setState(prev => (prev.exceptionRole === derived ? prev : { ...prev, exceptionRole: derived }));
  }

  // Persist notifications to localStorage whenever they change. Read flags,
  // dismissals, and (Phase 2+) action state / snooze / archive all flow
  // through here so reload preserves the user's progress.
  useEffect(() => {
    persistNotifications(state.notifications);
  }, [state.notifications]);

  const setView = useCallback((view: View) => {
    setState(prev => ({
      ...prev,
      view,
      showChatHistory: false,
      // The engagement workflow-builder banner only belongs in the chat it was opened for.
      workflowBuilderEngagementName: view === 'chat' ? prev.workflowBuilderEngagementName : null,
    }));
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

  const setSelectedWorkflow = useCallback((id: string | null, initialTab: AppState['workflowDetailInitialTab'] = 'runs') => {
    setState(prev => ({ ...prev, selectedWorkflowId: id, workflowDetailInitialTab: initialTab, view: id ? 'workflow-detail' : 'workflow-templates' }));
  }, []);

  const setSelectedBP = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedBPId: id, view: id ? 'bp-detail' : 'programs' }));
  }, []);

  const addUserProcess = useCallback((process: UserProcess) => {
    setState(prev => ({ ...prev, userProcesses: [...prev.userProcesses, process] }));
  }, []);

  const openAuditExecution = useCallback((engagementId: string) => {
    setState(prev => ({ ...prev, view: 'audit-execution' as View, selectedEngagementId: engagementId }));
  }, []);

  const openEngagement = useCallback((engagementId: string) => {
    const eng = findEngagement(engagementId);
    // Type routing: SOX gets the ICFR workspace; Compliance gets the promoted
    // pattern workspace (scope → PBC → testing → review → conclusion); the rest
    // keep the classic overview.
    const view: View = eng?.type === 'SOX / ICFR' ? 'sox-icfr'
      : eng?.type === 'Compliance' ? 'compliance-engagement'
      : 'engagement-overview';
    setState(prev => ({ ...prev, view, selectedEngagementId: engagementId }));
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

  const setShowShareModal = useCallback((show: boolean, context?: AppState['shareContext'], anchor?: AppState['shareAnchor']) => {
    setState(prev => ({ ...prev, showShareModal: show, shareContext: context ?? null, shareAnchor: anchor ?? null }));
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

  const setChatWorkflowRunSeed = useCallback((seed: WorkflowRunSeed | null) => {
    setState(prev => ({ ...prev, chatWorkflowRunSeed: seed }));
  }, []);

  // Open chat from a completed workflow run: seed the run as conversation
  // history and auto-submit the follow-up question, all in one atomic update
  // so ChatView mounts with both present on the same render.
  const openChatWithWorkflowRun = useCallback((query: string, seed: WorkflowRunSeed) => {
    setState(prev => ({
      ...prev,
      view: 'chat' as View,
      selectedChatId: null,
      showChatHistory: false,
      chatWorkflowRunSeed: seed,
      chatInitialQuery: query,
    }));
  }, []);

  const setChatComposerDraft = useCallback((draft: string | null) => {
    setState(prev => ({ ...prev, chatComposerDraft: draft }));
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
      workflowBuilderEngagementName: null,
    }));
  }, []);

  /** Enter the Ask IRA workflow-builder chat scoped to a specific engagement (shows a context banner). */
  const startWorkflowForEngagement = useCallback((engagementName: string) => {
    setState(prev => ({
      ...prev,
      view: 'chat' as View,
      chatMode: 'workflow' as ChatMode,
      artifactMode: 'workflow' as ArtifactMode,
      showArtifacts: true,
      chatWorkflowContext: null,
      selectedChatId: null,
      workflowBuilderEngagementName: engagementName,
    }));
  }, []);

  const openWorkflowExecutor = useCallback((workflowId: string, backTo: AppState['workflowExecutorBackView'] = null) => {
    setState(prev => ({ ...prev, view: 'workflow-executor' as View, selectedWorkflowId: workflowId, workflowExecutorBackView: backTo }));
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

  // Hand off a prompt with the "Build a workflow" intent. Routes to the
  // dedicated WorkflowBuilderJourney view (Stepper + StepWritePrompt +
  // AIAssistantPanel + ConciergeClarificationStage etc.) and seeds the initial
  // prompt so the journey can skip Step 1 and land on clarification when
  // a non-empty prompt is provided. Empty string opens the journey at
  // Step 1.
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

  // Open the AI Concierge "Workflow Builder" tile INSIDE the Ask IRA chat rather
  // than the standalone journey: land on view='chat' with an (empty) workflow
  // seed, which boots ChatView into Workflow mode on its empty state — where the
  // Recent Workflows launcher shows. A non-empty prompt would auto-start an
  // in-thread build. Scoped to the tile; the shared
  // launchWorkflowBuilderWithPrompt (Evidence / Engagement / home) is unchanged.
  const launchWorkflowBuilderInChat = useCallback((prompt: string = '') => {
    setState(prev => ({
      ...prev,
      view: 'chat' as View,
      selectedChatId: null,
      workflowBuilderSeedPrompt: prompt,
      showChatHistory: false,
    }));
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
    addUserProcess,
    setShowExceptionModal,
    setShowEmailPreviewModal,
    setShowShareModal,
    setShowPowerBIWizard,
    openReportBuilder,
    setWorkflowCanvasStage,
    setWorkflowType,
    setChatInitialQuery,
    setChatWorkflowRunSeed,
    openChatWithWorkflowRun,
    setChatComposerDraft,
    setQueryAssumptions,
    enterWorkflowMode,
    startWorkflowForEngagement,
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
    launchWorkflowBuilderInChat,
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
