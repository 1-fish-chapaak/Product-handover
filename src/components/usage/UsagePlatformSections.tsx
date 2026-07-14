/**
 * Platform Usage — per-section deep-dives, tile + modal.
 *
 * The page shows one compact tile per platform section (Engagements, Ask IRA,
 * Reports, Workflows, Risk & Controls, Knowledge Hub, Dashboards) with its
 * headline numbers. Clicking a tile opens the full engagement-style deep-dive
 * in a scrollable modal, so the page itself stays short. Everything is
 * read-only stats — the only interaction is opening and closing details.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ClipboardCheck, Sparkles, FileBarChart, Workflow, ShieldCheck, Database,
  LayoutDashboard, ShieldUser, Wand2, Calendar, Inbox, Layers, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import Modal from '../shared/Modal';
import { PortfolioStat } from './usageSectionPrimitives';
import { Eyebrow, TrendBars, Tile, TooltipCard } from './usageChrome';
import { DONUT_SHADES, ICON_TILE, ICON_TILE_BRAND, fmt } from './usageTokens';
import UsageEngagementsSection from './UsageEngagementsSection';
import UsageConciergeSection from './UsageConciergeSection';
import ModuleUsagePanel from './ModuleUsagePanel';
import { SECTION_MODULE, type SectionKey } from './usageSectionMap';
import { deriveEngagementPortfolio } from '../../data/engagement-portfolio';
import { useKnowledgeSources } from '../../hooks/useKnowledgeSources';
import { useGeneratedReports } from '../../hooks/useGeneratedReports';
import {
  deriveAskIraPortfolio, deriveReportsPortfolio, deriveWorkflowsPortfolio,
  deriveRiskControlsPortfolio, deriveKnowledgePortfolio, deriveDashboardsPortfolio,
  deriveAdminPortfolio, deriveAuditPlanningPortfolio, deriveExceptionsPortfolio,
  deriveProcessHubPortfolio,
  type SectionPortfolio, type SectionStat, type RankedRow,
} from '../../data/section-portfolios';
import {
  aiToolRuns, conciergeRunners, conciergeToolUsage,
  type UsageDay, type UsageModule, type UserUsageRow,
} from '../../data/platform-usage';

const RIGHT_TONE = {
  good: 'text-compliant-700 font-semibold',
  bad: 'text-risk-700 font-semibold',
  muted: 'text-ink-400',
};

function RankedRowLine({ row }: { row: RankedRow }) {
  return (
    <div className="w-full -mx-2 px-2 py-2 rounded-lg flex items-center gap-3">
      {/* title + chip + sub */}
      <div className="min-w-0 w-[38%]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[0.8125rem] font-semibold text-ink-900 truncate">{row.title}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          {row.chip && <span className={`inline-flex items-center px-1.5 h-4 rounded border text-[0.5625rem] font-semibold shrink-0 ${row.chip.className}`}>{row.chip.label}</span>}
          {row.sub && <span className="text-[0.625rem] text-ink-400 truncate">{row.sub}</span>}
        </div>
      </div>

      {/* bar */}
      <div className="flex-1 min-w-0">
        {row.bar && (
          <>
            {/* The bar's own label ("Pages", "Controls") is dropped. It was the
                same word on every row of the list, and the note to its right
                already says "24 pages". */}
            <div className="flex items-center justify-end mb-1">
              <span className="text-[0.6875rem] text-ink-500 tabular-nums">{row.bar.note}</span>
            </div>
            {/* Full-width track on every row: these are magnitudes of one measure,
                so they need a shared baseline to be read against each other. One
                hue, too — the row already wears a chip naming its kind, so tinting
                the bar to match is the same fact told twice. */}
            <div className="h-2 rounded-full bg-brand-100/70 overflow-hidden relative">
              {typeof row.bar.fillPct === 'number' ? (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand-200"
                  style={{ width: `${Math.max(2, Math.min(100, row.bar.value))}%` }}
                >
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${row.bar.fillPct}%` }} />
                </div>
              ) : (
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${Math.max(2, Math.min(100, row.bar.value))}%` }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* right note */}
      <div className="w-[128px] text-right shrink-0">
        {row.right && <span className={`text-[0.6875rem] tabular-nums ${RIGHT_TONE[row.right.tone ?? 'muted']}`}>{row.right.text}</span>}
      </div>
    </div>
  );
}

