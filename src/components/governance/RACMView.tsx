import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  Plus,
  Download,
  Filter,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Link2,
  Unlink,
  Workflow,
  Shield,
} from 'lucide-react';
import SmartTable from '../shared/SmartTable';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';

interface Props {
  /* no external props needed */
}

interface RACMRow {
  id: string;
  name: string;
  process: string;
  processAbbr: string;
  version: string;
  status: 'Active' | 'In Mapping' | 'Draft';
  risks: number;
  controlsMapped: number;
  completeness: number;
  lastUpdated: string;
}

const MOCK_RACMS: RACMRow[] = [
  { id: 'RACM-001', name: 'Order to Cash 2026', process: 'Order to Cash', processAbbr: 'O2C', version: 'v2.1', status: 'Active', risks: 15, controlsMapped: 42, completeness: 87, lastUpdated: 'Mar 28, 2026' },
  { id: 'RACM-002', name: 'Procure to Pay 2026', process: 'Procure to Pay', processAbbr: 'P2P', version: 'v3.0', status: 'Active', risks: 22, controlsMapped: 58, completeness: 92, lastUpdated: 'Mar 25, 2026' },
  { id: 'RACM-003', name: 'Financial Reporting', process: 'Record to Report', processAbbr: 'R2R', version: 'v1.2', status: 'In Mapping', risks: 8, controlsMapped: 12, completeness: 45, lastUpdated: 'Mar 20, 2026' },
  { id: 'RACM-004', name: 'IT General Controls', process: 'IT General Controls', processAbbr: 'ITGC', version: 'v1.0', status: 'Draft', risks: 5, controlsMapped: 0, completeness: 0, lastUpdated: 'Mar 15, 2026' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Active: { bg: 'bg-success-bg', text: 'text-compliant-700', dot: 'bg-success' },
  'In Mapping': { bg: 'bg-warning-bg', text: 'text-mitigated-700', dot: 'bg-warning' },
  Draft: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

/* ─── Mock hierarchy data for Risks tab ─── */
const RISK_HIERARCHY = [
  {
    id: 'RSK-001', name: 'Unauthorized payments processed', severity: 'critical' as const,
    controls: [
      {
        id: 'CTL-001', name: 'Payment approval workflow', linked: true,
        workflows: [
          { id: 'WF-001', name: 'Dual-approval payment check', linked: true },
          { id: 'WF-002', name: 'Bank account verification', linked: true },
        ],
      },
      {
        id: 'CTL-002', name: 'Segregation of duties — AP', linked: true,
        workflows: [
          { id: 'WF-003', name: 'SOD conflict scanner', linked: true },
        ],
      },
    ],
  },
  {
    id: 'RSK-002', name: 'Vendor master data manipulation', severity: 'high' as const,
    controls: [
      {
        id: 'CTL-003', name: 'Vendor change monitoring', linked: true,
        workflows: [
          { id: 'WF-004', name: 'Real-time vendor change alert', linked: true },
        ],
      },
      {
        id: 'CTL-004', name: 'Vendor onboarding review', linked: false,
        workflows: [],
      },
    ],
  },
  {
    id: 'RSK-003', name: 'Duplicate invoice processing', severity: 'medium' as const,
    controls: [
      {
        id: 'CTL-005', name: '3-way match automation', linked: true,
        workflows: [
          { id: 'WF-005', name: 'Duplicate invoice detector', linked: true },
          { id: 'WF-006', name: 'Invoice aging reconciler', linked: false },
        ],
      },
    ],
  },
];

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-risk-50', text: 'text-risk-700' },
  high: { bg: 'bg-high-50', text: 'text-high-700' },
  medium: { bg: 'bg-mitigated-50', text: 'text-mitigated-700' },
  low: { bg: 'bg-compliant-50', text: 'text-compliant-700' },
};

/* ─── 3-Level Risk Hierarchy Component ─── */
function RiskHierarchy() {
  const { addToast } = useToast();
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());

  const toggleRisk = (id: string) => {
    setExpandedRisks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleControl = (id: string) => {
    setExpandedControls(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {RISK_HIERARCHY.map((risk) => {
        const sev = SEVERITY_STYLES[risk.severity];
        const isExpanded = expandedRisks.has(risk.id);
        return (
          <div key={risk.id} className="bg-white rounded-xl border border-border-light overflow-hidden">
            {/* Level 1: Risk */}
            <button
              onClick={() => toggleRisk(risk.id)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <div className="shrink-0">
                {isExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
              </div>
              <div className="p-1.5 rounded-lg bg-risk-50 text-risk shrink-0">
                <AlertTriangle size={14} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[0.8125rem] font-semibold text-text">{risk.name}</div>
                <div className="text-[0.75rem] text-text-muted mt-0.5">{risk.id} · {risk.controls.length} controls linked</div>
              </div>
              <span className={`inline-flex items-center ${sev.bg} ${sev.text} px-2.5 py-0.5 rounded-full text-[0.75rem] font-bold uppercase`}>
                {risk.severity}
              </span>
            </button>

            {/* Level 2: Controls */}
            {isExpanded && (
              <div className="border-t border-border-light bg-surface-2/30">
                {risk.controls.map((control) => {
                  const ctlExpanded = expandedControls.has(control.id);
                  return (
                    <div key={control.id}>
                      <div className="flex items-center gap-3 px-4 pl-12 py-3 hover:bg-surface-2 transition-colors">
                        <button onClick={() => toggleControl(control.id)} className="shrink-0 cursor-pointer">
                          {ctlExpanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
                        </button>
                        <div className="p-1 rounded-md bg-evidence-50 text-evidence shrink-0">
                          <Shield size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.75rem] font-medium text-text">{control.name}</div>
                          <div className="text-[0.75rem] text-text-muted">{control.id} · {control.workflows.length} workflows</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToast({ message: control.linked ? `Unlinked ${control.id}` : `Linked ${control.id}`, type: 'info' });
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer ${
                            control.linked
                              ? 'bg-risk-50 text-risk-700 hover:bg-risk-50'
                              : 'bg-compliant-50 text-compliant hover:bg-compliant-50'
                          }`}
                        >
                          {control.linked ? <><Unlink size={10} /> Unlink</> : <><Link2 size={10} /> Link</>}
                        </button>
                      </div>

                      {/* Level 3: Workflows/Checks */}
                      {ctlExpanded && control.workflows.length > 0 && (
                        <div className="bg-surface-2/50">
                          {control.workflows.map((wf) => (
                            <div key={wf.id} className="flex items-center gap-3 px-4 pl-20 py-2.5 hover:bg-surface-2 transition-colors">
                              <div className="p-1 rounded-md bg-compliant-50 text-compliant shrink-0">
                                <Workflow size={11} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[0.75rem] font-medium text-text">{wf.name}</div>
                                <div className="text-[0.75rem] text-text-muted">{wf.id}</div>
                              </div>
                              <button
                                onClick={() => addToast({ message: wf.linked ? `Unlinked ${wf.id}` : `Linked ${wf.id}`, type: 'info' })}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer ${
                                  wf.linked
                                    ? 'bg-risk-50 text-risk-700 hover:bg-risk-50'
                                    : 'bg-compliant-50 text-compliant hover:bg-compliant-50'
                                }`}
                              >
                                {wf.linked ? <><Unlink size={9} /> Unlink</> : <><Link2 size={9} /> Link</>}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RACMView({}: Props) {
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = MOCK_RACMS.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    Active: MOCK_RACMS.filter(r => r.status === 'Active').length,
    'In Mapping': MOCK_RACMS.filter(r => r.status === 'In Mapping').length,
    Draft: MOCK_RACMS.filter(r => r.status === 'Draft').length,
  };

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.09} rotateOnHover hue={275} opacity={0.08} />
      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Risk & Control Matrices</h1>
            <p className="text-sm text-text-secondary mt-1">Manage RACMs across all business processes.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => addToast({ message: 'New RACM template created', type: 'info' })}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text-secondary hover:bg-white transition-colors cursor-pointer"
            >
              <Plus size={14} />
              Create RACM
            </button>
            <button
              onClick={() => addToast({ message: 'AI is analyzing your processes to generate a RACM...', type: 'info' })}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-medium hover:from-primary-hover hover:to-primary text-white rounded-lg text-[0.8125rem] font-semibold transition-all cursor-pointer"
            >
              <Sparkles size={14} />
              Generate with AI
            </button>
          </div>
        </div>

        {/* AI Insight */}
        <div className="bg-gradient-to-r from-primary-xlight via-white to-primary-xlight rounded-2xl border border-primary/10 p-4 mb-6 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-medium flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[0.75rem] font-semibold text-text">RACM Coverage Analysis</div>
            <div className="text-[0.75rem] text-text-secondary mt-0.5">
              2 RACMs have incomplete control mappings. IT General Controls has 5 unmapped risks requiring attention.
              <span className="text-primary font-semibold cursor-pointer hover:underline ml-1">Auto-map controls</span>
            </div>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-3 mb-6">
          {Object.entries(counts).map(([status, count], i) => {
            const style = STATUS_STYLES[status];
            return (
              <motion.button
                key={status}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${
                  statusFilter === status
                    ? `${style.bg} border-current ring-2 ring-offset-1 ring-current ${style.text}`
                    : `${style.bg} border-transparent hover:shadow-sm ${style.text}`
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className="text-[0.75rem] font-semibold">{status}: {count}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Table */}
        <SmartTable
          data={filtered as unknown as Record<string, unknown>[]}
          keyField="id"
          searchPlaceholder="Search RACMs..."
          searchKeys={['name', 'processAbbr', 'id']}
          pageSize={10}
          headerExtra={
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] text-text-secondary outline-none focus:border-primary/40 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="In Mapping">In Mapping</option>
                <option value="Draft">Draft</option>
              </select>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] text-text-secondary hover:bg-surface-2 cursor-pointer transition-colors">
                <Filter size={12} />
                Filters
              </button>
            </div>
          }
          expandable={(item) => {
            const racm = item as unknown as RACMRow;
            return (
              <div className="space-y-3">
                {/* RACM metadata — always visible */}
                <div className="flex items-center gap-6 pb-3 border-b border-border-light">
                  <div className="text-[0.75rem] text-text-secondary leading-relaxed flex-1">
                    <span className="font-semibold text-text">Process: </span>{racm.process}
                    <span className="text-text-muted ml-3">Version {racm.version}</span>
                    <span className="text-text-muted ml-3">Last updated: {racm.lastUpdated}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); addToast({ message: `Exporting ${racm.name}...`, type: 'info' }); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-text-secondary text-[0.75rem] font-semibold rounded-lg cursor-pointer"
                    >
                      <Download size={12} />
                      Export
                    </button>
                  </div>
                </div>
                {/* Risk → Control → Workflow hierarchy */}
                <div>
                  <div className="text-[0.75rem] font-bold text-text-muted mb-2">Risk Hierarchy</div>
                  <RiskHierarchy />
                </div>
              </div>
            );
          }}
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (item) => {
                const racm = item as unknown as RACMRow;
                return (
                  <div>
                    <div className="text-text font-medium">{racm.name}</div>
                    <div className="text-[0.75rem] text-text-muted mt-0.5">Updated {racm.lastUpdated}</div>
                  </div>
                );
              },
            },
            {
              key: 'processAbbr',
              label: 'Process',
              width: '80px',
              render: (item) => {
                const racm = item as unknown as RACMRow;
                const processColors: Record<string, string> = { O2C: '#6a12cd', P2P: '#0284c7', R2R: '#d97706', ITGC: '#16a34a' };
                return (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: processColors[racm.processAbbr] || '#888' }} />
                    <span className="text-text-secondary text-[0.75rem] font-medium">{racm.processAbbr}</span>
                  </span>
                );
              },
            },
            {
              key: 'version',
              label: 'Version',
              width: '70px',
              render: (item) => (
                <span className="text-[0.75rem] font-mono text-text-muted">{String(item.version)}</span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              width: '110px',
              render: (item) => {
                const racm = item as unknown as RACMRow;
                const s = STATUS_STYLES[racm.status];
                return (
                  <span className={`inline-flex items-center gap-1.5 ${s.bg} ${s.text} px-2.5 py-0.5 rounded-full text-[0.75rem] font-semibold whitespace-nowrap`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {racm.status}
                  </span>
                );
              },
            },
            {
              key: 'risks',
              label: 'Risks',
              width: '70px',
              align: 'center',
              render: (item) => (
                <span className="text-[0.75rem] font-semibold text-text">{String(item.risks)}</span>
              ),
            },
            {
              key: 'controlsMapped',
              label: 'Controls Mapped',
              width: '120px',
              align: 'center',
              render: (item) => (
                <span className="text-[0.75rem] font-semibold text-text">{String(item.controlsMapped)}</span>
              ),
            },
            {
              key: 'completeness',
              label: 'Completeness',
              width: '140px',
              render: (item) => {
                const racm = item as unknown as RACMRow;
                const pct = racm.completeness;
                const barColor = pct >= 80 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-gray-300';
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[0.75rem] font-semibold text-text-secondary w-8 text-right">{pct}%</span>
                  </div>
                );
              },
            },
            {
              key: 'warnings',
              label: '',
              width: '90px',
              sortable: false,
              align: 'center',
              render: (item) => {
                const racm = item as unknown as RACMRow;
                if (racm.completeness >= 100) return null;
                return (
                  <span className="inline-flex items-center gap-1 bg-mitigated-50 text-mitigated-700 px-2 py-0.5 rounded text-[0.75rem] font-semibold whitespace-nowrap">
                    <AlertTriangle size={10} />
                    Missing
                  </span>
                );
              },
            },
          ]}
        />

        {/* AI Recommendation Footer */}
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
                <h3 className="text-[0.8125rem] font-semibold text-text">AI Mapping Suggestions</h3>
                <p className="text-[0.75rem] text-text-muted mt-0.5">2 RACMs have unmapped risks that AI can resolve automatically</p>
              </div>
            </div>
            <div className="flex justify-center">
              <button className="flex items-center gap-1.5 text-[0.75rem] text-primary font-semibold hover:underline cursor-pointer">
                View suggestions
                <ArrowRight size={10} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
