/**
 * Platform Usage — module drill-down drawer.
 *
 * One module's story over the selected range: total + delta vs the prior
 * window, share of platform activity, daily trend, and its top members. Top
 * members come from the same per-user mix the member drawer renders, so the
 * two drill-downs always agree.
 */

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import Drawer from '../shared/Drawer';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import {
  moduleDailySeries, moduleTopUsers, usageDayLabel, usageDeltaPct,
  type UsageModule, type UsageDay, type UserUsageRow,
} from '../../data/platform-usage';

const fmt = (n: number) => n.toLocaleString('en-US');

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2.5">{children}</div>;
}

export default function ModuleUsageDrawer({
  module, days, priorDays, totalActions, rows, rangeDays, onClose,
}: {
  module: UsageModule;
  days: UsageDay[];
  priorDays: UsageDay[];
  totalActions: number;
  rows: UserUsageRow[];
  rangeDays: number;
  onClose: () => void;
}) {
  const series = moduleDailySeries(module, days);
  const total = series.reduce((s, p) => s + p.count, 0);
  const priorTotal = moduleDailySeries(module, priorDays).reduce((s, p) => s + p.count, 0);
  const deltaPct = usageDeltaPct(total, priorTotal);
  const share = totalActions > 0 ? Math.round((total / totalActions) * 100) : 0;
  const topUsers = moduleTopUsers(module, rows);
  const chartData = series.map(p => ({ label: usageDayLabel(p.dayOffset), count: p.count }));
  const tickInterval = rangeDays === 7 ? 0 : rangeDays === 30 ? 6 : 14;

  return (
    <Drawer
      title={module}
      subtitle={`Module usage · last ${rangeDays} days`}
      width="max-w-[520px]"
      onClose={onClose}
      ariaLabel={`${module} usage`}
    >
      {/* Totals */}
      <div className="flex items-center gap-6 pb-5 border-b border-canvas-border">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[1.5rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(total)}</span>
            {typeof deltaPct === 'number' && deltaPct !== 0 && (
              <span
                title={`vs previous ${rangeDays} days`}
                className={`inline-flex items-center gap-1 text-[0.6875rem] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                  deltaPct > 0 ? 'text-compliant-700 bg-compliant-50' : 'text-mitigated-700 bg-mitigated-50'
                }`}
              >
                <TrendingUp size={10} strokeWidth={2.5} className={deltaPct > 0 ? '' : 'rotate-180'} />
                {deltaPct > 0 ? '+' : ''}{deltaPct}%
              </span>
            )}
          </div>
          <div className="text-[0.6875rem] text-ink-500 mt-1">Actions</div>
        </div>
        <div>
          <div className="text-[1.5rem] font-bold text-ink-900 tabular-nums leading-none">{share}%</div>
          <div className="text-[0.6875rem] text-ink-500 mt-1">Share of all activity</div>
        </div>
      </div>

      {/* Trend */}
      <div className="py-5 border-b border-canvas-border">
        <SectionLabel>Daily trend</SectionLabel>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="moduleDrawerFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6A12CD" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#6A12CD" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF1" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6B5D82' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} interval={tickInterval} />
            <YAxis tick={{ fontSize: 9, fill: '#6B5D82' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} cursor={{ stroke: 'rgba(106,18,205,0.25)' }} />
            <Area type="monotone" dataKey="count" name="Actions" stroke="#6A12CD" strokeWidth={1.5} fill="url(#moduleDrawerFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top members */}
      <div className="py-5">
        <SectionLabel>Top members</SectionLabel>
        {topUsers.length > 0 ? (
          <div className="space-y-2.5">
            {topUsers.map(u => (
              <div key={u.email} className="flex items-center gap-2.5">
                <InitialsAvatar name={u.name} size={26} />
                <span className="text-[0.8125rem] font-medium text-ink-800 truncate">{u.name}</span>
                <span className="ml-auto text-[0.8125rem] text-ink-500 tabular-nums">{fmt(u.count)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[0.8125rem] text-ink-400">No activity in this range.</p>
        )}
      </div>
    </Drawer>
  );
}