/* A donut's slices are parts of one whole, so they are shades of one hue rather
   than four unrelated ones — the shared ramp, from `usageTokens`. It used to be
   a second copy of the same list declared here, which is exactly how two donuts
   on one product end up two different colours. */

/** The full deep-dive body rendered inside the section modal. */
function SectionDetail({ portfolio }: { portfolio: SectionPortfolio }) {
  const prefersReduced = useReducedMotion();
  const barMax = Math.max(1, ...portfolio.bars.items.map(b => b.value));
  const donutItems = portfolio.donut.items.map((d, i) => ({
    ...d,
    color: DONUT_SHADES[i % DONUT_SHADES.length],
  }));
  const donutTotal = donutItems.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-7">
        {portfolio.stats.map(s => (
          <PortfolioStat key={s.label} label={s.label} value={s.value} sub={s.sub} tone={s.tone} />
        ))}
      </div>

      {/* Composition: bars + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-6">
        <div className="lg:col-span-2">
          <Eyebrow className="mb-3">{portfolio.bars.title}</Eyebrow>
          {portfolio.bars.variant === 'list' ? (
            <div className="space-y-2">
              {portfolio.bars.items.map(b => (
                <div key={b.label} className="flex items-center justify-between gap-2 py-1 border-b border-canvas-border/40 last:border-0">
                  <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-700 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                    <span className="truncate">{b.label}</span>
                  </span>
                  {b.note && <span className="text-[0.6875rem] text-ink-500 shrink-0">{b.note}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              {portfolio.bars.items.map((b, i) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    {/* No colour swatch. The row is already named; a dot that
                        repeats the name in hue is decoration, and four hues down
                        a four-row list is a rainbow with nothing to say. */}
                    <span className="text-[0.75rem] font-medium text-ink-700 truncate min-w-0">{b.label}</span>
                    <span className="text-[0.6875rem] tabular-nums shrink-0">
                      <span className="font-semibold text-ink-800">{b.value.toLocaleString('en-US')}</span>
                      {b.note && <span className="ml-2 text-ink-400">{b.note}</span>}
                    </span>
                  </div>
                  {/* Every row's track is the full width, so the bars share a
                      baseline and can actually be compared. Previously the track
                      itself was the bar, which meant each row started from a
                      different-length container. */}
                  {/* The track is a lighter step of the fill's own ramp, not a
                      grey wash — the same rule the page's shared `Meter` follows,
                      so a bar inside a modal and a bar on the page behind it are
                      the same object. */}
                  <div className="h-2 rounded-full bg-brand-100/70 overflow-hidden relative">
                    {typeof b.fillPct === 'number' ? (
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-200"
                        style={{ width: `${Math.max(2, (b.value / barMax) * 100)}%` }}
                      >
                        <motion.div
                          className="h-full rounded-full bg-brand-600"
                          initial={prefersReduced ? false : { width: 0 }}
                          animate={{ width: `${b.fillPct}%` }}
                          transition={{ duration: prefersReduced ? 0 : 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    ) : (
                      <motion.div
                        className="h-full rounded-full bg-brand-600"
                        initial={prefersReduced ? false : { width: 0 }}
                        animate={{ width: `${Math.max(2, (b.value / barMax) * 100)}%` }}
                        transition={{ duration: prefersReduced ? 0 : 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {portfolio.bars.note && <p className="mt-3 text-[0.625rem] text-ink-400">{portfolio.bars.note}</p>}
        </div>

        <div>
          <Eyebrow className="mb-3">{portfolio.donut.title}</Eyebrow>
          <div className="flex items-center gap-4">
            <div className="relative w-[120px] h-[120px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutItems}
                    dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={42} outerRadius={58} paddingAngle={2} cornerRadius={4} strokeWidth={0}
                  >
                    {donutItems.map(s => <Cell key={s.name} fill={s.color} />)}
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
                          rows={[{ color: p.payload.color, name: 'Count', value: Number(p.value) }]}
                        />
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* The centre of a donut is the one place the total belongs. */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">
                  {donutTotal.toLocaleString('en-US')}
                </span>
                <span className="mt-1 text-[0.5625rem] text-ink-400 uppercase tracking-[0.1em]">Total</span>
              </div>
            </div>
            <div className="space-y-2 min-w-0 flex-1">
              {donutItems.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-[0.6875rem]">
                  <span className="h-[3px] w-3.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-ink-500 truncate">{s.name}</span>
                  <span className="ml-auto font-semibold text-ink-900 tabular-nums">{s.value.toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ranked rows — sections with no ranked list omit this block entirely. */}
      {portfolio.rows && (
        <div className="pt-4 border-t border-canvas-border/60">
          <div className="flex items-baseline justify-between mb-2">
            <Eyebrow>{portfolio.rows.title}</Eyebrow>
            <div className="text-[0.625rem] text-ink-400">{portfolio.rows.subtitle}</div>
          </div>
          <div className="space-y-1">
            {portfolio.rows.items.map(row => <RankedRowLine key={row.id} row={row} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact clickable summary tile for one platform section.
 *
 * This is the only thing on the page you can click through to a detail, so it
 * is the only thing that wears the Knowledge Hub's *tile*: brand-50 icon square,
 * brand-300 border and a spring lift on hover. The chart panels around it stay
 * flat — a lift is a promise of a click, and they don't take one.
 */
/**
 * Red carries "someone has to do something about this"; nothing else is tinted.
 *
 * Green is gone on purpose. `usageTokens` states the rule — colour only where
 * direction has meaning, never as decoration — and a green `0 failed sign-ins`
 * or `5 resolved` was celebrating the expected state. Across twelve tiles that
 * scattered red and green over the grid at random and left the reader with no
 * way to tell which cards actually wanted their attention.
 */
const STAT_TONE: Record<'good' | 'bad' | 'neutral', string> = {
  bad: 'text-risk-700',
  good: 'text-ink-900',
  neutral: 'text-ink-900',
};

function SectionTile({ icon: Icon, title, hint, stats, scope, index, activity, actions, onOpen }: {
  icon: LucideIcon; title: string; hint: string; stats: SectionStat[]; index: number;
  /**
   * Whether the date filter governs THIS CARD'S three numbers.
   *
   * It governs some and not others, and that is correct: PRD §6.7 requires these
   * counts to match the screen that owns them ("if the Control Library says 14,
   * this page says 14"), and a register is a stock — it has no "last 30 days"
   * reading. But REQ-1.1 also promises "one date control runs every number on
   * every tab", and the two rules collide precisely here.
   *
   * The collision is only harmful while it is INVISIBLE. An admin who moves the
   * date range and watches Ask IRA change while Reports sits still has been shown
   * a broken page — not because a number is wrong, but because nothing on screen
   * told them which numbers were ever going to move. So every card says.
   */
  scope: 'period' | 'all-time';
  /** The section's daily action count across the window, for the sparkline. */
  activity: number[];
  /** What those days add up to. The sparkline has no axis, so it carries no magnitude. */
  actions: number;
  onOpen: () => void;
}) {
  return (
    <Tile
      onClick={onOpen}
      index={index}
      /* The "open details" SUFFIX is a contract, not prose: both
         _qa-usage-modals and _qa-usage-consistency find every tile with
         `button[aria-label$="open details"]`. The scope goes in front of it so a
         screen-reader user hears which clock the figures run on. An aria-label
         overrides the button's inner content, so the visible chip alone would not
         reach them. */
      ariaLabel={`${title}, figures ${scope === 'period' ? 'for the selected period' : 'all time'}, open details`}
      className="p-5 flex flex-col"
    >
      {/* The description sits with the title it describes. It used to be marooned
          at the foot of the card under its own rule, which is where a footnote
          goes, not a definition. */}
      <div className="flex items-start gap-3">
        <div className={`${ICON_TILE} ${ICON_TILE_BRAND}`}>
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-snug truncate">{title}</h3>
          <p className="mt-0.5 text-[0.6875rem] text-ink-400 leading-snug line-clamp-2">{hint}</p>
        </div>
        <ChevronRight
          size={14}
          className="shrink-0 mt-0.5 text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-[color,transform]"
        />
      </div>

      {/* A ledger, not a hero. Every figure is named on its own line and set
          against the same right edge, so the card reads top to bottom and the
          twelve tiles read as one column of numbers rather than twelve posters.
          No figure is repeated from the title above it. */}
      {/* Which clock these three numbers run on. One word, and it is the word
          that stops the tab contradicting the rest of the page: "Reports in the
          library · all time · 23" cannot be mistaken for the Overview headline
          "Reports produced · 7", once the card says which is which. */}
      <div className="mt-auto pt-4 flex items-center justify-end">
        <span
          title={
            scope === 'period'
              ? 'These figures follow the date range at the top of the page.'
              : 'A live total from the register that owns it, so it matches that screen exactly. It does not change with the date range. The activity line below does.'
          }
          className={`inline-flex items-center h-[1.125rem] px-1.5 rounded border text-[0.5625rem] font-semibold uppercase tracking-wide ${
            scope === 'period'
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-canvas-border bg-canvas text-ink-400'
          }`}
        >
          {scope === 'period' ? 'This period' : 'All time'}
        </span>
      </div>

      <dl className="pt-2 divide-y divide-canvas-border/70">
        {stats.slice(0, 3).map(s => (
          <div key={s.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
            {/* The label stays verbatim even when it echoes the title above it
                ("Dashboards / Dashboards 7"). Shortening it to "Total" reads
                better, but _qa-usage-consistency reconciles each tile against its
                own module by finding this exact label, so it is a contract, not
                decoration. The echo is the cheaper of the two costs. */}
            <dt className="text-[0.75rem] text-ink-500 truncate">{s.label}</dt>
            <dd className={`text-[0.9375rem] font-semibold tabular-nums shrink-0 tracking-[-0.01em] ${STAT_TONE[s.tone ?? 'neutral']}`}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* The one thing twelve tiles of static counts could never say: whether the
          area is going anywhere.

          These were sparklines. They are now the same summing BARS the KPI band
          uses, and the change is not cosmetic — it is the page finally telling
          the truth in both places at once. A sparkline is normalised to its own
          maximum and has no baseline, so the identical curve is drawn whether the
          area moved by 2 actions or 200, and nothing under it adds up to the
          number printed beside it. The bars ARE that number, split across the
          window. Keeping curves here while arguing for bars on the KPI row was
          the page holding two opinions about the same mark. */}
      <div className="mt-4 pt-3 border-t border-canvas-border flex items-center justify-between gap-3">
        <span className="text-[0.625rem] font-medium text-ink-400 truncate">
          {actions > 0
            ? `${fmt(actions)} action${actions === 1 ? '' : 's'} this period`
            : 'No activity this period'}
        </span>
        {actions > 0 && activity.length > 1 && (
          // 96px and twelve buckets, not 64px and thirty days. At the old size
          // each day got about two pixels, so twelve cards carried twelve strips
          // of specks; bucketed, every bar is a column you can actually see, and
          // the sums still add up to the count printed beside them.
          <div className="w-24 shrink-0">
            <TrendBars
              series={activity}
              total={actions}
              height="h-6"
              maxBars={12}
              ariaLabel={`${title}: ${fmt(actions)} actions across the period`}
            />
          </div>
        )}
      </div>
    </Tile>
  );
}

/**
 * The window's daily counts for one module, bucketed down to a length a 64px
 * sparkline can actually draw. Ninety days across 64 pixels is under a pixel a
 * day: the line stops being a trend and becomes a texture.
 */
const SPARK_POINTS = 14;

function sparkSeries(days: UsageDay[], module: UsageModule): number[] {
  const daily = days.map(d => d.byModule[module] ?? 0);
  if (daily.length <= SPARK_POINTS) return daily;
  const size = Math.ceil(daily.length / SPARK_POINTS);
  const out: number[] = [];
  for (let i = 0; i < daily.length; i += size) {
    out.push(daily.slice(i, i + size).reduce((s, v) => s + v, 0));
  }
  return out;
}

/* `SectionKey`, `SECTION_MODULE` and `MODULE_SECTION` live in `usageSectionMap.ts`
   — a components file may not also export constants (Fast Refresh). */

/**
 * Every tile on this grid is one bucket of the audit log, so each one can carry
 * its own slice of the same series the Overview charts. The map is explicit
 * rather than derived from the title, because two of them differ ("Admin &
 * access" is logged as `Admin`) and a silent mismatch would draw a flat line
 * instead of failing.
 */
export default function UsagePlatformSections({
  days, rows, rangeDays, priorDays, totalActions, open: openProp, onOpenChange,
}: {
  days: UsageDay[];
  rows: UserUsageRow[];
  rangeDays: number;
  /** The window before this one — the usage panel's delta baseline. */
  priorDays: UsageDay[];
  /** All actions in the window, so each area can state its share of the whole. */
  totalActions: number;
  /**
   * Which section is open. Optional: pass it (with `onOpenChange`) when something
   * OUTSIDE the grid — the scatter, the Top-areas list — has to open a section's
   * detail. Left out, the grid owns the state itself and behaves as it always did.
   */
  open?: SectionKey | null;
  onOpenChange?: (key: SectionKey | null) => void;
}) {
  const [openLocal, setOpenLocal] = useState<SectionKey | null>(null);
  const open = openProp !== undefined ? openProp : openLocal;
  const setOpen = onOpenChange ?? setOpenLocal;

  // The Knowledge Hub's catalog is live — a user can add or delete a source and
  // the Hub reflects it immediately. Read the same store so this page does too,
  // rather than reporting on a snapshot that stopped being true.
  const { sources: knowledgeSources } = useKnowledgeSources();

  // The report book is live too — a report generated this session must be
  // counted here, not just in the Reports view.
  const generatedReports = useGeneratedReports();

  const eng = useMemo(() => deriveEngagementPortfolio(), []);
  const askIra = useMemo(() => deriveAskIraPortfolio(days, rows), [days, rows]);
  const reports = useMemo(() => deriveReportsPortfolio(generatedReports), [generatedReports]);
  const workflows = useMemo(() => deriveWorkflowsPortfolio(), []);
  const riskControls = useMemo(() => deriveRiskControlsPortfolio(), []);
  const knowledge = useMemo(
    () => deriveKnowledgePortfolio(knowledgeSources, rangeDays),
    [knowledgeSources, rangeDays],
  );
  const dashboards = useMemo(() => deriveDashboardsPortfolio(days), [days]);
  const admin = useMemo(() => deriveAdminPortfolio(days, rows), [days, rows]);
  // Three surfaces the page never reported on at all: the plan, the triage
  // queue, and the process map every RACM hangs off.
  const planning = useMemo(() => deriveAuditPlanningPortfolio(), []);
  const exceptions = useMemo(() => deriveExceptionsPortfolio(), []);
  const processHub = useMemo(() => deriveProcessHubPortfolio(), []);

  const engStats: SectionStat[] = [
    { label: 'Engagements', value: String(eng.total) },
    { label: 'Controls in scope', value: eng.controlsInScope.toLocaleString('en-US') },
    { label: 'Open findings', value: String(eng.openFindings), tone: eng.openFindings > 0 ? 'bad' : 'good' },
  ];

  // The Concierge tile answers "how much, on how many tools, by how many people";
  // which tool leads and who ran it is the modal's job, one click away.
  const conciergeTools = useMemo(() => conciergeToolUsage(days), [days]);
  const conciergeStats: SectionStat[] = [
    { label: 'Tool runs', value: aiToolRuns(days).toLocaleString('en-US') },
    {
      label: 'Tools used',
      value: `${conciergeTools.filter(t => t.runs > 0).length} of ${conciergeTools.length}`,
    },
    { label: 'Members running tools', value: String(conciergeRunners(days).length) },
  ];

  /* `scope` is not a style choice — it is the literal truth about each derive
     call above. A section is 'period' if and only if its portfolio is a function
     of `days`; everything else reads a live register and cannot move with the
     date picker. Get this wrong in either direction and the card lies. */
  const sections: { key: SectionKey; icon: LucideIcon; title: string; subtitle: string; stats: SectionStat[]; scope: 'period' | 'all-time'; portfolio?: SectionPortfolio }[] = [
    // Registers. deriveEngagementPortfolio/AuditPlanning/Exceptions/ProcessHub/
    // Reports/Workflows/RiskControls take no `days` — they are the owning
    // screen's totals, which is exactly what §6.7 demands of them.
    { key: 'engagements', icon: ClipboardCheck, title: 'Engagements', subtitle: 'Audits under way, and what testing has found', stats: engStats, scope: 'all-time' },
    { key: 'planning', icon: Calendar, title: 'Audit Planning', subtitle: 'What is scheduled, and who runs it', stats: planning.stats, scope: 'all-time', portfolio: planning },
    /* "Exceptions" is the domain word; "My Queue" is the word on the nav item a
       user actually clicks. An admin looking for how much My Queue gets used
       would not have found that phrase anywhere on this page. This page reports
       on other screens, so it has to speak their names — the card keeps the
       domain word as its title (the module, the chip and the ranking all use it)
       and names the screen in the line underneath, where it is findable. */
    { key: 'exceptions', icon: Inbox, title: 'Exceptions', subtitle: 'The rows behind My Queue: flagged by a workflow, waiting on a person', stats: exceptions.stats, scope: 'all-time', portfolio: exceptions },
    { key: 'process-hub', icon: Layers, title: 'Process Hub', subtitle: 'The SOPs and RACMs behind each business process', stats: processHub.stats, scope: 'all-time', portfolio: processHub },
    // Activity. These four ARE functions of `days`, and they move with the range.
    { key: 'ask-ira', icon: Sparkles, title: 'Ask IRA', subtitle: 'What people ask the assistant', stats: askIra.stats, scope: 'period', portfolio: askIra },
    { key: 'concierge', icon: Wand2, title: 'AI Concierge', subtitle: 'Which AI tool gets run, and who runs it', stats: conciergeStats, scope: 'period' },
    { key: 'reports', icon: FileBarChart, title: 'Reports', subtitle: 'The report book, and what is in it', stats: reports.stats, scope: 'all-time', portfolio: reports },
    { key: 'workflows', icon: Workflow, title: 'Workflows', subtitle: 'How much the automations actually run', stats: workflows.stats, scope: 'all-time', portfolio: workflows },
    { key: 'risk-controls', icon: ShieldCheck, title: 'Risk & Controls', subtitle: 'How much of the register is controlled', stats: riskControls.stats, scope: 'all-time', portfolio: riskControls },
    // Knowledge Hub reads the live source list, but one of its three figures
    // ("Added in this period") is windowed on rangeDays. A card whose figures
    // run on two clocks has to be called by the one a reader would otherwise be
    // fooled by: the register. The windowed line names its own window.
    { key: 'knowledge', icon: Database, title: 'Knowledge Hub', subtitle: 'Where the platform gets its data', stats: knowledge.stats, scope: 'all-time', portfolio: knowledge },
    { key: 'dashboards', icon: LayoutDashboard, title: 'Dashboards', subtitle: 'What the team keeps an eye on', stats: dashboards.stats, scope: 'period', portfolio: dashboards },
    { key: 'admin', icon: ShieldUser, title: 'Admin & access', subtitle: 'Workspaces, teams, and who can change what', stats: admin.stats, scope: 'period', portfolio: admin },
  ];

  const active = sections.find(s => s.key === open) ?? null;

  // One pass over the window per section, memoised on the window itself: the
  // grid re-renders on every hover of every tile, and twelve reductions over
  // ninety days is not work to redo for a border colour.
  const trends = useMemo(() => {
    const out = {} as Record<SectionKey, { series: number[]; total: number }>;
    (Object.keys(SECTION_MODULE) as SectionKey[]).forEach(key => {
      const module = SECTION_MODULE[key];
      out[key] = {
        series: sparkSeries(days, module),
        total: days.reduce((s, d) => s + (d.byModule[module] ?? 0), 0),
      };
    });
    return out;
  }, [days]);

  return (
    <div>
      {/* Said once, at the top, and then again on every card.

          This tab is the one place on the page where the date range does not run
          every number, and it cannot: §6.7 requires these counts to match the
          register that owns them ("if the Control Library says 14, this page says
          14"), and a register has no last-30-days reading. That is a deliberate
          exception to REQ-1.1, and an exception nobody is told about is
          indistinguishable from a bug — an admin moves the range, watches Ask IRA
          move and Reports sit still, and stops trusting the page. */}
      <p className="mb-4 text-[0.75rem] text-ink-500 leading-relaxed">
        Cards marked <span className="font-semibold text-brand-700">This period</span> follow the date range above.
        Cards marked <span className="font-semibold text-ink-600">All time</span> are live totals taken from the
        screen that owns them, so they match the Control Library, the Risk Register and the report book exactly, and
        they do not move with the range. The activity line at the foot of every card is always the period.
      </p>

      {/* Three across, never four. At four the tile is ~250px wide inside a
          1440px window, and every section whose name is longer than "Reports"
          truncated in its own header — "Risk & Contr…", "Knowledge …", "Admin &
          acc…" — with the one-line description clipped under it. A card that
          cannot print its own title has stopped being a card and become a puzzle.
          Twelve tiles land as a clean 3 × 4. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((s, i) => (
          <SectionTile
            key={s.key}
            icon={s.icon}
            title={s.title}
            hint={s.subtitle}
            stats={s.stats}
            scope={s.scope}
            index={i}
            activity={trends[s.key].series}
            actions={trends[s.key].total}
            onOpen={() => setOpen(s.key)}
          />
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <Modal
            key={active.key}
            title={active.title}
            subtitle={active.subtitle}
            width="max-w-5xl"
            onClose={() => setOpen(null)}
          >
            {/* ONE detail per area: how much it was USED, then what is IN it.
                These were two separate modals — usage if you arrived from Top
                areas, inventory if you arrived from a section card — so the page
                could tell you Reports was busy, or that the library holds 23
                reports, but never both, and never answered the question those two
                facts exist to answer together: is this area producing anything?

                Usage leads, because usage is what this page is for. The register
                underneath is the context. */}
            <div className="pb-6 mb-6 border-b border-canvas-border">
              <ModuleUsagePanel
                module={SECTION_MODULE[active.key]}
                days={days}
                priorDays={priorDays}
                totalActions={totalActions}
                rows={rows}
                rangeDays={rangeDays}
              />
            </div>

            {active.key === 'engagements' ? (
              <UsageEngagementsSection />
            ) : active.key === 'concierge' ? (
              <UsageConciergeSection days={days} rows={rows} rangeDays={rangeDays} />
            ) : (
              active.portfolio && <SectionDetail portfolio={active.portfolio} />
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
