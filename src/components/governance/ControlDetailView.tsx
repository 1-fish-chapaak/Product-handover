import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Pencil, Star, Shield, User, Calendar, Clock,
  FileText, AlertTriangle, Workflow, Link2, Unlink, Search,
  Check, X, LayoutGrid, History, ClipboardList, Plus, Trash2,
  Info, Lock, Paperclip, CheckCircle2, Zap, ArrowRight, Play,
  Settings, Eye, Repeat, Share2,
} from 'lucide-react';
import Orb from '../shared/Orb';
import InsightGenerator from '../shared/InsightGenerator';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { useAuditLog } from '../../context/AdminDataContext';
import { RISKS, WORKFLOWS, RACMS } from '../../data/mockData';
import LinkWorkflowDrawer from './LinkWorkflowDrawer';
import {
  type ControlRow, type TestAttribute, type EvidenceType,
  BP_COLORS, AUTOMATION_STYLES, NATURE_STYLES,
  STATUS_STYLES, ASSERTION_LABELS, SEED_WORKFLOW_ATTRIBUTES,
  RACM_CONTROL_MAP, CONTROL_HISTORY,
} from './controlTypes';

/* ─── Types ─── */
type TabId = 'definition' | 'classification' | 'workflows' | 'execution-logic' | 'test-design' | 'usage' | 'change-history';

interface Props {
  control: ControlRow;
  onBack: () => void;
  onUpdate: (updated: ControlRow) => void;
}

/* ─── Severity styles ─── */
const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-risk-50 text-risk-700',
  high:     'bg-high-50 text-high-700',
  medium:   'bg-mitigated-50 text-mitigated-700',
  low:      'bg-compliant-50 text-compliant-700',
};

const EVIDENCE_TYPES: EvidenceType[] = ['PO', 'Invoice', 'GRN', 'Approval', 'System Log', 'Other'];

/* ─── Shared styles ─── */
const inputClass = 'w-full px-3 py-2 rounded-lg border border-canvas-border bg-white text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10 transition-all';
const labelClass = 'block text-[0.75rem] font-semibold text-ink-700 mb-1.5';

