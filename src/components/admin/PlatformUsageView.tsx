// ─── Platform Usage ──────────────────────────────────────────────────────────
// Org-wide usage snapshot: how much of the platform's surface area is
// actually being used. Read-only KPI dashboard. Pulls counts from the in-app
// seed data so the numbers match what the demo otherwise shows.

import { useMemo, type JSX } from 'react';
import { motion } from 'motion/react';
import {
  Workflow, MessageSquare, LayoutDashboard, FileText, Shield, TrendingUp,
  Sparkles, Database, Users, Activity, Calendar,
} from 'lucide-react';
import {
  RACMS, CONTROLS, WORKFLOWS, GENERATED_REPORTS, BUSINESS_PROCESSES,
} from '../../data/mockData';
import { QUERY_SESSIONS, FAVOURITES } from '../../data/queryHistory';
import { ENGAGEMENTS } from '../../data/engagements';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countQueries(): number {
  // Each QueryGroup item is a query — flatten history + favourites.
  let n = 0;
  for (const g of QUERY_SESSIONS) n += g.items.length;
  for (const g of FAVOURITES) n += g.items.length;
  return n;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlatformUsageView(): JSX.Element {
  const stats = useMemo(() => ({
    workflows:   WORKFLOWS.length,
    queries:     countQueries(),
    dashboards:  6,                       // built-in + shared dashboards exposed in App.tsx
    racms:       RACMS.length,
    controls:    CONTROLS.length,
    reports:     GENERATED_REPORTS.length,
    engagements: ENGAGEMENTS.length,
    processes:   BUSINESS_PROCESSES.length,
  }), []);

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="max-w-[1200px] mx-auto px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2 rounded-lg bg-brand-50 text-brand-700"><TrendingUp size={18} /></div>
            <h1 className="text-[1.25rem] font-bold text-text">Platform Usage</h1>
            <span className="text-[0.625rem] text-text-muted font-mono bg-canvas px-1.5 py-0.5 rounded">FY26 · to date</span>
          </div>
          <p className="text-[0.75rem] text-text-secondary ml-12">Aggregate signal on how much of the platform your org is using. Updated nightly.</p>
        </div>

        {/* Hero KPI grid — the five things the user asked for */}
        <section>
          <h2 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-3">Core usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <BigKpi icon={Workflow}        label="Workflows created"  value={stats.workflows}  tone="bg-brand-50 text-brand-700"            sub="across all processes" />
            <BigKpi icon={MessageSquare}   label="Queries done"       value={stats.queries}    tone="bg-evidence-50 text-evidence-700"      sub="from Ask IRA + history" />
            <BigKpi icon={LayoutDashboard} label="Dashboards"         value={stats.dashboards} tone="bg-compliant-50 text-compliant-700"    sub="org + shared + custom" />
            <BigKpi icon={FileText}        label="RACMs"              value={stats.racms}      tone="bg-mitigated-50 text-mitigated-700"    sub="risk-control matrices" />
            <BigKpi icon={Shield}          label="Controls configured" value={stats.controls}  tone="bg-risk-50 text-risk-700"              sub="with workflow coverage" />
          </div>
        </section>

        {/* Secondary breakdown — context the user might want next */}
        <section>
          <h2 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-3">Around the edges</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SmallKpi icon={Database}  label="Business processes" value={stats.processes} />
            <SmallKpi icon={Calendar}  label="Engagements"        value={stats.engagements} />
            <SmallKpi icon={FileText}  label="Reports generated"  value={stats.reports} />
            <SmallKpi icon={Users}     label="Active users"       value={12} />
          </div>
        </section>

        {/* Activity rhythm — gentle sparkline strip so the page feels alive */}
        <section>
          <h2 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-3">Activity over the last 8 weeks</h2>
          <div className="rounded-2xl border border-canvas-border bg-white p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <ActivityBar label="Workflow runs"  values={[4, 6, 9, 12, 8, 15, 11, 18]} accent="bg-brand-500" />
              <ActivityBar label="Queries"        values={[12, 16, 14, 22, 19, 26, 24, 31]} accent="bg-evidence-500" />
              <ActivityBar label="Dashboards opened" values={[8, 11, 9, 14, 12, 17, 15, 20]} accent="bg-compliant-500" />
              <ActivityBar label="Evidence uploaded" values={[3, 5, 7, 6, 8, 10, 9, 13]} accent="bg-mitigated-500" />
            </div>
          </div>
        </section>

        {/* Note */}
        <p className="text-[0.6875rem] text-text-muted">
          <Activity size={10} className="inline mr-1" />
          Numbers shown reflect seed data in this prototype. In production this view subscribes to the platform-events stream.
        </p>
      </div>
    </div>
  );
}

// ─── Tiles + bars ────────────────────────────────────────────────────────────

function BigKpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: number | string; sub: string; tone: string;
}): JSX.Element {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className="rounded-2xl border border-canvas-border bg-white px-5 py-5 flex flex-col gap-2">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon size={16} />
      </div>
      <div className="text-[1.75rem] font-bold text-text tabular-nums leading-none mt-1">{value}</div>
      <div className="text-[0.75rem] font-semibold text-text">{label}</div>
      <div className="text-[0.75rem] text-text-muted">{sub}</div>
    </motion.div>
  );
}

function SmallKpi({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: number | string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-canvas-border bg-white px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={11} className="text-text-muted" />
        <span className="text-[0.625rem] uppercase tracking-wider font-bold text-text-muted">{label}</span>
      </div>
      <div className="text-[1.125rem] font-bold text-text tabular-nums">{value}</div>
    </div>
  );
}

function ActivityBar({ label, values, accent }: { label: string; values: number[]; accent: string }): JSX.Element {
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const delta = values.length >= 2 ? values[values.length - 1]! - values[values.length - 2]! : 0;
  return (
    <div className="space-y-1.5">
      <div className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-[1.125rem] font-bold text-text tabular-nums leading-none">{total}</span>
        <span className={`text-[0.625rem] tabular-nums font-semibold ${delta >= 0 ? 'text-compliant-700' : 'text-risk-700'}`}>
          {delta >= 0 ? '+' : ''}{delta} wk/wk
        </span>
      </div>
      <div className="flex items-end gap-1 h-12 mt-2">
        {values.map((v, i) => (
          <div key={i} className={`flex-1 rounded-sm ${accent} opacity-${20 + Math.min(80, Math.round((v / max) * 80))}`}
            style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: 0.4 + (v / max) * 0.6 }} />
        ))}
      </div>
    </div>
  );
}
