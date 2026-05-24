// ─── Engagement Final — Internal Audit + Automation + Compliance Prototype ──
// Programs → Engagement Final. Reuses existing IA Scope, Automation Workflows/Cases,
// Business Process RACM, Compliance Controls/Evidence/WorkingPaper, and shared
// Activity Trail components.

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ClipboardCheck, Plus, Search, Calendar, Users, ChevronRight,
  Shield, ShieldCheck, Workflow, AlertTriangle, FileText, CheckCircle2, Clock, Eye,
  X,
} from 'lucide-react';

// Reused components
import type { ConfigurableEngagement, InternalAuditConfig } from '../engagement-configurable/configurableEngagementTypes';
import { EngagementPatternType, EngagementStatus, AuditScopeLevel } from '../engagement-configurable/configurableEngagementTypes';
import InternalAuditScopeTab from '../engagement-configurable/patterns/internal-audit/InternalAuditScopeTab';
import { DEFAULT_IA_SCOPE, type InternalAuditScopeState } from '../engagement-configurable/patterns/internal-audit/internalAuditScopeData';
import InternalAuditAnnouncementTab from '../engagement-configurable/patterns/internal-audit/InternalAuditAnnouncementTab';
import { DEFAULT_ANNOUNCEMENT, type InternalAuditAnnouncementState } from '../engagement-configurable/patterns/internal-audit/internalAuditAnnouncementData';
import RACMTab from '../audit/RACMTab';
import ControlsTab from '../audit/ControlsTab';
import EvidenceTab from '../audit/EvidenceTab';
import WorkingPaperTab from '../audit/WorkingPaperTab';
import { HealthOverviewTab, ActionTrailTab } from '../audit/EngagementOverviewView';
import type { Engagement as RACMEngagement } from '../../data/engagements';
import InternalAuditControlsTab from '../engagement-configurable/patterns/internal-audit/InternalAuditControlsTab';
import type { InternalAuditAnalysisState } from '../engagement-configurable/patterns/internal-audit/internalAuditAnalysisData';
import AutomationWorkflowsTab from '../engagement-configurable/patterns/automation/AutomationWorkflowsTab';
import AutomationCasesTab from '../engagement-configurable/patterns/automation/AutomationCasesTab';
import type { AutomationProjectWorkspaceState } from '../engagement-configurable/patterns/automation/automationInputData';
import type { AutomationSetupState } from '../engagement-configurable/patterns/automation/automationSetupData';
import type { AutomationRunsState, AutomationRun, ExceptionStatus as AutoExceptionStatus } from '../engagement-configurable/patterns/automation/automationRunsData';
import type { AnalysisRun } from '../engagement-configurable/patterns/internal-audit/internalAuditAnalysisData';
import type { AutomationOutputReviewState } from '../engagement-configurable/patterns/automation/automationOutputReviewData';
import type { AutomationCasesState } from '../engagement-configurable/patterns/automation/automationCasesData';
import type { AutomationReportsState } from '../engagement-configurable/patterns/automation/automationReportsData';
import type { AutomationScheduleState } from '../engagement-configurable/patterns/automation/automationScheduleData';
import type { AutomationInputDataState } from '../engagement-configurable/patterns/automation/automationInputData';

// ─── Mock Data ──────────────────────────────────────────────────────────

interface IAEngagementCard {
  id: string; code: string; name: string; description: string;
  type: 'Internal Audit' | 'Automation' | 'Compliance'; process: string; entity: string;
  owner: string; reviewer: string; framework: string;
  status: string; statusTone: string; period: string;
  exceptions: number; health: number; nextAction: string;
  lastActivity: string;
}

const STATUS_CLS: Record<string, string> = {
  Active: 'bg-compliant-50 text-compliant-700', 'In Progress': 'bg-evidence-50 text-evidence-700',
  'In Fieldwork': 'bg-evidence-50 text-evidence-700', 'Scope Defined': 'bg-brand-50 text-brand-700',
  'Exception Review': 'bg-mitigated-50 text-mitigated-700', 'Pending Review': 'bg-mitigated-50 text-mitigated-700',
  'Report Pending': 'bg-brand-50 text-brand-700', Planned: 'bg-brand-50 text-brand-700',
  Draft: 'bg-draft-50 text-draft-700', Closed: 'bg-gray-100 text-gray-600', Review: 'bg-mitigated-50 text-mitigated-700',
};
const STATUS_DOT: Record<string, string> = {
  Active: 'bg-compliant', 'In Progress': 'bg-evidence-600', 'In Fieldwork': 'bg-evidence-600',
  'Scope Defined': 'bg-brand-500', 'Exception Review': 'bg-mitigated-600', 'Pending Review': 'bg-mitigated-600',
  'Report Pending': 'bg-brand-500', Planned: 'bg-brand-500', Draft: 'bg-gray-400', Closed: 'bg-gray-400', Review: 'bg-mitigated-600',
};
const TYPE_CLS: Record<string, string> = {
  Compliance: 'bg-brand-50 text-brand-700 border-brand-100',
  'Internal Audit': 'bg-evidence-50 text-evidence-700 border-evidence-100',
  Automation: 'bg-compliant-50 text-compliant-700 border-compliant-100',
};
function healthTier(pct: number) {
  if (pct >= 85) return { bar: 'bg-compliant', text: 'text-compliant-700' };
  if (pct >= 65) return { bar: 'bg-mitigated-500', text: 'text-mitigated-700' };
  return { bar: 'bg-risk', text: 'text-risk-700' };
}

