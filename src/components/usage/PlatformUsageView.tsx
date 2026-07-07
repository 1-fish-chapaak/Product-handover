/**
 * Platform Usage — adoption analytics for admins.
 *
 * Renders the seeded 90-day usage series (src/data/platform-usage.ts) with
 * today's live audit-log events folded in: KPI band → usage-over-time chart +
 * module breakdown → AI usage → per-user activity table. Same page skeleton
 * as Administration (header strip → KPI band → toolbar → SmartTable).
 */

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Users, Activity, Sparkles, FileBarChart, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useAdminData } from '../../context/AdminDataContext';
import { getRole } from '../../data/rbac';
import {
  USAGE_MODULES, usageDaysWithLive, userUsageRows, usageDayLabel,
  type UsageModule,
} from '../../data/platform-usage';
import SmartTable, { type Column } from '../shared/SmartTable';
import ColumnFilter from '../shared/ColumnFilter';
import FloatingLines from '../shared/FloatingLines';
import EmptyState from '../shared/EmptyState';
import { InitialsAvatar, MemberSearch, AdminKpiRow } from '../admin/AdminPrimitives';
import { presetChip, type Stat } from '../admin/adminTokens';

type RangeDays = 7 | 30 | 90;
const RANGES: { days: RangeDays; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

const fmt = (n: number) => n.toLocaleString('en-US');

/* ── Per-user table row (flattened so SmartTable sorting works on raw keys) ── */
interface UsageRow extends Record<string, unknown> {
  name: string;
  email: string;
  roleName: string;
  team: string;
  lastLogin: string;
  actions: number;
  aiQueries: number;
  topModule: UsageModule;
}

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
  { key: 'roleName', label: 'Role', sortable: true, width: '13%', render: (r) => <span className="text-[0.8125rem] text-ink-700">{r.roleName}</span> },
  { key: 'team', label: 'Team', sortable: true, width: '12%', render: (r) => <span className="text-[0.8125rem] text-ink-700">{r.team}</span> },
  {
    key: 'lastLogin', label: 'Last Active', sortable: true, width: '12%',
    render: (r) => <span className={`text-[0.75rem] font-mono tabular-nums ${r.lastLogin === 'Never' ? 'italic text-ink-400' : 'text-ink-700'}`}>{r.lastLogin}</span>,
  },
  {
    key: 'actions', label: 'Actions', sortable: true, width: '9%', align: 'right',
    render: (r) => <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(r.actions)}</span>,
  },
  {
    key: 'aiQueries', label: 'AI Queries', sortable: true, width: '10%', align: 'right',
    render: (r) => <span className="text-[0.8125rem] text-ink-700 tabular-nums">{fmt(r.aiQueries)}</span>,
  },
  {
    key: 'topModule', label: 'Top Module', sortable: true, width: '13%',
    render: (r) => r.actions === 0
      ? <span className="text-[0.75rem] text-ink-400">—</span>
      : <span className="inline-flex items-center px-2 h-6 rounded-full border border-canvas-border bg-canvas text-[0.6875rem] font-medium text-ink-600 whitespace-nowrap">{r.topModule}</span>,
  },
];

const CARD = 'rounded-xl border border-canvas-border bg-canvas-elevated';

