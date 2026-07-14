/**
 * Platform Usage — adoption analytics for admins. (PRD-PLATFORM-USAGE.md)
 *
 * Read-only diagnostic surface over the seeded usage series
 * (src/data/platform-usage.ts) with today's live audit-log events folded in.
 *
 * The page reads top-down as one argument: how much happened (KPI band) → what
 * that means (highlights) → when it happened (the trend) → where (areas) → is
 * the licence earning its keep (adoption) → what came out of it (AI, output,
 * exports) → and finally who, in a table you can drill and export. Filters sit
 * in one sticky row at the top and scope everything below them, so the numbers
 * always agree with each other.
 *
 * Every card, tooltip, meter and delta chip on this page comes from
 * `usageChrome.tsx`. People-management stays in Administration; this view only
 * reports.
 */

import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Users, User, UserCheck, UserX, Activity, Sparkles, Download,
  CalendarClock, ListChecks, PackagePlus, Play, Share2,
  Gauge, LayoutGrid, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useAdminData, useAuditLog, type AdminUser } from '../../context/AdminDataContext';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { getRole } from '../../data/rbac';
import {
  USAGE_MODULES, usageDaysWithLive, userUsageRows, usageDayLabel,
  usageAnchorLabel, usageAnchor,
  usageWindowTotals, usageDeltaPct, seatBuckets, lastLoginOffsetDays,
  segmentFor, activeMeanActions, aiAdoptionPct, usageHourlyMatrix,
  activityConcentration, usageSpikes, recentDownloads, downloadFormatSplit,
  aiQuestions, aiToolRuns,
  creationTotals, recentCreations, workflowRunTotals, recentRuns, shareTotals, recentShares,
  ENGAGEMENT_SEGMENTS, SEGMENT_LABELS,
  type UsageModule, type UsageDay, type UserUsageRow, type EngagementSegment,
} from '../../data/platform-usage';
import SmartTable, { type Column } from '../shared/SmartTable';
import {
  DateFilterPicker, DATE_PRESETS, type DateFilter,
} from '../shared/DateFilterPicker';
import ColumnFilter from '../shared/ColumnFilter';
import FloatingLines from '../shared/FloatingLines';
import EmptyState from '../shared/EmptyState';
import { Pill, type Tone } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { InitialsAvatar, MemberSearch, AdminKpiRow } from '../admin/AdminPrimitives';
import { presetChip, BTN_CTA_OUTLINE, type Stat } from '../admin/adminTokens';
import UsageKpiRow, { type UsageStat } from './UsageKpiRow';
import UserUsageModal from './UserUsageModal';
import ModuleUsageModal from './ModuleUsageModal';
import TeamUsageModal from './TeamUsageModal';
import UsageRhythm from './UsageRhythm';
import UsageActivityChart from './UsageActivityChart';
import { activityPoints, activityTakeaway } from './usageActivity';
import UsageVerdict, { type VerdictInput } from './UsageVerdict';
import UsagePlatformSections from './UsagePlatformSections';
import UsageAdoption from './UsageAdoption';
import { Card, Band, Eyebrow, DeltaPill, Meter, RankedRow } from './usageChrome';
import { KH_EASE, SERIES, fmt } from './usageTokens';

const DAY_MS = 86400000;

/** Day-offset of an ISO date relative to the anchor (0 = the anchor day, larger = older). */
function offsetFromAnchor(iso: string, anchor: Date): number {
  const d = new Date(iso);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const a = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  return Math.round((a - day) / DAY_MS);
}

/**
 * Turn a DateFilter into the window this page reports on.
 *
 * The page is anchored on the newest real record, not wall-clock time, so the
 * picker gets the anchor as its `today` and every window is measured back from
 * there. Presets end at the anchor; a custom range can sit anywhere in the
 * 180-day series. `priorDays` is always the equally-long window immediately
 * before, so the period-over-period deltas stay honest.
 */
function usageWindow(allDays: UsageDay[], filter: DateFilter, anchor: Date) {
  const total = allDays.length;

  if (filter.kind === 'preset') {
    const preset = DATE_PRESETS.find(p => p.id === filter.id);
    // 'all' has days: null → the whole series. 'today' has days: 0 → the anchor bucket.
    const len = preset?.days == null ? total : Math.max(1, preset.days);
    return {
      days: allDays.slice(-len),
      priorDays: allDays.slice(Math.max(0, total - 2 * len), total - len),
      rangeDays: Math.min(len, total),
    };
  }

  const a = offsetFromAnchor(filter.from, anchor);
  const b = offsetFromAnchor(filter.to, anchor);
  const oldest = Math.min(total - 1, Math.max(a, b));
  const newest = Math.max(0, Math.min(a, b));
  const days = oldest < newest ? [] : allDays.filter(d => d.dayOffset <= oldest && d.dayOffset >= newest);
  const len = days.length;
  return {
    days,
    priorDays: allDays.filter(d => d.dayOffset > oldest && d.dayOffset <= oldest + len),
    rangeDays: len,
  };
}

type Lens = 'users' | 'teams';

/* ── Flattened table rows (SmartTable sorts on raw keys) ── */
interface UsageRow extends Record<string, unknown> {
  name: string;
  email: string;
  roleName: string;
  team: string;
  lastLogin: string;
  actions: number;
  aiQueries: number;
  downloads: number;
  topModule: UsageModule;
  trendPct: number | null;
  segment: EngagementSegment;
}

interface TeamUsageRow extends Record<string, unknown> {
  team: string;
  members: number;
  memberNames: string[];
  actions: number;
  aiQueries: number;
  topModule: string;
  lastActive: string;
}

/* ── Cell vocabulary ───────────────────────────────────────────────────────
   The chips in these tables are the platform's chips. The module tag used to
   be a bespoke inline span; it is now the shared `Pill` (§7.10.4), and the
   engagement segment — which you could already filter by but could not see —
   is a `Pill` too.

   Engagement is an adoption scale, not a risk scale, so it deliberately avoids
   the risk/high tones (the same rule `ConfidenceBadge` follows): a light user
   is not a finding. Dormant reads grey — the absence of a thing, not an alarm.
   The one place it IS flagged as actionable is the KPI card, in amber. */
const SEGMENT_TONE: Record<EngagementSegment, Tone> = {
  Power: 'compliant',
  Core: 'evidence',
  Casual: 'info',
  Dormant: 'draft',
};

/** Nobody is "—". The users table said one thing, the teams table another. */
const UNASSIGNED = 'Unassigned';

const teamLabel = (team: string) => (team === '—' ? UNASSIGNED : team);

/** The em-dash a numeric cell shows when there is nothing to show. */
const Blank = () => <span className="text-[0.75rem] text-ink-300">—</span>;

/* The members table. `table-fixed` (see `fixedLayout` below) makes these widths
   real, so the header row can no longer wrap "AI Queries" onto two lines while
   the Trend column sits half-empty beside it. Widths sum to 80; Member takes
   the remaining 20%. */
const userColumns = (compareLabel: string): Column<UsageRow>[] => [
  {
    key: 'name', label: 'Member', sortable: true, truncate: true,
    render: (r) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <InitialsAvatar name={r.name} size={26} />
        <div className="min-w-0 leading-tight">
          <div className="text-[0.8125rem] font-semibold text-ink-900 tracking-[-0.01em] truncate">{r.name}</div>
          <div className="text-[0.6875rem] text-ink-400 mt-0.5 truncate">{r.email}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'segment', label: 'Engagement', sortable: true, width: '9%',
    render: (r) => <Pill tone={SEGMENT_TONE[r.segment]}>{SEGMENT_LABELS[r.segment]}</Pill>,
  },
  { key: 'roleName', label: 'Role', sortable: true, width: '10%', render: (r) => <span className="text-[0.8125rem] text-ink-700 truncate">{r.roleName}</span> },
  {
    key: 'team', label: 'Team', sortable: true, width: '10%',
    render: (r) => r.team === '—'
      ? <span className="text-[0.8125rem] text-ink-400">{UNASSIGNED}</span>
      : <span className="text-[0.8125rem] text-ink-700 truncate">{r.team}</span>,
  },
  {
    key: 'lastLogin', label: 'Last Active', sortable: true, width: '10%',
    render: (r) => <span className={`text-[0.75rem] font-mono tabular-nums ${r.lastLogin === 'Never' ? 'italic text-ink-400' : 'text-ink-700'}`}>{r.lastLogin}</span>,
  },
  {
    // Actions and Trend were two columns saying one thing: the trend IS the
    // action count, measured against the window before. The rest of the page
    // already spells that as a number plus a `DeltaPill` (every CardFigure and
    // Meter does), and the pill names its baseline on hover — which the bare
    // "+35%" never did.
    key: 'actions', label: 'Actions', sortable: true, width: '11%', align: 'right',
    render: (r) => (
      <div className="inline-flex items-baseline gap-1.5">
        <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>
        <DeltaPill pct={r.trendPct} compareLabel={compareLabel} size="sm" />
      </div>
    ),
  },
  {
    key: 'aiQueries', label: 'AI Queries', sortable: true, width: '10%', align: 'right',
    render: (r) => r.aiQueries === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'downloads', label: 'Downloads', sortable: true, width: '9%', align: 'right',
    render: (r) => r.downloads === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.downloads)}</span>,
  },
  {
    key: 'topModule', label: 'Top Module', sortable: true, width: '11%',
    render: (r) => r.actions === 0 ? <Blank /> : <Pill tone="draft">{r.topModule}</Pill>,
  },
];

