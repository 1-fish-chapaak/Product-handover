/**
 * Platform Usage — AI Concierge section.
 *
 * The Concierge is a rack of tools you run, so the question this section has to
 * answer is "which tool, and who ran it". The page used to list the catalog as
 * seven flat lines with no numbers on them at all — every tool looked equally
 * used, including the one nobody has ever opened — because the audit log wrote
 * every run under one generic entity. Runs now name their tool, so this ranks
 * the toolkit by real runs and lets you click a tool for its own breakdown:
 * its trend, who ran it, and the runs themselves.
 *
 * Two views, one modal. The toolkit ranking, and a single tool's detail with a
 * way back. Read-only throughout.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight, MousePointerClick, Wand2 } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { PortfolioStat } from './usageSectionPrimitives';
import { Eyebrow, TooltipCard } from './usageChrome';
import { SERIES, RAMP, GRID, ICON_TILE, ICON_TILE_BRAND, xAxisProps, yAxisProps, fmt } from './usageTokens';
import { useAdminData } from '../../context/AdminDataContext';
import {
  conciergeToolUsage, conciergeRunners, aiToolRuns, usageDayLabel,
  type ConciergeToolUsage, type UsageDay, type UserUsageRow,
} from '../../data/platform-usage';

/** Colours for the run-mix donut: the busiest tool gets the darkest step. */
const MIX_COLORS = [...RAMP].reverse();

/**
 * A run of content under a label, divided by a hairline. Not a card.
 *
 * The modal panel is already a bordered, elevated surface; a bordered card
 * inside it draws a second box around the same content, and three stacked cards
 * (each with its own icon tile) is what made this body read as an admin panel
 * rather than a page. Every other section modal here is built from a stat strip,
 * eyebrow labels and rules — this now matches, and the tool detail earns the one
 * icon tile it uses for its own header.
 */
function Band({ title, note, right, flush, children }: {
  title: string;
  note?: string;
  right?: ReactNode;
  /** No rule of its own — for bands sitting side by side under a shared one.
   *  Two columns each drawing their own top border reads as one rule with a
   *  bite taken out of it, which is worse than no rule at all. */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={flush ? '' : 'mt-7 pt-6 border-t border-canvas-border/70'}>
      <div className="flex items-baseline justify-between gap-4 mb-3.5">
        <Eyebrow>{title}</Eyebrow>
        {right ?? (note && <span className="text-[0.6875rem] text-ink-400 shrink-0">{note}</span>)}
      </div>
      {children}
    </section>
  );
}

/** The rule + air that opens a row of side-by-side bands. */
const BAND_ROW = 'mt-7 pt-6 border-t border-canvas-border/70 grid gap-x-10 gap-y-7';

/**
 * A date, not "3 days ago" — the page is as-of the anchor, not as-of today.
 *
 * Everything on this page is windowed, so a tool with no runs is a tool nobody
 * ran *in the selected range*, which is not the same claim as "never run". The
 * Speech Auditor has been run — just not in the last 30 days — and calling it
 * never-run would be the page inventing a fact out of its own date filter.
 */
function lastRunLabel(offset: number | null, logs: ReturnType<typeof useAdminData>['logs']): string {
  if (offset === null) return 'no runs in this window';
  return usageDayLabel(offset, logs);
}

/**
 * What a run was pointed at, with the tool's own name taken off the front.
 *
 * The log line reads "Ran Document Forensics on a vendor invoice pack for P2P".
 * On that tool's page the first clause is the heading repeated back at you, and
 * it costs the room the rest of the sentence needs. Falls back to the whole
 * description when the shape isn't the one we write (a hand-made log line, say),
 * so nothing is ever silently swallowed.
 */
function runTarget(description: string, title: string): string {
  const prefix = `Ran ${title} on `;
  return description.startsWith(prefix) ? description.slice(prefix.length) : description;
}

/* ── The toolkit: every tool, ranked by runs ─────────────────────────────── */

/**
 * One tool in the ranking — and the only clickable thing on this screen.
 *
 * Clickability has to be legible *at rest*, not just on hover: a bare row of
 * numbers reads as a table, and nobody clicks a table. So every row carries a
 * chevron and a rank in the same place a list row carries them, the whole row
 * is one hit target (not just the title), and hover lifts the Hub's canvas tint
 * with the title, chevron and bar all shifting to brand at once — one gesture,
 * not four independent hovers.
 */
