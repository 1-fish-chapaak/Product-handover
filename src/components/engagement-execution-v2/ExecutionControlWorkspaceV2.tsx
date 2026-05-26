// ─── Engagement Execution V2 — Control Workspace Drawer ──────────────────
// Right-side panel that opens when a control row is clicked.
// Dynamic steps based on control type (Automated / Manual / Hybrid).
// Step internals are placeholders — will be built in subsequent prompts.

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, ChevronRight, ChevronDown, Lock, Shield, FileText, AlertTriangle,
  CheckCircle2, Upload, FlaskConical, ClipboardCheck, Eye,
  Play, Layers, Settings, Workflow, Plus, Trash2, Database, Shuffle, Paperclip, Download,
  Send, RotateCcw, Link2, Loader2, ArrowLeft, Info, Clock,
} from 'lucide-react';
import type { ExecutionControl, Attribute, Assertion, WorkflowMapping, TestItem, AttributeResult, PopulationSnapshot, Evidence } from './types';
import { ControlExecStatus, AttrResult, AttrSource, SampleResult, ExecutionMode, ReviewStatus, WorkingPaperStatus, AttributeType } from './types';
import {
  EXEC_STATUS_DISPLAY, CONCLUSION_DISPLAY, CONTROL_TYPE_DISPLAY,
} from './executionState';
import {
  deriveControlType, deriveWorkflowCoverage, deriveNextAction, deriveNextStepId,
  deriveStepAvailability, deriveTestingProgress, deriveSampleResult, deriveControlConclusion,
  deriveEvidenceMatrixReadiness,
  type StepAvailability, type DerivedControlType,
} from './helpers';

// ─── Step Definition ──────────────────────────────────────────────────────

interface StepDef {
  id: string;
  label: string;
  icon: React.ElementType;
  availabilityKey: keyof StepAvailability;
}

// Unified steps for all control types — simplified flow
const EXECUTION_STEPS: StepDef[] = [
  { id: 'overview',       label: 'Overview',          icon: FileText,       availabilityKey: 'overview' },
  { id: 'request-pbc',    label: 'Request PBC',       icon: Send,           availabilityKey: 'requestPbc' },
  { id: 'samples',        label: 'Samples',           icon: FlaskConical,   availabilityKey: 'samples' },
  { id: 'attr-testing',   label: 'Attribute Testing', icon: ClipboardCheck, availabilityKey: 'attributeTesting' },
  { id: 'working-paper',  label: 'Working Paper',     icon: FileText,       availabilityKey: 'workingPaper' },
  { id: 'review',         label: 'Review',            icon: Eye,            availabilityKey: 'review' },
  { id: 'conclusion',     label: 'Conclusion',        icon: CheckCircle2,   availabilityKey: 'conclusion' },
  { id: 'audit-trail',    label: 'Audit Trail',       icon: Clock,          availabilityKey: 'auditTrail' },
];

