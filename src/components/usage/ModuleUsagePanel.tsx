/**
 * Platform Usage — one area's USAGE, as a panel.
 *
 * Total actions with a change, share of all activity, the daily trend, and the
 * people who did the work. This is REQ-9.2 ("Area" pop-up) — and it used to be a
 * modal of its own, `ModuleUsageModal`, opened by clicking a row in Top areas.
 *
 * WHY IT IS A PANEL NOW. The page had two different pop-ups for one thing. Click
 * "Reports" in Top areas and you got usage (actions, trend, top members). Click
 * the "Reports" card on Sections and you got inventory (reports in the library,
 * SOX split, recent records). Two modals, two layouts, one area — and no way to
 * see both at once, which is precisely the question an admin has ("this area is
 * busy, but is it producing anything?").
 *
 * The PRD asks for both (REQ-9.2 and REQ-7.13–7.16) and never says they are two
 * screens. They aren't. One area, one detail: this panel sits at the top of the
 * section modal, and the inventory sits under it.
 *
 * `ModuleUsageModal` still wraps this panel, for the one area that has no section
 * behind it — 'Other', the catch-all a module string falls into when nothing maps
 * it. That area has usage and no inventory, so the usage view is all there is.
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { Eyebrow, DeltaPill, TooltipCard } from './usageChrome';
import { useAdminData } from '../../context/AdminDataContext';
import {
  moduleDailySeries, moduleTopUsers, usageDayLabel, usageDeltaPct,
  type UsageModule, type UsageDay, type UserUsageRow,
} from '../../data/platform-usage';
import { GRID, SERIES, CROSSHAIR, xAxisProps, yAxisProps, fmt } from './usageTokens';

export default function ModuleUsagePanel({
  module, days, priorDays, totalActions, rows, rangeDays,
}: {
  module: UsageModule;
  days: UsageDay[];
  priorDays: UsageDay[];
  totalActions: number;
  rows: UserUsageRow[];
  rangeDays: number;
}) {
  const { logs } = useAdminData();
  const series = moduleDailySeries(module, days);
  const total = series.reduce((s, p) => s + p.count, 0);
  const priorTotal = moduleDailySeries(module, priorDays).reduce((s, p) => s + p.count, 0);
  const deltaPct = usageDeltaPct(total, priorTotal);
  const share = totalActions > 0 ? Math.round((total / totalActions) * 100) : 0;
  const topUsers = moduleTopUsers(module, rows);
  const chartData = series.map(p => ({ label: usageDayLabel(p.dayOffset, logs), count: p.count }));
  const compareLabel = `previous ${rangeDays} ${rangeDays === 1 ? 'day' : 'days'}`;

  return (
    <div>
      <div className="flex items-baseline gap-8 pb-5 border-b border-canvas-border">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[1.5rem] font-semibold text-ink-900 tabular-nums leading-none tracking-[-0.02em]">
              {fmt(total)}
            </span>
            {/* The page's own delta chip, which names its baseline on hover. The
                bespoke one this replaced used the MITIGATED tone for a fall —
                amber, the colour this page reserves for "act on this" — so an
                area simply being quieter than last month read as a finding. */}
            <DeltaPill pct={deltaPct} compareLabel={compareLabel} />
          </div>
          <div className="text-[0.6875rem] text-ink-500 mt-1.5">Actions in this period</div>
        </div>
        <div>
          <div className="text-[1.5rem] font-semibold text-ink-900 tabular-nums leading-none tracking-[-0.02em]">
            {share}%
          </div>
          <div className="text-[0.6875rem] text-ink-500 mt-1.5">Share of all activity</div>
        </div>
      </div>

      <div className="py-5 border-b border-canvas-border">
        <Eyebrow className="mb-3">Day by day</Eyebrow>
        <ChartAutoSizer height={140}>
          {({ width, height }) => (
          /* The house chart chrome — same axis props, same grid, same tooltip as
             every other plot on this page. It was drawing its own dashed grid, a
             9px axis and Recharts' default tooltip, so the one chart a reader
             reached by drilling IN was the one chart that looked like it came
             from somewhere else. */
          <AreaChart width={width} height={height} data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="module-panel-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.primary} stopOpacity={0.22} />
                <stop offset="100%" stopColor={SERIES.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...xAxisProps} interval="preserveStartEnd" minTickGap={40} />
            <YAxis {...yAxisProps} allowDecimals={false} width={40} />
            <Tooltip
              isAnimationActive={false}
              cursor={CROSSHAIR}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const v = Number(payload[0].value);
                return (
                  <TooltipCard
                    title={String(label)}
                    rows={[{ color: SERIES.primary, name: module, value: v }]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Actions"
              stroke={SERIES.primary}
              strokeWidth={2}
              fill="url(#module-panel-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
          )}
        </ChartAutoSizer>
      </div>

      <div className="py-5">
        <Eyebrow className="mb-3">Who works in here</Eyebrow>
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
          <p className="text-[0.8125rem] text-ink-400">Nobody worked in this area in this period.</p>
        )}
      </div>
    </div>
  );
}
