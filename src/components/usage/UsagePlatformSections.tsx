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
import { Eyebrow, Tile, TooltipCard } from './usageChrome';
import { ICON_TILE, ICON_TILE_BRAND } from './usageTokens';
import UsageEngagementsSection from './UsageEngagementsSection';
import UsageConciergeSection from './UsageConciergeSection';
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
  type UsageDay, type UserUsageRow,
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
            <div className="h-2 rounded-full bg-ink-900/[0.06] overflow-hidden relative">
              {typeof row.bar.fillPct === 'number' ? (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand-100"
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

/**
 * A donut's slices are parts of one whole, so they are shades of one hue rather
 * than four unrelated ones. Green/blue/amber segments read as four different
 * *kinds* of thing and pull the eye to whichever slice happens to be red.
 */
const DONUT_SHADES = ['#6A12CD', '#8B4FD8', '#A87BE4', '#C4A2EE', '#EDE4FA'];

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
                  <div className="h-2 rounded-full bg-ink-900/[0.06] overflow-hidden relative">
                    {typeof b.fillPct === 'number' ? (
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-100"
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

function SectionTile({ icon: Icon, title, hint, stats, index, onOpen }: {
  icon: LucideIcon; title: string; hint: string; stats: SectionStat[]; index: number; onOpen: () => void;
}) {
  
  return (
    <Tile
      onClick={onOpen}
      index={index}
      ariaLabel={`${title} — open details`}
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
      <dl className="mt-auto pt-4 divide-y divide-canvas-border/70">
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
    </Tile>
  );
}

type SectionKey =
  | 'engagements' | 'planning' | 'exceptions' | 'process-hub'
  | 'ask-ira' | 'concierge' | 'reports' | 'workflows'
  | 'risk-controls' | 'knowledge' | 'dashboards' | 'admin';

export default function UsagePlatformSections({ days, rows, rangeDays }: {
  days: UsageDay[];
  rows: UserUsageRow[];
  rangeDays: number;
}) {
  const [open, setOpen] = useState<SectionKey | null>(null);

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

  const sections: { key: SectionKey; icon: LucideIcon; title: string; subtitle: string; stats: SectionStat[]; portfolio?: SectionPortfolio }[] = [
    { key: 'engagements', icon: ClipboardCheck, title: 'Engagements', subtitle: 'Audits under way, and what testing has found', stats: engStats },
    { key: 'planning', icon: Calendar, title: 'Audit Planning', subtitle: 'What is scheduled, and who runs it', stats: planning.stats, portfolio: planning },
    { key: 'exceptions', icon: Inbox, title: 'Exceptions', subtitle: 'Flagged by a workflow, waiting on a person', stats: exceptions.stats, portfolio: exceptions },
    { key: 'process-hub', icon: Layers, title: 'Process Hub', subtitle: 'The SOPs and RACMs behind each business process', stats: processHub.stats, portfolio: processHub },
    { key: 'ask-ira', icon: Sparkles, title: 'Ask IRA', subtitle: 'What people ask the assistant', stats: askIra.stats, portfolio: askIra },
    { key: 'concierge', icon: Wand2, title: 'AI Concierge', subtitle: 'Which AI tool gets run, and who runs it', stats: conciergeStats },
    { key: 'reports', icon: FileBarChart, title: 'Reports', subtitle: 'What got generated, and what came of it', stats: reports.stats, portfolio: reports },
    { key: 'workflows', icon: Workflow, title: 'Workflows', subtitle: 'How much the automations actually run', stats: workflows.stats, portfolio: workflows },
    { key: 'risk-controls', icon: ShieldCheck, title: 'Risk & Controls', subtitle: 'How much of the register is controlled', stats: riskControls.stats, portfolio: riskControls },
    { key: 'knowledge', icon: Database, title: 'Knowledge Hub', subtitle: 'Where the platform gets its data', stats: knowledge.stats, portfolio: knowledge },
    { key: 'dashboards', icon: LayoutDashboard, title: 'Dashboards', subtitle: 'What the team keeps an eye on', stats: dashboards.stats, portfolio: dashboards },
    { key: 'admin', icon: ShieldUser, title: 'Admin & access', subtitle: 'Workspaces, teams, and who can change what', stats: admin.stats, portfolio: admin },
  ];

  const active = sections.find(s => s.key === open) ?? null;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sections.map((s, i) => (
          <SectionTile key={s.key} icon={s.icon} title={s.title} hint={s.subtitle} stats={s.stats} index={i} onOpen={() => setOpen(s.key)} />
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
