import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, X, ChevronRight, ChevronLeft, AlertTriangle,
  CheckCircle2, Clock, Archive, Edit3, Eye, ArrowLeft,
  ArrowRight, FileText, HelpCircle, Shield, Workflow as WorkflowIcon, Grid3x3,
  Play, Trash2, Star, Link2, Share2,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import ColumnFilter from '../shared/ColumnFilter';
import ConfirmationModal from '../shared/ConfirmationModal';
import { Button } from '../shared/Button';
import { KpiTile } from '../shared/KpiTile';
import ListLoadError from '../shared/ListLoadError';
import ListPlaceholder from '../shared/ListPlaceholder';
import { LinkControlPickerDrawer, WorkflowControlChooserDrawer } from './RacmListTable';
import { LinkWorkflowToControlDrawer, type ControlWorkflow } from './RacmMappingWorkspace';
import CreateControlDrawer from '../governance/CreateControlDrawer';
import { addCreatedControl, useCreatedControls } from '../../data/createdControlsStore';
import { useRiskControlLinks, addRiskControlLinks } from '../../data/riskControlLinksStore';
import { getRiskRelationships, getControlRelationships } from '../../data/processHubJoins';
import { BUSINESS_PROCESSES } from '../../data/mockData';

// ─── Types ──────────────────────────────────────────────────────────────────

type RiskLifecycleStatus = 'Draft' | 'Active' | 'Under Review' | 'Archived';
type RiskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
type RiskCategory = 'Financial' | 'Operational' | 'Compliance' | 'IT' | 'Fraud' | 'Reporting' | 'Other';
// (STATUS_FILTER_OPTIONS removed — no UI control consumed it; dead code.)

export interface RiskEntry {
  id: string;
  name: string;
  description: string;
  businessProcess: string;
  subProcess: string;
  category: RiskCategory;
  priority: RiskPriority;
  owner: string;
  reviewer: string;
  status: RiskLifecycleStatus;
  lastReviewed: string;
  createdAt: string;
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

export const SEED_RISKS: RiskEntry[] = [
  { id: 'RSK-001', name: 'Unauthorized vendor payments', description: 'Payments processed without proper PO or approval, leading to financial loss', businessProcess: 'P2P', subProcess: 'Accounts Payable', category: 'Financial', priority: 'Critical', owner: 'Rajiv Sharma', reviewer: 'Deepak Bansal', status: 'Active', lastReviewed: 'Apr 10, 2026', createdAt: 'Jan 15, 2026' },
  { id: 'RSK-002', name: 'Duplicate invoices processed', description: 'Same invoice paid twice due to weak detection controls', businessProcess: 'P2P', subProcess: 'Invoice Processing', category: 'Financial', priority: 'High', owner: 'Rajiv Sharma', reviewer: 'Meera Patel', status: 'Active', lastReviewed: 'Apr 8, 2026', createdAt: 'Jan 15, 2026' },
  { id: 'RSK-003', name: 'Fictitious vendor registration', description: 'Vendor created without verification of identity and bank details', businessProcess: 'P2P', subProcess: 'Vendor Management', category: 'Fraud', priority: 'Critical', owner: 'Deepak Bansal', reviewer: 'Rajiv Sharma', status: 'Active', lastReviewed: 'Apr 12, 2026', createdAt: 'Jan 15, 2026' },
  { id: 'RSK-004', name: 'Unauthorized PO creation', description: 'Purchase orders above threshold committed without dual sign-off', businessProcess: 'P2P', subProcess: 'Procurement', category: 'Operational', priority: 'High', owner: 'Meera Patel', reviewer: 'Rajiv Sharma', status: 'Draft', lastReviewed: '—', createdAt: 'Mar 20, 2026' },
  { id: 'RSK-005', name: 'SOD violation in AP', description: 'Same user creates and approves payment transactions', businessProcess: 'P2P', subProcess: 'Accounts Payable', category: 'IT', priority: 'Critical', owner: 'IT Security', reviewer: 'Deepak Bansal', status: 'Under Review', lastReviewed: 'Apr 5, 2026', createdAt: 'Feb 1, 2026' },
  { id: 'RSK-006', name: 'Revenue recognition timing', description: 'Revenue recognized before performance obligation completion under ASC 606', businessProcess: 'O2C', subProcess: 'Revenue Accounting', category: 'Financial', priority: 'High', owner: 'Neha Joshi', reviewer: 'Karan Mehta', status: 'Active', lastReviewed: 'Apr 10, 2026', createdAt: 'Jan 20, 2026' },
  { id: 'RSK-007', name: 'Incorrect journal entries', description: 'Manual JE posted without review or with incorrect amounts', businessProcess: 'R2R', subProcess: 'General Ledger', category: 'Financial', priority: 'High', owner: 'Rohan Patel', reviewer: 'Karan Mehta', status: 'Active', lastReviewed: 'Apr 14, 2026', createdAt: 'Jan 20, 2026' },
  { id: 'RSK-008', name: 'GL balance discrepancy', description: 'Subsidiary balances do not reconcile to consolidated GL', businessProcess: 'R2R', subProcess: 'Reconciliation', category: 'Financial', priority: 'Medium', owner: 'Karan Mehta', reviewer: 'Rohan Patel', status: 'Draft', lastReviewed: '—', createdAt: 'Mar 25, 2026' },
  { id: 'RSK-009', name: 'Credit limit override without approval', description: 'Customer credit limits changed without proper authorization', businessProcess: 'O2C', subProcess: 'Credit Management', category: 'Operational', priority: 'Medium', owner: 'Sneha Desai', reviewer: 'Neha Joshi', status: 'Active', lastReviewed: 'Apr 2, 2026', createdAt: 'Feb 10, 2026' },
  { id: 'RSK-010', name: 'Unauthorized access to financial systems', description: 'Users retain access after role change or termination', businessProcess: 'ITGC', subProcess: 'Access Management', category: 'IT', priority: 'Critical', owner: 'IT Security', reviewer: 'Deepak Bansal', status: 'Active', lastReviewed: 'Apr 15, 2026', createdAt: 'Jan 10, 2026' },
  { id: 'RSK-011', name: 'Uncontrolled change management', description: 'System changes deployed without proper testing and approval', businessProcess: 'ITGC', subProcess: 'Change Management', category: 'IT', priority: 'High', owner: 'IT Security', reviewer: 'Rohan Patel', status: 'Under Review', lastReviewed: 'Apr 1, 2026', createdAt: 'Feb 5, 2026' },
  { id: 'RSK-012', name: 'Regulatory reporting delay', description: 'Financial reports not submitted to regulators within deadline', businessProcess: 'R2R', subProcess: 'Reporting', category: 'Compliance', priority: 'High', owner: 'Karan Mehta', reviewer: 'Neha Joshi', status: 'Active', lastReviewed: 'Apr 8, 2026', createdAt: 'Jan 25, 2026' },
  { id: 'RSK-013', name: 'Contract revenue leakage', description: 'Revenue not billed per contract terms due to manual tracking', businessProcess: 'O2C', subProcess: 'Contract Billing', category: 'Financial', priority: 'Medium', owner: 'Neha Joshi', reviewer: 'Sneha Desai', status: 'Active', lastReviewed: 'Mar 15, 2026', createdAt: 'Dec 1, 2025' },
  { id: 'RSK-014', name: 'Inadequate backup and recovery', description: 'Critical system backups not tested or failing silently', businessProcess: 'ITGC', subProcess: 'Operations', category: 'IT', priority: 'Medium', owner: 'IT Security', reviewer: 'Deepak Bansal', status: 'Draft', lastReviewed: '—', createdAt: 'Apr 10, 2026' },
  { id: 'RSK-021', name: 'Unauthorized sales order pricing', description: 'Order prices or discounts applied outside approved price lists, eroding margin', businessProcess: 'O2C', subProcess: 'Order Management', category: 'Operational', priority: 'High', owner: 'Sneha Desai', reviewer: 'Neha Joshi', status: 'Active', lastReviewed: 'Apr 11, 2026', createdAt: 'Feb 14, 2026' },
  { id: 'RSK-022', name: 'Goods shipped without approved order', description: 'Shipments released and invoiced before the sales order is approved and credit-cleared', businessProcess: 'O2C', subProcess: 'Shipping & Billing', category: 'Operational', priority: 'Critical', owner: 'Neha Joshi', reviewer: 'Karan Mehta', status: 'Active', lastReviewed: 'Apr 9, 2026', createdAt: 'Feb 18, 2026' },
  { id: 'RSK-023', name: 'Customer cash receipts misapplied', description: 'Incoming customer payments posted to the wrong account or invoice, distorting AR balances', businessProcess: 'O2C', subProcess: 'Cash Application', category: 'Financial', priority: 'High', owner: 'Karan Mehta', reviewer: 'Sneha Desai', status: 'Under Review', lastReviewed: 'Apr 4, 2026', createdAt: 'Feb 22, 2026' },
  { id: 'RSK-024', name: 'Aged receivables not provisioned', description: 'Overdue receivables not assessed for impairment, overstating collectible AR', businessProcess: 'O2C', subProcess: 'Collections', category: 'Financial', priority: 'Medium', owner: 'Neha Joshi', reviewer: 'Karan Mehta', status: 'Active', lastReviewed: 'Apr 6, 2026', createdAt: 'Mar 1, 2026' },
];

const PROCESSES = ['P2P', 'O2C', 'R2R', 'ITGC', 'S2C'];
const CATEGORIES: RiskCategory[] = ['Financial', 'Operational', 'Compliance', 'IT', 'Fraud', 'Reporting', 'Other'];
const PRIORITIES: RiskPriority[] = ['Critical', 'High', 'Medium', 'Low'];

// ─── Style maps ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<RiskLifecycleStatus, string> = {
  Draft: 'bg-paper-100 text-ink-600',
  Active: 'bg-compliant-50 text-compliant-700',
  'Under Review': 'bg-high-50 text-high-700',
  Archived: 'bg-paper-100 text-ink-400',
};

