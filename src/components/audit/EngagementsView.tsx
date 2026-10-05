import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardCheck, Calendar, ArrowUpRight, Search, Plus,
  Trash2, AlertTriangle, X, LayoutDashboard, List,
  GitBranch, Sparkles,
} from 'lucide-react';
import Orb from '../shared/Orb';
import { findEngagement, libraryEngagements, registerEngagement, type AutomationSubtype, type Engagement, type EngStatus, type EngType, type ProcessCode } from '../../data/engagements';
import { useCreatedEngagements } from '../../data/createdEngagementsStore';
import ConfirmationModal from '../shared/ConfirmationModal';
import { FilterSelect } from '../shared/FilterSelect';
import CreateEngagementWizard from './CreateEngagementWizard';
import ScopingWizard from './sox-testing/ScopingWizard';
import { ROUND_LABEL, soxCardStats, soxRoundOf } from '../sox-icfr/engagementRounds';
import { FlowModal } from './sox-testing/SoxTestingTab';
import { registerProgramme, type SoxProgramme } from './sox-testing/soxTestingData';
import EngagementsOverview, { type ListFilter } from './EngagementsOverview';
import { useCan } from '../../context/CurrentUserContext';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { useNotify } from '../../notifications/NotificationContext';
import { useInsightStackRun } from '../shared/useInsightStackRun';
import InsightLauncherPill from '../shared/InsightLauncherPill';
import InsightStackDrawer from '../shared/InsightStackDrawer';
import type { StackRowNav } from '../shared/InsightStack';
import { ActionDrawer, InsightReflection, TargetedActionList } from '../shared/TargetedActions';
import { getActionsForTarget, getReflectionsFor, useInsightCacheVersion, type TargetedAction } from '../shared/insightCache';
import { makePortfolioBuilder, portfolioInsightSubjects, portfolioStackSteps, PORTFOLIO_SUBJECT_ID } from '../../data/portfolioInsights';
import WorkflowConfigurator from '../exceptions/workflow/WorkflowConfigurator';
import type { Persona } from '../exceptions/workflow/workflowTypes';

type EngViewMode = 'overview' | 'list' | 'approval-flow';

interface Props {
  onOpenEngagement: (engagementId: string) => void;
  onOpenAuditPlanning: () => void;
  /** Open already narrowed to a type (e.g. routed from the SOX report flow
   *  with 'Compliance'). Lands on the list so the filter is visible. */
  initialTypeFilter?: 'All' | EngType;
  /** Called once on mount after the initial filter is applied, so the parent
   *  can clear its one-shot flag (normal navigation stays unfiltered). */
  onInitialFilterConsumed?: () => void;
  /** Open directly on the Approval Flow tab (e.g. from "Create new approval flow"). */
  initialApprovalFlow?: boolean;
  /** Called once the Approval Flow tab has been opened, to clear the one-shot flag. */
  onApprovalFlowConsumed?: () => void;
  /** Open directly on the All Engagements list — set when backing out of an
   *  engagement workspace, so the arrow returns you to the list you came from. */
  initialList?: boolean;
  /** Called once the list has been opened, to clear the one-shot flag. */
  onInitialListConsumed?: () => void;
}

const STATUS_CLS: Record<EngStatus, string> = {
  Active: 'bg-compliant-50 text-compliant-700',
  'In Progress': 'bg-evidence-50 text-evidence-700',
  Review: 'bg-mitigated-50 text-mitigated-700',
  Planned: 'bg-brand-50 text-brand-700',
  Draft: 'bg-draft-50 text-draft-700',
  Closed: 'bg-canvas text-ink-600',
};

const STATUS_DOT: Record<EngStatus, string> = {
  Active: 'bg-compliant',
  'In Progress': 'bg-evidence-600',
  Review: 'bg-mitigated-600',
  Planned: 'bg-brand-500',
  Draft: 'bg-ink-400',
  Closed: 'bg-ink-400',
};

/** What a status reads as on screen. A signed-off engagement is "Concluded" —
 *  the word its own page uses — so the list and the page never disagree. */
