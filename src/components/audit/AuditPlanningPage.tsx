import DatePicker from '../shared/DatePicker';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, ClipboardList, Plus, X, User, Clock,
  Shield, ChevronRight, Search, Eye, Pencil, Play,
  Info, ClipboardCheck, ArrowUpRight,
} from 'lucide-react';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';

// ─── Types ──────────────────────────────────────────────────────────────────

type PlanningTab = 'timeline' | 'engagement-plan';
type EngStatus = 'Planned' | 'Active' | 'In Progress' | 'Review' | 'Closed' | 'Draft';

interface TimelineEngagement {
  id: string;
  name: string;
  auditType: string;
  process: string;
  start: number; // month index (0=Apr)
  duration: number; // months
  color: string;
  status: EngStatus;
  owner: string;
  startDate: string;
  endDate: string;
  controls: number;
  framework: string;
  progress?: number; // 0-100
  atRisk?: boolean;
}

interface Props {
  onNavigateToExecution?: (engagementId: string) => void;
  onOpenEngagements?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const PROCESSES = ['P2P', 'O2C', 'R2R', 'S2C', 'ITGC'];
const STATUSES: EngStatus[] = ['Active', 'In Progress', 'Planned', 'Review', 'Draft', 'Closed'];
const OWNERS = ['Tushar Goel', 'Neha Joshi', 'Karan Mehta', 'Rohan Patel', 'Sneha Desai', 'Deepak Bansal', 'Priya Singh'];

const PROCESS_COLORS: Record<string, string> = {
  P2P: '#6a12cd', O2C: '#0284c7', R2R: '#d97706', S2C: '#059669', ITGC: '#7c3aed',
};

const STATUS_BAR_OPACITY: Record<string, number> = {
  Active: 0.9, 'In Progress': 0.85, Review: 0.75, Planned: 0.55, Draft: 0.35, Closed: 0.3,
};

const STATUS_CLS: Record<string, string> = {
  Active: 'bg-compliant-50 text-compliant-700',
  'In Progress': 'bg-evidence-50 text-evidence-700',
  Review: 'bg-mitigated-50 text-mitigated-700',
  Planned: 'bg-brand-50 text-brand-700',
  Draft: 'bg-draft-50 text-draft-700',
  Closed: 'bg-canvas text-ink-600',
};

const SEED_ENGAGEMENTS: TimelineEngagement[] = [
  { id: 'tl-1', name: 'P2P — SOX Audit', auditType: 'Financial Internal Control', process: 'P2P', start: 0, duration: 3, color: PROCESS_COLORS.P2P, status: 'Active', owner: 'Tushar Goel', startDate: 'Apr 1, 2025', endDate: 'Jun 30, 2025', controls: 24, framework: 'SOX ICFR', progress: 75, atRisk: true },
  { id: 'tl-2', name: 'O2C — SOX Audit', auditType: 'Financial Internal Control', process: 'O2C', start: 1, duration: 3, color: PROCESS_COLORS.O2C, status: 'Active', owner: 'Neha Joshi', startDate: 'May 1, 2025', endDate: 'Jul 31, 2025', controls: 18, framework: 'SOX ICFR', progress: 44 },
  { id: 'tl-3', name: 'R2R — SOX Audit', auditType: 'Financial Internal Control', process: 'R2R', start: 0, duration: 5, color: PROCESS_COLORS.R2R, status: 'In Progress', owner: 'Karan Mehta', startDate: 'Apr 1, 2025', endDate: 'Aug 31, 2025', controls: 31, framework: 'SOX ICFR', progress: 84, atRisk: true },
  { id: 'tl-4', name: 'S2C — Contract Review', auditType: 'Internal Audit', process: 'S2C', start: 3, duration: 3, color: PROCESS_COLORS.S2C, status: 'Planned', owner: 'Rohan Patel', startDate: 'Jul 1, 2025', endDate: 'Sep 30, 2025', controls: 14, framework: 'Internal Policy', progress: 0 },
  { id: 'tl-5', name: 'P2P — IFC Assessment', auditType: 'Financial Internal Control', process: 'P2P', start: 4, duration: 3, color: PROCESS_COLORS.P2P, status: 'Planned', owner: 'Sneha Desai', startDate: 'Aug 1, 2025', endDate: 'Oct 31, 2025', controls: 18, framework: 'IFC', progress: 0 },
  { id: 'tl-6', name: 'IT General Controls', auditType: 'IT Audit', process: 'ITGC', start: 2, duration: 8, color: PROCESS_COLORS.ITGC, status: 'Active', owner: 'Deepak Bansal', startDate: 'Jun 1, 2025', endDate: 'Jan 31, 2026', controls: 15, framework: 'ISO 27001', progress: 60 },
  { id: 'tl-7', name: 'Vendor Risk Assessment', auditType: 'Operational Audit', process: 'P2P', start: 6, duration: 2, color: PROCESS_COLORS.P2P, status: 'Draft', owner: 'Priya Singh', startDate: 'Oct 1, 2025', endDate: 'Nov 30, 2025', controls: 8, framework: 'Internal Policy', progress: 0 },
  { id: 'tl-8', name: 'Year-End Close Review', auditType: 'Financial Internal Control', process: 'R2R', start: 8, duration: 3, color: PROCESS_COLORS.R2R, status: 'Planned', owner: 'Karan Mehta', startDate: 'Dec 1, 2025', endDate: 'Feb 28, 2026', controls: 12, framework: 'SOX ICFR', progress: 0 },
  { id: 'tl-9', name: 'O2C — Revenue Review', auditType: 'Compliance Audit', process: 'O2C', start: 6, duration: 4, color: PROCESS_COLORS.O2C, status: 'Review', owner: 'Neha Joshi', startDate: 'Oct 1, 2025', endDate: 'Jan 31, 2026', controls: 10, framework: 'SOX ICFR', progress: 90 },
];

// "Today" position — Apr 28, 2026 is month index ~12 (end of FY), but for demo use month 1 (May area)
const TODAY_MONTH_INDEX = 1.9; // Roughly late May 2025 for visual demo

// ─── Component ──────────────────────────────────────────────────────────────

const RACM_OPTIONS = ['RACM v2.1 (Current — Feb 2026)', 'RACM v2.0 (Nov 2025)', 'RACM v1.9 (Aug 2025)', 'RACM v1.8 (May 2025)'];
const AUDIT_TYPES_LIST = ['Financial Internal Control', 'Operational Audit', 'Compliance Audit', 'IT Audit', 'Concurrent Audit', 'Internal Audit', 'Other'];
const FRAMEWORK_LIST = ['SOX ICFR', 'IFC', 'COSO', 'SOC 1', 'SOC 2', 'ISO 27001', 'Internal Policy', 'Custom'];

export default function AuditPlanningPage({ onNavigateToExecution, onOpenEngagements }: Props) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [activeTab, setActiveTab] = useState<PlanningTab>('timeline');

