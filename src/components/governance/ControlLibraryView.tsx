import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Plus,
  Download,
  Star,
  ArrowRight,
  Link2,
  AlertTriangle,
  Eye,
  Pencil,
  Trash2,
  Workflow,
  Share2,
} from 'lucide-react';
import SmartTable from '../shared/SmartTable';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { WORKFLOWS } from '../../data/mockData';
import CreateControlDrawer, { type NewControlData } from './CreateControlDrawer';
import { useCreatedControls } from '../../data/createdControlsStore';
import ControlDetailView from './ControlDetailView';
import { LinkWorkflowToControlDrawer, type ControlWorkflow } from '../audit/RacmMappingWorkspace';
import {
  type ControlRow,
  BP_COLORS, AUTOMATION_STYLES, NATURE_STYLES, STATUS_STYLES,
} from './controlTypes';

/* ─── Seed Data ─── */
const SEED_CONTROLS: ControlRow[] = [
  { id: 'C-001', controlId: 'C-001', name: 'Three-Way PO/GRN/Invoice Matching', description: 'System-enforced three-way matching of Purchase Order, Goods Receipt Note, and Invoice before payment release to prevent unauthorized or duplicate payments.', objective: 'Ensure every payment is backed by a valid PO, goods receipt, and matching invoice.', businessProcess: 'P2P', subProcess: 'Invoice Processing', classification: 'Key', nature: 'Preventive', automation: 'Automated', frequency: 'Per transaction', owner: 'Tushar Goel', assertions: ['completeness', 'accuracy', 'authorization'], mappedRisks: ['RSK-001', 'RSK-002'], linkedWorkflows: ['Three-Way PO Match'], linkedWorkflowIds: ['wf-007'], usedInRACMs: 4, status: 'Active', createdAt: 'Jan 15, 2026', updatedAt: 'Apr 22, 2026' },
  { id: 'C-002', controlId: 'C-002', name: 'Vendor Master Change Approval', description: 'Multi-level approval workflow for vendor master data changes including verification of tax ID, bank details, and compliance checks.', objective: 'Prevent unauthorized changes to vendor master data and fictitious vendor registration.', businessProcess: 'P2P', subProcess: 'Vendor Management', classification: 'Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', owner: 'Deepak Bansal', assertions: ['authorization', 'occurrence', 'existence'], mappedRisks: ['RSK-003', 'RSK-004'], linkedWorkflows: ['Vendor Master Change Monitor'], linkedWorkflowIds: ['wf-002'], usedInRACMs: 2, status: 'Active', createdAt: 'Jan 20, 2026', updatedAt: 'Apr 20, 2026' },
  { id: 'C-003', controlId: 'C-003', name: 'Duplicate Invoice Detection', description: 'Automated scanning of incoming invoices against historical data to identify and flag potential duplicate submissions before payment processing.', objective: 'Prevent duplicate payments and overpayments to vendors.', businessProcess: 'P2P', subProcess: 'Invoice Processing', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Per transaction', owner: 'Tushar Goel', assertions: ['accuracy', 'occurrence'], mappedRisks: ['RSK-002'], linkedWorkflows: ['Duplicate Invoice Detector'], linkedWorkflowIds: ['wf-001'], usedInRACMs: 3, status: 'Active', createdAt: 'Jan 22, 2026', updatedAt: 'Apr 18, 2026' },
  { id: 'C-004', controlId: 'C-004', name: 'High-Value Payment Review', description: 'Automatic flagging and additional approval workflow for payments exceeding defined threshold amounts.', objective: 'Ensure high-value transactions receive additional scrutiny and dual authorization.', businessProcess: 'P2P', subProcess: 'Payment Execution', classification: 'Key', nature: 'Preventive', automation: 'IT-dependent', frequency: 'Per transaction', owner: 'Karan Mehta', assertions: ['authorization', 'accuracy'], mappedRisks: ['RSK-001', 'RSK-005'], linkedWorkflows: ['High-Value Payment Flagging'], linkedWorkflowIds: ['wf-003'], usedInRACMs: 2, status: 'Active', createdAt: 'Feb 1, 2026', updatedAt: 'Apr 14, 2026' },
  { id: 'C-005', controlId: 'C-005', name: 'Revenue Recognition Compliance Check', description: 'Automated validation of revenue recognition against ASC 606 criteria for all revenue transactions.', objective: 'Ensure revenue is recognized in compliance with accounting standards.', businessProcess: 'O2C', subProcess: 'Revenue Recognition', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Monthly', owner: 'Neha Joshi', assertions: ['completeness', 'accuracy', 'cutoff', 'valuation'], mappedRisks: ['RSK-010'], linkedWorkflows: ['Revenue Recognition Checker'], linkedWorkflowIds: ['wf-004'], usedInRACMs: 2, status: 'Active', createdAt: 'Feb 5, 2026', updatedAt: 'Apr 10, 2026' },
  { id: 'C-006', controlId: 'C-006', name: 'Credit Limit Override Approval', description: 'Manual review and approval process for customer credit limit overrides and changes above the defined threshold.', objective: 'Prevent unauthorized credit exposure and override abuse.', businessProcess: 'O2C', subProcess: 'Credit Management', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', owner: 'Sneha Desai', assertions: ['authorization'], mappedRisks: [], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 1, status: 'Draft', createdAt: 'Feb 10, 2026', updatedAt: 'Feb 10, 2026' },
  { id: 'C-007', controlId: 'C-007', name: 'Journal Entry Approval', description: 'AI-powered anomaly detection and management review of journal entries to identify unusual patterns that may indicate errors or fraud.', objective: 'Detect and investigate anomalous journal entries before period close.', businessProcess: 'R2R', subProcess: 'Journal Entries', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Daily', owner: 'Rohan Patel', assertions: ['accuracy', 'occurrence', 'completeness'], mappedRisks: ['RSK-011'], linkedWorkflows: ['Journal Entry Anomaly Detector'], linkedWorkflowIds: ['wf-005'], usedInRACMs: 3, status: 'Active', createdAt: 'Feb 15, 2026', updatedAt: 'Apr 16, 2026' },
  { id: 'C-008', controlId: 'C-008', name: 'Period-End Close Reconciliation', description: 'Monthly reconciliation of all GL accounts to ensure balances are accurate before financial close.', objective: 'Ensure accuracy and completeness of financial reporting.', businessProcess: 'R2R', subProcess: 'Financial Close', classification: 'Key', nature: 'Detective', automation: 'Manual', frequency: 'Monthly', owner: 'Karan Mehta', assertions: ['completeness', 'accuracy', 'valuation', 'cutoff'], mappedRisks: ['RSK-012'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 2, status: 'Draft', createdAt: 'Feb 18, 2026', updatedAt: 'Feb 28, 2026' },
  { id: 'C-009', controlId: 'C-009', name: 'SOD Violation Detection', description: 'Real-time segregation of duties conflict detection across all business processes with automatic alerting.', objective: 'Prevent and detect segregation of duties violations.', businessProcess: 'ITGC', subProcess: 'Access Management', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Daily', owner: 'Priya Singh', assertions: ['authorization', 'occurrence'], mappedRisks: ['RSK-008'], linkedWorkflows: ['SOD Violation Detector'], linkedWorkflowIds: ['wf-008'], usedInRACMs: 2, status: 'Active', createdAt: 'Feb 20, 2026', updatedAt: 'Apr 8, 2026' },
  { id: 'C-010', controlId: 'C-010', name: 'User Access Review', description: 'Quarterly review of all system access rights to ensure appropriate access levels are maintained and unauthorized access is revoked.', objective: 'Ensure only authorized users retain system access per least-privilege principle.', businessProcess: 'ITGC', subProcess: 'Access Management', classification: 'Key', nature: 'Preventive', automation: 'IT-dependent', frequency: 'Quarterly', owner: 'Priya Singh', assertions: ['authorization', 'existence'], mappedRisks: ['RSK-009'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 1, status: 'Active', createdAt: 'Mar 1, 2026', updatedAt: 'Mar 15, 2026' },
  { id: 'C-011', controlId: 'C-011', name: 'Contract Expiry Monitoring', description: 'Automated tracking of contract expiration dates with proactive alerts to stakeholders for renewal or termination decisions.', objective: 'Prevent contract lapses and ensure timely renewals.', businessProcess: 'S2C', subProcess: 'Contract Compliance', classification: 'Non-Key', nature: 'Detective', automation: 'Automated', frequency: 'Daily', owner: 'Rohan Patel', assertions: ['completeness', 'cutoff'], mappedRisks: [], linkedWorkflows: ['Contract Expiry Alert'], linkedWorkflowIds: ['wf-006'], usedInRACMs: 1, status: 'Active', createdAt: 'Mar 5, 2026', updatedAt: 'Mar 5, 2026' },
  { id: 'C-012', controlId: 'C-012', name: 'Supplier Risk Assessment', description: 'Periodic assessment of supplier risk profiles including financial stability, compliance, and performance metrics.', objective: 'Identify and mitigate supplier-related risks.', businessProcess: 'S2C', subProcess: 'Supplier Performance', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Quarterly', owner: 'Deepak Bansal', assertions: ['existence', 'valuation'], mappedRisks: ['RSK-007'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 0, status: 'Draft', createdAt: 'Mar 10, 2026', updatedAt: 'Mar 10, 2026' },
  { id: 'C-013', controlId: 'C-013', name: 'Intercompany Reconciliation', description: 'Monthly reconciliation of intercompany balances across all subsidiaries.', objective: 'Ensure intercompany transactions are accurately recorded and eliminate discrepancies.', businessProcess: 'R2R', subProcess: 'Intercompany', classification: 'Non-Key', nature: 'Detective', automation: 'Manual', frequency: 'Monthly', owner: 'Sneha Desai', assertions: ['completeness', 'accuracy'], mappedRisks: ['RSK-012'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 1, status: 'Draft', createdAt: 'Mar 12, 2026', updatedAt: 'Mar 12, 2026' },
  { id: 'C-014', controlId: 'C-014', name: 'Purchase Order Dual Sign-Off', description: 'Dual authorization requirement for all purchase orders above the standard threshold.', objective: 'Ensure proper authorization for purchasing commitments.', businessProcess: 'P2P', subProcess: 'Purchase Orders', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', owner: 'Tushar Goel', assertions: ['authorization'], mappedRisks: ['RSK-005'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 1, status: 'Draft', createdAt: 'Mar 15, 2026', updatedAt: 'Mar 15, 2026' },
];

/* ─── Component ─── */

interface ControlLibraryProps {
  /** When set, filters controls to this process and pre-fills create drawer */
  processFilter?: string;
}

export default function ControlLibraryView({ processFilter }: ControlLibraryProps) {
  const { addToast } = useToast();
  const { can } = useCan();
  const { openShare } = useShare();

  // Stateful controls list
  const [controls, setControls] = useState<ControlRow[]>(SEED_CONTROLS);

  // Controls created via the wizard (e.g. a risk's Link Control → Create Control)
  // are merged in — newest first — so they appear in the global library too.
  const created = useCreatedControls();
  const createdRows: ControlRow[] = created.map(c => {
    const linkedWorkflows: string[] = [];
    const linkedWorkflowIds: string[] = [];
    if (c.workflowChoice === 'link' && c.linkedWorkflowId) {
      const wf = WORKFLOWS.find(w => w.id === c.linkedWorkflowId);
      if (wf) { linkedWorkflows.push(wf.name); linkedWorkflowIds.push(wf.id); }
    }
    return {
      id: c.id, controlId: c.id,
      name: c.name, description: c.description, objective: c.objective,
      businessProcess: c.businessProcess as ControlRow['businessProcess'],
      subProcess: c.subProcess,
      classification: c.classification, nature: c.nature, automation: c.automation,
      frequency: c.frequency, owner: c.owner,
      assertions: c.assertions, mappedRisks: c.mappedRisks,
      linkedWorkflows, linkedWorkflowIds,
      usedInRACMs: 0,
      status: (c.workflowChoice === 'link' && c.linkedWorkflowId) ? 'Active' : 'Draft',
      createdAt: c.createdAt, updatedAt: c.createdAt,
    };
  });
  const allControls = [...createdRows, ...controls];

  // Detail view state. On mount, honour a sessionStorage hand-off so
  // deep-links from elsewhere (e.g. the homepage Control Breaks chip) can
  // land directly on a specific control's detail page. The flag is consumed
  // once so subsequent visits start at the library list.
  const [selectedControlId, setSelectedControlId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const pending = window.sessionStorage.getItem('control-library.open-control-id');
    if (pending) {
      window.sessionStorage.removeItem('control-library.open-control-id');
      return pending;
    }
    return null;
  });

  // Drawer state
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [linkWfControlId, setLinkWfControlId] = useState<string | null>(null);

  // Filters — lock BP filter when processFilter is provided
  const [bpFilter, setBpFilter] = useState<string>(processFilter || 'all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [automationFilter, setAutomationFilter] = useState<string>('all');
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<string>('all');

  // Selected control for detail view
  const selectedControl = selectedControlId ? allControls.find(c => c.id === selectedControlId) : null;

  // If detail view is open, render it
  if (selectedControl) {
    return (
      <ControlDetailView
        control={selectedControl}
        onBack={() => setSelectedControlId(null)}
        onUpdate={(updated) => {
          setControls(prev => prev.map(c => c.id === updated.id ? updated : c));
        }}
      />
    );
  }

  // Base controls (process-scoped when embedded)
  const baseControls = processFilter ? allControls.filter(c => c.businessProcess === processFilter) : allControls;

  // Filtered data
  const filtered = baseControls.filter(c => {
    if (!processFilter && bpFilter !== 'all' && c.businessProcess !== bpFilter) return false;
    if (classFilter !== 'all' && c.classification !== classFilter) return false;
    if (automationFilter !== 'all' && c.automation !== automationFilter) return false;
    if (workflowStatusFilter === 'linked' && c.linkedWorkflows.length === 0) return false;
    if (workflowStatusFilter === 'missing' && c.linkedWorkflows.length > 0) return false;
    return true;
  });

  // KPI computations
  const totalControls = baseControls.length;
  const keyControls = baseControls.filter(c => c.classification === 'Key').length;
  const automatedControls = baseControls.filter(c => c.automation === 'Automated').length;
  const missingWorkflow = baseControls.filter(c => c.linkedWorkflows.length === 0).length;

  const hasActiveFilters = bpFilter !== 'all' || classFilter !== 'all' || automationFilter !== 'all' || workflowStatusFilter !== 'all';

  const clearFilters = () => {
    setBpFilter('all');
    setClassFilter('all');
    setAutomationFilter('all');
    setWorkflowStatusFilter('all');
  };

  // Create control handler
  const handleCreateControl = (data: NewControlData) => {
    const nextNum = controls.length + 1;
    const controlId = `C-${String(nextNum).padStart(3, '0')}`;

    // Resolve linked workflow
    const linkedWorkflowNames: string[] = [];
    const linkedWorkflowIds: string[] = [];
    if (data.workflowChoice === 'link' && data.linkedWorkflowId) {
      const wf = WORKFLOWS.find(w => w.id === data.linkedWorkflowId);
      if (wf) {
        linkedWorkflowNames.push(wf.name);
        linkedWorkflowIds.push(wf.id);
      }
    }

    // Determine status
    let status: ControlRow['status'];
    if (data.workflowChoice === 'link' && data.linkedWorkflowId) {
      status = 'Active';
    } else {
      status = 'Draft';
    }

    const newControl: ControlRow = {
      id: controlId,
      controlId,
      name: data.name,
      description: data.description,
      objective: data.objective,
      businessProcess: data.businessProcess as ControlRow['businessProcess'],
      subProcess: data.subProcess,
      classification: data.classification,
      nature: data.nature,
      automation: data.automation,
      frequency: data.frequency,
      owner: data.owner,
      assertions: data.assertions,
      mappedRisks: data.mappedRisks,
      linkedWorkflows: linkedWorkflowNames,
      linkedWorkflowIds,
      usedInRACMs: 0,
      status,
      createdAt: 'Apr 25, 2026',
      updatedAt: 'Apr 25, 2026',
    };

    setControls(prev => [newControl, ...prev]);
    setShowCreateDrawer(false);
    addToast({ message: `Control ${controlId} "${data.name}" created`, type: 'success' });

    // Open the new control's detail view
    setSelectedControlId(controlId);
  };

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.09} rotateOnHover hue={275} opacity={0.08} />
      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Control Library</h1>
            <p className="text-sm text-text-secondary mt-1">
              Global repository of reusable controls across all business processes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {can('ctrl_export') && (
              <button
                onClick={() => addToast({ message: 'Control library exported as CSV', type: 'success' })}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text-secondary hover:bg-white transition-colors cursor-pointer"
              >
                <Download size={14} />
                Export
              </button>
            )}
            {can('ctrl_create') && (
              <button
                onClick={() => setShowCreateDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Create Control
              </button>
            )}
          </div>
        </div>

        {/* Summary line */}
        <div className="flex items-center gap-6 text-[0.75rem] text-text-muted mb-5">
          <span><span className="font-semibold text-text">{totalControls}</span> controls</span>
          <span><span className="font-semibold text-text">{keyControls}</span> key</span>
          <span><span className="font-semibold text-text">{automatedControls}</span> automated</span>
          {missingWorkflow > 0 && (
            <span className="text-high-700">
              <span className="font-semibold">{missingWorkflow}</span> missing workflow
            </span>
          )}
        </div>

        {/* Table */}
        <SmartTable
          data={filtered as unknown as Record<string, unknown>[]}
          keyField="id"
          searchPlaceholder="Search controls by ID, name, or process..."
          searchKeys={['controlId', 'name', 'businessProcess']}
          pageSize={10}
          emptyMessage={
            controls.length === 0
              ? 'No controls yet. Create your first reusable control.'
              : 'No controls match your filters.'
          }
          onRowClick={(item) => {
            const ctrl = item as unknown as ControlRow;
            setSelectedControlId(ctrl.id);
          }}
          headerExtra={
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={bpFilter}
                onChange={e => setBpFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] text-text-secondary outline-none focus:border-primary/40 cursor-pointer"
              >
                <option value="all">All Processes</option>
                <option value="P2P">P2P</option>
                <option value="O2C">O2C</option>
                <option value="R2R">R2R</option>
                <option value="ITGC">ITGC</option>
                <option value="S2C">S2C</option>
              </select>
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] text-text-secondary outline-none focus:border-primary/40 cursor-pointer"
              >
                <option value="all">All Classifications</option>
                <option value="Key">Key</option>
                <option value="Non-Key">Non-Key</option>
              </select>
              <select
                value={automationFilter}
                onChange={e => setAutomationFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] text-text-secondary outline-none focus:border-primary/40 cursor-pointer"
              >
                <option value="all">All Automation</option>
                <option value="Manual">Manual</option>
                <option value="IT-dependent">IT-dependent</option>
                <option value="Automated">Automated</option>
              </select>
              <select
                value={workflowStatusFilter}
                onChange={e => setWorkflowStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] text-text-secondary outline-none focus:border-primary/40 cursor-pointer"
              >
                <option value="all">All Workflow Status</option>
                <option value="linked">Workflow Mapped</option>
                <option value="missing">Workflow Missing</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 rounded-lg text-[0.75rem] text-primary font-semibold hover:bg-primary-xlight cursor-pointer transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          }
          columns={[
            {
              key: 'controlId',
              label: 'Control ID',
              width: '90px',
              render: (item) => (
                <span className="font-mono text-text-muted text-[0.75rem]">{String(item.controlId)}</span>
              ),
            },
            {
              key: 'name',
              label: 'Control Name',
              render: (item) => (
                <div className="text-text font-medium text-[0.75rem]">{String(item.name)}</div>
              ),
            },
            {
              key: 'businessProcess',
              label: 'Business Process',
              width: '110px',
              render: (item) => {
                const bp = String(item.businessProcess);
                return (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BP_COLORS[bp] || '#888' }} />
                    <span className="text-text-secondary text-[0.75rem] font-medium">{bp}</span>
                  </span>
                );
              },
            },
            {
              key: 'classification',
              label: 'Key / Non-Key',
              width: '100px',
              align: 'center',
              render: (item) => {
                const ctrl = item as unknown as ControlRow;
                if (ctrl.classification === 'Key') {
                  return (
                    <span className="inline-flex items-center gap-1 bg-mitigated-50 text-mitigated-700 px-2 py-0.5 rounded text-[0.75rem] font-semibold">
                      <Star size={10} className="fill-mitigated text-mitigated" />
                      Key
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center bg-gray-50 text-gray-500 px-2 py-0.5 rounded text-[0.75rem] font-medium">
                    Non-Key
                  </span>
                );
              },
            },
            {
              key: 'nature',
              label: 'Nature',
              width: '100px',
              render: (item) => {
                const ctrl = item as unknown as ControlRow;
                const s = NATURE_STYLES[ctrl.nature];
                return (
                  <span className={`inline-flex items-center ${s.bg} ${s.text} px-2.5 py-0.5 rounded text-[0.75rem] font-bold whitespace-nowrap`}>
                    {ctrl.nature}
                  </span>
                );
              },
            },
            {
              key: 'automation',
              label: 'Automation',
              width: '110px',
              render: (item) => {
                const ctrl = item as unknown as ControlRow;
                const s = AUTOMATION_STYLES[ctrl.automation];
                return (
                  <span className={`inline-flex items-center ${s.bg} ${s.text} px-2.5 py-0.5 rounded text-[0.75rem] font-bold whitespace-nowrap`}>
                    {ctrl.automation}
                  </span>
                );
              },
            },
            {
              key: 'linkedWorkflows',
              label: 'Linked Workflows',
              width: '130px',
              render: (item) => {
                const ctrl = item as unknown as ControlRow;
                if (ctrl.linkedWorkflows.length === 0) {
                  return (
                    <span className="inline-flex items-center gap-1 text-risk-700 text-[0.75rem] font-medium">
                      <AlertTriangle size={11} />
                      None
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 text-evidence-700 text-[0.75rem] font-medium">
                    <Link2 size={11} />
                    {ctrl.linkedWorkflows.length} linked
                  </span>
                );
              },
            },
            {
              key: 'usedInRACMs',
              label: 'Used in RACMs',
              width: '100px',
              align: 'center',
              render: (item) => {
                const ctrl = item as unknown as ControlRow;
                if (ctrl.usedInRACMs === 0) {
                  return <span className="text-[0.75rem] text-text-muted">&mdash;</span>;
                }
                return (
                  <span className="text-[0.75rem] text-text-secondary font-medium">{ctrl.usedInRACMs} RACM{ctrl.usedInRACMs !== 1 ? 's' : ''}</span>
                );
              },
            },
            {
              key: 'status',
              label: 'Status',
              width: '130px',
              render: (item) => {
                const ctrl = item as unknown as ControlRow;
                const s = STATUS_STYLES[ctrl.status] || STATUS_STYLES['Draft'];
                return (
                  <span className={`inline-flex items-center gap-1.5 ${s.bg} ${s.text} px-2.5 py-0.5 rounded-full text-[0.75rem] font-semibold whitespace-nowrap`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {ctrl.status}
                  </span>
                );
              },
            },
            {
              key: 'actions',
              label: 'Action',
              width: '150px',
              sortable: false,
              align: 'center',
              render: (item) => {
                const ctrl = item as unknown as ControlRow;
                return (
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedControlId(ctrl.id); }}
                      title="View Control"
                      className="p-1.5 rounded-md hover:bg-gray-100 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      <Eye size={13} />
                    </button>
                    {can('ctrl_share') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openShare({ type: 'control', id: ctrl.id, anchor: rectFromEvent(e) }); }}
                        title="Share Control"
                        className="p-1.5 rounded-md hover:bg-gray-100 text-text-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        <Share2 size={13} />
                      </button>
                    )}
                    {can('ctrl_edit') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); addToast({ message: `Editing ${ctrl.name}`, type: 'info' }); }}
                        title="Edit Control"
                        className="p-1.5 rounded-md hover:bg-gray-100 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {can('ctrl_link') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setLinkWfControlId(ctrl.id); }}
                        title="Link Workflow"
                        className="p-1.5 rounded-md hover:bg-gray-100 text-text-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        <Workflow size={13} />
                      </button>
                    )}
                    {can('ctrl_delete') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); addToast({ message: `Deleted ${ctrl.name}`, type: 'success' }); }}
                        title="Delete Control"
                        className="p-1.5 rounded-md hover:bg-risk-50 text-text-muted hover:text-risk-700 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
          expandable={(item) => {
            const ctrl = item as unknown as ControlRow;
            return (
              <div className="flex items-start gap-8 text-[0.75rem]">
                <div>
                  <span className="font-semibold text-text">Business Process:</span>
                  <span className="text-text-secondary ml-1.5">{ctrl.businessProcess}</span>
                </div>
                <div>
                  <span className="font-semibold text-text">Nature:</span>
                  <span className="text-text-secondary ml-1.5">{ctrl.nature}</span>
                </div>
                <div>
                  <span className="font-semibold text-text">Automation:</span>
                  <span className="text-text-secondary ml-1.5">{ctrl.automation}</span>
                </div>
                {ctrl.linkedWorkflows.length > 0 && (
                  <div>
                    <span className="font-semibold text-text">Workflows:</span>
                    <span className="text-text-secondary ml-1.5">{ctrl.linkedWorkflows.join(', ')}</span>
                  </div>
                )}
              </div>
            );
          }}
        />

        {/* AI Footer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary-xlight/60 via-white to-primary-xlight/30 p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Sparkles size={14} className="text-primary" />
              </div>
              <div>
                <h3 className="text-[0.8125rem] font-semibold text-text">AI Control Recommendations</h3>
                <p className="text-[0.75rem] text-text-muted mt-0.5">
                  {missingWorkflow} control{missingWorkflow !== 1 ? 's' : ''} need workflow linkage. AI can suggest matching workflows from the Workflow Library.
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => addToast({ message: 'AI is analyzing controls for workflow recommendations...', type: 'info' })}
                className="flex items-center gap-1.5 text-[0.75rem] text-primary font-semibold hover:underline cursor-pointer"
              >
                Auto-suggest workflows
                <ArrowRight size={10} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Create Control Drawer */}
      <AnimatePresence>
        {showCreateDrawer && (
          <CreateControlDrawer
            onClose={() => setShowCreateDrawer(false)}
            onSave={handleCreateControl}
            defaultProcess={processFilter}
          />
        )}
      </AnimatePresence>

      {/* Link Workflow to Control — per-row action; links a workflow onto the control object */}
      <AnimatePresence>
        {linkWfControlId && (() => {
          const ctrl = controls.find(c => c.id === linkWfControlId);
          if (!ctrl) return null;
          return (
            <LinkWorkflowToControlDrawer
              control={{ name: ctrl.name, description: ctrl.description, isKey: ctrl.classification === 'Key', workflows: [] }}
              onClose={() => setLinkWfControlId(null)}
              onLink={(wf: ControlWorkflow) => {
                setControls(prev => prev.map(c => c.id === ctrl.id
                  ? {
                      ...c,
                      linkedWorkflows: c.linkedWorkflows.includes(wf.name) ? c.linkedWorkflows : [...c.linkedWorkflows, wf.name],
                      linkedWorkflowIds: c.linkedWorkflowIds.includes(wf.id) ? c.linkedWorkflowIds : [...c.linkedWorkflowIds, wf.id],
                    }
                  : c));
                addToast({ message: `Linked "${wf.name}" to ${ctrl.controlId}`, type: 'success' });
                setLinkWfControlId(null);
              }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
