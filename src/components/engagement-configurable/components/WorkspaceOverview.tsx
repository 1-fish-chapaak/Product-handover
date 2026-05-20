import React, { useState, useMemo } from 'react';
import {
  CheckCircle2, AlertCircle, MinusCircle, Activity,
  AlertTriangle, Shield, Workflow, ChevronRight, ChevronDown,
  Clock, Play, Sparkles, Send, RefreshCw, TrendingUp, TrendingDown,
  FileText, BarChart3, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../configurableEngagementTypes';
import { EngagementPatternType } from '../configurableEngagementTypes';
import { getEngagementPatternDefinition } from '../engagementPatterns';
import type { AutomationProjectWorkspaceState } from '../patterns/automation/automationInputData';
import type { AutomationScheduleState } from '../patterns/automation/automationScheduleData';
import { calculateNextRun } from '../patterns/automation/automationScheduleData';

interface Props {
  engagement: ConfigurableEngagement;
  automationState?: AutomationProjectWorkspaceState;
  onNavigateTab?: (tabId: string) => void;
}

// ─── Standard Overview (Compliance, IA, non-dashboard Automation) ─────────

interface CheckItem { label: string; status: 'ready' | 'missing' | 'optional' }

function getReadinessChecks(eng: ConfigurableEngagement): CheckItem[] {
  const cfg = eng.config;
  const checks: CheckItem[] = [];
  if (cfg.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    checks.push({ label: 'Framework selected', status: cfg.framework ? 'ready' : 'missing' });
    checks.push({ label: 'Control scope source selected', status: cfg.controlScopeSource ? 'ready' : 'missing' });
    checks.push({ label: 'RACM linked', status: cfg.racmVersionId ? 'ready' : cfg.controlScopeSource === 'RACM_VERSION' ? 'missing' : 'optional' });
    checks.push({ label: 'Testing input method selected', status: cfg.defaultTestingInputMethod ? 'ready' : 'missing' });
    checks.push({ label: 'Reviewer assigned', status: eng.reviewer ? 'ready' : 'missing' });
    checks.push({ label: 'Audit period configured', status: cfg.auditPeriodStart && cfg.auditPeriodEnd ? 'ready' : 'missing' });
    checks.push({ label: 'Working paper required', status: 'ready' });
  }
  if (cfg.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
    checks.push({ label: 'Scope level selected', status: cfg.scopeLevel ? 'ready' : 'missing' });
    checks.push({ label: 'Process owner assigned', status: cfg.processOwner ? 'ready' : 'missing' });
    checks.push({ label: 'Announcement configured', status: cfg.announcementRequired ? 'ready' : 'optional' });
    checks.push({ label: 'IDR enabled', status: cfg.idrEnabled ? 'ready' : 'optional' });
    checks.push({ label: 'Audit period configured', status: cfg.auditPeriodStart && cfg.auditPeriodEnd ? 'ready' : 'missing' });
    checks.push({ label: 'Final report required', status: cfg.finalReportRequired ? 'ready' : 'missing' });
    checks.push({ label: 'Action tracking enabled', status: cfg.actionTrackingEnabled ? 'ready' : 'optional' });
  }
  if (cfg.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT) {
    checks.push({ label: 'Input type selected', status: cfg.inputType ? 'ready' : 'missing' });
    checks.push({ label: 'Automation setup mode selected', status: cfg.automationSetupMode ? 'ready' : 'missing' });
    checks.push({ label: 'Output report required', status: cfg.reportRequired ? 'ready' : 'missing' });
    checks.push({ label: 'Case creation enabled', status: cfg.caseCreationEnabled ? 'ready' : 'optional' });
    checks.push({ label: 'Review required', status: cfg.reviewRequired ? 'ready' : 'optional' });
    if (cfg.runType === 'RECURRING') checks.push({ label: 'Schedule configured', status: cfg.frequency ? 'ready' : 'missing' });
  }
  return checks;
}

function getConfigSummary(eng: ConfigurableEngagement): { label: string; value: string }[] {
  const cfg = eng.config;
  const entries: { label: string; value: string }[] = [];
  if (cfg.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    entries.push({ label: 'Framework', value: cfg.framework.replace(/_/g, ' ') }, { label: 'Audit Type', value: cfg.auditType }, { label: 'Control Scope', value: cfg.controlScopeSource.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }, { label: 'Testing Method', value: cfg.defaultTestingInputMethod.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) });
  }
  if (cfg.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
    entries.push({ label: 'Scope Level', value: cfg.scopeLevel.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }, { label: 'Process Owner', value: cfg.processOwner }, { label: 'IDR', value: cfg.idrEnabled ? 'Enabled' : 'Disabled' }, { label: 'Announcement', value: cfg.announcementRequired ? 'Required' : 'Not required' });
  }
  if (cfg.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT) {
    entries.push({ label: 'Input Type', value: cfg.inputType.replace(/_/g, ' ') }, { label: 'Setup Mode', value: cfg.automationSetupMode.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }, { label: 'Run Type', value: cfg.runType.replace(/_/g, ' ') });
    if (cfg.frequency) entries.push({ label: 'Frequency', value: cfg.frequency });
  }
  return entries;
}

