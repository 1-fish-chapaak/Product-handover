/**
 * Platform Usage — Engagements section.
 *
 * The whole book of engagement work as charts + breakdowns (not a log): the
 * portfolio at a glance (counts, controls in scope vs effective, open
 * findings), a by-type breakdown, a status donut, and a per-engagement
 * breakdown table showing controls tested and findings. Read-only stats —
 * no actions, no navigation.
 */

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ClipboardCheck, ShieldCheck, AlertTriangle, GitBranch } from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  deriveEngagementPortfolio, deriveFindingsTrend, ENG_TYPE_COLOR, ENG_STATUS_COLOR,
  type EngRow,
} from '../../data/engagement-portfolio';
import type { EngType } from '../../data/engagements';
import { fmt, SectionCard, PortfolioStat } from './usageSectionPrimitives';

const TYPE_CHIP: Record<EngType, string> = {
  'SOX / ICFR': 'bg-brand-50 text-brand-700 border-brand-100',
  'Internal Audit': 'bg-evidence-50 text-evidence-700 border-evidence-100',
  'Compliance': 'bg-compliant-50 text-compliant-700 border-compliant-100',
  'Automation': 'bg-high-50 text-high-700 border-high-100',
};

export default function UsageEngagementsSection({ rangeDays = 30 }: {
  rangeDays?: number;
}) {
  const prefersReduced = useReducedMotion();
  const p = useMemo(() => deriveEngagementPortfolio(), []);
  const typeMax = Math.max(1, ...p.byType.map(t => t.controls));
  const controlsMax = Math.max(1, ...p.rows.map(r => r.controls));
  const processMax = Math.max(1, ...p.byProcess.map(pr => pr.controls));

  const statusData = p.byStatus.map(s => ({ name: s.status, value: s.count, color: ENG_STATUS_COLOR[s.status] }));
  const findingsTrend = useMemo(() => deriveFindingsTrend(rangeDays, p.openFindings), [rangeDays, p.openFindings]);
  const trendTick = rangeDays <= 7 ? 0 : 1;

  // Engagements ranked for the breakdown — in-flight first (most controls), then the rest.
  const rankedRows: EngRow[] = useMemo(() => {
    const rank = (r: EngRow) => (['Active', 'In Progress', 'Review'].includes(r.status) ? 0 : 1);
    return [...p.rows].sort((a, b) => rank(a) - rank(b) || b.controls - a.controls);
  }, [p.rows]);

  return (
    <div className="space-y-3">
      {/* Portfolio strip */}
      <SectionCard
        icon={ClipboardCheck}
        title="Portfolio"
        subtitle="Counts, controls and findings at a glance"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <PortfolioStat label="Engagements" value={fmt(p.total)} sub={`${p.inFlight} in-flight · ${p.planned} planned`} />
          <PortfolioStat label="Controls in scope" value={fmt(p.controlsInScope)} sub="across all engagements" />
          <PortfolioStat label="Controls effective" value={fmt(p.controlsEffective)} sub={`${p.effectivePct}% of scope`} tone="good" />
          <PortfolioStat label="Open findings" value={fmt(p.openFindings)} sub={`${p.needsAttention} engagements`} tone={p.openFindings > 0 ? 'bad' : 'good'} />
          <PortfolioStat label="Avg health" value={`${p.avgHealth}%`} sub="in-flight engagements" tone={p.avgHealth >= 75 ? 'good' : p.avgHealth > 0 ? 'neutral' : 'neutral'} />
          <PortfolioStat label="Need attention" value={fmt(p.needsAttention)} sub="have open findings" tone={p.needsAttention > 0 ? 'bad' : 'good'} />
        </div>

        {/* By type + by status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* By type — controls with effective overlay, per engagement type */}
          <div className="lg:col-span-2">
            <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">By type</div>
            <div className="space-y-3">
              {p.byType.map((t, i) => (
                <div key={t.type}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-700">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ENG_TYPE_COLOR[t.type] }} />
                      {t.type}
                      <span className="text-ink-400">· {t.count} engagement{t.count === 1 ? '' : 's'}</span>
                    </span>
                    <span className="text-[0.6875rem] text-ink-500 tabular-nums shrink-0">
                      <span className="font-semibold text-ink-800">{fmt(t.effective)}</span>/{fmt(t.controls)} effective
                      {t.findings > 0 && <span className="text-risk-600 ml-2">{t.findings} findings</span>}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-canvas overflow-hidden relative" style={{ width: `${Math.max(8, (t.controls / typeMax) * 100)}%` }}>
                    <div className="absolute inset-0 rounded-full opacity-25" style={{ background: ENG_TYPE_COLOR[t.type] }} />
                    <motion.div
                      className="h-full rounded-full relative"
                      style={{ background: ENG_TYPE_COLOR[t.type] }}
                      initial={prefersReduced ? false : { width: 0 }}
                      animate={{ width: `${t.controls > 0 ? (t.effective / t.controls) * 100 : 0}%` }}
                      transition={{ duration: prefersReduced ? 0 : 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.625rem] text-ink-400">Bar length = controls in scope · filled = controls effective.</p>
          </div>

          {/* By status donut */}
          <div>
            <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">By status</div>
            <div className="flex items-center gap-4">
              <div className="w-[112px] h-[112px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={32} outerRadius={54} paddingAngle={2} strokeWidth={0}>
                      {statusData.map(s => <Cell key={s.name} fill={s.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 min-w-0">
                {statusData.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-[0.6875rem]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-ink-600 truncate">{s.name}</span>
                    <span className="ml-auto font-semibold text-ink-800 tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Findings over time + by process */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <SectionCard
          icon={AlertTriangle}
          title="Findings over time"
          subtitle={`Raised vs resolved · last ${rangeDays} days`}
          className="lg:col-span-2"
          right={
            <div className="flex items-center gap-3 text-[0.6875rem] text-ink-500 shrink-0">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#B42318' }} />Raised</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#15803D' }} />Resolved</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t-2 border-dashed" style={{ borderColor: '#6A12CD' }} />Open</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={findingsTrend} margin={{ top: 4, right: 6, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="engFindingsRaised" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B42318" stopOpacity={0.20} />
                  <stop offset="100%" stopColor="#B42318" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF1" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B5D82' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} interval={trendTick} />
              <YAxis tick={{ fontSize: 10, fill: '#6B5D82' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Area type="monotone" dataKey="raised" name="Raised" stroke="#B42318" strokeWidth={2} fill="url(#engFindingsRaised)" />
              <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#15803D" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="open" name="Open" stroke="#6A12CD" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[0.625rem] text-ink-400"><span className="font-semibold text-ink-600">{fmt(p.openFindings)}</span> findings open now across {fmt(p.needsAttention)} engagements.</p>
        </SectionCard>

        <SectionCard icon={GitBranch} title="By process" subtitle="Controls in scope">
          <div className="space-y-3">
            {p.byProcess.map((pr, i) => (
              <div key={pr.process}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.75rem] font-medium text-ink-700">{pr.process}</span>
                  <span className="text-[0.6875rem] text-ink-500 tabular-nums"><span className="font-semibold text-ink-800">{fmt(pr.controls)}</span> · {pr.count} eng{pr.count === 1 ? '' : 's'}</span>
                </div>
                <div className="h-2 rounded-full bg-canvas overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-brand-500"
                    initial={prefersReduced ? false : { width: 0 }}
                    animate={{ width: `${Math.max(4, (pr.controls / processMax) * 100)}%` }}
                    transition={{ duration: prefersReduced ? 0 : 0.5, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Per-engagement breakdown */}
      <SectionCard
        icon={ShieldCheck}
        title="Controls tested & findings by engagement"
        subtitle="In-flight work first"
      >
        <div className="space-y-1">
          {rankedRows.map((r, i) => {
            const testedPct = r.controls > 0 ? Math.round((r.effective / r.controls) * 100) : 0;
            return (
              <div
                key={r.id}
                className="w-full -mx-2 px-2 py-2 rounded-lg flex items-center gap-3"
              >
                {/* name + type */}
                <div className="min-w-0 w-[34%]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[0.8125rem] font-semibold text-ink-900 truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-flex items-center px-1.5 h-4 rounded border text-[0.5625rem] font-semibold ${TYPE_CHIP[r.type]}`}>{r.type}</span>
                    <span className="text-[0.625rem] text-ink-400 truncate">{r.code} · {r.status}</span>
                  </div>
                </div>

                {/* controls bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[0.625rem] text-ink-400">Controls</span>
                    <span className="text-[0.6875rem] text-ink-500 tabular-nums"><span className="font-semibold text-ink-800">{fmt(r.effective)}</span>/{fmt(r.controls)} effective · {testedPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-canvas overflow-hidden" style={{ width: `${Math.max(6, (r.controls / controlsMax) * 100)}%` }}>
                    <div className="h-full rounded-full" style={{ width: `${testedPct}%`, background: ENG_TYPE_COLOR[r.type] }} />
                  </div>
                </div>

                {/* findings */}
                <div className="w-[92px] text-right shrink-0">
                  {r.openIssues > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-risk-700">
                      <AlertTriangle size={11} />{r.openIssues} finding{r.openIssues === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span className="text-[0.6875rem] text-ink-300">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
