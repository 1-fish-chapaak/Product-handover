// ─── Engagement Final — Internal Audit Prototype ─────────────────────────
// Programs → Engagement Final. Reuses existing IA Scope, Automation Workflows/Cases,
// Business Process RACM, and shared Activity Trail components.

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ClipboardCheck, Plus, Search, Calendar, Users, ChevronRight,
  Shield, Workflow, AlertTriangle, FileText, CheckCircle2, Clock, Eye,
  BarChart3, Info, X,
} from 'lucide-react';

// Reused components
import type { ConfigurableEngagement, InternalAuditConfig } from '../engagement-configurable/configurableEngagementTypes';
import { EngagementPatternType, EngagementStatus, AuditScopeLevel } from '../engagement-configurable/configurableEngagementTypes';
import InternalAuditScopeTab from '../engagement-configurable/patterns/internal-audit/InternalAuditScopeTab';
import { DEFAULT_IA_SCOPE, type InternalAuditScopeState } from '../engagement-configurable/patterns/internal-audit/internalAuditScopeData';
import InternalAuditAnnouncementTab from '../engagement-configurable/patterns/internal-audit/InternalAuditAnnouncementTab';
import { DEFAULT_ANNOUNCEMENT, type InternalAuditAnnouncementState } from '../engagement-configurable/patterns/internal-audit/internalAuditAnnouncementData';
import RacmMappingWorkspace from '../audit/RacmMappingWorkspace';
import InternalAuditControlsTab from '../engagement-configurable/patterns/internal-audit/InternalAuditControlsTab';
import type { InternalAuditAnalysisState } from '../engagement-configurable/patterns/internal-audit/internalAuditAnalysisData';
import AutomationWorkflowsTab from '../engagement-configurable/patterns/automation/AutomationWorkflowsTab';
import AutomationCasesTab from '../engagement-configurable/patterns/automation/AutomationCasesTab';
import type { AutomationProjectWorkspaceState } from '../engagement-configurable/patterns/automation/automationInputData';
import type { AutomationSetupState } from '../engagement-configurable/patterns/automation/automationSetupData';
import type { AutomationRunsState, ExceptionStatus as AutoExceptionStatus } from '../engagement-configurable/patterns/automation/automationRunsData';
import type { AutomationOutputReviewState } from '../engagement-configurable/patterns/automation/automationOutputReviewData';
import type { AutomationCasesState } from '../engagement-configurable/patterns/automation/automationCasesData';
import type { AutomationReportsState } from '../engagement-configurable/patterns/automation/automationReportsData';
import type { AutomationScheduleState } from '../engagement-configurable/patterns/automation/automationScheduleData';
import type { AutomationInputDataState } from '../engagement-configurable/patterns/automation/automationInputData';

// ─── Mock Data ──────────────────────────────────────────────────────────

interface IAEngagementCard {
  id: string; name: string; process: string; entity: string; owner: string; reviewer: string;
  status: string; statusTone: string; period: string; exceptions: number; nextAction: string;
}

const MOCK_IA_ENGAGEMENTS: IAEngagementCard[] = [
  { id: 'ef-001', name: 'P2P Internal Audit Review', process: 'Procure to Pay', entity: 'Corporate', owner: 'Karan Mehta', reviewer: 'Sneha Desai', status: 'In Progress', statusTone: 'bg-evidence-50 text-evidence-700', period: 'Jan 2026 – Jun 2026', exceptions: 5, nextAction: 'Run Workflows' },
  { id: 'ef-002', name: 'Vendor Onboarding Audit', process: 'Vendor Management', entity: 'Corporate', owner: 'Tushar Goel', reviewer: 'Karan Mehta', status: 'Scope Defined', statusTone: 'bg-blue-50 text-blue-700', period: 'Feb 2026 – Jul 2026', exceptions: 0, nextAction: 'Select Controls' },
  { id: 'ef-003', name: 'Branch Operations Audit', process: 'Operations', entity: 'Branch — Mumbai', owner: 'Deepak Bansal', reviewer: 'Karan Mehta', status: 'Exception Review', statusTone: 'bg-amber-50 text-amber-700', period: 'Oct 2025 – Mar 2026', exceptions: 7, nextAction: 'Review Exceptions' },
  { id: 'ef-004', name: 'Inventory Management Review', process: 'Inventory', entity: 'Plant — Pune', owner: 'Neha Joshi', reviewer: 'Rohan Patel', status: 'Report Pending', statusTone: 'bg-purple-50 text-purple-700', period: 'Mar 2026 – Aug 2026', exceptions: 4, nextAction: 'Generate Report' },
];

