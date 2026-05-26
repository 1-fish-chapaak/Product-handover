import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, X, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, Archive, Edit3, Eye,
  ArrowRight, FileText,
} from 'lucide-react';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';

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
  Draft: 'bg-gray-100 text-gray-600',
  Active: 'bg-emerald-50 text-emerald-700',
  'Under Review': 'bg-amber-50 text-amber-700',
  Archived: 'bg-gray-100 text-gray-400',
};

const PRIORITY_STYLES: Record<RiskPriority, string> = {
  Critical: 'text-red-600 font-bold',
  High: 'text-amber-600 font-semibold',
  Medium: 'text-gray-600 font-medium',
  Low: 'text-gray-400 font-medium',
};

// ─── Action derivation ─────────────────────────────────────────────────────

function getRiskRegisterAction(status: RiskLifecycleStatus): { label: string; cls: string } {
  switch (status) {
    case 'Draft': return { label: 'Complete Setup', cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Active': return { label: 'View', cls: 'bg-gray-100 text-gray-600 hover:bg-gray-200/70' };
    case 'Under Review': return { label: 'Review', cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100/70' };
    case 'Archived': return { label: 'View', cls: 'bg-gray-50 text-gray-400 hover:bg-gray-100' };
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
  const [name, setName] = useState(risk?.name || '');
  const [description, setDescription] = useState(risk?.description || '');
  const [businessProcess, setBusinessProcess] = useState(risk?.businessProcess || defaultProcess || '');
  const [subProcess, setSubProcess] = useState(risk?.subProcess || '');
  const [category, setCategory] = useState<RiskCategory | ''>(risk?.category || '');
  const [priority, setPriority] = useState<RiskPriority | ''>(risk?.priority || '');
  const [owner, setOwner] = useState(risk?.owner || '');
  const [reviewer, setReviewer] = useState(risk?.reviewer || '');

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

  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
  const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1.5';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[1.125rem] font-semibold text-ink-900">{isEdit ? 'Edit Risk' : 'Create Risk'}</h2>
            <p className="text-[0.75rem] text-ink-500 mt-0.5">{isEdit ? 'Update risk definition and metadata.' : 'Define a reusable risk for RACM mapping.'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Basic Details */}
          <div className="space-y-3">
            <h3 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider">Basic Details</h3>
            <div>
              <label className={labelCls}>Risk Name <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Unauthorized vendor payments" className={fieldCls} autoFocus />
            </div>
            <div>
              <label className={labelCls}>Description <span className="text-red-400">*</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the risk scenario and potential impact..." className={fieldCls + ' resize-none'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Business Process <span className="text-red-400">*</span></label>
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
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`px-3 py-2 rounded-lg text-[0.75rem] font-medium border transition-all cursor-pointer ${
                    priority === p ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted hover:border-primary/30'
                  }`}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button onClick={() => { if (isValid) onSave(buildRisk('Active')); }} disabled={!isValid}
            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
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
      { label: 'Activate', status: 'Active', cls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70' },
      { label: 'Archive', status: 'Archived', cls: 'bg-gray-100 text-gray-500 hover:bg-gray-200/70' },
    ],
    Active: [
      { label: 'Mark Under Review', status: 'Under Review', cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100/70' },
      { label: 'Archive', status: 'Archived', cls: 'bg-gray-100 text-gray-500 hover:bg-gray-200/70' },
    ],
    'Under Review': [
      { label: 'Activate', status: 'Active', cls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70' },
      { label: 'Archive', status: 'Archived', cls: 'bg-gray-100 text-gray-500 hover:bg-gray-200/70' },
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
              <h2 className="font-display text-[1.125rem] font-semibold text-ink-900">{risk.name}</h2>
              <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${STATUS_STYLES[risk.status]}`}>{risk.status}</span>
            </div>
            <p className="text-[0.75rem] text-ink-500 mt-0.5 font-mono">{risk.id}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Description */}
          <div>
            <h3 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-2">Description</h3>
            <p className="text-[0.8125rem] text-text leading-relaxed">{risk.description}</p>
          </div>

          {/* Fields */}
          <div>
            <h3 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-2">Details</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {fields.map(f => (
                <div key={f.label}>
                  <span className="text-[0.625rem] text-gray-400 uppercase block">{f.label}</span>
                  <span className={`text-[0.8125rem] mt-0.5 block ${f.label === 'Priority' ? PRIORITY_STYLES[risk.priority] : 'text-text'}`}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border">
          <button onClick={onClose} className="w-full px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Close</button>
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

  // Apply process filter first (for embedded mode)
  const baseRisks = processFilter ? risks.filter(r => r.businessProcess === processFilter) : risks;

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

    return result;
  }, [baseRisks, activeFilter, searchQuery]);

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

  // Count risks with no mapped controls (draft status = unmapped)
  const unmappedCount = baseRisks.filter(r => r.status === 'Draft').length;

  return (
    <div className="relative h-full overflow-y-auto">
      <Orb className="fixed top-[-180px] right-[-120px] w-[500px] h-[500px] opacity-20" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-text">Risk Register</h1>
            <p className="text-[0.8125rem] text-text-muted mt-1">Maintain the master list of business and audit risks across processes.</p>
          </div>
          <button onClick={() => setShowCreateDrawer(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
            <Plus size={14} />New Risk
          </button>
        </div>

        {/* Insight banner */}
        {unmappedCount > 0 && (
          <div className="rounded-lg border border-amber-200/50 bg-amber-50/30 px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span className="text-[0.75rem] text-amber-800 flex-1">
              <span className="font-semibold">{unmappedCount} risk{unmappedCount !== 1 ? 's' : ''}</span> {unmappedCount !== 1 ? 'are' : 'is'} not yet mapped to controls.
            </span>
          </div>
        )}

        {/* Filters + Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map(f => (
              <button key={f.key} onClick={() => setActiveFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${
                  activeFilter === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                }`}>
                {f.label}
                {f.count > 0 && <span className={`ml-1 text-[0.625rem] tabular-nums ${activeFilter === f.key ? 'text-white/80' : 'text-text-muted/60'}`}>{f.count}</span>}
              </button>
            ))}
          </div>
          <div className="relative shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search risks..."
              className="pl-9 pr-3 py-2 rounded-lg border border-border bg-white text-[0.75rem] w-[220px] placeholder:text-ink-400 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
          </div>
        </div>

        {/* Risk Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[0.75rem]">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  {['Risk ID', 'Risk Name', 'Sub-process', 'Category', 'Priority', ''].map(h => (
                    <th key={h || 'action'} className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRisks.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[0.75rem] text-text-muted">No risks match your search or filters</td></tr>
                ) : filteredRisks.map((risk, i) => (
                  <motion.tr key={risk.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                    onClick={() => setDetailRisk(risk)}
                    className="border-b border-border/50 hover:bg-gray-50/60 transition-colors cursor-pointer">
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[0.625rem] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">{risk.id}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[0.75rem] font-medium text-text">{risk.name}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[0.6875rem] text-gray-500">{risk.subProcess || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[0.6875rem] text-gray-500">{risk.category}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[0.6875rem] ${PRIORITY_STYLES[risk.priority]}`}>{risk.priority}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDetailRisk(risk)}
                        className="px-2 py-1 rounded-lg text-[0.625rem] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-gray-100 text-gray-600 hover:bg-gray-200/70">
                        View<ChevronRight size={8} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-2/30">
            <span className="text-[0.6875rem] text-text-muted">{filteredRisks.length} of {baseRisks.length} risks</span>
          </div>
        </div>
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
