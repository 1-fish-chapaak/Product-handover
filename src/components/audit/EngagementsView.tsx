import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, ArrowUpRight, Search, Plus,
  Trash2, AlertTriangle, X, LayoutDashboard, List,
  GitBranch, Sparkles, UserRound, ShieldCheck,
} from 'lucide-react';
import FloatingLines from '../shared/FloatingLines';
import { Button } from '../shared/Button';
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
import ApprovalFlowsPanel from './ApprovalFlowsPanel';
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

/** Type reads as coloured text on the entry's meta line (Control Library's
 *  "Standard library" treatment), not a pill. */
const TYPE_TEXT: Record<EngType, string> = {
  Compliance: 'text-brand-700',
  'Internal Audit': 'text-evidence-700',
  Automation: 'text-compliant-700',
  'SOX / ICFR': 'text-brand-800',
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
    // Knowledge Hub's chrome: full-bleed elevated header strip (title ·
    // subhead · underlined tabs) pinned on top; the tab content scrolls below.
    <div className="kh-no-focus-ring h-full flex flex-col overflow-hidden bg-canvas">
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
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
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative mb-6 flex flex-wrap lg:flex-nowrap items-end justify-between gap-x-6 gap-y-4"
          >
            <div className="min-w-0 flex-1">
              <h1 className="text-[2.125rem] font-semibold tracking-tight text-ink-900 leading-[1.15]">
                Engagement Library
              </h1>
              <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">
                {/* One line for the whole library, whichever tab is open (user ask). */}
                A cross-engagement snapshot — health, attention, and activity across your whole portfolio.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* One primary action per tab. Portfolio AI insights only on
                  Overview (row reflections on the list still open its drawer);
                  Approval Flow's own Create flow sits in its toolbar. */}
              {mode === 'overview' && (<>
                <InsightLauncherPill
                  run={insightRun}
                  onOpen={() => setInsightsPanelOpen(true)}
                  compact
                  idleTitle="Correlates findings across every engagement in the library — shared root causes, reliance dependencies, colliding milestones. Won’t run automatically; you trigger it so it only bills when you need it."
                />
                <div className="h-9 w-px bg-border-light mx-1" aria-hidden="true" />
              </>)}
              <button
                onClick={onOpenAuditPlanning}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[0.75rem] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
                title="See engagements laid out on the FY timeline"
              >
                <Calendar size={13} />
                Audit Planning Timeline
                <ArrowUpRight size={12} />
              </button>
              {mode !== 'approval-flow' && can('eng_create') && (
                <Button
                  variant="primary"
                  leftIcon={<Plus size={14} />}
                  onClick={() => { setWizardInitialType(undefined); setWizardOpen(true); }}
                >
                  New Engagement
                </Button>
              )}
            </div>
          </motion.div>

          {/* Tabs sit on the strip's border-b, which is their underline track. */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="relative -mb-px"
          >
            <ViewToggle mode={mode} onChange={setMode} count={all.length} />
          </motion.div>
        </div>
      </div>

      {/* Tab content — the page's one scroll region under the pinned header. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-6 pb-8 flex-1 min-h-0 overflow-y-auto">

        {mode === 'overview' && (
          <EngagementsOverview
            engagements={all}
            onOpenEngagement={onOpenEngagement}
            onGoToList={goToList}
            onOpenPortfolioInsights={() => setInsightsPanelOpen(true)}
          />
        )}

        {mode === 'list' && (<>
        {/* Toolbar — Control Library's grammar: type as a segmented control,
            process + search on the right, status as pills underneath. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-7">
          <div role="tablist" aria-label="Engagement type" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-100">
            {TYPE_FILTERS.map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                className={`h-7 px-3 rounded-md text-[0.75rem] font-medium cursor-pointer transition-colors whitespace-nowrap ${typeFilter === t ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}
              >
                {t === 'All' ? 'All' : TYPE_LABEL[t]} <span className="ml-0.5 text-ink-400 tabular-nums">{counts.type[t] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
            {anyFilterActive && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 h-9 px-2 rounded-md text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <X size={12} aria-hidden /> Clear filters
              </button>
            )}
            {/* Status as one filter button (user ask, 8 Oct) — it was a row of pills. */}
            <MinimalFilter label="Status" allLabel="Any status"
              options={STATUS_FILTERS.filter(st => st === 'All' || st === statusFilter || (counts.status[st] ?? 0) > 0)}
              value={statusFilter} onChange={setStatusFilter} counts={counts.status} optionLabel={st => (st === 'All' ? 'Any status' : STATUS_LABEL(st))} />
            <MinimalFilter label="Process" allLabel="All processes" options={PROCESS_FILTERS} value={processFilter} onChange={setProcessFilter} counts={counts.process} />
            <div className="relative flex-1 sm:flex-none sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, owner, code…"
                aria-label="Search engagements"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-300"
              />
            </div>
          </div>
        </div>
        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-canvas-border px-6 py-16 text-center">
            <p className="text-[0.875rem] font-medium text-ink-800">No engagements match your filters</p>
            <p className="mt-1 text-[0.8125rem] text-ink-500">Try clearing the type, status, process, or search filter.</p>
          </div>
        ) : (
          <div>
            {/* Entries, not table rows (no column headers, user ask 28 Sep):
                every value says what it is — Control Library's entry card. */}
            <ul className="space-y-3">
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
              const isNew = eng.id === justCreatedId;
              return (
                <motion.li
                  key={eng.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.025 }}
                  onClick={() => onOpenEngagement(eng.id)}
                  className={`group rounded-xl border bg-canvas-elevated transition-[border-color,box-shadow] duration-150 cursor-pointer hover:shadow-[0_8px_24px_rgba(15,8,30,0.04)] ${isNew ? 'border-brand-300' : 'border-canvas-border hover:border-brand-200'}`}
                >
                  <div className="flex items-start gap-6 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      {/* Meta line — code · process · type · subtype · round */}
                      <div className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-ink-400">
                        <span className="font-mono text-ink-500 tabular-nums">{eng.code}</span>
                        <span aria-hidden>·</span>
                        <span className="font-mono">{eng.process}</span>
                        <span aria-hidden>·</span>
                        <span className={`font-medium ${TYPE_TEXT[eng.type]}`}>{TYPE_LABEL[eng.type]}</span>
                        {eng.type === 'Automation' && eng.subtype && (<>
                          <span aria-hidden>·</span>
                          <span className="text-ink-500">{SUBTYPE_LABEL[eng.subtype]}</span>
                        </>)}
                        {/* One engagement = one audit round (5 Oct 2026) — say which. */}
                        {eng.type === 'SOX / ICFR' && (<>
                          <span aria-hidden>·</span>
                          <span className="text-ink-500">{ROUND_LABEL[soxRoundOf(eng)]}</span>
                        </>)}
                      </div>
                      <h3 className="mt-1 flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold leading-snug text-ink-900">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onOpenEngagement(eng.id); }}
                          className="text-left cursor-pointer group-hover:text-brand-700 transition-colors"
                        >
                          {eng.name}
                        </button>
                        {isNew && <span className="text-[0.6875rem] font-semibold text-brand-700">Just created</span>}
                        {eng.aiRecommended && (
                          <span
                            className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[0.625rem] font-semibold bg-brand-50 text-brand-700"
                            title="Drafted by Ira's One-Click Audit"
                          >
                            <Sparkles size={10} aria-hidden />
                            AI Recommended
                          </span>
                        )}
                      </h3>
                      <p className="mt-1 max-w-[75ch] text-[0.8125rem] leading-relaxed text-ink-500 line-clamp-2">{eng.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.75rem] text-ink-500">
                        <span className="inline-flex items-center gap-1.5"><UserRound size={12} className="text-ink-400" aria-hidden />{eng.owner}</span>
                        <span className="inline-flex items-center gap-1.5 tabular-nums"><Calendar size={12} className="text-ink-400" aria-hidden />{eng.periodStart} – {eng.periodEnd}</span>
                        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} className="text-ink-400" aria-hidden />{eng.framework}</span>
                        {eng.openIssues > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-risk-700">
                            <AlertTriangle size={12} aria-hidden />
                            <span className="font-semibold tabular-nums">{eng.openIssues}</span> open
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status + health. No ▶ Open icon (feedback #9) and no
                        Edit / Assign / Close (user ask, 28 Sep) — the whole
                        card opens the engagement; only Delete stays here. */}
                    <div className="w-52 shrink-0 flex flex-col items-end gap-3 pt-0.5">
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[0.6875rem] font-medium whitespace-nowrap ${STATUS_CLS[eng.status]}`}>
                          <span className={`size-1.5 rounded-full ${STATUS_DOT[eng.status]}`} aria-hidden />
                          {STATUS_LABEL(eng.status)}
                        </span>
                        {can('eng_delete') && (
                          <IconAction
                            label="Delete engagement"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(eng); }}
                            className="text-ink-400 hover:text-risk-700 hover:bg-risk-50"
                          >
                            <Trash2 size={13} />
                          </IconAction>
                        )}
                      </div>
                      {notStarted ? (
                        <span className="text-[0.6875rem] text-ink-400 tabular-nums">{eng.controls} controls · not started</span>
                      ) : (
                        <div className="w-full">
                          <div className="flex items-baseline justify-between gap-2 text-[0.6875rem] text-ink-500 tabular-nums">
                            <span><span className="font-semibold text-ink-900">{effective}</span>/{eng.controls} controls effective</span>
                            <span className={`font-mono font-semibold ${health.text}`}>{eng.health}%</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-paper-100 overflow-hidden">
                            <div className={`h-full rounded-full ${health.bar} transition-all duration-500`} style={{ width: `${eng.health}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Portfolio-insight reflection + travelled actions — the
                      row's slice of a cross-engagement finding. Clicks here
                      must not open the engagement (the row's own action). */}
                  {(reflections.length > 0 || rowActions.length > 0) && (
                    <div
                      className="mx-5 pb-4 pt-3 border-t border-canvas-border flex flex-col gap-2 cursor-default"
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
                </motion.li>
              );
            })}
            </ul>

            <p className="mt-4 text-[0.75rem] text-ink-400 tabular-nums">
              {filtered.length} of {all.length} engagements
            </p>
          </div>
        )}
        </>)}


        {mode === 'approval-flow' && <ApprovalFlowsPanel role={flowRole} onRoleChange={setFlowRole} />}
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

/** Primary view switcher — Knowledge Hub's underlined tabs (spring brand
 *  bar riding the header strip's border-b). */
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
    <div className="flex gap-6" role="tablist" aria-label="Engagements view">
      {tabs.map(({ id, label, Icon, badge }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
              active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={14} />
              {label}
              {badge != null && (
                <span className={`tabular-nums text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-brand-100 text-brand-700' : 'bg-paper-50 text-ink-500'
                }`}>{badge}</span>
              )}
            </span>
            {active && (
              <motion.div
                layoutId="eng-main-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
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
