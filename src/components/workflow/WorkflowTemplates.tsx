import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, Activity, Eye,
  Zap, Shield, RefreshCw, Sparkles, Loader2, TrendingUp, TrendingDown,
  Clock, Lightbulb, ArrowRight, Play, Check, X, ChevronDown,
  FileText, Bot, Copy, Trash2, Edit3
} from 'lucide-react';
import { WORKFLOWS } from '../../data/mockData';
import { StatusBadge, TypeBadge } from '../shared/StatusBadge';
import BorderGlow from '../shared/BorderGlow';
import Gated from '../shared/Gated';
import { useCan } from '../../context/CurrentUserContext';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';

interface Props {
  onSelectWorkflow: (id: string) => void;
  onBuildNew: () => void;
  onRunWorkflow?: (id: string) => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  Detection: Zap,
  Monitoring: Eye,
  Compliance: Shield,
  Reconciliation: RefreshCw,
};

// Mock sparkline data for each workflow
const SPARKLINES: Record<string, number[]> = {
  'wf-001': [65, 72, 68, 85, 90, 88, 92, 95],
  'wf-002': [40, 55, 52, 60, 58, 65, 70, 68],
  'wf-003': [80, 75, 82, 78, 85, 90, 88, 92],
  'wf-004': [50, 60, 55, 70, 72, 68, 75, 80],
  'wf-005': [30, 45, 50, 65, 70, 75, 80, 85],
  'wf-006': [90, 88, 85, 82, 80, 78, 82, 85],
  'wf-007': [70, 72, 75, 78, 80, 82, 85, 88],
  'wf-008': [55, 60, 58, 65, 70, 68, 72, 78],
};