function ToolRow({ tool, max, index, onOpen, logs }: {
  tool: ConciergeToolUsage;
  max: number;
  index: number;
  onOpen: () => void;
  logs: ReturnType<typeof useAdminData>['logs'];
}) {
  const prefersReduced = useReducedMotion();
  const topRunner = tool.runners[0];
  const unused = tool.runs === 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-tool={tool.id}
      aria-label={`${tool.title} — open breakdown`}
      className="group w-full text-left px-2.5 py-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      {/* Rank. The list is sorted by runs, and a reader shouldn't have to infer
          that from the bar lengths. */}
      <span className="w-4 shrink-0 text-[0.6875rem] font-semibold tabular-nums text-ink-300 transition-colors group-hover:text-brand-500">
        {index + 1}
      </span>

      {/* name + tags */}
      <div className="min-w-0 w-[30%]">
        <div className="text-[0.8125rem] font-semibold text-ink-900 truncate transition-colors group-hover:text-brand-700">
          {tool.title}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          {tool.tags.slice(0, 2).map(t => (
            <span key={t} className="inline-flex items-center px-1.5 h-4 rounded border text-[0.5625rem] font-semibold shrink-0 bg-brand-50 text-brand-700 border-brand-100">
              {t}
            </span>
          ))}
          <span className="text-[0.625rem] text-ink-400 truncate">
            {unused ? 'not run in this window' : `last run ${lastRunLabel(tool.lastRunOffset, logs)}`}
          </span>
        </div>
      </div>

      {/* runs bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1.5 gap-2">
          <span className="text-[0.625rem] text-ink-400">Runs</span>
          <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">
            <span className="text-[0.8125rem] font-semibold text-ink-900">{fmt(tool.runs)}</span>
            <span className="ml-1.5">{tool.share}%</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-ink-900/[0.06] overflow-hidden">
          {/* Nothing to draw at zero. An empty track says "none" without a stub
              bar pretending to be a value. */}
          {!unused && (
            <motion.div
              className="h-full rounded-full bg-brand-600 transition-colors group-hover:bg-brand-500"
              initial={prefersReduced ? false : { width: 0 }}
              animate={{ width: `${Math.max(3, (tool.runs / max) * 100)}%` }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.55, delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </div>
      </div>

      {/* who runs it. The face and the name lead: "who used it" is half the
          question this section exists to answer, and it should be readable
          without a click. */}
      <div className="w-[164px] shrink-0 flex items-center justify-end gap-2">
        {topRunner ? (
          <>
            <div className="min-w-0 text-right">
              <div className="text-[0.6875rem] font-semibold text-ink-800 truncate">{topRunner.user}</div>
              <div className="text-[0.625rem] text-ink-400 tabular-nums truncate">
                {fmt(topRunner.count)} run{topRunner.count === 1 ? '' : 's'} · {tool.runners.length} in all
              </div>
            </div>
            <InitialsAvatar name={topRunner.user} size={24} />
          </>
        ) : (
          <span className="text-[0.6875rem] text-ink-300">Nobody</span>
        )}
      </div>

      {/* The affordance. Present at rest in ink-300, brand and a step to the
          right on hover — the same promise-of-a-click the section tiles make. */}
      <ChevronRight
        size={15}
        className="shrink-0 text-ink-300 transition-[color,transform] group-hover:text-brand-600 group-hover:translate-x-0.5"
      />
    </button>
  );
}

/* ── One tool's own breakdown ────────────────────────────────────────────── */

function ToolDetail({ tool, rangeDays, onBack }: {
  tool: ConciergeToolUsage;
  rangeDays: number;
  onBack: () => void;
}) {
  const { logs } = useAdminData();
  const prefersReduced = useReducedMotion();

  const chartData = tool.series.map(p => ({ label: usageDayLabel(p.dayOffset, logs), runs: p.count }));
  const tickInterval = rangeDays <= 7 ? 0 : rangeDays <= 30 ? 6 : 14;
  const maxRunner = Math.max(1, ...tool.runners.map(r => r.count));
  const perMember = tool.runners.length > 0 ? Math.round(tool.runs / tool.runners.length) : 0;

  return (
    <motion.div
      key={tool.id}
      initial={prefersReduced ? false : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* The way back rides the scroll.
          The detail is three cards deep, so a back link parked at the top scrolls
          away the moment you read past the chart, and the only exit left is the
          modal's ✕ — which closes the whole section rather than returning to the
          toolkit. Sticky to the modal's scrollport, it is always one click away,
          and it carries the tool's name so you never lose your place either.
          `-mx-7` bleeds it to the modal's own padding so nothing scrolls past in
          the gutter beside it. */}
      <div className="sticky -top-5 z-20 -mx-7 -mt-5 px-7 pt-5 pb-2.5 bg-canvas-elevated/95 backdrop-blur-sm border-b border-canvas-border flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-[0.8125rem] font-semibold text-ink-600 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          <ArrowLeft size={15} /> The toolkit
        </button>
        <span className="text-ink-300" aria-hidden>/</span>
        <span className="text-[0.8125rem] font-medium text-ink-500 truncate">{tool.title}</span>
      </div>

      {/* The tool, stated once. A modal is already a box; a card inside it is a
          second border around the same content, and three of them stacked is why
          the old body read as an admin panel rather than a page. The heading, the
          hairline and the space do the separating instead. */}
      <header className="pt-5 flex items-start gap-3">
        <div className={`${ICON_TILE} ${ICON_TILE_BRAND}`}>
          <Wand2 size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[1.0625rem] font-semibold text-ink-900 leading-snug tracking-[-0.01em]">{tool.title}</h3>
          <p className="mt-1 text-[0.8125rem] text-ink-500 leading-snug">{tool.description}</p>
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {tool.tags.map(t => (
              <span key={t} className="inline-flex items-center px-2 h-5 rounded border text-[0.625rem] font-semibold bg-brand-50 text-brand-700 border-brand-100">
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 pt-6">
        <PortfolioStat label="Runs" value={fmt(tool.runs)} sub={`in the last ${rangeDays} days`} />
        <PortfolioStat label="Share of tool runs" value={`${tool.share}%`} sub="of all Concierge runs" />
        <PortfolioStat
          label="Members running it"
          value={tool.runners.length > 0 ? fmt(tool.runners.length) : '—'}
          sub={tool.runners.length > 0 ? `${fmt(perMember)} run${perMember === 1 ? '' : 's'} each` : 'nobody ran it in this window'}
        />
        <PortfolioStat
          label="Last run"
          value={tool.lastRunOffset === null ? '—' : lastRunLabel(tool.lastRunOffset, logs)}
          sub={tool.lastRunOffset === null ? 'not in this window' : 'most recent run'}
        />
        <PortfolioStat
          label="Busiest member"
          value={tool.runners[0] ? String(tool.runners[0].count) : '—'}
          sub={tool.runners[0] ? `runs by ${tool.runners[0].user}` : 'no runner in this window'}
        />
      </div>

      {tool.runs === 0 ? (
        <Band title={`No runs in the last ${rangeDays} days`}>
          <p className="text-[0.8125rem] text-ink-500 leading-relaxed max-w-2xl">
            {tool.title} is live on the AI Concierge page and anyone with Concierge access can open
            it — the platform simply recorded no run of it in this window. Widen the range at the
            top of the page to see whether it has ever been run.
          </p>
        </Band>
      ) : (
        <>
          <Band title="Runs over time" note={`Daily runs · last ${rangeDays} days`}>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="conciergeToolFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES.primary} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SERIES.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" {...xAxisProps} interval={tickInterval} />
                <YAxis {...yAxisProps} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: 'rgba(106,18,205,0.25)' }}
                  isAnimationActive={false}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <TooltipCard
                        title={String(label)}
                        rows={[{ color: SERIES.primary, name: 'Runs', value: Number(payload[0].value) }]}
                      />
                    );
                  }}
                />
                <Area type="monotone" dataKey="runs" stroke={SERIES.primary} strokeWidth={1.75} fill="url(#conciergeToolFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </Band>

          <div className={`${BAND_ROW} grid-cols-1 lg:grid-cols-2`}>
            <Band flush title="Who ran it" note={`${fmt(tool.runners.length)} member${tool.runners.length === 1 ? '' : 's'}`}>
              <div className="space-y-3">
                {tool.runners.map((r, i) => (
                  <div key={r.user} className="flex items-center gap-2.5">
                    <InitialsAvatar name={r.user} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-[0.75rem] font-medium text-ink-700 truncate">{r.user}</span>
                        <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums">
                          <span className="font-semibold text-ink-900">{fmt(r.count)}</span>
                          <span className="ml-1.5">{Math.round((r.count / tool.runs) * 100)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-ink-900/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-brand-600"
                          initial={prefersReduced ? false : { width: 0 }}
                          animate={{ width: `${Math.max(2, (r.count / maxRunner) * 100)}%` }}
                          transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, delay: 0.03 * i }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Band>

            {/* The runs themselves. Every number above is counted off these rows,
                so the drill-down bottoms out in the record, not in another chart. */}
            <Band flush title="Recent runs" note={tool.recent.length > 8 ? `8 of ${fmt(tool.recent.length)}` : 'Newest first'}>
              <div className="divide-y divide-canvas-border/60">
                {tool.recent.slice(0, 8).map(r => (
                  <div key={r.entry.id} className="py-2 first:pt-0 flex items-baseline gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[0.75rem] font-medium text-ink-800 truncate">{r.entry.user}</div>
                      {/* "Ran Document Forensics on a vendor invoice pack" — on
                          Document Forensics' own page, the first half is the page
                          title read back to you, and it pushes the half that says
                          what was actually run *on* into the ellipsis. */}
                      <div className="text-[0.6875rem] text-ink-400 truncate">{runTarget(r.entry.description, tool.title)}</div>
                    </div>
                    <div className="shrink-0 text-[0.6875rem] text-ink-400 tabular-nums text-right">
                      {usageDayLabel(r.dayOffset, logs)}
                      {r.entry.hour !== null && (
                        <span className="ml-1.5">{String(r.entry.hour).padStart(2, '0')}:00</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Band>
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ── The section ─────────────────────────────────────────────────────────── */

export default function UsageConciergeSection({ days, rows, rangeDays }: {
  days: UsageDay[];
  rows: UserUsageRow[];
  rangeDays: number;
}) {
  const { logs } = useAdminData();
  const prefersReduced = useReducedMotion();
  const [openTool, setOpenTool] = useState<string | null>(null);

  /**
   * The two views share one scrollport (the modal body), so the scroll position
   * has to be handed between them deliberately.
   *
   * Click a tool from halfway down the list and the detail would otherwise open
   * already scrolled past its own header — the reader lands in the middle of a
   * chart with no idea what they opened. So: to the top on the way in, and back
   * to the row you clicked on the way out, which is where your eye already is.
   */
  const rootRef = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  /** The row that opened the detail — the thing focus belongs to on the way back. */
  const cameFrom = useRef<string | null>(null);

  const scrollport = () => rootRef.current?.closest<HTMLElement>('.overflow-y-auto') ?? null;

  const openDetail = (id: string) => {
    listScroll.current = scrollport()?.scrollTop ?? 0;
    cameFrom.current = id;
    setOpenTool(id);
  };

  const closeDetail = () => setOpenTool(null);

  useLayoutEffect(() => {
    const el = scrollport();
    if (!el) return;
    const target = openTool ? 0 : listScroll.current;

    // Re-applied across a few frames, not set once. Recharts measures its
    // container asynchronously, so the view mounts shorter than it ends up, and
    // the browser silently clamps the scroll to that short height on a *later*
    // layout pass — reading scrollTop straight after the assignment reports the
    // value we asked for, so a single set (or a check-then-retry) looks like it
    // worked and still lands the reader short of where they were.
    let frames = 0;
    let raf = 0;
    const apply = () => {
      el.scrollTop = target;
      if (frames++ < 6) raf = requestAnimationFrame(apply);
    };
    apply();

    // Coming back, focus returns to the row that was clicked, not to the top of
    // the document — otherwise a keyboard user has to tab the whole list again
    // to get back to where they were. `preventScroll` because the restore above
    // already owns the scroll position; letting focus move it too would fight it.
    if (!openTool && cameFrom.current) {
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tool="${cameFrom.current}"]`)
        ?.focus({ preventScroll: true });
      cameFrom.current = null;
    }

    return () => cancelAnimationFrame(raf);
  }, [openTool]);

  const tools = useMemo(() => conciergeToolUsage(days), [days]);
  const runs = useMemo(() => aiToolRuns(days), [days]);
  const runners = useMemo(() => conciergeRunners(days), [days]);

  const active = rows.filter(r => r.actions > 0);
  const adoption = active.length > 0 ? Math.round((runners.length / active.length) * 100) : 0;
  const used = tools.filter(t => t.runs > 0);
  const unused = tools.filter(t => t.runs === 0);
  const most = used[0];
  const maxRuns = Math.max(1, ...tools.map(t => t.runs));
  const maxRunner = Math.max(1, ...runners.map(r => r.count));

  const mix = used.map((t, i) => ({
    name: t.title,
    value: t.runs,
    color: MIX_COLORS[i % MIX_COLORS.length],
  }));

  const detail = tools.find(t => t.id === openTool) ?? null;

  // One root, two views — the ref has to survive the swap, because it is how
  // both of them reach the scrollport they share.
  if (detail) {
    return (
      <div ref={rootRef}>
        <AnimatePresence mode="wait">
          <ToolDetail key={detail.id} tool={detail} rangeDays={rangeDays} onBack={closeDetail} />
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="pt-1">
      {/* The four numbers the section exists to hand over, before any chart. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <PortfolioStat label="Tool runs" value={fmt(runs)} sub={`in the last ${rangeDays} days`} />
        <PortfolioStat
          label="Most used"
          value={most ? most.title.split(' ')[0] : '—'}
          sub={most ? `${fmt(most.runs)} runs · ${most.share}% of all` : 'no runs in this window'}
        />
        <PortfolioStat
          label="Members running tools"
          value={runners.length > 0 ? fmt(runners.length) : '—'}
          sub={runners.length > 0 ? `${adoption}% of active members` : 'no tool runs in this window'}
        />
        <PortfolioStat
          label="Tools nobody ran"
          value={`${unused.length} of ${tools.length}`}
          sub={unused.length > 0 ? unused.map(t => t.title).join(', ') : 'every tool was used'}
        />
      </div>

      <Band
        title="The toolkit"
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 h-[1.375rem] text-[0.6875rem] font-semibold text-brand-700 shrink-0">
            <MousePointerClick size={12} strokeWidth={2} />
            Click a tool for its breakdown
          </span>
        }
      >
        {/* Hairlines between rows, none at the edges — the rows are one list, and
            the band's own rule already opened it. The list keeps the modal's own
            gutter: a row that tints edge-to-edge on hover would wash right up
            against the panel border. */}
        <div className="divide-y divide-canvas-border/60">
          {tools.map((t, i) => (
            <ToolRow key={t.id} tool={t} max={maxRuns} index={i} logs={logs} onOpen={() => openDetail(t.id)} />
          ))}
        </div>
        <p className="mt-3 text-[0.625rem] text-ink-400">
          Bar length = runs in the window. A tool with no bar was not run in it — widen the range
          to see whether it has ever been run.
        </p>
      </Band>

      <div className={`${BAND_ROW} grid-cols-1 lg:grid-cols-3`}>
        <div className="lg:col-span-2">
          <Band flush title="Who runs the tools" note="Busiest first">
            {runners.length > 0 ? (
              <div className="space-y-3">
                {runners.slice(0, 8).map((r, i) => (
                  <div key={r.user} className="flex items-center gap-2.5">
                    <InitialsAvatar name={r.user} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-[0.75rem] font-medium text-ink-700 truncate">{r.user}</span>
                        <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums">
                          <span className="font-semibold text-ink-900">{fmt(r.count)}</span>
                          <span className="ml-1.5">{Math.round((r.count / Math.max(1, runs)) * 100)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-ink-900/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-brand-600"
                          initial={prefersReduced ? false : { width: 0 }}
                          animate={{ width: `${Math.max(2, (r.count / maxRunner) * 100)}%` }}
                          transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, delay: 0.03 * i }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8125rem] text-ink-400">Nobody ran a Concierge tool in this window.</p>
            )}
          </Band>
        </div>

        <Band flush title="Run mix" note="By tool">
          {mix.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="relative w-[120px] h-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mix} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={42} outerRadius={58} paddingAngle={2} cornerRadius={4} strokeWidth={0}
                    >
                      {mix.map(m => <Cell key={m.name} fill={m.color} />)}
                    </Pie>
                    <Tooltip
                      isAnimationActive={false}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0];
                        return (
                          <TooltipCard
                            title={String(p.name)}
                            rows={[{ color: p.payload.color, name: 'Runs', value: Number(p.value) }]}
                          />
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">
                    {fmt(runs)}
                  </span>
                  <span className="mt-1 text-[0.5625rem] text-ink-400 uppercase tracking-[0.1em]">Runs</span>
                </div>
              </div>
              <div className="space-y-2 min-w-0 flex-1">
                {mix.map(m => (
                  <div key={m.name} className="flex items-center gap-2 text-[0.6875rem]">
                    <span className="h-[3px] w-3.5 rounded-full shrink-0" style={{ background: m.color }} />
                    <span className="text-ink-500 truncate">{m.name}</span>
                    <span className="ml-auto font-semibold text-ink-900 tabular-nums">{fmt(m.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[0.8125rem] text-ink-400">No runs to split.</p>
          )}
          {unused.length > 0 && (
            <p className="mt-4 text-[0.6875rem] text-ink-400 leading-relaxed">
              {`${unused.map(t => t.title).join(', ')} — no runs in this window, so ${unused.length === 1 ? 'it takes' : 'they take'} no share of the mix.`}
            </p>
          )}
        </Band>
      </div>
    </div>
  );
}
