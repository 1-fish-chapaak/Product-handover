import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search, Plus, Upload, Sparkles,
  ChevronRight, ChevronDown, LayoutGrid,
  ArrowLeft, ArrowRight,
  Building2,
  FileText, FileUp, Check, CheckCircle2, AlertTriangle, X, Eye, Pencil, Loader2, Paperclip, Play, Lock, ShieldCheck, Trash2, Download, RotateCcw,
  HelpCircle, Grid3x3, Shield, Workflow, Zap, Link2, User, Clock, Share2,
} from 'lucide-react';
import { KpiTile } from '../shared/KpiTile';
import { getSopRelationships, getControlRelationships, getWorkflowRelationships, getRacmRelationships } from '../../data/processHubJoins';
import { BUSINESS_PROCESSES, SOPS, RACMS, RISKS, CONTROLS, WORKFLOWS } from '../../data/mockData';
import { getSeedControls, getSeedWorkflows, findSeedControl } from '../../data/processHubSeeds';
import { getCreatedControls, type CreatedControl } from '../../data/createdControlsStore';
import { generateRacmForProcess, type RACMRow } from '../../data/racm';
import type { ProcessCode } from '../../data/engagements';
import type { UserProcess } from '../../hooks/useAppState';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import RacmListTable, { RACM_SEED_DATA } from './RacmListTable';
import { LinkWorkflowToControlDrawer, type ControlWorkflow } from './RacmMappingWorkspace';
import SopDetailDrawer, { DEFAULT_SOP_SECTIONS } from './SopDetailDrawer';
import { BulkExecuteModal } from '../workflow/BulkExecuteModal';
import { AuditLogsView, deterministicCaseCount, type LibraryWorkflow, type BulkRunWorkflowResult } from '../workflow/WorkflowLibraryView';

// Shape of a completed bulk-run, fed to the shared AuditLogsView (same flow as
// the Workflow Library's bulk run).
type BulkAuditRun = { name: string; workflows: BulkRunWorkflowResult[]; skippedCount: number; date: string };
import BPOverviewDashboard from './BPOverviewDashboard';
import ProcessInsightsTab from './ProcessInsightsTab';
import { PROCESS_INSIGHTS } from '../../data/insightMemory';
import RiskRegister, { SEED_RISKS } from './RiskRegister';
import ColumnFilter from '../shared/ColumnFilter';
import ConfirmationModal from '../shared/ConfirmationModal';
import SopDocumentModal from './SopDocumentModal';
import { Button as BaseButton } from '../shared/Button';
// Process Hub standardization: every button gets an 8px (rounded-lg) corner radius. Primary
// CTAs additionally render flat (no shadow) + semibold and lock to a compact h-8 so all
// primary buttons across the Process Hub tabs match the agreed standard.
const Button = (props: React.ComponentProps<typeof BaseButton>) => {
  const isPrimary = (props.variant ?? 'primary') === 'primary';
  return (
    <BaseButton
      {...props}
      className={[/rounded-/.test(props.className ?? '') ? '' : 'rounded-lg!', isPrimary ? 'shadow-none! hover:shadow-none! font-semibold! h-8!' : '', props.className].filter(Boolean).join(' ')}
    />
  );
};
import ListPlaceholder from '../shared/ListPlaceholder';
import ListLoadError from '../shared/ListLoadError';
import FloatingLines from '../shared/FloatingLines';
import DesignControlAddModal from './DesignControlAddModal';
// ControlLibraryView no longer embedded — replaced by ControlDesignTab
// WorkflowLibraryView no longer used — replaced by WorkflowGovernanceTab

// RACMs surfaced in the P2P RACM tab so the list mirrors the "RACM Ready" SOPs in
// the SOP section — each shares its source SOP's name (sop-102/104/105). Injected
// through the RacmListTable `extraRacms` prop (NOT the global RACM_SEED_DATA), so
// Audit Planning and every other RACM consumer stay untouched. Badge state is a
// deliberate mix: Sample SOP + Agrawal Metals read as fully Ready (Active · Ready),
// while Testing RACM is mapped but still Workflow Missing.
const P2P_RACM_READY_RACMS: import('./RacmListTable').RacmEntry[] = [
  { id: 'RACM-102', name: 'Sample SOP', version: 'v1.0', createdAt: 'May 28, 2026', updatedAt: 'Jun 6, 2026', process: 'P2P', framework: 'SOX ICFR', risks: 6, controls: 16, mappedRisks: 6, unmappedRisks: 0, keyControls: 4, workflowCoverage: 100, attributesCoverage: 100, isValidated: true, linkedToEngagement: false },
  { id: 'RACM-104', name: 'Testing RACM (4)_RACM', version: 'v1.0', createdAt: 'May 12, 2026', updatedAt: 'May 30, 2026', process: 'P2P', framework: 'SOX ICFR', risks: 8, controls: 20, mappedRisks: 8, unmappedRisks: 0, keyControls: 5, workflowCoverage: 80, attributesCoverage: 100, isValidated: false, linkedToEngagement: false },
  { id: 'RACM-105', name: 'Agrawal Metals - Part 1 - Fixed Assets - SOP', version: 'v1.0', createdAt: 'Apr 30, 2026', updatedAt: 'May 25, 2026', process: 'P2P', framework: 'SOX ICFR', risks: 7, controls: 19, mappedRisks: 7, unmappedRisks: 0, keyControls: 5, workflowCoverage: 100, attributesCoverage: 100, isValidated: true, linkedToEngagement: false },
];
const P2P_RACM_READY_IDS = new Set(P2P_RACM_READY_RACMS.map(r => r.id));

// A new-tab deep link into the BP detail (?view=bp-detail&bp=&section=&risk=/racm=)
// is captured once at module load. The BP detail strips its own ?section= on its
// first (StrictMode) unmount, which wipes the whole query before the remount can
// read it — so BPDetailView restores this on remount, then consumes it. Mutable
// binding so it only forces the deep link once (not when returning to the BP later).
let BP_DEEPLINK: { bp: string; qs: string } | null = (() => {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  return p.get('view') === 'bp-detail' && p.get('bp')
    ? { bp: p.get('bp')!, qs: window.location.search }
    : null;
})();

// ─── New RACM flow (ported from the engagement RACM tab) ───────────────────
// Two-card chooser: import an existing matrix, or upload an SOP and let IRA
// extract the RACM. Mirrors RACMTab's NewRacmModal so the Process Hub create-
// RACM flow is identical to the engagement one.
function NewRacmModal({ onClose, onUploadRacm, onUploadSop }: { onClose: () => void; onUploadRacm: () => void; onUploadSop: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="New RACM">
      <motion.div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[600px] bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border-light">
          <div>
            <h2 className="text-[1rem] font-bold text-text">Create RACM</h2>
            <p className="text-[0.78125rem] text-text-secondary mt-0.5">Start from an existing matrix, or extract one from an SOP.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"><X size={16} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-3">
          <button onClick={onUploadRacm} className="text-left rounded-xl border border-border-light hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer">
            <div className="p-2 rounded-lg bg-evidence-50 inline-flex mb-3"><FileUp size={16} className="text-evidence-700" /></div>
            <div className="text-[0.84375rem] font-semibold text-text mb-1">Upload a RACM</div>
            <div className="text-[0.71875rem] text-text-muted leading-relaxed">Import an existing matrix (.xlsx / .csv).</div>
          </button>
          <button onClick={onUploadSop} className="text-left rounded-xl border border-border-light hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer">
            <div className="p-2 rounded-lg bg-brand-50 inline-flex mb-3"><Sparkles size={16} className="text-brand-600" /></div>
            <div className="text-[0.84375rem] font-semibold text-text mb-1 flex items-center gap-1.5">Upload an SOP <span className="text-text-muted">→</span> extract</div>
            <div className="text-[0.71875rem] text-text-muted leading-relaxed">IRA reads a procedure (.pdf/.docx) and drafts the RACM.</div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// SOP → RACM extraction overlay (ported from the engagement RACM tab).
function RacmExtractionOverlay({ filename, onCancel }: { filename: string; onCancel?: () => void }) {
  const steps = ['Parsing the SOP document', 'Identifying risks & control points', 'Mapping controls to risks', 'Drafting attributes & test procedures'];
  // Reassure (don't alarm) if extraction runs long, and always offer an escape.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, []);
  // Non-blocking progress card — docked bottom-right where toasts appear, so the
  // user can keep working while the SOP→RACM extraction runs.
  return (
    <motion.div
      role="status" aria-live="polite"
      initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 right-6 z-[110] w-[360px] bg-white rounded-xl shadow-2xl border border-canvas-border p-5"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-brand-50"><Loader2 size={20} className="text-brand-600 animate-spin" /></div>
        <div className="min-w-0">
          <div className="text-[0.875rem] font-bold text-text">Extracting RACM from SOP</div>
          <div className="text-[0.71875rem] text-text-muted truncate flex items-center gap-1"><FileText size={11} />{filename}</div>
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <motion.div key={s} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.32, duration: 0.3 }} className="flex items-center gap-2.5 text-[0.75rem] text-text-secondary">
            <span className="w-4 h-4 rounded-full bg-brand-50 border border-brand-100 inline-flex items-center justify-center shrink-0">
              <Sparkles size={9} className="text-brand-600" />
            </span>
            {s}
          </motion.div>
        ))}
      </div>
      <div className="mt-5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <motion.div className="h-full bg-brand-500 rounded-full" initial={{ width: '6%' }} animate={{ width: '92%' }} transition={{ duration: 1.5, ease: 'easeInOut' }} />
      </div>
      {slow && (
        <p className="mt-3 text-[0.6875rem] text-text-muted text-center">Still working. This is taking longer than usual…</p>
      )}
      {onCancel && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </motion.div>
  );
}

// Derive a readable RACM name from an uploaded file name (mirrors the engagement helper).
function racmNameFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\bSOP\b/ig, '')
    .replace(/\bRACM\b/ig, '')
    .replace(/\bv?\d+(\.\d+)?\b/gi, '')
    .trim();
  return base ? base.replace(/\b\w/g, c => c.toUpperCase()) : '';
}

// Roll up generated RACM rows into the counts the RACM list card needs.
function racmStatsFromRows(rows: RACMRow[]) {
  const risks = new Set(rows.map(r => r.riskId)).size;
  const controls = new Set(rows.map(r => r.controlId)).size;
  const keyControls = new Set(rows.filter(r => r.isKey).map(r => r.controlId)).size;
  const withAttrs = rows.filter(r => r.attributes.length > 0).length;
  const attributesCoverage = rows.length ? Math.round((withAttrs / rows.length) * 100) : 0;
  return { risks, controls, keyControls, attributesCoverage };
}

