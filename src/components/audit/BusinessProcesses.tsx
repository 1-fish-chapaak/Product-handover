import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, Upload, Sparkles,
  ChevronRight, ChevronDown,
  ArrowLeft, ArrowRight,
  Building2,
  FileText, CheckCircle2, AlertTriangle, X, Eye, Loader2, Paperclip, Play, Lock, ShieldCheck, Pencil, Trash2,
  HelpCircle, Grid3x3, Shield, Workflow, Archive,
} from 'lucide-react';
import { getSopRelationships, getControlRelationships, getWorkflowRelationships, getRacmRelationships } from '../../data/processHubJoins';
import { BUSINESS_PROCESSES, SOPS, RACMS, RISKS, CONTROLS, WORKFLOWS } from '../../data/mockData';
import type { UserProcess } from '../../hooks/useAppState';
import { useToast } from '../shared/Toast';
import RacmListTable from './RacmListTable';
import RiskRegister from './RiskRegister';
import ColumnFilter from '../shared/ColumnFilter';
// ControlLibraryView no longer embedded — replaced by ControlDesignTab
// WorkflowLibraryView no longer used — replaced by WorkflowGovernanceTab

interface Props {
  selectedBPId: string | null;
  onSelectBP: (id: string | null) => void;
  onOpenEngagement?: (engagementId: string) => void;
  userProcesses: UserProcess[];
  /** Opens the full-page RACM editor for any RACM in the list. */
  onOpenRacmEditor?: (racm: import('./RacmListTable').RacmEntry) => void;
  /** Opens the canonical workflow detail page (shared with Workflow Library). */
  onOpenWorkflowDetail?: (workflowId: string) => void;
}


// ─── SOP Types & Extraction Mock Data ─────────────────────────────────────

type SOPStatus = 'Draft' | 'Processing' | 'Processed' | 'Linked' | 'Archived';

// ─── SOP Status Display ───────────────────────────────────────────────────

const SOP_STATUS_STYLES: Record<SOPStatus, string> = {
  'Draft': 'bg-paper-100 text-ink-500',
  'Processing': 'bg-evidence-50 text-evidence-700',
  'Processed': 'bg-compliant-50 text-compliant-700',
  'Linked': 'bg-brand-50 text-brand-700',
  'Archived': 'bg-paper-50 text-ink-400',
};

interface SOPAction {
  label: string;
  cls: string;
}

