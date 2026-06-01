import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, X, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, Archive, Edit3, Eye,
  ArrowRight, FileText, HelpCircle,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import ColumnFilter from '../shared/ColumnFilter';

// ─── Types ──────────────────────────────────────────────────────────────────

type RiskLifecycleStatus = 'Draft' | 'Active' | 'Under Review' | 'Archived';
type RiskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
type RiskCategory = 'Financial' | 'Operational' | 'Compliance' | 'IT' | 'Fraud' | 'Reporting' | 'Other';
type FilterKey = 'all' | 'draft' | 'active' | 'under-review' | 'archived' | 'high-priority' | 'unreviewed';

interface RiskEntry {
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

const SEED_RISKS: RiskEntry[] = [
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
  { id: 'RSK-013', name: 'Contract revenue leakage', description: 'Revenue not billed per contract terms due to manual tracking', businessProcess: 'O2C', subProcess: 'Contract Billing', category: 'Financial', priority: 'Medium', owner: 'Neha Joshi', reviewer: 'Sneha Desai', status: 'Archived', lastReviewed: 'Mar 15, 2026', createdAt: 'Dec 1, 2025' },
  { id: 'RSK-014', name: 'Inadequate backup and recovery', description: 'Critical system backups not tested or failing silently', businessProcess: 'ITGC', subProcess: 'Operations', category: 'IT', priority: 'Medium', owner: 'IT Security', reviewer: 'Deepak Bansal', status: 'Draft', lastReviewed: '—', createdAt: 'Apr 10, 2026' },
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

// ─── Action derivation ─────────────────────────────────────────────────────

function getRiskRegisterAction(status: RiskLifecycleStatus): { label: string; cls: string } {
  switch (status) {
    case 'Draft': return { label: 'Complete Setup', cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Active': return { label: 'View', cls: 'bg-paper-100 text-ink-600 hover:bg-paper-200' };
    case 'Under Review': return { label: 'Review', cls: 'bg-high-50 text-high-700 hover:bg-high-50/70' };
    case 'Archived': return { label: 'View', cls: 'bg-paper-50 text-ink-400 hover:bg-paper-100' };
  }
}

// ─── Create / Edit Risk Drawer ──────────────────────────────────────────────

interface DrawerProps {
  risk: RiskEntry | null; // null = create mode
  onClose: () => void;
  onSave: (risk: RiskEntry) => void;
  defaultProcess?: string;
}

function RiskDrawer({ risk, onClose, onSave, defaultProcess }: DrawerProps) {
  const isEdit = !!risk;
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

  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-white outline-none focus:border-primary/40 transition-all';
  const labelCls = 'text-[12px] font-semibold text-text-muted block mb-1.5';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={requestClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-ink-900">{isEdit ? 'Edit Risk' : 'Create Risk'}</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">{isEdit ? 'Update risk definition and metadata.' : 'Define a reusable risk for RACM mapping.'}</p>
          </div>
          <button type="button" aria-label="Close" onClick={requestClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>

        {/* Discard confirm strip — appears at top of body when user tries to close with unsaved changes */}
        {showDiscardConfirm && (
          <div className="p-3 bg-mitigated-50 border-b border-mitigated-200 flex items-center gap-3 text-[13px] shrink-0">
            <AlertTriangle className="w-4 h-4 text-mitigated-700 shrink-0" />
            <div className="flex-1 text-ink-800">Discard unsaved changes?</div>
            <button type="button" onClick={discardAndClose} className="px-3 py-1 rounded-[6px] bg-paper-0 border border-mitigated-300 text-[12px] text-ink-700 hover:bg-paper-50">Discard</button>
            <button type="button" onClick={() => setShowDiscardConfirm(false)} className="px-3 py-1 rounded-[6px] bg-mitigated-700 text-paper-0 text-[12px] hover:bg-mitigated-800">Keep editing</button>
          </div>
        )}

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Basic Details */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Basic Details</h3>
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
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Ownership</h3>
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
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Priority</h3>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button type="button" key={p} onClick={() => setPriority(p)}
                  className={`px-3 py-2 rounded-[8px] text-[12px] font-medium border transition-all cursor-pointer ${
                    priority === p ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted hover:border-primary/30'
                  }`}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3 shrink-0">
          <button type="button" onClick={requestClose} className="px-4 py-2.5 rounded-[8px] border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button type="button" onClick={() => { if (isValid) onSave(buildRisk('Active')); }} disabled={!isValid}
            className="px-5 py-2.5 rounded-[8px] bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            Save
          </button>
        </div>
      </motion.aside>
    </>
  );
}

// ─── Risk Detail Drawer ─────────────────────────────────────────────────────

function RiskDetailDrawer({ risk, onClose, onUpdate }: { risk: RiskEntry; onClose: () => void; onUpdate: (r: RiskEntry) => void }) {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);

  const handleStatusChange = (newStatus: RiskLifecycleStatus) => {
    onUpdate({ ...risk, status: newStatus, lastReviewed: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
    addToast({ message: `Risk status changed to ${newStatus}`, type: 'success' });
  };

  const transitions: Partial<Record<RiskLifecycleStatus, { label: string; status: RiskLifecycleStatus; cls: string }[]>> = {
    Draft: [
      { label: 'Activate', status: 'Active', cls: 'bg-compliant-50 text-compliant-700 hover:bg-compliant-50/70' },
      { label: 'Archive', status: 'Archived', cls: 'bg-paper-100 text-ink-500 hover:bg-paper-200' },
    ],
    Active: [
      { label: 'Mark Under Review', status: 'Under Review', cls: 'bg-high-50 text-high-700 hover:bg-high-50/70' },
      { label: 'Archive', status: 'Archived', cls: 'bg-paper-100 text-ink-500 hover:bg-paper-200' },
    ],
    'Under Review': [
      { label: 'Activate', status: 'Active', cls: 'bg-compliant-50 text-compliant-700 hover:bg-compliant-50/70' },
      { label: 'Archive', status: 'Archived', cls: 'bg-paper-100 text-ink-500 hover:bg-paper-200' },
    ],
    Archived: [],
  };

  const availableActions = transitions[risk.status] || [];

  const fields = [
    { label: 'Risk ID', value: risk.id },
    { label: 'Business Process', value: risk.businessProcess },
    { label: 'Sub-process', value: risk.subProcess || '—' },
    { label: 'Category', value: risk.category },
    { label: 'Priority', value: risk.priority },
    { label: 'Owner', value: risk.owner || '—' },
    { label: 'Reviewer', value: risk.reviewer || '—' },
    { label: 'Created', value: risk.createdAt },
    { label: 'Last Reviewed', value: risk.lastReviewed },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">

        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[18px] font-semibold text-ink-900">{risk.name}</h2>
              <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${STATUS_STYLES[risk.status]}`}>{risk.status}</span>
            </div>
            <p className="text-[12px] text-ink-500 mt-0.5 font-mono">{risk.id}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Description */}
          <div>
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Description</h3>
            <p className="text-[13px] text-text leading-relaxed">{risk.description}</p>
          </div>

          {/* Fields */}
          <div>
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Details</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {fields.map(f => (
                <div key={f.label}>
                  <span className="text-[10px] text-ink-400 uppercase block">{f.label}</span>
                  <span className={`text-[13px] mt-0.5 block ${f.label === 'Priority' ? PRIORITY_STYLES[risk.priority] : 'text-text'}`}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border">
          <button type="button" onClick={onClose} className="w-full px-4 py-2.5 rounded-[8px] border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Close</button>
        </footer>

        {/* Edit drawer (nested) */}
        <AnimatePresence>
          {editing && (
            <RiskDrawer risk={risk} onClose={() => setEditing(false)} onSave={(updated) => { onUpdate(updated); setEditing(false); }} />
          )}
        </AnimatePresence>
      </motion.aside>
    </>
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
  const [risks, setRisks] = useState<RiskEntry[]>(SEED_RISKS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [detailRisk, setDetailRisk] = useState<RiskEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [archivedRiskIds, setArchivedRiskIds] = useState<string[]>([]);
  const [subProcessFilter, setSubProcessFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
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
  const highPriorityCount = baseRisks.filter(r => r.priority === 'Critical' || r.priority === 'High').length;
  const unreviewedCount = baseRisks.filter(r => r.lastReviewed === '—').length;

  // Filters
  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: baseRisks.length },
    { key: 'draft', label: 'Draft', count: baseRisks.filter(r => r.status === 'Draft').length },
    { key: 'active', label: 'Active', count: baseRisks.filter(r => r.status === 'Active').length },
    { key: 'under-review', label: 'Under Review', count: baseRisks.filter(r => r.status === 'Under Review').length },
    { key: 'archived', label: 'Archived', count: baseRisks.filter(r => r.status === 'Archived').length },
    { key: 'high-priority', label: 'High Priority', count: highPriorityCount },
    { key: 'unreviewed', label: 'Unreviewed', count: unreviewedCount },
  ];

  const filteredRisks = useMemo(() => {
    let result = baseRisks;

    // Status / priority filters
    switch (activeFilter) {
      case 'draft': result = result.filter(r => r.status === 'Draft'); break;
      case 'active': result = result.filter(r => r.status === 'Active'); break;
      case 'under-review': result = result.filter(r => r.status === 'Under Review'); break;
      case 'archived': result = result.filter(r => r.status === 'Archived'); break;
      case 'high-priority': result = result.filter(r => r.priority === 'Critical' || r.priority === 'High'); break;
      case 'unreviewed': result = result.filter(r => r.lastReviewed === '—'); break;
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
  }, [baseRisks, activeFilter, searchQuery, subProcessFilter, categoryFilter, priorityFilter]);

  const subProcessOptions = useMemo(() => Array.from(new Set(baseRisks.map(r => r.subProcess))).sort(), [baseRisks]);
  const categoryOptions = useMemo(() => Array.from(new Set(baseRisks.map(r => r.category))).sort(), [baseRisks]);
  const priorityOptions = useMemo(() => {
    const order = ['Critical', 'High', 'Medium', 'Low'];
    const set = new Set(baseRisks.map(r => r.priority));
    return order.filter(p => set.has(p as RiskPriority));
  }, [baseRisks]);

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
    setDetailRisk(null);
  };

  const handleUpdateRisk = (updated: RiskEntry) => {
    setRisks(prev => prev.map(r => r.id === updated.id ? updated : r));
    setDetailRisk(updated);
  };

  // Single-row archive replaces the old sticky bulk bar.
  const handleArchiveOne = (id: string) => {
    setArchivedRiskIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSelectedRiskIds(prev => prev.filter(s => s !== id));
    addToast({ message: `Risk archived`, type: 'success' });
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

  return (
    <div className={embedded ? '' : 'relative h-full overflow-y-auto'}>
      <div className={embedded ? 'space-y-5' : 'relative z-10 max-w-[1200px] mx-auto px-6 py-6 space-y-5'}>
        {/* Toolbar — when embedded inside Process Hub, the create button lives in the
            Process Hub header. Standalone Risk Register keeps its own title + CTA. */}
        {!embedded && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[18px] font-semibold text-ink-900">Risk Register</h1>
              <p className="text-[13px] text-text-muted mt-1">Maintain the master list of business and audit risks across processes.</p>
            </div>
            <button type="button" onClick={() => setShowCreateDrawer(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer shrink-0">
              <Plus size={13} />New Risk
            </button>
          </div>
        )}

        {/* Insight banner — standalone only (embedded shows it in the header row) */}
        {!embedded && unmappedCount > 0 && (
          <div className="rounded-[8px] border border-high-700/15 bg-high-50 px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={14} className="text-high-700 shrink-0" />
            <span className="text-[12px] text-high-700 flex-1">
              <span className="font-semibold">{unmappedCount} risk{unmappedCount !== 1 ? 's' : ''}</span> {unmappedCount !== 1 ? 'are' : 'is'} not yet mapped to controls.
            </span>
          </div>
        )}

        {/* True empty state — no risks at all (after process filter) — hidden during initial loading */}
        {!isLoading && baseRisks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-[12px] bg-paper-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-ink-500" />
            </div>
            <h3 className="text-[15px] font-display text-ink-800 mb-1">No risks yet</h3>
            <p className="text-[13px] text-ink-600 mb-5 max-w-[320px]">Track risks for this process and link them to controls.</p>
            <button type="button" onClick={() => setShowCreateDrawer(true)} className="px-4 py-2 rounded-[8px] bg-brand-600 text-paper-0 text-[13px] font-medium hover:bg-brand-700">New Risk</button>
          </div>
        ) : (
        <>

        {/* Filters + Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map(f => (
              <button type="button" key={f.key} onClick={() => setActiveFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                  activeFilter === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                }`}>
                {f.label}
                {f.count > 0 && <span className={`ml-1 text-[10px] tabular-nums ${activeFilter === f.key ? 'text-white/80' : 'text-text-muted/60'}`}>{f.count}</span>}
              </button>
            ))}
          </div>
          <div className="relative shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search risks..."
              className="pl-9 pr-3 py-2 rounded-[8px] border border-border bg-white text-[12px] w-[220px] placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all" />
          </div>
        </div>

        {/* Risk Table */}
        <div className="border-t border-border-light overflow-x-auto min-h-[calc(100vh-280px)]">
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-white border-b border-border-light">
                <tr>
                  <th className="px-4 py-3 text-left w-8">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="Select all visible risks"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      disabled={isLoading || visibleIds.length === 0}
                      className="w-3.5 h-3.5 rounded-[4px] border border-ink-300 cursor-pointer accent-brand-600"
                    />
                  </th>
                  {([
                    { key: 'risk-id', label: 'Risk ID' },
                    { key: 'risk-name', label: 'Risk Name' },
                    { key: 'sub-process', label: 'Sub-process', filter: 'subProcess' as const },
                    { key: 'category', label: 'Category', filter: 'category' as const },
                    { key: 'priority', label: 'Priority', tooltip: 'Inherent risk severity — Critical/High/Medium/Low based on likelihood × impact before any controls are applied.', filter: 'priority' as const },
                    { key: 'action', label: '' },
                  ] as Array<{ key: string; label: string; tooltip?: string; filter?: 'subProcess' | 'category' | 'priority' }>).map(h => (
                    <th key={h.key} className="px-4 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {h.tooltip ? (
                          <span className="inline-flex items-center gap-1 group/tip relative">
                            {h.label}
                            <HelpCircle className="w-3 h-3 text-ink-400" aria-label={`What is ${h.label}?`} />
                            <span className="absolute top-full left-0 mt-1 w-[220px] p-2.5 rounded-[8px] bg-ink-800 text-paper-0 text-[12px] font-normal leading-snug normal-case tracking-normal opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
                              {h.tooltip}
                            </span>
                          </span>
                        ) : h.label}
                        {h.filter === 'subProcess' && (
                          <ColumnFilter label="Sub-process" options={subProcessOptions} value={subProcessFilter} onChange={setSubProcessFilter} />
                        )}
                        {h.filter === 'category' && (
                          <ColumnFilter label="Category" options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} />
                        )}
                        {h.filter === 'priority' && (
                          <ColumnFilter label="Priority" options={priorityOptions} value={priorityFilter} onChange={setPriorityFilter} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={`skel-${i}`} className="border-t border-border-light">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-3 bg-paper-100 rounded-[4px] animate-pulse" style={{ width: `${60 + ((i + j) * 7) % 30}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredRisks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[12px] text-text-muted">
                      No risks match your search or filters.
                      {(subProcessFilter.length || categoryFilter.length || priorityFilter.length) > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSubProcessFilter([]); setCategoryFilter([]); setPriorityFilter([]); }}
                          className="ml-2 text-brand-700 hover:text-brand-600 cursor-pointer font-medium"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : filteredRisks.map((risk, i) => {
                  const isChecked = selectedRiskIds.includes(risk.id);
                  return (
                  <motion.tr key={risk.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                    onClick={() => setDetailRisk(risk)}
                    className="border-t border-border-light hover:bg-surface-2/40 transition-colors cursor-pointer">
                    <td className="px-4 py-4 align-top" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${risk.id}`}
                        checked={isChecked}
                        onChange={() => toggleSelectRisk(risk.id)}
                        className="w-3.5 h-3.5 rounded-[4px] border border-ink-300 cursor-pointer accent-brand-600"
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="font-mono text-[10px] text-ink-500 bg-paper-50 border border-canvas-border px-1.5 py-0.5 rounded-[4px]">{risk.id}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="text-[13px] font-medium text-text leading-snug">{risk.name}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="text-[11px] text-ink-500">{risk.subProcess || '—'}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="text-[11px] text-ink-500">{risk.category}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`text-[11px] ${PRIORITY_STYLES[risk.priority]}`}>{risk.priority}</span>
                    </td>
                    <td className="px-4 py-4 align-top text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 justify-end">
                        {isChecked ? (
                          <>
                            <button type="button"
                              onClick={() => handleArchiveOne(risk.id)}
                              className="px-2 py-1 rounded-[6px] text-[10px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 bg-paper-0 border border-ink-200 text-ink-800 hover:bg-paper-50">
                              <Archive size={10} />Archive
                            </button>
                            <button type="button"
                              onClick={() => handleCancelOne(risk.id)}
                              className="px-2 py-1 rounded-[6px] text-[10px] font-medium text-ink-600 hover:bg-paper-100 cursor-pointer transition-colors">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setDetailRisk(risk)}
                            className="px-2 py-1 rounded-[8px] text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-paper-100 text-ink-600 hover:bg-paper-200">
                            View<ChevronRight size={8} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                  );
                })}
              </tbody>
            </table>
        </div>
        </>
        )}
      </div>

      {/* Create Drawer */}
      <AnimatePresence>
        {showCreateDrawer && (
          <RiskDrawer risk={null} onClose={() => setShowCreateDrawer(false)} onSave={handleSaveRisk} defaultProcess={processFilter} />
        )}
      </AnimatePresence>

      {/* Detail Drawer */}
      <AnimatePresence>
        {detailRisk && !showCreateDrawer && (
          <RiskDetailDrawer risk={detailRisk} onClose={() => setDetailRisk(null)} onUpdate={handleUpdateRisk} />
        )}
      </AnimatePresence>
    </div>
  );
}