const MOCK_IA_ENGAGEMENTS: IAEngagementCard[] = [
  { id: 'ef-001', code: 'EF-001', name: 'P2P Internal Audit Review', description: 'Internal audit of Procure to Pay — duplicate invoices, PO approvals, vendor master changes, and payment authorization.', type: 'Internal Audit', process: 'P2P', entity: 'Corporate', owner: 'Karan Mehta', reviewer: 'Sneha Desai', framework: 'Internal Policy', status: 'In Progress', statusTone: 'bg-evidence-50 text-evidence-700', period: 'Jan 2026 – Jun 2026', exceptions: 5, health: 68, nextAction: 'Run Workflows', lastActivity: '2h ago' },
  { id: 'ef-002', code: 'EF-002', name: 'Vendor Onboarding Audit', description: 'Operational audit of vendor onboarding process — qualification, KYC, sanctions screening, and risk scoring.', type: 'Internal Audit', process: 'P2P', entity: 'Corporate', owner: 'Tushar Goel', reviewer: 'Karan Mehta', framework: 'Internal Policy', status: 'Planned', statusTone: 'bg-blue-50 text-blue-700', period: 'Feb 2026 – Jul 2026', exceptions: 0, health: 0, nextAction: 'Define Scope', lastActivity: 'Not started' },
  { id: 'ef-003', code: 'EF-003', name: 'Branch Operations Audit', description: 'Audit of branch-level operational controls — cash handling, inventory, and daily reconciliation.', type: 'Internal Audit', process: 'P2P', entity: 'Branch — Mumbai', owner: 'Deepak Bansal', reviewer: 'Karan Mehta', framework: 'Internal Policy', status: 'Exception Review', statusTone: 'bg-amber-50 text-amber-700', period: 'Oct 2025 – Mar 2026', exceptions: 7, health: 52, nextAction: 'Review Exceptions', lastActivity: '1d ago' },
  { id: 'ef-004', code: 'EF-004', name: 'Inventory Management Review', description: 'Internal audit of plant inventory — cycle counts, stock valuation, and write-off authorization.', type: 'Internal Audit', process: 'P2P', entity: 'Plant — Pune', owner: 'Neha Joshi', reviewer: 'Rohan Patel', framework: 'Internal Policy', status: 'Report Pending', statusTone: 'bg-purple-50 text-purple-700', period: 'Mar 2026 – Aug 2026', exceptions: 4, health: 71, nextAction: 'Generate Report', lastActivity: '3d ago' },
  { id: 'ef-auto-001', code: 'EF-A-001', name: 'AP Duplicate Invoice Monitor', description: 'Continuous monitoring for duplicate AP invoice posting — daily scan against vendor, amount, invoice number, and date.', type: 'Automation', process: 'P2P', entity: 'Corporate', owner: 'Priya Singh', reviewer: 'Karan Mehta', framework: 'Internal Policy', status: 'Active', statusTone: 'bg-emerald-50 text-emerald-700', period: 'Oct 2025 – Mar 2026', exceptions: 4, health: 88, nextAction: 'in 8h', lastActivity: '3h ago' },
  { id: 'ef-auto-002', code: 'EF-A-002', name: 'Vendor Master Change Monitor', description: 'Monitors vendor master data changes — bank account, address, and contact updates requiring dual authorization.', type: 'Automation', process: 'P2P', entity: 'Corporate', owner: 'Sneha Desai', reviewer: 'Tushar Goel', framework: 'Internal Policy', status: 'Active', statusTone: 'bg-emerald-50 text-emerald-700', period: 'Jan 2026 – Jun 2026', exceptions: 2, health: 92, nextAction: 'in 6h', lastActivity: '1h ago' },
  { id: 'ef-auto-003', code: 'EF-A-003', name: 'PO Approval Threshold Scanner', description: 'Scans purchase orders against approval matrix — flags threshold breaches and split-PO patterns.', type: 'Automation', process: 'P2P', entity: 'Plant — Pune', owner: 'Neha Joshi', reviewer: 'Deepak Bansal', framework: 'Internal Policy', status: 'In Progress', statusTone: 'bg-evidence-50 text-evidence-700', period: 'Mar 2026 – Aug 2026', exceptions: 3, health: 78, nextAction: 'Configure', lastActivity: '6h ago' },
  { id: 'ef-comp-001', code: 'EF-C-001', name: 'P2P SOX Control Testing', description: 'SOX ICFR testing of Procure-to-Pay controls — vendor master, PO approval, three-way match, payment release.', type: 'Compliance', process: 'P2P', entity: 'Corporate', owner: 'Tushar Goel', reviewer: 'Audit Lead', framework: 'SOX ICFR', status: 'In Progress', statusTone: 'bg-evidence-50 text-evidence-700', period: 'Jan 2026 – Jun 2026', exceptions: 3, health: 76, nextAction: 'Continue Testing', lastActivity: 'Today' },
  { id: 'ef-comp-002', code: 'EF-C-002', name: 'O2C IFC Control Testing', description: 'IFC assessment for Order-to-Cash — credit limits, invoicing, revenue recognition cutoffs.', type: 'Compliance', process: 'O2C', entity: 'Corporate', owner: 'Neha Joshi', reviewer: 'SOX Manager', framework: 'IFC', status: 'Pending Review', statusTone: 'bg-amber-50 text-amber-700', period: 'Jan 2026 – Jun 2026', exceptions: 1, health: 89, nextAction: 'Review Controls', lastActivity: '6h ago' },
  { id: 'ef-comp-003', code: 'EF-C-003', name: 'R2R ICFR Control Testing', description: 'ICFR testing for Record-to-Report — journal entries, reconciliation, and financial close.', type: 'Compliance', process: 'R2R', entity: 'Corporate', owner: 'Karan Mehta', reviewer: 'Finance Controller', framework: 'ICFR', status: 'Planned', statusTone: 'bg-blue-50 text-blue-700', period: 'Apr 2026 – Sep 2026', exceptions: 0, health: 0, nextAction: 'Start Testing', lastActivity: 'Not started' },
];