/* ─── Component ─── */
export default function ControlDetailView({ control, onBack, onUpdate }: Props) {
  const { addToast } = useToast();
  const { can } = useCan();
  const { openShare } = useShare();
  const logEvent = useAuditLog();
  const [activeTab, setActiveTab] = useState<TabId>('definition');
  const [showLinkDrawer, setShowLinkDrawer] = useState(false);
  const [showLinkDrawerFromAttrs, setShowLinkDrawerFromAttrs] = useState(false);
  const [riskSearch, setRiskSearch] = useState('');

  // Test Attributes state
  const [workflowAttributes, setWorkflowAttributes] = useState<Record<string, TestAttribute[]>>(() => {
    const initial: Record<string, TestAttribute[]> = {};
    for (const wfId of control.linkedWorkflowIds) {
      initial[wfId] = SEED_WORKFLOW_ATTRIBUTES[wfId] ? [...SEED_WORKFLOW_ATTRIBUTES[wfId]] : [];
    }
    return initial;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<TestAttribute | null>(null);
  const [draftVersionCreated, setDraftVersionCreated] = useState(false);

  // Change history — dynamic per control + live actions
  const [liveHistory, setLiveHistory] = useState<{ date: string; user: string; action: string }[]>([]);
  const seedHistory = CONTROL_HISTORY[control.controlId] || [{ date: control.createdAt, user: control.owner, action: 'Control created' }];
  const fullHistory = [...liveHistory, ...seedHistory];

  // Resolve enriched data
  const mappedRiskObjects = RISKS.filter(r => control.mappedRisks.includes(r.id));
  const linkedWorkflowObjects = WORKFLOWS.filter(w => control.linkedWorkflowIds.includes(w.id));

  // Real RACM mapping
  const controlRACMs = useMemo(() => {
    return RACMS.filter(racm => {
      const mapped = RACM_CONTROL_MAP[racm.id];
      return mapped && mapped.includes(control.controlId);
    });
  }, [control.controlId]);

  const statusStyle = STATUS_STYLES[control.status] || STATUS_STYLES['Draft'];
  const natureStyle = NATURE_STYLES[control.nature];
  const autoStyle = AUTOMATION_STYLES[control.automation];

  // Primary workflow
  const primaryWfId = control.linkedWorkflowIds[0] || null;
  const primaryWf = primaryWfId ? WORKFLOWS.find(w => w.id === primaryWfId) : null;
  const primaryAttributes = primaryWfId ? (workflowAttributes[primaryWfId] || []) : [];

  const totalAttrCount = useMemo(() => {
    return Object.values(workflowAttributes).reduce((sum, attrs) => sum + attrs.length, 0);
  }, [workflowAttributes]);

  // Next steps logic
  const hasWorkflow = control.linkedWorkflowIds.length > 0;
  const hasAttributes = totalAttrCount > 0;
  const canMarkReady = hasWorkflow && hasAttributes && control.status === 'Draft';
  const nextSteps: { label: string; desc: string; icon: React.ElementType; cls: string; action: () => void }[] = [];

  if (!hasWorkflow) {
    nextSteps.push({
      label: 'Link Workflow', desc: 'Define how this control will be tested',
      icon: Link2, cls: 'text-brand-700 border-brand/20 bg-brand-50/50 hover:bg-brand-50',
      action: () => { setActiveTab('execution-logic'); setTimeout(() => setShowLinkDrawer(true), 200); },
    });
  }
  if (hasWorkflow && !hasAttributes) {
    nextSteps.push({
      label: 'Add Test Conditions', desc: 'Define what evidence and criteria are validated',
      icon: ClipboardList, cls: 'text-evidence-700 border-evidence/20 bg-evidence-50/50 hover:bg-evidence-50',
      action: () => setActiveTab('test-design'),
    });
  }
  if (canMarkReady) {
    nextSteps.push({
      label: 'Mark Ready', desc: 'Workflow linked & attributes defined — ready for engagements',
      icon: CheckCircle2, cls: 'text-compliant-700 border-compliant/20 bg-compliant-50/50 hover:bg-compliant-50',
      action: () => handleMarkReady(),
    });
  }

  // Risk search
  const availableRisks = RISKS.filter(r => !control.mappedRisks.includes(r.id));
  const filteredAvailableRisks = availableRisks.filter(r => {
    if (!riskSearch) return true;
    const q = riskSearch.toLowerCase();
    return r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
  });

  // ── Handlers ──
  const addHistoryEntry = (action: string) => {
    setLiveHistory(prev => [{ date: 'Apr 26, 2026', user: control.owner, action }, ...prev]);
  };

  const handleAddRisk = (riskId: string) => {
    onUpdate({ ...control, mappedRisks: [...control.mappedRisks, riskId], updatedAt: 'Apr 26, 2026' });
    addHistoryEntry(`Mapped risk ${riskId}`);
    addToast({ message: `Risk ${riskId} mapped to ${control.controlId}`, type: 'success' });
    const risk = RISKS.find(r => r.id === riskId);
    logEvent({ action: 'Update', description: `Mapped risk "${risk?.name || riskId}" to control "${control.name}" (${control.controlId})`, module: 'Control Library', entity: 'Control' });
  };

  const handleRemoveRisk = (riskId: string) => {
    onUpdate({ ...control, mappedRisks: control.mappedRisks.filter(r => r !== riskId), updatedAt: 'Apr 26, 2026' });
    addHistoryEntry(`Removed risk mapping ${riskId}`);
    addToast({ message: `Risk ${riskId} removed from ${control.controlId}`, type: 'info' });
    const risk = RISKS.find(r => r.id === riskId);
    logEvent({ action: 'Update', description: `Unmapped risk "${risk?.name || riskId}" from control "${control.name}" (${control.controlId})`, module: 'Control Library', entity: 'Control' });
  };

  const handleLinkWorkflow = (workflowId: string, workflowName: string) => {
    const wasEmpty = control.linkedWorkflowIds.length === 0;
    const newStatus = wasEmpty && control.status === 'Draft' ? 'Active' : control.status;
    onUpdate({
      ...control,
      linkedWorkflowIds: [...control.linkedWorkflowIds, workflowId],
      linkedWorkflows: [...control.linkedWorkflows, workflowName],
      status: newStatus,
      updatedAt: 'Apr 26, 2026',
    });
    setWorkflowAttributes(prev => ({
      ...prev,
      [workflowId]: SEED_WORKFLOW_ATTRIBUTES[workflowId] ? [...SEED_WORKFLOW_ATTRIBUTES[workflowId]] : [],
    }));
    addHistoryEntry(`Linked workflow "${workflowName}"`);
    setShowLinkDrawer(false);
    setShowLinkDrawerFromAttrs(false);
    addToast({ message: `Workflow "${workflowName}" linked to ${control.controlId}`, type: 'success' });
    logEvent({ action: 'Update', description: `Linked workflow "${workflowName}" to control "${control.name}" (${control.controlId})`, module: 'Control Library', entity: 'Control' });
  };

  const handleUnlinkWorkflow = (workflowId: string, workflowName: string) => {
    const newIds = control.linkedWorkflowIds.filter(id => id !== workflowId);
    const newNames = control.linkedWorkflows.filter(n => n !== workflowName);
    onUpdate({
      ...control,
      linkedWorkflowIds: newIds,
      linkedWorkflows: newNames,
      status: newIds.length === 0 ? 'Draft' : control.status,
      updatedAt: 'Apr 26, 2026',
    });
    setWorkflowAttributes(prev => { const next = { ...prev }; delete next[workflowId]; return next; });
    addHistoryEntry(`Unlinked workflow "${workflowName}"`);
    addToast({ message: `Workflow "${workflowName}" unlinked`, type: 'info' });
    logEvent({ action: 'Update', description: `Unlinked workflow "${workflowName}" from control "${control.name}" (${control.controlId})`, module: 'Control Library', entity: 'Control' });
  };

  const handleMarkReady = () => {
    onUpdate({ ...control, status: 'Active', updatedAt: 'Apr 26, 2026' });
    addHistoryEntry('Marked control as Active');
    addToast({ message: `${control.controlId} marked as Active — available for engagement snapshots`, type: 'success' });
    logEvent({ action: 'Update', description: `Marked control "${control.name}" (${control.controlId}) Active`, module: 'Control Library', entity: 'Control' });
  };

  // Attribute handlers
  const ensureDraftVersion = () => {
    if (primaryWf?.status === 'active' && !draftVersionCreated) {
      setDraftVersionCreated(true);
      addToast({ message: 'Draft version v2 created. Published version unchanged.', type: 'info' });
    }
  };

  const handleSaveAttribute = (data: Omit<TestAttribute, 'id' | 'label'>) => {
    if (!primaryWfId) return;
    ensureDraftVersion();
    if (editingAttribute) {
      setWorkflowAttributes(prev => ({
        ...prev,
        [primaryWfId]: (prev[primaryWfId] || []).map(a => a.id === editingAttribute.id ? { ...a, ...data } : a),
      }));
      addHistoryEntry(`Updated attribute "${data.name}"`);
      addToast({ message: `Attribute "${data.name}" updated`, type: 'success' });
      logEvent({ action: 'Update', description: `Updated test attribute "${data.name}" on control "${control.name}" (${control.controlId})`, module: 'Control Library', entity: 'Test Attribute' });
    } else {
      const existing = workflowAttributes[primaryWfId] || [];
      const newId = `TA-${String(100 + existing.length + 1).padStart(3, '0')}`;
      setWorkflowAttributes(prev => ({
        ...prev,
        [primaryWfId]: [...(prev[primaryWfId] || []), { id: newId, label: newId, ...data }],
      }));
      addHistoryEntry(`Added attribute "${data.name}" to workflow`);
      addToast({ message: `Attribute "${data.name}" added`, type: 'success' });
      logEvent({ action: 'Create', description: `Added test attribute "${data.name}" to control "${control.name}" (${control.controlId})`, module: 'Control Library', entity: 'Test Attribute' });
    }
    setShowAddModal(false);
    setEditingAttribute(null);
  };

  const handleRemoveAttribute = (attrId: string) => {
    if (!primaryWfId) return;
    ensureDraftVersion();
    const attr = primaryAttributes.find(a => a.id === attrId);
    setWorkflowAttributes(prev => ({
      ...prev,
      [primaryWfId]: (prev[primaryWfId] || []).filter(a => a.id !== attrId),
    }));
    addHistoryEntry(`Removed attribute "${attr?.name || attrId}"`);
    addToast({ message: 'Attribute removed', type: 'info' });
    logEvent({ action: 'Delete', description: `Removed test attribute "${attr?.name || attrId}" from control "${control.name}" (${control.controlId})`, module: 'Control Library', entity: 'Test Attribute' });
  };

  /* ─── Tab definitions ─── */
  const tabs: { id: TabId; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'definition', label: 'Control Definition', icon: FileText },
    { id: 'classification', label: 'Classification', icon: Shield },
    { id: 'workflows', label: 'Workflows', icon: Workflow, count: control.linkedWorkflowIds.length || undefined },
    { id: 'execution-logic', label: 'Execution Logic', icon: Settings },
    { id: 'test-design', label: 'Test Design', icon: ClipboardList, count: totalAttrCount || undefined },
    { id: 'usage', label: 'Usage', icon: LayoutGrid, count: controlRACMs.length || undefined },
    { id: 'change-history', label: 'Change History', icon: History },
  ];

  /* ─── Render ─── */
  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
          <ArrowLeft size={14} />Back to Control Library
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-text mb-1.5">{control.name}</h1>
            <div className="flex items-center gap-2 text-[0.75rem] text-ink-500 mb-1">
              <span className="font-mono text-ink-400">Control ID: {control.controlId}</span>
              <span className="text-ink-300">|</span>
              <span>Type: {control.classification}</span>
              <span className="text-ink-300">|</span>
              <span>Nature: {control.nature}</span>
              <span className="text-ink-300">|</span>
              <span>Automation: {control.automation}</span>
            </div>
            <div className="text-[0.75rem] text-ink-400">
              Used in: {controlRACMs.length} RACM{controlRACMs.length !== 1 ? 's' : ''} · {control.linkedWorkflowIds.length} Workflow{control.linkedWorkflowIds.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {can('ctrl_share') && (
              <button
                onClick={(e) => { e.stopPropagation(); openShare({ type: 'control', id: control.id, anchor: rectFromEvent(e) }); }}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text-secondary hover:bg-white hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
              >
                <Share2 size={14} />Share
              </button>
            )}
            <button
              onClick={() => addToast({ message: `Editing ${control.name}`, type: 'info' })}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-[0.8125rem] text-text-secondary hover:bg-white transition-colors cursor-pointer"
            >
              <Pencil size={14} />Edit Control
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-border-light mb-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors cursor-pointer ${active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}>
                <Icon size={14} />{tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className={`text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>

            {/* ═══ CONTROL DEFINITION ═══ */}
            {activeTab === 'definition' && (
              <div className="space-y-6">
                {/* AI insight — the Layer-2 deep card, cost-gated. Same journey as the
                    engagement Controls tab: idle → Generate → full reasoning + fix.
                    Not passed a test result (the library holds definitions, not runs),
                    so it reads forward-looking; pricing-thread controls surface the
                    confirmed root-cause story. */}
                <InsightGenerator
                  layer="control"
                  subjectId={control.controlId}
                  subjectLabel={control.name}
                  isKey={control.classification === 'Key'}
                />

                {/* Description & Objective */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="glass-card p-5">
                    <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-2">Description</h3>
                    <p className="text-[0.8125rem] text-ink-700 leading-relaxed">{control.description || 'No description provided.'}</p>
                  </div>
                  <div className="glass-card p-5">
                    <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-2">Objective</h3>
                    <p className="text-[0.8125rem] text-ink-700 leading-relaxed">{control.objective || 'No objective defined.'}</p>
                  </div>
                </div>

                {/* Assertions */}
                <div className="glass-card p-5">
                  <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-3">Assertions</h3>
                  {control.assertions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {control.assertions.map(a => (<span key={a} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-canvas text-ink-700 text-[0.75rem] font-medium border border-canvas-border/60"><Check size={11} className="text-ink-400" />{ASSERTION_LABELS[a] || a}</span>))}
                    </div>
                  ) : <p className="text-[0.75rem] text-ink-400">No assertions defined.</p>}
                </div>

                {/* Details */}
                <div className="glass-card p-5">
                  <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-4">Details</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div><div className="text-[0.6875rem] text-ink-400 mb-1">Owner</div><div className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-700"><User size={13} className="text-ink-400" />{control.owner}</div></div>
                    <div><div className="text-[0.6875rem] text-ink-400 mb-1">Created</div><div className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-700"><Calendar size={13} className="text-ink-400" />{control.createdAt}</div></div>
                    <div><div className="text-[0.6875rem] text-ink-400 mb-1">Last Updated</div><div className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-700"><Calendar size={13} className="text-ink-400" />{control.updatedAt}</div></div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ CLASSIFICATION ═══ */}
            {activeTab === 'classification' && (
              <div className="space-y-6">
                <div className="glass-card p-5">
                  <div className="grid grid-cols-4 gap-6">
                    <div><div className="text-[0.6875rem] text-ink-400 mb-1">Importance</div><div className="text-[0.8125rem] font-semibold text-ink-800">{control.classification}</div></div>
                    <div><div className="text-[0.6875rem] text-ink-400 mb-1">Nature</div><div className="text-[0.8125rem] font-medium text-ink-700">{control.nature}</div></div>
                    <div><div className="text-[0.6875rem] text-ink-400 mb-1">Automation</div><div className="text-[0.8125rem] font-medium text-ink-700">{control.automation}</div></div>
                    <div><div className="text-[0.6875rem] text-ink-400 mb-1">Frequency</div><div className="text-[0.8125rem] font-medium text-ink-700">{control.frequency || '—'}</div></div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ WORKFLOWS ═══ */}
            {activeTab === 'workflows' && (() => {
              // Compute workflow status
              const wfStatus: 'No Workflow' | 'Partially Configured' | 'Ready' = (() => {
                if (linkedWorkflowObjects.length === 0) return 'No Workflow';
                const allAttrs = Object.values(workflowAttributes).flat();
                if (allAttrs.length === 0) return 'Partially Configured';
                // Check: every attribute is Active
                const activeAttrs = allAttrs.filter(a => a.status === 'Active');
                if (activeAttrs.length < allAttrs.length) return 'Partially Configured';
                return 'Ready';
              })();
              const wfStatusStyle = wfStatus === 'Ready' ? 'bg-compliant-50 text-compliant-700 border-compliant/20'
                : wfStatus === 'Partially Configured' ? 'bg-mitigated-50 text-mitigated-700 border-mitigated/20'
                : 'bg-risk-50 text-risk-700 border-risk/20';

              return (
              <div className="space-y-5">
                {/* Top status indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[0.8125rem] font-semibold text-ink-700">Workflow Status</span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.6875rem] font-semibold border ${wfStatusStyle}`}>
                      {wfStatus === 'Ready' && <CheckCircle2 size={12} />}
                      {wfStatus === 'Partially Configured' && <AlertTriangle size={12} />}
                      {wfStatus === 'No Workflow' && <X size={12} />}
                      {wfStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowLinkDrawer(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                      <Plus size={14} />Add Workflow
                    </button>
                  </div>
                </div>

                {/* Warning — no workflow */}
                {linkedWorkflowObjects.length === 0 && (
                  <div className="rounded-xl border border-risk/20 bg-risk-50/30 p-5 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-risk-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[0.8125rem] font-semibold text-risk-800 mb-0.5">No workflow linked</p>
                      <p className="text-[0.75rem] text-risk-600">This control cannot be tested until a workflow is added. Link an existing workflow or create a new one.</p>
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={() => setShowLinkDrawer(true)} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5"><Link2 size={12} />Link Existing Workflow</button>
                        <button onClick={() => addToast({ message: 'Opening Ask IRA to build a workflow for this control...', type: 'info' })} className="px-3 py-1.5 rounded-lg border border-border text-[0.75rem] text-text-secondary hover:bg-white cursor-pointer transition-colors flex items-center gap-1.5"><Zap size={12} />Create New Workflow</button>
                        <button onClick={() => addToast({ message: 'Workflow can be added later.', type: 'info' })} className="px-3 py-1.5 rounded-lg text-[0.75rem] text-ink-400 hover:text-ink-600 cursor-pointer transition-colors">Create Later</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Workflow table */}
                {linkedWorkflowObjects.length > 0 && (
                  <div className="border border-border-light rounded-xl overflow-hidden">
                    <table className="w-full text-[0.75rem]">
                      <thead className="bg-white border-b border-border-light">
                        <tr>
                          <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">Workflow Name</th>
                          <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted w-[140px]">Type</th>
                          <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted w-[250px]">Attributes Covered</th>
                          <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted w-[120px]">Status</th>
                          <th className="px-4 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted w-[140px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedWorkflowObjects.map(wf => {
                          const attrs = workflowAttributes[wf.id] || [];
                          const activeAttrs = attrs.filter(a => a.status === 'Active');
                          const wfRowStatus = attrs.length === 0 ? 'Missing Mapping' : activeAttrs.length < attrs.length ? 'Incomplete' : 'Ready';
                          const rowStatusStyle = wfRowStatus === 'Ready' ? 'bg-compliant-50 text-compliant-700'
                            : wfRowStatus === 'Incomplete' ? 'bg-mitigated-50 text-mitigated-700'
                            : 'bg-risk-50 text-risk-700';

                          return (
                            <tr key={wf.id} className="border-t border-border-light hover:bg-surface-2/40 transition-colors">
                              {/* Workflow Name — clickable */}
                              <td className="px-4 py-3.5 align-top">
                                <button onClick={() => addToast({ message: `Opening workflow "${wf.name}"`, type: 'info' })}
                                  className="text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 hover:underline cursor-pointer text-left">
                                  {wf.name}
                                </button>
                                <span className="text-[0.625rem] font-mono text-ink-400 block mt-0.5">{wf.id}</span>
                              </td>
                              {/* Type */}
                              <td className="px-4 py-3.5 align-top">
                                <div className="flex flex-wrap gap-1">
                                  <span className={`px-1.5 py-0.5 rounded text-[0.5625rem] font-bold ${wf.type === 'automated' ? 'bg-evidence-50 text-evidence-700' : 'bg-canvas text-ink-600'}`}>
                                    {wf.type === 'automated' ? 'Automated' : 'Manual'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold bg-surface-2 text-ink-600">
                                    {(wf as Record<string, unknown>).controlNature as string || 'Detective'}
                                  </span>
                                </div>
                              </td>
                              {/* Attributes Covered */}
                              <td className="px-4 py-3.5 align-top">
                                {attrs.length === 0 ? (
                                  <span className="text-[0.6875rem] text-ink-400 italic">No attributes mapped</span>
                                ) : (
                                  <div className="space-y-1">
                                    {attrs.map(attr => (
                                      <div key={attr.id} className="flex items-center gap-1.5 text-[0.6875rem]">
                                        {attr.status === 'Active' ? (
                                          <Check size={11} className="text-compliant-600 shrink-0" />
                                        ) : (
                                          <X size={11} className="text-risk-500 shrink-0" />
                                        )}
                                        <span className={attr.status === 'Active' ? 'text-ink-700' : 'text-ink-400'}>{attr.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              {/* Status */}
                              <td className="px-4 py-3.5 align-top">
                                <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${rowStatusStyle}`}>{wfRowStatus}</span>
                              </td>
                              {/* Actions */}
                              <td className="px-4 py-3.5 align-top text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => addToast({ message: `Opening workflow "${wf.name}"`, type: 'info' })}
                                    className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors" title="View">
                                    <Eye size={14} />
                                  </button>
                                  <button onClick={() => addToast({ message: `Replace workflow "${wf.name}"...`, type: 'info' })}
                                    className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors" title="Replace">
                                    <Repeat size={14} />
                                  </button>
                                  <button onClick={() => handleUnlinkWorkflow(wf.id, wf.name)}
                                    className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-risk-600 hover:bg-risk-50 cursor-pointer transition-colors" title="Remove">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Validation note */}
                {linkedWorkflowObjects.length > 0 && (
                  <div className="rounded-lg border border-canvas-border bg-canvas p-3 flex items-start gap-2.5">
                    <Info size={14} className="text-ink-400 mt-0.5 shrink-0" />
                    <div className="text-[0.75rem] text-ink-500">
                      <span className="font-semibold text-ink-600">Validation:</span> Every test attribute must be covered by at least one workflow. Multiple workflows can share attributes, and one workflow can cover multiple attributes.
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            {/* ═══ EXECUTION LOGIC ═══ */}
            {activeTab === 'execution-logic' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowLinkDrawer(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Link2 size={14} />Link Existing Workflow</button>
                  <button onClick={() => addToast({ message: 'Workflow builder will open with this control as context', type: 'info' })} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-[0.8125rem] text-text-secondary hover:bg-white transition-colors cursor-pointer"><Workflow size={14} />Create Workflow from Control</button>
                </div>
                {linkedWorkflowObjects.length === 0 ? (
                  <div className="glass-card p-8 text-center">
                    <Workflow size={32} className="mx-auto text-ink-300 mb-3" />
                    <p className="text-[0.875rem] font-semibold text-ink-600 mb-1">No workflows linked</p>
                    <p className="text-[0.75rem] text-ink-400">Link a workflow to define how this control will be tested during engagements.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {linkedWorkflowObjects.map((wf, i) => {
                      const attrCount = (workflowAttributes[wf.id] || []).length;
                      return (
                        <div key={wf.id} className="glass-card p-5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Workflow size={15} className="text-brand-600" />
                                <span className="text-[0.875rem] font-semibold text-ink-800">{wf.name}</span>
                                {i === 0 && <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-bold bg-brand-50 text-brand-700">PRIMARY</span>}
                                <span className={`px-2 py-0.5 rounded text-[0.625rem] font-bold uppercase ${wf.status === 'active' ? 'bg-compliant-50 text-compliant-700' : 'bg-canvas text-ink-600'}`}>{wf.status}</span>
                              </div>
                              <p className="text-[0.75rem] text-ink-500 mb-3">{wf.desc}</p>
                              <div className="grid grid-cols-5 gap-4 text-[0.75rem]">
                                <div><span className="text-ink-400">Type</span><div className="font-medium text-ink-700 mt-0.5">{wf.type}</div></div>
                                <div><span className="text-ink-400">Steps</span><div className="font-medium text-ink-700 mt-0.5">{wf.steps.length} steps</div></div>
                                <div><span className="text-ink-400">Attributes</span><div className="font-medium text-ink-700 mt-0.5">{attrCount}</div></div>
                                <div><span className="text-ink-400">Total Runs</span><div className="font-medium text-ink-700 mt-0.5">{wf.runs}</div></div>
                                <div><span className="text-ink-400">Last Run</span><div className="font-medium text-ink-700 mt-0.5">{wf.lastRun}</div></div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                              <button onClick={() => addToast({ message: `Opening workflow "${wf.name}"`, type: 'info' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.75rem] font-medium hover:bg-primary/20 transition-colors cursor-pointer"><ArrowRight size={12} />View Workflow</button>
                              <button onClick={() => handleUnlinkWorkflow(wf.id, wf.name)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-canvas-border text-[0.75rem] text-ink-500 hover:text-risk-700 hover:border-risk/30 hover:bg-risk-50 transition-colors cursor-pointer"><Unlink size={12} />Unlink</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="rounded-lg border border-canvas-border bg-canvas p-3 flex items-start gap-2.5">
                  <Shield size={14} className="text-ink-400 mt-0.5 shrink-0" />
                  <div className="text-[0.75rem] text-ink-500"><span className="font-semibold text-ink-600">Note:</span> Linking a workflow defines how this control will be tested. Execution happens within an engagement.</div>
                </div>
              </div>
            )}

            {/* ═══ TEST DESIGN ═══ */}
            {activeTab === 'test-design' && (
              <div className="space-y-5">
                {control.linkedWorkflowIds.length === 0 ? (
                  <div className="glass-card p-10 text-center">
                    <ClipboardList size={36} className="mx-auto text-ink-300 mb-3" />
                    <p className="text-[0.9375rem] font-semibold text-ink-600 mb-1">No workflow linked</p>
                    <p className="text-[0.8125rem] text-ink-400 mb-5 max-w-md mx-auto">Link or create a workflow to define test conditions. These describe what evidence and criteria are validated during testing.</p>
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => setShowLinkDrawerFromAttrs(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Link2 size={14} />Link Workflow</button>
                      <button onClick={() => addToast({ message: 'Workflow builder will open with this control as context', type: 'info' })} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-[0.8125rem] text-text-secondary hover:bg-white transition-colors cursor-pointer"><Workflow size={14} />Create Workflow</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-mitigated/30 bg-mitigated-50 p-3 flex items-start gap-2.5">
                      <Info size={14} className="text-mitigated-700 mt-0.5 shrink-0" />
                      <div className="text-[0.75rem] text-mitigated-700">Changes to attributes affect future engagements only. Existing engagement snapshots are not changed.</div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Workflow size={15} className="text-brand-600" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[0.8125rem] font-semibold text-ink-800">{primaryWf?.name}</span>
                              <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-bold bg-brand-50 text-brand-700">PRIMARY</span>
                              {draftVersionCreated ? (
                                <span className="px-2 py-0.5 rounded text-[0.625rem] font-bold bg-mitigated-50 text-mitigated-700">DRAFT v2</span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[0.625rem] font-bold uppercase ${primaryWf?.status === 'active' ? 'bg-compliant-50 text-compliant-700' : 'bg-canvas text-ink-600'}`}>
                                  {primaryWf?.status === 'active' ? 'PUBLISHED v1' : primaryWf?.status}
                                </span>
                              )}
                            </div>
                            <div className="text-[0.75rem] text-ink-400 mt-0.5">{primaryAttributes.length} attribute{primaryAttributes.length !== 1 ? 's' : ''} defined</div>
                          </div>
                        </div>
                        <button onClick={() => { setEditingAttribute(null); setShowAddModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Add Attribute</button>
                      </div>
                    </div>
                    {primaryWf?.status === 'active' && !draftVersionCreated && (
                      <div className="rounded-lg border border-canvas-border bg-canvas p-3 flex items-start gap-2.5">
                        <Lock size={13} className="text-ink-400 mt-0.5 shrink-0" />
                        <div className="text-[0.75rem] text-ink-500">This workflow is <span className="font-semibold text-ink-600">published</span>. Editing attributes will create a new draft version (v2) automatically.</div>
                      </div>
                    )}
                    {primaryAttributes.length === 0 ? (
                      <div className="glass-card p-8 text-center">
                        <ClipboardList size={28} className="mx-auto text-ink-300 mb-2" />
                        <p className="text-[0.8125rem] text-ink-500">No attributes defined yet.</p>
                        <p className="text-[0.75rem] text-ink-400 mt-0.5">Add attributes to define what is tested and what evidence is required.</p>
                      </div>
                    ) : (
                      <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-[0.75rem]">
                            <thead><tr className="bg-canvas border-b border-canvas-border">
                              <th className="px-4 py-2.5 text-left font-semibold text-ink-500" style={{ width: '80px' }}>ID</th>
                              <th className="px-4 py-2.5 text-left font-semibold text-ink-500">Attribute Name</th>
                              <th className="px-4 py-2.5 text-left font-semibold text-ink-500" style={{ width: '200px' }}>Expected Result</th>
                              <th className="px-4 py-2.5 text-center font-semibold text-ink-500" style={{ width: '90px' }}>Evidence</th>
                              <th className="px-4 py-2.5 text-center font-semibold text-ink-500" style={{ width: '100px' }}>Mandatory</th>
                              <th className="px-4 py-2.5 text-center font-semibold text-ink-500" style={{ width: '80px' }}>Status</th>
                              <th className="px-4 py-2.5 text-center font-semibold text-ink-500" style={{ width: '80px' }}>Action</th>
                            </tr></thead>
                            <tbody>
                              {primaryAttributes.map((attr, i) => (
                                <tr key={attr.id} className={`border-b border-canvas-border last:border-0 hover:bg-brand-50/30 transition-colors ${i % 2 === 1 ? 'bg-canvas/30' : ''}`}>
                                  <td className="px-4 py-3"><span className="font-mono text-[0.6875rem] text-ink-500">{attr.label}</span></td>
                                  <td className="px-4 py-3"><div className="font-medium text-ink-800">{attr.name}</div><div className="text-[0.75rem] text-ink-400 mt-0.5 line-clamp-1">{attr.description}</div></td>
                                  <td className="px-4 py-3"><div className="text-[0.75rem] text-ink-600 line-clamp-2">{attr.passCriteria}</div></td>
                                  <td className="px-4 py-3 text-center">{attr.evidenceRequired ? (<span className="inline-flex items-center gap-1 text-evidence-700 text-[0.6875rem] font-semibold"><Paperclip size={10} />{attr.evidenceType || 'Yes'}</span>) : <span className="text-[0.6875rem] text-ink-400">No</span>}</td>
                                  <td className="px-4 py-3 text-center">{attr.mandatory ? (<span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-bold bg-risk-50 text-risk-700">Required</span>) : (<span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-medium bg-canvas text-ink-500">Optional</span>)}</td>
                                  <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold ${attr.status === 'Active' ? 'bg-compliant-50 text-compliant-700' : 'bg-canvas text-ink-600'}`}><span className={`w-1.5 h-1.5 rounded-full ${attr.status === 'Active' ? 'bg-compliant' : 'bg-ink-400'}`} />{attr.status}</span></td>
                                  <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1">
                                    <button onClick={() => { setEditingAttribute(attr); setShowAddModal(true); }} title="Edit" className="p-1.5 rounded-md hover:bg-canvas text-ink-400 hover:text-ink-700 transition-colors cursor-pointer"><Pencil size={12} /></button>
                                    <button onClick={() => handleRemoveAttribute(attr.id)} title="Remove" className="p-1.5 rounded-md hover:bg-risk-50 text-ink-400 hover:text-risk-700 transition-colors cursor-pointer"><Trash2 size={12} /></button>
                                  </div></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══ USAGE ═══ */}
            {activeTab === 'usage' && (
              <div className="space-y-5">
                <div className="glass-card p-5">
                  <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-4">RACM Matrices Using This Control ({controlRACMs.length})</h3>
                  {controlRACMs.length === 0 ? (
                    <div className="text-center py-8">
                      <LayoutGrid size={28} className="mx-auto text-ink-300 mb-2" />
                      <p className="text-[0.8125rem] text-ink-500">This control is not used in any RACM yet.</p>
                      <p className="text-[0.75rem] text-ink-400 mt-0.5">Add it to a Risk & Control Matrix to track its usage.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {controlRACMs.map(racm => (
                        <div key={racm.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-canvas-border bg-white hover:bg-canvas transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono text-[0.6875rem] text-ink-500">{racm.id}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-bold uppercase ${racm.status === 'active' ? 'bg-compliant-50 text-compliant-700' : 'bg-canvas text-ink-600'}`}>{racm.status}</span>
                            </div>
                            <div className="text-[0.8125rem] font-medium text-ink-800">{racm.name}</div>
                          </div>
                          <div className="text-[0.6875rem] text-ink-400">{racm.fw}</div>
                          <div className="text-[0.6875rem] text-ink-400">{racm.owner}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ CHANGE HISTORY ═══ */}
            {activeTab === 'change-history' && (
              <div className="glass-card p-5">
                <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-4">Change History ({fullHistory.length})</h3>
                <div className="relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-canvas-border" />
                  <div className="space-y-4">
                    {fullHistory.map((entry, i) => (
                      <div key={i} className="flex items-start gap-4 relative">
                        <div className={`w-[15px] h-[15px] rounded-full bg-white border-2 shrink-0 mt-0.5 z-10 ${i < liveHistory.length ? 'border-brand-600' : 'border-brand-300'}`} />
                        <div className="flex-1">
                          <div className="text-[0.75rem] text-ink-800">{entry.action}</div>
                          <div className="flex items-center gap-3 mt-0.5 text-[0.6875rem] text-ink-400">
                            <span className="flex items-center gap-1"><User size={10} />{entry.user}</span>
                            <span className="flex items-center gap-1"><Calendar size={10} />{entry.date}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Link Workflow Drawer */}
      <AnimatePresence>
        {(showLinkDrawer || showLinkDrawerFromAttrs) && (
          <LinkWorkflowDrawer
            onClose={() => { setShowLinkDrawer(false); setShowLinkDrawerFromAttrs(false); }}
            onLink={handleLinkWorkflow}
            alreadyLinkedIds={control.linkedWorkflowIds}
          />
        )}
      </AnimatePresence>

      {/* Add / Edit Attribute Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AttributeModal
            existing={editingAttribute}
            onClose={() => { setShowAddModal(false); setEditingAttribute(null); }}
            onSave={handleSaveAttribute}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ Attribute Modal ═══ */
function AttributeModal({ existing, onClose, onSave }: {
  existing: TestAttribute | null; onClose: () => void; onSave: (data: Omit<TestAttribute, 'id' | 'label'>) => void;
}) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [evidenceRequired, setEvidenceRequired] = useState(existing?.evidenceRequired ?? true);
  const [evidenceType, setEvidenceType] = useState<EvidenceType | ''>(existing?.evidenceType || '');
  const [mandatory, setMandatory] = useState(existing?.mandatory ?? true);
  const [passCriteria, setPassCriteria] = useState(existing?.passCriteria || '');
  const [failureCriteria, setFailureCriteria] = useState(existing?.failureCriteria || '');
  const isValid = name.trim().length > 0 && passCriteria.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onSave({ name, description, evidenceRequired, evidenceType, mandatory, passCriteria, failureCriteria, status: existing?.status || 'Draft' });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[560px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between">
            <div>
              <h2 className="text-[1.125rem] font-semibold text-ink-900">{isEdit ? 'Edit Attribute' : 'Add Attribute'}</h2>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">Define a test condition for the linked workflow.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div><label className={labelClass}>Attribute Name <span className="text-risk">*</span></label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PO exists and is approved" className={inputClass} /></div>
            <div><label className={labelClass}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this attribute checks..." rows={2} className={inputClass + ' resize-none'} /></div>
            <div>
              <label className={labelClass}>Evidence Required</label>
              <div className="grid grid-cols-2 gap-3">
                {[true, false].map(v => (<button key={String(v)} onClick={() => { setEvidenceRequired(v); if (!v) setEvidenceType(''); }} className={`px-4 py-2.5 rounded-lg border text-[0.8125rem] font-medium transition-all cursor-pointer ${evidenceRequired === v ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{v ? 'Yes' : 'No'}</button>))}
              </div>
            </div>
            {evidenceRequired && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className={labelClass}>Evidence Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {EVIDENCE_TYPES.map(t => (<button key={t} onClick={() => setEvidenceType(evidenceType === t ? '' : t)} className={`px-3 py-2 rounded-lg border text-[0.75rem] font-medium transition-all cursor-pointer ${evidenceType === t ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{t}</button>))}
                </div>
              </motion.div>
            )}
            <div>
              <label className={labelClass}>Mandatory</label>
              <div className="grid grid-cols-2 gap-3">
                {[true, false].map(v => (<button key={String(v)} onClick={() => setMandatory(v)} className={`px-4 py-2.5 rounded-lg border text-[0.8125rem] font-medium transition-all cursor-pointer ${mandatory === v ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{v ? 'Yes — Required' : 'No — Optional'}</button>))}
              </div>
            </div>
            <div><label className={labelClass}>Pass Criteria <span className="text-risk">*</span></label><textarea value={passCriteria} onChange={e => setPassCriteria(e.target.value)} placeholder="Define what constitutes a pass..." rows={2} className={inputClass + ' resize-none'} /></div>
            <div><label className={labelClass}>Failure Criteria</label><textarea value={failureCriteria} onChange={e => setFailureCriteria(e.target.value)} placeholder="Define what constitutes a failure..." rows={2} className={inputClass + ' resize-none'} /></div>
          </div>
          <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
            <button onClick={handleSubmit} disabled={!isValid} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">{isEdit ? 'Save Changes' : 'Add Attribute'}</button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
