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
import { Eyebrow, DeltaPill, TooltipCard, InfoPopover } from './usageChrome';
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

  /* Every number below is derived, and the panel now shows the working rather
     than asserting the result. `moduleTopUsers` returns the busiest THREE, and
     the old heading said "Who works in here" over that slice with nothing to say
     it was a slice — so an area worked by nine people looked like an area worked
     by three. These two are what make the list honest: how many people actually
     touched this area, and how much of the area's work the three on screen did. */
  const everyone = rows.filter(r => r.moduleCounts[module] > 0);
  const shownActions = topUsers.reduce((s, u) => s + u.count, 0);
  const shownSharePct = total > 0 ? Math.round((shownActions / total) * 100) : 0;
  /* Bars are read against the busiest person, not against the area's total: the
     question this list answers is who carries it relative to each other. */
  const topCount = topUsers[0]?.count ?? 1;

  return (
    /* A CONTAINER query, not a viewport one, and it has to be. This panel has two
       callers at very different widths: the section modal at 7xl (~1,224px of
       content) and `ModuleUsageModal` at 560px (~504px). A `lg:` breakpoint asks
       the window how wide it is, so on any normal display the 560px modal would
       have gone two-column too and squeezed its chart into ~200px beside a 272px
       rail. `@3xl` asks the panel's own box, which is the thing that actually has
       to fit the chart. */
    <div className="@container">
      {/* Two columns, not three stacked full-width bands. The panel was a stat
          row, then a chart, then a people list, each spanning the full modal —
          which at 7xl meant every name sat ~1,000px from its own count, and the
          panel ran 470px deep before the register underneath even started. The
          chart keeps the room (it is the visual this panel is for) and the roster
          moves into a rail beside it, where a name and its number are adjacent. */}
      <div className="flex flex-col @3xl:flex-row gap-6 @3xl:gap-8">
        <div className="min-w-0 @3xl:flex-1">
          <div className="flex items-baseline gap-8">
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
                <InfoPopover
                  label="an action"
                  counts={`every action logged in ${module} over the last ${rangeDays} days`}
                  excludes="signing in, and anything done in another area"
                />
              </div>
              <div className="text-[0.6875rem] text-ink-500 mt-1.5">Actions in this period</div>
            </div>
            <div>
              <div className="text-[1.5rem] font-semibold text-ink-900 tabular-nums leading-none tracking-[-0.02em]">
                {share}%
              </div>
              {/* The sum this percentage came from, not a restatement of its name.
                  "Share of all activity" told the reader what the figure was called;
                  it never told them what it was divided by, so 10% could have been
                  10% of anything. */}
              <div className="text-[0.6875rem] text-ink-500 mt-1.5 tabular-nums">
                {fmt(total)} of {fmt(totalActions)} actions everywhere
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Eyebrow className="mb-3">Day by day</Eyebrow>
            <ChartAutoSizer height={148}>
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
        </div>

        {/* The roster rail. Stacked, it keeps a rule above it; beside the chart, a
            rule to its left — either way one hairline separates how much the area
            was used from who used it. */}
        <div className="border-t border-canvas-border pt-5 @3xl:w-[17rem] @3xl:shrink-0 @3xl:border-t-0 @3xl:pt-0 @3xl:border-l @3xl:pl-8">
          <Eyebrow className="mb-3">
            {everyone.length > topUsers.length
              ? `Busiest ${topUsers.length} of ${everyone.length} people`
              : 'Who works in here'}
          </Eyebrow>
          {topUsers.length > 0 ? (
            <>
              <div className="space-y-3">
                {topUsers.map(u => (
                  <div key={u.email}>
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar name={u.name} size={24} />
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-800">{u.name}</span>
                      <span className="shrink-0 text-[0.8125rem] font-semibold text-ink-800 tabular-nums">{fmt(u.count)}</span>
                    </div>
                    {/* The count as a length, read against the busiest person. A
                        column of bare numbers makes the reader do the comparison
                        the chart is supposed to do for them. */}
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-100/70">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${Math.max(4, (u.count / topCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* The arithmetic, said out loud: what the names on screen add up to
                  against the area's own total. Both figures are on this panel, so
                  the reader can check it. */}
              <p className="mt-3.5 text-[0.6875rem] leading-relaxed text-ink-400">
                <span className="font-semibold text-ink-600 tabular-nums">{fmt(shownActions)}</span> of{' '}
                <span className="tabular-nums">{fmt(total)}</span> actions here
                {' '}({shownSharePct}%) were done by {topUsers.length === 1 ? 'this person' : `these ${topUsers.length}`}.
              </p>
            </>
          ) : (
            <p className="text-[0.8125rem] text-ink-400">Nobody worked in this area in this period.</p>
          )}
        </div>
      </div>
    </div>
  );
}
