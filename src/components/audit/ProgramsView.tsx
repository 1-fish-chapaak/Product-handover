import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Calendar, Layers, Search, ArrowLeft,
  ChevronRight, Plus, X, Trash2,
  FileText, Shield, AlertTriangle, Workflow, Zap,
  Upload, CheckCircle2, User, Clock,
} from 'lucide-react';
import { BUSINESS_PROCESSES, RACMS } from '../../data/mockData';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubProcess { name: string; description: string; }

interface BPItem {
  id: string; name: string; abbr: string; color: string;
  risks: number; controls: number; coverage: number; sops: number; workflows: number;
  status?: 'Draft' | 'Active' | 'Archived';
  // Extended fields for user-created processes
  department?: string;
  owner?: string;
  fy?: string;
  description?: string;
  subProcesses?: SubProcess[];
}

interface Props {
  selectedBPId: string | null;
  onSelectBP: (id: string | null) => void;
  onNavigateToExecution?: (engagementId: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const NEW_COLORS = ['#0891b2', '#c026d3', '#ea580c', '#4f46e5', '#16a34a', '#9333ea', '#e11d48', '#0d9488'];
const DEPARTMENTS = ['Finance', 'Procurement', 'Sales', 'HR', 'IT', 'Operations', 'Legal & Compliance', 'Other'];
const OWNERS = ['Tushar Goel', 'Deepak Bansal', 'Neha Joshi', 'Karan Mehta', 'Sneha Desai', 'Rohan Patel', 'Priya Singh'];
const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1.5';

function racmsForProcess(bpId: string) { return RACMS.filter(r => r.bpId === bpId).length; }

// IDs from the original seed data
const SEED_IDS = new Set(BUSINESS_PROCESSES.map(bp => bp.id));

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProgramsView({ onSelectBP }: Props) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [processes, setProcesses] = useState<BPItem[]>(
    BUSINESS_PROCESSES.map(bp => ({ ...bp, status: 'Active' as const }))
  );
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  const q = search.toLowerCase();
  const filteredProcesses = processes.filter(bp =>
    !q || bp.name.toLowerCase().includes(q) || bp.abbr.toLowerCase().includes(q)
  );

  const selectedProcess = selectedProcessId ? processes.find(p => p.id === selectedProcessId) : null;

  const handleCreateProcess = (newBP: BPItem) => {
    setProcesses(prev => [...prev, newBP]);
    setShowCreateDrawer(false);
    addToast({ message: `"${newBP.name}" (${newBP.abbr}) created as Draft`, type: 'success' });
    // Navigate to the new process detail
    setSelectedProcessId(newBP.id);
  };

  const handleProcessClick = (bp: BPItem) => {
    if (SEED_IDS.has(bp.id)) {
      // Existing seed process → use global route (renders BusinessProcesses detail)
      onSelectBP(bp.id);
    } else {
      // User-created process → local detail view
      setSelectedProcessId(bp.id);
    }
  };

  // If a local process detail is open, render it
  if (selectedProcess && !SEED_IDS.has(selectedProcess.id)) {
    return (
      <ProcessDetailView
        process={selectedProcess}
        onBack={() => setSelectedProcessId(null)}
        onUpdate={(updated) => setProcesses(prev => prev.map(p => p.id === updated.id ? updated : p))}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-medium text-white"><Layers size={16} /></div>
              <h1 className="text-xl font-bold text-text">Process Hub</h1>
            </div>
            <p className="text-sm text-text-secondary mt-1 ml-9">Manage business processes and their RACMs. Engagements live under the dedicated <strong className="text-text-secondary">Engagements</strong> entry in the sidebar.</p>
          </div>
        </div>

        {/* Toolbar — Search + New Process */}
        <div className="flex items-center justify-end gap-3 mb-5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Search processes..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-[0.75rem] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 transition-colors w-48" />
          </div>
          <button onClick={() => setShowCreateDrawer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer shrink-0">
            <Plus size={14} />New Process
          </button>
        </div>

        {/* ── Process Grid ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          {filteredProcesses.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center"><Building2 size={32} className="text-text-muted mx-auto mb-3" /><p className="text-[0.875rem] font-semibold text-text mb-1">No processes found</p><p className="text-[0.75rem] text-text-muted">Try adjusting your search.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProcesses.map((bp, i) => (
                <motion.div key={bp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}
                  onClick={() => handleProcessClick(bp)} className="glass-card rounded-2xl p-5 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[0.8125rem] font-bold" style={{ background: bp.color }}>{bp.abbr}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[0.875rem] font-semibold text-text">{bp.name}</span>
                          {bp.status === 'Draft' && <span className="px-1.5 h-4 rounded text-[0.5625rem] font-bold bg-gray-100 text-gray-500">Draft</span>}
                        </div>
                        <div className="text-[0.6875rem] text-text-muted">{bp.abbr}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-text-muted group-hover:text-primary transition-colors" />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[{ label: 'Risks', value: bp.risks }, { label: 'Controls', value: bp.controls }, { label: 'RACMs', value: racmsForProcess(bp.id) }].map(m => (
                      <div key={m.label} className="text-center"><div className="text-[0.9375rem] font-bold text-text">{m.value}</div><div className="text-[0.625rem] text-text-muted">{m.label}</div></div>
                    ))}
                    <div className="text-center">
                      <div className={`text-[0.9375rem] font-bold ${bp.coverage >= 70 ? 'text-compliant-700' : bp.coverage >= 50 ? 'text-mitigated-700' : bp.coverage > 0 ? 'text-risk-700' : 'text-text-muted'}`}>{bp.coverage}%</div>
                      <div className="text-[0.625rem] text-text-muted">Coverage</div>
                    </div>
                  </div>
                  <div className="mt-3"><div className="h-1.5 bg-surface-3 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${bp.coverage}%`, background: bp.color }} /></div></div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create drawer */}
      <AnimatePresence>
        {showCreateDrawer && (
          <CreateProcessDrawer
            existingCodes={processes.map(p => p.abbr)}
            onClose={() => setShowCreateDrawer(false)}
            onCreate={handleCreateProcess}
            colorIndex={processes.length}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Process Detail View (for user-created processes)
// ═════════════════════════════════════════════════════════════════════════════

type DetailTab = 'overview' | 'sops' | 'racms' | 'risks' | 'controls' | 'workflows' | 'engagements';

interface MockSOP { id: string; name: string; version: string; uploadedBy: string; uploadedAt: string; status: 'processed' | 'processing'; }
interface MockRACM { id: string; name: string; fw: string; status: 'active' | 'draft'; risks: number; controls: number; }
interface MockRisk { id: string; name: string; severity: string; controls: number; status: string; }
interface MockControl { id: string; name: string; nature: string; automation: string; isKey: boolean; }
interface MockWF { id: string; name: string; type: string; steps: number; status: string; }
interface MockEng { id: string; name: string; auditType: string; status: string; controls: number; }

function ProcessDetailView({ process, onBack, onUpdate }: {
  process: BPItem;
  onBack: () => void;
  onUpdate: (updated: BPItem) => void;
}) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Local mock state for each entity
  const [sops, setSops] = useState<MockSOP[]>([]);
  const [racms, setRacms] = useState<MockRACM[]>([]);
  const [risks, setRisks] = useState<MockRisk[]>([]);
  const [controls, setControls] = useState<MockControl[]>([]);
  const [wfs, setWfs] = useState<MockWF[]>([]);
  const [engs, setEngs] = useState<MockEng[]>([]);

  const bp = process;
  const statusCls = bp.status === 'Active' ? 'bg-compliant-50 text-compliant-700' : bp.status === 'Archived' ? 'bg-gray-100 text-gray-600' : 'bg-draft-50 text-draft-700';

  // Coverage: risks with at least one key control / total risks
  const coveredRisks = risks.filter(r => r.controls > 0).length;
  const coverage = risks.length > 0 ? Math.round((coveredRisks / risks.length) * 100) : 0;

  const kpis = [
    { label: 'SOPs', value: sops.length, icon: Upload },
    { label: 'RACMs', value: racms.length, icon: FileText },
    { label: 'Risks', value: risks.length, icon: AlertTriangle },
    { label: 'Controls', value: controls.length, icon: Shield },
    { label: 'Workflows', value: wfs.length, icon: Workflow },
    { label: 'Engagements', value: engs.length, icon: Calendar },
  ];

  const tabs: { id: DetailTab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'overview', label: 'Overview', icon: Building2, count: 0 },
    { id: 'sops', label: 'SOPs', icon: Upload, count: sops.length },
    { id: 'racms', label: 'RACMs', icon: FileText, count: racms.length },
    { id: 'risks', label: 'Risks', icon: AlertTriangle, count: risks.length },
    { id: 'controls', label: 'Controls', icon: Shield, count: controls.length },
    { id: 'workflows', label: 'Workflows', icon: Workflow, count: wfs.length },
    { id: 'engagements', label: 'Engagements', icon: Calendar, count: engs.length },
  ];

  const checklist = [
    { key: 'sop', label: 'Upload SOP', desc: 'Upload a Standard Operating Procedure to help generate risks, controls, and RACM.', done: sops.length > 0, cta: 'Upload SOP', tab: 'sops' as DetailTab, icon: Upload },
    { key: 'racm', label: 'Create RACM', desc: 'Create a Risk and Control Matrix to map risks and controls for this process.', done: racms.length > 0, cta: 'Create RACM', tab: 'racms' as DetailTab, icon: FileText },
    { key: 'risks', label: 'Add Risks', desc: 'Identify and document risks relevant to this business process.', done: risks.length > 0, cta: 'Add Risk', tab: 'risks' as DetailTab, icon: AlertTriangle },
    { key: 'controls', label: 'Map Controls', desc: 'Map mitigating controls from the Control Library to this process.', done: controls.length > 0, cta: 'Map Control', tab: 'controls' as DetailTab, icon: Shield },
    { key: 'workflows', label: 'Link Workflows', desc: 'Link test workflows to define how controls will be tested.', done: wfs.length > 0, cta: 'Link Workflow', tab: 'workflows' as DetailTab, icon: Workflow },
    { key: 'engagement', label: 'Create Engagement', desc: 'Create an engagement when you are ready to execute testing.', done: engs.length > 0, cta: 'Create Engagement', tab: 'engagements' as DetailTab, icon: Zap },
  ];
  const completedCount = checklist.filter(c => c.done).length;

  // Demo actions — add mock items
  const handleUploadSOP = () => {
    const sop: MockSOP = { id: `sop-${Date.now()}`, name: `${bp.name} SOP`, version: 'v1.0', uploadedBy: bp.owner || 'System', uploadedAt: 'Apr 26, 2026', status: 'processed' };
    setSops(prev => [...prev, sop]);
    addToast({ message: `SOP "${sop.name}" uploaded and processed`, type: 'success' });
  };

  const handleCreateRACM = () => {
    const racm: MockRACM = { id: `racm-${Date.now()}`, name: `${bp.abbr} RACM FY26`, fw: 'SOX ICFR', status: 'draft', risks: 0, controls: 0 };
    setRacms(prev => [...prev, racm]);
    addToast({ message: `RACM "${racm.name}" created as Draft`, type: 'success' });
  };

  const handleAddRisk = () => {
    const idx = risks.length + 1;
    const r: MockRisk = { id: `rsk-${Date.now()}`, name: `${bp.abbr} Risk ${idx}`, severity: ['high', 'medium', 'critical'][idx % 3], controls: 0, status: 'open' };
    setRisks(prev => [...prev, r]);
    addToast({ message: `Risk "${r.name}" added`, type: 'success' });
  };

  const handleMapControl = () => {
    const idx = controls.length + 1;
    const c: MockControl = { id: `ctl-${Date.now()}`, name: `${bp.abbr} Control ${idx}`, nature: ['Preventive', 'Detective'][idx % 2], automation: ['Manual', 'Automated'][idx % 2], isKey: idx <= 2 };
    setControls(prev => [...prev, c]);
    // Update risk control counts
    if (risks.length > 0) {
      setRisks(prev => prev.map((r, i) => i === (idx - 1) % prev.length ? { ...r, controls: r.controls + 1 } : r));
    }
    addToast({ message: `Control "${c.name}" mapped`, type: 'success' });
  };

  const handleLinkWorkflow = () => {
    const idx = wfs.length + 1;
    const w: MockWF = { id: `wf-${Date.now()}`, name: `${bp.abbr} Test Workflow ${idx}`, type: ['Detection', 'Compliance', 'Monitoring'][idx % 3], steps: 4 + idx, status: 'active' };
    setWfs(prev => [...prev, w]);
    addToast({ message: `Workflow "${w.name}" linked`, type: 'success' });
  };

  const handleCreateEngagement = () => {
    const e: MockEng = { id: `eng-${Date.now()}`, name: `${bp.abbr} — Audit FY26`, auditType: 'SOX ICFR', status: 'Draft', controls: controls.length };
    setEngs(prev => [...prev, e]);
    addToast({ message: `Engagement "${e.name}" created as Draft`, type: 'success' });
  };

  const actionMap: Record<string, () => void> = {
    sops: handleUploadSOP, racms: handleCreateRACM, risks: handleAddRisk,
    controls: handleMapControl, workflows: handleLinkWorkflow, engagements: handleCreateEngagement,
  };

  const sevCls: Record<string, string> = { critical: 'bg-risk-50 text-risk-700', high: 'bg-high-50 text-high-700', medium: 'bg-mitigated-50 text-mitigated-700', low: 'bg-compliant-50 text-compliant-700' };

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
          <ArrowLeft size={14} />Back to Process Hub
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-[0.875rem] font-bold" style={{ background: bp.color }}>{bp.abbr}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-text">{bp.name}</h1>
                  <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${statusCls}`}>{bp.status || 'Draft'}</span>
                </div>
                <div className="flex items-center gap-4 text-[0.75rem] text-text-muted mt-0.5">
                  <span className="font-mono">{bp.abbr}</span>
                  {bp.owner && <span className="flex items-center gap-1"><User size={11} />{bp.owner}</span>}
                  {bp.fy && <span className="flex items-center gap-1"><Clock size={11} />{bp.fy}</span>}
                  {bp.department && <span>{bp.department}</span>}
                </div>
              </div>
            </div>
            {bp.description && <p className="text-[0.8125rem] text-text-secondary mt-1 max-w-2xl">{bp.description}</p>}
          </div>
          <div className="text-center shrink-0 ml-6">
            <div className={`text-2xl font-bold ${coverage > 0 ? 'text-compliant-700' : 'text-text-muted'}`}>{coverage}%</div>
            <div className="text-[0.625rem] text-text-muted">Coverage</div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => setActiveTab(tabs[i + 1]?.id || 'overview')}
              className="glass-card rounded-xl p-3 text-center cursor-pointer hover:border-primary/20 transition-all">
              <kpi.icon size={14} className="mx-auto text-text-muted mb-1" />
              <div className="text-lg font-bold text-text tabular-nums">{kpi.value}</div>
              <div className="text-[0.625rem] text-text-muted">{kpi.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-border-light mb-5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors cursor-pointer ${
                  active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}>
                <Icon size={14} />{tab.label}
                {tab.count > 0 && <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>

            {/* ═══ OVERVIEW ═══ */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-medium"><Zap size={16} className="text-white" /></div>
                    <div>
                      <h3 className="text-[0.875rem] font-bold text-text">Set up this business process</h3>
                      <p className="text-[0.75rem] text-text-muted mt-0.5">{completedCount} of {checklist.length} steps complete</p>
                    </div>
                    <div className="ml-auto"><div className="w-16 h-2 bg-surface-3 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-medium transition-all" style={{ width: `${Math.round((completedCount / checklist.length) * 100)}%` }} /></div></div>
                  </div>
                  <div className="space-y-2">
                    {checklist.map((item, i) => (
                      <motion.div key={item.key} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${item.done ? 'border-compliant/20 bg-compliant-50/30' : 'border-border hover:border-primary/20 hover:bg-primary-xlight/30'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.done ? 'bg-compliant text-white' : 'bg-surface-2 text-text-muted'}`}>
                          {item.done ? <CheckCircle2 size={14} /> : <span className="text-[0.6875rem] font-bold">{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[0.8125rem] font-medium ${item.done ? 'text-compliant-700 line-through' : 'text-text'}`}>{item.label}</div>
                          <div className="text-[0.6875rem] text-text-muted mt-0.5">{item.desc}</div>
                        </div>
                        {!item.done && (
                          <button onClick={() => { setActiveTab(item.tab); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.6875rem] font-semibold hover:bg-primary/15 transition-colors cursor-pointer shrink-0">
                            <item.icon size={11} />{item.cta}
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {bp.subProcesses && bp.subProcesses.filter(sp => sp.name).length > 0 && (
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-3">Sub-processes</h3>
                    <div className="space-y-2">
                      {bp.subProcesses.filter(sp => sp.name).map((sp, i) => (
                        <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-canvas-border">
                          <div className="w-6 h-6 rounded-lg bg-surface-2 flex items-center justify-center text-[0.625rem] font-bold text-text-muted shrink-0">{i + 1}</div>
                          <div><div className="text-[0.8125rem] font-medium text-text">{sp.name}</div>{sp.description && <div className="text-[0.6875rem] text-text-muted mt-0.5">{sp.description}</div>}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-canvas-border bg-canvas px-4 py-3 flex items-start gap-2.5">
                  <Shield size={13} className="text-ink-400 mt-0.5 shrink-0" />
                  <p className="text-[0.6875rem] text-ink-400 leading-relaxed">Business Process organizes risk and control context. RACM defines mappings. Engagement executes testing.</p>
                </div>
              </div>
            )}

            {/* ═══ SOPs TAB ═══ */}
            {activeTab === 'sops' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.8125rem] font-semibold text-text">{sops.length} SOP{sops.length !== 1 ? 's' : ''}</h3>
                  <button onClick={handleUploadSOP} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Upload size={14} />Upload SOP</button>
                </div>
                {sops.length === 0 ? (
                  <div className="glass-card rounded-xl p-10 text-center"><Upload size={32} className="mx-auto text-ink-300 mb-3" /><p className="text-[0.875rem] font-semibold text-ink-600 mb-1">No SOPs uploaded</p><p className="text-[0.75rem] text-ink-400 mb-4">Upload an SOP to help generate risks, controls, and RACM.</p><button onClick={handleUploadSOP} className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Upload size={14} />Upload SOP</button></div>
                ) : (
                  <div className="space-y-3">
                    {sops.map(sop => (
                      <div key={sop.id} className="glass-card rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-brand-50"><FileText size={16} className="text-brand-600" /></div>
                            <div>
                              <div className="text-[0.8125rem] font-semibold text-text">{sop.name}</div>
                              <div className="text-[0.6875rem] text-text-muted">{sop.version} · Uploaded by {sop.uploadedBy} · {sop.uploadedAt}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-compliant-50 text-compliant-700 inline-flex items-center">Processed</span>
                            <button onClick={() => { setActiveTab('racms'); handleCreateRACM(); }} className="text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer">Generate RACM from SOP</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ RACMs TAB ═══ */}
            {activeTab === 'racms' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.8125rem] font-semibold text-text">{racms.length} RACM{racms.length !== 1 ? 's' : ''}</h3>
                  <button onClick={handleCreateRACM} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Create RACM</button>
                </div>
                {racms.length === 0 ? (
                  <div className="glass-card rounded-xl p-10 text-center"><FileText size={32} className="mx-auto text-ink-300 mb-3" /><p className="text-[0.875rem] font-semibold text-ink-600 mb-1">No RACMs created</p><p className="text-[0.75rem] text-ink-400 mb-4">Create a RACM to map risks and controls for this process.</p><button onClick={handleCreateRACM} className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Create RACM</button></div>
                ) : (
                  <div className="space-y-3">{racms.map(racm => (
                    <div key={racm.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                      <div><div className="text-[0.8125rem] font-semibold text-text">{racm.name}</div><div className="text-[0.6875rem] text-text-muted">{racm.fw} · {racm.risks} risks · {racm.controls} controls</div></div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${racm.status === 'active' ? 'bg-compliant-50 text-compliant-700' : 'bg-gray-100 text-gray-600'}`}>{racm.status === 'active' ? 'Active' : 'Draft'}</span>
                        <button onClick={() => addToast({ message: `View RACM "${racm.name}"`, type: 'info' })} className="text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer">View</button>
                      </div>
                    </div>
                  ))}</div>
                )}
              </div>
            )}

            {/* ═══ RISKS TAB ═══ */}
            {activeTab === 'risks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.8125rem] font-semibold text-text">{risks.length} Risk{risks.length !== 1 ? 's' : ''}</h3>
                  <button onClick={handleAddRisk} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Add Risk</button>
                </div>
                {risks.length === 0 ? (
                  <div className="glass-card rounded-xl p-10 text-center"><AlertTriangle size={32} className="mx-auto text-ink-300 mb-3" /><p className="text-[0.875rem] font-semibold text-ink-600 mb-1">No risks identified</p><p className="text-[0.75rem] text-ink-400 mb-4">Risks are typically mapped through the RACM. Add risks to build the risk profile.</p><button onClick={handleAddRisk} className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Add Risk</button></div>
                ) : (
                  <div className="glass-card rounded-xl overflow-hidden">
                    <table className="w-full text-[0.75rem]">
                      <thead><tr className="border-b border-border bg-surface-2/50">
                        {['Risk', 'Severity', 'Controls', 'Status'].map(h => <th key={h} className="px-4 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">{h}</th>)}
                      </tr></thead>
                      <tbody>{risks.map(r => (
                        <tr key={r.id} className="border-b border-border/40 hover:bg-surface-2/30 transition-colors">
                          <td className="px-4 py-3 text-[0.75rem] font-medium text-text">{r.name}</td>
                          <td className="px-4 py-3"><span className={`px-2 h-5 rounded-full text-[0.625rem] font-bold uppercase inline-flex items-center ${sevCls[r.severity] || 'bg-gray-100 text-gray-600'}`}>{r.severity}</span></td>
                          <td className="px-4 py-3 text-[0.75rem] text-text-secondary">{r.controls}</td>
                          <td className="px-4 py-3"><span className="px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-risk-50 text-risk-700 inline-flex items-center capitalize">{r.status}</span></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ═══ CONTROLS TAB ═══ */}
            {activeTab === 'controls' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.8125rem] font-semibold text-text">{controls.length} Control{controls.length !== 1 ? 's' : ''}</h3>
                  <button onClick={handleMapControl} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Map Control</button>
                </div>
                {controls.length === 0 ? (
                  <div className="glass-card rounded-xl p-10 text-center"><Shield size={32} className="mx-auto text-ink-300 mb-3" /><p className="text-[0.875rem] font-semibold text-ink-600 mb-1">No controls mapped</p><p className="text-[0.75rem] text-ink-400 mb-4">Map controls from the Control Library to this process.</p><button onClick={handleMapControl} className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Map Control</button></div>
                ) : (
                  <div className="glass-card rounded-xl overflow-hidden">
                    <table className="w-full text-[0.75rem]">
                      <thead><tr className="border-b border-border bg-surface-2/50">
                        {['Control', 'Nature', 'Automation', 'Key'].map(h => <th key={h} className="px-4 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">{h}</th>)}
                      </tr></thead>
                      <tbody>{controls.map(c => (
                        <tr key={c.id} className="border-b border-border/40 hover:bg-surface-2/30 transition-colors cursor-pointer">
                          <td className="px-4 py-3 text-[0.75rem] font-medium text-text">{c.name}</td>
                          <td className="px-4 py-3"><span className={`px-2 h-5 rounded text-[0.625rem] font-bold inline-flex items-center ${c.nature === 'Preventive' ? 'bg-compliant-50 text-compliant-700' : 'bg-evidence-50 text-evidence-700'}`}>{c.nature}</span></td>
                          <td className="px-4 py-3"><span className={`px-2 h-5 rounded text-[0.625rem] font-bold inline-flex items-center ${c.automation === 'Automated' ? 'bg-evidence-50 text-evidence-700' : 'bg-gray-100 text-gray-700'}`}>{c.automation}</span></td>
                          <td className="px-4 py-3">{c.isKey ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.625rem] font-bold">K</span> : <span className="text-ink-300">—</span>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ═══ WORKFLOWS TAB ═══ */}
            {activeTab === 'workflows' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.8125rem] font-semibold text-text">{wfs.length} Workflow{wfs.length !== 1 ? 's' : ''}</h3>
                  <button onClick={handleLinkWorkflow} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Link Workflow</button>
                </div>
                {wfs.length === 0 ? (
                  <div className="glass-card rounded-xl p-10 text-center"><Workflow size={32} className="mx-auto text-ink-300 mb-3" /><p className="text-[0.875rem] font-semibold text-ink-600 mb-1">No workflows linked</p><p className="text-[0.75rem] text-ink-400 mb-4">Link workflows to define how controls will be tested. Execution happens in engagements.</p><button onClick={handleLinkWorkflow} className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Link Workflow</button></div>
                ) : (
                  <div className="space-y-3">{wfs.map(w => (
                    <div key={w.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3"><Workflow size={15} className="text-brand-600 shrink-0" /><div><div className="text-[0.8125rem] font-semibold text-text">{w.name}</div><div className="text-[0.6875rem] text-text-muted">{w.type} · {w.steps} steps</div></div></div>
                      <span className="px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-compliant-50 text-compliant-700 inline-flex items-center capitalize">{w.status}</span>
                    </div>
                  ))}</div>
                )}
              </div>
            )}

            {/* ═══ ENGAGEMENTS TAB ═══ */}
            {activeTab === 'engagements' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.8125rem] font-semibold text-text">{engs.length} Engagement{engs.length !== 1 ? 's' : ''}</h3>
                  <button onClick={handleCreateEngagement} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Create Engagement</button>
                </div>
                {engs.length === 0 ? (
                  <div className="glass-card rounded-xl p-10 text-center"><Calendar size={32} className="mx-auto text-ink-300 mb-3" /><p className="text-[0.875rem] font-semibold text-ink-600 mb-1">No engagements yet</p><p className="text-[0.75rem] text-ink-400 mb-4">Create an engagement when you are ready to execute testing for {bp.name}.</p><button onClick={handleCreateEngagement} className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Create Engagement for {bp.abbr}</button></div>
                ) : (
                  <div className="space-y-3">{engs.map(e => (
                    <div key={e.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                      <div><div className="text-[0.8125rem] font-semibold text-text">{e.name}</div><div className="text-[0.6875rem] text-text-muted">{e.auditType} · {e.controls} controls</div></div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-draft-50 text-draft-700 inline-flex items-center">{e.status}</span>
                        <button onClick={() => addToast({ message: 'Configure engagement before activation', type: 'info' })} className="px-2 py-1 rounded-lg text-[0.625rem] font-bold bg-brand-50 text-brand-700 hover:bg-brand-50/80 cursor-pointer transition-colors inline-flex items-center gap-1">Configure <ChevronRight size={9} /></button>
                      </div>
                    </div>
                  ))}</div>
                )}
                <div className="rounded-lg border border-canvas-border bg-canvas px-3 py-2 flex items-start gap-2"><Shield size={11} className="text-ink-400 mt-0.5 shrink-0" /><span className="text-[0.625rem] text-ink-400">Engagement prefills Primary Process = {bp.abbr}. You still need to select Audit Type, Framework, RACM Version, and assign Owner/Reviewer.</span></div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Create Business Process Drawer
// ═════════════════════════════════════════════════════════════════════════════

function CreateProcessDrawer({ existingCodes, onClose, onCreate, colorIndex }: {
  existingCodes: string[];
  onClose: () => void;
  onCreate: (bp: BPItem) => void;
  colorIndex: number;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [owner, setOwner] = useState(OWNERS[0]);
  const [fy, setFy] = useState('FY 2025-26');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Active' | 'Archived'>('Draft');
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([{ name: '', description: '' }]);

  const codeUpper = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isDuplicate = existingCodes.includes(codeUpper);
  const isValid = name.trim().length > 0 && codeUpper.length >= 2 && !isDuplicate && department !== '' && owner !== '';

  const addSubProcess = () => setSubProcesses(prev => [...prev, { name: '', description: '' }]);
  const removeSubProcess = (idx: number) => setSubProcesses(prev => prev.filter((_, i) => i !== idx));
  const updateSubProcess = (idx: number, field: keyof SubProcess, value: string) => {
    setSubProcesses(prev => prev.map((sp, i) => i === idx ? { ...sp, [field]: value } : sp));
  };

  const handleCreate = () => {
    if (!isValid) return;
    onCreate({
      id: codeUpper.toLowerCase() + '-' + Date.now(),
      name, abbr: codeUpper,
      color: NEW_COLORS[colorIndex % NEW_COLORS.length],
      risks: 0, controls: 0, coverage: 0, sops: 0, workflows: 0,
      status, department, owner, fy, description,
      subProcesses: subProcesses.filter(sp => sp.name.trim()),
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Create Business Process">

        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Building2 size={18} className="text-brand-600" /><h2 className="font-display text-[1.125rem] font-semibold text-ink-900 tracking-tight">Create Business Process</h2></div>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">Define a new business process as a taxonomy object.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
          <div className="mb-3"><label className={labelCls}>Process Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Procure to Pay" className={inputCls} /></div>
          <div className="mb-3">
            <label className={labelCls}>Process Code *</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="e.g. P2P" maxLength={6} className={`${inputCls} font-mono uppercase ${isDuplicate ? 'border-risk focus:border-risk focus:ring-risk/10' : ''}`} />
            {isDuplicate && <p className="text-[0.625rem] text-risk-700 mt-0.5 px-1">Code "{codeUpper}" already exists.</p>}
            {!isDuplicate && codeUpper.length > 0 && <p className="text-[0.625rem] text-compliant-700 mt-0.5 px-1">Code available</p>}
          </div>
          <div className="mb-3"><label className={labelCls}>Function / Department *</label><select value={department} onChange={e => setDepartment(e.target.value)} className={selectCls}><option value="">Select department...</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="mb-3"><label className={labelCls}>Process Owner *</label><select value={owner} onChange={e => setOwner(e.target.value)} className={selectCls}>{OWNERS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="mb-3"><label className={labelCls}>Financial Year / Period</label><input type="text" value={fy} onChange={e => setFy(e.target.value)} className={inputCls} /></div>
          <div className="mb-3"><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Describe what this process covers." className={inputCls + ' resize-none'} /></div>
          <div className="mb-4">
            <label className={labelCls}>Status</label>
            <div className="flex gap-2">
              {(['Draft', 'Active', 'Archived'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)} className={`px-4 py-2 rounded-lg border text-[0.75rem] font-medium transition-all cursor-pointer ${status === s ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' mb-0'}>Sub-processes</label>
              <button onClick={addSubProcess} className="text-[0.6875rem] font-semibold text-brand-600 hover:underline cursor-pointer flex items-center gap-1"><Plus size={11} />Add row</button>
            </div>
            <div className="space-y-2">
              {subProcesses.map((sp, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input type="text" value={sp.name} onChange={e => updateSubProcess(idx, 'name', e.target.value)}
                      placeholder={`Sub-process name (e.g. ${['Vendor onboarding', 'Purchase order creation', 'Goods receipt', 'Invoice processing', 'Payment release'][idx] || 'Sub-process'})`}
                      className="w-full px-2.5 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 transition-all" />
                    <input type="text" value={sp.description} onChange={e => updateSubProcess(idx, 'description', e.target.value)}
                      placeholder="Brief description (optional)"
                      className="w-full px-2.5 py-1.5 border border-border/60 rounded-lg text-[0.6875rem] text-text-muted bg-white outline-none focus:border-primary/40 transition-all" />
                  </div>
                  {subProcesses.length > 1 && (
                    <button onClick={() => removeSubProcess(idx)} className="p-1.5 mt-1 rounded-md hover:bg-risk-50 text-ink-400 hover:text-risk-700 transition-colors cursor-pointer shrink-0"><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleCreate} disabled={!isValid} className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Create Process</button>
        </footer>
      </motion.aside>
    </>
  );
}
