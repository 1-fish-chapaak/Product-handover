/**
 * Platform Usage — adoption analytics for admins. (PRD-PLATFORM-USAGE.md)
 *
 * Read-only diagnostic surface over the seeded usage series
 * (src/data/platform-usage.ts) with today's live audit-log events folded in:
 * KPI band with prior-period deltas → derived highlights → usage chart +
 * module breakdown (click a module for its drill-down) → AI usage + seats &
 * lifecycle → activity-rhythm heatmap → segmented Users|Teams table with
 * member/team drill-down drawers and CSV export. People-management stays in
 * Administration; this view only links there.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Users, User, Activity, Sparkles, FileBarChart, BarChart3, Download,
  Zap, UserMinus, ArrowRight, CalendarClock, ListChecks, ChevronRight, type LucideIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useAdminData, useAuditLog, type AdminUser } from '../../context/AdminDataContext';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { getRole } from '../../data/rbac';
import type { View } from '../../hooks/useAppState';
import {
  USAGE_MODULES, usageDaysWithLive, userUsageRows, usageDayLabel,
  usageWindowTotals, usageDeltaPct, seatBuckets, lastLoginOffsetDays,
  segmentFor, activeMeanActions, aiAdoptionPct, usageHourlyMatrix,
  activityConcentration, ENGAGEMENT_SEGMENTS, SEGMENT_LABELS,
  type UsageModule, type UserUsageRow, type EngagementSegment,
} from '../../data/platform-usage';
import SmartTable, { type Column } from '../shared/SmartTable';
import ColumnFilter from '../shared/ColumnFilter';
import FloatingLines from '../shared/FloatingLines';
import EmptyState from '../shared/EmptyState';
import { useToast } from '../shared/Toast';
import { InitialsAvatar, MemberSearch } from '../admin/AdminPrimitives';
import { presetChip } from '../admin/adminTokens';
import UsageKpiRow, { type UsageStat } from './UsageKpiRow';
import UserUsageDrawer from './UserUsageDrawer';
import ModuleUsageDrawer from './ModuleUsageDrawer';
import TeamUsageDrawer from './TeamUsageDrawer';
import UsageHeatmap from './UsageHeatmap';

type RangeDays = 7 | 30 | 90;
const RANGES: { days: RangeDays; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

type Lens = 'users' | 'teams';

const fmt = (n: number) => n.toLocaleString('en-US');

/* ── Flattened table rows (SmartTable sorts on raw keys) ── */
interface UsageRow extends Record<string, unknown> {
  name: string;
  email: string;
  roleName: string;
  team: string;
  lastLogin: string;
  actions: number;
  aiQueries: number;
  topModule: UsageModule;
  trendPct: number | null;
  segment: EngagementSegment;
}

interface TeamUsageRow extends Record<string, unknown> {
  team: string;
  members: number;
  actions: number;
  aiQueries: number;
  topModule: string;
  lastActive: string;
}

const MODULE_CHIP = 'inline-flex items-center px-2 h-6 rounded-full border border-canvas-border bg-canvas text-[0.6875rem] font-medium text-ink-600 whitespace-nowrap';

