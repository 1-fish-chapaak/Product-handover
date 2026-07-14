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
import { CARD } from './usageSectionPrimitives';
import { PortfolioStat } from './usageSectionPrimitives';
import UsageEngagementsSection from './UsageEngagementsSection';
import { deriveEngagementPortfolio } from '../../data/engagement-portfolio';
import { useKnowledgeSources } from '../../hooks/useKnowledgeSources';
import { useGeneratedReports } from '../../hooks/useGeneratedReports';
import {
  deriveAskIraPortfolio, deriveConciergePortfolio, deriveReportsPortfolio, deriveWorkflowsPortfolio,
  deriveRiskControlsPortfolio, deriveKnowledgePortfolio, deriveDashboardsPortfolio,
  deriveAdminPortfolio, deriveAuditPlanningPortfolio, deriveExceptionsPortfolio,
  deriveProcessHubPortfolio,
  type SectionPortfolio, type SectionStat, type RankedRow,
} from '../../data/section-portfolios';
import type { UsageDay, UserUsageRow } from '../../data/platform-usage';

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
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.625rem] text-ink-400">{row.bar.label}</span>
              <span className="text-[0.6875rem] text-ink-500 tabular-nums">{row.bar.note}</span>
            </div>
            <div className="h-2 rounded-full bg-canvas overflow-hidden relative" style={{ width: `${Math.max(6, Math.min(100, row.bar.value))}%` }}>
              {typeof row.bar.fillPct === 'number' ? (
                <>
                  <div className="absolute inset-0 rounded-full opacity-25" style={{ background: row.bar.color }} />
                  <div className="h-full rounded-full relative" style={{ width: `${row.bar.fillPct}%`, background: row.bar.color }} />
                </>
              ) : (
                <div className="h-full rounded-full" style={{ width: '100%', background: row.bar.color }} />
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

/** The full deep-dive body rendered inside the section modal. */
function SectionDetail({ portfolio }: { portfolio: SectionPortfolio }) {
  const prefersReduced = useReducedMotion();
  const barMax = Math.max(1, ...portfolio.bars.items.map(b => b.value));

  return (
    <div>
      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {portfolio.stats.map(s => (
          <PortfolioStat key={s.label} label={s.label} value={s.value} sub={s.sub} tone={s.tone} />
        ))}
      </div>

      {/* Composition: bars + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2">
          <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">{portfolio.bars.title}</div>
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
            <div className="space-y-3">
              {portfolio.bars.items.map((b, i) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-700 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                      <span className="truncate">{b.label}</span>
                    </span>
                    <span className="text-[0.6875rem] text-ink-500 tabular-nums shrink-0">
                      <span className="font-semibold text-ink-800">{b.value.toLocaleString('en-US')}</span>
                      {b.note && <span className="ml-2">{b.note}</span>}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-canvas overflow-hidden relative" style={{ width: `${Math.max(8, (b.value / barMax) * 100)}%` }}>
                    {typeof b.fillPct === 'number' ? (
                      <>
                        <div className="absolute inset-0 rounded-full opacity-25" style={{ background: b.color }} />
                        <motion.div
                          className="h-full rounded-full relative"
                          style={{ background: b.color }}
                          initial={prefersReduced ? false : { width: 0 }}
                          animate={{ width: `${b.fillPct}%` }}
                          transition={{ duration: prefersReduced ? 0 : 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </>
                    ) : (
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: b.color }}
                        initial={prefersReduced ? false : { width: 0 }}
                        animate={{ width: '100%' }}
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
          <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">{portfolio.donut.title}</div>
          <div className="flex items-center gap-4">
            <div className="w-[112px] h-[112px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={portfolio.donut.items} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={32} outerRadius={54} paddingAngle={2} strokeWidth={0}>
                    {portfolio.donut.items.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 min-w-0">
              {portfolio.donut.items.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-[0.6875rem]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-ink-600 truncate">{s.name}</span>
                  <span className="ml-auto font-semibold text-ink-800 tabular-nums">{s.value.toLocaleString('en-US')}</span>
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
            <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">{portfolio.rows.title}</div>
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

/** Compact clickable summary tile for one platform section. */
function SectionTile({ icon: Icon, title, hint, stats, onOpen }: {
  icon: LucideIcon; title: string; hint: string; stats: SectionStat[]; onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      aria-label={`${title} — open details`}
      className={`${CARD} group text-left p-4 hover:border-brand-200 hover:shadow-[0_2px_6px_rgb(15_15_20_/_0.06)] transition-all cursor-pointer`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-ink-500 shrink-0 group-hover:text-brand-600 transition-colors" strokeWidth={1.75} />
        <h3 className="text-[0.75rem] font-semibold text-ink-900 truncate flex-1">{title}</h3>
        <span className="inline-flex items-center gap-0.5 text-[0.6875rem] font-medium text-ink-400 group-hover:text-brand-700 transition-colors shrink-0">
          Details
          <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.slice(0, 3).map(s => (
          <div key={s.label} className="min-w-0">
            <div className={`text-[1.0625rem] font-bold tabular-nums leading-none ${s.tone === 'good' ? 'text-compliant-700' : s.tone === 'bad' ? 'text-risk-700' : 'text-ink-900'}`}>{s.value}</div>
            <div className="text-[0.625rem] text-ink-500 mt-1 leading-snug line-clamp-2">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-canvas-border/50 text-[0.625rem] text-ink-400 truncate">{hint}</div>
    </button>
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
  const concierge = useMemo(() => deriveConciergePortfolio(days, rows), [days, rows]);
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

  const sections: { key: SectionKey; icon: LucideIcon; title: string; subtitle: string; stats: SectionStat[]; portfolio?: SectionPortfolio }[] = [
    { key: 'engagements', icon: ClipboardCheck, title: 'Engagements', subtitle: 'The whole book of work — controls, testing and findings across every engagement', stats: engStats },
    { key: 'planning', icon: Calendar, title: 'Audit Planning', subtitle: 'The plan — what is scheduled, what is running, and who is carrying it', stats: planning.stats, portfolio: planning },
    { key: 'exceptions', icon: Inbox, title: 'Exceptions', subtitle: 'The triage queue — what workflows flagged and whether anyone is working it', stats: exceptions.stats, portfolio: exceptions },
    { key: 'process-hub', icon: Layers, title: 'Process Hub', subtitle: 'The process map — SOPs, RACMs and coverage per business process', stats: processHub.stats, portfolio: processHub },
    { key: 'ask-ira', icon: Sparkles, title: 'Ask IRA', subtitle: 'The chat — questions asked and conversations held', stats: askIra.stats, portfolio: askIra },
    { key: 'concierge', icon: Wand2, title: 'AI Concierge', subtitle: 'The toolkit — which tools exist and how often they run', stats: concierge.stats, portfolio: concierge },
    { key: 'reports', icon: FileBarChart, title: 'Reports', subtitle: 'The report book — generated, shared and Action Taken Reports', stats: reports.stats, portfolio: reports },
    { key: 'workflows', icon: Workflow, title: 'Workflows', subtitle: 'The automation library and how much it runs', stats: workflows.stats, portfolio: workflows },
    { key: 'risk-controls', icon: ShieldCheck, title: 'Risk & Controls', subtitle: 'The control environment — risks, controls, RACMs and coverage', stats: riskControls.stats, portfolio: riskControls },
    { key: 'knowledge', icon: Database, title: 'Knowledge Hub', subtitle: 'What data the platform can reach', stats: knowledge.stats, portfolio: knowledge },
    { key: 'dashboards', icon: LayoutDashboard, title: 'Dashboards', subtitle: 'What the team watches', stats: dashboards.stats, portfolio: dashboards },
    { key: 'admin', icon: ShieldUser, title: 'Admin & access', subtitle: 'Workspaces, teams, roles — and who can change what', stats: admin.stats, portfolio: admin },
  ];

  const active = sections.find(s => s.key === open) ?? null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Section deep-dives</div>
        <div className="text-[0.625rem] text-ink-400">Click a section for the full picture</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sections.map(s => (
          <SectionTile key={s.key} icon={s.icon} title={s.title} hint={s.subtitle} stats={s.stats} onOpen={() => setOpen(s.key)} />
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
            {active.key === 'engagements'
              ? <UsageEngagementsSection />
              : active.portfolio && <SectionDetail portfolio={active.portfolio} />}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
