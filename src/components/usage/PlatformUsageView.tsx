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

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Users, User, UserCheck, UserX, Activity, Sparkles, Download,
  CalendarClock, PackagePlus, Play, Share2, TrendingUp,
  Gauge, LayoutGrid, Grid2x2, Send, Clock, Layers,
  PieChart as PieChartIcon,
  type LucideIcon,
} from 'lucide-react';
import { useAdminData, useAuditLog, type AdminUser } from '../../context/AdminDataContext';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { getRole } from '../../data/rbac';
import {
  USAGE_MODULES, MODULE_FAMILY, type UsageFamily,
  usageDaysWithLive, userUsageRows, usageDayLabel,
  usageAnchorLabel, usageAnchor,
  usageWindowTotals, usageDeltaPct, seatBuckets, lastLoginOffsetDays,
  segmentFor, activeMeanActions, aiAdoptionPct, usageHourlyMatrix, engagementMatrix,
  activityConcentration, usageSpikes, recentDownloads, downloadAreaSplit,
  aiQuestions, aiToolRuns,
  creationTotals, recentCreations, workflowRunTotals, recentRuns, shareTotals, recentShares,
  bulkAuditActivity,
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
import { InitialsAvatar, AvatarStack, MemberSearch, AdminKpiRow } from '../admin/AdminPrimitives';
import { presetChip, BTN_CTA_OUTLINE, type Stat } from '../admin/adminTokens';
import UsageKpiRow, { type UsageStat } from './UsageKpiRow';
import UserUsageModal from './UserUsageModal';
import ModuleUsageModal from './ModuleUsageModal';
import TeamUsageModal from './TeamUsageModal';
import UsageRhythm from './UsageRhythm';
import UsageActivityChart, { UsageAiStrip } from './UsageActivityChart';
import { activityPoints } from './usageActivity';
import UsageVerdict, { type VerdictInput } from './UsageVerdict';
import UsageHighlights, { type HighlightsInput } from './UsageHighlights';
import UsagePlatformSections from './UsagePlatformSections';
import UsageMatrix from './UsageMatrix';
import { MODULE_SECTION, type SectionKey } from './usageSectionMap';
import UsageAdoption from './UsageAdoption';
import UsageConcentration from './UsageConcentration';
import UsageMiniTrend from './UsageMiniTrend';
import UsageAreaMix from './UsageAreaMix';
import { Card, Band, Eyebrow, DeltaPill, InfoPopover, Legend, Meter, RankedRow, UsageLede } from './usageChrome';
import { KH_EASE, SERIES, fmt } from './usageTokens';

const DAY_MS = 86400000;

/** Join a list the way a person says it: "A", "A and B", "A, B and C". */
function listAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

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

/* The Activity filter's two states, mirroring the KPI cards. "Active" spans the
   Heavy/Regular/Light tiers (anyone with actions this period); "No activity" is
   its exact complement (the Dormant tier). Named tokens so the option list and
   the filter logic agree on the strings. NO_ACTIVITY intentionally equals
   SEGMENT_LABELS.Dormant so the two never drift apart. */
const ACTIVE_OPTION = 'Active';
const NO_ACTIVITY_OPTION = SEGMENT_LABELS.Dormant; // 'No activity'
const ACTIVITY_OPTIONS = [ACTIVE_OPTION, NO_ACTIVITY_OPTION];

/** Nobody is "—". The users table said one thing, the teams table another. */
const UNASSIGNED = 'Unassigned';

const teamLabel = (team: string) => (team === '—' ? UNASSIGNED : team);

/** The em-dash a numeric cell shows when there is nothing to show. */
const Blank = () => <span className="text-[0.75rem] text-ink-300">—</span>;

/* The members table. `table-fixed` (see `fixedLayout` below) makes these widths
   real, so the header row can no longer wrap "IRA Queries" onto two lines while
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
    key: 'segment', label: 'Usage', sortable: true, width: '100px',
    render: (r) => <Pill tone={SEGMENT_TONE[r.segment]}>{SEGMENT_LABELS[r.segment]}</Pill>,
  },
  /* `truncate` is `overflow:hidden` + `text-overflow:ellipsis`, and neither does
     anything to an INLINE box. These two cells were spans, so "System Admin" and
     "SOX Audit" did not ellipse at the cell edge — they simply overflowed it and
     ran into each other, which is what made the table look broken at 1512px.
     A block box truncates. It also needs the width to be honest: Role and Team
     hold the longest free text in the table and were the two narrowest columns
     on it. */
  {
    key: 'roleName', label: 'Role', sortable: true, width: '116px',
    render: (r) => <span className="block truncate text-[0.8125rem] text-ink-700" title={r.roleName}>{r.roleName}</span>,
  },
  {
    key: 'team', label: 'Team', sortable: true, width: '108px',
    render: (r) => r.team === '—'
      ? <span className="block truncate text-[0.8125rem] text-ink-400">{UNASSIGNED}</span>
      : <span className="block truncate text-[0.8125rem] text-ink-700" title={r.team}>{r.team}</span>,
  },
  /* The DAY, not the day and the clock time. The stored value is "Today, 16:14",
     and the minute somebody last signed in is not a fact this page is for: it is
     an adoption surface, and "Today" is the whole answer. Printing the time cost
     the column half its width again, which is width Role and Team needed to stop
     truncating — so the clock was pushing real content off the table to say
     something nobody came here to read. It stays on hover, and in the CSV. */
  {
    key: 'lastLogin', label: 'Last active', sortable: true, width: '110px',
    render: (r) => (
      <span
        title={r.lastLogin}
        className={`block truncate text-[0.75rem] tabular-nums ${r.lastLogin === 'Never' ? 'italic text-ink-400' : 'text-ink-700'}`}
      >
        {r.lastLogin.split(',')[0]}
      </span>
    ),
  },
  {
    // Actions and Trend were two columns saying one thing: the trend IS the
    // action count, measured against the window before. The rest of the page
    // already spells that as a number plus a `DeltaPill` (every CardFigure and
    // Meter does), and the pill names its baseline on hover — which the bare
    // "+35%" never did.
    key: 'actions', label: 'Actions', sortable: true, width: '112px', align: 'right',
    render: (r) => (
      <div className="inline-flex items-baseline gap-1.5">
        <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>
        <DeltaPill pct={r.trendPct} compareLabel={compareLabel} size="sm" />
      </div>
    ),
  },
  /* "IRA use", not "IRA actions". A right-aligned count column has to be wide
     enough for its own HEADER, not just its digits, and "IRA actions" plus a sort
     arrow did not fit in 9% of the table — it wrapped onto two lines and dragged
     the whole header row down with it. The shorter label fits on one. */
  {
    key: 'aiQueries', label: 'IRA use', sortable: true, width: '82px', align: 'right',
    render: (r) => r.aiQueries === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'downloads', label: 'Downloads', sortable: true, width: '114px', align: 'right',
    render: (r) => r.downloads === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.downloads)}</span>,
  },
  {
    // 14%, not 11%. The longest module name the platform has is "Knowledge Hub",
    // and inside a Pill inside an 11% cell of a `table-fixed` layout it was
    // clipped mid-word on every row that had it — a chip that cannot print its
    // own label is worse than no chip.
    key: 'topModule', label: 'Top area', sortable: true, width: '132px',
    render: (r) => r.actions === 0 ? <Blank /> : <Pill tone="draft">{r.topModule}</Pill>,
  },
];

/* The teams table, spelled exactly like Administration's: a brand icon tile and
   the name, the member avatar stack, then the numbers. */
/* The Teams lens is the SAME TABLE as the Users lens, counting a different noun,
   and the two are one toggle apart — so every shared column has to be spelled the
   same way in both. It was not: Teams said "Last Active" where Users said "Last
   active", printed its timestamp in `font-mono` where Users used the page's own
   face, and headed its AI column "IRA actions" — the exact label Users had already
   rejected for wrapping onto two lines. Flipping the switch redrew the same row in
   a different dialect. */