const STATUS_ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  ready: { icon: CheckCircle2, cls: 'text-emerald-500' },
  missing: { icon: AlertCircle, cls: 'text-red-400' },
  optional: { icon: MinusCircle, cls: 'text-gray-300' },
};

function StandardOverview({ engagement }: { engagement: ConfigurableEngagement }) {
  const pattern = getEngagementPatternDefinition(engagement.patternType);
  const checks = getReadinessChecks(engagement);
  const configSummary = getConfigSummary(engagement);
  const readyCount = checks.filter(c => c.status === 'ready').length;
  const missingCount = checks.filter(c => c.status === 'missing').length;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-light p-4">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Objective</h5>
        <p className="text-[12px] text-text leading-relaxed">{engagement.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border-light p-4">
          <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Configuration</h5>
          <div className="space-y-1.5">{configSummary.map((e, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[11px]"><span className="text-gray-400 w-28 shrink-0">{e.label}</span><span className="text-text font-medium">{e.value}</span></div>
          ))}</div>
        </div>
        <div className="rounded-lg border border-border-light p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Readiness</h5>
            <span className={`text-[10px] font-semibold ${missingCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{readyCount}/{checks.length} ready</span>
          </div>
          <div className="space-y-1">{checks.map((c, i) => {
            const { icon: Icon, cls } = STATUS_ICON[c.status];
            return (<div key={i} className="flex items-center gap-2 text-[10px]"><Icon size={11} className={cls} /><span className={c.status === 'missing' ? 'text-text' : 'text-gray-500'}>{c.label}</span>{c.status === 'optional' && <span className="text-[8px] text-gray-300 ml-auto">Optional</span>}</div>);
          })}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border-light p-4">
          <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Workspace Flow</h5>
          <div className="flex flex-wrap gap-1.5">{pattern.workspaceTabs.map((tab, i) => (
            <span key={tab.id} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-semibold"><span className="text-[8px] text-primary/50">{i + 1}</span>{tab.label}</span>
          ))}</div>
        </div>
        <div className="rounded-lg border border-border-light p-4">
          <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Required Outputs</h5>
          <div className="space-y-1">{pattern.requiredOutputs.map(o => (
            <div key={o} className="flex items-center gap-2 text-[10px] text-text"><CheckCircle2 size={10} className="text-gray-300" />{o}</div>
          ))}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Continuous Monitoring Dashboard ──────────────────────────────────────

const CHART_COLORS = ['var(--color-compliant)', 'var(--color-evidence)', 'var(--color-high)', 'var(--color-risk)', 'var(--color-mitigated)', 'var(--color-brand-500)'];
const PIE_COLORS = ['var(--color-compliant)', 'var(--color-high)', 'var(--color-risk)', 'var(--color-mitigated)', 'var(--color-evidence)'];

function ContinuousMonitoringDashboard({ engagement, state, onNavigateTab }: {
  engagement: ConfigurableEngagement; state: AutomationProjectWorkspaceState; onNavigateTab?: (tabId: string) => void;
}) {
  const cfg = engagement.config as AutomationProjectConfig;
  const { runs, schedule, cases, outputReview } = state;
  const completedRuns = runs.runs.filter(r => r.status === 'COMPLETED');
  const failedRuns = runs.runs.filter(r => r.status === 'FAILED');
  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const highCritical = allExceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;
  const openEx = allExceptions.filter(e => e.status === 'OPEN').length;
  const caseCands = allExceptions.filter(e => e.status === 'CASE_CANDIDATE').length;
  const lastRun = runs.runs.length > 0 ? runs.runs[runs.runs.length - 1] : null;
  const wfNames = state.setup.selectedWorkflowNames?.length ? state.setup.selectedWorkflowNames : (state.setup.selectedWorkflowName ? [state.setup.selectedWorkflowName] : []);
  const hasWorkflows = wfNames.length > 0;
  const hasRuns = completedRuns.length > 0;
  const scheduleActive = schedule.status === 'ACTIVE';
  const nextRun = scheduleActive && schedule.startDate ? calculateNextRun(schedule.startDate, schedule.frequency, schedule.runTime) : null;

  // ── Setup prompts ──
  if (!hasWorkflows) {
    return (
      <div className="space-y-5">
        <DashboardHeader engagement={engagement} schedule={schedule} />
        <SetupPrompt icon={Workflow} title="Select workflows to start continuous monitoring" description="Choose or build workflows that will be monitored on a recurring schedule." cta="Go to Workflows" onAction={() => onNavigateTab?.('workflows')} />
      </div>
    );
  }
  if (!hasRuns) {
    return (
      <div className="space-y-5">
        <DashboardHeader engagement={engagement} schedule={schedule} />
        <MonitoringStatusBar schedule={schedule} lastRun={null} nextRun={null} wfCount={wfNames.length} />
        <SetupPrompt icon={Play} title="Run workflows to initialize monitoring baseline" description={`${wfNames.length} workflow${wfNames.length !== 1 ? 's' : ''} selected. Run them once to establish the baseline for continuous monitoring.`} cta="Go to Workflows" onAction={() => onNavigateTab?.('workflows')} />
      </div>
    );
  }

  // Derived chart data
  const exByWorkflow = useMemo(() => {
    const map = new Map<string, number>();
    for (const ex of allExceptions) { const n = ex.sourceWorkflowName || 'Other'; map.set(n, (map.get(n) || 0) + 1); }
    return Array.from(map.entries()).map(([name, count]) => ({ name: name.split(' ').slice(0, 2).join(' '), value: count }));
  }, [allExceptions]);

  const exStatusBreakdown = useMemo(() => [
    { name: 'Open', value: openEx, color: 'var(--color-high)' },
    { name: 'Reviewed', value: allExceptions.filter(e => e.status === 'REVIEWED').length, color: 'var(--color-evidence)' },
    { name: 'Case Cand.', value: caseCands, color: 'var(--color-brand-500)' },
    { name: 'Dismissed', value: allExceptions.filter(e => e.status === 'DISMISSED').length, color: 'var(--color-mitigated)' },
  ].filter(s => s.value > 0), [allExceptions, openEx, caseCands]);

  const runTrend = useMemo(() =>
    completedRuns.map((r, i) => ({
      run: `Run ${i + 1}`,
      exceptions: r.exceptionCount,
      outputs: r.outputCount,
    }))
  , [completedRuns]);

  const outputApproval = useMemo(() => [
    { name: 'Approved', value: outputReview.approvedOutputIds.length, color: 'var(--color-compliant)' },
    { name: 'Excluded', value: outputReview.rejectedOutputIds.length, color: 'var(--color-risk)' },
    { name: 'Pending', value: allOutputs.length - outputReview.approvedOutputIds.length - outputReview.rejectedOutputIds.length, color: 'var(--color-mitigated)' },
  ].filter(s => s.value > 0), [allOutputs, outputReview]);

  return (
    <div className="space-y-5">
      <DashboardHeader engagement={engagement} schedule={schedule} />

      {/* Alerts bar */}
      <AlertsDigestBar state={state} allExceptions={allExceptions} schedule={schedule} onNavigateTab={onNavigateTab} />

      {/* Schedule warning */}
      {!scheduleActive && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-high-50/50 border border-high/30 text-[11px] text-high-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Schedule not active.</span> Dashboard is based on completed runs. Activate schedule for continuous monitoring.
            <button onClick={() => onNavigateTab?.('schedule')} className="ml-2 text-primary font-semibold hover:underline cursor-pointer">Configure Schedule</button>
          </div>
        </div>
      )}

      {/* KPI cards — platform style */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Runs', value: completedRuns.length.toString(), trend: completedRuns.length > 0 ? 'up' as const : undefined, change: '', color: 'text-evidence-700 bg-evidence-50' },
          { title: 'Open Exceptions', value: openEx.toString(), trend: openEx > 0 ? 'up' as const : 'down' as const, change: highCritical > 0 ? `${highCritical} high/critical` : 'None critical', color: openEx > 0 ? 'text-high-700 bg-high-50' : 'text-compliant bg-compliant-50' },
          { title: 'Case Candidates', value: caseCands.toString(), trend: caseCands > 0 ? 'up' as const : undefined, change: `${cases.cases.length} assigned`, color: caseCands > 0 ? 'text-brand-700 bg-brand-50' : 'text-compliant bg-compliant-50' },
          { title: 'Monitoring Health', value: failedRuns.length === 0 && openEx === 0 ? 'Healthy' : openEx > 3 ? 'At Risk' : 'Needs Review', trend: failedRuns.length === 0 && openEx === 0 ? 'up' as const : 'down' as const, change: scheduleActive ? `Next: ${nextRun || '—'}` : 'No schedule', color: failedRuns.length === 0 && openEx === 0 ? 'text-compliant bg-compliant-50' : 'text-high-700 bg-high-50' },
        ].map((kpi, i) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.05 }}
            className="glass-card rounded-xl px-5 py-4 hover:border-brand-200 hover:shadow-md transition-all">
            <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-2">{kpi.title}</p>
            <p className="text-[26px] font-bold text-ink-900 leading-none">{kpi.value}</p>
            {kpi.change && (
              <p className={`text-[10px] font-semibold mt-2 flex items-center gap-1 ${kpi.trend === 'up' && kpi.title !== 'Open Exceptions' && kpi.title !== 'Case Candidates' ? 'text-compliant' : kpi.trend === 'down' && (kpi.title === 'Open Exceptions') ? 'text-compliant' : 'text-ink-400'}`}>
                {kpi.change}
              </p>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Charts — platform style 2×2 grid */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Exception trend */}
        <WidgetCard title="Exception Trend" subtitle="Exceptions per run">
          {runTrend.length === 0 ? <EmptyChartState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={runTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="exGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-high)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-high)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-canvas-border)" />
                <XAxis dataKey="run" tick={{ fontSize: 11, fill: 'var(--color-ink-400)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-400)' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-canvas-border)' }} />
                <Area type="monotone" dataKey="exceptions" stroke="var(--color-high)" fill="url(#exGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </WidgetCard>

        {/* Workflow exception distribution */}
        <WidgetCard title="Exceptions by Workflow" subtitle="Distribution across workflows">
          {exByWorkflow.length === 0 ? <EmptyChartState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={exByWorkflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-canvas-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-ink-400)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-400)' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-canvas-border)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {exByWorkflow.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </WidgetCard>

        {/* Exception status breakdown */}
        <WidgetCard title="Exception Status" subtitle="Classification breakdown">
          {exStatusBreakdown.length === 0 ? <EmptyChartState label="No exceptions" /> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={exStatusBreakdown} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                    {exStatusBreakdown.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {exStatusBreakdown.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-[12px]">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-ink-500">{s.name}</span>
                    <span className="font-bold text-ink-900 ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </WidgetCard>

        {/* Output approval */}
        <WidgetCard title="Output Approval" subtitle="Report readiness">
          {outputApproval.length === 0 ? <EmptyChartState label="No outputs" /> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={outputApproval} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                    {outputApproval.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {outputApproval.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-[12px]">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-ink-500">{s.name}</span>
                    <span className="font-bold text-ink-900 ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </WidgetCard>
      </motion.div>

      {/* Workflow health table */}
      <WorkflowHealthTable state={state} completedRuns={completedRuns} onNavigateTab={onNavigateTab} />

      {/* Quick actions */}
      <QuickActions onNavigateTab={onNavigateTab} />
    </div>
  );
}

// ─── Dashboard sub-components (platform style) ──────────────────────────

function DashboardHeader({ engagement, schedule }: { engagement: ConfigurableEngagement; schedule: AutomationScheduleState }) {
  const statusLabel = schedule.status === 'ACTIVE' ? 'Active' : schedule.status === 'PAUSED' ? 'Paused' : 'Not Scheduled';
  const statusCls = schedule.status === 'ACTIVE' ? 'bg-compliant-50 text-compliant' : schedule.status === 'PAUSED' ? 'bg-high-50 text-high-700' : 'bg-canvas-elevated text-ink-400';
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-medium"><Activity size={18} className="text-white" /></div>
          <div>
            <h3 className="text-[16px] font-bold text-ink-900 tracking-tight">Continuous Monitoring Dashboard</h3>
            <p className="text-[12px] text-ink-400">Monitor recurring workflow runs, exceptions, cases, and report readiness.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${statusCls}`}>{statusLabel}</span>
          {schedule.frequency && <span className="text-[11px] text-ink-400 font-medium">{schedule.frequency}</span>}
        </div>
      </div>
      <p className="text-[10px] text-ink-300 mt-2">Dashboard appears because Dashboard output is selected and this project is configured for recurring monitoring.</p>
    </div>
  );
}

