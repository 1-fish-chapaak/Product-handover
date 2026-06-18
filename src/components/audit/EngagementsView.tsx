import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardCheck, Calendar, ArrowUpRight, Search, Plus,
  Play, Trash2, AlertTriangle, X, LayoutDashboard, List,
  Pencil, UserPlus, CheckCircle2,
} from 'lucide-react';
import Orb from '../shared/Orb';
import { ENGAGEMENTS, registerEngagement, type AutomationSubtype, type Engagement, type EngStatus, type EngType, type ProcessCode } from '../../data/engagements';
import CreateEngagementWizard from './CreateEngagementWizard';
import EngagementsOverview, { type ListFilter } from './EngagementsOverview';
import { useCan } from '../../context/CurrentUserContext';
import { useToast } from '../shared/Toast';

interface Props {
  onOpenEngagement: (engagementId: string) => void;
  onOpenAuditPlanning: () => void;
  /** Open already narrowed to a type (e.g. routed from the SOX report flow
   *  with 'Compliance'). Lands on the list so the filter is visible. */
  initialTypeFilter?: 'All' | EngType;
  /** Called once on mount after the initial filter is applied, so the parent
   *  can clear its one-shot flag (normal navigation stays unfiltered). */
  onInitialFilterConsumed?: () => void;
}

const STATUS_CLS: Record<EngStatus, string> = {
  Active: 'bg-compliant-50 text-compliant-700',
  'In Progress': 'bg-evidence-50 text-evidence-700',
  Review: 'bg-mitigated-50 text-mitigated-700',
  Planned: 'bg-brand-50 text-brand-700',
  Draft: 'bg-draft-50 text-draft-700',
  Closed: 'bg-gray-100 text-gray-600',
};

const STATUS_DOT: Record<EngStatus, string> = {
  Active: 'bg-compliant',
  'In Progress': 'bg-evidence-600',
  Review: 'bg-mitigated-600',
  Planned: 'bg-brand-500',
  Draft: 'bg-gray-400',
  Closed: 'bg-gray-400',
};

const TYPE_CLS: Record<EngType, string> = {
  Compliance: 'bg-brand-50 text-brand-700 border-brand-100',
  'Internal Audit': 'bg-evidence-50 text-evidence-700 border-evidence-100',
  Automation: 'bg-compliant-50 text-compliant-700 border-compliant-100',
  'SOX / ICFR': 'bg-brand-100 text-brand-800 border-brand-200',
};

const TYPE_LABEL: Record<EngType, string> = {
  Compliance: 'Compliance',
  'Internal Audit': 'Internal Audit',
  Automation: 'Automation',
  'SOX / ICFR': 'SOX / ICFR',
};

/** Short label for the Automation subtype shown as a small tag next to the type pill. */
const SUBTYPE_LABEL: Record<AutomationSubtype, string> = {
  CCM: 'CCM',
  Reconciliation: 'Reconciliation',
  MIS: 'MIS',
  Forensic: 'Forensic',
  'Image Analytics': 'Image Analytics',
  Custom: 'Custom',
};

const TYPE_FILTERS: ('All' | EngType)[] = ['All', 'SOX / ICFR', 'Compliance', 'Internal Audit', 'Automation'];
const STATUS_FILTERS: ('All' | EngStatus)[] = ['All', 'Active', 'In Progress', 'Planned', 'Review', 'Draft'];
const PROCESS_FILTERS: ('All' | ProcessCode)[] = ['All', 'P2P', 'O2C', 'R2R', 'S2C', 'ITGC'];

/** Pick a colour for the health bar by tier. */
function healthTier(pct: number): { bar: string; text: string } {
  if (pct >= 85) return { bar: 'bg-compliant', text: 'text-compliant-700' };
  if (pct >= 65) return { bar: 'bg-mitigated-500', text: 'text-mitigated-700' };
  return { bar: 'bg-risk', text: 'text-risk-700' };
}