function getStepsForType(_type: DerivedControlType): StepDef[] {
  return EXECUTION_STEPS;
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  ctrl: ExecutionControl;
  onClose: () => void;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  initialStepId?: string | null;
  onLaunchWorkflowBuilder?: (seedPrompt: string) => void;
  requestPbcEnabled?: boolean;
  /** When true, Samples tab becomes "Configure Samples" with population upload + sampling config */
  generateFromPopulation?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ExecutionControlWorkspaceV2({ ctrl, onClose, onUpdateControl, initialStepId, onLaunchWorkflowBuilder, requestPbcEnabled = true, generateFromPopulation = false }: Props) {
  const controlType = deriveControlType(ctrl);
  const coverage = deriveWorkflowCoverage(ctrl);
  const nextAction = deriveNextAction(ctrl);
  const availability = deriveStepAvailability(ctrl);
  const statusDisplay = EXEC_STATUS_DISPLAY[ctrl.execution.status];
  const typeDisplay = CONTROL_TYPE_DISPLAY[controlType];
  const conclusionDisplay = ctrl.execution.conclusion.value ? CONCLUSION_DISPLAY[ctrl.execution.conclusion.value] : null;

  const allSteps = getStepsForType(controlType);
  const steps = (requestPbcEnabled ? allSteps : allSteps.filter(s => s.id !== 'request-pbc'))
    .map(s => s.id === 'samples' && generateFromPopulation ? { ...s, label: 'Configure Samples' } : s);
  const [activeStepId, setActiveStepId] = useState(initialStepId || 'overview');

  // Sync when parent changes initialStepId (e.g., clicking a different action button)
  useEffect(() => {
    if (initialStepId) setActiveStepId(initialStepId);
  }, [initialStepId]);
  const activeStep = steps.find(s => s.id === activeStepId) || steps[0];
  const activeAvailability = availability[activeStep.availabilityKey];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mt-5 bg-white rounded-xl border border-border-light overflow-hidden">

      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-border-light">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[0.6875rem] font-mono text-gray-400">{ctrl.id.replace('exec-', '')}</span>
              <span className={`px-1.5 py-0.5 rounded text-[0.5625rem] font-bold ${typeDisplay.bg} ${typeDisplay.text}`}>{typeDisplay.label}</span>
              <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${statusDisplay.bg} ${statusDisplay.text}`}>{statusDisplay.label}</span>
              {conclusionDisplay && (
                <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${conclusionDisplay.bg} ${conclusionDisplay.text}`}>{conclusionDisplay.label}</span>
              )}
            </div>
            <h3 className="text-[0.9375rem] font-bold text-text truncate">{ctrl.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-[0.6875rem] text-text-muted">
              <span>{coverage.displayText}</span>
              {coverage.unmappedAttributes > 0 && (
                <span className="text-amber-600 flex items-center gap-0.5"><AlertTriangle size={10} />{coverage.unmappedAttributes} unmapped</span>
              )}
              <span className="text-gray-300">|</span>
              <span>Next: <strong className="text-primary">{nextAction}</strong></span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"><X size={16} /></button>
        </div>
      </div>

      {/* ── Step Tabs ── */}
      <div className="px-6 border-b border-border-light">
        <div className="flex gap-0 overflow-x-auto">
          {steps.map(step => {
            const stepAvail = availability[step.availabilityKey];
            const isActive = activeStepId === step.id;
            const isLocked = !stepAvail.enabled;
            const Icon = step.icon;
            return (
              <button key={step.id}
                onClick={() => setActiveStepId(step.id)}
                disabled={false}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[0.6875rem] font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-primary text-primary'
                    : isLocked
                      ? 'border-transparent text-gray-400'
                      : 'border-transparent text-text-muted hover:text-text-secondary hover:border-gray-200'
                }`}>
                {isLocked ? <Lock size={11} className="shrink-0" /> : <Icon size={11} className="shrink-0" />}
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Step Content ── */}
      <div className="px-6 py-5" style={{ minHeight: 300 }}>
        {activeStepId === 'overview' ? (
          <OverviewStep ctrl={ctrl} controlType={controlType} coverage={coverage} nextAction={nextAction} onNavigate={setActiveStepId} onUpdateControl={onUpdateControl} />
        ) : activeStepId === 'request-pbc' && activeAvailability.enabled ? (
          <RequestPBCStep ctrl={ctrl} onNavigate={setActiveStepId} />
        ) : activeStepId === 'samples' && activeAvailability.enabled && generateFromPopulation ? (
          <ConfigureSamplesStep ctrl={ctrl} onUpdateControl={onUpdateControl} onNavigate={setActiveStepId} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} />
        ) : activeStepId === 'samples' && activeAvailability.enabled ? (
          <UnifiedSamplesStep ctrl={ctrl} controlType={controlType} onUpdateControl={onUpdateControl} onNavigate={setActiveStepId} />
        ) : activeStepId === 'attr-testing' && activeAvailability.enabled ? (
          <AttributeTestingStep ctrl={ctrl} onUpdateControl={onUpdateControl} onNavigate={setActiveStepId} />
        ) : activeStepId === 'working-paper' && activeAvailability.enabled ? (
          <WorkingPaperStep ctrl={ctrl} controlType={controlType} onNavigate={setActiveStepId} />
        ) : activeStepId === 'review' && activeAvailability.enabled ? (
          <ReviewStep ctrl={ctrl} onUpdateControl={onUpdateControl} onNavigate={setActiveStepId} />
        ) : activeStepId === 'conclusion' && activeAvailability.enabled ? (
          <ConclusionStep ctrl={ctrl} onNavigate={setActiveStepId} />
        ) : activeStepId === 'audit-trail' ? (
          <AuditTrailStep ctrl={ctrl} />
        ) : !activeAvailability.enabled ? (
          <LockedStep step={activeStep} reason={activeAvailability.reason} steps={steps} availability={availability} onNavigate={setActiveStepId} />
        ) : (
          <PlaceholderStep step={activeStep} />
        )}
      </div>
    </motion.div>
  );
}

// ─── Overview Step ────────────────────────────────────────────────────────

function OverviewStep({ ctrl, controlType, coverage, nextAction, onNavigate, onUpdateControl }: {
  ctrl: ExecutionControl;
  controlType: DerivedControlType;
  coverage: ReturnType<typeof deriveWorkflowCoverage>;
  nextAction: string;
  onNavigate: (stepId: string) => void;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
}) {
  const [showAddAssertion, setShowAddAssertion] = useState(false);
  const [newAssertionName, setNewAssertionName] = useState('');
  const [addAttrAssertionId, setAddAttrAssertionId] = useState<string | null>(null);
  const [attrName, setAttrName] = useState('');
  const [attrDesc, setAttrDesc] = useState('');
  const [attrType, setAttrType] = useState<'AUTOMATED' | 'MANUAL'>('MANUAL');
  const [attrRequired, setAttrRequired] = useState(true);
  const [attrEvTypes, setAttrEvTypes] = useState<string[]>([]);
  const [attrWfId, setAttrWfId] = useState('');
  const [linkAttrId, setLinkAttrId] = useState<string | null>(null);
  const [linkWfId, setLinkWfId] = useState('');
  const [showAddWorkflow, setShowAddWorkflow] = useState(false);
  const [newWfName, setNewWfName] = useState('');
  const [newWfVersion, setNewWfVersion] = useState('v1.0');
  const [newWfType, setNewWfType] = useState<'AUTOMATED' | 'MANUAL'>('AUTOMATED');
  const [newWfAttrIds, setNewWfAttrIds] = useState<Set<string>>(new Set());

  const fieldCls = 'w-full px-2.5 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white outline-none focus:border-primary/40 transition-all';
  const EV_TYPES = ['Invoice Copy', 'PO Copy', 'GRN Copy', 'Approval Log', 'Budget File', 'Historical Spend Report', 'Project Plan', 'System Report', 'Other'];

  // Group attributes by assertion
  const assertionGroups: { assertion: Assertion; attrs: Attribute[] }[] = [];
  for (const asr of ctrl.assertions) {
    assertionGroups.push({ assertion: asr, attrs: ctrl.attributes.filter(a => a.assertionId === asr.id) });
  }

  // Handlers
  const handleAddAssertion = () => {
    if (!newAssertionName.trim()) return;
    if (ctrl.assertions.some(a => a.name.toLowerCase() === newAssertionName.trim().toLowerCase())) return;
    const id = `asr-${Date.now()}`;
    onUpdateControl(prev => ({ ...prev, assertions: [...prev.assertions, { id, name: newAssertionName.trim() }] }));
    setNewAssertionName(''); setShowAddAssertion(false);
  };

  const handleAddAttribute = () => {
    if (!attrName.trim() || !addAttrAssertionId) return;
    const asr = ctrl.assertions.find(a => a.id === addAttrAssertionId);
    if (!asr) return;
    const id = `attr-${Date.now()}`;
    const newAttr: Attribute = {
      id, name: attrName.trim(), description: attrDesc, assertionId: asr.id, assertionName: asr.name,
      type: attrType as any, scope: 'SAMPLE_BASED' as const, required: attrRequired, requiredEvidenceTypes: attrEvTypes, workflowId: attrWfId || undefined,
    };
    onUpdateControl(prev => {
      const updated = { ...prev, attributes: [...prev.attributes, newAttr] };
      if (attrWfId) {
        updated.workflowMappings = updated.workflowMappings.map(wm =>
          wm.workflowId === attrWfId ? { ...wm, mappedAttributeIds: [...wm.mappedAttributeIds, id] } : wm
        );
      }
      return updated;
    });
    setAttrName(''); setAttrDesc(''); setAttrType('MANUAL'); setAttrRequired(true); setAttrEvTypes([]); setAttrWfId(''); setAddAttrAssertionId(null);
  };

  const handleLinkWorkflow = () => {
    if (!linkAttrId) return;
    const attr = ctrl.attributes.find(a => a.id === linkAttrId);
    if (!attr) return;
    onUpdateControl(prev => {
      let updated = { ...prev };
      // Remove from old workflow
      if (attr.workflowId) {
        updated.workflowMappings = updated.workflowMappings.map(wm =>
          wm.workflowId === attr.workflowId ? { ...wm, mappedAttributeIds: wm.mappedAttributeIds.filter(id => id !== linkAttrId) } : wm
        );
      }
      // Update attribute
      updated.attributes = updated.attributes.map(a => a.id === linkAttrId ? { ...a, workflowId: linkWfId || undefined } : a);
      // Add to new workflow
      if (linkWfId) {
        updated.workflowMappings = updated.workflowMappings.map(wm =>
          wm.workflowId === linkWfId ? { ...wm, mappedAttributeIds: [...wm.mappedAttributeIds.filter(id => id !== linkAttrId), linkAttrId!] } : wm
        );
      }
      return updated;
    });
    setLinkAttrId(null); setLinkWfId('');
  };

  const handleAddWorkflow = () => {
    if (!newWfName.trim()) return;
    const wfId = `wf-${Date.now()}`;
    const mapping: WorkflowMapping = { workflowId: wfId, workflowName: newWfName.trim(), version: newWfVersion, status: 'ACTIVE', mappedAttributeIds: [...newWfAttrIds] };
    onUpdateControl(prev => {
      let updated = { ...prev, workflowMappings: [...prev.workflowMappings, mapping] };
      updated.attributes = updated.attributes.map(a => newWfAttrIds.has(a.id) ? { ...a, workflowId: wfId } : a);
      return updated;
    });
    setNewWfName(''); setNewWfVersion('v1.0'); setNewWfType('AUTOMATED'); setNewWfAttrIds(new Set()); setShowAddWorkflow(false);
  };

  const totalAttrs = ctrl.attributes.length;
  const automatedAttrs = ctrl.attributes.filter(a => a.type === 'AUTOMATED').length;
  const requiredAttrs = ctrl.attributes.filter(a => a.required).length;
  const mappedAttrs = ctrl.attributes.filter(a => a.workflowId).length;

  return (
    <div className="space-y-5">
      {/* ═══ Control Summary Card ═══ */}
      <div className="rounded-xl border border-border-light bg-white p-5">
        <div className="flex items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[0.625rem] font-mono text-gray-400">{ctrl.id}</span>
              <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-semibold ${ctrl.importanceClass === 'KEY' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{ctrl.importanceClass === 'KEY' ? 'Key Control' : 'Non-Key'}</span>
              <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-semibold ${ctrl.natureClass === 'PREVENTIVE' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{ctrl.natureClass.charAt(0) + ctrl.natureClass.slice(1).toLowerCase()}</span>
              <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-semibold ${controlType === 'Automated' ? 'bg-emerald-50 text-emerald-700' : controlType === 'Hybrid' ? 'bg-evidence-50 text-evidence-700' : 'bg-gray-100 text-gray-600'}`}>{controlType.charAt(0) + controlType.slice(1).toLowerCase()}</span>
            </div>
            <p className="text-[0.75rem] text-text-secondary leading-relaxed mb-3">{ctrl.description}</p>
            <div className="flex items-center gap-4 text-[0.6875rem]">
              <span className="text-gray-400">Process: <span className="text-text font-medium">{ctrl.process}</span></span>
              <span className="text-gray-400">Owner: <span className="text-text font-medium">{ctrl.owner}</span></span>
            </div>
          </div>
          {/* Next Action */}
          <div className="shrink-0 rounded-lg border border-primary/15 bg-primary/5 p-3 text-center min-w-[140px]">
            <span className="text-[0.5625rem] text-primary/60 font-medium uppercase tracking-wider block mb-0.5">Next Step</span>
            <span className="text-[0.75rem] font-semibold text-primary block mb-2">{nextAction}</span>
            <button onClick={() => onNavigate(deriveNextStepId(nextAction))}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.625rem] font-semibold cursor-pointer transition-colors w-full">
              Go <ChevronRight size={10} className="inline" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Testing Structure Summary ═══ */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Assertions', value: ctrl.assertions.length, color: 'text-text' },
          { label: 'Attributes', value: totalAttrs, color: 'text-text' },
          { label: 'Linked Workflows', value: coverage.linkedWorkflowCount, color: coverage.linkedWorkflowCount > 0 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'Mapped to Workflow', value: `${mappedAttrs}/${totalAttrs}`, color: mappedAttrs === totalAttrs && totalAttrs > 0 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'Automated', value: `${automatedAttrs}/${totalAttrs}`, color: automatedAttrs > 0 ? 'text-emerald-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light bg-white p-2.5 text-center">
            <div className={`text-[1rem] font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[0.5625rem] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ Explanation Strip ═══ */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/40 border border-blue-100/50 text-[0.625rem] text-blue-600">
        <Info size={11} className="shrink-0 mt-0.5" />
        <span>Assertions define what this control proves. Attributes are the testable checks. Workflows automate or support the attribute testing.</span>
      </div>

      {/* ═══ Assertions & Attributes ═══ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[0.75rem] font-bold text-text flex items-center gap-1.5">
            <Shield size={12} className="text-primary" />Assertions & Attributes
          </h4>
          <button onClick={() => setShowAddAssertion(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[0.625rem] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors"><Plus size={10} />Add Assertion</button>
        </div>

        {/* Add Assertion Inline Form */}
        {showAddAssertion && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mb-3 space-y-2">
            <input value={newAssertionName} onChange={e => setNewAssertionName(e.target.value)} placeholder="e.g. Accuracy, Completeness, Authorization" className={fieldCls} autoFocus />
            {ctrl.assertions.some(a => a.name.toLowerCase() === newAssertionName.trim().toLowerCase()) && newAssertionName.trim() && (
              <span className="text-[0.5625rem] text-red-500">Assertion already exists</span>
            )}
            <div className="flex gap-1.5">
              <button onClick={handleAddAssertion} disabled={!newAssertionName.trim() || ctrl.assertions.some(a => a.name.toLowerCase() === newAssertionName.trim().toLowerCase())}
                className="px-2.5 py-1 rounded bg-primary text-white text-[0.625rem] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
              <button onClick={() => { setShowAddAssertion(false); setNewAssertionName(''); }} className="px-2.5 py-1 rounded border border-border text-[0.625rem] text-gray-500 cursor-pointer">Cancel</button>
            </div>
          </div>
        )}

        {/* Assertion Groups */}
        <div className="space-y-3">
          {assertionGroups.map(group => (
            <div key={group.assertion.id} className="rounded-xl border border-border-light overflow-hidden">
              <div className="px-4 py-2.5 bg-surface-2/30 border-b border-border-light flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center"><Shield size={11} className="text-primary" /></div>
                  <span className="text-[0.6875rem] font-bold text-text">{group.assertion.name}</span>
                  <span className="text-[0.625rem] text-gray-400">{group.attrs.length} attribute{group.attrs.length !== 1 ? 's' : ''}</span>
                </div>
                <button onClick={() => { setAddAttrAssertionId(group.assertion.id); setAttrName(''); setAttrDesc(''); setAttrType('MANUAL'); setAttrRequired(true); setAttrEvTypes([]); setAttrWfId(''); }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.5625rem] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors"><Plus size={9} />Add Attribute</button>
              </div>
              <div className="divide-y divide-border-light/50">
                {group.attrs.length === 0 && (
                  <div className="px-3 py-3 text-[0.625rem] text-gray-400 italic">No attributes added yet.</div>
                )}
                {group.attrs.map(attr => {
                  const wm = ctrl.workflowMappings.find(w => w.mappedAttributeIds.includes(attr.id));
                  const isLinking = linkAttrId === attr.id;
                  return (
                    <div key={attr.id} className="px-4 py-2.5">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[0.75rem] font-medium text-text">{attr.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${attr.type === 'AUTOMATED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                              {attr.type === 'AUTOMATED' ? 'Automated' : 'Manual'}
                            </span>
                          </div>
                          {attr.description && <p className="text-[0.625rem] text-gray-500 mb-1">{attr.description}</p>}
                          {wm ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-[0.625rem] text-emerald-700 font-medium">
                              <Workflow size={10} className="shrink-0" />Linked: {wm.workflowName} <span className="text-emerald-500">{wm.version}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-[0.625rem] text-amber-700 font-medium">
                              <AlertTriangle size={9} className="shrink-0" />No workflow linked
                            </span>
                          )}
                        </div>
                        <button onClick={() => { setLinkAttrId(attr.id); setLinkWfId(attr.workflowId || ''); }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.5625rem] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors shrink-0" title="Link Workflow"><Link2 size={10} />{wm ? 'Change' : 'Link'}</button>
                      </div>
                      {/* Inline Link Workflow */}
                      {isLinking && (
                        <div className="mt-2 rounded border border-primary/20 bg-primary/5 p-2 flex items-center gap-2">
                          <select value={linkWfId} onChange={e => setLinkWfId(e.target.value)} className="flex-1 px-2 py-1 border border-border rounded text-[0.625rem] bg-white outline-none cursor-pointer">
                            <option value="">No workflow</option>
                            {ctrl.workflowMappings.map(w => <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>)}
                          </select>
                          <button onClick={handleLinkWorkflow} className="px-2 py-1 rounded bg-primary text-white text-[0.5625rem] font-semibold cursor-pointer">Save</button>
                          <button onClick={() => setLinkAttrId(null)} className="px-2 py-1 rounded border border-border text-[0.5625rem] text-gray-500 cursor-pointer">Cancel</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Add Attribute Inline Form */}
              {addAttrAssertionId === group.assertion.id && (
                <div className="px-3 py-3 border-t border-border-light bg-surface-2/20 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={attrName} onChange={e => setAttrName(e.target.value)} placeholder="Attribute name *" className={fieldCls} autoFocus />
                    <select value={attrType} onChange={e => setAttrType(e.target.value as any)} className={fieldCls + ' cursor-pointer'}>
                      <option value="MANUAL">Manual</option>
                      <option value="AUTOMATED">Automated</option>
                    </select>
                  </div>
                  <input value={attrDesc} onChange={e => setAttrDesc(e.target.value)} placeholder="Description" className={fieldCls} />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[0.625rem] cursor-pointer">
                      <input type="checkbox" checked={attrRequired} onChange={e => setAttrRequired(e.target.checked)} className="w-3 h-3 accent-primary cursor-pointer" />Required
                    </label>
                    <select value={attrWfId} onChange={e => setAttrWfId(e.target.value)} className="flex-1 px-2 py-1 border border-border rounded text-[0.625rem] bg-white outline-none cursor-pointer">
                      <option value="">No workflow yet</option>
                      {ctrl.workflowMappings.map(w => <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={handleAddAttribute} disabled={!attrName.trim()}
                      className="px-2.5 py-1 rounded bg-primary text-white text-[0.625rem] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Add Attribute</button>
                    <button onClick={() => setAddAttrAssertionId(null)} className="px-2.5 py-1 rounded border border-border text-[0.625rem] text-gray-500 cursor-pointer">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {assertionGroups.length === 0 && !showAddAssertion && (
            <div className="text-[0.6875rem] text-gray-400 italic">No assertions defined. Add an assertion to start.</div>
          )}
        </div>

        {/* Unmapped warning */}
        {coverage.unmappedAttributes > 0 && (
          <div className="mt-2 rounded-lg border border-amber-200/40 bg-amber-50/20 p-2 flex items-center gap-2 text-[0.625rem] text-amber-700">
            <AlertTriangle size={10} />{coverage.unmappedAttributes} attribute{coverage.unmappedAttributes !== 1 ? 's are' : ' is'} not mapped to workflows.
          </div>
        )}
      </div>

      {/* ═══ Linked Workflows ═══ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[0.75rem] font-bold text-text flex items-center gap-1.5">
            <Workflow size={12} className="text-primary" />Linked Workflows ({coverage.linkedWorkflowCount})
          </h4>
          <button onClick={() => setShowAddWorkflow(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[0.625rem] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors"><Plus size={10} />Add Workflow</button>
        </div>

        {/* Add Workflow Form */}
        {showAddWorkflow && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mb-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input value={newWfName} onChange={e => setNewWfName(e.target.value)} placeholder="Workflow name *" className={fieldCls} autoFocus />
              <input value={newWfVersion} onChange={e => setNewWfVersion(e.target.value)} placeholder="Version" className={fieldCls} />
              <select value={newWfType} onChange={e => setNewWfType(e.target.value as any)} className={fieldCls + ' cursor-pointer'}>
                <option value="AUTOMATED">Automated</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
            <div>
              <span className="text-[0.5625rem] text-gray-500 block mb-1">Map attributes to this workflow:</span>
              <div className="flex flex-wrap gap-1.5">
                {ctrl.attributes.map(a => (
                  <label key={a.id} className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer text-[0.5625rem] transition-colors ${newWfAttrIds.has(a.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border-light text-gray-500 hover:border-primary/30'}`}>
                    <input type="checkbox" checked={newWfAttrIds.has(a.id)} onChange={() => setNewWfAttrIds(prev => { const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}
                      className="w-3 h-3 accent-primary cursor-pointer" />{a.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={handleAddWorkflow} disabled={!newWfName.trim()}
                className="px-2.5 py-1 rounded bg-primary text-white text-[0.625rem] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Add Workflow</button>
              <button onClick={() => { setShowAddWorkflow(false); setNewWfName(''); setNewWfAttrIds(new Set()); }} className="px-2.5 py-1 rounded border border-border text-[0.625rem] text-gray-500 cursor-pointer">Cancel</button>
            </div>
          </div>
        )}

        {ctrl.workflowMappings.length === 0 && !showAddWorkflow ? (
          <div className="rounded-lg border border-amber-200/40 bg-amber-50/20 p-3 flex items-center gap-2 text-[0.6875rem] text-amber-700">
            <AlertTriangle size={12} />No workflows mapped. Add a workflow to define how attributes are tested.
          </div>
        ) : ctrl.workflowMappings.length > 0 && (
          <div className="rounded-lg border border-border-light overflow-hidden">
            <table className="w-full text-[0.6875rem]">
              <thead><tr className="border-b border-border-light bg-surface-2/30">
                <th className="px-3 py-1.5 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Workflow</th>
                <th className="px-3 py-1.5 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Version</th>
                <th className="px-3 py-1.5 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Status</th>
                <th className="px-3 py-1.5 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Attributes Covered</th>
                <th className="px-3 py-1.5 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Assertions</th>
              </tr></thead>
              <tbody>
                {ctrl.workflowMappings.map(wm => {
                  const mappedAttrs = ctrl.attributes.filter(a => wm.mappedAttributeIds.includes(a.id));
                  const assertions = [...new Set(mappedAttrs.map(a => a.assertionName))];
                  return (
                    <tr key={wm.workflowId} className="border-b border-border-light/50">
                      <td className="px-3 py-1.5"><span className="text-text font-medium flex items-center gap-1.5"><Workflow size={10} className="text-primary shrink-0" />{wm.workflowName}</span></td>
                      <td className="px-3 py-1.5 text-gray-500">{wm.version}</td>
                      <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${wm.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{wm.status}</span></td>
                      <td className="px-3 py-1.5 text-gray-500">{mappedAttrs.length > 0 ? mappedAttrs.map(a => a.name).join(', ') : '—'}</td>
                      <td className="px-3 py-1.5"><div className="flex flex-wrap gap-0.5">{assertions.map(a => <span key={a} className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[0.4375rem] font-bold">{a}</span>)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Next Action */}
      <div className="flex items-center justify-end">
        <button onClick={() => onNavigate(deriveNextStepId(nextAction))}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
          {nextAction} <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Population Step (Automated / Hybrid Controls) ────────────────────────

// Demo population rows per control
const DEMO_POP_C002: Record<string, unknown>[] = [
  { invoiceId: 'INV-10201', poNumber: 'PO-4501', vendor: 'Acme Supplies Ltd', poAmount: 125000, grnQuantity: 500, invoiceAmount: 125000, approvalStatus: 'Approved' },
  { invoiceId: 'INV-10202', poNumber: 'PO-4502', vendor: 'Global Parts Inc', poAmount: 89500, grnQuantity: 200, invoiceAmount: 89500, approvalStatus: 'Approved' },
  { invoiceId: 'INV-10203', poNumber: 'PO-4503', vendor: 'TechVendor Co', poAmount: 234000, grnQuantity: 1200, invoiceAmount: 233800, approvalStatus: 'Pending' },
  { invoiceId: 'INV-10204', poNumber: 'PO-4504', vendor: 'Acme Supplies Ltd', poAmount: 67200, grnQuantity: 300, invoiceAmount: 67200, approvalStatus: 'Approved' },
  { invoiceId: 'INV-10205', poNumber: 'PO-4505', vendor: 'Office World', poAmount: 15800, grnQuantity: 50, invoiceAmount: 15800, approvalStatus: 'Approved' },
  { invoiceId: 'INV-10206', poNumber: 'PO-4506', vendor: 'Global Parts Inc', poAmount: 178000, grnQuantity: 800, invoiceAmount: 178200, approvalStatus: 'Approved' },
  { invoiceId: 'INV-10207', poNumber: 'PO-4507', vendor: 'RawMat Industries', poAmount: 456000, grnQuantity: 2000, invoiceAmount: 456000, approvalStatus: 'Approved' },
  { invoiceId: 'INV-10208', poNumber: 'PO-4508', vendor: 'TechVendor Co', poAmount: 92100, grnQuantity: 400, invoiceAmount: 92100, approvalStatus: 'Approved' },
  { invoiceId: 'INV-10209', poNumber: 'PO-4509', vendor: 'Office World', poAmount: 8400, grnQuantity: 25, invoiceAmount: 8400, approvalStatus: 'Approved' },
  { invoiceId: 'INV-10210', poNumber: 'PO-4510', vendor: 'Acme Supplies Ltd', poAmount: 310000, grnQuantity: 1500, invoiceAmount: 310000, approvalStatus: 'Approved' },
];

const DEMO_POP_C003: Record<string, unknown>[] = [
  { invoiceId: 'INV-10201', vendor: 'Acme Supplies Ltd', amount: 125000, invoiceDate: '2025-11-15', duplicateFlag: false, overrideApproved: false },
  { invoiceId: 'INV-10202', vendor: 'Global Parts Inc', amount: 89500, invoiceDate: '2025-11-18', duplicateFlag: false, overrideApproved: false },
  { invoiceId: 'INV-10203', vendor: 'TechVendor Co', amount: 234000, invoiceDate: '2025-12-01', duplicateFlag: true, overrideApproved: true },
  { invoiceId: 'INV-10204', vendor: 'Acme Supplies Ltd', amount: 125000, invoiceDate: '2025-12-05', duplicateFlag: true, overrideApproved: false },
  { invoiceId: 'INV-10205', vendor: 'Office World', amount: 15800, invoiceDate: '2025-12-10', duplicateFlag: false, overrideApproved: false },
  { invoiceId: 'INV-10206', vendor: 'Global Parts Inc', amount: 89500, invoiceDate: '2025-12-12', duplicateFlag: true, overrideApproved: true },
  { invoiceId: 'INV-10207', vendor: 'RawMat Industries', amount: 456000, invoiceDate: '2026-01-08', duplicateFlag: false, overrideApproved: false },
  { invoiceId: 'INV-10208', vendor: 'TechVendor Co', amount: 92100, invoiceDate: '2026-01-15', duplicateFlag: false, overrideApproved: false },
];

function getDemoPopulation(ctrlId: string): Record<string, unknown>[] {
  if (ctrlId === 'exec-c002') return DEMO_POP_C002;
  if (ctrlId === 'exec-c003') return DEMO_POP_C003;
  // Default fallback for any automated/hybrid
  return DEMO_POP_C002;
}

function PopulationStep({ ctrl, onUpdateControl, onNavigate }: {
  ctrl: ExecutionControl;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
}) {
  const pop = ctrl.execution.population;
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null);

  // State 3: Locked
  if (pop && pop.locked) {
    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-[0.875rem] font-bold text-text mb-1">Population Snapshot Locked</h4>
          <p className="text-[0.75rem] text-text-muted">The population dataset is locked and ready for test item generation.</p>
        </div>

        <div className="rounded-lg border border-emerald-200/50 bg-emerald-50/20 p-4 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-2 text-[0.75rem]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <div><span className="text-gray-500">Snapshot ID:</span> <span className="font-mono text-text">{pop.id}</span></div>
              <div><span className="text-gray-500">Source:</span> <span className="text-text">{pop.source}</span></div>
              <div><span className="text-gray-500">Row Count:</span> <span className="text-text font-medium tabular-nums">{pop.rowCount}</span></div>
              <div><span className="text-gray-500">Test Unit:</span> <span className="text-text">{pop.testUnit}</span></div>
              <div><span className="text-gray-500">Locked At:</span> <span className="text-text">{pop.lockedAt}</span></div>
              <div><span className="text-gray-500">Checksum:</span> <span className="font-mono text-gray-400 text-[0.625rem]">{pop.checksum}</span></div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-center justify-between">
          <span className="text-[0.6875rem] text-primary">Population snapshot locked. Next: choose execution mode.</span>
          <button onClick={() => onNavigate('execution-mode')}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">
            Execution Mode<ChevronRight size={10} />
          </button>
        </div>
      </div>
    );
  }

  // State 2: Preview (rows loaded but not locked)
  if (previewRows) {
    const columns = Object.keys(previewRows[0] || {});
    const previewSlice = previewRows.slice(0, 5);

    const handleLock = () => {
      const snapshot: PopulationSnapshot = {
        id: `POP-${Date.now().toString(36).toUpperCase()}`,
        source: 'Demo Dataset',
        rows: previewRows,
        rowCount: previewRows.length,
        locked: true,
        lockedAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        checksum: `sha256:${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`,
        testUnit: 'Transaction',
      };
      onUpdateControl(prev => ({
        ...prev,
        execution: { ...prev.execution, population: snapshot, status: ControlExecStatus.POPULATION_READY },
      }));
    };

    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-[0.875rem] font-bold text-text mb-1">Population Preview</h4>
          <p className="text-[0.75rem] text-text-muted">{previewRows.length} rows loaded. Review and lock the snapshot to proceed.</p>
        </div>

        <div className="rounded-lg border border-border-light overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 260 }}>
            <table className="w-full text-[0.6875rem]">
              <thead className="sticky top-0 bg-white z-10"><tr className="border-b border-border-light">
                {columns.map(col => (
                  <th key={col} className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr></thead>
              <tbody>
                {previewSlice.map((row, i) => (
                  <tr key={i} className="border-b border-border-light/50">
                    {columns.map(col => (
                      <td key={col} className="px-3 py-1.5 text-text whitespace-nowrap tabular-nums">{String(row[col] ?? '—')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-surface-2/20 border-t border-border-light text-[0.625rem] text-text-muted">
            Showing {previewSlice.length} of {previewRows.length} rows
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleLock}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
            <Lock size={12} />Lock Population Snapshot
          </button>
          <button onClick={() => setPreviewRows(null)}
            className="px-4 py-2 rounded-lg border border-border text-[0.75rem] font-medium text-text-secondary hover:bg-surface-2 cursor-pointer transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // State 1: No population
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-[0.875rem] font-bold text-text mb-1">Build Population Dataset</h4>
        <p className="text-[0.75rem] text-text-muted">Prepare the audit dataset that will be used for test item selection. The population will be locked as a snapshot before proceeding.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setPreviewRows(getDemoPopulation(ctrl.id))}
          className="p-4 rounded-xl border-2 border-border-light hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer text-left">
          <Database size={18} className="text-primary mb-2" />
          <div className="text-[0.75rem] font-semibold text-text">Use Demo Population</div>
          <div className="text-[0.625rem] text-text-muted mt-0.5">Load sample transaction data for testing.</div>
        </button>

        <div className="p-4 rounded-xl border-2 border-border-light opacity-60 cursor-not-allowed text-left">
          <Upload size={18} className="text-gray-400 mb-2" />
          <div className="text-[0.75rem] font-semibold text-text">Upload File</div>
          <div className="text-[0.625rem] text-text-muted mt-0.5">Upload CSV/Excel dataset. Coming soon.</div>
        </div>

        <div className="p-4 rounded-xl border-2 border-border-light opacity-60 cursor-not-allowed text-left">
          <Layers size={18} className="text-gray-400 mb-2" />
          <div className="text-[0.75rem] font-semibold text-text">Population Builder</div>
          <div className="text-[0.625rem] text-text-muted mt-0.5">Query connected data sources. Coming soon.</div>
        </div>
      </div>
    </div>
  );
}

// ─── Execution Mode Step ──────────────────────────────────────────────────

function createTestItemFromPopRow(row: Record<string, unknown>, index: number, attributes: Attribute[]): TestItem {
  const refId = String(row['invoiceId'] || row['id'] || `ROW-${index + 1}`);
  const desc = Object.values(row).slice(0, 3).map(String).join(' · ');
  const attrResults: AttributeResult[] = attributes.map(attr => ({
    attributeId: attr.id,
    result: AttrResult.NOT_TESTED,
    source: attr.type === 'AUTOMATED' ? AttrSource.AUTO : AttrSource.MANUAL,
    evidenceIds: [],
    notes: '',
    testedAt: null,
    testedBy: null,
  }));
  return {
    id: `ti-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    referenceId: refId,
    description: desc,
    sourceRow: index,
    evidence: [],
    attributeResults: attrResults,
    sampleResult: SampleResult.PENDING,
  };
}

function ExecutionModeStep({ ctrl, controlType, onUpdateControl, onNavigate }: {
  ctrl: ExecutionControl;
  controlType: DerivedControlType;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
}) {
  const pop = ctrl.execution.population;
  const mode = ctrl.execution.executionMode;
  const hasTestItems = ctrl.execution.testItems.length > 0;

  // Already chosen
  if (mode && hasTestItems) {
    const nextStep = controlType === 'Hybrid' ? 'evidence' : 'attr-testing';
    const nextLabel = controlType === 'Hybrid' ? 'Evidence' : 'Attribute Testing';
    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-[0.875rem] font-bold text-text mb-1">Execution Mode Selected</h4>
          <p className="text-[0.75rem] text-text-muted">
            Mode: <strong>{mode === 'FULL_RUN' ? 'Full Dataset' : 'Sampling'}</strong> · {ctrl.execution.testItems.length} test items created from {pop?.rowCount || 0} population rows.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200/50 bg-emerald-50/20 p-4 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <div className="text-[0.75rem] text-emerald-800">
            {ctrl.execution.testItems.length} test items ready with {ctrl.attributes.length} attributes each = {ctrl.execution.testItems.length * ctrl.attributes.length} total checks.
          </div>
        </div>
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-center justify-between">
          <span className="text-[0.6875rem] text-primary">Test items ready. Next: {nextLabel}.</span>
          <button onClick={() => onNavigate(nextStep)}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">
            {nextLabel}<ChevronRight size={10} />
          </button>
        </div>
      </div>
    );
  }

  if (!pop) return null;

  const handleFullRun = () => {
    const items = pop.rows.map((row, i) => createTestItemFromPopRow(row, i, ctrl.attributes));
    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        executionMode: ExecutionMode.FULL_RUN,
        testItems: items,
        status: ControlExecStatus.TEST_ITEMS_READY,
      },
    }));
  };

  const handleSelectSampling = () => {
    onUpdateControl(prev => ({
      ...prev,
      execution: { ...prev.execution, executionMode: ExecutionMode.SAMPLING },
    }));
    onNavigate('samples');
  };

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-[0.875rem] font-bold text-text mb-1">How do you want to test this control?</h4>
        <p className="text-[0.75rem] text-text-muted">Population has {pop.rowCount} rows. Choose whether to test every row or select a sample.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={handleFullRun}
          className="p-5 rounded-xl border-2 border-border-light hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer text-left">
          <Play size={20} className="text-primary mb-3" />
          <div className="text-[0.8125rem] font-semibold text-text">Run on Full Dataset</div>
          <div className="text-[0.6875rem] text-text-muted mt-1">Test all {pop.rowCount} transactions. Creates one test item per row.</div>
          <div className="mt-3 text-[0.625rem] text-primary font-medium">{pop.rowCount} test items · {pop.rowCount * ctrl.attributes.length} total checks</div>
        </button>

        <button onClick={handleSelectSampling}
          className="p-5 rounded-xl border-2 border-border-light hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer text-left">
          <Shuffle size={20} className="text-primary mb-3" />
          <div className="text-[0.8125rem] font-semibold text-text">Use Sampling</div>
          <div className="text-[0.6875rem] text-text-muted mt-1">Select a subset of transactions based on sampling method and size.</div>
          <div className="mt-3 text-[0.625rem] text-gray-400 font-medium">Configure sample size in next step</div>
        </button>
      </div>
    </div>
  );
}

// ─── Samples Step ─────────────────────────────────────────────────────────

function SamplesStep({ ctrl, controlType, onUpdateControl }: {
  ctrl: ExecutionControl;
  controlType: DerivedControlType;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
}) {
  const mode = ctrl.execution.executionMode;
  const items = ctrl.execution.testItems;
  const pop = ctrl.execution.population;

  // FULL_RUN or SAMPLING with items — show the table
  if (items.length > 0) {
    const label = mode === ExecutionMode.FULL_RUN ? 'Full Population' : 'Sampled';
    const subtitle = mode === ExecutionMode.FULL_RUN
      ? `All ${items.length} population rows selected as test items.`
      : `${items.length} items sampled from ${pop?.rowCount || '?'} population rows.`;
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-[0.875rem] font-bold text-text mb-1">Test Items — {label}</h4>
          <p className="text-[0.75rem] text-text-muted">{subtitle}</p>
        </div>
        <TestItemsTable items={items} attrCount={ctrl.attributes.length} />
      </div>
    );
  }

  // SAMPLING — no items yet → sampling config
  if (mode === ExecutionMode.SAMPLING && pop) {
    return <SamplingConfigPanel ctrl={ctrl} pop={pop} onUpdateControl={onUpdateControl} />;
  }

  return (
    <div className="text-center py-12 text-[0.75rem] text-text-muted">Choose execution mode first.</div>
  );
}

// ─── Sampling Config Panel ────────────────────────────────────────────────

function SamplingConfigPanel({ ctrl, pop, onUpdateControl }: {
  ctrl: ExecutionControl;
  pop: PopulationSnapshot;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
}) {
  const [sampleSize, setSampleSize] = useState(Math.min(5, pop.rowCount));
  const maxSize = pop.rowCount;
  const previewCount = Math.min(sampleSize, 5);

  // Random sample preview
  const previewIndices = Array.from({ length: previewCount }, (_, i) => Math.floor((i * pop.rowCount) / previewCount));
  const previewRows = previewIndices.map(idx => pop.rows[idx]).filter(Boolean);
  const previewColumns = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  const handleGenerate = () => {
    // Select evenly spaced rows for deterministic "random" sampling
    const step = pop.rowCount / sampleSize;
    const selectedIndices: number[] = [];
    for (let i = 0; i < sampleSize; i++) {
      selectedIndices.push(Math.min(Math.floor(i * step), pop.rowCount - 1));
    }
    const uniqueIndices = [...new Set(selectedIndices)];
    const items = uniqueIndices.map((idx, i) => createTestItemFromPopRow(pop.rows[idx], idx, ctrl.attributes));

    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        testItems: items,
        status: ControlExecStatus.TEST_ITEMS_READY,
      },
    }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-[0.875rem] font-bold text-text mb-1">Sampling Configuration</h4>
        <p className="text-[0.75rem] text-text-muted">Select a subset of {pop.rowCount} transactions for testing.</p>
      </div>

      {/* Method selection */}
      <div>
        <h5 className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider mb-2">Sampling Method</h5>
        <div className="grid grid-cols-4 gap-2">
          <div className="p-3 rounded-lg border-2 border-primary/30 bg-primary/5 text-left">
            <Shuffle size={14} className="text-primary mb-1" />
            <div className="text-[0.6875rem] font-semibold text-primary">Random</div>
            <div className="text-[0.5625rem] text-primary/70 mt-0.5">Evenly distributed selection</div>
          </div>
          {['Systematic', 'Value-based', 'Manual Selection'].map(m => (
            <div key={m} className="p-3 rounded-lg border-2 border-border-light opacity-50 cursor-not-allowed text-left">
              <div className="text-[0.6875rem] font-semibold text-gray-400">{m}</div>
              <div className="text-[0.5625rem] text-gray-400 mt-0.5">Coming soon</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sample size */}
      <div>
        <h5 className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider mb-2">Sample Size</h5>
        <div className="flex items-center gap-3">
          <input type="number" value={sampleSize} min={1} max={maxSize}
            onChange={e => setSampleSize(Math.max(1, Math.min(maxSize, parseInt(e.target.value) || 1)))}
            className="w-24 px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text outline-none focus:border-primary/40 tabular-nums" />
          <span className="text-[0.6875rem] text-text-muted">of {pop.rowCount} transactions</span>
          <span className="text-[0.6875rem] text-gray-400">({Math.round((sampleSize / pop.rowCount) * 100)}%)</span>
        </div>
      </div>

      {/* Preview */}
      {previewRows.length > 0 && (
        <div>
          <h5 className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview (first {previewCount} of {sampleSize})</h5>
          <div className="rounded-lg border border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.6875rem]">
                <thead><tr className="border-b border-border-light bg-surface-2/30">
                  {previewColumns.map(col => (
                    <th key={col} className="px-3 py-1.5 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase whitespace-nowrap">{col}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-border-light/50">
                      {previewColumns.map(col => (
                        <td key={col} className="px-3 py-1.5 text-text whitespace-nowrap tabular-nums">{String(row[col] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Generate CTA */}
      <button onClick={handleGenerate}
        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
        <FlaskConical size={13} />Select {sampleSize} Transactions for Testing
      </button>
    </div>
  );
}

// ─── Test Items Table (shared) ────────────────────────────────────────────

function TestItemsTable({ items, attrCount }: { items: TestItem[]; attrCount: number }) {
  const preview = items.slice(0, 10);
  return (
    <div className="rounded-lg border border-border-light overflow-hidden">
      <div className="overflow-x-auto" style={{ maxHeight: 300 }}>
        <table className="w-full text-[0.6875rem]">
          <thead className="sticky top-0 bg-white z-10"><tr className="border-b border-border-light">
            <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">#</th>
            <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Ref ID</th>
            <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Description</th>
            <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase">Attributes</th>
            <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase">Evidence</th>
            <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase">Result</th>
          </tr></thead>
          <tbody>
            {preview.map((item, i) => (
              <tr key={item.id} className="border-b border-border-light/50">
                <td className="px-3 py-1.5 text-gray-400 tabular-nums">{i + 1}</td>
                <td className="px-3 py-1.5 font-mono text-gray-500">{item.referenceId}</td>
                <td className="px-3 py-1.5 text-text max-w-[250px] truncate">{item.description}</td>
                <td className="px-3 py-1.5 text-center text-gray-500 tabular-nums">{item.attributeResults.length}</td>
                <td className="px-3 py-1.5 text-center text-gray-500 tabular-nums">{item.evidence.length}</td>
                <td className="px-3 py-1.5 text-center">
                  <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-gray-100 text-gray-500">Pending</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 bg-surface-2/20 border-t border-border-light text-[0.625rem] text-text-muted">
        {items.length > 10 ? `Showing 10 of ${items.length} items` : `${items.length} item${items.length !== 1 ? 's' : ''}`} · {attrCount} attributes each · {items.length * attrCount} total checks
      </div>
    </div>
  );
}

// ─── Evidence Step ────────────────────────────────────────────────────────

const EVIDENCE_TYPES = ['Invoice Copy', 'PO Copy', 'GRN Copy', 'Approval Log', 'Budget File', 'Historical Spend Report', 'Project Plan', 'System Report', 'Other'] as const;

/** Auto-suggest attribute mappings based on evidence type */
function suggestAttributeMappings(evidenceType: string, attributes: Attribute[]): string[] {
  const map: Record<string, string[]> = {
    'PO Copy': ['PO', 'Existence', 'exists'],
    'GRN Copy': ['GRN', 'Match', 'quantity'],
    'Invoice Copy': ['Invoice', 'amount', 'Amount Match'],
    'Approval Log': ['Approval', 'approval', 'Authorization', 'authorization', 'override'],
    'Budget File': ['Budget', 'budget', 'OPEX', 'CAPEX', 'historical'],
    'Historical Spend Report': ['historical', 'Accuracy', 'spending', 'trend'],
    'Project Plan': ['project', 'strategic', 'Validity', 'plan'],
    'System Report': ['Scan', 'Detection', 'duplicate', 'Matrix', 'Role', 'system'],
  };
  const keywords = map[evidenceType] || [];
  if (keywords.length === 0) return [];
  return attributes
    .filter(a => keywords.some(kw => a.name.toLowerCase().includes(kw.toLowerCase()) || a.description.toLowerCase().includes(kw.toLowerCase())))
    .map(a => a.id);
}

function EvidenceStep({ ctrl, onUpdateControl, onNavigate }: {
  ctrl: ExecutionControl;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
}) {
  const items = ctrl.execution.testItems;
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [selectedEvidenceType, setSelectedEvidenceType] = useState<string>('');
  const [mappedAttrIds, setMappedAttrIds] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lock size={20} className="text-gray-400 mb-3" />
        <h4 className="text-[0.875rem] font-semibold text-text mb-1">No test items yet</h4>
        <p className="text-[0.75rem] text-text-muted">Create or select samples before collecting evidence.</p>
      </div>
    );
  }

  const manualAttrs = ctrl.attributes.filter(a => a.type === 'MANUAL');
  const totalEvidence = items.reduce((s, ti) => s + ti.evidence.length, 0);

  // Compute evidence status per item
  const getItemEvidenceStatus = (item: TestItem): 'Not Uploaded' | 'Partial' | 'Ready' => {
    if (item.evidence.length === 0) return 'Not Uploaded';
    if (manualAttrs.length === 0) return 'Ready';
    const mappedIds = new Set(item.evidence.flatMap(e => e.mappedAttributeIds));
    const covered = manualAttrs.filter(a => mappedIds.has(a.id)).length;
    if (covered >= manualAttrs.length) return 'Ready';
    if (covered > 0 || item.evidence.length > 0) return 'Partial';
    return 'Not Uploaded';
  };

  const allReady = items.every(ti => getItemEvidenceStatus(ti) !== 'Not Uploaded');

  const addEvidenceToItem = (itemId: string, fileName: string, evidenceType: string, attrIds: string[]) => {
    const ev: Evidence = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      fileName,
      evidenceType,
      mappedAttributeIds: attrIds,
      uploadedAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      uploadedBy: 'Current User',
    };
    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        status: prev.execution.status === ControlExecStatus.TEST_ITEMS_READY ? ControlExecStatus.EVIDENCE_IN_PROGRESS : prev.execution.status,
        testItems: prev.execution.testItems.map(ti => {
          if (ti.id !== itemId) return ti;
          const updatedEvidence = [...ti.evidence, ev];
          // Update attributeResults.evidenceIds for mapped attributes
          const updatedResults = ti.attributeResults.map(ar =>
            attrIds.includes(ar.attributeId) ? { ...ar, evidenceIds: [...ar.evidenceIds, ev.id] } : ar
          );
          return { ...ti, evidence: updatedEvidence, attributeResults: updatedResults };
        }),
      },
    }));
  };

  const removeEvidence = (itemId: string, evidenceId: string) => {
    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        testItems: prev.execution.testItems.map(ti => {
          if (ti.id !== itemId) return ti;
          const updatedEvidence = ti.evidence.filter(e => e.id !== evidenceId);
          const updatedResults = ti.attributeResults.map(ar => ({
            ...ar, evidenceIds: ar.evidenceIds.filter(eid => eid !== evidenceId),
          }));
          return { ...ti, evidence: updatedEvidence, attributeResults: updatedResults };
        }),
      },
    }));
  };

  const startUpload = (itemId: string) => {
    setUploadingItemId(itemId);
    setSelectedEvidenceType('');
    setMappedAttrIds(new Set());
  };

  const confirmUpload = () => {
    if (!uploadingItemId || !selectedEvidenceType) return;
    const fileName = `${selectedEvidenceType.replace(/\s+/g, '_')}_${uploadingItemId.slice(-4)}.pdf`;
    addEvidenceToItem(uploadingItemId, fileName, selectedEvidenceType, [...mappedAttrIds]);
    setUploadingItemId(null);
  };

  const handleTypeChange = (type: string) => {
    setSelectedEvidenceType(type);
    const suggested = suggestAttributeMappings(type, ctrl.attributes);
    setMappedAttrIds(new Set(suggested));
  };

  const toggleAttrMapping = (attrId: string) => {
    setMappedAttrIds(prev => {
      const n = new Set(prev);
      if (n.has(attrId)) n.delete(attrId); else n.add(attrId);
      return n;
    });
  };

  const addDemoEvidence = (itemId: string) => {
    // Add relevant demo files based on control attributes
    const demoFiles: { name: string; type: string; attrs: string[] }[] = [];
    for (const attr of ctrl.attributes) {
      if (attr.type !== 'MANUAL') continue;
      const evTypes = attr.requiredEvidenceTypes;
      for (const et of evTypes) {
        if (!demoFiles.some(f => f.type === et)) {
          const suggested = suggestAttributeMappings(et, ctrl.attributes);
          demoFiles.push({ name: `${et.replace(/\s+/g, '_')}_demo.pdf`, type: et, attrs: suggested });
        }
      }
    }
    // If no manual attrs, add a generic system report
    if (demoFiles.length === 0) {
      demoFiles.push({ name: 'System_Report_demo.pdf', type: 'System Report', attrs: ctrl.attributes.map(a => a.id) });
    }
    for (const f of demoFiles) {
      addEvidenceToItem(itemId, f.name, f.type, f.attrs);
    }
  };

  const evStatusStyle = (s: string) =>
    s === 'Ready' ? 'bg-emerald-50 text-emerald-700' :
    s === 'Partial' ? 'bg-amber-50 text-amber-600' :
    'bg-gray-100 text-gray-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[0.875rem] font-bold text-text mb-1">Evidence Collection</h4>
          <p className="text-[0.75rem] text-text-muted">{totalEvidence} file{totalEvidence !== 1 ? 's' : ''} uploaded across {items.length} sample{items.length !== 1 ? 's' : ''}.</p>
        </div>
      </div>

      {/* Samples with evidence */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[0.6875rem]">
          <thead><tr className="border-b border-border-light bg-surface-2/30">
            <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Sample</th>
            <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Reference</th>
            <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase">Files</th>
            <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase">Status</th>
            <th className="px-3 py-2 text-right text-[0.5625rem] font-semibold text-gray-400 uppercase">Action</th>
          </tr></thead>
          <tbody>
            {items.map((item, idx) => {
              const evStatus = getItemEvidenceStatus(item);
              const isExpanded = expandedItemId === item.id;
              return (
                <React.Fragment key={item.id}>
                  <tr className={`border-b border-border-light/50 cursor-pointer ${isExpanded ? 'bg-primary/5' : 'hover:bg-surface-2/40'}`}
                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}>
                    <td className="px-3 py-2 text-gray-400 tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{item.referenceId}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-text">{item.evidence.length}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${evStatusStyle(evStatus)}`}>{evStatus}</span>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => startUpload(item.id)}
                          className="px-2 py-1 rounded text-[0.5625rem] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer flex items-center gap-1">
                          <Upload size={9} />Upload
                        </button>
                        <button onClick={() => addDemoEvidence(item.id)}
                          className="px-2 py-1 rounded text-[0.5625rem] font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200/70 cursor-pointer">
                          Demo
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded: show evidence files */}
                  {isExpanded && item.evidence.length > 0 && (
                    <tr><td colSpan={5} className="p-0">
                      <div className="px-6 py-3 bg-surface-2/10 border-b border-border-light/50 space-y-1.5">
                        {item.evidence.map(ev => (
                          <div key={ev.id} className="flex items-center gap-3 text-[0.625rem] py-1">
                            <Paperclip size={10} className="text-gray-400 shrink-0" />
                            <span className="text-text font-medium flex-1">{ev.fileName}</span>
                            <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-gray-100 text-gray-500">{ev.evidenceType}</span>
                            <span className="text-gray-400">{ev.mappedAttributeIds.length} attr{ev.mappedAttributeIds.length !== 1 ? 's' : ''}</span>
                            <span className="text-gray-400">{ev.uploadedAt}</span>
                            <button onClick={() => removeEvidence(item.id, ev.id)} className="text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </td></tr>
                  )}
                  {isExpanded && item.evidence.length === 0 && (
                    <tr><td colSpan={5} className="p-0">
                      <div className="px-6 py-4 bg-surface-2/10 border-b border-border-light/50 text-center text-[0.6875rem] text-gray-400">
                        No evidence uploaded for this sample yet.
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {uploadingItemId && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h5 className="text-[0.75rem] font-bold text-text">Upload Evidence for {items.find(i => i.id === uploadingItemId)?.referenceId || 'Sample'}</h5>

          <div>
            <label className="text-[0.625rem] font-semibold text-gray-500 block mb-1">Evidence Type <span className="text-red-400">*</span></label>
            <select value={selectedEvidenceType} onChange={e => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 cursor-pointer">
              <option value="">Select type...</option>
              {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {selectedEvidenceType && (
            <div>
              <label className="text-[0.625rem] font-semibold text-gray-500 block mb-1.5">Map to Attributes</label>
              <div className="space-y-1">
                {ctrl.attributes.map(attr => (
                  <label key={attr.id} className="flex items-center gap-2 text-[0.6875rem] cursor-pointer hover:bg-white rounded px-2 py-1 transition-colors">
                    <input type="checkbox" checked={mappedAttrIds.has(attr.id)} onChange={() => toggleAttrMapping(attr.id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-primary cursor-pointer" />
                    <span className="text-text">{attr.name}</span>
                    <span className="text-[0.5625rem] text-gray-400 ml-auto">{attr.assertionName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={confirmUpload} disabled={!selectedEvidenceType}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
              <Upload size={11} />Add Evidence
            </button>
            <button onClick={() => setUploadingItemId(null)}
              className="px-3 py-1.5 rounded-lg border border-border text-[0.6875rem] font-medium text-text-secondary hover:bg-white cursor-pointer transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Next CTA */}
      {allReady && !uploadingItemId && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-center justify-between">
          <span className="text-[0.6875rem] text-primary">Evidence collected for all samples. Next: start attribute testing.</span>
          <button onClick={() => onNavigate('attr-testing')}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">
            Attribute Testing<ChevronRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Unified Samples Step (upload-only) ───────────────────────────────────

// Per-control realistic sample data generated on "upload"
function getSampleRowsForControl(ctrlId: string): { refId: string; description: string; value: string }[] {
  if (ctrlId.includes('c003') || ctrlId.includes('003')) return [
    { refId: 'INV-1001', description: 'Vendor A — Invoice', value: '₹45,000' },
    { refId: 'INV-1002', description: 'Vendor B — Invoice', value: '₹62,500' },
    { refId: 'INV-1003', description: 'Vendor A — Invoice (potential duplicate)', value: '₹45,000' },
    { refId: 'INV-1004', description: 'Vendor C — Invoice', value: '₹18,200' },
    { refId: 'INV-1005', description: 'Vendor D — Invoice', value: '₹91,000' },
  ];
  if (ctrlId.includes('c002') || ctrlId.includes('002')) return [
    { refId: 'TXN-001', description: 'PO-001 / GRN-001 / INV-001', value: '₹1,25,000' },
    { refId: 'TXN-002', description: 'PO-002 / GRN-002 / INV-002', value: '₹89,500' },
    { refId: 'TXN-003', description: 'PO-003 / GRN missing / INV-003', value: '₹2,34,000' },
    { refId: 'TXN-004', description: 'PO-004 / GRN-004 / INV-004', value: '₹67,200' },
    { refId: 'TXN-005', description: 'PO-005 / GRN-005 / INV-005', value: '₹15,800' },
  ];
  // Budget / manual controls
  return [
    { refId: 'BUD-MKT', description: 'Marketing FY26 Budget', value: '₹12,50,000' },
    { refId: 'BUD-IT', description: 'IT FY26 Budget', value: '₹8,75,000' },
    { refId: 'BUD-OPS', description: 'Operations FY26 Budget', value: '₹15,20,000' },
    { refId: 'BUD-HR', description: 'HR FY26 Budget', value: '₹4,60,000' },
    { refId: 'BUD-FIN', description: 'Finance FY26 Budget', value: '₹3,80,000' },
  ];
}

// ─── Request PBC Step ────────────────────────────────────────────────────

interface PBCRequest {
  id: string;
  name: string;
  description: string;
  assignee: string;
  dueDate: string;
  status: 'Pending' | 'Submitted' | 'Accepted' | 'Rejected';
  attachments: number;
}

function RequestPBCStep({ ctrl, onNavigate }: {
  ctrl: ExecutionControl;
  onNavigate: (stepId: string) => void;
}) {
  const [requests, setRequests] = React.useState<PBCRequest[]>([
    { id: 'pbc-001', name: 'General Ledger Extract', description: 'Full GL extract for the audit period covering all journal entries', assignee: 'Finance Team', dueDate: '2026-02-15', status: 'Pending', attachments: 0 },
    { id: 'pbc-002', name: 'Trial Balance', description: 'Period-end trial balance with comparative prior year', assignee: 'Finance Team', dueDate: '2026-02-15', status: 'Pending', attachments: 0 },
    { id: 'pbc-003', name: 'Policy Documentation', description: 'Current approved policy document for this control area', assignee: 'Compliance Team', dueDate: '2026-02-20', status: 'Pending', attachments: 0 },
  ]);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newAssignee, setNewAssignee] = React.useState('');
  const [newDueDate, setNewDueDate] = React.useState('');

  const statusStyles: Record<PBCRequest['status'], string> = {
    Pending: 'bg-amber-50 text-amber-700',
    Submitted: 'bg-blue-50 text-blue-700',
    Accepted: 'bg-emerald-50 text-emerald-700',
    Rejected: 'bg-red-50 text-red-700',
  };

  const addRequest = () => {
    if (!newName.trim()) return;
    setRequests(prev => [...prev, {
      id: `pbc-${Date.now()}`,
      name: newName.trim(),
      description: '',
      assignee: newAssignee.trim() || 'Unassigned',
      dueDate: newDueDate || '—',
      status: 'Pending',
      attachments: 0,
    }]);
    setNewName('');
    setNewAssignee('');
    setNewDueDate('');
    setShowAddForm(false);
  };

  const summary = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'Pending').length,
    submitted: requests.filter(r => r.status === 'Submitted').length,
    accepted: requests.filter(r => r.status === 'Accepted').length,
  };

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Requests', value: summary.total, color: 'text-text' },
          { label: 'Pending', value: summary.pending, color: 'text-amber-700' },
          { label: 'Submitted', value: summary.submitted, color: 'text-blue-700' },
          { label: 'Accepted', value: summary.accepted, color: 'text-emerald-700' },
        ].map(k => (
          <div key={k.label} className="bg-surface-2/40 rounded-lg border border-border-light px-3 py-2">
            <span className={`text-[1.125rem] font-bold ${k.color} block tabular-nums`}>{k.value}</span>
            <span className="text-[0.5625rem] text-gray-400 font-medium">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <h4 className="text-[0.8125rem] font-bold text-text">PBC Request List</h4>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.625rem] font-semibold hover:bg-primary/20 cursor-pointer transition-colors">
          <Plus size={11} /> Add Request
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-surface-2/40 rounded-lg border border-border-light p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[0.625rem] font-medium text-text-muted block mb-1">Request Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Bank Reconciliation"
                className="w-full px-2.5 h-8 rounded-lg border border-border bg-white text-[0.6875rem] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </div>
            <div>
              <label className="text-[0.625rem] font-medium text-text-muted block mb-1">Assignee</label>
              <input value={newAssignee} onChange={e => setNewAssignee(e.target.value)} placeholder="e.g. Finance Team"
                className="w-full px-2.5 h-8 rounded-lg border border-border bg-white text-[0.6875rem] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </div>
            <div>
              <label className="text-[0.625rem] font-medium text-text-muted block mb-1">Due Date</label>
              <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                className="w-full px-2.5 h-8 rounded-lg border border-border bg-white text-[0.6875rem] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 rounded-lg border border-border-light text-[0.625rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
            <button onClick={addRequest} disabled={!newName.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-[0.625rem] font-semibold hover:bg-primary/90 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
          </div>
        </div>
      )}

      {/* Request table */}
      <div className="bg-white rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[0.6875rem]">
          <thead className="bg-surface-2/30 border-b border-border-light">
            <tr>
              <th className="px-3 py-2 text-left text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted">Request</th>
              <th className="px-3 py-2 text-left text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[140px]">Assignee</th>
              <th className="px-3 py-2 text-left text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[100px]">Due Date</th>
              <th className="px-3 py-2 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[90px]">Status</th>
              <th className="px-3 py-2 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[80px]">Files</th>
              <th className="px-3 py-2 text-right text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted w-[80px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id} className="border-t border-border-light hover:bg-surface-2/20 transition-colors">
                <td className="px-3 py-2.5">
                  <span className="text-[0.75rem] font-medium text-text block">{req.name}</span>
                  {req.description && <span className="text-[0.625rem] text-text-muted line-clamp-1">{req.description}</span>}
                </td>
                <td className="px-3 py-2.5 text-[0.6875rem] text-text-muted">{req.assignee}</td>
                <td className="px-3 py-2.5 text-[0.6875rem] text-text-muted tabular-nums">{req.dueDate}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-semibold ${statusStyles[req.status]}`}>{req.status}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-[0.625rem] tabular-nums ${req.attachments === 0 ? 'text-gray-300' : 'text-text'}`}>{req.attachments || '—'}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button className="px-2 py-1 rounded text-[0.5625rem] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors">
                    <Send size={9} className="inline mr-0.5" />Send
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-2">
        <button onClick={() => onNavigate('samples')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.625rem] font-semibold hover:bg-primary/20 cursor-pointer transition-colors">
          Next: Samples <ChevronRight size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── Unified Samples Step ────────────────────────────────────────────────

function UnifiedSamplesStep({ ctrl, controlType, onUpdateControl, onNavigate }: {
  ctrl: ExecutionControl;
  controlType: DerivedControlType;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
}) {
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const hasSamples = ctrl.execution.testItems.length > 0;
  const anyTested = ctrl.execution.testItems.some(ti => ti.attributeResults.some(ar => ar.result !== AttrResult.NOT_TESTED));

  // Upload handler: trigger file picker, then create testItems from control-specific mock rows
  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      const fileName = file?.name || 'sample_data.csv';
      setUploadedFileName(fileName);
      const rows = getSampleRowsForControl(ctrl.id);
      const items = rows.map((r, i) => createTestItem(r.refId, r.description, ctrl.attributes));
      onUpdateControl(prev => ({
        ...prev,
        execution: { ...prev.execution, testItems: items, status: ControlExecStatus.TEST_ITEMS_READY },
      }));
    };
    input.click();
  };

  // Execute Testing: run automated checks, navigate to Attribute Testing
  const handleExecuteTesting = () => {
    onUpdateControl(prev => {
      const pop = prev.execution.population;
      const now = new Date().toISOString();
      const updatedItems = prev.execution.testItems.map(ti => {
        const rowData: Record<string, unknown> = (pop && ti.sourceRow !== null && pop.rows[ti.sourceRow]) ? pop.rows[ti.sourceRow] : {};
        const newEvidence: Evidence[] = [...ti.evidence];
        const updatedResults = ti.attributeResults.map(ar => {
          const attr = prev.attributes.find(a => a.id === ar.attributeId);
          if (!attr || attr.type !== 'AUTOMATED') return ar;
          if (ar.result !== AttrResult.NOT_TESTED) return ar;
          const wfMapping = prev.workflowMappings.find(wm => wm.mappedAttributeIds.includes(attr.id));
          const wfName = wfMapping?.workflowName || 'Automated Workflow';
          const check = runAutoCheck(attr.name, rowData);
          const sysEvId = `ev-sys-${ti.id}-${attr.id}`;
          if (!newEvidence.some(e => e.id === sysEvId)) {
            newEvidence.push({ id: sysEvId, fileName: check.pass ? `Workflow Run Log — ${wfName}` : `Exception Report — ${attr.name}`, evidenceType: check.pass ? 'Workflow Run Log' : 'Exception Report', mappedAttributeIds: [attr.id], uploadedAt: now, uploadedBy: 'System' });
          }
          return { ...ar, result: check.pass ? AttrResult.PASS : AttrResult.FAIL, source: AttrSource.AUTO, notes: `Auto-tested by ${wfName}. ${check.notes}`, testedAt: now, testedBy: wfName, evidenceIds: [...ar.evidenceIds, sysEvId] };
        });
        const updatedItem = { ...ti, attributeResults: updatedResults, evidence: newEvidence };
        updatedItem.sampleResult = deriveSampleResult(updatedItem, prev.attributes);
        return updatedItem;
      });
      const totalChecks = updatedItems.length * prev.attributes.length;
      const completedChecks = updatedItems.reduce((s, ti) => s + ti.attributeResults.filter(r => r.result !== AttrResult.NOT_TESTED).length, 0);
      const newStatus = completedChecks === totalChecks && totalChecks > 0 ? ControlExecStatus.TESTING_COMPLETE : ControlExecStatus.TESTING_IN_PROGRESS;
      return { ...prev, execution: { ...prev.execution, testItems: updatedItems, status: newStatus } };
    });
    onNavigate('attr-testing');
  };

  // ── No samples yet: Upload Card ──
  if (!hasSamples) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border-2 border-dashed border-border-light p-10 text-center hover:border-primary/30 hover:bg-primary/5 transition-all">
          <Upload size={32} className="mx-auto text-gray-300 mb-3" />
          <h4 className="text-[0.9375rem] font-bold text-text mb-1">Upload Sample Data</h4>
          <p className="text-[0.75rem] text-text-muted max-w-md mx-auto leading-relaxed mb-4">
            Upload the sample file that should be tested for this control. Once uploaded, testing can be executed against these samples.
          </p>
          <button onClick={handleUpload}
            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.8125rem] font-semibold cursor-pointer transition-colors inline-flex items-center gap-2">
            <Upload size={15} />Upload Sample Data
          </button>
          <p className="text-[0.625rem] text-gray-400 mt-3">CSV, XLSX supported · The uploaded rows will become test items for this control.</p>
        </div>
      </div>
    );
  }

  // ── Samples uploaded: preview + Execute Testing ──
  const sampleRows = getSampleRowsForControl(ctrl.id);
  const displayName = uploadedFileName || 'sample_data.csv';
  const uploadTime = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5">
      {/* Upload summary */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[0.875rem] font-bold text-text mb-0.5">Sample Data Uploaded</h4>
          <div className="flex items-center gap-3 text-[0.6875rem] text-text-muted">
            <span className="flex items-center gap-1"><Paperclip size={10} />{displayName}</span>
            <span>{ctrl.execution.testItems.length} samples</span>
            <span className={`px-1.5 py-0.5 rounded text-[0.5625rem] font-bold ${anyTested ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {anyTested ? 'Testing Started' : 'Ready for Testing'}
            </span>
          </div>
        </div>
      </div>

      {/* Sample preview table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[0.6875rem]">
          <thead><tr className="border-b border-border-light bg-surface-2/30">
            <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase w-8">#</th>
            <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Sample ID</th>
            <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Reference / Description</th>
            <th className="px-3 py-2 text-right text-[0.5625rem] font-semibold text-gray-400 uppercase">Value</th>
            <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase">Status</th>
          </tr></thead>
          <tbody>
            {ctrl.execution.testItems.slice(0, 10).map((item, i) => {
              const rowData = sampleRows[i];
              return (
                <tr key={item.id} className="border-b border-border-light/50">
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{item.referenceId}</td>
                  <td className="px-3 py-2 text-text">{item.description}</td>
                  <td className="px-3 py-2 text-right text-text tabular-nums">{rowData?.value || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${item.sampleResult === 'PASS' ? 'bg-emerald-50 text-emerald-700' : item.sampleResult === 'FAIL' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.sampleResult === 'PASS' ? 'Passed' : item.sampleResult === 'FAIL' ? 'Failed' : 'Not Tested'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ctrl.execution.testItems.length > 10 && (
          <div className="px-3 py-2 bg-surface-2/20 border-t border-border-light text-[0.625rem] text-text-muted">
            Showing 10 of {ctrl.execution.testItems.length} samples
          </div>
        )}
        <div className="px-3 py-2 bg-surface-2/20 border-t border-border-light text-[0.625rem] text-text-muted">
          {ctrl.execution.testItems.length} samples · {ctrl.attributes.length} attributes each · {ctrl.execution.testItems.length * ctrl.attributes.length} total checks
        </div>
      </div>


      {/* Next: go to Attribute Testing */}
      {hasSamples && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-center justify-between">
          <span className="text-[0.6875rem] text-primary">{anyTested ? 'Testing executed. View and complete attribute results.' : 'Samples uploaded. Proceed to attribute testing.'}</span>
          <button onClick={() => onNavigate('attr-testing')}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">
            Next: Attribute Testing<ChevronRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mock Automated Workflow Engine ───────────────────────────────────────

/** Deterministic mock: evaluates an automated attribute against population row data */
function runAutoCheck(attrName: string, rowData: Record<string, unknown>): { pass: boolean; notes: string } {
  const name = attrName.toLowerCase();

  if (name.includes('po exists') || name.includes('po existence')) {
    const has = !!rowData['poNumber'] || !!rowData['poAmount'];
    return { pass: has, notes: has ? 'PO found in transaction record' : 'No PO reference found' };
  }
  if (name.includes('grn exists') || name.includes('grn match')) {
    const qty = Number(rowData['grnQuantity'] || 0);
    return { pass: qty > 0, notes: qty > 0 ? `GRN quantity: ${qty}` : 'No GRN record found' };
  }
  if (name.includes('invoice amount match') || name.includes('invoice amount')) {
    const inv = Number(rowData['invoiceAmount'] || 0);
    const po = Number(rowData['poAmount'] || 0);
    const match = inv > 0 && po > 0 && inv === po;
    return { pass: match, notes: match ? `Invoice ${inv} matches PO ${po}` : `Mismatch: Invoice ${inv} vs PO ${po}` };
  }
  if (name.includes('duplicate invoice number') || name.includes('duplicate invoice')) {
    const flagged = rowData['duplicateFlag'] === true;
    return { pass: !flagged, notes: flagged ? 'Duplicate invoice number detected' : 'No duplicate found' };
  }
  if (name.includes('vendor') && name.includes('amount') && name.includes('duplicate')) {
    const flagged = rowData['duplicateFlag'] === true;
    return { pass: !flagged, notes: flagged ? 'Vendor + amount duplicate detected' : 'No vendor-amount duplicate' };
  }
  if (name.includes('override authorization') || name.includes('override')) {
    const flagged = rowData['duplicateFlag'] === true;
    const approved = rowData['overrideApproved'] === true;
    const pass = !flagged || approved;
    return { pass, notes: pass ? 'Override authorized or no duplicate' : 'Duplicate override not authorized' };
  }
  if (name.includes('threshold') || name.includes('flagg')) {
    const amt = Number(rowData['invoiceAmount'] || rowData['amount'] || 0);
    const pass = amt < 200000;
    return { pass, notes: pass ? `Amount ${amt} below threshold` : `Amount ${amt} exceeds threshold — flagged` };
  }
  if (name.includes('role matrix') || name.includes('matrix current')) {
    return { pass: true, notes: 'Role matrix version validated — current' };
  }
  if (name.includes('conflict') || name.includes('detection')) {
    return { pass: true, notes: 'Conflict scan executed — no violations' };
  }
  if (name.includes('scan executed') || name.includes('scan')) {
    return { pass: true, notes: 'Scan log present before processing timestamp' };
  }

  // Default: pass
  return { pass: true, notes: 'Automated check passed' };
}

// ─── Bulk Evidence Upload Types + Logic ───────────────────────────────────

interface BulkFileMapping {
  fileName: string;
  relativePath: string;
  matchedItemId: string;
  matchedItemRef: string;
  evidenceType: string;
  mappedAttrIds: string[];
  status: 'Matched' | 'Needs Review' | 'Unmatched';
}

const BULK_EV_TYPE_KEYWORDS: [string, string[]][] = [
  ['Override Approval', ['override']],
  ['Invoice Copy', ['invoice', 'inv_']],
  ['PO Copy', ['po_', 'po-', 'purchase_order', 'purchase-order', 'purchase']],
  ['GRN Copy', ['grn', 'goods_receipt', 'goods-receipt', 'receipt']],
  ['Approval Log', ['approval', 'auth', 'authorization']],
  ['Exception Report', ['exception', 'duplicate_report', 'duplicate-report', 'error', 'failure']],
  ['Workflow Run Log', ['workflow', 'run_log', 'run-log', 'wf_log']],
  ['Budget File', ['budget']],
  ['Historical Spend Report', ['historical', 'spend', 'trend']],
  ['Project Plan', ['project', 'plan', 'strategic']],
  ['System Report', ['system', 'report']],
];

const BULK_ATTR_KEYWORDS: Record<string, string[]> = {
  'Invoice Copy': ['invoice', 'amount', 'duplicate invoice', 'inv'],
  'PO Copy': ['po', 'purchase', 'existence', 'exists', 'po amount'],
  'GRN Copy': ['grn', 'goods receipt', 'receipt', 'quantity'],
  'Approval Log': ['approval', 'authorization', 'sign-off', 'payment approval'],
  'Override Approval': ['override', 'authorization', 'duplicate override'],
  'Budget File': ['budget', 'opex', 'capex', 'allocation', 'anticipated'],
  'Historical Spend Report': ['historical', 'spending', 'accuracy', 'trend', 'reflects'],
  'Project Plan': ['project', 'strategic', 'validity', 'plan', 'aligns'],
  'Workflow Run Log': ['scan', 'detection', 'automated', 'workflow', 'matrix', 'role'],
  'Exception Report': ['exception', 'duplicate', 'override', 'fail', 'flag'],
};

function bulkInferEvidenceType(filePath: string): string {
  const lower = filePath.toLowerCase();
  for (const [type, keywords] of BULK_EV_TYPE_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return type;
  }
  return 'Other';
}

function bulkInferSampleMatch(filePath: string, items: TestItem[]): { id: string; ref: string } | null {
  // Normalize: remove extension, replace separators with space, lowercase
  const normalized = filePath.toLowerCase().replace(/\.[^.]+$/, '').replace(/[_\-/\\]/g, ' ');
  const normalizedCompact = normalized.replace(/\s+/g, '');

  for (const item of items) {
    // Match referenceId (e.g., INV-1001 matches inv1001 in path)
    const refCompact = item.referenceId.toLowerCase().replace(/[_\-\s]/g, '');
    if (normalizedCompact.includes(refCompact)) return { id: item.id, ref: item.referenceId };
  }
  // Second pass: match description keywords (for budget controls etc.)
  for (const item of items) {
    const descWords = item.description.toLowerCase().split(/[\s,·—]+/).filter(w => w.length > 3);
    for (const word of descWords) {
      const wordClean = word.replace(/[^a-z0-9]/g, '');
      if (wordClean.length > 3 && normalizedCompact.includes(wordClean)) return { id: item.id, ref: item.referenceId };
    }
  }
  return null;
}

function bulkInferAttrMapping(evidenceType: string, attributes: Attribute[]): string[] {
  const keywords = BULK_ATTR_KEYWORDS[evidenceType] || [];
  if (keywords.length === 0) return [];
  return attributes
    .filter(a => {
      const nameDesc = (a.name + ' ' + a.description).toLowerCase();
      return keywords.some(kw => nameDesc.includes(kw));
    })
    .map(a => a.id);
}

function buildBulkMappings(files: { name: string; path: string }[], items: TestItem[], attributes: Attribute[]): BulkFileMapping[] {
  return files.map(f => {
    const searchPath = f.path || f.name;
    const evType = bulkInferEvidenceType(searchPath);
    const sampleMatch = bulkInferSampleMatch(searchPath, items);
    const attrIds = bulkInferAttrMapping(evType, attributes);

    if (sampleMatch && attrIds.length > 0) {
      return { fileName: f.name, relativePath: f.path, matchedItemId: sampleMatch.id, matchedItemRef: sampleMatch.ref, evidenceType: evType, mappedAttrIds: attrIds, status: 'Matched' as const };
    }
    if (sampleMatch) {
      return { fileName: f.name, relativePath: f.path, matchedItemId: sampleMatch.id, matchedItemRef: sampleMatch.ref, evidenceType: evType, mappedAttrIds: [], status: 'Needs Review' as const };
    }
    return { fileName: f.name, relativePath: f.path, matchedItemId: '', matchedItemRef: '', evidenceType: evType, mappedAttrIds: [], status: 'Unmatched' as const };
  });
}

function deriveBulkStatus(m: BulkFileMapping): BulkFileMapping['status'] {
  if (!m.matchedItemId) return 'Unmatched';
  if (m.mappedAttrIds.length > 0) return 'Matched';
  return 'Needs Review';
}

// ─── Attribute Testing Step ───────────────────────────────────────────────

function AttributeTestingStep({ ctrl, onUpdateControl, onNavigate }: {
  ctrl: ExecutionControl;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
}) {
  const items = ctrl.execution.testItems;
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(items[0]?.id || null);
  const [bulkMappings, setBulkMappings] = useState<BulkFileMapping[] | null>(null);
  const [running, setRunning] = useState(false);
  const [retestMode, setRetestMode] = useState<'select' | 'evidence' | null>(null);
  const [retestIds, setRetestIds] = useState<Set<string>>(new Set());
  const [showAllPreview, setShowAllPreview] = useState(false);
  const [retestCompletedIds, setRetestCompletedIds] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lock size={20} className="text-gray-400 mb-3" />
        <h4 className="text-[0.875rem] font-semibold text-text mb-1">No test items</h4>
        <p className="text-[0.75rem] text-text-muted">Select transactions or create samples before attribute testing.</p>
      </div>
    );
  }

  const progress = deriveTestingProgress(ctrl);

  // Check if all testing is complete
  const allComplete = progress.totalAttributeChecks > 0 && progress.completedAttributeChecks === progress.totalAttributeChecks;

  // Update a single attribute result for a single test item
  const updateAttributeResult = (itemId: string, attrId: string, result: AttrResult, notes: string) => {
    onUpdateControl(prev => {
      const updatedItems = prev.execution.testItems.map(ti => {
        if (ti.id !== itemId) return ti;
        const updatedResults = ti.attributeResults.map(ar =>
          ar.attributeId === attrId ? {
            ...ar,
            result,
            notes,
            testedAt: new Date().toISOString(),
            testedBy: 'Current User',
          } : ar
        );
        const updatedItem = { ...ti, attributeResults: updatedResults };
        // Derive sample result
        updatedItem.sampleResult = deriveSampleResult(updatedItem, prev.attributes);
        return updatedItem;
      });

      // Determine new status
      const totalChecks = updatedItems.length * prev.attributes.length;
      const completedChecks = updatedItems.reduce((s, ti) =>
        s + ti.attributeResults.filter(r => r.result !== AttrResult.NOT_TESTED).length, 0);
      let newStatus = prev.execution.status;
      if (completedChecks > 0 && completedChecks < totalChecks) {
        newStatus = ControlExecStatus.TESTING_IN_PROGRESS;
      } else if (completedChecks === totalChecks && totalChecks > 0) {
        newStatus = ControlExecStatus.TESTING_COMPLETE;
      }

      return { ...prev, execution: { ...prev.execution, testItems: updatedItems, status: newStatus } };
    });
  };

  // Attach evidence to a test item for a specific attribute
  const attachEvidence = (itemId: string, attrId: string, fileName: string, evidenceType: string) => {
    const evId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        testItems: prev.execution.testItems.map(ti => {
          if (ti.id !== itemId) return ti;
          const newEv: Evidence = { id: evId, fileName, evidenceType, mappedAttributeIds: [attrId], uploadedAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }), uploadedBy: 'Current User' };
          return {
            ...ti,
            evidence: [...ti.evidence, newEv],
            attributeResults: ti.attributeResults.map(ar => ar.attributeId === attrId ? { ...ar, evidenceIds: [...ar.evidenceIds, evId] } : ar),
          };
        }),
      },
    }));
  };

  // Bulk upload — auto-attach evidence to every sample × required attribute
  const handleBulkFolderUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    (input as any).webkitdirectory = true;
    (input as any).directory = true;
    input.onchange = () => autoAttachAllEvidence();
    input.click();
  };

  const handleBulkMultiFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg';
    input.onchange = () => autoAttachAllEvidence();
    input.click();
  };

  // For prototype: auto-generate evidence for every sample × required attribute
  const autoAttachAllEvidence = () => {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    onUpdateControl(prev => {
      const updatedItems = prev.execution.testItems.map(ti => {
        const newEvidence = [...ti.evidence];
        const updatedResults = ti.attributeResults.map(ar => {
          const attr = prev.attributes.find(a => a.id === ar.attributeId);
          if (!attr || !attr.required) return ar;
          // Skip if already has evidence
          if (ar.evidenceIds.length > 0) return ar;
          const evId = `ev-auto-${ti.id}-${attr.id}`;
          if (!newEvidence.some(e => e.id === evId)) {
            const evType = attr.requiredEvidenceTypes[0] || 'Supporting Document';
            newEvidence.push({
              id: evId,
              fileName: `${ti.referenceId}_${attr.name.replace(/\s+/g, '_').toLowerCase()}.pdf`,
              evidenceType: evType,
              mappedAttributeIds: [attr.id],
              uploadedAt: now,
              uploadedBy: 'User',
            });
          }
          return { ...ar, evidenceIds: [...ar.evidenceIds, evId] };
        });
        return { ...ti, evidence: newEvidence, attributeResults: updatedResults };
      });
      return { ...prev, execution: { ...prev.execution, testItems: updatedItems } };
    });
  };

  const applyBulkMappings = () => {
    if (!bulkMappings) return;
    const nowTs = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const applicable = bulkMappings.filter(m => m.matchedItemId && m.mappedAttrIds.length > 0);
    onUpdateControl(prev => {
      let updatedItems = [...prev.execution.testItems];
      for (const mapping of applicable) {
        const evId = `ev-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const ev: Evidence = { id: evId, fileName: mapping.fileName, evidenceType: mapping.evidenceType, mappedAttributeIds: mapping.mappedAttrIds, uploadedAt: nowTs, uploadedBy: 'User' };
        updatedItems = updatedItems.map(ti => {
          if (ti.id !== mapping.matchedItemId) return ti;
          return {
            ...ti,
            evidence: [...ti.evidence, ev],
            attributeResults: ti.attributeResults.map(ar => mapping.mappedAttrIds.includes(ar.attributeId) ? { ...ar, evidenceIds: [...ar.evidenceIds, evId] } : ar),
          };
        });
      }
      return { ...prev, execution: { ...prev.execution, testItems: updatedItems } };
    });
    const skipped = bulkMappings.length - applicable.length;
    if (skipped > 0 && applicable.length > 0) {
      // Keep unmatched in review
      setBulkMappings(bulkMappings.filter(m => !m.matchedItemId || m.mappedAttrIds.length === 0));
    } else {
      setBulkMappings(null);
    }
  };

  // Check if there are automated attributes that haven't been tested yet
  const autoAttrs = ctrl.attributes.filter(a => a.type === 'AUTOMATED');
  const hasUntested = items.some(ti =>
    ti.attributeResults.some(ar => {
      const attr = ctrl.attributes.find(a => a.id === ar.attributeId);
      return attr?.type === 'AUTOMATED' && ar.result === AttrResult.NOT_TESTED;
    })
  );

  const runAutomatedChecks = () => {
    const pop = ctrl.execution.population;
    const now = new Date().toISOString();
    onUpdateControl(prev => {
      const updatedItems = prev.execution.testItems.map(ti => {
        const rowData: Record<string, unknown> = (pop && ti.sourceRow !== null && pop.rows[ti.sourceRow])
          ? pop.rows[ti.sourceRow]
          : {};
        const newEvidence: Evidence[] = [...ti.evidence];
        const updatedResults = ti.attributeResults.map(ar => {
          const attr = prev.attributes.find(a => a.id === ar.attributeId);
          if (!attr || attr.type !== 'AUTOMATED') return ar;
          if (ar.result !== AttrResult.NOT_TESTED) return ar;
          const wfMapping = prev.workflowMappings.find(wm => wm.mappedAttributeIds.includes(attr.id));
          const wfName = wfMapping?.workflowName || 'Automated Workflow';
          const check = runAutoCheck(attr.name, rowData);
          // Create system evidence for this automated check
          const sysEvId = `ev-sys-${ti.id}-${attr.id}`;
          if (!newEvidence.some(e => e.id === sysEvId)) {
            newEvidence.push({
              id: sysEvId,
              fileName: check.pass ? `Workflow Run Log — ${wfName}` : `Exception Report — ${attr.name}`,
              evidenceType: check.pass ? 'Workflow Run Log' : 'Exception Report',
              mappedAttributeIds: [attr.id],
              uploadedAt: now,
              uploadedBy: 'System',
            });
          }
          return {
            ...ar,
            result: check.pass ? AttrResult.PASS : AttrResult.FAIL,
            source: AttrSource.AUTO,
            notes: `Auto-tested by ${wfName}. ${check.notes}`,
            testedAt: now,
            testedBy: wfName,
            evidenceIds: [...ar.evidenceIds, sysEvId],
          };
        });
        const updatedItem = { ...ti, attributeResults: updatedResults, evidence: newEvidence };
        updatedItem.sampleResult = deriveSampleResult(updatedItem, prev.attributes);
        return updatedItem;
      });

      const totalChecks = updatedItems.length * prev.attributes.length;
      const completedChecks = updatedItems.reduce((s, ti) =>
        s + ti.attributeResults.filter(r => r.result !== AttrResult.NOT_TESTED).length, 0);
      let newStatus = prev.execution.status;
      if (completedChecks > 0 && completedChecks < totalChecks) newStatus = ControlExecStatus.TESTING_IN_PROGRESS;
      else if (completedChecks === totalChecks && totalChecks > 0) newStatus = ControlExecStatus.TESTING_COMPLETE;

      return { ...prev, execution: { ...prev.execution, testItems: updatedItems, status: newStatus } };
    });
  };

  // Group attributes by assertion for rendering
  const assertionGroups: { assertionName: string; attrs: Attribute[] }[] = [];
  const groupMap = new Map<string, Attribute[]>();
  for (const attr of ctrl.attributes) {
    if (!groupMap.has(attr.assertionName)) groupMap.set(attr.assertionName, []);
    groupMap.get(attr.assertionName)!.push(attr);
  }
  for (const [name, attrs] of groupMap) assertionGroups.push({ assertionName: name, attrs });

  // Sample result display
  const getSampleDisplayStatus = (item: TestItem) => {
    if (item.sampleResult === 'PASS') return { label: 'Passed', cls: 'bg-emerald-50 text-emerald-700' };
    if (item.sampleResult === 'FAIL') return { label: 'Failed', cls: 'bg-red-50 text-red-700' };
    // Check if evidence is attached for all required attributes
    const requiredAttrs = ctrl.attributes.filter(a => a.required);
    const allEvidenceReady = requiredAttrs.length > 0 && requiredAttrs.every(a => {
      const ar = item.attributeResults.find(r => r.attributeId === a.id);
      return ar && ar.evidenceIds.length > 0;
    });
    if (allEvidenceReady) return { label: 'Evidence Ready', cls: 'bg-emerald-50 text-emerald-600' };
    if (item.evidence.length > 0) return { label: 'Evidence Partial', cls: 'bg-amber-50 text-amber-600' };
    return { label: 'Pending', cls: 'bg-gray-100 text-gray-500' };
  };

  return (
    <div className="space-y-4">
      {/* Progress Panel */}
      <div className="rounded-lg border border-border-light bg-surface-2/20 p-4">
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Samples', value: items.length, color: 'text-text' },
            { label: 'Total Checks', value: progress.totalAttributeChecks, color: 'text-text' },
            { label: 'Completed', value: progress.completedAttributeChecks, color: progress.completedAttributeChecks > 0 ? 'text-emerald-700' : 'text-gray-400' },
            { label: 'Manual Pending', value: progress.manualPending, color: progress.manualPending > 0 ? 'text-amber-700' : 'text-emerald-700' },
            { label: 'Auto Pending', value: progress.automatedPending, color: progress.automatedPending > 0 ? 'text-blue-700' : 'text-emerald-700' },
            { label: 'Failed', value: progress.failedAttributeChecks, color: progress.failedAttributeChecks > 0 ? 'text-red-700' : 'text-gray-400' },
          ].map(s => (
            <div key={s.label}>
              <span className={`text-[1.125rem] font-bold ${s.color} block tabular-nums`}>{s.value}</span>
              <span className="text-[0.5625rem] text-gray-400 font-medium">{s.label}</span>
            </div>
          ))}
        </div>
        {progress.totalAttributeChecks > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${progress.completionPercent}%` }} />
            </div>
            <span className="text-[0.625rem] text-gray-400 mt-1 block">{progress.completionPercent}% complete</span>
          </div>
        )}
      </div>

      {/* Sample-wise Testing Preview */}
      {ctrl.attributes.length > 0 && (
        <div className="rounded-xl border border-border-light bg-white p-4 space-y-3">
          {/* Quick actions at top of preview */}
          <div className="flex items-center justify-between">
            <h4 className="text-[0.75rem] font-bold text-text mb-0">Sample-wise Testing Preview</h4>
            <div className="flex items-center gap-1.5">
              <button onClick={handleBulkFolderUpload}
                className="px-2.5 py-1 rounded-lg text-[0.5625rem] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors flex items-center gap-1">
                <Upload size={10} />Upload Evidence
              </button>
              {autoAttrs.length > 0 && (
                <button onClick={() => { setRunning(true); setTimeout(() => { runAutomatedChecks(); setRunning(false); }, 7000); }}
                  className="px-2.5 py-1 rounded-lg text-[0.5625rem] font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors flex items-center gap-1">
                  <Play size={10} />Run Checks
                </button>
              )}
            </div>
          </div>
          <div>
            <p className="text-[0.625rem] text-text-muted">Rows are samples. Columns are required attributes. Each cell shows the testing status for that sample + attribute.</p>
            <p className="text-[0.625rem] text-primary font-medium mt-1 tabular-nums">{items.length} sample{items.length !== 1 ? 's' : ''} × {ctrl.attributes.length} required attribute{ctrl.attributes.length !== 1 ? 's' : ''} = {progress.totalAttributeChecks} total checks</p>
          </div>

          {/* Matrix table */}
          <div className="overflow-x-auto">
            <table className="text-[0.625rem] w-full border-collapse">
              <thead>
                <tr className="bg-surface-2/30">
                  <th className="text-left px-3 py-2 text-[0.5625rem] font-semibold text-gray-400 uppercase tracking-wider border-b border-border-light">Sample</th>
                  {ctrl.attributes.map((attr, ai) => (
                    <th key={attr.id} className="px-2 py-2 text-center border-b border-border-light" title={attr.name}>
                      <span className="text-[0.5625rem] font-semibold text-gray-400 uppercase tracking-wider">Attribute {String.fromCharCode(65 + ai)}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase tracking-wider border-b border-border-light">Sample Result</th>
                </tr>
              </thead>
              <tbody>
                {(showAllPreview ? items : items.slice(0, 3)).map(ti => {
                  const sampleDone = ti.attributeResults.every(ar => ar.result !== 'NOT_TESTED');
                  const sampleFailed = ti.attributeResults.some(ar => ar.result === 'FAIL');
                  return (
                    <tr key={ti.id} className="border-b border-border-light/30 hover:bg-surface-2/10">
                      <td className="px-3 py-2">
                        <span className="text-[0.625rem] font-semibold text-text">{ti.referenceId || ti.id}</span>
                        {ti.description && <span className="text-[0.5625rem] text-gray-400 block mt-0.5 truncate max-w-[140px]">{ti.description}</span>}
                      </td>
                      {ti.attributeResults.map(ar => {
                        const bg = ar.result === 'PASS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ar.result === 'FAIL' ? 'bg-red-50 text-red-700 border-red-200' : ar.evidenceIds.length > 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200';
                        const label = ar.result === 'PASS' ? 'Passed' : ar.result === 'FAIL' ? 'Failed' : ar.evidenceIds.length > 0 ? 'Evidence Ready' : 'Not Tested';
                        return (
                          <td key={ar.attributeId} className="px-2 py-2 text-center">
                            <span className={`inline-flex items-center justify-center px-1.5 h-5 rounded-full border text-[0.5rem] font-semibold ${bg}`}>{label}</span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center px-2 h-5 rounded-full text-[0.5rem] font-bold ${sampleDone ? (sampleFailed ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                          {sampleDone ? (sampleFailed ? 'Failed' : 'Passed') : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length > 3 && !showAllPreview && (
              <button onClick={() => setShowAllPreview(true)} className="text-[0.5625rem] text-primary font-semibold mt-1.5 px-3 cursor-pointer hover:underline">
                +{items.length - 3} more sample{items.length - 3 !== 1 ? 's' : ''} — show all
              </button>
            )}
            {items.length > 3 && showAllPreview && (
              <button onClick={() => setShowAllPreview(false)} className="text-[0.5625rem] text-gray-400 font-semibold mt-1.5 px-3 cursor-pointer hover:underline">
                Show fewer
              </button>
            )}
          </div>

          {/* Attribute Legend */}
          <div className="pt-2 border-t border-border-light/30">
            <span className="text-[0.5625rem] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Attributes</span>
            <div className="space-y-1">
              {ctrl.attributes.map((attr, ai) => (
                <div key={attr.id} className="flex items-center gap-2 text-[0.625rem]">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary text-[0.5625rem] font-bold shrink-0">{String.fromCharCode(65 + ai)}</span>
                  <span className="text-text">{attr.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* Bulk Upload Review Panel */}
      {bulkMappings && (
        <div className="rounded-xl border border-primary/20 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h5 className="text-[0.75rem] font-bold text-text">{bulkMappings.length} file{bulkMappings.length !== 1 ? 's' : ''} — review mappings</h5>
            <div className="flex items-center gap-3 text-[0.5625rem]">
              <span className="text-emerald-700 font-semibold">{bulkMappings.filter(m => deriveBulkStatus(m) === 'Matched').length} matched</span>
              <span className="text-amber-600 font-semibold">{bulkMappings.filter(m => deriveBulkStatus(m) === 'Needs Review').length} needs review</span>
              <span className="text-gray-400">{bulkMappings.filter(m => deriveBulkStatus(m) === 'Unmatched').length} unmatched</span>
            </div>
          </div>
          {bulkMappings.some(m => deriveBulkStatus(m) === 'Unmatched') && (
            <div className="rounded-lg border border-amber-200/50 bg-amber-50/20 px-3 py-2 text-[0.625rem] text-amber-700 flex items-center gap-1.5">
              <AlertTriangle size={10} />Some files could not be matched. Please select sample and attributes manually.
            </div>
          )}
          <div className="rounded-lg border border-border-light overflow-hidden" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="w-full text-[0.625rem]">
              <thead className="sticky top-0 bg-white z-10"><tr className="border-b border-border-light">
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">File</th>
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase w-[90px]">Sample</th>
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase w-[100px]">Evidence Type</th>
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase w-[140px]">Mapped Attributes</th>
                <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase w-[65px]">Status</th>
              </tr></thead>
              <tbody>
                {bulkMappings.map((m, i) => {
                  const st = deriveBulkStatus(m);
                  return (
                  <tr key={i} className={`border-b border-border-light/50 ${st === 'Unmatched' ? 'bg-red-50/10' : ''}`}>
                    <td className="px-2 py-1.5">
                      <span className="text-text block truncate max-w-[160px]">{m.fileName}</span>
                      {m.relativePath !== m.fileName && <span className="text-[0.5rem] text-gray-400 block truncate max-w-[160px]">{m.relativePath}</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={m.matchedItemId} onChange={e => {
                        const item = items.find(ti => ti.id === e.target.value);
                        setBulkMappings(prev => prev!.map((x, j) => j === i ? { ...x, matchedItemId: e.target.value, matchedItemRef: item?.referenceId || '' } : x));
                      }} className="w-full px-1 py-0.5 border border-border rounded text-[0.5625rem] bg-white outline-none cursor-pointer">
                        <option value="">—</option>
                        {items.map(ti => <option key={ti.id} value={ti.id}>{ti.referenceId}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={m.evidenceType} onChange={e => {
                        const newType = e.target.value;
                        const newAttrs = bulkInferAttrMapping(newType, ctrl.attributes);
                        setBulkMappings(prev => prev!.map((x, j) => j === i ? { ...x, evidenceType: newType, mappedAttrIds: newAttrs } : x));
                      }} className="w-full px-1 py-0.5 border border-border rounded text-[0.5625rem] bg-white outline-none cursor-pointer">
                        {BULK_EV_TYPE_KEYWORDS.map(([t]) => <option key={t} value={t}>{t}</option>)}
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-0.5">
                        {ctrl.attributes.map(a => {
                          const selected = m.mappedAttrIds.includes(a.id);
                          return (
                            <button key={a.id} onClick={() => {
                              setBulkMappings(prev => prev!.map((x, j) => {
                                if (j !== i) return x;
                                const ids = selected ? x.mappedAttrIds.filter(id => id !== a.id) : [...x.mappedAttrIds, a.id];
                                return { ...x, mappedAttrIds: ids };
                              }));
                            }} className={`px-1 py-0.5 rounded text-[0.4375rem] font-bold cursor-pointer transition-colors ${selected ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                              {a.name.length > 12 ? a.name.slice(0, 11) + '…' : a.name}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1 py-0.5 rounded text-[0.4375rem] font-bold ${st === 'Matched' ? 'bg-emerald-50 text-emerald-700' : st === 'Needs Review' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>{st}</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={applyBulkMappings}
                disabled={bulkMappings.every(m => deriveBulkStatus(m) === 'Unmatched')}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                <CheckCircle2 size={11} />Apply {bulkMappings.filter(m => deriveBulkStatus(m) === 'Matched').length} Matched
              </button>
              <button onClick={() => setBulkMappings(null)}
                className="px-3 py-1.5 rounded-lg border border-border text-[0.6875rem] font-medium text-text-secondary hover:bg-white cursor-pointer transition-colors">Cancel</button>
            </div>
            <span className="text-[0.5625rem] text-gray-400">{bulkMappings.filter(m => deriveBulkStatus(m) !== 'Matched').length} file{bulkMappings.filter(m => deriveBulkStatus(m) !== 'Matched').length !== 1 ? 's' : ''} need attention</span>
          </div>
        </div>
      )}

      {/* Running Automated Checks loader */}
      {running && (
        <div className="rounded-xl border-2 border-blue-200/50 bg-blue-50/20 p-6 text-center">
          <Loader2 size={28} className="mx-auto text-blue-600 animate-spin mb-3" />
          <h5 className="text-[0.875rem] font-bold text-blue-800 mb-1">Running Automated Checks...</h5>
          <p className="text-[0.6875rem] text-blue-600">Executing workflows on {items.length} samples × {autoAttrs.length} automated attributes</p>
          <div className="mt-3 h-1.5 bg-blue-100 rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full rounded-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}
      {!running && autoAttrs.length > 0 && !hasUntested && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200/50 bg-emerald-50/20 px-4 py-2.5">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <span className="text-[0.6875rem] text-emerald-700">All automated checks completed across {items.length} test items.</span>
        </div>
      )}

      {/* Per-Sample Testing */}
      <div className="space-y-2">
        {items.map((item, sampleIdx) => {
          const isExpanded = expandedSampleId === item.id;
          return (
            <div key={item.id} className="rounded-lg border border-border-light overflow-hidden">
              {/* Sample Header */}
              <button onClick={() => setExpandedSampleId(isExpanded ? null : item.id)}
                className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-surface-2/30 transition-colors cursor-pointer text-left">
                <div className="flex items-center gap-3">
                  <span className="text-[0.6875rem] text-gray-400 tabular-nums w-6">{sampleIdx + 1}</span>
                  <span className="text-[0.75rem] font-mono text-gray-500">{item.referenceId}</span>
                  <span className="text-[0.6875rem] text-text-muted truncate max-w-[200px]">{item.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  {retestCompletedIds.has(item.id) && (
                    <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-amber-50 text-amber-600 flex items-center gap-0.5"><RotateCcw size={7} />Retested</span>
                  )}
                  {(() => { const s = getSampleDisplayStatus(item); return (
                    <span className={`px-1.5 py-0.5 rounded text-[0.5625rem] font-bold ${s.cls}`}>{s.label}</span>
                  ); })()}
                  <span className="text-[0.625rem] text-gray-400 tabular-nums">
                    {item.attributeResults.filter(r => r.result !== AttrResult.NOT_TESTED).length}/{item.attributeResults.length}
                  </span>
                  {isExpanded ? <ChevronRight size={12} className="text-gray-400 rotate-90" /> : <ChevronRight size={12} className="text-gray-400" />}
                </div>
              </button>

              {/* Expanded: attribute groups */}
              {isExpanded && (
                <div className="border-t border-border-light bg-surface-2/10 px-4 py-3 space-y-3">
                  {assertionGroups.map(group => (
                    <div key={group.assertionName}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shield size={10} className="text-primary" />
                        <span className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wider">{group.assertionName}</span>
                        <span className="text-[0.5625rem] text-gray-400">({group.attrs.length})</span>
                      </div>
                      <div className="space-y-1">
                        {group.attrs.map(attr => {
                          const ar = item.attributeResults.find(r => r.attributeId === attr.id);
                          const result = ar?.result || AttrResult.NOT_TESTED;
                          const notes = ar?.notes || '';
                          const isManual = attr.type === 'MANUAL';
                          const isAuto = attr.type === 'AUTOMATED';
                          const evidenceCount = ar?.evidenceIds.length || 0;
                          const wfMapping = ctrl.workflowMappings.find(wm => wm.mappedAttributeIds.includes(attr.id));

                          return (
                            <AttributeTestRow
                              key={attr.id}
                              attr={attr}
                              result={result}
                              notes={notes}
                              isManual={isManual}
                              isAuto={isAuto}
                              evidenceCount={evidenceCount}
                              workflowName={wfMapping?.workflowName}
                              onSave={(r, n) => updateAttributeResult(item.id, attr.id, r, n)}
                              onAttachEvidence={(fileName, evType) => attachEvidence(item.id, attr.id, fileName, evType)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Retest + Next CTA */}
      {allComplete && !retestMode && !running && (
        <div className="space-y-3">
          {/* Show retested badge on samples that were retested */}
          {retestCompletedIds.size > 0 && (
            <div className="rounded-lg border border-amber-200/50 bg-amber-50/20 px-4 py-2.5 flex items-center gap-2">
              <RotateCcw size={12} className="text-amber-600 shrink-0" />
              <span className="text-[0.6875rem] text-amber-700">{retestCompletedIds.size} sample{retestCompletedIds.size !== 1 ? 's were' : ' was'} retested with fresh evidence.</span>
            </div>
          )}
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <span className="text-[0.75rem] font-semibold text-primary block">Testing Complete</span>
              <span className="text-[0.625rem] text-primary/70">All attribute testing complete. Proceed to working paper or retest selected samples.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => { setRetestMode('select'); setRetestIds(new Set()); }}
                className="px-3 py-1.5 rounded-lg border border-primary/20 text-primary text-[0.6875rem] font-semibold cursor-pointer hover:bg-primary/10 transition-colors flex items-center gap-1">
                <RotateCcw size={11} />Retest Samples
              </button>
              <button onClick={() => onNavigate('working-paper')}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                Working Paper<ChevronRight size={11} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retest Step 1: Select samples */}
      {retestMode === 'select' && !running && (
        <div className="rounded-xl border-2 border-amber-200/50 bg-amber-50/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-[0.8125rem] font-bold text-amber-800">Step 1: Select Samples to Retest</h5>
              <p className="text-[0.625rem] text-amber-600 mt-0.5">Choose which samples need to be retested with fresh evidence.</p>
            </div>
            <span className="text-[0.6875rem] font-semibold text-amber-700">{retestIds.size} / {items.length} selected</span>
          </div>
          <div className="space-y-1">
            {items.map((item, i) => {
              const selected = retestIds.has(item.id);
              const ds = getSampleDisplayStatus(item);
              return (
                <label key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected ? 'bg-amber-50 border border-amber-200/50' : 'border border-border-light hover:bg-surface-2/30'}`}>
                  <input type="checkbox" checked={selected} onChange={() => setRetestIds(prev => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                    className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer" />
                  <span className="text-[0.6875rem] text-gray-400 tabular-nums w-5">{i + 1}</span>
                  <span className="text-[0.6875rem] font-mono text-gray-500">{item.referenceId}</span>
                  <span className="text-[0.6875rem] text-text flex-1">{item.description}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${ds.cls}`}>{ds.label}</span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => setRetestIds(new Set(items.map(i => i.id)))} className="text-[0.625rem] text-primary font-semibold cursor-pointer hover:underline">Select All</button>
            <button onClick={() => setRetestIds(new Set())} className="text-[0.625rem] text-gray-500 font-medium cursor-pointer hover:underline">Deselect All</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
                if (retestIds.size === 0) return;
                // Clear results + evidence for selected samples
                onUpdateControl(prev => ({
                  ...prev,
                  execution: {
                    ...prev.execution,
                    status: ControlExecStatus.TESTING_IN_PROGRESS,
                    testItems: prev.execution.testItems.map(ti => {
                      if (!retestIds.has(ti.id)) return ti;
                      return {
                        ...ti,
                        sampleResult: SampleResult.PENDING,
                        evidence: ti.evidence.filter(e => e.uploadedBy === 'System'),
                        attributeResults: ti.attributeResults.map(ar => ({ ...ar, result: AttrResult.NOT_TESTED, notes: '', testedAt: null, testedBy: null, evidenceIds: ar.evidenceIds.filter(eid => eid.startsWith('ev-sys-')) })),
                      };
                    }),
                  },
                }));
                setRetestMode('evidence');
              }}
              disabled={retestIds.size === 0}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              Next: Upload Evidence<ChevronRight size={12} />
            </button>
            <button onClick={() => setRetestMode(null)} className="px-3 py-1.5 rounded-lg border border-border text-[0.6875rem] font-medium text-text-secondary hover:bg-white cursor-pointer transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Retest Step 2: Upload evidence for selected samples */}
      {retestMode === 'evidence' && !running && (
        <div className="rounded-xl border-2 border-blue-200/50 bg-blue-50/10 p-4 space-y-3">
          <div>
            <h5 className="text-[0.8125rem] font-bold text-blue-800">Step 2: Upload Evidence for Retested Samples</h5>
            <p className="text-[0.625rem] text-blue-600 mt-0.5">Upload fresh evidence for the {retestIds.size} selected sample{retestIds.size !== 1 ? 's' : ''}. Click upload to auto-attach evidence, then run retest.</p>
          </div>
          {/* Show selected samples with evidence status */}
          <div className="space-y-1">
            {items.filter(ti => retestIds.has(ti.id)).map((item, i) => {
              const ds = getSampleDisplayStatus(item);
              return (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-light">
                  <span className="text-[0.6875rem] text-gray-400 tabular-nums w-5">{i + 1}</span>
                  <span className="text-[0.6875rem] font-mono text-gray-500">{item.referenceId}</span>
                  <span className="text-[0.6875rem] text-text flex-1">{item.description}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${ds.cls}`}>{ds.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
                // Auto-attach evidence for retested samples only
                const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                onUpdateControl(prev => ({
                  ...prev,
                  execution: {
                    ...prev.execution,
                    testItems: prev.execution.testItems.map(ti => {
                      if (!retestIds.has(ti.id)) return ti;
                      const newEvidence = [...ti.evidence];
                      const updatedResults = ti.attributeResults.map(ar => {
                        const attr = prev.attributes.find(a => a.id === ar.attributeId);
                        if (!attr || !attr.required) return ar;
                        if (ar.evidenceIds.some(eid => !eid.startsWith('ev-sys-'))) return ar;
                        const evId = `ev-retest-${ti.id}-${attr.id}`;
                        if (!newEvidence.some(e => e.id === evId)) {
                          newEvidence.push({ id: evId, fileName: `${ti.referenceId}_${attr.name.replace(/\s+/g, '_').toLowerCase()}_retest.pdf`, evidenceType: attr.requiredEvidenceTypes[0] || 'Supporting Document', mappedAttributeIds: [attr.id], uploadedAt: now, uploadedBy: 'User' });
                        }
                        return { ...ar, evidenceIds: [...ar.evidenceIds.filter(eid => eid.startsWith('ev-sys-')), evId] };
                      });
                      return { ...ti, evidence: newEvidence, attributeResults: updatedResults };
                    }),
                  },
                }));
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
              <Upload size={11} />Upload Fresh Evidence
            </button>
          </div>
          {/* Check if evidence is ready for retested samples */}
          {(() => {
            const retestItems = items.filter(ti => retestIds.has(ti.id));
            const requiredAttrs = ctrl.attributes.filter(a => a.required);
            const allReady = retestItems.every(ti => requiredAttrs.every(a => {
              const ar = ti.attributeResults.find(r => r.attributeId === a.id);
              return ar && ar.evidenceIds.length > 0;
            }));
            return allReady ? (
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => {
                    setRetestMode(null);
                    setRunning(true);
                    setTimeout(() => {
                      runAutomatedChecks();
                      setRunning(false);
                      setRetestCompletedIds(prev => new Set([...prev, ...retestIds]));
                    }, 7000);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                  <Play size={12} />Run Retest
                </button>
                <button onClick={() => setRetestMode(null)} className="px-3 py-1.5 rounded-lg border border-border text-[0.6875rem] font-medium text-text-secondary hover:bg-white cursor-pointer transition-colors">Cancel</button>
              </div>
            ) : (
              <p className="text-[0.625rem] text-blue-500">Upload evidence for all required attributes on selected samples to enable retest.</p>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Attribute Test Row ───────────────────────────────────────────────────

function AttributeTestRow({ attr, result, notes, isManual, isAuto, evidenceCount, workflowName, onSave, onAttachEvidence }: {
  attr: Attribute;
  result: AttrResult;
  notes: string;
  isManual: boolean;
  isAuto: boolean;
  evidenceCount: number;
  workflowName?: string;
  onSave: (result: AttrResult, notes: string) => void;
  onAttachEvidence: (fileName: string, evidenceType: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localResult, setLocalResult] = useState(result);
  const [localNotes, setLocalNotes] = useState(notes);
  const [showAttach, setShowAttach] = useState(false);
  const [attachType, setAttachType] = useState('');

  const ATTACH_TYPES = ['Invoice Copy', 'PO Copy', 'GRN Copy', 'Approval Log', 'Budget File', 'Historical Spend Report', 'Project Plan', 'System Report', 'Exception Report', 'Workflow Run Log', 'Override Approval', 'Other'];

  if (!editing && localResult !== result) setLocalResult(result);
  if (!editing && localNotes !== notes) setLocalNotes(notes);

  const handleSave = () => {
    if (localResult === AttrResult.FAIL && !localNotes.trim()) return;
    onSave(localResult, localNotes);
    setEditing(false);
  };

  const handleAttach = () => {
    if (!attachType) return;
    const fileName = `${attachType.replace(/\s+/g, '_')}_${attr.id.slice(-4)}.pdf`;
    onAttachEvidence(fileName, attachType);
    setAttachType(''); setShowAttach(false);
  };

  const resultStyle = (r: AttrResult) =>
    r === 'PASS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    r === 'FAIL' ? 'bg-red-50 text-red-700 border-red-200' :
    'bg-gray-50 text-gray-500 border-gray-200';

  const hasEvidence = evidenceCount > 0;

  return (
    <div className={`rounded-lg border ${result === 'FAIL' ? 'border-red-200 bg-red-50/10' : hasEvidence && result === AttrResult.NOT_TESTED ? 'border-emerald-200/50 bg-emerald-50/10' : 'border-border-light'} px-3 py-2`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[0.6875rem] font-medium text-text">{attr.name}</span>
            <span className={`px-1 py-0.5 rounded text-[0.4375rem] font-bold ${isAuto ? 'bg-evidence-50 text-evidence-700' : 'bg-gray-100 text-gray-600'}`}>
              {isAuto ? 'AUTO' : 'MANUAL'}
            </span>
            {attr.required && <span className="text-[0.4375rem] font-bold text-red-400">REQ</span>}
            {hasEvidence && <span className="px-1 py-0.5 rounded text-[0.4375rem] font-bold bg-emerald-50 text-emerald-700 flex items-center gap-0.5"><CheckCircle2 size={7} />{evidenceCount} evidence</span>}
          </div>
          <div className="flex items-center gap-2 text-[0.5625rem] text-gray-400">
            {workflowName && <span>{workflowName}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Evidence attach button */}
          <button onClick={() => setShowAttach(!showAttach)}
            className="px-1.5 py-0.5 rounded text-[0.5rem] font-semibold text-gray-400 hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors flex items-center gap-0.5"
            title={isAuto ? 'Attach Supporting Evidence' : 'Upload Evidence'}>
            <Upload size={8} />{isAuto ? 'Attach' : 'Evidence'}
          </button>

          {/* Result */}
          {!editing ? (
            <>
              <span className={`px-2 py-0.5 rounded border text-[0.5625rem] font-bold ${resultStyle(result)}`}>
                {result === 'PASS' ? 'Pass' : result === 'FAIL' ? 'Fail' : 'Not Tested'}
              </span>
              {isManual && result === AttrResult.NOT_TESTED && (
                <button onClick={() => setEditing(true)}
                  className="px-2 py-1 rounded text-[0.5625rem] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer">
                  Test
                </button>
              )}
              {isManual && result !== AttrResult.NOT_TESTED && (
                <button onClick={() => setEditing(true)}
                  className="px-1.5 py-0.5 rounded text-[0.5rem] text-gray-400 hover:text-primary cursor-pointer">
                  Edit
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setLocalResult(AttrResult.PASS)}
                className={`px-2 py-1 rounded text-[0.5625rem] font-bold cursor-pointer transition-colors ${localResult === 'PASS' ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-gray-100 text-gray-500 hover:bg-emerald-50'}`}>Pass</button>
              <button onClick={() => setLocalResult(AttrResult.FAIL)}
                className={`px-2 py-1 rounded text-[0.5625rem] font-bold cursor-pointer transition-colors ${localResult === 'FAIL' ? 'bg-red-100 text-red-800 ring-1 ring-red-300' : 'bg-gray-100 text-gray-500 hover:bg-red-50'}`}>Fail</button>
            </div>
          )}
        </div>
      </div>

      {/* Attach Evidence Inline */}
      {showAttach && (
        <div className="mt-2 rounded border border-primary/20 bg-primary/5 p-2 flex items-center gap-2">
          <select value={attachType} onChange={e => setAttachType(e.target.value)} className="flex-1 px-2 py-1 border border-border rounded text-[0.625rem] bg-white outline-none cursor-pointer">
            <option value="">Select evidence type...</option>
            {ATTACH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={handleAttach} disabled={!attachType}
            className="px-2 py-1 rounded bg-primary text-white text-[0.5625rem] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5"><Upload size={8} />Add</button>
          <button onClick={() => { setShowAttach(false); setAttachType(''); }} className="px-2 py-1 rounded border border-border text-[0.5625rem] text-gray-500 cursor-pointer">Cancel</button>
        </div>
      )}

      {/* Edit area */}
      {editing && (
        <div className="mt-2 space-y-2">
          <input value={localNotes} onChange={e => setLocalNotes(e.target.value)}
            placeholder={localResult === 'FAIL' ? 'Notes required for failures...' : 'Optional notes...'}
            className="w-full px-2 py-1.5 border border-border rounded text-[0.6875rem] text-text outline-none focus:border-primary/40" />
          {localResult === AttrResult.FAIL && !localNotes.trim() && (
            <span className="text-[0.5625rem] text-red-500 block">Notes are required when marking an attribute as failed.</span>
          )}
          <div className="flex items-center gap-1.5">
            <button onClick={handleSave}
              disabled={localResult === AttrResult.NOT_TESTED || (localResult === AttrResult.FAIL && !localNotes.trim())}
              className="px-2.5 py-1 rounded bg-primary hover:bg-primary/90 text-white text-[0.625rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
            <button onClick={() => { setEditing(false); setLocalResult(result); setLocalNotes(notes); }}
              className="px-2.5 py-1 rounded border border-border text-[0.625rem] text-text-secondary hover:bg-white cursor-pointer transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {!editing && notes && (
        <p className="mt-1 text-[0.625rem] text-gray-500 italic">{notes}</p>
      )}
    </div>
  );
}

// ─── Working Paper Step ───────────────────────────────────────────────────

function WorkingPaperStep({ ctrl, controlType, onNavigate }: {
  ctrl: ExecutionControl;
  controlType: DerivedControlType;
  onNavigate: (stepId: string) => void;
}) {
  const exec = ctrl.execution;
  const progress = deriveTestingProgress(ctrl);
  const items = exec.testItems;
  const hasItems = items.length > 0;
  const isConcluded = exec.status === ControlExecStatus.CONCLUDED;
  const isReviewed = exec.review.status === ReviewStatus.APPROVED;
  const isRejected = exec.review.status === ReviewStatus.REJECTED;
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(null);
  const [expandedEvidenceSampleId, setExpandedEvidenceSampleId] = useState<string | null>(null);

  // Before testing has started
  if (!hasItems) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText size={24} className="text-gray-300 mb-3" />
        <h4 className="text-[0.875rem] font-semibold text-text mb-1">Working Paper</h4>
        <p className="text-[0.75rem] text-text-muted">Working paper will be generated as testing progresses.</p>
      </div>
    );
  }

  // Build attribute legend: A, B, C...
  const attrLegend = ctrl.attributes.map((a, i) => {
    const code = String.fromCharCode(65 + i); // A, B, C...
    const wm = ctrl.workflowMappings.find(w => w.mappedAttributeIds.includes(a.id));
    return { code, attr: a, workflowName: wm?.workflowName || '—', workflowVersion: wm?.version || '' };
  });
  const attrCodeMap = new Map(attrLegend.map(l => [l.attr.id, l.code]));

  // Counts
  const totalChecks = items.length * ctrl.attributes.length;
  const totalEvidence = items.reduce((s, ti) => s + ti.evidence.length, 0);
  const passedSamples = items.filter(i => i.sampleResult === 'PASS').length;
  const failedSamples = items.filter(i => i.sampleResult === 'FAIL').length;
  const pendingSamples = items.filter(i => i.sampleResult === 'PENDING').length;

  // Section component
  const Section = ({ num, title, children }: { num: number; title: string; children: React.ReactNode }) => (
    <div className="border-b border-border-light pb-4">
      <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[0.5625rem] font-bold inline-flex items-center justify-center">{num}</span>
        {title}
      </h5>
      {children}
    </div>
  );

  const attrResultStyle = (r: string) =>
    r === 'PASS' ? 'text-emerald-700 bg-emerald-50' : r === 'FAIL' ? 'text-red-700 bg-red-50' : r === 'NOT_APPLICABLE' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 bg-gray-50';
  const attrResultLabel = (r: string) =>
    r === 'PASS' ? 'P' : r === 'FAIL' ? 'F' : r === 'NOT_APPLICABLE' ? 'N/A' : '—';

  const sampleResultStyle = (r: string) =>
    r === 'PASS' ? 'bg-emerald-50 text-emerald-700' : r === 'FAIL' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500';
  const sampleResultLabel = (r: string) =>
    r === 'PASS' ? 'Pass' : r === 'FAIL' ? 'Fail' : 'Pending';

  const reviewLabel = exec.review.status === 'APPROVED' ? 'Approved' : exec.review.status === 'REJECTED' ? 'Rejected' : exec.review.status === 'PENDING' ? 'Pending' : 'Not Submitted';
  const reviewStyle = exec.review.status === 'APPROVED' ? 'text-emerald-700' : exec.review.status === 'REJECTED' ? 'text-red-700' : 'text-gray-500';
  const conclusionLabel = exec.conclusion.value === 'EFFECTIVE' ? 'Effective' : exec.conclusion.value === 'INEFFECTIVE' ? 'Ineffective' : 'Pending';

  return (
    <div className="space-y-5">
      <button onClick={() => onNavigate('attr-testing')} className="flex items-center gap-1 text-[0.6875rem] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors">
        <ArrowLeft size={12} />Back to Attribute Testing
      </button>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-[0.875rem] font-bold text-text">Working Paper</h4>
            <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${isReviewed ? 'bg-emerald-50 text-emerald-700' : isRejected ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
              {isReviewed ? 'Reviewed' : isRejected ? 'Rejected' : 'Not Reviewed'}
            </span>
          </div>
          <p className="text-[0.6875rem] text-text-muted">System-generated audit documentation for this control test instance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = '/working-paper-final.pdf';
              a.download = `Working Paper — ${ctrl.name}.pdf`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.6875rem] font-semibold cursor-pointer hover:bg-primary/20 flex items-center gap-1.5 transition-colors">
            <Download size={12} />Download
          </button>
          <button disabled={!isConcluded}
            onClick={() => {
              if (!isConcluded) return;
              const a = document.createElement('a');
              a.href = '/working-paper-final.pdf';
              a.download = `Working Paper Final — ${ctrl.name}.pdf`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            className={`px-3 py-1.5 rounded-lg text-[0.6875rem] font-semibold flex items-center gap-1.5 transition-colors ${isConcluded ? 'bg-primary hover:bg-primary/90 text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'}`}
            title={isConcluded ? 'Download final working paper' : 'Final download available after conclusion'}>
            <Download size={12} />Final
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-gray-50 border border-border-light text-[0.625rem] text-text font-medium">Samples: <span className="font-bold tabular-nums">{items.length}</span></span>
        <span className="px-2.5 py-1 rounded-lg bg-gray-50 border border-border-light text-[0.625rem] text-text font-medium">Attributes: <span className="font-bold tabular-nums">{ctrl.attributes.length}</span></span>
        <span className="px-2.5 py-1 rounded-lg bg-gray-50 border border-border-light text-[0.625rem] text-text font-medium">Checks: <span className="font-bold tabular-nums">{totalChecks}</span></span>
        <span className="px-2.5 py-1 rounded-lg bg-gray-50 border border-border-light text-[0.625rem] text-text font-medium">Evidence: <span className="font-bold tabular-nums">{totalEvidence} files</span></span>
        <span className={`px-2.5 py-1 rounded-lg border text-[0.625rem] font-medium ${isReviewed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : isRejected ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-border-light text-gray-500'}`}>
          Result: <span className="font-bold">{reviewLabel}</span>
        </span>
        <span className={`px-2.5 py-1 rounded-lg border text-[0.625rem] font-medium ${exec.conclusion.value === 'EFFECTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : exec.conclusion.value === 'INEFFECTIVE' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-border-light text-gray-500'}`}>
          Conclusion: <span className="font-bold">{conclusionLabel}</span>
        </span>
      </div>

      {/* Paper content */}
      <div className="rounded-xl border border-border-light bg-white p-5 space-y-4">

        {/* 1. Header */}
        <Section num={1} title="Header">
          <div className="grid grid-cols-3 gap-3 text-[0.6875rem]">
            <div><span className="text-gray-400 block text-[0.625rem]">Control</span><span className="text-text font-medium">{ctrl.id.replace('exec-', '')} — {ctrl.name}</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Process</span><span className="text-text font-medium">{ctrl.process}</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Owner</span><span className="text-text font-medium">{ctrl.owner}</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Importance</span><span className="text-text font-medium">{ctrl.importanceClass === 'KEY' ? 'Key' : 'Non-Key'}</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Nature</span><span className="text-text font-medium">{ctrl.natureClass.charAt(0) + ctrl.natureClass.slice(1).toLowerCase()}</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Control Type</span><span className="text-text font-medium">{controlType}</span></div>
          </div>
        </Section>

        {/* 2. Control Objective */}
        <Section num={2} title="Control Objective">
          <p className="text-[0.6875rem] text-text leading-relaxed">{ctrl.description}</p>
        </Section>

        {/* 3. Test Design */}
        <Section num={3} title="Test Design">
          <div className="space-y-2 text-[0.6875rem]">
            <div>
              <span className="text-gray-400 text-[0.625rem]">Assertions:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {ctrl.assertions.map(a => (
                  <span key={a.id} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[0.5625rem] font-bold">{a.name}</span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-400 text-[0.625rem]">Workflows ({ctrl.workflowMappings.length}):</span>
              <div className="mt-1 space-y-0.5">
                {ctrl.workflowMappings.map(wm => (
                  <div key={wm.workflowId} className="text-[0.625rem] text-text">{wm.workflowName} {wm.version} — {wm.mappedAttributeIds.length} attribute{wm.mappedAttributeIds.length !== 1 ? 's' : ''}</div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* 4. Attribute-Level Testing Summary */}
        <Section num={4} title="Attribute-Level Testing Summary">
          <p className="text-[0.5625rem] text-gray-400 mb-3">Testing was performed sample-wise. This summary shows how each required attribute performed across all tested samples.</p>
          <div className="rounded-lg border border-border-light overflow-hidden">
            <table className="w-full text-[0.625rem]">
              <thead><tr className="border-b border-border-light bg-surface-2/30">
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase w-8">Code</th>
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">Assertion</th>
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">Attribute</th>
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">Workflow</th>
                <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase">Samples Tested</th>
                <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase">Passed</th>
                <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase">Failed</th>
                <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase">Pass Rate</th>
                <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">Evidence Req</th>
                <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase">Status</th>
              </tr></thead>
              <tbody>
                {attrLegend.map(l => {
                  const evReq = l.attr.type === 'AUTOMATED' ? 'System + User' : 'User Evidence';
                  // Derive per-attribute pass/fail across all samples
                  const totalSamples = items.length;
                  let passed = 0;
                  let failed = 0;
                  let tested = 0;
                  items.forEach(ti => {
                    const ar = ti.attributeResults.find(r => r.attributeId === l.attr.id);
                    if (ar && ar.result !== 'NOT_TESTED') {
                      tested++;
                      if (ar.result === 'PASS') passed++;
                      if (ar.result === 'FAIL') failed++;
                    }
                  });
                  const passRate = tested > 0 ? Math.round((passed / tested) * 100) : 0;
                  const status = tested < totalSamples ? 'Incomplete' : failed > 0 ? 'Exception Noted' : 'Passed';
                  return (
                    <tr key={l.attr.id} className="border-b border-border-light/50">
                      <td className="px-2 py-1.5 font-bold text-primary">{l.code}</td>
                      <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[0.5rem] font-bold">{l.attr.assertionName}</span></td>
                      <td className="px-2 py-1.5 text-text">{l.attr.name}</td>
                      <td className="px-2 py-1.5 text-gray-500">{l.workflowName} {l.workflowVersion}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums text-text">{tested}/{totalSamples}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums text-emerald-600 font-medium">{passed}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums text-red-600 font-medium">{failed}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums text-text font-medium">{tested > 0 ? `${passRate}%` : '—'}</td>
                      <td className="px-2 py-1.5 text-gray-500 text-[0.5625rem]">{evReq}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[0.4375rem] font-bold ${
                          status === 'Passed' ? 'bg-emerald-50 text-emerald-700' :
                          status === 'Exception Noted' ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 5. Sample Data Summary */}
        <Section num={5} title="Sample Data Summary">
          <div className="grid grid-cols-3 gap-3 text-[0.6875rem]">
            <div><span className="text-gray-400 block text-[0.625rem]">Sample Count</span><span className="text-text font-medium tabular-nums">{items.length}</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Source</span><span className="text-text font-medium">Uploaded sample data</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Attributes per Sample</span><span className="text-text font-medium tabular-nums">{ctrl.attributes.length}</span></div>
          </div>
        </Section>

        {/* 6. Evidence Coverage Matrix */}
        <Section num={6} title="Evidence Coverage Matrix">
          <p className="text-[0.5625rem] text-gray-400 mb-2">Attribute columns (A/B/C) show user-uploaded files. System Evidence shows workflow-generated logs and reports.</p>
          {items.some(ti => ti.evidence.length > 0) ? (
            <div className="rounded-lg border border-border-light overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[0.625rem]">
                  <thead><tr className="border-b border-border-light bg-surface-2/30">
                    <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase w-5"></th>
                    <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">Sample</th>
                    <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">Reference</th>
                    {attrLegend.map(l => (
                      <th key={l.attr.id} className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase" title={l.attr.name}>
                        <div className="flex flex-col items-center">
                          <span className="text-primary font-bold text-[0.5625rem]">{l.code}</span>
                          <span className="text-[0.375rem] text-gray-400 font-normal">files</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase">
                      <div className="flex flex-col items-center">
                        <span>System</span>
                        <span className="text-[0.375rem] text-gray-400 font-normal">logs</span>
                      </div>
                    </th>
                    <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase">Status</th>
                  </tr></thead>
                  <tbody>
                    {items.slice(0, 20).map(ti => {
                      const isEvExpanded = expandedEvidenceSampleId === ti.id;
                      // Count user-uploaded evidence per attribute code (exclude system)
                      const userEvByAttr = new Map<string, number>();
                      let systemEvCount = 0;
                      ti.evidence.forEach(ev => {
                        const isSystem = ev.uploadedBy === 'System';
                        if (isSystem) {
                          systemEvCount++;
                        } else {
                          ev.mappedAttributeIds.forEach(aId => {
                            const code = attrCodeMap.get(aId);
                            if (code) userEvByAttr.set(code, (userEvByAttr.get(code) || 0) + 1);
                          });
                        }
                      });
                      // Status: check that each attribute has at least some evidence (user or system)
                      const attrWithAnyEv = attrLegend.filter(l => {
                        const userCount = userEvByAttr.get(l.code) || 0;
                        // System evidence mapped to this attr
                        const sysCount = ti.evidence.filter(ev => ev.uploadedBy === 'System' && ev.mappedAttributeIds.some(aId => attrCodeMap.get(aId) === l.code)).length;
                        return userCount > 0 || sysCount > 0;
                      }).length;
                      const evStatus = ti.evidence.length === 0 ? 'Missing' : attrWithAnyEv === attrLegend.length ? 'Complete' : 'Partial';
                      const evStatusCls = evStatus === 'Complete' ? 'bg-emerald-50 text-emerald-700' : evStatus === 'Partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600';
                      return (
                        <React.Fragment key={ti.id}>
                          <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 transition-colors ${isEvExpanded ? 'bg-surface-2/20' : ''}`}
                            onClick={() => setExpandedEvidenceSampleId(isEvExpanded ? null : ti.id)}>
                            <td className="px-2 py-1.5 text-gray-400">
                              {isEvExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                            </td>
                            <td className="px-2 py-1.5 font-mono text-gray-500">{ti.referenceId}</td>
                            <td className="px-2 py-1.5 text-text text-[0.5625rem] truncate max-w-[120px]" title={ti.description}>{ti.description || '—'}</td>
                            {attrLegend.map(l => {
                              const count = userEvByAttr.get(l.code) || 0;
                              return (
                                <td key={l.attr.id} className="px-2 py-1.5 text-center">
                                  <span className={`text-[0.5rem] font-medium ${count > 0 ? 'text-text' : 'text-gray-300'}`}>
                                    {count}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-center">
                              <span className={`text-[0.5rem] font-medium ${systemEvCount > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                                {systemEvCount}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[0.4375rem] font-bold ${evStatusCls}`}>{evStatus}</span>
                            </td>
                          </tr>
                          {isEvExpanded && ti.evidence.length > 0 && (
                            <tr><td colSpan={attrLegend.length + 5} className="p-0">
                              <div className="bg-surface-2/15 px-4 py-2 border-b border-border-light space-y-2">
                                {/* User-uploaded evidence */}
                                {ti.evidence.filter(ev => ev.uploadedBy !== 'System').length > 0 && (
                                  <div>
                                    <div className="text-[0.4375rem] font-semibold text-gray-400 uppercase mb-1">User Evidence</div>
                                    <table className="w-full text-[0.5625rem]">
                                      <tbody>
                                        {ti.evidence.filter(ev => ev.uploadedBy !== 'System').map(ev => {
                                          const mappedCodes = ev.mappedAttributeIds.map(aId => attrCodeMap.get(aId) || '?').join(', ') || '—';
                                          return (
                                            <tr key={ev.id} className="border-t border-border-light/20">
                                              <td className="py-1 pr-2 font-bold text-primary w-10">{mappedCodes}</td>
                                              <td className="py-1 pr-2 text-gray-500 w-28">{ev.evidenceType}</td>
                                              <td className="py-1 text-text truncate max-w-[200px]" title={ev.fileName}>{ev.fileName}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                {/* System-generated evidence */}
                                {ti.evidence.filter(ev => ev.uploadedBy === 'System').length > 0 && (
                                  <div>
                                    <div className="text-[0.4375rem] font-semibold text-blue-500 uppercase mb-1">System Evidence</div>
                                    <table className="w-full text-[0.5625rem]">
                                      <tbody>
                                        {ti.evidence.filter(ev => ev.uploadedBy === 'System').map(ev => {
                                          const mappedCodes = ev.mappedAttributeIds.map(aId => attrCodeMap.get(aId) || '?').join(', ') || '—';
                                          return (
                                            <tr key={ev.id} className="border-t border-border-light/20">
                                              <td className="py-1 pr-2 font-bold text-primary w-10">{mappedCodes}</td>
                                              <td className="py-1 pr-2 text-blue-500 w-28">{ev.evidenceType}</td>
                                              <td className="py-1 text-blue-600 truncate max-w-[200px]" title={ev.fileName}>{ev.fileName}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {items.length > 20 && <div className="px-2 py-1 text-[0.5625rem] text-gray-400 bg-surface-2/20">Showing 20 of {items.length} items</div>}
            </div>
          ) : (
            <div className="text-[0.6875rem] text-gray-400 italic">No evidence uploaded.</div>
          )}
        </Section>

        {/* 7. Attribute Testing Matrix */}
        <Section num={7} title="Attribute Testing Matrix">
          <div className="rounded-lg border border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.625rem]">
                <thead><tr className="border-b border-border-light bg-surface-2/30">
                  <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">Sample</th>
                  <th className="px-2 py-1.5 text-left text-[0.5rem] font-semibold text-gray-400 uppercase">Reference</th>
                  {attrLegend.map(l => (
                    <th key={l.attr.id} className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase" title={l.attr.name}>
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-[0.5625rem]">{l.code}</span>
                        <span className="text-[0.4375rem] text-gray-400 leading-tight max-w-[60px] truncate">{l.attr.name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center text-[0.5rem] font-semibold text-gray-400 uppercase">Result</th>
                </tr></thead>
                <tbody>
                  {items.slice(0, 20).map(ti => (
                    <tr key={ti.id} className="border-b border-border-light/50">
                      <td className="px-2 py-1 font-mono text-gray-500">{ti.referenceId}</td>
                      <td className="px-2 py-1 text-text text-[0.5625rem] truncate max-w-[120px]" title={ti.description}>{ti.description || '—'}</td>
                      {attrLegend.map(l => {
                        const ar = ti.attributeResults.find(r => r.attributeId === l.attr.id);
                        const r = ar?.result || 'NOT_TESTED';
                        return (
                          <td key={l.attr.id} className="px-2 py-1 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${attrResultStyle(r)}`}>
                              {attrResultLabel(r)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${sampleResultStyle(ti.sampleResult)}`}>
                          {sampleResultLabel(ti.sampleResult)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length > 20 && <div className="px-2 py-1 text-[0.5625rem] text-gray-400 bg-surface-2/20">Showing 20 of {items.length} items</div>}
          </div>
          <div className="mt-1.5 text-[0.5625rem] text-gray-400">P = Attribute satisfied · F = Attribute not satisfied · — = Not tested · N/A = Not applicable</div>
        </Section>

        {/* 8. Sample-Level Testing Details */}
        <Section num={8} title="Sample-Level Testing Details">
          <div className="space-y-1">
            {items.slice(0, 20).map(ti => {
              const isExpanded = expandedSampleId === ti.id;
              // Compact inline summary: A:P B:F C:—
              const attrSummary = attrLegend.map(l => {
                const ar = ti.attributeResults.find(r => r.attributeId === l.attr.id);
                return { code: l.code, result: ar?.result || 'NOT_TESTED' };
              });
              const evCoveredCount = attrLegend.filter(l => {
                const ar = ti.attributeResults.find(r => r.attributeId === l.attr.id);
                return (ar?.evidenceIds?.length || 0) > 0;
              }).length;
              const evLabel = evCoveredCount === attrLegend.length ? 'Complete' : evCoveredCount > 0 ? 'Partial' : 'Missing';
              const evLabelCls = evLabel === 'Complete' ? 'text-emerald-600' : evLabel === 'Partial' ? 'text-amber-600' : 'text-gray-400';
              return (
                <div key={ti.id} className="rounded-lg border border-border-light overflow-hidden">
                  <button onClick={() => setExpandedSampleId(isExpanded ? null : ti.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-2/20 cursor-pointer transition-colors">
                    {isExpanded ? <ChevronDown size={9} className="text-gray-400 shrink-0" /> : <ChevronRight size={9} className="text-gray-400 shrink-0" />}
                    <span className="text-[0.625rem] font-mono text-gray-500 shrink-0 w-[70px]">{ti.referenceId}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold shrink-0 ${sampleResultStyle(ti.sampleResult)}`}>
                      {sampleResultLabel(ti.sampleResult)}
                    </span>
                    <span className={`text-[0.5rem] font-medium shrink-0 ${evLabelCls}`}>Ev: {evLabel}</span>
                    <span className="flex items-center gap-1 ml-auto shrink-0">
                      {attrSummary.map(a => (
                        <span key={a.code} className={`px-1 py-0.5 rounded text-[0.4375rem] font-bold ${attrResultStyle(a.result)}`}>
                          {a.code}:{attrResultLabel(a.result)}
                        </span>
                      ))}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border-light bg-surface-2/15 px-3 py-2">
                      <table className="w-full text-[0.625rem]">
                        <thead><tr className="text-[0.5rem] font-semibold text-gray-400 uppercase">
                          <th className="text-left py-1 pr-2">Code</th>
                          <th className="text-left py-1 pr-2">Attribute</th>
                          <th className="text-left py-1 pr-2">Assertion</th>
                          <th className="text-center py-1 pr-2">Result</th>
                          <th className="text-center py-1 pr-2">User Ev</th>
                          <th className="text-center py-1 pr-2">Sys Ev</th>
                          <th className="text-left py-1">Notes</th>
                        </tr></thead>
                        <tbody>
                          {attrLegend.map(l => {
                            const ar = ti.attributeResults.find(r => r.attributeId === l.attr.id);
                            const r = ar?.result || 'NOT_TESTED';
                            const evIds = ar?.evidenceIds || [];
                            const userEvCount = evIds.filter(eid => {
                              const ev = ti.evidence.find(e => e.id === eid);
                              return ev && ev.uploadedBy !== 'System';
                            }).length;
                            const sysEvCount = evIds.filter(eid => {
                              const ev = ti.evidence.find(e => e.id === eid);
                              return ev && ev.uploadedBy === 'System';
                            }).length;
                            return (
                              <tr key={l.attr.id} className="border-t border-border-light/30">
                                <td className="py-1 pr-2 font-bold text-primary">{l.code}</td>
                                <td className="py-1 pr-2 text-text">{l.attr.name}</td>
                                <td className="py-1 pr-2"><span className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[0.4375rem] font-bold">{l.attr.assertionName}</span></td>
                                <td className="py-1 pr-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${attrResultStyle(r)}`}>{attrResultLabel(r)}</span></td>
                                <td className="py-1 pr-2 text-center text-gray-500">{userEvCount > 0 ? `${userEvCount} file${userEvCount !== 1 ? 's' : ''}` : '—'}</td>
                                <td className="py-1 pr-2 text-center text-blue-500">{sysEvCount > 0 ? `${sysEvCount} log${sysEvCount !== 1 ? 's' : ''}` : '—'}</td>
                                <td className="py-1 text-gray-500 truncate max-w-[150px]" title={ar?.notes || ''}>{ar?.notes || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {items.length > 20 && <div className="text-[0.5625rem] text-gray-400">Showing 20 of {items.length} samples</div>}
          </div>
        </Section>

        {/* 9. Sample Results */}
        <Section num={9} title="Sample Results">
          <div className="flex items-center gap-4 mb-2 text-[0.6875rem]">
            <span className="text-emerald-600 font-semibold">{passedSamples} passed</span>
            <span className="text-red-600 font-semibold">{failedSamples} failed</span>
            <span className="text-gray-500 font-semibold">{pendingSamples} pending</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map(ti => (
              <div key={ti.id} className={`px-2 py-1 rounded text-[0.5625rem] font-bold ${sampleResultStyle(ti.sampleResult)}`}>
                {ti.referenceId}: {sampleResultLabel(ti.sampleResult)}
              </div>
            ))}
          </div>
          {failedSamples > 0 && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[0.625rem] text-amber-700">
              Control cannot be concluded effective unless reviewer accepts documented exception/override.
            </div>
          )}
        </Section>

        {/* 10. Review & Approval */}
        <Section num={10} title="Review & Approval">
          <div className="text-[0.6875rem] space-y-1">
            <div className="flex items-center gap-4">
              <span><span className="text-gray-400">Status:</span> <span className={`font-semibold ${reviewStyle}`}>{reviewLabel}</span></span>
              {exec.review.reviewer && <span><span className="text-gray-400">Reviewer:</span> <span className="text-text">{exec.review.reviewer}</span></span>}
              {exec.review.reviewedAt && <span><span className="text-gray-400">Date:</span> <span className="text-text">{exec.review.reviewedAt}</span></span>}
            </div>
            {exec.review.comments && <p className="text-text italic">"{exec.review.comments}"</p>}
            {isRejected && (
              <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[0.625rem] text-red-700">
                Reviewer rejected this working paper. Tester must fix issues and resubmit.
              </div>
            )}
          </div>
        </Section>

        {/* 11. Final Conclusion */}
        <div>
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[0.5625rem] font-bold inline-flex items-center justify-center">11</span>
            Final Conclusion
          </h5>
          {exec.conclusion.value ? (
            <div className={`px-3 py-2 rounded-lg text-[0.75rem] font-semibold ${exec.conclusion.value === 'EFFECTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {exec.conclusion.value === 'EFFECTIVE' ? 'Effective' : 'Ineffective'}
              {exec.conclusion.reason && <span className="font-normal text-[0.6875rem] ml-2">— {exec.conclusion.reason}</span>}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-gray-50 text-[0.6875rem] text-gray-500 italic">
              Conclusion unavailable — reviewer approval required before conclusion can be set.
            </div>
          )}
        </div>
      </div>

      {/* Next CTA */}
      {progress.completionPercent === 100 && exec.review.status === 'NOT_SUBMITTED' && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-center justify-between">
          <span className="text-[0.6875rem] text-primary">Testing complete. Submit for review to finalize.</span>
          <button onClick={() => onNavigate('review')}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">
            Review<ChevronRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Review Step ─────────────────────────────────────────────────────────

function ReviewStep({ ctrl, onUpdateControl, onNavigate }: {
  ctrl: ExecutionControl;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
}) {
  const exec = ctrl.execution;
  const progress = deriveTestingProgress(ctrl);
  const items = exec.testItems;
  const [comments, setComments] = useState(exec.review.comments);

  const isPending = exec.review.status === ReviewStatus.PENDING;
  const isApproved = exec.review.status === ReviewStatus.APPROVED;
  const isRejected = exec.review.status === ReviewStatus.REJECTED;
  const canSubmit = exec.review.status === ReviewStatus.NOT_SUBMITTED || isRejected;
  const isIncomplete = progress.completionPercent < 100;

  const passedSamples = items.filter(i => i.sampleResult === SampleResult.PASS).length;
  const failedSamples = items.filter(i => i.sampleResult === SampleResult.FAIL).length;
  const pendingSamples = items.filter(i => i.sampleResult === SampleResult.PENDING).length;
  const failedAttrs = items.flatMap(ti => ti.attributeResults).filter(ar => ar.result === AttrResult.FAIL);

  // Submit for review
  const handleSubmit = () => {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        status: ControlExecStatus.PENDING_REVIEW,
        review: { ...prev.execution.review, status: ReviewStatus.PENDING, submittedAt: now },
        workingPaper: { ...prev.execution.workingPaper, status: WorkingPaperStatus.GENERATED },
      },
    }));
  };

  // Approve
  const handleApprove = () => {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    onUpdateControl(prev => {
      const updatedReview = {
        ...prev.execution.review,
        status: ReviewStatus.APPROVED as typeof ReviewStatus.APPROVED,
        reviewedAt: now,
        reviewer: 'Audit Lead',
        comments,
      };
      // Derive conclusion via helper
      const tempCtrl = { ...prev, execution: { ...prev.execution, review: updatedReview } };
      const conclusionValue = deriveControlConclusion(tempCtrl);
      return {
        ...prev,
        execution: {
          ...prev.execution,
          status: ControlExecStatus.CONCLUDED,
          review: updatedReview,
          conclusion: {
            value: conclusionValue,
            reason: conclusionValue === 'EFFECTIVE' ? 'All test items passed required attribute checks.' : conclusionValue === 'INEFFECTIVE' ? 'One or more test items failed required attribute checks.' : '',
            generatedAt: now,
          },
          workingPaper: { ...prev.execution.workingPaper, status: WorkingPaperStatus.FINAL, finalDownloadEnabled: true },
        },
      };
    });
  };

  // Send back
  const handleSendBack = () => {
    if (!comments.trim()) return;
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        status: ControlExecStatus.REJECTED,
        review: { ...prev.execution.review, status: ReviewStatus.REJECTED, reviewedAt: now, reviewer: 'Audit Lead', comments },
      },
    }));
  };

  // ── Submit / Resubmit State ──
  if (canSubmit) {
    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-[0.875rem] font-bold text-text mb-1">{isRejected ? 'Resubmit for Review' : 'Submit for Review'}</h4>
          <p className="text-[0.75rem] text-text-muted">{isRejected ? 'Fix the issues noted by the reviewer and resubmit.' : 'Submit this control\'s test results to the reviewer for approval.'}</p>
        </div>

        {/* Previous rejection notice */}
        {isRejected && exec.review.comments && (
          <div className="rounded-lg border border-red-200/50 bg-red-50/20 p-3 flex items-start gap-2">
            <RotateCcw size={12} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-[0.6875rem] text-red-700">
              <strong>Previous reviewer feedback:</strong> "{exec.review.comments}"
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="rounded-lg border border-border-light p-4 space-y-3">
          <h5 className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider">Test Summary</h5>
          <div className="grid grid-cols-4 gap-3 text-[0.6875rem]">
            <div><span className="text-gray-400 block text-[0.625rem]">Test Items</span><span className="text-text font-medium tabular-nums">{items.length}</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Completion</span><span className="text-text font-medium tabular-nums">{progress.completionPercent}%</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Passed</span><span className="text-emerald-700 font-medium tabular-nums">{passedSamples}</span></div>
            <div><span className="text-gray-400 block text-[0.625rem]">Failed</span><span className={`font-medium tabular-nums ${failedSamples > 0 ? 'text-red-700' : 'text-gray-400'}`}>{failedSamples}</span></div>
          </div>
        </div>

        {/* Incomplete warning */}
        {isIncomplete && (
          <div className="rounded-lg border border-amber-200/50 bg-amber-50/20 p-3 flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[0.6875rem] text-amber-700">
              <strong>Warning:</strong> {progress.totalAttributeChecks - progress.completedAttributeChecks} attribute check{progress.totalAttributeChecks - progress.completedAttributeChecks !== 1 ? 's' : ''} incomplete. Reviewer may reject this submission.
            </div>
          </div>
        )}

        {/* Failed attributes */}
        {failedAttrs.length > 0 && (
          <div className="rounded-lg border border-red-200/50 bg-red-50/20 p-3">
            <h5 className="text-[0.625rem] font-bold text-red-700 uppercase tracking-wider mb-1.5">Failed Attributes ({failedAttrs.length})</h5>
            <div className="space-y-1">
              {failedAttrs.slice(0, 5).map((fa, i) => {
                const attr = ctrl.attributes.find(a => a.id === fa.attributeId);
                return (
                  <div key={i} className="text-[0.625rem] text-red-700">{attr?.name || fa.attributeId}: {fa.notes || 'No notes'}</div>
                );
              })}
              {failedAttrs.length > 5 && <div className="text-[0.625rem] text-red-500">+{failedAttrs.length - 5} more</div>}
            </div>
          </div>
        )}

        <button onClick={handleSubmit}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
          <Send size={13} />{isRejected ? 'Resubmit for Review' : 'Submit for Review'}
        </button>
      </div>
    );
  }

  // ── Pending Review State (Reviewer Decision Screen) ──
  if (isPending) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <h4 className="text-[0.875rem] font-bold text-text">Review Pending</h4>
          <span className="text-[0.6875rem] text-gray-400">Submitted {exec.review.submittedAt}</span>
        </div>

        {/* Embedded Working Paper for reviewer */}
        <WorkingPaperStep ctrl={ctrl} controlType={deriveControlType(ctrl)} onNavigate={onNavigate} />

        {/* Reviewer decision section */}
        <div className="rounded-xl border-2 border-purple-200/40 bg-purple-50/10 p-5 space-y-4">
          <h5 className="text-[0.75rem] font-bold text-text flex items-center gap-2">
            <ClipboardCheck size={14} className="text-purple-600" />
            Reviewer Decision
          </h5>

          {/* Failed attributes warning */}
          {failedAttrs.length > 0 && (
            <div className="rounded-lg border border-red-200/50 bg-red-50/10 p-3">
              <h6 className="text-[0.625rem] font-bold text-red-700 uppercase tracking-wider mb-1.5">Failed Attributes ({failedAttrs.length})</h6>
              <div className="space-y-1">
                {failedAttrs.map((fa, i) => {
                  const attr = ctrl.attributes.find(a => a.id === fa.attributeId);
                  const item = items.find(ti => ti.attributeResults.some(ar => ar === fa));
                  return (
                    <div key={i} className="flex items-start gap-2 text-[0.625rem]">
                      <X size={10} className="text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-text font-medium">{attr?.name || fa.attributeId}</span>
                        {item && <span className="text-gray-400 ml-1">({item.referenceId})</span>}
                        {fa.notes && <span className="text-gray-500 ml-1">— {fa.notes}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reviewer comments */}
          <div>
            <label className="text-[0.625rem] font-semibold text-gray-500 block mb-1.5">Reviewer Comments</label>
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3}
              placeholder="Add review comments..."
              className="w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 resize-none" />
          </div>

          {/* Reviewer Actions */}
          <div className="flex items-center gap-3">
            <button onClick={handleApprove}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
              <CheckCircle2 size={13} />Approve
            </button>
            <button onClick={handleSendBack} disabled={!comments.trim()}
              className="px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <RotateCcw size={13} />Send Back
            </button>
            {!comments.trim() && (
              <span className="text-[0.625rem] text-gray-400 italic">Comments required to send back</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Approved State ──
  if (isApproved) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border-2 border-emerald-200/50 bg-emerald-50/20 p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <div>
              <h4 className="text-[0.875rem] font-bold text-emerald-800">Review Approved</h4>
              <p className="text-[0.6875rem] text-emerald-600 mt-0.5">Reviewed by {exec.review.reviewer} on {exec.review.reviewedAt}</p>
            </div>
          </div>
          {exec.review.comments && (
            <p className="text-[0.6875rem] text-emerald-700 mt-2 italic">"{exec.review.comments}"</p>
          )}
        </div>
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-center justify-between">
          <span className="text-[0.6875rem] text-primary">Review approved. Conclusion has been set.</span>
          <button onClick={() => onNavigate('conclusion')}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">
            View Conclusion<ChevronRight size={10} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Conclusion Step ──────────────────────────────────────────────────────

function ConclusionStep({ ctrl, onNavigate }: {
  ctrl: ExecutionControl;
  onNavigate: (stepId: string) => void;
}) {
  const exec = ctrl.execution;
  const conclusion = exec.conclusion;
  const items = exec.testItems;
  const passedSamples = items.filter(i => i.sampleResult === SampleResult.PASS).length;
  const failedSamples = items.filter(i => i.sampleResult === SampleResult.FAIL).length;
  const pendingSamples = items.filter(i => i.sampleResult === SampleResult.PENDING).length;
  const failedAttrs = items.flatMap(ti => ti.attributeResults).filter(ar => ar.result === AttrResult.FAIL);

  // Before approval — show locked
  if (!conclusion.value) {
    const reviewLabel = exec.review.status === 'PENDING' ? 'Pending' : exec.review.status === 'REJECTED' ? 'Rejected' : 'Not Submitted';
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lock size={24} className="text-gray-300 mb-4" />
        <h4 className="text-[0.875rem] font-semibold text-text mb-1">Conclusion Not Available</h4>
        <p className="text-[0.75rem] text-text-muted max-w-sm mb-3">
          Conclusion will be generated after reviewer approval. The reviewer must approve the test results before a conclusion can be set.
        </p>
        <div className="text-[0.6875rem] text-gray-500">
          Current review status: <span className="font-semibold">{reviewLabel}</span>
        </div>
        {exec.review.status !== 'APPROVED' && (
          <button onClick={() => onNavigate('review')}
            className="mt-4 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.6875rem] font-semibold cursor-pointer hover:bg-primary/20 transition-colors flex items-center gap-1">
            Go to Review<ChevronRight size={10} />
          </button>
        )}
      </div>
    );
  }

  // After approval — show conclusion
  const isEffective = conclusion.value === 'EFFECTIVE';

  return (
    <div className="space-y-5">
      {/* Conclusion Banner */}
      <div className={`rounded-xl border-2 p-6 ${isEffective ? 'border-emerald-200/50 bg-emerald-50/30' : 'border-red-200/50 bg-red-50/30'}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isEffective ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {isEffective ? (
              <CheckCircle2 size={28} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={28} className="text-red-600" />
            )}
          </div>
          <div>
            <h3 className={`text-[1.25rem] font-bold ${isEffective ? 'text-emerald-800' : 'text-red-800'}`}>
              {isEffective ? 'Effective' : 'Ineffective'}
            </h3>
            <p className={`text-[0.75rem] mt-0.5 ${isEffective ? 'text-emerald-600' : 'text-red-600'}`}>
              {conclusion.reason}
            </p>
          </div>
        </div>

        {conclusion.generatedAt && (
          <p className={`text-[0.625rem] ${isEffective ? 'text-emerald-500' : 'text-red-500'}`}>
            Concluded on {conclusion.generatedAt}
          </p>
        )}
      </div>

      {/* Test Results Summary */}
      <div className="rounded-lg border border-border-light p-4">
        <h5 className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider mb-3">Test Results Summary</h5>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <span className="text-[1.25rem] font-bold text-text block tabular-nums">{items.length}</span>
            <span className="text-[0.5625rem] text-gray-400">Total Samples</span>
          </div>
          <div>
            <span className="text-[1.25rem] font-bold text-emerald-700 block tabular-nums">{passedSamples}</span>
            <span className="text-[0.5625rem] text-gray-400">Passed</span>
          </div>
          <div>
            <span className={`text-[1.25rem] font-bold block tabular-nums ${failedSamples > 0 ? 'text-red-700' : 'text-gray-400'}`}>{failedSamples}</span>
            <span className="text-[0.5625rem] text-gray-400">Failed</span>
          </div>
          <div>
            <span className={`text-[1.25rem] font-bold block tabular-nums ${pendingSamples > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{pendingSamples}</span>
            <span className="text-[0.5625rem] text-gray-400">Pending</span>
          </div>
        </div>
      </div>

      {/* Failed Attributes Detail */}
      {failedAttrs.length > 0 && (
        <div className="rounded-lg border border-red-200/50 bg-red-50/10 p-4">
          <h5 className="text-[0.625rem] font-bold text-red-700 uppercase tracking-wider mb-2">Failed Attributes ({failedAttrs.length})</h5>
          <div className="space-y-1.5">
            {failedAttrs.map((fa, i) => {
              const attr = ctrl.attributes.find(a => a.id === fa.attributeId);
              const item = items.find(ti => ti.attributeResults.some(ar => ar.attributeId === fa.attributeId && ar.result === AttrResult.FAIL));
              return (
                <div key={i} className="flex items-start gap-2 text-[0.625rem]">
                  <X size={10} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-text font-medium">{attr?.name || fa.attributeId}</span>
                    {item && <span className="text-gray-400 ml-1">({item.referenceId})</span>}
                    {fa.notes && <span className="text-gray-500 ml-1">— {fa.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Info */}
      <div className="rounded-lg border border-border-light p-4 text-[0.6875rem]">
        <h5 className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider mb-2">Review</h5>
        <div className="grid grid-cols-3 gap-3">
          <div><span className="text-gray-400 block text-[0.625rem]">Reviewer</span><span className="text-text font-medium">{exec.review.reviewer}</span></div>
          <div><span className="text-gray-400 block text-[0.625rem]">Approved On</span><span className="text-text font-medium">{exec.review.reviewedAt}</span></div>
          <div><span className="text-gray-400 block text-[0.625rem]">Working Paper</span><span className="text-text font-medium">{exec.workingPaper.status === 'FINAL' ? 'Final' : exec.workingPaper.status}</span></div>
        </div>
        {exec.review.comments && (
          <p className="text-gray-500 italic mt-2">"{exec.review.comments}"</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('working-paper')}
          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.6875rem] font-semibold cursor-pointer hover:bg-primary/20 transition-colors flex items-center gap-1.5">
          <FileText size={12} />View Working Paper
        </button>
        {exec.workingPaper.finalDownloadEnabled && (
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = '/working-paper-final.pdf';
              a.download = `Working Paper — ${ctrl.name}.pdf`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
            <Download size={12} />Download Final Working Paper
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Create Samples Step (Manual Controls) ────────────────────────────────

const DEMO_SAMPLES: { refId: string; description: string; owner: string; period: string }[] = [
  { refId: 'S-001', description: 'Marketing FY26 Procurement Budget', owner: 'Marketing Dept', period: 'FY26' },
  { refId: 'S-002', description: 'IT FY26 Procurement Budget', owner: 'IT Dept', period: 'FY26' },
  { refId: 'S-003', description: 'Operations FY26 Procurement Budget', owner: 'Operations Dept', period: 'FY26' },
  { refId: 'S-004', description: 'HR FY26 Procurement Budget', owner: 'HR Dept', period: 'FY26' },
];

function createTestItem(refId: string, description: string, attributes: Attribute[]): TestItem {
  const attrResults: AttributeResult[] = attributes.map(attr => ({
    attributeId: attr.id,
    result: AttrResult.NOT_TESTED,
    source: attr.type === 'AUTOMATED' ? AttrSource.AUTO : AttrSource.MANUAL,
    evidenceIds: [],
    notes: '',
    testedAt: null,
    testedBy: null,
  }));
  return {
    id: `ti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    referenceId: refId,
    description,
    sourceRow: null,
    evidence: [],
    attributeResults: attrResults,
    sampleResult: SampleResult.PENDING,
  };
}

function CreateSamplesStep({ ctrl, onUpdateControl, onNavigate }: {
  ctrl: ExecutionControl;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
}) {
  const [manualRef, setManualRef] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualOwner, setManualOwner] = useState('');
  const [manualPeriod, setManualPeriod] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const hasSamples = ctrl.execution.testItems.length > 0;
  const fieldCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';

  const addSample = (refId: string, description: string) => {
    const item = createTestItem(refId, description, ctrl.attributes);
    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        status: ControlExecStatus.TEST_ITEMS_READY,
        testItems: [...prev.execution.testItems, item],
      },
    }));
  };

  const addManualSample = () => {
    if (!manualRef.trim()) return;
    const desc = [manualDesc, manualOwner, manualPeriod, manualNotes].filter(Boolean).join(' · ');
    addSample(manualRef.trim(), desc || manualRef.trim());
    setManualRef(''); setManualDesc(''); setManualOwner(''); setManualPeriod(''); setManualNotes('');
  };

  const addDemoSamples = () => {
    const existingRefs = new Set(ctrl.execution.testItems.map(ti => ti.referenceId));
    const newItems = DEMO_SAMPLES
      .filter(d => !existingRefs.has(d.refId))
      .map(d => createTestItem(d.refId, `${d.description} · ${d.owner} · ${d.period}`, ctrl.attributes));
    if (newItems.length === 0) return;
    onUpdateControl(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        status: ControlExecStatus.TEST_ITEMS_READY,
        testItems: [...prev.execution.testItems, ...newItems],
      },
    }));
  };

  const removeSample = (itemId: string) => {
    onUpdateControl(prev => {
      const remaining = prev.execution.testItems.filter(ti => ti.id !== itemId);
      return {
        ...prev,
        execution: {
          ...prev.execution,
          testItems: remaining,
          status: remaining.length === 0 ? ControlExecStatus.NOT_STARTED : prev.execution.status,
        },
      };
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-[0.875rem] font-bold text-text mb-1">Select Samples for Testing</h4>
        <p className="text-[0.75rem] text-text-muted">Add the items you want to test for this control. Each sample will be tested against {ctrl.attributes.length} attribute{ctrl.attributes.length !== 1 ? 's' : ''}.</p>
      </div>

      {/* Existing Samples Table */}
      {hasSamples && (
        <div className="rounded-lg border border-border-light overflow-hidden">
          <table className="w-full text-[0.6875rem]">
            <thead><tr className="border-b border-border-light bg-surface-2/30">
              <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Ref ID</th>
              <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-gray-400 uppercase">Description</th>
              <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase">Attributes</th>
              <th className="px-3 py-2 text-center text-[0.5625rem] font-semibold text-gray-400 uppercase">Result</th>
              <th className="px-3 py-2 w-8"></th>
            </tr></thead>
            <tbody>
              {ctrl.execution.testItems.map(item => (
                <tr key={item.id} className="border-b border-border-light/50">
                  <td className="px-3 py-2 font-mono text-gray-500">{item.referenceId}</td>
                  <td className="px-3 py-2 text-text">{item.description}</td>
                  <td className="px-3 py-2 text-center text-gray-500 tabular-nums">{item.attributeResults.length}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-gray-100 text-gray-500">Pending</span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeSample(item.id)} className="text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 size={11} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 bg-surface-2/20 border-t border-border-light text-[0.625rem] text-text-muted">
            {ctrl.execution.testItems.length} sample{ctrl.execution.testItems.length !== 1 ? 's' : ''} · {ctrl.attributes.length} attributes each · {ctrl.execution.testItems.length * ctrl.attributes.length} total checks
          </div>
        </div>
      )}

      {/* Add Options */}
      <div className="grid grid-cols-2 gap-4">
        {/* Manual Add */}
        <div className="rounded-lg border border-border-light p-4 space-y-3">
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider">Add Sample Manually</h5>
          <div>
            <label className="text-[0.625rem] font-semibold text-gray-500 block mb-1">Reference ID <span className="text-red-400">*</span></label>
            <input value={manualRef} onChange={e => setManualRef(e.target.value)} placeholder="e.g. S-005" className={fieldCls} />
          </div>
          <div>
            <label className="text-[0.625rem] font-semibold text-gray-500 block mb-1">Description</label>
            <input value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="e.g. Finance FY26 Procurement Budget" className={fieldCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[0.625rem] font-semibold text-gray-500 block mb-1">Owner / Department</label>
              <input value={manualOwner} onChange={e => setManualOwner(e.target.value)} placeholder="e.g. Finance Dept" className={fieldCls} />
            </div>
            <div>
              <label className="text-[0.625rem] font-semibold text-gray-500 block mb-1">Period</label>
              <input value={manualPeriod} onChange={e => setManualPeriod(e.target.value)} placeholder="e.g. FY26" className={fieldCls} />
            </div>
          </div>
          <div>
            <label className="text-[0.625rem] font-semibold text-gray-500 block mb-1">Notes</label>
            <input value={manualNotes} onChange={e => setManualNotes(e.target.value)} placeholder="Optional notes" className={fieldCls} />
          </div>
          <button onClick={addManualSample} disabled={!manualRef.trim()}
            className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            <Plus size={12} />Add Sample
          </button>
        </div>

        {/* Demo Samples */}
        <div className="rounded-lg border border-border-light p-4 space-y-3">
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider">Use Demo Samples</h5>
          <p className="text-[0.6875rem] text-text-muted">Add pre-defined budget samples for quick testing.</p>
          <div className="space-y-1.5">
            {DEMO_SAMPLES.map(d => {
              const alreadyAdded = ctrl.execution.testItems.some(ti => ti.referenceId === d.refId);
              return (
                <div key={d.refId} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${alreadyAdded ? 'border-emerald-200/50 bg-emerald-50/20' : 'border-border-light'}`}>
                  {alreadyAdded ? <CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> : <FlaskConical size={12} className="text-gray-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.6875rem] font-mono text-gray-500">{d.refId}</span>
                    <span className="text-[0.6875rem] text-text ml-1.5">{d.description}</span>
                  </div>
                  {alreadyAdded && <span className="text-[0.5625rem] text-emerald-600 font-semibold">Added</span>}
                </div>
              );
            })}
          </div>
          <button onClick={addDemoSamples}
            disabled={DEMO_SAMPLES.every(d => ctrl.execution.testItems.some(ti => ti.referenceId === d.refId))}
            className="w-full py-2 rounded-lg bg-primary/10 text-primary text-[0.6875rem] font-semibold cursor-pointer transition-colors hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            <Plus size={12} />Add Demo Budget Samples
          </button>
        </div>
      </div>

      {/* Next step hint */}
      {hasSamples && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-center justify-between">
          <span className="text-[0.6875rem] text-primary">
            {ctrl.execution.testItems.length} sample{ctrl.execution.testItems.length !== 1 ? 's' : ''} ready. Next: collect evidence for manual attributes.
          </span>
          <button onClick={() => onNavigate('evidence')}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">
            Evidence<ChevronRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Locked Step ──────────────────────────────────────────────────────────

function LockedStep({ step, reason, steps, availability, onNavigate }: {
  step: StepDef;
  reason: string;
  steps: StepDef[];
  availability: StepAvailability;
  onNavigate: (stepId: string) => void;
}) {
  // Find the first enabled step before this one as a CTA target
  const currentIdx = steps.findIndex(s => s.id === step.id);
  let prevEnabledStep: StepDef | null = null;
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (availability[steps[i].availabilityKey].enabled) {
      prevEnabledStep = steps[i];
      break;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
        <Lock size={20} className="text-gray-400" />
      </div>
      <h4 className="text-[0.875rem] font-semibold text-text mb-1">{step.label} is locked</h4>
      <p className="text-[0.75rem] text-text-muted max-w-sm mb-5">{reason || 'Complete the required previous steps to unlock this step.'}</p>
      {prevEnabledStep && (
        <button onClick={() => onNavigate(prevEnabledStep!.id)}
          className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-[0.75rem] font-semibold hover:bg-primary/20 cursor-pointer transition-colors flex items-center gap-1.5">
          Go to {prevEnabledStep.label}<ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Placeholder Step (enabled but not yet implemented) ───────────────────

function PlaceholderStep({ step }: { step: StepDef }) {
  const Icon = step.icon;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon size={20} className="text-primary" />
      </div>
      <h4 className="text-[0.875rem] font-semibold text-text mb-1">{step.label}</h4>
      <p className="text-[0.75rem] text-text-muted max-w-sm">This step will be implemented in a subsequent prompt. The step is unlocked and ready for implementation.</p>
    </div>
  );
}

// ─── Audit Trail Step ────────────────────────────────────────────────────

function AuditTrailStep({ ctrl }: { ctrl: ExecutionControl }) {
  const events = [
    { id: '1', time: 'Today', title: 'Control opened', subtitle: `${ctrl.name} opened for testing`, actor: ctrl.owner, type: 'config' as const },
    ...(ctrl.execution.testItems.length > 0 ? [{ id: '2', time: 'Today', title: `${ctrl.execution.testItems.length} test items created`, subtitle: 'Samples generated from population', actor: ctrl.owner, type: 'run' as const }] : []),
    ...ctrl.workflowMappings.map((wm, i) => ({ id: `wf-${i}`, time: 'Today', title: `Workflow linked: ${wm.workflowName}`, subtitle: `${wm.version} · ${wm.status} · ${wm.mappedAttributeIds.length} attributes`, actor: ctrl.owner, type: 'config' as const })),
    ...ctrl.attributes.map((attr, i) => ({ id: `attr-${i}`, time: 'Today', title: `Attribute: ${attr.name}`, subtitle: `${attr.type} · ${attr.assertionName}${attr.workflowId ? ' · Workflow linked' : ''}`, actor: ctrl.owner, type: 'finding' as const })),
    { id: 'status', time: 'Today', title: `Status: ${ctrl.execution.status.replace(/_/g, ' ')}`, subtitle: `Control ${ctrl.id}`, actor: 'System', type: 'review' as const },
  ];

  const ICON_MAP = { config: Settings, run: Play, finding: AlertTriangle, review: CheckCircle2 };
  const BG_MAP = { config: 'bg-gray-200 text-gray-500', run: 'bg-purple-100 text-purple-600', finding: 'bg-amber-100 text-amber-600', review: 'bg-emerald-100 text-emerald-600' };
  const BORDER_MAP = { config: 'border-l-gray-300', run: 'border-l-purple-300', finding: 'border-l-amber-400', review: 'border-l-emerald-400' };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-[0.8125rem] font-bold text-text mb-0.5">Audit Trail</h4>
        <p className="text-[0.6875rem] text-text-muted">Activity log for this control's testing lifecycle.</p>
      </div>
      <div className="space-y-1">
        {events.map(ev => {
          const Icon = ICON_MAP[ev.type]; const bg = BG_MAP[ev.type]; const border = BORDER_MAP[ev.type];
          return (
            <div key={ev.id} className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border-l-[3px] ${border} hover:bg-white transition-colors`}>
              <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center shrink-0 mt-0.5`}><Icon size={13} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[0.75rem] font-semibold text-text">{ev.title}</div>
                <div className="text-[0.625rem] text-gray-400 mt-0.5">{ev.subtitle}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[0.625rem] text-gray-300">{ev.time}</div>
                <div className="text-[0.625rem] text-gray-400 mt-0.5">{ev.actor}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Configure Samples Step (Generate from Population) ───────────────────

type SampleMethod = 'Random' | 'Statistical' | 'Column-filter' | 'Workflow';

function ConfigureSamplesStep({ ctrl, onUpdateControl, onNavigate, onLaunchWorkflowBuilder }: {
  ctrl: ExecutionControl;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
  onLaunchWorkflowBuilder?: (seedPrompt: string) => void;
}) {
  const [populationUploaded, setPopulationUploaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [populationFile, setPopulationFile] = useState('');
  const [populationRows, setPopulationRows] = useState(0);
  const [method, setMethod] = useState<SampleMethod>('Random');
  const [sampleSize, setSampleSize] = useState(25);
  const [filterDesc, setFilterDesc] = useState('');
  const [samplesReady, setSamplesReady] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);

  const sampleBasedCount = ctrl.attributes.length || 3;

  const handleUpload = () => {
    setProcessing(true);
    setPopulationFile(`population_${ctrl.id.toLowerCase()}_FY26.xlsx`);
    setTimeout(() => {
      setProcessing(false);
      setPopulationUploaded(true);
      setPopulationRows(487);
    }, 5000);
  };

  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    const count = Math.min(sampleSize, populationRows);
    setTimeout(() => {
      setSampleCount(count);
      setSamplesReady(true);
      setGenerating(false);
      // Create test items on the control so Attribute Testing can use them
      onUpdateControl(prev => ({
        ...prev,
        execution: {
          ...prev.execution,
          testItems: Array.from({ length: count }, (_, i) => ({
            id: `S${String(i + 1).padStart(3, '0')}`,
            referenceId: `POP-${String(Math.floor(Math.random() * populationRows) + 1).padStart(4, '0')}`,
            description: `Sample ${i + 1} from ${method} sampling`,
            sourceRow: Math.floor(Math.random() * populationRows) + 1,
            evidence: [],
            attributeResults: prev.attributes.map(attr => ({
              attributeId: attr.id,
              result: 'NOT_TESTED' as any,
              source: 'MANUAL' as any,
              evidenceIds: [],
              notes: '',
              testedAt: null,
              testedBy: null,
            })),
            sampleResult: 'PENDING' as any,
          })),
          status: prev.execution.status === 'NOT_STARTED' ? 'TEST_ITEMS_READY' as any : prev.execution.status,
        },
      }));
    }, 5000);
  };

  const fieldCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';

  const METHODS: { id: SampleMethod; label: string; sub: string }[] = [
    { id: 'Random', label: 'Random', sub: 'Uniform random draw' },
    { id: 'Statistical', label: 'Statistical', sub: 'Stratified / confidence-based' },
    { id: 'Column-filter', label: 'Column-filter', sub: 'WHERE col = ...' },
    { id: 'Workflow', label: 'Workflow', sub: 'Custom workflow' },
  ];

  // Stage 1: Upload Population
  if (!populationUploaded && !processing) {
    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-[0.8125rem] font-bold text-text mb-0.5">Upload Population</h4>
          <p className="text-[0.6875rem] text-text-muted">Upload the full population file for this control before generating samples.</p>
        </div>
        <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.03] p-8 text-center space-y-4">
          <Upload size={32} className="text-primary/40 mx-auto" />
          <div>
            <p className="text-[0.8125rem] font-semibold text-text mb-1">Upload Population File</p>
            <p className="text-[0.6875rem] text-text-muted">Supported: XLSX, CSV</p>
          </div>
          <label className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
            <Upload size={13} />Upload Population File
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>
    );
  }

  // Processing state
  if (processing) {
    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-[0.8125rem] font-bold text-text mb-0.5">Upload Population</h4>
          <p className="text-[0.6875rem] text-text-muted">Processing your population file...</p>
        </div>
        <div className="rounded-xl border border-border-light bg-white p-12 text-center space-y-4">
          <Loader2 size={32} className="text-primary mx-auto animate-spin" />
          <p className="text-[0.8125rem] font-semibold text-text">Processing population file…</p>
          <p className="text-[0.6875rem] text-text-muted">Analyzing rows, validating schema, and preparing for sampling.</p>
        </div>
      </div>
    );
  }

  // Stage 2: Configure Sampling
  return (
    <div className="space-y-5">
      {/* Population summary */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[0.6875rem] text-emerald-700">
        <CheckCircle2 size={14} />
        <div>
          <span className="font-semibold">Population uploaded:</span> {populationFile} · {populationRows.toLocaleString()} rows
        </div>
        <label className="ml-auto text-[0.625rem] font-semibold text-primary cursor-pointer hover:underline">
          Replace
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={() => { setPopulationUploaded(false); setSamplesReady(false); handleUpload(); }} />
        </label>
      </div>

      {/* Configure sampling */}
      <div className="rounded-xl border border-border-light bg-white p-5 space-y-4">
        <div>
          <h4 className="text-[0.8125rem] font-bold text-text mb-0.5">Configure sampling</h4>
          <p className="text-[0.6875rem] text-text-muted">One sample set shared across {sampleBasedCount} sample-based attributes.</p>
        </div>

        {/* Method cards */}
        <div className="grid grid-cols-4 gap-2">
          {METHODS.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className={`rounded-xl border-2 p-3 text-left cursor-pointer transition-all ${
                method === m.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border-light hover:border-primary/30'
              }`}>
              <span className="text-[0.75rem] font-semibold text-text block">{m.label}</span>
              <span className="text-[0.625rem] text-gray-400 mt-0.5 block">{m.sub}</span>
            </button>
          ))}
        </div>

        {/* Sample size + method-specific options */}
        <div className="space-y-3">
          {method !== 'Workflow' && (
            <div>
              <label className="text-[0.6875rem] font-semibold text-text-muted block mb-1">Sample Size</label>
              <input type="number" value={sampleSize} onChange={e => { setSampleSize(Math.max(1, Math.min(5000, Number(e.target.value)))); setSamplesReady(false); }}
                className={fieldCls + ' max-w-[200px]'} min={1} max={5000} />
            </div>
          )}

          {method === 'Column-filter' && (
            <div>
              <label className="text-[0.6875rem] font-semibold text-text-muted block mb-1">Filter</label>
              <input value={filterDesc} onChange={e => setFilterDesc(e.target.value)}
                placeholder="e.g. amount > 100000 AND status = 'OPEN'" className={fieldCls} />
            </div>
          )}

          {method === 'Statistical' && (
            <p className="text-[0.625rem] text-gray-400 italic">Statistical sampling configuration can be expanded later.</p>
          )}

          {method === 'Workflow' && (
            <div className="space-y-2">
              <label className="text-[0.6875rem] font-semibold text-text-muted block">Sample Size</label>
              <input type="number" value={sampleSize} disabled className={fieldCls + ' max-w-[200px] opacity-50 cursor-not-allowed'} />
              <p className="text-[0.625rem] text-gray-400">Sample size is determined by the workflow.</p>
              <button onClick={() => onLaunchWorkflowBuilder?.(`Build a sampling workflow for control ${ctrl.id} (${ctrl.name}). The workflow should select a deterministic sample list from the uploaded population (${populationRows} rows).`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-[0.6875rem] font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-colors">
                <Workflow size={12} />Build sampling workflow
              </button>
            </div>
          )}
        </div>

        {/* Generate CTA */}
        {method !== 'Workflow' && !generating && (
          <button onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
            <Play size={12} />Generate Samples
          </button>
        )}

        {/* Generating loader */}
        {generating && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
            <Loader2 size={16} className="text-primary animate-spin" />
            <div>
              <span className="text-[0.75rem] font-semibold text-text block">Generating samples…</span>
              <span className="text-[0.625rem] text-text-muted">Drawing {sampleSize} samples using {method} method from {populationRows.toLocaleString()} rows.</span>
            </div>
          </div>
        )}

        {/* Samples ready */}
        {samplesReady && !generating && (
          <div className="flex items-center gap-2 text-[0.6875rem] text-emerald-700">
            <CheckCircle2 size={13} />
            <span className="font-semibold">{sampleCount} samples ready</span>
          </div>
        )}
      </div>

      {/* Continue */}
      {samplesReady && (
        <button onClick={() => onNavigate('attr-testing')}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
          Continue to Attribute Testing <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}
