import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Calendar, Shield, Users, ShieldCheck, AlertTriangle,
  Clock, CheckCircle2, XCircle, Search, Workflow,
  FileText, Zap, Eye, Target, Copy, ChevronRight,
  Upload, Database, X, Play, Lock, BarChart3, Paperclip,
  Settings, ArrowRight, Link2
} from 'lucide-react';
import Orb from '../shared/Orb';
import { ENGAGEMENT, CONTROLS, FINDINGS, getWorkflowSummary, getLinkedWorkflows, type ControlDetail, type ControlStatus, type Finding } from './engagementData';

// ─── Status helpers ──────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ControlStatus }) {
  const map: Record<ControlStatus, { label: string; cls: string }> = {
    'not-started':        { label: 'Not Started',        cls: 'bg-draft-50 text-draft-700' },
    'population-pending': { label: 'Population Pending', cls: 'bg-high-50 text-high-700' },
    'in-progress':        { label: 'In Progress',        cls: 'bg-evidence-50 text-evidence-700' },
    'pending-review':     { label: 'Pending Review',     cls: 'bg-mitigated-50 text-mitigated-700' },
    'effective':          { label: 'Effective',           cls: 'bg-compliant-50 text-compliant-700' },
    'partially-effective':{ label: 'Partial',             cls: 'bg-high-50 text-high-700' },
    'ineffective':        { label: 'Ineffective',         cls: 'bg-risk-50 text-risk-700' },
  };
  const s = map[status] || map['not-started'];
  return <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