function MonitoringStatusBar({ schedule, lastRun, nextRun, wfCount }: { schedule: AutomationScheduleState; lastRun: any; nextRun: string | null; wfCount: number }) {
  return (
    <div className="glass-card rounded-xl p-4 grid grid-cols-4 gap-4 text-[11px]">
      <div><span className="text-ink-400 block text-[10px]">Last Run</span><span className="text-ink-900 font-medium">{lastRun?.completedAt || '—'}</span></div>
      <div><span className="text-ink-400 block text-[10px]">Next Run</span><span className="text-ink-900 font-medium">{nextRun || '—'}</span></div>
      <div><span className="text-ink-400 block text-[10px]">Frequency</span><span className="text-ink-900 font-medium">{schedule.frequency || '—'}</span></div>
      <div><span className="text-ink-400 block text-[10px]">Workflows</span><span className="text-ink-900 font-medium">{wfCount}</span></div>
    </div>
  );
}

function AlertsDigestBar({ state, allExceptions, schedule, onNavigateTab }: {
  state: AutomationProjectWorkspaceState; allExceptions: any[]; schedule: AutomationScheduleState; onNavigateTab?: (tabId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const openEx = allExceptions.filter((e: any) => e.status === 'OPEN').length;
  const highCrit = allExceptions.filter((e: any) => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;
  const lastRun = state.runs.runs.length > 0 ? state.runs.runs[state.runs.runs.length - 1] : null;
  const completedRuns = state.runs.runs.filter((r: any) => r.status === 'COMPLETED');

  const alerts: { type: 'alert' | 'change' | 'improvement'; text: string }[] = [];
  if (highCrit > 0) alerts.push({ type: 'alert', text: `${highCrit} high/critical exception${highCrit !== 1 ? 's' : ''} require review.` });
  if (openEx > 0 && openEx !== highCrit) alerts.push({ type: 'alert', text: `${openEx} open exception${openEx !== 1 ? 's' : ''} pending action.` });
  if (schedule.status !== 'ACTIVE') alerts.push({ type: 'change', text: 'Schedule is not active. Activate for continuous monitoring.' });
  if (lastRun?.status === 'COMPLETED' && lastRun.exceptionCount === 0) alerts.push({ type: 'improvement', text: 'Latest run completed with no exceptions.' });
  if (completedRuns.length > 0 && completedRuns.every((r: any) => r.status === 'COMPLETED')) alerts.push({ type: 'improvement', text: `All ${completedRuns.length} monitored run${completedRuns.length !== 1 ? 's' : ''} completed successfully.` });
  if (state.outputReview.approvedOutputIds.length > 0) alerts.push({ type: 'improvement', text: `${state.outputReview.approvedOutputIds.length} output${state.outputReview.approvedOutputIds.length !== 1 ? 's' : ''} approved for report.` });

  const typeIcons = { change: RefreshCw, alert: AlertTriangle, improvement: TrendingUp };
  const typeColors = { change: 'text-evidence-700 bg-evidence-50', alert: 'text-high-700 bg-high-50', improvement: 'text-compliant bg-compliant-50' };
  const alertCount = alerts.filter(a => a.type === 'alert').length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-light/50">
        <button onClick={() => setExpanded(p => !p)} className="flex items-center gap-2 cursor-pointer">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-medium"><Sparkles size={13} className="text-white" /></div>
          <span className="text-[13px] font-semibold text-text">Alerts & Daily Digest</span>
          {alertCount > 0 && <span className="text-[12px] bg-risk-50 text-risk-700 px-2 py-0.5 rounded-full font-bold">{alertCount} alert{alertCount > 1 ? 's' : ''}</span>}
          <span className="text-[12px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">AI Summary</span>
          <ChevronDown size={14} className={`text-text-muted transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer">
          <Send size={11} /> Share with Team
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 py-4 space-y-2">
              {alerts.map((item, i) => {
                const Icon = typeIcons[item.type];
                const color = typeColors[item.type];
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors ${item.type === 'alert' ? 'bg-high-50/50 border border-high/50' : 'hover:bg-surface-2'}`}>
                    <div className={`p-1.5 rounded-lg shrink-0 ${color}`}><Icon size={12} /></div>
                    <span className="text-[12px] text-ink-700">{item.text}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function WidgetCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border-light/50 flex items-center justify-between">
        <div><h4 className="text-[13px] font-semibold text-ink-900">{title}</h4><p className="text-[11px] text-ink-400">{subtitle}</p></div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function EmptyChartState({ label = 'No data yet' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart3 size={24} className="text-ink-300 mb-2" />
      <p className="text-[12px] text-ink-400">{label}</p>
    </div>
  );
}

function WorkflowHealthTable({ state, completedRuns, onNavigateTab }: {
  state: AutomationProjectWorkspaceState; completedRuns: any[]; onNavigateTab?: (tabId: string) => void;
}) {
  const wfMap = new Map<string, { name: string; lastStatus: string; outputs: number; exceptions: number; caseCands: number; approved: number; lastRun: string | null }>();
  for (const run of completedRuns) {
    const names = run.workflowNames?.length ? run.workflowNames : (run.workflowName ? [run.workflowName] : []);
    for (const name of names) {
      const outs = run.outputs.filter((o: any) => o.sourceWorkflowName === name);
      const excs = run.exceptions.filter((e: any) => e.sourceWorkflowName === name);
      const existing = wfMap.get(name);
      const approvedCount = outs.filter((o: any) => state.outputReview.approvedOutputIds.includes(o.id)).length;
      if (!existing) {
        wfMap.set(name, { name, lastStatus: run.status, outputs: outs.length, exceptions: excs.length, caseCands: excs.filter((e: any) => e.status === 'CASE_CANDIDATE').length, approved: approvedCount, lastRun: run.completedAt });
      } else {
        existing.outputs += outs.length;
        existing.exceptions += excs.length;
        existing.caseCands += excs.filter((e: any) => e.status === 'CASE_CANDIDATE').length;
        existing.approved += approvedCount;
        if (run.completedAt && (!existing.lastRun || run.completedAt > existing.lastRun)) { existing.lastRun = run.completedAt; existing.lastStatus = run.status; }
      }
    }
  }
  const workflows = Array.from(wfMap.values());
  if (workflows.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border-light/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow size={14} className="text-primary" />
          <h4 className="text-[13px] font-semibold text-ink-900">Workflow Health</h4>
        </div>
        <button onClick={() => onNavigateTab?.('workflows')} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer">View All</button>
      </div>
      <table className="w-full text-[12px]">
        <thead><tr className="border-b border-border-light bg-canvas-elevated/50 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
          <th className="px-5 py-2.5 text-left">Workflow</th>
          <th className="px-4 py-2.5 text-center">Status</th>
          <th className="px-4 py-2.5 text-center">Outputs</th>
          <th className="px-4 py-2.5 text-center">Approved</th>
          <th className="px-4 py-2.5 text-center">Exceptions</th>
          <th className="px-4 py-2.5 text-center">Case Cand.</th>
          <th className="px-4 py-2.5 text-left">Last Run</th>
          <th className="px-4 py-2.5 text-right">Action</th>
        </tr></thead>
        <tbody>{workflows.map(wf => (
          <tr key={wf.name} className="border-b border-border-light/60 hover:bg-primary/[0.015] transition-colors">
            <td className="px-5 py-3 font-medium text-ink-900">{wf.name}</td>
            <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${wf.lastStatus === 'COMPLETED' ? 'text-compliant-700 bg-compliant-50' : 'text-risk-700 bg-risk-50'}`}>{wf.lastStatus === 'COMPLETED' ? 'Healthy' : 'Failed'}</span></td>
            <td className="px-4 py-3 text-center tabular-nums text-ink-500">{wf.outputs}</td>
            <td className="px-4 py-3 text-center"><span className={`tabular-nums ${wf.approved > 0 ? 'text-compliant font-semibold' : 'text-ink-400'}`}>{wf.approved}</span></td>
            <td className="px-4 py-3 text-center"><span className={`tabular-nums ${wf.exceptions > 0 ? 'text-high-700 font-semibold' : 'text-ink-400'}`}>{wf.exceptions}</span></td>
            <td className="px-4 py-3 text-center"><span className={`tabular-nums ${wf.caseCands > 0 ? 'text-brand-700 font-semibold' : 'text-ink-400'}`}>{wf.caseCands}</span></td>
            <td className="px-4 py-3 text-ink-400">{wf.lastRun || '—'}</td>
            <td className="px-4 py-3 text-right"><button onClick={() => onNavigateTab?.('output-review')} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer">Review</button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function QuickActions({ onNavigateTab }: { onNavigateTab?: (tabId: string) => void }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h5 className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-3">Quick Actions</h5>
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Workflows', tabId: 'workflows', icon: Workflow },
          { label: 'Output Review', tabId: 'output-review', icon: CheckCircle2 },
          { label: 'Cases', tabId: 'cases', icon: Shield },
          { label: 'Reports', tabId: 'reports', icon: FileText },
          { label: 'Schedule', tabId: 'schedule', icon: Calendar },
        ].map(a => (
          <button key={a.tabId} onClick={() => onNavigateTab?.(a.tabId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-canvas-border text-[11px] font-medium text-ink-500 hover:bg-primary/5 hover:text-primary hover:border-brand-200 cursor-pointer transition-all">
            <a.icon size={12} />{a.label}<ChevronRight size={10} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SetupPrompt({ icon: Icon, title, description, cta, onAction }: {
  icon: React.ElementType; title: string; description: string; cta: string; onAction: () => void;
}) {
  return (
    <div className="glass-card rounded-2xl p-8 text-center space-y-3">
      <Icon size={32} className="text-ink-300 mx-auto" />
      <h4 className="text-[14px] font-semibold text-ink-900">{title}</h4>
      <p className="text-[12px] text-ink-400 max-w-md mx-auto">{description}</p>
      <button onClick={onAction} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-medium text-white text-[13px] font-semibold hover:from-primary-hover hover:to-primary transition-all cursor-pointer inline-flex items-center gap-1.5">
        {cta} <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────

export default function WorkspaceOverview({ engagement, automationState, onNavigateTab }: Props) {
  if (engagement.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT && automationState) {
    const cfg = engagement.config as AutomationProjectConfig;
    const hasDashboardOutput = cfg.outputTypes.includes('DASHBOARD');
    const isRecurring = cfg.runType === 'RECURRING';

    if (hasDashboardOutput && isRecurring) {
      return <ContinuousMonitoringDashboard engagement={engagement} state={automationState} onNavigateTab={onNavigateTab} />;
    }
    if (hasDashboardOutput && !isRecurring) {
      return (
        <div className="space-y-4">
          <StandardOverview engagement={engagement} />
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-evidence-50 border border-evidence-200 text-[11px] text-evidence-700">
            <Activity size={12} className="shrink-0 mt-0.5" />
            <span>Dashboard output is selected. Set run type to <strong>Recurring</strong> and configure a schedule to enable continuous monitoring.</span>
          </div>
        </div>
      );
    }
    if (isRecurring && !hasDashboardOutput) {
      return (
        <div className="space-y-4">
          <StandardOverview engagement={engagement} />
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-evidence-50 border border-evidence-200 text-[11px] text-evidence-700">
            <Activity size={12} className="shrink-0 mt-0.5" />
            <span>This project is configured for recurring runs. Add <strong>Dashboard</strong> as an output type to enable continuous monitoring view.</span>
          </div>
        </div>
      );
    }
  }
  return <StandardOverview engagement={engagement} />;
}