function buildEngagement(card: IAEngagementCard): ConfigurableEngagement {
  return {
    id: card.id, name: card.name,
    patternType: EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT,
    displayLabel: 'Audit Assignment', description: card.description,
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

function buildAutomationEngagement(card: IAEngagementCard): ConfigurableEngagement {
  return {
    id: card.id, name: card.name,
    patternType: EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT,
    displayLabel: 'Automation', description: card.description,
    owner: card.owner, reviewer: card.reviewer, businessProcess: card.process, entityOrLocation: card.entity,
    status: EngagementStatus.IN_PROGRESS, stage: card.status,
    config: {
      patternType: EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT,
    } as any,
    outputs: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

// ─── Toast Component ───────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[12px] font-medium shadow-lg"
    >
      {message}
    </motion.div>
  );
}

// ─── Automation Creation Modal ─────────────────────────────────────────

const AUTOMATION_CATEGORIES = [
  'Continuous Monitoring',
  'Reconciliation Automation',
  'Exception Detection',
  'MIS / Reporting Automation',
  'Ad-hoc Workflow Automation',
] as const;

const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[12.5px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const fieldLabelCls = 'text-[11.5px] font-semibold text-text-muted block mb-1.5';

function AutomationCreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (card: IAEngagementCard) => void;
}) {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [owner, setOwner] = useState('');
  const [process, setProcess] = useState('');
  const [entity, setEntity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');
  const [validation, setValidation] = useState('');

  const handleCreate = () => {
    if (!name.trim()) { setValidation('Project name is required.'); return; }
    if (!objective.trim()) { setValidation('Objective is required.'); return; }
    if (!owner.trim()) { setValidation('Project owner is required.'); return; }
    const card: IAEngagementCard = {
      id: `ef-auto-new-${Date.now()}`,
      code: `EF-A-${Date.now().toString().slice(-3)}`,
      name: name.trim(),
      description: objective.trim(),
      type: 'Automation',
      process: process || 'P2P',
      entity: entity || 'Corporate',
      owner: owner.trim(),
      reviewer: '—',
      framework: 'Internal Policy',
      status: 'Draft',
      statusTone: 'bg-gray-100 text-gray-600',
      period: startDate && endDate ? `${startDate} – ${endDate}` : '—',
      exceptions: 0,
      health: 0,
      nextAction: 'Configure Workflows',
      lastActivity: 'Just created',
    };
    onCreate(card);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50" onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[540px] bg-white rounded-2xl border border-border-light shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Workflow size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-text">Create Automation Project</h2>
              <p className="text-[11px] text-text-muted mt-0.5">Workflows, files, schedules, and exceptions can be configured inside the workspace.</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-text cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className={fieldLabelCls}>Project Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => { setName(e.target.value); setValidation(''); }} placeholder="e.g. AP Duplicate Invoice Monitor" className={fieldCls} />
          </div>
          <div>
            <label className={fieldLabelCls}>Objective / Description <span className="text-red-400">*</span></label>
            <textarea value={objective} onChange={e => { setObjective(e.target.value); setValidation(''); }} rows={2}
              placeholder="What will this automation monitor or detect?" className={fieldCls + ' resize-none'} />
          </div>
          <div>
            <label className={fieldLabelCls}>Project Owner <span className="text-red-400">*</span></label>
            <input value={owner} onChange={e => { setOwner(e.target.value); setValidation(''); }} placeholder="e.g. Priya Singh" className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={fieldLabelCls}>Business Process</label>
              <select value={process} onChange={e => setProcess(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                <option value="">Select...</option>
                <option value="Procure to Pay">Procure to Pay</option>
                <option value="Order to Cash">Order to Cash</option>
                <option value="Record to Report">Record to Report</option>
                <option value="IT General Controls">IT General Controls</option>
              </select>
            </div>
            <div>
              <label className={fieldLabelCls}>Entity / Location</label>
              <input value={entity} onChange={e => setEntity(e.target.value)} placeholder="e.g. Corporate" className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Automation Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
              <option value="">Select category...</option>
              {AUTOMATION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={fieldLabelCls}>Planned Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={fieldLabelCls}>Planned End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50/50 border border-emerald-100/60 text-[10.5px] text-emerald-700 leading-relaxed">
            <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
            <span>You can add workflows and configure runs after creation.</span>
          </div>

          {validation && <p className="text-[11px] text-red-500 font-medium">{validation}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light bg-surface-2/20 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-gray-500 hover:text-text hover:bg-gray-100 cursor-pointer transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate}
            className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors shadow-sm shadow-primary/20">
            Create Project
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Internal Audit Creation Modal ────────────────────────────────────

const SCOPE_LEVELS = ['Process', 'Sub-process', 'Activity', 'Specific Element'] as const;
const BUSINESS_PROCESSES_LIST = ['P2P', 'O2C', 'R2R', 'H2R', 'ITGC'] as const;

interface IASetupOptions {
  includeScope: boolean;
  useSOP: boolean;
  useChecklist: boolean;
  useRACM: boolean;
  enableWorkflows: boolean;
  enableExceptions: boolean;
  enableReport: boolean;
  enableTrail: boolean;
}

const DEFAULT_SETUP: IASetupOptions = {
  includeScope: true, useSOP: false, useChecklist: false, useRACM: false,
  enableWorkflows: true, enableExceptions: true, enableReport: true, enableTrail: true,
};

function IACreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (card: IAEngagementCard) => void;
}) {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [owner, setOwner] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [process, setProcess] = useState('');
  const [entity, setEntity] = useState('');
  const [scopeLevel, setScopeLevel] = useState('Process');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [setup, setSetup] = useState<IASetupOptions>({ ...DEFAULT_SETUP });
  const [validation, setValidation] = useState('');

  const toggle = (key: keyof IASetupOptions) => setSetup(p => ({ ...p, [key]: !p[key] }));

  const handleCreate = () => {
    if (!name.trim()) { setValidation('Assignment name is required.'); return; }
    if (!objective.trim()) { setValidation('Objective is required.'); return; }
    if (!owner.trim()) { setValidation('Owner is required.'); return; }
    const card: IAEngagementCard = {
      id: `ef-ia-new-${Date.now()}`,
      code: `EF-${Date.now().toString().slice(-3)}`,
      name: name.trim(),
      description: objective.trim(),
      type: 'Internal Audit',
      process: process || 'P2P',
      entity: entity || 'Corporate',
      owner: owner.trim(),
      reviewer: reviewer.trim() || '—',
      framework: 'Internal Policy',
      status: 'Draft',
      statusTone: 'bg-draft-50 text-draft-700',
      period: periodFrom && periodTo ? `${periodFrom} – ${periodTo}` : startDate && endDate ? `${startDate} – ${endDate}` : '—',
      exceptions: 0,
      health: 0,
      nextAction: 'Define Scope',
      lastActivity: 'Just created',
    };
    onCreate(card);
  };

  const checkboxCls = 'w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer accent-primary';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[580px] bg-white rounded-2xl border border-border-light shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <ClipboardCheck size={16} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-text">Create Internal Audit Assignment</h2>
              <p className="text-[11px] text-text-muted mt-0.5">Define scope, attach RACM/checklists, run workflows, and generate reports after creation.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-text cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* A. Basic Details */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Basic Details</h4>
            <div>
              <label className={fieldLabelCls}>Assignment Name <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => { setName(e.target.value); setValidation(''); }} placeholder="e.g. P2P Internal Audit Review" className={fieldCls} />
            </div>
            <div>
              <label className={fieldLabelCls}>Objective / Description <span className="text-red-400">*</span></label>
              <textarea value={objective} onChange={e => { setObjective(e.target.value); setValidation(''); }} rows={2}
                placeholder="What is the audit focus and scope?" className={fieldCls + ' resize-none'} />
            </div>
          </div>

          {/* B. Ownership */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Ownership</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelCls}>Owner <span className="text-red-400">*</span></label>
                <input value={owner} onChange={e => { setOwner(e.target.value); setValidation(''); }} placeholder="e.g. Karan Mehta" className={fieldCls} />
              </div>
              <div>
                <label className={fieldLabelCls}>Reviewer</label>
                <input value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="e.g. Sneha Desai" className={fieldCls} />
              </div>
            </div>
          </div>

          {/* C. Timeline */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Timeline</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelCls}>Planned Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={fieldLabelCls}>Planned End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={fieldCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelCls}>Data / Audit Period From</label>
                <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={fieldLabelCls}>Data / Audit Period To</label>
                <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className={fieldCls} />
              </div>
            </div>
          </div>

          {/* E. Initial Setup Options */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Initial Setup Options</h4>
            <div className="rounded-lg border border-border-light bg-surface-2/20 p-4 space-y-3">
              {([
                { key: 'includeScope' as const, label: 'Include Scope setup', desc: 'Define what this audit will cover' },
                { key: 'useSOP' as const, label: 'Use SOP / process documents', desc: 'Attach SOPs to derive RACM and controls' },
                { key: 'useChecklist' as const, label: 'Use Checklist', desc: 'Create controls from checklist items' },
                { key: 'useRACM' as const, label: 'Use RACM', desc: 'Select and map risk-control matrix' },
                { key: 'enableWorkflows' as const, label: 'Enable workflow execution', desc: 'Run automated workflows on audit data' },
                { key: 'enableExceptions' as const, label: 'Enable exception management', desc: 'Track and manage exceptions from runs' },
                { key: 'enableReport' as const, label: 'Generate audit report', desc: 'Create and publish audit report' },
                { key: 'enableTrail' as const, label: 'Enable action trail', desc: 'Track engagement activity' },
              ]).map(opt => (
                <label key={opt.key} className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={setup[opt.key]} onChange={() => toggle(opt.key)} className={checkboxCls + ' mt-0.5'} />
                  <div>
                    <div className="text-[12px] font-semibold text-text group-hover:text-primary transition-colors">{opt.label}</div>
                    <div className="text-[10.5px] text-text-muted">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {validation && <p className="text-[11px] text-red-500 font-medium">{validation}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light bg-surface-2/20 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-gray-500 hover:text-text hover:bg-gray-100 cursor-pointer transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate}
            className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors shadow-sm shadow-primary/20">
            Create Internal Audit
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Compliance Creation Modal ────────────────────────────────────────

const FRAMEWORKS = ['SOX ICFR', 'IFC', 'ICFR', 'ICOFR', 'SOC 1', 'Internal Financial Control', 'Custom'] as const;
const COMP_PROCESSES = ['P2P', 'O2C', 'R2R', 'Inventory', 'Payroll', 'ITGC'] as const;

function ComplianceCreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (card: IAEngagementCard) => void;
}) {
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('');
  const [process, setProcess] = useState('');
  const [entity, setEntity] = useState('');
  const [owner, setOwner] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [validation, setValidation] = useState('');

  const handleCreate = () => {
    if (!name.trim()) { setValidation('Engagement name is required.'); return; }
    if (!framework) { setValidation('Framework is required.'); return; }
    if (!process) { setValidation('Business process is required.'); return; }
    if (!owner.trim()) { setValidation('Owner is required.'); return; }
    if (!reviewer.trim()) { setValidation('Reviewer is required.'); return; }
    const card: IAEngagementCard = {
      id: `ef-comp-new-${Date.now()}`,
      code: `EF-C-${Date.now().toString().slice(-3)}`,
      name: name.trim(),
      description: description.trim() || `${framework} compliance control testing for ${process}.`,
      type: 'Compliance',
      process: process,
      entity: entity || 'Corporate',
      owner: owner.trim(),
      reviewer: reviewer.trim(),
      framework: framework,
      status: 'Planned',
      statusTone: 'bg-brand-50 text-brand-700',
      period: startDate && endDate ? `${startDate} – ${endDate}` : '—',
      exceptions: 0,
      health: 0,
      nextAction: 'Start Testing',
      lastActivity: 'Just created',
    };
    onCreate(card);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[560px] bg-white rounded-2xl border border-border-light shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <ShieldCheck size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-text">Create Compliance Engagement</h2>
              <p className="text-[11px] text-text-muted mt-0.5">RACM, controls, samples, evidence, testing, review, and conclusion can be completed after creation.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-text cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Basic Details */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Basic Details</h4>
            <div>
              <label className={fieldLabelCls}>Engagement Name <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => { setName(e.target.value); setValidation(''); }} placeholder="e.g. P2P SOX Control Testing" className={fieldCls} />
            </div>
            <div>
              <label className={fieldLabelCls}>Description / Objective</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="What is the testing scope and objective?" className={fieldCls + ' resize-none'} />
            </div>
          </div>

          {/* Framework & Process */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Framework & Process</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelCls}>Framework <span className="text-red-400">*</span></label>
                <select value={framework} onChange={e => { setFramework(e.target.value); setValidation(''); }} className={fieldCls + ' cursor-pointer appearance-none'}>
                  <option value="">Select framework...</option>
                  {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className={fieldLabelCls}>Business Process <span className="text-red-400">*</span></label>
                <select value={process} onChange={e => { setProcess(e.target.value); setValidation(''); }} className={fieldCls + ' cursor-pointer appearance-none'}>
                  <option value="">Select process...</option>
                  {COMP_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={fieldLabelCls}>Entity / Location</label>
              <input value={entity} onChange={e => setEntity(e.target.value)} placeholder="e.g. Corporate" className={fieldCls} />
            </div>
          </div>

          {/* Ownership */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Ownership</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelCls}>Owner <span className="text-red-400">*</span></label>
                <input value={owner} onChange={e => { setOwner(e.target.value); setValidation(''); }} placeholder="e.g. Tushar Goel" className={fieldCls} />
              </div>
              <div>
                <label className={fieldLabelCls}>Reviewer <span className="text-red-400">*</span></label>
                <input value={reviewer} onChange={e => { setReviewer(e.target.value); setValidation(''); }} placeholder="e.g. Audit Lead" className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Timeline</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelCls}>Planned Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={fieldLabelCls}>Planned End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={fieldCls} />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-100/60 text-[10.5px] text-blue-700 leading-relaxed">
            <ShieldCheck size={12} className="shrink-0 mt-0.5" />
            <span>You can select RACM, set up controls, and begin testing after creation.</span>
          </div>

          {validation && <p className="text-[11px] text-red-500 font-medium">{validation}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light bg-surface-2/20 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-gray-500 hover:text-text hover:bg-gray-100 cursor-pointer transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate}
            className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors shadow-sm shadow-primary/20">
            Create Compliance Engagement
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Type Picker Modal ─────────────────────────────────────────────────

function TypePickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (type: 'Internal Audit' | 'Automation' | 'Compliance') => void }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[680px] bg-white rounded-2xl border border-border-light shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <div>
            <h2 className="text-[15px] font-bold text-text">New Engagement</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Choose the engagement type to get started.</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-text cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>
        {/* Cards */}
        <div className="p-6 grid grid-cols-3 gap-4">
          <button
            onClick={() => onSelect('Internal Audit')}
            className="text-left p-4 rounded-xl border border-border-light hover:border-purple-300 hover:bg-purple-50/30 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
              <ClipboardCheck size={18} className="text-purple-600" />
            </div>
            <div className="text-[13px] font-bold text-text group-hover:text-purple-700 transition-colors">Internal Audit</div>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">Multi-stage audit: scope, RACM, controls, workflows, exceptions, and reporting.</p>
          </button>
          <button
            onClick={() => onSelect('Automation')}
            className="text-left p-4 rounded-xl border border-border-light hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
              <Workflow size={18} className="text-emerald-600" />
            </div>
            <div className="text-[13px] font-bold text-text group-hover:text-emerald-700 transition-colors">Automation</div>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">Continuous monitoring: configure workflows, detect exceptions, and manage cases.</p>
          </button>
          <button
            onClick={() => onSelect('Compliance')}
            className="text-left p-4 rounded-xl border border-border-light hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
              <ShieldCheck size={18} className="text-blue-600" />
            </div>
            <div className="text-[13px] font-bold text-text group-hover:text-blue-700 transition-colors">Compliance</div>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">Framework-driven control testing with RACM, samples, evidence, attribute testing, and working paper.</p>
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Landing Page ───────────────────────────────────────────────────────

function EngagementFinalLanding({ onOpen }: { onOpen: (card: IAEngagementCard) => void }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [processFilter, setProcessFilter] = useState('All');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showAutoCreate, setShowAutoCreate] = useState(false);
  const [showIACreate, setShowIACreate] = useState(false);
  const [showCompCreate, setShowCompCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = MOCK_IA_ENGAGEMENTS.filter(e => {
    if (typeFilter !== 'All' && e.type !== typeFilter) return false;
    if (statusFilter !== 'All' && e.status !== statusFilter) return false;
    if (processFilter !== 'All' && e.process !== processFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.owner.toLowerCase().includes(q) || e.process.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || e.framework.toLowerCase().includes(q);
    }
    return true;
  });

  const allStatuses = [...new Set(MOCK_IA_ENGAGEMENTS.map(e => e.status))];
  const allProcesses = [...new Set(MOCK_IA_ENGAGEMENTS.map(e => e.process))];

  const activityLabel = (eng: IAEngagementCard) => {
    if (eng.type === 'Automation') return { last: 'Last run', next: 'Next run' };
    if (eng.type === 'Compliance') return { last: 'Last tested', next: 'Next milestone' };
    return { last: 'Last activity', next: 'Next milestone' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold text-text-muted tracking-wider uppercase mb-1">Engagements</div>
          <h1 className="font-display text-[28px] font-bold text-text tracking-tight">Engagement Final</h1>
          <p className="text-[13px] text-text-secondary mt-1.5">Browse all engagements — compliance audits, internal audits, and automation programs.</p>
        </div>
        <button onClick={() => setShowTypePicker(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-medium text-white text-[13px] font-semibold hover:from-primary-hover hover:to-primary transition-all cursor-pointer shadow-sm">
          <Plus size={14} />New Engagement
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search engagement, owner, framework, or code..."
          className="w-full pl-9 pr-4 h-10 rounded-lg border border-border-light bg-white text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Type</span>
        {['All', 'Compliance', 'Internal Audit', 'Automation'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${typeFilter === t ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'}`}>
            {t}
          </button>
        ))}
        <div className="w-px h-5 bg-border-light" />
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Status</span>
        {['All', ...allStatuses.slice(0, 4)].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${statusFilter === s ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'}`}>
            {s}
          </button>
        ))}
        <div className="w-px h-5 bg-border-light" />
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Process</span>
        {['All', ...allProcesses].map(p => (
          <button key={p} onClick={() => setProcessFilter(p)}
            className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${processFilter === p ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'}`}>
            {p}
          </button>
        ))}
      </div>

      {/* Engagement List */}
      <div className="border border-border-light rounded-xl bg-white overflow-hidden">
        {/* Column Headers */}
        <div className="grid grid-cols-[2.4fr_1fr_1.3fr_1.4fr] gap-5 px-6 py-3 bg-surface-2/30 border-b border-border-light text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80">
          <div>Engagement</div>
          <div>Type</div>
          <div>Health</div>
          <div>Activity</div>
        </div>

        {/* Rows */}
        {filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-[13px] text-text-muted">No engagements match your filters.</div>
        )}
        {filtered.map((eng, i) => {
          const health = healthTier(eng.health);
          const labels = activityLabel(eng);
          const isNotStarted = eng.health === 0 && (eng.status === 'Planned' || eng.status === 'Draft');
          return (
            <motion.div key={eng.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
              onClick={() => onOpen(eng)}
              className="grid grid-cols-[2.4fr_1fr_1.3fr_1.4fr] gap-5 px-6 py-5 border-b border-border-light last:border-0 hover:bg-surface-2/30 transition-colors cursor-pointer items-start"
            >
              {/* Col 1: Engagement */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[14.5px] font-semibold text-text leading-snug">{eng.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold ${STATUS_CLS[eng.status] || 'bg-gray-100 text-gray-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[eng.status] || 'bg-gray-400'}`} />
                    {eng.status}
                  </span>
                </div>
                <p className="text-[12px] text-text-secondary mt-1.5 leading-relaxed line-clamp-2 max-w-2xl">{eng.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted flex-wrap">
                  <span className="font-mono tracking-tight">{eng.code}</span>
                  <span className="text-border">·</span>
                  <span>{eng.owner}</span>
                  <span className="text-border">·</span>
                  <span className="tabular-nums">{eng.period}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold bg-surface-2 text-text-secondary border border-border-light">{eng.process}</span>
                  <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-medium bg-white text-text-muted border border-border-light">{eng.framework}</span>
                </div>
              </div>

              {/* Col 2: Type */}
              <div className="flex flex-col items-start gap-1.5">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${TYPE_CLS[eng.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {eng.type}
                </span>
              </div>

              {/* Col 3: Health */}
              <div className="space-y-1.5">
                {isNotStarted ? (
                  <div className="text-[11px] text-text-muted italic">Not yet started</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] font-bold tabular-nums ${health.text}`}>{eng.health}%</span>
                      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Effective</span>
                    </div>
                    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full ${health.bar} rounded-full transition-all duration-500`} style={{ width: `${eng.health}%` }} />
                    </div>
                  </>
                )}
                {eng.exceptions > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={11} className="text-risk-700" />
                    <span className="text-[11px] font-semibold text-risk-700">{eng.exceptions}</span>
                    <span className="text-[11px] text-text-muted">open</span>
                  </div>
                )}
              </div>

              {/* Col 4: Activity */}
              <div className="flex flex-col gap-1 min-w-0 text-[11px]">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-text-muted shrink-0">{labels.last}</span>
                  <span className="text-text font-medium truncate">{eng.lastActivity}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <Clock size={10} className="text-text-muted shrink-0 self-center" />
                  <span className="text-text-muted shrink-0">{labels.next}</span>
                  <span className="text-text font-medium truncate">{eng.nextAction}</span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Footer */}
        <div className="px-6 py-2.5 bg-surface-2/30 border-t border-border-light text-[11px] text-text-muted">
          {filtered.length} of {MOCK_IA_ENGAGEMENTS.length} engagements
        </div>
      </div>

      {/* Type Picker Modal */}
      <AnimatePresence>
        {showTypePicker && (
          <TypePickerModal
            onClose={() => setShowTypePicker(false)}
            onSelect={(type) => {
              setShowTypePicker(false);
              if (type === 'Automation') {
                setShowAutoCreate(true);
              } else if (type === 'Internal Audit') {
                setShowIACreate(true);
              } else if (type === 'Compliance') {
                setShowCompCreate(true);
              } else {
                setToast(`${type} engagement creation coming soon`);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Automation Creation Modal */}
      <AnimatePresence>
        {showAutoCreate && (
          <AutomationCreateModal
            onClose={() => setShowAutoCreate(false)}
            onCreate={(card) => {
              setShowAutoCreate(false);
              onOpen(card);
            }}
          />
        )}
      </AnimatePresence>

      {/* Internal Audit Creation Modal */}
      <AnimatePresence>
        {showIACreate && (
          <IACreateModal
            onClose={() => setShowIACreate(false)}
            onCreate={(card) => {
              setShowIACreate(false);
              onOpen(card);
            }}
          />
        )}
      </AnimatePresence>

      {/* Compliance Creation Modal */}
      <AnimatePresence>
        {showCompCreate && (
          <ComplianceCreateModal
            onClose={() => setShowCompCreate(false)}
            onCreate={(card) => {
              setShowCompCreate(false);
              onOpen(card);
            }}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
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
  { id: 'trail', label: 'Action Trail' },
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

const AUTOMATION_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'exceptions', label: 'Exception Management' },
  { id: 'trail', label: 'Action Trail' },
];

// ─── Automation Final Workspace ────────────────────────────────────────

function AutomationFinalWorkspace({ card, onBack }: { card: IAEngagementCard; onBack: () => void }) {
  const engagement = useMemo(() => buildAutomationEngagement(card), [card]);
  const [activeTab, setActiveTab] = useState('overview');

  // Automation state
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

  const completedRuns = automationState.runs.runs.filter(r => r.status === 'COMPLETED');
  const totalExceptions = completedRuns.flatMap(r => r.exceptions).length;

  // Build an Engagement object for HealthOverviewTab
  const overviewEngagement = useMemo<RACMEngagement>(() => ({
    id: card.id,
    code: card.id.toUpperCase(),
    name: card.name,
    description: `Continuous monitoring of ${card.process} process.`,
    type: 'Automation',
    subtype: 'CCM',
    process: (card.process as RACMEngagement['process']) || 'P2P',
    framework: 'Internal Policy',
    owner: card.owner,
    status: 'Active',
    periodStart: card.period.split(' – ')[0] || '',
    periodEnd: card.period.split(' – ')[1] || '',
    controls: 4,
    health: totalExceptions > 0 ? Math.max(40, 100 - totalExceptions * 5) : 88,
    openIssues: totalExceptions || card.exceptions,
    lastActivity: completedRuns.length > 0 ? 'Today' : '3h ago',
    nextScheduled: 'in 8h',
  }), [card, totalExceptions, completedRuns.length]);

  // Action trail events
  const trailEvents = useMemo(() => {
    const events: { id: string; time: string; title: string; subtitle: string; type: string }[] = [];
    events.push({ id: '1', time: 'Today', title: 'Engagement opened', subtitle: card.name, type: 'config' });
    events.push({ id: '2', time: 'Today', title: 'Automation configured', subtitle: `Process: ${card.process}`, type: 'config' });
    for (const run of automationState.runs.runs.filter(r => r.status === 'COMPLETED')) {
      events.push({ id: `run-${run.id}`, time: 'Today', title: `Workflow run completed: ${run.workflowNames?.join(', ') || run.workflowName}`, subtitle: `${run.exceptionCount} exceptions · ${run.processedRecords} records`, type: 'run' });
    }
    if (automationState.cases.cases.length > 0) {
      events.push({ id: 'cases', time: 'Today', title: `${automationState.cases.cases.length} case(s) created`, subtitle: 'Exception management in progress', type: 'case' });
    }
    return events;
  }, [card, automationState.runs.runs, automationState.cases.cases.length]);

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
            <div className="p-2 rounded-lg bg-emerald-100"><Workflow size={18} className="text-emerald-600" /></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[15px] font-bold text-text">{card.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${card.statusTone}`}>{card.status}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold">Automation</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold">CCM</span>
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
          {AUTOMATION_TABS.map(tab => (
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
        <HealthOverviewTab
          eng={overviewEngagement}
          onDrillToExceptions={() => setActiveTab('exceptions')}
          onConfigureWorkflow={() => setActiveTab('workflows')}
          hideWorkflowConfig
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
          skipOutputCheck
        />
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
                  config: { icon: Workflow, bg: 'bg-gray-200', color: 'text-gray-500', border: 'border-l-gray-300' },
                  run: { icon: Workflow, bg: 'bg-emerald-100', color: 'text-emerald-600', border: 'border-l-emerald-300' },
                  case: { icon: AlertTriangle, bg: 'bg-amber-100', color: 'text-amber-600', border: 'border-l-amber-300' },
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
    </div>
  );
}

// ─── IA Workspace ──────────────────────────────────────────────────────

function EngagementFinalWorkspace({ card, onBack, onOpenRacmFullEditor }: { card: IAEngagementCard; onBack: () => void; onOpenRacmFullEditor?: (ctx: { racmId: string; racmName: string; processLabel: string }) => void }) {
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

  // Merge workflow runs + control analysis runs into a single AutomationRunsState for the Exception Management tab
  const mergedRunsState: AutomationRunsState = useMemo(() => {
    const analysisAsAutomation: AutomationRun[] = analysisState.runs
      .filter(r => r.status === 'COMPLETED' && r.exceptions.length > 0)
      .map((ar: AnalysisRun) => ({
        id: ar.id, runName: ar.title, runType: 'WORKFLOW' as const, sourceSetupMode: 'CONTROL_EXECUTION',
        workflowName: ar.workflowName, inputSourceIds: ar.inputFiles,
        status: 'COMPLETED' as const, startedAt: ar.startedAt, completedAt: ar.completedAt,
        runBy: ar.runBy, summary: ar.summary, processedRecords: 0, exceptionCount: ar.exceptions.length, outputCount: 0,
        outputs: [], logs: [],
        exceptions: ar.exceptions.map(e => ({
          id: e.id, severity: e.severity, title: e.title, description: e.description,
          sourceRecord: e.source, sourceFile: e.linkedFile,
          category: 'POLICY_VIOLATION' as const, status: (e.status === 'CONVERTED_TO_OBSERVATION' ? 'REVIEWED' : e.status) as AutoExceptionStatus,
          sourceWorkflowId: ar.id, sourceWorkflowName: ar.workflowName,
        })),
      }));
    return { runs: [...automationState.runs.runs, ...analysisAsAutomation] };
  }, [automationState.runs.runs, analysisState.runs]);

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

  // Build an Engagement object compatible with RACMTab + HealthOverviewTab
  const dynamicExceptionCount = totalExceptions + analysisState.runs.flatMap(r => r.exceptions).length;
  const racmEngagement = useMemo<RACMEngagement>(() => ({
    id: card.id,
    code: card.id.toUpperCase(),
    name: card.name,
    description: `Internal audit of ${card.process} process.`,
    type: 'Internal Audit',
    process: (card.process as RACMEngagement['process']) || 'P2P',
    framework: 'Internal Audit',
    owner: card.owner,
    status: 'Active',
    periodStart: card.period.split(' – ')[0] || '',
    periodEnd: card.period.split(' – ')[1] || '',
    controls: scope.checklistIds.length + scope.racmVersionIds.length + scope.sopIds.length,
    health: dynamicExceptionCount > 0 ? Math.max(40, 100 - dynamicExceptionCount * 5) : 85,
    openIssues: dynamicExceptionCount || card.exceptions,
    lastActivity: completedRuns.length > 0 ? 'Today' : '—',
    nextScheduled: '—',
  }), [card, scope.checklistIds.length, scope.racmVersionIds.length, scope.sopIds.length, dynamicExceptionCount, completedRuns.length]);

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
        <HealthOverviewTab
          eng={racmEngagement}
          onDrillToExceptions={() => setActiveTab('exceptions')}
          onConfigureWorkflow={() => setActiveTab('workflows')}
          hideWorkflowConfig
        />
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
        <RACMTab engagement={racmEngagement} onOpenFullEditor={onOpenRacmFullEditor ? () => onOpenRacmFullEditor({
          racmId: 'racm-procurement-fy26',
          racmName: `${racmEngagement.process} Internal Audit RACM`,
          processLabel: racmEngagement.process,
        }) : undefined} />
      )}

      {activeTab === 'controls' && (
        <InternalAuditControlsTab
          engagement={engagement}
          scope={scope}
          analysisState={analysisState}
          onUpdateAnalysis={handleUpdateAnalysis}
          onNavigateTab={(tabId) => setActiveTab(tabId === 'analysis' ? 'exceptions' : tabId)}
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
          runsState={mergedRunsState}
          casesState={automationState.cases}
          onUpdateCases={handleUpdateCases}
          onUpdateRunException={handleUpdateRunException}
          onNavigateTab={setActiveTab}
          skipOutputCheck
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

      {/* Announcement Modal */}
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
                  hideTimeline
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

// ─── Compliance Final Workspace ─────────────────────────────────────────

const COMPLIANCE_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'racm', label: 'RACM' },
  { id: 'controls', label: 'Controls' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'working-paper', label: 'Working Paper' },
  { id: 'trail', label: 'Action Trail' },
];

function ComplianceFinalWorkspace({ card, onBack, onOpenRacmFullEditor }: { card: IAEngagementCard; onBack: () => void; onOpenRacmFullEditor?: (ctx: { racmId: string; racmName: string; processLabel: string }) => void }) {
  const [activeTab, setActiveTab] = useState('overview');

  const complianceEngagement = useMemo<RACMEngagement>(() => ({
    id: card.id,
    code: card.id.toUpperCase(),
    name: card.name,
    description: card.description,
    type: 'Compliance',
    process: (card.process as RACMEngagement['process']) || 'P2P',
    framework: 'SOX ICFR',
    owner: card.owner,
    status: card.status === 'Planned' ? 'Planned' : 'Active',
    periodStart: card.period.split(' – ')[0] || '',
    periodEnd: card.period.split(' – ')[1] || '',
    controls: 24,
    health: card.exceptions > 0 ? Math.max(50, 100 - card.exceptions * 8) : 90,
    openIssues: card.exceptions,
    lastActivity: 'Today',
    nextScheduled: card.nextAction,
  }), [card]);

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
            <div className="p-2 rounded-lg bg-blue-100"><ShieldCheck size={18} className="text-blue-600" /></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[15px] font-bold text-text">{card.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${card.statusTone}`}>{card.status}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold">Compliance</span>
                <span className="text-text-muted">SOX ICFR</span>
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
          {COMPLIANCE_TABS.map(tab => (
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
        <HealthOverviewTab
          eng={complianceEngagement}
          onDrillToExceptions={() => setActiveTab('controls')}
          onConfigureWorkflow={() => setActiveTab('controls')}
          hideWorkflowConfig
        />
      )}

      {activeTab === 'racm' && (
        <RACMTab engagement={complianceEngagement} onOpenFullEditor={onOpenRacmFullEditor ? () => onOpenRacmFullEditor({
          racmId: 'racm-procurement-fy26',
          racmName: `${complianceEngagement.process} Compliance RACM`,
          processLabel: complianceEngagement.process,
        }) : undefined} />
      )}

      {activeTab === 'controls' && (
        <ControlsTab engagement={complianceEngagement} />
      )}

      {activeTab === 'evidence' && (
        <EvidenceTab engagement={complianceEngagement} />
      )}

      {activeTab === 'working-paper' && (
        <WorkingPaperTab engagement={complianceEngagement} />
      )}

      {activeTab === 'trail' && (
        <ActionTrailTab eng={complianceEngagement} />
      )}
    </div>
  );
}

// ─── Main Module Export ──────────────────────────────────────────────────

interface ModuleProps {
  onOpenRacmFullEditor?: (ctx: { racmId: string; racmName: string; processLabel: string }) => void;
}

export default function EngagementFinalModule({ onOpenRacmFullEditor }: ModuleProps) {
  const [selectedCard, setSelectedCard] = useState<IAEngagementCard | null>(null);

  if (selectedCard) {
    if (selectedCard.type === 'Automation') {
      return <AutomationFinalWorkspace card={selectedCard} onBack={() => setSelectedCard(null)} />;
    }
    if (selectedCard.type === 'Compliance') {
      return <ComplianceFinalWorkspace card={selectedCard} onBack={() => setSelectedCard(null)} onOpenRacmFullEditor={onOpenRacmFullEditor} />;
    }
    return <EngagementFinalWorkspace card={selectedCard} onBack={() => setSelectedCard(null)} onOpenRacmFullEditor={onOpenRacmFullEditor} />;
  }

  return <EngagementFinalLanding onOpen={setSelectedCard} />;
}
