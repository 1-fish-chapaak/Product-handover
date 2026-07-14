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
import { useAuditLog } from '../../context/AdminDataContext';
import { WORKFLOWS } from '../../data/mockData';
import CreateControlDrawer, { type NewControlData } from './CreateControlDrawer';
import { useCreatedControls } from '../../data/createdControlsStore';
import ControlDetailView from './ControlDetailView';
import { LinkWorkflowToControlDrawer, type ControlWorkflow } from '../audit/RacmMappingWorkspace';
import {
  type ControlRow,
  BP_COLORS, AUTOMATION_STYLES, NATURE_STYLES, STATUS_STYLES,
} from './controlTypes';
import { CONTROL_LIBRARY } from '../../data/controlLibrary';


/* ─── Component ─── */

interface ControlLibraryProps {
  /** When set, filters controls to this process and pre-fills create drawer */
  processFilter?: string;
}

export default function ControlLibraryView({ processFilter }: ControlLibraryProps) {
  const { addToast } = useToast();
  const { can } = useCan();
  const { openShare } = useShare();
  const logEvent = useAuditLog();

  // Stateful controls list
  const [controls, setControls] = useState<ControlRow[]>(CONTROL_LIBRARY);

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
    logEvent({ action: 'Create', description: `Created control "${data.name}" (${controlId})`, module: 'Control Library', entity: 'Control' });

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
                onClick={() => {
                  addToast({ message: 'Control library exported as CSV', type: 'success' });
                  logEvent({ action: 'Export', description: `Exported the control library (${totalControls} controls) as CSV`, module: 'Control Library', entity: 'Control' });
                }}
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
                  <span className="inline-flex items-center bg-canvas text-ink-500 px-2 py-0.5 rounded text-[0.75rem] font-medium">
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
                      className="p-1.5 rounded-md hover:bg-canvas text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      <Eye size={13} />
                    </button>
                    {can('ctrl_share') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openShare({ type: 'control', id: ctrl.id, anchor: rectFromEvent(e) }); }}
                        title="Share Control"
                        className="p-1.5 rounded-md hover:bg-canvas text-text-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        <Share2 size={13} />
                      </button>
                    )}
                    {can('ctrl_edit') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToast({ message: `Editing ${ctrl.name}`, type: 'info' });
                          logEvent({ action: 'Update', description: `Edited control "${ctrl.name}" (${ctrl.controlId})`, module: 'Control Library', entity: 'Control' });
                        }}
                        title="Edit Control"
                        className="p-1.5 rounded-md hover:bg-canvas text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {can('ctrl_link') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setLinkWfControlId(ctrl.id); }}
                        title="Link Workflow"
                        className="p-1.5 rounded-md hover:bg-canvas text-text-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        <Workflow size={13} />
                      </button>
                    )}
                    {can('ctrl_delete') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToast({ message: `Deleted ${ctrl.name}`, type: 'success' });
                          logEvent({ action: 'Delete', description: `Deleted control "${ctrl.name}" (${ctrl.controlId})`, module: 'Control Library', entity: 'Control' });
                        }}
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
                logEvent({ action: 'Update', description: `Linked workflow "${wf.name}" to control "${ctrl.name}" (${ctrl.controlId})`, module: 'Control Library', entity: 'Control' });
                setLinkWfControlId(null);
              }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