function ResultPill({ result }: { result: string }) {
  if (!result) return <span className="text-ink-400 text-[0.6875rem]">—</span>;
  const map: Record<string, string> = {
    'Effective': 'bg-compliant-50 text-compliant-700',
    'Partially Effective': 'bg-high-50 text-high-700',
    'Ineffective': 'bg-risk-50 text-risk-700',
    'Pending': 'bg-draft-50 text-draft-700',
  };
  return <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap ${map[result] || map['Pending']}`}>{result}</span>;
}

function isConcluded(s: ControlStatus): boolean {
  return ['effective', 'partially-effective', 'ineffective'].includes(s);
}

// ─── Action logic per control ────────────────────────────────────────────────

function hasUnmappedAttributes(ctrl: ControlDetail): boolean {
  // If control has explicit linkedWorkflows, check for unmapped attrs
  if (ctrl.linkedWorkflows && ctrl.linkedWorkflows.length > 0) {
    return ctrl.workflowAttributes.some(a => !a.workflowId);
  }
  // Legacy single-workflow controls are implicitly fully mapped
  return false;
}

function getControlAction(ctrl: ControlDetail): { label: string; icon: React.ElementType; cls: string } {
  // Workflow mapping readiness takes priority for not-started controls
  if (hasUnmappedAttributes(ctrl) && (ctrl.status === 'not-started' || ctrl.status === 'population-pending'))
    return { label: 'Fix Mapping', icon: Link2, cls: 'bg-risk-50 text-risk-700 hover:bg-risk-50/80' };
  if (ctrl.status === 'not-started' && ctrl.populationStatus === 'none')
    return { label: 'Upload Population', icon: Upload, cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
  if (ctrl.status === 'not-started' || ctrl.status === 'population-pending')
    return { label: 'Generate Samples', icon: Database, cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
  if (ctrl.status === 'in-progress' && ctrl.samples.some(s => s.status === 'not-tested'))
    return { label: 'Continue Testing', icon: Target, cls: 'bg-evidence-50 text-evidence-700 hover:bg-evidence-50/80' };
  if (ctrl.status === 'in-progress' && ctrl.samples.every(s => s.status !== 'not-tested'))
    return { label: 'Submit Review', icon: Eye, cls: 'bg-brand-50 text-brand-700 hover:bg-brand-50/80' };
  if (ctrl.status === 'pending-review')
    return { label: 'Review', icon: Eye, cls: 'bg-mitigated-50 text-mitigated-700 hover:bg-mitigated-50/80' };
  if (isConcluded(ctrl.status))
    return { label: 'View', icon: Eye, cls: 'bg-surface-2 text-text-muted hover:bg-surface-2/80' };
  return { label: 'Open', icon: ChevronRight, cls: 'bg-surface-2 text-text-muted hover:bg-surface-2/80' };
}

type TabId = 'controls' | 'review-queue' | 'findings';
type StatusFilter = 'all' | 'not-started' | 'in-progress' | 'pending-review' | 'concluded' | 'failed';

// ─── Workflow Coverage Cell ─────────────────────────────────────────────────

function WorkflowCoverageCell({ control, onOpenDrawer }: { control: ControlDetail; onOpenDrawer: (id: string) => void }) {
  const summary = getWorkflowSummary(control);
  const allMapped = summary.unmappedAttributeCount === 0;
  const noWorkflows = !control.workflowName && (!control.linkedWorkflows || control.linkedWorkflows.length === 0);

  if (noWorkflows) {
    return (
      <div className="flex items-center gap-1">
        <AlertTriangle size={10} className="text-risk-700 shrink-0" />
        <span className="text-[0.625rem] font-semibold text-risk-700">Missing workflow</span>
      </div>
    );
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <button onClick={() => onOpenDrawer(control.id)} className="text-left cursor-pointer group/wf">
        <div className="flex items-center gap-1.5">
          <Workflow size={10} className="text-brand-500 shrink-0" />
          <span className="text-[0.625rem] font-medium text-brand-700">{summary.displayText}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {allMapped ? (
            <span className="inline-flex items-center gap-0.5 text-[0.5625rem] font-medium text-compliant-700"><CheckCircle2 size={8} />All mapped</span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[0.5625rem] font-medium text-risk-700"><AlertTriangle size={8} />{summary.unmappedAttributeCount} unmapped</span>
          )}
          <ChevronRight size={8} className="text-ink-300 group-hover/wf:text-brand-500" />
        </div>
      </button>
    </div>
  );
}

// ─── Workflow Mapping Drawer ────────────────────────────────────────────────

function WorkflowMappingDrawer({ control, onClose }: { control: ControlDetail; onClose: () => void }) {
  const workflows = getLinkedWorkflows(control);
  const summary = getWorkflowSummary(control);
  const isSingleLegacy = workflows.length === 1 && workflows[0].id === 'lw-legacy';

  // Local overrides for unmapped attribute reassignment
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2200); };

  const resolveWfId = (attrWfId?: string, attrId?: string): string | undefined =>
    (attrId ? overrides[attrId] : undefined) ?? attrWfId ?? (isSingleLegacy ? 'lw-legacy' : undefined);

  // Group attributes by workflow
  const grouped = new Map<string, typeof control.workflowAttributes>();
  const unmapped: typeof control.workflowAttributes = [];

  control.workflowAttributes.forEach(attr => {
    const wfId = resolveWfId(attr.workflowId, attr.id);
    if (!wfId) { unmapped.push(attr); return; }
    if (!grouped.has(wfId)) grouped.set(wfId, []);
    grouped.get(wfId)!.push(attr);
  });

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside
        initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Workflow Mapping"
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Link2 size={18} className="text-brand-600" />
                <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">Workflow Mapping</h2>
              </div>
              <p className="text-[0.75rem] text-ink-500 mt-1">{control.controlName}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
          {/* Summary chips */}
          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[0.625rem] font-semibold bg-brand-50 text-brand-700">
              <Workflow size={10} />{summary.linkedWorkflowCount} workflow{summary.linkedWorkflowCount !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[0.625rem] font-semibold bg-evidence-50 text-evidence-700">
              <Target size={10} />{summary.attributeCount} attribute{summary.attributeCount !== 1 ? 's' : ''}
            </span>
            {summary.unmappedAttributeCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[0.625rem] font-semibold bg-risk-50 text-risk-700">
                <AlertTriangle size={10} />{summary.unmappedAttributeCount} unmapped
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[0.625rem] font-semibold bg-compliant-50 text-compliant-700">
                <CheckCircle2 size={10} />All mapped
              </span>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 relative">
          {/* Grouped by workflow */}
          {workflows.map(wf => {
            const wfAttrs = grouped.get(wf.id) || [];
            if (wfAttrs.length === 0) return null;
            return (
              <div key={wf.id}>
                <div className="flex items-center gap-2 mb-2">
                  <Workflow size={13} className="text-brand-600 shrink-0" />
                  <span className="text-[0.8125rem] font-semibold text-ink-800">{wf.name}</span>
                  <span className="text-[0.625rem] font-mono text-ink-400">{wf.version}</span>
                </div>
                <div className="space-y-1.5 ml-5">
                  {wfAttrs.map(attr => (
                    <div key={attr.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-canvas-border bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.75rem] font-medium text-ink-800">{attr.name}</div>
                        {attr.assertions && attr.assertions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {attr.assertions.map(a => (
                              <span key={a} className="px-1.5 h-[16px] rounded text-[0.5625rem] font-medium bg-brand-50 text-brand-700 inline-flex items-center">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[0.5625rem] font-bold bg-compliant-50 text-compliant-700 shrink-0">
                        <CheckCircle2 size={8} />Mapped
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Unmapped section */}
          {unmapped.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-risk-700 shrink-0" />
                <span className="text-[0.8125rem] font-semibold text-risk-700">Unmapped Attributes</span>
                <span className="text-[0.625rem] text-risk-700/70">({unmapped.length})</span>
              </div>
              <div className="space-y-1.5 ml-5">
                {unmapped.map(attr => (
                  <div key={attr.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-risk/20 bg-risk-50/20">
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.75rem] font-medium text-ink-800">{attr.name}</div>
                      {attr.assertions && attr.assertions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {attr.assertions.map(a => (
                            <span key={a} className="px-1.5 h-[16px] rounded text-[0.5625rem] font-medium bg-brand-50 text-brand-700 inline-flex items-center">{a}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <select
                      value=""
                      onChange={e => {
                        if (!e.target.value) return;
                        setOverrides(prev => ({ ...prev, [attr.id]: e.target.value }));
                        const wf = workflows.find(w => w.id === e.target.value);
                        if (wf) showToast(`Attribute mapped to ${wf.name}`);
                      }}
                      className="w-[120px] px-2 py-1 rounded border border-risk/30 bg-white text-[0.625rem] text-ink-700 outline-none cursor-pointer focus:border-brand-500/60 shrink-0"
                    >
                      <option value="">Assign…</option>
                      {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inline toast */}
          <AnimatePresence>
            {toastMsg && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-ink-800 text-white text-[0.6875rem] font-medium shadow-lg flex items-center gap-2">
                <CheckCircle2 size={12} className="text-compliant shrink-0" />{toastMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas">
          <div className="rounded-lg border border-canvas-border bg-surface-2/50 px-3 py-2 flex items-start gap-2 mb-3">
            <Shield size={11} className="text-ink-400 mt-0.5 shrink-0" />
            <span className="text-[0.75rem] text-ink-400 leading-relaxed">
              Workflow mapping defines how each attribute will be tested. Execution starts after population and sample setup.
            </span>
          </div>
          <button onClick={onClose} className="w-full px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
            Done
          </button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

// Reset controls to clean Not Started state for fresh engagements
function resetControlsToClean(controls: ControlDetail[]): ControlDetail[] {
  return controls.map(c => ({
    ...c,
    status: 'not-started' as ControlStatus,
    result: '' as const,
    conclusion: '',
    populationStatus: 'none' as const,
    populationSize: 0,
    populationSource: '',
    samplingMethod: '',
    samples: [],
    sampleCount: 0,
    samplesTested: 0,
    exceptions: 0,
    evidenceCount: 0,
    lastUpdated: '—',
    testingRound: 0,
    workingPaper: { ...c.workingPaper, rounds: [], comments: [] },
    auditTrail: [],
  }));
}

interface Props {
  engagementId?: string;
  freshActivation?: boolean;
  onBack: () => void;
  onOpenControl: (controlId: string, controlData?: ControlDetail) => void;
}

export default function EngagementDetailView({ engagementId, freshActivation, onBack, onOpenControl }: Props) {
  const eng = ENGAGEMENT;

  // Use seeded data ONLY for explicit demo engagement IDs; everything else starts fresh
  const isDemoEngagement = engagementId === 'ap-1' || engagementId === 'eng-sox-fy26';
  const isFreshEngagement = !isDemoEngagement || freshActivation;
  const sourceControls = isFreshEngagement ? resetControlsToClean(CONTROLS) : CONTROLS;

  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeTab, setActiveTab] = useState<TabId>('controls');
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [mappingDrawerControlId, setMappingDrawerControlId] = useState<string | null>(null);
  const mappingDrawerControl = mappingDrawerControlId ? sourceControls.find(c => c.id === mappingDrawerControlId) : null;

  const domains = ['All', ...Array.from(new Set(sourceControls.map(c => c.domain)))];

  const filteredControls = sourceControls.filter(c => {
    if (domainFilter !== 'All' && c.domain !== domainFilter) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'not-started' && c.status !== 'not-started' && c.status !== 'population-pending') return false;
      if (statusFilter === 'in-progress' && c.status !== 'in-progress') return false;
      if (statusFilter === 'pending-review' && c.status !== 'pending-review') return false;
      if (statusFilter === 'concluded' && !isConcluded(c.status)) return false;
      if (statusFilter === 'failed' && c.status !== 'ineffective') return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return c.controlId.toLowerCase().includes(q) || c.controlName.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q) || c.assignee.toLowerCase().includes(q) || c.workflowName.toLowerCase().includes(q);
    }
    return true;
  });

  // KPIs
  const totalControls = sourceControls.length;
  const readyControls = sourceControls.filter(c => c.status === 'not-started' && c.populationStatus === 'none').length;
  const populationPending = sourceControls.filter(c => c.status === 'population-pending' || (c.status === 'not-started' && c.populationStatus !== 'none')).length;
  const wip = sourceControls.filter(c => c.status === 'in-progress').length;
  const pendingReview = sourceControls.filter(c => c.status === 'pending-review').length;
  const concluded = sourceControls.filter(c => isConcluded(c.status)).length;
  const deficient = sourceControls.filter(c => c.status === 'ineffective').length;

  // Progress
  const progressPct = totalControls > 0 ? Math.round((concluded / totalControls) * 100) : 0;
  const canClose = concluded === totalControls && totalControls > 0 && pendingReview === 0;

  // Reviewer queue
  const reviewQueue = sourceControls.filter(c => c.status === 'pending-review');

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />

      <div className="p-8 relative">
        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
          <ArrowLeft size={14} />Back
        </button>

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-text">{eng.name}</h1>
              <span className="px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold bg-compliant-50 text-compliant-700 inline-flex items-center">{eng.status}</span>
            </div>
            <p className="text-[0.8125rem] text-text-secondary mt-1 max-w-2xl">{eng.description}</p>
          </div>
          {canClose && (
            <button onClick={() => setShowCloseModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-medium hover:brightness-110 text-white rounded-xl text-[0.75rem] font-bold transition-all cursor-pointer shrink-0">
              <Lock size={14} />Close Engagement
            </button>
          )}
        </div>

        {/* ── METADATA STRIP ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
          {[
            { label: 'Audit Type', value: eng.auditType, icon: Shield },
            { label: 'Framework', value: eng.framework, icon: Target },
            { label: 'Audit Period', value: `${eng.auditPeriodStart} — ${eng.auditPeriodEnd}`, icon: Calendar },
            { label: 'RACM Version', value: eng.racmVersion, icon: FileText },
            { label: 'Snapshot', value: eng.snapshotId, icon: Copy },
            { label: 'Owner', value: eng.owner, icon: Users },
            { label: 'Reviewer', value: eng.reviewer, icon: Eye },
            { label: 'Activated', value: eng.activatedAt, icon: Zap },
          ].map(m => (
            <div key={m.label} className="glass-card rounded-xl p-2.5">
              <div className="flex items-center gap-1 mb-0.5"><m.icon size={10} className="text-text-muted" /><span className="text-[0.5625rem] font-semibold text-text-muted uppercase">{m.label}</span></div>
              <div className="text-[0.6875rem] font-medium text-text truncate" title={m.value}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* ── FIRST-TIME ONBOARDING ── */}
        {showOnboarding && sourceControls.every(c => c.status === 'not-started' || c.status === 'population-pending') && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/[0.03] to-brand-50/30 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-medium"><Play size={16} className="text-white" /></div>
                  <div>
                    <h3 className="text-[0.875rem] font-bold text-text">Welcome to Your Audit Workspace</h3>
                    <p className="text-[0.75rem] text-text-muted mt-0.5">This engagement has been created from the selected RACM snapshot. Testing has not started yet. Begin by uploading population data for controls.</p>
                  </div>
                </div>
                <button onClick={() => setShowOnboarding(false)} className="p-1.5 rounded-lg hover:bg-surface-2 cursor-pointer"><X size={14} className="text-text-muted" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { step: 1, icon: Upload, label: 'Upload Population', desc: 'Upload data source for each control.', color: 'text-evidence-700 bg-evidence-50' },
                  { step: 2, icon: Database, label: 'Generate Samples', desc: 'Select sampling method and generate samples.', color: 'text-brand-700 bg-brand-50' },
                  { step: 3, icon: Target, label: 'Start Testing', desc: 'Evaluate samples against workflow attributes.', color: 'text-compliant-700 bg-compliant-50' },
                ].map(s => (
                  <div key={s.step} className="glass-card rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6875rem] font-bold text-white bg-gradient-to-br from-primary to-primary-medium">{s.step}</div>
                      <div className={`p-1 rounded-lg ${s.color}`}><s.icon size={12} /></div>
                    </div>
                    <p className="text-[0.75rem] font-semibold text-text mb-1">{s.label}</p>
                    <p className="text-[0.625rem] text-text-muted leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Not Configured Warning — when all controls are not-started and have no population */}
        {!showOnboarding && sourceControls.every(c => c.status === 'not-started') && sourceControls.every(c => c.populationStatus === 'none') && (
          <div className="mb-6 rounded-xl border-2 border-high/20 bg-high-50/20 p-4">
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-high-700" />
              <div>
                <p className="text-[0.8125rem] font-semibold text-high-700">Engagement activated, but controls need configuration</p>
                <p className="text-[0.6875rem] text-high-700/80 mt-0.5">All {sourceControls.length} controls are awaiting population data and workflow configuration before execution can begin. Click any control below to start.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── UNMAPPED ATTRIBUTES WARNING ── */}
        {sourceControls.some(c => hasUnmappedAttributes(c)) && (
          <div className="mb-4 rounded-xl border border-risk/20 bg-risk-50/30 px-4 py-3 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-risk-50 shrink-0"><Link2 size={14} className="text-risk-700" /></div>
            <div>
              <p className="text-[0.75rem] font-semibold text-risk-700">Workflow mapping incomplete</p>
              <p className="text-[0.6875rem] text-risk-700/70 mt-0.5">
                {sourceControls.filter(c => hasUnmappedAttributes(c)).length} control{sourceControls.filter(c => hasUnmappedAttributes(c)).length !== 1 ? 's have' : ' has'} attributes not linked to workflows. Complete workflow mapping before execution.
              </p>
            </div>
          </div>
        )}

        {/* ── TABS ── */}
        <div className="flex items-center border-b border-border-light mb-4">
          <button onClick={() => setActiveTab('controls')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'controls' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}>
            <ShieldCheck size={14} />Controls
            <span className={`text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'controls' ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{sourceControls.length}</span>
          </button>
          <button onClick={() => setActiveTab('review-queue')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'review-queue' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}>
            <Eye size={14} />Review Queue
            {pendingReview > 0 && <span className="text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-full bg-mitigated-50 text-mitigated-700">{pendingReview}</span>}
          </button>
          <button onClick={() => setActiveTab('findings')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'findings' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}>
            <AlertTriangle size={14} />Findings
            {FINDINGS.length > 0 && <span className="text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-full bg-risk-50 text-risk-700">{FINDINGS.length}</span>}
          </button>
        </div>

        {/* ══ CONTROLS TAB ══ */}
        {activeTab === 'controls' && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] font-bold text-text-muted">Status:</span>
                <div className="flex gap-1 flex-wrap">
                  {([['all', 'All'], ['not-started', 'Ready'], ['in-progress', 'In Progress'], ['pending-review', 'Review'], ['concluded', 'Concluded'], ['failed', 'Failed']] as [StatusFilter, string][]).map(([key, label]) => (
                    <button key={key} onClick={() => setStatusFilter(key)}
                      className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${statusFilter === key ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] font-bold text-text-muted">Domain:</span>
                <div className="flex gap-1 flex-wrap">
                  {domains.map(d => (
                    <button key={d} onClick={() => setDomainFilter(d)}
                      className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${domainFilter === d ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'}`}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1" />
              <div className="relative w-52">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-[0.75rem] bg-white border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-text-muted" />
              </div>
            </div>

            {/* Controls Execution Table */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/50">
                      {['Control', 'Process', 'Key', 'Workflow Coverage', 'Execution Status', 'Population', 'Samples', 'Evidence', 'Reviewer', 'Action'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-[0.625rem] font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredControls.map((row, i) => {
                      const action = getControlAction(row);
                      const samplesWithEvidence = row.samples.filter(s => s.evidenceFiles.length > 0).length;
                      const evidencePct = row.samples.length > 0 ? Math.round((samplesWithEvidence / row.samples.length) * 100) : 0;
                      const popLabel = row.populationStatus === 'snapshot-created' ? 'Locked' : row.populationStatus === 'uploaded' ? 'Uploaded' : 'None';
                      const popCls = row.populationStatus === 'snapshot-created' ? 'text-compliant-700' : row.populationStatus === 'uploaded' ? 'text-evidence-700' : 'text-ink-400';

                      return (
                        <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          onClick={() => onOpenControl(row.id, row)}
                          className="border-b border-border/50 hover:bg-brand-50/30 transition-colors cursor-pointer group">
                          <td className="px-3 py-3">
                            <span className="text-[0.625rem] font-mono text-text-muted">{row.controlId}</span>
                            <div className="text-[0.75rem] font-medium text-text max-w-[160px] truncate">{row.controlName}</div>
                          </td>
                          <td className="px-3 py-3"><span className="text-[0.6875rem] text-text-secondary">{row.domain}</span></td>
                          <td className="px-3 py-3 text-center">
                            {row.isKey ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.625rem] font-bold">K</span> : <span className="text-ink-300">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <WorkflowCoverageCell control={row} onOpenDrawer={setMappingDrawerControlId} />
                          </td>
                          <td className="px-3 py-3"><StatusPill status={row.status} /></td>
                          <td className="px-3 py-3"><span className={`text-[0.6875rem] font-semibold ${popCls}`}>{popLabel}</span></td>
                          <td className="px-3 py-3">
                            {row.sampleCount > 0 ? <span className="text-[0.6875rem] tabular-nums text-text-secondary">{row.samplesTested}/{row.sampleCount}</span> : <span className="text-ink-300 text-[0.625rem]">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {row.samples.length > 0 ? (
                              <span className={`text-[0.625rem] font-bold ${evidencePct === 100 ? 'text-compliant-700' : evidencePct > 0 ? 'text-high-700' : 'text-ink-400'}`}>{evidencePct}%</span>
                            ) : <span className="text-ink-300 text-[0.625rem]">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {row.workingPaper.rounds.some(r => r.reviewerStatus === 'approved')
                              ? <span className="text-[0.625rem] font-bold text-compliant-700">Approved</span>
                              : row.status === 'pending-review'
                                ? <span className="text-[0.625rem] font-bold text-mitigated-700">Pending</span>
                                : <span className="text-ink-300 text-[0.625rem]">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              onClick={action.label === 'Fix Mapping' ? (e: React.MouseEvent) => { e.stopPropagation(); setMappingDrawerControlId(row.id); } : undefined}
                              className={`text-[0.625rem] font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1 ${action.cls}`}>
                              <action.icon size={10} />{action.label}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2/30">
                <span className="text-[0.6875rem] text-text-muted">Showing {filteredControls.length} of {sourceControls.length} controls</span>
              </div>
            </div>
          </>
        )}

        {/* ══ REVIEW QUEUE TAB ══ */}
        {activeTab === 'review-queue' && (
          <div>
            {reviewQueue.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 size={32} className="text-compliant mx-auto mb-3" />
                <p className="text-[0.875rem] font-semibold text-text">No pending reviews</p>
                <p className="text-[0.75rem] text-text-muted mt-1">All submitted controls have been reviewed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="glass-card rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div><span className="text-[0.6875rem] font-bold text-text-muted uppercase">Reviewer</span><p className="text-[0.8125rem] font-semibold text-text">{eng.reviewer}</p></div>
                    <div className="flex items-center gap-4">
                      <div className="text-center"><div className="text-lg font-bold text-mitigated-700 tabular-nums">{reviewQueue.length}</div><div className="text-[0.625rem] text-text-muted">Pending</div></div>
                      <div className="text-center"><div className="text-lg font-bold text-risk-700 tabular-nums">{reviewQueue.filter(c => c.exceptions > 0).length}</div><div className="text-[0.625rem] text-text-muted">Exceptions</div></div>
                    </div>
                  </div>
                </div>
                {reviewQueue.map(ctrl => {
                  const passed = ctrl.samples.filter(s => s.status === 'pass').length;
                  const failed = ctrl.samples.filter(s => s.status === 'fail' || s.status === 'exception').length;
                  return (
                    <div key={ctrl.id} className={`glass-card rounded-xl p-5 ${ctrl.exceptions > 0 ? 'border-l-4 border-l-risk' : ''}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[0.625rem] font-mono text-text-muted">{ctrl.controlId}</span>
                            {ctrl.isKey && <span className="px-1.5 h-4 rounded text-[0.5625rem] font-bold bg-mitigated-50 text-mitigated-700 inline-flex items-center">KEY</span>}
                            {ctrl.exceptions > 0 && <span className="px-1.5 h-4 rounded text-[0.5625rem] font-bold bg-risk-50 text-risk-700 inline-flex items-center">{ctrl.exceptions} EXCEPTIONS</span>}
                          </div>
                          <h3 className="text-[0.8125rem] font-semibold text-text">{ctrl.controlName}</h3>
                          <span className="text-[0.6875rem] text-text-muted">Submitted by {ctrl.assignee}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="text-center p-2 rounded-lg bg-surface-2/50"><div className="text-[0.875rem] font-bold text-text tabular-nums">{ctrl.samplesTested}/{ctrl.sampleCount}</div><div className="text-[0.5625rem] text-text-muted">Samples</div></div>
                        <div className="text-center p-2 rounded-lg bg-surface-2/50"><div className="text-[0.875rem] font-bold text-compliant-700 tabular-nums">{passed}</div><div className="text-[0.5625rem] text-text-muted">Passed</div></div>
                        <div className="text-center p-2 rounded-lg bg-surface-2/50"><div className={`text-[0.875rem] font-bold tabular-nums ${failed > 0 ? 'text-risk-700' : 'text-text-muted'}`}>{failed}</div><div className="text-[0.5625rem] text-text-muted">Failed</div></div>
                        <div className="text-center p-2 rounded-lg bg-surface-2/50"><div className="text-[0.875rem] font-bold text-text tabular-nums">{ctrl.evidenceCount}</div><div className="text-[0.5625rem] text-text-muted">Evidence</div></div>
                      </div>
                      {ctrl.conclusion && <div className="p-3 bg-surface-2/40 rounded-lg mb-3"><span className="text-[0.625rem] font-bold text-text-muted uppercase">Tester Conclusion</span><p className="text-[0.75rem] text-text-secondary mt-0.5">{ctrl.conclusion}</p></div>}
                      <div className="flex items-center gap-3">
                        <button onClick={() => onOpenControl(ctrl.id, ctrl)} className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-lg text-[0.6875rem] font-semibold hover:bg-primary/20 transition-colors cursor-pointer"><Eye size={12} />Review Detail</button>
                        <button className="flex items-center gap-1.5 px-3 py-2 bg-compliant hover:brightness-110 text-white rounded-lg text-[0.6875rem] font-semibold transition-all cursor-pointer"><CheckCircle2 size={12} />Approve</button>
                        <button className="flex items-center gap-1.5 px-3 py-2 border border-risk text-risk-700 hover:bg-risk-50 rounded-lg text-[0.6875rem] font-semibold transition-all cursor-pointer"><XCircle size={12} />Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ FINDINGS TAB ══ */}
        {activeTab === 'findings' && (
          <div>
            {FINDINGS.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 size={32} className="text-compliant mx-auto mb-3" />
                <p className="text-[0.875rem] font-semibold text-text">No findings raised</p>
                <p className="text-[0.75rem] text-text-muted mt-1">Findings are created when a control is concluded as ineffective.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {FINDINGS.map(f => (
                  <div key={f.id} className="glass-card rounded-xl p-5 border-l-4 border-risk hover:border-risk/80 transition-colors cursor-pointer"
                    onClick={() => { const ctrl = sourceControls.find(c => c.controlId === f.controlId); if (ctrl) onOpenControl(ctrl.id, ctrl); }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.8125rem] font-mono font-bold text-risk-700">{f.id}</span>
                        <span className={`px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold inline-flex items-center ${f.severity === 'Material Weakness' ? 'bg-risk-50 text-risk-700' : f.severity === 'Significant Deficiency' ? 'bg-high-50 text-high-700' : 'bg-mitigated-50 text-mitigated-700'}`}>{f.severity}</span>
                        <span className={`px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold inline-flex items-center ${f.status === 'Open' ? 'bg-risk-50 text-risk-700' : 'bg-compliant-50 text-compliant-700'}`}>{f.status}</span>
                      </div>
                      <span className="text-[0.6875rem] text-text-muted">Due: {f.remediationDueDate}</span>
                    </div>
                    <h3 className="text-[0.8125rem] font-semibold text-text mb-2">{f.title}</h3>
                    <div className="grid grid-cols-2 gap-2 text-[0.6875rem]">
                      <div><span className="text-text-muted">Control: </span><span className="text-text font-medium">{f.controlName}</span></div>
                      <div><span className="text-text-muted">Owner: </span><span className="text-text font-medium">{f.owner}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── WORKFLOW MAPPING DRAWER ── */}
      <AnimatePresence>
        {mappingDrawerControl && (
          <WorkflowMappingDrawer control={mappingDrawerControl} onClose={() => setMappingDrawerControlId(null)} />
        )}
      </AnimatePresence>

      {/* ── CLOSE ENGAGEMENT MODAL ── */}
      <AnimatePresence>
        {showCloseModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setShowCloseModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowCloseModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl border border-border-light max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-medium"><Lock size={16} className="text-white" /></div>
                  <h3 className="text-[0.9375rem] font-bold text-text">Close Engagement</h3>
                </div>
                <div className="space-y-2 mb-5">
                  {[
                    { icon: Lock, label: 'Lock engagement permanently', desc: 'No further testing or evidence changes' },
                    { icon: FileText, label: 'Generate final working papers', desc: 'System compiles all round data and conclusions' },
                    { icon: Database, label: 'Freeze all execution data', desc: 'Samples, evidence, and results become immutable' },
                  ].map((step, i) => (
                    <motion.div key={step.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/50">
                      <div className="p-1.5 rounded-lg bg-brand-50 text-brand-700 shrink-0"><step.icon size={13} /></div>
                      <div><p className="text-[0.75rem] font-semibold text-text">{step.label}</p><p className="text-[0.625rem] text-text-muted">{step.desc}</p></div>
                    </motion.div>
                  ))}
                </div>
                <div className="p-3 bg-surface-2 rounded-xl mb-5 text-[0.75rem] space-y-1">
                  <div className="flex justify-between"><span className="text-text-muted">Concluded</span><span className="font-semibold text-compliant-700">{concluded}/{totalControls}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Effective</span><span className="font-semibold text-compliant-700">{sourceControls.filter(c => c.status === 'effective').length}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Ineffective</span><span className="font-semibold text-risk-700">{deficient}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Findings</span><span className="font-semibold text-text">{FINDINGS.length}</span></div>
                </div>
                <div className="flex items-center gap-3 justify-end">
                  <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 border border-border rounded-lg text-[0.75rem] font-medium text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">Cancel</button>
                  <button onClick={() => setShowCloseModal(false)} className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-medium hover:brightness-110 text-white rounded-xl text-[0.75rem] font-bold transition-all cursor-pointer flex items-center gap-2"><Lock size={13} />Close Engagement</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
