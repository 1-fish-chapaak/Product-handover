import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Search, Plus, X, Trash2, HelpCircle, ChevronRight,
} from 'lucide-react';
import { BUSINESS_PROCESSES, RACMS, RISKS, CONTROLS } from '../../data/mockData';
import type { UserProcess } from '../../hooks/useAppState';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import FloatingLines from '../shared/FloatingLines';
import { ChromaGrid, handleChromaCardMove } from '../reports/ChromaGrid';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubProcess { name: string; description: string; }

interface Props {
  selectedBPId: string | null;
  onSelectBP: (id: string | null) => void;
  onNavigateToExecution?: (engagementId: string) => void;
  userProcesses: UserProcess[];
  addUserProcess: (p: UserProcess) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const NEW_COLORS = ['#0891b2', '#c026d3', '#ea580c', '#4f46e5', '#16a34a', '#9333ea', '#e11d48', '#0d9488'];
const DEPARTMENTS = ['Finance', 'Procurement', 'Sales', 'HR', 'IT', 'Operations', 'Legal & Compliance', 'Other'];
const OWNERS = ['Tushar Goel', 'Deepak Bansal', 'Neha Joshi', 'Karan Mehta', 'Sneha Desai', 'Rohan Patel', 'Priya Singh'];
const inputCls = 'w-full px-3 py-2.5 border border-border rounded-[8px] text-[13px] text-text bg-white outline-none focus:border-primary/40 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[12px] font-semibold text-text-muted block mb-1.5';

function racmsForProcess(bpId: string) { return RACMS.filter(r => r.bpId === bpId).length; }

/** Coverage = % of this process's risks that have at least one mapped control. */
function coverageForProcess(bp: { id: string }) {
  const rs = RISKS.filter(r => r.bpId === bp.id);
  if (!rs.length) return 0;
  const ids = new Set(rs.map(r => r.id));
  const covered = new Set(CONTROLS.filter(c => ids.has(c.riskId)).map(c => c.riskId));
  return Math.round((covered.size / rs.length) * 100);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProgramsView({ onSelectBP, userProcesses, addUserProcess }: Props) {
  const { addToast } = useToast();
  const { can } = useCan();
  const [search, setSearch] = useState('');
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  const allProcesses: UserProcess[] = [
    ...BUSINESS_PROCESSES.map(bp => ({ ...bp, status: 'Active' as const })),
    ...userProcesses,
  ];

  const q = search.toLowerCase();
  const filteredProcesses = allProcesses.filter(bp =>
    !q || bp.name.toLowerCase().includes(q) || bp.abbr.toLowerCase().includes(q)
  );

  const handleCreateProcess = (newBP: UserProcess) => {
    addUserProcess(newBP);
    setShowCreateDrawer(false);
    addToast({ message: `"${newBP.name}" (${newBP.abbr}) created as Draft`, type: 'success' });
    onSelectBP(newBP.id);
  };

  const handleProcessClick = (bp: UserProcess) => {
    onSelectBP(bp.id);
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas relative">
      <div className="px-[124px] py-8 relative">
        {/* Header — full-bleed white strip, 124px side margins to match Reports. */}
        <div className="bg-white -mx-[124px] px-[124px] -mt-8 pt-8 pb-6 mb-4 border-b border-border relative overflow-hidden">
          {/* Ambient FloatingLines — same recipe as the Knowledge Hub / BP-detail
              header. Top/bottom waves, low-opacity texture; the absolute canvas
              paints behind the title, content stays in normal flow above it. */}
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />
          <h1 className="font-display text-[34px] font-[420] tracking-tight text-ink-900 leading-[1.15]">Process Hub</h1>
          <p className="text-[13px] text-text-secondary mt-2 max-w-md leading-relaxed">Track risk, control, and coverage across every business process you audit.</p>
        </div>

        {/* Toolbar — Search on the LEFT, New Process on the RIGHT. */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Search processes..." value={search} onChange={e => setSearch(e.target.value)}
              aria-label="Search processes"
              className="pl-9 pr-3 py-2 text-[12px] border border-canvas-border rounded-[8px] bg-paper-50 text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors w-48" />
          </div>
          {can('bp_create') && (
          <button type="button" onClick={() => setShowCreateDrawer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer shrink-0">
            <Plus size={14} />New Process
          </button>
          )}
        </div>

        {/* ── Process Grid ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          {filteredProcesses.length === 0 ? (
            <div className="bg-canvas-elevated border border-canvas-border rounded-[8px] p-10 text-center"><Building2 size={32} className="text-text-muted mx-auto mb-3" /><p className="text-[14px] font-semibold text-text mb-1">No processes found</p><p className="text-[12px] text-text-muted">Try adjusting your search.</p></div>
          ) : (
            <ChromaGrid className="grid grid-cols-1 md:grid-cols-2 gap-5" radius={320} damping={0.45} fadeOut={0.6}>
              {filteredProcesses.map((bp, i) => {
                const coverage = coverageForProcess(bp);
                return (
                  <motion.button type="button" key={bp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}
                    onClick={() => handleProcessClick(bp)}
                    onMouseMove={handleChromaCardMove}
                    className="chroma-card-lite text-left bg-canvas-elevated border border-canvas-border rounded-[12px] p-6 hover:border-brand-200 transition-colors cursor-pointer group">
                    {/* Identity row — abbr stamp + process name, with a quiet open affordance. */}
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-brand-50 text-brand-700 font-mono text-[12px] font-semibold tracking-tight shrink-0">{bp.abbr}</div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[16px] font-semibold text-ink-900 group-hover:text-brand-700 transition-colors truncate">{bp.name}</span>
                          {bp.status === 'Draft' && <span className="px-1.5 h-[18px] inline-flex items-center rounded-[5px] text-[9px] font-bold uppercase tracking-wide bg-paper-100 text-ink-500 shrink-0">Draft</span>}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                    </div>

                    {/* Metric row — coverage is the hero number; counts read like a ledger annotation. */}
                    <div className="flex items-end justify-between gap-4 mb-3">
                      <div>
                        <div className={`font-mono text-[26px] font-semibold tabular-nums leading-none ${coverage === 0 ? 'text-ink-400' : 'text-ink-900'}`}>{coverage}<span className="text-[15px] text-ink-400">%</span></div>
                        <span className="inline-flex items-center gap-1 group/tip relative text-[10.5px] uppercase tracking-wide text-ink-400 mt-2">
                          Coverage
                          <HelpCircle className="w-3 h-3 text-ink-300" aria-label="What is Coverage?" />
                          <span className="absolute bottom-full left-0 mb-1.5 w-[220px] p-2.5 rounded-[8px] bg-ink-800 text-paper-0 text-[12px] font-normal normal-case tracking-normal leading-snug opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
                            Percent of identified risks that have at least one linked control.
                          </span>
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5 text-[12px] text-ink-400 pb-0.5">
                        <span><span className="font-mono text-[13px] font-semibold tabular-nums text-ink-800">{bp.risks}</span> risks</span>
                        <span className="text-ink-300" aria-hidden>·</span>
                        <span><span className="font-mono text-[13px] font-semibold tabular-nums text-ink-800">{bp.controls}</span> controls</span>
                        <span className="text-ink-300" aria-hidden>·</span>
                        <span><span className="font-mono text-[13px] font-semibold tabular-nums text-ink-800">{racmsForProcess(bp.id)}</span> RACMs</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-paper-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${coverage}%` }} /></div>
                  </motion.button>
                );
              })}
            </ChromaGrid>
          )}
        </motion.div>
      </div>

      {/* Create drawer */}
      <AnimatePresence>
        {showCreateDrawer && (
          <CreateProcessDrawer
            existingCodes={allProcesses.map(p => p.abbr)}
            onClose={() => setShowCreateDrawer(false)}
            onCreate={handleCreateProcess}
            colorIndex={allProcesses.length}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Create Business Process Drawer
// ═════════════════════════════════════════════════════════════════════════════

function CreateProcessDrawer({ existingCodes, onClose, onCreate, colorIndex }: {
  existingCodes: string[];
  onClose: () => void;
  onCreate: (bp: UserProcess) => void;
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
              <div className="flex items-center gap-2"><Building2 size={18} className="text-brand-600" /><h2 className="font-display text-[18px] font-semibold text-ink-900 tracking-tight">Create Business Process</h2></div>
              <p className="text-[12px] text-ink-500 mt-0.5">Define a new business process as a taxonomy object.</p>
            </div>
            <button type="button" aria-label="Close drawer" onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
          <div className="mb-3"><label className={labelCls}>Process Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Procure to Pay" className={inputCls} /></div>
          <div className="mb-3">
            <label className={labelCls}>Process Code *</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="e.g. P2P" maxLength={6} className={`${inputCls} font-mono uppercase ${isDuplicate ? 'border-risk focus:border-risk' : ''}`} />
            {isDuplicate && <p className="text-[10px] text-risk-700 mt-0.5 px-1">Code "{codeUpper}" already exists.</p>}
            {!isDuplicate && codeUpper.length > 0 && <p className="text-[10px] text-compliant-700 mt-0.5 px-1">Code available</p>}
          </div>
          <div className="mb-3"><label className={labelCls}>Function / Department *</label><select value={department} onChange={e => setDepartment(e.target.value)} className={selectCls}><option value="">Select department...</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="mb-3"><label className={labelCls}>Process Owner *</label><select value={owner} onChange={e => setOwner(e.target.value)} className={selectCls}>{OWNERS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="mb-3"><label className={labelCls}>Financial Year / Period</label><input type="text" value={fy} onChange={e => setFy(e.target.value)} className={inputCls} /></div>
          <div className="mb-3"><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Describe what this process covers." className={inputCls + ' resize-none'} /></div>
          <div className="mb-4">
            <label className={labelCls}>Status</label>
            <div className="flex gap-2">
              {(['Draft', 'Active', 'Archived'] as const).map(s => (
                <button type="button" key={s} onClick={() => setStatus(s)} className={`px-4 py-2 rounded-[8px] border text-[12px] font-medium transition-all cursor-pointer ${status === s ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' mb-0'}>Sub-processes</label>
              <button type="button" onClick={addSubProcess} className="text-[11px] font-semibold text-brand-600 hover:underline cursor-pointer flex items-center gap-1"><Plus size={11} />Add row</button>
            </div>
            <div className="space-y-2">
              {subProcesses.map((sp, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input type="text" value={sp.name} onChange={e => updateSubProcess(idx, 'name', e.target.value)}
                      placeholder={`Sub-process name (e.g. ${['Vendor onboarding', 'Purchase order creation', 'Goods receipt', 'Invoice processing', 'Payment release'][idx] || 'Sub-process'})`}
                      className="w-full px-2.5 py-2 border border-border rounded-[8px] text-[12px] text-text bg-white outline-none focus:border-primary/40 transition-all" />
                    <input type="text" value={sp.description} onChange={e => updateSubProcess(idx, 'description', e.target.value)}
                      placeholder="Brief description (optional)"
                      className="w-full px-2.5 py-1.5 border border-border/60 rounded-[8px] text-[11px] text-text-muted bg-white outline-none focus:border-primary/40 transition-all" />
                  </div>
                  {subProcesses.length > 1 && (
                    <button type="button" aria-label="Remove sub-process" onClick={() => removeSubProcess(idx)} className="p-1.5 mt-1 rounded-[6px] hover:bg-risk-50 text-ink-400 hover:text-risk-700 transition-colors cursor-pointer shrink-0"><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-[8px] border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={!isValid} className="px-5 py-2.5 rounded-[8px] bg-brand-600 hover:bg-brand-500 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">New Process</button>
        </footer>
      </motion.aside>
    </>
  );
}