const userColumns: Column<UsageRow>[] = [
  {
    key: 'name', label: 'Member', sortable: true, truncate: true,
    render: (r) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <InitialsAvatar name={r.name} size={28} />
        <div className="min-w-0">
          <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{r.name}</div>
          <div className="text-[0.6875rem] text-ink-400 truncate">{r.email}</div>
        </div>
      </div>
    ),
  },
  { key: 'roleName', label: 'Role', sortable: true, width: '11%', render: (r) => <span className="text-[0.8125rem] text-ink-700">{r.roleName}</span> },
  { key: 'team', label: 'Team', sortable: true, width: '10%', render: (r) => <span className="text-[0.8125rem] text-ink-700">{r.team}</span> },
  {
    key: 'lastLogin', label: 'Last Active', sortable: true, width: '11%',
    render: (r) => <span className={`text-[0.75rem] font-mono tabular-nums ${r.lastLogin === 'Never' ? 'italic text-ink-400' : 'text-ink-700'}`}>{r.lastLogin}</span>,
  },
  {
    key: 'actions', label: 'Actions', sortable: true, width: '8%', align: 'right',
    render: (r) => <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>,
  },
  {
    key: 'trendPct', label: 'Trend', sortable: false, width: '8%', align: 'right',
    render: (r) => r.trendPct === null
      ? <span className="text-[0.75rem] text-ink-400">—</span>
      : (
        <span className={`text-[0.75rem] font-medium tabular-nums ${
          r.trendPct > 0 ? 'text-compliant-700' : r.trendPct < 0 ? 'text-mitigated-700' : 'text-ink-400'
        }`}>
          {r.trendPct > 0 ? '+' : ''}{r.trendPct}%
        </span>
      ),
  },
  {
    key: 'aiQueries', label: 'AI Queries', sortable: true, width: '9%', align: 'right',
    render: (r) => <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'topModule', label: 'Top Module', sortable: true, width: '12%',
    render: (r) => r.actions === 0
      ? <span className="text-[0.75rem] text-ink-400">—</span>
      : <span className={MODULE_CHIP}>{r.topModule}</span>,
  },
];

const teamColumns: Column<TeamUsageRow>[] = [
  {
    key: 'team', label: 'Team', sortable: true, truncate: true,
    render: (r) => (
      <div className="min-w-0">
        <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{r.team}</div>
        <div className="text-[0.6875rem] text-ink-400">{r.members} member{r.members !== 1 ? 's' : ''}</div>
      </div>
    ),
  },
  {
    key: 'actions', label: 'Actions', sortable: true, width: '13%', align: 'right',
    render: (r) => <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>,
  },
  {
    key: 'aiQueries', label: 'AI Queries', sortable: true, width: '13%', align: 'right',
    render: (r) => <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'topModule', label: 'Top Module', sortable: true, width: '16%',
    render: (r) => r.actions === 0
      ? <span className="text-[0.75rem] text-ink-400">—</span>
      : <span className={MODULE_CHIP}>{r.topModule}</span>,
  },
  {
    key: 'lastActive', label: 'Last Active', sortable: true, width: '14%',
    render: (r) => <span className="text-[0.75rem] font-mono tabular-nums text-ink-700">{r.lastActive}</span>,
  },
];

/* Home's widget-card surface: hairline border + the soft double shadow. */
const CARD = 'rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)]';

/** Full day names (JS getDay() order) for the busiest-day sentence. */
const FULL_DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** Compress a daily series into at most `buckets` bars (sums), oldest → newest. */
function bucketize(values: number[], buckets = 12): number[] {
  if (values.length <= buckets) return values;
  const size = values.length / buckets;
  return Array.from({ length: buckets }, (_, i) =>
    values.slice(Math.floor(i * size), Math.floor((i + 1) * size)).reduce((s, v) => s + v, 0));
}

/* ── Home's list-widget shell: icon header strip + optional right action ── */
function WidgetCard({ icon: Icon, title, subtitle, right, className = '', bodyClassName = 'p-5', children }: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${CARD} overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} className="text-ink-500 shrink-0" strokeWidth={1.75} />
          <h3 className="text-[0.75rem] font-semibold text-ink-900 truncate">{title}</h3>
          {subtitle && <span className="hidden md:inline text-[0.6875rem] text-ink-400 truncate">· {subtitle}</span>}
        </div>
        {right}
      </div>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** The header-strip action link, Home's "View all →" style. */
function CardLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">
      {children}
    </button>
  );
}

/* ── Users | Teams lens toggle — the platform's sliding-pill segmented
      switch (mirrors Admin's MembersSwitch, own layoutId). ── */