function MiniSparkline({ data, color = '#6a12cd' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const h = 28;
  const w = 64;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export default function WorkflowTemplates({ onSelectWorkflow, onBuildNew, onRunWorkflow }: Props) {
  const totalRuns = WORKFLOWS.reduce((a, w) => a + w.runs, 0);
  const avgScore = 82;

  const { addToast } = useToast();
  const { can } = useCan();
  const logEvent = useAuditLog();
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedWfs, setSelectedWfs] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [showBuildDropdown, setShowBuildDropdown] = useState(false);

  const filteredForBulk = bulkSearch
    ? WORKFLOWS.filter(w => w.name.toLowerCase().includes(bulkSearch.toLowerCase()))
    : WORKFLOWS;

  const toggleWf = (id: string) => {
    setSelectedWfs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkRun = () => {
    if (!can('wf_run')) { addToast({ message: 'You do not have permission to run workflows.', type: 'error' }); return; }
    setBulkRunning(true);
    addToast({ message: `Running ${selectedWfs.size} workflows...`, type: 'success' });
    logEvent({
      action: 'Run',
      description: `Bulk-ran ${selectedWfs.size} workflow${selectedWfs.size === 1 ? '' : 's'} and generated a consolidated report`,
      module: 'Workflow Library',
      entity: 'Workflow',
    });
    setTimeout(() => {
      addToast({ message: 'All workflows completed', type: 'success' });
      setTimeout(() => {
        addToast({ message: 'Consolidated report generated — view in Reports', type: 'success' });
        setBulkRunning(false);
        setBulkMode(false);
        setSelectedWfs(new Set());
      }, 1000);
    }, 2500);
  };

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.09} rotateOnHover hue={275} opacity={0.08} />
      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Workflow Intelligence</h1>
            <p className="text-sm text-text-secondary mt-1">Monitor, analyze, and optimize audit workflows</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                placeholder="Search workflows..."
                className="pl-9 pr-4 py-2 rounded-lg border border-border bg-white text-[0.8125rem] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 w-56 transition-all"
              />
            </div>
            <Gated permission="wf_run" mode="disable" title="You don't have permission to run workflows">
            <button
              onClick={() => { setBulkMode(p => !p); setSelectedWfs(new Set()); setBulkSearch(''); }}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-[0.8125rem] font-medium transition-all cursor-pointer ${
                bulkMode ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:bg-white'
              }`}
            >
              <Play size={14} />
              {bulkMode ? 'Cancel Bulk Run' : 'Bulk Run'}
            </button>
            </Gated>
            <div className="relative">
              <Gated permission="wf_create" mode="disable" title="You don't have permission to create workflows">
              <button
                onClick={() => setShowBuildDropdown(p => !p)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Build New
                <ChevronDown size={12} className={`transition-transform ${showBuildDropdown ? 'rotate-180' : ''}`} />
              </button>
              </Gated>
              <AnimatePresence>
                {showBuildDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowBuildDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.97 }}
                      className="absolute right-0 top-full mt-1 w-[200px] bg-white rounded-xl shadow-xl border border-border-light z-50 overflow-hidden"
                    >
                      <button
                        onClick={() => { setShowBuildDropdown(false); onBuildNew(); }}
                        className="w-full text-left px-4 py-3 hover:bg-primary-xlight transition-colors cursor-pointer flex items-center gap-2.5"
                      >
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><FileText size={13} /></div>
                        <div>
                          <div className="text-[0.75rem] font-semibold text-text">From Template</div>
                          <div className="text-[0.75rem] text-text-muted">Start from a template</div>
                        </div>
                      </button>
                      <div className="border-t border-border-light" />
                      <button
                        onClick={() => { setShowBuildDropdown(false); onBuildNew(); }}
                        className="w-full text-left px-4 py-3 hover:bg-primary-xlight transition-colors cursor-pointer flex items-center gap-2.5"
                      >
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Bot size={13} /></div>
                        <div>
                          <div className="text-[0.75rem] font-semibold text-text">With AI</div>
                          <div className="text-[0.75rem] text-text-muted">Describe in chat</div>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* AI Insight Banner */}
        <div className="bg-gradient-to-r from-primary-xlight via-white to-primary-xlight rounded-xl border border-primary/10 p-4 mb-6 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-medium flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[0.75rem] font-semibold text-text">Impact Intelligence</div>
            <div className="text-[0.75rem] text-text-secondary">
              Duplicate Invoice Detector saved <strong>$2.4M</strong> in potential overpayments this quarter. 3 workflows need attention.
            </div>
          </div>
          <div className="flex gap-6 shrink-0">
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-text">{WORKFLOWS.length}</div>
              <div className="text-[0.75rem] text-text-muted">Workflows</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-primary">{totalRuns}</div>
              <div className="text-[0.75rem] text-text-muted">Total Runs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-success">{avgScore}</div>
              <div className="text-[0.75rem] text-text-muted">Avg Score</div>
            </div>
          </div>
        </div>

        {/* AI Recommended Workflows */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={13} className="text-primary/60" />
            <span className="text-[0.75rem] font-semibold text-text-muted">AI Recommended for Your Audit</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: 'Vendor Bank Account Validator', desc: 'Cross-reference vendor bank details against known fraud databases before payment release', type: 'Detection', score: 96 },
              { name: 'Purchase Order Split Detector', desc: 'Identify PO splitting patterns that bypass approval thresholds', type: 'Compliance', score: 89 },
              { name: 'Intercompany Balance Reconciler', desc: 'Auto-reconcile intercompany balances across subsidiaries for R2R close', type: 'Reconciliation', score: 92 },
            ].map((rw, i) => {
              const TypeIcon = TYPE_ICONS[rw.type] || Activity;
              return (
                <motion.div
                  key={rw.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                >
                  <BorderGlow
                    borderRadius={16}
                    glowRadius={35}
                    glowIntensity={1}
                    coneSpread={30}
                    edgeSensitivity={40}
                    backgroundColor="#ffffff"
                    colors={['#6a12cd', '#9b59d6', '#c084fc']}
                  >
                    <div
                      className="p-5 relative cursor-pointer group rounded-2xl hover:shadow-sm active:scale-[0.98] transition-all"
                      onClick={onBuildNew}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                          <TypeIcon size={14} />
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5">
                          <Sparkles size={9} className="text-primary" />
                          <span className="text-[0.75rem] font-bold text-primary">{rw.score}% match</span>
                        </div>
                      </div>
                      <h4 className="text-[0.8125rem] font-semibold text-text group-hover:text-primary transition-colors mb-1.5">{rw.name}</h4>
                      <p className="text-[0.75rem] text-text-muted leading-relaxed">{rw.desc}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <TypeBadge type={rw.type} />
                        <span className="text-[0.75rem] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          Build <ArrowRight size={9} />
                        </span>
                      </div>
                    </div>
                  </BorderGlow>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bulk Run Panel */}
        <AnimatePresence>
          {bulkMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap size={15} className="text-primary" />
                    <span className="text-[0.875rem] font-semibold text-text">Select Workflows to Run</span>
                    <span className="text-[0.75rem] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{selectedWfs.size} selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      const all = new Set(filteredForBulk.map(w => w.id));
                      setSelectedWfs(prev => prev.size === all.size ? new Set() : all);
                    }} className="text-[0.75rem] text-primary font-medium hover:underline cursor-pointer">
                      {selectedWfs.size === filteredForBulk.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                {/* Search within bulk */}
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    value={bulkSearch}
                    onChange={e => setBulkSearch(e.target.value)}
                    placeholder="Search workflows to select..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-border-light text-[0.75rem] focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                    autoFocus
                  />
                  {bulkSearch && <button onClick={() => setBulkSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={13} className="text-text-muted" /></button>}
                </div>

                {/* Selectable workflow grid */}
                <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                  {filteredForBulk.map(wf => {
                    const isSelected = selectedWfs.has(wf.id);
                    return (
                      <button
                        key={wf.id}
                        onClick={() => toggleWf(wf.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-primary text-white' : 'bg-surface-2 border border-border'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-[0.75rem] font-semibold truncate ${isSelected ? 'text-primary' : 'text-text'}`}>{wf.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[0.75rem] text-text-muted">{wf.type}</span>
                            <span className={`text-[0.75rem] font-bold ${wf.status === 'active' ? 'text-compliant-700' : 'text-ink-500'}`}>●</span>
                            <span className="text-[0.75rem] text-text-muted">{wf.runs} runs</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Run button */}
                {selectedWfs.size > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-3">
                    <button
                      onClick={handleBulkRun}
                      disabled={bulkRunning}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover disabled:opacity-70 text-white rounded-xl text-[0.8125rem] font-semibold transition-all cursor-pointer shadow-md"
                    >
                      {bulkRunning ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <Loader2 size={15} />
                          </motion.div>
                          Running {selectedWfs.size} workflows...
                        </>
                      ) : (
                        <>
                          <Play size={15} />
                          Run {selectedWfs.size} Workflow{selectedWfs.size > 1 ? 's' : ''} + Generate Report
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Workflow Cards - list style */}
        <div className="space-y-3">
          {WORKFLOWS.map((wf, i) => {
            const Icon = TYPE_ICONS[wf.type] || Activity;
            const sparkData = SPARKLINES[wf.id] || [50, 60, 55, 70, 65, 72, 68, 75];
            const score = sparkData[sparkData.length - 1];
            const prevScore = sparkData[sparkData.length - 2];
            const delta = score - prevScore;
            const isUp = delta >= 0;

            return (
              <motion.div
                key={wf.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onSelectWorkflow(wf.id)}
                className="glass-card rounded-2xl p-5 cursor-pointer hover:shadow-primary/5 hover:border-primary/20 active:scale-[0.998] transition-all duration-300 group relative overflow-hidden"
              >
                {/* Bulk mode checkbox */}
                {bulkMode && (
                  <div className={`absolute top-3 right-3 w-5 h-5 rounded-md flex items-center justify-center z-10 ${
                    selectedWfs.has(wf.id) ? 'bg-primary text-white' : 'bg-white border-2 border-border'
                  }`} onClick={(e) => { e.stopPropagation(); toggleWf(wf.id); }}>
                    {selectedWfs.has(wf.id) && <Check size={12} />}
                  </div>
                )}

                {/* Top color strip on hover */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity ${
                  score >= 80 ? 'bg-compliant' :
                  score >= 60 ? 'bg-mitigated' :
                  'bg-risk'
                }`} />

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-primary-xlight text-primary shrink-0 mt-0.5 transition-transform duration-300">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold text-text group-hover:text-primary transition-colors">{wf.name}</h3>
                      <p className="text-[0.75rem] text-text-muted leading-relaxed mt-1 max-w-xl">{wf.desc}</p>
                    </div>
                  </div>

                  {/* Impact score ring */}
                  <div className="text-center shrink-0 ml-4 transition-transform duration-300">
                    <svg width="52" height="52" viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r="22" fill="none" stroke="#f1edf9" strokeWidth="4" />
                      <circle cx="26" cy="26" r="22" fill="none"
                        stroke={score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'}
                        strokeWidth="4"
                        strokeDasharray={`${score * 1.382} ${138.2 - score * 1.382}`}
                        strokeLinecap="round" transform="rotate(-90 26 26)" />
                      <text x="26" y="24" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0e0b1e">{score}</text>
                      <text x="26" y="34" textAnchor="middle" fontSize="7" fill="#9e96b8">SCORE</text>
                    </svg>
                  </div>
                </div>

                {/* Metrics strip */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { l: 'Total Runs', v: wf.runs, delta: '+3', up: true },
                    { l: 'Flags Raised', v: Math.round(wf.runs * 0.3), delta: '-2', up: false },
                    { l: 'Avg Duration', v: '1.8s', delta: '-0.2s', up: false },
                    { l: 'Success Rate', v: '98.5%', delta: '+0.5%', up: true },
                  ].map(m => (
                    <div key={m.l} className="bg-surface-2 rounded-lg p-3 border border-border-light">
                      <div className="text-[0.75rem] text-text-muted mb-1">{m.l}</div>
                      <div className="text-base font-bold font-mono text-text leading-none mb-1">{m.v}</div>
                      <div className={`text-[0.75rem] font-mono font-medium ${m.up ? 'text-success' : 'text-danger'}`}>
                        {m.delta}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom row: tags + sparkline + meta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={wf.type} />
                    <StatusBadge status={wf.status} />
                    <span className="text-[0.75rem] text-text-muted flex items-center gap-1">
                      <Clock size={10} />
                      {wf.lastRun}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[0.75rem] text-text-muted">7-day trend</div>
                    </div>
                    <MiniSparkline data={sparkData} color={isUp ? '#16a34a' : '#dc2626'} />
                    <div className={`flex items-center gap-0.5 text-[0.75rem] font-semibold font-mono ${isUp ? 'text-success' : 'text-danger'}`}>
                      {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {isUp ? '+' : ''}{delta}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border-light">
                  <Gated permission="wf_run" mode="disable" title="You don't have permission to run workflows">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRunWorkflow?.(wf.id); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[0.75rem] font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <Play size={11} /> Run
                  </button>
                  </Gated>
                  <Gated permission="wf_update_delete" mode="disable" title="You don't have permission to edit workflows">
                  <button
                    onClick={(e) => { e.stopPropagation(); onBuildNew(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-text-muted hover:text-primary hover:bg-primary-xlight rounded-lg text-[0.75rem] font-medium transition-colors cursor-pointer"
                  >
                    <Edit3 size={11} /> Edit
                  </button>
                  </Gated>
                  <Gated permission="wf_create" mode="disable" title="You don't have permission to create workflows">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToast({ message: `"${wf.name}" duplicated`, type: 'success' });
                      logEvent({ action: 'Create', description: `Duplicated workflow "${wf.name}"`, module: 'Workflow Library', entity: 'Workflow' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-text-muted hover:text-primary hover:bg-primary-xlight rounded-lg text-[0.75rem] font-medium transition-colors cursor-pointer"
                  >
                    <Copy size={11} /> Duplicate
                  </button>
                  </Gated>
                  <Gated permission="wf_update_delete" mode="disable" title="You don't have permission to delete workflows">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToast({ message: `"${wf.name}" deleted`, type: 'info' });
                      logEvent({ action: 'Delete', description: `Deleted workflow "${wf.name}"`, module: 'Workflow Library', entity: 'Workflow' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-text-muted hover:text-risk-700 hover:bg-risk-50 rounded-lg text-[0.75rem] font-medium transition-colors cursor-pointer ml-auto"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                  </Gated>
                </div>

                {/* Insight - show on first two */}
                {i < 2 && (
                  <div className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-[0.75rem] leading-relaxed ${
                    i === 0 ? 'bg-compliant-50 border border-compliant text-compliant-700' : 'bg-mitigated-50 border border-mitigated text-mitigated-700'
                  }`}>
                    <Sparkles size={12} className="shrink-0 mt-0.5" />
                    {i === 0 ? 'Detected 23% more duplicates after threshold adjustment. Recommend lowering fuzzy match tolerance from 85% to 80%.' :
                     'Vendor master change rate increased 40% — consider increasing monitoring frequency from daily to every 6 hours.'}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
