// ─── Engagement Execution V2 — Main Page ─────────────────────────────────
// Renders engagement header, KPI cards, and controls table.
// Uses derived helpers — no hardcoded state logic in this component.

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, Shield, Calendar, User, Clock, FileText, Search,
  ChevronRight, AlertTriangle, X, ExternalLink, Upload,
} from 'lucide-react';
import RacmMappingWorkspace from '../audit/RacmMappingWorkspace';
import { useAuditLog } from '../../context/AdminDataContext';
import type { EngagementExecution, ExecutionControl } from './types';
import { MOCK_ENGAGEMENT_V2 } from './mockExecutionData';
import {
  EXEC_STATUS_DISPLAY, CONCLUSION_DISPLAY,
  CONTROL_TYPE_DISPLAY, REVIEW_STATUS_DISPLAY,
} from './executionState';
import {
  deriveControlType, deriveWorkflowCoverage, deriveNextAction, deriveNextStepId,
  deriveTestingProgress, deriveEngagementKpis,
} from './helpers';
import ExecutionControlWorkspaceV2 from './ExecutionControlWorkspaceV2';
import EngagementInsightsRollup from './EngagementInsightsRollup';

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  engagementId?: string;
  onBack: () => void;
  onLaunchWorkflowBuilder?: (seedPrompt: string) => void;
  requestPbcEnabled?: boolean;
  generateFromPopulation?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function EngagementExecutionV2({ onBack, onLaunchWorkflowBuilder, requestPbcEnabled = true, generateFromPopulation = false }: Props) {
  const [engagement, setEngagement] = useState<EngagementExecution>(MOCK_ENGAGEMENT_V2);
  const [showRacmModal, setShowRacmModal] = useState(false);
  const logEvent = useAuditLog();

  const updateControl = (controlId: string, updater: (ctrl: ExecutionControl) => ExecutionControl) => {
    setEngagement(prev => ({
      ...prev,
      controls: prev.controls.map(c => c.id === controlId ? updater(c) : c),
    }));
  };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [initialStepId, setInitialStepId] = useState<string | null>(null);

  const openControlWorkspace = (controlId: string, stepId?: string) => {
    setSelectedControlId(controlId || null);
    setInitialStepId(stepId || null);
  };

  const kpis = useMemo(() => deriveEngagementKpis(engagement), [engagement]);

  const filtered = useMemo(() => {
    let list = engagement.controls;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    }
    if (statusFilter !== 'All') {
      list = list.filter(c => c.execution.status === statusFilter);
    }
    return list;
  }, [engagement.controls, search, statusFilter]);

  const statusFilters = [
    { id: 'All', label: 'All', count: engagement.controls.length },
    { id: 'NOT_STARTED', label: 'Not Started', count: kpis.notStarted },
    { id: 'IN_PROGRESS', label: 'In Progress', count: kpis.inProgress },
    { id: 'PENDING_REVIEW', label: 'Pending Review', count: kpis.pendingReview },
    { id: 'CONCLUDED', label: 'Concluded', count: kpis.concluded },
  ];

  // For "In Progress" filter — match multiple statuses
  const filteredFinal = useMemo(() => {
    if (statusFilter !== 'IN_PROGRESS') return filtered;
    const inProgressStatuses = ['POPULATION_READY', 'TEST_ITEMS_READY', 'EVIDENCE_IN_PROGRESS', 'EVIDENCE_READY', 'TESTING_IN_PROGRESS', 'TESTING_COMPLETE'];
    return engagement.controls.filter(c => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.id.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) return false;
      }
      return inProgressStatuses.includes(c.execution.status);
    });
  }, [engagement.controls, search, statusFilter, filtered]);

  const displayList = statusFilter === 'IN_PROGRESS' ? filteredFinal : filtered;
  const selectedControl = selectedControlId ? engagement.controls.find(c => c.id === selectedControlId) : null;

  return (
    <div className="h-full overflow-y-auto bg-surface-2">
      <div className="px-10 py-6 max-w-[1440px] mx-auto">

        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-4">
          <ArrowLeft size={14} />Back to Engagements
        </button>

        {/* ═══ Engagement Header ═══ */}
        <div className="bg-white rounded-lg border border-border-light p-6 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[0.6875rem] text-text-muted font-medium uppercase tracking-wider mb-1">Engagement Execution Workspace</p>
              <h1 className="text-[1.25rem] font-bold text-text">{engagement.name}</h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-[0.6875rem] font-semibold ${
              engagement.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
              engagement.status === 'COMPLETED' ? 'bg-blue-50 text-blue-700' :
              engagement.status === 'IN_REVIEW' ? 'bg-purple-50 text-purple-700' :
              'bg-canvas text-ink-600'
            }`}>{engagement.status === 'ACTIVE' ? 'Active' : engagement.status === 'IN_REVIEW' ? 'In Review' : engagement.status === 'COMPLETED' ? 'Completed' : 'Draft'}</span>
          </div>

          <div className="grid grid-cols-6 gap-4 text-[0.75rem]">
            {[
              { icon: FileText, label: 'Audit Type', value: engagement.auditType },
              { icon: Shield, label: 'Framework', value: engagement.framework },
              { icon: Calendar, label: 'Audit Period', value: `${engagement.auditPeriodStart} — ${engagement.auditPeriodEnd}` },
              { icon: Clock, label: 'Primary Process', value: engagement.primaryProcess },
              { icon: User, label: 'Owner', value: engagement.owner },
              { icon: User, label: 'Reviewer', value: engagement.reviewer },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <item.icon size={13} className="text-ink-400 shrink-0" />
                <div>
                  <span className="text-ink-400 block text-[0.625rem]">{item.label}</span>
                  <span className="text-text font-medium">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ KPI Cards ═══ */}
        <div className="grid grid-cols-7 gap-2.5 mb-5">
          {[
            { label: 'Total Controls', value: kpis.totalControls, color: 'text-text', bg: 'bg-white' },
            { label: 'Not Started', value: kpis.notStarted, color: 'text-ink-600', bg: 'bg-white' },
            { label: 'In Progress', value: kpis.inProgress, color: 'text-blue-700', bg: kpis.inProgress > 0 ? 'bg-blue-50/40' : 'bg-white' },
            { label: 'Pending Review', value: kpis.pendingReview, color: 'text-purple-700', bg: kpis.pendingReview > 0 ? 'bg-purple-50/40' : 'bg-white' },
            { label: 'Concluded', value: kpis.concluded, color: 'text-emerald-700', bg: kpis.concluded > 0 ? 'bg-emerald-50/40' : 'bg-white' },
            { label: 'Effective', value: kpis.effective, color: 'text-emerald-700', bg: kpis.effective > 0 ? 'bg-emerald-50/40' : 'bg-white' },
            { label: 'Ineffective', value: kpis.ineffective, color: 'text-red-700', bg: kpis.ineffective > 0 ? 'bg-red-50/40' : 'bg-white' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} rounded-xl border border-border-light px-3.5 py-2.5`}>
              <span className={`text-[1.25rem] font-bold ${card.color} block tabular-nums`}>{card.value}</span>
              <span className="text-[0.5625rem] text-ink-400 font-medium">{card.label}</span>
            </div>
          ))}
        </div>

        {/* ═══ AI insight roll-up (engagement / portfolio altitude) ═══ */}
        <EngagementInsightsRollup engagementName={engagement.name} />

        {/* ═══ Linked RACM Snapshot ═══ */}
        <div className="bg-white rounded-lg border border-border-light p-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10"><Shield size={16} className="text-primary" /></div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[0.8125rem] font-semibold text-text">Linked RACM Snapshot</span>
                <span className="px-2 py-0.5 rounded-full text-[0.5625rem] font-semibold bg-emerald-50 text-emerald-700">Locked</span>
              </div>
              <div className="flex items-center gap-3 text-[0.6875rem] text-ink-500">
                <span className="font-medium text-text">FY26 P2P — Vendor Payment</span>
                <span className="text-ink-300">·</span>
                <span>{engagement.framework}</span>
                <span className="text-ink-300">·</span>
                <span>{engagement.primaryProcess}</span>
                <span className="text-ink-300">·</span>
                <span>9 risks · {kpis.totalControls} controls</span>
              </div>
            </div>
          </div>
          <button onClick={() => setShowRacmModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-[0.6875rem] font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-colors">
            <ExternalLink size={12} />Open RACM
          </button>
        </div>

        {/* ═══ Toolbar ═══ */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-[260px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search controls..."
              className="w-full pl-8 pr-3 h-9 rounded-lg border border-border bg-white text-[0.75rem] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
          </div>
          <div className="flex items-center gap-1">
            {statusFilters.map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[0.625rem] font-semibold cursor-pointer transition-all ${
                  statusFilter === f.id ? 'bg-primary text-white' : 'bg-white text-text-muted border border-border-light hover:bg-primary/5'
                }`}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          <span className="ml-auto text-[0.6875rem] text-text-muted">{displayList.length} control{displayList.length !== 1 ? 's' : ''}</span>
        </div>

        {/* ═══ Controls Table ═══ */}
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[0.6875rem]" style={{ minWidth: 1200 }}>
              <thead className="bg-white sticky top-0 z-10 border-b border-border-light">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[90px]">Control ID</th>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted">Control Name</th>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[80px]">Type</th>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[160px]">Workflow Coverage</th>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[110px]">Exec Status</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[90px]">Pop / Samples</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[70px]">Evidence</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[90px]">Attr Testing</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[70px]">Review</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[80px]">Conclusion</th>
                  <th className="px-3 py-2.5 text-right text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[120px]">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {displayList.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-[0.75rem] text-text-muted">No controls match the current filter</td></tr>
                ) : displayList.map((ctrl, i) => (
                  <ControlTableRow
                    key={ctrl.id}
                    ctrl={ctrl}
                    index={i}
                    isSelected={selectedControlId === ctrl.id}
                    onSelect={() => openControlWorkspace(ctrl.id === selectedControlId ? '' : ctrl.id)}
                    onActionClick={() => {
                      const action = deriveNextAction(ctrl);
                      const stepId = deriveNextStepId(action);
                      openControlWorkspace(ctrl.id, stepId);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ Selected Control Workspace ═══ */}
        {selectedControl && (
          <ExecutionControlWorkspaceV2
            ctrl={selectedControl}
            onClose={() => { setSelectedControlId(null); setInitialStepId(null); }}
            onUpdateControl={(updater) => updateControl(selectedControl.id, updater)}
            initialStepId={initialStepId}
            onLaunchWorkflowBuilder={onLaunchWorkflowBuilder}
            requestPbcEnabled={requestPbcEnabled}
            generateFromPopulation={generateFromPopulation}
          />
        )}

      </div>

      {/* ═══ RACM Modal ═══ */}
      {showRacmModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={() => setShowRacmModal(false)} />
          <div className="fixed inset-4 z-50 flex items-stretch justify-center">
            <div className="bg-white rounded-2xl shadow-2xl border border-border-light w-full max-w-[1200px] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="shrink-0 px-6 py-4 border-b border-border-light">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-[1rem] font-bold text-text">Linked RACM Snapshot</h2>
                    <p className="text-[0.75rem] text-text-muted mt-0.5">FY26 P2P — Vendor Payment · {engagement.framework} · {engagement.primaryProcess}</p>
                  </div>
                  <button onClick={() => setShowRacmModal(false)} className="w-8 h-8 rounded-full text-ink-400 hover:text-text hover:bg-canvas flex items-center justify-center cursor-pointer transition-colors">
                    <X size={16} />
                  </button>
                </div>
                {/* Upload RACM */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03]">
                  <Upload size={14} className="text-primary shrink-0" />
                  <div className="flex-1">
                    <span className="text-[0.6875rem] font-semibold text-text">Upload RACM</span>
                    <span className="text-[0.625rem] text-ink-400 ml-2">Upload an Excel/CSV RACM file to replace or update the linked version.</span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors">
                    <Upload size={11} />Choose File
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Simulate RACM upload — in production this would parse and import
                        logEvent({ action: 'Upload', description: `Uploaded RACM file "${file.name}" for engagement "${engagement.name}"`, module: 'Engagement Execution', entity: 'RACM' });
                        alert(`RACM file "${file.name}" selected. This will be used as the linked RACM version for this engagement.`);
                        e.target.value = '';
                      }
                    }} />
                  </label>
                </div>
              </div>
              {/* Modal Body — reuses RacmMappingWorkspace */}
              <div className="flex-1 overflow-y-auto">
                <RacmMappingWorkspace
                  onBack={() => setShowRacmModal(false)}
                  racmName="FY26 P2P — Vendor Payment"
                  racmProcess="P2P"
                  inline={true}
                  showEditAction={true}
                />
              </div>
              {/* Modal Footer */}
              <div className="shrink-0 px-6 py-3 border-t border-border-light bg-canvas/50 flex items-center justify-between">
                <span className="text-[0.625rem] text-ink-400">Changes to the source RACM may require refreshing the engagement snapshot before testing.</span>
                <button onClick={() => setShowRacmModal(false)} className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Control Table Row ────────────────────────────────────────────────────

function ControlTableRow({ ctrl, index, isSelected, onSelect, onActionClick }: {
  ctrl: ExecutionControl; index: number; isSelected: boolean; onSelect: () => void; onActionClick: () => void;
}) {
  const controlType = deriveControlType(ctrl);
  const coverage = deriveWorkflowCoverage(ctrl);
  const nextAction = deriveNextAction(ctrl);
  const testing = deriveTestingProgress(ctrl);
  const statusDisplay = EXEC_STATUS_DISPLAY[ctrl.execution.status];
  const typeDisplay = CONTROL_TYPE_DISPLAY[controlType];
  const reviewDisplay = REVIEW_STATUS_DISPLAY[ctrl.execution.review.status];
  const conclusionDisplay = ctrl.execution.conclusion.value ? CONCLUSION_DISPLAY[ctrl.execution.conclusion.value] : null;

  const popSamples = ctrl.execution.population
    ? `${ctrl.execution.population.rowCount} / ${ctrl.execution.testItems.length}`
    : '—';

  const evidenceCount = ctrl.execution.testItems.reduce((sum, ti) => sum + ti.evidence.length, 0);

  const attrDisplay = testing.totalAttributeChecks > 0
    ? `${testing.completedAttributeChecks}/${testing.totalAttributeChecks}`
    : '—';

  return (
    <motion.tr
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.02 }}
      onClick={onSelect}
      className={`border-t border-border-light transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-2/40'}`}>

      {/* Control ID */}
      <td className="px-3 py-3">
        <span className="text-[0.6875rem] font-mono text-ink-500">{ctrl.id.replace('exec-', '')}</span>
      </td>

      {/* Control Name */}
      <td className="px-3 py-3">
        <span className="text-[0.75rem] font-medium text-text">{ctrl.name}</span>
      </td>

      {/* Type */}
      <td className="px-3 py-3">
        <span className={`px-1.5 py-0.5 rounded text-[0.5625rem] font-bold ${typeDisplay.bg} ${typeDisplay.text}`}>{typeDisplay.label}</span>
      </td>

      {/* Workflow Coverage */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.625rem] text-text">{coverage.displayText}</span>
          {coverage.unmappedAttributes > 0 && (
            <AlertTriangle size={10} className="text-amber-500 shrink-0" />
          )}
        </div>
      </td>

      {/* Execution Status */}
      <td className="px-3 py-3">
        <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${statusDisplay.bg} ${statusDisplay.text}`}>
          {statusDisplay.label}
        </span>
      </td>

      {/* Population / Samples */}
      <td className="px-3 py-3 text-center">
        <span className={`text-[0.625rem] tabular-nums ${popSamples === '—' ? 'text-ink-300' : 'text-text'}`}>{popSamples}</span>
      </td>

      {/* Evidence */}
      <td className="px-3 py-3 text-center">
        <span className={`text-[0.625rem] tabular-nums ${evidenceCount === 0 ? 'text-ink-300' : 'text-text'}`}>{evidenceCount || '—'}</span>
      </td>

      {/* Attribute Testing */}
      <td className="px-3 py-3 text-center">
        <span className={`text-[0.625rem] tabular-nums ${attrDisplay === '—' ? 'text-ink-300' : 'text-text'}`}>{attrDisplay}</span>
      </td>

      {/* Review */}
      <td className="px-3 py-3 text-center">
        <span className={`text-[0.625rem] font-semibold ${reviewDisplay.text}`}>{reviewDisplay.label}</span>
      </td>

      {/* Conclusion */}
      <td className="px-3 py-3 text-center">
        {conclusionDisplay ? (
          <span className={`px-1.5 py-0.5 rounded text-[0.5625rem] font-bold ${conclusionDisplay.bg} ${conclusionDisplay.text}`}>{conclusionDisplay.label}</span>
        ) : (
          <span className="text-[0.625rem] text-ink-300">—</span>
        )}
      </td>

      {/* Next Action */}
      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
        <button onClick={onActionClick}
          className="px-2.5 py-1 rounded-lg text-[0.625rem] font-semibold cursor-pointer transition-colors bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1">
          {nextAction}<ChevronRight size={8} />
        </button>
      </td>
    </motion.tr>
  );
}