export default function PlatformUsageView() {
  const prefersReduced = useReducedMotion();
  const { logs, users } = useAdminData();
  const [range, setRange] = useState<RangeDays>(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);

  // Full series (live events folded into today), then the visible slice.
  const allDays = useMemo(() => usageDaysWithLive(logs), [logs]);
  const days = useMemo(() => allDays.slice(-range), [allDays, range]);

  const totals = useMemo(() => ({
    actions: days.reduce((s, d) => s + d.actions, 0),
    aiQueries: days.reduce((s, d) => s + d.aiQueries, 0),
    reports: days.reduce((s, d) => s + d.reports, 0),
  }), [days]);

  const rows = useMemo<UsageRow[]>(() =>
    userUsageRows(users, days, logs).map(r => ({
      name: r.user.name,
      email: r.user.email,
      roleName: getRole(r.user.roleId)?.name ?? '—',
      team: r.user.team,
      lastLogin: r.user.lastLogin,
      actions: r.actions,
      aiQueries: r.aiQueries,
      topModule: r.topModule,
    })), [users, days, logs]);

  const activeUserCount = rows.filter(r => r.actions > 0).length;

  const stats: Stat[] = [
    { key: 'active', label: 'Active users', value: activeUserCount, icon: Users },
    { key: 'actions', label: 'Actions', value: fmt(totals.actions), icon: Activity },
    { key: 'ai', label: 'AI queries', value: fmt(totals.aiQueries), icon: Sparkles },
    { key: 'reports', label: 'Reports generated', value: fmt(totals.reports), icon: FileBarChart },
  ];

  // Chart data — oldest → today; thin the axis labels so long ranges stay legible.
  const chartData = days.map(d => ({
    label: usageDayLabel(d.dayOffset),
    actions: d.actions,
    aiQueries: d.aiQueries,
  }));
  const tickInterval = range === 7 ? 0 : range === 30 ? 4 : 13;

  // Module breakdown across the slice, ranked.
  const moduleTotals = useMemo(() => {
    const sums = Object.fromEntries(USAGE_MODULES.map(m => [m, 0])) as Record<UsageModule, number>;
    days.forEach(d => USAGE_MODULES.forEach(m => { sums[m] += d.byModule[m]; }));
    return USAGE_MODULES.map(m => ({ module: m, count: sums[m] }))
      .sort((a, b) => b.count - a.count);
  }, [days]);
  const moduleMax = Math.max(1, ...moduleTotals.map(m => m.count));

  const topAiUsers = [...rows].sort((a, b) => b.aiQueries - a.aiQueries).slice(0, 3).filter(r => r.aiQueries > 0);

  // Table filtering
  const uniqueRoles = [...new Set(rows.map(r => r.roleName))];
  const uniqueTeams = [...new Set(rows.map(r => r.team))].filter(t => t !== '—');
  const hasAnyFilter = searchQuery.length > 0 || roleFilter.length > 0 || teamFilter.length > 0;
  const clearAll = () => { setSearchQuery(''); setRoleFilter([]); setTeamFilter([]); };

  const filteredRows = rows.filter(r => {
    if (roleFilter.length && !roleFilter.includes(r.roleName)) return false;
    if (teamFilter.length && !teamFilter.includes(r.team)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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

          <AdminKpiRow stats={stats} />

          {/* Usage over time + module breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <div className={`${CARD} lg:col-span-2 p-5`}>
              <div className="mb-4">
                <div className="text-[0.875rem] font-semibold text-ink-900">Usage over time</div>
                <div className="text-[0.75rem] text-ink-500 mt-0.5">Actions per day across the platform, with AI queries shown inside the total.</div>
              </div>
              <div>
                <ResponsiveContainer width="100%" height={240}>
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
            </div>

            <div className={`${CARD} p-5`}>
              <div className="mb-4">
                <div className="text-[0.875rem] font-semibold text-ink-900">Module breakdown</div>
                <div className="text-[0.75rem] text-ink-500 mt-0.5">Where the activity happens.</div>
              </div>
              <div className="space-y-3">
                {moduleTotals.map(({ module, count }) => {
                  const share = totals.actions > 0 ? Math.round((count / totals.actions) * 100) : 0;
                  return (
                    <div key={module}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[0.75rem] font-medium text-ink-700">{module}</span>
                        <span className="text-[0.75rem] text-ink-500 tabular-nums">{fmt(count)} · {share}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-brand-50 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-brand-500"
                          initial={prefersReduced ? false : { width: 0 }}
                          animate={{ width: `${Math.max(2, (count / moduleMax) * 100)}%` }}
                          transition={{ duration: prefersReduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI usage */}
          <div className={`${CARD} p-5 mb-3`}>
            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-[200px]">
                <div className="text-[0.875rem] font-semibold text-ink-900">AI usage</div>
                <div className="text-[0.75rem] text-ink-500 mt-0.5 mb-4">Ask IRA and Concierge activity in this range.</div>
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[1.375rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(totals.aiQueries)}</div>
                    <div className="text-[0.6875rem] text-ink-500 mt-1">AI queries</div>
                  </div>
                  <div>
                    <div className="text-[1.375rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(Math.round(totals.aiQueries * 0.42))}</div>
                    <div className="text-[0.6875rem] text-ink-500 mt-1">Chats started</div>
                  </div>
                  <div>
                    <div className="text-[1.375rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(Math.round(totals.reports * 0.6))}</div>
                    <div className="text-[0.6875rem] text-ink-500 mt-1">AI-assisted reports</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-[220px] self-end">
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
                <div className="min-w-[180px]">
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
          </div>

          {/* Per-user activity */}
          <SmartTable
            columns={userColumns}
            data={filteredRows}
            keyField="email"
            searchable={false}
            paginated
            pageSize={10}
            hideResultCount
            animateRows={false}
            noRowHover
            headerExtra={
              <div className="flex flex-wrap items-center gap-2 w-full">
                <MemberSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search members..." className="w-full sm:w-[240px]" />
                <div className="ml-auto flex items-center gap-2">
                  {hasAnyFilter && (
                    <button type="button" onClick={clearAll} className="text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer">Clear all</button>
                  )}
                  <ColumnFilter variant="button" label="Role" options={uniqueRoles} value={roleFilter} onChange={setRoleFilter} align="end" selectIndicator="checkbox" />
                  <ColumnFilter variant="button" label="Team" options={uniqueTeams} value={teamFilter} onChange={setTeamFilter} align="end" selectIndicator="checkbox" />
                </div>
              </div>
            }
            emptyContent={
              <EmptyState
                icon={BarChart3}
                size="compact"
                title="No members match your filters"
                body="Try a different search, or clear the active filters."
              />
            }
          />
        </motion.div>
      </div>
    </div>
  );
}