const teamColumns: Column<TeamUsageRow>[] = [
  /* Fixed, and the avatars flexible — not the other way round. With Team taking
     the slack, six columns in a 1470px table left roughly 790px of white between
     a team's name and its faces, so the two halves of one row read as unrelated
     objects. The identity column only needs room for the longest team name.

     No `truncate` here: that prop means `max-width: 0` (SmartTable §Column), which
     is the trick that lets a WIDTH-LESS column shrink, and it beats an explicit
     width — set both and the column collapses to its own padding. Fixed width and
     `truncate` are alternatives, not a pair. The name still ellipsizes: the cell
     is a `min-w-0` flex row, so the inner `truncate` div clips against 260px. */
  {
    key: 'team', label: 'Team', sortable: true, width: '260px',
    render: (r) => (
      /* 26px and `gap-2.5`, matching the Member cell one toggle away. This was a
         36px brand tile against the Users lens's 26px avatar, which made the two
         tables different ROW HEIGHTS — the switch between them visibly jumped. */
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-[26px] h-[26px] rounded-lg bg-brand-100 ring-1 ring-inset ring-brand-600/10 flex items-center justify-center shrink-0">
          <Users size={13} className="text-brand-700" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[0.8125rem] font-semibold text-ink-900 tracking-[-0.01em] truncate">{r.team}</div>
          <div className="text-[0.6875rem] text-ink-400 mt-0.5">{r.members} member{r.members !== 1 ? 's' : ''}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'memberNames', label: 'Members', sortable: false,
    render: (r) => <AvatarStack names={r.memberNames} />,
  },
  {
    key: 'actions', label: 'Actions', sortable: true, width: '112px', align: 'right',
    render: (r) => <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>,
  },
  /* "IRA use" at 82px, the Users lens's own answer to this exact column. Its
     comment there records why: "IRA actions" plus a sort arrow does not fit a
     right-aligned count column and wraps onto two lines. */
  {
    key: 'aiQueries', label: 'IRA use', sortable: true, width: '82px', align: 'right',
    render: (r) => r.aiQueries === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'topModule', label: 'Top area', sortable: true, width: '132px',
    render: (r) => r.actions === 0 ? <Blank /> : <Pill tone="draft">{r.topModule}</Pill>,
  },
  /* The DAY, not the clock — the Users lens's rule, and for its reason: this is
     an adoption surface, and the minute a team last signed in is not what it is
     for. The time stays on hover and in the CSV. `font-mono` is gone with it: no
     other cell on this page is monospaced, and a lone typewriter column read as
     debug output sitting in a product table. */
  {
    key: 'lastActive', label: 'Last active', sortable: true, width: '110px',
    render: (r) => (
      <span
        title={r.lastActive}
        className={`block truncate text-[0.75rem] tabular-nums ${r.lastActive === 'Never' ? 'italic text-ink-400' : 'text-ink-700'}`}
      >
        {r.lastActive.split(',')[0]}
      </span>
    ),
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

/* ── The five tabs ─────────────────────────────────────────────────────────
   One tab, one question, in the order the person reading actually asks them.
   The reader is an audit lead, not an analyst: they will not hold a question in
   their head across a tab switch, so no tab may need another tab to finish its
   own point.

     Overview  — is anyone using this?
     Seats     — are we paying for seats nobody uses?
     People    — who is doing the work?
     Areas     — which parts of the product get used?
     Output    — what did we get out of it?

   Seats used to carry People as well: the licence verdict, the seat bands, the
   funnel, the recommendations AND the full member table, seven bands deep. Two
   questions stacked on one tab is a page inside a page, and the second question
   always loses. They are separate tabs now, and neither lost a card. */
type UsageTab = 'overview' | 'seats' | 'people' | 'areas' | 'output';

const TABS: { id: UsageTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'seats', label: 'Seats', icon: Gauge },
  { id: 'people', label: 'People', icon: Users },
  // "Areas", not "Sections". The tab is named after the thing it is about, the
  // twelve areas of the product, rather than after the twelve cards it happens
  // to be built from. It holds every view of an area the page has: the map (the
  // scatter), the ranking (busiest areas), and the detail (the cards).
  { id: 'areas', label: 'Areas', icon: LayoutGrid },
  { id: 'output', label: 'Output', icon: PackagePlus },
];

/** The verdict's window. The platform's 60% healthy mark is a weekly-active-to-
 *  licence ratio, so the number judged against it has to be measured on a week. */
const VERDICT_WINDOW_DAYS = 7;
/** How many weeks of licence use the hero plots behind the number. */
const VERDICT_TREND_WEEKS = 8;

/** How many AI users the "who uses it most" list names before rolling the tail
 *  into one row. Nine covers every AI user in the seeded period, so the list is
 *  the whole roster rather than a head with a hidden tail; the roll-up still
 *  catches a wider window. */
const AI_USERS_SHOWN = 9;

/* The subhead is the tab's question, asked in the words the reader would use.
   It used to be a description of the contents ("What got created, run, shared
   and exported"), which tells a reader what they are about to look at but not
   why they would want to. A question tells them both. */
const TAB_SUBHEAD: Record<UsageTab, string> = {
  overview: 'Is anyone using this? How much work happened, and when.',
  seats: 'Are you paying for seats nobody uses?',
  people: 'Who is doing the work, and who has gone quiet?',
  areas: 'Which parts of the product get used, and which sit idle?',
  output: 'What the team built, ran, shared and downloaded.',
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
function UsageTabs({ active, onChange, tabs }: {
  active: UsageTab;
  onChange: (id: UsageTab) => void;
  /** Which tabs this reader may see. A team lead gets People only. */
  tabs?: UsageTab[];
}) {
  const prefersReduced = useReducedMotion();
  const shown = tabs ? TABS.filter(t => tabs.includes(t.id)) : TABS;
  return (
    <div className="flex gap-6 overflow-x-auto">
      {shown.map(t => {
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
/* The four states 17 seats can be in. A flat label-gap-count table hid the one
   thing this breakdown is for — the PROPORTION: that Active dwarfs the rest, and
   how much of what you pay for is sitting idle. Each row now carries a bar of its
   share of the total, tone-coloured (brand for the seats doing work, amber for
   the ones you are paying for and not using, grey for the expected-inactive), so
   the composition reads at a glance and the empty middle is gone. */
/* ── The seat funnel — from paying for a licence to using it as a habit ──────
   A meter-per-stage read as four progress bars, not a funnel: the narrowing
   from 17 → 9 only lived in the numbers, and the drop-off was a line of red
   text the eye had to find. Now the bars themselves taper — each one's WIDTH is
   its share of the seats you pay for — so the funnel is the shape, and the seats
   that fall away between stages are drawn as a red gap the "−N" label sits over.

   The stages darken as they descend the same one hue (RAMP is defined for
   ordered buckets): the seats that reached the habit land on full brand, the
   funnel they came through steps back toward it — the author's "the last stage
   is the point" intent, now carried by the ramp instead of a flat muted/brand
   split. Red is the only non-brand ink here, because the drop-off is the one
   thing on this card an admin can act on. */
const FUNNEL_SHADES = ['#C4A2EE', '#A87BE4', '#8B4FD8', '#6A12CD'];

/**
 * Why one seat never reached a stage, in the seat's own terms.
 *
 * "−4 seats drop off" was the card's worst line: four seats left the funnel for
 * four unrelated reasons, and flattening them into one red number told an admin
 * to worry about all four equally. Three of them are switched off ON PURPOSE
 * (suspended, locked, inactive) and are not waste at all; the fourth is a live
 * Active licence that has been silent for months, and IS. One of those is a
 * to-do and three are noise, and the old line could not tell you which.
 *
 * This explains why a seat is not SIGNED IN or not ACTIVE. It is deliberately not
 * the reason for every stage: a seat that stops at "Used IRA" is signed in, is
 * active, and stopped for a reason this function knows nothing about — so the
 * stage that rejected the seat supplies its own explanation (`why`, below), and
 * this is only the default. Asked to explain an IRA drop it would reach for the
 * login clock and answer "quiet 0 days", which is both absurd and false.
 */
function dropReason(u: AdminUser): string {
  if (u.status === 'Invited') return 'invite not accepted';
  if (u.status === 'Suspended') return 'suspended';
  if (u.status === 'Locked') return 'locked';
  if (u.status === 'Inactive') return 'set to inactive';
  const d = lastLoginOffsetDays(u.lastLogin);
  return Number.isFinite(d) ? `quiet ${d} days` : 'never signed in';
}

/**
 * The seat funnel: seventeen seats, and the point each one stopped at.
 *
 * This took `count: number` per stage and could therefore only ever say "−2".
 * A reader's very next question is "which two", and a count has thrown that away
 * before the component is even called. It takes SETS now, so every drop-off is a
 * real set difference and every seat that falls out can be named, given a reason,
 * and clicked through to.
 *
 * The stages are nested BY CONSTRUCTION (each filters the one above) rather than
 * by three predicates that happen to agree today. A funnel whose third bar can
 * outgrow its second is not a funnel, and `prev.count - stage.count` would have
 * quietly printed a negative drop-off if the definitions ever drifted.
 *
 * The hint used to live in a `title` attribute, so the only way to learn what a
 * stage meant was to rest the cursor on it and wait for the OS to draw a black
 * box over the card. It is a subtitle now: on the surface, where the label is.
 */
function SeatFunnel({ stages, total, onPick }: {
  stages: {
    label: string;
    seats: AdminUser[];
    hint: string;
    /** Why a seat failed to reach THIS stage. Owned by the stage, because only
     *  the stage knows what it tested for. */
    why: (u: AdminUser) => string;
  }[];
  total: number;
  /** Cross to People with this seat found. The one crossing this page allows. */
  onPick: (name: string) => void;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="space-y-4">
      {stages.map((stage, i) => {
        const count = stage.seats.length;
        const pct = total > 0 ? (count / total) * 100 : 0;
        const prev = i > 0 ? stages[i - 1] : null;
        const prevPct = prev && total > 0 ? (prev.seats.length / total) * 100 : 100;
        // The real seats that fell away, not a subtraction of two totals.
        const lostSeats = prev
          ? prev.seats.filter(p => !stage.seats.some(s => s.email === p.email))
          : [];
        const shade = FUNNEL_SHADES[Math.min(i, FUNNEL_SHADES.length - 1)];
        return (
          <div key={stage.label}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="min-w-0 truncate text-[0.8125rem] font-medium text-ink-700">{stage.label}</span>
              <span className="shrink-0 inline-flex items-baseline gap-2.5 tabular-nums">
                <span className="w-5 text-right text-[0.8125rem] font-semibold text-ink-900">{count}</span>
                <span className="w-9 text-right text-[0.6875rem] text-ink-400">{Math.round(pct)}%</span>
              </span>
            </div>
            {/* What the stage counts, said on the card rather than hidden in an OS
                tooltip. */}
            <p className="mb-1.5 text-[0.6875rem] leading-snug text-ink-400">{stage.hint}</p>
            <div className="relative h-7 overflow-hidden rounded-md bg-brand-50/70">
              {/* The seats that fell away, drawn where they fell away: the gap
                  between this bar and the wider one above it. */}
              {lostSeats.length > 0 && (
                <div
                  className="absolute inset-y-0 bg-risk-700/[0.09]"
                  style={{ left: `${pct}%`, width: `${Math.max(0, prevPct - pct)}%` }}
                  aria-hidden
                />
              )}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-md"
                style={{ background: shade }}
                initial={prefersReduced ? false : { width: 0 }}
                animate={{ width: `${Math.max(2, pct)}%` }}
                transition={
                  prefersReduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 240, damping: 30, delay: 0.06 * i }
                }
              />
            </div>

            {/* Who dropped, by name, under the gap they dropped into. Each name is
                a real button: it crosses to People with that seat found, because
                "which two?" deserves an answer the reader can act on rather than
                a number they have to go hunting for. */}
            {lostSeats.length > 0 && (
              <div className="mt-2">
                <div className="text-[0.6875rem] font-medium text-risk-600">
                  {lostSeats.length} {lostSeats.length === 1 ? 'seat stops here' : 'seats stop here'}
                </div>
                <div className="mt-1 space-y-0.5">
                  {lostSeats.map(u => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => onPick(u.name)}
                      className="group flex w-full items-baseline justify-between gap-3 rounded px-1 -mx-1 py-0.5 text-left transition-colors hover:bg-canvas"
                      title={`Find ${u.name} on the People tab`}
                    >
                      <span className="truncate text-[0.75rem] text-ink-700 group-hover:text-brand-700">{u.name}</span>
                      <span className="shrink-0 text-[0.6875rem] text-ink-400">{stage.why(u)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── An event in one of the "what happened" feeds. One spelling for all four. ── */
/**
 * One line of a feed: who, what, what kind, when.
 *
 * The kind chip used to be glued to the end of the sentence, so it landed at a
 * different x on every row — five chips scattered across the middle of the card,
 * which is exactly the thing a column exists to prevent. It now has a column of
 * its own, right-aligned against the timestamp, so the rows scan.
 */
function FeedRow({ who, verb, what, chip, when, live }: {
  who: string; verb?: string; what: string; chip?: string; when: string; live: boolean;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0 py-2">
      <InitialsAvatar name={who} size={24} />
      <div className="min-w-0 flex-1 leading-snug truncate">
        <span className="text-[0.75rem] font-semibold text-ink-900">{who}</span>
        {/* The verb is optional — some feeds carry it inside `what` ("ran the
            X workflow"). Either way the name needs a space after it. */}
        {verb ? <span className="text-[0.75rem] text-ink-400"> {verb} </span> : ' '}
        <span className="text-[0.75rem] text-ink-600">{what}</span>
      </div>
      {chip && (
        <span className="shrink-0 inline-flex items-center justify-center px-1.5 h-[1.125rem] rounded border border-canvas-border bg-canvas text-[0.5625rem] font-semibold text-ink-500">
          {chip}
        </span>
      )}
      <span className={`shrink-0 w-[3.25rem] text-right text-[0.6875rem] font-mono tabular-nums ${live ? 'text-brand-700 font-semibold' : 'text-ink-400'}`}>
        {when}
      </span>
    </div>
  );
}

/**
 * One member on the "who uses IRA" lists: avatar, name, then the figure
 * leading its share.
 *
 * No bar. The five it replaces were full-width 28px slabs scaled to the TOP
 * user, while the figure printed beside each was a share of all IRA actions — so
 * the longest bar filled its row and read 22%. A bar whose length contradicts
 * its own number is worse than no bar. Rescaling them to the same denominator
 * would not save it either: with counts this close (13, 11, 10, 9…) a linear bar
 * either reads uniform or shrinks to a stub, and the split bar in the left
 * column already carries the one proportion worth drawing.
 *
 * The row is instead the shape `UsageConcentration`'s `RankRow` uses at HEAD —
 * 30px avatar, hairline, figure then share — because the two cards sit side by
 * side on the People tab and rank the same people by two measures. Rhythm is
 * 17px rather than that card's 13px: this card lists every AI user instead of a
 * head plus a roll-up, so the looser rhythm is what brings the two lists to the
 * same baseline. Spacing does the filling, not invented content.
 */
function AiUserRow({ avatar, name, nameClass, figure, trail }: {
  avatar: ReactNode; name: string; nameClass: string; figure: ReactNode; trail: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-[17px] border-b border-canvas-border/50 last:border-b-0">
      <span className="inline-flex shrink-0">{avatar}</span>
      <span className={`min-w-0 flex-1 truncate text-[0.875rem] font-medium ${nameClass}`} title={name}>{name}</span>
      <span className="shrink-0 inline-flex items-baseline gap-2.5 tabular-nums">
        <span className="text-[0.9375rem] font-semibold text-ink-900 tracking-[-0.01em]">{figure}</span>
        <span className="w-9 text-right text-[0.75rem] text-ink-400">{trail}</span>
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
  const { can, currentUser } = useCurrentUser();
  const logEvent = useAuditLog();
  const { addToast } = useToast();

  /* ── Who is reading this ────────────────────────────────────────────────────
     Two capabilities gate this page. `ad_usage` is the workspace-wide admin
     view. `ad_usage_people` is named per-person visibility. A System Admin holds
     both. A Team Lead holds `ad_usage_people` WITHOUT `ad_usage` — and that pair
     is the signal to scope this page to their own team.

     A team lead sees only the People tab, and only their own team's members. The
     aggregate tabs (Overview / Seats / Areas / Output) stay hidden for them: the
     usage series is a workspace-wide seed that cannot be truthfully split per
     team, so showing them a workspace total under a "your team" heading would be
     a lying number. What CAN be scoped honestly — the per-member table, which
     carries a team on every row — is exactly what they get. */
  const fullUsage = can('ad_usage');
  const peopleAccess = can('ad_usage_people');
  const teamScoped = peopleAccess && !fullUsage;
  /** The team lead's own team, resolved from their roster record by email. Null
   *  for admins (not scoped) or if the signed-in persona isn't on the roster. */
  const myTeam = useMemo(() => {
    if (!teamScoped || !currentUser) return null;
    const me = users.find(u => u.email === currentUser.email);
    return me && me.team !== '—' ? me.team : null;
  }, [teamScoped, currentUser, users]);
  /** The roster this page reports on. A team lead sees their team; everyone else
   *  sees the whole workspace. Every per-person derivation reads this, so the
   *  scope is applied once. */
  const scopedUsers = useMemo(
    () => (myTeam ? users.filter(u => u.team === myTeam) : users),
    [users, myTeam],
  );
  /** The tabs this reader may open. A team lead gets People only; a reader with
   *  workspace usage but no per-person right loses the People tab; an admin gets
   *  everything. */
  const visibleTabs = useMemo<UsageTab[]>(() => {
    if (teamScoped) return ['people'];
    if (!peopleAccess) return TABS.filter(t => t.id !== 'people').map(t => t.id);
    return TABS.map(t => t.id);
  }, [teamScoped, peopleAccess]);

  const [tab, setTab] = useState<UsageTab>(teamScoped ? 'people' : 'overview');
  // Defaults to the last 30 days — the window the page shipped with.
  const [filter, setFilter] = useState<DateFilter>({ kind: 'preset', id: '30d' });
  const [dateOpen, setDateOpen] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  /* AI is off by default now, not a second chart pinned under the first. It was
     always-on: everyone landing on Overview met two stacked plots before the
     page told them anything. AI is a tenth of the work — an optional lens on the
     activity chart, revealed on demand, not a permanent equal beside the total. */
  const [aiOn, setAiOn] = useState(false);
  const [lens, setLensState] = useState<Lens>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  // Engagement is now a multi-select like Role and Team, held as the labels the
  // user actually reads ('Heavy', 'Regular', 'Light'), not the internal segment enum.
  const [segmentFilter, setSegmentFilter] = useState<string[]>([]);
  // Activity is a separate axis from the engagement tier: did the seat do anything
  // this period (Active) or not (No activity). Held as its own filter so the Usage
  // dropdown stays a clean list of mutually-exclusive tiers with no rollup inside it.
  const [activityFilter, setActivityFilter] = useState<string[]>([]);
  const [modalEmail, setModalEmail] = useState<string | null>(null);
  const [modalModule, setModalModule] = useState<UsageModule | null>(null);
  const [modalTeam, setModalTeam] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** The member table, so the verdict's "See who" can scroll to it in-tab. */
  const memberTableRef = useRef<HTMLDivElement>(null);

  /**
   * Open an area's detail. ONE detail per area, wherever you clicked from.
   *
   * The page had two: a usage modal (from Top areas) and an inventory modal (from
   * a section card), for the same twelve things. Now every route — a dot on the
   * scatter, a row in the ranking, the "fastest growing" finding on Overview —
   * lands on the same modal, which carries usage first and the register under it.
   *
   * 'Other' is the exception, and it has to be: it is the bucket an unrecognised
   * module string falls into, so there is no register behind it and no section
   * card for it. It keeps the standalone usage modal, which for that area is the
   * whole truth rather than half of it.
   */
  const openArea = (module: UsageModule) => {
    const section = MODULE_SECTION[module];
    if (section) {
      setTab('areas');
      setOpenSection(section);
    } else {
      setModalModule(module);
    }
  };

  // Switching lens resets the toolbar so filters never apply invisibly.
  const setLens = (l: Lens) => {
    setLensState(l);
    setSearchQuery(''); setRoleFilter([]); setTeamFilter([]); setSegmentFilter([]); setActivityFilter([]);
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
  // The oldest day in the series — what "All time" actually starts at, so the
  // picker can say so instead of leaving that one preset undated.
  const earliestDate = useMemo(() => {
    const oldest = allDays[0]?.dayOffset ?? 0;
    return new Date(usageAnchor(logs) - oldest * DAY_MS);
  }, [allDays, logs]);
  const { days, priorDays, rangeDays: range } = useMemo(
    () => usageWindow(allDays, filter, anchorDate),
    [allDays, filter, anchorDate],
  );
  // Where the window actually ends. Presets run up to the anchor; a custom range
  // can stop earlier, and the copy must not call that "the most recent activity".
  const endOffset = days.length > 0 ? days[days.length - 1].dayOffset : 0;
  const endsAtAnchor = endOffset === 0;
  const endLabel = endsAtAnchor ? anchorLabel : usageDayLabel(endOffset, logs);
  /** The window's start date, with the year, for the provenance footer. Built
   *  the same way as the anchor label so "Mar 23, 2026" reads on its own. */
  const startLabel = useMemo(() => (
    days.length > 0
      ? new Date(usageAnchor(logs) - days[0].dayOffset * DAY_MS).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
        })
      : anchorLabel
  ), [days, logs, anchorLabel]);
  /** The baseline every delta on this page is measured against. Named, never implied. */
  const compareLabel = `previous ${range} ${range === 1 ? 'day' : 'days'}`;


  const questionsAsked = useMemo(() => aiQuestions(days), [days]);
  const toolRuns = useMemo(() => aiToolRuns(days), [days]);

  const totals = useMemo(() => usageWindowTotals(days, users), [days, users]);
  const priorTotals = useMemo(() => usageWindowTotals(priorDays, users), [priorDays, users]);

  /**
   * The licence verdict is measured on a FIXED seven-day window, not on whatever
   * the date filter happens to be set to.
   *
   * The 60% it is judged against is the platform's healthy weekly-active-to-
   * licence target. It is defined on a week. Comparing it to an arbitrary
   * window made the verdict a function of the dropdown: the same tenant read 59%
   * "below the mark" over one day and 88% "above" over ninety, because over
   * ninety days almost every seat signs in at least once. That is not licence
   * health, it is the definition of a wider window.
   *
   * So the hero answers one fixed question — how many seats did real work THIS
   * WEEK — and the date filter governs everything below it.
   */
  const weeklyVerdict = useMemo(() => {
    const week = allDays.slice(-VERDICT_WINDOW_DAYS);
    const priorWeek = allDays.slice(-2 * VERDICT_WINDOW_DAYS, -VERDICT_WINDOW_DAYS);
    return {
      windowDays: week.length,
      active: usageWindowTotals(week, users).activeUsers,
      priorActive: usageWindowTotals(priorWeek, users).activeUsers,
    };
  }, [allDays, users]);


  const rawRows = useMemo(() => userUsageRows(scopedUsers, days), [scopedUsers, days]);
  const priorByEmail = useMemo(() => {
    const map = new Map<string, number>();
    userUsageRows(scopedUsers, priorDays).forEach(r => map.set(r.user.email, r.actions));
    return map;
  }, [scopedUsers, priorDays]);
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
  // they are derived before it. Scoped to the reader's roster, so a team lead's
  // "gone quiet" count is their team's, not the workspace's.
  const seats = useMemo(() => seatBuckets(scopedUsers, range), [scopedUsers, range]);

  /** Licence use week by week, so the hero shows a direction and not just a dot. */
  const weeklyTrend = useMemo(() => {
    const out: { pct: number; active: number; weeksAgo: number }[] = [];
    for (let i = VERDICT_TREND_WEEKS - 1; i >= 0; i--) {
      const end = allDays.length - i * VERDICT_WINDOW_DAYS;
      const slice = allDays.slice(Math.max(0, end - VERDICT_WINDOW_DAYS), end);
      if (slice.length === 0) continue;
      const active = usageWindowTotals(slice, users).activeUsers;
      out.push({
        active,
        pct: seats.total > 0 ? Math.round((active / seats.total) * 100) : 0,
        weeksAgo: i,
      });
    }
    return out;
  }, [allDays, users, seats.total]);

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

  /**
   * The same actions, grouped into the KINDS of work the Overview ring plots.
   *
   * Built from moduleTotals rather than from the entries again, so the ring and
   * the area ranking can never disagree: same numbers, one grouping deep. The
   * reasoning for the taxonomy itself is on USAGE_FAMILIES.
   */
  const familyTotals = useMemo(() => {
    const byFamily = new Map<UsageFamily, { value: number; members: string[] }>();
    // moduleTotals is already ranked, so each family's member list comes out
    // busiest-first for free.
    moduleTotals.forEach(m => {
      const family = MODULE_FAMILY[m.module];
      const row = byFamily.get(family) ?? { value: 0, members: [] };
      row.value += m.count;
      row.members.push(m.module);
      byFamily.set(family, row);
    });
    return [...byFamily.entries()]
      .map(([name, r]) => ({ name, value: r.value, members: r.members }))
      .sort((a, b) => b.value - a.value);
  }, [moduleTotals]);

  /** The two the Overview lede names. Shares are computed the same way the ring
   *  computes them, so the sentence and the segment can never disagree. */
  const [topFamily, secondFamily] = familyTotals.map(f => ({
    ...f,
    share: totals.actions > 0 ? Math.round((f.value / totals.actions) * 100) : 0,
  }));

  // Overview ranks the leaders; the full inventory of areas is the Sections tab.
  const OVERVIEW_MODULES = 6;
  const topModules = moduleTotals.slice(0, OVERVIEW_MODULES);
  const restModules = Math.max(0, moduleTotals.length - OVERVIEW_MODULES);
  /** Barely-used areas — the actionable end of the reach×depth read, surfaced in
   *  the Areas lede so the tab's answer leads before the table proving it. */
  const barelyUsed = useMemo(
    () => engagementMatrix(days, users).points.filter(p => p.quadrant === 'shelfware').map(p => p.module),
    [days, users],
  );

  /* ── The KPI band ────────────────────────────────────────────────────────
     Every tile names what it counts and what it doesn't (the ⓘ), states its
     change against a named baseline in whole units when the base is small, and
     — where the metric is really a share — draws that share against the level
     that counts as healthy. The old copy ("things done on the platform",
     "different people used the platform") restated the label in worse words
     instead of defining the metric, which is what made the numbers unreadable. */
  // aiEvents is a strict subset of actions (both are audit-log rows), so this
  // share is honest. aiActivity — which also counts saved chats, and those are
  // not audit actions — is NOT a subset, and dividing it by actions would be a
  // number that can exceed 100%.
  const aiEventsTotal = useMemo(() => days.reduce((s, d) => s + d.aiEvents, 0), [days]);
  const aiSharePct = totals.actions > 0 ? Math.round((aiEventsTotal / totals.actions) * 100) : 0;

  /* The four headline numbers (REQ-2.1–2.4), each with the days that made it.
     Active users is back, and it leads: "how many people" is the question the
     page exists to answer, and the tab's own subhead promises "how much happened
     in this period". The licence verdict on Adoption asks a different question of
     the same seats — what share of what you PAY FOR did real work this week — on
     a fixed weekly window against a benchmark. This tile is the window you chose,
     with no benchmark. They are not the same fact told twice; the one thing they
     must not do is disagree, and they don't: both count a person as active only
     if they did real work.

     `series` is the per-day breakdown drawn under each number. For Actions, AI
     and Reports the bars sum to the headline exactly (REQ-2.5). For Active users
     they cannot — a person working three days is one user and three bars — and
     that tile prints the caveat (REQ-2.6). */
  /* The weekday the series starts on, so the KPI trend read can name a weekly
     rhythm (a weekday tool that goes quiet on weekends) instead of calling it
     "steady". The series is oldest-first, so days[0] is the oldest day; its date
     is the anchor minus its offset. 0 = Sunday … 6 = Saturday. */
  const seriesStartDow = days.length > 0
    ? new Date(anchorDate.getTime() - days[0].dayOffset * DAY_MS).getDay()
    : undefined;

  /* A date label per day in the series, oldest first — "Mon, Apr 14" — for the
     hover tooltip under each KPI number, so a reader can point at a bar and read
     the day and its real value rather than guessing the shape. Same window for
     every tile, so it is built once here. */
  const seriesDates = days.map(d =>
    new Date(anchorDate.getTime() - d.dayOffset * DAY_MS).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    }),
  );

  const stats: UsageStat[] = [
    {
      key: 'active', label: 'People active', value: fmt(totals.activeUsers),
      of: `of ${seats.total} licensed`,
      current: totals.activeUsers, prior: priorTotals.activeUsers, unit: 'people',
      series: days.map(d => d.activeUsers),
      // The one metric on the row whose bars are not its number. Said on the tile.
      additive: false,
      counts: 'Anyone who did at least one piece of real work in this period.',
      excludes: 'Signing in and doing nothing. A sign-in is not use.',
    },
    {
      key: 'actions', label: 'Work done', value: fmt(totals.actions),
      of: `across ${moduleTotals.length} ${moduleTotals.length === 1 ? 'area' : 'areas'}`,
      current: totals.actions, prior: priorTotals.actions, unit: 'actions',
      series: days.map(d => d.actions),
      counts: 'Every recorded step of real work: testing a control, raising a finding, running a workflow, generating a report.',
      excludes: 'Signing in, and opening a page without changing anything.',
    },
    {
      key: 'ai', label: 'Work done with IRA', value: `${aiSharePct}%`,
      of: `${fmt(aiEventsTotal)} of ${fmt(totals.actions)}`,
      current: aiEventsTotal, prior: priorDays.reduce((s, d) => s + d.aiEvents, 0), unit: 'IRA actions',
      series: days.map(d => d.aiEvents),
      counts: 'Work where someone asked Ask IRA a question or ran an AI Concierge tool.',
      excludes: `Opening the AI panel without asking anything. Saved conversations are counted separately (${fmt(totals.aiConversations)} in this period).`,
    },
    {
      key: 'reports', label: 'Reports produced', value: fmt(totals.reports),
      current: totals.reports, prior: priorTotals.reports, unit: 'reports',
      series: days.map(d => d.reports),
      counts: 'Reports and Action Taken Reports generated in this period.',
      excludes: 'Opening, downloading or sharing a report that already exists. Only generating a new one counts.',
    },
  ];


  // Anomaly detection — days above mean + 2 standard deviations.
  // `logs` gives the anchor, which gives the weekday — an odd day is odd for its
  // own KIND of day (see `oddDayTest`), and without that this test cannot fire at all.
  const spikes = useMemo(() => usageSpikes(days, logs), [days, logs]);
  const biggestSpike = spikes[0];

  /* Everyone who used IRA, busiest first — and everyone who is active but has
     not touched it. The card is titled "Who uses IRA", and the people who
     don't are the other half of that answer: they are already implied by the
     "9 of 12" in the lede, so naming them costs nothing and saves the reader
     working out who the other three are. */
  const aiUsersRanked = useMemo(
    () => [...rows].filter(r => r.aiQueries > 0).sort((a, b) => b.aiQueries - a.aiQueries),
    [rows],
  );
  const topAiUsers = aiUsersRanked.slice(0, AI_USERS_SHOWN);
  const aiUsersRest = aiUsersRanked.slice(AI_USERS_SHOWN);
  const aiUsersRestQueries = aiUsersRest.reduce((s, r) => s + r.aiQueries, 0);
  const aiAbstainers = useMemo(
    () => [...rows].filter(r => r.actions > 0 && r.aiQueries === 0).sort((a, b) => b.actions - a.actions),
    [rows],
  );
  const aiAdoption = useMemo(() => aiAdoptionPct(rawRows), [rawRows]);
  /** People who actually did something this period — the denominator the People
   *  lede and the concentration split both count against. */
  const activeDoerCount = useMemo(() => rawRows.filter(r => r.actions > 0).length, [rawRows]);
  const concentration = useMemo(() => activityConcentration(rawRows), [rawRows]);

  /* ── What stands out ─────────────────────────────────────────────────────
     Four findings, none of them new data. Three restate an aggregate the page
     shows elsewhere; the fourth — the top-3 share — is the one an admin cannot
     assemble from anything else here, and it is the one that matters most,
     because "3 people do 70% of everything" is precisely what a healthy-looking
     total conceals. A ranking by volume (Top areas) does not surface the fastest
     RISER either: an area can triple and still sit fourth.

     The growth finding needs a floor. A module that went 1 → 4 is +300% and is
     not a trend; below `GROWTH_FLOOR` actions the percentage is arithmetic on
     noise, and the page would lead with it. */
  const GROWTH_FLOOR = 10;
  const highlights = useMemo<HighlightsInput>(() => {
    const risen = moduleTotals
      .filter(m => m.count >= GROWTH_FLOOR && typeof m.deltaPct === 'number' && m.deltaPct > 0)
      .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0];
    return {
      growing: risen ? { module: risen.module, deltaPct: risen.deltaPct as number } : null,
      aiAdoptionPct: aiAdoption,
      // AI *actions*, not aiActivity. This card's fallback copy calls the number
      // "IRA actions this period" — so it has to BE the IRA actions, not the IRA
      // actions plus the saved conversations, which are not actions at all.
      aiActivity: aiEventsTotal,
      dormant: seats.dormant.length,
      concentration,
      topNames: [...rawRows]
        .filter(r => r.actions > 0)
        .sort((a, b) => b.actions - a.actions)
        .slice(0, 3)
        .map(r => r.user.name),
    };
  }, [moduleTotals, aiAdoption, aiEventsTotal, seats.dormant.length, concentration, rawRows]);

  /* Every finding lands on the tab that holds its evidence.

     The two people-shaped findings are still different claims, and they must not
     be conflated. "No sign-in for 30+ days" is about sign-in RECENCY, and it is
     answered by Seats, under "Where the seats sit", which names exactly those
     people. The member table's "No activity" segment asks a different question,
     zero actions inside the chosen window, so a reader sent from one to the other
     would get a filtered count that disagrees with the number they clicked. */
  const seeQuietSeats = () => setTab('seats');
  const seeTopMembers = () => {
    // People is a per-person surface; don't route a reader there who can't see it.
    if (!peopleAccess) return;
    setLens('users');
    setTab('people');
  };

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
  // Which days the work lands on — the coarse companion to the hours heatmap.
  const weekSplit = useMemo(() => {
    const s = activityData.reduce(
      (a, p) => { if (p.weekend) a.weekend += p.total; else a.weekday += p.total; return a; },
      { weekday: 0, weekend: 0 },
    );
    const total = s.weekday + s.weekend;
    return { ...s, total, weekdayPct: total > 0 ? Math.round((s.weekday / total) * 100) : 0 };
  }, [activityData]);

  const verdict = useMemo<VerdictInput>(() => {
    const [first, second] = moduleTotals;
    const topTwoShare = totals.actions > 0
      ? Math.round(((first?.count ?? 0) + (second?.count ?? 0)) / totals.actions * 100)
      : 0;
    return {
      // Fixed weekly window, NOT `range` — see weeklyVerdict above.
      rangeDays: weeklyVerdict.windowDays,
      seats: seats.total,
      activeUsers: weeklyVerdict.active,
      priorActiveUsers: weeklyVerdict.priorActive,
      trend: weeklyTrend,
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
  }, [moduleTotals, totals, weeklyVerdict, weeklyTrend, seats, users, aiSharePct]);

  // Downloads & exports — who is pulling data out of the platform.
  const downloadDelta = usageDeltaPct(totals.downloads, priorTotals.downloads);
  // The window's action total against the equal window before it — the one line
  // of comparison the area-mix donut carries above its slices.
  const actionsDelta = usageDeltaPct(totals.actions, priorTotals.actions);
  const downloadAreas = useMemo(() => downloadAreaSplit(days), [days]);
  const recentDl = useMemo(() => recentDownloads(days), [days]);
  const topDownloaders = useMemo(
    () => [...rows].sort((a, b) => b.downloads - a.downloads).slice(0, 3).filter(r => r.downloads > 0),
    [rows],
  );

  // What got created — artifacts built in the window (live Create events fold in).
  // Ranked, like every other breakdown on this page: the kinds were listed in
  // catalog order, so the reader had to compare five bars to find the busiest.
  const creations = useMemo(
    () => [...creationTotals(days, priorDays)].sort((a, b) => b.count - a.count),
    [days, priorDays],
  );
  const creationMax = Math.max(1, ...creations.map(c => c.count));
  const created = useMemo(() => {
    const count = creations.reduce((s, c) => s + c.count, 0);
    const prior = creations.reduce((s, c) => s + c.prior, 0);
    return { count, deltaPct: usageDeltaPct(count, prior) };
  }, [creations]);
  const recentCr = useMemo(() => recentCreations(days), [days]);

  /* Output, day by day.
   *
   * The Output tab had no time axis anywhere on it: four totals, four change
   * chips, four feeds. A change chip is a two-point comparison — it cannot tell
   * steady production from one enormous Tuesday followed by three silent weeks,
   * and those are the same number and completely different facts.
   *
   * Each series is derived by running the SAME aggregator the card's headline
   * uses over a single day, so a strip can never drift from the total above it:
   * the bars are the number, split by day. (Thirty days × three reducers is
   * nothing — and correctness here is worth more than a bespoke fast path that
   * could disagree with the headline.)
   */
  const outputSeries = useMemo(() => days.map(d => {
    const label = usageDayLabel(d.dayOffset, logs);
    const one = [d];
    return {
      label,
      created: creationTotals(one, []).reduce((s, c) => s + c.count, 0),
      runs: workflowRunTotals(one, []).total,
      shares: shareTotals(one, []).total,
      downloads: d.downloads,
    };
  }), [days, logs]);

  const seriesFor = (key: 'created' | 'runs' | 'shares' | 'downloads') =>
    outputSeries.map(p => ({ label: p.label, value: p[key] }));

  // Workflow runs + sharing — executions and share events (live folds in).
  const runs = useMemo(() => workflowRunTotals(days, priorDays), [days, priorDays]);
  const runAreaMax = Math.max(1, ...runs.byArea.map(a => a.count));
  const recentRn = useMemo(() => recentRuns(days), [days]);
  const shares = useMemo(() => shareTotals(days, priorDays), [days, priorDays]);
  const shareKindMax = Math.max(1, ...shares.byKind.map(k => k.count));
  const recentSh = useMemo(() => recentShares(days), [days]);
  // Bulk Audit — a lens across reports + runs, not a bucket of its own.
  const bulk = useMemo(() => bulkAuditActivity(days, priorDays), [days, priorDays]);

  // Adoption funnel — every stage a fraction of total seats, and the drop-off
  // between stages is the point of the chart, so it gets said out loud.
  // Each stage is filtered FROM the stage above it, so the sets are nested by
  // construction and a drop-off is a real set difference. Built as counts, this
  // was three unrelated predicates whose totals happened to descend; nothing
  // stopped a later stage outgrowing an earlier one and printing a negative
  // drop. Carrying the seats rather than their length is also the only reason
  // the card can name who fell out.
  const funnel = useMemo(() => {
    const paid = seats.total > 0 ? scopedUsers : [];
    const signedIn = paid.filter(u => u.lastLogin !== 'Never');
    const activeEmails = new Set(seats.activeInRange.map(u => u.email));
    const active = signedIn.filter(u => activeEmails.has(u.email));
    const iraEmails = new Set(
      rawRows.filter(r => r.actions > 0 && r.aiQueries > 0).map(r => r.user.email),
    );
    const usedIra = active.filter(u => iraEmails.has(u.email));
    // Each stage explains its own rejects. The last one cannot use `dropReason`:
    // its seats are signed in and active, so the login clock has nothing to say
    // about them and would answer "quiet 0 days".
    return [
      { label: 'Seats you pay for', seats: paid, hint: 'Every licence on the bill', why: dropReason },
      { label: 'Ever signed in', seats: signedIn, hint: 'Reached the product at least once', why: dropReason },
      { label: 'Active this period', seats: active, hint: 'Signed in within the window', why: dropReason },
      { label: 'Used IRA this period', seats: usedIra, hint: 'Asked IRA or ran a Concierge tool', why: () => 'never opened IRA' },
    ];
  }, [seats, scopedUsers, rawRows]);

  // Worth checking — the business "so what" of this period's numbers, as
  // read-only findings. This page only reports; acting on them lives elsewhere.
  const nextSteps = useMemo(() => {
    // Same shape the Overview highlights use — a short eyebrow, the figure that
    // IS the finding, and a sentence saying what it is about — so the two finding
    // surfaces read as one component. These stay read-only (act in Admin), so
    // they are static tiles, not the clickable highlight ones.
    const steps: { key: string; icon: LucideIcon; eyebrow: string; figure: string; detail: string }[] = [];
    if (seats.invited.length > 0) {
      const n = seats.invited.length;
      steps.push({
        key: 'invites',
        icon: Send,
        eyebrow: 'Pending invites',
        figure: String(n),
        detail: `Paid for, not used yet.`,
      });
    }
    if (seats.dormant.length > 0) {
      const n = seats.dormant.length;
      steps.push({
        key: 'dormant',
        icon: Clock,
        eyebrow: 'Quiet 30+ days',
        figure: String(n),
        detail: `${n === 1 ? 'This seat' : 'These seats'} may not be needed.`,
      });
    }
    if (typeof concentration === 'number' && concentration >= 60) {
      steps.push({
        key: 'concentration',
        icon: Users,
        eyebrow: 'Carried by 3',
        figure: `${concentration}%`,
        detail: 'of all the work. Hardly anyone else pitches in.',
      });
    }
    if (aiAdoption < 50 && totals.activeUsers > 0) {
      steps.push({
        key: 'ai',
        icon: Sparkles,
        eyebrow: 'Using IRA',
        figure: `${aiAdoption}%`,
        detail: 'have tried it. The rest work without it.',
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
  const hasAnyFilter = searchQuery.length > 0 || roleFilter.length > 0 || teamFilter.length > 0 || segmentFilter.length > 0 || activityFilter.length > 0;
  const clearAll = () => { setSearchQuery(''); setRoleFilter([]); setTeamFilter([]); setSegmentFilter([]); setActivityFilter([]); };

  const filteredRows = rows.filter(r => {
    if (segmentFilter.length && !segmentFilter.includes(SEGMENT_LABELS[r.segment])) return false;
    // Activity is its own axis: 'Active' = did anything, 'No activity' = did nothing.
    if (activityFilter.length) {
      const isActive = r.actions > 0;
      const matches = (activityFilter.includes(ACTIVE_OPTION) && isActive)
        || (activityFilter.includes(NO_ACTIVITY_OPTION) && !isActive);
      if (!matches) return false;
    }
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
  // Usage is now the engagement tiers only (Heavy/Regular/Light). Dormant moved to
  // the Activity filter as "No activity", so it's excluded here to avoid offering the
  // same bucket in two controls. Only tiers with rows behind them are offered.
  const segmentOptions = ENGAGEMENT_SEGMENTS
    .filter(seg => seg !== 'Dormant' && (segmentCounts.get(seg) ?? 0) > 0)
    .map(seg => SEGMENT_LABELS[seg]);

  // Activity option counts. Active = anyone with actions; No activity = the Dormant
  // tier. Each state is offered only when at least one seat is in it.
  const activityCounts: Record<string, number> = {
    [ACTIVE_OPTION]: rows.filter(r => r.actions > 0).length,
    [NO_ACTIVITY_OPTION]: segmentCounts.get('Dormant') ?? 0,
  };
  const activityOptions = ACTIVITY_OPTIONS.filter(opt => activityCounts[opt] > 0);

  /* ── The People KPI band ─────────────────────────────────────────────────
     Every section of Administration opens on one (DESIGN.md §7.11.1: KPI band →
     toolbar → content) and every other tab of this page opens on either the KPI
     row or the verdict. People opened straight onto a chip row and a table.

     These are a pure metric band on both lenses — a reading, not a control.
     Filtering the member table by engagement is the Engagement dropdown's job
     in the toolbar below; making the cards a second way to set the same
     `segmentFilter` gave the reader two competing controls for one piece of
     state. The cards report, the dropdown filters. */
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
        { key: 'ai', label: 'IRA queries', value: fmt(teamRows.reduce((s, t) => s + t.aiQueries, 0)), icon: Sparkles },
      ];

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
      ? ['Member', 'Email', 'Usage', 'Role', 'Team', 'Last active', 'Actions', `Trend vs ${compareLabel}`, 'IRA actions', 'Downloads', 'Top area']
      : ['Team', 'Members', 'Member Names', 'Actions', 'IRA actions', 'Top area', 'Last Active'];
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
              variant="button" label="Activity" options={activityOptions}
              value={activityFilter} onChange={setActivityFilter} align="end" selectIndicator="checkbox"
              renderOption={(opt) => (
                <>
                  <span className="truncate">{opt}</span>
                  <span className="ml-auto shrink-0 text-ink-400 tabular-nums">{activityCounts[opt] ?? 0}</span>
                </>
              )}
            />
            <ColumnFilter
              variant="button" label="Usage" options={segmentOptions}
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
          {/* Only the TOP wave. This strip is not title-only like the other
              headers that run FloatingLines (DataSourceDetail, ReportDocumentChrome)
              — it also carries the tab row along its bottom edge. The `bottom` wave
              sits at 80% of the strip height with a ±40px amplitude, which is
              exactly where the tabs are: it drew a drifting purple band straight
              across "Areas / Output", and where its three lines converged on the
              right their strokes stacked into a saturated blob over the tab labels.
              Confined to the top wave, the texture stays in the title band and
              never reaches anything you have to read or click. */}
          <FloatingLines
            enabledWaves={['top']}
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[2.125rem] font-semibold tracking-tight text-ink-900 leading-[1.15]">Platform Usage</h1>
                {/* A team lead is scoped, and the page says so out loud — otherwise
                    a short list reads as "the whole workspace is quiet" rather than
                    "this is my team". */}
                {myTeam && (
                  <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-brand-50 text-brand-700 text-[0.75rem] font-semibold">
                    <Users size={13} />
                    {myTeam}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">
                {myTeam
                  ? `Who on ${myTeam} is doing the work, and who has gone quiet.`
                  : TAB_SUBHEAD[tab]}
              </p>
            </div>

          </motion.div>

          {/* Tabs at the bottom of the strip — the strip's own border-b is the
              underline track. Same spelling as Knowledge Hub and Administration.
              A team lead has a single tab, so the row is suppressed: one tab is
              not a choice, and an underlined lone tab reads as a broken control. */}
          {visibleTabs.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 -mb-px"
            >
              <UsageTabs active={tab} onChange={setTab} tabs={visibleTabs} />
            </motion.div>
          )}
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
          {/* Two ends of the row, no shared words between them. The picker on the
              right already prints the exact window ("Mar 23 – Apr 21, 2026"), so
              this side never restates the dates — it carries only what the picker
              can't: the window as a plain day-count.

              There is no freshness note here. The audit log is a fixed seed anchored
              to Apr 21, 2026 (src/data/audit-history.ts) — the whole platform's mock
              records live in early 2026 by design, and there is no ingestion feed.
              A "no new data since…" line would flag a staleness state that can't
              exist: nothing ever stopped arriving because nothing ever arrives. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 text-[0.8125rem]">
            <span className="text-ink-500 min-w-0 truncate">
              {range > 0
                ? <>Showing <span className="font-semibold text-ink-800">{range} {range === 1 ? 'day' : 'days'}</span> of activity</>
                : <>No days in this range. The records end {anchorLabel}</>}
            </span>
          </div>
          <div className="shrink-0">
            <DateFilterPicker
              filter={filter}
              open={dateOpen}
              onToggle={() => setDateOpen(o => !o)}
              onClose={() => setDateOpen(false)}
              onApply={f => { setFilter(f); setDateOpen(false); }}
              today={anchorDate}
              // The presets resolve against the anchor, so they must print the
              // dates they will actually hand back. "Last 30 days" picked in July
              // silently returns a window that closed in April; the label alone
              // gives the reader nothing to catch that with.
              showPresetDates
              earliest={earliestDate}
              triggerRounded="rounded-lg"
              triggerHeight="h-9"
            />
          </div>
        </div>

        {/* The one scroll region. It spans the full panel width and carries the
            reading column's padding itself, so the scrollbar rides the panel
            edge instead of floating 124px inland beside the cards. Gutter is
            reserved so the bands don't nudge sideways when it appears.

            Top fade: content dissolves under the period toolbar as it scrolls up,
            rather than being sliced off at a hard edge (which is what it did — a
            card's top just vanished at the toolbar line with no separation). The
            mask fades the top 20px of the viewport; the matching pt-5 means that
            zone is empty padding at rest, so nothing is faded until you scroll.
            It is CONSTANT (never changes as you read), so it does not reintroduce
            the fade-in-on-scroll chrome that was removed earlier. */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] pt-5 pb-8 px-6 lg:px-12 xl:px-[124px] [mask-image:linear-gradient(to_bottom,transparent_0,#000_1.25rem)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,#000_1.25rem)]"
        >
        {/* One tab at a time. Each band below declares which tab it belongs to;
            document order is already the order each tab wants to read in.
            The top padding lives HERE, on the scrolling content, not on the
            scroll container — so a `sticky top-0` element (the People table's
            pinned toolbar) parks flush against the scroller's top edge instead
            of leaving a strip of scrolled rows showing above it. */}
        <motion.div
          key={tab}
          className="pt-5"
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReduced ? 0 : 0.3, ease: KH_EASE }}
        >
          {/* Overview opens straight on the KPI band — how much happened, in four
              numbers. It used to carry a one-line summary above this ("About N
              actions a day … N of M people did real work"), but both of those
              facts are the first two KPI tiles right below it (People active = N
              of M; Work done = the daily total), so the line was a confusing
              restatement that cost a full row. The tab subhead already asks the
              question; the KPIs answer it. */}
          {tab === 'overview' && (
            <UsageKpiRow stats={stats} rangeDays={range} asOf={endLabel} endsAtAnchor={endsAtAnchor} seriesStartDow={seriesStartDow} seriesDates={seriesDates} />
          )}

          {/* What stands out. The KPI band says how much; this says what about it
              is worth knowing — including the top-3 share, which is on no other
              screen and which no total, chart or table on this page can be read
              to reveal. Each card clicks through to its own evidence. */}
          {tab === 'overview' && (
          <Band title="What stands out" note="Click any finding to see it">
            <UsageHighlights
              h={highlights}
              // The "fastest growing area" finding lands on that area's detail —
              // the same one the scatter and the ranking open. It used to open a
              // second, different modal.
              onOpenModule={openArea}
              onSeeAi={() => setTab('people')}
              onSeeQuiet={seeQuietSeats}
              onSeeTop={seeTopMembers}
            />
          </Band>
          )}

          {/* The trend. The title IS the reading of the chart — a chart titled
              with a noun ("Daily activity") makes the reader derive the finding
              themselves, which most readers simply will not do. */}
          {tab === 'overview' && (
          <Band title="Activity">
            <div className="grid grid-cols-1 gap-4">
              <Card
                rank="hero"
                title="Actions per day"
                subtitle="The line is a 7-day average, so it smooths over weekend dips instead of following them."
                right={
                  <div className="flex items-center gap-4">
                    {/* Every mark on the plot gets a key. The weekend used to be a
                        grey band BEHIND the bars, explained only in the subtitle;
                        it is now the pale column itself, so it can carry a legend
                        key like any other mark. */}
                    <div className="hidden lg:block">
                      <Legend
                        keys={[
                          { color: SERIES.primary, label: 'Weekday' },
                          { color: '#BC9BE8', label: 'Weekend' },
                          ...(aiOn
                            ? [{ color: SERIES.secondary, label: 'IRA' }]
                            : []),
                          ...(spikes.length > 0
                            ? [{ color: SERIES.attention, label: 'Unusually busy' }]
                            : []),
                          ...(compareOn
                            ? [{ color: SERIES.compare, label: 'Last period', dashed: true }]
                            : []),
                        ]}
                      />
                    </div>
                    {/* Two lenses on the same plot, both off by default. The chart
                        answers its own question — how much work, day by day —
                        before either is asked for. */}
                    <div className="flex items-center gap-2">
                      <button className={presetChip(aiOn)} onClick={() => setAiOn(a => !a)} aria-pressed={aiOn}>
                        IRA
                      </button>
                      <button className={presetChip(compareOn)} onClick={() => setCompareOn(c => !c)} aria-pressed={compareOn}>
                        Compare
                      </button>
                    </div>
                    <InfoPopover
                      label="the daily activity"
                      counts="Every piece of real work someone did, grouped by the day it happened."
                      excludes="Signing in, or opening a page without changing anything."
                      note="The line is a 7-day average, so one quiet day does not swing it. Turn on Compare to lay last period over the top."
                    />
                  </div>
                }
              >
                <UsageActivityChart points={activityData} compareOn={compareOn} height={260} />

                {/* REQ-4.2. AI on its own scale, sharing the dates above — but
                    only when the reader asks for it. Stacked into the bars it was
                    a flat blue crust nobody could read a day off; on its own scale
                    the shape is visible; behind a toggle it stops being a second
                    chart everyone has to scroll past to reach the heatmap. */}
                {aiOn && (
                  <div className="mt-5 pt-5 border-t border-canvas-border">
                    <UsageAiStrip points={activityData} />
                  </div>
                )}

                {/* "for that kind of day" is the whole fix, so the copy has to say
                    it. A ring on a Sunday with 8 actions looks absurd next to a
                    Tuesday with 29 — until you know a normal Sunday is 3, and that
                    somebody working a weekend is the more unusual event of the two.
                    A reader told only "above normal" would read the Sunday ring as
                    a bug. */}
                {biggestSpike && (
                  <p className="mt-5 pt-4 border-t border-canvas-border text-[0.75rem] text-ink-500">
                    <span className="font-semibold text-ink-700">{usageDayLabel(biggestSpike.dayOffset, logs)}</span> was much busier than usual, mostly in <span className="font-semibold text-ink-700">{biggestSpike.topModule}</span>.
                    {spikes.length > 1 && (
                      <>{' '}<span className="font-semibold text-ink-700">{listAnd(spikes.slice(1).map(s => usageDayLabel(s.dayOffset, logs)))}</span> {spikes.length === 2 ? 'was' : 'were'} also busier than usual.</>
                    )}
                  </p>
                )}

              </Card>
            </div>
          </Band>
          )}

          {/* Pace and rhythm, side by side — "this period in context" as one row
              instead of two stacked full-width bands. Pace answers whether the work
              is running ahead of last period; the grid answers which hours it lands
              in. Neither needs a section header the cards' own titles do not already
              give, so the two band headings are dropped and the row reads as one.

              The split is intentional: a cumulative line reads fine in a narrow
              column, so Pace takes the smaller share and leaves the 24-hour punch
              card the wider one it was asking for. */}
          {tab === 'overview' && (
          <Band>
            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
            <Card
              icon={PieChartIcon}
              title="What people worked on"
              className="xl:col-span-5"
              bodyClassName="flex flex-col"
              right={
                <InfoPopover
                  label="the work mix"
                  counts="Every piece of real work in the window, grouped into the kind of work it was. The segments add up to Work done."
                  excludes="Signing in, or opening a page without changing anything."
                  note="The thirteen areas are grouped into kinds of work, because the busiest single area is only 15% and thirteen near-equal segments say nothing. Each row names the areas inside it. Hover a segment, or its row, to read that kind's count and share. Per-area counts are on the Areas tab. The bar at the foot is how much of it was done with IRA."
                />
              }
            >
              {/* The answer, in words, before the ring that proves it. Every other
                  tab on this page leads with its verdict; this card used to show a
                  shape and leave the reader to infer the finding, which was the
                  one thing it existed to say. */}
              {topFamily && (
                <div className="mb-5">
                  <UsageLede lead={`${topFamily.name} was the biggest kind, at ${topFamily.share}%.`}>
                    {fmt(topFamily.value)} of {fmt(totals.actions)} actions.
                    {secondFamily && ` ${secondFamily.name} came next at ${secondFamily.share}%.`}
                  </UsageLede>
                </div>
              )}

              <UsageAreaMix
                className="flex-1"
                items={familyTotals}
                total={totals.actions}
                areaCount={moduleTotals.length}
                note={
                  actionsDelta !== null ? (
                    <span className="text-ink-500">
                      <span className="font-semibold tabular-nums" style={{ color: actionsDelta >= 0 ? SERIES.primary : SERIES.attention }}>
                        {actionsDelta >= 0 ? '↑' : '↓'} {Math.abs(actionsDelta)}%
                      </span>{' '}
                      vs the {range} {range === 1 ? 'day' : 'days'} before (<span className="tabular-nums">{fmt(priorTotals.actions)}</span>)
                    </span>
                  ) : undefined
                }
                footer={
                  totals.actions > 0 && aiEventsTotal > 0 ? (
                    <div>
                      <div className="mb-2 flex items-baseline justify-between text-[0.75rem]">
                        <span className="font-semibold text-evidence">Done with IRA · {aiSharePct}%</span>
                        <span className="tabular-nums text-ink-400">{fmt(aiEventsTotal)} of {fmt(totals.actions)} actions</span>
                      </div>
                      <div className="flex h-3 w-full gap-[2px]">
                        <div
                          className="min-w-[3px] rounded-l-full rounded-r-sm"
                          style={{ width: `${aiSharePct}%`, background: 'linear-gradient(90deg,#0EA5E9,#0284C7)' }}
                        />
                        <div className="flex-1 rounded-l-sm rounded-r-full bg-ink-900/[0.06]" />
                      </div>
                      {/* This line names the grey half of the bar, and that is all it
                          does. It also carried "Saved conversations are not counted
                          here", which is a definition of the metric, not a reading of
                          the chart — nobody parses that under a bar. The definition
                          belongs in the ⓘ on "Who uses IRA", where it now lives. */}
                      <p className="mt-1.5 text-[0.6875rem] text-ink-400">
                        The rest was done without IRA.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[0.75rem] text-ink-400">No work done with IRA in this period.</p>
                  )
                }
              />
            </Card>
            {/* The weekday/weekend balance rides as a compact strip on top of the
                grid rather than as its own narrow card — see the earlier note; here
                it keeps that shape while sharing the row with Pace. */}
            <Card
              icon={CalendarClock}
              title="When people are working"
              subtitle="Each square is one hour of one weekday. The darker it is, the busier that hour was."
              className="xl:col-span-7"
              bodyClassName="flex flex-col"
              right={
                <InfoPopover
                  label="the working pattern"
                  counts="Every action, counted in the hour and day it happened."
                  excludes="Signing in without doing any work."
                  note="8am to 6pm is just the daytime band this chart uses to split day work from night work, not your set office hours. The weekend is Saturday and Sunday. Busiest means the most actions in one hour."
                />
              }
            >
              <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-[1.5rem] font-semibold leading-none tracking-[-0.03em] text-ink-900 tabular-nums">
                    {weekSplit.weekdayPct}%
                  </span>
                  <span className="text-[0.8125rem] text-ink-500">lands on weekdays</span>
                </div>
                <div className="grid min-w-[16rem] flex-1 grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  {[
                    { name: 'Weekdays', value: weekSplit.weekday, pct: weekSplit.weekdayPct, color: SERIES.primary },
                    { name: 'Weekends', value: weekSplit.weekend, pct: 100 - weekSplit.weekdayPct, color: '#C4A2EE' },
                  ].map(row => (
                    <div key={row.name}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-[0.75rem] text-ink-600">{row.name}</span>
                        <span className="text-[0.75rem] text-ink-500 tabular-nums">
                          {fmt(row.value)} <span className="text-ink-400">· {row.pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-900/[0.06]">
                        <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <UsageRhythm data={heatmap} />
            </Card>
            </div>
          </Band>
          )}

          {/* The answer, before the evidence, on the tab that asks the question.
              Someone wondering whether to renew arrives with one question, "is
              the licence worth it", and it has a single number for an answer: the
              share of paid seats that did real work. Nothing here is new data. It
              is the page's own numbers, said out loud. */}
          {tab === 'seats' && (
            <div className="mb-4">
              {/* "See who" crosses to People, and that is the one crossing the
                  page allows. Seats does the licence arithmetic; People puts
                  names to it. The button is a drill-down into the answer, not a
                  tab borrowing another tab to finish its own argument. */}
              <UsageVerdict
                v={verdict}
                findings={nextSteps}
                onSeeWho={() => {
                  setLens('users');
                  setTab('people');
                }}
              />
            </div>
          )}

          {/* The evidence under the verdict. Both cards ask a seat question, so
              they sit side by side:

                · How often does each seat get used? The days-worked bands. This
                  finds the seats you could take back.
                · How far does a seat get? The funnel, from paying for it to using
                  it as a habit. This finds where people fall away.

              The other half of "how the work is spread", who carries it, is a
              question about people rather than about licences, so it leads the
              People tab instead. */}
          {tab === 'seats' && (
          // No band heading here: it read "How much each seat gets used" directly
          // above this section's left card, "How often each seat is used" — two
          // near-identical titles stacked. Both child cards title themselves, so
          // the umbrella was pure duplication.
          <Band>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <UsageAdoption days={days} users={users} className="xl:col-span-7" />

              {/* The seat funnel. The drop-off between stages is the entire point
                  of the chart, so it is the loudest thing on it. */}
              <Card
                icon={Users}
                title="From paying for a seat to using it"
                subtitle={`All ${seats.total} seats you pay for, and where each one stops. Every bar is a share of that ${seats.total}.`}
                className="xl:col-span-5"
                right={
                  <InfoPopover
                    label="the seat funnel"
                    counts={`Every paid seat, sorted by how far it got: signed in, active this period, then used IRA. The top bar is all ${seats.total} seats, so it is the full width and every bar below is a share of it.`}
                    excludes="Nothing. Suspended, locked and never-invited seats are all still on the bill, so they are all in here, named at the stage where they stop."
                    note="The names under a bar are the seats that got no further. Click one to find it on the People tab."
                  />
                }
              >
                {/* "Where the seats sit" used to sit under this funnel: four rows
                    reading Active 11, No sign-in 1, Invited 2, Suspended 3. That
                    is 17, which is this funnel's four stages and its three
                    drop-offs, listed a second time with avatars instead of names
                    and detached from the drop each one explains. The card was
                    holding the answer to "who drops off?" three inches below the
                    question and never joining them up. The names moved onto the
                    drop they belong to and the block went. */}
                <SeatFunnel
                  stages={funnel}
                  total={seats.total}
                  // Order matters, and not obviously: `setLens` deliberately
                  // clears the toolbar so a filter can never apply invisibly, so
                  // it has to run BEFORE the search it would otherwise wipe.
                  onPick={(name) => {
                    setLens('users');
                    setSearchQuery(name);
                    setTab('people');
                  }}
                />
              </Card>
            </div>
          </Band>
          )}

          {/* PEOPLE — who carries the work, and how much of it is AI.
              Concentration leads, because it is the one finding on this page an
              admin cannot get from any other screen: if three people do 70% of
              everything, the total still looks healthy, and no chart, table or
              number anywhere else can be read to reveal it. */}
          {tab === 'people' && (
          <Band>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <Card
                icon={TrendingUp}
                title="How much the team relies on its busiest people"
                // Full width for a team lead: the AI card beside it reads
                // workspace-wide AI totals that can't be split per team, so it is
                // hidden for them and this card takes the whole row.
                className={teamScoped ? 'xl:col-span-12' : 'xl:col-span-5'}
                bodyClassName="flex flex-col"
                right={
                  <InfoPopover
                    label="the work split"
                    counts="Real work done by each member this period, ranked highest first."
                    excludes="Members who did nothing this period. The share is out of the people who were active."
                    note="The top three are the three busiest members. If they do most of the work, the platform depends on a few people."
                  />
                }
              >
                {/* The reading, before the evidence. Body text, NOT the tab-level
                    UsageLede: that component is a 17px hero built to lead a whole
                    tab, and inside a card it out-shouted its own 14px title.

                    The tone dot that used to sit beside it is gone, and so is the
                    " The other 9 share the rest." clause: the chart below now
                    groups its bars under "Busiest 3" and "Everyone else (9)" and
                    accents the busiest three, so both were saying a second time
                    what the picture already says. The share is printed here and
                    nowhere else on the card. */}
                <div className="mb-5">
                  <p className="text-[0.875rem] font-semibold leading-relaxed text-ink-900">
                    {typeof concentration === 'number'
                      ? `The busiest 3 of ${activeDoerCount} active members do ${concentration}% of the work.`
                      : `${activeDoerCount} members did real work this period.`}
                  </p>
                  {seats.dormant.length > 0 && (
                    <p className="mt-1.5 text-[0.75rem] text-ink-400">
                      Worth a look: {seats.dormant.length} {seats.dormant.length === 1 ? 'member has' : 'members have'} gone quiet for over a month.
                    </p>
                  )}
                </div>
                <UsageConcentration rows={rawRows} topShare={concentration} />
              </Card>

              {!teamScoped && (
              <Card
                icon={Sparkles}
                title="Who uses IRA"
                subtitle="Ask IRA is the chat. The AI Concierge is the toolkit."
                className="xl:col-span-7"
                bodyClassName="flex flex-col"
                right={
                  <InfoPopover
                    label="IRA use"
                    counts="Questions typed into Ask IRA, and tools run in the AI Concierge. Together those are the IRA actions."
                    excludes="Opening IRA without asking or running anything. Saved conversations, which are kept chats rather than actions."
                    note="Every IRA action is also one of the period's actions, which is how the share of the work is worked out."
                  />
                }
              >
                {/* The card is one chain the reader can follow end to end: two
                    surfaces add up to the IRA actions, and the IRA actions are a
                    slice of the period's actions. The old card DENIED that chain
                    in its own subtitle ("counted separately and never added up")
                    while the bar underneath quietly added them anyway: `aiEvents`
                    IS the Ask IRA questions plus the Concierge runs, by
                    construction (see `isAiEntry`) — 39 + 19 = 58, the very number
                    the share was drawn from. So the reader was told not to do the
                    one sum the card had already done for them, and the 39 and the
                    19 sat in two tinted boxes with no stated relation to anything
                    below. Now the sum is drawn as the sum it is.

                    Gone with it: the two tinted hero-number panels (a box inside
                    a box, and the big-number/small-label template this kit
                    refuses), the "of the people" meter (75% of what the sentence
                    beside it already said as "9 of 12"), and the five full-width
                    28px bars. Those bars were scaled to the top user while the
                    figure beside them was a share of all IRA actions, so the
                    longest bar filled its row and read 22%. */}
                {totals.actions > 0 && aiEventsTotal > 0 ? (
                  <div className="grid flex-1 grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-12">
                    {/* How much: the sum, where it sits, and who is outside it. */}
                    <div className="lg:col-span-5">
                      {/* The reading, before the evidence. A plain sentence under
                          the title, not the tab-level UsageLede: the same call the
                          concentration card beside it makes, so the two cards open
                          in one voice. The dot is neutral brand — this page has no
                          AI target to pass or miss, and a dot that changed colour
                          would invent one. */}
                      <div className="flex items-start gap-2.5">
                        <span className="mt-[0.3rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                        <p className="text-[0.875rem] leading-relaxed text-ink-500">
                          <span className="font-semibold text-ink-900">
                            {fmt(aiUsersRanked.length)} of the {fmt(activeDoerCount)} active {activeDoerCount === 1 ? 'member' : 'members'} used IRA.
                          </span>
                          {' '}It did {fmt(aiEventsTotal)} of the {fmt(totals.actions)} things done this period.
                        </p>
                      </div>

                      {/* The sum, laid out as a sum: two surfaces, a rule, the
                          total they make. The arithmetic is the layout, so no
                          sentence has to assert it. */}
                      <div className="mt-5">
                        <Eyebrow className="mb-1.5">Where IRA runs</Eyebrow>
                        {[
                          { name: 'Ask IRA', kind: 'the chat', value: questionsAsked, unit: questionsAsked === 1 ? 'question' : 'questions' },
                          { name: 'AI Concierge', kind: 'the toolkit', value: toolRuns, unit: toolRuns === 1 ? 'tool run' : 'tool runs' },
                        ].map(s => (
                          <div key={s.name} className="flex items-baseline justify-between gap-3 py-[7px]">
                            <span className="min-w-0 truncate text-[0.8125rem]">
                              <span className="font-medium text-ink-800">{s.name}</span>
                              <span className="text-ink-400"> {s.kind}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-[0.75rem] text-ink-400">
                              <span className="text-[0.875rem] font-semibold text-ink-900">{fmt(s.value)}</span> {s.unit}
                            </span>
                          </div>
                        ))}
                        <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-canvas-border pt-2.5">
                          <span className="text-[0.8125rem] font-medium text-ink-800">Together</span>
                          <span className="shrink-0 tabular-nums text-[0.75rem] text-ink-400">
                            <span className="text-[0.875rem] font-semibold text-evidence-700">{fmt(aiEventsTotal)}</span> IRA actions
                          </span>
                        </div>
                      </div>

                      {/* Those IRA actions against everything else. One split bar,
                          in the same spelling as the concentration split beside it
                          — two segments, a 2px surface gap, the recessive half on
                          the page's neutral track — so the two bars read as one
                          language answering two questions. Evidence blue, the hue
                          the KPI band already gives the AI story. */}
                      <div className="mt-4">
                        <div className="flex h-3.5 w-full gap-[2px]">
                          <div
                            className="rounded-l-full rounded-r-sm"
                            style={{ width: `${Math.max(2, aiSharePct)}%`, background: 'linear-gradient(90deg,#0EA5E9,#0284C7)' }}
                          />
                          <div className="flex-1 rounded-l-sm rounded-r-full bg-ink-900/[0.06]" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between text-[0.6875rem]">
                          <span className="font-semibold text-evidence-700">Done with IRA · {aiSharePct}%</span>
                          <span className="text-ink-400">Done without · {100 - aiSharePct}%</span>
                        </div>
                      </div>

                      {totals.aiConversations > 0 && (
                        <p className="mt-3.5 text-[0.6875rem] leading-relaxed text-ink-400">
                          {fmt(totals.aiConversations)} saved {totals.aiConversations === 1 ? 'conversation sits' : 'conversations sit'} alongside
                          {' '}these. Keeping a chat is not an action, so it is not in the count.
                        </p>
                      )}

                      {/* The other half of "who uses IRA". These people are
                          working — the figure beside each is their own action
                          count — they are just doing it without AI, which is the
                          one thing the reader can act on. */}
                      {aiAbstainers.length > 0 && (
                        <div className="mt-5 border-t border-canvas-border pt-4">
                          <div className="mb-1 flex items-baseline justify-between gap-3">
                            <Eyebrow>Not using it yet</Eyebrow>
                            <span className="text-[0.625rem] text-ink-400">Their actions</span>
                          </div>
                          <div>
                            {aiAbstainers.slice(0, 3).map(u => (
                              <AiUserRow
                                key={u.email}
                                avatar={<InitialsAvatar name={u.name} size={30} />}
                                name={u.name}
                                nameClass="text-ink-800"
                                figure={fmt(u.actions)}
                                trail={<span className="text-ink-300">none</span>}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Who — the names, in the twin of the list beside it. */}
                    <div className="lg:col-span-7 lg:border-l lg:border-canvas-border lg:pl-10">
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <Eyebrow>Who uses it most</Eyebrow>
                        <span className="text-[0.625rem] text-ink-400">IRA actions in this period</span>
                      </div>
                      <div>
                        {topAiUsers.map(u => (
                          <AiUserRow
                            key={u.email}
                            avatar={<InitialsAvatar name={u.name} size={30} />}
                            name={u.name}
                            nameClass="text-ink-800"
                            figure={fmt(u.aiQueries)}
                            /* Share of the AI ACTIONS, the total this list is a
                               breakdown of, so the shares add up to the whole
                               they sit in. Never of `aiActivity`, which also
                               carries the saved chats these rows are not part
                               of. */
                            trail={`${Math.round((u.aiQueries / aiEventsTotal) * 100)}%`}
                          />
                        ))}
                        {aiUsersRest.length > 0 && (
                          <AiUserRow
                            avatar={
                              <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-brand-50 text-[0.5625rem] font-semibold text-brand-700">
                                +{aiUsersRest.length}
                              </div>
                            }
                            name={`${aiUsersRest.length} more ${aiUsersRest.length === 1 ? 'member' : 'members'}`}
                            nameClass="text-ink-500"
                            figure={fmt(aiUsersRestQueries)}
                            trail={`${Math.round((aiUsersRestQueries / aiEventsTotal) * 100)}%`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[0.75rem] text-ink-400">No IRA activity was recorded in this period.</p>
                )}
              </Card>
              )}
            </div>
          </Band>
          )}

          {/* "Worth checking" used to be a separate section here; it is now merged
              into the UsageVerdict card's footer above, so the same licence
              questions sit with the number they qualify instead of repeating it. */}

          {tab === 'output' && (
          <Band>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card
                icon={PackagePlus}
                title="What the team built"
                subtitle="Workflows, dashboards, RACMs, engagements and reports made in this period"
                className="lg:col-span-12"
                right={
                  <InfoPopover
                    label="what was built"
                    counts="Workflows, dashboards, RACMs, engagements and reports created in this period."
                    excludes="Editing, opening or sharing something that already existed. Only making a new one counts."
                    note="Recently created lists the newest first, with who made each one."
                  />
                }
              >
                {/* The tab's answer, before the evidence. This summary of the whole
                    period (created, ran, sent) used to float alone at the top of the
                    tab; it now leads the first and widest Output card, so the reading
                    sits with the numbers that back it instead of above them. */}
                <div className="mb-5 pb-5 border-b border-canvas-border">
                  <UsageLede
                    tone="neutral"
                    lead={`The team created ${fmt(created.count)} ${created.count === 1 ? 'thing' : 'things'} this period.`}
                  >
                    It ran {fmt(runs.total)} {runs.total === 1 ? 'workflow' : 'workflows'} and sent {fmt(shares.total)} {shares.total === 1 ? 'share' : 'shares'}.
                  </UsageLede>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6">
                  {/* The card had no total — the one card on this tab without one,
                      while Runs, Sharing and Exports all lead with theirs. The
                      reader was left to add five bars up to answer the question the
                      card's own title asks. */}
                  <div className="lg:col-span-4">
                    <CardFigure
                      value={created.count}
                      caption="Created in this period"
                      delta={created.deltaPct}
                      compareLabel={compareLabel}
                    />
                    <div className="mt-4">
                      <UsageMiniTrend points={seriesFor('created')} name="Things created" />
                    </div>
                    {/* One line per kind, not a stacked label over a 28px block.
                        Five counts (7, 7, 5, 4, 2) were running 460px tall — taller
                        than the six-row feed beside them, so the whole card was
                        sized by five single-digit numbers and the right half sat
                        half empty. */}
                    <div className="mt-4 space-y-2.5">
                      {creations.map((c, i) => (
                        <Meter
                          key={c.kind.key}
                          size="row"
                          label={c.kind.label}
                          value={fmt(c.count)}
                          pct={(c.count / creationMax) * 100}
                          delta={c.deltaPct}
                          compareLabel={compareLabel}
                          index={i}
                        />
                      ))}
                    </div>
                  </div>

                  {/* A rule, so the two halves stop floating in one wide field. */}
                  <div className="lg:col-span-8 lg:border-l lg:border-canvas-border lg:pl-10">
                    <div className="flex items-baseline justify-between gap-4 mb-2">
                      <Eyebrow>Recently created</Eyebrow>
                      <span className="text-[0.625rem] text-ink-400">Newest first</span>
                    </div>
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

              {/* Bulk Audit — a cross-cut over the two cards below it, not a fifth
                  bucket. It answers "how much of the period was bulk work": the
                  reports generated from a bulk run (registry tag) plus the bulk
                  runs themselves (the log). Both still count in their own totals —
                  a bulk report is a report, a bulk run is a workflow run — so this
                  strip never adds to the tab, it only names the slice. */}
              {bulk.total > 0 && (
              <Card
                icon={Layers}
                title="Bulk Audit"
                subtitle="Reports generated from a bulk run, and the bulk runs behind them"
                className="lg:col-span-12"
                right={
                  <InfoPopover
                    label="Bulk Audit"
                    counts={'Reports tagged "Bulk Audit" in the report library, plus every bulk run kicked off from the Workflow Library.'}
                    excludes="Single reports and one-off workflow runs. Only work done in bulk counts here."
                    note="These are the same reports and runs the cards below already count. This is a lens across them, not an extra total."
                  />
                }
              >
                <div className="flex flex-wrap items-end gap-x-12 gap-y-5">
                  <CardFigure
                    value={bulk.total}
                    caption="Bulk actions this period"
                    delta={bulk.deltaPct}
                    compareLabel={compareLabel}
                  />
                  <div className="flex items-end gap-10 pb-0.5">
                    <div>
                      <div className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">{fmt(bulk.reports)}</div>
                      <div className="mt-1.5 text-[0.6875rem] text-ink-400">Reports from a bulk run</div>
                    </div>
                    <div>
                      <div className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">{fmt(bulk.runs)}</div>
                      <div className="mt-1.5 text-[0.6875rem] text-ink-400">Bulk runs</div>
                    </div>
                  </div>
                </div>
              </Card>
              )}

              <Card
                icon={Play}
                title="Workflow runs"
                subtitle="Every time somebody ran a workflow, and where"
                className="lg:col-span-6"
                right={
                  <InfoPopover
                    label="the workflow runs"
                    counts="Every time someone ran a workflow, grouped by the area it ran in."
                    excludes="Building or editing a workflow without running it."
                  />
                }
              >
                <CardFigure value={runs.total} caption="Runs in this period" delta={runs.deltaPct} compareLabel={compareLabel} />
                <div className="mt-4">
                  <UsageMiniTrend points={seriesFor('runs')} name="Workflow runs" />
                </div>
                {/* An area with nothing in it is not a bar of zero — it is not a
                    row (REQ-4.7, §8.2). "IRA tools · 0" with a 1.5% stub of a bar
                    beside it was the page breaking its own rule: a mark that says
                    "almost none" where the truth is "none at all". Sharing below
                    already filters the same way; Runs did not. */}
                <div className="mt-4 space-y-2.5">
                  {runs.byArea.filter(a => a.count > 0).map((a, i) => (
                    <Meter key={a.area} size="row" label={a.area} value={fmt(a.count)} pct={(a.count / runAreaMax) * 100} index={i} />
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

              <Card
                icon={Share2}
                title="Sharing"
                subtitle="Invites and share links sent"
                className="lg:col-span-6"
                right={
                  <InfoPopover
                    label="the sharing"
                    counts="Invites and share links sent in this period, grouped by kind."
                    excludes="Opening something someone else shared with you."
                  />
                }
              >
                <CardFigure value={shares.total} caption="Shares in this period" delta={shares.deltaPct} compareLabel={compareLabel} />
                <div className="mt-4">
                  <UsageMiniTrend points={seriesFor('shares')} name="Shares" />
                </div>
                <div className="mt-4 space-y-2.5">
                  {shares.byKind.filter(k => k.count > 0).map((k, i) => (
                    <Meter key={k.kind} size="row" label={k.kind} value={fmt(k.count)} pct={(k.count / shareKindMax) * 100} index={i} />
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
                title="Downloads"
                subtitle="What left the platform as a file, and who took it"
                className="lg:col-span-12"
                right={
                  <InfoPopover
                    label="the downloads"
                    counts="Every file taken off the platform in this period, grouped by what was downloaded."
                    excludes="Viewing a file in the browser without downloading it."
                    note="Each download is one file out of one area, so the areas add up to the total."
                  />
                }
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6">
                  <div className="lg:col-span-4">
                    <CardFigure value={totals.downloads} caption="Files downloaded in this period" delta={downloadDelta} compareLabel={compareLabel} />
                    <div className="mt-4">
                      <UsageMiniTrend points={seriesFor('downloads')} name="Files downloaded" />
                    </div>
                    {topDownloaders.length > 0 && (
                      <div className="mt-5">
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

                  {/* WHAT was downloaded, not what file type it arrived as. This
                      was a donut of PDF / XLSX / CSV, which is a fact about the
                      export button rather than about the work: no audit lead has
                      ever needed to know that a quarter of the clicks produced
                      spreadsheets. Reports, workflow results and working papers
                      are the things people actually pull out, so those are the
                      rows, in the same area vocabulary the Areas tab uses.

                      Every area with a download gets a row — no top-N. The whole
                      point is to answer "how many workflows, how many reports",
                      and an area folded into an "other" line is exactly the one
                      somebody came to look up. An area with NO download is not a
                      row of zero, matching Runs and Sharing above.

                      The file type still rides on each row of the feed, where it
                      describes one real file rather than a made-up category. */}
                  <div className="lg:col-span-3">
                    <Eyebrow className="mb-2">What was downloaded</Eyebrow>
                    {downloadAreas.length > 0 ? (
                      <div className="space-y-1.5">
                        {downloadAreas.map(({ area, count }, i) => (
                          <RankedRow
                            key={area}
                            label={area}
                            count={count}
                            share={totals.downloads > 0 ? Math.round((count / totals.downloads) * 100) : 0}
                            pct={(count / downloadAreas[0].count) * 100}
                            index={i}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.8125rem] text-ink-400">Nothing was downloaded in this period.</p>
                    )}
                  </div>

                  <div className="lg:col-span-5">
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
                </div>
              </Card>
            </div>
          </Band>
          )}

          {/* ── AREAS ────────────────────────────────────────────────────────
              Everything the page knows about an area, in one place, in the order
              a decision gets made:

                1. WHERE does each area sit — the scatter. Broad and heavy, or
                   narrow and idle. This is the map, and its dots are clickable.
                2. WHICH ones lead — the ranking. The scatter answers "what kind
                   of used is it"; it cannot answer "which is busiest", because
                   volume is not on either axis.
                3. WHAT is inside each one — the twelve cards.

              These were three tabs' worth of the same twelve entities. An admin
              looking at "Dashboards is shelfware" had to leave the chart, find
              the Dashboards card on another tab, and open it — carrying the
              finding in their head across a tab switch. Now the dot IS the door. */}
          {tab === 'areas' && (
          <>
            <Band>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <Card
                  icon={Grid2x2}
                  title="How many people use each area, and how hard"
                  subtitle="Areas that few people use, and not much, are flagged."
                  className="xl:col-span-7"
                  right={
                    <InfoPopover
                      label="the area map"
                      counts="For each area, how many people opened it (reach) and how much each of them did in it (depth)."
                      excludes="People who never opened the area. Reach is a share of everyone with a seat."
                      note="An area low on both reach and depth is barely used, so it is flagged."
                    />
                  }
                >
                  <UsageMatrix days={days} users={users} onSelect={openArea} />
                </Card>

                <Card
                  title="Busiest areas"
                  subtitle="Ranked by how much work was done in each."
                  className="xl:col-span-5"
                  right={
                    <InfoPopover
                      label="the area ranking"
                      counts="All real work done in each area this period, added up and ranked."
                      excludes="Just opening an area without doing anything in it."
                      note="The share is that area's slice of all work done this period."
                    />
                  }
                >
                  {/* The tab's verdict now leads the ranking it summarises, instead
                      of floating in a hero band at the top of the tab. The lead
                      clause IS this ranking (the busiest areas); the trailing
                      clause names the ones the ranking leaves at the bottom. */}
                  <div className="mb-4 flex items-baseline gap-2">
                    <span
                      className={`translate-y-[0.1rem] h-1.5 w-1.5 shrink-0 rounded-full ${barelyUsed.length > 0 ? 'bg-mitigated-600' : 'bg-compliant-600'}`}
                      aria-hidden
                    />
                    <p className="text-[0.8125rem] leading-snug text-ink-500">
                      <span className="font-semibold text-ink-900">
                        {topModules.length > 0
                          ? `${topModules[0].module}${topModules[1] ? ` and ${topModules[1].module}` : ''} ${topModules[1] ? 'are' : 'is'} the busiest ${topModules[1] ? 'areas' : 'area'}.`
                          : 'No area was used in this period.'}
                      </span>{' '}
                      {barelyUsed.length > 0
                        ? <>{listAnd(barelyUsed)} {barelyUsed.length === 1 ? 'is' : 'are'} barely used, so it is worth asking whether the team needs {barelyUsed.length === 1 ? 'it' : 'them'}.</>
                        : 'Every area is being used, by a lot of people or heavily by a few.'}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {topModules.map(({ module, count }, i) => (
                      <RankedRow
                        key={module}
                        size="lg"
                        label={module}
                        count={count}
                        share={totals.actions > 0 ? Math.round((count / totals.actions) * 100) : 0}
                        pct={(count / moduleMax) * 100}
                        index={i}
                        onClick={() => openArea(module)}
                      />
                    ))}
                  </div>
                  {restModules > 0 && (
                    <p className="mt-5 pt-4 border-t border-canvas-border text-[0.75rem] text-ink-400">
                      The other {restModules} {restModules === 1 ? 'area is' : 'areas are'} in the cards below.
                    </p>
                  )}
                </Card>
              </div>
            </Band>

            <Band>
              <UsagePlatformSections
                days={days}
                rows={rawRows}
                rangeDays={range}
                priorDays={priorDays}
                totalActions={totals.actions}
                open={openSection}
                onOpenChange={setOpenSection}
              />
            </Band>
          </>
          )}

          {/* Everyone, by name. This is the People tab's whole point, and the
              reason it is no longer the last band of a seven-band Seats tab: a
              reader looking for a person had to scroll past the licence verdict,
              the seat bands and the funnel to reach the one thing they came for.

              Administration's skeleton end to end (§7.11.1): the lens switch and
              the one action on the left/right of a header row, then the KPI band,
              then the table with search-left, filters-right inside its card. */}
          {tab === 'people' && (
          <Band>
          <div ref={memberTableRef} className="scroll-mt-4">
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

            {/* Pure metric band — not click-to-filter. Filtering the member
                table is the Engagement dropdown's job in the toolbar below; a
                card that doubles as a filter added a second, competing control
                for the same state. */}
            <AdminKpiRow stats={peopleStats} />

            {/* The switch between the two lenses, animated.
                Flipping Users → Teams was a hard cut: the table was simply a
                different table on the next frame, and because the two count
                different nouns the reader had no way to tell whether the numbers
                had been re-read or the page had jumped.

                This is NOT a new animation. It is Administration's People/Teams
                switch, spelled exactly the same way, because it is the same
                control doing the same job one screen away — and that switch had
                already solved the hard part. The outgoing table exits to
                `position:absolute` so it dissolves ON TOP of the incoming one
                instead of pushing it: without that, 10 member rows swapping for 5
                team rows makes the card lurch to double height and collapse back
                mid-transition. The incoming table, still in flow, defines the
                height. Crossfade in place, no blank beat. */}
            <div className="relative">
            <AnimatePresence initial={false}>
            {lens === 'users' ? (
              <motion.div
                key="users"
                initial={prefersReduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0, position: 'absolute', top: 0, left: 0, right: 0 }}
                transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
              <SmartTable
                columns={userMemberColumns}
                data={filteredRows}
                keyField="email"
                searchable={false}
                paginated
                pageSize={10}
                hideResultCount
                fixedLayout
                stickyHeader
                stickyToolbar
                stickyHeaderTop="top-[61px]"
                nowrapHeaders
                compact
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
              </motion.div>
            ) : (
              <motion.div
                key="teams"
                initial={prefersReduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0, position: 'absolute', top: 0, left: 0, right: 0 }}
                transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
              <SmartTable
                columns={teamColumns}
                data={filteredTeamRows}
                keyField="team"
                searchable={false}
                paginated
                pageSize={10}
                hideResultCount
                fixedLayout
                stickyHeader
                stickyToolbar
                stickyHeaderTop="top-[61px]"
                nowrapHeaders
                compact
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
              </motion.div>
            )}
            </AnimatePresence>
            </div>
          </div>
          </Band>
          )}

          <p className="mt-8 text-[0.6875rem] text-ink-400">
            These numbers come straight from the activity log, starting {startLabel}.
            They update as people work, so they are never out of date.
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