  // Stateful engagement list
  const [engagements, setEngagements] = useState<TimelineEngagement[]>(SEED_ENGAGEMENTS);
  const [showPlanDrawer, setShowPlanDrawer] = useState(false);

  const handleCreateEngagement = (eng: TimelineEngagement) => {
    setEngagements(prev => [...prev, eng]);
    setShowPlanDrawer(false);
    addToast({ message: `"${eng.name}" planned — visible on timeline and engagement list`, type: 'success' });
    logEvent({ action: 'Create', description: `Planned engagement "${eng.name}"`, module: 'Engagements', entity: 'Engagement' });
  };

  // Filters
  const [processFilter, setProcessFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Collapse state for groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (p: string) => setCollapsedGroups(prev => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  // Tooltip / Preview
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [previewEng, setPreviewEng] = useState<TimelineEngagement | null>(null);

  // Filtered data
  const filtered = useMemo(() => {
    return engagements.filter(e => {
      if (processFilter !== 'All' && e.process !== processFilter) return false;
      if (statusFilter !== 'All' && e.status !== statusFilter) return false;
      return true;
    });
  }, [engagements, processFilter, statusFilter]);

  // Group by process
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEngagement[]>();
    PROCESSES.forEach(p => map.set(p, []));
    filtered.forEach(e => {
      const list = map.get(e.process) || [];
      list.push(e);
      map.set(e.process, list);
    });
    return Array.from(map.entries()).filter(([, engs]) => engs.length > 0);
  }, [filtered]);

  const hoveredEng = hoveredId ? engagements.find(e => e.id === hoveredId) : null;

