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
  CalendarClock, ListChecks, PackagePlus, Play, Share2, TrendingUp,
  Gauge, LayoutGrid, Grid2x2, Send, Clock, CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import { useAdminData, useAuditLog, type AdminUser } from '../../context/AdminDataContext';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { getRole } from '../../data/rbac';
import {
  USAGE_MODULES, usageDaysWithLive, userUsageRows, usageDayLabel,
  usageAnchorLabel, usageAnchor,
  usageWindowTotals, usageDeltaPct, seatBuckets, lastLoginOffsetDays,
  segmentFor, activeMeanActions, aiAdoptionPct, usageHourlyMatrix, engagementMatrix,
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
import UsageActivityChart, { UsageAiStrip } from './UsageActivityChart';
import { activityPoints, activityTakeaway } from './usageActivity';
import UsageVerdict, { type VerdictInput } from './UsageVerdict';
import UsageHighlights, { type HighlightsInput } from './UsageHighlights';
import UsagePlatformSections from './UsagePlatformSections';
import UsageMatrix from './UsageMatrix';
import { MODULE_SECTION, type SectionKey } from './usageSectionMap';
import UsageAdoption from './UsageAdoption';
import UsageConcentration from './UsageConcentration';
import UsageMiniTrend from './UsageMiniTrend';
import UsageCumulativePace from './UsageCumulativePace';
import { Card, Band, Donut, Eyebrow, DeltaPill, Legend, Meter, RankedRow, UsageLede } from './usageChrome';
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
    key: 'segment', label: 'Usage', sortable: true, width: '8%',
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
    key: 'roleName', label: 'Role', sortable: true, width: '13%',
    render: (r) => <span className="block truncate text-[0.8125rem] text-ink-700" title={r.roleName}>{r.roleName}</span>,
  },
  {
    key: 'team', label: 'Team', sortable: true, width: '12%',
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
    key: 'lastLogin', label: 'Last active', sortable: true, width: '8%',
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
    key: 'actions', label: 'Actions', sortable: true, width: '11%', align: 'right',
    render: (r) => (
      <div className="inline-flex items-baseline gap-1.5">
        <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>
        <DeltaPill pct={r.trendPct} compareLabel={compareLabel} size="sm" />
      </div>
    ),
  },
  /* "AI use", not "AI actions". A right-aligned count column has to be wide
     enough for its own HEADER, not just its digits, and "AI actions" plus a sort
     arrow did not fit in 9% of the table — it wrapped onto two lines and dragged
     the whole header row down with it. The shorter label fits on one. */
  {
    key: 'aiQueries', label: 'AI use', sortable: true, width: '7%', align: 'right',
    render: (r) => r.aiQueries === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'downloads', label: 'Downloads', sortable: true, width: '9%', align: 'right',
    render: (r) => r.downloads === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.downloads)}</span>,
  },
  {
    // 14%, not 11%. The longest module name the platform has is "Knowledge Hub",
    // and inside a Pill inside an 11% cell of a `table-fixed` layout it was
    // clipped mid-word on every row that had it — a chip that cannot print its
    // own label is worse than no chip.
    key: 'topModule', label: 'Top area', sortable: true, width: '12%',
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
    key: 'actions', label: 'Actions', sortable: true, width: '11%', align: 'right',
    render: (r) => <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>,
  },
  {
    key: 'aiQueries', label: 'AI actions', sortable: true, width: '12%', align: 'right',
    render: (r) => r.aiQueries === 0 ? <Blank /> : <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'topModule', label: 'Top area', sortable: true, width: '12%',
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

/** The verdict's window. GitHub's 60% healthy mark is a weekly-active-to-licence
 *  ratio, so the number judged against it has to be measured on a week. */
const VERDICT_WINDOW_DAYS = 7;
/** How many weeks of licence use the hero plots behind the number. */
const VERDICT_TREND_WEEKS = 8;

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
/* The four states 17 seats can be in. A flat label-gap-count table hid the one
   thing this breakdown is for — the PROPORTION: that Active dwarfs the rest, and
   how much of what you pay for is sitting idle. Each row now carries a bar of its
   share of the total, tone-coloured (brand for the seats doing work, amber for
   the ones you are paying for and not using, grey for the expected-inactive), so
   the composition reads at a glance and the empty middle is gone. */
const SEAT_TONES: Record<'active' | 'attention' | 'muted', { bar: string; text: string }> = {
  active: { bar: '#6A12CD', text: 'text-ink-700' },
  attention: { bar: '#B45309', text: 'text-mitigated-700' },
  muted: { bar: '#B9AEC9', text: 'text-ink-500' },
};

function SeatRow({ label, people, total, tone, index = 0 }: {
  label: string;
  people: AdminUser[];
  total: number;
  tone: 'active' | 'attention' | 'muted';
  index?: number;
}) {
  const prefersReduced = useReducedMotion();
  const shown = people.slice(0, 4);
  const extra = people.length - shown.length;
  const n = people.length;
  const pct = total > 0 ? (n / total) * 100 : 0;
  // A count of zero never wears a warning colour — an empty bucket is good news.
  const t = n === 0 ? SEAT_TONES.muted : SEAT_TONES[tone];

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-[0.8125rem] font-medium flex-1 min-w-0 truncate ${t.text}`}>
          {label}
        </span>
        <div className="flex items-center">
          {shown.map((p, i) => (
            <div key={p.email} className={i > 0 ? '-ml-1.5' : ''} title={p.name}>
              <InitialsAvatar name={p.name} size={20} />
            </div>
          ))}
          {extra > 0 && (
            <span className="-ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-canvas border border-canvas-border text-[0.5625rem] font-semibold text-ink-500">
              +{extra}
            </span>
          )}
        </div>
        <span className="text-[0.9375rem] font-semibold text-ink-900 tabular-nums w-6 text-right">{n}</span>
      </div>
      {/* The share of all seats, drawn — so the row says "how big" without the
          reader dividing by the total in their head. */}
      <div className="h-1.5 rounded-full bg-ink-900/[0.05] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: t.bar }}
          initial={prefersReduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.1 + index * 0.06, ease: KH_EASE }}
        />
      </div>
    </div>
  );
}

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

function SeatFunnel({ stages, total }: {
  stages: { label: string; count: number; hint: string }[];
  total: number;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const pct = total > 0 ? (stage.count / total) * 100 : 0;
        const prev = i > 0 ? stages[i - 1] : null;
        const prevPct = prev && total > 0 ? (prev.count / total) * 100 : 100;
        const lost = prev ? prev.count - stage.count : 0;
        const shade = FUNNEL_SHADES[Math.min(i, FUNNEL_SHADES.length - 1)];
        return (
          <div key={stage.label} title={stage.hint}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[0.75rem] font-medium text-ink-700 truncate min-w-0">{stage.label}</span>
              <span className="shrink-0 inline-flex items-baseline gap-1.5 text-[0.75rem] tabular-nums">
                {lost > 0 && (
                  <span className="text-[0.625rem] font-semibold text-risk-700">
                    −{lost} {lost === 1 ? 'seat drops off' : 'seats drop off'}
                  </span>
                )}
                <span className="font-semibold text-ink-900 ml-1">{stage.count}</span>
                <span className="text-ink-400 w-8 text-right">{Math.round(pct)}%</span>
              </span>
            </div>
            <div className="relative h-7 rounded-md bg-brand-50/70 overflow-hidden">
              {/* The seats that fell away since the stage above, drawn where they
                  fell away — the gap between this bar and the wider one before it. */}
              {lost > 0 && (
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
  // user actually reads ('Heavy', 'No activity'), not the internal segment enum.
  const [segmentFilter, setSegmentFilter] = useState<string[]>([]);
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
   * The benchmark it is judged against (60%) is GitHub's healthy weekly-active-
   * to-licence ratio. It is defined on a week. Comparing it to an arbitrary
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
      key: 'ai', label: 'AI-assisted work', value: `${aiSharePct}%`,
      of: `${fmt(aiEventsTotal)} of ${fmt(totals.actions)}`,
      current: aiEventsTotal, prior: priorDays.reduce((s, d) => s + d.aiEvents, 0), unit: 'AI actions',
      series: days.map(d => d.aiEvents),
      counts: 'Work where someone asked Ask IRA a question or ran an AI Concierge tool.',
      excludes: `Opening the AI panel without asking anything. Saved conversations are counted separately (${fmt(totals.aiConversations)} in this period).`,
    },
    {
      key: 'reports', label: 'Reports produced', value: fmt(totals.reports),
      current: totals.reports, prior: priorTotals.reports, unit: 'reports',
      series: days.map(d => d.reports),
      counts: 'Finished reports and Action Taken Reports generated in this period.',
      excludes: 'Drafts, and reports that were only opened or shared.',
    },
  ];


  // Anomaly detection — days above mean + 2 standard deviations.
  // `logs` gives the anchor, which gives the weekday — an odd day is odd for its
  // own KIND of day (see `oddDayTest`), and without that this test cannot fire at all.
  const spikes = useMemo(() => usageSpikes(days, logs), [days, logs]);
  const biggestSpike = spikes[0];

  const topAiUsers = [...rows].sort((a, b) => b.aiQueries - a.aiQueries).slice(0, 5).filter(r => r.aiQueries > 0);
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
      // "AI actions this period" — so it has to BE the AI actions, not the AI
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
  // The chart's reading, for the section note. The card itself takes a plain noun
  // title — shipped dashboards title charts with nouns and put the sentence in
  // the subtitle; the takeaway lives in the verdict strip at the top.
  const activityNote = useMemo(() => activityTakeaway(activityData), [activityData]);

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
  const formatSplit = useMemo(() => downloadFormatSplit(days), [days]);
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
        detail: `Paid for, and nobody is using ${n === 1 ? 'it' : 'them'} yet.`,
      });
    }
    if (seats.dormant.length > 0) {
      const n = seats.dormant.length;
      steps.push({
        key: 'dormant',
        icon: Clock,
        eyebrow: 'Quiet 30+ days',
        figure: String(n),
        detail: `No sign-in in a month — ${n === 1 ? 'the seat' : 'those seats'} may not be needed.`,
      });
    }
    if (typeof concentration === 'number' && concentration >= 60) {
      steps.push({
        key: 'concentration',
        icon: Users,
        eyebrow: 'Carried by 3',
        figure: `${concentration}%`,
        detail: 'of the work is these three. Hardly anyone else has taken it up.',
      });
    }
    if (aiAdoption < 50 && totals.activeUsers > 0) {
      steps.push({
        key: 'ai',
        icon: Sparkles,
        eyebrow: 'Using the AI',
        figure: `${aiAdoption}%`,
        detail: 'have tried it. The rest are doing it the long way.',
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
      ? ['Member', 'Email', 'Usage', 'Role', 'Team', 'Last active', 'Actions', `Trend vs ${compareLabel}`, 'AI actions', 'Downloads', 'Top area']
      : ['Team', 'Members', 'Member Names', 'Actions', 'AI actions', 'Top area', 'Last Active'];
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
          {/* Overview opens on what Overview promises: how much happened.
              It used to open on the licence verdict — a 148px gauge saying what
              share of the PAID SEATS did work — which is a procurement question,
              and it is the Adoption tab's entire stated purpose. Seat health
              matters, but it is not what an admin comes to a usage page to ask
              first, and it has no business being the loudest mark on a tab whose
              own subhead says "how much happened in this period, and when". It
              now leads Adoption, where it is the answer rather than a guest. */}
          {tab === 'overview' && (
            <div className="mb-7">
              {/* The lede is the tab's one-line answer, so it must not restate the
                  bands directly beneath it. The AI-people share (75%) is the
                  "Using the AI" finding's whole job, one screen down, and repeating
                  it here printed the same number twice on one view. The lede keeps
                  the activity trend (which nothing else states) and the plain
                  participation that answers the subhead's "is anyone using this?";
                  the AI reading is left to the card that owns it. */}
              <UsageLede tone="neutral" lead={`${activityNote}.`}>
                {totals.activeUsers} of {seats.total} people did the work.
              </UsageLede>
            </div>
          )}

          {tab === 'overview' && (
            <UsageKpiRow stats={stats} rangeDays={range} asOf={endLabel} endsAtAnchor={endsAtAnchor} />
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
                subtitle="The line is a 7-day average, so it rides through the weekend dips instead of following them."
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
                            ? [{ color: SERIES.secondary, label: 'AI' }]
                            : []),
                          ...(spikes.length > 0
                            ? [{ color: SERIES.attention, label: 'An odd day' }]
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
                        AI
                      </button>
                      <button className={presetChip(compareOn)} onClick={() => setCompareOn(c => !c)} aria-pressed={compareOn}>
                        Compare
                      </button>
                    </div>
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
                    A ring marks a day well above normal <span className="font-medium text-ink-600">for that kind of day</span>. Weekdays are judged against weekdays, and weekends against weekends.
                    {' '}The biggest was <span className="font-semibold text-ink-700">{usageDayLabel(biggestSpike.dayOffset, logs)}</span>, at {biggestSpike.ratio} times a normal day, mostly in <span className="font-semibold text-ink-700">{biggestSpike.topModule}</span>.
                    {spikes.length > 1 && <> {spikes.length - 1} other {spikes.length === 2 ? 'day stands' : 'days stand'} out too.</>}
                  </p>
                )}

              </Card>
            </div>
          </Band>
          )}

          {/* Pace against last period. The hero above answers "how much, day by
              day"; the KPI row answers it as one number and a change-chip. Neither
              answers the question a renewal conversation actually turns on: is this
              period running ahead of the last one, or behind it. A cumulative curve
              against the prior window's cumulative is the one honest way to show it
              — daily counts are too noisy to read a lead off, but a running total
              only climbs, so the gap between the two lines is the whole finding. */}
          {tab === 'overview' && (
          <Band title="Pace against last period">
            <Card
              icon={TrendingUp}
              title="Actions so far, against last period"
              subtitle="Both lines are running totals. The gap between them is how far ahead of, or behind, last period's pace this one is running."
            >
              <UsageCumulativePace activity={activityData} />
            </Card>
          </Band>
          )}

          {/* Where the work lands, and when — the two halves of the same
              question, side by side, exactly as PRD §5 lays the tab out: "Then
              the busiest 6 areas, and a grid showing which hours of the week
              people work."

              The hours grid spent a while on Adoption. That was wrong twice over:
              it is not a licence question, so it interrupted the renewal argument
              (verdict → seats → areas → funnel) to talk about Tuesdays; and it
              left Overview — the tab everyone lands on — with two visuals and a
              screen and a half of dead space under them. */}
          {/* Overview keeps WHEN the work happens. WHERE it happens — the areas —
              now lives on the Areas tab in one piece, instead of being previewed
              here, plotted on Adoption, and detailed on Sections. */}
          {/* Two readings of "when": which DAYS the work lands on (the coarse
              split) and which HOURS (the grid). The split is the one-glance
              headline — "is this a weekday tool" — that the dense grid answers in
              detail beside it. */}
          {tab === 'overview' && (
          <Band title="When the work happens">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <Card
                icon={CalendarDays}
                title="Weekday vs weekend"
                subtitle="How the work splits across the week."
                className="lg:col-span-4"
              >
                <div className="flex flex-col gap-5 pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink-900 tabular-nums">
                      {weekSplit.weekdayPct}%
                    </span>
                    <span className="text-[0.8125rem] text-ink-500">lands on weekdays</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: 'Weekdays', value: weekSplit.weekday, pct: weekSplit.weekdayPct, color: SERIES.primary },
                      { name: 'Weekends', value: weekSplit.weekend, pct: 100 - weekSplit.weekdayPct, color: '#C4A2EE' },
                    ].map(row => (
                      <div key={row.name}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-[0.8125rem] text-ink-600">{row.name}</span>
                          <span className="text-[0.8125rem] text-ink-500 tabular-nums">
                            {fmt(row.value)} <span className="text-ink-400">· {row.pct}%</span>
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-ink-900/[0.06] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card
                icon={CalendarClock}
                title="When people are working"
                subtitle="Each square is one hour of one weekday. The darker it is, the busier that hour was."
                className="lg:col-span-8"
              >
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
          <Band title="How much each seat gets used">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <UsageAdoption days={days} users={users} className="xl:col-span-7" />

              {/* The seat funnel. The drop-off between stages is the entire point
                  of the chart, so it is the loudest thing on it. */}
              <Card
                icon={Users}
                title="From paying for a seat to using it"
                subtitle="Each stage as a share of the seats you pay for."
                className="xl:col-span-5"
              >
                {/* The bars taper — each width is the stage's share of the seats
                    you pay for — so the funnel is the shape and the drop-off is
                    the gap between one bar and the next, drawn in the one red on
                    the card. Labels ride above the track, never inside the fill. */}
                <SeatFunnel stages={funnel} total={seats.total} />

                <div className="mt-5 pt-4 border-t border-canvas-border">
                  <Eyebrow className="mb-2">Where the seats sit</Eyebrow>
                  <SeatRow label="Active this period" people={seats.activeInRange} total={seats.total} tone="active" index={0} />
                  <SeatRow label="No sign-in 30+ days" people={seats.dormant} total={seats.total} tone="attention" index={1} />
                  <SeatRow label="Invited, not joined yet" people={seats.invited} total={seats.total} tone="attention" index={2} />
                  <SeatRow label="Suspended or inactive" people={seats.suspendedOrInactive} total={seats.total} tone="muted" index={3} />
                </div>
              </Card>
            </div>
          </Band>
          )}

          {/* PEOPLE — who carries the work, and who has gone quiet: the tab's
              question, answered in one line before any card. */}
          {tab === 'people' && (
            <div className="mb-7">
              <UsageLede
                tone={typeof concentration === 'number' && concentration >= 60 ? 'watch' : 'neutral'}
                lead={
                  typeof concentration === 'number'
                    ? `The busiest 3 of ${activeDoerCount} active members do ${concentration}% of the work.`
                    : `${activeDoerCount} members did the work this period.`
                }
              >
                {seats.dormant.length > 0
                  ? <>{seats.dormant.length} {seats.dormant.length === 1 ? 'member has' : 'members have'} gone quiet for 30+ days.</>
                  : 'Nobody has gone quiet in the last 30 days.'}
              </UsageLede>
            </div>
          )}

          {/* PEOPLE — who carries the work, and how much of it is AI.
              Concentration leads, because it is the one finding on this page an
              admin cannot get from any other screen: if three people do 70% of
              everything, the total still looks healthy, and no chart, table or
              number anywhere else can be read to reveal it. */}
          {tab === 'people' && (
          <Band title="How the work is shared out">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <Card
                icon={TrendingUp}
                title="How much the team leans on its busiest people"
                subtitle="The busiest three against everyone else, then each member ranked by what they did."
                className="xl:col-span-5"
                bodyClassName="flex flex-col"
              >
                <UsageConcentration rows={rawRows} topShare={concentration} />
              </Card>

              <Card
                icon={Sparkles}
                title="Who uses the AI"
                subtitle="Ask IRA is the chat. The AI Concierge is the toolkit. A question you type and a tool you run are different things, so they are counted separately and never added up."
                className="xl:col-span-7"
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

                {/* What the numbers add up to, in one sentence.

                    THE SHARE IS `aiEvents`, NOT `aiActivity`. This card used to
                    divide aiActivity (AI events PLUS saved conversations) by
                    actions, and print the result as "AI was involved in 12% of
                    everything done on the platform". The KPI band, ten
                    centimetres above, printed 11% for the same claim — because it
                    divides aiEvents by actions.

                    11% and 12% are not two facts. They are one fact, computed two
                    ways, and the page has no way to tell a reader which one is
                    the AI number. Worse, the 12% was the wrong one: a saved
                    conversation is NOT an audit action, so it is not in the
                    denominator. Dividing it by actions is a share of a whole that
                    does not contain it — a number that can, in principle, exceed
                    100%.

                    One definition: AI's share of the work is the AI ACTIONS over
                    all actions. Conversations are real, and they are counted —
                    but they are counted as themselves, in the tile beside this. */}
                {/* AI's share of the work, shown not told: a two-segment bar,
                    AI against everything else. Same split-bar language as the
                    concentration card, so the tab reads as one system. */}
                {totals.actions > 0 && aiEventsTotal > 0 ? (
                  <div className="mt-5">
                    <div className="flex items-baseline justify-between mb-2 text-[0.75rem]">
                      <span className="font-semibold text-evidence">AI-assisted · {aiSharePct}%</span>
                      <span className="text-ink-400 tabular-nums">{fmt(aiEventsTotal)} of {fmt(totals.actions)} actions</span>
                    </div>
                    <div className="flex h-3 w-full gap-[2px]">
                      <div
                        className="rounded-l-full rounded-r-sm min-w-[3px]"
                        style={{ width: `${aiSharePct}%`, background: 'linear-gradient(90deg,#0EA5E9,#0284C7)' }}
                      />
                      <div className="flex-1 rounded-r-full rounded-l-sm bg-ink-900/[0.06]" />
                    </div>
                    {totals.aiConversations > 0 && (
                      <p className="mt-2 text-[0.6875rem] text-ink-400">
                        {fmt(totals.aiConversations)} saved conversation{totals.aiConversations === 1 ? '' : 's'} counted separately, not as work.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-5 text-[0.75rem] text-ink-400">No AI activity was recorded in this period.</p>
                )}

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
                        rather than see — every other ranking here carries a bar,
                        and now it is the same bar: the shared `Meter`, so this
                        list cannot drift away from the six others. */}
                    <div className="space-y-3">
                      {topAiUsers.map((u, i) => (
                        <div key={u.email} className="flex items-center gap-2.5">
                          <InitialsAvatar name={u.name} size={24} />
                          <div className="min-w-0 flex-1">
                            <Meter
                              index={i}
                              label={<span className="text-ink-800">{u.name}</span>}
                              value={fmt(u.aiQueries)}
                              note={
                                <span>
                                  {/* Share of the AI ACTIONS, not of aiActivity.
                                      `aiQueries` is a per-user count of AI events;
                                      dividing it by a total that also carries
                                      saved conversations gave every name a share
                                      of a whole it is not part of, so the five
                                      shares could never add up to the ranking they
                                      sit in. */}
                                  {aiEventsTotal > 0 ? Math.round((u.aiQueries / aiEventsTotal) * 100) : 0}%
                                </span>
                              }
                              pct={(u.aiQueries / topAiUsers[0].aiQueries) * 100}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </Band>
          )}

          {/* Worth checking: pending invites, quiet seats, shallow adoption.
              Every one of these is a licence question, so it closes the Seats
              tab. It cannot go on Overview, where it would sit beside the
              highlights and repeat them word for word: "2 members have not signed
              in for 30+ days" would be on the same screen twice. */}
          {tab === 'seats' && (
          <Band>
            {/* A lean strip, not a full Card. The 40px icon tile, the two-line
                subtitle and the p-5 body were a hero panel's worth of chrome around
                two one-word findings; the whole block ran taller than the seat curve
                it followed. Header is one line, findings sit side by side, and the
                attention amber still rides the chip and count only. */}
            <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
              <div className="flex items-baseline gap-2 mb-3">
                <ListChecks size={14} strokeWidth={2} className="shrink-0 self-center text-brand-600" aria-hidden />
                <h3 className="text-[0.8125rem] font-semibold text-ink-900">Worth checking</h3>
                <span className="min-w-0 truncate text-[0.75rem] text-ink-400">Act on any of these in Administration.</span>
              </div>
              {nextSteps.length > 0 ? (
                <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  {nextSteps.map(step => (
                    <li key={step.key} className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-mitigated-700/[0.12] text-mitigated-700">
                        <step.icon size={13} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="shrink-0 text-[0.9375rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-mitigated-700">
                        {step.figure}
                      </span>
                      <p className="min-w-0 truncate text-[0.8125rem] text-ink-500">
                        <span className="font-semibold text-ink-800">{step.eyebrow}</span>
                        <span className="text-ink-300"> · </span>
                        {step.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2.5">
                  <UserCheck size={15} strokeWidth={2} className="text-compliant-700 shrink-0" aria-hidden />
                  <p className="text-[0.8125rem] text-ink-600">Nothing needs attention right now. Every seat is earning its keep.</p>
                </div>
              )}
            </div>
          </Band>
          )}

          {/* What the platform produced this period. The tab is called Output and
              its subhead already says what that means — a band heading here would
              be the third time the page says the same thing. */}
          {tab === 'output' && (
            <div className="mb-7">
              <UsageLede
                tone="neutral"
                lead={`The team created ${fmt(created.count)} ${created.count === 1 ? 'thing' : 'things'} this period.`}
              >
                It ran {fmt(runs.total)} {runs.total === 1 ? 'workflow' : 'workflows'} and sent {fmt(shares.total)} {shares.total === 1 ? 'share' : 'shares'}.
              </UsageLede>
            </div>
          )}

          {tab === 'output' && (
          <Band>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card
                icon={PackagePlus}
                title="What the team built"
                subtitle="Workflows, dashboards, RACMs, engagements and reports made in this period"
                className="lg:col-span-12"
              >
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
                    <div className="mt-5 space-y-3.5">
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

              <Card icon={Play} title="Workflow runs" subtitle="Every time somebody ran a workflow, and where" className="lg:col-span-6">
                <CardFigure value={runs.total} caption="Runs in this period" delta={runs.deltaPct} compareLabel={compareLabel} />
                <div className="mt-4">
                  <UsageMiniTrend points={seriesFor('runs')} name="Workflow runs" />
                </div>
                {/* An area with nothing in it is not a bar of zero — it is not a
                    row (REQ-4.7, §8.2). "AI tools · 0" with a 1.5% stub of a bar
                    beside it was the page breaking its own rule: a mark that says
                    "almost none" where the truth is "none at all". Sharing below
                    already filters the same way; Runs did not. */}
                <div className="mt-5 space-y-3.5">
                  {runs.byArea.filter(a => a.count > 0).map((a, i) => (
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
                <div className="mt-4">
                  <UsageMiniTrend points={seriesFor('shares')} name="Shares" />
                </div>
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
                title="Downloads"
                subtitle="What left the platform as a file, and who took it"
                className="lg:col-span-12"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6">
                  <div className="lg:col-span-4">
                    <CardFigure value={totals.downloads} caption="Files downloaded in this period" delta={downloadDelta} compareLabel={compareLabel} />
                    <div className="mt-4">
                      <UsageMiniTrend points={seriesFor('downloads')} name="Files downloaded" />
                    </div>
                    {/* The one genuine part-to-whole on the page: every download
                        is exactly one format, and the formats add up to the
                        figure above. A ranked bar would answer "which format
                        leads" — which nobody asks. The question here is the shape
                        of the mix, and that is what a donut is for. Everything
                        else on this page stays a bar. */}
                    {formatSplit.length > 0 && (
                      <div className="mt-5">
                        <Donut
                          items={formatSplit.map(f => ({ name: f.format, value: f.count }))}
                          total={totals.downloads}
                          totalLabel="Files"
                          size={118}
                        />
                      </div>
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
            <div className="mb-7">
              <UsageLede
                tone={barelyUsed.length > 0 ? 'watch' : 'neutral'}
                lead={
                  topModules.length > 0
                    ? `${topModules[0].module}${topModules[1] ? ` and ${topModules[1].module}` : ''} ${topModules[1] ? 'are' : 'is'} the busiest ${topModules[1] ? 'areas' : 'area'}.`
                    : 'No area was used in this period.'
                }
              >
                {barelyUsed.length > 0
                  ? <>{listAnd(barelyUsed)} {barelyUsed.length === 1 ? 'is' : 'are'} barely used — worth asking whether the team needs {barelyUsed.length === 1 ? 'it' : 'them'}.</>
                  : 'Every area is being used, by a lot of people or heavily by a few.'}
              </UsageLede>
            </div>

            <Band title="Which areas earn their keep" note="Click any area for its detail">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <Card
                  icon={Grid2x2}
                  title="How many people use each area, and how hard"
                  subtitle="Reach is the share of people who opened it; depth is how much each of them did. Barely-used areas — low on both — are flagged."
                  className="xl:col-span-7"
                >
                  <UsageMatrix days={days} users={users} onSelect={openArea} />
                </Card>

                <Card
                  title="Busiest areas"
                  subtitle="Ranked by total work done in each — the volume the table beside this does not carry."
                  className="xl:col-span-5"
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

            <Band title="Every area in detail">
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
          <Band title="Everyone, by name" note="Open a row for the full breakdown">
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
          </div>
          </Band>
          )}

          <p className="mt-8 text-[0.6875rem] text-ink-400">
            Everything on this page is derived from the audit log and the live record set, as of {anchorLabel}.
            Numbers move when work happens. They are not a snapshot taken at some other time.
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