interface Props {
  selectedBPId: string | null;
  onSelectBP: (id: string | null) => void;
  onOpenEngagement?: (engagementId: string) => void;
  userProcesses: UserProcess[];
  /** Opens the full-page RACM editor for any RACM in the list. */
  onOpenRacmEditor?: (racm: import('./RacmListTable').RacmEntry) => void;
  /** Opens the canonical workflow detail page (shared with Workflow Library). */
  onOpenWorkflowDetail?: (workflowId: string) => void;
  onCreateWorkflow?: () => void;
  onRunWorkflow?: (workflowId: string) => void;
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
    case 'Processed':  return { label: 'Create RACM',       cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
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
  'Unsupported file format: only PDF, DOCX, and XLSX are supported.',
  'File is unreadable: the document may be corrupted or password-protected.',
  'Processing timeout: the document is too large or complex. Try splitting into smaller sections.',
  'No process content detected: the document does not appear to contain standard operating procedures.',
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
          <span className="text-[0.6875rem] font-semibold text-text-muted">Processing: {sop.name}</span>
          <span className="text-[0.6875rem] font-bold text-text tabular-nums">{progressPct}%</span>
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
                  <div className="text-[0.6875rem] leading-tight">{step.label}</div>
                  {state === 'in-progress' && <div className="text-[0.625rem] text-ink-400 mt-0.5">{step.description}</div>}
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

  const defaultRacmName = `FY26 ${sop.businessProcess}: ${sop.name.replace(/\s*SOP\s*/i, '').trim()}`;
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

  const fieldCls = 'w-full px-2 py-1.5 border border-border rounded-md text-[0.75rem] text-text bg-white outline-none focus:border-primary/40';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-3">
          <ArrowLeft size={14} />Back to SOP List
        </button>
        <div className="bg-white rounded-lg border border-canvas-border p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[1rem] font-bold text-text">{sop.name}</h2>
                <span className="text-[0.6875rem] font-mono text-ink-500 bg-paper-50 px-1.5 py-0.5 rounded-xs">{sop.version}</span>
                <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[0.6875rem] text-ink-500">
                <span>Uploaded by {sop.uploadedBy} · {sop.uploadedAt}</span>
                <span className="inline-flex items-center px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-paper-100 text-ink-600 border border-canvas-border/60">{sop.businessProcess}</span>
              </div>
            </div>
          </div>

          {/* CTA section — gating warning sits right next to the action */}
          {isPartial && partialWarnings.length > 0 && (
            <div className="rounded-md border border-mitigated bg-mitigated-50/50 px-4 py-3 mt-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-mitigated-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-[0.75rem] font-semibold text-mitigated-700">Incomplete extraction: review required</div>
                  <p className="text-[0.6875rem] text-mitigated-700/80 mt-0.5">Some information could not be extracted confidently. Review and complete missing items before creating RACM.</p>
                  <ul className="mt-2 space-y-0.5">
                    {partialWarnings.map((w, i) => (
                      <li key={i} className="text-[0.6875rem] text-mitigated-700/70 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-mitigated shrink-0" />{w}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input type="checkbox" checked={partialConfirmed} onChange={e => setPartialConfirmed(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-xs border-mitigated text-mitigated-700 accent-mitigated cursor-pointer" />
                    <span className="text-[0.6875rem] font-medium text-mitigated-700">I have reviewed the gaps and want to proceed</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end mt-3">
            <Button variant="primary" size="sm" shape="lg" onClick={() => setShowConfirmModal(true)} disabled={activeRisks.length === 0 || (isPartial && !partialConfirmed)} leftIcon={<FileText size={13} />}>
              Create RACM
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-md bg-paper-50 border border-canvas-border">
              <div className="text-lg font-bold text-text">{activeRisks.length}</div>
              <div className="text-[0.625rem] text-text-muted">Accepted Risks</div>
            </div>
            <div className="text-center p-3 rounded-md bg-paper-50 border border-canvas-border">
              <div className="text-lg font-bold text-text">{controls.filter(c => c.accepted).length}</div>
              <div className="text-[0.625rem] text-text-muted">Control References</div>
            </div>
            <div className="text-center p-3 rounded-md bg-paper-50 border border-canvas-border">
              <div className="text-lg font-bold text-ink-400">{risks.length - activeRisks.length + controls.length - controls.filter(c => c.accepted).length}</div>
              <div className="text-[0.625rem] text-text-muted">Removed</div>
            </div>
          </div>

          {/* Linked RACM traceability (SOP → RACM) */}
          {sop.racmId && (
            <div className="rounded-md border border-compliant/50 bg-compliant-50/20 px-4 py-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-compliant-50 flex items-center justify-center shrink-0">
                    <FileText size={12} className="text-compliant-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.75rem] font-semibold text-text">{sop.racmName || sop.racmId}</span>
                      <span className="px-1.5 h-4 rounded-xs text-[0.625rem] font-bold bg-paper-100 text-ink-600">Draft</span>
                      <span className="px-1.5 h-4 rounded-xs text-[0.625rem] font-bold bg-mitigated-50 text-mitigated-700">Mapping Incomplete</span>
                    </div>
                    <div className="text-[0.625rem] text-ink-500 mt-0.5">
                      {sop.risks} risks · {sop.controls} control references · Created from this SOP
                    </div>
                  </div>
                </div>
                <button type="button" onClick={onBack}
                  className="px-3 py-1.5 rounded-md text-[0.625rem] font-semibold bg-paper-100 text-ink-600 hover:bg-paper-200/70 cursor-pointer transition-colors inline-flex items-center gap-1">
                  View RACM<ChevronRight size={8} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary — editable */}
      <div className="bg-white rounded-lg border border-canvas-border p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={11} className="text-primary/60" />SOP Summary
          </h3>
          <button type="button" onClick={() => setEditingSummary(!editingSummary)} className="text-[0.625rem] font-medium text-primary hover:underline cursor-pointer">
            {editingSummary ? 'Done' : 'Edit'}
          </button>
        </div>
        {editingSummary ? (
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-border rounded-md text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 resize-none" />
        ) : (
          <p className="text-[0.75rem] text-text-secondary leading-relaxed">{summary}</p>
        )}
      </div>

      {/* Extracted Risks Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[0.8125rem] font-semibold text-text">Extracted Risks ({risks.length})</h3>
          <button type="button" onClick={() => setShowAddRisk(true)} className="text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            <Plus size={11} />New Risk
          </button>
        </div>
        <div className="border-t border-border-light overflow-x-auto">
            <table className="w-full border-collapse text-[0.75rem]">
              <thead className="bg-white border-b border-border-light">
                <tr>
                  {['Risk Name', 'Description', 'Process', 'Source Section', 'Confidence', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[0.6875rem] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                        <span className="text-[0.75rem] font-medium text-text">{risk.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top max-w-[200px]">
                      {editingRiskId === risk.id ? (
                        <input value={risk.description} onChange={e => handleEditRisk(risk.id, 'description', e.target.value)} className={fieldCls} />
                      ) : (
                        <span className="text-[0.6875rem] text-ink-500 line-clamp-2">{risk.description}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <span className="inline-flex items-center px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-paper-100 text-ink-600 border border-canvas-border/60">{sop.businessProcess}</span>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <span className="text-[0.625rem] text-ink-400 font-mono">{risk.section}</span>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <span className={`px-1.5 h-4 rounded-xs text-[0.625rem] font-bold inline-flex items-center ${CONFIDENCE_STYLES[risk.confidence]}`}>{risk.confidence}</span>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label={editingRiskId === risk.id ? 'Save edit' : 'Edit'} onClick={() => setEditingRiskId(editingRiskId === risk.id ? null : risk.id)}
                          className="p-1 rounded-xs hover:bg-paper-100 text-ink-400 hover:text-primary cursor-pointer" title={editingRiskId === risk.id ? 'Save edit' : 'Edit'}>
                          {editingRiskId === risk.id ? <Check size={11} /> : <Pencil size={11} />}
                        </button>
                        <button type="button" aria-label="Remove" onClick={() => handleRemoveRisk(risk.id)}
                          className="p-1 rounded-xs hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer" title="Remove">
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
                    <td className="px-4 py-2 align-top"><span className="text-[0.625rem] text-ink-400">{sop.businessProcess}</span></td>
                    <td className="px-4 py-2 align-top"><input value={newRiskSection} onChange={e => setNewRiskSection(e.target.value)} placeholder="Section" className={fieldCls} /></td>
                    <td className="px-4 py-2 align-top"><span className="text-[0.625rem] text-ink-400">Manual</span></td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Add risk" title="Add risk" onClick={handleAddRisk} disabled={!newRiskName.trim()} className="p-1 rounded-xs bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer disabled:opacity-40"><CheckCircle2 size={11} /></button>
                        <button type="button" aria-label="Cancel" title="Cancel" onClick={() => { setShowAddRisk(false); setNewRiskName(''); setNewRiskDesc(''); }} className="p-1 rounded-xs hover:bg-paper-100 text-ink-400 cursor-pointer"><X size={11} /></button>
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
            <h3 className="text-[0.8125rem] font-semibold text-text">Extracted Control References ({controls.length})</h3>
            <p className="text-[0.625rem] text-ink-400 mt-0.5">References only. Actual controls will be created in the Control Library after RACM review.</p>
          </div>
          <button type="button" onClick={() => setShowAddCtrl(true)} className="text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            <Plus size={11} />New Control reference
          </button>
        </div>
        <div className="border-t border-border-light overflow-x-auto">
            <table className="w-full border-collapse text-[0.75rem]">
              <thead className="bg-white border-b border-border-light">
                <tr>
                  {['Control Reference', 'Related Risk', 'Process', 'Source Section', 'Type', 'Confidence', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[0.6875rem] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                          <span className="text-[0.75rem] font-medium text-text">{ctrl.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="text-[0.6875rem] text-ink-500">{linkedRisk?.name || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="inline-flex items-center px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-paper-100 text-ink-600 border border-canvas-border/60">{sop.businessProcess}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="text-[0.625rem] text-ink-400 font-mono">{ctrl.section || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="px-1.5 h-4 rounded-xs text-[0.625rem] font-bold bg-paper-100 text-ink-500 inline-flex items-center">{ctrl.type}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className={`px-1.5 h-4 rounded-xs text-[0.625rem] font-bold inline-flex items-center ${CONFIDENCE_STYLES[ctrl.confidence]}`}>{ctrl.confidence}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label={editingCtrlId === ctrl.id ? 'Save edit' : 'Edit'} onClick={() => setEditingCtrlId(editingCtrlId === ctrl.id ? null : ctrl.id)}
                            className="p-1 rounded-xs hover:bg-paper-100 text-ink-400 hover:text-primary cursor-pointer" title={editingCtrlId === ctrl.id ? 'Save edit' : 'Edit'}>
                            {editingCtrlId === ctrl.id ? <Check size={11} /> : <Pencil size={11} />}
                          </button>
                          <button type="button" aria-label="Remove" onClick={() => handleRemoveControl(ctrl.id)}
                            className="p-1 rounded-xs hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer" title="Remove">
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
                    <td className="px-4 py-2 align-top"><span className="text-[0.625rem] text-ink-400">{sop.businessProcess}</span></td>
                    <td className="px-4 py-2 align-top"><input value={newCtrlSection} onChange={e => setNewCtrlSection(e.target.value)} placeholder="Section" className={fieldCls} /></td>
                    <td className="px-4 py-2 align-top">
                      <select value={newCtrlType} onChange={e => setNewCtrlType(e.target.value as any)} className={fieldCls + ' cursor-pointer appearance-none'}>
                        <option value="Preventive">Preventive</option>
                        <option value="Detective">Detective</option>
                        <option value="Corrective">Corrective</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 align-top"><span className="text-[0.625rem] text-ink-400">Manual</span></td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Add control reference" title="Add control reference" onClick={handleAddControl} disabled={!newCtrlName.trim()} className="p-1 rounded-xs bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer disabled:opacity-40"><CheckCircle2 size={11} /></button>
                        <button type="button" aria-label="Cancel" title="Cancel" onClick={() => { setShowAddCtrl(false); setNewCtrlName(''); setNewCtrlDesc(''); }} className="p-1 rounded-xs hover:bg-paper-100 text-ink-400 cursor-pointer"><X size={11} /></button>
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px]" onClick={() => setShowConfirmModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }} className="bg-white rounded-xl shadow-2xl border border-canvas-border w-full max-w-[560px]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between">
                  <div>
                    <h2 className="text-[1rem] font-bold text-text">Create Draft RACM from SOP</h2>
                    <p className="text-[0.75rem] text-text-muted mt-0.5">Review the summary below before creating the draft RACM.</p>
                  </div>
                  <button type="button" aria-label="Close" title="Close" onClick={() => setShowConfirmModal(false)} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"><X size={16} /></button>
                </div>

                {/* Summary */}
                <div className="px-6 py-5 space-y-4">
                  {/* Source SOP */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <span className="text-[0.625rem] text-ink-400 uppercase block">Source SOP</span>
                      <span className="text-[0.8125rem] text-text font-medium mt-0.5 block">{sop.name}</span>
                    </div>
                    <div>
                      <span className="text-[0.625rem] text-ink-400 uppercase block">Business Process</span>
                      <span className="text-[0.8125rem] text-text mt-0.5 block">{sop.businessProcess}</span>
                    </div>
                    <div>
                      <span className="text-[0.625rem] text-ink-400 uppercase block">Risks to create</span>
                      <span className="text-[0.8125rem] text-text font-semibold mt-0.5 block">{activeRisks.length}</span>
                    </div>
                    <div>
                      <span className="text-[0.625rem] text-ink-400 uppercase block">Control references</span>
                      <span className="text-[0.8125rem] text-text font-semibold mt-0.5 block">{controls.filter(c => c.accepted).length}</span>
                    </div>
                  </div>

                  {/* RACM Name */}
                  <div>
                    <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">RACM Name</label>
                    <input value={racmName} onChange={e => setRacmName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-md text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 transition-all" />
                  </div>

                  {/* What will happen */}
                  <div className="rounded-md bg-paper-50 border border-canvas-border px-4 py-3 space-y-1.5">
                    <div className="text-[0.6875rem] font-semibold text-text-muted">What will happen:</div>
                    <ul className="space-y-1">
                      {[
                        'RACM created in Draft status (not Active)',
                        `${activeRisks.length} extracted risks linked to RACM`,
                        `${controls.filter(c => c.accepted).length} control references preserved (not mapped to Control Library)`,
                        'Source SOP sections preserved for traceability',
                        'RACM readiness: Mapping Incomplete',
                        'SOP linked to the created RACM',
                      ].map((item, i) => (
                        <li key={i} className="text-[0.6875rem] text-text-secondary flex items-start gap-1.5">
                          <CheckCircle2 size={10} className="text-compliant-700 shrink-0 mt-0.5" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* What will NOT happen */}
                  <div className="rounded-md bg-paper-50 border border-border/30 px-4 py-3 space-y-1.5">
                    <div className="text-[0.6875rem] font-semibold text-ink-500">What will NOT happen:</div>
                    <ul className="space-y-1">
                      {[
                        'Controls will not be created in Control Library',
                        'Workflows will not be linked',
                        'RACM will not be validated or activated',
                      ].map((item, i) => (
                        <li key={i} className="text-[0.6875rem] text-ink-400 flex items-start gap-1.5">
                          <X size={10} className="text-ink-300 shrink-0 mt-0.5" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3">
                  <Button variant="outline" size="md" shape="lg" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
                  <Button variant="primary" size="md" shape="lg" onClick={() => { setShowConfirmModal(false); onAccept(racmName); }} disabled={!racmName.trim()} leftIcon={<FileText size={13} />}>
                    Create Draft RACM
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Upload SOP Modal ────────────────────────────────────────────────────

interface UploadSOPData {
  name: string;
  version: string;
  description: string;
  fileName: string;
}

function UploadSOPModal({ bpAbbr, retrySopName, onClose, onUploadAndProcess, onSaveAsDraft }: {
  bpAbbr: string;
  // When set, the modal is retrying a failed SOP: the name is fixed to the
  // original SOP (the new file does not rename it) and the copy reflects a retry.
  retrySopName?: string;
  onClose: () => void;
  onUploadAndProcess: (data: UploadSOPData) => void;
  onSaveAsDraft: (data: UploadSOPData) => void;
}) {
  const isRetry = !!retrySopName;
  const [name, setName] = useState(retrySopName ?? '');
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
  // Retry pre-fills the name; only flag dirty if the user changed it, picked a
  // file, or typed a description.
  const isDirty = isRetry
    ? (name.trim() !== (retrySopName ?? '').trim() || !!fileName || !!description.trim())
    : !!(name.trim() || description.trim() || fileName);

  const buildData = (): UploadSOPData => ({ name: name.trim(), version: 'v1.0', description: description.trim(), fileName });

  // Discard-aware close handlers.
  const requestClose = () => { if (isDirty) setShowDiscardConfirm(true); else onClose(); };

  // Escape key closes (via requestClose so discard-confirm fires when dirty).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);
  const discardAndClose = () => { setName(''); setDescription(''); setFileName(''); setShowDiscardConfirm(false); onClose(); };
  const cancelClose = () => setShowDiscardConfirm(false);

  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-md text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 transition-all';
  const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isRetry ? 'Retry RACM generation' : 'Upload SOP'}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={requestClose} />
      <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[600px] max-h-[calc(100vh-2rem)] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Discard-changes confirm strip — only shows when user tried to close after editing */}
        {showDiscardConfirm && (
          <div className="p-3 bg-mitigated-50 border-b border-mitigated-200 flex items-center gap-3 text-[0.8125rem]">
            <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0" />
            <div className="flex-1 text-ink-800">Discard unsaved changes?</div>
            <button type="button" onClick={discardAndClose} className="px-3 py-1 rounded-sm bg-paper-0 border border-mitigated-300 text-[0.75rem] text-ink-700 hover:bg-paper-50">Discard</button>
            <button type="button" onClick={cancelClose} className="px-3 py-1 rounded-sm bg-mitigated-700 text-paper-0 text-[0.75rem] hover:bg-mitigated-800">Keep editing</button>
          </div>
        )}

        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-[1rem] font-bold text-ink-900">{isRetry ? 'Retry RACM generation' : 'Upload SOP'}</h2>
            <p className="text-[0.75rem] text-ink-500 mt-0.5">{isRetry ? 'Re-upload a document to retry. The SOP keeps its name.' : 'Upload a process document and define metadata.'}</p>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={requestClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"><X size={16} /></button>
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
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                dragOver ? 'border-primary bg-primary/5' : fileName ? 'border-compliant bg-compliant-50/30' : 'border-border hover:border-canvas-border'
              }`}
            >
              {fileName ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={16} className="text-compliant-700" />
                  <span className="text-[0.75rem] font-medium text-compliant-700">{fileName}</span>
                  <button type="button" aria-label="Remove file" title="Remove file" onClick={e => { e.stopPropagation(); setFileName(''); }} className="text-ink-400 hover:text-risk-700"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <Upload size={18} className={`mx-auto mb-1.5 ${dragOver ? 'text-primary' : 'text-ink-300'}`} />
                  <div className="text-[0.75rem] text-text-muted">Drag & drop or click to browse</div>
                  <div className="text-[0.625rem] text-ink-400 mt-0.5">PDF, DOCX, XLSX, CSV</div>
                </>
              )}
            </div>
          </div>

          {/* SOP Name — editable. On retry it's pre-filled with the SOP's current
              name (so it isn't lost); for a fresh upload it auto-fills from the file. */}
          <div>
            <label className={labelCls}>SOP Name <span className="text-risk">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={isRetry ? 'SOP name' : 'Auto-filled from file name'} className={fieldCls} />
          </div>

          {/* Business Process (read-only) */}
          <div>
            <label className={labelCls}>Business Process</label>
            <div className="px-3 py-2.5 border border-border rounded-md text-[0.8125rem] text-text bg-canvas-elevated cursor-not-allowed">{bpAbbr}</div>
          </div>



          {/* Description */}
          <div>
            <label className={labelCls}>Description <span className="font-normal text-ink-400">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief description of the SOP scope..." className={fieldCls + ' resize-none'} />
          </div>

        </div>

        <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3 shrink-0">
          <Button variant="outline" size="md" shape="lg" onClick={requestClose}>Cancel</Button>
          <Button variant="outline" size="md" shape="lg" onClick={() => { if (isValid) onSaveAsDraft(buildData()); }} disabled={!isValid}>
            Save as Draft
          </Button>
          <Button variant="primary" size="md" shape="lg" onClick={() => { if (isValid) onUploadAndProcess(buildData()); }} disabled={!isValid}>
            Upload & Process
          </Button>
        </div>
      </motion.div>
    </div>
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
  const initialName = sopLabel ? `FY26 ${bpAbbr}: ${sopLabel}` : '';
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

  // Escape key closes the drawer (respects discard-confirm when dirty).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-md text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 transition-all';
  const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1.5';

  const handleFileUpload = (fileName: string) => {
    setUploadedFile(fileName);
    setUploadParsing(true);
    if (!name) setName(`FY26 ${bpAbbr}: ${fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')}`);
    // Simulate parsing delay
    setTimeout(() => {
      setUploadParsing(false);
      setUploadParsed(true);
      setExtractedStats({ risks: 5, controls: 7, rows: 7 });
      addToast({ message: `"${fileName}" parsed: 5 risks, 7 controls extracted.`, type: 'success' });
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
        className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]" onClick={requestClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[600px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">

        {/* Discard-changes confirm strip — only shows when user tried to close after editing */}
        {showDiscardConfirm && (
          <div className="p-3 bg-mitigated-50 border-b border-mitigated-200 flex items-center gap-3 text-[0.8125rem]">
            <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0" />
            <div className="flex-1 text-ink-800">Discard unsaved changes?</div>
            <button type="button" onClick={discardAndClose} className="px-3 py-1 rounded-sm bg-paper-0 border border-mitigated-300 text-[0.75rem] text-ink-700 hover:bg-paper-50">Discard</button>
            <button type="button" onClick={cancelClose} className="px-3 py-1 rounded-sm bg-mitigated-700 text-paper-0 text-[0.75rem] hover:bg-mitigated-800">Keep editing</button>
          </div>
        )}

        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-[1rem] font-bold text-ink-900">Create RACM</h2>
            <p className="text-[0.75rem] text-ink-500 mt-0.5">Define a new Risk &amp; Control Matrix for audit governance.</p>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={requestClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ─── Form Fields (always visible once source chosen or immediately) ─── */}
          <div className="space-y-3">
            <h3 className="text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider">Basic Info</h3>
            <div>
              <label className={labelCls}>RACM Name <span className="text-risk">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FY26 P2P: Vendor Payment" className={fieldCls} autoFocus />
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
              <div className="px-3 py-2.5 border border-border rounded-md text-[0.8125rem] text-text bg-paper-50/80 cursor-not-allowed flex items-center gap-2">
                <Building2 size={13} className="text-ink-400 shrink-0" />
                <span>{bpAbbr}</span>
                <span className="ml-auto text-[0.625rem] text-ink-400">Auto-filled</span>
              </div>
            </div>
          </div>

          {/* ─── Source Type Selection ─── */}
          <div className="space-y-3">
            <h3 className="text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider">Source Type</h3>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'blank' as const, label: 'Start Blank', desc: 'Add risks & controls manually', icon: Plus, disabled: false },
                { id: 'upload' as const, label: 'Upload RACM File', desc: 'Import from Excel, CSV, PDF', icon: Upload, disabled: false },
                { id: 'sop' as const, label: 'Generate from SOP', desc: hasSopSource ? 'Extract from uploaded SOP' : 'Upload a SOP first', icon: Sparkles, disabled: !hasSopSource },
              ] as const).map(opt => (
                <button type="button" key={opt.id} onClick={() => { if (!opt.disabled) setSource(opt.id); }}
                  disabled={opt.disabled}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${
                    source === opt.id
                      ? 'border-primary bg-primary/5'
                      : opt.disabled
                        ? 'border-border-light bg-paper-50/50 opacity-50 cursor-not-allowed'
                        : 'border-border-light hover:border-primary/30 hover:bg-primary/5 cursor-pointer'
                  }`}>
                  <opt.icon size={16} className={`mb-1.5 ${source === opt.id ? 'text-primary' : 'text-ink-400'}`} />
                  <div className={`text-[0.75rem] font-semibold ${source === opt.id ? 'text-primary' : 'text-text'}`}>{opt.label}</div>
                  <div className="text-[0.625rem] text-text-muted mt-0.5 leading-snug">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Upload Section (only when source is upload) ─── */}
          {source === 'upload' && (
            <div className="space-y-3">
              <h3 className="text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider">Upload File</h3>
              {!uploadedFile ? (
                <div onClick={() => {
                    const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls,.csv,.pdf';
                    input.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleFileUpload(f.name); };
                    input.click();
                  }}
                  className="border-2 border-dashed border-border-light rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 hover:bg-paper-50/50 transition-all">
                  <Upload size={22} className="mx-auto text-ink-300 mb-2" />
                  <div className="text-[0.8125rem] font-semibold text-text">Drop file here or click to browse</div>
                  <div className="text-[0.6875rem] text-text-muted mt-1">Supported: Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf)</div>
                </div>
              ) : (
                <div className="rounded-md border border-canvas-border bg-surface-2/30 p-4 space-y-3">
                  {/* File info */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] font-semibold text-text truncate">{uploadedFile}</p>
                      <p className="text-[0.625rem] text-text-muted mt-0.5">
                        {uploadParsing ? 'Parsing file…' : uploadParsed && extractedStats ? `${extractedStats.rows} rows · ${extractedStats.risks} risks · ${extractedStats.controls} controls extracted` : 'Ready'}
                      </p>
                    </div>
                    {uploadParsing ? (
                      <Loader2 size={16} className="text-primary animate-spin shrink-0" />
                    ) : (
                      <button type="button" aria-label="Remove file" onClick={handleRemoveFile} className="p-1.5 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors" title="Remove file"><X size={14} /></button>
                    )}
                  </div>

                  {/* Extracted summary */}
                  {uploadParsed && extractedStats && (
                    <div className="flex items-center gap-2 p-2.5 bg-compliant-50/40 rounded-md border border-compliant/60">
                      <CheckCircle2 size={12} className="text-compliant-700 shrink-0" />
                      <span className="text-[0.6875rem] text-compliant-700">File parsed successfully. Review the imported structure in the next step to validate and finalize.</span>
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
            <Button variant="outline" size="md" shape="lg" onClick={requestClose}>Cancel</Button>
            <Button
              variant="primary"
              size="md"
              shape="lg"
              onClick={() => {
                if (!isFormValid) return;
                if (isUploadReview && onStartReview) {
                  onStartReview(name.trim(), uploadedFile!);
                  onClose();
                } else {
                  onCreate(name.trim(), framework || 'Internal Policy');
                }
              }}
              disabled={ctaDisabled}
              leftIcon={isUploadReview ? <Eye size={14} /> : undefined}
            >
              {ctaLabel}
            </Button>
          </div>
        )}
      </motion.aside>
    </>
  );
}

// ─── SOP Detail Page (Step 4 — detail-page pattern) ───────────────────────

function SOPDetailPage({ sop, onGoToRacm }: {
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

      <div className="bg-white border border-canvas-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span>
              <span className="font-mono text-[0.6875rem] text-ink-500">{sop.id}</span>
            </div>
            <h1 className="text-[1.625rem] font-semibold tracking-tight text-ink-900 leading-[1.2]">{sop.name}</h1>
          </div>
          {rels.racm && onGoToRacm && (
            <Button
              variant="primary"
              size="sm"
              shape="lg"
              onClick={onGoToRacm}
              className="shrink-0"
              rightIcon={<ArrowRight size={13} />}
            >
              Go to RACM
            </Button>
          )}
        </div>

        {sop.description && (
          <p className="text-[0.8125rem] text-text leading-relaxed mb-5 max-w-3xl">{sop.description}</p>
        )}

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-canvas-border/70">
          {fields.map(f => (
            <div key={f.label}>
              <span className="text-[0.625rem] text-ink-400 uppercase block tracking-wider mb-0.5">{f.label}</span>
              {f.pill ? (
                <span className={`mt-0.5 px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span>
              ) : (
                <span className={`text-[0.8125rem] block ${f.mono ? 'font-mono text-ink-700' : 'text-text'}`}>{f.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-canvas-border rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[0.8125rem] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <FileText size={13} className="text-ink-500" />
              Linked RACM
            </h2>
            <span className="text-[0.75rem] font-mono text-ink-400 tabular-nums">{rels.racm ? 1 : 0}</span>
          </div>
          {!rels.racm ? (
            <p className="text-[0.75rem] text-ink-400 italic">Not linked to a RACM yet. Process the SOP to extract risks and controls into a draft RACM.</p>
          ) : (
            <div className="rounded-md border border-canvas-border bg-paper-50/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug truncate flex-1">{rels.racm.name}</span>
                <span className="text-[0.625rem] font-mono text-ink-400 tabular-nums shrink-0">{rels.racm.fw}</span>
              </div>
              <span className="text-[0.6875rem] text-ink-500 leading-snug">Owner: {rels.racm.owner} · Last run: {rels.racm.lastRun}</span>
            </div>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[0.8125rem] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-ink-500" />
              Extracted Risks
            </h2>
            <span className="text-[0.75rem] font-mono text-ink-400 tabular-nums">{rels.risks.length}</span>
          </div>
          {rels.risks.length === 0 ? (
            <p className="text-[0.75rem] text-ink-400 italic">No risks extracted yet.</p>
          ) : (
            <ul className="space-y-2">
              {rels.risks.map(r => (
                <li key={r.id} className="rounded-md border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[0.625rem] text-ink-400 tabular-nums shrink-0 mt-0.5">{r.id}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug">{r.name}</span>
                      <span className="text-[0.6875rem] text-ink-500 leading-snug block">Severity: {r.severity} · Status: {r.status}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[0.8125rem] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-ink-500" />
              Extracted Controls
            </h2>
            <span className="text-[0.75rem] font-mono text-ink-400 tabular-nums">{rels.controls.length}</span>
          </div>
          {rels.controls.length === 0 ? (
            <p className="text-[0.75rem] text-ink-400 italic">No controls extracted yet.</p>
          ) : (
            <ul className="space-y-2">
              {rels.controls.map(c => (
                <li key={c.id} className="rounded-md border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[0.625rem] text-ink-400 tabular-nums shrink-0 mt-0.5">{c.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug">{c.name}</span>
                        {c.isKey && <span className="px-1.5 h-4 rounded-xs text-[0.625rem] font-bold inline-flex items-center bg-mitigated-50 text-mitigated-700 shrink-0">Key</span>}
                      </div>
                      <span className="text-[0.6875rem] text-ink-500 leading-snug">{c.desc}</span>
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
  const { can } = useCan();
  const logEvent = useAuditLog();
  const [localSops, setLocalSops] = useState<LocalSOP[]>(() =>
    existingSops.map((s, idx) => ({
      id: s.id, name: s.name, fileName: `${s.name.replace(/\s+/g, '_')}.pdf`, version: s.version,
      description: '', businessProcess: bpAbbr,
      uploadedBy: s.by, uploadedAt: s.at,
      status: (s.racmId ? 'Linked' : idx % 3 === 0 ? 'Processed' : 'Draft') as SOPStatus,
      progress: s.racmId ? 100 : 0, processingStep: s.racmId ? 6 : 0,
      risks: s.risks, controls: s.controls, racmId: s.racmId, racmName: s.racmId ? `FY26 ${bpAbbr}: ${s.name.replace(/\s*SOP\s*/i, '').trim()}` : null,
      failureReason: s.status === 'failed' ? 'RACM generation timed out. No progress for over 15 minutes. Please re-upload the SOP to retry.' : null,
      extractedRisks: s.racmId ? [] : buildMockExtractions().risks,
      extractedControls: s.racmId ? [] : buildMockExtractions().controls,
    }))
  );

  const [reviewingSopId, setReviewingSopId] = useState<string | null>(null);
  const [viewingSopId, setViewingSopId] = useState<string | null>(null);
  const [confirmDeleteSop, setConfirmDeleteSop] = useState<{ id: string; name: string } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  // When set, the Upload SOP modal is in "retry" mode — the re-uploaded file
  // replaces this failed SOP in place instead of creating a new SOP row.
  const [retryingSopId, setRetryingSopId] = useState<string | null>(null);
  const [showCreateRacmForSopId, setShowCreateRacmForSopId] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState<{ data: UploadSOPData; startProcessing: boolean; existing: LocalSOP } | null>(null);
  const [sopStatusFilter, setSopStatusFilter] = useState<string[]>([]);
  const [detailSopId, setDetailSopId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('sop');
  });
  const [fileTypeFilter, setFileTypeFilter] = useState<string[]>([]);
  const [uploaderFilter, setUploaderFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // URL sync — ?sop=sop-001
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get('sop');
    if (detailSopId && current !== detailSopId) {
      params.set('sop', detailSopId);
      window.history.pushState({ ...window.history.state, sop: detailSopId }, '', `?${params.toString()}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else if (!detailSopId && current) {
      params.delete('sop');
      const qs = params.toString();
      window.history.pushState({ ...window.history.state, sop: null }, '', qs ? `?${qs}` : window.location.pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
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
  const retryingSop = retryingSopId ? localSops.find(s => s.id === retryingSopId) ?? null : null;

  // Derive a friendly file type label from the filename extension (e.g. "PDF").
  const getFileType = useCallback((sop: LocalSOP) => {
    const m = sop.fileName.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toUpperCase() : 'FILE';
  }, []);

  // Local data is ready immediately; only reveal a skeleton if loading genuinely
  // exceeds ~150ms (e.g. a future remote source). For today's local data it never shows.
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    const armSkeleton = setTimeout(() => setShowSkeleton(true), 150);
    setIsLoading(false); // synchronous local data — ready right away
    return () => clearTimeout(armSkeleton);
  }, []);

  // Listen for header-level "Upload SOP" trigger.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: string }>;
      if (ce.detail?.section === 'sop') setShowUploadModal(true);
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
    setShowUploadModal(false);

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
      addToast({ message: `"${data.name}" processed: ${risks.length} risks and ${controls.length} controls extracted. Review to create draft RACM.`, type: 'success' });
    }, 4500);
  }, [addToast, bpAbbr]);

  // Retry a failed SOP — replace the failed record in place with the re-uploaded
  // document and re-run RACM generation, instead of adding a new SOP row.
  const handleRetrySOP = useCallback((data: UploadSOPData) => {
    const sopId = retryingSopId;
    if (!sopId) return;
    setShowUploadModal(false);
    setRetryingSopId(null);

    const { risks, controls } = buildMockExtractions();
    const uploadDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Swap in the new file + metadata, clear the failure, and restart processing.
    // racmId is cleared for now so the card reads "Processing", not "RACM Ready".
    setLocalSops(prev => prev.map(s => s.id === sopId ? {
      ...s,
      name: data.name || s.name,  // retry saves the (editable) name from the modal
      fileName: data.fileName,
      version: s.version,  // and its original version
      description: data.description,
      uploadedBy: 'Current User',
      uploadedAt: uploadDate,
      status: 'Processing' as SOPStatus,
      progress: 0, processingStep: 0,
      failureReason: null,
      racmId: null, racmName: null,
      risks: 0, controls: 0,
      extractedRisks: risks, extractedControls: controls,
    } : s));

    addToast({ message: `Retrying "${data.name}"…`, type: 'info' });

    const stepDelays = [500, 1000, 1800, 2500, 3200, 3800, 4200];
    stepDelays.forEach((delay, stepIdx) => {
      setTimeout(() => {
        setLocalSops(prev => prev.map(s => s.id === sopId
          ? { ...s, processingStep: stepIdx, progress: Math.round((stepIdx / 6) * 100) }
          : s));
      }, delay);
    });

    // Success — RACM generated: attach a RACM so the card flips to "RACM Ready".
    setTimeout(() => {
      setLocalSops(prev => prev.map(s => {
        if (s.id !== sopId) return s;
        return {
          ...s,
          progress: 100, processingStep: 6,
          risks: risks.filter(r => r.accepted).length,
          controls: controls.filter(c => c.accepted).length,
          racmId: `RACM-${Date.now()}`,
          racmName: `FY26 ${bpAbbr}: ${(data.name || s.name).replace(/\s*SOP\s*/i, '').trim()}`,
          failureReason: null,
          status: 'Linked' as SOPStatus,
        };
      }));
      addToast({ message: `"${data.name}" retried. RACM generated with ${risks.length} risks and ${controls.length} controls.`, type: 'success' });
    }, 4500);
  }, [retryingSopId, bpAbbr, addToast]);

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
      addToast({ message: `"${sop.name}" processed: ${risks.length} risks and ${controls.length} controls extracted.`, type: 'success' });
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
    const name = racmName || `FY26 ${sop.businessProcess}: ${sop.name.replace(/\s*SOP\s*/i, '').trim()}`;

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
      case 'Create RACM':       setShowCreateRacmForSopId(sop.id); break;
      case 'Edit RACM Draft':   if (sop.racmId && onViewRacm) onViewRacm(sop.racmId); break;
      case 'Configure RACM':    if (sop.racmId && onViewRacm) onViewRacm(sop.racmId); break;
      case 'View SOP':          setViewingSopId(sop.id); break;
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

        {/* Upload SOP Modal (keep available even in review) */}
        <AnimatePresence>
          {showUploadModal && (
            <UploadSOPModal bpAbbr={bpAbbr} retrySopName={retryingSop?.name} onClose={() => { setShowUploadModal(false); setRetryingSopId(null); }}
              onUploadAndProcess={(data) => retryingSopId ? handleRetrySOP(data) : handleUploadIntent(data, true)} onSaveAsDraft={(data) => retryingSopId ? handleRetrySOP(data) : handleUploadIntent(data, false)} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Sort: latest version first (higher version number = first), then newest upload date.
  // Apply search + status + file type + uploader filters on top of the sorted list.
  const sortedSops = useMemo(() => {
    const sorted = [...localSops].sort((a, b) => {
      const parseVer = (v: string) => {
        const m = v.match(/v(\d+)\.(\d+)/);
        return m ? parseInt(m[1]) * 1000 + parseInt(m[2]) : 0;
      };
      const vDiff = parseVer(b.version) - parseVer(a.version);
      if (vDiff !== 0) return vDiff;
      return b.id.localeCompare(a.id);
    });
    const q = searchQuery.trim().toLowerCase();
    return sorted.filter(s => {
      if (sopStatusFilter.length > 0 && !sopStatusFilter.includes(s.status)) return false;
      if (fileTypeFilter.length > 0 && !fileTypeFilter.includes(getFileType(s))) return false;
      if (uploaderFilter.length > 0 && !uploaderFilter.includes(s.uploadedBy)) return false;
      if (q) {
        const hay = `${s.name} ${s.id} ${s.uploadedBy}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [localSops, sopStatusFilter, fileTypeFilter, uploaderFilter, searchQuery, getFileType]);

  const sopStatusOptions = useMemo<SOPStatus[]>(
    () => ['Draft', 'Processing', 'Processed', 'Linked', 'Archived'],
    []
  );
  const fileTypeOptions = useMemo(
    () => Array.from(new Set(localSops.map(s => getFileType(s)))).sort(),
    [localSops, getFileType]
  );
  const uploaderOptions = useMemo(
    () => Array.from(new Set(localSops.map(s => s.uploadedBy))).sort(),
    [localSops]
  );

  // Selection helpers — keyed off the currently visible (filtered) cards.
  const visibleIds = sortedSops.map(s => s.id);
  const selectedVisibleCount = selectedIds.filter(id => visibleIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    else setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const clearSelection = () => setSelectedIds([]);

  const archiveSop = (id: string) => {
    const target = localSops.find(s => s.id === id);
    setLocalSops(prev => prev.map(s => s.id === id ? { ...s, status: 'Archived' as SOPStatus } : s));
    setSelectedIds(prev => prev.filter(x => x !== id));
    if (target) addToast({ message: `"${target.name}" archived`, type: 'info' });
    if (target) logEvent({ action: 'Update', description: `Archived SOP "${target.name}"`, module: 'Process Hub', entity: 'SOP' });
  };

  const hasAnyFilter =
    searchQuery.trim().length > 0 ||
    sopStatusFilter.length > 0 ||
    fileTypeFilter.length > 0 ||
    uploaderFilter.length > 0;

  const clearAllFilters = () => {
    setSearchQuery('');
    setSopStatusFilter([]);
    setFileTypeFilter([]);
    setUploaderFilter([]);
  };

  // CTA-pill filter dropdown — right-aligned panel, multi-select with count badge.
  // Defined inline so we don't have to extend the shared ColumnFilter component.
  function FilterCTA({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: string[];
    value: string[];
    onChange: (next: string[]) => void;
  }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const hasFilter = value.length > 0;

    useEffect(() => {
      if (!open) return;
      const onDoc = (e: MouseEvent) => {
        if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
      };
      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onEsc);
      return () => {
        document.removeEventListener('mousedown', onDoc);
        document.removeEventListener('keydown', onEsc);
      };
    }, [open]);

    const toggle = (opt: string) => {
      onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
    };

    return (
      <div ref={wrapRef} className="relative inline-flex">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[0.75rem] font-medium cursor-pointer transition-colors ${
            hasFilter
              ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
              : 'border-border bg-white text-ink-700 hover:bg-paper-50'
          }`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          {label}
          {hasFilter && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-brand-600 text-white text-[0.625rem] font-bold tabular-nums">
              {value.length}
            </span>
          )}
          <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full right-0 mt-1.5 z-50 w-[220px] bg-white border border-border-light rounded-md shadow-lg normal-case tracking-normal">
            <div className="px-3 py-2 border-b border-border-light flex items-center justify-between">
              <span className="text-[0.625rem] uppercase tracking-wider font-semibold text-ink-500">Filter {label}</span>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[0.625rem] text-brand-700 hover:text-brand-600 cursor-pointer font-medium"
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="py-1 max-h-[260px] overflow-y-auto">
              {options.length === 0 ? (
                <li className="px-3 py-2 text-[0.75rem] text-ink-400 italic">No options</li>
              ) : options.map(opt => {
                const checked = value.includes(opt);
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => toggle(opt)}
                      className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[0.75rem] text-ink-800 hover:bg-paper-50 cursor-pointer"
                    >
                      <span className={`w-3.5 h-3.5 inline-flex items-center justify-center rounded-xs border ${checked ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-300'}`}>
                        {checked && <Check size={9} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{opt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

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

  if (!isLoading && loadError) {
    return <ListLoadError label="SOPs" onRetry={() => setLoadError(false)} />;
  }

  return (
    <div>
      {/* Empty state — only after loading settles so we don't flash it. */}
      {!isLoading && localSops.length === 0 ? (
        <ListPlaceholder
          icon={FileText}
          title="No SOPs yet"
          body="Upload a process document. IRA drafts a RACM from it for your review."
          action={can('bp_create') && (
            <Button variant="primary" size="md" onClick={() => setShowUploadModal(true)}>Upload SOP</Button>
          )}
        />
      ) : (
        <>
          {/* Filter row — search on the LEFT, Clear all + CTA filter pills on the RIGHT.
              -mt-4 cancels the shared header's mb-4 so the header→search gap is exactly
              py-5 (20px); pb-5 keeps the search→list gap at 20px too. */}
          <div className="flex items-center justify-between gap-3 py-5 -mt-4">
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search SOPs..."
                className="pl-9 pr-3 h-9 rounded-md border border-border bg-white text-[0.75rem] w-[260px] placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[0.6875rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer px-2 py-1"
                >
                  Clear all
                </button>
              )}
              <FilterCTA label="Status" options={sopStatusOptions as string[]} value={sopStatusFilter} onChange={setSopStatusFilter} />
              <FilterCTA label="File type" options={fileTypeOptions} value={fileTypeFilter} onChange={setFileTypeFilter} />
              <FilterCTA label="User" options={uploaderOptions} value={uploaderFilter} onChange={setUploaderFilter} />
              {can('bp_create') && (
              <Button variant="primary" size="md" shape="lg" onClick={() => setShowUploadModal(true)} disabled={searchQuery.trim().length > 0} title={searchQuery.trim().length > 0 ? 'Clear search to create' : undefined} className="shrink-0 rounded-md! text-[0.75rem]!" leftIcon={<Plus size={13} />}>
                Upload SOP
              </Button>
              )}
            </div>
          </div>

          {/* Bulk-select strip — only renders when ≥1 card is selected. */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 px-6 py-2.5 bg-brand-50/40 border-t border-border-light">
              <input
                type="checkbox"
                aria-label="Select all visible SOPs"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded-xs border border-ink-300 cursor-pointer accent-brand-600"
              />
              <span className="text-[0.6875rem] text-ink-700">
                <span className="font-semibold tabular-nums">{selectedVisibleCount}</span>
                <span className="text-ink-500"> of </span>
                <span className="font-semibold tabular-nums">{visibleIds.length}</span>
                <span className="text-ink-500"> selected</span>
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="ml-auto text-[0.6875rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* SOP cards */}
          <div className="min-h-[calc(100vh-280px)] pb-4 space-y-2">
            {isLoading && showSkeleton ? (
              [...Array(5)].map((_, i) => (
                <div key={`skel-sop-card-${i}`} className="px-6 py-5 rounded-xl border border-border-light bg-white">
                  <div className="grid grid-cols-[28px_2.6fr_1fr_1.7fr_80px] gap-5 items-start">
                    <div className="h-3.5 w-3.5 rounded-xs bg-paper-100 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-3 bg-paper-100 rounded-xs animate-pulse w-2/3" />
                      <div className="h-2.5 bg-paper-100 rounded-xs animate-pulse w-5/6" />
                      <div className="h-2.5 bg-paper-100 rounded-xs animate-pulse w-1/2" />
                    </div>
                    <div className="h-3 bg-paper-100 rounded-xs animate-pulse w-3/4" />
                    <div className="h-3 bg-paper-100 rounded-xs animate-pulse w-1/2" />
                    <div className="h-3 bg-paper-100 rounded-xs animate-pulse" />
                  </div>
                </div>
              ))
            ) : sortedSops.length === 0 ? (
              <ListPlaceholder
                icon={Search}
                title="No matching SOPs"
                body="Nothing matched your search or filters. Try a different combination."
                action={hasAnyFilter && (
                  <button type="button" onClick={clearAllFilters} className="text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">Clear all</button>
                )}
              />
            ) : (
              sortedSops.map((sop, i) => {
                // Status shown to match the SOP-section screenshot:
                //   failed generation → "Generation Failed" (red)
                //   SOP with a RACM   → "RACM Ready" (green)
                const statusLabel = sop.failureReason ? 'Generation Failed' : sop.racmId ? 'RACM Ready' : sop.status;
                const statusCls = sop.failureReason
                  ? 'bg-risk-50 text-risk-700'
                  : sop.racmId
                    ? 'bg-compliant-50 text-compliant-700'
                    : SOP_STATUS_STYLES[sop.status];
                // RACM Ready = has a RACM and generation didn't fail. Only these
                // open their RACM on card-body click; everything else is inert.
                const isRacmReady = !sop.failureReason && !!sop.racmId;
                // Commented out — these drove elements not present in the screenshot
                // (status spinner, selection, extraction summary, file-type, readiness):
                // const isProcessing = sop.status === 'Processing';
                // const isChecked = selectedIds.includes(sop.id);
                // const extractedRiskCount = sop.extractedRisks?.length ?? 0;
                // const extractedControlCount = sop.extractedControls?.length ?? 0;
                // const hasExtraction = extractedRiskCount > 0 || extractedControlCount > 0;
                // const fileType = getFileType(sop);
                // const currentStep = PROCESSING_STEPS[sop.processingStep] ?? PROCESSING_STEPS[0];

                return (
                  <motion.div
                    key={sop.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={`rounded-xl border bg-white transition-all cursor-default ${sop.status === 'Archived' ? 'border-border-light opacity-60' : 'border-border-light'}`}
                  >
                    <div className="flex items-start gap-4 px-6 py-5">
                    {/* Main — name + status badge inline, failure message, uploader · date.
                        Card layout per the Risk-card reference (image #21); same data as the table. */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <span className="text-[0.9375rem] font-semibold text-ink-900 leading-snug">{sop.name}</span>
                        <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${statusCls}`}>
                          {statusLabel}
                        </span>
                        <span className="text-[0.6875rem] font-mono text-ink-500 bg-paper-50 px-1.5 py-0.5 rounded-xs">{sop.version}</span>
                      </div>
                      {sop.failureReason && (
                        <div className="mb-1.5">
                          <p className="text-[0.8125rem] text-risk-700 leading-snug">{sop.failureReason}</p>
                          <button
                            type="button"
                            onClick={() => { setRetryingSopId(sop.id); setShowUploadModal(true); }}
                            aria-label={`Retry RACM generation for ${sop.name}`}
                            title="Retry"
                            className="mt-1 inline-flex items-center gap-1 text-[0.75rem] font-medium text-risk-700 hover:text-risk-800 cursor-pointer"
                          >
                            <RotateCcw size={13} />Retry
                          </button>
                        </div>
                      )}
                      <div className="text-[0.75rem] text-ink-400">
                        {sop.uploadedBy}
                        <span className="mx-1.5">·</span>
                        Uploaded {sop.uploadedAt}
                      </div>
                    </div>

                    {/* Actions — view + download + delete (retry is the inline icon at the end of the error message). */}
                    <div onClick={e => e.stopPropagation()} className="flex items-center gap-0.5 shrink-0">
                      <div className="relative group/view">
                        <button
                          type="button"
                          onClick={() => setViewingSopId(sop.id)}
                          aria-label={`View ${sop.name}`}
                          className="w-10 h-10 rounded-sm inline-flex items-center justify-center text-ink-500 hover:bg-brand-50 hover:text-primary cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
                        >
                          <Eye size={15} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/view:opacity-100 pointer-events-none transition-opacity z-50">
                          View SOP
                        </span>
                      </div>
                      <div className="relative group/download">
                        <button
                          type="button"
                          onClick={() => addToast({ message: `Downloading ${sop.name}…`, type: 'info' })}
                          aria-label="Download SOP"
                          className="w-10 h-10 rounded-sm inline-flex items-center justify-center text-ink-500 hover:bg-brand-50 hover:text-primary cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
                        >
                          <Download size={15} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/download:opacity-100 pointer-events-none transition-opacity z-50">
                          Download SOP
                        </span>
                      </div>
                      {can('sop_archive') && (
                      <div className="relative group/delete">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSop({ id: sop.id, name: sop.name })}
                          aria-label={`Delete ${sop.name}`}
                          className="w-10 h-10 rounded-sm inline-flex items-center justify-center text-ink-500 hover:bg-brand-50 hover:text-risk-700 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
                        >
                          <Trash2 size={15} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/delete:opacity-100 pointer-events-none transition-opacity z-50">
                          Delete
                        </span>
                      </div>
                      )}
                    </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Upload SOP Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <UploadSOPModal
            bpAbbr={bpAbbr}
            retrySopName={retryingSop?.name}
            onClose={() => { setShowUploadModal(false); setRetryingSopId(null); }}
            onUploadAndProcess={(data) => retryingSopId ? handleRetrySOP(data) : handleUploadIntent(data, true)}
            onSaveAsDraft={(data) => retryingSopId ? handleRetrySOP(data) : handleUploadIntent(data, false)}
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

      {/* Delete-SOP confirmation */}
      <ConfirmationModal
        open={!!confirmDeleteSop}
        title="Delete this SOP?"
        description={confirmDeleteSop
          ? <>This removes <span className="font-semibold text-ink-700">{confirmDeleteSop.name}</span> from this process. You can&apos;t undo this here.</>
          : undefined}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => { if (confirmDeleteSop) archiveSop(confirmDeleteSop.id); setConfirmDeleteSop(null); }}
        onClose={() => setConfirmDeleteSop(null)}
      />

      {/* SOP document viewer */}
      {(() => {
        const viewingSop = localSops.find(s => s.id === viewingSopId);
        return (
          <SopDocumentModal
            open={!!viewingSop}
            sopId={viewingSop?.id}
            sopName={viewingSop?.name ?? ''}
            version={viewingSop?.version}
            uploadedBy={viewingSop?.uploadedBy}
            uploadedAgo={viewingSop?.uploadedAt}
            sections={DEFAULT_SOP_SECTIONS}
            onDownload={(kind) => viewingSop && addToast({ message: `Downloading ${viewingSop.name}${kind ? ` (${kind})` : ''}…`, type: 'info' })}
            onClose={() => setViewingSopId(null)}
          />
        );
      })()}

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
                  transition={{ duration: 0.2 }} className="bg-white rounded-xl shadow-2xl border border-canvas-border w-full max-w-[440px]" onClick={e => e.stopPropagation()}>

                  <div className="px-6 pt-5 pb-4 border-b border-canvas-border">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={16} className="text-mitigated-700" />
                      <h2 className="text-[1rem] font-bold text-text">SOP already exists</h2>
                    </div>
                    <p className="text-[0.75rem] text-text-muted">An SOP with this name already exists for this process.</p>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {/* Existing SOP info */}
                    <div className="rounded-md border border-canvas-border bg-surface-2/30 px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[0.75rem] font-semibold text-text">{existing.name}</span>
                        <span className="text-[0.625rem] font-mono text-ink-500 bg-paper-50 px-1 py-0.5 rounded-xs">{existing.version}</span>
                        <span className={`px-1.5 h-4 rounded-xs text-[0.625rem] font-bold inline-flex items-center ${SOP_STATUS_STYLES[existing.status]}`}>{existing.status}</span>
                      </div>
                      <div className="text-[0.6875rem] text-ink-500">
                        {existing.uploadedBy} · {existing.uploadedAt}
                        {isLinked && <span className="ml-2 text-primary">Linked to {existing.racmId}</span>}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                      <button type="button" onClick={() => handleVersionConflictResolve('new-version')}
                        className="w-full text-left px-4 py-3 rounded-md border border-canvas-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                        <div className="text-[0.75rem] font-semibold text-text">Upload as new version</div>
                        <div className="text-[0.6875rem] text-ink-500 mt-0.5">Creates {existing.version.replace(/\d+$/, m => String(Number(m) + 1))}. Keeps existing SOP and linked RACM intact.</div>
                      </button>

                      {canReplace ? (
                        <button type="button" onClick={() => handleVersionConflictResolve('replace')}
                          className="w-full text-left px-4 py-3 rounded-md border border-canvas-border hover:border-mitigated hover:bg-mitigated-50/30 transition-all cursor-pointer">
                          <div className="text-[0.75rem] font-semibold text-text">Replace existing draft</div>
                          <div className="text-[0.6875rem] text-ink-500 mt-0.5">Removes the {existing.status.toLowerCase()} SOP and uploads the new file in its place.</div>
                        </button>
                      ) : (
                        <div className="px-4 py-3 rounded-md border border-canvas-border bg-paper-50 opacity-60">
                          <div className="text-[0.75rem] font-medium text-ink-400">Replace existing</div>
                          <div className="text-[0.6875rem] text-ink-400 mt-0.5">Cannot replace: SOP is {existing.status.toLowerCase()}{isLinked ? ' and linked to a RACM' : ''}.</div>
                        </div>
                      )}

                      <button type="button" onClick={() => handleVersionConflictResolve('cancel')}
                        className="w-full text-left px-4 py-3 rounded-md border border-canvas-border hover:bg-paper-50 transition-all cursor-pointer">
                        <div className="text-[0.75rem] font-medium text-ink-500">Cancel</div>
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
// A linked workflow chip on an attribute (engagement-style: code + full name).
interface AttrWorkflow { code: string; name: string; }
type AttrResult = 'Pass' | 'Fail' | 'Pending';
// Test attribute under a control — mirrors the engagement Controls model so the
// per-control KPIs (Tested / Effective / Failed / Pending) and the control↔workflow
// mapping have something to count.
interface ControlAttribute { id: string; description: string; result: AttrResult; workflows: AttrWorkflow[]; }
export interface DesignControl {
  id: string; name: string; description: string; classification: 'Key' | 'Non-Key';
  nature: string; automation: string; frequency: string;
  mappedRisks: string[]; workflows: BoundWorkflow[];
  usedInRACMs: number; assertions: string[];
  attributes: ControlAttribute[];
  /** Set on controls created from the engagement-style "New control" modal. */
  subProcess?: string; custom?: boolean; inRacm?: boolean;
}

// ── Control test status (derived from a control's attribute results) ──────────
type CtrlStatus = 'Effective' | 'In Test' | 'Failed' | 'Pending';
function deriveControlStatus(attrs: ControlAttribute[]): CtrlStatus {
  if (attrs.length === 0) return 'Pending';
  if (attrs.some(a => a.result === 'Fail')) return 'Failed';
  if (attrs.every(a => a.result === 'Pass')) return 'Effective';
  if (attrs.some(a => a.result === 'Pass')) return 'In Test';
  return 'Pending';
}
const CTRL_STATUS_CLS: Record<CtrlStatus, string> = {
  Effective: 'bg-compliant-50 text-compliant-700 border-compliant-50',
  'In Test': 'bg-evidence-50 text-evidence-700 border-evidence-100',
  Failed:    'bg-risk-50 text-risk-700 border-risk-50',
  Pending:   'bg-draft-50 text-draft-700 border-canvas-border',
};
const CTRL_STATUS_DOT: Record<CtrlStatus, string> = {
  Effective: 'bg-compliant', 'In Test': 'bg-evidence-600', Failed: 'bg-risk', Pending: 'bg-draft',
};
// KPI-as-filter keys for the Controls list — each maps to a status bucket; 'total' = show all.
type StatusKpi = 'total' | 'tested' | 'effective' | 'failed' | 'pending';

// Pill style for control Nature — shared by the Controls list card and the
// control detail header. Falls back to a neutral pill for unknown values.
function naturePillCls(nature: string): string {
  if (nature === 'Preventive') return 'bg-compliant-50 text-compliant-700 border-compliant-50';
  if (nature === 'Detective') return 'bg-mitigated-50 text-mitigated-700 border-mitigated-50';
  if (nature === 'Corrective') return 'bg-high-50 text-high-700 border-high-50';
  return 'bg-paper-100 text-ink-600 border-canvas-border';
}
// Pill style for control Automation (Automated / Manual / IT-dependent).
function automationPillCls(automation: string): string {
  if (automation === 'Automated') return 'bg-evidence-50 text-evidence-700 border-evidence-100';
  if (automation === 'IT-dependent') return 'bg-brand-50 text-brand-700 border-brand-100';
  return 'bg-paper-100 text-ink-600 border-canvas-border';
}

// Seed controls/workflows now live in ../../data/processHubSeeds.ts, keyed per
// process (getSeedControls / getSeedWorkflows / findSeedControl), so each process
// shows its own — and an un-built process shows none.

// Persist the live controls list (seed + created + edits) so a control opened in a
// real new browser tab can resolve its data. Keyed per business process.
// v2: bumped when controls became per-process. The old code saved the shared P2P
// seed under every process's key, so v1 storage would wrongly show P2P controls on
// O2C/S2C/R2R. The new key starts those processes clean (P2P re-seeds from its own).
const controlsStoreKey = (bpAbbr: string) => `irame.processhub.controls.v2.${bpAbbr || 'P2P'}`;
function loadStoredControls(bpAbbr: string): DesignControl[] | null {
  try {
    const raw = localStorage.getItem(controlsStoreKey(bpAbbr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // Backfill `attributes` for any control persisted by an older shape, pulling
    // from the seed by id so the detail page always has mapping data to show.
    return (parsed as DesignControl[]).map(c => {
      if (Array.isArray(c.attributes) && c.attributes.length > 0) return c;
      const seed = findSeedControl(c.id);
      return { ...c, attributes: c.attributes ?? seed?.attributes ?? [] };
    });
  } catch { return null; }
}
function saveStoredControls(bpAbbr: string, controls: DesignControl[]) {
  try { localStorage.setItem(controlsStoreKey(bpAbbr), JSON.stringify(controls)); } catch { /* ignore */ }
}

// Workflow pool used by the attribute "Map" picker on the control detail page.
const WORKFLOW_POOL: AttrWorkflow[] = [
  { code: 'WF-P2P-001', name: 'PO Validation Workflow' },
  { code: 'WF-P2P-002', name: 'GRN Matching Workflow' },
  { code: 'WF-P2P-003', name: 'Invoice Match Workflow' },
  { code: 'WF-P2P-004', name: 'Vendor Change Monitor' },
  { code: 'WF-P2P-005', name: 'Duplicate Invoice Detector' },
  { code: 'WF-P2P-006', name: 'Payment Approval Review' },
  { code: 'WF-P2P-007', name: 'Three-Way Match Reconciliation' },
  { code: 'WF-P2P-008', name: 'Payment Run Approval' },
];

// ─── Control Detail Page (Step 4) ────────────────────────────────────────
function ControlDetailPage({ ctrl, bpAbbr, onBack }: {
  ctrl: DesignControl;
  bpAbbr: string;
  onBack: () => void;
}) {
  const bp = BUSINESS_PROCESSES.find(b => b.abbr === bpAbbr);
  const risks = bp ? RISKS.filter(r => ctrl.mappedRisks.includes(r.id) && r.bpId === bp.id) : RISKS.filter(r => ctrl.mappedRisks.includes(r.id));
  const racms = bp ? RACMS.filter(r => r.bpId === bp.id) : [];

  // Open a risk / RACM in a new tab on the Process Hub BP detail (deep-linked to
  // the right section + entity; the BP detail restores section/risk/racm from URL).
  const bpId = bp?.id ?? '';
  const openInHub = (section: 'risks' | 'racm', key: 'risk' | 'racm', id: string) => {
    const params = new URLSearchParams({ view: 'bp-detail', bp: bpId, section });
    if (id) params.set(key, id); // no id (unresolved RACM) → land on the section list
    window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank');
  };
  // The control's "Found in RACMs" uses mockData ids (RACM-001), but the hub's RACM
  // summary page is keyed differently (racm-001) — resolve case-insensitively to a
  // real hub RACM id so the summary opens; '' when there's no match.
  const resolveRacmId = (id: string): string =>
    [...RACM_SEED_DATA, ...P2P_RACM_READY_RACMS]
      .filter(r => r.process === bpAbbr)
      .find(r => r.id.toLowerCase() === id.toLowerCase())?.id ?? '';

  // Attributes are editable here (workflow Map / unlink), so they live in local
  // state and write back to the per-BP store the list reads from.
  const [attributes, setAttributes] = useState<ControlAttribute[]>(ctrl.attributes ?? []);
  const [mapAttrId, setMapAttrId] = useState<string | null>(null);
  const [showAiMap, setShowAiMap] = useState(false);
  const [draftAttr, setDraftAttr] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    const stored = loadStoredControls(bpAbbr) ?? getSeedControls(bpAbbr);
    const next = stored.map(c => (c.id === ctrl.id ? { ...c, attributes } : c));
    saveStoredControls(bpAbbr, next);
  }, [attributes, bpAbbr, ctrl.id]);

  const status = deriveControlStatus(attributes);
  const workflowsLinked = new Set(attributes.flatMap(a => a.workflows.map(w => w.code))).size;

  const linkWf = (attrId: string, wf: AttrWorkflow) =>
    setAttributes(prev => prev.map(a => (a.id === attrId && !a.workflows.some(w => w.code === wf.code) ? { ...a, workflows: [...a.workflows, wf] } : a)));
  const unlinkWf = (attrId: string, code: string) =>
    setAttributes(prev => prev.map(a => (a.id === attrId ? { ...a, workflows: a.workflows.filter(w => w.code !== code) } : a)));
  // Add-attribute flow (engagement-style): user-added attributes get an -X<n> id.
  const submitAddAttr = () => {
    const desc = draftAttr.trim();
    if (!desc) return;
    const xCount = attributes.filter(a => /-X\d+$/.test(a.id)).length;
    setAttributes(prev => [...prev, { id: `${ctrl.id}-X${xCount + 1}`, description: desc, result: 'Pending', workflows: [] }]);
    setDraftAttr('');
    addToast({ message: 'Attribute added', type: 'success' });
  };

  // Classification / Nature / Automation are surfaced as header pills now, so the
  // grid keeps only the remaining facts (shown once).
  const fields = [
    { label: 'Frequency', value: ctrl.frequency || '—' },
    { label: 'Assertions', value: ctrl.assertions.length > 0 ? ctrl.assertions.join(', ') : '—' },
    { label: 'Used in RACMs', value: String(ctrl.usedInRACMs), mono: true },
  ];
  const mapAttr = mapAttrId ? attributes.find(a => a.id === mapAttrId) ?? null : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-canvas-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[0.6875rem] text-ink-500">{ctrl.id}</span>
              <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${ctrl.classification === 'Key' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-paper-100 text-ink-500'}`}>{ctrl.classification}</span>
            </div>
            <h1 className="text-[1.625rem] font-semibold tracking-tight text-ink-900 leading-[1.2]">{ctrl.name}</h1>
          </div>
          {/* Status + Nature + Automation tags */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Control status chip — commented out for now (per request). Uncomment to restore Effective / Failed / In Test / Pending.
            <span className={`px-2.5 h-7 rounded-full text-[0.6875rem] font-semibold border inline-flex items-center gap-1.5 ${CTRL_STATUS_CLS[status]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${CTRL_STATUS_DOT[status]}`} />{status}
            </span>
            */}
            <span className={`px-2.5 h-7 rounded-full text-[0.6875rem] font-semibold border inline-flex items-center ${naturePillCls(ctrl.nature)}`}>{ctrl.nature || '—'}</span>
            <span className={`px-2.5 h-7 rounded-full text-[0.6875rem] font-semibold border inline-flex items-center ${automationPillCls(ctrl.automation)}`}>{ctrl.automation || '—'}</span>
          </div>
        </div>

        <p className="text-[0.8125rem] text-text leading-relaxed mb-5 max-w-3xl">{ctrl.description}</p>

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-canvas-border/70">
          {fields.map(f => (
            <div key={f.label}>
              <span className="text-[0.625rem] text-ink-400 uppercase block tracking-wider mb-0.5">{f.label}</span>
              <span className={`text-[0.8125rem] block ${f.mono ? 'font-mono text-ink-700' : 'text-text'}`}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-control KPI strip — coverage mix. Same count-up + spring + hover
          effect as the BP Overview KPIs. */}
      <div className="grid grid-cols-4 gap-3">
        <KpiTile label="Attributes"      value={String(attributes.length)} index={0} />
        <KpiTile label="Workflows Linked" value={String(workflowsLinked)}  index={1} />
        <KpiTile label="Risks Mapped"    value={String(risks.length)}      index={2} />
        <KpiTile label="Used in RACMs"   value={String(ctrl.usedInRACMs)}  index={3} />
      </div>

      {/* Control & workflow mapping — attributes with their linked workflows */}
      <div className="bg-white border border-canvas-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[0.8125rem] font-bold text-ink-900 inline-flex items-center gap-1.5">
            <Workflow size={13} className="text-ink-500" />
            Attributes
          </h2>
          <div className="flex items-center gap-2.5">
            <span className="text-[0.75rem] font-mono text-ink-400 tabular-nums">{attributes.length} attribute{attributes.length !== 1 ? 's' : ''}</span>
            <button
              onClick={() => setShowAiMap(true)}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-[0.75rem] font-semibold hover:bg-brand-100 cursor-pointer transition-colors"
            >
              <Sparkles size={13} /> AI Map
            </button>
          </div>
        </div>
        {attributes.length === 0 ? (
          <p className="text-[0.75rem] text-ink-400 italic">No attributes on this control yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-canvas-border">
                  <th className="py-2 pr-4 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">Attribute</th>
                  <th className="py-2 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">Linked Workflows</th>
                </tr>
              </thead>
              <tbody>
                {attributes.map(attr => (
                  <tr key={attr.id} className="border-b border-canvas-border/60 last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <div className="font-mono text-[0.65625rem] font-semibold text-brand-700">{attr.id}</div>
                      <div className="text-[0.78125rem] text-ink-800 leading-snug">{attr.description}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {attr.workflows.map(w => (
                          <span key={w.code} title={w.name} className="inline-flex items-center gap-1 pl-1.5 pr-0.5 h-[22px] rounded-md bg-brand-50 border border-brand-100 text-[0.65625rem] font-semibold text-brand-700">
                            <Workflow size={10} className="shrink-0" />
                            <span className="font-mono">{w.code}</span>
                            <button onClick={() => unlinkWf(attr.id, w.code)} className="p-0.5 rounded hover:bg-brand-100 text-brand-600 hover:text-brand-800 cursor-pointer transition-colors" aria-label={`Unlink ${w.code}`}>
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => setMapAttrId(attr.id)}
                          className="inline-flex items-center gap-1 px-2 h-[22px] rounded-md border border-dashed border-canvas-border bg-white text-[0.65625rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 cursor-pointer transition-colors"
                        >
                          <Link2 size={11} className="shrink-0" />
                          Workflow
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Add attribute — engagement-style input + button (new ids get an -X<n> suffix) */}
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draftAttr}
            onChange={e => setDraftAttr(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitAddAttr(); }}
            placeholder="Add an attribute to this control..."
            className="flex-1 px-3 py-2 rounded-lg border border-dashed border-canvas-border bg-white text-[0.78125rem] text-ink-700 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
          />
          <button
            onClick={submitAddAttr}
            disabled={!draftAttr.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-ink-300 disabled:cursor-not-allowed text-white text-[0.78125rem] font-semibold cursor-pointer transition-colors"
          >
            <Plus size={13} /> Attribute
          </button>
        </div>
      </div>

      {/* Mapped Risks */}
      <div className="bg-white border border-canvas-border rounded-lg p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[0.8125rem] font-bold text-ink-900 inline-flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-ink-500" />
            Mapped Risks
          </h2>
          <span className="text-[0.75rem] font-mono text-ink-400 tabular-nums">{risks.length}</span>
        </div>
        {risks.length === 0 ? (
          <p className="text-[0.75rem] text-ink-400 italic">No risks mapped yet.</p>
        ) : (
          <ul className="space-y-2">
            {risks.map(r => (
              <li
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => openInHub('risks', 'risk', r.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInHub('risks', 'risk', r.id); } }}
                title="Open risk in a new tab"
                className="rounded-md border border-canvas-border bg-paper-50/40 px-3 py-2.5 cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span className="font-mono text-[0.625rem] text-ink-400 tabular-nums shrink-0 mt-0.5">{r.id}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug">{r.name}</span>
                    <span className="text-[0.6875rem] text-ink-500 leading-snug block">Severity: {r.severity} · Status: {r.status}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Found in RACMs */}
      <div className="bg-white border border-canvas-border rounded-lg p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[0.8125rem] font-bold text-ink-900 inline-flex items-center gap-1.5">
            <FileText size={13} className="text-ink-500" />
            Found in RACMs
          </h2>
          <span className="text-[0.75rem] font-mono text-ink-400 tabular-nums">{ctrl.usedInRACMs}</span>
        </div>
        {racms.length === 0 ? (
          <p className="text-[0.75rem] text-ink-400 italic">Not part of any RACM.</p>
        ) : (
          <ul className="space-y-2">
            {racms.map(r => (
              <li
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => openInHub('racm', 'racm', resolveRacmId(r.id))}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInHub('racm', 'racm', resolveRacmId(r.id)); } }}
                title="Open RACM in a new tab"
                className="rounded-md border border-canvas-border bg-paper-50/40 px-3 py-2.5 cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug truncate flex-1">{r.name}</span>
                  <span className="text-[0.625rem] font-mono text-ink-400 tabular-nums shrink-0">{r.fw}</span>
                </div>
                <span className="text-[0.6875rem] text-ink-500 leading-snug">Owner: {r.owner}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mapAttr && (
        <AttrWorkflowMapModal
          attr={mapAttr}
          onClose={() => setMapAttrId(null)}
          onLink={wf => linkWf(mapAttr.id, wf)}
          onUnlink={code => unlinkWf(mapAttr.id, code)}
        />
      )}
      {showAiMap && (
        <AiMapPanel
          attributes={attributes}
          onClose={() => setShowAiMap(false)}
          onAccept={(attrId, wf) => linkWf(attrId, wf)}
        />
      )}
    </div>
  );
}

// ─── AI Map — suggested attribute → workflow pairings (review panel) ──────────
function AiMapPanel({ attributes, onClose, onAccept }: {
  attributes: ControlAttribute[];
  onClose: () => void;
  onAccept: (attrId: string, wf: AttrWorkflow) => void;
}) {
  type Sugg = { attrId: string; attrDesc: string; wf: AttrWorkflow };
  const { addToast } = useToast();
  // One plausible workflow per attribute that isn't already linked (offset by
  // index for variety). Stands in for an AI suggestion engine.
  const [pending, setPending] = useState<Sugg[]>(() =>
    attributes
      .map((attr, i): Sugg | null => {
        const linked = new Set(attr.workflows.map(w => w.code));
        const pool = WORKFLOW_POOL.filter(w => !linked.has(w.code));
        const wf = pool.length ? pool[i % pool.length] : null;
        return wf ? { attrId: attr.id, attrDesc: attr.description, wf } : null;
      })
      .filter((s): s is Sugg => !!s),
  );
  const accept = (s: Sugg) => {
    onAccept(s.attrId, s.wf);
    setPending(prev => prev.filter(p => p !== s));
    addToast({ message: `Linked ${s.wf.code} to ${s.attrId}`, type: 'success' });
  };
  const dismiss = (s: Sugg) => setPending(prev => prev.filter(p => p !== s));

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] bg-canvas-elevated rounded-xl border border-canvas-border shadow-xl z-50 flex flex-col max-h-[85vh]"
        role="dialog" aria-label="AI workflow suggestions"
      >
        <header className="shrink-0 px-5 pt-4 pb-3 border-b border-canvas-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-600" />
            <h2 className="text-[1rem] font-bold text-ink-900">AI workflow suggestions</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60" aria-label="Close"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {pending.length === 0 ? (
            <div className="text-center py-10">
              <Sparkles size={20} className="text-ink-300 mx-auto mb-2" />
              <p className="text-[0.8125rem] font-semibold text-ink-700">All caught up</p>
              <p className="text-[0.75rem] text-ink-400">No more workflow suggestions for these attributes.</p>
            </div>
          ) : pending.map((s, i) => (
            <div key={`${s.attrId}-${i}`} className="rounded-lg border border-canvas-border bg-white px-3 py-2.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[0.65625rem] font-semibold text-brand-700">{s.attrId}</span>
                  <p className="text-[0.75rem] text-ink-700 leading-snug">{s.attrDesc}</p>
                  <div className="mt-1.5 inline-flex items-center gap-1 pl-1.5 pr-2 h-[22px] rounded-md bg-brand-50 border border-brand-100 text-[0.65625rem] font-semibold text-brand-700">
                    <Sparkles size={10} className="shrink-0" />
                    <span className="font-mono">{s.wf.code}</span>
                    <span className="text-brand-500 font-normal">· {s.wf.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="primary" size="sm" onClick={() => accept(s)}>Accept</Button>
                  <Button variant="outline" size="sm" onClick={() => dismiss(s)}>Dismiss</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <footer className="shrink-0 px-5 py-3 border-t border-canvas-border flex justify-end">
          <Button variant="primary" size="md" onClick={onClose}>Done</Button>
        </footer>
      </motion.div>
    </>
  );
}

// ─── Attribute → workflow map picker ─────────────────────────────────────────
function AttrWorkflowMapModal({ attr, onClose, onLink, onUnlink }: {
  attr: ControlAttribute;
  onClose: () => void;
  onLink: (wf: AttrWorkflow) => void;
  onUnlink: (code: string) => void;
}) {
  const [q, setQ] = useState('');
  const linked = new Set(attr.workflows.map(w => w.code));
  const options = WORKFLOW_POOL.filter(w =>
    w.name.toLowerCase().includes(q.trim().toLowerCase()) || w.code.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] bg-canvas-elevated rounded-xl border border-canvas-border shadow-xl z-50 flex flex-col max-h-[85vh]"
        role="dialog" aria-label="Map workflows"
      >
        <header className="shrink-0 px-5 pt-4 pb-3 border-b border-canvas-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow size={16} className="text-brand-600" />
            <h2 className="text-[1rem] font-bold text-ink-900">Map workflows</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60" aria-label="Close"><X size={16} /></button>
        </header>
        <div className="px-5 pt-3 pb-2 shrink-0">
          <p className="text-[0.71875rem] text-ink-500 mb-2"><span className="font-mono text-brand-700">{attr.id}</span> · {attr.description}</p>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search workflows..."
              className="w-full pl-9 pr-3 py-2 border border-canvas-border rounded-lg text-[0.78125rem] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1.5">
          {options.length === 0 ? (
            <p className="text-[0.75rem] text-ink-400 italic py-4 text-center">No workflows match.</p>
          ) : options.map(w => {
            const on = linked.has(w.code);
            return (
              <button key={w.code} onClick={() => (on ? onUnlink(w.code) : onLink(w))}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left cursor-pointer transition-colors ${on ? 'border-brand-200 bg-brand-50/60' : 'border-canvas-border bg-white hover:bg-canvas/50'}`}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-brand-600 border-brand-600' : 'border-ink-300'}`}>
                  {on && <Check size={11} className="text-white" />}
                </span>
                <span className="font-mono text-[0.6875rem] font-semibold text-brand-700 shrink-0">{w.code}</span>
                <span className="text-[0.78125rem] text-ink-800 flex-1 min-w-0 truncate">{w.name}</span>
              </button>
            );
          })}
        </div>
        <footer className="shrink-0 px-5 py-3 border-t border-canvas-border flex items-center justify-between gap-3">
          <button
            onClick={() => window.open(`${window.location.origin}${window.location.pathname}?view=chat&compose=workflow`, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-200 bg-brand-50/50 text-brand-700 text-[0.78125rem] font-semibold hover:bg-brand-50 cursor-pointer transition-colors"
          >
            <Plus size={13} /> Create workflow
          </button>
          <Button variant="primary" size="md" onClick={onClose}>Done</Button>
        </footer>
      </motion.div>
    </>
  );
}

// ─── Standalone control detail (opened in a real new browser tab) ────────────
// Wired in App.tsx at ?view=control-detail&controlId=…&bp=…. Resolves the control
// from the per-BP store (so seeded AND just-created controls open correctly).
export function ControlDetailStandalone() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const controlId = params.get('controlId') ?? '';
  const bpAbbr = params.get('bp') ?? 'P2P';
  const controls = loadStoredControls(bpAbbr) ?? getSeedControls(bpAbbr);
  const ctrl = controls.find(c => c.id === controlId);
  const { can } = useCan();
  const { openShare } = useShare();
  const back = () => { if (window.opener && !window.opener.closed) window.close(); else window.history.back(); };
  // Exactly the RACM detail takeover layout: same scroll container, the same
  // px-[124px] gutters, and the same white back-trail bar above the content.
  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="px-[124px] py-8">
        <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 pb-4 mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            className="font-mono text-[0.75rem] tracking-tight text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft size={12} />Back to controls
          </button>
          {ctrl && can('ctrl_share') && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openShare({ type: 'control', id: ctrl.id, anchor: rectFromEvent(e) }); }}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-canvas-border bg-white text-[0.75rem] font-semibold text-text-secondary hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
            >
              <Share2 size={14} /> Share
            </button>
          )}
        </div>
        {ctrl ? (
          <ControlDetailPage ctrl={ctrl} bpAbbr={bpAbbr} onBack={back} />
        ) : (
          <div className="text-center py-20">
            <p className="text-[0.875rem] font-semibold text-ink-800 mb-1">Control not found</p>
            <p className="text-[0.75rem] text-ink-500">This control isn’t available in this tab. Reopen it from the Controls list.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Map a wizard-created control (shared-store shape) into the Controls-tab shape.
function toDesignControl(c: CreatedControl): DesignControl {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    classification: c.classification,
    nature: c.nature,
    automation: c.automation,
    frequency: c.frequency,
    mappedRisks: c.mappedRisks,
    workflows: [],
    usedInRACMs: 0,
    assertions: c.assertions,
    attributes: [],
    subProcess: c.subProcess,
    custom: true,
    inRacm: false,
  };
}

function ControlDesignTab({ bpAbbr, seeded, onGoToRacm }: { bpAbbr: string; seeded: boolean; onGoToRacm?: () => void }) {
  // `onGoToRacm` powers the empty-state "Open RACM" CTA.
  const { addToast } = useToast();
  const { can } = useCan();
  const { openShare } = useShare();
  const logEvent = useAuditLog();
  // Hydrate from the per-BP store so edits made in a detail tab (workflow Map /
  // unlink) and just-created controls survive across the list and the new tab.
  const [controls, setControls] = useState<DesignControl[]>(() => {
    const base = loadStoredControls(bpAbbr) ?? getSeedControls(bpAbbr);
    // Merge in wizard-created controls for this process (newest first), deduped by
    // id so one already persisted into this store on a prior visit isn't doubled.
    const seen = new Set(base.map(c => c.id));
    const createdForBp = getCreatedControls()
      .filter(c => c.businessProcess === bpAbbr && !seen.has(c.id))
      .map(toDesignControl);
    return [...createdForBp, ...base];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string[]>([]);
  const [natureFilter, setNatureFilter] = useState<string[]>([]);
  const [automationFilter, setAutomationFilter] = useState<string[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<string[]>([]);
  // KPI-as-filter: clicking a KPI tile narrows the list below by control status.
  // 'total' = show all (default); 'tested' = Effective + In Test + Failed.
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  // Control whose "Link workflow" drawer is open (Controls-tab card action).
  const [linkWfCtrlId, setLinkWfCtrlId] = useState<string | null>(null);

  // Persist whenever the list changes, and re-hydrate when this tab regains focus
  // (a control detail opened in another browser tab may have edited workflow links).
  useEffect(() => { saveStoredControls(bpAbbr, controls); }, [bpAbbr, controls]);
  useEffect(() => {
    const rehydrate = () => { const s = loadStoredControls(bpAbbr); if (s) setControls(s); };
    window.addEventListener('focus', rehydrate);
    return () => window.removeEventListener('focus', rehydrate);
  }, [bpAbbr]);

  // Clicking a control opens its detail in a real new browser tab. We persist the
  // list first so the new tab resolves the control (incl. just-created ones), and
  // intentionally omit `noopener` so the detail tab's "Back" can close itself.
  const openControlInNewTab = (id: string) => {
    saveStoredControls(bpAbbr, controls);
    const params = new URLSearchParams({ view: 'control-detail', controlId: id, bp: bpAbbr });
    window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank');
  };

  // Local data is ready immediately; only reveal a skeleton if loading genuinely
  // exceeds ~150ms (e.g. a future remote source). For today's local data it never shows.
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    const armSkeleton = setTimeout(() => setShowSkeleton(true), 150);
    setIsLoading(false); // synchronous local data — ready right away
    return () => clearTimeout(armSkeleton);
  }, []);

  const matchesSearch = (c: DesignControl) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  };

  // Per-control derived status — drives the KPI tiles, the KPI status filter, and
  // each card's status pill. Declared above the filter so the list can read it.
  const controlStatuses = useMemo(
    () => new Map(controls.map(c => [c.id, deriveControlStatus(c.attributes ?? [])])),
    [controls],
  );

  const filteredControls = controls.filter(c => {
    if (!matchesSearch(c)) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(controlStatuses.get(c.id) ?? 'Pending')) return false;
    if (classificationFilter.length > 0 && !classificationFilter.includes(c.classification)) return false;
    if (natureFilter.length > 0 && !natureFilter.includes(c.nature)) return false;
    if (automationFilter.length > 0 && !automationFilter.includes(c.automation)) return false;
    if (frequencyFilter.length > 0 && !frequencyFilter.includes(c.frequency)) return false;
    return true;
  });

  // Options for the filter dropdowns. Classification is derived directly from
  // the data — current seed values are 'Key' | 'Non-Key'. The remaining three
  // pull unique values from the controls list so filters always reflect what
  // can actually appear in the cards below.
  const classificationOptions = Array.from(new Set(controls.map(c => c.classification).filter(Boolean))).sort();
  const natureOptions = Array.from(new Set(controls.map(c => c.nature).filter(Boolean))).sort();
  const automationOptions = Array.from(new Set(controls.map(c => c.automation).filter(Boolean))).sort();
  const frequencyOptions = Array.from(new Set(controls.map(c => c.frequency).filter(Boolean))).sort();

  // Bulk select + bulk archive (in-memory archive — removes from list, no API).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visibleIds = filteredControls.map(c => c.id);
  const selectedVisibleCount = visibleIds.filter(id => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    else setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleArchiveOne = (id: string) => {
    logEvent({ action: 'Update', description: `Archived control ${id}`, module: 'Control Library', entity: 'Control' });
    setControls(prev => prev.filter(c => c.id !== id));
    setSelectedIds(prev => prev.filter(s => s !== id));
    addToast({ message: `Control archived`, type: 'success' });
  };
  // Delete-control confirmation (the trash action on a control card).
  const [confirmDeleteCtrl, setConfirmDeleteCtrl] = useState<{ id: string; name: string } | null>(null);
  const [showCreateControl, setShowCreateControl] = useState(false);
  const handleDeleteOne = (id: string) => {
    logEvent({ action: 'Delete', description: `Deleted control ${id}`, module: 'Control Library', entity: 'Control' });
    setControls(prev => prev.filter(c => c.id !== id));
    setSelectedIds(prev => prev.filter(s => s !== id));
    addToast({ message: `Control deleted`, type: 'success' });
  };
  const handleCancelOne = (id: string) => {
    setSelectedIds(prev => prev.filter(s => s !== id));
  };

  const hasActiveFilter =
    classificationFilter.length > 0 ||
    natureFilter.length > 0 ||
    automationFilter.length > 0 ||
    frequencyFilter.length > 0 ||
    statusFilter.length > 0 ||
    searchQuery.length > 0;

  const clearAll = () => {
    setClassificationFilter([]);
    setNatureFilter([]);
    setAutomationFilter([]);
    setFrequencyFilter([]);
    setStatusFilter([]);
    setSearchQuery('');
  };

  // Open the Create Control flow when the journey/setup checklist (or the empty
  // state) requests it via the shared 'process-hub-create' event for this section.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: string }>;
      if (ce.detail?.section === 'controls') setShowCreateControl(true);
    };
    window.addEventListener('process-hub-create', handler);
    return () => window.removeEventListener('process-hub-create', handler);
  }, []);

  // Create-control modal, lifted into a shared element so it's available from both
  // the empty state (no controls yet) and the populated list.
  const createControlModal = (
    <AnimatePresence>
      {showCreateControl && (
        <DesignControlAddModal
          subProcesses={Array.from(new Set(controls.map(c => c.subProcess).filter((s): s is string => !!s)))}
          onClose={() => setShowCreateControl(false)}
          onCreate={({ description, isKey, subProcess, attributes, inRacm }) => {
            const newId = `C-${String(controls.length + 1).padStart(3, '0')}`;
            const attrs: ControlAttribute[] = attributes
              .map(a => a.trim())
              .filter(Boolean)
              .map((desc, idx) => ({ id: `${newId}-A${idx + 1}`, description: desc, result: 'Pending' as AttrResult, workflows: [] }));
            setControls(prev => [{
              id: newId,
              name: description.trim(),
              description: description.trim(),
              classification: isKey ? 'Key' : 'Non-Key',
              nature: '', automation: '', frequency: '',
              mappedRisks: [],
              workflows: [],
              usedInRACMs: inRacm ? 1 : 0,
              assertions: [],
              attributes: attrs,
              subProcess, custom: true, inRacm,
            }, ...prev]);
            setShowCreateControl(false);
            addToast({ message: `Control "${description.trim()}" created`, type: 'success' });
          }}
        />
      )}
    </AnimatePresence>
  );

  if (!isLoading && loadError) {
    return <ListLoadError label="controls" onRetry={() => setLoadError(false)} />;
  }

  if (!isLoading && controls.length === 0) {
    return (
      <>
        <ListPlaceholder
          icon={Shield}
          title="No controls yet"
          body="Create a control for this process, or open a RACM to map risks to controls."
          action={(
            <div className="flex items-center gap-3">
              {can('ctrl_create') && (
                <Button variant="primary" size="md" onClick={() => setShowCreateControl(true)}>Create Control</Button>
              )}
              <button type="button" onClick={() => onGoToRacm?.()} className="text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer transition-colors">Open RACM</button>
            </div>
          )}
        />
        {createControlModal}
      </>
    );
  }

  return (
    <div className="space-y-5 -mt-4 pt-5">

      {/* Filter row — search on the left, CTA-pill filters + Clear all on the right. */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search controls..."
            className="pl-9 pr-3 h-9 rounded-md border border-border bg-white text-[0.75rem] w-[260px] placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="mr-1 text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
            >
              Clear all
            </button>
          )}
          <ControlFilterPill label="Status" options={['Effective', 'In Test', 'Failed', 'Pending']} value={statusFilter} onChange={setStatusFilter} />
          <ControlFilterPill label="Classification" options={classificationOptions} value={classificationFilter} onChange={setClassificationFilter} />
          <ControlFilterPill label="Automation" options={automationOptions} value={automationFilter} onChange={setAutomationFilter} />
          <ControlFilterPill label="Frequency" options={frequencyOptions} value={frequencyFilter} onChange={setFrequencyFilter} />
          {can('ctrl_create') && (
          <Button variant="primary" size="md" onClick={() => setShowCreateControl(true)} disabled={searchQuery.trim().length > 0} title={searchQuery.trim().length > 0 ? 'Clear search to create' : undefined} className="rounded-md!" leftIcon={<Plus size={14} />}>
            Create Control
          </Button>
          )}
        </div>
      </div>

      {/* Bulk-select strip — only renders once at least one card is ticked. */}
      {!isLoading && selectedIds.length > 0 && (
        <div className="flex items-center gap-2 text-[0.6875rem] text-text-muted">
          <input
            ref={selectAllRef}
            type="checkbox"
            aria-label="Select all visible controls"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            className="w-3.5 h-3.5 rounded-xs border border-ink-300 cursor-pointer accent-brand-600"
          />
          <span>{selectedVisibleCount} of {visibleIds.length} selected</span>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="ml-2 text-brand-700 hover:text-brand-600 font-medium cursor-pointer"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Card stack — engagement-style list, one card per control. Clicking the
          card opens the Control detail (URL syncs `?control=<id>`). Checkbox +
          action buttons stopPropagation so they don't fire the card click. */}
      <div className="space-y-2 min-h-[calc(100vh-280px)]">
        {isLoading && showSkeleton ? (
          [...Array(5)].map((_, i) => (
            <div key={`skel-ctrl-${i}`} className="px-6 py-5 rounded-xl border border-border-light bg-white">
              <div className="flex items-start gap-4">
                <div className="h-3.5 w-3.5 rounded-sm bg-paper-100 animate-pulse shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-3 bg-paper-100 rounded-sm animate-pulse w-2/3" />
                  <div className="h-2.5 bg-paper-100 rounded-sm animate-pulse w-2/5" />
                  <div className="h-2.5 bg-paper-100 rounded-sm animate-pulse w-1/3" />
                </div>
              </div>
            </div>
          ))
        ) : filteredControls.length === 0 ? (
          <ListPlaceholder
            icon={Search}
            title="No matching controls"
            body="Nothing matched your search or filters. Try a different combination."
            action={hasActiveFilter && (
              <button type="button" onClick={clearAll} className="text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">Clear all</button>
            )}
          />
        ) : filteredControls.map((ctrl, i) => {
          const isKey = ctrl.classification === 'Key';
          // Workflow id labels for the card: prefer the WF-xxx code (lives on the
          // control's attributes, matched by workflow name); fall back to the
          // workflow's own name when no code exists (e.g. freshly-linked ones).
          const wfLabels = (() => {
            const codeByName = new Map<string, string>();
            for (const attr of ctrl.attributes ?? []) {
              for (const w of attr.workflows ?? []) {
                if (w?.name && w?.code && !codeByName.has(w.name)) codeByName.set(w.name, w.code);
              }
            }
            return (ctrl.workflows ?? []).map(w => codeByName.get(w.name) ?? w.name);
          })();
          const status = controlStatuses.get(ctrl.id) ?? 'Pending';
          return (
            <motion.div
              key={ctrl.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="rounded-xl border border-border-light bg-white hover:border-primary/40 transition-all"
            >
              {/* Grid lanes mirror the Risk & RACM list cards (grid-cols-[2.6fr_1fr_1.7fr_…])
                  so all three process-hub cards share one structure: name+status headline,
                  a grouped tag lane, a numbers lane, then actions. */}
              <div className="grid grid-cols-[2.6fr_1fr_1.7fr_auto] gap-5 px-6 py-5 items-start">
              {/* Lane 1 — Control: id + name (click opens detail in a new tab) + status
                  pill on the headline; first assertion grouped beneath. */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[0.9375rem] font-semibold leading-snug">
                    <span className="font-mono text-[0.75rem] font-semibold text-brand-700 mr-2">{ctrl.id}</span>
                    <button
                      type="button"
                      onClick={() => openControlInNewTab(ctrl.id)}
                      title="Open control"
                      className="text-left text-text hover:text-brand-700 hover:underline decoration-brand-600 underline-offset-2 cursor-pointer transition-colors"
                    >
                      {ctrl.name}
                    </button>
                  </h3>
                  {/* Control status chip — commented out for now (per request). Uncomment to restore Effective / Failed / In Test / Pending.
                  <span className={`inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[0.625rem] font-semibold border ${CTRL_STATUS_CLS[status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${CTRL_STATUS_DOT[status]}`} />{status}
                  </span>
                  */}
                  {/* Key/Non-Key classification — a control-level property, so it sits on the
                      identity line next to status (not in the workflow lane). */}
                  <span className={`inline-flex items-center px-2 h-5 rounded-full text-[0.625rem] font-bold shrink-0 ${isKey ? 'bg-mitigated-50 text-mitigated-700' : 'bg-paper-100 text-ink-500'}`}>
                    {isKey ? 'Key' : 'Non-Key'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-medium bg-white text-text-muted border border-border-light">
                    {ctrl.assertions[0] || 'No assertions'}
                  </span>
                </div>
              </div>

              {/* Lane 2 — Type: Nature + Frequency grouped (mirrors RACM's process +
                  framework tag lane). Frequency now shows on the card, aligned per row. */}
              <div className="flex flex-wrap items-start gap-1.5">
                <span className={`inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-semibold border ${naturePillCls(ctrl.nature)}`}>
                  {ctrl.nature || '—'}
                </span>
                <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-medium bg-white text-text-muted border border-border-light">
                  {ctrl.frequency || '—'}
                </span>
              </div>

              {/* Lane 3 — linked workflow ids as lavender brand pills (same chip style the
                  control id uses elsewhere). First two render inline; extras collapse into a
                  +N with a hover tooltip. Code-less workflows fall back to their name (also a
                  pill). No workflows → em dash. (Key/Non-Key now lives on the headline.) */}
              <div className="flex items-center gap-2.5 min-w-0">
                {wfLabels.length === 0 ? (
                  <span className="text-[0.75rem] text-text-muted leading-relaxed whitespace-nowrap">—</span>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    {wfLabels.slice(0, 2).map((label, idx) => (
                      <span key={idx} title={label} className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-[0.6875rem] font-mono font-semibold max-w-[13rem] min-w-0">
                        <span className="truncate">{label}</span>
                      </span>
                    ))}
                    {wfLabels.length > 2 && (
                      <span className="relative group/wfids shrink-0">
                        <span className="text-[0.75rem] text-text-muted cursor-default whitespace-nowrap">+{wfLabels.length - 2}</span>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium opacity-0 group-hover/wfids:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">{wfLabels.slice(2).join(', ')}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Lane 4 — Actions: delete only. Always-visible hover tooltip (matches the
                  Workflow/RACM rows) + the "Delete this control?" confirmation modal. */}
              <div className="flex items-start justify-end gap-0.5">
                <div className="relative group/lwf">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLinkWfCtrlId(ctrl.id); }}
                    aria-label="Link workflow"
                    className="shrink-0 inline-flex items-center gap-1 px-2 h-7 whitespace-nowrap rounded-md border border-dashed border-border-light bg-white text-[0.6875rem] font-semibold text-text-muted hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition-colors cursor-pointer"
                  >
                    <Link2 size={12} className="shrink-0" aria-hidden="true" /> Link workflow
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/lwf:opacity-100 pointer-events-none transition-opacity z-50">Link workflow</span>
                </div>
                {can('ctrl_share') && (
                <div className="relative group/share">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openShare({ type: 'control', id: ctrl.id, anchor: rectFromEvent(e) }); }}
                    aria-label="Share control"
                    className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Share2 size={14} />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/share:opacity-100 pointer-events-none transition-opacity z-50">
                    Share control
                  </span>
                </div>
                )}
                {can('ctrl_delete') && (
                <div className="relative group/del">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCtrl({ id: ctrl.id, name: ctrl.name })}
                    aria-label="Delete control"
                    className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/del:opacity-100 pointer-events-none transition-opacity z-50">
                    Delete control
                  </span>
                </div>
                )}
              </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create control — engagement-style modal (shared with the empty state). */}
      {createControlModal}

      {/* Link workflow to a control — reuses the shared drawer; on link the control's
          workflow count bumps (BoundWorkflow appended, deduped by name). */}
      <AnimatePresence>
        {linkWfCtrlId && (() => {
          const c = controls.find(x => x.id === linkWfCtrlId);
          if (!c) return null;
          return (
            <LinkWorkflowToControlDrawer
              control={{ name: c.name, description: c.description, isKey: c.classification === 'Key', workflows: [] }}
              onClose={() => setLinkWfCtrlId(null)}
              onLink={(wf: ControlWorkflow) => {
                setControls(prev => prev.map(x => {
                  if (x.id !== linkWfCtrlId) return x;
                  if (x.workflows.some(w => w.name === wf.name)) return x;
                  const bound: BoundWorkflow = { name: wf.name, type: 'Automated', status: wf.status === 'Active' ? 'Ready' : wf.status, lastRun: wf.lastRun || '—', runs: 0 };
                  return { ...x, workflows: [...x.workflows, bound] };
                }));
                addToast({ message: `Workflow "${wf.name}" linked to ${c.name}`, type: 'success' });
                setLinkWfCtrlId(null);
              }}
            />
          );
        })()}
      </AnimatePresence>

      {/* Delete-control confirmation */}
      <ConfirmationModal
        open={!!confirmDeleteCtrl}
        title="Delete this control?"
        description={confirmDeleteCtrl
          ? <>This removes <span className="font-semibold text-ink-700">{confirmDeleteCtrl.name}</span> (<span className="font-mono">{confirmDeleteCtrl.id}</span>) from the control library. You can't undo this here.</>
          : undefined}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => { if (confirmDeleteCtrl) handleDeleteOne(confirmDeleteCtrl.id); setConfirmDeleteCtrl(null); }}
        onClose={() => setConfirmDeleteCtrl(null)}
      />
    </div>
  );
}

// ─── ControlFilterPill ───────────────────────────────────────────────────────
// CTA-style multi-select dropdown rendered inline. Mirrors the shared
// ColumnFilter `variant="button"` look (label + count pill + chevron) so the
// Controls filter row reads consistently with other Process Hub sections.
function ControlFilterPill({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hasFilter = value.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[0.75rem] font-medium cursor-pointer transition-colors ${
          hasFilter
            ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-50/80'
            : 'border-border bg-white text-ink-700 hover:bg-paper-50'
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span>{label}</span>
        {hasFilter && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-brand-600 text-paper-0 text-[0.625rem] font-mono tabular-nums">
            {value.length}
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1.5 z-50 w-[220px] bg-white border border-border-light rounded-md shadow-lg normal-case tracking-normal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-border-light flex items-center justify-between">
            <span className="text-[0.625rem] uppercase tracking-wider font-semibold text-ink-500">Filter {label}</span>
            {hasFilter && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[0.625rem] text-brand-700 hover:text-brand-600 cursor-pointer font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <ul className="py-1 max-h-[240px] overflow-y-auto">
            {options.map(opt => {
              const checked = value.includes(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => toggle(opt)}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[0.75rem] text-ink-800 hover:bg-paper-50 cursor-pointer"
                  >
                    <span className={`w-3.5 h-3.5 inline-flex items-center justify-center rounded-xs border ${checked ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-300'}`}>
                      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-3 py-2 text-[0.75rem] text-ink-400 italic">No options</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Workflow Cockpit Tab ────────────────────────────────────────────────────

// ─── Workflow Types for BP-scoped view ─────────────────────────────────────
type RunStatus = 'Success' | 'Error';
// Why the last run failed. 'technical' = server/connectivity/transient — safe to
// re-run as-is in place. 'data' = file/data/mapping problem — the input must be
// fixed in the executor first, so Retry opens the executor instead.
type RunErrorKind = 'technical' | 'data';

export interface BPWorkflow {
  id: string; name: string; description: string;
  type: 'Automated' | 'Manual';
  nature: 'Preventive' | 'Detective';
  status: 'Draft' | 'Ready' | 'Active' | 'Archived';
  linkedControls: string[]; // control IDs
  owner: string;
  lastRun: string | null;            // formatted date/time; null = never run
  lastRunStatus: RunStatus | null;   // result of the last run; null = never run
  lastRunError: string | null;       // failure reason, shown when lastRunStatus === 'Error'
  lastRunErrorKind: RunErrorKind | null; // drives Retry behaviour (in-place vs executor)
  tags: string[];                    // functional/domain tags shown on the card
  isSql: boolean;                    // SQL-based workflow → shows the green "Live" tag
}

// Run-status dot colour + pill styling for the run-status tag.
const RUN_STATUS_DOT: Record<RunStatus, string> = { Success: 'bg-compliant', Error: 'bg-risk' };
// Pill (bg + text + border) for the run-status tag that sits beside the type tag.
const RUN_STATUS_PILL: Record<RunStatus, string> = {
  Success: 'bg-compliant-50 text-compliant-700 border-compliant-100',
  Error: 'bg-risk-50 text-risk-700 border-risk-100',
};

// Seed workflows moved to ../../data/processHubSeeds.ts (WORKFLOWS_BY_PROCESS /
// getSeedWorkflows), keyed per process.

function WorkflowGovernanceTab({ bpAbbr, seeded, onOpenWorkflowDetail, onCreateWorkflow, onRunWorkflow, onBulkRunComplete }: { bpAbbr: string; seeded: boolean; onOpenWorkflowDetail?: (workflowId: string) => void; onCreateWorkflow?: () => void; onRunWorkflow?: (workflowId: string) => void; onBulkRunComplete?: (run: BulkAuditRun) => void }) {
  const { addToast } = useToast();
  const { can } = useCan();
  const [workflows, setWorkflows] = useState<BPWorkflow[]>(getSeedWorkflows(bpAbbr));
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [confirmDeleteWf, setConfirmDeleteWf] = useState<{ id: string; name: string } | null>(null);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Bulk-run mode — mirrors the Workflow Library: the always-visible "Bulk Run"
  // button turns this on (swapping to "Cancel"), which reveals the per-card
  // checkboxes; turning it off clears any selection. The run itself is launched
  // from the Continue bar that appears once ≥1 workflow is ticked.
  const [bulkMode, setBulkMode] = useState(false);
  // Bulk-run config modal (shared with the Workflow Library flow).
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  // Workflows currently re-running in place after a technical error.
  const [retryingIds, setRetryingIds] = useState<string[]>([]);
  // Per-row filter dropdown state (which filter button is open, if any).
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);

  // Local data is ready immediately; only reveal a skeleton if loading genuinely
  // exceeds ~150ms (e.g. a future remote source). For today's local data it never shows.
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    const armSkeleton = setTimeout(() => setShowSkeleton(true), 150);
    setIsLoading(false); // synchronous local data — ready right away
    return () => clearTimeout(armSkeleton);
  }, []);

  // Listen for header-level "Create new Workflow" trigger.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: string }>;
      if (ce.detail?.section === 'workflows') onCreateWorkflow?.();
    };
    window.addEventListener('process-hub-create', handler);
    return () => window.removeEventListener('process-hub-create', handler);
  }, []);

  const searched = searchQuery.trim() ? workflows.filter(w => {
    const q = searchQuery.toLowerCase();
    return w.name.toLowerCase().includes(q)
      || w.id.toLowerCase().includes(q)
      || w.description.toLowerCase().includes(q);
  }) : workflows;
  const filtered = searched
    .filter(w => typeFilter.length === 0 || typeFilter.includes(w.type))
    .filter(w => ownerFilter.length === 0 || ownerFilter.includes(w.owner));
  const typeOptions = Array.from(new Set(workflows.map(w => w.type))).sort();
  const ownerOptions = Array.from(new Set(workflows.map(w => w.owner))).sort();

  const anyFilterActive = searchQuery.trim().length > 0 || typeFilter.length > 0 || ownerFilter.length > 0;
  const clearAllFilters = () => {
    setSearchQuery('');
    setTypeFilter([]);
    setOwnerFilter([]);
  };

  const handleDelete = (id: string) => {
    const idx = workflows.findIndex(w => w.id === id);
    if (idx === -1) return;
    const wf = workflows[idx];
    setWorkflows(prev => prev.filter(w => w.id !== id));
    setSelectedIds(prev => prev.filter(s => s !== id));
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
    setWorkflows(prev => [{ id: `wf-${Date.now()}`, name: data.name, description: data.desc, type: data.type, nature: data.nature, status: 'Draft', linkedControls: [], owner: 'You', lastRun: null, lastRunStatus: null, lastRunError: null, lastRunErrorKind: null, tags: [], isSql: false }, ...prev]);
    setShowCreateDrawer(false);
    addToast({ message: `Workflow "${data.name}" created.`, type: 'success' });
  };

  // Retry a failed run. A technical/server error re-runs in place (the input is
  // unchanged); a data/file error needs fixing first, so it opens the executor.
  const handleRetry = (wf: BPWorkflow) => {
    if (wf.lastRunErrorKind === 'data') { onRunWorkflow?.(wf.id); return; }
    if (retryingIds.includes(wf.id)) return;
    setRetryingIds(prev => [...prev, wf.id]);
    addToast({ message: `Re-running "${wf.name}"…`, type: 'info' });
    setTimeout(() => {
      setWorkflows(prev => prev.map(w => w.id === wf.id
        ? { ...w, lastRunStatus: 'Success', lastRun: 'Just now', lastRunError: null, lastRunErrorKind: null }
        : w));
      setRetryingIds(prev => prev.filter(id => id !== wf.id));
      addToast({ message: `"${wf.name}" re-ran successfully.`, type: 'success' });
    }, 1600);
  };

  // Bulk-select helpers — mirrors RiskRegister pattern.
  const visibleIds = filtered.map(w => w.id);
  const selectedVisibleCount = visibleIds.filter(id => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };
  const clearSelection = () => setSelectedIds([]);
  // Bulk-run mode toggle — entering starts from a clean selection; cancelling clears it.
  const enterBulkMode = () => { setBulkMode(true); setSelectedIds([]); };
  const exitBulkMode = () => { setBulkMode(false); setSelectedIds([]); };

  // Selected workflows mapped to the Library's shape so the shared BulkExecuteModal
  // can drive the same bulk-run flow from the Process Hub.
  const selectedBulkWorkflows: LibraryWorkflow[] = workflows
    .filter(w => selectedIds.includes(w.id))
    .map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      tags: [bpAbbr],
      businessProcess: bpAbbr,
      controlId: w.id.toUpperCase(),
      live: w.lastRunStatus != null,
    }));

  // Same hand-off as WorkflowLibraryView.handleModalContinue: build the run result
  // and surface the shared AuditLogsView (rendered by BPDetailView).
  const handleBulkRunContinue = (data: { auditName: string }) => {
    setBulkModalOpen(false);
    const results: BulkRunWorkflowResult[] = selectedBulkWorkflows.map(w => ({
      id: w.id,
      code: w.controlId,
      name: w.name,
      casesFlagged: deterministicCaseCount(w.controlId + w.id),
    }));
    onBulkRunComplete?.({
      name: data.auditName || 'BulkRun',
      workflows: results,
      skippedCount: 0,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    });
    clearSelection();
    setBulkMode(false);
  };

  if (!isLoading && loadError) {
    return <ListLoadError label="workflows" onRetry={() => setLoadError(false)} />;
  }

  if (!isLoading && workflows.length === 0) {
    return (
      <ListPlaceholder
        icon={Workflow}
        title="No workflows yet"
        body="Connect approval steps and evidence collection."
        action={can('wf_create') && onCreateWorkflow && (
          <Button variant="primary" size="md" onClick={onCreateWorkflow}>Create Workflow</Button>
        )}
      />
    );
  }

  // Inline CTA filter pill — opens a checkbox popover. Matches the visual
  // language of the new card-stack pattern; reuses ColumnFilter's option logic
  // but renders as a button + chevron instead of a small icon.
  const FilterPill = ({ filterKey, label, options, value, onChange }: { filterKey: string; label: string; options: string[]; value: string[]; onChange: (next: string[]) => void }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const open = openFilterKey === filterKey;
    useEffect(() => {
      if (!open) return;
      const onDocClick = (e: MouseEvent) => {
        if (!ref.current?.contains(e.target as Node)) setOpenFilterKey(null);
      };
      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenFilterKey(null); };
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onEsc);
      return () => {
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('keydown', onEsc);
      };
    }, [open]);
    const active = value.length > 0;
    const toggle = (opt: string) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
    return (
      <div ref={ref} className="relative inline-flex">
        <button
          type="button"
          onClick={() => setOpenFilterKey(open ? null : filterKey)}
          aria-haspopup="true"
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[0.75rem] font-semibold border transition-colors cursor-pointer ${
            active
              ? 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100'
              : 'bg-white border-border text-text-secondary hover:border-primary/40 hover:text-text'
          }`}
        >
          {label}
          {active && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[0.625rem] font-bold tabular-nums">
              {value.length}
            </span>
          )}
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full right-0 mt-1.5 z-50 w-[220px] bg-white border border-border-light rounded-md shadow-lg">
            <div className="px-3 py-2 border-b border-border-light flex items-center justify-between">
              <span className="text-[0.625rem] uppercase tracking-wider font-semibold text-ink-500">Filter {label}</span>
              {active && (
                <button type="button" onClick={() => onChange([])}
                  className="text-[0.625rem] text-brand-700 hover:text-brand-600 cursor-pointer font-medium">Clear</button>
              )}
            </div>
            <ul className="py-1 max-h-[240px] overflow-y-auto">
              {options.length === 0 && (
                <li className="px-3 py-2 text-[0.75rem] text-ink-400 italic">No options</li>
              )}
              {options.map(opt => {
                const checked = value.includes(opt);
                return (
                  <li key={opt}>
                    <button type="button" onClick={() => toggle(opt)}
                      className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[0.75rem] text-ink-800 hover:bg-paper-50 cursor-pointer">
                      <span className={`w-3.5 h-3.5 inline-flex items-center justify-center rounded-xs border ${checked ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-300'}`}>
                        {checked && <CheckCircle2 size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{opt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 -mt-4 pt-5">
      {/* Search (LEFT) + Clear all + Filter pills (RIGHT).
          -mt-4 cancels the shared header's mb-4 → 20px above; space-y-5 → 20px below. */}
      <div className="flex items-center gap-3">
        <div className="relative w-[260px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search workflows..."
            className="pl-9 pr-3 h-9 rounded-md border border-border bg-white text-[0.75rem] w-full placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {anyFilterActive && (
            <button type="button" onClick={clearAllFilters}
              className="text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer px-2 py-1">
              Clear all
            </button>
          )}
          {/* Bulk run — always-visible toggle, mirroring the Workflow Library: it
              swaps to "Cancel" and reveals the per-card checkboxes. The run is then
              launched from the Continue bar that appears once ≥1 card is ticked. */}
          {can('wf_run') && (bulkMode ? (
            <Button variant="outline" size="md" onClick={exitBulkMode} className="shrink-0 rounded-md!">
              Cancel
            </Button>
          ) : (
            <Button variant="outline" size="md" onClick={enterBulkMode} className="shrink-0 rounded-md!" leftIcon={<Play size={14} />}>
              Bulk Run
            </Button>
          ))}
          <FilterPill filterKey="owner"  label="User"   options={ownerOptions}  value={ownerFilter}  onChange={setOwnerFilter} />
          <FilterPill filterKey="type"   label="Type"   options={typeOptions}   value={typeFilter}   onChange={setTypeFilter} />
          {can('wf_create') && (
          <Button variant="primary" size="md" shape="lg" onClick={() => onCreateWorkflow?.()} disabled={searchQuery.trim().length > 0} title={searchQuery.trim().length > 0 ? 'Clear search to create' : undefined} className="shrink-0 rounded-md!" leftIcon={<Plus size={13} />}>
            Create Workflow
          </Button>
          )}
        </div>
      </div>

      {/* Bulk-select strip — the single bulk control bar above the card list.
          Left: select-all, selected count, Clear selection. Right: Continue
          (the run launcher → opens the shared 3-step Bulk Execute setup). */}
      {bulkMode && selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-brand-50 border border-brand-100">
          <input
            ref={selectAllRef}
            type="checkbox"
            aria-label="Select all visible workflows"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="w-3.5 h-3.5 rounded-xs border border-ink-300 cursor-pointer accent-brand-600"
          />
          <span className="text-[0.75rem] text-ink-700">
            <span className="font-semibold text-text">{selectedVisibleCount}</span> of <span className="font-semibold text-text">{visibleIds.length}</span> selected
          </span>
          <button type="button" onClick={clearSelection}
            className="text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">
            Clear selection
          </button>
          <Button variant="primary" size="md" onClick={() => setBulkModalOpen(true)} className="ml-auto shrink-0" rightIcon={<ArrowRight size={14} />}>
            Continue
          </Button>
        </div>
      )}

      {/* Card stack */}
      {isLoading && showSkeleton ? (
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => (
            <div key={`skel-wf-${i}`} className="rounded-xl border border-border-light bg-white px-6 py-5">
              <div className="grid grid-cols-[28px_2.6fr_1fr_1.7fr_80px] gap-5 items-start">
                <div className="h-4 w-4 rounded-xs bg-paper-100 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-3.5 w-3/5 bg-paper-100 rounded animate-pulse" />
                  <div className="h-3 w-4/5 bg-paper-100 rounded animate-pulse" />
                  <div className="h-2.5 w-1/2 bg-paper-100 rounded animate-pulse" />
                </div>
                <div className="h-5 w-20 bg-paper-100 rounded animate-pulse" />
                <div className="h-5 w-28 bg-paper-100 rounded animate-pulse" />
                <div className="h-6 w-16 bg-paper-100 rounded animate-pulse justify-self-end" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <ListPlaceholder
          icon={Search}
          title="No matching workflows"
          body="Nothing matched your search or filters. Try a different combination."
          action={anyFilterActive && (
            <button type="button" onClick={clearAllFilters} className="text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">Clear all filters</button>
          )}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((wf, i) => {
            const isSelected = selectedIds.includes(wf.id);
            const isRetrying = retryingIds.includes(wf.id);
            // Workflow "type" badge styling — Preventive uses compliant; Detective uses mitigated.
            const natureStyle =
              wf.nature === 'Preventive' ? 'bg-compliant-50 text-compliant-700 border-compliant-100'
              : wf.nature === 'Detective' ? 'bg-mitigated-50 text-mitigated-700 border-mitigated-100'
              :                             'bg-paper-100 text-ink-700 border-border-light';
            const openDetail = () => {
              if (onOpenWorkflowDetail) onOpenWorkflowDetail(wf.id);
              else addToast({ message: `Opening "${wf.name}"...`, type: 'info' });
            };
            return (
              <motion.div
                key={wf.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={bulkMode ? () => toggleSelect(wf.id) : undefined}
                className={`group grid ${bulkMode ? 'grid-cols-[28px_1.8fr_2.1fr_80px] cursor-pointer select-none' : 'grid-cols-[1.8fr_2.1fr_80px]'} gap-5 px-6 py-5 rounded-xl border bg-white hover:border-primary/50 hover:shadow-sm transition-all items-start ${
                  isSelected ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border-light'
                }`}
              >
                {/* Select checkbox — its own 28px column on the left, shown only in
                    bulk-run mode (revealed when "Bulk Run" is toggled on). */}
                {bulkMode && (
                  <div onClick={e => e.stopPropagation()} className="pt-[2px]">
                    <input
                      type="checkbox"
                      aria-label={`Select ${wf.name}`}
                      checked={isSelected}
                      onChange={() => toggleSelect(wf.id)}
                      className="w-4 h-4 rounded-xs border border-ink-300 cursor-pointer accent-brand-600"
                    />
                  </div>
                )}

                {/* Col 2 — id + title, description, run meta, error/retry. */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[0.75rem] font-semibold text-brand-700 shrink-0">{wf.id.toUpperCase()}</span>
                    <button type="button" onClick={openDetail} className={`text-[0.875rem] font-semibold text-text leading-snug truncate text-left ${bulkMode ? 'pointer-events-none' : 'hover:text-brand-700 hover:underline cursor-pointer'}`}>{wf.name}</button>
                    {/* Live tag — only for SQL-based workflows (matches the Workflow Library pill) */}
                    {wf.isSql && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.6875rem] font-medium shrink-0 bg-compliant-50 text-compliant-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-compliant-700" />
                        Live
                      </span>
                    )}
                  </div>
                  {wf.description && (
                    <p className="mt-1 line-clamp-2 text-[0.75rem] text-text-secondary leading-snug">{wf.description}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-text-muted">
                    <span className="inline-flex items-center gap-1" title="Last run">
                      <Clock size={11} className="text-ink-400 shrink-0" />
                      {wf.lastRun ? `Last run ${wf.lastRun}` : 'Not run yet'}
                    </span>
                  </div>
                  {wf.lastRunStatus === 'Error' && wf.lastRunError && (
                    <div className="mt-1.5 flex items-start gap-2 text-[0.6875rem] text-risk-700">
                      <AlertTriangle size={12} className="shrink-0 mt-px" />
                      <span className="line-clamp-2 leading-snug min-w-0">{wf.lastRunError}</span>
                      <button
                        type="button"
                        aria-label={isRetrying ? `Retrying ${wf.name}` : `Retry ${wf.name}`}
                        title="Retry"
                        disabled={isRetrying}
                        onClick={(e) => { e.stopPropagation(); handleRetry(wf); }}
                        className={`shrink-0 inline-flex items-center align-middle text-risk-700 hover:text-risk-800 disabled:opacity-60 disabled:cursor-default cursor-pointer ${bulkMode ? 'opacity-40 pointer-events-none' : ''}`}
                      >
                        <RotateCcw size={13} className={isRetrying ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Col 3 — run status pill + workflow type (automation · nature) + linked controls + owner.
                    The status pill sits in a fixed-width slot so the type tags stay
                    left-aligned across every card, even when a workflow never ran. */}
                <div className="pt-0.5 flex flex-wrap items-center gap-2">
                  <div className="w-[92px] shrink-0">
                    {isRetrying ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[0.6875rem] font-semibold bg-paper-100 text-ink-500 border-canvas-border">
                        <Loader2 size={11} className="animate-spin" />
                        Running…
                      </span>
                    ) : wf.lastRunStatus ? (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[0.6875rem] font-semibold ${RUN_STATUS_PILL[wf.lastRunStatus]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${RUN_STATUS_DOT[wf.lastRunStatus]}`} />
                        {wf.lastRunStatus}
                      </span>
                    ) : null}
                  </div>
                  {/* type tag slot — fixed width keeps the control chips aligned across cards */}
                  <div className="w-[144px] shrink-0">
                    <span className={`inline-flex items-center px-2 py-1 rounded-sm border text-[0.6875rem] font-semibold ${natureStyle}`}>
                      {wf.type} · {wf.nature}
                    </span>
                  </div>
                  {/* controls slot — fixed width (reserved even when empty) keeps the owner aligned across cards */}
                  <div className="w-[100px] shrink-0 flex items-center gap-1.5 ml-4">
                    {wf.linkedControls.map(c => (
                      <span key={c} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-[0.6875rem] font-mono font-semibold shrink-0">
                        {c}
                      </span>
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1 ml-4 text-[0.6875rem] text-text-muted shrink-0" title="Owner">
                    <User size={11} className="text-ink-400 shrink-0" />
                    {wf.owner}
                  </span>
                </div>

                {/* Col 4 — actions (80px). In bulk-run mode these dim and go
                    non-interactive: selection is the only action, so a click here
                    falls through to the card and toggles the checkbox instead. */}
                <div onClick={e => e.stopPropagation()} className={`flex items-center justify-end gap-0.5 ${bulkMode ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="relative group/run">
                    <button type="button" aria-label="Execute workflow"
                      onClick={(e) => { e.stopPropagation(); onRunWorkflow?.(wf.id); }}
                      className="w-8 h-8 rounded-sm flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors">
                      <Play size={14} />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/run:opacity-100 pointer-events-none transition-opacity z-50">
                      Execute workflow
                    </span>
                  </div>
                  <div className="relative group/del">
                    <button type="button" aria-label="Delete workflow"
                      onClick={() => setConfirmDeleteWf({ id: wf.id, name: wf.name })}
                      className="w-8 h-8 rounded-sm flex items-center justify-center text-text-muted hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors">
                      <Trash2 size={14} />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/del:opacity-100 pointer-events-none transition-opacity z-50">
                      Delete
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete-workflow confirmation */}
      <ConfirmationModal
        open={!!confirmDeleteWf}
        title="Delete this workflow?"
        description={confirmDeleteWf
          ? <>This removes <span className="font-semibold text-ink-700">{confirmDeleteWf.name}</span> (<span className="font-mono">{confirmDeleteWf.id.toUpperCase()}</span>). You can't undo this here.</>
          : undefined}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => { if (confirmDeleteWf) handleDelete(confirmDeleteWf.id); setConfirmDeleteWf(null); }}
        onClose={() => setConfirmDeleteWf(null)}
      />

      {/* Bulk-run config modal — shared with the Workflow Library bulk-run flow */}
      {bulkModalOpen && (
        <BulkExecuteModal
          selectedWorkflows={selectedBulkWorkflows}
          onClose={() => setBulkModalOpen(false)}
          onContinue={handleBulkRunContinue}
          defaultAuditName={`${bpAbbr} Bulk Run`}
          defaultAuditDescription=""
        />
      )}

      {/* Create Workflow Drawer */}
      <AnimatePresence>
        {showCreateDrawer && (() => {
          const D = () => {
            const [n, setN] = useState(''); const [t, setT] = useState<'Automated' | 'Manual'>('Automated'); const [nat, setNat] = useState<'Preventive' | 'Detective'>('Preventive'); const [d, setD] = useState('');
            const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
            const fCls = 'w-full px-3 py-2.5 border border-border rounded-md text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 transition-all';
            // Dirty as soon as any field deviates from its initial default.
            const isDirty = n.trim().length > 0 || d.trim().length > 0 || t !== 'Automated' || nat !== 'Preventive';
            const requestClose = () => { if (isDirty) setShowDiscardConfirm(true); else setShowCreateDrawer(false); };
            const discardAndClose = () => { setN(''); setD(''); setT('Automated'); setNat('Preventive'); setShowDiscardConfirm(false); setShowCreateDrawer(false); };
            const cancelClose = () => setShowDiscardConfirm(false);
            return (<>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]" onClick={requestClose} />
              <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed top-0 right-0 z-50 w-full max-w-[600px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">
                {/* Discard-changes confirm strip */}
                {showDiscardConfirm && (
                  <div className="p-3 bg-mitigated-50 border-b border-mitigated-200 flex items-center gap-3 text-[0.8125rem]">
                    <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0" />
                    <div className="flex-1 text-ink-800">Discard unsaved changes?</div>
                    <button type="button" onClick={discardAndClose} className="px-3 py-1 rounded-sm bg-paper-0 border border-mitigated-300 text-[0.75rem] text-ink-700 hover:bg-paper-50">Discard</button>
                    <button type="button" onClick={cancelClose} className="px-3 py-1 rounded-sm bg-mitigated-700 text-paper-0 text-[0.75rem] hover:bg-mitigated-800">Keep editing</button>
                  </div>
                )}
                <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
                  <div><h2 className="text-[1rem] font-bold text-ink-900">Create Workflow</h2><p className="text-[0.75rem] text-ink-500 mt-0.5">Define a new workflow for this business process.</p></div>
                  <button type="button" aria-label="Close" title="Close" onClick={requestClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  <div><label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Name <span className="text-risk">*</span></label><input value={n} onChange={e => setN(e.target.value)} placeholder="e.g. Three-Way PO Match" className={fCls} autoFocus /></div>
                  <div><label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Business Process</label>
                    <div className="px-3 py-2.5 border border-border rounded-md text-[0.8125rem] text-text bg-paper-50 cursor-not-allowed flex items-center gap-2"><Building2 size={13} className="text-ink-400 shrink-0" />{bpAbbr}<span className="ml-auto text-[0.625rem] text-ink-400">Auto-filled</span></div>
                  </div>
                  <div><label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Automation Type</label>
                    <div className="flex gap-2">{(['Automated', 'Manual'] as const).map(v => (<button type="button" key={v} onClick={() => setT(v)} className={`px-3 py-2 rounded-md text-[0.75rem] font-medium border cursor-pointer transition-all ${t === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted'}`}>{v}</button>))}</div>
                  </div>
                  <div><label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Nature</label>
                    <div className="flex gap-2">{(['Preventive', 'Detective'] as const).map(v => (<button type="button" key={v} onClick={() => setNat(v)} className={`px-3 py-2 rounded-md text-[0.75rem] font-medium border cursor-pointer transition-all ${nat === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted'}`}>{v}</button>))}</div>
                  </div>
                  <div><label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Description</label><textarea value={d} onChange={e => setD(e.target.value)} rows={3} placeholder="Describe what this workflow does..." className={fCls + ' resize-none'} /></div>
                </div>
                <div className="px-6 py-4 border-t border-canvas-border flex justify-end gap-3 shrink-0">
                  <Button variant="outline" size="md" shape="lg" onClick={requestClose}>Cancel</Button>
                  <Button variant="primary" size="md" shape="lg" onClick={() => { if (n.trim()) handleCreate({ name: n.trim(), type: t, nature: nat, desc: d }); }} disabled={!n.trim()}>Create</Button>
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
  keyControl: 'Marked as a key control: required for SOX or regulatory reporting.',
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
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-3">
          <ArrowLeft size={14} />Back to RACM List
        </button>
        <div className="bg-white rounded-lg border border-canvas-border p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[1rem] font-bold text-text">{racmName}</h2>
                <span className="px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center bg-mitigated-50 text-mitigated-700">Draft Review</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[0.6875rem] text-ink-500">
                <span>{bpAbbr}</span>
                <span>Source: {fileName}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Review/issues warning sits right next to the action */}
              <div className="flex items-center gap-2 text-[0.6875rem]">
                <span className="text-ink-500">{reviewedCount}/{rows.length} reviewed</span>
                {issueCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-mitigated-700 bg-mitigated-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={11} />{issueCount} with issues
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" shape="lg" onClick={() => addToast({ message: 'Draft saved.', type: 'success' })}>Save Draft</Button>
                <Button
                  variant="primary"
                  size="sm"
                  shape="lg"
                  onClick={() => { setFreezeConfirmed(false); setShowFreezeModal(true); }}
                  disabled={reviewedCount < rows.length}
                  title={reviewedCount < rows.length ? `Review all rows before freezing (${reviewedCount}/${rows.length} reviewed)` : ''}
                  leftIcon={<Lock size={12} />}
                >Freeze RACM</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(['All', 'Needs Review', 'Reviewed', 'Flagged', 'Has Issues'] as const).map(f => (
            <button type="button" key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded-full text-[0.625rem] font-semibold cursor-pointer transition-all ${filter === f ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10'}`}>
              {f}{f === 'Has Issues' && issueCount > 0 ? ` (${issueCount})` : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleBulkMarkReviewed} className="px-3 py-1.5 rounded-md text-[0.625rem] font-semibold border border-border text-text-muted hover:bg-paper-50 cursor-pointer">Mark All Reviewed</button>
          <button type="button" onClick={handleAddRow} className="px-3 py-1.5 rounded-md text-[0.625rem] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer flex items-center gap-1"><Plus size={9} />Add Row</button>
        </div>
      </div>

      {/* Grid + Detail panel */}
      <div className="flex gap-4">
        {/* Grid */}
        <div className={`${selectedRow ? 'flex-1' : 'w-full'} bg-white rounded-lg border border-canvas-border overflow-hidden`}>
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
            <table className="w-full text-[0.6875rem] border-collapse" style={{ minWidth: totalMinW }}>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-paper-50/80">
                  {GRID_COLUMNS.map(c => {
                    const tip = GRID_HEADER_TIPS[c.key as string];
                    return (
                      <th key={c.key} className="px-1.5 py-2 text-left text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wide whitespace-nowrap"
                        style={{ minWidth: c.minW }}>
                        {tip ? (
                          <span className="inline-flex items-center gap-1 group/tip relative">
                            {c.label}
                            <HelpCircle className="w-3 h-3 text-ink-400" aria-label={`What is ${c.label}?`} />
                            <span className="absolute top-full left-0 mt-1 w-[220px] p-2.5 rounded-md bg-ink-800 text-paper-0 text-[0.75rem] font-normal normal-case tracking-normal leading-snug opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
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
                          <td key={col.key} className="px-1.5 py-1 text-[0.625rem] text-ink-400 font-mono" style={{ minWidth: col.minW }}>
                            {val}
                          </td>
                        );
                      }

                      // ── Status badge ──
                      if (col.type === 'status') {
                        return (
                          <td key={col.key} className="px-1.5 py-1" style={{ minWidth: col.minW }}>
                            <span className={`px-1.5 h-4 rounded-xs text-[0.625rem] font-bold inline-flex items-center ${row.reviewStatus === 'Reviewed' ? 'bg-compliant-50 text-compliant-700' : row.reviewStatus === 'Flagged' ? 'bg-risk-50 text-risk-700' : 'bg-mitigated-50 text-mitigated-700'}`}>
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
                              className="w-3.5 h-3.5 rounded-xs border-canvas-border text-primary accent-primary cursor-pointer" />
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
                                className="w-full px-1 py-0.5 border border-primary/40 rounded-xs text-[0.6875rem] outline-none bg-white cursor-pointer" autoFocus>
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
                              <span className={`px-1.5 h-4 rounded-xs text-[0.625rem] font-bold inline-flex items-center ${ratingColor(val)}`}>{val}</span>
                            ) : (
                              <span className={`text-[0.6875rem] ${hasIssue && isEmpty ? 'text-mitigated-700' : isEmpty ? 'text-ink-300' : 'text-text'} truncate block`}>
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
                              className="w-full px-1 py-0.5 border border-primary/40 rounded-xs text-[0.6875rem] outline-none" autoFocus />
                          </td>
                        );
                      }
                      return (
                        <td key={col.key}
                          className={`px-1.5 py-1 ${hasIssue ? 'relative' : ''}`}
                          style={{ minWidth: col.minW }}
                          onClick={e => { e.stopPropagation(); setSelectedRowId(row.id); startEdit(row.id, col.key, val === 'undefined' ? '' : val); }}>
                          <span className={`text-[0.6875rem] ${hasIssue && isEmpty ? 'text-mitigated-700' : isEmpty ? 'text-ink-300' : 'text-text'} truncate block`}
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
                          <button type="button" aria-label="Mark Reviewed" onClick={() => handleMarkReviewed(row.id)} className="p-1 rounded-xs hover:bg-compliant-50 text-ink-400 hover:text-compliant-700 cursor-pointer" title="Mark Reviewed"><CheckCircle2 size={11} /></button>
                        )}
                        <button type="button" aria-label="Delete" onClick={() => handleDeleteRow(row.id)} className="p-1 rounded-xs hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer" title="Delete"><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-border bg-surface-2/30 text-[0.625rem] text-text-muted">
            {filtered.length} row{filtered.length !== 1 ? 's' : ''} · Click any cell to edit. Press Enter to save, Tab to move.
          </div>
        </div>

        {/* Detail panel */}
        {selectedRow && (
          <div className="w-[280px] shrink-0 bg-white rounded-lg border border-canvas-border p-6 space-y-3.5 overflow-y-auto" style={{ maxHeight: 560 }}>
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] font-bold text-text-muted uppercase">Row {selectedRow.sourceRow}</span>
              <button type="button" aria-label="Close" title="Close" onClick={() => setSelectedRowId(null)} className="p-1 rounded-md text-ink-400 hover:text-ink-600 hover:bg-surface-2 transition-colors cursor-pointer"><X size={12} /></button>
            </div>

            {/* Process */}
            <div>
              <span className="text-[0.625rem] text-ink-400 uppercase block">Process</span>
              <p className="text-[0.75rem] font-medium text-text">{selectedRow.process || '—'}</p>
              {selectedRow.subProcess && <p className="text-[0.625rem] text-ink-500 mt-0.5">{selectedRow.subProcess}</p>}
            </div>

            {/* Risk */}
            <div>
              <span className="text-[0.625rem] text-ink-400 uppercase block">Risk</span>
              <p className="text-[0.75rem] font-medium text-text">{selectedRow.riskName || '—'}</p>
              <p className="text-[0.625rem] text-ink-500 mt-0.5">{selectedRow.riskDesc || '—'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[0.625rem] font-mono text-ink-400">{selectedRow.riskId || '—'}</span>
                {selectedRow.riskRating && (
                  <span className={`px-1.5 h-4 rounded-xs text-[0.625rem] font-bold inline-flex items-center ${ratingColor(selectedRow.riskRating)}`}>{selectedRow.riskRating}</span>
                )}
              </div>
            </div>

            {/* Control */}
            <div>
              <span className="text-[0.625rem] text-ink-400 uppercase block">Control</span>
              <p className="text-[0.75rem] font-medium text-text">{selectedRow.controlName || '—'}</p>
              <p className="text-[0.625rem] text-ink-500 mt-0.5">{selectedRow.controlDesc || '—'}</p>
              <div className="grid grid-cols-2 gap-1 mt-1.5 text-[0.625rem]">
                <div><span className="text-ink-400">ID:</span> <span className="text-text font-mono">{selectedRow.controlId || '���'}</span></div>
                <div><span className="text-ink-400">Owner:</span> <span className="text-text">{selectedRow.controlOwner || '—'}</span></div>
                <div><span className="text-ink-400">Type:</span> <span className="text-text">{selectedRow.controlType || '—'}</span></div>
                <div><span className="text-ink-400">Frequency:</span> <span className="text-text">{selectedRow.frequency || '—'}</span></div>
                <div><span className="text-ink-400">Key:</span> <span className="text-text">{selectedRow.keyControl ? 'Yes' : 'No'}</span></div>
              </div>
            </div>

            {/* Assertion / Attribute */}
            <div>
              <span className="text-[0.625rem] text-ink-400 uppercase block">Assertion / Attribute</span>
              <p className="text-[0.6875rem] text-text">{selectedRow.assertion || '—'} / {selectedRow.attribute || '—'}</p>
            </div>

            {/* Source */}
            <div>
              <span className="text-[0.625rem] text-ink-400 uppercase block">Source</span>
              <p className="text-[0.625rem] text-ink-500">Row {selectedRow.sourceRow} · {selectedRow.framework || '—'}</p>
            </div>

            {/* Validation Issues */}
            {selectedRow.validationIssues.length > 0 && (
              <div className="bg-mitigated-50/60 rounded-md p-2.5 space-y-1">
                <span className="text-[0.625rem] font-bold text-mitigated-700 uppercase flex items-center gap-1"><AlertTriangle size={10} />Validation Issues ({selectedRow.validationIssues.length})</span>
                {selectedRow.validationIssues.map((issue, i) => (
                  <p key={i} className="text-[0.625rem] text-mitigated-700 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-mitigated shrink-0" />{issue}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 pt-2">
              {selectedRow.reviewStatus !== 'Reviewed' && (
                <button type="button" onClick={() => handleMarkReviewed(selectedRow.id)} className="flex-1 py-1.5 rounded-md text-[0.625rem] font-semibold bg-compliant-50 text-compliant-700 hover:bg-compliant-50 cursor-pointer text-center">Mark Reviewed</button>
              )}
              <button type="button" onClick={() => { setRows(prev => prev.map(r => r.id === selectedRow.id ? { ...r, reviewStatus: 'Flagged' as const } : r)); }}
                className="flex-1 py-1.5 rounded-md text-[0.625rem] font-semibold bg-risk-50 text-risk-700 hover:bg-risk-50 cursor-pointer text-center">Flag</button>
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
              className="bg-white rounded-xl shadow-2xl border border-border-light w-[560px] overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ShieldCheck size={22} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[1rem] font-bold text-text">Freeze RACM Structure</h3>
                    <p className="text-[0.6875rem] text-text-muted mt-0.5">{racmName}</p>
                  </div>
                </div>

                {/* Message */}
                <p className="text-[0.75rem] text-text-secondary leading-relaxed mb-5">
                  You are about to finalize this imported RACM structure. After freezing, structural edits will be restricted and the RACM will move into system mapping mode.
                </p>

                {/* Stats Grid */}
                <div className="bg-surface-2/60 rounded-lg p-4 mb-4">
                  <span className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wide block mb-3">Import Summary</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Rows', value: stats.totalRows, color: 'text-text' },
                      { label: 'Unique Risks', value: stats.uniqueRisks, color: 'text-primary' },
                      { label: 'Unique Controls', value: stats.uniqueControls, color: 'text-primary' },
                      { label: 'Risk-Control Mappings', value: stats.riskControlMappings, color: 'text-text' },
                      { label: 'Needs Review', value: stats.needsReview, color: stats.needsReview > 0 ? 'text-mitigated-700' : 'text-compliant-700' },
                      { label: 'Validation Warnings', value: stats.validationWarnings, color: stats.validationWarnings > 0 ? 'text-mitigated-700' : 'text-compliant-700' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-md px-3 py-2 border border-border-light">
                        <span className={`text-[1.125rem] font-bold ${s.color} block`}>{s.value}</span>
                        <span className="text-[0.625rem] text-ink-400 font-medium">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation warnings detail */}
                {stats.validationWarnings > 0 && (
                  <div className="bg-mitigated-50/60 rounded-md p-3 mb-4 space-y-1">
                    <span className="text-[0.625rem] font-bold text-mitigated-700 uppercase flex items-center gap-1"><AlertTriangle size={10} />Rows with issues</span>
                    {rows.filter(r => r.validationIssues.length > 0).slice(0, 3).map(r => (
                      <div key={r.id} className="flex items-start gap-2 text-[0.625rem]">
                        <span className="text-mitigated-700 font-semibold shrink-0">Row {r.sourceRow}:</span>
                        <span className="text-mitigated-700">{r.validationIssues.join(', ')}</span>
                      </div>
                    ))}
                    {stats.validationWarnings > 3 && (
                      <p className="text-[0.625rem] text-mitigated-700 font-medium">+{stats.validationWarnings - 3} more…</p>
                    )}
                    <p className="text-[0.625rem] text-mitigated-700/70 mt-1">These rows will be imported as-is. You can fix them in the RACM mapping workspace after freeze.</p>
                  </div>
                )}

                {/* Needs review warning */}
                {stats.needsReview > 0 && (
                  <div className="bg-evidence-50/60 rounded-md p-3 mb-4">
                    <p className="text-[0.625rem] text-evidence-700">{stats.needsReview} row{stats.needsReview !== 1 ? 's' : ''} not yet marked as reviewed. You can still freeze: unreviewed rows will be imported.</p>
                  </div>
                )}

                {/* Lock-for-audit callout — strong warning above the confirm. */}
                <div className="p-3 bg-mitigated-50 border border-mitigated-200 rounded-md mb-4 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0 mt-0.5" />
                  <div className="text-[0.75rem] text-ink-800">
                    <div className="font-semibold text-mitigated-800 mb-1">This will lock the RACM for audit</div>
                    <div className="text-[0.75rem] leading-snug">No edits can be made after freezing. To make changes later, an admin must re-open it from the RACM row actions.</div>
                  </div>
                </div>

                {/* Confirmation checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-md bg-surface-2/40 border border-border-light mb-5 cursor-pointer select-none hover:bg-surface-2/70 transition-colors">
                  <input type="checkbox" checked={freezeConfirmed} onChange={e => setFreezeConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded-xs border-canvas-border text-primary accent-primary cursor-pointer" />
                  <span className="text-[0.75rem] text-text leading-snug">I confirm this RACM structure has been reviewed and is correct.</span>
                </label>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="md" className="flex-1" onClick={() => setShowFreezeModal(false)}>Cancel</Button>
                  <Button variant="primary" size="md" className="flex-1" onClick={() => { setShowFreezeModal(false); onFreeze(rows); }} disabled={!freezeConfirmed} leftIcon={<Lock size={13} />}>
                    Freeze &amp; Create RACM
                  </Button>
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

// One entity row (a single SOP / RACM / Risk / Control / Workflow) shown inside
// a section card when that section is expanded. Mirrors the engagement-card
// stacking from the reference screenshot (title + status pill, optional
// description, meta, tag pills, optional right-side stat).
type EntryData = {
  id: string;
  title: string;
  status?: { label: string; tone: 'green' | 'amber' | 'red' | 'gray' };
  description?: string;
  meta: string;
  tags?: string[];
  highlight?: { primary: string; secondary?: string };
  onOpen?: () => void;
};

const ENTRY_TONE_TEXT: Record<NonNullable<EntryData['status']>['tone'], string> = {
  green: 'text-compliant-700',
  amber: 'text-mitigated-700',
  red: 'text-high-700',
  gray: 'text-ink-500',
};
const ENTRY_TONE_DOT: Record<NonNullable<EntryData['status']>['tone'], string> = {
  green: 'bg-compliant-700',
  amber: 'bg-mitigated-700',
  red: 'bg-high-700',
  gray: 'bg-ink-400',
};

function SectionEntryCard({ data }: { data: EntryData }) {
  const interactive = !!data.onOpen;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? data.onOpen : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); data.onOpen?.(); }
      } : undefined}
      className={`w-full bg-white border border-canvas-border rounded-lg px-4 py-3 transition-colors ${
        interactive ? 'cursor-pointer hover:border-brand-300 hover:bg-paper-50/30' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <h3 className="text-[0.8125rem] font-semibold text-ink-900">{data.title}</h3>
            {data.status && (
              <span className={`inline-flex items-center gap-1 text-[0.625rem] font-medium shrink-0 ${ENTRY_TONE_TEXT[data.status.tone]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ENTRY_TONE_DOT[data.status.tone]}`} />
                {data.status.label}
              </span>
            )}
          </div>
          {data.description && (
            <p className="text-[0.75rem] text-ink-600 leading-snug mb-1.5">
              {data.description}
            </p>
          )}
          <div className="text-[0.6875rem] text-ink-500 font-mono leading-tight">
            {data.meta}
          </div>
          {data.tags && data.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {data.tags.map((tag, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full border border-canvas-border text-[0.625rem] text-ink-600 font-mono">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {data.highlight && (
          <div className="shrink-0 text-right min-w-[120px]">
            <div className="text-[0.75rem] font-mono font-semibold text-ink-800 tabular-nums">{data.highlight.primary}</div>
            {data.highlight.secondary && (
              <div className="text-[0.6875rem] font-mono text-ink-500 tabular-nums mt-0.5">{data.highlight.secondary}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// (SectionCard removed — the BP-detail landing is now the BPOverviewDashboard.)

// Exponential ease-out (≈ expo) for the overview's first-paint reveal. Typed as a
// bezier tuple so it satisfies motion's Easing type without casts.
const OVERVIEW_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// Animate the overview in only once per session — auditors switch back and forth all
// day; a first-impression stagger is a moment, not something to replay every navigation.
let overviewHasAnimated = false;

function BPDetailView({ bp, onBack, onOpenRacmEditor, onOpenWorkflowDetail, onCreateWorkflow, onRunWorkflow }: {
  bp: UserProcess; onBack: () => void;
  onOpenRacmEditor?: (racm: import('./RacmListTable').RacmEntry) => void;
  onOpenWorkflowDetail?: (workflowId: string) => void;
  onCreateWorkflow?: () => void;
  onRunWorkflow?: (workflowId: string) => void;
}) {
  const { addToast } = useToast();
  // Completed bulk-run from the Workflows tab — when set, the shared AuditLogsView
  // takes over the page (same results view as the Workflow Library bulk run).
  const { can } = useCan();
  const { openShare } = useShare();
  const [bulkAuditRun, setBulkAuditRun] = useState<BulkAuditRun | null>(null);
  const [createdRacms, setCreatedRacms] = useState<import('./RacmListTable').RacmEntry[]>([]);
  const [showCreateRacm, setShowCreateRacm] = useState(false);
  // Two-card "New RACM" flow (ported from the engagement RACM tab): pick a file,
  // then either import the matrix straight in or run the SOP→RACM extraction overlay.
  const racmFileRef = useRef<HTMLInputElement | null>(null);
  const sopFileRef = useRef<HTMLInputElement | null>(null);
  const [extractingFile, setExtractingFile] = useState<string | null>(null);
  // Holds the in-flight extraction timer so Cancel can abort it cleanly.
  const extractTimer = useRef<number | null>(null);
  const cancelExtraction = () => {
    if (extractTimer.current != null) { window.clearTimeout(extractTimer.current); extractTimer.current = null; }
    setExtractingFile(null);
    addToast({ type: 'info', message: 'Extraction cancelled. No RACM was created.' });
  };
  // Add a newly created RACM to the list (frozen/active — the review step is dropped).
  const addCreatedRacm = (rows: RACMRow[], name: string, sourceFileName: string) => {
    const s = racmStatsFromRows(rows);
    setCreatedRacms(prev => [{
      id: `racm-${Date.now()}`, name, version: 'v1.0', process: bp.abbr, framework: 'SOX ICFR',
      risks: s.risks, controls: s.controls, mappedRisks: s.risks, unmappedRisks: 0,
      keyControls: s.keyControls, workflowCoverage: 0, attributesCoverage: s.attributesCoverage,
      isValidated: true, linkedToEngagement: false, isFrozen: true, sourceFileName,
    }, ...prev]);
  };
  const triggerRacmUpload = () => { setShowCreateRacm(false); racmFileRef.current?.click(); };
  const triggerSopUpload = () => { setShowCreateRacm(false); sopFileRef.current?.click(); };
  const onRacmFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const rows = generateRacmForProcess(bp.abbr as ProcessCode);
      const name = racmNameFromFilename(file.name) || `${bp.abbr}: Imported RACM`;
      addCreatedRacm(rows, name, file.name);
      const areas = new Set(rows.map(r => r.subProcess)).size;
      addToast({ type: 'success', message: `Imported "${file.name}": ${rows.length} rows · ${areas} sub-process${areas === 1 ? '' : 'es'}` });
    }
    e.target.value = '';
  };
  const onSopFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const filename = file.name;
    e.target.value = '';
    setExtractingFile(filename);
    // Simulate the SOP → RACM extraction pipeline (matches the engagement overlay timing).
    extractTimer.current = window.setTimeout(() => {
      const rows = generateRacmForProcess(bp.abbr as ProcessCode).slice(0, 5);
      const label = racmNameFromFilename(filename);
      addCreatedRacm(rows, label ? `${label} RACM` : `${bp.abbr} RACM`, filename);
      const s = racmStatsFromRows(rows);
      extractTimer.current = null;
      setExtractingFile(null);
      addToast({ type: 'success', message: `Extracted ${s.controls} controls · ${s.risks} risks from "${filename}"` });
    }, 1600);
  };
  /** Tracks which RACM is open in the Excel review editor. Stores the racmId. */
  const [reviewingRacmId, setReviewingRacmId] = useState<string | null>(null);
  const reviewingRacm = reviewingRacmId ? createdRacms.find(r => r.id === reviewingRacmId) : null;
  const reduceMotion = useReducedMotion();
  const [animateOverviewIn] = useState(() => { const first = !overviewHasAnimated; overviewHasAnimated = true; return first; });

  type SectionKey = 'sop' | 'racm' | 'risks' | 'controls' | 'workflows' | 'ai-insights';

  // ─── Data: single query per entity, filtered by business_process_id ───
  const bpRacms = RACMS.filter(r => r.bpId === bp.id);
  const bpSops = SOPS.filter(s => s.bpId === bp.id);
  const bpWfs = WORKFLOWS.filter(w => w.bpId === bp.id);
  const bpRisks = RISKS.filter(r => r.bpId === bp.id);
  const bpRiskIds = new Set(bpRisks.map(r => r.id));
  const bpControls = CONTROLS.filter(c => bpRiskIds.has(c.riskId));

  // Built-in (seed) processes keep their demo Controls/Workflows; newly-created processes start empty.
  const isSeedProcess = BUSINESS_PROCESSES.some(b => b.id === bp.id);

  // No separate status logic — RACM uses racmStateEngine, risks use RiskRegister lifecycle,
  // controls use ControlLibraryView status, workflows use WorkflowLibraryView status.

  // DRILL-IN state + per-section metadata
  // Seed from URL on first render so deep links + back/forward navigation work.
  // Consume the new-tab deep link (see BP_DEEPLINK) ~2s after mount — long enough
  // to outlast StrictMode's async effect cleanups (which would otherwise strip the
  // URL). While it's live the section-strip cleanup below is skipped; afterwards
  // returning to this BP behaves normally.
  useEffect(() => {
    if (!BP_DEEPLINK || BP_DEEPLINK.bp !== bp.id) return;
    const t = setTimeout(() => { BP_DEEPLINK = null; }, 2000);
    return () => clearTimeout(t);
  }, [bp.id]);

  const VALID_SECTIONS: SectionKey[] = ['sop', 'racm', 'risks', 'controls', 'workflows', 'ai-insights'];
  const readSectionFromUrl = (): SectionKey | null => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('section');
    return raw && (VALID_SECTIONS as string[]).includes(raw) ? (raw as SectionKey) : null;
  };
  // Overview tab is hidden — opening a process (no ?section= in URL) lands on the first section.
  const [drilledSection, setDrilledSection] = useState<SectionKey | null>(() => readSectionFromUrl() ?? 'sop');

  // Track which risk/control detail is open (URL-driven) so the BP-level breadcrumb
  // can add the entity name and the tab pills row can be hidden while a detail is on screen.
  const readUrlParam = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get(key);
  };
  const [openDetailRiskId, setOpenDetailRiskId] = useState<string | null>(() => readUrlParam('risk'));
  const [openDetailControlId, setOpenDetailControlId] = useState<string | null>(() => readUrlParam('control'));
  const [openDetailRacmId, setOpenDetailRacmId] = useState<string | null>(() => readUrlParam('racm'));
  const [openDetailSopId, setOpenDetailSopId] = useState<string | null>(() => readUrlParam('sop'));
  useEffect(() => {
    const onPop = () => {
      setOpenDetailRiskId(readUrlParam('risk'));
      setOpenDetailControlId(readUrlParam('control'));
      setOpenDetailRacmId(readUrlParam('racm'));
      setOpenDetailSopId(readUrlParam('sop'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openDetailRisk = openDetailRiskId ? SEED_RISKS.find(r => r.id === openDetailRiskId) : null;
  const openDetailControl = openDetailControlId ? findSeedControl(openDetailControlId) : null;
  const openDetailRacm = openDetailRacmId ? RACM_SEED_DATA.find(r => r.id === openDetailRacmId) : null;
  const openDetailSop = openDetailSopId ? SOPS.find(s => s.id === openDetailSopId) : null;
  // RacmListTable manages RACM detail/mapping takeovers internally; mirror that state
  // up so the section-pills row can hide while a RACM owns the screen.
  const [racmTakeover, setRacmTakeover] = useState<'detail' | 'mapping' | null>(null);
  const detailIsOpen = !!(openDetailRisk || openDetailControl || openDetailRacm || openDetailSop);

  // Listen for browser back/forward so closing the drilled section via browser back works.
  // Reads ?section= from the URL rather than e.state, so synthetic popstate events
  // dispatched by child components (RiskRegister / ControlDesignTab after pushState) don't
  // accidentally drop us out of the drilled view by passing a stateless event.
  // On unmount (user navigated away from this BP entirely), strip the ?section= query so it
  // doesn't leak into a different BP later. We use replaceState — never push/clobber history.
  useEffect(() => {
    const onPop = () => {
      const raw = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('section')
        : null;
      // Overview hidden — a section-less URL falls back to the first section, not the Overview index.
      const next = raw && (VALID_SECTIONS as string[]).includes(raw) ? (raw as SectionKey) : 'sop';
      setDrilledSection(next);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Skip the strip while a new-tab deep link is live, otherwise StrictMode's
      // mount→unmount→mount wipes ?section=/?risk= before the remount can read it.
      if (!BP_DEEPLINK && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('section')) {
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

  // Close the drilled view and also clear any open risk/control detail so the BP-name
  // breadcrumb always lands on the BP index page, never on a still-open detail child.
  const closeDrilledSection = () => {
    // Overview tab is hidden — the process "home" is now the first section (SOPs), so the
    // BP-name breadcrumb lands on SOPs instead of the (hidden) Overview index.
    if (typeof window !== 'undefined') {
      window.history.pushState({ section: 'sop' }, '', `?section=sop`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    setDrilledSection('sop');
  };

  // Close any open detail (?risk= / ?control= / ?racm= / ?sop=) without leaving the current
  // section — used by the section-name breadcrumb segment on a detail page.
  const closeOpenDetail = () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('risk');
    params.delete('control');
    params.delete('racm');
    params.delete('sop');
    const qs = params.toString();
    window.history.pushState({}, '', qs ? `?${qs}` : window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // The RACM cards rendered in this tab come from <RacmListTable>: RACM_SEED_DATA
  // merged with the same `racmExtra` we pass below, filtered by this process. Mirror
  // that exact logic here so the tab badge equals the number of cards shown (the two
  // previously read different mock arrays). createdRacms are already part of racmExtra.
  const racmExtra = bp.id === 'p2p'
    ? [...P2P_RACM_READY_RACMS, ...createdRacms.filter(c => !P2P_RACM_READY_IDS.has(c.id))]
    : createdRacms;
  const racmExtraIds = new Set(racmExtra.map(r => r.id));
  const racmCardsForBp = [
    ...RACM_SEED_DATA.filter(r => !racmExtraIds.has(r.id)),
    ...racmExtra,
  ].filter(r => r.process === bp.abbr);

  const sectionMeta: Record<SectionKey, { title: string; count: number; countLabel: string; warning?: string }> = {
    sop: { title: 'SOPs', count: bpSops.length, countLabel: 'documents', warning: bpSops.length === 0 ? 'no SOPs uploaded' : undefined },
    racm: { title: 'RACMs', count: racmCardsForBp.length, countLabel: 'matrices', warning: racmCardsForBp.length === 0 ? 'no RACMs yet' : undefined },
    risks: { title: 'Risks', count: bpRisks.length, countLabel: 'risks', warning: bpRisks.length === 0 ? 'no risks captured' : undefined },
    controls: { title: 'Controls', count: bpControls.length, countLabel: 'controls', warning: bpControls.length === 0 ? 'no controls defined' : undefined },
    workflows: { title: 'Workflows', count: getSeedWorkflows(bp.abbr).length, countLabel: 'workflows', warning: getSeedWorkflows(bp.abbr).length === 0 ? 'no workflows linked' : undefined },
    'ai-insights': { title: 'AI Insights', count: PROCESS_INSIGHTS.length, countLabel: 'insights' },
  };
  const sectionOrder: SectionKey[] = ['sop', 'racm', 'risks', 'controls', 'workflows', 'ai-insights'];

  // Single source of truth for "is this section set up?" — shared by both the
  // "Set up this business process" checklist and the "Coverage by section"
  // panel so they never disagree. A showcase override pins O2C to a mid-setup
  // state; every other process derives done-state from real section content.
  const SETUP_DEMO_OVERRIDE: Partial<Record<string, Record<SectionKey, boolean>>> = {
    // (none) — O2C is now fully built, so every process derives setup state from real content.
  };
  const sectionDemoOverride = SETUP_DEMO_OVERRIDE[bp.id];
  const isSectionComplete = (k: SectionKey) =>
    sectionDemoOverride ? sectionDemoOverride[k] : sectionMeta[k].count > 0;

  // ── Rich insights per section — drive the BP detail index cards. ────────────
  // Each section reads its underlying seed data and reports:
  //   health      — visible badge (Healthy / Attention / Stale / Empty)
  //   breakdown   — secondary line (e.g. "1 linked · 1 standalone")
  //   lastActivity — short timestamp string
  //   ctaLabel    — pill on the card hinting at the create affordance
  type SectionInsight = {
    health: SectionHealth;
    breakdown: string;
    lastActivity: string;
    ctaLabel: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    ratio: number | null;
    openCount: number;
    openLabel: string;
    description: string;
    healthRatioText: string;
    entries: EntryData[];
  };
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
    const isSopStale = (at: string) => /Dec 2025|Nov 2025|Oct 2025|Jan|Feb/.test(at);
    const staleSops = bpSops.filter(s => isSopStale(s.at)).length;

    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const riskTone = (r: typeof bpRisks[number]): EntryData['status'] => {
      if (r.status === 'mitigated') return { label: 'Mitigated', tone: 'green' };
      const sev = r.severity;
      if (sev === 'critical' || sev === 'high') return { label: 'Open', tone: 'red' };
      if (sev === 'medium') return { label: 'Open', tone: 'amber' };
      return { label: 'Open', tone: 'gray' };
    };

    const sopEntries: EntryData[] = bpSops.map(s => ({
      id: s.id,
      title: `${s.name} ${s.version}`,
      status: isSopStale(s.at)
        ? { label: 'Stale', tone: 'amber' }
        : { label: 'Processed', tone: 'green' },
      meta: `${s.by} · ${s.at}`,
      tags: s.racmId ? [s.racmId] : ['Standalone'],
      highlight: { primary: `${s.risks} risks`, secondary: `${s.controls} controls` },
      onOpen: () => openEntryDetail('sop'),
    }));

    const seedRacmEntries: EntryData[] = bpRacms.map(r => ({
      id: r.id,
      title: r.name,
      status: r.status === 'active'
        ? { label: 'Active', tone: 'green' as const }
        : { label: 'Draft', tone: 'gray' as const },
      meta: `${r.owner} · ${r.fw} · ${r.lastRun === 'Never' ? 'Never run' : `Last run ${r.lastRun}`}`,
      tags: [r.fw],
      onOpen: () => openEntryDetail('racm'),
    }));
    const createdRacmEntries: EntryData[] = createdRacms.map(r => ({
      id: r.id,
      title: r.name,
      status: r.isFrozen === false
        ? { label: 'Draft', tone: 'gray' }
        : { label: 'Active', tone: 'green' },
      meta: `${r.process} · ${r.framework} · ${r.risks} risks · ${r.controls} controls`,
      tags: [r.framework],
      onOpen: () => openEntryDetail('racm'),
    }));
    const racmEntries = [...seedRacmEntries, ...createdRacmEntries];

    const riskEntries: EntryData[] = bpRisks.map(r => ({
      id: r.id,
      title: r.name,
      status: riskTone(r),
      meta: `${r.id} · ${cap(r.severity)} severity · ${r.lastUpdated ? `Updated ${r.lastUpdated}` : 'Never updated'}`,
      tags: [cap(r.severity)],
      highlight: { primary: `${r.ctls} ${r.ctls === 1 ? 'control' : 'controls'}`, secondary: `${r.keyCtls} key` },
      onOpen: () => openEntryDetail('risks', 'risk', r.id),
    }));

    const controlEntries: EntryData[] = bpControls.map(c => ({
      id: c.id,
      title: c.name,
      status: c.status === 'effective'
        ? { label: 'Effective', tone: 'green' }
        : c.status === 'ineffective'
          ? { label: 'Ineffective', tone: 'red' }
          : { label: 'Not tested', tone: 'gray' },
      description: c.desc,
      meta: `${c.id} · ${c.isKey ? 'Key control' : 'Standard'} · maps ${c.riskId}`,
      tags: c.isKey ? ['Key'] : ['Standard'],
      onOpen: () => openEntryDetail('controls', 'control', c.id),
    }));

    const workflowEntries: EntryData[] = bpWfs.map(w => ({
      id: w.id,
      title: w.name,
      status: w.status === 'active'
        ? { label: 'Active', tone: 'green' }
        : { label: 'Idle', tone: 'amber' },
      description: w.desc,
      meta: `${w.type} · Last run ${w.lastRun}`,
      tags: [w.type],
      highlight: { primary: `${w.runs} runs` },
      onOpen: () => openEntryDetail('workflows'),
    }));

    return {
      sop: {
        icon: Upload,
        health: bpSops.length === 0 ? 'empty' : (staleSops > 0 ? 'stale' : 'healthy'),
        breakdown: bpSops.length === 0
          ? 'No SOPs uploaded yet'
          : `${linkedSops} linked to RACM${standaloneSops > 0 ? ` · ${standaloneSops} standalone` : ''}`,
        lastActivity: bpSops.length === 0 ? 'No activity yet' : `Latest: ${bpSops[0].at}`,
        ctaLabel: bpSops.length === 0 ? 'Upload SOP' : 'Open',
        ratio: bpSops.length === 0 ? null : (bpSops.length - staleSops) / bpSops.length,
        openCount: staleSops,
        openLabel: 'stale',
        description: 'Standard operating procedures: the source of truth for how each step in this process runs.',
        healthRatioText: bpSops.length === 0 ? '' : `${bpSops.length - staleSops}/${bpSops.length} fresh`,
        entries: sopEntries,
      },
      racm: {
        icon: FileText,
        health: totalRacms === 0 ? 'empty' : (draftRacms > 0 ? 'attention' : 'healthy'),
        breakdown: totalRacms === 0
          ? 'Build your first matrix'
          : `${activeRacms} active${draftRacms > 0 ? ` · ${draftRacms} draft` : ''}`,
        lastActivity: bpRacms[0]?.lastRun
          ? (bpRacms[0].lastRun === 'Never' ? 'Never run' : `Last run: ${bpRacms[0].lastRun}`)
          : 'No activity yet',
        ctaLabel: totalRacms === 0 ? 'Create RACM' : 'Open',
        ratio: totalRacms === 0 ? null : activeRacms / totalRacms,
        openCount: draftRacms,
        openLabel: 'draft',
        description: 'Risk-and-control matrices that map each risk in this process to one or more controls.',
        healthRatioText: totalRacms === 0 ? '' : `${activeRacms}/${totalRacms} active`,
        entries: racmEntries,
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
        ctaLabel: bpRisks.length === 0 ? 'Create Risk' : 'Open',
        ratio: bpRisks.length === 0 ? null : mappedRisks / bpRisks.length,
        openCount: unmappedRisks,
        openLabel: 'unmapped',
        description: 'Process risks identified through SOP review, control mapping, or direct entry.',
        healthRatioText: bpRisks.length === 0 ? '' : `${mappedRisks}/${bpRisks.length} mapped`,
        entries: riskEntries,
      },
      controls: {
        icon: Shield,
        health: bpControls.length === 0 ? 'empty' : (ineffectiveCtls > 0 ? 'attention' : 'healthy'),
        breakdown: bpControls.length === 0
          ? 'Mapped via RACM'
          : `${keyCtls} key${ineffectiveCtls > 0 ? ` · ${ineffectiveCtls} ineffective` : ''}`,
        lastActivity: bpControls.length === 0 ? 'No activity yet' : 'Mapped via RACM',
        ctaLabel: bpControls.length === 0 ? 'Open RACM' : 'Open',
        ratio: bpControls.length === 0 ? null : (bpControls.length - ineffectiveCtls) / bpControls.length,
        openCount: ineffectiveCtls,
        openLabel: 'ineffective',
        description: 'Controls designed to prevent or detect each risk in this process.',
        healthRatioText: bpControls.length === 0 ? '' : `${bpControls.length - ineffectiveCtls}/${bpControls.length} effective`,
        entries: controlEntries,
      },
      workflows: {
        icon: Workflow,
        health: bpWfs.length === 0 ? 'empty' : (idleWfs > 0 ? 'attention' : 'healthy'),
        breakdown: bpWfs.length === 0
          ? 'No workflows linked'
          : `${activeWfs} active${idleWfs > 0 ? ` · ${idleWfs} idle` : ''}`,
        lastActivity: bpWfs[0]?.lastRun ? `Last run: ${bpWfs[0].lastRun}` : 'No activity yet',
        ctaLabel: bpWfs.length === 0 ? 'Create Workflow' : 'Open',
        ratio: bpWfs.length === 0 ? null : activeWfs / bpWfs.length,
        openCount: idleWfs,
        openLabel: 'idle',
        description: 'Operational workflows that fire when a control triggers: approvals, monitors, escalations.',
        healthRatioText: bpWfs.length === 0 ? '' : `${activeWfs}/${bpWfs.length} active`,
        entries: workflowEntries,
      },
      // AI Insights is a read-only intelligence view, not a setup section, so it
      // carries no coverage ratio (null → excluded from the health rollup).
      'ai-insights': {
        icon: Sparkles,
        health: 'healthy',
        breakdown: 'Learned across runs',
        lastActivity: 'Updated after every run',
        ctaLabel: 'Open',
        ratio: null,
        openCount: 0,
        openLabel: '',
        description: 'Patterns memory learned across this process’s workflow runs.',
        healthRatioText: '',
        entries: [],
      },
    };
  }, [bpSops, bpRacms, createdRacms, bpRisks, bpControls, bpWfs]);

  // ── "What needs attention" items — computed from the same seed data. ───────
  // Each item links to the section where the user can act on it.
  const attentionItems = useMemo(() => {
    const items: Array<{ text: string; section: Exclude<SectionKey, 'ai-insights'> }> = [];
    const draftRacms = bpRacms.filter(r => r.status === 'draft').length
                     + createdRacms.filter(r => r.isFrozen === false).length;
    if (draftRacms > 0) {
      items.push({ text: `${draftRacms} RACM${draftRacms !== 1 ? 's' : ''} in draft: finish setup before audit can run`, section: 'racm' });
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

  // Overall health for the summary line — share of items in good standing across
  // every section (weighted by item count, so it's an honest single number).
  const overallCoverage = useMemo(() => {
    let good = 0, total = 0;
    for (const k of sectionOrder) {
      const ins = sectionInsights[k];
      if (ins.ratio === null || ins.ratio === undefined) continue;
      total += sectionMeta[k].count;
      good += sectionMeta[k].count - (ins.openCount ?? 0);
    }
    return total === 0 ? null : Math.round((good / total) * 100);
  }, [sectionInsights, sectionMeta]);
  const firstFixSection = attentionItems[0]?.section ?? null;

  // Staggered first-paint: summary first, then each section row 40ms apart. Exponential
  // ease-out, 8px rise — a single crafted page-load moment, gated to once per session.
  const doStagger = animateOverviewIn && !reduceMotion;
  const revealProps = (i: number) => doStagger ? {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: OVERVIEW_EASE, delay: i * 0.04 },
  } : {};

  // A brand-new BP has no SOPs and no RACMs yet — drive the linear-unlock onboarding.
  const isFreshBP = bpSops.length === 0 && bpRacms.length === 0 && createdRacms.length === 0;

  // Section switcher pill labels.
  const sectionPillLabel: Record<SectionKey, string> = {
    sop: 'SOPs',
    racm: 'RACMs',
    risks: 'Risks',
    controls: 'Controls',
    workflows: 'Workflows',
    'ai-insights': 'AI Insights',
  };

  // Tooltips for the tab buttons (all tabs for completeness).
  const sectionTabTooltip: Partial<Record<SectionKey, string>> = {
    sop: 'Standard Operating Procedures',
    racm: 'Risk & Control Matrices',
    'ai-insights': 'Patterns memory learned across this process’s workflow runs',
  };
  // Tab icons — SOP upload, RACM document, risk triangle, control shield, workflow nodes.
  const sectionTabIcon: Record<SectionKey, React.ComponentType<{ size?: number; className?: string }>> = {
    sop: Upload,
    racm: FileText,
    risks: AlertTriangle,
    controls: Shield,
    workflows: Workflow,
    'ai-insights': Sparkles,
  };
  // Switch to a different drilled section in-place (also updates URL).
  const switchDrilledSection = (next: SectionKey) => {
    if (next === drilledSection) return;
    if (typeof window !== 'undefined') {
      window.history.pushState({ section: next }, '', `?section=${next}`);
    }
    setDrilledSection(next);
  };

  // Open a specific risk or control detail from anywhere on the BP page (e.g. clicking
  // an entry card in an expanded section). Pushes both ?section= and the detail param
  // in one history entry, then fires popstate so the section component picks it up.
  const openEntryDetail = (section: SectionKey, detailKey?: 'risk' | 'control', detailId?: string) => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams();
      params.set('section', section);
      if (detailKey && detailId) params.set(detailKey, detailId);
      window.history.pushState({ section }, '', `?${params.toString()}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    setDrilledSection(section);
  };

  // Section-specific create button label rendered in the drilled-view header.
  const sectionCreateLabel: Record<SectionKey, string> = {
    sop: 'Upload SOP',
    racm: 'Create RACM',
    risks: 'Create new Risk',
    controls: 'Create new Control',
    workflows: 'Create Workflow',
    'ai-insights': '',
  };

  // Trigger the create flow for a given section. RACM lives in this component;
  // other sections own their own drawer state and listen for a window event.
  const triggerSectionCreate = (section: SectionKey) => {
    if (section === 'racm') {
      setShowCreateRacm(true);
      return;
    }
    // sop / risks / controls / workflows each own their create flow and open it on
    // this event (Upload SOP, Create Risk, Create Control, Create Workflow).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('process-hub-create', { detail: { section } }));
    }
  };

  // When a create/upload flow is requested for a section we aren't viewing yet,
  // we navigate there first and remember the intent. The effect below fires the
  // trigger once that section is mounted — child effects (which register the
  // section's create listener) run before this parent effect, so the flow opens
  // reliably instead of racing a fixed timeout.
  const [pendingCreate, setPendingCreate] = useState<SectionKey | null>(null);
  const handleDropdownPick = (section: SectionKey) => {
    if (section === drilledSection) {
      // Already viewing the section — open its flow immediately.
      triggerSectionCreate(section);
    } else {
      setPendingCreate(section);
      switchDrilledSection(section);
    }
  };
  useEffect(() => {
    if (pendingCreate && drilledSection === pendingCreate) {
      triggerSectionCreate(pendingCreate);
      setPendingCreate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drilledSection, pendingCreate]);


  // Top tab bar — Overview + the five sections. Shown on the index (Overview active)
  // and on every drilled section, so navigation is identical everywhere.
  const renderTabBar = (active: 'overview' | SectionKey) => (
    <div className="flex items-center gap-6 overflow-x-auto -mx-1 px-1 min-w-0">
      {([/* 'overview' tab hidden — process opens on the first section (SOPs); re-add 'overview' here to restore the tab */ ...sectionOrder] as ('overview' | SectionKey)[]).map((key) => {
        const isActive = active === key;
        const isOverview = key === 'overview';
        const TabIcon = isOverview ? LayoutGrid : sectionTabIcon[key as SectionKey];
        const label = isOverview ? 'Overview' : sectionPillLabel[key as SectionKey];
        const count = isOverview ? 0 : sectionMeta[key as SectionKey].count;
        return (
          <button
            type="button"
            key={key}
            title={isOverview ? undefined : sectionTabTooltip[key as SectionKey]}
            aria-label={isOverview ? 'Overview' : `Switch to ${sectionMeta[key as SectionKey].title}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => (isOverview ? closeDrilledSection() : switchDrilledSection(key as SectionKey))}
            className={`group no-focus-ring shrink-0 inline-flex items-center gap-2 px-1 pb-2.5 border-b-2 text-[0.8125rem] transition-colors cursor-pointer focus-visible:outline-none ${
              isActive
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-ink-500 font-medium hover:text-ink-800'
            }`}
          >
            <TabIcon size={15} className={isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'} />
            <span>{label}</span>
            {!isOverview && (
              <span className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[0.6875rem] font-semibold tabular-nums ${
                count === 0
                  ? 'bg-paper-100 text-ink-400'
                  : isActive ? 'bg-brand-50 text-brand-700' : 'bg-paper-100 text-ink-500'
              }`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  // The process masthead — breadcrumb, title, tab bar, and the process-meta row —
  // rendered identically on the Overview index and on every drilled section tab, so
  // the header stays constant as you move between tabs. (Deep detail / RACM-takeover
  // pages swap this for a collapsed back-trail header so the detail owns the screen.)
  const renderProcessHeader = (active: 'overview' | SectionKey) => (
    <>
      <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 mb-4 border-b border-border relative overflow-hidden">
        {/* Ambient FloatingLines — same recipe as the Knowledge Hub header.
            Top/bottom waves only (no middle wave under the H1), low opacity so
            the lines read as texture. The absolute canvas paints behind the
            header content, which stays in normal flow above it. */}
        <FloatingLines
          enabledWaves={['top', 'bottom']}
          lineCount={3}
          lineDistance={10}
          bendRadius={5}
          bendStrength={-0.3}
          interactive
          parallax
          color="#6a12cd"
          opacity={0.05}
        />
        <div className="font-mono text-[0.75rem] tracking-tight flex items-center gap-1.5 min-w-0 mb-3">
          <button type="button" onClick={onBack} className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 rounded-sm">
            <ArrowLeft size={12} />Process Hub
          </button>
          <span className="text-ink-300">/</span>
          <span className="text-ink-700 truncate">{bp.name}</span>
        </div>
        <div className="pb-5 flex items-end justify-between gap-4 flex-wrap">
          <h1 className="text-[2.125rem] font-semibold tracking-tight text-ink-900 leading-[1.15]">{bp.name}</h1>
          <div className="flex items-center gap-3 flex-wrap pb-1.5">
          {/* Process-meta (code · owner · status) — shown on all tabs for orientation.
              Full size on Overview; compact/quieter on section tabs. */}
          <div className={`flex items-center gap-4 flex-wrap ${active !== 'overview' ? 'opacity-70' : ''}`} style={{ fontSize: active !== 'overview' ? '0.6875rem' : '0.75rem' }}>
            <span className="font-mono tabular-nums text-ink-500">{bp.abbr}</span>
            <span className="w-px h-3 bg-canvas-border" aria-hidden />
            <span className="flex items-center gap-1.5">
              <span className="text-ink-400">Owner</span>
              <span className="font-medium text-ink-700">{bp.owner ?? 'Unassigned'}</span>
            </span>
            <span className="w-px h-3 bg-canvas-border" aria-hidden />
            {(() => {
              const s = bp.status ?? 'Active';
              const tone =
                s === 'Active'   ? { wrap: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-700' } :
                s === 'Draft'    ? { wrap: 'bg-paper-100 text-ink-600',          dot: 'bg-ink-400' } :
                s === 'Archived' ? { wrap: 'bg-paper-100 text-ink-500',          dot: 'bg-ink-300' } :
                                   { wrap: 'bg-paper-100 text-ink-600',          dot: 'bg-ink-400' };
              return (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold ${tone.wrap}`} style={{ fontSize: 'inherit' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden />
                  {s}
                </span>
              );
            })()}
          </div>
          {can('bp_share') && (
            <button
              onClick={(e) => { e.stopPropagation(); openShare({ type: 'process', id: bp.abbr, anchor: rectFromEvent(e) }); }}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-canvas-border bg-white text-[0.75rem] font-semibold text-text-secondary hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
            >
              <Share2 size={14} /> Share
            </button>
          )}
          </div>
        </div>
        <div className="pt-1">{renderTabBar(active)}</div>
      </div>
    </>
  );

  // RACM editor takeover — full-screen replaces all views while editing
  if (reviewingRacm) {
    return (
      <div className="h-full overflow-y-auto bg-canvas">
        <div className="px-[124px] py-8">
          {/* Collapsed back-bar breadcrumb — keeps orientation while the takeover owns the screen */}
          <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 pb-4 mb-4 border-b border-border">
            <div className="font-mono text-[0.75rem] tracking-tight flex items-center gap-1.5 min-w-0">
              <button type="button" onClick={onBack} className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5">
                <ArrowLeft size={12} />Process Hub
              </button>
              <span className="text-ink-300">/</span>
              <button type="button" onClick={() => setReviewingRacmId(null)} className="text-ink-500 hover:text-primary transition-colors cursor-pointer truncate">{bp.name}</button>
              <span className="text-ink-300">/</span>
              <button type="button" onClick={() => setReviewingRacmId(null)} className="text-ink-500 hover:text-primary transition-colors cursor-pointer truncate">RACMs</button>
              <span className="text-ink-300">/</span>
              <span className="text-ink-700 truncate">{reviewingRacm.name}</span>
            </div>
          </div>
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
                message: `RACM "${reviewingRacm.name}" frozen: ${uniqueRisks.size} risks, ${uniqueControls.size} controls, ${mappings.size} mappings created.`,
                type: 'success',
              });
            }}
          />
        </div>
      </div>
    );
  }

  // Bulk-run results take over the page (shared with the Workflow Library flow).
  // Back returns to the Workflows tab (drilledSection is preserved).
  if (bulkAuditRun) {
    return (
      <div className="h-full overflow-y-auto bg-canvas">
        <div className="px-[124px] py-8">
          {/* Collapsed back-bar breadcrumb — keeps orientation during bulk-run results */}
          <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 pb-4 mb-4 border-b border-border">
            <div className="font-mono text-[0.75rem] tracking-tight flex items-center gap-1.5 min-w-0">
              <button type="button" onClick={onBack} className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5">
                <ArrowLeft size={12} />Process Hub
              </button>
              <span className="text-ink-300">/</span>
              <button type="button" onClick={() => setBulkAuditRun(null)} className="text-ink-500 hover:text-primary transition-colors cursor-pointer truncate">{bp.name}</button>
              <span className="text-ink-300">/</span>
              <button type="button" onClick={() => setBulkAuditRun(null)} className="text-ink-500 hover:text-primary transition-colors cursor-pointer truncate">Workflows</button>
              <span className="text-ink-300">/</span>
              <span className="text-ink-700 truncate">{bulkAuditRun.name}</span>
            </div>
          </div>
          <AuditLogsView run={bulkAuditRun} onBack={() => setBulkAuditRun(null)} />
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
          {(detailIsOpen || (drilledSection === 'racm' && racmTakeover)) ? (
            /* Detail / RACM-takeover pages own the screen — collapse to a back trail, no tabs. */
            <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 pb-4 mb-4">
              <div className="font-mono text-[0.75rem] tracking-tight flex items-center gap-1.5 min-w-0">
                {drilledSection === 'racm' && racmTakeover === 'detail' ? (
                  <button type="button" onClick={closeOpenDetail} className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5">
                    <ArrowLeft size={12} />Back to RACMs
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={onBack} className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5">
                      <ArrowLeft size={12} />Process Hub
                    </button>
                    <span className="text-ink-300">/</span>
                    <button type="button" onClick={closeDrilledSection} className="text-ink-500 hover:text-primary transition-colors cursor-pointer truncate">{bp.name}</button>
                    <span className="text-ink-300">/</span>
                    {detailIsOpen ? (
                      <>
                        <button type="button" onClick={closeOpenDetail} className="text-ink-500 hover:text-primary transition-colors cursor-pointer truncate">{info.title}</button>
                        <span className="text-ink-300">/</span>
                        <span className="text-ink-700 truncate">
                          {openDetailRisk?.name ?? openDetailControl?.name ?? openDetailRacm?.name ?? openDetailSop?.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-700 truncate">{info.title}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            renderProcessHeader(drilledSection)
          )}

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
                  // A RACM generated from a SOP carries that SOP's name (pre-seeded in mockData RACMS).
                  const seeded = RACMS.find(r => r.id === racmId);
                  const sourceSop = SOPS.find(s => s.racmId === racmId);
                  setCreatedRacms(prev => [...prev, {
                    id: racmId, name: seeded?.name ?? `RACM ${racmId}`, version: 'v1.0', process: bp.abbr, framework: seeded?.fw ?? 'SOX ICFR',
                    risks: sourceSop?.risks ?? 0, controls: sourceSop?.controls ?? 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0,
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
                extraRacms={racmExtra}
                onCreate={() => setShowCreateRacm(true)}
                onEditDraft={(racm) => {
                  const exists = createdRacms.some(r => r.id === racm.id);
                  if (!exists) {
                    setCreatedRacms(prev => [...prev, { ...racm, isFrozen: false }]);
                  }
                  setReviewingRacmId(racm.id);
                }}
                onOpenInEditor={onOpenRacmEditor}
                onTakeoverChange={setRacmTakeover}
              />
              <input ref={racmFileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onRacmFile} />
              <input ref={sopFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onSopFile} />
              <AnimatePresence>
                {showCreateRacm && (
                  <NewRacmModal
                    onClose={() => setShowCreateRacm(false)}
                    onUploadRacm={triggerRacmUpload}
                    onUploadSop={triggerSopUpload}
                  />
                )}
              </AnimatePresence>
              <AnimatePresence>
                {extractingFile && <RacmExtractionOverlay filename={extractingFile} onCancel={cancelExtraction} />}
              </AnimatePresence>
            </div>
          )}
          {drilledSection === 'risks' && <RiskRegister processFilter={bp.abbr} />}
          {drilledSection === 'controls' && <ControlDesignTab bpAbbr={bp.abbr} seeded={isSeedProcess} onGoToRacm={() => switchDrilledSection('racm')} />}
          {drilledSection === 'workflows' && <WorkflowGovernanceTab bpAbbr={bp.abbr} seeded={isSeedProcess} onOpenWorkflowDetail={onOpenWorkflowDetail} onCreateWorkflow={onCreateWorkflow} onRunWorkflow={onRunWorkflow} onBulkRunComplete={setBulkAuditRun} />}
          {drilledSection === 'ai-insights' && <ProcessInsightsTab bpAbbr={bp.abbr} bpName={bp.name} />}
        </div>
      </div>
    );
  }

  // Index view — header strip + 5 clickable section rows
  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="px-[124px] py-8">
        {renderProcessHeader('overview')}

        {/* KPI strip — process-level rollups, in the Engagements-overview style (shared
            KpiTile: count-up value, label, footer; click to drill). */}
        {!isFreshBP && overallCoverage !== null && (() => {
          const controlsOpen = sectionInsights.controls.openCount ?? 0;
          const risksOpen = sectionInsights.risks.openCount ?? 0;
          const controlsEffective = Math.max(0, sectionMeta.controls.count - controlsOpen);
          const risksMapped = Math.max(0, sectionMeta.risks.count - risksOpen);
          const fixName = firstFixSection ? sectionMeta[firstFixSection].title : null;
          const atRisk = attentionItems.length;
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <KpiTile
                label="Process Health"
                value={`${overallCoverage}%`}
                index={0}
                onClick={firstFixSection ? () => switchDrilledSection(firstFixSection) : undefined}
                footer={
                  <span className={`text-[0.6875rem] font-semibold ${atRisk > 0 ? 'text-risk-700' : 'text-ink-400'}`}>
                    {atRisk > 0 ? `${atRisk} section${atRisk !== 1 ? 's' : ''} need${atRisk === 1 ? 's' : ''} attention` : 'All sections on track'}
                  </span>
                }
              />
              <KpiTile
                label="Sections to fix"
                value={String(atRisk)}
                index={1}
                onClick={firstFixSection ? () => switchDrilledSection(firstFixSection) : undefined}
                footer={<span className="text-[0.6875rem] text-ink-400">{fixName ? `Start with ${fixName}` : 'Nothing flagged'}</span>}
              />
              <KpiTile
                label="Controls"
                value={String(sectionMeta.controls.count)}
                index={2}
                onClick={() => switchDrilledSection('controls')}
                footer={<span className="text-[0.6875rem] text-ink-400"><span className="font-semibold text-ink-600 tabular-nums">{controlsEffective}</span> effective</span>}
              />
              <KpiTile
                label="Risks"
                value={String(sectionMeta.risks.count)}
                index={3}
                onClick={() => switchDrilledSection('risks')}
                footer={<span className="text-[0.6875rem] text-ink-400"><span className="font-semibold text-ink-600 tabular-nums">{risksMapped}</span> mapped</span>}
              />
            </div>
          );
        })()}

        {/* Engagement-style overview widgets — risk/control health, coverage funnel,
            workflows, and (placeholder) activity. Populated processes only. */}
        {!isFreshBP && (
          <BPOverviewDashboard
            bp={bp}
            risks={bpRisks}
            controls={bpControls}
            workflows={bpWfs}
            sops={bpSops}
            racms={bpRacms}
            attention={attentionItems}
            onOpenSection={switchDrilledSection}
          />
        )}

        {/* Setup checklist — onboarding for processes that aren't fully built out.
            Hidden once every section has content (the dashboard above covers it). */}
        {!sectionOrder.every(k => isSectionComplete(k)) && (() => {
          const SETUP_STEPS = [
            { key: 'sop' as const,       title: 'Upload SOP',      desc: 'Upload a Standard Operating Procedure to help generate risks, controls, and RACM.', cta: 'Upload SOP',             icon: Upload },
            { key: 'racm' as const,      title: 'Create RACM',     desc: 'Create a Risk and Control Matrix to map risks and controls for this process.',       cta: 'Create RACM',            icon: FileText },
            { key: 'risks' as const,     title: 'Create Risks',    desc: 'Identify and document risks relevant to this business process.',                      cta: 'Create Risk',            icon: AlertTriangle },
            { key: 'controls' as const,  title: 'Create Controls', desc: 'Create controls to mitigate the risks on this process.',                            cta: 'Create Control',         icon: Shield },
            { key: 'workflows' as const, title: 'Link Workflows',  desc: 'Link test workflows to define how controls will be tested.',                          cta: 'Link existing workflow', icon: Workflow },
          ];
          // Done-state comes from the shared isSectionComplete helper, so the
          // checklist and the Coverage panel always tell the same story.
          const isStepDone = isSectionComplete;
          const completed = SETUP_STEPS.filter(s => isStepDone(s.key)).length;
          const pct = Math.round((completed / SETUP_STEPS.length) * 100);
          return (
            <motion.section className="rounded-xl border border-canvas-border bg-white p-5 mb-5" {...revealProps(0)}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-brand-600 grid place-items-center shrink-0">
                    <Zap size={18} className="text-paper-0" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Set up this business process</h3>
                    <p className="text-[0.75rem] text-ink-400 mt-0.5">
                      <span className="font-mono tabular-nums">{completed}</span> of <span className="font-mono tabular-nums">{SETUP_STEPS.length}</span> steps complete
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:block w-32 h-2 bg-paper-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {SETUP_STEPS.map((step, i) => {
                  const done = isStepDone(step.key);
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className={`flex items-center gap-4 px-4 py-3.5 rounded-lg border transition-colors ${done ? 'border-compliant/25 bg-compliant-50/40' : 'border-canvas-border/40 bg-white'}`}>
                      {done ? (
                        <span className="w-6 h-6 rounded-full bg-compliant grid place-items-center shrink-0">
                          <CheckCircle2 size={16} className="text-paper-0" strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-paper-100 grid place-items-center shrink-0 font-mono text-[0.75rem] font-semibold text-ink-500 tabular-nums">{i + 1}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-[0.875rem] font-semibold leading-tight ${done ? 'text-compliant-700' : 'text-ink-900'}`}>{step.title}</h4>
                        <p className="text-[0.8125rem] text-ink-500 mt-0.5 leading-snug">{step.desc}</p>
                      </div>
                      {!done && (
                        <Button
                          variant="secondary"
                          size="sm"
                          shape="lg"
                          onClick={() => handleDropdownPick(step.key)}
                          className="shrink-0"
                          leftIcon={<Icon size={13} />}
                        >
                          {step.cta}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.section>
          );
        })()}
      </div>
    </div>
  );
}

/* ─── Process detail wrapper — landing now lives in ProgramsView ─── */
export default function BusinessProcesses({ selectedBPId, onSelectBP, userProcesses, onOpenRacmEditor, onOpenWorkflowDetail, onCreateWorkflow, onRunWorkflow }: Props) {
  if (selectedBPId) {
    const bp = [...BUSINESS_PROCESSES, ...userProcesses].find(b => b.id === selectedBPId);
    if (bp) return <BPDetailView bp={bp} onBack={() => onSelectBP(null)} onOpenRacmEditor={onOpenRacmEditor} onOpenWorkflowDetail={onOpenWorkflowDetail} onCreateWorkflow={onCreateWorkflow} onRunWorkflow={onRunWorkflow} />;
  }
  return null;
}