  const tabs: { id: PlanningTab; label: string; icon: React.ElementType }[] = [
    { id: 'timeline', label: 'Timeline View', icon: Calendar },
  ];

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />

      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-medium text-white"><Calendar size={16} /></div>
              <h1 className="text-xl font-bold text-text">Audit Planning</h1>
            </div>
            <p className="text-sm text-text-secondary mt-1 ml-9">Plan, schedule, and manage audit engagements across processes.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenEngagements && (
              <button onClick={onOpenEngagements}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[0.75rem] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
                title="Open the engagements list">
                <ClipboardCheck size={13} />
                Engagements
                <ArrowUpRight size={12} />
              </button>
            )}
            {activeTab === 'timeline' && (
              <button onClick={() => setShowPlanDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                <Plus size={14} />Plan Engagement
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-border-light mb-5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}>
                <Icon size={14} />{tab.label}
              </button>
            );
          })}
        </div>

        {/* ══ TIMELINE VIEW ══ */}
        {activeTab === 'timeline' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>

            {/* Filters — simple pills */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[0.6875rem] font-bold text-text-muted">Process:</span>
                <div className="flex gap-1">
                  {['All', ...PROCESSES].map(p => (
                    <button key={p} onClick={() => setProcessFilter(p)}
                      className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${
                        processFilter === p ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                      }`}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="w-px h-5 bg-border-light" />
              <div className="flex items-center gap-2">
                <span className="text-[0.6875rem] font-bold text-text-muted">Status:</span>
                <div className="flex gap-1">
                  {['All', 'Active', 'In Progress', 'Planned', 'Review'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${
                        statusFilter === s ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gantt chart */}
            <div className="glass-card overflow-hidden relative">
              {/* Month header */}
              <div className="flex border-b border-border bg-surface-2/50 sticky top-0 z-10">
                <div className="w-[200px] shrink-0 px-4 py-2.5 text-[0.625rem] font-semibold text-text-muted uppercase">Process / Engagement</div>
                <div className="flex-1 flex relative">
                  {MONTHS.map(m => (
                    <div key={m} className="flex-1 text-center py-2.5 text-[0.625rem] font-semibold text-text-muted border-l border-border/20">{m}</div>
                  ))}
                </div>
              </div>

              {/* Grouped rows */}
              {grouped.length === 0 ? (
                <div className="px-4 py-10 text-center text-[0.75rem] text-text-muted">No engagements match filters</div>
              ) : (
                grouped.map(([process, engs]) => {
                  const isCollapsed = collapsedGroups.has(process);
                  return (
                    <div key={process}>
                      {/* Process group header — clickable to expand/collapse */}
                      <div className="flex items-center bg-surface-2/30 border-b border-border/30 cursor-pointer hover:bg-surface-2/50 transition-colors"
                        onClick={() => toggleGroup(process)}>
                        <div className="w-[200px] shrink-0 px-4 py-2 flex items-center gap-2">
                          <ChevronRight size={12} className={`text-ink-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                          <div className="w-3 h-3 rounded" style={{ background: PROCESS_COLORS[process] }} />
                          <span className="text-[0.6875rem] font-bold text-text">{process}</span>
                          <span className="text-[0.625rem] text-text-muted">({engs.length})</span>
                        </div>
                        <div className="flex-1 flex relative">
                          {MONTHS.map(m => <div key={m} className="flex-1 border-l border-border/10 h-6" />)}
                          {/* Today line on header */}
                          <div className="absolute top-0 bottom-0 w-px bg-risk/40 z-[5]" style={{ left: `${(TODAY_MONTH_INDEX / 12) * 100}%` }} />
                        </div>
                      </div>

                      {/* Engagement rows — hidden when collapsed */}
                      <AnimatePresence>
                        {!isCollapsed && engs.map((eng, i) => {
                          const pct = eng.progress ?? 0;
                          return (
                            <motion.div key={eng.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.12 }}
                              className="flex border-b border-border/20 hover:bg-primary-xlight/20 transition-colors">
                              <div className="w-[200px] shrink-0 px-4 py-2.5 pl-10 flex items-center gap-2 min-w-0">
                                {eng.atRisk && <div className="w-2 h-2 rounded-full bg-risk shrink-0 animate-pulse" title="At Risk" />}
                                <div className="min-w-0 flex-1">
                                  <div className="text-[0.6875rem] font-medium text-text truncate">{eng.name}</div>
                                  <div className="text-[0.5625rem] text-text-muted">{eng.owner}</div>
                                </div>
                              </div>
                              <div className="flex-1 flex items-center relative py-1.5"
                                onMouseEnter={() => setHoveredId(eng.id)}
                                onMouseLeave={() => setHoveredId(null)}>
                                {/* Faint grid */}
                                {MONTHS.map((_, mi) => <div key={mi} className="flex-1 border-l border-border/8 h-full" />)}
                                {/* Today line */}
                                <div className="absolute top-0 bottom-0 w-px bg-risk/30 z-[5]" style={{ left: `${(TODAY_MONTH_INDEX / 12) * 100}%` }} />
                                {/* Engagement bar */}
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 h-7 rounded-lg overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
                                  style={{
                                    left: `${(eng.start / 12) * 100}%`,
                                    width: `${(eng.duration / 12) * 100}%`,
                                  }}
                                  onClick={() => setPreviewEng(eng)}
                                  onMouseMove={e => setHoverPos({ x: e.clientX, y: e.clientY })}
                                >
                                  {/* Bar background */}
                                  <div className="absolute inset-0 rounded-lg" style={{ background: eng.color, opacity: STATUS_BAR_OPACITY[eng.status] || 0.7 }} />
                                  {/* Progress fill (darker overlay from left) */}
                                  {pct > 0 && pct < 100 && (
                                    <div className="absolute top-0 bottom-0 left-0 rounded-l-lg bg-black/15" style={{ width: `${pct}%` }} />
                                  )}
                                  {/* Content */}
                                  <div className="relative flex items-center gap-1.5 px-2 h-full z-[1]">
                                    <span className="text-[0.5625rem] font-bold text-white truncate">{eng.name.split('—')[0].trim()}</span>
                                    {pct > 0 && <span className="text-[0.5rem] font-bold text-white/70 tabular-nums shrink-0">{pct}%</span>}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}

              {/* Legend */}
              <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-surface-2/30">
                {STATUSES.filter(s => engagements.some(e => e.status === s)).map(s => (
                  <span key={s} className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${STATUS_CLS[s]}`}>{s}</span>
                ))}
                <span className="inline-flex items-center gap-1 ml-2"><div className="w-2 h-2 rounded-full bg-risk" /><span className="text-[0.5625rem] text-text-muted">At Risk</span></span>
                <span className="ml-auto text-[0.625rem] text-text-muted">FY: April 2025 — March 2026</span>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-5 gap-3 mt-5">
              {[
                { label: 'Total', value: filtered.length, color: 'text-brand-700' },
                { label: 'Active', value: filtered.filter(e => e.status === 'Active').length, color: 'text-compliant-700' },
                { label: 'In Progress', value: filtered.filter(e => e.status === 'In Progress').length, color: 'text-evidence-700' },
                { label: 'Planned', value: filtered.filter(e => e.status === 'Planned').length, color: 'text-brand-700' },
                { label: 'At Risk', value: filtered.filter(e => e.atRisk).length, color: 'text-risk-700' },
              ].map((kpi, i) => (
                <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}
                  className="glass-card p-3 text-center">
                  <div className={`text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-[0.625rem] text-text-muted mt-0.5">{kpi.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Hover Tooltip */}
            <AnimatePresence>
              {hoveredEng && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
                  className="fixed z-50 pointer-events-none" style={{ left: hoverPos.x + 12, top: hoverPos.y - 90 }}>
                  <div className="bg-ink-900 text-white rounded-xl shadow-xl px-4 py-3 min-w-[220px]">
                    <div className="text-[0.75rem] font-semibold mb-1.5">{hoveredEng.name}</div>
                    <div className="space-y-1 text-[0.625rem]">
                      <div className="flex items-center justify-between"><span className="text-white/60">Process</span><span>{hoveredEng.process}</span></div>
                      <div className="flex items-center justify-between"><span className="text-white/60">Dates</span><span>{hoveredEng.startDate} — {hoveredEng.endDate}</span></div>
                      <div className="flex items-center justify-between"><span className="text-white/60">Owner</span><span>{hoveredEng.owner}</span></div>
                      <div className="flex items-center justify-between"><span className="text-white/60">Status</span>
                        <span className="flex items-center gap-1">
                          {hoveredEng.atRisk && <span className="w-2 h-2 rounded-full bg-risk" />}
                          <span className={`px-1.5 h-4 rounded text-[0.5625rem] font-bold inline-flex items-center ${STATUS_CLS[hoveredEng.status]}`}>{hoveredEng.status}</span>
                        </span>
                      </div>
                      {(hoveredEng.progress ?? 0) > 0 && <div className="flex items-center justify-between"><span className="text-white/60">Progress</span><span>{hoveredEng.progress}%</span></div>}
                    </div>
                    <div className="text-[0.5625rem] text-white/40 mt-2">Click bar to preview</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ══ ENGAGEMENT PLAN ══ */}
        {activeTab === 'engagement-plan' && (
          <EngagementPlanTab
            onNavigateToExecution={onNavigateToExecution}
            engagements={engagements}
            onPlanNew={() => setShowPlanDrawer(true)}
            onActivate={(id) => {
              const eng = engagements.find(e => e.id === id);
              setEngagements(prev => prev.map(e => e.id === id ? { ...e, status: 'Active' as EngStatus } : e));
              addToast({ message: 'Engagement activated — now visible in execution workspace', type: 'success' });
              logEvent({ action: 'Update', description: `Activated engagement "${eng?.name ?? id}"`, module: 'Engagements', entity: 'Engagement' });
            }}
          />
        )}
      </div>

      {/* ── Engagement Preview Drawer ── */}
      <AnimatePresence>
        {previewEng && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={() => setPreviewEng(null)} />
            <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-[420px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
              role="dialog" aria-label="Engagement Preview">
              <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded" style={{ background: previewEng.color }} />
                      <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${STATUS_CLS[previewEng.status]}`}>{previewEng.status}</span>
                    </div>
                    <h2 className="text-[1.0625rem] font-semibold text-ink-900">{previewEng.name}</h2>
                  </div>
                  <button onClick={() => setPreviewEng(null)} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Audit Type', value: previewEng.auditType },
                    { label: 'Framework', value: previewEng.framework },
                    { label: 'Process', value: previewEng.process },
                    { label: 'Controls', value: String(previewEng.controls) },
                    { label: 'Start Date', value: previewEng.startDate },
                    { label: 'End Date', value: previewEng.endDate },
                    { label: 'Owner', value: previewEng.owner },
                    { label: 'Duration', value: `${previewEng.duration} months` },
                  ].map(d => (
                    <div key={d.label}>
                      <span className="text-[0.625rem] text-ink-400 uppercase">{d.label}</span>
                      <div className="text-[0.8125rem] font-medium text-text mt-0.5">{d.value}</div>
                    </div>
                  ))}
                </div>

                {/* Timeline bar preview */}
                <div>
                  <span className="text-[0.625rem] text-ink-400 uppercase block mb-2">Timeline Position</span>
                  <div className="rounded-lg bg-surface-2 p-3">
                    <div className="flex text-[0.5625rem] text-ink-400 mb-1">
                      {MONTHS.map(m => <div key={m} className="flex-1 text-center">{m}</div>)}
                    </div>
                    <div className="relative h-6 bg-white rounded-full overflow-hidden">
                      <div className="absolute top-0 bottom-0 rounded-full" style={{
                        left: `${(previewEng.start / 12) * 100}%`,
                        width: `${(previewEng.duration / 12) * 100}%`,
                        background: previewEng.color,
                        opacity: 0.85,
                      }} />
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="space-y-2">
                  <button onClick={() => { setPreviewEng(null); if (onNavigateToExecution) onNavigateToExecution(previewEng.id); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-primary/20 hover:bg-primary-xlight/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-2"><Shield size={14} className="text-primary" /><span className="text-[0.75rem] font-medium text-text">Open Execution Workspace</span></div>
                    <ChevronRight size={14} className="text-ink-300" />
                  </button>
                </div>
              </div>

              <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas">
                <button onClick={() => setPreviewEng(null)} className="w-full px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Close</button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Plan Engagement Drawer ── */}
      <AnimatePresence>
        {showPlanDrawer && (
          <PlanEngagementDrawer
            onClose={() => setShowPlanDrawer(false)}
            onCreate={handleCreateEngagement}
            existingCount={engagements.length}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Plan Engagement Drawer (4-step wizard)
// ═════════════════════════════════════════════════════════════════════════════

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1.5';
const STEP_LABELS = ['Basic Info', 'Planning', 'Scope', 'Confirm'];

function PlanEngagementDrawer({ onClose, onCreate, existingCount }: {
  onClose: () => void;
  onCreate: (eng: TimelineEngagement) => void;
  existingCount: number;
}) {
  const [name, setName] = useState('');
  const [process, setProcess] = useState('P2P');
  const [auditType, setAuditType] = useState('Financial Internal Control');
  const [framework, setFramework] = useState('SOX ICFR');
  const [owner, setOwner] = useState(OWNERS[0]);
  const [reviewer, setReviewer] = useState(OWNERS[3]);
  const [startDate, setStartDate] = useState('2025-04-01');
  const [endDate, setEndDate] = useState('2026-03-31');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [racmVersion, setRacmVersion] = useState(RACM_OPTIONS[0]);
  const [description, setDescription] = useState('');

  const isSox = framework === 'SOX ICFR';
  const isValid = name.trim().length > 0 && plannedStart && plannedEnd && owner && (!isSox || reviewer);

  function monthIndex(dateStr: string): number {
    if (!dateStr) return 0;
    const m = new Date(dateStr).getMonth();
    const fyMap: Record<number, number> = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 0: 9, 1: 10, 2: 11 };
    return fyMap[m] ?? 0;
  }
  function monthDiff(s: string, e: string): number {
    if (!s || !e) return 3;
    return Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
  }
  function fmtDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const handleCreate = () => {
    if (!isValid) return;
    onCreate({
      id: `tl-new-${Date.now()}`, name, auditType, process,
      start: monthIndex(plannedStart), duration: monthDiff(plannedStart, plannedEnd),
      color: PROCESS_COLORS[process] || '#6a12cd', status: 'Planned', owner,
      startDate: fmtDate(plannedStart), endDate: fmtDate(plannedEnd), controls: 0, framework,
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Plan Engagement">

        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Calendar size={18} className="text-brand-600" /><h2 className="text-[1.125rem] font-semibold text-ink-900">Plan Engagement</h2></div>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">Create a new audit engagement. All controls will start fresh after activation.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
          {/* Name */}
          <div className="mb-3"><label className={labelCls}>Engagement Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. P2P — SOX Audit FY27" className={inputCls} autoFocus /></div>

          {/* Audit Type */}
          <div className="mb-3">
            <label className={labelCls}>Audit Type *</label>
            <select value={auditType} onChange={e => setAuditType(e.target.value)} className={selectCls}>{AUDIT_TYPES_LIST.map(t => <option key={t} value={t}>{t}</option>)}</select>
            <p className="text-[0.625rem] text-text-muted mt-0.5 px-1">Audit type defines the nature of the audit.</p>
          </div>

          {/* Framework */}
          <div className="mb-3">
            <label className={labelCls}>Framework / Compliance Scope *</label>
            <select value={framework} onChange={e => setFramework(e.target.value)} className={selectCls}>{FRAMEWORK_LIST.map(f => <option key={f} value={f}>{f}</option>)}</select>
            <p className="text-[0.625rem] text-text-muted mt-0.5 px-1">Framework defines the compliance or assurance standard.</p>
          </div>

          {/* SOX Enforcement */}
          <div className={`mb-3 rounded-xl border px-4 py-3 ${isSox ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface-2/50'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.6875rem] font-bold text-text-muted uppercase">SOX Enforcement</span>
              {isSox
                ? <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.625rem] font-bold bg-brand-100 text-brand-700">Enabled</span>
                : <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.625rem] font-medium bg-canvas text-ink-500">Disabled</span>}
            </div>
            {isSox
              ? <p className="text-[0.625rem] text-brand-700 leading-relaxed">Reviewer approval, evidence requirements, key-control validation, and period locking will be enforced.</p>
              : <p className="text-[0.625rem] text-text-muted leading-relaxed">Standard engagement rules will apply.</p>}
            <p className="text-[0.5625rem] text-text-muted mt-1 italic">SOX enforcement is driven by framework, not audit type.</p>
          </div>

          {/* Business Process */}
          <div className="mb-3">
            <label className={labelCls}>Primary Business Process / Domain *</label>
            <select value={process} onChange={e => setProcess(e.target.value)} className={selectCls}>{PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}</select>
            <p className="text-[0.625rem] text-text-muted mt-0.5 px-1">Used for planning and filtering. Execution scope comes from linked RACM.</p>
          </div>

          {/* Audit Period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="mb-3"><label className={labelCls}>Audit Period Start *</label><DatePicker value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} /></div>
            <div className="mb-3"><label className={labelCls}>Audit Period End *</label><DatePicker value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} /></div>
          </div>

          {/* Planned Start/End */}
          <div className="grid grid-cols-2 gap-3">
            <div className="mb-3"><label className={labelCls}>Planned Start *</label><DatePicker value={plannedStart} onChange={e => setPlannedStart(e.target.value)} className={inputCls} /></div>
            <div className="mb-3"><label className={labelCls}>Planned End *</label><DatePicker value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} className={inputCls} /></div>
          </div>

          {/* Owner & Reviewer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="mb-3"><label className={labelCls}>Owner *</label><select value={owner} onChange={e => setOwner(e.target.value)} className={selectCls}>{OWNERS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
            <div className="mb-3"><label className={labelCls}>Reviewer {isSox ? '*' : ''}</label><select value={reviewer} onChange={e => setReviewer(e.target.value)} className={selectCls}>{[...OWNERS, 'Abhinav S'].map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          </div>

          {/* RACM Version */}
          <div className="mb-3"><label className={labelCls}>RACM Version *</label><select value={racmVersion} onChange={e => setRacmVersion(e.target.value)} className={selectCls}>{RACM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>

          {/* Description */}
          <div className="mb-3"><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the scope and objectives..." className={inputCls + ' resize-none'} /></div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleCreate} disabled={!isValid}
            className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            Create Engagement
          </button>
        </footer>
      </motion.aside>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Engagement Plan Tab
// ═════════════════════════════════════════════════════════════════════════════

type PlanStatus = 'Draft' | 'Planned' | 'Approved' | 'Active' | 'Closed';

interface PlanRow {
  id: string;
  name: string;
  process: string;
  auditType: string;
  framework: string;
  startDate: string;
  endDate: string;
  owner: string;
  status: PlanStatus;
  racm: string;
  controls: number;
  color: string;
}

const PLAN_STATUS_CLS: Record<PlanStatus, string> = {
  Draft: 'bg-draft-50 text-draft-700',
  Planned: 'bg-brand-50 text-brand-700',
  Approved: 'bg-evidence-50 text-evidence-700',
  Active: 'bg-compliant-50 text-compliant-700',
  Closed: 'bg-canvas text-ink-600',
};

function toPlanRow(e: TimelineEngagement): PlanRow {
  const statusMap: Record<string, PlanStatus> = {
    Active: 'Active', 'In Progress': 'Active', Review: 'Active', Planned: 'Planned', Draft: 'Draft', Closed: 'Closed',
  };
  return {
    id: e.id, name: e.name, process: e.process, auditType: e.auditType,
    framework: e.framework, startDate: e.startDate, endDate: e.endDate,
    owner: e.owner, status: statusMap[e.status] || 'Draft',
    racm: `RACM ${e.framework === 'SOX ICFR' ? 'v2.1' : 'v1.8'}`,
    controls: e.controls, color: e.color,
  };
}

function EngagementPlanTab({ onNavigateToExecution, engagements, onPlanNew, onActivate }: {
  onNavigateToExecution?: (id: string) => void;
  engagements: TimelineEngagement[];
  onPlanNew?: () => void;
  onActivate?: (id: string) => void;
}) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlanStatus | 'All'>('All');
  const [detailRow, setDetailRow] = useState<PlanRow | null>(null);

  const rows = useMemo(() => engagements.map(toPlanRow), [engagements]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.process.toLowerCase().includes(q) && !r.owner.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  function getAction(r: PlanRow): { label: string; icon: React.ElementType; cls: string } {
    if (r.status === 'Active') return { label: 'View', icon: Eye, cls: 'bg-primary/10 text-primary hover:bg-primary/15' };
    if (r.status === 'Approved' || r.status === 'Planned') return { label: 'Activate', icon: Play, cls: 'bg-brand-50 text-brand-700 hover:bg-brand-50/80' };
    return { label: 'Edit', icon: Pencil, cls: 'bg-draft-50 text-draft-700 hover:bg-draft-50/80' };
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search engagements..."
              className="pl-8 pr-3 py-2 text-[0.75rem] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 transition-colors w-52" />
          </div>
          <div className="flex gap-1">
            {(['All', 'Draft', 'Planned', 'Approved', 'Active', 'Closed'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${
                  statusFilter === s ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                }`}>{s}</button>
            ))}
          </div>
        </div>
        <button onClick={() => onPlanNew?.()}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
          <Plus size={14} />Plan Engagement
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.75rem]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                {['Engagement Name', 'Process', 'Audit Type', 'Framework', 'Planned Start', 'Planned End', 'Owner', 'Status', 'Linked RACM', 'Action'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-[0.75rem] text-text-muted">No engagements match your filters.</td></tr>
              ) : filtered.map((row, i) => {
                const action = getAction(row);
                const ActionIcon = action.icon;
                const processColor = PROCESS_COLORS[row.process] || '#6B5D82';
                return (
                  <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    onClick={() => setDetailRow(row)}
                    className="border-b border-border/40 hover:bg-brand-50/20 transition-colors cursor-pointer">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                        <span className="text-[0.75rem] font-medium text-text">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 h-5 rounded-full text-[0.625rem] font-bold border inline-flex items-center gap-1"
                        style={{ background: `${processColor}10`, color: processColor, borderColor: `${processColor}30` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: processColor }} />{row.process}
                      </span>
                    </td>
                    <td className="px-3 py-3"><span className="text-[0.6875rem] text-text-secondary">{row.auditType}</span></td>
                    <td className="px-3 py-3"><span className="text-[0.6875rem] text-text-secondary">{row.framework}</span></td>
                    <td className="px-3 py-3"><span className="text-[0.6875rem] text-text-secondary tabular-nums">{row.startDate}</span></td>
                    <td className="px-3 py-3"><span className="text-[0.6875rem] text-text-secondary tabular-nums">{row.endDate}</span></td>
                    <td className="px-3 py-3"><span className="text-[0.6875rem] text-text-secondary">{row.owner.split(' ')[0]}</span></td>
                    <td className="px-3 py-3"><span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${PLAN_STATUS_CLS[row.status]}`}>{row.status}</span></td>
                    <td className="px-3 py-3"><span className="text-[0.6875rem] text-brand-600 font-medium">{row.racm}</span></td>
                    <td className="px-3 py-3">
                      <span onClick={e => {
                          e.stopPropagation();
                          if (row.status === 'Active' && onNavigateToExecution) onNavigateToExecution(row.id);
                          else if ((row.status === 'Planned' || row.status === 'Approved') && onActivate) onActivate(row.id);
                          else setDetailRow(row);
                        }}
                        className={`px-2 py-1 rounded-lg text-[0.625rem] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 ${action.cls}`}>
                        <ActionIcon size={10} />{action.label} <ChevronRight size={8} />
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-2/30">
          <span className="text-[0.6875rem] text-text-muted">{filtered.length} of {rows.length} engagements</span>
        </div>
      </div>

      {/* Helper */}
      <div className="mt-4 rounded-lg border border-canvas-border bg-canvas px-4 py-3 flex items-start gap-2.5">
        <Info size={13} className="text-ink-400 mt-0.5 shrink-0" />
        <p className="text-[0.6875rem] text-ink-400 leading-relaxed">Planned engagements become active and move to execution when activated. Activation creates a RACM snapshot and initializes test instances. Execution metrics are visible in the Execution workspace.</p>
      </div>

      {/* ── Planning Detail Drawer ── */}
      <AnimatePresence>
        {detailRow && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={() => setDetailRow(null)} />
            <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-[440px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
              role="dialog" aria-label="Engagement Planning Detail">
              <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded" style={{ background: detailRow.color }} />
                      <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${PLAN_STATUS_CLS[detailRow.status]}`}>{detailRow.status}</span>
                    </div>
                    <h2 className="text-[1.0625rem] font-semibold text-ink-900">{detailRow.name}</h2>
                  </div>
                  <button onClick={() => setDetailRow(null)} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Audit Type', value: detailRow.auditType },
                    { label: 'Framework', value: detailRow.framework },
                    { label: 'Process', value: detailRow.process },
                    { label: 'Controls', value: String(detailRow.controls) },
                    { label: 'Planned Start', value: detailRow.startDate },
                    { label: 'Planned End', value: detailRow.endDate },
                    { label: 'Owner', value: detailRow.owner },
                    { label: 'Linked RACM', value: detailRow.racm },
                  ].map(d => (
                    <div key={d.label}>
                      <span className="text-[0.625rem] text-ink-400 uppercase">{d.label}</span>
                      <div className="text-[0.8125rem] font-medium text-text mt-0.5">{d.value}</div>
                    </div>
                  ))}
                </div>

                {/* Planning checklist */}
                <div>
                  <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-2">Planning Checklist</h3>
                  <div className="space-y-1.5">
                    {[
                      { label: 'RACM linked', done: true },
                      { label: 'Owner assigned', done: !!detailRow.owner },
                      { label: 'Dates defined', done: !!detailRow.startDate && !!detailRow.endDate },
                      { label: 'Framework selected', done: !!detailRow.framework },
                      { label: 'Controls scoped', done: detailRow.controls > 0 },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        {c.done ? <Shield size={12} className="text-compliant-700 shrink-0" /> : <Clock size={12} className="text-ink-300 shrink-0" />}
                        <span className={`text-[0.75rem] ${c.done ? 'text-text-secondary' : 'text-text-muted'}`}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {detailRow.status === 'Active' && onNavigateToExecution && (
                    <button onClick={() => { setDetailRow(null); onNavigateToExecution(detailRow.id); }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-primary/20 hover:bg-primary-xlight/20 transition-all cursor-pointer">
                      <div className="flex items-center gap-2"><Shield size={14} className="text-primary" /><span className="text-[0.75rem] font-medium text-text">Open Execution Workspace</span></div>
                      <ChevronRight size={14} className="text-ink-300" />
                    </button>
                  )}
                  {(detailRow.status === 'Planned' || detailRow.status === 'Approved') && (
                    <button onClick={() => { if (onActivate) onActivate(detailRow.id); setDetailRow(null); }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-compliant/20 bg-compliant-50/20 hover:bg-compliant-50/40 transition-all cursor-pointer">
                      <div className="flex items-center gap-2"><Play size={14} className="text-compliant-700" /><span className="text-[0.75rem] font-medium text-compliant-700">Activate Engagement</span></div>
                      <ChevronRight size={14} className="text-compliant-700/50" />
                    </button>
                  )}
                  {detailRow.status === 'Draft' && (
                    <button onClick={() => { addToast({ message: `Editing "${detailRow.name}"`, type: 'info' }); }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-primary/20 hover:bg-primary-xlight/20 transition-all cursor-pointer">
                      <div className="flex items-center gap-2"><Pencil size={14} className="text-text-muted" /><span className="text-[0.75rem] font-medium text-text">Edit Planning Details</span></div>
                      <ChevronRight size={14} className="text-ink-300" />
                    </button>
                  )}
                </div>
              </div>

              <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas">
                <button onClick={() => setDetailRow(null)} className="w-full px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Close</button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
