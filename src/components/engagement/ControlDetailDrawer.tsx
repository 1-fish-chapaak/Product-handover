import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronRight, ChevronDown, CheckCircle2, Clock, AlertTriangle,
  Database, FileText, Shield, Workflow, Target,
  Eye, ArrowRight, XCircle, ArrowLeft, Users,
  Paperclip, Send, Lock, Zap, CloudUpload, MessageSquare, Copy,
  Upload, Play, Calendar, Filter, BarChart3, Download, Settings, Plus
} from 'lucide-react';
import { getControlById, getLinkedWorkflows, getAttributesForWorkflow, FINDINGS, ENGAGEMENT, type ControlDetail, type SampleItem, type Finding, type LinkedWorkflow } from './engagementData';
import { useAuditLog } from '../../context/AdminDataContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type TestingStep = 'overview' | 'population' | 'execution-mode' | 'samples' | 'create-samples' | 'evidence' | 'testing' | 'working-paper' | 'review' | 'conclusion';
type ExecutionMode = 'full-run' | 'sampling' | null;
type ControlExecType = 'Automated' | 'Manual' | 'Hybrid';

// Shared evidence file type
interface EvidenceFile { id: string; fileName: string; evidenceType: string; mappedAttributeIds: string[]; uploadedAt: string; }

// Shared sample set type
interface SampleSet { rows: number[]; size: number; populationSize: number; method: string; generatedAt: string; }

function deriveControlType(ctrl: ControlDetail): ControlExecType {
  const hasAutoWorkflow = ctrl.workflowName?.toLowerCase().includes('automat') || ctrl.controlName?.toLowerCase().includes('automat');
  const hasManualEvidence = ctrl.workflowAttributes.some(a => a.requiredEvidence && a.requiredEvidence.length > 0);
  if (ctrl.workflowAttributes.length === 0) return 'Manual';
  if (hasAutoWorkflow && !hasManualEvidence) return 'Automated';
  if (!hasAutoWorkflow && hasManualEvidence) return 'Manual';
  return 'Hybrid';
}

function isConcluded(s: string): boolean {
  return ['effective', 'partially-effective', 'ineffective'].includes(s);
}

// ─── Small components ────────────────────────────────────────────────────────

function AttrResultChip({ result }: { result: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pass: { cls: 'bg-compliant-50 text-compliant-700', label: 'Pass' },
    fail: { cls: 'bg-risk-50 text-risk-700', label: 'Fail' },
    pending: { cls: 'bg-draft-50 text-draft-700', label: 'Not Tested' },
    na: { cls: 'bg-paper-50 text-ink-400', label: 'N/A' },
  };
  const s = map[result] || map.pending;
  return <span className={`inline-flex items-center px-2 h-5 rounded text-[0.625rem] font-bold ${s.cls}`}>{s.label}</span>;
}

function SampleStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'pass': 'bg-compliant', 'fail': 'bg-risk', 'exception': 'bg-high', 'not-tested': 'bg-ink-300',
  };
  return <div className={`w-2.5 h-2.5 rounded-full ${colors[status] || 'bg-ink-300'}`} />;
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    'not-started': { cls: 'bg-draft-50 text-draft-700', label: 'Not Started' },
    'population-pending': { cls: 'bg-high-50 text-high-700', label: 'Population Pending' },
    'in-progress': { cls: 'bg-evidence-50 text-evidence-700', label: 'In Progress' },
    'pending-review': { cls: 'bg-mitigated-50 text-mitigated-700', label: 'Pending Review' },
    'effective': { cls: 'bg-compliant-50 text-compliant-700', label: 'Concluded — Effective' },
    'partially-effective': { cls: 'bg-high-50 text-high-700', label: 'Concluded — Partial' },
    'ineffective': { cls: 'bg-risk-50 text-risk-700', label: 'Concluded — Ineffective' },
  };
  const s = map[status] || map['not-started'];
  return <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold ${s.cls}`}>{s.label}</span>;
}

function StepIndicator({ steps, current, onStep }: { steps: { id: TestingStep; label: string; icon: React.ElementType }[]; current: TestingStep; onStep: (s: TestingStep) => void }) {
  const currentIdx = steps.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-1 py-3 px-4 border-b border-border-light bg-surface-2/30 overflow-x-auto">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.id === current;
        const isPast = i < currentIdx;
        return (
          <div key={step.id} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight size={10} className="text-ink-300 mx-0.5" />}
            <button onClick={() => onStep(step.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[0.6875rem] font-semibold transition-all cursor-pointer ${
                isActive ? 'bg-primary text-white' : isPast ? 'bg-compliant-50 text-compliant-700' : 'text-ink-500 hover:bg-surface-2'
              }`}>
              {isPast ? <CheckCircle2 size={11} /> : <Icon size={11} />}
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Helper: compute next action ─────────────────────────────────────────────

function getNextAction(ctrl: ControlDetail): { label: string; icon: React.ElementType; cls: string; step: TestingStep } {
  if (ctrl.status === 'not-started') return { label: 'Upload Population', icon: Upload, cls: 'bg-primary text-white hover:bg-primary-hover', step: 'population' };
  if (ctrl.status === 'population-pending') return { label: 'Generate Samples', icon: Zap, cls: 'bg-primary text-white hover:bg-primary-hover', step: 'population' };
  if (ctrl.samples.some(s => s.evidenceFiles.length === 0 && s.status === 'not-tested')) return { label: 'Add Evidence', icon: FileText, cls: 'bg-evidence-700 text-white hover:brightness-110', step: 'evidence' };
  if (ctrl.samples.some(s => s.status === 'not-tested')) return { label: 'Complete Testing', icon: Target, cls: 'bg-primary text-white hover:bg-primary-hover', step: 'testing' };
  if (ctrl.status === 'in-progress' && ctrl.samples.every(s => s.status !== 'not-tested')) return { label: 'Submit for Review', icon: Send, cls: 'bg-brand-600 text-white hover:bg-brand-500', step: 'review' };
  if (ctrl.status === 'pending-review') return { label: 'Resolve Pending Review', icon: Eye, cls: 'bg-mitigated-700 text-white hover:brightness-110', step: 'review' };
  if (ctrl.exceptions > 0 && !ctrl.result) return { label: 'Resolve Exceptions', icon: AlertTriangle, cls: 'bg-risk text-white hover:brightness-110', step: 'conclusion' };
  return { label: 'View Working Paper', icon: FileText, cls: 'bg-primary text-white hover:bg-primary-hover', step: 'working-paper' };
}

// ─── OVERVIEW STEP ───────────────────────────────────────────────────────────