/* The teams table, spelled exactly like Administration's: a brand icon tile and
   the name, the member avatar stack, then the numbers. */
const teamColumns: Column<TeamUsageRow>[] = [
  {
    key: 'team', label: 'Team', sortable: true, truncate: true,
    render: (r) => (
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <Users size={15} className="text-brand-700" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[0.8125rem] font-semibold text-ink-900 tracking-[-0.01em] truncate">{r.team}</div>
          <div className="text-[0.6875rem] text-ink-400 mt-0.5">{r.members} member{r.members !== 1 ? 's' : ''}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'memberNames', label: 'Members', sortable: false, width: '18%',
    render: (r) => (
      <div className="flex items-center -space-x-2">
        {r.memberNames.slice(0, 5).map((m, i) => (
          <div
            key={`${m}-${i}`}
            title={m}
            className="relative rounded-full ring-2 ring-canvas-elevated transition-transform duration-150 hover:z-10 hover:-translate-y-0.5"
          >
            <InitialsAvatar name={m} size={26} />
          </div>
        ))}
        {r.memberNames.length > 5 && (
          <div className="relative w-[26px] h-[26px] rounded-full flex items-center justify-center text-[0.625rem] font-semibold text-ink-500 bg-canvas ring-2 ring-canvas-elevated tabular-nums">
            +{r.memberNames.length - 5}
          </div>
        )}
      </div>
    ),
  },
  {
    key: 'actions', label: 'Actions', sortable: true, width: '12%', align: 'right',
    render: (r) => <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>,
  },
  {
    key: 'aiQueries', label: 'AI Queries', sortable: true, width: '12%', align: 'right',
    render: (r) => r.aiQueries === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'topModule', label: 'Top Module', sortable: true, width: '14%',
    render: (r) => r.actions === 0 ? <Blank /> : <Pill tone="draft">{r.topModule}</Pill>,
  },
  {
    key: 'lastActive', label: 'Last Active', sortable: true, width: '12%',
    render: (r) => <span className={`text-[0.75rem] font-mono tabular-nums ${r.lastActive === 'Never' ? 'italic text-ink-400' : 'text-ink-700'}`}>{r.lastActive}</span>,
  },
];

/* ── Tabs ──────────────────────────────────────────────────────────────────
   This page answers five different questions, and it used to answer all of
   them in one 5,900px scroll of stacked full-width bands — nine of them, each
   the same 8/4 rhythm, with the same twelve modules rendered three separate
   ways (the ranked list, the matrix, the deep-dive tiles) in three places you
   could not see at once.

   Splitting it by question gives every tab a focal point and a natural end.
   Nothing was dropped: every card that was on the old page is on one of these.
   The period filter sits above the tabs and scopes all of them, so the numbers
   still agree across the whole surface. */

type UsageTab = 'overview' | 'adoption' | 'output' | 'sections' | 'people';

const TABS: { id: UsageTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'adoption', label: 'Adoption', icon: Gauge },
  { id: 'output', label: 'Output', icon: PackagePlus },
  { id: 'sections', label: 'Sections', icon: LayoutGrid },
  { id: 'people', label: 'People', icon: Users },
];

/** The subhead is the tab's promise — it changes with the tab, like KH's does. */
const TAB_SUBHEAD: Record<UsageTab, string> = {
  overview: "How much happened in this period, and when.",
  adoption: "Whether the licence is earning its keep. Which seats get used, and which sit idle.",
  output: "What got created, run, shared and exported.",
  sections: "Every section of the platform, with its own numbers. Open one for the detail.",
  people: "Who did the work, member by member and team by team. Open a row for the breakdown.",
};

/**
 * The tab row. No counts on it, as in Knowledge Hub — which passes none to its
 * own `UnderlinedTabs` and carries its counts on the segmented filter pills.
 *
 * The People tab used to wear a badge fed by `rows.length`. That is the seat
 * count: `userUsageRows()` is `users.map(...)`, so its length is `users.length`
 * whatever window you hand it. A number that cannot move sitting directly above
 * the period filter — the one control that moves every other number on the page —
 * reads as "17 people in the last 30 days" when it means "17 licences, ever".
 * The real figure is already on the page twice, and both times it says what it
 * is: "of 17 licensed" on the KPI, and "Seats · 17" in the adoption funnel.
 */