function getSOPAction(status: SOPStatus, hasRacm: boolean, racmFrozen?: boolean): SOPAction {
  if (hasRacm && (status === 'Processed' || status === 'Linked')) {
    if (racmFrozen) return { label: 'Configure RACM', cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    return { label: 'Edit RACM Draft', cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
  }
  switch (status) {
    case 'Draft':      return { label: 'Start Processing',  cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Processing': return { label: 'View Progress',     cls: 'bg-paper-100 text-ink-500 hover:bg-paper-50' };
    case 'Processed':  return { label: 'New RACM',          cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Linked':     return { label: 'Edit RACM Draft',   cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Archived':   return { label: 'View SOP',          cls: 'bg-paper-50 text-ink-400 hover:bg-paper-100' };
  }
}

interface ExtractedRisk {
  id: string;
  name: string;
  description: string;
  section: string;
  confidence: 'high' | 'medium' | 'low';
  accepted: boolean;
}

interface ExtractedControl {
  id: string;
  name: string;
  description: string;
  linkedRiskId: string;
  type: 'Preventive' | 'Detective' | 'Corrective';
  section: string;
  confidence: 'high' | 'medium' | 'low';
  accepted: boolean;
}

interface LocalSOP {
  id: string;
  name: string;
  fileName: string;
  version: string;
  description: string;
  businessProcess: string;
  uploadedBy: string;
  uploadedAt: string;
  status: SOPStatus;
  progress: number;
  processingStep: number; // 0-6 index into PROCESSING_STEPS
  risks: number;
  controls: number;
  racmId: string | null;
  racmName: string | null;
  failureReason: string | null;
  extractedRisks: ExtractedRisk[];
  extractedControls: ExtractedControl[];
}

const FAILURE_REASONS = [
  'Unsupported file format — only PDF, DOCX, and XLSX are supported.',
  'File is unreadable — the document may be corrupted or password-protected.',
  'Processing timeout — the document is too large or complex. Try splitting into smaller sections.',
  'No process content detected — the document does not appear to contain standard operating procedures.',
] as const;

// Determine if extraction is partial (incomplete)
function isPartialExtraction(sop: LocalSOP): boolean {
  const risks = sop.extractedRisks || [];
  const ctrls = sop.extractedControls || [];
  const hasRisks = risks.length > 0;
  const hasControls = ctrls.length > 0;
  const lowConfidence = [...risks, ...ctrls].filter(x => x.confidence === 'low').length;
  const total = risks.length + ctrls.length;
  // Partial if: risks but no controls, controls but no risks, or >40% low confidence
  if (hasRisks && !hasControls) return true;
  if (!hasRisks && hasControls) return true;
  if (total > 0 && lowConfidence / total > 0.4) return true;
  return false;
}

function getPartialWarnings(sop: LocalSOP): string[] {
  const risks = sop.extractedRisks || [];
  const ctrls = sop.extractedControls || [];
  const warnings: string[] = [];
  if (risks.length === 0) warnings.push('No risks were extracted from the document.');
  if (ctrls.length === 0) warnings.push('No control references were extracted.');
  const lowRisks = risks.filter(r => r.confidence === 'low').length;
  const lowCtrls = ctrls.filter(c => c.confidence === 'low').length;
  if (lowRisks > 0) warnings.push(`${lowRisks} risk${lowRisks > 1 ? 's have' : ' has'} low extraction confidence.`);
  if (lowCtrls > 0) warnings.push(`${lowCtrls} control reference${lowCtrls > 1 ? 's have' : ' has'} low extraction confidence.`);
  const unclearSections = [...risks, ...ctrls].filter(x => x.section === 'Unclear' || x.section === '').length;
  if (unclearSections > 0) warnings.push(`${unclearSections} item${unclearSections > 1 ? 's have' : ' has'} unclear source sections.`);
  return warnings;
}

// ─── Processing Steps ─────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  { label: 'File uploaded', description: 'Document received and queued' },
  { label: 'Reading document', description: 'Reading SOP structure' },
  { label: 'Identifying activities', description: 'Identifying activities and control points' },
  { label: 'Extracting risks', description: 'Drafting risks from SOP' },
  { label: 'Extracting controls', description: 'Drafting control references' },
  { label: 'Building RACM structure', description: 'Preparing RACM draft' },
  { label: 'Ready for review', description: 'Ready for user review' },
] as const;

type StepState = 'pending' | 'in-progress' | 'completed' | 'failed';

function getStepState(stepIndex: number, currentStep: number, failed: boolean): StepState {
  if (failed && stepIndex === currentStep) return 'failed';
  if (stepIndex < currentStep) return 'completed';
  if (stepIndex === currentStep) return 'in-progress';
  return 'pending';
}

const STEP_STATE_STYLES: Record<StepState, { dot: string; text: string; line: string }> = {
  'completed':   { dot: 'bg-compliant text-white', text: 'text-ink-500', line: 'bg-compliant' },
  'in-progress': { dot: 'bg-brand-600 text-white ring-2 ring-brand-200', text: 'text-ink-800 font-semibold', line: 'bg-paper-100' },
  'pending':     { dot: 'bg-paper-100 text-ink-400', text: 'text-ink-400', line: 'bg-paper-100' },
  'failed':      { dot: 'bg-risk text-white', text: 'text-risk-700', line: 'bg-paper-100' },
};

function ProcessingStepperPanel({ sop }: { sop: LocalSOP }) {
  const isFailed = sop.status === 'Draft';
  const progressPct = Math.round((sop.processingStep / (PROCESSING_STEPS.length - 1)) * 100);

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }} className="overflow-hidden">
      <div className="px-4 py-4 bg-surface-2/30 border-t border-border/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-text-muted">Processing: {sop.name}</span>
          <span className="text-[11px] font-bold text-text tabular-nums">{progressPct}%</span>
        </div>
        <div className="space-y-0">
          {PROCESSING_STEPS.map((step, idx) => {
            const state = getStepState(idx, sop.processingStep, isFailed);
            const styles = STEP_STATE_STYLES[state];
            const isLast = idx === PROCESSING_STEPS.length - 1;
            return (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${styles.dot}`}>
                    {state === 'completed' && <CheckCircle2 size={10} />}
                    {state === 'in-progress' && <Loader2 size={10} className="animate-spin" />}
                    {state === 'failed' && <X size={10} />}
                    {state === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-paper-300" />}
                  </div>
                  {!isLast && <div className={`w-0.5 h-5 ${styles.line}`} />}
                </div>
                <div className={`pt-0.5 pb-3 ${styles.text}`}>
                  <div className="text-[11px] leading-tight">{step.label}</div>
                  {state === 'in-progress' && <div className="text-[10px] text-ink-400 mt-0.5">{step.description}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function buildMockExtractions(): { risks: ExtractedRisk[]; controls: ExtractedControl[] } {
  const risks: ExtractedRisk[] = [
    { id: 'ext-r1', name: 'Unauthorized vendor payments without PO', description: 'Payments may be processed without a valid purchase order, leading to financial loss.', section: '§3.2 Payment Authorization', confidence: 'high', accepted: true },
    { id: 'ext-r2', name: 'Duplicate invoice submission', description: 'Same invoice could be submitted and paid twice due to weak detection.', section: '§4.1 Invoice Processing', confidence: 'high', accepted: true },
    { id: 'ext-r3', name: 'Vendor master data manipulation', description: 'Unauthorized changes to vendor bank details could enable fraudulent payments.', section: '§2.3 Vendor Management', confidence: 'medium', accepted: true },
    { id: 'ext-r4', name: 'Threshold bypass for approvals', description: 'High-value transactions processed without required dual authorization.', section: '§3.4 Approval Matrix', confidence: 'medium', accepted: false },
    { id: 'ext-r5', name: 'Segregation of duties violation', description: 'Same user creates and approves payment transactions.', section: '§5.1 Access Controls', confidence: 'high', accepted: true },
  ];
  const controls: ExtractedControl[] = [
    { id: 'ext-c1', name: 'Three-way PO/GRN/Invoice match', description: 'System enforces matching before payment release.', linkedRiskId: 'ext-r1', type: 'Preventive', section: '§3.2 Payment Authorization', confidence: 'high', accepted: true },
    { id: 'ext-c2', name: 'Duplicate invoice detection scan', description: 'Automated scan against historical invoices before processing.', linkedRiskId: 'ext-r2', type: 'Detective', section: '§4.1 Invoice Processing', confidence: 'high', accepted: true },
    { id: 'ext-c3', name: 'Vendor change multi-level approval', description: 'Multi-level approval for vendor master data changes.', linkedRiskId: 'ext-r3', type: 'Preventive', section: '§2.3 Vendor Management', confidence: 'medium', accepted: true },
    { id: 'ext-c4', name: 'High-value payment flagging', description: 'Automatic flagging for payments above threshold.', linkedRiskId: 'ext-r1', type: 'Preventive', section: '§3.4 Approval Matrix', confidence: 'medium', accepted: false },
    { id: 'ext-c5', name: 'SOD conflict detection', description: 'Real-time detection of segregation of duties violations.', linkedRiskId: 'ext-r5', type: 'Detective', section: '§5.1 Access Controls', confidence: 'high', accepted: true },
  ];
  return { risks, controls };
}

function buildPartialExtractions(): { risks: ExtractedRisk[]; controls: ExtractedControl[] } {
  const risks: ExtractedRisk[] = [
    { id: 'ext-p-r1', name: 'Potential unauthorized access', description: 'Document references access controls but details are unclear.', section: 'Unclear', confidence: 'low', accepted: true },
    { id: 'ext-p-r2', name: 'Data integrity risk', description: 'Manual data entry processes may lead to errors.', section: '§2.1 Data Entry', confidence: 'medium', accepted: true },
    { id: 'ext-p-r3', name: 'Process gap identified', description: 'The document mentions a review step but no details on frequency or ownership.', section: '§4.3 Review', confidence: 'low', accepted: false },
  ];
  // No controls extracted — partial
  return { risks, controls: [] };
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-compliant-50 text-compliant-700',
  medium: 'bg-mitigated-50 text-mitigated-700',
  low: 'bg-paper-100 text-ink-500',
};

// ─── SOP Extraction Review Workspace (inline, replaces SOP table) ─────────

function ExtractionReviewWorkspace({ sop, onBack, onAccept, onUpdateRisks, onUpdateControls }: {
  sop: LocalSOP;
  onBack: () => void;
  onAccept: (racmName: string) => void;
  onUpdateRisks: (risks: ExtractedRisk[]) => void;
  onUpdateControls: (controls: ExtractedControl[]) => void;
}) {
  const { addToast } = useToast();
  const isPartial = sop.status === 'Processed' || isPartialExtraction(sop);
  const partialWarnings = isPartial ? getPartialWarnings(sop) : [];
  const [partialConfirmed, setPartialConfirmed] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const defaultRacmName = `FY26 ${sop.businessProcess} — ${sop.name.replace(/\s*SOP\s*/i, '').trim()}`;
  const [racmName, setRacmName] = useState(defaultRacmName);

  const [summary, setSummary] = useState(
    `This SOP describes the ${sop.businessProcess} process for ${sop.name.replace(' SOP', '')}. ` +
    `AI extraction identified ${(sop.extractedRisks || []).length} potential risks and ${(sop.extractedControls || []).length} control references ` +
    `across ${new Set((sop.extractedRisks || []).map(r => r.section)).size} document sections.`
  );
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const [editingCtrlId, setEditingCtrlId] = useState<string | null>(null);
  const [showAddRisk, setShowAddRisk] = useState(false);
  const [showAddCtrl, setShowAddCtrl] = useState(false);

  // Inline add risk form state
  const [newRiskName, setNewRiskName] = useState('');
  const [newRiskDesc, setNewRiskDesc] = useState('');
  const [newRiskSection, setNewRiskSection] = useState('');

  // Inline add control ref form state
  const [newCtrlName, setNewCtrlName] = useState('');
  const [newCtrlDesc, setNewCtrlDesc] = useState('');
  const [newCtrlRiskId, setNewCtrlRiskId] = useState('');
  const [newCtrlType, setNewCtrlType] = useState<'Preventive' | 'Detective' | 'Corrective'>('Preventive');
  const [newCtrlSection, setNewCtrlSection] = useState('');

  const risks = sop.extractedRisks || [];
  const controls = sop.extractedControls || [];
  const activeRisks = risks.filter(r => r.accepted);

  const handleRemoveRisk = (id: string) => {
    onUpdateRisks(risks.filter(r => r.id !== id));
    addToast({ message: 'Risk removed', type: 'info' });
  };

  const handleRemoveControl = (id: string) => {
    onUpdateControls(controls.filter(c => c.id !== id));
    addToast({ message: 'Control reference removed', type: 'info' });
  };

  const handleEditRisk = (id: string, field: keyof ExtractedRisk, value: string) => {
    onUpdateRisks(risks.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleEditControl = (id: string, field: keyof ExtractedControl, value: string) => {
    onUpdateControls(controls.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddRisk = () => {
    if (!newRiskName.trim()) return;
    const newRisk: ExtractedRisk = {
      id: `ext-r-new-${Date.now()}`, name: newRiskName.trim(), description: newRiskDesc.trim(),
      section: newRiskSection.trim() || 'Manual entry', confidence: 'medium', accepted: true,
    };
    onUpdateRisks([...risks, newRisk]);
    setNewRiskName(''); setNewRiskDesc(''); setNewRiskSection(''); setShowAddRisk(false);
    addToast({ message: `Risk "${newRisk.name}" added`, type: 'success' });
  };

  const handleAddControl = () => {
    if (!newCtrlName.trim()) return;
    const newCtrl: ExtractedControl = {
      id: `ext-c-new-${Date.now()}`, name: newCtrlName.trim(), description: newCtrlDesc.trim(),
      linkedRiskId: newCtrlRiskId, type: newCtrlType, section: newCtrlSection.trim() || 'Manual entry',
      confidence: 'medium', accepted: true,
    };
    onUpdateControls([...controls, newCtrl]);
    setNewCtrlName(''); setNewCtrlDesc(''); setNewCtrlRiskId(''); setNewCtrlSection(''); setShowAddCtrl(false);
    addToast({ message: `Control reference "${newCtrl.name}" added`, type: 'success' });
  };

  const fieldCls = 'w-full px-2 py-1.5 border border-border rounded-[8px] text-[12px] text-text bg-white outline-none focus:border-primary/40';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-3">
          <ArrowLeft size={14} />Back to SOP List
        </button>
        <div className="bg-white rounded-[12px] border border-canvas-border p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-text">{sop.name}</h2>
                <span className="text-[11px] font-mono text-ink-500 bg-paper-50 px-1.5 py-0.5 rounded-[4px]">{sop.version}</span>
                <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[11px] text-ink-500">
                <span>Uploaded by {sop.uploadedBy} · {sop.uploadedAt}</span>
                <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-paper-100 text-ink-600 border border-canvas-border/60">{sop.businessProcess}</span>
              </div>
            </div>
          </div>

          {/* CTA section — gating warning sits right next to the action */}
          {isPartial && partialWarnings.length > 0 && (
            <div className="rounded-[8px] border border-mitigated bg-mitigated-50/50 px-4 py-3 mt-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-mitigated-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-mitigated-700">Incomplete extraction — review required</div>
                  <p className="text-[11px] text-mitigated-700/80 mt-0.5">Some information could not be extracted confidently. Review and complete missing items before creating RACM.</p>
                  <ul className="mt-2 space-y-0.5">
                    {partialWarnings.map((w, i) => (
                      <li key={i} className="text-[11px] text-mitigated-700/70 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-mitigated shrink-0" />{w}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input type="checkbox" checked={partialConfirmed} onChange={e => setPartialConfirmed(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-[4px] border-mitigated text-mitigated-700 accent-mitigated cursor-pointer" />
                    <span className="text-[11px] font-medium text-mitigated-700">I have reviewed the gaps and want to proceed</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end mt-3">
            <button type="button" onClick={() => setShowConfirmModal(true)} disabled={activeRisks.length === 0 || (isPartial && !partialConfirmed)}
              className="px-4 py-2 rounded-[8px] bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
              <FileText size={13} />New RACM
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-[8px] bg-paper-50 border border-canvas-border">
              <div className="text-lg font-bold text-text">{activeRisks.length}</div>
              <div className="text-[10px] text-text-muted">Accepted Risks</div>
            </div>
            <div className="text-center p-3 rounded-[8px] bg-paper-50 border border-canvas-border">
              <div className="text-lg font-bold text-text">{controls.filter(c => c.accepted).length}</div>
              <div className="text-[10px] text-text-muted">Control References</div>
            </div>
            <div className="text-center p-3 rounded-[8px] bg-paper-50 border border-canvas-border">
              <div className="text-lg font-bold text-ink-400">{risks.length - activeRisks.length + controls.length - controls.filter(c => c.accepted).length}</div>
              <div className="text-[10px] text-text-muted">Removed</div>
            </div>
          </div>

          {/* Linked RACM traceability (SOP → RACM) */}
          {sop.racmId && (
            <div className="rounded-[8px] border border-compliant/50 bg-compliant-50/20 px-4 py-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-[8px] bg-compliant-50 flex items-center justify-center shrink-0">
                    <FileText size={12} className="text-compliant-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-text">{sop.racmName || sop.racmId}</span>
                      <span className="px-1.5 h-4 rounded-[4px] text-[10px] font-bold bg-paper-100 text-ink-600">Draft</span>
                      <span className="px-1.5 h-4 rounded-[4px] text-[10px] font-bold bg-mitigated-50 text-mitigated-700">Mapping Incomplete</span>
                    </div>
                    <div className="text-[10px] text-ink-500 mt-0.5">
                      {sop.risks} risks · {sop.controls} control references · Created from this SOP
                    </div>
                  </div>
                </div>
                <button type="button" onClick={onBack}
                  className="px-3 py-1.5 rounded-[8px] text-[10px] font-semibold bg-paper-100 text-ink-600 hover:bg-paper-200/70 cursor-pointer transition-colors inline-flex items-center gap-1">
                  View RACM<ChevronRight size={8} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary — editable */}
      <div className="bg-white rounded-[12px] border border-canvas-border p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={11} className="text-primary/60" />SOP Summary
          </h3>
          <button type="button" onClick={() => setEditingSummary(!editingSummary)} className="text-[10px] font-medium text-primary hover:underline cursor-pointer">
            {editingSummary ? 'Done' : 'Edit'}
          </button>
        </div>
        {editingSummary ? (
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-border rounded-[8px] text-[12px] text-text bg-white outline-none focus:border-primary/40 resize-none" />
        ) : (
          <p className="text-[12px] text-text-secondary leading-relaxed">{summary}</p>
        )}
      </div>

      {/* Extracted Risks Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-text">Extracted Risks ({risks.length})</h3>
          <button type="button" onClick={() => setShowAddRisk(true)} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            <Plus size={11} />New Risk
          </button>
        </div>
        <div className="border-t border-border-light overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-white border-b border-border-light">
                <tr>
                  {['Risk Name', 'Description', 'Process', 'Source Section', 'Confidence', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risks.map(risk => (
                  <tr key={risk.id} className={`border-t border-border-light transition-colors ${risk.accepted ? 'hover:bg-surface-2/40' : 'bg-paper-50/30 opacity-50'}`}>
                    <td className="px-4 py-2.5 align-top">
                      {editingRiskId === risk.id ? (
                        <input value={risk.name} onChange={e => handleEditRisk(risk.id, 'name', e.target.value)} className={fieldCls} autoFocus />
                      ) : (
                        <span className="text-[12px] font-medium text-text">{risk.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top max-w-[200px]">
                      {editingRiskId === risk.id ? (
                        <input value={risk.description} onChange={e => handleEditRisk(risk.id, 'description', e.target.value)} className={fieldCls} />
                      ) : (
                        <span className="text-[11px] text-ink-500 line-clamp-2">{risk.description}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-paper-100 text-ink-600 border border-canvas-border/60">{sop.businessProcess}</span>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <span className="text-[10px] text-ink-400 font-mono">{risk.section}</span>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <span className={`px-1.5 h-4 rounded-[4px] text-[10px] font-bold inline-flex items-center ${CONFIDENCE_STYLES[risk.confidence]}`}>{risk.confidence}</span>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Edit" onClick={() => setEditingRiskId(editingRiskId === risk.id ? null : risk.id)}
                          className="p-1 rounded-[4px] hover:bg-paper-100 text-ink-400 hover:text-primary cursor-pointer" title="Edit">
                          <Eye size={11} />
                        </button>
                        <button type="button" aria-label="Remove" onClick={() => handleRemoveRisk(risk.id)}
                          className="p-1 rounded-[4px] hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer" title="Remove">
                          <X size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Add risk inline form */}
                {showAddRisk && (
                  <tr className="border-b border-border/50 bg-primary/5">
                    <td className="px-4 py-2 align-top"><input value={newRiskName} onChange={e => setNewRiskName(e.target.value)} placeholder="Risk name" className={fieldCls} autoFocus /></td>
                    <td className="px-4 py-2 align-top"><input value={newRiskDesc} onChange={e => setNewRiskDesc(e.target.value)} placeholder="Description" className={fieldCls} /></td>
                    <td className="px-4 py-2 align-top"><span className="text-[10px] text-ink-400">{sop.businessProcess}</span></td>
                    <td className="px-4 py-2 align-top"><input value={newRiskSection} onChange={e => setNewRiskSection(e.target.value)} placeholder="Section" className={fieldCls} /></td>
                    <td className="px-4 py-2 align-top"><span className="text-[9px] text-ink-400">Manual</span></td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Add risk" onClick={handleAddRisk} disabled={!newRiskName.trim()} className="p-1 rounded-[4px] bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer disabled:opacity-40"><CheckCircle2 size={11} /></button>
                        <button type="button" aria-label="Cancel" onClick={() => { setShowAddRisk(false); setNewRiskName(''); setNewRiskDesc(''); }} className="p-1 rounded-[4px] hover:bg-paper-100 text-ink-400 cursor-pointer"><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </div>

      {/* Extracted Control References Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-[13px] font-semibold text-text">Extracted Control References ({controls.length})</h3>
            <p className="text-[10px] text-ink-400 mt-0.5">References only — actual controls will be created in the Control Library after RACM review.</p>
          </div>
          <button type="button" onClick={() => setShowAddCtrl(true)} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            <Plus size={11} />New Control reference
          </button>
        </div>
        <div className="border-t border-border-light overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-white border-b border-border-light">
                <tr>
                  {['Control Reference', 'Related Risk', 'Process', 'Source Section', 'Type', 'Confidence', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {controls.map(ctrl => {
                  const linkedRisk = risks.find(r => r.id === ctrl.linkedRiskId);
                  return (
                    <tr key={ctrl.id} className={`border-t border-border-light transition-colors ${ctrl.accepted ? 'hover:bg-surface-2/40' : 'bg-paper-50/30 opacity-50'}`}>
                      <td className="px-4 py-2.5 align-top max-w-[180px]">
                        {editingCtrlId === ctrl.id ? (
                          <input value={ctrl.name} onChange={e => handleEditControl(ctrl.id, 'name', e.target.value)} className={fieldCls} autoFocus />
                        ) : (
                          <span className="text-[12px] font-medium text-text">{ctrl.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="text-[11px] text-ink-500">{linkedRisk?.name || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-paper-100 text-ink-600 border border-canvas-border/60">{sop.businessProcess}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="text-[10px] text-ink-400 font-mono">{ctrl.section || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="px-1.5 h-4 rounded-[4px] text-[10px] font-bold bg-paper-100 text-ink-500 inline-flex items-center">{ctrl.type}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className={`px-1.5 h-4 rounded-[4px] text-[10px] font-bold inline-flex items-center ${CONFIDENCE_STYLES[ctrl.confidence]}`}>{ctrl.confidence}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label="Edit" onClick={() => setEditingCtrlId(editingCtrlId === ctrl.id ? null : ctrl.id)}
                            className="p-1 rounded-[4px] hover:bg-paper-100 text-ink-400 hover:text-primary cursor-pointer" title="Edit">
                            <Eye size={11} />
                          </button>
                          <button type="button" aria-label="Remove" onClick={() => handleRemoveControl(ctrl.id)}
                            className="p-1 rounded-[4px] hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer" title="Remove">
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Add control ref inline form */}
                {showAddCtrl && (
                  <tr className="border-b border-border/50 bg-primary/5">
                    <td className="px-4 py-2 align-top"><input value={newCtrlName} onChange={e => setNewCtrlName(e.target.value)} placeholder="Control reference" className={fieldCls} autoFocus /></td>
                    <td className="px-4 py-2 align-top">
                      <select value={newCtrlRiskId} onChange={e => setNewCtrlRiskId(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                        <option value="">Select risk...</option>
                        {activeRisks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 align-top"><span className="text-[10px] text-ink-400">{sop.businessProcess}</span></td>
                    <td className="px-4 py-2 align-top"><input value={newCtrlSection} onChange={e => setNewCtrlSection(e.target.value)} placeholder="Section" className={fieldCls} /></td>
                    <td className="px-4 py-2 align-top">
                      <select value={newCtrlType} onChange={e => setNewCtrlType(e.target.value as any)} className={fieldCls + ' cursor-pointer appearance-none'}>
                        <option value="Preventive">Preventive</option>
                        <option value="Detective">Detective</option>
                        <option value="Corrective">Corrective</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 align-top"><span className="text-[9px] text-ink-400">Manual</span></td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Add control reference" onClick={handleAddControl} disabled={!newCtrlName.trim()} className="p-1 rounded-[4px] bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer disabled:opacity-40"><CheckCircle2 size={11} /></button>
                        <button type="button" aria-label="Cancel" onClick={() => { setShowAddCtrl(false); setNewCtrlName(''); setNewCtrlDesc(''); }} className="p-1 rounded-[4px] hover:bg-paper-100 text-ink-400 cursor-pointer"><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </div>

      {/* Create Draft RACM Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }} className="bg-white rounded-[16px] shadow-2xl border border-canvas-border w-full max-w-[480px]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold text-text">Create Draft RACM from SOP</h2>
                    <p className="text-[12px] text-text-muted mt-0.5">Review the summary below before creating the draft RACM.</p>
                  </div>
                  <button type="button" aria-label="Close" onClick={() => setShowConfirmModal(false)} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
                </div>

                {/* Summary */}
                <div className="px-6 py-5 space-y-4">
                  {/* Source SOP */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <span className="text-[10px] text-ink-400 uppercase block">Source SOP</span>
                      <span className="text-[13px] text-text font-medium mt-0.5 block">{sop.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 uppercase block">Business Process</span>
                      <span className="text-[13px] text-text mt-0.5 block">{sop.businessProcess}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 uppercase block">Risks to create</span>
                      <span className="text-[13px] text-text font-semibold mt-0.5 block">{activeRisks.length}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 uppercase block">Control references</span>
                      <span className="text-[13px] text-text font-semibold mt-0.5 block">{controls.filter(c => c.accepted).length}</span>
                    </div>
                  </div>

                  {/* RACM Name */}
                  <div>
                    <label className="text-[12px] font-semibold text-text-muted block mb-1.5">RACM Name</label>
                    <input value={racmName} onChange={e => setRacmName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-white outline-none focus:border-primary/40 transition-all" />
                  </div>

                  {/* What will happen */}
                  <div className="rounded-[8px] bg-paper-50 border border-canvas-border px-4 py-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-text-muted">What will happen:</div>
                    <ul className="space-y-1">
                      {[
                        'RACM created in Draft status (not Active)',
                        `${activeRisks.length} extracted risks linked to RACM`,
                        `${controls.filter(c => c.accepted).length} control references preserved (not mapped to Control Library)`,
                        'Source SOP sections preserved for traceability',
                        'RACM readiness: Mapping Incomplete',
                        'SOP linked to the created RACM',
                      ].map((item, i) => (
                        <li key={i} className="text-[11px] text-text-secondary flex items-start gap-1.5">
                          <CheckCircle2 size={10} className="text-compliant-700 shrink-0 mt-0.5" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* What will NOT happen */}
                  <div className="rounded-[8px] bg-paper-50 border border-border/30 px-4 py-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-ink-500">What will NOT happen:</div>
                    <ul className="space-y-1">
                      {[
                        'Controls will not be created in Control Library',
                        'Workflows will not be linked',
                        'RACM will not be validated or activated',
                      ].map((item, i) => (
                        <li key={i} className="text-[11px] text-ink-400 flex items-start gap-1.5">
                          <X size={10} className="text-ink-300 shrink-0 mt-0.5" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2.5 rounded-[8px] border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
                  <button type="button" onClick={() => { setShowConfirmModal(false); onAccept(racmName); }} disabled={!racmName.trim()}
                    className="px-5 py-2.5 rounded-[8px] bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                    <FileText size={13} />Create Draft RACM
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Upload SOP Drawer ────────────────────────────────────────────────────

interface UploadSOPData {
  name: string;
  version: string;
  description: string;
  fileName: string;
}

function UploadSOPDrawer({ bpAbbr, onClose, onUploadAndProcess, onSaveAsDraft }: {
  bpAbbr: string;
  onClose: () => void;
  onUploadAndProcess: (data: UploadSOPData) => void;
  onSaveAsDraft: (data: UploadSOPData) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const now = new Date();
  const uploadDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleFile = (file: File) => {
    setFileName(file.name);
    if (!name) {
      setName(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    }
  };

  const isValid = name.trim() && fileName;
  // Drawer is dirty as soon as the user touches any field — close attempts go through confirm.
  const isDirty = !!(name.trim() || description.trim() || fileName);

  const buildData = (): UploadSOPData => ({ name: name.trim(), version: 'v1.0', description: description.trim(), fileName });

  // Discard-aware close handlers.
  const requestClose = () => { if (isDirty) setShowDiscardConfirm(true); else onClose(); };
  const discardAndClose = () => { setName(''); setDescription(''); setFileName(''); setShowDiscardConfirm(false); onClose(); };
  const cancelClose = () => setShowDiscardConfirm(false);

  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-white outline-none focus:border-primary/40 transition-all';
  const labelCls = 'text-[12px] font-semibold text-text-muted block mb-1.5';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={requestClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">

        {/* Discard-changes confirm strip — only shows when user tried to close after editing */}
        {showDiscardConfirm && (
          <div className="p-3 bg-mitigated-50 border-b border-mitigated-200 flex items-center gap-3 text-[13px]">
            <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0" />
            <div className="flex-1 text-ink-800">Discard unsaved changes?</div>
            <button type="button" onClick={discardAndClose} className="px-3 py-1 rounded-[6px] bg-paper-0 border border-mitigated-300 text-[12px] text-ink-700 hover:bg-paper-50">Discard</button>
            <button type="button" onClick={cancelClose} className="px-3 py-1 rounded-[6px] bg-mitigated-700 text-paper-0 text-[12px] hover:bg-mitigated-800">Keep editing</button>
          </div>
        )}

        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-ink-900">Upload SOP</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">Upload a process document and define metadata.</p>
          </div>
          <button type="button" aria-label="Close" onClick={requestClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* File Upload */}
          <div>
            <label className={labelCls}>Document <span className="text-risk">*</span></label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.docx,.xlsx,.doc,.xls,.csv';
                input.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); };
                input.click();
              }}
              className={`border-2 border-dashed rounded-[12px] p-5 text-center cursor-pointer transition-all ${
                dragOver ? 'border-primary bg-primary/5' : fileName ? 'border-compliant bg-compliant-50/30' : 'border-border hover:border-canvas-border'
              }`}
            >
              {fileName ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={16} className="text-compliant-700" />
                  <span className="text-[12px] font-medium text-compliant-700">{fileName}</span>
                  <button type="button" aria-label="Remove file" onClick={e => { e.stopPropagation(); setFileName(''); }} className="text-ink-400 hover:text-risk-700"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <Upload size={18} className={`mx-auto mb-1.5 ${dragOver ? 'text-primary' : 'text-ink-300'}`} />
                  <div className="text-[12px] text-text-muted">Drag & drop or click to browse</div>
                  <div className="text-[10px] text-ink-400 mt-0.5">PDF, DOCX, XLSX, CSV</div>
                </>
              )}
            </div>
          </div>

          {/* SOP Name */}
          <div>
            <label className={labelCls}>SOP Name <span className="text-risk">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Auto-filled from file name" className={fieldCls} />
          </div>

          {/* Business Process (read-only) */}
          <div>
            <label className={labelCls}>Business Process</label>
            <div className="px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-paper-50 cursor-not-allowed">{bpAbbr}</div>
          </div>



          {/* Description */}
          <div>
            <label className={labelCls}>Description <span className="font-normal text-ink-400">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief description of the SOP scope..." className={fieldCls + ' resize-none'} />
          </div>

        </div>

        <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3 shrink-0">
          <button type="button" onClick={requestClose} className="px-4 py-2.5 rounded-[8px] border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button type="button" onClick={() => { if (isValid) onUploadAndProcess(buildData()); }} disabled={!isValid}
            className="px-5 py-2.5 rounded-[8px] bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            Upload & Process
          </button>
        </div>
      </motion.aside>
    </>
  );
}

// ─── SOP Preview Drawer ──────────────────────────────────────────────────

function SOPPreviewDrawer({ sop, onClose, onGoToRacm }: { sop: LocalSOP; onClose: () => void; onGoToRacm?: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-ink-900">{sop.name}</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">SOP Preview</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><span className="text-[10px] text-ink-400 uppercase block">Uploaded By</span><span className="text-[13px] text-text mt-0.5 block">{sop.uploadedBy}</span></div>
            <div><span className="text-[10px] text-ink-400 uppercase block">Upload Date</span><span className="text-[13px] text-text mt-0.5 block">{sop.uploadedAt}</span></div>
            <div><span className="text-[10px] text-ink-400 uppercase block">Business Process</span><span className="text-[13px] text-text mt-0.5 block">{sop.businessProcess}</span></div>
            <div><span className="text-[10px] text-ink-400 uppercase block">Version</span><span className="text-[13px] text-text mt-0.5 font-mono block">{sop.version}</span></div>
            <div><span className="text-[10px] text-ink-400 uppercase block">Status</span><span className={`mt-0.5 px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span></div>
            <div><span className="text-[10px] text-ink-400 uppercase block">File</span><span className="text-[13px] text-text mt-0.5 block">{sop.fileName}</span></div>
          </div>
          {/* Description */}
          {sop.description && (
            <div>
              <span className="text-[10px] text-ink-400 uppercase block mb-1">Description</span>
              <p className="text-[13px] text-text-secondary leading-relaxed">{sop.description}</p>
            </div>
          )}
          {/* Source file placeholder */}
          <div>
            <span className="text-[10px] text-ink-400 uppercase block mb-2">Document Preview</span>
            <div className="rounded-[8px] border border-border bg-paper-50 p-10 text-center">
              <FileText size={24} className="mx-auto text-ink-300 mb-2" />
              <div className="text-[12px] text-ink-400">Document preview not available in prototype</div>
              <div className="text-[10px] text-ink-300 mt-1">{sop.fileName}</div>
            </div>
          </div>
          {/* Extraction summary */}
          {(sop.risks > 0 || sop.controls > 0) && (
            <div>
              <span className="text-[10px] text-ink-400 uppercase block mb-2">Extraction Summary</span>
              <div className="flex gap-4">
                <div className="text-center p-3 rounded-[8px] bg-paper-50 border border-canvas-border flex-1">
                  <div className="text-lg font-bold text-text">{sop.risks}</div>
                  <div className="text-[10px] text-text-muted">Risks Extracted</div>
                </div>
                <div className="text-center p-3 rounded-[8px] bg-paper-50 border border-canvas-border flex-1">
                  <div className="text-lg font-bold text-text">{sop.controls}</div>
                  <div className="text-[10px] text-text-muted">Control References</div>
                </div>
              </div>
            </div>
          )}
          {/* Linked RACM */}
          {sop.racmId && (
            <div>
              <span className="text-[10px] text-ink-400 uppercase block mb-2">Linked RACM</span>
              <div className="rounded-[8px] border border-border p-3 flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-medium text-text">{sop.racmName || sop.racmId}</span>
                  <span className="text-[10px] text-ink-400 block mt-0.5">{sop.risks} risks · {sop.controls} control references</span>
                </div>
                {onGoToRacm && (
                  <button type="button" onClick={() => { onClose(); onGoToRacm(); }}
                    className="px-2.5 py-1 rounded-[8px] text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors">
                    View RACM
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border">
          <button type="button" onClick={onClose} className="w-full px-4 py-2.5 rounded-[8px] border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Close</button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Create RACM from SOP Modal ──────────────────────────────────────────

const RACM_AUDIT_TYPES = ['IFC', 'Internal Audit', 'Operational Audit', 'Concurrent Audit', 'ITGC'];
const RACM_FY_OPTIONS = ['FY25', 'FY26', 'FY27'];
const RACM_FRAMEWORKS = ['SOX ICFR', 'ISO 27001', 'Internal Policy', 'Custom'];

function CreateRacmFromSOPModal({ sopName, bpAbbr, onClose, onCreate, onStartReview }: {
  sopName: string;
  bpAbbr: string;
  onClose: () => void;
  onCreate: (racmName: string, framework: string) => void;
  onStartReview?: (racmName: string, fileName: string) => void;
}) {
  const { addToast } = useToast();
  type SourceMode = 'blank' | 'upload' | 'sop';
  const [source, setSource] = useState<SourceMode | null>(sopName ? 'sop' : null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadParsing, setUploadParsing] = useState(false);
  const [uploadParsed, setUploadParsed] = useState(false);
  const [extractedStats, setExtractedStats] = useState<{ risks: number; controls: number; rows: number } | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Form state
  const sopLabel = sopName.replace(/\s*SOP\s*/i, '').trim();
  const initialName = sopLabel ? `FY26 ${bpAbbr} — ${sopLabel}` : '';
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState('');
  const [owner, setOwner] = useState('Current User');

  const isFormValid = name.trim().length > 0 && owner.trim().length > 0;
  // Dirty if any user-editable field deviates from its initial state, or a file/source is loaded.
  const isDirty = name !== initialName
    || description.trim().length > 0
    || framework.length > 0
    || owner !== 'Current User'
    || !!uploadedFile
    || (source !== (sopName ? 'sop' : null));
  const requestClose = () => { if (isDirty) setShowDiscardConfirm(true); else onClose(); };
  const discardAndClose = () => {
    setName(initialName); setDescription(''); setFramework(''); setOwner('Current User');
    setUploadedFile(null); setUploadParsing(false); setUploadParsed(false); setExtractedStats(null);
    setSource(sopName ? 'sop' : null);
    setShowDiscardConfirm(false);
    onClose();
  };
  const cancelClose = () => setShowDiscardConfirm(false);
  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-white outline-none focus:border-primary/40 transition-all';
  const labelCls = 'text-[12px] font-semibold text-text-muted block mb-1.5';

  const handleFileUpload = (fileName: string) => {
    setUploadedFile(fileName);
    setUploadParsing(true);
    if (!name) setName(`FY26 ${bpAbbr} — ${fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')}`);
    // Simulate parsing delay
    setTimeout(() => {
      setUploadParsing(false);
      setUploadParsed(true);
      setExtractedStats({ risks: 5, controls: 7, rows: 7 });
      addToast({ message: `"${fileName}" parsed — 5 risks, 7 controls extracted.`, type: 'success' });
    }, 1200);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadParsing(false);
    setUploadParsed(false);
    setExtractedStats(null);
  };

  // Determine CTA label + action
  const isUploadReview = source === 'upload' && uploadParsed && uploadedFile;
  const ctaLabel = isUploadReview ? 'Review Imported RACM' : 'Create RACM';
  const ctaDisabled = !isFormValid || (source === 'upload' && !uploadParsed);
  const hasSopSource = !!sopName;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={requestClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[540px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">

        {/* Discard-changes confirm strip — only shows when user tried to close after editing */}
        {showDiscardConfirm && (
          <div className="p-3 bg-mitigated-50 border-b border-mitigated-200 flex items-center gap-3 text-[13px]">
            <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0" />
            <div className="flex-1 text-ink-800">Discard unsaved changes?</div>
            <button type="button" onClick={discardAndClose} className="px-3 py-1 rounded-[6px] bg-paper-0 border border-mitigated-300 text-[12px] text-ink-700 hover:bg-paper-50">Discard</button>
            <button type="button" onClick={cancelClose} className="px-3 py-1 rounded-[6px] bg-mitigated-700 text-paper-0 text-[12px] hover:bg-mitigated-800">Keep editing</button>
          </div>
        )}

        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-ink-900">Create RACM</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">Define a new Risk &amp; Control Matrix for audit governance.</p>
          </div>
          <button type="button" aria-label="Close" onClick={requestClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ─── Form Fields (always visible once source chosen or immediately) ─── */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Basic Info</h3>
            <div>
              <label className={labelCls}>RACM Name <span className="text-risk">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FY26 P2P — Vendor Payment" className={fieldCls} autoFocus />
            </div>
            <div>
              <label className={labelCls}>Framework <span className="font-normal text-ink-400">(optional)</span></label>
              <select value={framework} onChange={e => setFramework(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                <option value="">Select...</option>
                {RACM_FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Owner <span className="text-risk">*</span></label>
              <input value={owner} onChange={e => setOwner(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Description <span className="font-normal text-ink-400">(optional)</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Brief description..." className={fieldCls + ' resize-none'} />
            </div>
            {/* Business Process — auto-filled, read-only */}
            <div>
              <label className={labelCls}>Business Process</label>
              <div className="px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-paper-50/80 cursor-not-allowed flex items-center gap-2">
                <Building2 size={13} className="text-ink-400 shrink-0" />
                <span>{bpAbbr}</span>
                <span className="ml-auto text-[10px] text-ink-400">Auto-filled</span>
              </div>
            </div>
          </div>

          {/* ─── Source Type Selection ─── */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Source Type</h3>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'blank' as const, label: 'Start Blank', desc: 'Add risks & controls manually', icon: Plus, disabled: false },
                { id: 'upload' as const, label: 'Upload RACM File', desc: 'Import from Excel, CSV, PDF', icon: Upload, disabled: false },
                { id: 'sop' as const, label: 'Generate from SOP', desc: hasSopSource ? 'Extract from uploaded SOP' : 'Coming soon', icon: Sparkles, disabled: !hasSopSource },
              ] as const).map(opt => (
                <button type="button" key={opt.id} onClick={() => { if (!opt.disabled) setSource(opt.id); }}
                  disabled={opt.disabled}
                  className={`text-left p-3 rounded-[12px] border-2 transition-all ${
                    source === opt.id
                      ? 'border-primary bg-primary/5'
                      : opt.disabled
                        ? 'border-border-light bg-paper-50/50 opacity-50 cursor-not-allowed'
                        : 'border-border-light hover:border-primary/30 hover:bg-primary/5 cursor-pointer'
                  }`}>
                  <opt.icon size={16} className={`mb-1.5 ${source === opt.id ? 'text-primary' : 'text-ink-400'}`} />
                  <div className={`text-[12px] font-semibold ${source === opt.id ? 'text-primary' : 'text-text'}`}>{opt.label}</div>
                  <div className="text-[10px] text-text-muted mt-0.5 leading-snug">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Upload Section (only when source is upload) ─── */}
          {source === 'upload' && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Upload File</h3>
              {!uploadedFile ? (
                <div onClick={() => {
                    const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls,.csv,.pdf';
                    input.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleFileUpload(f.name); };
                    input.click();
                  }}
                  className="border-2 border-dashed border-border-light rounded-[12px] p-6 text-center cursor-pointer hover:border-primary/30 hover:bg-paper-50/50 transition-all">
                  <Upload size={22} className="mx-auto text-ink-300 mb-2" />
                  <div className="text-[13px] font-semibold text-text">Drop file here or click to browse</div>
                  <div className="text-[11px] text-text-muted mt-1">Supported: Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf)</div>
                </div>
              ) : (
                <div className="rounded-[8px] border border-canvas-border bg-surface-2/30 p-4 space-y-3">
                  {/* File info */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[8px] bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-text truncate">{uploadedFile}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {uploadParsing ? 'Parsing file…' : uploadParsed && extractedStats ? `${extractedStats.rows} rows · ${extractedStats.risks} risks · ${extractedStats.controls} controls extracted` : 'Ready'}
                      </p>
                    </div>
                    {uploadParsing ? (
                      <Loader2 size={16} className="text-primary animate-spin shrink-0" />
                    ) : (
                      <button type="button" aria-label="Remove file" onClick={handleRemoveFile} className="p-1.5 rounded-[8px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors" title="Remove file"><X size={14} /></button>
                    )}
                  </div>

                  {/* Extracted summary */}
                  {uploadParsed && extractedStats && (
                    <div className="flex items-center gap-2 p-2.5 bg-compliant-50/40 rounded-[8px] border border-compliant/60">
                      <CheckCircle2 size={12} className="text-compliant-700 shrink-0" />
                      <span className="text-[11px] text-compliant-700">File parsed successfully. Review the imported structure in the next step to validate and finalize.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer — shown once a source type is selected */}
        {source && (
          <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3 shrink-0">
            <button type="button" onClick={requestClose} className="px-4 py-2.5 rounded-[8px] border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
            <button type="button" onClick={() => {
                if (!isFormValid) return;
                if (isUploadReview && onStartReview) {
                  onStartReview(name.trim(), uploadedFile!);
                  onClose();
                } else {
                  onCreate(name.trim(), framework || 'Internal Policy');
                }
              }} disabled={ctaDisabled}
              className="px-5 py-2.5 rounded-[8px] bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
              {isUploadReview && <Eye size={14} />}
              {ctaLabel}
            </button>
          </div>
        )}
      </motion.aside>
    </>
  );
}

// ─── SOP Detail Page (Step 4 — detail-page pattern) ───────────────────────

function SOPDetailPage({ sop, onBack, onGoToRacm }: {
  sop: LocalSOP;
  onBack: () => void;
  onGoToRacm?: () => void;
}) {
  const rels = getSopRelationships(sop.id);
  const fields = [
    { label: 'Version', value: sop.version, mono: true },
    { label: 'Business Process', value: sop.businessProcess },
    { label: 'Status', value: sop.status, pill: true },
    { label: 'Uploaded By', value: sop.uploadedBy },
    { label: 'Upload Date', value: sop.uploadedAt },
    { label: 'File', value: sop.fileName, mono: true },
  ];

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[12px] text-ink-500 hover:text-primary tracking-tight transition-colors cursor-pointer inline-flex items-center gap-1.5"
      >
        <ArrowLeft size={12} />Back to SOPs
      </button>

      <div className="bg-white border border-canvas-border rounded-[12px] p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span>
              <span className="font-mono text-[11px] text-ink-500">{sop.id}</span>
            </div>
            <h1 className="font-display text-[26px] font-[420] tracking-tight text-ink-900 leading-[1.2]">{sop.name}</h1>
          </div>
          {rels.racm && onGoToRacm && (
            <button
              type="button"
              onClick={onGoToRacm}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer"
            >
              Go to RACM<ArrowRight size={13} />
            </button>
          )}
        </div>

        {sop.description && (
          <p className="text-[13px] text-text leading-relaxed mb-5 max-w-3xl">{sop.description}</p>
        )}

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-canvas-border/70">
          {fields.map(f => (
            <div key={f.label}>
              <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-0.5">{f.label}</span>
              {f.pill ? (
                <span className={`mt-0.5 px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span>
              ) : (
                <span className={`text-[13px] block ${f.mono ? 'font-mono text-ink-700' : 'text-text'}`}>{f.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <Grid3x3 size={13} className="text-ink-500" />
              Linked RACM
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.racm ? 1 : 0}</span>
          </div>
          {!rels.racm ? (
            <p className="text-[12px] text-ink-400 italic">Not linked to a RACM yet. Process the SOP to extract risks and controls into a draft RACM.</p>
          ) : (
            <div className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[12.5px] text-ink-800 font-medium leading-snug truncate flex-1">{rels.racm.name}</span>
                <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{rels.racm.fw}</span>
              </div>
              <span className="text-[11px] text-ink-500 leading-snug">Owner: {rels.racm.owner} · Last run: {rels.racm.lastRun}</span>
            </div>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-ink-500" />
              Extracted Risks
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.risks.length}</span>
          </div>
          {rels.risks.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No risks extracted yet.</p>
          ) : (
            <ul className="space-y-2">
              {rels.risks.map(r => (
                <li key={r.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{r.id}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{r.name}</span>
                      <span className="text-[11px] text-ink-500 leading-snug block">Severity: {r.severity} · Status: {r.status}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-ink-500" />
              Extracted Controls
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.controls.length}</span>
          </div>
          {rels.controls.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No controls extracted yet.</p>
          ) : (
            <ul className="space-y-2">
              {rels.controls.map(c => (
                <li key={c.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{c.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{c.name}</span>
                        {c.isKey && <span className="px-1.5 h-4 rounded-[4px] text-[9px] font-bold inline-flex items-center bg-mitigated-50 text-mitigated-700 shrink-0">Key</span>}
                      </div>
                      <span className="text-[11px] text-ink-500 leading-snug">{c.desc}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SOP Tab Content Component ────────────────────────────────────────────

function SOPTabContent({ bpId, bpAbbr, existingSops, existingRacms, onGoToRacm, onRacmCreated, onViewRacm }: {
  bpId: string;
  bpAbbr: string;
  existingSops: typeof SOPS;
  existingRacms: typeof RACMS;
  onGoToRacm: () => void;
  onRacmCreated?: (racmId: string, racmName: string, process: string, framework: string) => void;
  onViewRacm?: (racmId: string) => void;
}) {
  const { addToast } = useToast();

  // Local SOP state (seed from mock + allow new uploads)
  const [localSops, setLocalSops] = useState<LocalSOP[]>(() =>
    existingSops.map((s, idx) => ({
      id: s.id, name: s.name, fileName: `${s.name.replace(/\s+/g, '_')}.pdf`, version: s.version,
      description: '', businessProcess: bpAbbr,
      uploadedBy: s.by, uploadedAt: s.at,
      status: (s.racmId ? 'Linked' : idx % 3 === 0 ? 'Processed' : 'Draft') as SOPStatus,
      progress: s.racmId ? 100 : 0, processingStep: s.racmId ? 6 : 0,
      risks: s.risks, controls: s.controls, racmId: s.racmId, racmName: s.racmId ? `FY26 ${bpAbbr} — ${s.name.replace(/\s*SOP\s*/i, '').trim()}` : null, failureReason: null,
      extractedRisks: s.racmId ? [] : buildMockExtractions().risks,
      extractedControls: s.racmId ? [] : buildMockExtractions().controls,
    }))
  );

  const [reviewingSopId, setReviewingSopId] = useState<string | null>(null);
  const [previewingSopId, setPreviewingSopId] = useState<string | null>(null);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [showCreateRacmForSopId, setShowCreateRacmForSopId] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState<{ data: UploadSOPData; startProcessing: boolean; existing: LocalSOP } | null>(null);
  const [sopStatusFilter, setSopStatusFilter] = useState<string[]>([]);
  const [detailSopId, setDetailSopId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('sop');
  });

  // URL sync — ?sop=sop-001
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get('sop');
    if (detailSopId && current !== detailSopId) {
      params.set('sop', detailSopId);
      window.history.pushState({ ...window.history.state, sop: detailSopId }, '', `?${params.toString()}`);
    } else if (!detailSopId && current) {
      params.delete('sop');
      const qs = params.toString();
      window.history.pushState({ ...window.history.state, sop: null }, '', qs ? `?${qs}` : window.location.pathname);
    }
  }, [detailSopId]);

  useEffect(() => {
    const onPop = () => {
      const param = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sop') : null;
      setDetailSopId(param);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const reviewingSop = reviewingSopId ? localSops.find(s => s.id === reviewingSopId) : null;

  // Skeleton state — short 400ms placeholder so SOP list never paints into a flash of "empty" / "no SOPs".
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  // Listen for header-level "Create new SOP" trigger.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: string }>;
      if (ce.detail?.section === 'sop') setShowUploadDrawer(true);
    };
    window.addEventListener('process-hub-create', handler);
    return () => window.removeEventListener('process-hub-create', handler);
  }, []);

  // Check for duplicate before creating
  const handleUploadIntent = useCallback((data: UploadSOPData, startProcessing: boolean) => {
    const nameLower = data.name.trim().toLowerCase();
    const existing = localSops.find(s => s.name.toLowerCase() === nameLower && s.status !== 'Archived');
    if (existing) {
      setVersionConflict({ data, startProcessing, existing });
      return;
    }
    handleCreateSOP(data, startProcessing);
  }, [localSops]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVersionConflictResolve = (action: 'new-version' | 'replace' | 'cancel') => {
    if (!versionConflict) return;
    const { data, startProcessing, existing } = versionConflict;

    if (action === 'cancel') {
      setVersionConflict(null);
      return;
    }

    if (action === 'replace') {
      // Replace: remove old, create new with same version
      setLocalSops(prev => prev.filter(s => s.id !== existing.id));
      handleCreateSOP(data, startProcessing);
      setVersionConflict(null);
      return;
    }

    if (action === 'new-version') {
      // Bump version: parse existing, increment
      const match = existing.version.match(/v(\d+)\.(\d+)/);
      const major = match ? parseInt(match[1]) : 1;
      const minor = match ? parseInt(match[2]) + 1 : 1;
      const newVersion = `v${major}.${minor}`;
      handleCreateSOP({ ...data, version: newVersion }, startProcessing);
      setVersionConflict(null);
      return;
    }
  };

  // Create SOP record and optionally start AI processing
  const handleCreateSOP = useCallback((data: UploadSOPData, startProcessing: boolean) => {
    const newId = `sop-new-${Date.now()}`;
    const { risks, controls } = buildMockExtractions();
    const uploadDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newSop: LocalSOP = {
      id: newId, name: data.name, fileName: data.fileName, version: data.version,
      description: data.description, businessProcess: bpAbbr,
      uploadedBy: 'Current User', uploadedAt: uploadDate,
      status: startProcessing ? 'Processing' : 'Draft',
      progress: 0, processingStep: startProcessing ? 0 : 0,
      risks: 0, controls: 0, racmId: null, racmName: null, failureReason: null,
      extractedRisks: risks, extractedControls: controls,
    };

    setLocalSops(prev => [newSop, ...prev]);
    setShowUploadDrawer(false);

    if (!startProcessing) {
      addToast({ message: `"${data.name}" saved as draft. Start processing when ready.`, type: 'success' });
      return;
    }

    addToast({ message: `Processing "${data.name}"...`, type: 'info' });

    // Simulate step-by-step: advance processingStep 0→6, then Ready for Review
    const stepDelays = [500, 1000, 1800, 2500, 3200, 3800, 4200];
    stepDelays.forEach((delay, stepIdx) => {
      setTimeout(() => {
        setLocalSops(prev => prev.map(s => s.id === newId ? {
          ...s,
          processingStep: stepIdx,
          progress: Math.round((stepIdx / 6) * 100),
        } : s));
      }, delay);
    });
    // Final: determine if result is Ready for Review or Partial
    setTimeout(() => {
      setLocalSops(prev => prev.map(s => {
        if (s.id !== newId) return s;
        const updated = {
          ...s, progress: 100, processingStep: 6,
          risks: risks.filter(r => r.accepted).length,
          controls: controls.filter(c => c.accepted).length,
        };
        const partial = isPartialExtraction(updated);
        return { ...updated, status: 'Processed' as SOPStatus };
      }));
      addToast({ message: `"${data.name}" processed — ${risks.length} risks and ${controls.length} controls extracted. Review to create draft RACM.`, type: 'success' });
    }, 4500);
  }, [addToast, bpAbbr]);

  // Start processing for a draft SOP
  const handleStartProcessing = useCallback((sopId: string) => {
    const sop = localSops.find(s => s.id === sopId);
    if (!sop || sop.status !== 'Draft') return;

    setLocalSops(prev => prev.map(s => s.id === sopId ? { ...s, status: 'Processing' as SOPStatus, progress: 0, processingStep: 0, failureReason: null } : s));
    addToast({ message: `Processing "${sop.name}"...`, type: 'info' });

    const { risks, controls } = buildMockExtractions();

    const stepDelays = [500, 1000, 1800, 2500, 3200, 3800, 4200];
    stepDelays.forEach((delay, stepIdx) => {
      setTimeout(() => {
        setLocalSops(prev => prev.map(s => s.id === sopId ? {
          ...s, processingStep: stepIdx, progress: Math.round((stepIdx / 6) * 100),
          ...(stepIdx === 0 ? { extractedRisks: risks, extractedControls: controls } : {}),
        } : s));
      }, delay);
    });
    setTimeout(() => {
      setLocalSops(prev => prev.map(s => {
        if (s.id !== sopId) return s;
        const updated = {
          ...s, progress: 100, processingStep: 6,
          risks: risks.filter(r => r.accepted).length,
          controls: controls.filter(c => c.accepted).length,
        };
        const partial = isPartialExtraction(updated);
        return { ...updated, status: 'Processed' as SOPStatus };
      }));
      addToast({ message: `"${sop.name}" processed — ${risks.length} risks and ${controls.length} controls extracted.`, type: 'success' });
    }, 4500);
  }, [addToast, localSops]);

  const handleUpdateRisks = (sopId: string, risks: ExtractedRisk[]) => {
    setLocalSops(prev => prev.map(s => s.id === sopId ? { ...s, extractedRisks: risks, risks: risks.filter(r => r.accepted).length } : s));
  };

  const handleUpdateControls = (sopId: string, controls: ExtractedControl[]) => {
    setLocalSops(prev => prev.map(s => s.id === sopId ? { ...s, extractedControls: controls, controls: controls.filter(c => c.accepted).length } : s));
  };

  const handleCreateDraftRacm = (sopId: string, racmName?: string) => {
    const sop = localSops.find(s => s.id === sopId);
    if (!sop) return;
    const racmId = `RACM-DRAFT-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const acceptedRisks = (sop.extractedRisks || []).filter(r => r.accepted).length;
    const acceptedControls = (sop.extractedControls || []).filter(c => c.accepted).length;
    const name = racmName || `FY26 ${sop.businessProcess} — ${sop.name.replace(/\s*SOP\s*/i, '').trim()}`;

    setLocalSops(prev => prev.map(s => s.id === sopId ? {
      ...s, status: 'Linked' as SOPStatus, racmId, racmName: name, risks: acceptedRisks, controls: acceptedControls,
    } : s));
    setReviewingSopId(null);
    addToast({ message: `Draft RACM "${name}" created with ${acceptedRisks} risks and ${acceptedControls} control references. Open the RACM tab to continue.`, type: 'success' });
  };

  // Action click handlers — derived from status via getSOPAction
  const handleSOPActionClick = (sop: LocalSOP) => {
    const action = getSOPAction(sop.status, !!sop.racmId, false);
    switch (action.label) {
      case 'Start Processing':  handleStartProcessing(sop.id); break;
      case 'View Progress':     addToast({ message: `"${sop.name}" is currently being processed...`, type: 'info' }); break;
      case 'New RACM':          setShowCreateRacmForSopId(sop.id); break;
      case 'Edit RACM Draft':   if (sop.racmId && onViewRacm) onViewRacm(sop.racmId); break;
      case 'Configure RACM':    if (sop.racmId && onViewRacm) onViewRacm(sop.racmId); break;
      case 'View SOP':          setPreviewingSopId(sop.id); break;
    }
  };

  // If reviewing an SOP, render the extraction workspace inline
  if (reviewingSop) {
    return (
      <div>
        <ExtractionReviewWorkspace
          sop={reviewingSop}
          onBack={() => setReviewingSopId(null)}
          onAccept={(racmName) => handleCreateDraftRacm(reviewingSop.id, racmName)}
          onUpdateRisks={(risks) => handleUpdateRisks(reviewingSop.id, risks)}
          onUpdateControls={(controls) => handleUpdateControls(reviewingSop.id, controls)}
        />

        {/* Upload SOP Drawer (keep available even in review) */}
        <AnimatePresence>
          {showUploadDrawer && (
            <UploadSOPDrawer bpAbbr={bpAbbr} onClose={() => setShowUploadDrawer(false)}
              onUploadAndProcess={(data) => handleUploadIntent(data, true)} onSaveAsDraft={(data) => handleUploadIntent(data, false)} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Sort: latest version first (higher version number = first), then newest upload date
  const sortedSops = useMemo(() => {
    const sorted = [...localSops].sort((a, b) => {
      // Parse version numbers for comparison
      const parseVer = (v: string) => {
        const m = v.match(/v(\d+)\.(\d+)/);
        return m ? parseInt(m[1]) * 1000 + parseInt(m[2]) : 0;
      };
      const vDiff = parseVer(b.version) - parseVer(a.version);
      if (vDiff !== 0) return vDiff;
      // Newer uploads first (by id — newer IDs are larger timestamps)
      return b.id.localeCompare(a.id);
    });
    return sopStatusFilter.length > 0 ? sorted.filter(s => sopStatusFilter.includes(s.status)) : sorted;
  }, [localSops, sopStatusFilter]);

  const sopStatusOptions = useMemo(() => Array.from(new Set(localSops.map(s => s.status))).sort(), [localSops]);

  // Detail page takeover when ?sop= is in URL
  const detailSopFromUrl = detailSopId ? localSops.find(s => s.id === detailSopId) : null;
  if (detailSopFromUrl) {
    return (
      <SOPDetailPage
        sop={detailSopFromUrl}
        onBack={() => setDetailSopId(null)}
        onGoToRacm={onGoToRacm}
      />
    );
  }

  return (
    <div>
      {/* Empty state — only after loading settles so we don't flash it. */}
      {!isLoading && localSops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-[12px] bg-paper-100 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-ink-500" />
          </div>
          <h3 className="text-[15px] font-display text-ink-800 mb-1">No SOPs yet</h3>
          <p className="text-[13px] text-ink-600 mb-5 max-w-[320px]">Upload an SOP doc to map controls automatically.</p>
          <button type="button" onClick={() => setShowUploadDrawer(true)}
            className="px-4 py-2 rounded-[8px] bg-brand-600 text-paper-0 text-[13px] font-medium hover:bg-brand-700">
            New SOP
          </button>
        </div>
      ) : (
        <>
          {/* SOP Table — Workflow-table chrome, now with version, linked RACM, and extracted counts. */}
          <div className="border-t border-border-light overflow-x-auto min-h-[calc(100vh-280px)]">
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-white border-b border-border-light">
                  <tr>
                    {['SOP Name', 'Version', 'Linked to', 'Extracted', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">
                        {h === 'Status' ? (
                          <span className="inline-flex items-center gap-1">
                            Status
                            <ColumnFilter label="Status" options={sopStatusOptions} value={sopStatusFilter} onChange={setSopStatusFilter} />
                          </span>
                        ) : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    /* 5 skeleton rows during 400ms placeholder. Headers always render above. */
                    [...Array(5)].map((_, i) => (
                      <tr key={`skel-sop-${i}`} className="border-t border-border-light">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-4">
                            <div
                              className="h-3 bg-paper-100 rounded-[4px] animate-pulse"
                              style={{ width: `${60 + ((i + j) * 7) % 30}%` }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : sortedSops.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[12px] text-text-muted">
                        No SOPs match your filters.
                        <button
                          type="button"
                          onClick={() => setSopStatusFilter([])}
                          className="ml-2 text-brand-700 hover:text-brand-600 cursor-pointer font-medium"
                        >
                          Clear filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                  sortedSops.map((sop, i) => {
                    const isProcessing = sop.status === 'Processing';
                    const action = getSOPAction(sop.status, !!sop.racmId, false);
                    const showCounts = sop.status !== 'Draft' && sop.status !== 'Processing';
                    return (<React.Fragment key={sop.id}>
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                        onClick={() => setDetailSopId(sop.id)}
                        className={`border-t border-border-light transition-colors cursor-pointer ${sop.status === 'Archived' ? 'opacity-50' : 'hover:bg-surface-2/40'}`}>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="text-[13px] font-medium text-text leading-snug">{sop.name}</span>
                            <span className="text-[11px] text-ink-500">{sop.uploadedBy} · {sop.uploadedAt}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="font-mono text-[11px] text-ink-700 tabular-nums">{sop.version}</span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {sop.racmId ? (
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-[12px] text-ink-800 leading-snug truncate max-w-[200px]">{sop.racmName ?? sop.racmId}</span>
                              <span className="font-mono text-[10px] text-ink-400 tabular-nums">{sop.racmId}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-ink-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top">
                          {showCounts ? (
                            <span className="text-[12px] text-ink-700 leading-snug">
                              <span className="tabular-nums font-medium">{sop.risks}</span> risks
                              <span className="text-ink-300 mx-1">·</span>
                              <span className="tabular-nums font-medium">{sop.controls}</span> controls
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>
                            {isProcessing && <Loader2 size={9} className="animate-spin mr-1" />}
                            {sop.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => handleSOPActionClick(sop)}
                              className={`px-2 py-1 rounded-[8px] text-[10px] font-bold cursor-pointer transition-colors ${action.cls}`}>
                              {action.label}
                            </button>
                            {(sop.status === 'Processed' || sop.status === 'Linked') && (
                              <button type="button" onClick={() => setDetailSopId(sop.id)}
                                className="px-2 py-1 rounded-[8px] text-[10px] font-medium text-ink-500 hover:bg-paper-100 cursor-pointer transition-colors">
                                View SOP
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                      {/* Processing stepper */}
                      <AnimatePresence>
                        {isProcessing && (
                          <tr><td colSpan={6} className="p-0"><ProcessingStepperPanel sop={sop} /></td></tr>
                        )}
                      </AnimatePresence>
                      {/* Failed state */}
                      {sop.status === 'Draft' && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="px-4 py-3 bg-paper-50 border-t border-canvas-border">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-risk-700 flex-1">{sop.failureReason || 'An unexpected error occurred.'}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button type="button" onClick={() => handleStartProcessing(sop.id)} className="px-2.5 py-1 rounded-[8px] text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors">Retry</button>
                                  <button type="button" onClick={() => setShowUploadDrawer(true)} className="px-2.5 py-1 rounded-[8px] text-[10px] font-medium border border-canvas-border text-ink-500 hover:bg-paper-50 cursor-pointer transition-colors">Re-upload</button>
                                  <button type="button" onClick={() => { setLocalSops(prev => prev.map(s => s.id === sop.id ? { ...s, status: 'Archived' as SOPStatus } : s)); addToast({ message: `"${sop.name}" archived`, type: 'info' }); }}
                                    className="px-2.5 py-1 rounded-[8px] text-[10px] font-medium text-ink-400 hover:bg-paper-100 cursor-pointer transition-colors">Archive</button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>);
                  })
                  )}
                </tbody>
              </table>
          </div>
        </>
      )}

      {/* SOP Preview Drawer */}
      <AnimatePresence>
        {previewingSopId && (() => {
          const pSop = localSops.find(s => s.id === previewingSopId);
          return pSop ? <SOPPreviewDrawer sop={pSop} onClose={() => setPreviewingSopId(null)} onGoToRacm={pSop.racmId ? onGoToRacm : undefined} /> : null;
        })()}
      </AnimatePresence>

      {/* Upload SOP Drawer */}
      <AnimatePresence>
        {showUploadDrawer && (
          <UploadSOPDrawer
            bpAbbr={bpAbbr}
            onClose={() => setShowUploadDrawer(false)}
            onUploadAndProcess={(data) => handleUploadIntent(data, true)}
            onSaveAsDraft={(data) => handleUploadIntent(data, false)}
          />
        )}
      </AnimatePresence>

      {/* Create RACM Modal */}
      <AnimatePresence>
        {showCreateRacmForSopId && (() => {
          const targetSop = localSops.find(s => s.id === showCreateRacmForSopId);
          if (!targetSop) return null;
          return <CreateRacmFromSOPModal
            sopName={targetSop.name}
            bpAbbr={bpAbbr}
            onClose={() => setShowCreateRacmForSopId(null)}
            onCreate={(racmName, framework) => {
              const racmId = `racm-${Date.now()}`;
              setLocalSops(prev => prev.map(s => s.id === showCreateRacmForSopId ? {
                ...s, racmId, racmName,
              } : s));
              setShowCreateRacmForSopId(null);
              onRacmCreated?.(racmId, racmName, bpAbbr, framework);
              addToast({ message: `RACM "${racmName}" created. Open the RACM tab to start mapping.`, type: 'success' });
            }}
          />;
        })()}
      </AnimatePresence>

      {/* Version Conflict Modal */}
      <AnimatePresence>
        {versionConflict && (() => {
          const { existing } = versionConflict;
          const canReplace = existing.status === 'Draft';
          const isLinked = existing.status === 'Processed' && !!existing.racmId;
          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setVersionConflict(null)}>
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.2 }} className="bg-white rounded-[16px] shadow-2xl border border-canvas-border w-full max-w-[440px]" onClick={e => e.stopPropagation()}>

                  <div className="px-6 pt-5 pb-4 border-b border-canvas-border">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={16} className="text-mitigated-700" />
                      <h2 className="text-[16px] font-bold text-text">SOP already exists</h2>
                    </div>
                    <p className="text-[12px] text-text-muted">An SOP with this name already exists for this process.</p>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {/* Existing SOP info */}
                    <div className="rounded-[8px] border border-canvas-border bg-surface-2/30 px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-semibold text-text">{existing.name}</span>
                        <span className="text-[10px] font-mono text-ink-500 bg-paper-50 px-1 py-0.5 rounded-[4px]">{existing.version}</span>
                        <span className={`px-1.5 h-4 rounded-[4px] text-[10px] font-bold inline-flex items-center ${SOP_STATUS_STYLES[existing.status]}`}>{existing.status}</span>
                      </div>
                      <div className="text-[11px] text-ink-500">
                        {existing.uploadedBy} · {existing.uploadedAt}
                        {isLinked && <span className="ml-2 text-primary">Linked to {existing.racmId}</span>}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                      <button type="button" onClick={() => handleVersionConflictResolve('new-version')}
                        className="w-full text-left px-4 py-3 rounded-[8px] border border-canvas-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                        <div className="text-[12px] font-semibold text-text">Upload as new version</div>
                        <div className="text-[11px] text-ink-500 mt-0.5">Creates {existing.version.replace(/\d+$/, m => String(Number(m) + 1))} — keeps existing SOP and linked RACM intact.</div>
                      </button>

                      {canReplace ? (
                        <button type="button" onClick={() => handleVersionConflictResolve('replace')}
                          className="w-full text-left px-4 py-3 rounded-[8px] border border-canvas-border hover:border-mitigated hover:bg-mitigated-50/30 transition-all cursor-pointer">
                          <div className="text-[12px] font-semibold text-text">Replace existing draft</div>
                          <div className="text-[11px] text-ink-500 mt-0.5">Removes the {existing.status.toLowerCase()} SOP and uploads the new file in its place.</div>
                        </button>
                      ) : (
                        <div className="px-4 py-3 rounded-[8px] border border-canvas-border bg-paper-50 opacity-60">
                          <div className="text-[12px] font-medium text-ink-400">Replace existing</div>
                          <div className="text-[11px] text-ink-400 mt-0.5">Cannot replace — SOP is {existing.status.toLowerCase()}{isLinked ? ' and linked to a RACM' : ''}.</div>
                        </div>
                      )}

                      <button type="button" onClick={() => handleVersionConflictResolve('cancel')}
                        className="w-full text-left px-4 py-3 rounded-[8px] border border-canvas-border hover:bg-paper-50 transition-all cursor-pointer">
                        <div className="text-[12px] font-medium text-ink-500">Cancel</div>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ─── Control Design Tab ──────────────────────────────────────────────────────

interface BoundWorkflow { name: string; type: 'Automated' | 'Manual'; status: 'Ready' | 'Draft' | 'Completed'; lastRun: string; runs: number; }
interface DesignControl {
  id: string; name: string; description: string; classification: 'Key' | 'Non-Key';
  nature: string; automation: string; frequency: string;
  mappedRisks: string[]; workflows: BoundWorkflow[];
  usedInRACMs: number; assertions: string[];
}

const SEED_DESIGN_CONTROLS: DesignControl[] = [
  { id: 'C-001', name: 'Three-Way PO/GRN/Invoice Matching', description: 'System-enforced three-way matching before payment release.', classification: 'Key', nature: 'Preventive', automation: 'Automated', frequency: 'Per transaction', mappedRisks: ['RSK-001', 'RSK-002'], workflows: [
    { name: 'PO Validation Workflow', type: 'Automated', status: 'Completed', lastRun: 'Apr 28, 2026', runs: 14 },
    { name: 'GRN Matching Workflow', type: 'Automated', status: 'Completed', lastRun: 'Apr 28, 2026', runs: 12 },
    { name: 'Invoice Match Workflow', type: 'Automated', status: 'Ready', lastRun: 'Apr 26, 2026', runs: 10 },
  ], usedInRACMs: 4, assertions: ['Completeness', 'Accuracy', 'Authorization'] },
  { id: 'C-002', name: 'Vendor Master Change Approval', description: 'Multi-level approval for vendor master data changes.', classification: 'Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', mappedRisks: ['RSK-003', 'RSK-004'], workflows: [
    { name: 'Vendor Change Monitor', type: 'Automated', status: 'Ready', lastRun: 'Apr 20, 2026', runs: 8 },
  ], usedInRACMs: 2, assertions: ['Authorization', 'Occurrence'] },
  { id: 'C-003', name: 'Duplicate Invoice Detection', description: 'Automated scanning to flag potential duplicate invoices.', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Per transaction', mappedRisks: ['RSK-002'], workflows: [
    { name: 'Duplicate Invoice Detector', type: 'Automated', status: 'Completed', lastRun: 'Apr 26, 2026', runs: 12 },
    { name: 'Invoice Reconciliation Check', type: 'Manual', status: 'Draft', lastRun: '—', runs: 0 },
  ], usedInRACMs: 3, assertions: ['Accuracy', 'Occurrence'] },
  { id: 'C-004', name: 'High-Value Payment Review', description: 'Additional approval for payments above threshold.', classification: 'Key', nature: 'Preventive', automation: 'IT-dependent', frequency: 'Per transaction', mappedRisks: ['RSK-001'], workflows: [
    { name: 'Payment Approval Review', type: 'Manual', status: 'Ready', lastRun: 'Apr 10, 2026', runs: 3 },
  ], usedInRACMs: 2, assertions: ['Authorization', 'Accuracy'] },
  { id: 'C-014', name: 'Purchase Order Dual Sign-Off', description: 'Dual authorization for all POs above threshold.', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', mappedRisks: ['RSK-005'], workflows: [], usedInRACMs: 1, assertions: ['Authorization'] },
];

// ─── Control Detail Page (Step 4) ────────────────────────────────────────
function ControlDetailPage({ ctrl, bpAbbr, onBack, onGoToRacm }: {
  ctrl: DesignControl;
  bpAbbr: string;
  onBack: () => void;
  onGoToRacm?: () => void;
}) {
  const bp = BUSINESS_PROCESSES.find(b => b.abbr === bpAbbr);
  const risks = bp ? RISKS.filter(r => ctrl.mappedRisks.includes(r.id) && r.bpId === bp.id) : RISKS.filter(r => ctrl.mappedRisks.includes(r.id));
  const racms = bp ? RACMS.filter(r => r.bpId === bp.id) : [];

  const fields = [
    { label: 'Classification', value: ctrl.classification },
    { label: 'Nature', value: ctrl.nature },
    { label: 'Automation', value: ctrl.automation },
    { label: 'Frequency', value: ctrl.frequency },
    { label: 'Assertions', value: ctrl.assertions.length > 0 ? ctrl.assertions.join(', ') : '—' },
    { label: 'Used in RACMs', value: String(ctrl.usedInRACMs), mono: true },
  ];

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[12px] text-ink-500 hover:text-primary tracking-tight transition-colors cursor-pointer inline-flex items-center gap-1.5"
      >
        <ArrowLeft size={12} />Back to Controls
      </button>

      <div className="bg-white border border-canvas-border rounded-[12px] p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${ctrl.classification === 'Key' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-paper-100 text-ink-500'}`}>{ctrl.classification}</span>
              <span className="font-mono text-[11px] text-ink-500">{ctrl.id}</span>
            </div>
            <h1 className="font-display text-[26px] font-[420] tracking-tight text-ink-900 leading-[1.2]">{ctrl.name}</h1>
          </div>
          {onGoToRacm && (
            <button
              type="button"
              onClick={onGoToRacm}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer"
            >
              Map in RACM<ArrowRight size={13} />
            </button>
          )}
        </div>

        <p className="text-[13px] text-text leading-relaxed mb-5 max-w-3xl">{ctrl.description}</p>

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-canvas-border/70">
          {fields.map(f => (
            <div key={f.label}>
              <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-0.5">{f.label}</span>
              <span className={`text-[13px] block ${f.mono ? 'font-mono text-ink-700' : 'text-text'}`}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-ink-500" />
              Mapped Risks
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{risks.length}</span>
          </div>
          {risks.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No risks mapped yet.</p>
          ) : (
            <ul className="space-y-2">
              {risks.map(r => (
                <li key={r.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{r.id}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{r.name}</span>
                      <span className="text-[11px] text-ink-500 leading-snug block">Severity: {r.severity} · Status: {r.status}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <Workflow size={13} className="text-ink-500" />
              Linked Workflows
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{ctrl.workflows.length}</span>
          </div>
          {ctrl.workflows.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No workflows linked.</p>
          ) : (
            <ul className="space-y-2">
              {ctrl.workflows.map((w, i) => (
                <li key={i} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12.5px] text-ink-800 font-medium leading-snug truncate flex-1">{w.name}</span>
                    <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{w.runs} runs</span>
                  </div>
                  <span className="text-[11px] text-ink-500 leading-snug">Type: {w.type} · Status: {w.status} · Last run: {w.lastRun}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <Grid3x3 size={13} className="text-ink-500" />
              Found in RACMs
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{ctrl.usedInRACMs}</span>
          </div>
          {racms.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">Not part of any RACM.</p>
          ) : (
            <ul className="space-y-2">
              {racms.map(r => (
                <li key={r.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12.5px] text-ink-800 font-medium leading-snug truncate flex-1">{r.name}</span>
                    <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{r.fw}</span>
                  </div>
                  <span className="text-[11px] text-ink-500 leading-snug">Owner: {r.owner}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ControlDesignTab({ bpAbbr, seeded, onGoToRacm }: { bpAbbr: string; seeded: boolean; onGoToRacm?: () => void }) {
  const { addToast } = useToast();
  const [controls, setControls] = useState<DesignControl[]>(seeded ? SEED_DESIGN_CONTROLS : []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<string[]>([]);
  const [natureFilter, setNatureFilter] = useState<string[]>([]);
  const [designStatusFilter, setDesignStatusFilter] = useState<string[]>([]);
  const [detailControlId, setDetailControlId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('control');
  });

  // URL sync — ?control=C-001
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get('control');
    if (detailControlId && current !== detailControlId) {
      params.set('control', detailControlId);
      window.history.pushState({ ...window.history.state, control: detailControlId }, '', `?${params.toString()}`);
    } else if (!detailControlId && current) {
      params.delete('control');
      const qs = params.toString();
      window.history.pushState({ ...window.history.state, control: null }, '', qs ? `?${qs}` : window.location.pathname);
    }
  }, [detailControlId]);

  useEffect(() => {
    const onPop = () => {
      const param = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('control') : null;
      setDetailControlId(param);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Skeleton state — 400ms placeholder before first paint of the controls grid.
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const getDesignStatus = (ctrl: DesignControl): 'Complete' | 'Incomplete' => {
    return ctrl.workflows.length > 0 && ctrl.mappedRisks.length > 0 ? 'Complete' : 'Incomplete';
  };

  const filteredControls = controls.filter(c => {
    if (classificationFilter.length > 0 && !classificationFilter.includes(c.classification)) return false;
    if (natureFilter.length > 0 && !natureFilter.includes(c.nature)) return false;
    if (designStatusFilter.length > 0 && !designStatusFilter.includes(getDesignStatus(c))) return false;
    return true;
  });
  const classificationOptions = Array.from(new Set(controls.map(c => c.classification))).sort();
  const natureOptions = Array.from(new Set(controls.map(c => c.nature))).sort();
  const designStatusOptions = ['Complete', 'Incomplete'];

  // Bulk select + bulk archive (in-memory archive — removes from list, no API).
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const allVisibleIds = filteredControls.map(c => c.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedControlIds.includes(id));
  const someSelected = selectedControlIds.length > 0 && !allSelected;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedControlIds([]);
    else setSelectedControlIds(allVisibleIds);
  };
  const toggleSelectOne = (id: string) => {
    setSelectedControlIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleArchiveOne = (id: string) => {
    setControls(prev => prev.filter(c => c.id !== id));
    setSelectedControlIds(prev => prev.filter(s => s !== id));
    addToast({ message: `Control archived`, type: 'success' });
  };
  const handleCancelOne = (id: string) => {
    setSelectedControlIds(prev => prev.filter(s => s !== id));
  };

  const handleCreateWorkflow = (ctrl: DesignControl) => {
    addToast({ message: `Opening Ask IRA to create workflow for "${ctrl.name}" (${ctrl.id})`, type: 'info' });
  };

  // Detail page takeover when ?control= is in URL
  const detailControlFromUrl = detailControlId ? controls.find(c => c.id === detailControlId) : null;
  if (detailControlFromUrl) {
    return (
      <ControlDetailPage
        ctrl={detailControlFromUrl}
        bpAbbr={bpAbbr}
        onBack={() => setDetailControlId(null)}
        onGoToRacm={onGoToRacm}
      />
    );
  }

  if (!isLoading && controls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-[12px] bg-paper-100 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-ink-500" />
        </div>
        <h3 className="text-[15px] font-display text-ink-800 mb-1">No controls yet</h3>
        <p className="text-[13px] text-ink-600 mb-5 max-w-[320px]">Controls live inside a RACM. Open RACM to map risks to controls — they'll appear here.</p>
        {onGoToRacm && (
          <button
            type="button"
            onClick={onGoToRacm}
            className="px-4 py-2 rounded-[8px] bg-brand-600 text-paper-0 text-[13px] font-medium hover:bg-brand-700">
            Go to RACM
          </button>
        )}
      </div>
    );
  }

  const incompleteCount = controls.filter(c => getDesignStatus(c) === 'Incomplete').length;

  return (
    <div className="space-y-4">

      {/* "Map controls in RACM" link moved to per-row Actions cell, beside View. */}

      <div className="border-t border-border-light overflow-x-auto min-h-[calc(100vh-280px)]">
        <table className="w-full border-collapse text-[12px]">
          <thead className="bg-white border-b border-border-light">
            <tr>
              {/* Select-all checkbox — first column. */}
              <th className="pl-4 pr-2 py-3 w-[44px]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded-[4px] border-canvas-border accent-primary cursor-pointer"
                  aria-label="Select all controls"
                />
              </th>
              {([
                { label: 'Control' },
                { label: 'Classification', tip: 'Marked as Key for SOX or regulatory reporting; Non-Key is supportive but not externally tested.', filter: 'classification' as const },
                { label: 'Nature', filter: 'nature' as const },
                { label: 'Workflows' },
                { label: 'Mapped Risks' },
                { label: 'RACMs' },
                { label: 'Design Status', tip: 'Whether the control has both linked workflows and mapped risks. Incomplete controls cannot be tested.', filter: 'designStatus' as const },
                { label: '' },
              ] as { label: string; tip?: string; filter?: 'classification' | 'nature' | 'designStatus' }[]).map(h => (
                <th key={h.label || 'act'} className="px-4 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {h.tip ? (
                      <span className="inline-flex items-center gap-1 group/tip relative">
                        {h.label}
                        <HelpCircle className="w-3 h-3 text-ink-400" aria-label={`What is ${h.label}?`} />
                        <span className="absolute top-full left-0 mt-1 w-[220px] p-2.5 rounded-[8px] bg-ink-800 text-paper-0 text-[12px] font-normal normal-case tracking-normal leading-snug opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
                          {h.tip}
                        </span>
                      </span>
                    ) : h.label}
                    {h.filter === 'classification' && (
                      <ColumnFilter label="Classification" options={classificationOptions} value={classificationFilter} onChange={setClassificationFilter} />
                    )}
                    {h.filter === 'nature' && (
                      <ColumnFilter label="Nature" options={natureOptions} value={natureFilter} onChange={setNatureFilter} />
                    )}
                    {h.filter === 'designStatus' && (
                      <ColumnFilter label="Design Status" options={designStatusOptions} value={designStatusFilter} onChange={setDesignStatusFilter} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              /* 5 skeleton rows — column count is 9 (1 checkbox + 8 data cols). */
              [...Array(5)].map((_, i) => (
                <tr key={`skel-ctrl-${i}`} className="border-t border-border-light">
                  {[...Array(9)].map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <div
                        className="h-3 bg-paper-100 rounded-[4px] animate-pulse"
                        style={{ width: `${60 + ((i + j) * 7) % 30}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredControls.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[12px] text-text-muted">
                  No controls match your filters.
                  <button
                    type="button"
                    onClick={() => { setClassificationFilter([]); setNatureFilter([]); setDesignStatusFilter([]); }}
                    className="ml-2 text-brand-700 hover:text-brand-600 cursor-pointer font-medium"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
            filteredControls.map((ctrl, i) => {
              const isExpanded = expandedId === ctrl.id;
              const hasBound = ctrl.workflows.length > 0;
              return (
                <React.Fragment key={ctrl.id}>
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                    className={`border-t border-border-light hover:bg-surface-2/40 transition-colors cursor-pointer ${selectedControlIds.includes(ctrl.id) ? 'bg-brand-50/50' : ''}`} onClick={() => setDetailControlId(ctrl.id)}>
                    {/* Per-row checkbox — stopPropagation so it doesn't toggle the row expand. */}
                    <td className="pl-4 pr-2 py-4 align-top" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedControlIds.includes(ctrl.id)}
                        onChange={() => toggleSelectOne(ctrl.id)}
                        className="w-4 h-4 rounded-[4px] border-canvas-border accent-primary cursor-pointer"
                        aria-label={`Select ${ctrl.name}`}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-text leading-snug">{ctrl.name}</span>
                        <span className="font-mono text-[11px] text-ink-500 tracking-tight">{ctrl.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`px-1.5 h-4 rounded-[4px] text-[10px] font-bold inline-flex items-center ${ctrl.classification === 'Key' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-paper-100 text-ink-500'}`}>{ctrl.classification}</span>
                    </td>
                    <td className="px-4 py-4 align-top"><span className="text-[11px] text-ink-500">{ctrl.nature}</span></td>
                    <td className="px-4 py-4 align-top">
                      {ctrl.workflows.length === 0 ? (
                        <span className="text-[11px] text-mitigated-700 font-medium">No workflow mapped</span>
                      ) : ctrl.workflows.length === 1 ? (
                        <span className="text-[11px] text-compliant-700 font-medium">{ctrl.workflows[0].name}</span>
                      ) : ctrl.workflows.length <= 2 ? (
                        <div className="flex flex-wrap gap-1">
                          {ctrl.workflows.map((w, wi) => (<span key={wi} className="px-1.5 h-4 rounded-[4px] text-[10px] font-medium bg-compliant-50 text-compliant-700">{w.name.length > 15 ? w.name.slice(0, 14) + '…' : w.name}</span>))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {ctrl.workflows.slice(0, 2).map((w, wi) => (<span key={wi} className="px-1.5 h-4 rounded-[4px] text-[10px] font-medium bg-compliant-50 text-compliant-700">{w.name.length > 12 ? w.name.slice(0, 11) + '…' : w.name}</span>))}
                          <span className="px-1.5 h-4 rounded-[4px] text-[10px] font-medium bg-paper-100 text-ink-500">+{ctrl.workflows.length - 2}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top"><span className="text-[12px] text-text tabular-nums">{ctrl.mappedRisks.length}</span></td>
                    <td className="px-4 py-4 align-top"><span className="text-[12px] text-text tabular-nums">{ctrl.usedInRACMs}</span></td>
                    <td className="px-4 py-4 align-top">
                      {(() => { const ds = getDesignStatus(ctrl); return <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${ds === 'Complete' ? 'bg-compliant-50 text-compliant-700' : 'bg-mitigated-50 text-mitigated-700'}`}>{ds}</span>; })()}
                    </td>
                    <td className="px-4 py-4 align-top text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        {selectedControlIds.includes(ctrl.id) ? (
                          <>
                            <button type="button"
                              onClick={() => handleArchiveOne(ctrl.id)}
                              className="px-2 py-1 rounded-[4px] text-[10px] font-medium inline-flex items-center gap-1 bg-paper-0 border border-ink-200 text-ink-800 hover:bg-paper-50 cursor-pointer transition-colors">
                              <Archive size={10} />Archive
                            </button>
                            <button type="button"
                              onClick={() => handleCancelOne(ctrl.id)}
                              className="px-2 py-1 rounded-[4px] text-[10px] font-medium text-ink-600 hover:bg-paper-100 cursor-pointer transition-colors">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {ctrl.workflows.length === 0 && <button type="button" onClick={() => handleCreateWorkflow(ctrl)} className="px-2 py-1 rounded-[4px] text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer">New Workflow</button>}
                            <button type="button" onClick={() => setDetailControlId(ctrl.id)} className="px-2 py-1 rounded-[4px] text-[10px] font-bold bg-paper-100 text-ink-600 hover:bg-paper-200 cursor-pointer">View</button>
                            {onGoToRacm && (
                              <button type="button" onClick={onGoToRacm}
                                className="px-2 py-1 rounded-[4px] text-[10px] font-medium text-brand-700 hover:bg-brand-50 inline-flex items-center gap-0.5 cursor-pointer transition-colors">
                                Map in RACM
                                <ChevronRight size={10} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <div className="px-5 py-4 bg-surface-2/20 border-t border-canvas-border space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div><span className="text-[10px] text-ink-400 uppercase block">Description</span><p className="text-[11px] text-text mt-0.5">{ctrl.description}</p></div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-[10px] text-ink-400 uppercase block">Automation</span><p className="text-[11px] text-text">{ctrl.automation}</p></div>
                              <div><span className="text-[10px] text-ink-400 uppercase block">Frequency</span><p className="text-[11px] text-text">{ctrl.frequency}</p></div>
                            </div>
                          </div>
                          {ctrl.assertions.length > 0 && (
                            <div><span className="text-[10px] text-ink-400 uppercase block mb-1">Assertions</span>
                              <div className="flex flex-wrap gap-1">{ctrl.assertions.map(a => (<span key={a} className="px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-paper-50 text-ink-600 border border-canvas-border">{a}</span>))}</div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div><span className="text-[10px] text-ink-400 uppercase block mb-1">Linked Risks</span>
                              {ctrl.mappedRisks.length > 0 ? ctrl.mappedRisks.map(r => (<div key={r} className="text-[10px] font-mono text-ink-500">{r}</div>)) : <span className="text-[10px] text-ink-300">None</span>}
                            </div>
                            <div><span className="text-[10px] text-ink-400 uppercase block mb-1">Used in RACMs</span>
                              <span className="text-[10px] text-text">{ctrl.usedInRACMs} RACM{ctrl.usedInRACMs !== 1 ? 's' : ''}</span>
                            </div>
                          </div>

                          {/* Workflow bindings detail */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-ink-400 uppercase font-bold">Workflows ({ctrl.workflows.length})</span>
                              <button type="button" onClick={e => { e.stopPropagation(); handleCreateWorkflow(ctrl); }} className="text-[10px] font-semibold text-primary hover:underline cursor-pointer">+ New Workflow</button>
                            </div>
                            {ctrl.workflows.length === 0 ? (
                              <div className="text-[10px] text-mitigated-700 py-2">No workflows mapped. Add a new workflow to enable testing.</div>
                            ) : (
                              <div className="bg-white rounded-lg border border-canvas-border overflow-hidden">
                                <table className="w-full text-[11px]">
                                  <thead><tr className="border-b border-canvas-border bg-paper-50">
                                    <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-ink-400 uppercase">Workflow</th>
                                    <th className="px-3 py-1.5 text-center text-[10px] font-semibold text-ink-400 uppercase">Type</th>
                                    <th className="px-3 py-1.5 text-center text-[10px] font-semibold text-ink-400 uppercase">Status</th>
                                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-ink-400 uppercase">Runs</th>
                                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-ink-400 uppercase">Last Run</th>
                                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-ink-400 uppercase">Actions</th>
                                  </tr></thead>
                                  <tbody>{ctrl.workflows.map((w, wi) => (
                                    <tr key={wi} className="border-b border-canvas-border">
                                      <td className="px-3 py-1.5 text-text font-medium">{w.name}</td>
                                      <td className="px-3 py-1.5 text-center"><span className={`px-1.5 h-4 rounded-[4px] text-[10px] font-bold inline-flex items-center ${w.type === 'Automated' ? 'bg-evidence-50 text-evidence-700' : 'bg-paper-100 text-ink-600'}`}>{w.type}</span></td>
                                      <td className="px-3 py-1.5 text-center"><span className={`px-1.5 h-4 rounded-[4px] text-[10px] font-bold inline-flex items-center ${w.status === 'Completed' ? 'bg-compliant-50 text-compliant-700' : w.status === 'Ready' ? 'bg-compliant-50 text-compliant-700' : 'bg-paper-100 text-ink-500'}`}>{w.status}</span></td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-ink-500">{w.runs}</td>
                                      <td className="px-3 py-1.5 text-right text-ink-400">{w.lastRun}</td>
                                      <td className="px-3 py-1.5 text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                          <button type="button" onClick={e => { e.stopPropagation(); addToast({ message: `Viewing "${w.name}"`, type: 'info' }); }} className="text-[10px] font-medium text-primary hover:underline cursor-pointer">View</button>
                                          {w.type === 'Automated' && <button type="button" onClick={e => { e.stopPropagation(); addToast({ message: `Running "${w.name}"...`, type: 'info' }); }} className="text-[10px] font-medium text-primary hover:underline cursor-pointer">Run</button>}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}</tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Workflow Cockpit Tab ────────────────────────────────────────────────────

// ─── Workflow Types for BP-scoped view ─────────────────────────────────────
interface BPWorkflow {
  id: string; name: string; description: string;
  type: 'Automated' | 'Manual';
  nature: 'Preventive' | 'Detective';
  status: 'Draft' | 'Ready' | 'Active' | 'Archived';
  linkedControls: string[]; // control IDs
}

const SEED_BP_WF: BPWorkflow[] = [
  { id: 'wf-c1', name: 'Three-Way PO Match', description: 'Automated matching of PO, GRN, and Invoice before payment release.', type: 'Automated', nature: 'Preventive', status: 'Active', linkedControls: ['C-001', 'C-006'] },
  { id: 'wf-c2', name: 'Vendor Change Monitor', description: 'Monitors vendor master data changes and validates approval chain.', type: 'Automated', nature: 'Detective', status: 'Active', linkedControls: ['C-002'] },
  { id: 'wf-c3', name: 'Duplicate Invoice Detector', description: 'Scans invoices against historical data to flag duplicates.', type: 'Automated', nature: 'Detective', status: 'Active', linkedControls: ['C-003'] },
  { id: 'wf-c4', name: 'Payment Approval Review', description: 'Manual review of high-value payment approvals.', type: 'Manual', nature: 'Preventive', status: 'Active', linkedControls: ['C-004'] },
  { id: 'wf-c5', name: 'PO Dual Sign-Off Check', description: 'Validates dual authorization for purchase orders above threshold.', type: 'Automated', nature: 'Preventive', status: 'Draft', linkedControls: [] },
];

// ─── Workflow Detail Page (Step 4) ──────────────────────────────────────
function WorkflowDetailPage({ wf, bpAbbr, allControls, onBack, onOpenWorkflowDetail }: {
  wf: BPWorkflow;
  bpAbbr: string;
  allControls: DesignControl[];
  onBack: () => void;
  onOpenWorkflowDetail?: (workflowId: string) => void;
}) {
  const linkedControls = allControls.filter(c => wf.linkedControls.includes(c.id));
  const linkedRiskIds = new Set(linkedControls.flatMap(c => c.mappedRisks));
  const bp = BUSINESS_PROCESSES.find(b => b.abbr === bpAbbr);
  const risks = RISKS.filter(r => linkedRiskIds.has(r.id) && (!bp || r.bpId === bp.id));
  const racms = bp ? RACMS.filter(r => r.bpId === bp.id) : [];

  const statusStyle =
    wf.status === 'Active' ? 'bg-compliant-50 text-compliant-700' :
    wf.status === 'Ready' ? 'bg-evidence-50 text-evidence-700' :
    wf.status === 'Draft' ? 'bg-paper-100 text-ink-600' : 'bg-paper-100 text-ink-400';

  const fields = [
    { label: 'Type', value: wf.type },
    { label: 'Nature', value: wf.nature },
    { label: 'Status', value: wf.status, pill: true },
    { label: 'Business Process', value: bpAbbr },
  ];

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[12px] text-ink-500 hover:text-primary tracking-tight transition-colors cursor-pointer inline-flex items-center gap-1.5"
      >
        <ArrowLeft size={12} />Back to Workflows
      </button>

      <div className="bg-white border border-canvas-border rounded-[12px] p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${statusStyle}`}>{wf.status}</span>
              <span className="font-mono text-[11px] text-ink-500">{wf.id}</span>
            </div>
            <h1 className="font-display text-[26px] font-[420] tracking-tight text-ink-900 leading-[1.2]">{wf.name}</h1>
          </div>
          {onOpenWorkflowDetail && (
            <button
              type="button"
              onClick={() => onOpenWorkflowDetail(wf.id)}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer"
            >
              Open in Workflow Library<ArrowRight size={13} />
            </button>
          )}
        </div>

        <p className="text-[13px] text-text leading-relaxed mb-5 max-w-3xl">{wf.description}</p>

        <div className="grid grid-cols-4 gap-x-6 gap-y-4 pt-4 border-t border-canvas-border/70">
          {fields.map(f => (
            <div key={f.label}>
              <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-0.5">{f.label}</span>
              {f.pill ? (
                <span className={`mt-0.5 px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${statusStyle}`}>{wf.status}</span>
              ) : (
                <span className="text-[13px] block text-text">{f.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <Shield size={13} className="text-ink-500" />
              Controls using this workflow
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{linkedControls.length}</span>
          </div>
          {linkedControls.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">Not used by any control yet.</p>
          ) : (
            <ul className="space-y-2">
              {linkedControls.map(c => (
                <li key={c.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{c.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{c.name}</span>
                        {c.classification === 'Key' && <span className="px-1.5 h-4 rounded-[4px] text-[9px] font-bold inline-flex items-center bg-mitigated-50 text-mitigated-700 shrink-0">Key</span>}
                      </div>
                      <span className="text-[11px] text-ink-500 leading-snug">{c.nature} · {c.automation}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-ink-500" />
              Risks covered (via controls)
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{risks.length}</span>
          </div>
          {risks.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No risks covered yet.</p>
          ) : (
            <ul className="space-y-2">
              {risks.map(r => (
                <li key={r.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{r.id}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{r.name}</span>
                      <span className="text-[11px] text-ink-500 leading-snug block">Severity: {r.severity}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <Grid3x3 size={13} className="text-ink-500" />
              RACMs in this process
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{racms.length}</span>
          </div>
          {racms.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No RACMs in this process.</p>
          ) : (
            <ul className="space-y-2">
              {racms.map(r => (
                <li key={r.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12.5px] text-ink-800 font-medium leading-snug truncate flex-1">{r.name}</span>
                    <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{r.fw}</span>
                  </div>
                  <span className="text-[11px] text-ink-500 leading-snug">Owner: {r.owner}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowGovernanceTab({ bpAbbr, seeded, onOpenWorkflowDetail }: { bpAbbr: string; seeded: boolean; onOpenWorkflowDetail?: (workflowId: string) => void }) {
  const { addToast } = useToast();
  const [workflows, setWorkflows] = useState<BPWorkflow[]>(seeded ? SEED_BP_WF : []);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [usageFilter, setUsageFilter] = useState<'All' | 'Used' | 'Unused'>('All');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [showLinkedControls, setShowLinkedControls] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('workflow');
  });

  // URL sync — ?workflow=wf-c1
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get('workflow');
    if (detailWorkflowId && current !== detailWorkflowId) {
      params.set('workflow', detailWorkflowId);
      window.history.pushState({ ...window.history.state, workflow: detailWorkflowId }, '', `?${params.toString()}`);
    } else if (!detailWorkflowId && current) {
      params.delete('workflow');
      const qs = params.toString();
      window.history.pushState({ ...window.history.state, workflow: null }, '', qs ? `?${qs}` : window.location.pathname);
    }
  }, [detailWorkflowId]);

  useEffect(() => {
    const onPop = () => {
      const param = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('workflow') : null;
      setDetailWorkflowId(param);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Skeleton state — 400ms placeholder so workflow list doesn't flash empty.
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  // Listen for header-level "Create new Workflow" trigger.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: string }>;
      if (ce.detail?.section === 'workflows') setShowCreateDrawer(true);
    };
    window.addEventListener('process-hub-create', handler);
    return () => window.removeEventListener('process-hub-create', handler);
  }, []);

  const searched = search.trim() ? workflows.filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase())) : workflows;
  const usageScoped = usageFilter === 'All' ? searched
    : usageFilter === 'Used' ? searched.filter(w => w.linkedControls.length > 0)
    : searched.filter(w => w.linkedControls.length === 0);
  const filtered = typeFilter.length > 0
    ? usageScoped.filter(w => typeFilter.includes(w.type) || typeFilter.includes(w.nature))
    : usageScoped;
  const typeOptions = [
    ...Array.from(new Set(workflows.map(w => w.type))).sort(),
    ...Array.from(new Set(workflows.map(w => w.nature))).sort(),
  ];

  const usedCount = workflows.filter(w => w.linkedControls.length > 0).length;
  const unusedCount = workflows.filter(w => w.linkedControls.length === 0).length;

  const handleDelete = (id: string) => {
    const idx = workflows.findIndex(w => w.id === id);
    if (idx === -1) return;
    const wf = workflows[idx];
    setWorkflows(prev => prev.filter(w => w.id !== id));
    addToast({
      message: `Workflow "${wf.name}" deleted.`,
      type: 'info',
      action: {
        label: 'Undo',
        onClick: () => setWorkflows(prev => {
          const next = [...prev];
          next.splice(Math.min(idx, next.length), 0, wf);
          return next;
        }),
      },
    });
  };

  const handleCreate = (data: { name: string; type: 'Automated' | 'Manual'; nature: 'Preventive' | 'Detective'; desc: string }) => {
    setWorkflows(prev => [{ id: `wf-${Date.now()}`, name: data.name, description: data.desc, type: data.type, nature: data.nature, status: 'Draft', linkedControls: [] }, ...prev]);
    setShowCreateDrawer(false);
    addToast({ message: `Workflow "${data.name}" created.`, type: 'success' });
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allVisibleSelected = filtered.length > 0 && filtered.every(w => selectedIds.has(w.id));
  const someVisibleSelected = filtered.some(w => selectedIds.has(w.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(w => w.id)));
  };

  const handleBulkRun = () => {
    const selected = workflows.filter(w => selectedIds.has(w.id));
    const runnable = selected.filter(w => w.type === 'Automated' && w.status === 'Active');
    const skipped = selected.length - runnable.length;
    if (runnable.length === 0) { addToast({ message: 'No runnable workflows selected. Only Live + Automated workflows can be run.', type: 'warning' }); return; }
    runnable.forEach(w => addToast({ message: `Running "${w.name}"...`, type: 'info' }));
    if (skipped > 0) addToast({ message: `${skipped} workflow${skipped !== 1 ? 's' : ''} skipped (manual or draft).`, type: 'info' });
    setBulkMode(false); setSelectedIds(new Set());
  };

  // Detail page takeover when ?workflow= is in URL
  const detailWorkflowFromUrl = detailWorkflowId ? workflows.find(w => w.id === detailWorkflowId) : null;
  if (detailWorkflowFromUrl) {
    return (
      <WorkflowDetailPage
        wf={detailWorkflowFromUrl}
        bpAbbr={bpAbbr}
        allControls={SEED_DESIGN_CONTROLS}
        onBack={() => setDetailWorkflowId(null)}
        onOpenWorkflowDetail={onOpenWorkflowDetail}
      />
    );
  }

  if (!isLoading && workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-[12px] bg-paper-100 flex items-center justify-center mb-4">
          <Workflow className="w-6 h-6 text-ink-500" />
        </div>
        <h3 className="text-[15px] font-display text-ink-800 mb-1">No workflows yet</h3>
        <p className="text-[13px] text-ink-600 mb-5 max-w-[320px]">Connect approval steps and evidence collection.</p>
        <button type="button" onClick={() => setShowCreateDrawer(true)}
          className="px-4 py-2 rounded-[8px] bg-brand-600 text-paper-0 text-[13px] font-medium hover:bg-brand-700">
          New Workflow
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search + Filters + CTA */}
      <div className="flex items-center gap-3">
        <div className="relative w-[320px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflow..."
            className="w-full pl-10 pr-4 h-10 rounded-[6px] border border-border bg-white text-[13px] outline-none focus:border-primary/40 transition-all" />
        </div>
        <div className="flex items-center gap-1.5">
          {([
            { id: 'All' as const, label: 'All', count: workflows.length },
            { id: 'Used' as const, label: 'Used', count: usedCount },
            { id: 'Unused' as const, label: 'Unused', count: unusedCount },
          ]).map(f => (
            <button type="button" key={f.id} onClick={() => setUsageFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-all ${usageFilter === f.id ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10'}`}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {bulkMode ? (
            <>
              <span className="text-[13px] text-text-secondary"><span className="font-semibold text-text">{selectedIds.size}</span> selected</span>
              <button type="button" onClick={handleBulkRun} disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 h-10 rounded-[6px] bg-primary text-white text-[13px] font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <Play size={14} />Run Selected
              </button>
              <button type="button" onClick={() => { setBulkMode(false); setSelectedIds(new Set()); }}
                className="flex items-center gap-2 px-4 h-10 rounded-[6px] bg-white text-text border border-border text-[13px] font-semibold hover:bg-surface-2 transition-colors cursor-pointer">
                Cancel
              </button>
            </>
          ) : (
            <>
              {/* "New Workflow" CTA moved to the Process Hub drilled-view header. */}
              <button type="button" onClick={() => setBulkMode(true)}
                className="flex items-center gap-2 px-4 h-10 rounded-[6px] bg-white text-text border border-border text-[13px] font-semibold transition-colors cursor-pointer hover:bg-[#6a12cd] hover:text-white hover:border-[#6a12cd]">
                <Play size={14} />Bulk Run
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {!isLoading && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-[12px] bg-paper-100 flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-ink-500" />
          </div>
          <h3 className="text-[15px] font-display text-ink-800 mb-1">No matching workflows</h3>
          <p className="text-[13px] text-ink-600 mb-5 max-w-[320px]">
            Nothing matched <span className="font-mono">"{search || usageFilter}"</span>{typeFilter.length > 0 ? <> with Type <span className="font-mono">{typeFilter.join(', ')}</span></> : null}. Try a different search or filter.
          </p>
        </div>
      ) : (
        <div className="border-t border-border-light min-h-[calc(100vh-280px)]">
          <table className="w-full border-collapse">
            <thead className="bg-white sticky top-0 z-10 border-b border-border-light">
              <tr>
                {bulkMode && (
                  <th className="pl-4 pr-2 py-3 w-[44px]">
                    <input type="checkbox" checked={allVisibleSelected} ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                      onChange={toggleSelectAll} className="w-4 h-4 rounded-[4px] border-canvas-border accent-primary cursor-pointer" aria-label="Select all" />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[280px]">Workflow Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Description</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[160px]">
                  <span className="inline-flex items-center gap-1">
                    Type
                    <ColumnFilter label="Type" options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[150px]">Usage</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[120px]" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                /* 5 skeleton rows — column count is 5 base + 1 if bulkMode (checkbox). */
                [...Array(5)].map((_, i) => (
                  <tr key={`skel-wf-${i}`} className="border-t border-border-light">
                    {[...Array(bulkMode ? 6 : 5)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div
                          className="h-3 bg-paper-100 rounded-[4px] animate-pulse"
                          style={{ width: `${60 + ((i + j) * 7) % 30}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
              filtered.map((wf, i) => {
                const isSelected = selectedIds.has(wf.id);
                return (
                <motion.tr key={wf.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                  onClick={() => { if (bulkMode) toggleSelect(wf.id); else setDetailWorkflowId(wf.id); }}
                  className={`border-t border-border-light transition-colors ${bulkMode ? 'cursor-pointer' : ''} ${bulkMode && isSelected ? 'bg-primary-xlight/50 hover:bg-primary-xlight/70' : 'hover:bg-surface-2/40'}`}>
                  {bulkMode && (
                    <td className="pl-4 pr-2 py-4 align-top" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(wf.id)}
                        className="w-4 h-4 rounded-[4px] border-canvas-border accent-primary cursor-pointer" />
                    </td>
                  )}
                  {/* Workflow Name + Live/Draft badge + ID */}
                  <td className="px-4 py-4 align-top w-[280px]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start gap-2">
                        {onOpenWorkflowDetail ? (
                          <button type="button" onClick={(e) => { e.stopPropagation(); onOpenWorkflowDetail(wf.id); }}
                            className="text-[13px] text-text font-medium leading-snug hover:text-primary hover:underline cursor-pointer transition-colors text-left bg-transparent border-none p-0">{wf.name}</button>
                        ) : (
                          <span className="text-[13px] text-text font-medium leading-snug">{wf.name}</span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 mt-0.5 ${
                          wf.status === 'Active' ? 'bg-compliant-50 text-compliant-700' : wf.status === 'Ready' ? 'bg-evidence-50 text-evidence-700' : wf.status === 'Archived' ? 'bg-paper-50 text-ink-400' : 'bg-paper-100 text-ink-500'
                        }`}>
                          {wf.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-compliant" />}
                          {wf.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-ink-500 tracking-tight">{wf.id.toUpperCase()}</span>
                    </div>
                  </td>
                  {/* Description */}
                  <td className="px-4 py-4 align-top">
                    <span className="text-[13px] text-text-secondary line-clamp-2">{wf.description}</span>
                  </td>
                  {/* Type — tags */}
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-paper-50 border border-canvas-border text-ink-700 text-[11px] font-medium">{wf.nature}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-paper-50 border border-canvas-border text-ink-700 text-[11px] font-medium">{wf.type}</span>
                    </div>
                  </td>
                  {/* Usage */}
                  <td className="px-4 py-4 align-top">
                    {wf.linkedControls.length > 0 ? (
                      <button type="button" onClick={() => setShowLinkedControls(showLinkedControls === wf.id ? null : wf.id)}
                        className="text-[12px] font-medium text-primary hover:underline cursor-pointer">
                        Used in {wf.linkedControls.length} control{wf.linkedControls.length !== 1 ? 's' : ''}
                      </button>
                    ) : (
                      <span className="text-[12px] text-ink-400">Not used</span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className={`px-4 py-4 align-top ${bulkMode ? 'pointer-events-none opacity-40' : ''}`}>
                    <div className="flex items-center justify-end gap-0.5">
                      {wf.type === 'Automated' && wf.status === 'Active' && (
                        <button type="button" aria-label="Run" onClick={() => addToast({ message: `Running "${wf.name}"...`, type: 'info' })}
                          className="w-8 h-8 rounded-[6px] flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors" title="Run">
                          <Play size={14} />
                        </button>
                      )}
                      <button type="button" aria-label="Edit" onClick={() => addToast({ message: `Editing "${wf.name}"...`, type: 'info' })}
                        className="w-8 h-8 rounded-[6px] flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" aria-label="Delete" onClick={() => handleDelete(wf.id)}
                        className="w-8 h-8 rounded-[6px] flex items-center justify-center text-text-muted hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Linked Controls Modal */}
      <AnimatePresence>
        {showLinkedControls && (() => {
          const wf = workflows.find(w => w.id === showLinkedControls);
          if (!wf || wf.linkedControls.length === 0) return null;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]"
              onClick={() => setShowLinkedControls(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-[16px] shadow-2xl border border-border-light w-[360px] overflow-hidden"
                onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
                  <div>
                    <h3 className="text-[13px] font-bold text-text">Linked Controls</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">{wf.name}</p>
                  </div>
                  <button type="button" aria-label="Close" onClick={() => setShowLinkedControls(null)} className="text-ink-400 hover:text-ink-600 cursor-pointer"><X size={14} /></button>
                </div>
                <div className="px-5 py-3 space-y-2">
                  {wf.linkedControls.map(cId => (
                    <div key={cId} className="flex items-center gap-2 p-2.5 rounded-[8px] bg-surface-2/40 border border-border-light">
                      <span className="text-[11px] font-mono text-ink-500">{cId}</span>
                      <span className="text-[12px] text-text">{CONTROLS.find(c => c.id === cId)?.name || `Control ${cId}`}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Create Workflow Drawer */}
      <AnimatePresence>
        {showCreateDrawer && (() => {
          const D = () => {
            const [n, setN] = useState(''); const [t, setT] = useState<'Automated' | 'Manual'>('Automated'); const [nat, setNat] = useState<'Preventive' | 'Detective'>('Preventive'); const [d, setD] = useState('');
            const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
            const fCls = 'w-full px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-white outline-none focus:border-primary/40 transition-all';
            // Dirty as soon as any field deviates from its initial default.
            const isDirty = n.trim().length > 0 || d.trim().length > 0 || t !== 'Automated' || nat !== 'Preventive';
            const requestClose = () => { if (isDirty) setShowDiscardConfirm(true); else setShowCreateDrawer(false); };
            const discardAndClose = () => { setN(''); setD(''); setT('Automated'); setNat('Preventive'); setShowDiscardConfirm(false); setShowCreateDrawer(false); };
            const cancelClose = () => setShowDiscardConfirm(false);
            return (<>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={requestClose} />
              <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">
                {/* Discard-changes confirm strip */}
                {showDiscardConfirm && (
                  <div className="p-3 bg-mitigated-50 border-b border-mitigated-200 flex items-center gap-3 text-[13px]">
                    <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0" />
                    <div className="flex-1 text-ink-800">Discard unsaved changes?</div>
                    <button type="button" onClick={discardAndClose} className="px-3 py-1 rounded-[6px] bg-paper-0 border border-mitigated-300 text-[12px] text-ink-700 hover:bg-paper-50">Discard</button>
                    <button type="button" onClick={cancelClose} className="px-3 py-1 rounded-[6px] bg-mitigated-700 text-paper-0 text-[12px] hover:bg-mitigated-800">Keep editing</button>
                  </div>
                )}
                <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
                  <div><h2 className="font-display text-[18px] font-semibold text-ink-900">Create Workflow</h2><p className="text-[12px] text-ink-500 mt-0.5">Define a new workflow for this business process.</p></div>
                  <button type="button" aria-label="Close" onClick={requestClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  <div><label className="text-[12px] font-semibold text-text-muted block mb-1.5">Name <span className="text-risk">*</span></label><input value={n} onChange={e => setN(e.target.value)} placeholder="e.g. Three-Way PO Match" className={fCls} autoFocus /></div>
                  <div><label className="text-[12px] font-semibold text-text-muted block mb-1.5">Business Process</label>
                    <div className="px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-paper-50 cursor-not-allowed flex items-center gap-2"><Building2 size={13} className="text-ink-400 shrink-0" />{bpAbbr}<span className="ml-auto text-[10px] text-ink-400">Auto-filled</span></div>
                  </div>
                  <div><label className="text-[12px] font-semibold text-text-muted block mb-1.5">Automation Type</label>
                    <div className="flex gap-2">{(['Automated', 'Manual'] as const).map(v => (<button type="button" key={v} onClick={() => setT(v)} className={`px-3 py-2 rounded-[8px] text-[12px] font-medium border cursor-pointer transition-all ${t === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted'}`}>{v}</button>))}</div>
                  </div>
                  <div><label className="text-[12px] font-semibold text-text-muted block mb-1.5">Nature</label>
                    <div className="flex gap-2">{(['Preventive', 'Detective'] as const).map(v => (<button type="button" key={v} onClick={() => setNat(v)} className={`px-3 py-2 rounded-[8px] text-[12px] font-medium border cursor-pointer transition-all ${nat === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted'}`}>{v}</button>))}</div>
                  </div>
                  <div><label className="text-[12px] font-semibold text-text-muted block mb-1.5">Description</label><textarea value={d} onChange={e => setD(e.target.value)} rows={3} placeholder="Describe what this workflow does..." className={fCls + ' resize-none'} /></div>
                </div>
                <div className="px-6 py-4 border-t border-canvas-border flex justify-end gap-3 shrink-0">
                  <button type="button" onClick={requestClose} className="px-4 py-2.5 rounded-[8px] border border-border text-[13px] font-medium text-ink-600 hover:bg-canvas cursor-pointer">Cancel</button>
                  <button type="button" onClick={() => { if (n.trim()) handleCreate({ name: n.trim(), type: t, nature: nat, desc: d }); }} disabled={!n.trim()} className="px-5 py-2.5 rounded-[8px] bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Create</button>
                </div>
              </motion.aside>
            </>);
          };
          return <D />;
        })()}
      </AnimatePresence>
    </div>
  );
}

// ─── Review Imported RACM Workspace ──────────────────────────────────────────

interface ImportedRow {
  id: string; sourceRow: number; process: string; subProcess: string;
  riskId: string; riskName: string; riskDesc: string; riskRating: string;
  controlId: string; controlName: string; controlDesc: string; controlObjective: string;
  controlOwner: string; frequency: string; controlType: string; keyControl: boolean;
  assertion: string; attribute: string; framework: string;
  reviewStatus: 'Needs Review' | 'Reviewed' | 'Flagged';
  validationIssues: string[];
}

// ─── Required-field validation ────────────────────────────────────────────
const REQUIRED_FIELDS: { field: keyof ImportedRow; label: string }[] = [
  { field: 'process', label: 'Missing process' },
  { field: 'riskName', label: 'Missing risk name' },
  { field: 'controlName', label: 'Missing control name' },
  { field: 'assertion', label: 'Missing assertion' },
  { field: 'attribute', label: 'Missing attribute' },
];

const VALIDATION_FIELD_MAP: Record<string, keyof ImportedRow> = Object.fromEntries(
  REQUIRED_FIELDS.map(f => [f.label, f.field]),
);

function validateRow(row: ImportedRow, allRows: ImportedRow[]): string[] {
  const issues: string[] = [];
  for (const { field, label } of REQUIRED_FIELDS) {
    if (!(row[field] as string).trim()) issues.push(label);
  }
  const dupeRisk = allRows.filter(r => r.id !== row.id && r.riskId === row.riskId && r.controlId === row.controlId && r.attribute === row.attribute);
  if (dupeRisk.length > 0 && row.riskId.trim() && row.controlId.trim()) issues.push('Duplicate row');
  return issues;
}

function getIssueFields(row: ImportedRow): Set<string> {
  const fields = new Set<string>();
  for (const issue of row.validationIssues) {
    const field = VALIDATION_FIELD_MAP[issue];
    if (field) fields.add(field);
  }
  return fields;
}

// ─── Column definitions for grid ──────────────────────────────────────────
type ColType = 'text' | 'dropdown' | 'checkbox' | 'readonly' | 'status';
interface GridColumn {
  key: keyof ImportedRow;
  label: string;
  minW: number;       // px min-width
  type: ColType;
  options?: string[];  // for dropdowns
  required?: boolean;
}

const RISK_RATINGS = ['Low', 'Medium', 'High', 'Critical'];
const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective'];
const FREQUENCY_OPTIONS = ['Per transaction', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually'];

const GRID_COLUMNS: GridColumn[] = [
  { key: 'sourceRow',    label: 'Row',              minW: 42,  type: 'readonly' },
  { key: 'process',      label: 'Process',          minW: 72,  type: 'text', required: true },
  { key: 'subProcess',   label: 'Sub-process',      minW: 100, type: 'text' },
  { key: 'riskId',       label: 'Risk ID',          minW: 62,  type: 'text' },
  { key: 'riskName',     label: 'Risk Name',        minW: 140, type: 'text', required: true },
  { key: 'riskDesc',     label: 'Risk Description', minW: 150, type: 'text' },
  { key: 'riskRating',   label: 'Risk Rating',      minW: 80,  type: 'dropdown', options: RISK_RATINGS },
  { key: 'controlId',    label: 'Ctrl ID',          minW: 62,  type: 'text' },
  { key: 'controlName',  label: 'Control Name',     minW: 140, type: 'text', required: true },
  { key: 'controlDesc',  label: 'Control Description', minW: 150, type: 'text' },
  { key: 'controlType',  label: 'Control Type',     minW: 90,  type: 'dropdown', options: CONTROL_TYPES },
  { key: 'controlOwner', label: 'Control Owner',    minW: 100, type: 'text' },
  { key: 'assertion',    label: 'Assertion',        minW: 90,  type: 'text', required: true },
  { key: 'attribute',    label: 'Attribute',        minW: 100, type: 'text', required: true },
  { key: 'frequency',    label: 'Frequency',        minW: 95,  type: 'dropdown', options: FREQUENCY_OPTIONS },
  { key: 'keyControl',   label: 'Key',              minW: 38,  type: 'checkbox' },
  { key: 'reviewStatus', label: 'Status',           minW: 70,  type: 'status' },
];

// Tooltip copy for jargon-y column headers in the RACM import grid.
const GRID_HEADER_TIPS: Record<string, string> = {
  keyControl: 'Marked as a key control — required for SOX or regulatory reporting.',
  assertion: 'The financial assertion this control supports (e.g. Accuracy, Completeness, Authorization).',
  attribute: 'The specific attribute or test step evidenced when this control runs.',
  riskRating: 'Inherent likelihood and impact of this risk before controls are applied.',
};

const MOCK_IMPORT_ROWS: ImportedRow[] = [
  { id: 'ir-1', sourceRow: 2, process: 'P2P', subProcess: 'Invoice Processing', riskId: 'R-001', riskName: 'Unauthorized vendor payments', riskDesc: 'Payments without approved PO', riskRating: 'High', controlId: 'C-001', controlName: 'Three-way PO match', controlDesc: 'System-enforced matching', controlObjective: 'Prevent unauthorized payments', controlOwner: 'Rajiv Sharma', frequency: 'Per transaction', controlType: 'Preventive', keyControl: true, assertion: 'Accuracy', attribute: 'PO Existence', framework: 'SOX ICFR', reviewStatus: 'Needs Review', validationIssues: [] },
  { id: 'ir-2', sourceRow: 3, process: 'P2P', subProcess: 'Invoice Processing', riskId: 'R-001', riskName: 'Unauthorized vendor payments', riskDesc: 'Payments without approved PO', riskRating: 'High', controlId: 'C-001', controlName: 'Three-way PO match', controlDesc: 'System-enforced matching', controlObjective: 'Prevent unauthorized payments', controlOwner: 'Rajiv Sharma', frequency: 'Per transaction', controlType: 'Preventive', keyControl: true, assertion: 'Accuracy', attribute: 'Payment Approval', framework: 'SOX ICFR', reviewStatus: 'Needs Review', validationIssues: [] },
  { id: 'ir-3', sourceRow: 4, process: 'P2P', subProcess: 'Invoice Processing', riskId: 'R-002', riskName: 'Duplicate invoices processed', riskDesc: 'Same invoice paid twice', riskRating: 'Medium', controlId: 'C-003', controlName: 'Duplicate invoice detection', controlDesc: 'Automated scan against historical data', controlObjective: 'Prevent duplicate payments', controlOwner: 'Rajiv Sharma', frequency: 'Per transaction', controlType: 'Detective', keyControl: true, assertion: 'Occurrence', attribute: 'Scan Executed', framework: 'SOX ICFR', reviewStatus: 'Needs Review', validationIssues: [] },
  { id: 'ir-4', sourceRow: 5, process: 'P2P', subProcess: 'Vendor Management', riskId: 'R-003', riskName: 'Fictitious vendor registration', riskDesc: 'Vendor created without verification', riskRating: 'Critical', controlId: 'C-002', controlName: 'Vendor change approval', controlDesc: 'Multi-level approval workflow', controlObjective: 'Prevent unauthorized vendor changes', controlOwner: 'Deepak Bansal', frequency: 'Per transaction', controlType: 'Preventive', keyControl: true, assertion: 'Authorization', attribute: 'Tax ID Verified', framework: 'SOX ICFR', reviewStatus: 'Needs Review', validationIssues: [] },
  { id: 'ir-5', sourceRow: 6, process: 'P2P', subProcess: 'Accounts Payable', riskId: 'R-005', riskName: 'SOD violation in AP', riskDesc: 'Same user creates and approves', riskRating: 'High', controlId: 'C-009', controlName: 'SOD conflict detection', controlDesc: 'Real-time detection', controlObjective: 'Prevent SOD violations', controlOwner: 'IT Security', frequency: 'Daily', controlType: 'Detective', keyControl: true, assertion: 'Authorization', attribute: 'Conflict Detected', framework: 'SOX ICFR', reviewStatus: 'Needs Review', validationIssues: [] },
  // Rows with validation issues for demo
  { id: 'ir-6', sourceRow: 7, process: '', subProcess: '', riskId: 'R-006', riskName: '', riskDesc: '', riskRating: '', controlId: 'C-010', controlName: 'Threshold check', controlDesc: 'Checks payment thresholds', controlObjective: '', controlOwner: '', frequency: 'Per transaction', controlType: 'Preventive', keyControl: false, assertion: '', attribute: '', framework: '', reviewStatus: 'Needs Review', validationIssues: [] },
  { id: 'ir-7', sourceRow: 8, process: 'P2P', subProcess: 'Payments', riskId: 'R-007', riskName: 'Late payment penalties', riskDesc: 'Payments delayed beyond terms', riskRating: 'Low', controlId: '', controlName: '', controlDesc: '', controlObjective: '', controlOwner: 'Karan Mehta', frequency: '', controlType: '', keyControl: false, assertion: 'Completeness', attribute: 'Payment Timeliness', framework: 'SOX ICFR', reviewStatus: 'Needs Review', validationIssues: [] },
];

/** Summary stats computed from imported rows for the freeze confirmation modal */
interface FreezeStats {
  totalRows: number;
  uniqueRisks: number;
  uniqueControls: number;
  riskControlMappings: number;
  needsReview: number;
  validationWarnings: number;
}

function computeFreezeStats(rows: ImportedRow[]): FreezeStats {
  const riskIds = new Set(rows.filter(r => r.riskId.trim()).map(r => r.riskId));
  const controlIds = new Set(rows.filter(r => r.controlId.trim()).map(r => r.controlId));
  const mappings = new Set(rows.filter(r => r.riskId.trim() && r.controlId.trim()).map(r => `${r.riskId}::${r.controlId}`));
  return {
    totalRows: rows.length,
    uniqueRisks: riskIds.size,
    uniqueControls: controlIds.size,
    riskControlMappings: mappings.size,
    needsReview: rows.filter(r => r.reviewStatus !== 'Reviewed').length,
    validationWarnings: rows.filter(r => r.validationIssues.length > 0).length,
  };
}

function ReviewImportWorkspace({ racmName, bpAbbr, fileName, onBack, onFreeze }: {
  racmName: string; bpAbbr: string; fileName: string;
  onBack: () => void; onFreeze: (rows: ImportedRow[]) => void;
}) {
  const { addToast } = useToast();
  const [rows, setRows] = useState<ImportedRow[]>(() => {
    const validated = MOCK_IMPORT_ROWS.map(r => ({ ...r, validationIssues: validateRow(r, MOCK_IMPORT_ROWS) }));
    return validated;
  });
  const [filter, setFilter] = useState<'All' | 'Needs Review' | 'Reviewed' | 'Flagged' | 'Has Issues'>('All');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeConfirmed, setFreezeConfirmed] = useState(false);

  const filtered = filter === 'All' ? rows : filter === 'Has Issues' ? rows.filter(r => r.validationIssues.length > 0) : rows.filter(r => r.reviewStatus === filter);
  const selectedRow = selectedRowId ? rows.find(r => r.id === selectedRowId) : null;
  const reviewedCount = rows.filter(r => r.reviewStatus === 'Reviewed').length;
  const issueCount = rows.filter(r => r.validationIssues.length > 0).length;

  // ─── Row helpers ─────────────────────────────────────────────────────────
  const revalidate = (updated: ImportedRow[]) =>
    updated.map(r => ({ ...r, validationIssues: validateRow(r, updated) }));

  const handleMarkReviewed = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, reviewStatus: 'Reviewed' as const } : r));
  };
  const handleBulkMarkReviewed = () => {
    setRows(prev => prev.map(r => ({ ...r, reviewStatus: 'Reviewed' as const })));
    addToast({ message: 'All rows marked as reviewed.', type: 'success' });
  };
  const handleDeleteRow = (id: string) => {
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return;
    const row = rows[idx];
    setRows(prev => revalidate(prev.filter(r => r.id !== id)));
    if (selectedRowId === id) setSelectedRowId(null);
    addToast({
      message: 'Row removed.',
      type: 'info',
      action: {
        label: 'Undo',
        onClick: () => setRows(prev => {
          const next = [...prev];
          next.splice(Math.min(idx, next.length), 0, row);
          return revalidate(next);
        }),
      },
    });
  };
  const handleAddRow = () => {
    const newRow: ImportedRow = {
      id: `ir-${Date.now()}`, sourceRow: rows.length + 2, process: bpAbbr, subProcess: '',
      riskId: '', riskName: '', riskDesc: '', riskRating: '',
      controlId: '', controlName: '', controlDesc: '', controlObjective: '',
      controlOwner: '', frequency: '', controlType: '', keyControl: false,
      assertion: '', attribute: '', framework: '', reviewStatus: 'Needs Review', validationIssues: [],
    };
    setRows(prev => revalidate([...prev, newRow]));
    addToast({ message: 'New row added.', type: 'success' });
  };

  // ─── Cell editing ────────────────────────────────────────────────────────
  const commitEdit = useCallback((rowId: string, field: string, value: string) => {
    setRows(prev => revalidate(prev.map(r => r.id === rowId ? { ...r, [field]: value } : r)));
    setEditingCell(null);
  }, []);

  const startEdit = useCallback((rowId: string, field: string, currentValue: string) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue);
  }, []);

  /** Move to next editable cell (Tab) or previous (Shift+Tab) */
  const moveToAdjacentCell = useCallback((rowId: string, field: string, forward: boolean) => {
    const editableCols = GRID_COLUMNS.filter(c => c.type !== 'readonly' && c.type !== 'status');
    const colIdx = editableCols.findIndex(c => c.key === field);
    const rowIdx = filtered.findIndex(r => r.id === rowId);
    if (colIdx === -1 || rowIdx === -1) return;

    let nextCol = colIdx + (forward ? 1 : -1);
    let nextRowIdx = rowIdx;
    if (nextCol >= editableCols.length) { nextCol = 0; nextRowIdx++; }
    if (nextCol < 0) { nextCol = editableCols.length - 1; nextRowIdx--; }
    if (nextRowIdx < 0 || nextRowIdx >= filtered.length) return;

    const nextRow = filtered[nextRowIdx];
    const col = editableCols[nextCol];
    if (col.type === 'checkbox') {
      // Skip checkbox — toggle is instant, keep moving
      setEditingCell(null);
      return;
    }
    const val = String(nextRow[col.key] ?? '');
    startEdit(nextRow.id, col.key, val === 'undefined' ? '' : val);
  }, [filtered, startEdit]);

  const toggleKeyControl = useCallback((rowId: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, keyControl: !r.keyControl } : r));
  }, []);

  // Total min-width for horizontal scroll
  const totalMinW = GRID_COLUMNS.reduce((a, c) => a + c.minW, 0) + 56; // +56 for actions col

  // ─── Risk Rating badge colors ────────────────────────────────────────────
  const ratingColor = (r: string) => {
    switch (r) {
      case 'Critical': return 'bg-risk-50 text-risk-700';
      case 'High':     return 'bg-high-50 text-high-700';
      case 'Medium':   return 'bg-mitigated-50 text-mitigated-700';
      case 'Low':      return 'bg-compliant-50 text-compliant-700';
      default:         return 'bg-paper-50 text-ink-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-3">
          <ArrowLeft size={14} />Back to RACM List
        </button>
        <div className="bg-white rounded-[12px] border border-canvas-border p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-text">{racmName}</h2>
                <span className="px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center bg-mitigated-50 text-mitigated-700">Draft Review</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-500">
                <span>{bpAbbr}</span>
                <span>Source: {fileName}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Review/issues warning sits right next to the action */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-ink-500">{reviewedCount}/{rows.length} reviewed</span>
                {issueCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-mitigated-700 bg-mitigated-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={11} />{issueCount} with issues
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => addToast({ message: 'Draft saved.', type: 'success' })}
                  className="px-3 py-2 rounded-[8px] border border-border text-[12px] font-medium text-text-secondary hover:bg-paper-50 cursor-pointer">Save Draft</button>
                <button type="button" onClick={() => { setFreezeConfirmed(false); setShowFreezeModal(true); }}
                  disabled={reviewedCount < rows.length}
                  title={reviewedCount < rows.length ? `Review all rows before freezing (${reviewedCount}/${rows.length} reviewed)` : ''}
                  className="px-4 py-2 rounded-[8px] bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"><Lock size={12} />Freeze RACM</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(['All', 'Needs Review', 'Reviewed', 'Flagged', 'Has Issues'] as const).map(f => (
            <button type="button" key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-all ${filter === f ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10'}`}>
              {f}{f === 'Has Issues' && issueCount > 0 ? ` (${issueCount})` : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleBulkMarkReviewed} className="px-3 py-1.5 rounded-[8px] text-[10px] font-semibold border border-border text-text-muted hover:bg-paper-50 cursor-pointer">Mark All Reviewed</button>
          <button type="button" onClick={handleAddRow} className="px-3 py-1.5 rounded-[8px] text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer flex items-center gap-1"><Plus size={9} />Add Row</button>
        </div>
      </div>

      {/* Grid + Detail panel */}
      <div className="flex gap-4">
        {/* Grid */}
        <div className={`${selectedRow ? 'flex-1' : 'w-full'} bg-white rounded-lg border border-canvas-border overflow-hidden`}>
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
            <table className="w-full text-[11px] border-collapse" style={{ minWidth: totalMinW }}>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-paper-50/80">
                  {GRID_COLUMNS.map(c => {
                    const tip = GRID_HEADER_TIPS[c.key as string];
                    return (
                      <th key={c.key} className="px-1.5 py-2 text-left text-[9px] font-semibold text-ink-400 uppercase tracking-wide whitespace-nowrap"
                        style={{ minWidth: c.minW }}>
                        {tip ? (
                          <span className="inline-flex items-center gap-1 group/tip relative">
                            {c.label}
                            <HelpCircle className="w-3 h-3 text-ink-400" aria-label={`What is ${c.label}?`} />
                            <span className="absolute top-full left-0 mt-1 w-[220px] p-2.5 rounded-[8px] bg-ink-800 text-paper-0 text-[12px] font-normal normal-case tracking-normal leading-snug opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
                              {tip}
                            </span>
                          </span>
                        ) : c.label}
                        {c.required && <span className="text-risk-700 ml-0.5">*</span>}
                      </th>
                    );
                  })}
                  <th className="px-1.5 py-2 w-14 sticky right-0 bg-paper-50/80"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const issueFields = getIssueFields(row);
                  return (
                  <tr key={row.id}
                    onClick={() => setSelectedRowId(row.id)}
                    className={`border-b border-border/30 transition-colors cursor-pointer ${selectedRowId === row.id ? 'bg-primary/5' : row.validationIssues.length > 0 ? 'bg-mitigated-50/20 hover:bg-mitigated-50/40' : 'hover:bg-paper-50/50'}`}>
                    {GRID_COLUMNS.map(col => {
                      const rawVal = row[col.key];
                      const val = rawVal === undefined || rawVal === null ? '' : String(rawVal);
                      const isEditing = editingCell?.rowId === row.id && editingCell.field === col.key;
                      const hasIssue = issueFields.has(col.key);
                      const isEmpty = !val || val === 'undefined' || val === 'false';

                      // ── Read-only Row # ──
                      if (col.type === 'readonly') {
                        return (
                          <td key={col.key} className="px-1.5 py-1 text-[10px] text-ink-400 font-mono" style={{ minWidth: col.minW }}>
                            {val}
                          </td>
                        );
                      }

                      // ── Status badge ──
                      if (col.type === 'status') {
                        return (
                          <td key={col.key} className="px-1.5 py-1" style={{ minWidth: col.minW }}>
                            <span className={`px-1.5 h-4 rounded-[4px] text-[10px] font-bold inline-flex items-center ${row.reviewStatus === 'Reviewed' ? 'bg-compliant-50 text-compliant-700' : row.reviewStatus === 'Flagged' ? 'bg-risk-50 text-risk-700' : 'bg-mitigated-50 text-mitigated-700'}`}>
                              {row.reviewStatus}
                            </span>
                          </td>
                        );
                      }

                      // ── Checkbox (Key Control) ──
                      if (col.type === 'checkbox') {
                        return (
                          <td key={col.key} className="px-1.5 py-1 text-center" style={{ minWidth: col.minW }}
                            onClick={e => { e.stopPropagation(); toggleKeyControl(row.id); }}>
                            <input type="checkbox" checked={row.keyControl} readOnly
                              className="w-3.5 h-3.5 rounded-[4px] border-canvas-border text-primary accent-primary cursor-pointer" />
                          </td>
                        );
                      }

                      // ── Dropdown cell ──
                      if (col.type === 'dropdown') {
                        if (isEditing) {
                          return (
                            <td key={col.key} className="px-0.5 py-0.5" style={{ minWidth: col.minW }}>
                              <select value={editValue}
                                onChange={e => { commitEdit(row.id, col.key, e.target.value); }}
                                onBlur={() => commitEdit(row.id, col.key, editValue)}
                                onKeyDown={e => {
                                  if (e.key === 'Escape') setEditingCell(null);
                                  if (e.key === 'Tab') { e.preventDefault(); commitEdit(row.id, col.key, editValue); moveToAdjacentCell(row.id, col.key, !e.shiftKey); }
                                }}
                                className="w-full px-1 py-0.5 border border-primary/40 rounded-[4px] text-[11px] outline-none bg-white cursor-pointer" autoFocus>
                                <option value="">—</option>
                                {col.options!.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </td>
                          );
                        }
                        // Display mode — show value or "Required" for required empty, single-click to edit
                        return (
                          <td key={col.key}
                            className={`px-1.5 py-1 ${hasIssue ? 'relative' : ''}`}
                            style={{ minWidth: col.minW }}
                            onClick={e => { e.stopPropagation(); setSelectedRowId(row.id); startEdit(row.id, col.key, val === 'undefined' ? '' : val); }}>
                            {col.key === 'riskRating' && val && val !== 'undefined' ? (
                              <span className={`px-1.5 h-4 rounded-[4px] text-[9px] font-bold inline-flex items-center ${ratingColor(val)}`}>{val}</span>
                            ) : (
                              <span className={`text-[11px] ${hasIssue && isEmpty ? 'text-mitigated-700' : isEmpty ? 'text-ink-300' : 'text-text'} truncate block`}>
                                {hasIssue && isEmpty ? (
                                  <span className="inline-flex items-center gap-0.5"><AlertTriangle size={9} className="shrink-0" />Required</span>
                                ) : val && val !== 'undefined' ? val : '—'}
                              </span>
                            )}
                            {hasIssue && <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-mitigated rounded-full" />}
                          </td>
                        );
                      }

                      // ── Text cell (single-click to edit) ──
                      if (isEditing) {
                        return (
                          <td key={col.key} className="px-0.5 py-0.5" style={{ minWidth: col.minW }}>
                            <input value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(row.id, col.key, editValue)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit(row.id, col.key, editValue);
                                if (e.key === 'Escape') setEditingCell(null);
                                if (e.key === 'Tab') { e.preventDefault(); commitEdit(row.id, col.key, editValue); moveToAdjacentCell(row.id, col.key, !e.shiftKey); }
                              }}
                              className="w-full px-1 py-0.5 border border-primary/40 rounded-[4px] text-[11px] outline-none" autoFocus />
                          </td>
                        );
                      }
                      return (
                        <td key={col.key}
                          className={`px-1.5 py-1 ${hasIssue ? 'relative' : ''}`}
                          style={{ minWidth: col.minW }}
                          onClick={e => { e.stopPropagation(); setSelectedRowId(row.id); startEdit(row.id, col.key, val === 'undefined' ? '' : val); }}>
                          <span className={`text-[11px] ${hasIssue && isEmpty ? 'text-mitigated-700' : isEmpty ? 'text-ink-300' : 'text-text'} truncate block`}
                            title={hasIssue && isEmpty ? 'Required field' : val}>
                            {hasIssue && isEmpty ? (
                              <span className="inline-flex items-center gap-0.5"><AlertTriangle size={9} className="shrink-0" />Required</span>
                            ) : val && val !== 'undefined' ? val : '—'}
                          </span>
                          {hasIssue && <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-mitigated rounded-full" />}
                        </td>
                      );
                    })}
                    {/* Actions — sticky right */}
                    <td className="px-1.5 py-1 text-right sticky right-0 bg-inherit" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5 justify-end">
                        {row.reviewStatus !== 'Reviewed' && (
                          <button type="button" aria-label="Mark Reviewed" onClick={() => handleMarkReviewed(row.id)} className="p-1 rounded-[4px] hover:bg-compliant-50 text-ink-400 hover:text-compliant-700 cursor-pointer" title="Mark Reviewed"><CheckCircle2 size={11} /></button>
                        )}
                        <button type="button" aria-label="Delete" onClick={() => handleDeleteRow(row.id)} className="p-1 rounded-[4px] hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer" title="Delete"><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-border bg-surface-2/30 text-[10px] text-text-muted">
            {filtered.length} row{filtered.length !== 1 ? 's' : ''} · Click any cell to edit. Press Enter to save, Tab to move.
          </div>
        </div>

        {/* Detail panel */}
        {selectedRow && (
          <div className="w-[280px] shrink-0 bg-white rounded-[12px] border border-canvas-border p-6 space-y-3.5 overflow-y-auto" style={{ maxHeight: 560 }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-muted uppercase">Row {selectedRow.sourceRow}</span>
              <button type="button" aria-label="Close" onClick={() => setSelectedRowId(null)} className="text-ink-400 hover:text-ink-600 cursor-pointer"><X size={12} /></button>
            </div>

            {/* Process */}
            <div>
              <span className="text-[9px] text-ink-400 uppercase block">Process</span>
              <p className="text-[12px] font-medium text-text">{selectedRow.process || '—'}</p>
              {selectedRow.subProcess && <p className="text-[10px] text-ink-500 mt-0.5">{selectedRow.subProcess}</p>}
            </div>

            {/* Risk */}
            <div>
              <span className="text-[9px] text-ink-400 uppercase block">Risk</span>
              <p className="text-[12px] font-medium text-text">{selectedRow.riskName || '—'}</p>
              <p className="text-[10px] text-ink-500 mt-0.5">{selectedRow.riskDesc || '—'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-mono text-ink-400">{selectedRow.riskId || '—'}</span>
                {selectedRow.riskRating && (
                  <span className={`px-1.5 h-4 rounded-[4px] text-[10px] font-bold inline-flex items-center ${ratingColor(selectedRow.riskRating)}`}>{selectedRow.riskRating}</span>
                )}
              </div>
            </div>

            {/* Control */}
            <div>
              <span className="text-[9px] text-ink-400 uppercase block">Control</span>
              <p className="text-[12px] font-medium text-text">{selectedRow.controlName || '—'}</p>
              <p className="text-[10px] text-ink-500 mt-0.5">{selectedRow.controlDesc || '—'}</p>
              <div className="grid grid-cols-2 gap-1 mt-1.5 text-[10px]">
                <div><span className="text-ink-400">ID:</span> <span className="text-text font-mono">{selectedRow.controlId || '���'}</span></div>
                <div><span className="text-ink-400">Owner:</span> <span className="text-text">{selectedRow.controlOwner || '—'}</span></div>
                <div><span className="text-ink-400">Type:</span> <span className="text-text">{selectedRow.controlType || '—'}</span></div>
                <div><span className="text-ink-400">Frequency:</span> <span className="text-text">{selectedRow.frequency || '—'}</span></div>
                <div><span className="text-ink-400">Key:</span> <span className="text-text">{selectedRow.keyControl ? 'Yes' : 'No'}</span></div>
              </div>
            </div>

            {/* Assertion / Attribute */}
            <div>
              <span className="text-[9px] text-ink-400 uppercase block">Assertion / Attribute</span>
              <p className="text-[11px] text-text">{selectedRow.assertion || '—'} / {selectedRow.attribute || '—'}</p>
            </div>

            {/* Source */}
            <div>
              <span className="text-[9px] text-ink-400 uppercase block">Source</span>
              <p className="text-[10px] text-ink-500">Row {selectedRow.sourceRow} · {selectedRow.framework || '—'}</p>
            </div>

            {/* Validation Issues */}
            {selectedRow.validationIssues.length > 0 && (
              <div className="bg-mitigated-50/60 rounded-[8px] p-2.5 space-y-1">
                <span className="text-[9px] font-bold text-mitigated-700 uppercase flex items-center gap-1"><AlertTriangle size={10} />Validation Issues ({selectedRow.validationIssues.length})</span>
                {selectedRow.validationIssues.map((issue, i) => (
                  <p key={i} className="text-[10px] text-mitigated-700 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-mitigated shrink-0" />{issue}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 pt-2">
              {selectedRow.reviewStatus !== 'Reviewed' && (
                <button type="button" onClick={() => handleMarkReviewed(selectedRow.id)} className="flex-1 py-1.5 rounded-[8px] text-[10px] font-semibold bg-compliant-50 text-compliant-700 hover:bg-compliant-50 cursor-pointer text-center">Mark Reviewed</button>
              )}
              <button type="button" onClick={() => { setRows(prev => prev.map(r => r.id === selectedRow.id ? { ...r, reviewStatus: 'Flagged' as const } : r)); }}
                className="flex-1 py-1.5 rounded-[8px] text-[10px] font-semibold bg-risk-50 text-risk-700 hover:bg-risk-50 cursor-pointer text-center">Flag</button>
            </div>
          </div>
        )}
      </div>

      {/* Freeze RACM Structure Modal */}
      <AnimatePresence>
        {showFreezeModal && (() => {
          const stats = computeFreezeStats(rows);
          return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowFreezeModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[16px] shadow-2xl border border-border-light w-[480px] overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-[12px] bg-primary/10 flex items-center justify-center">
                    <ShieldCheck size={22} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-text">Freeze RACM Structure</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">{racmName}</p>
                  </div>
                </div>

                {/* Message */}
                <p className="text-[12px] text-text-secondary leading-relaxed mb-5">
                  You are about to finalize this imported RACM structure. After freezing, structural edits will be restricted and the RACM will move into system mapping mode.
                </p>

                {/* Stats Grid */}
                <div className="bg-surface-2/60 rounded-[12px] p-4 mb-4">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wide block mb-3">Import Summary</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Rows', value: stats.totalRows, color: 'text-text' },
                      { label: 'Unique Risks', value: stats.uniqueRisks, color: 'text-primary' },
                      { label: 'Unique Controls', value: stats.uniqueControls, color: 'text-primary' },
                      { label: 'Risk-Control Mappings', value: stats.riskControlMappings, color: 'text-text' },
                      { label: 'Needs Review', value: stats.needsReview, color: stats.needsReview > 0 ? 'text-mitigated-700' : 'text-compliant-700' },
                      { label: 'Validation Warnings', value: stats.validationWarnings, color: stats.validationWarnings > 0 ? 'text-mitigated-700' : 'text-compliant-700' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-[8px] px-3 py-2 border border-border-light">
                        <span className={`text-[18px] font-bold ${s.color} block`}>{s.value}</span>
                        <span className="text-[9px] text-ink-400 font-medium">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation warnings detail */}
                {stats.validationWarnings > 0 && (
                  <div className="bg-mitigated-50/60 rounded-[8px] p-3 mb-4 space-y-1">
                    <span className="text-[9px] font-bold text-mitigated-700 uppercase flex items-center gap-1"><AlertTriangle size={10} />Rows with issues</span>
                    {rows.filter(r => r.validationIssues.length > 0).slice(0, 3).map(r => (
                      <div key={r.id} className="flex items-start gap-2 text-[10px]">
                        <span className="text-mitigated-700 font-semibold shrink-0">Row {r.sourceRow}:</span>
                        <span className="text-mitigated-700">{r.validationIssues.join(', ')}</span>
                      </div>
                    ))}
                    {stats.validationWarnings > 3 && (
                      <p className="text-[10px] text-mitigated-700 font-medium">+{stats.validationWarnings - 3} more…</p>
                    )}
                    <p className="text-[10px] text-mitigated-700/70 mt-1">These rows will be imported as-is. You can fix them in the RACM mapping workspace after freeze.</p>
                  </div>
                )}

                {/* Needs review warning */}
                {stats.needsReview > 0 && (
                  <div className="bg-evidence-50/60 rounded-[8px] p-3 mb-4">
                    <p className="text-[10px] text-evidence-700">{stats.needsReview} row{stats.needsReview !== 1 ? 's' : ''} not yet marked as reviewed. You can still freeze — unreviewed rows will be imported.</p>
                  </div>
                )}

                {/* Lock-for-audit callout — strong warning above the confirm. */}
                <div className="p-3 bg-mitigated-50 border border-mitigated-200 rounded-[8px] mb-4 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0 mt-0.5" />
                  <div className="text-[12px] text-ink-800">
                    <div className="font-semibold text-mitigated-800 mb-1">This will lock the RACM for audit</div>
                    <div className="text-[12px] leading-snug">No edits can be made after freezing. To make changes later, an admin must re-open it from the RACM row actions.</div>
                  </div>
                </div>

                {/* Confirmation checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-[8px] bg-surface-2/40 border border-border-light mb-5 cursor-pointer select-none hover:bg-surface-2/70 transition-colors">
                  <input type="checkbox" checked={freezeConfirmed} onChange={e => setFreezeConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded-[4px] border-canvas-border text-primary accent-primary cursor-pointer" />
                  <span className="text-[12px] text-text leading-snug">I confirm this RACM structure has been reviewed and is correct.</span>
                </label>

                {/* Actions */}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowFreezeModal(false)}
                    className="flex-1 py-2.5 rounded-[12px] border border-border text-[12px] font-semibold text-text-secondary hover:bg-paper-50 cursor-pointer">Cancel</button>
                  <button type="button" onClick={() => { setShowFreezeModal(false); onFreeze(rows); }}
                    disabled={!freezeConfirmed}
                    className="flex-1 py-2.5 rounded-[12px] bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Lock size={13} />Freeze &amp; Create RACM
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

/* ─── BP Detail View ─── */

// Health signal per section — drives the small badge on the SectionCard.
type SectionHealth = 'healthy' | 'attention' | 'stale' | 'empty';

// Minimal health signal: a single uppercase mono word, colored. "Healthy" stays
// silent so the eye only catches what actually needs attention.
const HEALTH_LABEL: Record<SectionHealth, { label: string | null; cls: string }> = {
  healthy:   { label: null,        cls: '' },
  attention: { label: 'Attention', cls: 'text-mitigated-700' },
  stale:     { label: 'Stale',     cls: 'text-high-700' },
  empty:     { label: 'Empty',     cls: 'text-ink-400' },
};

// Minimal section card. Two lines, no icon tile, no pill badges, no inline CTA pill.
// Title + count + health word (only when non-healthy) on row 1; muted breakdown on row 2.
// Health is implied by silence for "healthy" so the eye only catches what actually matters.
function SectionCard({
  title, count, countLabel, breakdown, lastActivity, health, locked, lockedReason, onClick,
}: {
  title: string;
  count: number;
  countLabel: string;
  breakdown: string;
  lastActivity: string;
  health: SectionHealth;
  locked?: boolean;
  lockedReason?: string;
  onClick: () => void;
}) {
  if (locked) {
    return (
      <div className="w-full bg-paper-50/40 border border-dashed border-canvas-border rounded-[12px] px-5 py-4">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h2 className="font-display text-[18px] font-[420] tracking-tight text-ink-400 leading-none">{title}</h2>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 inline-flex items-center gap-1 shrink-0">
            <Lock size={9} aria-hidden />Locked
          </span>
        </div>
        <div className="text-[12px] text-ink-400 leading-tight">{lockedReason ?? 'Available after the previous step is set up.'}</div>
      </div>
    );
  }
  const healthInfo = HEALTH_LABEL[health];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full bg-white border border-canvas-border rounded-[12px] hover:border-brand-200 hover:bg-paper-50/30 transition-colors cursor-pointer text-left px-5 py-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 mb-1">
            <h2 className="font-display text-[18px] font-[420] tracking-tight text-ink-900 leading-none">{title}</h2>
            <span className="text-[12px] text-ink-500 font-mono tabular-nums shrink-0">{count} {countLabel}</span>
            {healthInfo.label && (
              <span className={`text-[10px] uppercase tracking-wider font-semibold shrink-0 ${healthInfo.cls}`}>
                {healthInfo.label}
              </span>
            )}
          </div>
          <div className="text-[12px] text-ink-500 leading-tight truncate">
            {breakdown}
            <span className="text-ink-300 mx-1.5">·</span>
            {lastActivity}
          </div>
        </div>
        <ChevronRight size={14} className="text-ink-300 group-hover:text-brand-600 transition-colors shrink-0" aria-hidden />
      </div>
    </button>
  );
}

function BPDetailView({ bp, onBack, onOpenRacmEditor, onOpenWorkflowDetail }: {
  bp: UserProcess; onBack: () => void;
  onOpenRacmEditor?: (racm: import('./RacmListTable').RacmEntry) => void;
  onOpenWorkflowDetail?: (workflowId: string) => void;
}) {
  const { addToast } = useToast();
  const [createdRacms, setCreatedRacms] = useState<import('./RacmListTable').RacmEntry[]>([]);
  const [showCreateRacm, setShowCreateRacm] = useState(false);
  /** Tracks which RACM is open in the Excel review editor. Stores the racmId. */
  const [reviewingRacmId, setReviewingRacmId] = useState<string | null>(null);
  const reviewingRacm = reviewingRacmId ? createdRacms.find(r => r.id === reviewingRacmId) : null;

  type SectionKey = 'sop' | 'racm' | 'risks' | 'controls' | 'workflows';

  // ─── Data: single query per entity, filtered by business_process_id ───
  const bpRacms = RACMS.filter(r => r.bpId === bp.id);
  const bpSops = SOPS.filter(s => s.bpId === bp.id);
  const bpWfs = WORKFLOWS.filter(w => w.bpId === bp.id);
  const bpRisks = RISKS.filter(r => r.bpId === bp.id);
  const bpRiskIds = new Set(bpRisks.map(r => r.id));
  const bpControls = CONTROLS.filter(c => bpRiskIds.has(c.riskId));
  const coveredRiskIds = new Set(bpControls.map(c => c.riskId));
  const coverage = bpRisks.length ? Math.round((bpRisks.filter(r => coveredRiskIds.has(r.id)).length / bpRisks.length) * 100) : 0;

  // Built-in (seed) processes keep their demo Controls/Workflows; newly-created processes start empty.
  const isSeedProcess = BUSINESS_PROCESSES.some(b => b.id === bp.id);

  // No separate status logic — RACM uses racmStateEngine, risks use RiskRegister lifecycle,
  // controls use ControlLibraryView status, workflows use WorkflowLibraryView status.

  // DRILL-IN state + per-section metadata
  // Seed from URL on first render so deep links + back/forward navigation work.
  const VALID_SECTIONS: SectionKey[] = ['sop', 'racm', 'risks', 'controls', 'workflows'];
  const readSectionFromUrl = (): SectionKey | null => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('section');
    return raw && (VALID_SECTIONS as string[]).includes(raw) ? (raw as SectionKey) : null;
  };
  const [drilledSection, setDrilledSection] = useState<SectionKey | null>(() => readSectionFromUrl());

  // Listen for browser back/forward so closing the drilled section via browser back works.
  // On unmount (user navigated away from this BP entirely), strip the ?section= query so it
  // doesn't leak into a different BP later. We use replaceState — never push/clobber history.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const raw = (e.state && (e.state as { section?: string }).section) ?? null;
      const next = raw && (VALID_SECTIONS as string[]).includes(raw) ? (raw as SectionKey) : null;
      setDrilledSection(next);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('section')) {
        window.history.replaceState({ section: null }, '', window.location.pathname);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push a URL entry whenever the drilled section changes so the back button is meaningful.
  // We only push when the URL actually differs from current state — avoids double-stacking on
  // mount when we seeded from the URL above.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const current = new URLSearchParams(window.location.search).get('section');
    if (drilledSection && current !== drilledSection) {
      window.history.pushState({ section: drilledSection }, '', `?section=${drilledSection}`);
    } else if (!drilledSection && current) {
      // User cleared the drilled section in-code (e.g. clicked the BP-name breadcrumb).
      // Replace the URL so reload doesn't restore the drilled view.
      window.history.pushState({ section: null }, '', window.location.pathname);
    }
  }, [drilledSection]);

  // Close the drilled view by going back in history so browser back/forward stays consistent.
  const closeDrilledSection = () => {
    if (typeof window !== 'undefined' && window.history.state && (window.history.state as { section?: string }).section) {
      window.history.back();
    } else {
      setDrilledSection(null);
    }
  };

  const sectionMeta: Record<SectionKey, { title: string; count: number; countLabel: string; warning?: string }> = {
    sop: { title: 'SOPs', count: bpSops.length, countLabel: 'documents', warning: bpSops.length === 0 ? 'no SOPs uploaded' : undefined },
    racm: { title: 'RACMs', count: bpRacms.length + createdRacms.length, countLabel: 'matrices', warning: (bpRacms.length + createdRacms.length) === 0 ? 'no RACMs yet' : undefined },
    risks: { title: 'Risks', count: bpRisks.length, countLabel: 'risks', warning: bpRisks.length === 0 ? 'no risks captured' : undefined },
    controls: { title: 'Controls', count: bpControls.length, countLabel: 'controls', warning: bpControls.length === 0 ? 'no controls defined' : undefined },
    workflows: { title: 'Workflows', count: bpWfs.length, countLabel: 'workflows', warning: bpWfs.length === 0 ? 'no workflows linked' : undefined },
  };
  const sectionOrder: SectionKey[] = ['sop', 'racm', 'risks', 'controls', 'workflows'];

  // ── Rich insights per section — drive the BP detail index cards. ────────────
  // Each section reads its underlying seed data and reports:
  //   health      — visible badge (Healthy / Attention / Stale / Empty)
  //   breakdown   — secondary line (e.g. "1 linked · 1 standalone")
  //   lastActivity — short timestamp string
  //   ctaLabel    — pill on the card hinting at the create affordance
  type SectionInsight = { health: SectionHealth; breakdown: string; lastActivity: string; ctaLabel: string; icon: React.ComponentType<{ size?: number; className?: string }> };
  const sectionInsights: Record<SectionKey, SectionInsight> = useMemo(() => {
    const totalRacms = bpRacms.length + createdRacms.length;
    const draftRacms = bpRacms.filter(r => r.status === 'draft').length
                     + createdRacms.filter(r => r.isFrozen === false).length;
    const activeRacms = totalRacms - draftRacms;
    const linkedSops = bpSops.filter(s => s.racmId).length;
    const standaloneSops = bpSops.length - linkedSops;
    const unmappedRisks = bpRisks.filter(r => r.ctls === 0).length;
    const mappedRisks = bpRisks.length - unmappedRisks;
    const keyCtls = bpControls.filter(c => c.isKey).length;
    const ineffectiveCtls = bpControls.filter(c => c.status === 'ineffective').length;
    const activeWfs = bpWfs.filter(w => w.status === 'active').length;
    const idleWfs = bpWfs.length - activeWfs;

    // SOP staleness — anything dated before Mar 2026 in this demo dataset is "stale".
    const staleSops = bpSops.filter(s => /Dec 2025|Nov 2025|Oct 2025|Jan|Feb/.test(s.at)).length;

    return {
      sop: {
        icon: FileText,
        health: bpSops.length === 0 ? 'empty' : (staleSops > 0 ? 'stale' : 'healthy'),
        breakdown: bpSops.length === 0
          ? 'No SOPs uploaded yet'
          : `${linkedSops} linked to RACM${standaloneSops > 0 ? ` · ${standaloneSops} standalone` : ''}`,
        lastActivity: bpSops.length === 0 ? 'No activity yet' : `Latest: ${bpSops[0].at}`,
        ctaLabel: bpSops.length === 0 ? 'Upload SOP' : 'Open',
      },
      racm: {
        icon: Grid3x3,
        health: totalRacms === 0 ? 'empty' : (draftRacms > 0 ? 'attention' : 'healthy'),
        breakdown: totalRacms === 0
          ? 'Build your first matrix'
          : `${activeRacms} active${draftRacms > 0 ? ` · ${draftRacms} draft` : ''}`,
        lastActivity: bpRacms[0]?.lastRun
          ? (bpRacms[0].lastRun === 'Never' ? 'Never run' : `Last run: ${bpRacms[0].lastRun}`)
          : 'No activity yet',
        ctaLabel: totalRacms === 0 ? 'New RACM' : 'Open',
      },
      risks: {
        icon: AlertTriangle,
        health: bpRisks.length === 0 ? 'empty' : (unmappedRisks > 0 ? 'attention' : 'healthy'),
        breakdown: bpRisks.length === 0
          ? 'No risks captured'
          : `${mappedRisks} mapped${unmappedRisks > 0 ? ` · ${unmappedRisks} unmapped` : ''}`,
        lastActivity: bpRisks.length === 0
          ? 'No activity yet'
          : (bpRisks.find(r => r.lastUpdated)?.lastUpdated ? `Latest: ${bpRisks.find(r => r.lastUpdated)!.lastUpdated}` : 'No activity yet'),
        ctaLabel: bpRisks.length === 0 ? 'New Risk' : 'Open',
      },
      controls: {
        icon: Shield,
        health: bpControls.length === 0 ? 'empty' : (ineffectiveCtls > 0 ? 'attention' : 'healthy'),
        breakdown: bpControls.length === 0
          ? 'Mapped via RACM'
          : `${keyCtls} key${ineffectiveCtls > 0 ? ` · ${ineffectiveCtls} ineffective` : ''}`,
        lastActivity: bpControls.length === 0 ? 'No activity yet' : 'Mapped via RACM',
        ctaLabel: bpControls.length === 0 ? 'Go to RACM' : 'Open',
      },
      workflows: {
        icon: Workflow,
        health: bpWfs.length === 0 ? 'empty' : (idleWfs > 0 ? 'attention' : 'healthy'),
        breakdown: bpWfs.length === 0
          ? 'No workflows linked'
          : `${activeWfs} active${idleWfs > 0 ? ` · ${idleWfs} idle` : ''}`,
        lastActivity: bpWfs[0]?.lastRun ? `Last run: ${bpWfs[0].lastRun}` : 'No activity yet',
        ctaLabel: bpWfs.length === 0 ? 'New Workflow' : 'Open',
      },
    };
  }, [bpSops, bpRacms, createdRacms, bpRisks, bpControls, bpWfs]);

  // ── "What needs attention" items — computed from the same seed data. ───────
  // Each item links to the section where the user can act on it.
  const attentionItems = useMemo(() => {
    const items: Array<{ text: string; section: SectionKey }> = [];
    const draftRacms = bpRacms.filter(r => r.status === 'draft').length
                     + createdRacms.filter(r => r.isFrozen === false).length;
    if (draftRacms > 0) {
      items.push({ text: `${draftRacms} RACM${draftRacms !== 1 ? 's' : ''} in draft — finish setup before audit can run`, section: 'racm' });
    }
    const unmappedRisks = bpRisks.filter(r => r.ctls === 0).length;
    if (unmappedRisks > 0) {
      items.push({ text: `${unmappedRisks} risk${unmappedRisks !== 1 ? 's' : ''} not yet mapped to a control`, section: 'risks' });
    }
    const ineffectiveCtls = bpControls.filter(c => c.status === 'ineffective').length;
    if (ineffectiveCtls > 0) {
      items.push({ text: `${ineffectiveCtls} control${ineffectiveCtls !== 1 ? 's' : ''} flagged as ineffective`, section: 'controls' });
    }
    const staleSops = bpSops.filter(s => /Dec 2025|Nov 2025|Oct 2025|Jan|Feb/.test(s.at)).length;
    if (staleSops > 0) {
      items.push({ text: `${staleSops} SOP${staleSops !== 1 ? 's' : ''} not updated in 30+ days`, section: 'sop' });
    }
    const idleWfs = bpWfs.length - bpWfs.filter(w => w.status === 'active').length;
    if (idleWfs > 0) {
      items.push({ text: `${idleWfs} workflow${idleWfs !== 1 ? 's' : ''} idle for the last 14 days`, section: 'workflows' });
    }
    return items;
  }, [bpSops, bpRacms, createdRacms, bpRisks, bpControls, bpWfs]);

  // A brand-new BP has no SOPs and no RACMs yet — drive the linear-unlock onboarding.
  const isFreshBP = bpSops.length === 0 && bpRacms.length === 0 && createdRacms.length === 0;

  // Section switcher pill labels (shorter than full section titles where useful).
  const sectionPillLabel: Record<SectionKey, string> = {
    sop: 'SOP',
    racm: 'RACM',
    risks: 'Risks',
    controls: 'Controls',
    workflows: 'Workflows',
  };
  // Switch to a different drilled section in-place (also updates URL).
  const switchDrilledSection = (next: SectionKey) => {
    if (next === drilledSection) return;
    if (typeof window !== 'undefined') {
      window.history.pushState({ section: next }, '', `?section=${next}`);
    }
    setDrilledSection(next);
  };

  // Section-specific create button label rendered in the drilled-view header.
  const sectionCreateLabel: Record<SectionKey, string> = {
    sop: 'Create new SOP',
    racm: 'Create new RACM',
    risks: 'Create new Risk',
    controls: 'Create new Control',
    workflows: 'Create new Workflow',
  };

  // Trigger the create flow for a given section. RACM lives in this component;
  // other sections own their own drawer state and listen for a window event.
  const triggerSectionCreate = (section: SectionKey) => {
    if (section === 'racm') {
      setShowCreateRacm(true);
      return;
    }
    if (section === 'controls') {
      // Controls aren't created directly — they're mapped from a RACM.
      switchDrilledSection('racm');
      addToast({ message: 'Controls are mapped inside a RACM. Open a RACM to define controls.', type: 'info' });
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('process-hub-create', { detail: { section } }));
    }
  };

  // Dropdown menu — used in the BP detail INDEX header. Picks a section,
  // navigates to it, then fires triggerSectionCreate.
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const handleDropdownPick = (section: SectionKey) => {
    setCreateMenuOpen(false);
    if (section !== drilledSection) switchDrilledSection(section);
    // Defer trigger to next tick so the section component has mounted.
    setTimeout(() => triggerSectionCreate(section), 50);
  };

  // RACM editor takeover — full-screen replaces all views while editing
  if (reviewingRacm) {
    return (
      <div className="h-full overflow-y-auto bg-canvas">
        <div className="px-[124px] py-8">
          <ReviewImportWorkspace
            racmName={reviewingRacm.name}
            bpAbbr={bp.abbr}
            fileName={reviewingRacm.sourceFileName || 'imported.xlsx'}
            onBack={() => setReviewingRacmId(null)}
            onFreeze={(importedRows) => {
              const uniqueRisks = new Set(importedRows.filter(r => r.riskId.trim()).map(r => r.riskId));
              const uniqueControls = new Set(importedRows.filter(r => r.controlId.trim()).map(r => r.controlId));
              const keyControlIds = new Set(importedRows.filter(r => r.keyControl && r.controlId.trim()).map(r => r.controlId));
              const mappings = new Set(importedRows.filter(r => r.riskId.trim() && r.controlId.trim()).map(r => `${r.riskId}::${r.controlId}`));
              const framework = importedRows.find(r => r.framework.trim())?.framework || reviewingRacm.framework;
              setCreatedRacms(prev => prev.map(r => r.id === reviewingRacm.id ? {
                ...r, isFrozen: true,
                risks: uniqueRisks.size, controls: uniqueControls.size,
                mappedRisks: uniqueRisks.size, unmappedRisks: 0,
                keyControls: keyControlIds.size, framework,
                workflowCoverage: 0, attributesCoverage: 0, isValidated: true,
              } : r));
              setReviewingRacmId(null);
              addToast({
                message: `RACM "${reviewingRacm.name}" frozen — ${uniqueRisks.size} risks, ${uniqueControls.size} controls, ${mappings.size} mappings created.`,
                type: 'success',
              });
            }}
          />
        </div>
      </div>
    );
  }

  // Drilled view — full-screen content for one section with updated breadcrumb
  if (drilledSection) {
    const info = sectionMeta[drilledSection];
    return (
      <div className="h-full overflow-y-auto bg-canvas">
        <div className="px-[124px] py-8">
          <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 pb-4 mb-6 border-b border-border">
            <div className="font-mono text-[12px] mb-3 tracking-tight flex items-center gap-1.5 min-w-0">
              <button type="button" onClick={onBack} className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5">
                <ArrowLeft size={12} />Process Hub
              </button>
              <span className="text-ink-300">/</span>
              <button type="button" onClick={closeDrilledSection} className="text-ink-500 hover:text-primary transition-colors cursor-pointer truncate">{bp.name}</button>
              <span className="text-ink-300">/</span>
              <span className="text-ink-700 truncate">{info.title}</span>
            </div>

            {/* Section switcher pills + section-specific create button — share one row. */}
            <div className="flex items-center justify-between gap-3 mt-3">
              <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 min-w-0">
              {sectionOrder.map(key => {
                const m = sectionMeta[key];
                const active = drilledSection === key;
                return (
                  <button
                    type="button"
                    key={key}
                    aria-label={`Switch to ${m.title}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => switchDrilledSection(key)}
                    className={`no-focus-ring shrink-0 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-brand-600 text-paper-0'
                        : 'bg-white text-ink-700 border border-canvas-border hover:bg-paper-50'
                    }`}
                  >
                    {sectionPillLabel[key]}
                    {m.count > 0 && (
                      <span className={`ml-1.5 tabular-nums ${active ? 'text-paper-0/80' : 'text-ink-500'}`}>· {m.count}</span>
                    )}
                  </button>
                );
              })}
              </div>
              {/* Section-specific create button — text changes per drilled section. */}
              <button
                type="button"
                onClick={() => triggerSectionCreate(drilledSection)}
                className="no-focus-ring inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-paper-0 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer shrink-0">
                <Plus size={13} />{sectionCreateLabel[drilledSection]}
              </button>
            </div>

          </div>

          {drilledSection === 'sop' && (
            <SOPTabContent
              bpId={bp.id}
              bpAbbr={bp.abbr}
              existingSops={bpSops}
              existingRacms={bpRacms}
              onGoToRacm={() => switchDrilledSection('racm')}
              onRacmCreated={(racmId, racmName, process, framework) => {
                setCreatedRacms(prev => [...prev, {
                  id: racmId, name: racmName, version: 'v1.0', process, framework,
                  risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0,
                  workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false,
                  isFrozen: false,
                }]);
              }}
              onViewRacm={(racmId) => {
                const exists = createdRacms.some(r => r.id === racmId);
                if (!exists) {
                  setCreatedRacms(prev => [...prev, {
                    id: racmId, name: `RACM ${racmId}`, version: 'v1.0', process: bp.abbr, framework: 'SOX ICFR',
                    risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0,
                    workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false,
                    isFrozen: false,
                  }]);
                }
                setReviewingRacmId(racmId);
              }}
            />
          )}
          {drilledSection === 'racm' && (
            <div className="space-y-4">
              <RacmListTable
                processFilter={bp.abbr}
                extraRacms={createdRacms}
                onCreate={() => setShowCreateRacm(true)}
                onEditDraft={(racm) => {
                  const exists = createdRacms.some(r => r.id === racm.id);
                  if (!exists) {
                    setCreatedRacms(prev => [...prev, { ...racm, isFrozen: false }]);
                  }
                  setReviewingRacmId(racm.id);
                }}
                onOpenInEditor={onOpenRacmEditor}
              />
              <AnimatePresence>
                {showCreateRacm && (
                  <CreateRacmFromSOPModal
                    sopName=""
                    bpAbbr={bp.abbr}
                    onClose={() => setShowCreateRacm(false)}
                    onStartReview={(racmName, fileName) => {
                      const racmId = `racm-${Date.now()}`;
                      setCreatedRacms(prev => [...prev, {
                        id: racmId, name: racmName, version: 'v1.0', process: bp.abbr, framework: 'SOX ICFR',
                        risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0,
                        workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false,
                        isFrozen: false, sourceFileName: fileName,
                      }]);
                      setReviewingRacmId(racmId);
                      setShowCreateRacm(false);
                    }}
                    onCreate={(racmName, framework) => {
                      const racmId = `racm-${Date.now()}`;
                      setCreatedRacms(prev => [...prev, {
                        id: racmId, name: racmName, version: 'v1.0', process: bp.abbr, framework,
                        risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0,
                        workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false,
                        isFrozen: true,
                      }]);
                      setShowCreateRacm(false);
                    }}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
          {drilledSection === 'risks' && <RiskRegister processFilter={bp.abbr} />}
          {drilledSection === 'controls' && <ControlDesignTab bpAbbr={bp.abbr} seeded={isSeedProcess} onGoToRacm={() => switchDrilledSection('racm')} />}
          {drilledSection === 'workflows' && <WorkflowGovernanceTab bpAbbr={bp.abbr} seeded={isSeedProcess} onOpenWorkflowDetail={onOpenWorkflowDetail} />}
        </div>
      </div>
    );
  }

  // Index view — header strip + 5 clickable section rows
  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="px-[124px] py-8">
        <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 mb-6 border-b border-border">
          <button type="button" onClick={onBack} className="font-mono text-[12px] text-ink-500 hover:text-primary mb-2 tracking-tight transition-colors cursor-pointer flex items-center gap-1.5">
            <ArrowLeft size={12} />Process Hub
          </button>

          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="font-display text-[34px] font-[420] tracking-tight text-ink-900 leading-[1.15]">{bp.name}</h1>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold tabular-nums text-ink-800">{coverage}%</div>
              <div className="text-[10px] text-text-muted">Coverage</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mb-5 text-[12px] text-text-muted">
            <div className="flex items-center gap-6 min-w-0">
              <span className="font-mono">{bp.abbr}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">Owner:</span>
                <span className="font-medium text-text">{bp.owner ?? 'Tushar Goel'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Status:</span>
                {(() => {
                  const s = bp.status ?? 'Active';
                  const tone =
                    s === 'Active'   ? { wrap: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-700' } :
                    s === 'Draft'    ? { wrap: 'bg-paper-100 text-ink-600',          dot: 'bg-ink-400' } :
                    s === 'Archived' ? { wrap: 'bg-paper-100 text-ink-500',          dot: 'bg-ink-300' } :
                                       { wrap: 'bg-paper-100 text-ink-600',          dot: 'bg-ink-400' };
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${tone.wrap}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                      {s}
                    </span>
                  );
                })()}
              </div>
            </div>
            {/* Create new dropdown — sits at the right end of the meta row. */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setCreateMenuOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={createMenuOpen}
                className="no-focus-ring inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-paper-0 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer">
                Create new
                <ChevronDown size={13} />
              </button>
              {createMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCreateMenuOpen(false)} aria-hidden />
                  <div role="menu" className="absolute right-0 top-full mt-1 z-50 bg-paper-0 border border-canvas-border rounded-[8px] shadow-lg min-w-[180px] overflow-hidden">
                    {([
                      { key: 'sop' as const,        label: 'SOP' },
                      { key: 'racm' as const,       label: 'RACM' },
                      { key: 'risks' as const,      label: 'Risk' },
                      { key: 'controls' as const,   label: 'Control' },
                      { key: 'workflows' as const,  label: 'Workflow' },
                    ]).map(item => (
                      <button
                        type="button"
                        key={item.key}
                        role="menuitem"
                        onClick={() => handleDropdownPick(item.key)}
                        className="w-full px-4 py-2 text-left text-[12px] text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          {bp.description && (
            <p className="text-[13px] text-text-secondary mt-1.5 max-w-2xl pb-5">{bp.description}</p>
          )}
        </div>

        {/* Fresh-BP onboarding banner — only when nothing's set up yet. */}
        {isFreshBP && (
          <div className="mb-5 bg-brand-50/60 border border-brand-200/60 rounded-[12px] p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-[8px] bg-brand-600 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-paper-0" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-[18px] font-[420] tracking-tight text-ink-900 mb-1">Start by uploading an SOP</h3>
              <p className="text-[13px] text-ink-700 leading-snug">
                Upload your first SOP and we&apos;ll extract risks and controls automatically. The other sections unlock once you have a RACM.
              </p>
            </div>
            <button
              type="button"
              onClick={() => switchDrilledSection('sop')}
              className="shrink-0 px-4 py-2 rounded-[8px] bg-brand-600 text-paper-0 text-[13px] font-medium hover:bg-brand-700 transition-colors inline-flex items-center gap-1.5"
            >
              <Upload size={13} />Upload SOP
            </button>
          </div>
        )}

        {/* Attention card — white interior like the section cards below, but
            outlined in a warmer border so it differs by OUTLINE not by FILL. */}
        {!isFreshBP && attentionItems.length > 0 && (
          <div className="mb-5 bg-white border border-mitigated/25 rounded-[12px] overflow-hidden" aria-label="Items needing attention">
            <div className="flex items-center gap-2 px-5 pt-3.5 pb-2">
              <AlertTriangle size={11} className="text-mitigated-700" aria-hidden />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-mitigated-700">
                Needs attention
              </span>
              <span className="text-[10px] uppercase tracking-wider font-mono text-ink-400 tabular-nums">
                · {attentionItems.length}
              </span>
            </div>
            <ul className="divide-y divide-canvas-border/60">
              {attentionItems.map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => switchDrilledSection(item.section)}
                    aria-label={`Open ${item.section}: ${item.text}`}
                    className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-paper-50/40 transition-colors cursor-pointer group"
                  >
                    <span className="text-[13px] text-ink-800 leading-snug flex-1 min-w-0">{item.text}</span>
                    <ChevronRight size={13} className="text-ink-300 group-hover:text-mitigated-700 transition-colors shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {sectionOrder.map(key => {
            const m = sectionMeta[key];
            const ins = sectionInsights[key];
            // Linear unlock: when BP is fresh, only SOP is enabled. RACM unlocks once an SOP exists.
            const locked = isFreshBP && key !== 'sop'
              ? true
              : (key === 'racm' && bpRacms.length === 0 && createdRacms.length === 0 && bpSops.length === 0);
            const lockedReason = key === 'sop'
              ? undefined
              : key === 'racm'
                ? 'Available after the first SOP is uploaded.'
                : 'Available after the first RACM is created.';
            return (
              <SectionCard
                key={key}
                title={m.title}
                count={m.count}
                countLabel={m.countLabel}
                breakdown={ins.breakdown}
                lastActivity={ins.lastActivity}
                health={ins.health}
                locked={locked}
                lockedReason={lockedReason}
                onClick={() => switchDrilledSection(key)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Process detail wrapper — landing now lives in ProgramsView ─── */
export default function BusinessProcesses({ selectedBPId, onSelectBP, userProcesses, onOpenRacmEditor, onOpenWorkflowDetail }: Props) {
  if (selectedBPId) {
    const bp = [...BUSINESS_PROCESSES, ...userProcesses].find(b => b.id === selectedBPId);
    if (bp) return <BPDetailView bp={bp} onBack={() => onSelectBP(null)} onOpenRacmEditor={onOpenRacmEditor} onOpenWorkflowDetail={onOpenWorkflowDetail} />;
  }
  return null;
}