function buildEngagement(card: IAEngagementCard): ConfigurableEngagement {
  return {
    id: card.id, name: card.name,
    patternType: EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT,
    displayLabel: 'Audit Assignment', description: `Internal audit of ${card.process} process.`,
    owner: card.owner, reviewer: card.reviewer, businessProcess: card.process, entityOrLocation: card.entity,
    status: EngagementStatus.IN_PROGRESS, stage: card.status,
    config: {
      patternType: EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT,
      scopeLevel: AuditScopeLevel.PROCESS, businessProcessId: card.process, subProcessId: '',
      auditPeriodStart: '', auditPeriodEnd: '', sopIds: [], racmVersionId: '', checklistId: '',
      processOwner: card.owner, idrEnabled: true, announcementRequired: true, finalReportRequired: true, actionTrackingEnabled: true,
    } as InternalAuditConfig,
    outputs: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

// ─── Landing Page ───────────────────────────────────────────────────────

function EngagementFinalLanding({ onOpen }: { onOpen: (card: IAEngagementCard) => void }) {
  const [search, setSearch] = useState('');
  const filtered = MOCK_IA_ENGAGEMENTS.filter(e => !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()) || e.owner.toLowerCase().includes(search.toLowerCase()) || e.process.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Engagement Final</h1>
          <p className="text-sm text-text-secondary mt-1">Manage and execute internal audit engagements from scope to workflow execution, exception management, reporting, and audit trail.</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-medium text-white text-[13px] font-semibold hover:from-primary-hover hover:to-primary transition-all cursor-pointer shadow-sm">
          <Plus size={14} />Plan Internal Audit Engagement
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search engagements..."
          className="w-full pl-9 pr-4 h-9 rounded-md border border-border-light bg-white text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors" />
      </div>

      <div className="rounded-xl border border-border-light bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left">Engagement</th>
              <th className="px-4 py-2.5 text-left w-[120px]">Process</th>
              <th className="px-4 py-2.5 text-left w-[100px]">Entity</th>
              <th className="px-4 py-2.5 text-left w-[110px]">Owner</th>
              <th className="px-4 py-2.5 text-center w-[110px]">Status</th>
              <th className="px-4 py-2.5 text-center w-[80px]">Exceptions</th>
              <th className="px-4 py-2.5 text-left w-[120px]">Period</th>
              <th className="px-4 py-2.5 text-left w-[130px]">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((eng, i) => (
              <motion.tr key={eng.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                onClick={() => onOpen(eng)} className="border-b border-border-light/50 hover:bg-primary/[0.02] cursor-pointer transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0"><ClipboardCheck size={16} className="text-purple-600" /></div>
                    <div><div className="text-[13px] font-semibold text-text group-hover:text-primary transition-colors">{eng.name}</div></div>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">{eng.process}</td>
                <td className="px-4 py-3 text-text-muted">{eng.entity}</td>
                <td className="px-4 py-3"><div className="text-text font-medium">{eng.owner}</div><div className="text-[10px] text-gray-400">{eng.reviewer}</div></td>
                <td className="px-4 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${eng.statusTone}`}>{eng.status}</span></td>
                <td className="px-4 py-3 text-center"><span className={`font-semibold tabular-nums ${eng.exceptions > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{eng.exceptions}</span></td>
                <td className="px-4 py-3 text-text-muted text-[11px]"><span className="flex items-center gap-1"><Calendar size={10} />{eng.period}</span></td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-[10px] font-semibold">{eng.nextAction}</span></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab definitions ────────────────────────────────────────────────────

interface TabDef { id: string; label: string }

const ALL_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scope', label: 'Scope' },
  { id: 'racm', label: 'RACM' },
  { id: 'controls', label: 'Controls' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'exceptions', label: 'Exception Management' },
  { id: 'report', label: 'Audit Report' },
  { id: 'trail', label: 'Audit Trail' },
];

function getVisibleTabs(scope: InternalAuditScopeState): TabDef[] {
  const showRacm = scope.sopIds.length > 0 || scope.racmVersionIds.length > 0;
  const showControls = showRacm || scope.checklistIds.length > 0;
  const showWorkflows = showControls;
  return ALL_TABS.filter(t => {
    if (t.id === 'racm') return showRacm;
    if (t.id === 'controls') return showControls;
    if (t.id === 'workflows') return showWorkflows;
    if (t.id === 'exceptions') return showWorkflows;
    return true;
  });
}

// ─── Workspace ──────────────────────────────────────────────────────────

function EngagementFinalWorkspace({ card, onBack }: { card: IAEngagementCard; onBack: () => void }) {
  const engagement = useMemo(() => buildEngagement(card), [card]);
  const [activeTab, setActiveTab] = useState('overview');

  // IA Scope state
  const [scope, setScope] = useState<InternalAuditScopeState>({ ...DEFAULT_IA_SCOPE });

  // IA Announcement state + modal
  const [announcement, setAnnouncement] = useState<InternalAuditAnnouncementState>({ ...DEFAULT_ANNOUNCEMENT });
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  // Intercept Scope tab navigation — 'announcement' opens the modal instead
  const handleScopeNavigate = useCallback((tabId: string) => {
    if (tabId === 'announcement') {
      setShowAnnouncementModal(true);
    } else {
      setActiveTab(tabId);
    }
  }, []);

  // IA Analysis state (for Controls tab)
  const [analysisState, setAnalysisState] = useState<InternalAuditAnalysisState>({ runs: [], potentialObservations: [] });

  // Automation state (for Workflows + Cases)
  const [automationState, setAutomationState] = useState<AutomationProjectWorkspaceState>({
    inputData: { dataSources: [], selectedSourceIds: [], inputNotes: '', proceedWithoutData: false },
    setup: { setupMode: 'SELECT_EXISTING_WORKFLOW' as any, selectedWorkflowId: '', selectedWorkflowName: '', selectedWorkflowIds: [], selectedWorkflowNames: [], draftWorkflow: null, qaSetup: null, createdWorkflows: [], setupStatus: 'NOT_CONFIGURED' as any, setupNotes: '', history: [] },
    runs: { runs: [] },
    outputReview: { reviewedOutputIds: [], approvedOutputIds: [], rejectedOutputIds: [], outputComments: {}, reviewNotes: '', history: [] },
    cases: { cases: [], linkedExceptionIds: [], caseNotes: '' },
    reports: { reports: [], reportNotes: '' },
    schedule: { status: 'NOT_CONFIGURED' as any, frequency: '', startDate: '', endDate: '', runTime: '09:00', timezone: 'IST (UTC+5:30)', selectedWorkflowId: '', selectedInputSourceIds: [], notificationRecipients: '', failureNotificationRecipients: '', autoCreateCases: false, autoGenerateReport: false, lastRunAt: null, nextRunAt: null, scheduleNotes: '', history: [] },
  });

  const handleUpdateRuns = useCallback((runs: AutomationRunsState) => {
    setAutomationState(prev => ({ ...prev, runs }));
  }, []);
  const handleUpdateSetup = useCallback((setup: AutomationSetupState) => {
    setAutomationState(prev => ({ ...prev, setup }));
  }, []);
  const handleUpdateInputData = useCallback((inputData: AutomationInputDataState) => {
    setAutomationState(prev => ({ ...prev, inputData }));
  }, []);
  const handleUpdateCases = useCallback((cases: AutomationCasesState) => {
    setAutomationState(prev => ({ ...prev, cases }));
  }, []);
  const handleUpdateRunException = useCallback((runId: string, exId: string, status: AutoExceptionStatus, triageData?: Record<string, unknown>) => {
    setAutomationState(prev => ({
      ...prev,
      runs: { runs: prev.runs.runs.map(r => r.id === runId ? { ...r, exceptions: r.exceptions.map(e => e.id === exId ? { ...e, status, ...triageData } : e) } : r) },
    }));
  }, []);
  const handleUpdateAnalysis = useCallback((state: InternalAuditAnalysisState) => setAnalysisState(state), []);

  const visibleTabs = useMemo(() => getVisibleTabs(scope), [scope]);
  const activeTabDef = visibleTabs.find(t => t.id === activeTab) || visibleTabs[0];

  // Audit trail events
  const trailEvents = useMemo(() => {
    const events: { id: string; time: string; title: string; subtitle: string; type: string }[] = [];
    events.push({ id: '1', time: 'Today', title: 'Engagement opened', subtitle: card.name, type: 'config' });
    if (scope.businessProcessId) events.push({ id: '2', time: 'Today', title: 'Scope defined', subtitle: `Process: ${scope.businessProcessId}`, type: 'config' });
    if (scope.sopIds.length > 0) events.push({ id: '3', time: 'Today', title: `${scope.sopIds.length} SOP(s) selected`, subtitle: 'Scope sources configured', type: 'config' });
    if (scope.racmVersionIds.length > 0) events.push({ id: '4', time: 'Today', title: `${scope.racmVersionIds.length} RACM(s) selected`, subtitle: 'RACM linked', type: 'config' });
    for (const run of automationState.runs.runs.filter(r => r.status === 'COMPLETED')) {
      events.push({ id: `run-${run.id}`, time: 'Today', title: `Workflow run completed: ${run.workflowNames?.join(', ') || run.workflowName}`, subtitle: `${run.exceptionCount} exceptions · ${run.processedRecords} records`, type: 'run' });
    }
    return events;
  }, [card, scope, automationState.runs.runs]);

  const completedRuns = automationState.runs.runs.filter(r => r.status === 'COMPLETED');
  const totalExceptions = completedRuns.flatMap(r => r.exceptions).length;

  // RACM display — context-aware naming matching Programs → Engagements style
  const racmDisplayProcess = card.process === 'Procure to Pay' ? 'P2P' : card.process === 'Order to Cash' ? 'O2C' : card.process === 'Vendor Management' ? 'VM' : 'P2P';
  const racmDisplayName = scope.racmVersionIds.length > 0
    ? `FY26 ${racmDisplayProcess} — ${card.process}`
    : scope.sopIds.length > 0
    ? `SOP-Derived RACM — ${card.process}`
    : `${card.process} Internal Audit RACM`;

  return (
    <div className="space-y-0">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-4">
        <ArrowLeft size={14} />Back to Engagement Final Library
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-border-light p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><ClipboardCheck size={18} className="text-purple-600" /></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[15px] font-bold text-text">{card.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${card.statusTone}`}>{card.status}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-bold">Audit Assignment</span>
                <span className="text-text-muted">Internal Audit</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500 mt-1">
                <span>Owner: {card.owner}</span>
                <span>Reviewer: {card.reviewer}</span>
                <span>Process: {card.process}</span>
                <span>Entity: {card.entity}</span>
                <span>Period: {card.period}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-light mb-4">
        <div className="flex items-center gap-0.5 overflow-x-auto pb-px">
          {visibleTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-text hover:border-gray-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border-light bg-white p-5">
            <h3 className="text-[13px] font-bold text-text mb-2">Objective</h3>
            <p className="text-[12px] text-text-secondary leading-relaxed">{engagement.description}</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Workflows Run', value: completedRuns.length, icon: Workflow, color: 'text-primary' },
              { label: 'Exceptions', value: totalExceptions, icon: AlertTriangle, color: totalExceptions > 0 ? 'text-amber-600' : 'text-gray-400' },
              { label: 'Cases', value: automationState.cases.cases.length, icon: Shield, color: 'text-purple-600' },
              { label: 'Status', value: card.status, icon: CheckCircle2, color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border-light bg-white p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface-2"><s.icon size={16} className={s.color} /></div>
                <div><div className={`text-[16px] font-bold ${s.color}`}>{s.value}</div><div className="text-[10px] text-gray-400">{s.label}</div></div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/40 border border-blue-100/50 text-[10px] text-blue-600">
            <Info size={11} className="shrink-0 mt-0.5" />
            <span>Start by defining the Scope to configure RACM, Controls, and Workflows for this audit.</span>
          </div>
        </div>
      )}

      {activeTab === 'scope' && (
        <div className="space-y-0">
          {announcement.status !== 'DRAFT' && (
            <div className="mb-3 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                announcement.status === 'SENT' || announcement.status === 'ACKNOWLEDGED' ? 'bg-emerald-50 text-emerald-700' :
                announcement.status === 'READY_TO_SEND' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                <CheckCircle2 size={9} />
                {announcement.status === 'ACKNOWLEDGED' ? 'Announcement Acknowledged' :
                 announcement.status === 'SENT' ? 'Announcement Sent' :
                 announcement.status === 'READY_TO_SEND' ? 'Announcement Ready' : 'Announcement Drafted'}
              </span>
              <button onClick={() => setShowAnnouncementModal(true)} className="text-[10px] text-primary hover:underline cursor-pointer font-medium">View / Edit</button>
            </div>
          )}
          <InternalAuditScopeTab
            engagement={engagement}
            scope={scope}
            onUpdateScope={setScope}
            onNavigateTab={handleScopeNavigate}
          />
        </div>
      )}

      {activeTab === 'racm' && (
        <div className="space-y-4">
          {/* Linked RACM Snapshot header — matches Programs → Engagements P2P SOX Audit */}
          <div className="bg-white rounded-xl border border-border-light p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10"><Shield size={16} className="text-primary" /></div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-semibold text-text">Linked RACM Snapshot</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700">Active</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="font-medium text-text">{racmDisplayName}</span>
                  <span className="text-gray-300">·</span>
                  <span>{racmDisplayProcess}</span>
                  <span className="text-gray-300">·</span>
                  <span>{card.process}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upload RACM — matching Engagement Execution V2 */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03]">
            <FileText size={14} className="text-primary shrink-0" />
            <div className="flex-1">
              <span className="text-[11px] font-semibold text-text">Upload RACM</span>
              <span className="text-[10px] text-gray-400 ml-2">Upload an Excel/CSV RACM file to replace or update the linked version.</span>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors">
              <FileText size={11} />Choose File
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  alert(`RACM file "${file.name}" selected. This will be used as the linked RACM version for this engagement.`);
                  e.target.value = '';
                }
              }} />
            </label>
          </div>

          {/* Full RacmMappingWorkspace — same as Programs → Engagements P2P SOX Audit */}
          <RacmMappingWorkspace
            onBack={() => setActiveTab('scope')}
            racmName={racmDisplayName}
            racmProcess={racmDisplayProcess}
            inline={true}
            showEditAction={true}
          />
        </div>
      )}

      {activeTab === 'controls' && (
        <InternalAuditControlsTab
          engagement={engagement}
          scope={scope}
          analysisState={analysisState}
          onUpdateAnalysis={handleUpdateAnalysis}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'workflows' && (
        <AutomationWorkflowsTab
          engagement={engagement}
          inputData={automationState.inputData}
          setup={automationState.setup}
          runsState={automationState.runs}
          onUpdateSetup={handleUpdateSetup}
          onUpdateRuns={handleUpdateRuns}
          onUpdateInputData={handleUpdateInputData}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'exceptions' && (
        <AutomationCasesTab
          engagement={engagement}
          runsState={automationState.runs}
          casesState={automationState.cases}
          onUpdateCases={handleUpdateCases}
          onUpdateRunException={handleUpdateRunException}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border-light bg-white p-5">
            <h3 className="text-[15px] font-bold text-text mb-3 flex items-center gap-2"><FileText size={14} className="text-primary" />Audit Report</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[12px] mb-4">
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Engagement</span><span className="text-text font-semibold">{card.name}</span></div>
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Process</span><span className="text-text font-semibold">{card.process}</span></div>
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Owner</span><span className="text-text font-semibold">{card.owner}</span></div>
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Period</span><span className="text-text font-semibold">{card.period}</span></div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: 'Scope Sources', value: scope.sopIds.length + scope.racmVersionIds.length + scope.checklistIds.length },
                { label: 'Workflows Executed', value: completedRuns.length },
                { label: 'Exceptions Found', value: totalExceptions, color: totalExceptions > 0 ? 'text-amber-600' : '' },
                { label: 'Cases Assigned', value: automationState.cases.cases.length },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
                  <div className={`text-[16px] font-bold tabular-nums ${s.color || 'text-text'}`}>{s.value}</div>
                  <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
            {completedRuns.length === 0 ? (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50/50 border border-amber-200/50 text-[11px] text-amber-700">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>Run workflows from the Workflows tab to generate audit findings for this report.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50/50 border border-emerald-200/50 text-[11px] text-emerald-700">
                <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                <span>{completedRuns.length} workflow run(s) completed with {totalExceptions} exception(s). Review exceptions in Exception Management before finalizing.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'trail' && (
        <div className="space-y-0">
          <div className="flex items-center gap-4 pb-4 border-b border-border-light">
            <div className="text-[11px] text-gray-400">{trailEvents.length} event{trailEvents.length !== 1 ? 's' : ''}</div>
          </div>
          {trailEvents.length === 0 ? (
            <div className="py-16 text-center"><Clock size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-[14px] font-semibold text-text mb-1">No Activity Yet</p></div>
          ) : (
            <div className="pt-2 space-y-1">
              {trailEvents.map(ev => {
                const ICONS: Record<string, { icon: React.ElementType; bg: string; color: string; border: string }> = {
                  config: { icon: ClipboardCheck, bg: 'bg-gray-200', color: 'text-gray-500', border: 'border-l-gray-300' },
                  run: { icon: Workflow, bg: 'bg-purple-100', color: 'text-purple-600', border: 'border-l-purple-300' },
                };
                const cfg = ICONS[ev.type] || ICONS.config;
                const Icon = cfg.icon;
                return (
                  <div key={ev.id} className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border-l-[3px] ${cfg.border} hover:bg-white transition-colors`}>
                    <div className={`w-7 h-7 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}><Icon size={13} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-text">{ev.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{ev.subtitle}</div>
                    </div>
                    <div className="text-[10px] text-gray-300 shrink-0">{ev.time}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Announcement Modal ═══ */}
      <AnimatePresence>
        {showAnnouncementModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
              onClick={() => setShowAnnouncementModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-4 md:inset-8 lg:inset-y-8 lg:inset-x-16 z-50 flex flex-col bg-white rounded-2xl border border-border-light shadow-xl overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
                <div>
                  <h2 className="text-[15px] font-bold text-text">Audit Announcement</h2>
                  <p className="text-[11px] text-text-muted mt-0.5">Review the announcement before sharing it with process owners.</p>
                </div>
                <button onClick={() => setShowAnnouncementModal(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-text cursor-pointer transition-colors">
                  <X size={16} />
                </button>
              </div>
              {/* Modal body — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <InternalAuditAnnouncementTab
                  engagement={engagement}
                  scope={scope}
                  announcement={announcement}
                  onUpdateAnnouncement={setAnnouncement}
                  onNavigateTab={(tabId) => {
                    // 'requests-idr' from the Acknowledge → Continue action: close modal
                    setShowAnnouncementModal(false);
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Module Export ──────────────────────────────────────────────────

export default function EngagementFinalModule() {
  const [selectedCard, setSelectedCard] = useState<IAEngagementCard | null>(null);

  if (selectedCard) {
    return <EngagementFinalWorkspace card={selectedCard} onBack={() => setSelectedCard(null)} />;
  }

  return <EngagementFinalLanding onOpen={setSelectedCard} />;
}