function UsageTabs({ active, onChange }: {
  active: UsageTab;
  onChange: (id: UsageTab) => void;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex gap-6 overflow-x-auto">
      {TABS.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <motion.button
            key={t.id}
            onClick={() => onChange(t.id)}
            whileTap={prefersReduced ? undefined : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            aria-current={isActive ? 'page' : undefined}
            className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
              isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={14} />
              {t.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="usage-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Users | Teams lens toggle — the platform's sliding-pill segmented switch. ── */
function UsageLensSwitch({ lens, onSelect }: { lens: Lens; onSelect: (l: Lens) => void }) {
  const prefersReduced = useReducedMotion();
  const tabs: { id: Lens; label: string; icon: React.ElementType }[] = [
    { id: 'users', label: 'Users', icon: User },
    { id: 'teams', label: 'Teams', icon: Users },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 p-[3px] rounded-lg bg-ink-900/[0.04]">
      {tabs.map(t => {
        const active = lens === t.id;
        const Icon = t.icon;
        return (
          <motion.button
            key={t.id}
            onClick={() => onSelect(t.id)}
            whileTap={prefersReduced ? undefined : { scale: 0.97 }}
            aria-pressed={active}
            className={`relative inline-flex items-center gap-1.5 px-3.5 h-[1.625rem] rounded-md text-[0.8125rem] font-medium transition-colors cursor-pointer ${
              active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            {active && (
              <motion.span
                layoutId="usage-lens-active"
                transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-md bg-canvas-elevated shadow-[0_1px_2px_rgba(15,7,32,0.06),0_0_0_1px_rgba(15,7,32,0.04)]"
              />
            )}
            <Icon size={13} className="relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Seats & lifecycle bucket row: label + avatar stack + count ── */
function SeatRow({ label, people, tone }: { label: string; people: AdminUser[]; tone?: 'attention' }) {
  const shown = people.slice(0, 4);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-canvas-border last:border-0">
      <span className={`text-[0.75rem] flex-1 min-w-0 truncate ${
        tone === 'attention' && people.length > 0 ? 'font-medium text-mitigated-700' : 'font-medium text-ink-600'
      }`}>
        {label}
      </span>
      <div className="flex items-center">
        {shown.map((p, i) => (
          <div key={p.email} className={i > 0 ? '-ml-1.5' : ''} title={p.name}>
            <InitialsAvatar name={p.name} size={22} />
          </div>
        ))}
        {extra > 0 && (
          <span className="-ml-1.5 inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-canvas border border-canvas-border text-[0.5625rem] font-semibold text-ink-500">
            +{extra}
          </span>
        )}
      </div>
      <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums w-6 text-right">{people.length}</span>
    </div>
  );
}

/* ── An event in one of the "what happened" feeds. One spelling for all four. ── */
function FeedRow({ who, verb, what, chip, when, live }: {
  who: string; verb?: string; what: string; chip?: string; when: string; live: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 min-w-0 py-1.5">
      <InitialsAvatar name={who} size={24} />
      <div className="min-w-0 flex-1 leading-snug">
        <span className="text-[0.75rem] font-semibold text-ink-900">{who}</span>
        {/* The verb is optional — some feeds carry it inside `what` ("ran the
            X workflow"). Either way the name needs a space after it. */}
        {verb ? <span className="text-[0.75rem] text-ink-400"> {verb} </span> : ' '}
        <span className="text-[0.75rem] text-ink-600">{what}</span>
        {chip && (
          <span className="ml-1.5 inline-flex items-center px-1.5 h-[1.125rem] rounded border border-canvas-border bg-canvas text-[0.5625rem] font-semibold text-ink-500 align-middle">
            {chip}
          </span>
        )}
      </div>
      <span className={`shrink-0 text-[0.6875rem] font-mono tabular-nums ${live ? 'text-brand-700 font-semibold' : 'text-ink-400'}`}>
        {when}
      </span>
    </div>
  );
}

/** A headline number inside a card — the shape used by Runs, Sharing, Exports. */
function CardFigure({ value, caption, delta, compareLabel }: {
  value: number; caption: string; delta?: number | null; compareLabel: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">
          {fmt(value)}
        </span>
        <DeltaPill pct={delta} compareLabel={compareLabel} />
      </div>
      <div className="mt-1.5 text-[0.6875rem] text-ink-400">{caption}</div>
    </div>
  );
}

export default function PlatformUsageView() {
  const prefersReduced = useReducedMotion();
  const { logs, users } = useAdminData();
  const { can } = useCurrentUser();
  const logEvent = useAuditLog();
  const { addToast } = useToast();

  const [tab, setTab] = useState<UsageTab>('overview');
  // Defaults to the last 30 days — the window the page shipped with.
  const [filter, setFilter] = useState<DateFilter>({ kind: 'preset', id: '30d' });
  const [dateOpen, setDateOpen] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  const [lens, setLensState] = useState<Lens>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  // Engagement is now a multi-select like Role and Team, held as the labels the
  // user actually reads ('Heavy', 'No activity'), not the internal segment enum.
  const [segmentFilter, setSegmentFilter] = useState<string[]>([]);
  const [modalEmail, setModalEmail] = useState<string | null>(null);
  const [modalModule, setModalModule] = useState<UsageModule | null>(null);
  const [modalTeam, setModalTeam] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Switching lens resets the toolbar so filters never apply invisibly.
  const setLens = (l: Lens) => {
    setLensState(l);
    setSearchQuery(''); setRoleFilter([]); setTeamFilter([]); setSegmentFilter([]);
  };

  // Full 180-day real series, anchored on the newest record (live events fold
  // into the anchor bucket), then the window slices.
  const allDays = useMemo(() => usageDaysWithLive(logs), [logs]);
  const anchorLabel = useMemo(() => usageAnchorLabel(logs), [logs]);

  // When an event happened, said honestly. The page is "as of" the anchor, not
  // wall-clock, so only what this session actually produced is "Today" —
  // everything else is dated, which also matches the chart's axis.
  const whenLabel = (ev: { live: boolean; dayOffset: number; time: string }) =>
    ev.live ? `Today ${ev.time}` : usageDayLabel(ev.dayOffset, logs);
  // The picker measures from the anchor, not wall-clock — otherwise "last 7
  // days" would land months after the newest record and read as empty.
  const anchorDate = useMemo(() => new Date(usageAnchor(logs)), [logs]);
  const { days, priorDays, rangeDays: range } = useMemo(
    () => usageWindow(allDays, filter, anchorDate),
    [allDays, filter, anchorDate],
  );
  // Where the window actually ends. Presets run up to the anchor; a custom range
  // can stop earlier, and the copy must not call that "the most recent activity".
  const endOffset = days.length > 0 ? days[days.length - 1].dayOffset : 0;
  const endsAtAnchor = endOffset === 0;
  const endLabel = endsAtAnchor ? anchorLabel : usageDayLabel(endOffset, logs);
  /** The baseline every delta on this page is measured against. Named, never implied. */
  const compareLabel = `previous ${range} ${range === 1 ? 'day' : 'days'}`;

  const questionsAsked = useMemo(() => aiQuestions(days), [days]);
  const toolRuns = useMemo(() => aiToolRuns(days), [days]);

  const totals = useMemo(() => usageWindowTotals(days, users), [days, users]);
  const priorTotals = useMemo(() => usageWindowTotals(priorDays, users), [priorDays, users]);

  const rawRows = useMemo(() => userUsageRows(users, days), [users, days]);
  const priorByEmail = useMemo(() => {
    const map = new Map<string, number>();
    userUsageRows(users, priorDays).forEach(r => map.set(r.user.email, r.actions));
    return map;
  }, [users, priorDays]);
  const activeMean = useMemo(() => activeMeanActions(rawRows), [rawRows]);

  const rows = useMemo<UsageRow[]>(() =>
    rawRows.map(r => ({
      name: r.user.name,
      email: r.user.email,
      roleName: getRole(r.user.roleId)?.name ?? '—',
      team: r.user.team,
      lastLogin: r.user.lastLogin,
      actions: r.actions,
      aiQueries: r.aiQueries,
      downloads: r.downloads,
      topModule: r.topModule,
      trendPct: usageDeltaPct(r.actions, priorByEmail.get(r.user.email) ?? 0),
      segment: segmentFor(r, activeMean),
    })), [rawRows, priorByEmail, activeMean]);

  // Seats, and the module breakdown, are both read by the KPI band below, so
  // they are derived before it.
  const seats = useMemo(() => seatBuckets(users, range), [users, range]);

  // Module breakdown across the slice, ranked, with prior-window deltas.
  const moduleTotals = useMemo(() => {
    const sum = (slice: typeof days) => {
      const sums = Object.fromEntries(USAGE_MODULES.map(m => [m, 0])) as Record<UsageModule, number>;
      slice.forEach(d => USAGE_MODULES.forEach(m => { sums[m] += d.byModule[m]; }));
      return sums;
    };
    const cur = sum(days);
    const prior = sum(priorDays);
    // An area nobody touched in the window is not a ranking of zero — it is not
    // a row. This also keeps 'Other' (the catch-all for a module string nothing
    // maps yet) invisible until it actually catches something, at which point
    // it appears and says so.
    return USAGE_MODULES.map(m => ({ module: m, count: cur[m], deltaPct: usageDeltaPct(cur[m], prior[m]) }))
      .filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [days, priorDays]);
  const moduleMax = Math.max(1, ...moduleTotals.map(m => m.count));
  // Overview ranks the leaders; the full inventory of areas is the Sections tab.
  const OVERVIEW_MODULES = 6;
  const topModules = moduleTotals.slice(0, OVERVIEW_MODULES);
  const restModules = Math.max(0, moduleTotals.length - OVERVIEW_MODULES);

  /* ── The KPI band ────────────────────────────────────────────────────────
     Every tile names what it counts and what it doesn't (the ⓘ), states its
     change against a named baseline in whole units when the base is small, and
     — where the metric is really a share — draws that share against the level
     that counts as healthy. The old copy ("things done on the platform",
     "different people used the platform") restated the label in worse words
     instead of defining the metric, which is what made the numbers unreadable. */
  const seatCount = seats.total;
  // aiEvents is a strict subset of actions (both are audit-log rows), so this
  // share is honest. aiActivity — which also counts saved chats, and those are
  // not audit actions — is NOT a subset, and dividing it by actions would be a
  // number that can exceed 100%.
  const aiEventsTotal = useMemo(() => days.reduce((s, d) => s + d.aiEvents, 0), [days]);
  const aiSharePct = totals.actions > 0 ? Math.round((aiEventsTotal / totals.actions) * 100) : 0;

  const stats: UsageStat[] = [
    {
      key: 'active', label: 'People active', value: totals.activeUsers,
      of: `of ${seatCount} licensed`,
      current: totals.activeUsers, prior: priorTotals.activeUsers, unit: 'people',
      counts: 'Anyone who signed in and did at least one thing in this period.',
      excludes: 'People who only have a seat, and people whose invite is still unaccepted.',
    },
    {
      key: 'actions', label: 'Work done', value: fmt(totals.actions),
      of: `across ${moduleTotals.length} ${moduleTotals.length === 1 ? 'area' : 'areas'}`,
      current: totals.actions, prior: priorTotals.actions, unit: 'actions',
      counts: 'Every recorded step of real work — testing a control, raising a finding, running a workflow, generating a report.',
      excludes: 'Signing in, and simply opening a page without changing anything.',
    },
    {
      key: 'ai', label: 'AI-assisted work', value: `${aiSharePct}%`,
      of: `${fmt(aiEventsTotal)} of ${fmt(totals.actions)}`,
      current: aiEventsTotal, prior: priorDays.reduce((s, d) => s + d.aiEvents, 0), unit: 'AI actions',
      counts: 'Work where someone asked Ask IRA a question or ran an AI Concierge tool.',
      excludes: `Opening the AI panel without asking anything. Saved conversations are counted separately (${fmt(totals.aiConversations)} in this period).`,
    },
    {
      key: 'reports', label: 'Reports produced', value: fmt(totals.reports),
      current: totals.reports, prior: priorTotals.reports, unit: 'reports',
      counts: 'Finished reports and Action Taken Reports generated in this period.',
      excludes: 'Drafts, and reports that were only opened or shared.',
    },
  ];


  // Anomaly detection — days above mean + 2 standard deviations.
  const spikes = useMemo(() => usageSpikes(days), [days]);
  const biggestSpike = spikes[0];

  const topAiUsers = [...rows].sort((a, b) => b.aiQueries - a.aiQueries).slice(0, 5).filter(r => r.aiQueries > 0);
  const aiAdoption = useMemo(() => aiAdoptionPct(rawRows), [rawRows]);
  const concentration = useMemo(() => activityConcentration(rawRows), [rawRows]);

  const heatmap = useMemo(() => usageHourlyMatrix(days, logs), [days, logs]);

  /* ── The Overview's three readings ────────────────────────────────────────
     Each of these is a sentence derived from aggregates the page already shows.
     They exist because a chart titled with a noun ("Daily activity") makes the
     reader do the interpretation, and most readers won't. The title says what
     the chart says. */

  // The trend chart: weekly columns once the window is long enough for a weekly
  // cycle to exist, split into the work AI touched and the work it didn't.
  const activityData = useMemo(
    () => activityPoints(days, priorDays, logs),
    [days, priorDays, logs],
  );
  // The chart's reading, for the section note. The card itself takes a plain noun
  // title — shipped dashboards title charts with nouns and put the sentence in
  // the subtitle; the takeaway lives in the verdict strip at the top.
  const activityNote = useMemo(() => activityTakeaway(activityData), [activityData]);

  const verdict = useMemo<VerdictInput>(() => {
    const [first, second] = moduleTotals;
    const topTwoShare = totals.actions > 0
      ? Math.round(((first?.count ?? 0) + (second?.count ?? 0)) / totals.actions * 100)
      : 0;
    return {
      rangeDays: range,
      seats: seats.total,
      activeUsers: totals.activeUsers,
      priorActiveUsers: priorTotals.activeUsers,
      // "Never signed in" is not the same as "invited": a suspended member who
      // never arrived is idle too. Count the seats that have produced nothing.
      neverSignedIn: users.filter(u => u.lastLogin === 'Never').length,
      dormant: seats.dormant.length,
      pendingInvites: seats.invited.length,
      topArea: first?.module ?? null,
      secondArea: second?.module ?? null,
      topTwoShare,
      aiSharePct,
    };
  }, [moduleTotals, totals, priorTotals, range, seats, users, aiSharePct]);

  // Downloads & exports — who is pulling data out of the platform.
  const downloadDelta = usageDeltaPct(totals.downloads, priorTotals.downloads);
  const formatSplit = useMemo(() => downloadFormatSplit(days), [days]);
  const formatMax = Math.max(1, ...formatSplit.map(f => f.count));
  const recentDl = useMemo(() => recentDownloads(days), [days]);
  const topDownloaders = useMemo(
    () => [...rows].sort((a, b) => b.downloads - a.downloads).slice(0, 3).filter(r => r.downloads > 0),
    [rows],
  );

  // What got created — artifacts built in the window (live Create events fold in).
  const creations = useMemo(() => creationTotals(days, priorDays), [days, priorDays]);
  const creationMax = Math.max(1, ...creations.map(c => c.count));
  const recentCr = useMemo(() => recentCreations(days), [days]);

  // Workflow runs + sharing — executions and share events (live folds in).
  const runs = useMemo(() => workflowRunTotals(days, priorDays), [days, priorDays]);
  const runAreaMax = Math.max(1, ...runs.byArea.map(a => a.count));
  const recentRn = useMemo(() => recentRuns(days), [days]);
  const shares = useMemo(() => shareTotals(days, priorDays), [days, priorDays]);
  const shareKindMax = Math.max(1, ...shares.byKind.map(k => k.count));
  const recentSh = useMemo(() => recentShares(days), [days]);

  // Adoption funnel — every stage a fraction of total seats, and the drop-off
  // between stages is the point of the chart, so it gets said out loud.
  const funnel = useMemo(() => [
    { label: 'Seats', count: seats.total, hint: 'Licences you pay for' },
    { label: 'Signed in ever', count: users.filter(u => u.lastLogin !== 'Never').length, hint: 'Reached the product at least once' },
    { label: 'Active this period', count: seats.activeInRange.length, hint: 'Did something in the window' },
    { label: 'Used AI this period', count: rawRows.filter(r => r.actions > 0 && r.aiQueries > 0).length, hint: 'Asked IRA or ran a Concierge tool' },
  ], [seats, users, rawRows]);

  // Worth checking — the business "so what" of this period's numbers, as
  // read-only findings. This page only reports; acting on them lives elsewhere.
  const nextSteps = useMemo(() => {
    const steps: { key: string; text: string }[] = [];
    if (seats.invited.length > 0) {
      steps.push({
        key: 'invites',
        text: `${seats.invited.length} invite${seats.invited.length !== 1 ? 's' : ''} still pending — those seats are paid for but unused.`,
      });
    }
    if (seats.dormant.length > 0) {
      const n = seats.dormant.length;
      steps.push({
        key: 'dormant',
        text: n === 1
          ? "1 member hasn't signed in for 30+ days. That seat may not be needed."
          : `${n} members haven't signed in for 30+ days. Those seats may not be needed.`,
      });
    }
    if (typeof concentration === 'number' && concentration >= 60) {
      steps.push({
        key: 'concentration',
        text: `Top 3 members drive ${concentration}% of all activity — adoption is shallow beyond them.`,
      });
    }
    if (aiAdoption < 50 && totals.activeUsers > 0) {
      steps.push({
        key: 'ai',
        text: `Only ${aiAdoption}% of active members use AI — the rest are missing the fastest way to work.`,
      });
    }
    return steps.slice(0, 3);
  }, [seats, concentration, aiAdoption, totals.activeUsers]);

  // Teams lens: aggregate the user rows by team.
  const teamRows = useMemo<TeamUsageRow[]>(() => {
    const byTeam = new Map<string, UserUsageRow[]>();
    rawRows.forEach(r => {
      const name = r.user.team === '—' ? 'Unassigned' : r.user.team;
      const arr = byTeam.get(name) ?? [];
      arr.push(r);
      byTeam.set(name, arr);
    });
    return [...byTeam.entries()].map(([team, members]) => {
      const actions = members.reduce((s, m) => s + m.actions, 0);
      // Top module = each member's top module weighted by their action count.
      const tally = new Map<string, number>();
      members.forEach(m => tally.set(m.topModule, (tally.get(m.topModule) ?? 0) + m.actions));
      const topModule = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      const freshest = members.reduce((best, m) =>
        lastLoginOffsetDays(m.user.lastLogin) < lastLoginOffsetDays(best.user.lastLogin) ? m : best, members[0]);
      return {
        team,
        members: members.length,
        // Busiest first, so the five faces the stack shows are the five that
        // actually did the work — not whoever the seed listed first.
        memberNames: [...members].sort((a, b) => b.actions - a.actions).map(m => m.user.name),
        actions,
        aiQueries: members.reduce((s, m) => s + m.aiQueries, 0),
        topModule: actions === 0 ? '—' : topModule,
        lastActive: freshest.user.lastLogin,
      };
    }).sort((a, b) => b.actions - a.actions);
  }, [rawRows]);

  // Toolbar filtering. Team reads as 'Unassigned' everywhere a human sees it, so
  // the filter offers that word too — and matches it back to the '—' in the data.
  const uniqueRoles = [...new Set(rows.map(r => r.roleName))].sort();
  const uniqueTeams = [...new Set(rows.map(r => teamLabel(r.team)))]
    .sort((a, b) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)));
  const hasAnyFilter = searchQuery.length > 0 || roleFilter.length > 0 || teamFilter.length > 0 || segmentFilter.length > 0;
  const clearAll = () => { setSearchQuery(''); setRoleFilter([]); setTeamFilter([]); setSegmentFilter([]); };

  const filteredRows = rows.filter(r => {
    if (segmentFilter.length && !segmentFilter.includes(SEGMENT_LABELS[r.segment])) return false;
    if (roleFilter.length && !roleFilter.includes(r.roleName)) return false;
    if (teamFilter.length && !teamFilter.includes(teamLabel(r.team))) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Teams search matches the team name OR anyone in it — searching your own name
  // in the Teams lens finding nothing is the kind of dead end a search shouldn't have.
  const filteredTeamRows = teamRows.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.team.toLowerCase().includes(q) || r.memberNames.some(m => m.toLowerCase().includes(q));
  });

  const segmentCounts = useMemo(() => {
    const counts = new Map<EngagementSegment, number>();
    rows.forEach(r => counts.set(r.segment, (counts.get(r.segment) ?? 0) + 1));
    return counts;
  }, [rows]);
  // Only segments that actually exist in this window are offered — an "AI Concierge"
  // filter with zero rows behind it is a dead option.
  const segmentOptions = ENGAGEMENT_SEGMENTS
    .filter(seg => (segmentCounts.get(seg) ?? 0) > 0)
    .map(seg => SEGMENT_LABELS[seg]);

  /* ── The People KPI band ─────────────────────────────────────────────────
     Every section of Administration opens on one (DESIGN.md §7.11.1: KPI band →
     toolbar → content) and every other tab of this page opens on either the KPI
     row or the verdict. People opened straight onto a chip row and a table.

     On the Users lens these are click-to-filter cards — the affordance
     `AdminKpiCard` is built for (§7.11.2: hover lift, brand fill and an inset
     baseline bar when active). A bordered card carrying a number that you cannot
     click is a button's clothes on a label, and the amber "No activity" card is
     the worst offender: it names five people and then refuses to show you them.

     Crucially the cards and the Engagement dropdown are ONE piece of state, not
     two. Click "Heavy users" and the dropdown shows Heavy ticked; tick Heavy in
     the dropdown and the card lights up. The number you click and the rows you
     get back are always the same number.

     The Teams lens has nothing to filter by (a team is not a segment), so its
     cards stay pure metrics — no hover, no pointer, no promise. */
  const activeInWindow = rows.filter(r => r.actions > 0).length;
  const dormantCount = segmentCounts.get('Dormant') ?? 0;
  const peopleStats: Stat[] = lens === 'users'
    ? [
        { key: 'members', label: 'Members', value: rows.length, icon: Users },
        { key: 'active', label: 'Active', value: activeInWindow, icon: UserCheck },
        { key: 'heavy', label: 'Heavy users', value: segmentCounts.get('Power') ?? 0, icon: Gauge },
        {
          key: 'dormant', label: 'No activity', value: dormantCount, icon: UserX,
          // A seat that produced nothing this period is the one number here worth
          // acting on, so it is the one card allowed to be amber.
          tone: dormantCount > 0 ? 'attention' : undefined,
        },
      ]
    : [
        { key: 'teams', label: 'Teams', value: teamRows.length, icon: Users },
        { key: 'members', label: 'Members', value: rows.length, icon: User },
        // Summed from the rows below, not from the page totals — a band that
        // disagrees with the column it sits on top of is worse than no band.
        { key: 'actions', label: 'Actions', value: fmt(teamRows.reduce((s, t) => s + t.actions, 0)), icon: Activity },
        { key: 'ai', label: 'AI queries', value: fmt(teamRows.reduce((s, t) => s + t.aiQueries, 0)), icon: Sparkles },
      ];

  /* Each card is a saved selection of the same `segmentFilter` the dropdown
     drives. 'Active' is not a segment — it is everyone who did anything, i.e.
     every segment except Dormant — so it is spelled as that union, and only over
     the segments this window actually has (a filter for a segment with nobody in
     it would light up a card that shows an empty table). */
  const dormantLabel = SEGMENT_LABELS.Dormant;
  const heavyLabel = SEGMENT_LABELS.Power;
  const activeSegmentLabels = segmentOptions.filter(o => o !== dormantLabel);
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));

  /** Which card, if any, the current filter *is*. A combination only reachable
   *  from the dropdown (say Heavy + No activity) lights up no card — honest:
   *  none of them describes it. */
  const activeKpi = lens !== 'users' ? undefined
    : segmentFilter.length === 0 ? 'members'
    : sameSet(segmentFilter, [heavyLabel]) ? 'heavy'
    : sameSet(segmentFilter, [dormantLabel]) ? 'dormant'
    : activeSegmentLabels.length > 0 && sameSet(segmentFilter, activeSegmentLabels) ? 'active'
    : undefined;

  // Clicking the card you are already filtered by clears it — the same toggle
  // every selected chip on the platform has. 'Members' is the cleared state, so
  // it only ever clears.
  const selectKpi = (key: string) => {
    const next =
      key === 'heavy' ? [heavyLabel]
      : key === 'dormant' ? [dormantLabel]
      : key === 'active' ? activeSegmentLabels
      : [];
    setSegmentFilter(activeKpi === key ? [] : next);
  };

  // The Actions cell names its own baseline ("vs the previous 30 days"), so the
  // columns depend on the window — they can't be a module constant any more.
  const userMemberColumns = useMemo(() => userColumns(compareLabel), [compareLabel]);

  const modalRow = modalEmail ? rawRows.find(r => r.user.email === modalEmail) ?? null : null;
  const modalTeamMembers = modalTeam
    ? rawRows.filter(r => (r.user.team === '—' ? 'Unassigned' : r.user.team) === modalTeam)
    : [];

  // Export exactly what's on screen (the filtered set for the active lens).
  const exportCsv = () => {
    const esc = (v: unknown) => {
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    // The export carries every column on screen, in screen order, plus the two
    // things a spreadsheet can hold that a cell can't: the email and the members
    // behind a team's avatar stack.
    const headers = lens === 'users'
      ? ['Member', 'Email', 'Engagement', 'Role', 'Team', 'Last Active', 'Actions', `Trend vs ${compareLabel}`, 'AI Queries', 'Downloads', 'Top Module']
      : ['Team', 'Members', 'Member Names', 'Actions', 'AI Queries', 'Top Module', 'Last Active'];
    const body = lens === 'users'
      ? filteredRows.map(r => [
          r.name, r.email, SEGMENT_LABELS[r.segment], r.roleName, teamLabel(r.team), r.lastLogin, r.actions,
          r.trendPct === null ? '—' : `${r.trendPct > 0 ? '+' : ''}${r.trendPct}%`,
          r.aiQueries, r.downloads, r.actions === 0 ? '—' : r.topModule,
        ])
      : filteredTeamRows.map(r => [
          r.team, r.members, r.memberNames.join('; '), r.actions, r.aiQueries, r.topModule, r.lastActive,
        ]);
    const csv = [headers.map(esc).join(','), ...body.map(row => row.map(esc).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-usage-${lens}-${range}d-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const n = lens === 'users' ? filteredRows.length : filteredTeamRows.length;
    logEvent({ action: 'Export', description: `Exported platform usage as CSV (${n} ${lens === 'teams' ? 'teams' : 'members'}, last ${range} days)`, module: 'Admin', entity: 'Platform Usage' });
    addToast({ message: `Exported ${n} ${lens === 'teams' ? 'team' : 'member'}${n !== 1 ? 's' : ''} as CSV`, type: 'success' });
  };

  const exportCount = lens === 'users' ? filteredRows.length : filteredTeamRows.length;

  /* ── The toolbar ─────────────────────────────────────────────────────────
     Administration's skeleton, exactly (§7.11.1): search left, filters right,
     inside the table card. Three multi-selects of the same shape — Engagement,
     Role, Team — where there used to be a row of quick-set chips floating above
     the card doing the same job in a different vocabulary. `presetChip` is a
     quick-set affordance (the Roles presets, the Compare toggle); a table filter
     is a `ColumnFilter`, and now all three are.

     Every control on this row is h-10, so the row has one baseline. Export CSV
     used to sit here at h-8 — a 32px button in a 40px row — and it is an action,
     not a filter, so it now leads the section header beside the lens switch. */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 w-full">
      <MemberSearch
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={lens === 'users' ? 'Search by name or email...' : 'Search teams or members...'}
        className="w-full sm:w-[260px]"
      />
      <div className="ml-auto flex items-center gap-2">
        {hasAnyFilter && (
          <button type="button" onClick={clearAll} className="text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer">Clear all</button>
        )}
        {lens === 'users' && (
          <>
            <ColumnFilter
              variant="button" label="Engagement" options={segmentOptions}
              value={segmentFilter} onChange={setSegmentFilter} align="end" selectIndicator="checkbox"
              // The chips carried their counts on their face; the dropdown carries
              // them on each row, so nothing was lost in the trade.
              renderOption={(opt) => {
                const seg = ENGAGEMENT_SEGMENTS.find(s => SEGMENT_LABELS[s] === opt);
                return (
                  <>
                    <span className="truncate">{opt}</span>
                    <span className="ml-auto shrink-0 text-ink-400 tabular-nums">{seg ? segmentCounts.get(seg) ?? 0 : 0}</span>
                  </>
                );
              }}
            />
            <ColumnFilter variant="button" label="Role" options={uniqueRoles} value={roleFilter} onChange={setRoleFilter} align="end" selectIndicator="checkbox" />
            <ColumnFilter
              variant="button" label="Team" options={uniqueTeams} value={teamFilter} onChange={setTeamFilter} align="end" selectIndicator="checkbox"
              renderOption={(opt) => opt === UNASSIGNED
                ? <span className="text-ink-400">{UNASSIGNED}</span>
                : <span className="truncate">{opt}</span>}
            />
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Header strip — same full-bleed elevated panel as Administration. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        {/* No bottom padding, exactly as Knowledge Hub. The strip's own border-b
            has to BE the tabs' underline track — the tab row pulls onto it with
            -mb-px. A pb-6 here parks the row 24px above that hairline, which
            leaves the active tab's 3px brand bar floating in open space with a
            second, unrelated rule under it. */}
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
          {/* Texture, not a toy. The waves keep their ambient drift (a time-based
              sine, independent of the pointer) but no longer chase the cursor:
              `interactive` bent the lines toward the mouse and `parallax` slid
              them with it, which turned the header of a read-only reporting page
              into something that reacts to you while you are trying to read a
              number off it. Same off-switch DataSourceDetailView and
              ReportDocumentChrome already use.
              NOTE: both props default to TRUE in FloatingLines — they have to be
              passed as false explicitly, not merely omitted. */}
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive={false}
            parallax={false}
            color="#6a12cd"
            opacity={0.05}
          />
          {/* Title left, period right — the header's own row, the way Recents
              hangs "New chat" off its H1. The period used to sit below the tabs
              on a full-width band of its own, which never looked like anything
              because it had nothing to sit beside: every other toolbar on the
              platform earns its width from a search field (Recents, Admin) or a
              primary CTA (Knowledge Hub), and this page has neither. A band with
              one control on it is not a toolbar, it is a stranded control. */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start justify-between gap-6"
          >
            <div className="min-w-0">
              <h1 className="text-[2.125rem] font-semibold tracking-tight text-ink-900 leading-[1.15]">Platform Usage</h1>
              <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">{TAB_SUBHEAD[tab]}</p>
            </div>

          </motion.div>

          {/* Tabs at the bottom of the strip — the strip's own border-b is the
              underline track. Same spelling as Knowledge Hub and Administration. */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 -mb-px"
          >
            <UsageTabs active={tab} onChange={setTab} />
          </motion.div>
        </div>
      </div>

      {/* Content area — the Knowledge Hub's model exactly: a pinned toolbar and
          exactly one scroll region under it. The period row used to be a sticky
          bar with a backdrop-blur and a hairline that faded in on scroll, which
          meant the page had a scroll-within-scroll and a piece of chrome that
          changed appearance as you read. The Hub pins the toolbar instead and
          scrolls only the list — so the period is always in reach and never
          moves, and there is nothing to fade. */}
      <div className="pt-4 pb-8 flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* The period, in the platform's canonical toolbar row. Dashboards, Risk
            Register and Control Library all run this row, and all of them fill it
            the same way: content on the left, controls hard right.

            The window summary takes the slot the search field takes there, which
            is the whole point — a row needs two ends. Earlier attempts put the
            picker alone on a full-width band, and a band with one control on it
            is not a toolbar, it is a stranded control; that is why it read as
            empty no matter how it was styled. Not the header's top-right either:
            product-wide that slot holds an action (Create Risk, New Engagement,
            Add source), and the period is a filter, not an action. */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 lg:px-12 xl:px-[124px] pb-1">
          <span className="text-[0.8125rem] text-ink-500 min-w-0 truncate">
            {range > 0
              ? <>Showing <span className="font-semibold text-ink-800">{range} {range === 1 ? 'day' : 'days'}</span> {endsAtAnchor ? 'up to' : 'ending'} <span className="font-semibold text-ink-800">{endLabel}</span></>
              : <>No days in this range — the records end {anchorLabel}</>}
          </span>
          <div className="shrink-0">
            <DateFilterPicker
              filter={filter}
              open={dateOpen}
              onToggle={() => setDateOpen(o => !o)}
              onClose={() => setDateOpen(false)}
              onApply={f => { setFilter(f); setDateOpen(false); }}
              today={anchorDate}
              triggerRounded="rounded-lg"
              triggerHeight="h-9"
            />
          </div>
        </div>

        {/* The one scroll region. It spans the full panel width and carries the
            reading column's padding itself, so the scrollbar rides the panel
            edge instead of floating 124px inland beside the cards. Gutter is
            reserved so the bands don't nudge sideways when it appears. */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] pt-5 pb-8 px-6 lg:px-12 xl:px-[124px]"
        >
        {/* One tab at a time. Each band below declares which tab it belongs to;
            document order is already the order each tab wants to read in. */}
        <motion.div
          key={tab}
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReduced ? 0 : 0.3, ease: KH_EASE }}
        >
          {/* The answer, before the evidence. An admin arrives with three
              questions — is my team using this, is the licence worth it, what
              should I do — and every one of them used to be answerable only by
              reading four tiles and a chart and doing the arithmetic themselves.
              Nothing here is new data; it is the page's own numbers, said out
              loud, with the one button that acts on them. */}
          {tab === 'overview' && (
            <div className="mb-4">
              <UsageVerdict v={verdict} onSeeWho={() => setTab('people')} />
            </div>
          )}

          {tab === 'overview' && (
            <UsageKpiRow stats={stats} rangeDays={range} asOf={endLabel} endsAtAnchor={endsAtAnchor} />
          )}

          {/* The trend. The title IS the reading of the chart — a chart titled
              with a noun ("Daily activity") makes the reader derive the finding
              themselves, which most readers simply will not do. */}
          {tab === 'overview' && (
          <Band title="Activity" note={activityNote}>
            <div className="grid grid-cols-1 gap-4">
              <Card
                rank="hero"
                title="Actions per day"
                subtitle="The dark line is a 7-day average. Shaded columns are weekends."
                right={
                  <div className="flex items-center gap-3">
                    {/* Every mark on the plot has a key. The legend used to name
                        only the two bar segments, while the subtitle promised a
                        7-day line and weekend shading that nothing identified. */}
                    {/* Two keys, not five. The 7-day line and the weekend bands
                        are already named in the subtitle; keying them again is the
                        chart explaining itself twice. */}
                    <div className="hidden lg:flex items-center gap-4 text-[0.75rem] text-ink-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: SERIES.primary }} />Everything else
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: SERIES.secondary }} />AI was involved
                      </span>
                    </div>
                    <button className={presetChip(compareOn)} onClick={() => setCompareOn(c => !c)} aria-pressed={compareOn}>
                      Compare
                    </button>
                  </div>
                }
              >
                <UsageActivityChart points={activityData} compareOn={compareOn} height={280} />

                {biggestSpike && (
                  <p className="mt-4 pt-4 border-t border-canvas-border text-[0.75rem] text-ink-500">
                    Busiest single day was <span className="font-semibold text-ink-700">{usageDayLabel(biggestSpike.dayOffset, logs)}</span>, at {biggestSpike.ratio}× a normal day, mostly <span className="font-semibold text-ink-700">{biggestSpike.topModule}</span>.
                  </p>
                )}

              </Card>
            </div>
          </Band>
          )}

          {/* Where the work lands, and when. Two cards of roughly equal height —
              nothing here stretches to fill a neighbour. */}
          {/* Top areas, full width. The "when the work happens" card that used to
              sit beside it — seven day-bars and twenty-four hour-bars, each with
              its own number and its own label — was ninety-odd elements on its
              own, and answered a question ("Tuesdays, mid-morning") that changes
              no decision an admin makes. It has moved to Adoption, where the
              working-pattern question actually belongs. */}
          {tab === 'overview' && (
          <Band title="Where the work happens">
            <Card
              title="Top areas"
              subtitle="Click any area to see who used it and what they did."
            >
              <div className="space-y-1">
                {topModules.map(({ module, count }, i) => (
                  <RankedRow
                    key={module}
                    label={module}
                    count={count}
                    share={totals.actions > 0 ? Math.round((count / totals.actions) * 100) : 0}
                    pct={(count / moduleMax) * 100}
                    index={i}
                    onClick={() => setModalModule(module)}
                  />
                ))}
              </div>
              {restModules > 0 && (
                <div className="mt-5 pt-4 border-t border-canvas-border">
                  <button
                    type="button"
                    onClick={() => setTab('sections')}
                    className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    View all {moduleTotals.length} areas
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </Card>
          </Band>
          )}

          {/* When the team works — a working-pattern question, so it lives with
              the other licence-and-behaviour questions. */}
          {tab === 'adoption' && (
          <Band title="When the work happens">
            <Card
              icon={CalendarClock}
              title="When the work happens"
              subtitle="Which days the team works, and which hours."
            >
              <UsageRhythm data={heatmap} />
            </Card>
          </Band>
          )}

          {/* Adoption — is the licence earning its keep, and what is shelfware. */}
          {tab === 'adoption' && (
          <Band title="Seats and areas" note="Is the licence earning its keep">
            <UsageAdoption days={days} users={users} />
          </Band>
          )}

          {/* AI + the seat funnel. */}
          {tab === 'adoption' && (
          <Band title="AI and the seat funnel">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card
                icon={Sparkles}
                title="AI usage"
                subtitle="Ask IRA is the chat; the AI Concierge is the toolkit. A question you type and a tool you run are different products, so they are counted separately and never added up."
                className="lg:col-span-8"
                bodyClassName="flex flex-col"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
                  <div>
                    <Eyebrow className="mb-2.5">Ask IRA</Eyebrow>
                    <div className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">{fmt(questionsAsked)}</div>
                    <div className="mt-1.5 text-[0.6875rem] text-ink-400">Questions asked</div>
                  </div>
                  <div className="pl-6 border-l border-canvas-border">
                    <Eyebrow className="mb-2.5">&nbsp;</Eyebrow>
                    <div className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">{fmt(totals.aiConversations)}</div>
                    <div className="mt-1.5 text-[0.6875rem] text-ink-400">Conversations</div>
                  </div>
                  <div className="pl-6 border-l border-canvas-border">
                    <Eyebrow className="mb-2.5">Concierge</Eyebrow>
                    <div className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">{fmt(toolRuns)}</div>
                    <div className="mt-1.5 text-[0.6875rem] text-ink-400">Tool runs</div>
                  </div>
                  <div className="pl-6 border-l border-canvas-border">
                    <Eyebrow className="mb-2.5">Between them</Eyebrow>
                    <div className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">{aiAdoption}%</div>
                    <div className="mt-1.5 text-[0.6875rem] text-ink-400">Members using AI</div>
                  </div>
                </div>

                {/* What the four numbers add up to, in one sentence. AI is a
                    share of the work, not a separate universe — say what share. */}
                <p className="mt-5 text-[0.75rem] text-ink-600 leading-relaxed">
                  {totals.actions > 0 && totals.aiActivity > 0 ? (
                    <>
                      AI was involved in <span className="font-semibold text-ink-900">{Math.round((totals.aiActivity / totals.actions) * 100)}%</span> of
                      everything done on the platform this period — <span className="font-semibold text-ink-900">{fmt(totals.aiActivity)}</span> of {fmt(totals.actions)} actions.
                    </>
                  ) : (
                    <>No AI activity was recorded in this period.</>
                  )}
                </p>

                {/* Pinned to the bottom of the card, this block used to leave a
                    hand-sized hole in the middle of it: the card stretches to the
                    height of the taller funnel beside it, and `mt-auto` pushed all
                    of that slack into one gap between the sentence and the list.
                    Slack at the foot of a card reads as padding; slack through the
                    middle of one reads as something failed to load. */}
                {topAiUsers.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-canvas-border">
                    <div className="flex items-baseline justify-between mb-3">
                      <Eyebrow>Who leans on it most</Eyebrow>
                      <span className="text-[0.625rem] text-ink-400">AI actions in this period</span>
                    </div>
                    {/* Ranked, so rank it. Five names against five right-aligned
                        numerals was the one list on this page you had to read
                        rather than see — every other ranking here carries a bar. */}
                    <div className="space-y-3">
                      {topAiUsers.map((u, i) => (
                        <div key={u.email} className="flex items-center gap-2.5">
                          <InitialsAvatar name={u.name} size={24} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <span className="text-[0.8125rem] font-medium text-ink-800 truncate">{u.name}</span>
                              <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums">
                                <span className="font-semibold text-ink-900">{fmt(u.aiQueries)}</span>
                                <span className="ml-1.5">
                                  {totals.aiActivity > 0 ? Math.round((u.aiQueries / totals.aiActivity) * 100) : 0}%
                                </span>
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-ink-900/[0.06] overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-brand-600"
                                initial={prefersReduced ? false : { width: 0 }}
                                animate={{ width: `${Math.max(2, (u.aiQueries / topAiUsers[0].aiQueries) * 100)}%` }}
                                transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, delay: 0.03 * i }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* The seat funnel. The drop-off between stages is the entire point
                  of the chart, so it is the loudest thing on it. */}
              <Card
                icon={Users}
                title="From seat to habit"
                subtitle="Every stage as a share of the seats you pay for."
                className="lg:col-span-4"
              >
                {/* Labels ride above the track, never inside the fill: a fill
                    that reaches 100% would otherwise put ink on brand purple,
                    and one that reaches 20% would put white on an empty track.
                    The drop-off between stages is the point of the chart, so it
                    is the only red on the page. */}
                <div>
                  {funnel.map((stage, i) => {
                    const pct = seats.total > 0 ? Math.round((stage.count / seats.total) * 100) : 0;
                    const prev = i > 0 ? funnel[i - 1] : null;
                    const lost = prev ? prev.count - stage.count : 0;
                    return (
                      <div key={stage.label}>
                        {prev && (
                          <div className="flex items-center justify-end py-1.5">
                            {lost > 0 ? (
                              <span className="text-[0.625rem] font-semibold text-risk-700 tabular-nums">
                                {/* Name the thing that drops off. "−1 drops off here"
                                    left the reader supplying the noun themselves. */}
                                −{lost} {lost === 1 ? 'seat drops off here' : 'seats drop off here'}
                              </span>
                            ) : (
                              <span className="text-[0.625rem] text-ink-300">nobody drops off</span>
                            )}
                          </div>
                        )}
                        <div title={stage.hint}>
                          <div className="flex items-baseline justify-between gap-2 mb-1.5">
                            <span className="text-[0.75rem] font-medium text-ink-700 truncate min-w-0">{stage.label}</span>
                            <span className="shrink-0 text-[0.75rem] tabular-nums text-ink-400">
                              <span className="font-semibold text-ink-900">{stage.count}</span>
                              <span className="ml-1.5">{pct}%</span>
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-ink-900/[0.06] overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${i === funnel.length - 1 ? 'bg-brand-600' : 'bg-brand-400'}`}
                              initial={prefersReduced ? false : { width: 0 }}
                              animate={{ width: `${Math.max(2, pct)}%` }}
                              transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, delay: i * 0.06 }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 pt-4 border-t border-canvas-border">
                  <Eyebrow className="mb-2">Where the seats sit</Eyebrow>
                  <SeatRow label="Active this period" people={seats.activeInRange} />
                  <SeatRow label="No sign-in 30+ days" people={seats.dormant} tone="attention" />
                  <SeatRow label="Invited, not joined yet" people={seats.invited} tone="attention" />
                  <SeatRow label="Suspended or inactive" people={seats.suspendedOrInactive} />
                </div>
              </Card>
            </div>
          </Band>
          )}

          {/* Worth checking — pending invites, dormant seats, shallow adoption.
              Every one of these is a licence question, so it belongs on Adoption,
              not Overview. On Overview it sat next to the highlights and repeated
              them verbatim: "3 members haven't signed in for 30+ days" was on the
              same screen twice. */}
          {tab === 'adoption' && (
          <Band>
            <Card
              icon={ListChecks}
              title="Worth checking"
              subtitle="What this period's numbers imply. Acting on them lives in Administration."
            >
              {nextSteps.length > 0 ? (
                <ul className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3.5">
                  {nextSteps.map(step => (
                    <li key={step.key} className="flex items-start gap-2.5">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-mitigated-700 shrink-0" />
                      <p className="text-[0.75rem] text-ink-600 leading-relaxed">{step.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[0.8125rem] text-ink-400">Nothing needs attention right now.</p>
              )}
            </Card>
          </Band>
          )}

          {/* What the platform produced this period. The tab is called Output and
              its subhead already says what that means — a band heading here would
              be the third time the page says the same thing. */}
          {tab === 'output' && (
          <Band>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card
                icon={PackagePlus}
                title="What got created"
                subtitle="Workflows, dashboards, RACMs, engagements and reports built in this period"
                className="lg:col-span-12"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6">
                  <div className="lg:col-span-4 space-y-3.5">
                    {creations.map((c, i) => (
                      <Meter
                        key={c.kind.key}
                        label={c.kind.label}
                        value={fmt(c.count)}
                        pct={(c.count / creationMax) * 100}
                        delta={c.deltaPct}
                        compareLabel={compareLabel}
                        index={i}
                      />
                    ))}
                  </div>

                  <div className="lg:col-span-8">
                    <Eyebrow className="mb-2">Recently created</Eyebrow>
                    {recentCr.length > 0 ? (
                      <div className="divide-y divide-canvas-border">
                        {recentCr.map(cr => (
                          <FeedRow key={cr.id} who={cr.user} verb="created" what={cr.item} chip={cr.kindLabel} when={whenLabel(cr)} live={cr.live} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.8125rem] text-ink-400">Nothing created in this period.</p>
                    )}
                  </div>
                </div>
              </Card>

              <Card icon={Play} title="Workflow runs" subtitle="Executions across the platform" className="lg:col-span-6">
                <CardFigure value={runs.total} caption="Runs in this period" delta={runs.deltaPct} compareLabel={compareLabel} />
                <div className="mt-5 space-y-3.5">
                  {runs.byArea.map((a, i) => (
                    <Meter key={a.area} label={a.area} value={fmt(a.count)} pct={(a.count / runAreaMax) * 100} index={i} />
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-canvas-border">
                  <Eyebrow className="mb-2">Recent runs</Eyebrow>
                  {recentRn.length > 0 ? (
                    <div className="divide-y divide-canvas-border">
                      {recentRn.map(rn => (
                        <FeedRow key={rn.id} who={rn.user} what={rn.item} when={whenLabel(rn)} live={rn.live} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[0.8125rem] text-ink-400">No runs in this period.</p>
                  )}
                </div>
              </Card>

              <Card icon={Share2} title="Sharing" subtitle="Invites and share links sent" className="lg:col-span-6">
                <CardFigure value={shares.total} caption="Shares in this period" delta={shares.deltaPct} compareLabel={compareLabel} />
                <div className="mt-5 space-y-3.5">
                  {shares.byKind.filter(k => k.count > 0).map((k, i) => (
                    <Meter key={k.kind} label={k.kind} value={fmt(k.count)} pct={(k.count / shareKindMax) * 100} index={i} />
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-canvas-border">
                  <Eyebrow className="mb-2">Recent shares</Eyebrow>
                  {recentSh.length > 0 ? (
                    <div className="divide-y divide-canvas-border">
                      {recentSh.map(sh => (
                        <FeedRow key={sh.id} who={sh.user} what={sh.item} when={whenLabel(sh)} live={sh.live} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[0.8125rem] text-ink-400">No shares in this period.</p>
                  )}
                </div>
              </Card>

              <Card
                icon={Download}
                title="Exports & downloads"
                subtitle="Every download button on the platform, and who used it"
                className="lg:col-span-12"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6">
                  <div className="lg:col-span-3">
                    <CardFigure value={totals.downloads} caption="Files downloaded in this period" delta={downloadDelta} compareLabel={compareLabel} />
                    <div className="mt-5 space-y-3.5">
                      {formatSplit.map((f, i) => (
                        <Meter key={f.format} label={f.format} value={fmt(f.count)} pct={(f.count / formatMax) * 100} index={i} />
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <Eyebrow className="mb-2">Recent downloads</Eyebrow>
                    {recentDl.length > 0 ? (
                      <div className="divide-y divide-canvas-border">
                        {recentDl.map(dl => (
                          <FeedRow key={dl.id} who={dl.user} verb="downloaded" what={dl.item} chip={dl.format} when={whenLabel(dl)} live={dl.live} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.8125rem] text-ink-400">No downloads in this period.</p>
                    )}
                  </div>

                  {topDownloaders.length > 0 && (
                    <div className="lg:col-span-3">
                      <Eyebrow className="mb-3">Top downloaders</Eyebrow>
                      <div className="space-y-2.5">
                        {topDownloaders.map(u => (
                          <div key={u.email} className="flex items-center gap-2.5">
                            <InitialsAvatar name={u.name} size={24} />
                            <span className="text-[0.8125rem] font-medium text-ink-800 truncate">{u.name}</span>
                            <span className="ml-auto text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(u.downloads)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </Band>
          )}

          {/* Per-section deep-dives — compact tiles, full detail opens in a modal */}
          {tab === 'sections' && (
          <Band>
            <UsagePlatformSections days={days} rows={rawRows} rangeDays={range} />
          </Band>
          )}

          {/* The drill surface — who, exactly.

              Administration's skeleton end to end (§7.11.1): the lens switch and
              the one action on the left/right of a header row, then the KPI band,
              then the table with search-left · filters-right inside its card.
              This tab used to open on a bare chip row above an unbanded table —
              the only people surface on the platform that did. */}
          {tab === 'people' && (
          <Band>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <UsageLensSwitch lens={lens} onSelect={setLens} />
              {can('ad_usage_export') && (
                <button
                  onClick={exportCsv}
                  disabled={exportCount === 0}
                  title={exportCount === 0 ? 'Nothing to export' : hasAnyFilter ? `Export the ${exportCount} rows you can see` : 'Export all rows'}
                  // BTN_CTA_OUTLINE — the platform's spine action (h-10, flat,
                  // rounded-md), the same button Administration puts in this slot.
                  className={`group ${BTN_CTA_OUTLINE} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-canvas-elevated disabled:hover:border-canvas-border`}
                >
                  <Download size={14} className="transition-transform duration-200 group-hover:translate-y-0.5 group-active:translate-y-1" />
                  Export CSV
                </button>
              )}
            </div>

            <AdminKpiRow
              stats={peopleStats}
              active={activeKpi}
              onSelect={lens === 'users' ? selectKpi : undefined}
            />

            {lens === 'users' ? (
              <SmartTable
                key="users"
                columns={userMemberColumns}
                data={filteredRows}
                keyField="email"
                searchable={false}
                paginated
                pageSize={10}
                hideResultCount
                fixedLayout
                stickyHeader
                animateRows={false}
                onRowClick={(r) => setModalEmail(r.email as string)}
                headerExtra={toolbar}
                emptyContent={
                  <EmptyState
                    icon={Users}
                    size="compact"
                    title={hasAnyFilter ? 'No members match your filters' : 'Nobody has a seat yet'}
                    body={hasAnyFilter
                      ? 'Try a different search, or clear the active filters.'
                      : 'Members appear here once they are invited in Administration.'}
                    action={hasAnyFilter
                      ? <button className={BTN_CTA_OUTLINE} onClick={clearAll}>Clear filters</button>
                      : undefined}
                  />
                }
              />
            ) : (
              <SmartTable
                key="teams"
                columns={teamColumns}
                data={filteredTeamRows}
                keyField="team"
                searchable={false}
                paginated
                pageSize={10}
                hideResultCount
                fixedLayout
                stickyHeader
                animateRows={false}
                onRowClick={(r) => setModalTeam(r.team as string)}
                headerExtra={toolbar}
                emptyContent={
                  <EmptyState
                    icon={Users}
                    size="compact"
                    title={hasAnyFilter ? 'No teams match your search' : 'No teams yet'}
                    body={hasAnyFilter
                      ? 'Try a different team name or member, or clear the search.'
                      : 'Teams are created in Administration.'}
                    action={hasAnyFilter
                      ? <button className={BTN_CTA_OUTLINE} onClick={clearAll}>Clear search</button>
                      : undefined}
                  />
                }
              />
            )}
          </Band>
          )}

          <p className="mt-8 text-[0.6875rem] text-ink-400">
            Everything on this page is derived from the audit log and the live record set, as of {anchorLabel}.
            Numbers move when work happens — they are not a snapshot taken at some other time.
          </p>
        </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {modalRow && (
          <UserUsageModal
            key={`user-${modalRow.user.email}`}
            row={modalRow}
            days={days}
            logs={logs}
            rangeDays={range}
            segment={segmentFor(modalRow, activeMean)}
            onClose={() => setModalEmail(null)}
          />
        )}
        {modalModule && (
          <ModuleUsageModal
            key={`module-${modalModule}`}
            module={modalModule}
            days={days}
            priorDays={priorDays}
            totalActions={totals.actions}
            rows={rawRows}
            rangeDays={range}
            onClose={() => setModalModule(null)}
          />
        )}
        {modalTeam && (
          <TeamUsageModal
            key={`team-${modalTeam}`}
            team={modalTeam}
            members={modalTeamMembers}
            rangeDays={range}
            onClose={() => setModalTeam(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