function OverviewStep({ ctrl, onGoToStep }: { ctrl: ControlDetail; onGoToStep: (s: TestingStep) => void }) {
  const tested = ctrl.samples.filter(s => s.status !== 'not-tested').length;
  const totalAttrs = ctrl.workflowAttributes.length;
  const totalSamples = ctrl.samples.length;
  const nextAction = getNextAction(ctrl);

  // Resolve multi-workflow data
  const workflows = getLinkedWorkflows(ctrl);
  const hasMultipleWorkflows = workflows.length > 1;

  // Compute per-attribute aggregate status
  const attrStats = ctrl.workflowAttributes.map(attr => {
    const passCount = ctrl.samples.filter(s => s.attributes[attr.id] === 'pass').length;
    const failCount = ctrl.samples.filter(s => s.attributes[attr.id] === 'fail').length;
    const testedCount = ctrl.samples.filter(s => s.attributes[attr.id] !== 'pending').length;
    const exceptionCount = failCount;
    let status: string = 'pending';
    if (testedCount === 0) status = 'pending';
    else if (failCount > 0) status = 'fail';
    else if (testedCount === totalSamples) status = 'pass';
    else status = 'pending';
    return { ...attr, passCount, failCount, testedCount, exceptionCount, status };
  });

  // Legacy single-workflow detection: if only one fallback workflow, all attrs belong to it
  const isSingleLegacy = workflows.length === 1 && workflows[0].id === 'lw-legacy';

  // Unmapped attributes (no workflowId set — but legacy single-workflow controls are fully mapped)
  const unmappedAttrs = isSingleLegacy ? [] : ctrl.workflowAttributes.filter(a => !a.workflowId);

  // Collect all unique assertions across all attributes
  const allAssertions = new Set<string>();
  ctrl.workflowAttributes.forEach(a => { if (a.assertions) a.assertions.forEach(x => allAssertions.add(x)); });

  // Per-workflow aggregate status
  function getWorkflowStatus(wf: LinkedWorkflow): 'pass' | 'fail' | 'pending' {
    const wfAttrs = wf.id === 'lw-legacy'
      ? attrStats  // legacy: all attrs belong to the single workflow
      : attrStats.filter(a => a.workflowId === wf.id);
    if (wfAttrs.length === 0) return 'pending';
    if (wfAttrs.some(a => a.status === 'fail')) return 'fail';
    if (wfAttrs.every(a => a.status === 'pass')) return 'pass';
    return 'pending';
  }

  // Attribute completion %
  const totalAttrTests = totalAttrs * totalSamples;
  const completedAttrTests = ctrl.samples.reduce((sum, s) => sum + Object.values(s.attributes).filter(v => v !== 'pending').length, 0);
  const attrCompletion = totalAttrTests > 0 ? Math.round((completedAttrTests / totalAttrTests) * 100) : 0;

  // Evidence completion %
  const samplesWithEvidence = ctrl.samples.filter(s => s.evidenceFiles.length > 0).length;
  const evidenceCompletion = totalSamples > 0 ? Math.round((samplesWithEvidence / totalSamples) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── NEXT ACTION PANEL ── */}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[0.625rem] font-bold text-primary uppercase">Next Action</span>
            <p className="text-[0.8125rem] font-semibold text-text mt-0.5">{nextAction.label}</p>
          </div>
          <button onClick={() => onGoToStep(nextAction.step)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.75rem] font-semibold transition-all cursor-pointer ${nextAction.cls}`}>
            <nextAction.icon size={13} />
            {nextAction.label}
          </button>
        </div>
      </div>

      {/* ── TEST INSTANCE DETAILS ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Test Instance Details</h4>
        <div className="glass-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-[0.625rem] text-text-muted uppercase">Linked Workflows</span><p className="text-[0.75rem] font-semibold text-brand-700">{workflows.length === 1 ? `${ctrl.workflowName} ${ctrl.workflowVersion}` : `${workflows.length} workflows`}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Attributes</span><p className="text-[0.75rem] text-text">{totalAttrs} attributes{workflows.length > 1 ? ` across ${workflows.length} workflows` : ''}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Testing Round</span><p className="text-[0.75rem] text-text">{ctrl.testingRound > 0 ? `Round ${ctrl.testingRound}` : 'Not started'}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Population Source</span><p className="text-[0.75rem] text-text truncate" title={ctrl.populationSource}>{ctrl.populationSource || '—'}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Sampling Method</span><p className="text-[0.75rem] text-text">{ctrl.samplingMethod || '—'}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Population Size</span><p className="text-[0.75rem] font-mono text-text">{ctrl.populationSize > 0 ? ctrl.populationSize.toLocaleString() : '—'}</p></div>
          </div>
        </div>
      </div>

      {/* ── EXECUTION METRICS ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Execution Metrics</h4>
        <div className="grid grid-cols-5 gap-2">
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-text tabular-nums">{tested}/{totalSamples}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Samples Tested</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${ctrl.exceptions > 0 ? 'text-risk-700' : 'text-text-muted'}`}>{ctrl.samples.filter(s => s.status === 'fail' || s.status === 'exception').length}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Failed Samples</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-brand-700 tabular-nums">{attrCompletion}%</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Attr Complete</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${evidenceCompletion < 100 ? 'text-high-700' : 'text-compliant-700'}`}>{evidenceCompletion}%</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Evidence</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${ctrl.status === 'pending-review' ? 'text-mitigated-700' : 'text-text-muted'}`}>{ctrl.status === 'pending-review' ? '1' : '0'}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Pending Review</div>
          </div>
        </div>
      </div>

      {/* ── LINKED WORKFLOWS & ATTRIBUTE COVERAGE ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Linked Workflows & Attribute Coverage</h4>

        {/* Summary chips */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[0.625rem] font-semibold bg-brand-50 text-brand-700">
            <Workflow size={10} />{workflows.length} linked workflow{workflows.length !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[0.625rem] font-semibold bg-evidence-50 text-evidence-700">
            <Target size={10} />{totalAttrs} attribute{totalAttrs !== 1 ? 's' : ''} covered
          </span>
          {unmappedAttrs.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[0.625rem] font-semibold bg-risk-50 text-risk-700">
              <AlertTriangle size={10} />{unmappedAttrs.length} unmapped
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[0.625rem] font-semibold bg-compliant-50 text-compliant-700">
              <CheckCircle2 size={10} />0 unmapped
            </span>
          )}
        </div>

        {workflows.length === 0 ? (
          /* Empty state */
          <div className="glass-card p-6 text-center">
            <Workflow size={24} className="mx-auto text-ink-300 mb-2" />
            <p className="text-[0.75rem] font-semibold text-ink-600 mb-0.5">No workflows linked</p>
            <p className="text-[0.625rem] text-ink-400">Link workflows to test this control's attributes.</p>
          </div>
        ) : (
          /* Workflow ↔ attribute table */
          <div className="glass-card overflow-hidden">
            <table className="w-full text-[0.6875rem]">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Workflow</th>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase w-14">Ver.</th>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase w-20">Attrs</th>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Assertions</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-16">Status</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-14">Action</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((wf, i) => {
                  const wfAttrs = getAttributesForWorkflow(ctrl, wf.id);
                  const wfAssertions = new Set<string>();
                  wfAttrs.forEach(a => { if (a.assertions) a.assertions.forEach(x => wfAssertions.add(x)); });
                  const wfStatus = getWorkflowStatus(wf);

                  return (
                    <tr key={wf.id} className={`border-b border-border/40 hover:bg-surface-2/30 transition-colors ${i === 0 ? '' : ''}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Workflow size={11} className="text-brand-600 shrink-0" />
                          <span className="text-[0.6875rem] font-medium text-text">{wf.name}</span>
                          {i === 0 && hasMultipleWorkflows && (
                            <span className="px-1.5 h-4 rounded text-[0.5rem] font-bold bg-brand-50 text-brand-700 inline-flex items-center shrink-0">PRIMARY</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[0.625rem] font-mono text-text-muted">{wf.version}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[0.6875rem] text-text">{wfAttrs.length} attr{wfAttrs.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {Array.from(wfAssertions).map(a => (
                            <span key={a} className="px-1.5 h-4 rounded text-[0.5625rem] font-medium bg-brand-50/70 text-brand-700 inline-flex items-center">{a}</span>
                          ))}
                          {wfAssertions.size === 0 && <span className="text-[0.625rem] text-ink-300">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <AttrResultChip result={wfStatus} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => onGoToStep('testing')} className="text-[0.625rem] font-semibold text-brand-600 hover:underline cursor-pointer">View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Unmapped attributes warning */}
        {unmappedAttrs.length > 0 && (
          <div className="mt-2 rounded-lg border border-risk/20 bg-risk-50/50 px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={12} className="text-risk-700 shrink-0" />
            <span className="text-[0.625rem] text-risk-700">{unmappedAttrs.length} attribute{unmappedAttrs.length !== 1 ? 's are' : ' is'} not mapped to a workflow.</span>
          </div>
        )}
      </div>

      {/* ── ATTRIBUTE DETAIL TABLE ── */}
      <AttributeConditionsTable ctrl={ctrl} attrStats={attrStats} workflows={workflows} onGoToStep={onGoToStep} />

      {/* ── CONTROL TEST OVERVIEW ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Control Test Overview</h4>
        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-[0.625rem] text-text-muted uppercase">Control ID</span><p className="text-[0.75rem] font-mono text-text">{ctrl.controlId}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Domain</span><p className="text-[0.75rem] text-text">{ctrl.domain}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Frequency</span><p className="text-[0.75rem] text-text">{ctrl.frequency}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Control Owner</span><p className="text-[0.75rem] text-text">{ctrl.controlOwner}</p></div>
          </div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Objective</span><p className="text-[0.75rem] text-text-secondary leading-relaxed mt-0.5">{ctrl.objective}</p></div>
          <div className="flex flex-wrap gap-2">
            {ctrl.isKey && <span className="px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold bg-mitigated-50 text-mitigated-700 inline-flex items-center">Key Control</span>}
            {ctrl.assertions.map(a => (
              <span key={a} className="px-2.5 h-6 rounded-full text-[0.6875rem] font-medium bg-brand-50 text-brand-700 inline-flex items-center">{a}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ATTRIBUTE CONDITIONS TABLE (used by OverviewStep) ──────────────────────

interface AttrStat {
  id: string; name: string; description: string; requiredEvidence: string;
  assertions?: string[]; workflowId?: string;
  passCount: number; failCount: number; testedCount: number; exceptionCount: number; status: string;
}

function AttributeConditionsTable({ ctrl, attrStats, workflows, onGoToStep }: {
  ctrl: ControlDetail;
  attrStats: AttrStat[];
  workflows: LinkedWorkflow[];
  onGoToStep: (s: TestingStep) => void;
}) {
  // Local overrides for workflow mapping (demo only — does not mutate source data)
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const logEvent = useAuditLog();

  const handleRemap = (attrId: string, newWfId: string) => {
    if (newWfId === '__link_new__') {
      // Demo placeholder: show toast for "link another workflow"
      showToast('Open workflow library to link a new workflow…');
      return;
    }
    setOverrides(prev => ({ ...prev, [attrId]: newWfId }));
    const wf = workflows.find(w => w.id === newWfId);
    if (wf) {
      showToast(`Attribute mapped to ${wf.name}`);
      const attr = attrStats.find(a => a.id === attrId);
      logEvent({ action: 'Update', description: `Mapped attribute "${attr?.name ?? attrId}" to workflow ${wf.name} on ${ctrl.controlName}`, module: 'Engagements', entity: 'Control' });
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  };

  // For legacy controls (single workflow, no workflowId on attrs), treat all attrs as mapped to that workflow
  const isSingleLegacy = workflows.length === 1 && workflows[0].id === 'lw-legacy';
  const resolveWfId = (attr: AttrStat): string | undefined =>
    overrides[attr.id] ?? attr.workflowId ?? (isSingleLegacy ? 'lw-legacy' : undefined);

  // Coverage calculations (accounting for overrides)
  const mappedCount = attrStats.filter(a => !!resolveWfId(a)).length;
  const unmappedCount = attrStats.length - mappedCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase">Attributes & Workflow Mapping</h4>
        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] text-text-muted">{attrStats.length} total</span>
          <span className="text-[0.625rem] text-compliant-700 font-medium">{mappedCount} mapped</span>
          {unmappedCount > 0 && <span className="text-[0.625rem] text-risk-700 font-medium">{unmappedCount} unmapped</span>}
        </div>
      </div>
      <div className="glass-card overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                <th className="px-2.5 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase w-6">#</th>
                <th className="px-2.5 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Attribute</th>
                <th className="px-2.5 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase w-[110px]">Assertion</th>
                <th className="px-2.5 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase w-[140px]">Linked Workflow</th>
                <th className="px-2.5 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase w-16">Evidence</th>
                <th className="px-2.5 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-16">Status</th>
                <th className="px-2.5 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-12">Exc.</th>
              </tr>
            </thead>
            <tbody>
              {attrStats.map((attr, i) => {
                const currentWfId = resolveWfId(attr);
                const ownerWf = currentWfId ? workflows.find(w => w.id === currentWfId) : undefined;
                const isUnmapped = !currentWfId;

                return (
                  <tr key={attr.id} className={`border-b border-border/40 transition-colors ${isUnmapped ? 'bg-risk-50/20' : 'hover:bg-surface-2/30'}`}>
                    {/* # */}
                    <td className="px-2.5 py-2 text-[0.625rem] font-mono text-text-muted">{i + 1}</td>

                    {/* Attribute */}
                    <td className="px-2.5 py-2">
                      <div className="text-[0.6875rem] font-medium text-text">{attr.name}</div>
                      <div className="text-[0.75rem] text-text-muted truncate max-w-[180px]">{attr.description}</div>
                    </td>

                    {/* Assertion badges */}
                    <td className="px-2.5 py-2">
                      {attr.assertions && attr.assertions.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {attr.assertions.map(a => (
                            <span key={a} className="px-1.5 h-[18px] rounded text-[0.5625rem] font-medium bg-brand-50 text-brand-700 inline-flex items-center">{a}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[0.5625rem] text-ink-300">—</span>
                      )}
                    </td>

                    {/* Linked Workflow — compact dropdown */}
                    <td className="px-2.5 py-2">
                      {isUnmapped ? (
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 h-[18px] rounded text-[0.5625rem] font-bold bg-risk-50 text-risk-700 inline-flex items-center">Unmapped</span>
                          <select
                            value=""
                            onChange={e => { if (e.target.value) handleRemap(attr.id, e.target.value); }}
                            className="w-[70px] px-1 py-0.5 rounded border border-risk/30 bg-white text-[0.5625rem] text-risk-700 outline-none cursor-pointer focus:border-brand-500/60"
                          >
                            <option value="">Link…</option>
                            {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            <option value="__link_new__">+ Link another…</option>
                          </select>
                        </div>
                      ) : (
                        <select
                          value={currentWfId}
                          onChange={e => handleRemap(attr.id, e.target.value)}
                          className="w-full px-1.5 py-1 rounded border border-border/60 bg-white text-[0.625rem] text-text outline-none cursor-pointer hover:border-brand-500/40 focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/10 transition-colors"
                          title={ownerWf ? `${ownerWf.name} ${ownerWf.version}` : ''}
                        >
                          {workflows.map(w => <option key={w.id} value={w.id}>{w.name} {w.version}</option>)}
                          <option value="__link_new__">+ Link another…</option>
                        </select>
                      )}
                    </td>

                    {/* Evidence */}
                    <td className="px-2.5 py-2 text-[0.625rem] text-text-muted">{attr.requiredEvidence ? 'Required' : '—'}</td>

                    {/* Status */}
                    <td className="px-2.5 py-2 text-center"><AttrResultChip result={attr.status} /></td>

                    {/* Exceptions */}
                    <td className="px-2.5 py-2 text-center">
                      {attr.exceptionCount > 0 ? <span className="text-[0.6875rem] font-bold text-risk-700">{attr.exceptionCount}</span> : <span className="text-ink-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Inline toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg bg-ink-800 text-white text-[0.6875rem] font-medium shadow-lg flex items-center gap-2"
            >
              <CheckCircle2 size={12} className="text-compliant shrink-0" />
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Governance notice */}
      <div className="mt-2 rounded-lg border border-border/50 bg-surface-2/50 px-3 py-2 flex items-start gap-2">
        <Shield size={11} className="text-ink-400 mt-0.5 shrink-0" />
        <span className="text-[0.75rem] text-ink-400 leading-relaxed">
          Workflow mapping defines how each attribute will be tested. Workflows are not executed until the Testing step.
        </span>
      </div>
    </div>
  );
}

// ─── POPULATION STEP ─────────────────────────────────────────────────────────

type SamplingMethod = 'full' | 'random' | 'systematic' | 'manual' | 'judgmental';

const SAMPLING_METHODS: { id: SamplingMethod; label: string; desc: string }[] = [
  { id: 'full', label: 'Full Population', desc: 'All records will be included for testing.' },
  { id: 'random', label: 'Random Sampling', desc: 'System randomly selects records from the locked population.' },
  { id: 'systematic', label: 'Systematic Sampling', desc: 'System selects records at a fixed interval.' },
  { id: 'manual', label: 'Manual Sample Size', desc: 'User defines how many samples should be selected.' },
  { id: 'judgmental', label: 'Judgmental Selection', desc: 'Auditor selects specific items based on professional judgment.' },
];

// Mock existing datasets available for selection
const EXISTING_DATASETS = [
  { id: 'ds-1', source: 'SAP ERP — AP Transactions Q1-Q3 FY26', records: 11458, lastUpdated: 'Apr 3, 2026 02:15 PM' },
  { id: 'ds-2', source: 'SAP ERP — All invoices processed Q1-Q3 FY26', records: 3891, lastUpdated: 'Apr 1, 2026 09:30 AM' },
  { id: 'ds-3', source: 'SAP ERP — POs > $10K, Q1-Q3 FY26', records: 847, lastUpdated: 'Mar 28, 2026 04:45 PM' },
  { id: 'ds-4', source: 'SAP ERP — Manual journal entries Q1-Q3 FY26', records: 2134, lastUpdated: 'Mar 25, 2026 11:00 AM' },
  { id: 'ds-5', source: 'Excel Upload — Vendor Master Data', records: 562, lastUpdated: 'Mar 20, 2026 03:20 PM' },
];

type PopulationState = 'NO_DATA_SELECTED' | 'DATA_SELECTED' | 'SNAPSHOT_CREATED';
type SourceMode = 'existing' | 'upload' | null;

function PopulationStep({ ctrl, onGoToStep, onPopulationLocked }: { ctrl: ControlDetail; onGoToStep?: (s: TestingStep) => void; onPopulationLocked?: (info: { locked: boolean; recordCount: number; source: string; snapshotId: string }) => void }) {
  const logEvent = useAuditLog();
  // Always start with NO_DATA_SELECTED — user must explicitly choose
  const [popState, setPopState] = useState<PopulationState>('NO_DATA_SELECTED');
  const [sourceMode, setSourceMode] = useState<SourceMode>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; records: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [locking, setLocking] = useState(false);

  // Resolved dataset info (from selection or upload)
  const selectedDataset = selectedDatasetId ? EXISTING_DATASETS.find(d => d.id === selectedDatasetId) : null;

  const datasetInfo = popState !== 'NO_DATA_SELECTED' ? {
    source: selectedDataset?.source || uploadedFile?.name || '',
    records: selectedDataset?.records || uploadedFile?.records || 0,
    columns: 12,
    auditPeriod: 'Apr 2025 — Mar 2026',
    uploadedBy: ctrl.assignee,
    uploadedAt: selectedDataset?.lastUpdated || 'Just now',
    snapshotId: `POP-SNAP-${ctrl.controlId}-001`,
    lockedAt: '',
    lockedBy: ctrl.assignee,
  } : null;

  const handleSelectDataset = () => {
    if (!selectedDatasetId) return;
    setPopState('DATA_SELECTED');
    if (selectedDataset) logEvent({ action: 'Update', description: `Selected population dataset "${selectedDataset.source}" (${selectedDataset.records} records) for ${ctrl.controlId}`, module: 'Engagements', entity: 'Sample' });
  };

  const handleFileUpload = (fileName: string) => {
    // Simulate parsing
    const mockRecords = Math.floor(Math.random() * 5000) + 500;
    setUploadedFile({ name: fileName, records: mockRecords });
    setPopState('DATA_SELECTED');
    logEvent({ action: 'Upload', description: `Uploaded population file "${fileName}" for ${ctrl.controlId}`, module: 'Engagements', entity: 'Sample' });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      handleFileUpload(file.name);
    }
  };

  const handleLock = () => {
    setLocking(true);
    setTimeout(() => {
      setPopState('SNAPSHOT_CREATED');
      setLocking(false);
      onPopulationLocked?.({ locked: true, recordCount: datasetInfo?.records || 0, source: datasetInfo?.source || '', snapshotId: datasetInfo?.snapshotId || `POP-SNAP-${ctrl.controlId}-001` });
      logEvent({ action: 'Update', description: `Locked population snapshot for ${ctrl.controlName}`, module: 'Engagements', entity: 'Control' });
    }, 800);
  };

  const handleChangeSource = () => {
    setPopState('NO_DATA_SELECTED');
    setSourceMode(null);
    setSelectedDatasetId(null);
    setUploadedFile(null);
  };

  return (
    <div className="space-y-5">

      {/* ── A. Select Population Source ── */}
      {popState === 'NO_DATA_SELECTED' && (
        <div>
          <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
            <Database size={11} />
            Select Population Source
            <span className="px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ml-auto bg-draft-50 text-draft-700">No Data Selected</span>
          </h4>

          {/* Source mode selection — radio cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => setSourceMode('existing')}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                sourceMode === 'existing'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border-light hover:border-primary/30 bg-white'
              }`}>
              <div className="flex items-center gap-2 mb-1.5">
                {sourceMode === 'existing'
                  ? <CheckCircle2 size={14} className="text-primary" />
                  : <div className="w-3.5 h-3.5 rounded-full border-2 border-ink-300" />}
                <span className="text-[0.75rem] font-semibold text-text">Use Existing Dataset</span>
              </div>
              <p className="text-[0.625rem] text-text-muted ml-5.5">Select from previously uploaded or connected data sources.</p>
            </button>
            <button onClick={() => setSourceMode('upload')}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                sourceMode === 'upload'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border-light hover:border-primary/30 bg-white'
              }`}>
              <div className="flex items-center gap-2 mb-1.5">
                {sourceMode === 'upload'
                  ? <CheckCircle2 size={14} className="text-primary" />
                  : <div className="w-3.5 h-3.5 rounded-full border-2 border-ink-300" />}
                <span className="text-[0.75rem] font-semibold text-text">Upload New Dataset</span>
              </div>
              <p className="text-[0.625rem] text-text-muted ml-5.5">Upload a CSV or XLSX file as a new population source.</p>
            </button>
          </div>

          {/* Option A: Existing dataset list */}
          {sourceMode === 'existing' && (
            <div className="glass-card p-4 space-y-3">
              <p className="text-[0.6875rem] font-semibold text-text-muted uppercase">Available Datasets</p>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {EXISTING_DATASETS.map(ds => (
                  <button key={ds.id} onClick={() => setSelectedDatasetId(ds.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedDatasetId === ds.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border-light hover:border-primary/20'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedDatasetId === ds.id
                          ? <CheckCircle2 size={13} className="text-primary shrink-0" />
                          : <div className="w-3.5 h-3.5 rounded-full border-2 border-ink-300 shrink-0" />}
                        <span className="text-[0.75rem] font-medium text-text truncate">{ds.source}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-1 ml-5.5">
                      <span className="text-[0.625rem] text-text-muted"><span className="font-mono font-semibold text-text">{ds.records.toLocaleString()}</span> records</span>
                      <span className="text-[0.625rem] text-text-muted">Updated {ds.lastUpdated}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={handleSelectDataset} disabled={!selectedDatasetId}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[0.75rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                <Database size={12} />Select Dataset
              </button>
            </div>
          )}

          {/* Option B: Upload new dataset */}
          {sourceMode === 'upload' && (
            <div className="glass-card p-4 space-y-3">
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}>
                <CloudUpload size={32} className={`mx-auto mb-3 ${isDragging ? 'text-primary' : 'text-text-muted'}`} />
                <p className="text-[0.75rem] font-semibold text-text mb-1">Drag & drop your file here</p>
                <p className="text-[0.625rem] text-text-muted mb-3">Accepted formats: CSV, XLSX</p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer">
                  <Upload size={13} />Browse Files
                  <input type="file" accept=".csv,.xlsx" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file.name);
                    }} />
                </label>
              </div>
            </div>
          )}

          {/* Guidance when no source mode selected */}
          {!sourceMode && (
            <div className="flex items-center gap-2 p-3 bg-surface-2/50 rounded-lg">
              <AlertTriangle size={12} className="text-text-muted shrink-0" />
              <p className="text-[0.6875rem] text-text-muted">Choose a population source to continue with testing.</p>
            </div>
          )}
        </div>
      )}

      {/* ── B. Population Dataset Card (after selection, before lock) ── */}
      {popState === 'DATA_SELECTED' && datasetInfo && (
        <div>
          <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
            <Database size={11} />
            Population Dataset
            <span className="px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ml-auto bg-evidence-50 text-evidence-700">Selected</span>
          </h4>
          <div className="glass-card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-[0.625rem] text-text-muted uppercase">Source</span><p className="text-[0.75rem] text-text font-medium">{datasetInfo.source}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Records</span><p className="text-[0.75rem] font-mono text-text">{datasetInfo.records.toLocaleString()}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Columns Detected</span><p className="text-[0.75rem] text-text">{datasetInfo.columns}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Audit Period</span><p className="text-[0.75rem] text-text">{datasetInfo.auditPeriod}</p></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 bg-high-50/50 rounded-lg border border-high/20">
              <AlertTriangle size={12} className="text-high-700 mt-0.5 shrink-0" />
              <p className="text-[0.625rem] text-high-700">Once locked, this population cannot be replaced for this test instance.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleChangeSource}
                className="flex-1 py-2.5 border border-border text-text-secondary rounded-xl text-[0.75rem] font-medium hover:bg-surface-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                <ArrowLeft size={12} />Change Source
              </button>
              <button onClick={handleLock} disabled={locking}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-[0.75rem] font-semibold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5">
                <Lock size={12} />{locking ? 'Locking…' : 'Lock Population Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── C. Population Dataset Card (locked) ── */}
      {popState === 'SNAPSHOT_CREATED' && datasetInfo && (
        <div>
          <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
            <Database size={11} />
            Population Dataset
            <span className="px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ml-auto bg-compliant-50 text-compliant-700">Snapshot Locked</span>
          </h4>
          <div className="glass-card p-4 space-y-3 border-compliant/20">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-[0.625rem] text-text-muted uppercase">Source</span><p className="text-[0.75rem] text-text font-medium">{datasetInfo.source}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Records</span><p className="text-[0.75rem] font-mono text-text">{datasetInfo.records.toLocaleString()}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Snapshot ID</span><p className="text-[0.75rem] font-mono text-brand-700">{datasetInfo.snapshotId}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Locked At</span><p className="text-[0.75rem] text-text">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p></div>
            </div>
            <div className="flex items-center gap-2 p-2.5 bg-compliant-50/50 rounded-lg border border-compliant/20">
              <Lock size={11} className="text-compliant-700 shrink-0" />
              <span className="text-[0.6875rem] text-compliant-700">Population snapshot locked. Next, choose how this control should be tested.</span>
            </div>
            <button onClick={() => onGoToStep?.('execution-mode')}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[0.75rem] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5">
              Continue to Execution Mode<ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── EXECUTION MODE STEP ────────────────────────────────────────────────────

function ExecutionModeStep({ ctrl, executionMode, onSelect, onGoToStep, onCreateTestItems, populationInfo }: {
  ctrl: ControlDetail;
  executionMode: ExecutionMode;
  onSelect: (mode: ExecutionMode) => void;
  onGoToStep: (s: TestingStep) => void;
  onCreateTestItems: (set: SampleSet) => void;
  populationInfo?: { locked: boolean; recordCount: number } | null;
}) {
  const logEvent = useAuditLog();
  const isAutomated = ctrl.workflowName?.toLowerCase().includes('automat') || ctrl.controlName?.toLowerCase().includes('automat');
  const defaultMode = isAutomated ? 'full-run' : 'sampling';

  // Auto-select default on first render if no mode selected
  const effectiveMode = executionMode || defaultMode;

  const options: { id: ExecutionMode; title: string; subtitle: string; recommended?: boolean }[] = [
    { id: 'full-run', title: 'Run on Full Dataset', subtitle: 'Test all records in the population. Recommended for automated controls.', recommended: isAutomated },
    { id: 'sampling', title: 'Use Sampling', subtitle: 'Select a representative subset of records for manual testing.' , recommended: !isAutomated },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[0.875rem] font-bold text-text mb-1">How do you want to test this control?</h3>
        <p className="text-[0.75rem] text-text-muted">Choose whether to test the full population or a sample subset.</p>
      </div>

      <div className="space-y-2">
        {options.map(opt => (
          <button key={opt.id} onClick={() => onSelect(opt.id)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              effectiveMode === opt.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border-light hover:border-primary/30 bg-white'
            }`}>
            <div className="flex items-center gap-2 mb-1">
              {effectiveMode === opt.id
                ? <CheckCircle2 size={14} className="text-primary" />
                : <div className="w-3.5 h-3.5 rounded-full border-2 border-ink-300" />}
              <span className="text-[0.8125rem] font-semibold text-text">{opt.title}</span>
              {opt.recommended && <span className="px-1.5 h-4 rounded text-[0.5rem] font-bold bg-primary/10 text-primary">Recommended</span>}
            </div>
            <p className="text-[0.6875rem] text-text-muted ml-5.5">{opt.subtitle}</p>
          </button>
        ))}
      </div>

      {effectiveMode === 'full-run' && (
        <div className="flex items-center gap-2 p-3 bg-surface-2/50 rounded-lg">
          <Database size={12} className="text-text-muted shrink-0" />
          <p className="text-[0.6875rem] text-text-muted">All records in the population will be tested. Sampling configuration will be skipped.</p>
        </div>
      )}

      {effectiveMode === 'sampling' && (
        <div className="flex items-center gap-2 p-3 bg-surface-2/50 rounded-lg">
          <Filter size={12} className="text-text-muted shrink-0" />
          <p className="text-[0.6875rem] text-text-muted">You'll configure sampling method and size in the next step.</p>
        </div>
      )}

      <button onClick={() => {
          onSelect(effectiveMode);
          if (effectiveMode === 'full-run') {
            const popSize = populationInfo?.recordCount || ctrl.populationSize || 10245;
            onCreateTestItems({ rows: Array.from({ length: Math.min(popSize, 500) }, (_, i) => i), size: popSize, populationSize: popSize, method: 'full', generatedAt: new Date().toISOString() });
            logEvent({ action: 'Create', description: `Selected ${effectiveMode} execution mode — ${popSize} test items for ${ctrl.controlName}`, module: 'Engagements', entity: 'Sample' });
            onGoToStep('evidence');
          } else {
            onGoToStep('samples');
          }
        }}
        className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[0.75rem] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5">
        {effectiveMode === 'full-run' ? 'Continue to Testing' : 'Configure Sampling'}
        <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ─── SAMPLING ENGINE ────────────────────────────────────────────────────────

interface SamplingConfig {
  method: 'random' | 'systematic' | 'monetary-unit' | 'judgmental' | 'full';
  sampleSize: number;
  filters?: { column: string; operator: string; value: string }[];
}

function generateSamples(populationSize: number, config: SamplingConfig): number[] {
  const { method, sampleSize } = config;
  const effectiveSize = Math.min(sampleSize, populationSize);

  if (method === 'full') {
    return Array.from({ length: populationSize }, (_, i) => i);
  }

  if (method === 'random') {
    const indices = new Set<number>();
    while (indices.size < effectiveSize) {
      indices.add(Math.floor(Math.random() * populationSize));
    }
    return Array.from(indices).sort((a, b) => a - b);
  }

  if (method === 'systematic') {
    const interval = Math.max(1, Math.floor(populationSize / effectiveSize));
    const start = Math.floor(Math.random() * interval);
    return Array.from({ length: effectiveSize }, (_, i) => (start + i * interval) % populationSize).sort((a, b) => a - b);
  }

  // Default: random for other methods
  const indices = new Set<number>();
  while (indices.size < effectiveSize) {
    indices.add(Math.floor(Math.random() * populationSize));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

// ─── CREATE SAMPLES STEP (for Manual controls) ─────────────────────────────

function CreateSamplesStep({ ctrl, onGoToStep, onSamplesCreated }: {
  ctrl: ControlDetail; onGoToStep?: (s: TestingStep) => void; onSamplesCreated?: (set: SampleSet) => void;
}) {
  const logEvent = useAuditLog();
  const [items, setItems] = useState<{ ref: string; desc: string }[]>([]);
  const [newRef, setNewRef] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const handleAdd = () => { if (!newRef.trim()) return; const newRefVal = newRef.trim(); setItems(prev => [...prev, { ref: newRefVal, desc: newDesc.trim() }]); setNewRef(''); setNewDesc(''); logEvent({ action: 'Create', description: `Added manual sample "${newRefVal}" for ${ctrl.controlName}`, module: 'Engagements', entity: 'Sample' }); };
  const handleConfirm = () => { if (items.length === 0) return; onSamplesCreated?.({ rows: items.map((_, i) => i), size: items.length, populationSize: items.length, method: 'manual', generatedAt: new Date().toISOString() }); logEvent({ action: 'Create', description: `Confirmed ${items.length} manual samples for ${ctrl.controlName}`, module: 'Engagements', entity: 'Sample' }); onGoToStep?.('evidence'); };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[0.875rem] font-bold text-text mb-1">Select Samples for Testing</h3>
        <p className="text-[0.75rem] text-text-muted">Add the items you want to test manually. No population dataset is required.</p>
      </div>
      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[0.625rem] text-text-muted uppercase block mb-1">Reference ID <span className="text-red-400">*</span></label>
            <input value={newRef} onChange={e => setNewRef(e.target.value)} placeholder="e.g. INV-2026-001"
              className="w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 bg-white"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
          </div>
          <div>
            <label className="text-[0.625rem] text-text-muted uppercase block mb-1">Description</label>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional"
              className="w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 bg-white"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
          </div>
        </div>
        <button onClick={handleAdd} disabled={!newRef.trim()} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[0.6875rem] font-semibold hover:bg-primary/20 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><Plus size={11} />Add Sample</button>
      </div>
      {items.length > 0 && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-[0.6875rem]">
            <thead><tr className="border-b border-border bg-surface-2/50">
              <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-text-muted uppercase">Sample</th>
              <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-text-muted uppercase">Reference</th>
              <th className="px-3 py-2 text-left text-[0.5625rem] font-semibold text-text-muted uppercase">Description</th>
              <th className="px-3 py-2 w-8"></th>
            </tr></thead>
            <tbody>{items.map((s, i) => (
              <tr key={i} className="border-b border-border/40">
                <td className="px-3 py-2 font-mono text-text-muted">S-{String(i + 1).padStart(3, '0')}</td>
                <td className="px-3 py-2 text-text">{s.ref}</td>
                <td className="px-3 py-2 text-text-muted">{s.desc || '—'}</td>
                <td className="px-3 py-2"><button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-ink-400 hover:text-risk-700 cursor-pointer"><X size={11} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <button onClick={handleConfirm} disabled={items.length === 0}
        className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[0.75rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
        Confirm {items.length} Sample{items.length !== 1 ? 's' : ''} & Proceed to Evidence
      </button>
    </div>
  );
}

// ─── SAMPLES STEP (NEW) ─────────────────────────────────────────────────────

function SamplesStep({ ctrl, onGoToStep }: { ctrl: ControlDetail; onGoToStep?: (s: TestingStep) => void }) {
  const logEvent = useAuditLog();
  const [samplingMethod, setSamplingMethod] = useState<'random' | 'mus' | 'risk-based' | 'manual'>('random');
  const [sampleSize, setSampleSize] = useState(25);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(ctrl.samples.length > 0);
  const [previewIndices, setPreviewIndices] = useState<number[]>([]);

  const populationSize = ctrl.populationSize || 10245;
  const recommendedMin = Math.min(25, populationSize);
  const recommendedMax = Math.min(40, populationSize);

  // Generate preview when config changes
  const handlePreview = () => {
    const indices = generateSamples(populationSize, { method: samplingMethod === 'random' ? 'random' : 'random', sampleSize: Math.min(5, sampleSize), filters: [] });
    setPreviewIndices(indices);
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerated(true);
      setGenerating(false);
      logEvent({ action: 'Create', description: `Generated samples (${samplingMethod}) — ${sampleSize} of ${populationSize} for ${ctrl.controlName}`, module: 'Engagements', entity: 'Sample' });
    }, 1200);
  };

  // Gate: population not ready
  if (ctrl.populationStatus === 'none') {
    return (
      <div className="text-center py-14">
        <Lock size={28} className="text-text-muted mx-auto mb-3" />
        <p className="text-[0.875rem] font-semibold text-text mb-1">Population not available</p>
        <p className="text-[0.75rem] text-text-muted mb-4">Upload and lock the population dataset before configuring sampling.</p>
        <button onClick={() => onGoToStep?.('population')} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer">Go to Population</button>
      </div>
    );
  }

  // Sampling Configuration UI — not yet generated
  if (ctrl.samples.length === 0 && !generated) {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-[0.875rem] font-bold text-text mb-1">Sampling Configuration</h3>
          <p className="text-[0.75rem] text-text-muted">Configure how transactions will be selected from the population for testing.</p>
        </div>

        {/* Sampling Method */}
        <div>
          <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Sampling Method</h4>
          <div className="space-y-1.5">
            {([
              { id: 'random' as const, label: 'Random Sampling', desc: 'Randomly select transactions from the population', enabled: true },
              { id: 'mus' as const, label: 'Monetary Unit Sampling (MUS)', desc: 'Weight selection by monetary value', enabled: false },
              { id: 'risk-based' as const, label: 'Risk-Based Sampling', desc: 'Prioritize higher-risk transactions', enabled: false },
              { id: 'manual' as const, label: 'Manual Selection', desc: 'Manually pick specific transactions', enabled: false },
            ]).map(m => (
              <button key={m.id} onClick={() => { if (m.enabled) setSamplingMethod(m.id); }}
                disabled={!m.enabled}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  samplingMethod === m.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20 cursor-pointer'
                    : m.enabled ? 'border-border-light hover:border-primary/20 cursor-pointer' : 'border-border-light bg-canvas/50 opacity-50 cursor-not-allowed'
                }`}>
                <div className="flex items-center gap-2">
                  {samplingMethod === m.id ? <CheckCircle2 size={13} className="text-primary shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-ink-300 shrink-0" />}
                  <span className="text-[0.75rem] font-semibold text-text">{m.label}</span>
                  {!m.enabled && <span className="px-1.5 h-4 rounded text-[0.5rem] font-bold bg-canvas text-ink-400 ml-auto">Coming Soon</span>}
                </div>
                <p className="text-[0.625rem] text-text-muted mt-0.5 ml-5.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Sample Size */}
        <div>
          <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Sample Size</h4>
          <div className="glass-card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.625rem] text-text-muted uppercase block mb-1">Number of Samples</label>
                <input type="number" min={1} max={populationSize} value={sampleSize}
                  onChange={e => setSampleSize(Math.max(1, Math.min(populationSize, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 bg-white" />
              </div>
              <div>
                <label className="text-[0.625rem] text-text-muted uppercase block mb-1">Population Size</label>
                <div className="px-3 py-2 border border-border rounded-lg text-[0.75rem] font-mono text-text bg-canvas cursor-not-allowed">{populationSize.toLocaleString()}</div>
              </div>
            </div>
            <p className="text-[0.625rem] text-text-muted">Recommended: {recommendedMin}–{recommendedMax} samples for this dataset.</p>
            {sampleSize > populationSize && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-50/50 rounded-lg border border-amber-200/50">
                <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                <span className="text-[0.625rem] text-amber-700">Sample size exceeds population. All records will be selected.</span>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase">Preview</h4>
            <button onClick={handlePreview} className="text-[0.625rem] font-semibold text-primary hover:underline cursor-pointer">Refresh Preview</button>
          </div>
          <div className="glass-card p-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><span className="text-[0.625rem] text-text-muted uppercase">Population</span><p className="text-[0.75rem] font-mono text-text">{populationSize.toLocaleString()}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Sample Size</span><p className="text-[0.75rem] font-mono text-primary">{Math.min(sampleSize, populationSize)}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Method</span><p className="text-[0.75rem] text-text capitalize">{samplingMethod}</p></div>
            </div>
            {previewIndices.length > 0 ? (
              <div>
                <p className="text-[0.625rem] text-text-muted mb-1.5">Sample preview (first 5 rows):</p>
                <div className="space-y-1">
                  {previewIndices.slice(0, 5).map((idx, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded bg-surface-2/50 text-[0.6875rem]">
                      <span className="text-text-muted font-mono w-8">#{idx + 1}</span>
                      <span className="text-text">Transaction Row {idx + 1}</span>
                      <span className="text-text-muted ml-auto font-mono">₹{(Math.random() * 50000 + 1000).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[0.6875rem] text-text-muted text-center py-3">Click "Refresh Preview" to see sample rows.</p>
            )}
          </div>
        </div>

        {/* CTA */}
        <button onClick={handleGenerate} disabled={generating}
          className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[0.75rem] font-semibold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5">
          <Zap size={12} />{generating ? 'Generating…' : 'Select Transactions for Testing'}
        </button>
      </div>
    );
  }

  // Evidence readiness logic (NOT testing result)
  const requiredEvidenceCount = ctrl.workflowAttributes.filter(a => a.requiredEvidence).length;
  const getReadiness = (s: SampleItem): { label: string; cls: string } => {
    if (s.evidenceFiles.length === 0) return { label: 'Evidence Needed', cls: 'bg-risk-50 text-risk-700' };
    if (s.evidenceFiles.length < requiredEvidenceCount) return { label: 'Evidence Partial', cls: 'bg-high-50 text-high-700' };
    return { label: 'Evidence Ready', cls: 'bg-compliant-50 text-compliant-700' };
  };

  const readyCt = ctrl.samples.filter(s => getReadiness(s).label === 'Evidence Ready').length;
  const partialCt = ctrl.samples.filter(s => getReadiness(s).label === 'Evidence Partial').length;
  const neededCt = ctrl.samples.filter(s => getReadiness(s).label === 'Evidence Needed').length;

  return (
    <div className="space-y-5">
      {/* ── A. Sample Selection Summary ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <Database size={11} />Sample Selection Summary
        </h4>
        <div className="glass-card p-4">
          <div className="grid grid-cols-3 gap-3">
            <div><span className="text-[0.625rem] text-text-muted uppercase">Population Snapshot</span><p className="text-[0.75rem] font-mono text-brand-700">POP-SNAP-{ctrl.controlId}-001</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Population Size</span><p className="text-[0.75rem] font-mono text-text">{ctrl.populationSize.toLocaleString()}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Sampling Method</span><p className="text-[0.75rem] text-text">{ctrl.samplingMethod || 'Random'}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Sample Size</span><p className="text-[0.75rem] font-mono text-brand-700">{ctrl.samples.length}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Generated At</span><p className="text-[0.75rem] text-text">Apr 6, 2026 10:30 AM</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Generated By</span><p className="text-[0.75rem] text-text">{ctrl.assignee}</p></div>
          </div>
        </div>
      </div>

      {/* ── B. Required Evidence per Sample ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <FileText size={11} />Required Evidence for Each Sample
        </h4>
        <div className="glass-card p-3">
          <div className="flex flex-wrap gap-1.5">
            {ctrl.workflowAttributes.filter(a => a.requiredEvidence).map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100">
                <Paperclip size={9} />{a.requiredEvidence.split(',')[0].split(' or ')[0].trim()}
              </span>
            ))}
          </div>
          <p className="text-[0.625rem] text-text-muted mt-2">{requiredEvidenceCount} evidence items expected per sample · {readyCt} ready · {partialCt} partial · {neededCt} needed</p>
        </div>
      </div>

      {/* ── C. Sample Table ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">
          Samples ({ctrl.samples.length})
        </h4>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Sample ID</th>
                <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Reference</th>
                <th className="px-3 py-2.5 text-right text-[0.625rem] font-semibold text-text-muted uppercase">Amount</th>
                <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase">Evidence</th>
                <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase">Readiness</th>
                <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {ctrl.samples.map(s => {
                const readiness = getReadiness(s);
                return (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-surface-2/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="text-[0.75rem] font-medium text-text">{s.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[0.6875rem] font-mono text-text-muted">{s.referenceId}</td>
                    <td className="px-3 py-2.5 text-right text-[0.6875rem] tabular-nums text-text-secondary">{s.amount}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[0.625rem] font-bold ${s.evidenceFiles.length > 0 ? 'text-text-secondary' : 'text-ink-400'}`}>
                        {s.evidenceFiles.length}/{requiredEvidenceCount}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 h-5 rounded text-[0.625rem] font-bold ${readiness.cls}`}>{readiness.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onGoToStep?.('evidence')} className="text-[0.625rem] font-semibold text-primary hover:underline cursor-pointer">
                          {s.evidenceFiles.length === 0 ? 'Upload' : 'View'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── D. Readiness Summary ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-3 text-center">
          <div className="text-lg font-bold text-compliant-700 tabular-nums">{readyCt}</div>
          <div className="text-[0.5625rem] text-text-muted uppercase">Evidence Ready</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className={`text-lg font-bold tabular-nums ${partialCt > 0 ? 'text-high-700' : 'text-text-muted'}`}>{partialCt}</div>
          <div className="text-[0.5625rem] text-text-muted uppercase">Partial</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className={`text-lg font-bold tabular-nums ${neededCt > 0 ? 'text-risk-700' : 'text-text-muted'}`}>{neededCt}</div>
          <div className="text-[0.5625rem] text-text-muted uppercase">Needed</div>
        </div>
      </div>

      {/* ── E. Next Action ── */}
      {neededCt > 0 && (
        <div className="flex items-center gap-2 p-3 bg-high-50/30 rounded-lg border border-high/10">
          <FileText size={12} className="text-high-700 shrink-0" />
          <p className="text-[0.6875rem] text-high-700">{neededCt} samples still need evidence. Upload evidence before proceeding to attribute testing.</p>
        </div>
      )}
      {neededCt === 0 && (
        <div className="flex items-center gap-2 p-3 bg-compliant-50/30 rounded-lg border border-compliant/10">
          <CheckCircle2 size={12} className="text-compliant-700 shrink-0" />
          <p className="text-[0.6875rem] text-compliant-700">All samples have evidence. Ready to proceed to attribute testing.</p>
        </div>
      )}
    </div>
  );
}

// ─── EVIDENCE STEP ───────────────────────────────────────────────────────────

function EvidenceStep({ ctrl }: { ctrl: ControlDetail }) {
  const [expandedSample, setExpandedSample] = useState<string | null>(ctrl.samples.find(s => s.evidenceFiles.length === 0)?.id || null);

  // Required evidence types from workflow attributes
  const requiredTypes = ctrl.workflowAttributes.filter(a => a.requiredEvidence).map(a => a.requiredEvidence.split(',')[0].split(' or ')[0].trim());
  const requiredCount = requiredTypes.length;

  // Evidence status per sample
  const getEvidenceStatus = (s: SampleItem): { label: string; cls: string } => {
    if (s.evidenceFiles.length === 0) return { label: 'Missing', cls: 'bg-risk-50 text-risk-700' };
    if (s.evidenceFiles.length < requiredCount) return { label: 'Partial', cls: 'bg-high-50 text-high-700' };
    return { label: 'Complete', cls: 'bg-compliant-50 text-compliant-700' };
  };

  const totalFiles = ctrl.samples.reduce((sum, s) => sum + s.evidenceFiles.length, 0);
  const completeCt = ctrl.samples.filter(s => getEvidenceStatus(s).label === 'Complete').length;
  const partialCt = ctrl.samples.filter(s => getEvidenceStatus(s).label === 'Partial').length;
  const missingCt = ctrl.samples.filter(s => getEvidenceStatus(s).label === 'Missing').length;

  if (ctrl.samples.length === 0) {
    return (
      <div className="text-center py-14">
        <FileText size={28} className="text-text-muted mx-auto mb-3" />
        <p className="text-[0.875rem] font-semibold text-text mb-1">No samples to collect evidence for</p>
        <p className="text-[0.75rem] text-text-muted">Generate samples from the Population tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── A. Bulk Upload (secondary helper) ── */}
      <div className="border border-dashed border-border-light rounded-xl p-3 hover:border-primary/20 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CloudUpload size={16} className="text-text-muted" />
            <div>
              <p className="text-[0.75rem] font-medium text-text">Bulk upload evidence files</p>
              <p className="text-[0.625rem] text-text-muted">Files will need to be mapped to specific samples below</p>
            </div>
          </div>
          <button className="px-3 py-1.5 border border-border text-text-secondary rounded-lg text-[0.6875rem] font-medium hover:bg-surface-2 transition-colors cursor-pointer flex items-center gap-1.5">
            <Upload size={11} />Browse Files
          </button>
        </div>
      </div>

      {/* ── B. Evidence Summary ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Evidence Status</h4>
        <div className="grid grid-cols-4 gap-2">
          <div className="glass-card p-2.5 text-center">
            <div className="text-lg font-bold text-text tabular-nums">{totalFiles}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Files Uploaded</div>
          </div>
          <div className="glass-card p-2.5 text-center">
            <div className="text-lg font-bold text-compliant-700 tabular-nums">{completeCt}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Complete</div>
          </div>
          <div className="glass-card p-2.5 text-center">
            <div className={`text-lg font-bold tabular-nums ${partialCt > 0 ? 'text-high-700' : 'text-text-muted'}`}>{partialCt}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Partial</div>
          </div>
          <div className="glass-card p-2.5 text-center">
            <div className={`text-lg font-bold tabular-nums ${missingCt > 0 ? 'text-risk-700' : 'text-text-muted'}`}>{missingCt}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Missing</div>
          </div>
        </div>
      </div>

      {/* ── C. Sample-wise Evidence Cards ── */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Evidence by Sample</h4>
        <div className="space-y-2">
          {ctrl.samples.map(sample => {
            const evStatus = getEvidenceStatus(sample);
            const isExpanded = expandedSample === sample.id;

            return (
              <div key={sample.id} className={`glass-card overflow-hidden ${evStatus.label === 'Missing' ? 'border-risk/10' : ''}`}>
                {/* Sample header row */}
                <button onClick={() => setExpandedSample(isExpanded ? null : sample.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${evStatus.label === 'Complete' ? 'bg-compliant' : evStatus.label === 'Partial' ? 'bg-high' : 'bg-risk'}`} />
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.75rem] font-semibold text-text">{sample.label}</span>
                        <span className="text-[0.625rem] font-mono text-text-muted">{sample.referenceId}</span>
                        <span className="text-[0.625rem] text-text-muted">{sample.amount}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[0.625rem] tabular-nums text-text-muted">{sample.evidenceFiles.length}/{requiredCount}</span>
                    <span className={`inline-flex items-center px-2 h-5 rounded text-[0.625rem] font-bold ${evStatus.cls}`}>{evStatus.label}</span>
                    <ChevronDown size={12} className={`text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border-light/60 pt-3 space-y-3">
                    {/* Required evidence checklist */}
                    <div>
                      <span className="text-[0.625rem] font-bold text-text-muted uppercase">Required Evidence</span>
                      <div className="mt-1.5 space-y-1">
                        {requiredTypes.map((type, i) => {
                          // Try to match uploaded files to required types
                          const matchedFile = sample.evidenceFiles.find(f => {
                            const fl = f.toLowerCase();
                            const tl = type.toLowerCase();
                            return fl.includes(tl.split(' ')[0].toLowerCase()) || (tl.includes('PO') && fl.includes('po')) || (tl.includes('GRN') && fl.includes('grn')) || (tl.includes('Invoice') && fl.includes('inv')) || (tl.includes('Approval') && fl.includes('approval')) || (tl.includes('Tolerance') && fl.includes('tolerance')) || (tl.includes('Override') && fl.includes('override'));
                          });
                          // Fallback: just check by index
                          const fileForSlot = matchedFile || (i < sample.evidenceFiles.length ? sample.evidenceFiles[i] : null);

                          return (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-2/40">
                              <div className="flex items-center gap-2">
                                {fileForSlot ? <CheckCircle2 size={12} className="text-compliant-700 shrink-0" /> : <div className="w-3 h-3 rounded-full border-2 border-ink-300 shrink-0" />}
                                <span className={`text-[0.6875rem] font-medium ${fileForSlot ? 'text-text' : 'text-text-muted'}`}>{type}</span>
                              </div>
                              {fileForSlot ? (
                                <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                                  <Paperclip size={8} />{fileForSlot}
                                </span>
                              ) : (
                                <button className="text-[0.625rem] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
                                  <Upload size={9} />Upload
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Additional uploaded files not matching required types */}
                    {sample.evidenceFiles.length > requiredCount && (
                      <div>
                        <span className="text-[0.625rem] font-bold text-text-muted uppercase">Additional Files</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {sample.evidenceFiles.slice(requiredCount).map(f => (
                            <span key={f} className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-text-secondary bg-surface-2 px-2 py-0.5 rounded border border-border-light">
                              <Paperclip size={8} />{f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sample actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.625rem] font-semibold transition-colors cursor-pointer flex items-center gap-1.5">
                        <Upload size={10} />Upload Evidence
                      </button>
                      {sample.evidenceFiles.length > 0 && (
                        <button className="px-3 py-1.5 border border-border text-text-secondary rounded-lg text-[0.625rem] font-medium hover:bg-surface-2 transition-colors cursor-pointer flex items-center gap-1.5">
                          <Eye size={10} />View Files
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── D. Validation Guidance ── */}
      {missingCt > 0 && (
        <div className="flex items-center gap-2 p-3 bg-high-50/30 rounded-lg border border-high/10">
          <AlertTriangle size={12} className="text-high-700 shrink-0" />
          <p className="text-[0.6875rem] text-high-700">Upload required evidence for all {missingCt} samples before proceeding to attribute testing.</p>
        </div>
      )}
      {missingCt === 0 && partialCt > 0 && (
        <div className="flex items-center gap-2 p-3 bg-high-50/20 rounded-lg border border-high/10">
          <FileText size={12} className="text-high-700 shrink-0" />
          <p className="text-[0.6875rem] text-high-700">{partialCt} samples have partial evidence. Consider uploading remaining files.</p>
        </div>
      )}
      {missingCt === 0 && partialCt === 0 && (
        <div className="flex items-center gap-2 p-3 bg-compliant-50/30 rounded-lg border border-compliant/10">
          <CheckCircle2 size={12} className="text-compliant-700 shrink-0" />
          <p className="text-[0.6875rem] text-compliant-700">All samples have complete evidence. Ready for attribute testing.</p>
        </div>
      )}
    </div>
  );
}

// ─── ATTRIBUTE TESTING STEP ──────────────────────────────────────────────────

function AttributeTestingStep({ ctrl }: { ctrl: ControlDetail }) {
  const [selectedSample, setSelectedSample] = useState(ctrl.samples[0]?.id || '');
  const sample = ctrl.samples.find(s => s.id === selectedSample);
  const workflows = getLinkedWorkflows(ctrl);

  if (ctrl.samples.length === 0) {
    return (
      <div className="text-center py-14">
        <Lock size={28} className="text-text-muted mx-auto mb-3" />
        <p className="text-[0.875rem] font-semibold text-text mb-1">Select transactions before testing</p>
        <p className="text-[0.75rem] text-text-muted">Choose an execution mode and generate test items first.</p>
      </div>
    );
  }

  // Group attributes by assertion
  const groupByAssertion = () => {
    const groups: Record<string, typeof ctrl.workflowAttributes> = {};
    ctrl.workflowAttributes.forEach(attr => {
      const assertionList = attr.assertions && attr.assertions.length > 0 ? attr.assertions : ['General'];
      assertionList.forEach(a => {
        const key = a.charAt(0).toUpperCase() + a.slice(1);
        if (!groups[key]) groups[key] = [];
        if (!groups[key].some(x => x.id === attr.id)) groups[key].push(attr);
      });
    });
    return groups;
  };
  const assertionGroups = groupByAssertion();
  const assertionKeys = Object.keys(assertionGroups);

  // Derive sample-level result
  const getSampleResult = (s: SampleItem): 'pass' | 'fail' | 'pending' => {
    const results = ctrl.workflowAttributes.map(a => s.attributes[a.id] || 'pending');
    if (results.some(r => r === 'fail')) return 'fail';
    if (results.every(r => r === 'pass' || r === 'na')) return 'pass';
    return 'pending';
  };

  // Progress
  const totalAttrs = ctrl.workflowAttributes.length;
  const totalSamples = ctrl.samples.length;
  const testedSamples = ctrl.samples.filter(s => getSampleResult(s) !== 'pending').length;
  const totalCells = totalAttrs * totalSamples;
  const completedCells = ctrl.samples.reduce((sum, s) => sum + Object.values(s.attributes).filter(v => v !== 'pending').length, 0);
  const progressPct = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0;

  // Find workflow for an attribute
  const getAttrWorkflow = (attr: typeof ctrl.workflowAttributes[0]) => {
    if (attr.workflowId) {
      const wf = workflows.find(w => w.id === attr.workflowId);
      return wf?.name || '';
    }
    return workflows[0]?.name || '';
  };

  // Is automated
  const isAutoAttr = (attr: typeof ctrl.workflowAttributes[0]) => {
    const wfName = getAttrWorkflow(attr).toLowerCase();
    return wfName.includes('automat') || wfName.includes('detector') || wfName.includes('scanner');
  };

  return (
    <div className="space-y-4">
      {/* Header + progress */}
      <div className="flex items-center justify-between">
        <h4 className="text-[0.875rem] font-bold text-text">Attribute Testing</h4>
        <span className="text-[0.625rem] text-text-muted">{completedCells}/{totalCells} attributes tested · {progressPct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex gap-4">
        {/* Sample sidebar */}
        <div className="w-44 shrink-0">
          <div className="text-[0.625rem] font-bold text-text-muted uppercase mb-2">Samples ({testedSamples}/{totalSamples})</div>
          <div className="space-y-1 max-h-[450px] overflow-y-auto">
            {ctrl.samples.map(s => {
              const result = getSampleResult(s);
              return (
                <button key={s.id} onClick={() => setSelectedSample(s.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[0.6875rem] transition-all cursor-pointer ${
                    selectedSample === s.id ? 'bg-primary/10 text-primary font-semibold ring-1 ring-primary/20' : 'hover:bg-surface-2 text-text-secondary'
                  }`}>
                  <SampleStatusDot status={result === 'pass' ? 'pass' : result === 'fail' ? 'fail' : s.status} />
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{s.label}</div><div className="text-[0.625rem] text-text-muted truncate">{s.amount}</div></div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Attribute testing panel — grouped by assertion */}
        <div className="flex-1 min-w-0">
          {sample ? (
            <div>
              {/* Sample header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-light">
                <div>
                  <span className="text-[0.8125rem] font-semibold text-text">{sample.label}</span>
                  <span className="text-[0.6875rem] text-text-muted ml-2">{sample.referenceId} · {sample.amount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.625rem] text-text-muted">{sample.evidenceFiles.length} evidence</span>
                  {(() => {
                    const r = getSampleResult(sample);
                    return <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-bold inline-flex items-center ${r === 'pass' ? 'bg-compliant-50 text-compliant-700' : r === 'fail' ? 'bg-risk-50 text-risk-700' : 'bg-canvas text-ink-500'}`}>
                      {r === 'pass' ? 'Passed' : r === 'fail' ? 'Failed' : 'Pending'}
                    </span>;
                  })()}
                </div>
              </div>

              {/* Assertion groups */}
              {assertionKeys.map(assertion => {
                const attrs = assertionGroups[assertion];
                const completedInGroup = attrs.filter(a => (sample.attributes[a.id] || 'pending') !== 'pending').length;
                return (
                  <div key={assertion} className="mb-4">
                    {/* Assertion header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-surface-2/50 rounded-lg mb-2">
                      <div className="flex items-center gap-2">
                        <Shield size={11} className="text-brand-600" />
                        <span className="text-[0.6875rem] font-bold text-text">{assertion}</span>
                        <span className="text-[0.5625rem] text-text-muted">({attrs.length} attribute{attrs.length !== 1 ? 's' : ''})</span>
                      </div>
                      <span className="text-[0.5625rem] text-text-muted">{completedInGroup}/{attrs.length} done</span>
                    </div>

                    {/* Attribute rows */}
                    <div className="space-y-1.5">
                      {attrs.map(attr => {
                        const result = sample.attributes[attr.id] || 'pending';
                        const isAuto = isAutoAttr(attr);
                        const wfName = getAttrWorkflow(attr);
                        const evCount = sample.evidenceFiles.length;
                        return (
                          <div key={attr.id} className="glass-card p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[0.75rem] font-medium text-text">{attr.name}</span>
                                  <span className={`px-1.5 h-4 rounded text-[0.5rem] font-bold inline-flex items-center ${isAuto ? 'bg-evidence-50 text-evidence-700' : 'bg-canvas text-ink-500'}`}>
                                    {isAuto ? 'Auto' : 'Manual'}
                                  </span>
                                </div>
                                {wfName && <div className="text-[0.5625rem] text-text-muted flex items-center gap-1"><Workflow size={8} />{wfName}</div>}
                                <p className="text-[0.625rem] text-text-muted mt-1">{attr.description}</p>
                                {evCount > 0 && (
                                  <div className="text-[0.5625rem] text-brand-600 mt-1 flex items-center gap-1"><Paperclip size={8} />{evCount} evidence file{evCount !== 1 ? 's' : ''}</div>
                                )}
                              </div>

                              {/* Result selector */}
                              <div className="shrink-0 flex flex-col items-end gap-1">
                                <AttrResultChip result={result} />
                                {!isAuto ? (
                                  <div className="flex gap-0.5">
                                    {(['pass', 'fail', 'na'] as const).map(r => (
                                      <button key={r} className={`w-6 h-6 rounded text-[0.5625rem] font-bold cursor-pointer transition-all flex items-center justify-center ${
                                        result === r ? (r === 'pass' ? 'bg-compliant text-white' : r === 'fail' ? 'bg-risk text-white' : 'bg-ink-500 text-white') : 'bg-surface-2 text-text-muted hover:bg-primary/10'
                                      }`}>{r === 'pass' ? '✓' : r === 'fail' ? '✗' : '—'}</button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[0.5rem] text-evidence-600">Auto-evaluated</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Sample result summary */}
              {(() => {
                const r = getSampleResult(sample);
                const failedAttrs = ctrl.workflowAttributes.filter(a => sample.attributes[a.id] === 'fail');
                return (
                  <div className={`rounded-lg p-3 mt-2 ${r === 'pass' ? 'bg-compliant-50/30 border border-compliant/20' : r === 'fail' ? 'bg-risk-50/30 border border-risk/20' : 'bg-surface-2/50 border border-border-light'}`}>
                    <div className="flex items-center gap-2">
                      {r === 'pass' && <CheckCircle2 size={13} className="text-compliant-700" />}
                      {r === 'fail' && <XCircle size={13} className="text-risk-700" />}
                      {r === 'pending' && <Clock size={13} className="text-text-muted" />}
                      <span className={`text-[0.75rem] font-semibold ${r === 'pass' ? 'text-compliant-700' : r === 'fail' ? 'text-risk-700' : 'text-text-muted'}`}>
                        Sample Result: {r === 'pass' ? 'Passed' : r === 'fail' ? `Failed (${failedAttrs.length} attribute${failedAttrs.length !== 1 ? 's' : ''} failed)` : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : <div className="text-center py-12 text-text-muted text-[0.8125rem]">Select a sample</div>}
        </div>
      </div>
    </div>
  );
}

// ─── WORKING PAPER STEP ──────────────────────────────────────────────────────

function WorkingPaperStep({ ctrl, onSubmitForReview }: { ctrl: ControlDetail; onSubmitForReview?: () => void }) {
  const wp = ctrl.workingPaper;
  const [newComment, setNewComment] = useState('');
  const [expandedRound, setExpandedRound] = useState<number | null>(wp.rounds.length > 0 ? wp.rounds[wp.rounds.length - 1].round : null);
  const failed = ctrl.samples.filter(s => s.status === 'fail' || s.status === 'exception').length;
  const tested = ctrl.samples.filter(s => s.status !== 'not-tested').length;
  const failedSamples = ctrl.samples.filter(s => s.status === 'fail' || s.status === 'exception' || Object.values(s.attributes).some(v => v === 'fail'));
  const isReviewSubmitted = ctrl.status === 'pending-review' || isConcluded(ctrl.status);

  return (
    <div className="space-y-5">
      {/* ── Header + Download ── */}
      <div className="flex items-center justify-between">
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase">Working Paper</h4>
        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] text-text-muted">System-generated · Append-only</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/30 bg-primary/5 text-primary rounded-lg text-[0.625rem] font-semibold hover:bg-primary/10 transition-colors cursor-pointer">
            <Download size={10} />Download
          </button>
        </div>
      </div>

      {/* ── Test Instance Header ── */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-[0.625rem] text-text-muted uppercase">Test Instance</span><p className="text-[0.75rem] font-mono text-text">{wp.testInstanceId}</p></div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Control</span><p className="text-[0.75rem] text-text">{wp.controlName}</p></div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Workflow</span><p className="text-[0.75rem] text-brand-700">{wp.workflowName} {wp.workflowVersion}</p></div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Rounds</span><p className="text-[0.75rem] text-text">{wp.rounds.length || 'None yet'}</p></div>
        </div>
      </div>

      {/* ── 1. CONTROL DESIGN SECTION ── */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <Shield size={11} />Control Design
        </h5>
        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><span className="text-[0.625rem] text-text-muted uppercase">Control Description</span><p className="text-[0.75rem] text-text-secondary leading-relaxed mt-0.5">{ctrl.description}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Control Owner</span><p className="text-[0.75rem] text-text">{ctrl.controlOwner}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Frequency</span><p className="text-[0.75rem] text-text">{ctrl.frequency}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Business Process</span><p className="text-[0.75rem] text-text">{ctrl.domain}</p></div>
            {ctrl.assertions.length > 0 && (
              <div><span className="text-[0.625rem] text-text-muted uppercase">Assertions</span>
                <div className="flex flex-wrap gap-1 mt-0.5">{ctrl.assertions.map(a => (
                  <span key={a} className="px-2 py-0.5 rounded text-[0.625rem] font-medium bg-brand-50 text-brand-700 border border-brand-100">{a}</span>
                ))}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. TEST ATTRIBUTES SECTION ── */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <Target size={11} />Test Attributes
        </h5>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                <th className="px-3 py-2 text-left text-[0.625rem] font-semibold text-text-muted uppercase w-10">Ref</th>
                <th className="px-3 py-2 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Attribute</th>
                <th className="px-3 py-2 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Description</th>
              </tr>
            </thead>
            <tbody>
              {ctrl.workflowAttributes.map((attr, i) => (
                <tr key={attr.id} className="border-b border-border/40">
                  <td className="px-3 py-2 text-[0.6875rem] font-bold text-brand-700">{String.fromCharCode(65 + i)}</td>
                  <td className="px-3 py-2 text-[0.6875rem] font-medium text-text">{attr.name}</td>
                  <td className="px-3 py-2 text-[0.625rem] text-text-muted">{attr.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3–5. ROUND CARDS (enhanced with population, sample table, evidence, exceptions) ── */}
      {wp.rounds.length === 0 ? (
        <div className="text-center py-8 text-text-muted text-[0.75rem]">No testing rounds recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {wp.rounds.map(round => {
            const isExpanded = expandedRound === round.round;
            const isLocked = round.status === 'complete';
            return (
              <div key={round.round} className={`glass-card overflow-hidden ${isLocked ? '' : 'border-primary/20'}`}>
                <button onClick={() => setExpandedRound(isExpanded ? null : round.round)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-2/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
                    <span className="text-[0.75rem] font-bold text-text">Round {round.round}</span>
                    {isLocked && <Lock size={10} className="text-ink-400" />}
                    <span className="text-[0.6875rem] text-text-muted">{round.date} · {round.tester}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {round.reviewerStatus === 'approved' && <span className="text-[0.625rem] font-bold bg-compliant-50 text-compliant-700 px-2 py-0.5 rounded-full">Approved</span>}
                    {round.reviewerStatus === 'pending' && <span className="text-[0.625rem] font-bold bg-high-50 text-high-700 px-2 py-0.5 rounded-full">Pending Review</span>}
                    <span className={`text-[0.625rem] font-bold px-2 py-0.5 rounded-full ${isLocked ? 'bg-compliant-50 text-compliant-700' : 'bg-evidence-50 text-evidence-700'}`}>{isLocked ? 'Complete' : 'In Progress'}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border-light/60 pt-3 space-y-4">

                    {/* 3. Population Details (enhanced) */}
                    <div>
                      <span className="text-[0.625rem] font-bold text-text-muted uppercase">Population & Sampling</span>
                      <div className="grid grid-cols-3 gap-3 mt-1.5">
                        <div><span className="text-[0.625rem] text-text-muted uppercase">Population Size</span><p className="text-[0.75rem] tabular-nums text-text">{round.populationSize.toLocaleString()}</p></div>
                        <div><span className="text-[0.625rem] text-text-muted uppercase">Sample Size</span><p className="text-[0.75rem] tabular-nums text-text">{round.sampleSize}</p></div>
                        <div><span className="text-[0.625rem] text-text-muted uppercase">Tester</span><p className="text-[0.75rem] text-text">{round.tester}</p></div>
                        <div><span className="text-[0.625rem] text-text-muted uppercase">Population Source</span><p className="text-[0.75rem] text-text truncate" title={ctrl.populationSource}>{ctrl.populationSource || '—'}</p></div>
                        <div><span className="text-[0.625rem] text-text-muted uppercase">Sampling Method</span><p className="text-[0.75rem] text-text">{ctrl.samplingMethod || 'Random'}</p></div>
                        <div><span className="text-[0.625rem] text-text-muted uppercase">Period Covered</span><p className="text-[0.75rem] text-text">Apr 2025 — Mar 2026</p></div>
                      </div>
                    </div>

                    {/* Existing Attribute Results (kept intact) */}
                    <div>
                      <span className="text-[0.625rem] font-bold text-text-muted uppercase">Attribute Results</span>
                      <div className="mt-1.5 space-y-1">
                        {round.attributeResults.map((ar, i) => {
                          const attr = ctrl.workflowAttributes.find(a => a.id === ar.attrId);
                          const total = ar.passCount + ar.failCount + ar.naCount;
                          const rate = total > 0 ? Math.round((ar.passCount / total) * 100) : 0;
                          return (
                            <div key={ar.attrId} className="flex items-center justify-between p-2 rounded-lg bg-surface-2/40">
                              <div className="flex items-center gap-2">
                                <span className="text-[0.625rem] font-bold text-brand-700 w-4">{String.fromCharCode(65 + i)}</span>
                                <span className="text-[0.6875rem] font-medium text-text">{attr?.name || ar.attrId}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[0.625rem] text-compliant-700 font-bold">{ar.passCount}P</span>
                                {ar.failCount > 0 && <span className="text-[0.625rem] text-risk-700 font-bold">{ar.failCount}F</span>}
                                {ar.naCount > 0 && <span className="text-[0.625rem] text-ink-400 font-bold">{ar.naCount}NA</span>}
                                <div className="w-12 h-1.5 bg-surface-3 rounded-full overflow-hidden"><div className={`h-full rounded-full ${ar.failCount > 0 ? 'bg-risk' : 'bg-compliant'}`} style={{ width: `${rate}%` }} /></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Sample Testing Table (NEW — CRITICAL) */}
                    <div>
                      <span className="text-[0.625rem] font-bold text-text-muted uppercase">Sample Testing Details</span>
                      {ctrl.samples.length > 0 ? (
                        <div className="mt-1.5 rounded-lg overflow-hidden border border-border-light/60">
                          <div className="overflow-x-auto">
                            <table className="w-full text-[0.625rem]">
                              <thead>
                                <tr className="bg-surface-2/60 border-b border-border">
                                  <th className="px-2.5 py-2 text-left font-semibold text-text-muted uppercase">Sample ID</th>
                                  <th className="px-2.5 py-2 text-left font-semibold text-text-muted uppercase">Reference</th>
                                  <th className="px-2.5 py-2 text-right font-semibold text-text-muted uppercase">Amount</th>
                                  {ctrl.workflowAttributes.map((_, i) => (
                                    <th key={i} className="px-2 py-2 text-center font-semibold text-text-muted uppercase w-8">{String.fromCharCode(65 + i)}</th>
                                  ))}
                                  <th className="px-2.5 py-2 text-center font-semibold text-text-muted uppercase">Result</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ctrl.samples.map(s => {
                                  const hasFailure = s.status === 'fail' || s.status === 'exception' || Object.values(s.attributes).some(v => v === 'fail');
                                  return (
                                    <tr key={s.id} className={`border-b border-border/30 ${hasFailure ? 'bg-risk-50/15' : ''}`}>
                                      <td className="px-2.5 py-1.5 font-medium text-text">{s.label}</td>
                                      <td className="px-2.5 py-1.5 font-mono text-text-muted">{s.referenceId}</td>
                                      <td className="px-2.5 py-1.5 text-right tabular-nums text-text-secondary">{s.amount}</td>
                                      {ctrl.workflowAttributes.map(attr => {
                                        const r = s.attributes[attr.id] || 'pending';
                                        const cls = r === 'pass' ? 'text-compliant-700 font-bold' : r === 'fail' ? 'text-risk-700 font-bold' : r === 'na' ? 'text-ink-400' : 'text-ink-300';
                                        const label = r === 'pass' ? '✓' : r === 'fail' ? '✗' : r === 'na' ? 'NA' : '—';
                                        return <td key={attr.id} className={`px-2 py-1.5 text-center ${cls}`}>{label}</td>;
                                      })}
                                      <td className="px-2.5 py-1.5 text-center">
                                        <span className={`inline-flex items-center px-1.5 h-4 rounded text-[0.5625rem] font-bold ${
                                          s.status === 'pass' ? 'bg-compliant-50 text-compliant-700' :
                                          s.status === 'fail' || s.status === 'exception' ? 'bg-risk-50 text-risk-700' :
                                          'bg-draft-50 text-draft-700'
                                        }`}>{s.status === 'not-tested' ? 'Pending' : s.status === 'pass' ? 'Pass' : 'Fail'}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1.5 p-4 bg-surface-2/30 rounded-lg text-center">
                          <p className="text-[0.6875rem] text-text-muted">Sample-level testing will appear once samples are evaluated.</p>
                        </div>
                      )}
                    </div>

                    {/* 6. Exceptions Section (NEW) */}
                    <div>
                      <span className="text-[0.625rem] font-bold text-text-muted uppercase">Exceptions Identified</span>
                      {failedSamples.length > 0 ? (
                        <div className="mt-1.5 space-y-1.5">
                          {failedSamples.map(s => {
                            const failedAttrs = ctrl.workflowAttributes.filter(attr => s.attributes[attr.id] === 'fail');
                            return (
                              <div key={s.id} className="p-2.5 rounded-lg bg-risk-50/20 border border-risk/10">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <AlertTriangle size={10} className="text-risk-700 shrink-0" />
                                  <span className="text-[0.6875rem] font-semibold text-risk-700">{s.label}</span>
                                  <span className="text-[0.625rem] text-text-muted">({s.referenceId} · {s.amount})</span>
                                </div>
                                <p className="text-[0.625rem] text-risk-700/80 ml-4.5">
                                  {failedAttrs.length > 0
                                    ? `Failed: ${failedAttrs.map(a => a.name).join(', ')}`
                                    : 'Exception flagged during testing'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center gap-2 p-2.5 bg-compliant-50/30 rounded-lg border border-compliant/10">
                          <CheckCircle2 size={11} className="text-compliant-700 shrink-0" />
                          <span className="text-[0.6875rem] text-compliant-700">No exceptions identified.</span>
                        </div>
                      )}
                    </div>

                    {/* 5. Evidence References (enhanced — grouped) */}
                    <div>
                      <span className="text-[0.625rem] font-bold text-text-muted uppercase">Evidence References</span>
                      {round.evidenceRefs.length > 0 || ctrl.samples.some(s => s.evidenceFiles.length > 0) ? (
                        <div className="mt-1.5 space-y-2">
                          {/* Per-sample evidence grouping */}
                          {ctrl.samples.filter(s => s.evidenceFiles.length > 0).map(s => (
                            <div key={s.id} className="p-2 rounded-lg bg-surface-2/30">
                              <span className="text-[0.625rem] font-semibold text-text-muted">{s.label} ({s.referenceId})</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {s.evidenceFiles.map(f => (
                                  <span key={f} className="inline-flex items-center gap-1 text-[0.625rem] text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                                    <Paperclip size={8} />{f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          {ctrl.samples.every(s => s.evidenceFiles.length === 0) && round.evidenceRefs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {round.evidenceRefs.map(r => (
                                <span key={r} className="inline-flex items-center gap-1 text-[0.625rem] text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100"><Paperclip size={8} />{r}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1.5 p-2.5 bg-surface-2/30 rounded-lg">
                          <p className="text-[0.6875rem] text-text-muted">No evidence uploaded.</p>
                        </div>
                      )}
                    </div>

                    {/* Existing round conclusion & reviewer notes (kept intact) */}
                    {round.conclusion && (<div><span className="text-[0.625rem] font-bold text-text-muted uppercase">Round Conclusion</span><p className="text-[0.75rem] text-text-secondary mt-1 p-2.5 rounded-lg bg-surface-2/60 leading-relaxed">{round.conclusion}</p></div>)}
                    {round.reviewerNotes && (<div><span className="text-[0.625rem] font-bold text-text-muted uppercase">Reviewer Notes</span><p className="text-[0.75rem] text-text-secondary mt-1 p-2.5 rounded-lg bg-evidence-50/40 border border-evidence-50 leading-relaxed"><MessageSquare size={10} className="inline mr-1 text-evidence-700" />{round.reviewerNotes}</p></div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 7. Work Performed & Notes (renamed from Comments) ── */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <MessageSquare size={11} />Work Performed & Notes
        </h5>
        {wp.comments.length > 0 ? (
          <div className="space-y-2 mb-3">
            {wp.comments.map((c, i) => (
              <div key={i} className={`p-2.5 rounded-lg ${c.role === 'Reviewer' ? 'bg-evidence-50/40 border border-evidence-50' : 'bg-surface-2/40 border border-border-light/60'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.6875rem] font-bold text-text">{c.author}</span>
                  <span className={`text-[0.5625rem] font-bold px-1.5 py-0.5 rounded ${c.role === 'Reviewer' ? 'bg-evidence-50 text-evidence-700' : 'bg-brand-50 text-brand-700'}`}>{c.role}</span>
                  <span className="text-[0.625rem] text-text-muted">{c.date}</span>
                </div>
                <p className="text-[0.75rem] text-text-secondary leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-surface-2/30 rounded-lg text-center mb-3">
            <p className="text-[0.6875rem] text-text-muted">No work notes recorded yet.</p>
          </div>
        )}
        {!isReviewSubmitted && (
          <div className="flex gap-2">
            <input type="text" placeholder="Add a note..." value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 px-3 py-2 text-[0.75rem] border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-text-muted" />
            <button className="flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-lg text-[0.75rem] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"><Send size={12} /></button>
          </div>
        )}
      </div>

      {/* ── 8. Review & Approval Status ── */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <Users size={11} />Review & Approval
        </h5>

        {/* 9. Reviewer info */}
        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-[0.625rem] text-text-muted uppercase">Reviewer</span><p className="text-[0.75rem] font-medium text-text">{ctrl.reviewer}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Status</span>
              <p className="text-[0.75rem] font-semibold mt-0.5">{
                wp.rounds.some(r => r.reviewerStatus === 'approved')
                  ? <span className="text-compliant-700">Approved</span>
                  : ctrl.status === 'pending-review'
                  ? <span className="text-mitigated-700">Pending Review</span>
                  : isConcluded(ctrl.status)
                  ? <span className="text-compliant-700">Approved</span>
                  : <span className="text-text-muted">Not Submitted</span>
              }</p>
            </div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Tester</span><p className="text-[0.75rem] text-text">{ctrl.assignee}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Samples</span><p className="text-[0.75rem] tabular-nums text-text">{tested}/{ctrl.samples.length} tested · {failed} exception{failed !== 1 ? 's' : ''}</p></div>
          </div>

          {/* State A: Not submitted — always show CTA */}
          {!isReviewSubmitted && (
            <div className="pt-3 border-t border-border-light/60 space-y-2.5">
              {ctrl.samples.length > 0 && ctrl.samples.every(s => s.status !== 'not-tested') ? (
                <p className="text-[0.6875rem] text-brand-700/80">All samples tested. Submitting will lock attribute results and evidence, and send to {ctrl.reviewer} for review.</p>
              ) : (
                <div className="flex items-start gap-2 p-2.5 bg-high-50/30 rounded-lg border border-high/10">
                  <AlertTriangle size={11} className="text-high-700 shrink-0 mt-0.5" />
                  <p className="text-[0.6875rem] text-high-700">Some testing steps are incomplete. You can still submit, but the reviewer may send it back.</p>
                </div>
              )}
              <button onClick={() => onSubmitForReview?.()}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-[0.75rem] font-bold transition-colors cursor-pointer flex items-center justify-center gap-2">
                <Send size={13} />Submit for Review
              </button>
            </div>
          )}

          {/* State B: Submitted */}
          {ctrl.status === 'pending-review' && (
            <div className="pt-3 border-t border-border-light/60">
              <div className="flex items-center gap-2 p-2.5 bg-mitigated-50/30 rounded-lg border border-mitigated/10">
                <Clock size={11} className="text-mitigated-700 shrink-0" />
                <p className="text-[0.6875rem] text-mitigated-700">Submitted for review. Testing and evidence are locked until reviewer responds.</p>
              </div>
            </div>
          )}

          {/* State C: Approved */}
          {(wp.rounds.some(r => r.reviewerStatus === 'approved') || isConcluded(ctrl.status)) && (
            <div className="pt-3 border-t border-border-light/60">
              <div className="flex items-center gap-2 p-2.5 bg-compliant-50/30 rounded-lg border border-compliant/10">
                <CheckCircle2 size={11} className="text-compliant-700 shrink-0" />
                <p className="text-[0.6875rem] text-compliant-700">Review approved by {ctrl.reviewer}. Working paper is finalized and locked.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REVIEW STEP ─────────────────────────────────────────────────────────────

function ReviewStep({ ctrl, onApprove, onSendBack, onSubmitForReview, isSubmitted }: { ctrl: ControlDetail; onApprove?: () => void; onSendBack?: (comment: string) => void; onSubmitForReview?: () => void; isSubmitted?: boolean }) {
  const tested = ctrl.samples.filter(s => s.status !== 'not-tested').length;
  const passed = ctrl.samples.filter(s => s.status === 'pass').length;
  const failed = ctrl.samples.filter(s => s.status === 'fail' || s.status === 'exception').length;
  const isSameUser = ctrl.assignee === ctrl.reviewer;
  const isApproved = ctrl.workingPaper.rounds.some(r => r.reviewerStatus === 'approved');
  const evidenceCount = ctrl.samples.reduce((sum, s) => sum + s.evidenceFiles.length, 0);

  const [sendBackComment, setSendBackComment] = useState('');
  const [showSendBackForm, setShowSendBackForm] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Attribute summary across all samples
  const attrSummary = ctrl.workflowAttributes.map(attr => {
    const passCount = ctrl.samples.filter(s => s.attributes[attr.id] === 'pass').length;
    const failCount = ctrl.samples.filter(s => s.attributes[attr.id] === 'fail').length;
    const naCount = ctrl.samples.filter(s => s.attributes[attr.id] === 'na').length;
    const pendingCount = ctrl.samples.filter(s => !s.attributes[attr.id] || s.attributes[attr.id] === 'pending').length;
    return { ...attr, passCount, failCount, naCount, pendingCount, hasExceptions: failCount > 0 };
  });

  // Readiness checks
  const hasPopulation = ctrl.populationStatus !== 'none';
  const hasSamples = ctrl.samples.length > 0;
  const hasEvidence = ctrl.samples.some(s => s.evidenceFiles.length > 0);
  const allTested = ctrl.samples.length > 0 && ctrl.samples.every(s => s.status !== 'not-tested');
  const hasWorkingPaper = ctrl.workingPaper.rounds.length > 0;
  const allReady = hasPopulation && hasSamples && hasEvidence && allTested && hasWorkingPaper;

  const readinessItems = [
    { label: 'Population uploaded & locked', done: hasPopulation },
    { label: 'Samples generated', done: hasSamples },
    { label: 'Evidence attached to samples', done: hasEvidence },
    { label: 'Attribute testing completed', done: allTested },
    { label: 'Working paper generated', done: hasWorkingPaper },
  ];

  // Active submission screen — not yet submitted
  const showSubmissionScreen = ctrl.status !== 'pending-review' && !isApproved && !isConcluded(ctrl.status) && !isSubmitted;

  if (showSubmissionScreen) {
    const handleSubmit = () => {
      setSubmitting(true);
      setTimeout(() => {
        setSubmitting(false);
        onSubmitForReview?.();
      }, 800);
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase">Submit for Review</h4>
          <span className="px-2.5 h-6 rounded-full text-[0.625rem] font-bold inline-flex items-center bg-evidence-50 text-evidence-700">
            Tester → Reviewer
          </span>
        </div>

        {/* Ownership banner */}
        <div className="flex items-center gap-3 p-3 bg-brand-50/50 rounded-xl border border-brand-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Users size={13} className="text-primary" />
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold text-text">{ctrl.assignee}</p>
              <p className="text-[0.5625rem] text-text-muted uppercase">Tester</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-primary shrink-0" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-evidence-50 flex items-center justify-center">
              <Eye size={13} className="text-evidence-700" />
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold text-text">{ctrl.reviewer}</p>
              <p className="text-[0.5625rem] text-text-muted uppercase">Reviewer</p>
            </div>
          </div>
        </div>

        {/* Submission summary */}
        <div>
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
            <Shield size={11} />Submission Summary
          </h5>
          <div className="glass-card p-4">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-[0.625rem] text-text-muted uppercase">Control</span><p className="text-[0.75rem] font-medium text-text">{ctrl.controlName}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Control ID</span><p className="text-[0.75rem] font-mono text-text">{ctrl.controlId}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Workflow</span><p className="text-[0.75rem] text-brand-700 font-medium">{ctrl.workflowName} {ctrl.workflowVersion}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Testing Round</span><p className="text-[0.75rem] text-text">Round {ctrl.testingRound || 1}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Submitted By</span><p className="text-[0.75rem] text-text">{ctrl.assignee}</p></div>
              <div><span className="text-[0.625rem] text-text-muted uppercase">Assigned Reviewer</span><p className="text-[0.75rem] font-medium text-primary">{ctrl.reviewer}</p></div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-text tabular-nums">{tested}/{ctrl.samples.length}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Samples Tested</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${failed > 0 ? 'text-risk-700' : 'text-compliant-700'}`}>{failed}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Failed Samples</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-text tabular-nums">{evidenceCount}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Evidence Files</div>
          </div>
        </div>

        {/* Readiness checklist */}
        <div>
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={11} />Readiness Checklist
          </h5>
          <div className="glass-card p-4 space-y-2">
            {readinessItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-2/40">
                {item.done
                  ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" />
                  : <XCircle size={14} className="text-risk-700 shrink-0" />}
                <span className={`text-[0.75rem] font-medium ${item.done ? 'text-text' : 'text-risk-700'}`}>{item.label}</span>
                {!item.done && <span className="text-[0.625rem] text-risk-700 ml-auto font-semibold">Incomplete</span>}
              </div>
            ))}
          </div>
        </div>

        {/* What happens on submit */}
        <div className="flex items-start gap-2.5 p-3 bg-brand-50/30 rounded-xl border border-brand-100">
          <Lock size={12} className="text-brand-700 mt-0.5 shrink-0" />
          <div>
            <p className="text-[0.6875rem] font-semibold text-brand-700 mb-0.5">On submission:</p>
            <ul className="text-[0.625rem] text-brand-700/80 space-y-0.5">
              <li>Evidence, attribute results, and samples will be locked</li>
              <li>Working paper snapshot will be generated</li>
              <li>Reviewer ({ctrl.reviewer}) will be notified</li>
            </ul>
          </div>
        </div>

        {/* Warning if incomplete */}
        {!allReady && (
          <div className="flex items-start gap-2.5 p-3 bg-high-50/30 rounded-lg border border-high/10">
            <AlertTriangle size={12} className="text-high-700 shrink-0 mt-0.5" />
            <p className="text-[0.6875rem] text-high-700">Some checklist items are incomplete. You can still submit, but the reviewer may reject this test.</p>
          </div>
        )}

        {/* Submit CTA — always enabled */}
        <button onClick={() => { if (!allReady) { setShowConfirmModal(true); } else { handleSubmit(); } }} disabled={submitting}
          className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-[0.8125rem] font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {submitting ? (
            <><Clock size={14} className="animate-spin" />Submitting…</>
          ) : (
            <><Send size={14} />Submit for Review</>
          )}
        </button>

        {/* Confirmation modal for incomplete submissions */}
        {showConfirmModal && (
          <>
            <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-2xl shadow-2xl border border-border-light w-full max-w-sm p-5 space-y-4 pointer-events-auto">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-high-50 flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} className="text-high-700" />
                  </div>
                  <h3 className="text-[0.875rem] font-bold text-text">Submit with incomplete testing?</h3>
                </div>
                <p className="text-[0.75rem] text-text-muted leading-relaxed">
                  Some required steps (e.g., attribute testing, evidence) are not completed. This may lead to rejection during review.
                </p>
                <div className="flex gap-2.5">
                  <button onClick={() => setShowConfirmModal(false)}
                    className="flex-1 py-2.5 border border-border text-text-secondary rounded-xl text-[0.75rem] font-medium hover:bg-surface-2 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={() => { setShowConfirmModal(false); handleSubmit(); }}
                    className="flex-1 py-2.5 bg-high hover:brightness-110 text-white rounded-xl text-[0.75rem] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5">
                    <Send size={12} />Submit Anyway
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Post-submission: awaiting reviewer (submitted but not yet in pending-review from data)
  if (isSubmitted && ctrl.status !== 'pending-review' && !isApproved && !isConcluded(ctrl.status)) {
    // Show the "Submitted — Awaiting Review" state, then fall through to the full review UI below
    // We treat isSubmitted the same as pending-review for the reviewer view
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase">Review & Approval</h4>
        <span className={`px-2.5 h-6 rounded-full text-[0.625rem] font-bold inline-flex items-center ${
          isApproved || isConcluded(ctrl.status) ? 'bg-compliant-50 text-compliant-700' : 'bg-mitigated-50 text-mitigated-700'
        }`}>{isApproved || isConcluded(ctrl.status) ? 'Approved' : 'Pending Review'}</span>
      </div>

      {/* Submitted confirmation banner */}
      {isSubmitted && !isApproved && !isConcluded(ctrl.status) && ctrl.status !== 'pending-review' && (
        <div className="rounded-xl border-2 border-mitigated/30 bg-mitigated-50/20 p-4">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-7 h-7 rounded-full bg-mitigated-50 flex items-center justify-center">
              <CheckCircle2 size={14} className="text-mitigated-700" />
            </div>
            <div>
              <p className="text-[0.75rem] font-bold text-mitigated-700">Submitted — Awaiting Review</p>
              <p className="text-[0.625rem] text-mitigated-700/80">Evidence, attribute results, and samples are now locked. Reviewer ({ctrl.reviewer}) has been notified.</p>
            </div>
          </div>
        </div>
      )}

      {/* Conflict warning */}
      {isSameUser && (
        <div className="flex items-center gap-2.5 p-3 bg-risk-50 rounded-xl border border-risk">
          <AlertTriangle size={14} className="text-risk-700 shrink-0" />
          <span className="text-[0.75rem] text-risk-700 font-medium">Conflict: Tester and reviewer are the same person.</span>
        </div>
      )}

      {/* ── A. Control Summary ── */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <Shield size={11} />Control Summary
        </h5>
        <div className="glass-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-[0.625rem] text-text-muted uppercase">Control</span><p className="text-[0.75rem] font-medium text-text">{ctrl.controlName}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Control ID</span><p className="text-[0.75rem] font-mono text-text">{ctrl.controlId}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Workflow</span><p className="text-[0.75rem] text-brand-700 font-medium">{ctrl.workflowName} {ctrl.workflowVersion}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Testing Round</span><p className="text-[0.75rem] text-text">Round {ctrl.testingRound}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Tester</span><p className="text-[0.75rem] text-text">{ctrl.assignee}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Reviewer</span><p className="text-[0.75rem] font-medium text-primary">{ctrl.reviewer}</p></div>
          </div>
        </div>
      </div>

      {/* ── Testing Metrics ── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="glass-card p-3 text-center">
          <div className="text-lg font-bold text-text tabular-nums">{tested}/{ctrl.samples.length}</div>
          <div className="text-[0.5625rem] text-text-muted uppercase">Tested</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-lg font-bold text-compliant-700 tabular-nums">{passed}</div>
          <div className="text-[0.5625rem] text-text-muted uppercase">Passed</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className={`text-lg font-bold tabular-nums ${failed > 0 ? 'text-risk-700' : 'text-text-muted'}`}>{failed}</div>
          <div className="text-[0.5625rem] text-text-muted uppercase">Failed</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-lg font-bold text-text tabular-nums">{ctrl.samples.reduce((sum, s) => sum + s.evidenceFiles.length, 0)}</div>
          <div className="text-[0.5625rem] text-text-muted uppercase">Evidence Files</div>
        </div>
      </div>

      {/* ── B. Sample-Level Table ── */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <Database size={11} />Sample-Level Results ({ctrl.samples.length})
        </h5>
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[0.6875rem]">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Sample</th>
                  <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Reference</th>
                  <th className="px-3 py-2.5 text-right text-[0.625rem] font-semibold text-text-muted uppercase">Amount</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase">Evidence</th>
                  {ctrl.workflowAttributes.map(attr => (
                    <th key={attr.id} className="px-2 py-2.5 text-center text-[0.5625rem] font-semibold text-text-muted uppercase max-w-[60px]" title={attr.name}>
                      {attr.name.length > 8 ? attr.name.slice(0, 8) + '…' : attr.name}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase">Status</th>
                  <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase">Exception</th>
                </tr>
              </thead>
              <tbody>
                {ctrl.samples.map(s => {
                  const hasException = s.status === 'fail' || s.status === 'exception' || Object.values(s.attributes).some(v => v === 'fail');
                  return (
                    <tr key={s.id} className={`border-b border-border/40 hover:bg-surface-2/30 transition-colors ${hasException ? 'bg-risk-50/20' : ''}`}>
                      <td className="px-3 py-2.5 text-[0.6875rem] font-medium text-text">{s.label}</td>
                      <td className="px-3 py-2.5 text-[0.625rem] font-mono text-text-muted">{s.referenceId}</td>
                      <td className="px-3 py-2.5 text-right text-[0.6875rem] tabular-nums text-text-secondary">{s.amount}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => setExpandedEvidence(expandedEvidence === s.id ? null : s.id)}
                          className="text-[0.625rem] font-semibold text-brand-700 hover:underline cursor-pointer">
                          {s.evidenceFiles.length} file{s.evidenceFiles.length !== 1 ? 's' : ''}
                        </button>
                      </td>
                      {ctrl.workflowAttributes.map(attr => (
                        <td key={attr.id} className="px-2 py-2.5 text-center">
                          <AttrResultChip result={s.attributes[attr.id] || 'pending'} />
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 h-5 rounded text-[0.625rem] font-bold ${
                          s.status === 'pass' ? 'bg-compliant-50 text-compliant-700' :
                          s.status === 'fail' || s.status === 'exception' ? 'bg-risk-50 text-risk-700' :
                          'bg-draft-50 text-draft-700'
                        }`}>{s.status === 'not-tested' ? 'Pending' : s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {hasException
                          ? <AlertTriangle size={12} className="text-risk-700 mx-auto" />
                          : <span className="text-ink-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Evidence expansion row */}
          {expandedEvidence && (() => {
            const sample = ctrl.samples.find(s => s.id === expandedEvidence);
            if (!sample) return null;
            return (
              <div className="px-4 py-3 bg-brand-50/30 border-t border-brand-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.625rem] font-bold text-text-muted uppercase">Evidence — {sample.label}</span>
                  <button onClick={() => setExpandedEvidence(null)} className="text-[0.625rem] text-text-muted hover:text-text cursor-pointer">Close</button>
                </div>
                {sample.evidenceFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sample.evidenceFiles.map(f => (
                      <span key={f} className="inline-flex items-center gap-1.5 text-[0.625rem] font-medium text-brand-700 bg-white px-2.5 py-1 rounded-lg border border-brand-100 cursor-pointer hover:bg-brand-50 transition-colors">
                        <Paperclip size={9} />{f}
                        <Download size={9} className="text-brand-500" />
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[0.625rem] text-text-muted">No evidence files attached.</p>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── C. Attribute Summary ── */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <BarChart3 size={11} />Attribute Summary
        </h5>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                <th className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Attribute</th>
                <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-16">Pass</th>
                <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-16">Fail</th>
                <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-16">N/A</th>
                <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-20">Rate</th>
                <th className="px-3 py-2.5 text-center text-[0.625rem] font-semibold text-text-muted uppercase w-20">Exception</th>
              </tr>
            </thead>
            <tbody>
              {attrSummary.map(attr => {
                const total = attr.passCount + attr.failCount + attr.naCount;
                const rate = total > 0 ? Math.round((attr.passCount / total) * 100) : 0;
                return (
                  <tr key={attr.id} className={`border-b border-border/40 ${attr.hasExceptions ? 'bg-risk-50/20' : ''}`}>
                    <td className="px-3 py-2.5">
                      <div className="text-[0.6875rem] font-medium text-text">{attr.name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-[0.6875rem] font-bold text-compliant-700 tabular-nums">{attr.passCount}</td>
                    <td className="px-3 py-2.5 text-center text-[0.6875rem] font-bold tabular-nums">
                      <span className={attr.failCount > 0 ? 'text-risk-700' : 'text-text-muted'}>{attr.failCount}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-[0.6875rem] tabular-nums text-text-muted">{attr.naCount}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-10 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${rate === 100 ? 'bg-compliant' : rate >= 80 ? 'bg-high' : 'bg-risk'}`} style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-[0.625rem] tabular-nums text-text-muted">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {attr.hasExceptions
                        ? <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold text-risk-700"><AlertTriangle size={10} />{attr.failCount}</span>
                        : <span className="text-ink-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── D. Review Decision ── */}
      {(ctrl.status === 'pending-review' || isSubmitted) && !isSameUser && !isApproved && !isConcluded(ctrl.status) && (
        <div>
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
            <Users size={11} />Reviewer Decision
          </h5>

          {!showSendBackForm ? (
            <div className="glass-card p-4 space-y-3">
              <p className="text-[0.6875rem] text-text-muted">Review the sample results and attribute details above. Then approve or send back for further testing.</p>
              <div className="flex gap-3">
                <button onClick={() => onApprove?.()}
                  className="flex-1 py-2.5 bg-compliant hover:brightness-110 text-white rounded-xl text-[0.75rem] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={13} />Approve
                </button>
                <button onClick={() => setShowSendBackForm(true)}
                  className="flex-1 py-2.5 border-2 border-high text-high-700 hover:bg-high-50 rounded-xl text-[0.75rem] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5">
                  <ArrowLeft size={13} />Send Back
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card p-4 space-y-3 border-high/20">
              <div className="flex items-center gap-2">
                <ArrowLeft size={12} className="text-high-700" />
                <span className="text-[0.75rem] font-bold text-high-700">Send Back for Rework</span>
              </div>
              <p className="text-[0.6875rem] text-text-muted">A comment is required. This will unlock testing for the tester and return the status to In Progress.</p>
              <textarea
                value={sendBackComment}
                onChange={e => setSendBackComment(e.target.value)}
                placeholder="Describe what needs to be corrected or re-tested..."
                rows={3}
                className="w-full px-3 py-2 text-[0.75rem] border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-high/20 focus:border-high/40 transition-all placeholder:text-text-muted resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowSendBackForm(false); setSendBackComment(''); }}
                  className="flex-1 py-2 border border-border text-text-secondary rounded-xl text-[0.75rem] font-medium hover:bg-surface-2 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={() => { if (sendBackComment.trim()) { onSendBack?.(sendBackComment.trim()); setShowSendBackForm(false); setSendBackComment(''); } }}
                  disabled={!sendBackComment.trim()}
                  className="flex-1 py-2 bg-high hover:brightness-110 text-white rounded-xl text-[0.75rem] font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                  <Send size={12} />Send Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approved state */}
      {(isApproved || isConcluded(ctrl.status)) && (
        <div className="flex items-center gap-2 p-3 bg-compliant-50 rounded-xl border border-compliant">
          <CheckCircle2 size={14} className="text-compliant-700" />
          <span className="text-[0.75rem] text-compliant-700 font-semibold">Review approved by {ctrl.reviewer}</span>
          <span className="text-[0.625rem] text-compliant-700/70 ml-auto">Conclusion auto-generated</span>
        </div>
      )}

      {/* Pending — same user warning */}
      {(ctrl.status === 'pending-review' || isSubmitted) && isSameUser && !isApproved && !isConcluded(ctrl.status) && (
        <div className="flex items-center gap-2 p-3 bg-high-50/30 rounded-lg border border-high/10">
          <AlertTriangle size={12} className="text-high-700 shrink-0" />
          <p className="text-[0.6875rem] text-high-700">Review actions disabled — tester and reviewer cannot be the same person.</p>
        </div>
      )}
    </div>
  );
}

// ─── CONCLUSION STEP ─────────────────────────────────────────────────────────

function ConclusionStep({ ctrl, reviewApproved, onGoToStep }: { ctrl: ControlDetail; reviewApproved?: boolean; onGoToStep?: (s: TestingStep) => void }) {
  const linkedFindings = FINDINGS.filter(f => f.controlId === ctrl.controlId);
  const tested = ctrl.samples.filter(s => s.status !== 'not-tested').length;
  const passed = ctrl.samples.filter(s => s.status === 'pass').length;
  const failed = ctrl.samples.filter(s => s.status === 'fail' || s.status === 'exception').length;
  const evidenceCount = ctrl.samples.reduce((sum, s) => sum + s.evidenceFiles.length, 0);
  const isApproved = reviewApproved || ctrl.workingPaper.rounds.some(r => r.reviewerStatus === 'approved') || isConcluded(ctrl.status);

  // System-derived conclusion — ONLY after approval
  const derivedConclusion: string = isApproved
    ? (ctrl.result || (failed > 0 ? 'Ineffective' : 'Effective'))
    : '';

  // Failed samples for display
  const failedSamples = ctrl.samples.filter(s => s.status === 'fail' || s.status === 'exception' || Object.values(s.attributes).some(v => v === 'fail'));

  // ── CASE A: Before review approval — "Conclusion Locked" ──
  if (!isApproved) {
    // Determine current progress
    const hasPopulation = ctrl.populationStatus !== 'none';
    const hasSamples = ctrl.samples.length > 0;
    const allTested = hasSamples && ctrl.samples.every(s => s.status !== 'not-tested');
    const isPendingReview = ctrl.status === 'pending-review';

    const progressSteps = [
      { label: 'Population & Sampling', done: hasPopulation && hasSamples },
      { label: 'Attribute Testing', done: allTested },
      { label: 'Submit for Review', done: isPendingReview },
      { label: 'Reviewer Approval', done: false },
      { label: 'Conclusion', done: false },
    ];

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase">Control Conclusion</h4>
          <span className="px-2.5 h-6 rounded-full text-[0.625rem] font-bold inline-flex items-center bg-draft-50 text-draft-700">Locked</span>
        </div>

        {/* Locked state card */}
        <div className="rounded-xl border-2 border-border-light bg-surface-2/20 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-3">
            <Lock size={22} className="text-ink-400" />
          </div>
          <p className="text-[0.9375rem] font-bold text-text mb-1">Conclusion Locked</p>
          <p className="text-[0.75rem] text-text-muted max-w-sm mx-auto">
            The conclusion will be automatically generated after the reviewer approves testing results.
            No manual input is required.
          </p>
        </div>

        {/* Current status */}
        <div className="glass-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Current Status</span>
              <p className="text-[0.75rem] font-semibold text-text mt-0.5">{
                isPendingReview ? 'Pending Review' :
                ctrl.status === 'in-progress' ? 'Testing In Progress' :
                ctrl.status === 'not-started' ? 'Not Started' :
                'In Progress'
              }</p>
            </div>
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Reviewer</span>
              <p className="text-[0.75rem] text-text mt-0.5">{ctrl.reviewer}</p>
            </div>
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Samples</span>
              <p className="text-[0.75rem] tabular-nums text-text mt-0.5">{tested}/{ctrl.samples.length} tested</p>
            </div>
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Tester</span>
              <p className="text-[0.75rem] text-text mt-0.5">{ctrl.assignee}</p>
            </div>
          </div>
        </div>

        {/* Progress tracker */}
        <div>
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Progress to Conclusion</h5>
          <div className="glass-card p-4 space-y-1.5">
            {progressSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg">
                {step.done
                  ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" />
                  : i === progressSteps.findIndex(s => !s.done)
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-primary bg-primary/20 shrink-0 animate-pulse" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-ink-200 shrink-0" />}
                <span className={`text-[0.75rem] font-medium ${
                  step.done ? 'text-text line-through opacity-60' :
                  i === progressSteps.findIndex(s => !s.done) ? 'text-primary font-semibold' :
                  'text-text-muted'
                }`}>{step.label}</span>
                {i === progressSteps.findIndex(s => !s.done) && (
                  <span className="text-[0.5625rem] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-auto">CURRENT</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Guidance */}
        <div className="flex items-start gap-2.5 p-3 bg-brand-50/30 rounded-xl border border-brand-100">
          <Shield size={12} className="text-brand-700 mt-0.5 shrink-0" />
          <p className="text-[0.6875rem] text-brand-700">
            The conclusion is system-derived and read-only. It cannot be manually set or overridden.
            This ensures audit defensibility and SOX compliance.
          </p>
        </div>

        {/* Prototype preview — projected conclusion */}
        {tested > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase">Projected Conclusion</h5>
              <span className="text-[0.5625rem] font-bold text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded">PREVIEW</span>
            </div>
            <div className={`p-4 rounded-xl border-2 border-dashed opacity-70 ${
              failed > 0 ? 'border-risk/40 bg-risk-50/10' : 'border-compliant/40 bg-compliant-50/10'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {failed > 0 ? <XCircle size={14} className="text-risk-700" /> : <CheckCircle2 size={14} className="text-compliant-700" />}
                <span className="text-[0.8125rem] font-bold text-text">{failed > 0 ? 'Ineffective' : 'Effective'}</span>
                <span className="text-[0.625rem] text-text-muted ml-auto">Based on current results</span>
              </div>
              <p className="text-[0.6875rem] text-text-muted ml-5">
                {failed > 0
                  ? `${failed} sample${failed !== 1 ? 's' : ''} failed → would be marked INEFFECTIVE`
                  : `${passed} of ${ctrl.samples.length} samples passed → would be marked EFFECTIVE`}
              </p>
              <p className="text-[0.625rem] text-text-muted mt-2 ml-5 italic">This preview will become final after reviewer approval.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CASE B: After review approval — full conclusion ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase">Control Conclusion</h4>
        <span className="px-2.5 h-6 rounded-full text-[0.625rem] font-bold inline-flex items-center bg-compliant-50 text-compliant-700">System Derived — Read Only</span>
      </div>

      {/* Conclusion result — prominent */}
      <div className={`p-5 rounded-xl border-2 ${
        derivedConclusion === 'Effective' ? 'border-compliant bg-compliant-50/30' :
        derivedConclusion === 'Partially Effective' ? 'border-high bg-high-50/30' :
        'border-risk bg-risk-50/30'
      }`}>
        <div className="flex items-center gap-2.5 mb-2">
          {derivedConclusion === 'Effective' ? <CheckCircle2 size={20} className="text-compliant-700" /> :
           derivedConclusion === 'Ineffective' ? <XCircle size={20} className="text-risk-700" /> :
           <AlertTriangle size={20} className="text-high-700" />}
          <span className="text-[1.125rem] font-bold text-text">{derivedConclusion}</span>
        </div>

        {/* Derivation reason */}
        <div className={`ml-7 p-2.5 rounded-lg mt-2 ${
          derivedConclusion === 'Effective' ? 'bg-compliant-50/50' : 'bg-risk-50/50'
        }`}>
          <p className={`text-[0.75rem] font-semibold ${
            derivedConclusion === 'Effective' ? 'text-compliant-700' : 'text-risk-700'
          }`}>
            {derivedConclusion === 'Effective'
              ? `${passed} of ${ctrl.samples.length} samples passed → Control marked as EFFECTIVE`
              : `${failed} sample${failed !== 1 ? 's' : ''} failed → Control marked as INEFFECTIVE`}
          </p>
        </div>

        <div className="mt-3 ml-7 flex items-center gap-2 text-[0.625rem] text-text-muted">
          <Lock size={9} />
          <span>Derived by system · Approved by {ctrl.reviewer} · All data locked</span>
        </div>
      </div>

      {/* Execution metrics */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Execution Summary</h5>
        <div className="grid grid-cols-5 gap-2">
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-text tabular-nums">{ctrl.samples.length}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Total Samples</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-compliant-700 tabular-nums">{passed}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Passed</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${failed > 0 ? 'text-risk-700' : 'text-text-muted'}`}>{failed}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Failed</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${failed > 0 ? 'text-risk-700' : 'text-text-muted'}`}>{failed}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Exceptions</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold text-text tabular-nums">{evidenceCount}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Evidence</div>
          </div>
        </div>
      </div>

      {/* Control details */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-[0.625rem] text-text-muted uppercase">Control</span><p className="text-[0.75rem] font-medium text-text">{ctrl.controlName}</p></div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Control ID</span><p className="text-[0.75rem] font-mono text-text">{ctrl.controlId}</p></div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Tester</span><p className="text-[0.75rem] text-text">{ctrl.assignee}</p></div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Approved By</span><p className="text-[0.75rem] text-text">{ctrl.reviewer}</p></div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Execution Status</span><p className="text-[0.75rem] font-semibold text-compliant-700">Concluded</p></div>
          <div><span className="text-[0.625rem] text-text-muted uppercase">Edit Status</span><p className="text-[0.75rem] font-semibold text-text flex items-center gap-1"><Lock size={10} className="text-ink-400" />Locked</p></div>
        </div>
      </div>

      {/* Failed samples detail (if any) */}
      {failedSamples.length > 0 && (
        <div>
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-risk-700" />Failed Samples ({failedSamples.length})
          </h5>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-[0.6875rem]">
              <thead>
                <tr className="border-b border-border bg-risk-50/20">
                  <th className="px-3 py-2 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Sample</th>
                  <th className="px-3 py-2 text-left text-[0.625rem] font-semibold text-text-muted uppercase">Reference</th>
                  <th className="px-3 py-2 text-right text-[0.625rem] font-semibold text-text-muted uppercase">Amount</th>
                  <th className="px-3 py-2 text-center text-[0.625rem] font-semibold text-text-muted uppercase">Failed Attrs</th>
                  <th className="px-3 py-2 text-center text-[0.625rem] font-semibold text-text-muted uppercase">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {failedSamples.map(s => {
                  const failedAttrs = Object.entries(s.attributes).filter(([, v]) => v === 'fail').length;
                  return (
                    <tr key={s.id} className="border-b border-border/40 bg-risk-50/10">
                      <td className="px-3 py-2 text-[0.6875rem] font-medium text-text">{s.label}</td>
                      <td className="px-3 py-2 text-[0.625rem] font-mono text-text-muted">{s.referenceId}</td>
                      <td className="px-3 py-2 text-right text-[0.6875rem] tabular-nums text-text-secondary">{s.amount}</td>
                      <td className="px-3 py-2 text-center"><span className="text-[0.625rem] font-bold text-risk-700">{failedAttrs}</span></td>
                      <td className="px-3 py-2 text-center text-[0.625rem] text-text-muted">{s.evidenceFiles.length} files</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reviewer notes */}
      {ctrl.workingPaper.rounds.filter(r => r.reviewerNotes).map(r => (
        <div key={r.round} className="glass-card p-4">
          <span className="text-[0.625rem] font-bold text-text-muted uppercase">Reviewer Comments — Round {r.round}</span>
          <p className="text-[0.75rem] text-text-secondary mt-1 leading-relaxed">{r.reviewerNotes}</p>
          <p className="text-[0.625rem] text-text-muted mt-1">{ctrl.reviewer} · {r.date}</p>
        </div>
      ))}

      {/* Linked findings */}
      {linkedFindings.length > 0 && (
        <div>
          <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Linked Findings</h5>
          {linkedFindings.map(f => (
            <div key={f.id} className="glass-card p-4 border-l-4 border-risk mb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.75rem] font-mono font-bold text-risk-700">{f.id}</span>
                <span className={`px-2 h-5 rounded-full text-[0.625rem] font-bold inline-flex items-center ${f.severity === 'Material Weakness' ? 'bg-risk-50 text-risk-700' : f.severity === 'Significant Deficiency' ? 'bg-high-50 text-high-700' : 'bg-mitigated-50 text-mitigated-700'}`}>{f.severity}</span>
              </div>
              <p className="text-[0.75rem] font-medium text-text mb-1">{f.title}</p>
              <p className="text-[0.6875rem] text-text-muted">Failed: {f.failedAttribute}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lock confirmation */}
      <div className="flex items-start gap-2.5 p-3 bg-surface-2/50 rounded-xl border border-border-light">
        <Lock size={12} className="text-ink-400 mt-0.5 shrink-0" />
        <p className="text-[0.6875rem] text-text-muted">
          All testing data is locked. Samples, evidence, and attribute results cannot be modified after conclusion.
        </p>
      </div>

      {/* Supporting links */}
      <div>
        <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Supporting Data</h5>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => onGoToStep?.('working-paper')}
            className="glass-card p-3 text-center hover:bg-surface-2/50 transition-colors cursor-pointer group">
            <Copy size={16} className="text-brand-600 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-[0.6875rem] font-semibold text-text">Working Paper</p>
            <p className="text-[0.5625rem] text-text-muted">View full record</p>
          </button>
          <button onClick={() => onGoToStep?.('samples')}
            className="glass-card p-3 text-center hover:bg-surface-2/50 transition-colors cursor-pointer group">
            <Database size={16} className="text-brand-600 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-[0.6875rem] font-semibold text-text">Samples</p>
            <p className="text-[0.5625rem] text-text-muted">{ctrl.samples.length} items</p>
          </button>
          <button onClick={() => onGoToStep?.('evidence')}
            className="glass-card p-3 text-center hover:bg-surface-2/50 transition-colors cursor-pointer group">
            <FileText size={16} className="text-brand-600 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-[0.6875rem] font-semibold text-text">Evidence</p>
            <p className="text-[0.5625rem] text-text-muted">{evidenceCount} files</p>
          </button>
        </div>
      </div>

      {/* Download */}
      <button className="w-full py-2.5 border border-primary/30 bg-primary/5 text-primary rounded-xl text-[0.75rem] font-semibold hover:bg-primary/10 transition-colors cursor-pointer flex items-center justify-center gap-2">
        <FileText size={13} />Download Working Paper
      </button>
    </div>
  );
}

// ─── MAIN DRAWER ─────────────────────────────────────────────────────────────

interface Props {
  controlId: string;
  onClose: () => void;
  /** When provided, use this control data instead of looking up from static CONTROLS */
  controlData?: ControlDetail;
}

export default function ControlDetailDrawer({ controlId, onClose, controlData }: Props) {
  const ctrl = controlData || getControlById(controlId) || getControlById('ec-001')!;
  const [activeStep, setActiveStep] = useState<TestingStep>('overview');
  const [reviewApproved, setReviewApproved] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(null);
  const [generatedSampleSet, setGeneratedSampleSet] = useState<SampleSet | null>(null);
  const [populationLocked, setPopulationLocked] = useState<{ locked: boolean; recordCount: number; source: string; snapshotId: string } | null>(
    ctrl.populationStatus !== 'none' ? { locked: true, recordCount: ctrl.populationSize || 0, source: ctrl.populationSource || '', snapshotId: `POP-SNAP-${ctrl.controlId}-001` } : null
  );
  const [uploadedEvidence, setUploadedEvidence] = useState<Record<string, EvidenceFile[]>>({});
  const [attributeResults, setAttributeResults] = useState<Record<string, Record<string, { result: 'pass' | 'fail' | 'pending'; evidenceIds: string[]; notes: string }>>>({});
  const controlType = deriveControlType(ctrl);
  const eng = ENGAGEMENT;
  const logEvent = useAuditLog();

  const handleSubmitForReview = () => {
    setReviewSubmitted(true);
    logEvent({ action: 'Update', description: `Submitted control "${ctrl.controlName}" for review`, module: 'Engagements', entity: 'Control' });
  };

  const handleApprove = () => {
    setReviewApproved(true);
    logEvent({ action: 'Update', description: `Approved testing for control "${ctrl.controlName}"`, module: 'Engagements', entity: 'Control' });
    // Auto-navigate to conclusion after approval
    setTimeout(() => setActiveStep('conclusion'), 600);
  };

  const handleSendBack = (_comment: string) => {
    setReviewSubmitted(false);
    logEvent({ action: 'Update', description: `Sent control "${ctrl.controlName}" back for rework`, module: 'Engagements', entity: 'Control' });
    // Return to testing step
    setTimeout(() => setActiveStep('testing'), 600);
  };

  const setAttrResult = (sampleId: string, attrId: string, result: 'pass' | 'fail' | 'pending', notes?: string) => {
    setAttributeResults(prev => ({ ...prev, [sampleId]: { ...(prev[sampleId] || {}), [attrId]: { result, evidenceIds: [], notes: notes || '' } } }));
  };

  // Dynamic steps based on control type
  const steps: { id: TestingStep; label: string; icon: React.ElementType }[] = (() => {
    const common = [{ id: 'overview' as const, label: 'Overview', icon: Eye }];
    const tail = [
      { id: 'testing' as const, label: 'Attribute Testing', icon: Target },
      { id: 'working-paper' as const, label: 'Working Paper', icon: Copy },
      { id: 'review' as const, label: 'Review', icon: Users },
      { id: 'conclusion' as const, label: 'Conclusion', icon: CheckCircle2 },
    ];
    if (controlType === 'Manual') {
      return [...common, { id: 'create-samples' as const, label: 'Create Samples', icon: Plus }, { id: 'evidence' as const, label: 'Evidence', icon: FileText }, ...tail];
    }
    if (controlType === 'Automated') {
      return [...common, { id: 'population' as const, label: 'Population', icon: Database }, { id: 'execution-mode' as const, label: 'Execution Mode', icon: Settings },
        ...(executionMode !== 'full-run' ? [{ id: 'samples' as const, label: 'Samples', icon: Filter }] : []), ...tail];
    }
    return [...common, { id: 'population' as const, label: 'Population', icon: Database }, { id: 'execution-mode' as const, label: 'Execution Mode', icon: Settings },
      ...(executionMode !== 'full-run' ? [{ id: 'samples' as const, label: 'Samples', icon: Filter }] : []),
      { id: 'evidence' as const, label: 'Evidence', icon: FileText }, ...tail];
  })();

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-[680px] z-50 bg-white border-l border-border-light shadow-2xl flex flex-col">

        {/* ── EXECUTION-AWARE HEADER ── */}
        <div className="px-5 py-4 border-b border-border-light">
          {/* Engagement context bar */}
          <div className="flex items-center gap-2 mb-2 text-[0.625rem]">
            <span className="text-text-muted">{eng.name}</span>
            <span className="text-ink-300">·</span>
            <Calendar size={9} className="text-text-muted" />
            <span className="text-text-muted">{eng.auditPeriodStart} — {eng.auditPeriodEnd}</span>
            <span className="text-ink-300">·</span>
            <span className="text-text-muted">Snapshot: {eng.snapshotId}</span>
          </div>

          {/* Control + status */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[0.625rem] font-mono text-text-muted">{ctrl.controlId}</span>
                {ctrl.isKey && <span className="px-1.5 h-4 rounded text-[0.5625rem] font-bold bg-mitigated-50 text-mitigated-700 inline-flex items-center">KEY</span>}
                <StatusLabel status={ctrl.status} />
                <span className={`px-1.5 h-4 rounded text-[0.5rem] font-bold inline-flex items-center ${controlType === 'Automated' ? 'bg-evidence-50 text-evidence-700' : controlType === 'Manual' ? 'bg-canvas text-ink-600' : 'bg-brand-50 text-brand-700'}`}>{controlType}</span>
              </div>
              <h2 className="text-[0.875rem] font-bold text-text truncate">{ctrl.controlName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Workflow size={10} className="text-brand-500" />
                <span className="text-[0.6875rem] text-brand-700 font-medium">{ctrl.workflowName} {ctrl.workflowVersion}</span>
                <span className="text-ink-300">·</span>
                <span className="text-[0.6875rem] text-text-muted">Round {ctrl.testingRound || '—'}</span>
                <span className="text-ink-300">·</span>
                <Users size={10} className="text-text-muted" />
                <span className="text-[0.6875rem] text-text-muted">{ctrl.assignee} → {ctrl.reviewer}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer shrink-0 ml-3"><X size={16} className="text-text-muted" /></button>
          </div>
        </div>

        <StepIndicator steps={steps} current={activeStep} onStep={setActiveStep} />

        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            <motion.div key={activeStep} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
              {activeStep === 'overview' && <OverviewStep ctrl={ctrl} onGoToStep={setActiveStep} />}
              {activeStep === 'population' && <PopulationStep ctrl={ctrl} onGoToStep={setActiveStep} onPopulationLocked={setPopulationLocked} />}
              {activeStep === 'execution-mode' && <ExecutionModeStep ctrl={ctrl} executionMode={executionMode} onSelect={setExecutionMode} onGoToStep={setActiveStep} onCreateTestItems={setGeneratedSampleSet} populationInfo={populationLocked} />}
              {activeStep === 'create-samples' && <CreateSamplesStep ctrl={ctrl} onGoToStep={setActiveStep} onSamplesCreated={setGeneratedSampleSet} />}
              {activeStep === 'samples' && <SamplesStep ctrl={ctrl} onGoToStep={setActiveStep} />}
              {activeStep === 'evidence' && <EvidenceStep ctrl={ctrl} />}
              {activeStep === 'testing' && <AttributeTestingStep ctrl={ctrl} />}
              {activeStep === 'working-paper' && <WorkingPaperStep ctrl={ctrl} onSubmitForReview={() => setActiveStep('review')} />}
              {activeStep === 'review' && <ReviewStep ctrl={ctrl} onApprove={handleApprove} onSendBack={handleSendBack} onSubmitForReview={handleSubmitForReview} isSubmitted={reviewSubmitted} />}
              {activeStep === 'conclusion' && <ConclusionStep ctrl={ctrl} reviewApproved={reviewApproved} onGoToStep={setActiveStep} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-light bg-surface-2/30">
          <button onClick={() => { const idx = steps.findIndex(s => s.id === activeStep); if (idx > 0) setActiveStep(steps[idx - 1].id); }}
            disabled={activeStep === 'overview'}
            className="flex items-center gap-1.5 px-3 py-2 text-[0.75rem] font-medium text-text-secondary hover:text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
            <ArrowLeft size={12} />Previous
          </button>
          <div className="text-[0.6875rem] text-text-muted">{steps.findIndex(s => s.id === activeStep) + 1} of {steps.length}</div>
          {activeStep !== 'conclusion' ? (
            <button onClick={() => { const idx = steps.findIndex(s => s.id === activeStep); if (idx < steps.length - 1) setActiveStep(steps[idx + 1].id); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer">
              Next<ArrowRight size={12} />
            </button>
          ) : (
            <button onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary rounded-lg text-[0.75rem] font-medium hover:bg-surface-2 transition-colors cursor-pointer">
              Close
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