const STATUS_LABEL = (s: EngStatus): string => (s === 'Closed' ? 'Concluded' : s);

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
const STATUS_FILTERS: ('All' | EngStatus)[] = ['All', 'Active', 'In Progress', 'Planned', 'Review', 'Draft', 'Closed'];
const PROCESS_FILTERS: ('All' | ProcessCode)[] = ['All', 'P2P', 'O2C', 'R2R', 'S2C', 'ITGC'];

/** Severity order for picking which portfolio reflection leads a row. */
const INSIGHT_SEV_RANK: Record<'high' | 'med' | 'low', number> = { high: 0, med: 1, low: 2 };

/** Pick a colour for the health bar by tier. */
function healthTier(pct: number): { bar: string; text: string } {
  if (pct >= 85) return { bar: 'bg-compliant', text: 'text-compliant-700' };
  if (pct >= 65) return { bar: 'bg-mitigated-500', text: 'text-mitigated-700' };
  return { bar: 'bg-risk', text: 'text-risk-700' };
}

export default function EngagementsView({ onOpenEngagement, onOpenAuditPlanning, initialTypeFilter, onInitialFilterConsumed, initialApprovalFlow, onApprovalFlowConsumed, initialList, onInitialListConsumed }: Props) {
  const { can } = useCan();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const notify = useNotify();
  const presetType = initialTypeFilter && initialTypeFilter !== 'All';
  // When routed with an initial type (e.g. SOX → 'Compliance'), open straight
  // onto the list view, pre-filtered to that type. When routed to create an
  // approval flow, open straight onto the Approval Flow tab. When backing out
  // of an engagement workspace, open straight onto the All Engagements list.
  const [mode, setMode] = useState<EngViewMode>(initialApprovalFlow ? 'approval-flow' : (presetType || initialList) ? 'list' : 'overview');
  // Which side's flows the Approval Flow tab manages.
  const [flowRole, setFlowRole] = useState<Persona>('risk-owner');
  // Clear the parent's one-shot flags once consumed (mode itself is already
  // initialized from the flags in the useState initializer above).
  useEffect(() => { if (initialApprovalFlow) onApprovalFlowConsumed?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initialList) onInitialListConsumed?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | EngType>(initialTypeFilter ?? 'All');
  // Clear the parent's one-shot flag once we've taken the initial filter, so a
  // later plain visit to Engagements opens unfiltered.
  useEffect(() => { if (presetType) onInitialFilterConsumed?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [statusFilter, setStatusFilter] = useState<'All' | EngStatus>('All');
  const [processFilter, setProcessFilter] = useState<'All' | ProcessCode>('All');
  const [wizardOpen, setWizardOpen] = useState(false);
  /** Engagement being edited in the wizard, or null for create mode. */
  const [editTarget, setEditTarget] = useState<Engagement | null>(null);
  // SOX is scoped rather than configured, so picking that type in the wizard
  // above hands over to the same journey the SOX Testing tab runs.
  const [soxWizardOpen, setSoxWizardOpen] = useState(false);
  /** The engagement just created — the list opens with it marked at the top,
   *  so the new row is the first thing seen after Create. */
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  /** Set when the SOX sheet's Back reopens the classic wizard — keeps the
   *  Type step showing SOX / ICFR still selected. Cleared on normal opens. */
  const [wizardInitialType, setWizardInitialType] = useState<EngType | undefined>(undefined);
  /** Session list — seeds + anything created/edited/closed/deleted this session. */
  const [all, setAll] = useState<Engagement[]>(() => libraryEngagements());
  /** Engagements created outside this view (e.g. One-Click Audit from Knowledge
   *  Hub / Ask Ira) — merged into the session list without disturbing edits. */
  const createdEngagements = useCreatedEngagements();
  useEffect(() => {
    // Intentional merge-on-change: prepend store entries the session list
    // doesn't know yet (session deletes win — deps don't change on delete).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAll(prev => {
      const missing = createdEngagements.filter(c => !prev.some(e => e.id === c.id));
      return missing.length ? [...missing, ...prev] : prev;
    });
  }, [createdEngagements]);
  /** Row pending delete confirmation. */
  const [deleteTarget, setDeleteTarget] = useState<Engagement | null>(null);

  // Portfolio-wide AI insights — the cross-engagement altitude. These are
  // correlations no single engagement can see (a shared driver behind three
  // books' exceptions, ITGC undermining SOX reliance, colliding milestones),
  // so their anchor is the portfolio and the trigger lives in library chrome,
  // visible from every tab. Same launcher grammar, drawer and session cache
  // as the engagement header; row reflections below are pure cache reads.
  const portfolioSubjects = useMemo(() => portfolioInsightSubjects(all), [all]);
  const portfolioBuild = useMemo(() => makePortfolioBuilder(all), [all]);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const insightRun = useInsightStackRun({
    layer: 'portfolio',
    subjectId: PORTFOLIO_SUBJECT_ID,
    subjects: portfolioSubjects,
    buildOne: portfolioBuild,
    steps: portfolioStackSteps(all.length, portfolioSubjects.length),
    // A finished run opens the drawer — a clean scan is a result, not an
    // absence. Errors stay in the header pill with retry.
    onSettled: (p) => { if (p === 'generated' || p === 'empty') setInsightsPanelOpen(true); },
  });
  // Re-render when any Generate lands (here or in another tab), so the row
  // reflections and action chips light up without a remount.
  useInsightCacheVersion();
  /** Targeted action open in the act-in-place drawer. */
  const [openAction, setOpenAction] = useState<TargetedAction | null>(null);
  // Drawer → engagement redirect: an insight card's engagement chip opens that
  // workspace in a NEW browser tab (the reader keeps the portfolio report open
  // here; the cross-tab cache sync carries the insight along). Only engagement
  // types that route to the classic overview are deep-linkable — SOX and
  // Compliance refs stay informative chips.
  const insightRowNav = useMemo<StackRowNav>(() => ({
    canOpen: (ref) => {
      if (ref.kind !== 'engagement') return false;
      const eng = all.find(e => e.id === ref.id);
      return !!eng && eng.type !== 'SOX / ICFR' && eng.type !== 'Compliance';
    },
    open: (ref) => {
      const params = new URLSearchParams();
      params.set('view', 'engagement-overview');
      params.set('eng', ref.id);
      window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
    },
  }), [all]);

  /** Patch one engagement in the session list (and the runtime registry so detail views agree). */
  const patchEngagement = (id: string, patch: Partial<Engagement>) => {
    setAll(prev => prev.map(e => {
      if (e.id !== id) return e;
      const next = { ...e, ...patch };
      registerEngagement(next);
      return next;
    }));
  };

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

  /** Confirmed delete — removes from the session list with an undo toast. */
  const handleDeleteConfirmed = () => {
    if (!deleteTarget) return;
    const eng = deleteTarget;
    const idx = all.findIndex(e => e.id === eng.id);
    setAll(prev => prev.filter(e => e.id !== eng.id));
    setDeleteTarget(null);
    logEvent({ action: 'Delete', description: `Deleted engagement "${eng.name}"`, module: 'Engagements', entity: 'Engagement' });
    addToast({
      message: `"${eng.name}" deleted`,
      type: 'success',
      secondaryAction: {
        label: 'Undo',
        onClick: () => setAll(prev => {
          if (prev.some(e => e.id === eng.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(Math.max(idx, 0), next.length), 0, eng);
          return next;
        }),
      },
    });
  };

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
            <div className="text-[0.6875rem] font-semibold text-text-muted tracking-wider uppercase mb-1">Engagements</div>
            <h1 className="text-[2rem] font-bold text-text leading-tight">Engagement Library</h1>
            <p className="text-[0.8125rem] text-text-secondary mt-1.5 max-w-xl">
              {/* One line for the whole library, whichever tab is open (user ask). */}
              A cross-engagement snapshot — health, attention, and activity across your whole portfolio.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Portfolio AI insights — library chrome, because the roll-up
                spans every engagement, not any one tab. */}
            <InsightLauncherPill
              run={insightRun}
              onOpen={() => setInsightsPanelOpen(true)}
              idleTitle="Correlates findings across every engagement in the library — shared root causes, reliance dependencies, colliding milestones. Won’t run automatically; you trigger it so it only bills when you need it."
            />
            <div className="h-9 w-px bg-border-light mx-1" aria-hidden="true" />
            <button
              onClick={onOpenAuditPlanning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[0.75rem] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
              title="See engagements laid out on the FY timeline"
            >
              <Calendar size={13} />
              Audit Planning Timeline
              <ArrowUpRight size={12} />
            </button>
            {can('eng_create') && (
              <button
                onClick={() => { setWizardInitialType(undefined); setWizardOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"
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
            onOpenPortfolioInsights={() => setInsightsPanelOpen(true)}
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
              className="w-full pl-10 pr-3.5 py-2 text-[0.8125rem] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
          <MinimalFilter label="Type" allLabel="All types" options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} counts={counts.type} />
          <MinimalFilter label="Status" allLabel="All statuses" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} counts={counts.status} optionLabel={o => STATUS_LABEL(o as EngStatus)} />
          <MinimalFilter label="Process" allLabel="All processes" options={PROCESS_FILTERS} value={processFilter} onChange={setProcessFilter} counts={counts.process} />
          {anyFilterActive && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-text-muted hover:text-primary px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="border border-border-light rounded-xl p-14 text-center bg-white">
            <ClipboardCheck size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-[0.875rem] font-semibold text-text mb-1">No engagements match your filters</p>
            <p className="text-[0.75rem] text-text-muted">Try clearing the type, status, process, or search filter.</p>
          </div>
        ) : (
          <div>
            {/* No column headers (user ask, 28 Sep). These are cards, not table
                rows: every value already says what it is — the type is a pill,
                health is a percentage over a bar — so the labels named what was
                legible without them, and the last one named a column that has
                since come down to a single icon. */}
            <div className="space-y-2">
            {filtered.map((row, i) => {
              // A SOX engagement's figures are counted off its workspace — the
              // same source and rule as its Overview — not the seed record's
              // static numbers, which disagreed with the page they open.
              const sox = row.type === 'SOX / ICFR' ? soxCardStats(row) : null;
              const eng = sox ? { ...row, controls: sox.controls, health: sox.health, openIssues: sox.openIssues } : row;
              const health = healthTier(eng.health);
              const notStarted = eng.health === 0 && (eng.status === 'Planned' || eng.status === 'Draft');
              const effective = sox ? sox.effective : Math.round((eng.controls * eng.health) / 100);
              // B+C surfacing: a portfolio insight that spans this engagement
              // reflects its slice here (top-severity one; the rest stay one
              // honest line away), and explicitly-targeted actions land as
              // chips. Pure reads over the session cache — nothing generates.
              const reflections = getReflectionsFor('engagement', eng.id)
                .sort((a, b) => INSIGHT_SEV_RANK[a.source.severity] - INSIGHT_SEV_RANK[b.source.severity]);
              const rowActions = getActionsForTarget('engagement', eng.id);
              return (
                <motion.div
                  key={eng.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  onClick={() => onOpenEngagement(eng.id)}
                  className={`grid grid-cols-[2.6fr_1fr_1.7fr_80px] gap-5 px-6 py-5 rounded-lg border hover:border-primary/50 hover: transition-all cursor-pointer group items-start ${eng.id === justCreatedId ? 'border-primary/50 bg-brand-50/40' : 'border-border-light bg-white'}`}
                >
                  {/* Engagement column */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[0.90625rem] font-semibold text-text leading-snug">{eng.name}</h3>
                      {eng.id === justCreatedId && <span className="text-[0.6875rem] font-semibold text-brand-700">Just created</span>}
                      <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.625rem] font-semibold ${STATUS_CLS[eng.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[eng.status]}`} aria-hidden="true" />
                        {STATUS_LABEL(eng.status)}
                      </span>
                      {eng.aiRecommended && (
                        <span
                          className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white"
                          title="Drafted by Ira's One-Click Audit"
                        >
                          <Sparkles size={10} />
                          AI Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-[0.75rem] text-text-secondary mt-1.5 leading-relaxed line-clamp-2 max-w-2xl">
                      {eng.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[0.6875rem] text-text-muted flex-wrap">
                      <span className="font-mono tracking-tight">{eng.code}</span>
                      <span className="text-border">·</span>
                      <span>{eng.owner}</span>
                      <span className="text-border">·</span>
                      <span className="tabular-nums">{eng.periodStart} – {eng.periodEnd}</span>
                      {/* One engagement = one audit round (5 Oct 2026) — say which. */}
                      {eng.type === 'SOX / ICFR' && (<>
                        <span className="text-border">·</span>
                        <span>{ROUND_LABEL[soxRoundOf(eng)]}</span>
                      </>)}
                    </div>
                    {/* Inline tag badges */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.65625rem] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                        {eng.process}
                      </span>
                      <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.65625rem] font-medium bg-white text-text-muted border border-border-light">
                        {eng.framework}
                      </span>
                    </div>
                  </div>

                  {/* Type column */}
                  <div className="flex flex-col items-start gap-1.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[0.6875rem] font-semibold border ${TYPE_CLS[eng.type]}`}>
                      {TYPE_LABEL[eng.type]}
                    </span>
                    {eng.type === 'Automation' && eng.subtype && (
                      <span className="inline-flex items-center px-1.5 h-4 rounded text-[0.59375rem] font-bold uppercase tracking-wide bg-compliant-50/60 text-compliant-700 border border-compliant-100/70">
                        {SUBTYPE_LABEL[eng.subtype]}
                      </span>
                    )}
                  </div>

                  {/* Health column */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    {notStarted ? (
                      <div className="text-[0.6875rem] text-text-muted italic">
                        {eng.controls} controls · not started
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className={`text-[0.9375rem] font-bold tabular-nums leading-none ${health.text}`}>{eng.health}%</span>
                            <span className="text-[0.6875rem] text-text-secondary tabular-nums truncate">
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
                        <span className="text-[0.6875rem] font-semibold text-risk-700">{eng.openIssues}</span>
                        <span className="text-[0.6875rem] text-text-muted">open</span>
                      </div>
                    )}
                  </div>

                  {/* Actions column — no ▶ Open icon (feedback #9): it read as
                      "run", and the whole card already opens the engagement.
                      Edit, Assign owner and Close / finalize have gone too (user
                      ask, 28 Sep): four icons on a row made the list look like a
                      control panel when it is a way in, and each of the three
                      changed the engagement from a screen that shows none of its
                      detail. They belong where the engagement is open. */}
                  <div className="flex items-start justify-end gap-1">
                    {can('eng_delete') && (
                      <IconAction
                        label="Delete engagement"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(eng); }}
                        className="text-text-muted hover:text-risk-700 hover:bg-risk-50"
                      >
                        <Trash2 size={14} />
                      </IconAction>
                    )}
                  </div>

                  {/* Portfolio-insight reflection + travelled actions — the
                      row's slice of a cross-engagement finding. Clicks here
                      must not open the engagement (the row's own action). */}
                  {(reflections.length > 0 || rowActions.length > 0) && (
                    <div
                      className="col-span-full flex flex-col gap-2 pt-3 mt-1 border-t border-border-light/70 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {reflections[0] && (
                        <InsightReflection
                          reflection={reflections[0]}
                          onViewAnchor={() => setInsightsPanelOpen(true)}
                        />
                      )}
                      {reflections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setInsightsPanelOpen(true)}
                          className="self-start inline-flex items-center gap-1 px-1 text-[0.6875rem] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
                        >
                          <Sparkles size={10} aria-hidden="true" />
                          Part of {reflections.length - 1} more portfolio insight{reflections.length - 1 === 1 ? '' : 's'} — view all
                        </button>
                      )}
                      {rowActions.length > 0 && (
                        <TargetedActionList
                          actions={rowActions}
                          onOpen={setOpenAction}
                          heading="AI actions for this engagement"
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
            </div>

            {/* Footer */}
            <div className="px-6 py-2.5 mt-2 text-[0.6875rem] text-text-muted">
              {filtered.length} of {all.length} engagements
            </div>
          </div>
        )}
        </>)}


        {mode === 'approval-flow' && (
          <div>
            <p className="text-[0.78125rem] text-text-secondary mb-4 max-w-[620px]">
              Define reusable approval chains that apply wherever exceptions are sent for approval. Switch sides to manage Risk Owner or Auditor flows.
            </p>
            <WorkflowConfigurator role={flowRole} onRoleChange={setFlowRole} currentUserId={flowRole === 'auditor' ? 'u-au-owner' : 'u-ro-owner'} />
          </div>
        )}
      </div>

      {/* `custom` = "is the SOX sheet taking over?" — while true, the exiting
          wizard drops its slide/fade so the handoff reads as a step change. */}
      <AnimatePresence custom={soxWizardOpen}>
        {wizardOpen && (
          <CreateEngagementWizard
            initial={editTarget ?? undefined}
            initialType={wizardInitialType}
            enterInstant={wizardInitialType !== undefined}
            onClose={() => { setWizardOpen(false); setEditTarget(null); }}
            onCreated={(eng) => {
              registerEngagement(eng);
              setAll(prev => editTarget
                ? prev.map(e => (e.id === eng.id ? eng : e))
                : [eng, ...prev]);
              setWizardOpen(false);
              setEditTarget(null);
              if (!editTarget) {
                const facts = [{ label: 'Engagement', value: `${eng.code} · ${eng.name}` }, { label: 'Type', value: eng.type }, { label: 'Process', value: eng.process }, { label: 'Period', value: `${eng.periodStart} – ${eng.periodEnd}` }];
                // ENG-01 to the named owner; ENG-02 to everyone in scope when it starts Active.
                notify({
                  eventId: 'ENG-01', title: `You own new engagement ${eng.code} — ${eng.name}`, actor: 'You',
                  message: `${eng.type} · ${eng.process} · ${eng.periodStart} – ${eng.periodEnd}. Created as ${STATUS_LABEL(eng.status)}.`,
                  facts, recipients: [{ name: eng.owner, role: 'Named owner' }],
                  link: { view: 'engagement-overview', ref: { kind: 'engagement', id: eng.id } }, linkLabel: 'Open engagement',
                });
                if (eng.status === 'Active' || eng.status === 'In Progress') {
                  const people = [
                    { name: eng.owner, role: 'Engagement owner' },
                    ...(eng.team?.auditors ?? []).map(n => ({ name: n, role: 'Engagement auditor' })),
                    ...(eng.team?.riskOwners ?? []).map(n => ({ name: n, role: 'Risk Owner' })),
                    ...(eng.team?.reviewer ? [{ name: eng.team.reviewer, role: 'Reviewer' }] : []),
                  ];
                  people.forEach(p => notify({
                    eventId: 'ENG-02', title: `${eng.code} kicked off — you’re the ${p.role}`, actor: 'You',
                    message: `${eng.name} is ${STATUS_LABEL(eng.status)}. Period ${eng.periodStart} – ${eng.periodEnd}.`,
                    facts: [...facts, { label: 'Your role', value: p.role }],
                    recipients: [p], link: { view: 'engagement-overview', ref: { kind: 'engagement', id: eng.id } }, linkLabel: 'Open engagement', operationKey: `kickoff-${eng.id}`, itemLabel: p.name,
                  }));
                }
              }
            }}
            onPickSox={() => { setWizardOpen(false); setEditTarget(null); setSoxWizardOpen(true); }}
          />
        )}
      </AnimatePresence>

      {/* SOX / ICFR — the scoping journey, the same one the SOX Testing tab
          opens. It registers the engagement itself, so we only re-read the
          library and record the programme. */}
      {/* `custom` = "is the classic wizard coming back?" — Back-to-type swaps
          instantly; a plain close still slides the sheet away. The sheet also
          enters in place: the classic wizard was already showing there. */}
      <AnimatePresence custom={wizardOpen}>
        {soxWizardOpen && (
          <FlowModal
            label="New engagement"
            widthCls="w-full max-w-[560px]"
            variant="sheet"
            enterInstant
            hideClose
            onClose={() => setSoxWizardOpen(false)}
          >
            <ScopingWizard
              typePreselected
              onBackToType={() => {
                setSoxWizardOpen(false);
                setWizardInitialType('SOX / ICFR');
                setEditTarget(null);
                setWizardOpen(true);
              }}
              onCancel={() => setSoxWizardOpen(false)}
              onCreated={(p: SoxProgramme) => {
                registerProgramme(p);
                // the wizard already registered the engagement — pull it back
                // out by id and put it at the top of the library, the same
                // place a classic create lands it
                const eng = p.engagementId ? findEngagement(p.engagementId) : undefined;
                if (eng) setAll(prev => prev.some(e => e.id === eng.id) ? prev : [eng, ...prev]);
                setSoxWizardOpen(false);
                // One engagement = one audit round (5 Oct 2026): Create opens
                // the new engagement on its Overview. Landing there says it was
                // created, so no toast (no toasts in SOX).
                if (eng) onOpenEngagement(eng.id);
              }}
            />
          </FlowModal>
        )}
      </AnimatePresence>

      {/* Portfolio AI insights drawer — results of the header-gated run. */}
      <InsightStackDrawer
        open={insightsPanelOpen}
        onClose={() => setInsightsPanelOpen(false)}
        subjectLabel="Engagement portfolio"
        scopeLabel="across your portfolio"
        preamble="Only patterns no single engagement can tell you qualify at this level — single-engagement findings stay in their own engagement’s run."
        run={insightRun}
        rowNav={insightRowNav}
      />

      {/* Act-in-place drawer for a travelled action chip. */}
      <ActionDrawer
        action={openAction}
        onClose={() => setOpenAction(null)}
        onViewAnchor={() => setInsightsPanelOpen(true)}
      />

      <ConfirmationModal
        open={deleteTarget !== null}
        title="Delete engagement?"
        description={deleteTarget ? <>This removes <strong>{deleteTarget.name}</strong> ({deleteTarget.code}) from the library. You can undo from the toast right after.</> : undefined}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={handleDeleteConfirmed}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/** Primary Overview ⇄ List view switcher — large underline tabs. */
function ViewToggle({
  mode, onChange, count,
}: {
  mode: EngViewMode;
  onChange: (m: EngViewMode) => void;
  count: number;
}) {
  const tabs: { id: EngViewMode; label: string; Icon: typeof List; badge?: number }[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'list', label: 'All Engagements', Icon: List, badge: count },
    { id: 'approval-flow', label: 'Approval Flow', Icon: GitBranch },
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
            className={`flex items-center gap-2 px-4 py-3 text-[0.875rem] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text hover:border-border'
            }`}
          >
            <Icon size={16} />
            {label}
            {badge != null && (
              <span className={`tabular-nums text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-full ${
                active ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-text-muted'
              }`}>{badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Row action — icon button with the product's hover tooltip (the Process Hub
 *  row-action pattern). The label doubles as the accessible name, so the native
 *  `title` is dropped: it would fire a second, slower tooltip alongside this one.
 *  `hideTip` suppresses the tip while the button's own popover is open. */
function IconAction({ label, onClick, className, hideTip, children }: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className: string;
  hideTip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group/act">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`p-1.5 rounded-md transition-colors cursor-pointer ${className}`}
      >
        {children}
      </button>
      {!hideTip && (
        <span role="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-ink-800 text-paper-0 text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover/act:opacity-100 pointer-events-none transition-opacity z-50">
          {label}
        </span>
      )}
    </div>
  );
}

/** Compact dropdown filter — replaces the old chip panel. Highlights when a
 *  non-"All" value is picked. The menu is the product's themed popover (the
 *  native <select> popup can't be styled), so it matches every other filter. */
function MinimalFilter<T extends string>({
  label, allLabel, options, value, onChange, counts, optionLabel = o => o,
}: {
  label: string;
  allLabel: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  counts: Record<string, number>;
  /** Display text for an option — the value itself unless a screen word differs. */
  optionLabel?: (opt: T) => string;
}) {
  return (
    <FilterSelect
      value={value}
      options={options.map(opt => ({ value: opt, label: opt === 'All' ? allLabel : `${optionLabel(opt)} · ${counts[opt] ?? 0}` }))}
      onChange={v => onChange(v as T)}
      ariaLabel={`Filter by ${label}`}
    />
  );
}