const PRIORITY_STYLES: Record<RiskPriority, string> = {
  Critical: 'text-risk-700 font-bold',
  High: 'text-high-700 font-semibold',
  Medium: 'text-ink-600 font-medium',
  Low: 'text-ink-400 font-medium',
};

// ─── Create / Edit Risk Drawer ──────────────────────────────────────────────

interface DrawerProps {
  risk: RiskEntry | null; // null = create mode
  onClose: () => void;
  onSave: (risk: RiskEntry) => void;
  defaultProcess?: string;
  /** 'drawer' (default, right-side) or 'modal' (centered — e.g. stacked over the Link Risk modal) */
  presentation?: 'drawer' | 'modal';
}

export function RiskDrawer({ risk, onClose, onSave, defaultProcess, presentation = 'drawer' }: DrawerProps) {
  const isEdit = !!risk;
  const isModal = presentation === 'modal';
  // Capture initial values once so dirty-tracking is stable across re-renders
  const [initial] = useState({
    name: risk?.name || '',
    description: risk?.description || '',
    businessProcess: risk?.businessProcess || defaultProcess || '',
    subProcess: risk?.subProcess || '',
    category: (risk?.category || '') as RiskCategory | '',
    priority: (risk?.priority || '') as RiskPriority | '',
    owner: risk?.owner || '',
    reviewer: risk?.reviewer || '',
  });
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [businessProcess, setBusinessProcess] = useState(initial.businessProcess);
  const [subProcess, setSubProcess] = useState(initial.subProcess);
  const [category, setCategory] = useState<RiskCategory | ''>(initial.category);
  const [priority, setPriority] = useState<RiskPriority | ''>(initial.priority);
  const [owner, setOwner] = useState(initial.owner);
  const [reviewer, setReviewer] = useState(initial.reviewer);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isDirty =
    name !== initial.name ||
    description !== initial.description ||
    businessProcess !== initial.businessProcess ||
    subProcess !== initial.subProcess ||
    category !== initial.category ||
    priority !== initial.priority ||
    owner !== initial.owner ||
    reviewer !== initial.reviewer;

  const requestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const discardAndClose = () => {
    // Reset form state then close
    setName(initial.name);
    setDescription(initial.description);
    setBusinessProcess(initial.businessProcess);
    setSubProcess(initial.subProcess);
    setCategory(initial.category);
    setPriority(initial.priority);
    setOwner(initial.owner);
    setReviewer(initial.reviewer);
    setShowDiscardConfirm(false);
    onClose();
  };

  const isValid = name.trim() && description.trim() && businessProcess;

  const buildRisk = (status: RiskLifecycleStatus): RiskEntry => ({
    id: risk?.id || `RSK-${String(Date.now()).slice(-3)}`,
    name: name.trim(),
    description: description.trim(),
    businessProcess,
    subProcess: subProcess.trim(),
    category: (category as RiskCategory) || 'Other',
    priority: (priority as RiskPriority) || 'Medium',
    owner: owner.trim(),
    reviewer: reviewer.trim(),
    status,
    lastReviewed: status === 'Active' ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : risk?.lastReviewed || '—',
    createdAt: risk?.createdAt || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  });

  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-md text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 transition-all';
  const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1.5';

  // Fix #10: Escape-to-close for both modal and drawer presentations
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className={`fixed inset-0 ${isModal ? 'z-[60]' : 'z-50'} bg-ink-900/40 backdrop-blur-[2px]`} onClick={requestClose} />
      <motion.aside
        initial={isModal ? { opacity: 0 } : { x: '100%' }}
        animate={isModal ? { opacity: 1 } : { x: 0 }}
        exit={isModal ? { opacity: 0 } : { x: '100%' }}
        transition={isModal ? { duration: 0.16 } : { type: 'spring', damping: 30, stiffness: 300 }}
        role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Risk' : 'Create Risk'}
        className={isModal
          ? 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-[480px] max-h-[calc(100vh-2rem)] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden'
          : 'fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col'}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-[1rem] font-bold text-ink-900">{isEdit ? 'Edit Risk' : 'Create Risk'}</h2>
            <p className="text-[0.75rem] text-ink-500 mt-0.5">{isEdit ? 'Update risk definition and metadata.' : 'Define a reusable risk for RACM mapping.'}</p>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={requestClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0"><X size={16} /></button>
        </div>

        {/* Discard confirm strip — appears at top of body when user tries to close with unsaved changes */}
        {showDiscardConfirm && (
          <div className="p-3 bg-mitigated-50 border-b border-mitigated-200 flex items-center gap-3 text-[0.8125rem] shrink-0">
            <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0" />
            <div className="flex-1 text-ink-800">Discard unsaved changes?</div>
            <Button variant="destructive" size="sm" onClick={discardAndClose}>Discard</Button>
            <Button variant="outline" size="sm" onClick={() => setShowDiscardConfirm(false)}>Keep editing</Button>
          </div>
        )}

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Basic Details */}
          <div className="space-y-3">
            <h3 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider">Basic Details</h3>
            <div>
              <label className={labelCls}>Risk Name <span className="text-risk">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Unauthorized vendor payments" className={fieldCls} autoFocus />
            </div>
            <div>
              <label className={labelCls}>Description <span className="text-risk">*</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the risk scenario and potential impact..." className={fieldCls + ' resize-none'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Business Process <span className="text-risk">*</span></label>
                <select value={businessProcess} onChange={e => setBusinessProcess(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                  <option value="">Select...</option>
                  {PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sub-process</label>
                <input value={subProcess} onChange={e => setSubProcess(e.target.value)} placeholder="e.g. Accounts Payable" className={fieldCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Risk Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as RiskCategory)} className={fieldCls + ' cursor-pointer appearance-none'}>
                <option value="">Select...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Ownership */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider">Ownership</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Risk Owner</label>
                <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Name" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Reviewer</label>
                <input value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Name" className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider">Priority</h3>
            <div className="flex gap-2" role="radiogroup" aria-label="Priority">
              {PRIORITIES.map(p => (
                <button type="button" key={p} onClick={() => setPriority(p)}
                  role="radio" aria-checked={priority === p}
                  className={`px-3 py-2 rounded-md text-[0.75rem] font-medium border transition-all cursor-pointer ${
                    priority === p ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted hover:border-primary/30'
                  }`}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3 shrink-0">
          <Button variant="outline" size="md" onClick={requestClose}>Cancel</Button>
          {!isEdit && (
            <Button variant="outline" size="md" onClick={() => { if (isValid) onSave(buildRisk('Draft')); }} disabled={!isValid}>
              Save as Draft
            </Button>
          )}
          <Button variant="primary" size="md" onClick={() => { if (isValid) onSave(buildRisk('Active')); }} disabled={!isValid}>
            Save
          </Button>
        </div>
      </motion.aside>
    </>
  );
}

// (Risk detail side sheet retired — editing now lives on the full detail page.)

// ─── Risk detail page — full page, stacked sections (Control-detail data format) ─
function RiskDetailPage({
  risk,
  controls,
  linkedWorkflows,
  onBack,
  onEdit,
  onLinkControl,
  onLinkWorkflow,
}: {
  risk: RiskEntry;
  controls: { id: string; name: string; desc: string; isKey: boolean }[];
  linkedWorkflows?: Record<string, { id: string; name: string; version: string }[]>;
  onBack: () => void;
  onEdit: () => void;
  onLinkControl: () => void;
  onLinkWorkflow: () => void;
}) {
  const { can } = useCan();
  const { openShare } = useShare();
  const rels = getRiskRelationships(risk.id, risk.businessProcess);
  const keyCount = controls.filter(c => c.isKey).length;

  // Business Process / Category / Priority / Status are surfaced as header badges &
  // pills now (like the control detail page), so the grid keeps the remaining facts.
  const fields: { label: string; value: string }[] = [
    { label: 'Sub-process', value: risk.subProcess || '—' },
    { label: 'Owner', value: risk.owner || '—' },
    { label: 'Reviewer', value: risk.reviewer || '—' },
    { label: 'Created', value: risk.createdAt },
    { label: 'Last Reviewed', value: risk.lastReviewed },
  ];

  return (
    <div>
      {/* Back + Edit row — keeps the header card clean, like the control detail page */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-brand-700 font-medium cursor-pointer transition-colors">
          <ArrowLeft size={14} /> Back to risks
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {can('risk_share') && (
            <Button variant="outline" size="sm" shape="lg" onClick={(e) => { e.stopPropagation(); openShare({ type: 'risk', id: risk.id, anchor: rectFromEvent(e) }); }} leftIcon={<Share2 size={13} />}>
              Share
            </Button>
          )}
          <Button variant="primary" size="sm" shape="lg" onClick={onEdit} leftIcon={<Edit3 size={13} />}>
            Edit risk
          </Button>
        </div>
      </div>

      {/* Header card — matches the control detail page header */}
      <div className="bg-white border border-canvas-border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[0.6875rem] text-ink-500">{risk.id}</span>
              <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${
                risk.priority === 'Critical' ? 'bg-risk-50 text-risk-700'
                  : risk.priority === 'High' ? 'bg-high-50 text-high-700'
                  : risk.priority === 'Medium' ? 'bg-mitigated-50 text-mitigated-700'
                  : 'bg-compliant-50 text-compliant-700'
              }`}>{risk.priority}</span>
            </div>
            <h1 className="font-display text-[1.625rem] font-[420] tracking-tight text-ink-900 leading-[1.2]">{risk.name}</h1>
          </div>
          {/* Status + Business Process + Category pills */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className={`px-2.5 h-7 rounded-full text-[0.6875rem] font-semibold inline-flex items-center gap-1.5 ${STATUS_STYLES[risk.status]}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
              {risk.status}
            </span>
            <span className="px-2.5 h-7 rounded-full text-[0.6875rem] font-semibold border border-border-light bg-surface-2 text-text-secondary inline-flex items-center">
              {risk.businessProcess}
            </span>
            <span className="px-2.5 h-7 rounded-full text-[0.6875rem] font-semibold border border-border-light bg-white text-text-muted inline-flex items-center">
              {risk.category}
            </span>
          </div>
        </div>

        <p className="text-[0.8125rem] text-text leading-relaxed mb-5 max-w-3xl">{risk.description}</p>

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-canvas-border/70">
          {fields.map(f => (
            <div key={f.label}>
              <span className="text-[0.625rem] text-ink-400 uppercase block tracking-wider mb-0.5">{f.label}</span>
              <span className="text-[0.8125rem] block text-text">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stacked sections */}
      <div className="space-y-6">

        {/* Mapped controls */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider inline-flex items-center gap-1.5">
              <Shield size={13} className="text-ink-400" /> Mapped Controls
              {keyCount > 0 && <span className="font-medium normal-case tracking-normal text-ink-400">· {keyCount} key</span>}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={onLinkControl} aria-label="Link control"
                className="inline-flex items-center gap-1 px-2 h-[26px] rounded-md border border-dashed border-border-light bg-white text-[0.6875rem] font-semibold text-text-muted hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition-colors cursor-pointer">
                <Link2 size={12} className="shrink-0" /> Link control
              </button>
              <button type="button" onClick={onLinkWorkflow} aria-label="Link workflow"
                className="inline-flex items-center gap-1 px-2 h-[26px] rounded-md border border-dashed border-border-light bg-white text-[0.6875rem] font-semibold text-text-muted hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition-colors cursor-pointer">
                <WorkflowIcon size={12} className="shrink-0" /> Link workflow
              </button>
              <span className="text-[0.75rem] font-mono text-ink-400 tabular-nums ml-1">{controls.length}</span>
            </div>
          </div>
          {controls.length === 0 ? (
            <div className="text-[0.75rem] text-ink-400 italic">
              No controls mapped to this risk yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-canvas-border">
                    <th className="py-2 pr-4 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">Control</th>
                    <th className="py-2 pr-4 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider w-[88px]">Key</th>
                    <th className="py-2 pr-4 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">Description</th>
                    <th className="py-2 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">Linked Workflows</th>
                  </tr>
                </thead>
                <tbody>
                  {controls.map(c => (
                    <tr key={c.id} className="border-b border-canvas-border/60 last:border-0 align-top">
                      <td className="py-3 pr-4">
                        <div className="font-mono text-[0.65625rem] font-semibold text-brand-700">{c.id}</div>
                        <div className="text-[0.78125rem] font-semibold text-ink-800 leading-snug">{c.name}</div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {c.isKey ? (
                          <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded text-[0.625rem] font-bold bg-mitigated-50 text-mitigated-700">
                            <Star size={10} className="fill-amber-400 text-amber-500 shrink-0" aria-label="Key control" /> Key
                          </span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[0.78125rem] text-ink-600 leading-snug">{c.desc}</td>
                      <td className="py-3 align-top">
                        {(() => {
                          const base = getControlRelationships(c.id).workflows
                            .map(w => ({ id: w.id, name: w.name, title: `${w.name} · ${w.runs} runs` }));
                          const extra = (linkedWorkflows?.[`${risk.id}:${c.id}`] ?? [])
                            .filter(a => !base.some(b => b.id === a.id))
                            .map(a => ({ id: a.id, name: a.name, title: `${a.name} ${a.version} · newly linked` }));
                          const wfs = [...base, ...extra];
                          if (wfs.length === 0) return <span className="text-ink-300">—</span>;
                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {wfs.map(w => (
                                <span key={w.id} title={w.title}
                                  className="inline-flex items-center gap-1 pl-1.5 pr-2 h-[22px] rounded-md bg-brand-50 border border-brand-100 text-[0.65625rem] font-semibold text-brand-700">
                                  <WorkflowIcon size={10} className="shrink-0" />
                                  <span className="truncate max-w-[170px]">{w.name}</span>
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Found in RACMs */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider inline-flex items-center gap-1.5">
              <Grid3x3 size={13} className="text-ink-400" /> Found in RACMs
            </h3>
            <span className="text-[0.75rem] font-mono text-ink-400 tabular-nums">{rels.racms.length}</span>
          </div>
          {rels.racms.length === 0 ? (
            <p className="text-[0.75rem] text-ink-400 italic">Not part of any RACM yet.</p>
          ) : (
            <div className="space-y-2">
              {rels.racms.map(r => (
                <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-canvas-border bg-white">
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.8125rem] font-medium text-ink-800 block truncate">{r.name}</span>
                    <span className="text-[0.6875rem] text-ink-400">Owner: {r.owner}</span>
                  </div>
                  <span className="text-[0.6875rem] text-ink-400 shrink-0">{r.fw}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface Props {
  onRunWorkflow?: (workflowId: string) => void;
  onNavigate?: (view: string) => void;
  /** When set, filters risks to this process and pre-fills create drawer */
  processFilter?: string;
}

export default function RiskRegister({ onNavigate, processFilter }: Props) {
  const { addToast } = useToast();
  const { can } = useCan();
  const { openShare } = useShare();
  const [risks, setRisks] = useState<RiskEntry[]>(SEED_RISKS);
  const [searchQuery, setSearchQuery] = useState('');
  // Lifecycle-status filter driven by the clickable KPI tiles (single-select;
  // null = show all). Kept separate from the slim High Priority / Unreviewed dropdown.
  const [activeStatusTile, setActiveStatusTile] = useState<RiskLifecycleStatus | null>(null);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [detailRiskId, setDetailRiskId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('risk');
  });
  const [editingRisk, setEditingRisk] = useState<RiskEntry | null>(null);

  // URL sync — push ?risk=RSK-001 so browser back works
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get('risk');
    if (detailRiskId && current !== detailRiskId) {
      params.set('risk', detailRiskId);
      window.history.pushState({ ...window.history.state, risk: detailRiskId }, '', `?${params.toString()}`);
      // pushState doesn't fire popstate; dispatch one so the BP-level listener
      // (which hides the tab pills + updates the breadcrumb) reacts to the URL.
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else if (!detailRiskId && current) {
      params.delete('risk');
      const qs = params.toString();
      window.history.pushState({ ...window.history.state, risk: null }, '', qs ? `?${qs}` : window.location.pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [detailRiskId]);

  // popstate listener
  useEffect(() => {
    const onPop = () => {
      const param = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('risk') : null;
      setDetailRiskId(param);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Local data is ready immediately; only reveal a skeleton if loading genuinely
  // exceeds ~150ms (e.g. a future remote source). For today's local data it never shows.
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [linkControlRisk, setLinkControlRisk] = useState<RiskEntry | null>(null);
  // When true, the Create Control wizard swaps in over the Link Control picker.
  const [createControlFromLink, setCreateControlFromLink] = useState(false);
  // Link Workflow flow (mirrors the RACM table): pick a control on the risk
  // (skipped when it has exactly one), then a workflow. Session-local overlay
  // keyed by `${riskId}:${controlId}` — same scope as the RACM flow.
  const [linkWfTarget, setLinkWfTarget] = useState<{ riskId: string; riskName: string; controls: { id: string; name: string; isKey: boolean }[] } | null>(null);
  const [linkWfControl, setLinkWfControl] = useState<{ id: string; name: string; isKey: boolean } | null>(null);
  const [linkedWorkflows, setLinkedWorkflows] = useState<Record<string, { id: string; name: string; version: string }[]>>({});
  const addLinkedWorkflow = (riskId: string, ctlId: string, wf: { id: string; name: string; version: string }) =>
    setLinkedWorkflows(prev => {
      const key = `${riskId}:${ctlId}`;
      const have = prev[key] ?? [];
      if (have.some(w => w.id === wf.id)) return prev;
      return { ...prev, [key]: [...have, { id: wf.id, name: wf.name, version: wf.version }] };
    });
  // Created controls (carry mappedRisks) + existing controls linked via the picker —
  // both feed each risk card's "Mapped controls" list (see controlsForRisk).
  const createdControls = useCreatedControls();
  const riskControlLinks = useRiskControlLinks();
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [archivedRiskIds, setArchivedRiskIds] = useState<string[]>([]);
  const [subProcessFilter, setSubProcessFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const armSkeleton = setTimeout(() => setShowSkeleton(true), 150);
    setIsLoading(false); // synchronous local data — ready right away
    return () => clearTimeout(armSkeleton);
  }, []);

  // Listen for header-level "Create new Risk" trigger from Process Hub.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: string }>;
      if (ce.detail?.section === 'risks') setShowCreateDrawer(true);
    };
    window.addEventListener('process-hub-create', handler);
    return () => window.removeEventListener('process-hub-create', handler);
  }, []);

  // Apply process filter first (for embedded mode)
  const embedded = !!processFilter;
  const baseRisks = (processFilter ? risks.filter(r => r.businessProcess === processFilter) : risks)
    .filter(r => !archivedRiskIds.includes(r.id));

  // Derived KPIs
  const totalRisks = baseRisks.length;
  const activeCount = baseRisks.filter(r => r.status === 'Active').length;
  const underReviewCount = baseRisks.filter(r => r.status === 'Under Review').length;
  const draftCount = baseRisks.filter(r => r.status === 'Draft').length;
  const filteredRisks = useMemo(() => {
    let result = baseRisks;

    // Lifecycle status — single-select via the KPI tiles (null = show all).
    if (activeStatusTile) {
      result = result.filter(r => r.status === activeStatusTile);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.businessProcess.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q)
      );
    }

    if (subProcessFilter.length > 0) result = result.filter(r => subProcessFilter.includes(r.subProcess));
    if (categoryFilter.length > 0) result = result.filter(r => categoryFilter.includes(r.category));
    if (priorityFilter.length > 0) result = result.filter(r => priorityFilter.includes(r.priority));

    return result;
  }, [baseRisks, activeStatusTile, searchQuery, subProcessFilter, categoryFilter, priorityFilter]);

  const subProcessOptions = useMemo(() => Array.from(new Set(baseRisks.map(r => r.subProcess))).sort(), [baseRisks]);
  const categoryOptions = useMemo(() => Array.from(new Set(baseRisks.map(r => r.category))).sort(), [baseRisks]);
  const priorityOptions = useMemo(() => {
    const order = ['Critical', 'High', 'Medium', 'Low'];
    const set = new Set(baseRisks.map(r => r.priority));
    return order.filter(p => set.has(p as RiskPriority));
  }, [baseRisks]);

  // Single source of truth for "is any filter on" + a reset that clears every
  // filter (the KPI tile, the slim Status dropdown, the other dropdowns, search).
  const hasActiveFilters = !!activeStatusTile || subProcessFilter.length > 0 || categoryFilter.length > 0 || priorityFilter.length > 0 || searchQuery.length > 0;
  const clearAllFilters = () => {
    setActiveStatusTile(null);
    setSubProcessFilter([]);
    setCategoryFilter([]);
    setPriorityFilter([]);
    setSearchQuery('');
  };

  // A risk's mapped controls from every source: seed relationships, controls
  // created-and-linked via the wizard (carry mappedRisks), and existing controls
  // linked via the picker. Deduped by id (case-insensitive).
  const controlsForRisk = (r: RiskEntry) => {
    const seed = getRiskRelationships(r.id, r.businessProcess).controls
      .map(c => ({ id: c.id, name: c.name, desc: c.desc, isKey: c.isKey }));
    const created = createdControls
      .filter(c => c.mappedRisks.includes(r.id))
      .map(c => ({ id: c.id, name: c.name, desc: c.description, isKey: c.classification === 'Key' }));
    const linked = (riskControlLinks[r.id] ?? [])
      .map(c => ({ id: c.id, name: c.name, desc: c.description, isKey: c.isKey }));
    const seen = new Set<string>();
    const out: { id: string; name: string; desc: string; isKey: boolean }[] = [];
    for (const c of [...seed, ...created, ...linked]) {
      const key = c.id.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  };

  // Open the Link Workflow flow for a risk: needs at least one mapped control
  // (a workflow attaches to a control). One control → skip the chooser step.
  const openLinkWorkflow = (r: RiskEntry) => {
    const ctls = controlsForRisk(r).map(c => ({ id: c.id, name: c.name, isKey: c.isKey }));
    if (ctls.length === 0) {
      addToast({ message: 'Map a control to this risk first. Workflows link to a control.', type: 'info' });
      return;
    }
    setLinkWfTarget({ riskId: r.id, riskName: r.name, controls: ctls });
    if (ctls.length === 1) setLinkWfControl(ctls[0]);
  };

  const handleSaveRisk = (risk: RiskEntry) => {
    const exists = risks.find(r => r.id === risk.id);
    if (exists) {
      setRisks(prev => prev.map(r => r.id === risk.id ? risk : r));
      addToast({ message: `Risk "${risk.name}" updated`, type: 'success' });
    } else {
      setRisks(prev => [risk, ...prev]);
      addToast({ message: `Risk "${risk.name}" created as ${risk.status}`, type: 'success' });
    }
    setShowCreateDrawer(false);
  };

  const handleUpdateRisk = (updated: RiskEntry) => {
    setRisks(prev => prev.map(r => r.id === updated.id ? updated : r));
    // Editing happens on the full detail page; Save updates it in place + toasts.
    addToast({ message: `Risk "${updated.name}" updated`, type: 'success' });
  };

  // Single-row archive replaces the old sticky bulk bar.
  const handleArchiveOne = (id: string) => {
    setArchivedRiskIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSelectedRiskIds(prev => prev.filter(s => s !== id));
    addToast({ message: `Risk archived`, type: 'success' });
  };
  // Delete-risk confirmation (the trash action on a risk card).
  const [confirmDeleteRisk, setConfirmDeleteRisk] = useState<{ id: string; name: string } | null>(null);
  const handleDeleteOne = (id: string) => {
    setArchivedRiskIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSelectedRiskIds(prev => prev.filter(s => s !== id));
    addToast({ message: `Risk deleted`, type: 'success' });
  };
  const handleCancelOne = (id: string) => {
    setSelectedRiskIds(prev => prev.filter(s => s !== id));
  };

  // Select-all helpers based on currently-visible filteredRisks
  const visibleIds = filteredRisks.map(r => r.id);
  const selectedVisibleCount = visibleIds.filter(id => selectedRiskIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      // Deselect all visible
      setSelectedRiskIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Select all visible (merge with existing selections from other filtered views)
      setSelectedRiskIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectRisk = (id: string) => {
    setSelectedRiskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Count risks with no mapped controls (draft status = unmapped)
  const unmappedCount = baseRisks.filter(r => r.status === 'Draft').length;

  // Link Control + Link Workflow drawers — shared by the list view and the risk
  // detail-page takeover (both can trigger linking), so they render in each return.
  const linkDrawers = (
    <>
      {/* Link Control picker (opened from a card or the detail page) — modal */}
      <AnimatePresence>
        {linkControlRisk && !createControlFromLink && (
          <LinkControlPickerDrawer
            riskName={linkControlRisk.name}
            alreadyLinkedIds={controlsForRisk(linkControlRisk).map(c => c.id.toUpperCase())}
            onClose={() => setLinkControlRisk(null)}
            onCreateControl={() => setCreateControlFromLink(true)}
            onApply={(controls) => {
              addRiskControlLinks(linkControlRisk.id, controls);
              addToast({ message: `Linked ${controls.length} control${controls.length !== 1 ? 's' : ''} to ${linkControlRisk.name}.`, type: 'success' });
              setLinkControlRisk(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Create Control wizard — swaps in over the picker (modal). Cancel returns to
          the picker; saving creates the control, links it to this risk, and closes. */}
      <AnimatePresence>
        {linkControlRisk && createControlFromLink && (
          <CreateControlDrawer
            presentation="modal"
            defaultProcess={linkControlRisk.businessProcess}
            defaultRiskIds={[linkControlRisk.id]}
            defaultRisk={linkControlRisk.name}
            onClose={() => setCreateControlFromLink(false)}
            onSave={(data) => {
              addCreatedControl(data);
              addToast({ message: `Created "${data.name}" and linked it to ${linkControlRisk.name}.`, type: 'success' });
              setCreateControlFromLink(false);
              setLinkControlRisk(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Link Workflow — step 1: choose which control (skipped when the risk has one) */}
      <AnimatePresence>
        {linkWfTarget && !linkWfControl && (
          <WorkflowControlChooserDrawer
            riskName={linkWfTarget.riskName}
            controls={linkWfTarget.controls}
            onPick={ctl => setLinkWfControl(ctl)}
            onClose={() => setLinkWfTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Link Workflow — step 2: the workflow picker for the chosen control */}
      <AnimatePresence>
        {linkWfTarget && linkWfControl && (() => {
          const lwt = linkWfTarget;
          const lwc = linkWfControl;
          const riskObj = risks.find(r => r.id === lwt.riskId);
          const desc = riskObj ? (controlsForRisk(riskObj).find(c => c.id === lwc.id)?.desc ?? '') : '';
          return (
            <LinkWorkflowToControlDrawer
              control={{ name: lwc.name, description: desc, isKey: lwc.isKey, workflows: [] }}
              onClose={() => { if (lwt.controls.length > 1) setLinkWfControl(null); else { setLinkWfControl(null); setLinkWfTarget(null); } }}
              onLink={(wf: ControlWorkflow) => {
                addLinkedWorkflow(lwt.riskId, lwc.id, wf);
                addToast({ message: `Linked "${wf.name}" to ${lwc.id}.`, type: 'success' });
                setLinkWfControl(null);
                setLinkWfTarget(null);
              }}
            />
          );
        })()}
      </AnimatePresence>
    </>
  );

  // Spike C: detail page takeover when ?risk= is in URL
  const detailRiskFromUrl = detailRiskId ? risks.find(r => r.id === detailRiskId) : null;

  // Fix #1: deep-link to a non-existent risk ID → show "Risk not found" instead of silently falling through
  if (detailRiskId && !detailRiskFromUrl) {
    return (
      <div className={embedded ? '' : 'relative h-full overflow-y-auto'}>
        <div className={embedded ? 'space-y-5' : 'relative z-10 max-w-[1200px] mx-auto px-6 py-6 space-y-5'}>
          <ListPlaceholder
            icon={HelpCircle}
            title="Risk not found"
            body={`No risk with ID "${detailRiskId}" exists in the register.`}
            action={
              <Button variant="outline" size="md" onClick={() => setDetailRiskId(null)} leftIcon={<ArrowLeft size={14} />}>
                Back to register
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (detailRiskFromUrl) {
    return (
      <div className={embedded ? '' : 'relative h-full overflow-y-auto'}>
        <div className={embedded ? 'space-y-5' : 'relative z-10 max-w-[1200px] mx-auto px-6 py-6 space-y-5'}>
          <RiskDetailPage
            risk={detailRiskFromUrl}
            controls={controlsForRisk(detailRiskFromUrl)}
            linkedWorkflows={linkedWorkflows}
            onLinkControl={() => setLinkControlRisk(detailRiskFromUrl)}
            onLinkWorkflow={() => openLinkWorkflow(detailRiskFromUrl)}
            onBack={() => {
              // Inside the Process Hub already → just close the detail (back to the embedded Risks list).
              if (embedded) { setDetailRiskId(null); return; }
              // Opened standalone (new tab) → land on this risk's process in the Process Hub, Risks tab.
              const bp = BUSINESS_PROCESSES.find(b => b.abbr === detailRiskFromUrl.businessProcess);
              const params = bp
                ? new URLSearchParams({ view: 'bp-detail', bp: bp.id, section: 'risks' })
                : new URLSearchParams({ view: 'business-processes' });
              window.location.assign(`${window.location.origin}${window.location.pathname}?${params.toString()}`);
            }}
            onEdit={() => setEditingRisk(detailRiskFromUrl)}
          />
          <AnimatePresence>
            {editingRisk && (
              <RiskDrawer
                risk={editingRisk}
                presentation="modal"
                onClose={() => setEditingRisk(null)}
                onSave={(updated) => { handleUpdateRisk(updated); setEditingRisk(null); }}
              />
            )}
          </AnimatePresence>
          {linkDrawers}
        </div>
      </div>
    );
  }

  // List load-failure guard — dormant with local data (sits after the detail-page
  // takeover so it only governs the list view). Mirrors the empty-state guard below.
  if (!isLoading && loadError) {
    return <ListLoadError label="risks" onRetry={() => setLoadError(false)} />;
  }

  return (
    <div className={embedded ? '' : 'relative h-full overflow-y-auto'}>
      <div className={embedded ? 'space-y-5' : 'relative z-10 max-w-[1200px] mx-auto px-6 py-6 space-y-5'}>
        {/* KPI strip (4 tiles) — shown in both embedded (Process Hub) and standalone modes.
            Each tile is a single-select lifecycle-status filter; Total clears. */}
        <div className="grid grid-cols-4 gap-3">
          <KpiTile label="Total Risks"  value={String(totalRisks)}       index={0} onClick={() => setActiveStatusTile(null)} />
          <KpiTile label="Active"       value={String(activeCount)}      index={1} valueClassName="text-compliant-700" onClick={() => setActiveStatusTile(p => p === 'Active' ? null : 'Active')} selected={activeStatusTile === 'Active'} />
          <KpiTile label="Under Review" value={String(underReviewCount)} index={2} valueClassName="text-high-700" onClick={() => setActiveStatusTile(p => p === 'Under Review' ? null : 'Under Review')} selected={activeStatusTile === 'Under Review'} />
          <KpiTile label="Draft"        value={String(draftCount)}       index={3} onClick={() => setActiveStatusTile(p => p === 'Draft' ? null : 'Draft')} selected={activeStatusTile === 'Draft'} />
        </div>
        {/* Toolbar — when embedded inside Process Hub, the create button lives in the
            Process Hub header. Standalone Risk Register keeps its own title + CTA. */}
        {!embedded && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[1.125rem] font-semibold text-ink-900">Risk Register</h1>
              <p className="text-[0.8125rem] text-text-muted mt-1">Maintain the master list of business and audit risks across processes.</p>
            </div>
            <Button variant="primary" size="sm" shape="lg" onClick={() => setShowCreateDrawer(true)}
              leftIcon={<Plus size={13} />} className="shrink-0">
              Create Risk
            </Button>
          </div>
        )}

        {/* Insight banner — standalone only (embedded shows it in the header row) */}
        {!embedded && unmappedCount > 0 && (
          <div className="rounded-md border border-high-700/15 bg-high-50 px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={14} className="text-high-700 shrink-0" />
            <span className="text-[0.75rem] text-high-700 flex-1">
              <span className="font-semibold">{unmappedCount} risk{unmappedCount !== 1 ? 's' : ''}</span> {unmappedCount !== 1 ? 'are' : 'is'} not yet mapped to controls.
            </span>
          </div>
        )}

        {/* True empty state — no risks at all (after process filter) — hidden during initial loading */}
        {!isLoading && baseRisks.length === 0 ? (
          <ListPlaceholder
            icon={AlertTriangle}
            title="No risks yet"
            body="Track risks for this process and link them to controls."
            action={<Button variant="primary" size="md" onClick={() => setShowCreateDrawer(true)}>Create Risk</Button>}
          />
        ) : (
        <>

        {/* Filter row — search on the left, dropdown filters + clear on the right. */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search risks..."
              className="pl-9 pr-3 py-2 rounded-md border border-border bg-white text-[0.75rem] w-[260px] placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all" />
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mr-1 text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
            <ColumnFilter variant="button" label="Priority" options={priorityOptions} value={priorityFilter} onChange={setPriorityFilter} align="end" />
            <ColumnFilter variant="button" label="Sub-process" options={subProcessOptions} value={subProcessFilter} onChange={setSubProcessFilter} align="end" />
            <ColumnFilter variant="button" label="Category" options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} align="end" />
            {embedded && (
              <Button variant="primary" size="sm" shape="lg" onClick={() => setShowCreateDrawer(true)}
                leftIcon={<Plus size={13} />} className="shrink-0">
                Create Risk
              </Button>
            )}
          </div>
        </div>

        {/* Bulk-select strip — always visible so select-all is reachable from the start. */}
        {!isLoading && filteredRisks.length > 0 && (
          <div className="flex items-center gap-2 text-[0.6875rem] text-text-muted">
            <input
              ref={selectAllRef}
              type="checkbox"
              aria-label="Select all visible risks"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded-xs border border-ink-300 cursor-pointer accent-brand-600"
            />
            <span>
              {selectedVisibleCount} of {visibleIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedRiskIds([])}
              className="ml-2 text-brand-700 hover:text-brand-600 font-medium cursor-pointer"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Risk Cards — engagement-style list, one card per risk. Click anywhere to open detail. */}
        <div className="space-y-2 min-h-[calc(100vh-280px)]">
          {isLoading && showSkeleton ? (
            [...Array(5)].map((_, i) => (
              <div key={`skel-${i}`} className="px-6 py-5 rounded-xl border border-border-light bg-white">
                <div className="h-3 bg-paper-100 rounded-xs animate-pulse w-2/3 mb-2.5" />
                <div className="h-3 bg-paper-100 rounded-xs animate-pulse w-1/2" />
              </div>
            ))
          ) : filteredRisks.length === 0 ? (
            <ListPlaceholder
              icon={Search}
              title="No matching risks"
              body="Nothing matched your search or filters. Try a different combination."
              action={hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[0.8125rem] text-brand-700 hover:text-brand-600 cursor-pointer font-medium transition-colors"
                >
                  Clear filters
                </button>
              ) : undefined}
            />
          ) : filteredRisks.map((risk, i) => {
            const isChecked = selectedRiskIds.includes(risk.id);
            const cardControls = controlsForRisk(risk);
            return (
              <motion.div
                key={risk.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`rounded-xl border bg-white hover:border-primary/50 hover:shadow-sm transition-all ${
                  isChecked ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border-light'
                }`}
              >
                <div className="px-6 py-5">
                  {/* Risk identity + row actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[0.9375rem] font-semibold leading-snug">
                          <span className="font-mono text-[0.75rem] font-semibold text-brand-700 mr-2">{risk.id}</span>
                          <a
                            href={`${window.location.origin}${window.location.pathname}?${new URLSearchParams({ view: 'audit-risk-register', risk: risk.id }).toString()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open detail in a new tab"
                            className="text-left text-text hover:text-brand-700 hover:underline underline-offset-2 transition-colors cursor-pointer">
                            {risk.name}
                          </a>
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.625rem] font-semibold ${STATUS_STYLES[risk.status]}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                          {risk.status}
                        </span>
                        <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                          {risk.businessProcess}
                        </span>
                        <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-medium bg-white text-text-muted border border-border-light">
                          {risk.category}
                        </span>
                        <span className={`inline-flex items-center px-2.5 h-5 rounded-md text-[0.6875rem] font-semibold border border-border-light bg-white ${PRIORITY_STYLES[risk.priority]}`}>
                          {risk.priority}
                        </span>
                      </div>
                      <p className="text-[0.8125rem] text-text leading-relaxed mt-3 max-w-3xl">{risk.description || '—'}</p>
                    </div>
                    {/* Top-right: control tags moved up (before the actions, like the workflow card),
                        then row actions — Link control placed like the RACM card's Link risk button. */}
                    <div onClick={e => e.stopPropagation()} className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap max-w-[60%]">
                      {cardControls.map(ctrl => (
                        <span key={ctrl.id}
                          className="inline-flex items-center gap-1 px-2 h-[26px] rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-[0.6875rem] font-mono font-semibold">
                          {ctrl.isKey && <Star size={11} className="fill-amber-400 text-amber-500 shrink-0" aria-label="Key control" />}
                          {ctrl.id}
                        </span>
                      ))}
                      {isChecked ? (
                        <>
                          <button type="button" onClick={() => handleArchiveOne(risk.id)} title="Archive" aria-label="Archive risk"
                            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md text-text-muted hover:text-ink-800 hover:bg-paper-100 transition-colors cursor-pointer">
                            <Archive size={14} />
                          </button>
                          <button type="button" onClick={() => handleCancelOne(risk.id)} title="Cancel selection" aria-label="Cancel selection"
                            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md text-text-muted hover:text-ink-800 hover:bg-paper-100 transition-colors cursor-pointer">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="relative group/lcontrol">
                            <button type="button" onClick={() => setLinkControlRisk(risk)} aria-label="Link control"
                              className="shrink-0 inline-flex items-center gap-1 px-2 min-h-[40px] rounded-md border border-dashed border-border-light bg-white text-[0.6875rem] font-semibold text-text-muted hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition-colors cursor-pointer">
                              <Link2 size={12} className="shrink-0" /> Control
                            </button>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/lcontrol:opacity-100 pointer-events-none transition-opacity z-50">Link control</span>
                          </div>
                          {can('risk_share') && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); openShare({ type: 'risk', id: risk.id, anchor: rectFromEvent(e) }); }} title="Share risk" aria-label="Share risk"
                              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer">
                              <Share2 size={14} />
                            </button>
                          )}
                          <button type="button" onClick={() => setConfirmDeleteRisk({ id: risk.id, name: risk.name })} title="Delete risk" aria-label="Delete risk"
                            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        </>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreateDrawer && (
          <RiskDrawer risk={null} presentation="modal" onClose={() => setShowCreateDrawer(false)} onSave={handleSaveRisk} defaultProcess={processFilter} />
        )}
      </AnimatePresence>


      {linkDrawers}

      {/* Delete-risk confirmation */}
      <ConfirmationModal
        open={!!confirmDeleteRisk}
        title="Delete this risk?"
        description={confirmDeleteRisk
          ? <>This removes <span className="font-semibold text-ink-700">{confirmDeleteRisk.name}</span> (<span className="font-mono">{confirmDeleteRisk.id}</span>) from the register. You can't undo this here.</>
          : undefined}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => { if (confirmDeleteRisk) handleDeleteOne(confirmDeleteRisk.id); setConfirmDeleteRisk(null); }}
        onClose={() => setConfirmDeleteRisk(null)}
      />
    </div>
  );
}