function UsageLensSwitch({ lens, onSelect }: { lens: Lens; onSelect: (l: Lens) => void }) {
  const prefersReduced = useReducedMotion();
  const tabs: { id: Lens; label: string; icon: React.ElementType }[] = [
    { id: 'users', label: 'Users', icon: User },
    { id: 'teams', label: 'Teams', icon: Users },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-canvas-border/60 bg-canvas-elevated/40">
      {tabs.map(t => {
        const active = lens === t.id;
        const Icon = t.icon;
        return (
          <motion.button
            key={t.id}
            onClick={() => onSelect(t.id)}
            whileTap={prefersReduced ? undefined : { scale: 0.97 }}
            aria-pressed={active}
            className={`relative inline-flex items-center gap-2 px-3.5 h-8 rounded-md text-[0.8125rem] font-medium transition-colors cursor-pointer ${
              active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            {active && (
              <motion.span
                layoutId="usage-lens-active"
                transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute inset-0 rounded-md bg-canvas-elevated border border-canvas-border shadow-[0_1px_2px_rgba(15,8,30,0.06)]"
              />
            )}
            <Icon size={14} className="relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Highlights — sentences derived from the same aggregates the cards show.
      'attention' turns the icon chip amber (the platform's attention tone) so
      warnings don't wear the same purple as good news. ── */
function HighlightCard({ icon: Icon, tone, children }: { icon: LucideIcon; tone?: 'attention'; children: React.ReactNode }) {
  const attn = tone === 'attention';
  return (
    <div className={`${CARD} p-3.5 flex items-start gap-2.5`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${attn ? 'bg-mitigated-700/12 text-mitigated-700' : 'bg-brand-50 text-brand-600'}`}>
        <Icon size={14} strokeWidth={2} />
      </div>
      <p className="text-[0.75rem] text-ink-700 leading-snug">{children}</p>
    </div>
  );
}

/* ── Seats & lifecycle bucket row: label + count + avatar stack ── */
function SeatRow({ label, people }: { label: string; people: AdminUser[] }) {
  const shown = people.slice(0, 4);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.75rem] font-medium text-ink-700 flex-1 min-w-0 truncate">{label}</span>
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

export default function PlatformUsageView({ setView }: { setView: (v: View) => void }) {
  const prefersReduced = useReducedMotion();
  const { logs, users } = useAdminData();
  const { can } = useCurrentUser();
  const logEvent = useAuditLog();
  const { addToast } = useToast();

  const [range, setRange] = useState<RangeDays>(30);
  const [lens, setLensState] = useState<Lens>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [segmentFilter, setSegmentFilter] = useState<EngagementSegment | null>(null);
  const [drawerEmail, setDrawerEmail] = useState<string | null>(null);
  const [drawerModule, setDrawerModule] = useState<UsageModule | null>(null);
  const [drawerTeam, setDrawerTeam] = useState<string | null>(null);

  // Switching lens resets the toolbar so filters never apply invisibly.
  const setLens = (l: Lens) => {
    setLensState(l);
    setSearchQuery(''); setRoleFilter([]); setTeamFilter([]); setSegmentFilter(null);
  };

  // Full 180-day series (live events folded into today), then the slices.
  const allDays = useMemo(() => usageDaysWithLive(logs), [logs]);
  const days = useMemo(() => allDays.slice(-range), [allDays, range]);
  const priorDays = useMemo(() => allDays.slice(-2 * range, -range), [allDays, range]);

  const totals = useMemo(() => usageWindowTotals(days, users, 0), [days, users]);
  const priorTotals = useMemo(() => usageWindowTotals(priorDays, users, range), [priorDays, users, range]);

  const rawRows = useMemo(() => userUsageRows(users, days, logs), [users, days, logs]);
  // Prior-window per-user rows (no live events — those only exist today).
  const priorByEmail = useMemo(() => {
    const map = new Map<string, number>();
    userUsageRows(users, priorDays, [], range).forEach(r => map.set(r.user.email, r.actions));
    return map;
  }, [users, priorDays, range]);
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
      topModule: r.topModule,
      trendPct: usageDeltaPct(r.actions, priorByEmail.get(r.user.email) ?? 0),
      segment: segmentFor(r, activeMean),
    })), [rawRows, priorByEmail, activeMean]);

  const stats: UsageStat[] = [
    { key: 'active', label: 'Active users', value: totals.activeUsers, icon: Users, hint: 'Members who did at least one thing in this period', deltaPct: usageDeltaPct(totals.activeUsers, priorTotals.activeUsers), trend: bucketize(days.map(d => d.activeUsers)) },
    { key: 'actions', label: 'Actions', value: fmt(totals.actions), icon: Activity, hint: 'Everything done on the platform in this period', deltaPct: usageDeltaPct(totals.actions, priorTotals.actions), trend: bucketize(days.map(d => d.actions)) },
    { key: 'ai', label: 'AI queries', value: fmt(totals.aiQueries), icon: Sparkles, hint: 'Questions asked to Ask IRA and the AI tools', deltaPct: usageDeltaPct(totals.aiQueries, priorTotals.aiQueries), trend: bucketize(days.map(d => d.aiQueries)) },
    { key: 'reports', label: 'Reports', value: fmt(totals.reports), icon: FileBarChart, hint: 'Reports generated in this period', deltaPct: usageDeltaPct(totals.reports, priorTotals.reports), trend: bucketize(days.map(d => d.reports)) },
  ];

  // Chart data — oldest → today; thin the axis labels so long ranges stay legible.
  const chartData = days.map(d => ({
    label: usageDayLabel(d.dayOffset),
    actions: d.actions,
    aiQueries: d.aiQueries,
  }));
  const tickInterval = range === 7 ? 0 : range === 30 ? 4 : 13;

  // Module breakdown across the slice, ranked, with prior-window deltas.
  const moduleTotals = useMemo(() => {
    const sum = (slice: typeof days) => {
      const sums = Object.fromEntries(USAGE_MODULES.map(m => [m, 0])) as Record<UsageModule, number>;
      slice.forEach(d => USAGE_MODULES.forEach(m => { sums[m] += d.byModule[m]; }));
      return sums;
    };
    const cur = sum(days);
    const prior = sum(priorDays);
    return USAGE_MODULES.map(m => ({ module: m, count: cur[m], deltaPct: usageDeltaPct(cur[m], prior[m]) }))
      .sort((a, b) => b.count - a.count);
  }, [days, priorDays]);
  const moduleMax = Math.max(1, ...moduleTotals.map(m => m.count));

  const topAiUsers = [...rows].sort((a, b) => b.aiQueries - a.aiQueries).slice(0, 3).filter(r => r.aiQueries > 0);
  const aiAdoption = useMemo(() => aiAdoptionPct(rawRows), [rawRows]);
  const concentration = useMemo(() => activityConcentration(rawRows), [rawRows]);

  const seats = useMemo(() => seatBuckets(users, range), [users, range]);
  const seatUtilPct = seats.total > 0 ? Math.round((seats.activeInRange.length / seats.total) * 100) : 0;
  const heatmap = useMemo(() => usageHourlyMatrix(days), [days]);

  // What to do next — the business "so what": each finding links to where you
  // act on it. Read-only here, actions live in Admin (or Ask IRA).
  const nextSteps = useMemo(() => {
    const steps: { key: string; text: string; action: string; go: () => void }[] = [];
    if (seats.invited.length > 0) {
      steps.push({
        key: 'invites',
        text: `${seats.invited.length} invite${seats.invited.length !== 1 ? 's' : ''} still pending — those seats are paid for but unused.`,
        action: 'Resend or revoke in Admin',
        go: () => setView('admin-users'),
      });
    }
    if (seats.dormant.length > 0) {
      steps.push({
        key: 'dormant',
        text: `${seats.dormant.length} member${seats.dormant.length !== 1 ? 's' : ''} haven't signed in for 30+ days — check if they still need a seat.`,
        action: 'Review members in Admin',
        go: () => setView('admin-users'),
      });
    }
    if (typeof concentration === 'number' && concentration >= 60) {
      steps.push({
        key: 'concentration',
        text: `Top 3 members drive ${concentration}% of all activity — adoption is shallow beyond them.`,
        action: 'See who needs onboarding',
        go: () => setView('admin-users'),
      });
    }
    if (aiAdoption < 50 && totals.activeUsers > 0) {
      steps.push({
        key: 'ai',
        text: `Only ${aiAdoption}% of active members use AI — the rest are missing the fastest way to work.`,
        action: 'Open Ask IRA',
        go: () => setView('chat'),
      });
    }
    return steps.slice(0, 3);
  }, [seats, concentration, aiAdoption, totals.activeUsers, setView]);

  // Derived highlights — same aggregates the cards render, phrased as findings.
  const highlights = useMemo(() => {
    const growing = moduleTotals
      .filter(m => m.count >= 10 && typeof m.deltaPct === 'number')
      .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0];
    const daySums = heatmap.matrix.map(row => row.reduce((s, v) => s + v, 0));
    const busiestDow = daySums.indexOf(Math.max(...daySums));
    const hourSums = Array.from({ length: 24 }, (_, h) => heatmap.matrix.reduce((s, row) => s + row[h], 0));
    const peakHour = hourSums.indexOf(Math.max(...hourSums));
    return { growing, busiestDow, peakHour };
  }, [moduleTotals, heatmap]);

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
        actions,
        aiQueries: members.reduce((s, m) => s + m.aiQueries, 0),
        topModule: actions === 0 ? '—' : topModule,
        lastActive: freshest.user.lastLogin,
      };
    }).sort((a, b) => b.actions - a.actions);
  }, [rawRows]);

  // Toolbar filtering
  const uniqueRoles = [...new Set(rows.map(r => r.roleName))];
  const uniqueTeams = [...new Set(rows.map(r => r.team))].filter(t => t !== '—');
  const hasAnyFilter = searchQuery.length > 0 || roleFilter.length > 0 || teamFilter.length > 0 || segmentFilter !== null;
  const clearAll = () => { setSearchQuery(''); setRoleFilter([]); setTeamFilter([]); setSegmentFilter(null); };

  const filteredRows = rows.filter(r => {
    if (segmentFilter && r.segment !== segmentFilter) return false;
    if (roleFilter.length && !roleFilter.includes(r.roleName)) return false;
    if (teamFilter.length && !teamFilter.includes(r.team)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredTeamRows = teamRows.filter(r =>
    !searchQuery.trim() || r.team.toLowerCase().includes(searchQuery.toLowerCase()));

  const segmentCounts = useMemo(() => {
    const counts = new Map<EngagementSegment, number>();
    rows.forEach(r => counts.set(r.segment, (counts.get(r.segment) ?? 0) + 1));
    return counts;
  }, [rows]);

  const drawerRow = drawerEmail ? rawRows.find(r => r.user.email === drawerEmail) ?? null : null;
  const drawerTeamMembers = drawerTeam
    ? rawRows.filter(r => (r.user.team === '—' ? 'Unassigned' : r.user.team) === drawerTeam)
    : [];

  // Export exactly what's on screen (the filtered set for the active lens).
  const exportCsv = () => {
    const esc = (v: unknown) => {
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const headers = lens === 'users'
      ? ['Member', 'Email', 'Role', 'Team', 'Last Active', 'Actions', 'Trend vs prior', 'AI Queries', 'Top Module', 'Segment']
      : ['Team', 'Members', 'Actions', 'AI Queries', 'Top Module', 'Last Active'];
    const body = lens === 'users'
      ? filteredRows.map(r => [
          r.name, r.email, r.roleName, r.team, r.lastLogin, r.actions,
          r.trendPct === null ? '—' : `${r.trendPct > 0 ? '+' : ''}${r.trendPct}%`,
          r.aiQueries, r.actions === 0 ? '—' : r.topModule, SEGMENT_LABELS[r.segment],
        ])
      : filteredTeamRows.map(r => [r.team, r.members, r.actions, r.aiQueries, r.topModule, r.lastActive]);
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

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 w-full">
      <MemberSearch
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={lens === 'users' ? 'Search members...' : 'Search teams...'}
        className="w-full sm:w-[240px]"
      />
      <div className="ml-auto flex items-center gap-2">
        {hasAnyFilter && (
          <button type="button" onClick={clearAll} className="text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer">Clear all</button>
        )}
        {lens === 'users' && (
          <>
            <ColumnFilter variant="button" label="Role" options={uniqueRoles} value={roleFilter} onChange={setRoleFilter} align="end" selectIndicator="checkbox" />
            <ColumnFilter variant="button" label="Team" options={uniqueTeams} value={teamFilter} onChange={setTeamFilter} align="end" selectIndicator="checkbox" />
          </>
        )}
        {can('ad_usage_export') && (
          <>
            <span className="w-px h-5 bg-canvas-border" />
            <button
              onClick={exportCsv}
              disabled={exportCount === 0}
              title={exportCount === 0 ? 'Nothing to export' : hasAnyFilter ? `Export ${exportCount} filtered rows` : 'Export all rows'}
              className="group inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-canvas-border bg-canvas-elevated text-ink-700 text-[12px] font-medium hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-canvas-elevated disabled:hover:border-canvas-border disabled:hover:text-ink-700"
            >
              <Download size={13} className="transition-transform duration-200 group-hover:translate-y-0.5 group-active:translate-y-1" />
              Export CSV
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Header strip — same full-bleed elevated panel as Administration. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 pb-6 border-b border-canvas-border relative overflow-hidden">
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
          >
            <h1 className="text-[2.125rem] font-semibold tracking-tight text-ink-900 leading-[1.15]">Platform Usage</h1>
            <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">Who's using the platform, which modules they use, and how AI adoption is trending.</p>
          </motion.div>
        </div>
      </div>

      <div className="px-6 lg:px-12 xl:px-[124px] pb-8 flex-1 min-h-0 overflow-y-auto">
        <motion.div
          className="pt-5"
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
        >
          {/* Range switch — applies to everything below. */}
          <div className="mb-4 flex items-center gap-1.5">
            {RANGES.map(r => (
              <button key={r.days} className={presetChip(range === r.days)} onClick={() => setRange(r.days)} aria-pressed={range === r.days}>
                {r.label}
              </button>
            ))}
          </div>

          <UsageKpiRow stats={stats} rangeDays={range} />

          {/* Highlights — findings derived from the same aggregates below. */}
          <div className="mb-4">
            <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2">Highlights</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <HighlightCard icon={Zap}>
                {highlights.growing && typeof highlights.growing.deltaPct === 'number' && highlights.growing.deltaPct > 0 ? (
                  <><span className="font-semibold text-ink-900">{highlights.growing.module}</span> is growing fastest: <span className="font-semibold text-ink-900">+{highlights.growing.deltaPct}%</span> vs the previous period.</>
                ) : (
                  <>No area grew vs the previous period.</>
                )}
              </HighlightCard>
              <HighlightCard icon={Sparkles}>
                <span className="font-semibold text-ink-900">{aiAdoption}%</span> of active members used AI in this range.
              </HighlightCard>
              <HighlightCard icon={UserMinus} tone={seats.dormant.length > 0 ? 'attention' : undefined}>
                {seats.dormant.length > 0 ? (
                  <><span className="font-semibold text-ink-900">{seats.dormant.length} member{seats.dormant.length !== 1 ? 's' : ''}</span> {seats.dormant.length !== 1 ? 'haven’t' : 'hasn’t'} signed in for 30+ days.</>
                ) : (
                  <>Everyone has signed in within the last 30 days.</>
                )}
              </HighlightCard>
              <HighlightCard icon={Users} tone={typeof concentration === 'number' && concentration >= 60 ? 'attention' : undefined}>
                {typeof concentration === 'number' ? (
                  <>Top 3 members account for <span className="font-semibold text-ink-900">{concentration}%</span> of all activity.</>
                ) : (
                  <>No activity yet in this period.</>
                )}
              </HighlightCard>
            </div>
          </div>

          {/* Usage over time + module breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <WidgetCard
              icon={Activity}
              title="Daily activity"
              subtitle="How much happened each day"
              className="lg:col-span-2"
              right={
                <div className="flex items-center gap-4 text-[0.6875rem] text-ink-500 shrink-0">
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#6A12CD' }} />All actions</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#A366F0' }} />AI queries</span>
                </div>
              }
            >
              <div>
                <ResponsiveContainer width="100%" height={330}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="usageActions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6A12CD" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#6A12CD" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="usageAi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A366F0" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#A366F0" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF1" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B5D82' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} interval={tickInterval} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B5D82' }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} cursor={{ stroke: 'rgba(106,18,205,0.25)' }} />
                    <Area type="monotone" dataKey="actions" name="Actions" stroke="#6A12CD" strokeWidth={2} fill="url(#usageActions)" />
                    <Area type="monotone" dataKey="aiQueries" name="AI queries" stroke="#A366F0" strokeWidth={1.5} fill="url(#usageAi)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </WidgetCard>

            <WidgetCard icon={BarChart3} title="Most-used areas" subtitle="Click one for details">
              <div className="space-y-1">
                {moduleTotals.map(({ module, count }) => {
                  const share = totals.actions > 0 ? Math.round((count / totals.actions) * 100) : 0;
                  return (
                    <button
                      key={module}
                      onClick={() => setDrawerModule(module)}
                      className="group w-full text-left -mx-2 px-2 py-1.5 rounded-md hover:bg-canvas transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.75rem] font-medium text-ink-700 group-hover:text-brand-700 transition-colors">{module}</span>
                        <span className="inline-flex items-center gap-1 text-[0.75rem] text-ink-500 tabular-nums">
                          {fmt(count)} · {share}%
                          <ChevronRight size={11} className="text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-brand-50 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-brand-500"
                          initial={prefersReduced ? false : { width: 0 }}
                          animate={{ width: `${Math.max(2, (count / moduleMax) * 100)}%` }}
                          transition={{ duration: prefersReduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </WidgetCard>
          </div>

          {/* AI usage + Seats & lifecycle */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <WidgetCard
              icon={Sparkles}
              title="AI usage"
              subtitle="How much the team uses Ask IRA and the AI tools"
              className="lg:col-span-2"
              right={<CardLink onClick={() => setView('chat')}>Open Ask IRA →</CardLink>}
            >
              <div className="flex flex-wrap items-start gap-6">
                <div className="min-w-[240px]">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-[1.375rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(totals.aiQueries)}</div>
                      <div className="text-[0.6875rem] text-ink-500 mt-1">Questions asked</div>
                    </div>
                    <div>
                      <div className="text-[1.375rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(Math.round(totals.aiQueries * 0.42))}</div>
                      <div className="text-[0.6875rem] text-ink-500 mt-1">Chats started</div>
                    </div>
                    <div>
                      <div className="text-[1.375rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(Math.round(totals.reports * 0.6))}</div>
                      <div className="text-[0.6875rem] text-ink-500 mt-1">AI-assisted reports</div>
                    </div>
                    <div title="Share of active members who asked the AI at least one question in this period">
                      <div className="text-[1.375rem] font-bold text-ink-900 tabular-nums leading-none">{aiAdoption}%</div>
                      <div className="text-[0.6875rem] text-ink-500 mt-1">Members using AI</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-[180px] self-end">
                  <ResponsiveContainer width="100%" height={96}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="usageAiSpark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#A366F0" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#A366F0" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="aiQueries" stroke="#A366F0" strokeWidth={1.5} fill="url(#usageAiSpark)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {topAiUsers.length > 0 && (
                  <div className="min-w-[170px]">
                    <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2.5">Top AI users</div>
                    <div className="space-y-2">
                      {topAiUsers.map(u => (
                        <div key={u.email} className="flex items-center gap-2">
                          <InitialsAvatar name={u.name} size={22} />
                          <span className="text-[0.75rem] font-medium text-ink-800 truncate">{u.name}</span>
                          <span className="ml-auto text-[0.75rem] text-ink-500 tabular-nums">{fmt(u.aiQueries)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </WidgetCard>

            <WidgetCard
              icon={Users}
              title="Members"
              right={<CardLink onClick={() => setView('admin-users')}>Manage in Admin →</CardLink>}
              bodyClassName="p-5 flex flex-col"
            >
              <div className="mb-4">
                <div className="text-[0.6875rem] text-ink-400 mb-1.5">Seats used this period.</div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[1.125rem] font-bold text-ink-900 tabular-nums leading-none">{seats.activeInRange.length} of {seats.total}</span>
                  <span className="text-[0.75rem] text-ink-500 tabular-nums">{seatUtilPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-brand-50 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-brand-500"
                    initial={prefersReduced ? false : { width: 0 }}
                    animate={{ width: `${Math.max(2, seatUtilPct)}%` }}
                    transition={{ duration: prefersReduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <SeatRow label="Active this period" people={seats.activeInRange} />
                <SeatRow label="No sign-in 30+ days" people={seats.dormant} />
                <SeatRow label="Invited, not joined yet" people={seats.invited} />
                <SeatRow label="Suspended or inactive" people={seats.suspendedOrInactive} />
              </div>
            </WidgetCard>
          </div>

          {/* When people are active + What to do next */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <WidgetCard
              icon={CalendarClock}
              title="When people are active"
              subtitle="Darker means more activity"
              className="lg:col-span-2"
              right={
                <span className="hidden lg:inline text-xs text-ink-500 shrink-0">
                  Busiest: <span className="font-semibold text-ink-700">{FULL_DAYS[highlights.busiestDow]}</span> around <span className="font-semibold text-ink-700 tabular-nums">{String(highlights.peakHour).padStart(2, '0')}:00</span>
                </span>
              }
            >
              <UsageHeatmap data={heatmap} />
            </WidgetCard>

            <WidgetCard icon={ListChecks} title="What to do next" subtitle="Based on this period's numbers">
              {nextSteps.length > 0 ? (
                <div className="space-y-4">
                  {nextSteps.map(step => (
                    <div key={step.key}>
                      <p className="text-[0.75rem] text-ink-700 leading-snug">{step.text}</p>
                      <button
                        onClick={step.go}
                        className="mt-1 inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
                      >
                        {step.action}
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[0.8125rem] text-ink-400">Nothing needs attention right now.</p>
              )}
            </WidgetCard>
          </div>

          {/* Lens switch + engagement segments */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <UsageLensSwitch lens={lens} onSelect={setLens} />
            {lens === 'users' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button className={presetChip(segmentFilter === null)} onClick={() => setSegmentFilter(null)} aria-pressed={segmentFilter === null}>
                  All ({rows.length})
                </button>
                {ENGAGEMENT_SEGMENTS.filter(seg => (segmentCounts.get(seg) ?? 0) > 0).map(seg => (
                  <button key={seg} className={presetChip(segmentFilter === seg)} onClick={() => setSegmentFilter(segmentFilter === seg ? null : seg)} aria-pressed={segmentFilter === seg}>
                    {SEGMENT_LABELS[seg]} ({segmentCounts.get(seg) ?? 0})
                  </button>
                ))}
              </div>
            )}
          </div>

          {lens === 'users' ? (
            <SmartTable
              key="users"
              columns={userColumns}
              data={filteredRows}
              keyField="email"
              searchable={false}
              paginated
              pageSize={10}
              hideResultCount
              animateRows={false}
              onRowClick={(r) => setDrawerEmail(r.email as string)}
              headerExtra={toolbar}
              emptyContent={
                <EmptyState
                  icon={BarChart3}
                  size="compact"
                  title="No members match your filters"
                  body="Try a different search, or clear the active filters."
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
              animateRows={false}
              onRowClick={(r) => setDrawerTeam(r.team as string)}
              headerExtra={toolbar}
              emptyContent={
                <EmptyState
                  icon={BarChart3}
                  size="compact"
                  title="No teams match your search"
                  body="Try a different team name, or clear the search."
                />
              }
            />
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {drawerRow && (
          <UserUsageDrawer
            key={`user-${drawerRow.user.email}`}
            row={drawerRow}
            days={days}
            logs={logs}
            rangeDays={range}
            segment={segmentFor(drawerRow, activeMean)}
            onManage={() => setView('admin-users')}
            onClose={() => setDrawerEmail(null)}
          />
        )}
        {drawerModule && (
          <ModuleUsageDrawer
            key={`module-${drawerModule}`}
            module={drawerModule}
            days={days}
            priorDays={priorDays}
            totalActions={totals.actions}
            rows={rawRows}
            rangeDays={range}
            onClose={() => setDrawerModule(null)}
          />
        )}
        {drawerTeam && (
          <TeamUsageDrawer
            key={`team-${drawerTeam}`}
            team={drawerTeam}
            members={drawerTeamMembers}
            rangeDays={range}
            onManage={() => setView('admin-users')}
            onClose={() => setDrawerTeam(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