export default function EngagementsView({ onOpenEngagement, onOpenAuditPlanning, initialTypeFilter, onInitialFilterConsumed }: Props) {
  const { can } = useCan();
  const { addToast } = useToast();
  const presetType = initialTypeFilter && initialTypeFilter !== 'All';
  // When routed with an initial type (e.g. SOX → 'Compliance'), open straight
  // onto the list view, pre-filtered to that type.
  const [mode, setMode] = useState<'overview' | 'list'>(presetType ? 'list' : 'overview');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | EngType>(initialTypeFilter ?? 'All');
  // Clear the parent's one-shot flag once we've taken the initial filter, so a
  // later plain visit to Engagements opens unfiltered.
  useEffect(() => { if (presetType) onInitialFilterConsumed?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [statusFilter, setStatusFilter] = useState<'All' | EngStatus>('All');
  const [processFilter, setProcessFilter] = useState<'All' | ProcessCode>('All');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [created, setCreated] = useState<Engagement[]>([]);

  const all = useMemo(() => [...created, ...ENGAGEMENTS], [created]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(e => {
      if (typeFilter !== 'All' && e.type !== typeFilter) return false;
      if (statusFilter !== 'All' && e.status !== statusFilter) return false;
      if (processFilter !== 'All' && e.process !== processFilter) return false;
      if (q && !e.name.toLowerCase().includes(q)
            && !e.owner.toLowerCase().includes(q)
            && !e.description.toLowerCase().includes(q)
            && !e.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, search, typeFilter, statusFilter, processFilter]);

  /** Static counts across the full library — shown as small badges on each filter chip. */
  const counts = useMemo(() => {
    const t = { All: all.length } as Record<string, number>;
    const s = { All: all.length } as Record<string, number>;
    const p = { All: all.length } as Record<string, number>;
    for (const e of all) {
      t[e.type] = (t[e.type] ?? 0) + 1;
      s[e.status] = (s[e.status] ?? 0) + 1;
      p[e.process] = (p[e.process] ?? 0) + 1;
    }
    return { type: t, status: s, process: p };
  }, [all]);

  const anyFilterActive = typeFilter !== 'All' || statusFilter !== 'All' || processFilter !== 'All';
  const clearFilters = () => { setTypeFilter('All'); setStatusFilter('All'); setProcessFilter('All'); };

  /** Jump from the overview into the list, pre-filtered on a single dimension. */
  const goToList = (filter?: ListFilter) => {
    setTypeFilter(filter?.type ?? 'All');
    setStatusFilter(filter?.status ?? 'All');
    setProcessFilter(filter?.process ?? 'All');
    setSearch('');
    setMode('list');
  };

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-[11px] font-semibold text-text-muted tracking-wider uppercase mb-1">Engagements</div>
            <h1 className="text-[32px] font-bold text-text leading-tight">Engagement Library</h1>
            <p className="text-[13px] text-text-secondary mt-1.5 max-w-xl">
              {mode === 'overview'
                ? 'A cross-engagement snapshot — health, attention, and activity across your whole portfolio.'
                : 'Browse all engagements — compliance audits, internal audits, and automation programs.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenAuditPlanning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[12px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
              title="See engagements laid out on the FY timeline"
            >
              <Calendar size={13} />
              Audit Planning Timeline
              <ArrowUpRight size={12} />
            </button>
            {can('eng_create') && (
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
              >
                <Plus size={14} />New Engagement
              </button>
            )}
          </div>
        </div>

        {/* Primary view switcher — prominent, on its own row */}
        <div className="flex items-center gap-3 mb-6 border-b border-border-light">
          <ViewToggle mode={mode} onChange={setMode} count={all.length} />
        </div>

        {mode === 'overview' && (
          <EngagementsOverview
            engagements={all}
            onOpenEngagement={onOpenEngagement}
            onGoToList={goToList}
          />
        )}

        {mode === 'list' && (<>
        {/* Search + filters — one compact row, no dedicated panel */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search engagement, owner, framework, or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-[13px] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
          <MinimalFilter label="Type" allLabel="All types" options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} counts={counts.type} />
          <MinimalFilter label="Status" allLabel="All statuses" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} counts={counts.status} />
          <MinimalFilter label="Process" allLabel="All processes" options={PROCESS_FILTERS} value={processFilter} onChange={setProcessFilter} counts={counts.process} />
          {anyFilterActive && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-muted hover:text-primary px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="border border-border-light rounded-xl p-14 text-center bg-white">
            <ClipboardCheck size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-text mb-1">No engagements match your filters</p>
            <p className="text-[12px] text-text-muted">Try clearing the type, status, process, or search filter.</p>
          </div>
        ) : (
          <div>
            {/* Column headers — label row above the cards */}
            <div className="grid grid-cols-[2.6fr_1fr_1.7fr_80px] gap-5 px-6 pb-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80">
              <div>Engagement</div>
              <div>Type</div>
              <div>Health</div>
              <div className="text-right">Actions</div>
            </div>

            <div className="space-y-2">
            {filtered.map((eng, i) => {
              const health = healthTier(eng.health);
              const notStarted = eng.health === 0 && (eng.status === 'Planned' || eng.status === 'Draft');
              const effective = Math.round((eng.controls * eng.health) / 100);
              return (
                <motion.div
                  key={eng.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  onClick={() => onOpenEngagement(eng.id)}
                  className="grid grid-cols-[2.6fr_1fr_1.7fr_80px] gap-5 px-6 py-5 rounded-xl border border-border-light bg-white hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group items-start"
                >
                  {/* Engagement column */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[14.5px] font-semibold text-text leading-snug">{eng.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold ${STATUS_CLS[eng.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[eng.status]}`} aria-hidden="true" />
                        {eng.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-secondary mt-1.5 leading-relaxed line-clamp-2 max-w-2xl">
                      {eng.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted flex-wrap">
                      <span className="font-mono tracking-tight">{eng.code}</span>
                      <span className="text-border">·</span>
                      <span>{eng.owner}</span>
                      <span className="text-border">·</span>
                      <span className="tabular-nums">{eng.periodStart} – {eng.periodEnd}</span>
                    </div>
                    {/* Inline tag badges */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                        {eng.process}
                      </span>
                      <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-medium bg-white text-text-muted border border-border-light">
                        {eng.framework}
                      </span>
                    </div>
                  </div>

                  {/* Type column */}
                  <div className="flex flex-col items-start gap-1.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${TYPE_CLS[eng.type]}`}>
                      {TYPE_LABEL[eng.type]}
                    </span>
                    {eng.type === 'Automation' && eng.subtype && (
                      <span className="inline-flex items-center px-1.5 h-4 rounded text-[9.5px] font-bold uppercase tracking-wide bg-compliant-50/60 text-compliant-700 border border-compliant-100/70">
                        {SUBTYPE_LABEL[eng.subtype]}
                      </span>
                    )}
                  </div>

                  {/* Health column */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    {notStarted ? (
                      <div className="text-[11px] text-text-muted italic">
                        {eng.controls} controls · not started
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className={`text-[15px] font-bold tabular-nums leading-none ${health.text}`}>{eng.health}%</span>
                            <span className="text-[11px] text-text-secondary tabular-nums truncate">
                              <span className="font-semibold text-text">{effective}</span>
                              <span className="text-text-muted">/{eng.controls}</span>
                              <span className="text-text-muted ml-1">controls effective</span>
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                          <div className={`h-full ${health.bar} rounded-full transition-all duration-500`} style={{ width: `${eng.health}%` }} />
                        </div>
                      </>
                    )}
                    {eng.openIssues > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={11} className="text-risk-700" />
                        <span className="text-[11px] font-semibold text-risk-700">{eng.openIssues}</span>
                        <span className="text-[11px] text-text-muted">open</span>
                      </div>
                    )}
                  </div>

                  {/* Actions column */}
                  <div className="flex items-start justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenEngagement(eng.id); }}
                      className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                      title="Open engagement"
                    >
                      <Play size={14} />
                    </button>
                    {can('eng_edit') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); addToast({ message: `Editing ${eng.name}`, type: 'info' }); }}
                        className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {can('eng_assign') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); addToast({ message: `Assign owner & reviewer for ${eng.name}`, type: 'info' }); }}
                        className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        title="Assign"
                      >
                        <UserPlus size={14} />
                      </button>
                    )}
                    {can('eng_close') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); addToast({ message: `${eng.name} closed`, type: 'success' }); }}
                        className="p-1.5 rounded-md text-text-muted hover:text-evidence-700 hover:bg-evidence-50 transition-colors cursor-pointer"
                        title="Close / finalize"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    {can('eng_delete') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
            </div>

            {/* Footer */}
            <div className="px-6 py-2.5 mt-2 text-[11px] text-text-muted">
              {filtered.length} of {ENGAGEMENTS.length + created.length} engagements
            </div>
          </div>
        )}
        </>)}
      </div>

      <AnimatePresence>
        {wizardOpen && (
          <CreateEngagementWizard
            onClose={() => setWizardOpen(false)}
            onCreated={(newEng) => {
              registerEngagement(newEng);
              setCreated(prev => [newEng, ...prev]);
              setWizardOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Primary Overview ⇄ List view switcher — large underline tabs. */
function ViewToggle({
  mode, onChange, count,
}: {
  mode: 'overview' | 'list';
  onChange: (m: 'overview' | 'list') => void;
  count: number;
}) {
  const tabs: { id: 'overview' | 'list'; label: string; Icon: typeof List; badge?: number }[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'list', label: 'All Engagements', Icon: List, badge: count },
  ];
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Engagements view">
      {tabs.map(({ id, label, Icon, badge }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 px-4 py-3 text-[14px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text hover:border-border'
            }`}
          >
            <Icon size={16} />
            {label}
            {badge != null && (
              <span className={`tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                active ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-text-muted'
              }`}>{badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact dropdown filter — replaces the old chip panel. Highlights when a non-"All" value is picked. */
function MinimalFilter<T extends string>({
  label, allLabel, options, value, onChange, counts,
}: {
  label: string;
  allLabel: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  counts: Record<string, number>;
}) {
  const active = value !== 'All';
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      aria-label={`Filter by ${label}`}
      className={`py-2 px-3 rounded-lg border text-[12.5px] font-semibold outline-none cursor-pointer transition-colors focus:ring-2 focus:ring-primary/10 ${
        active
          ? 'border-primary/40 text-primary bg-primary-xlight/30'
          : 'border-border bg-white text-text-secondary hover:border-primary/30'
      }`}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt === 'All' ? allLabel : `${opt} · ${counts[opt] ?? 0}`}
        </option>
      ))}
    </select>
  );
}
