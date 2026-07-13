/**
 * Section portfolios — cross-section aggregates for the Platform Usage page.
 *
 * Same idea as engagement-portfolio.ts, extended to every other platform
 * section: each derive* function folds that section's real records into stats,
 * composition breakdowns and ranked rows, so the usage page can show an
 * engagement-style read-only deep-dive per section. No actions here — these
 * are reporting shapes only, and every number traces to a stored record.
 */

import {
  RISKS, CONTROLS, RACMS, BUSINESS_PROCESSES, WORKFLOWS,
  GENERATED_REPORTS, SHARED_REPORTS, POWER_BI_DASHBOARDS, CHAT_HISTORY,
} from './mockData';
import { ATR_LIBRARY } from './atrLibrary';
import { getRole } from './rbac';
import { SEED as KH_SOURCES, type SourceType } from '../components/data-sources/sources';
import { aiToolRuns, aiQuestions, type UsageDay, type UserUsageRow } from './platform-usage';

/* ── Generic shapes every section renders ────────────────────────────────── */

export interface SectionStat {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad' | 'neutral';
}

export interface BarItem {
  label: string;
  /** Bar length relative to the group max. */
  value: number;
  /** Optional filled share of the bar (0-100); when set the bar renders
   *  two-layer like the engagement type bars (length = value, fill = pct). */
  fillPct?: number;
  note?: string;
  color: string;
}

export interface DonutItem {
  name: string;
  value: number;
  color: string;
}

export interface RankedRow {
  id: string;
  title: string;
  chip?: { label: string; className: string };
  sub?: string;
  bar?: { label: string; value: number; note: string; color: string; fillPct?: number };
  right?: { text: string; tone?: 'good' | 'bad' | 'muted' };
}

export interface SectionPortfolio {
  stats: SectionStat[];
  /** variant 'list' renders name + note lines without bar tracks — for
   *  catalogs where the items have no meaningful magnitude. */
  bars: { title: string; items: BarItem[]; note?: string; variant?: 'list' };
  donut: { title: string; items: DonutItem[] };
  rows: { title: string; subtitle: string; items: RankedRow[] };
}

const fmt = (n: number) => n.toLocaleString('en-US');

/* Shared palette — matches the tones already used across the usage page. */
const BRAND = '#6A12CD';
const GOOD = '#15803D';
const BAD = '#B42318';
const WARN = '#D97706';
const INFO = '#0284C7';
const MUTED = '#9CA3AF';

const CHIP_NEUTRAL = 'bg-canvas text-ink-600 border-canvas-border';
const CHIP_BRAND = 'bg-brand-50 text-brand-700 border-brand-100';
const CHIP_GOOD = 'bg-compliant-50 text-compliant-700 border-compliant-100';
const CHIP_WARN = 'bg-high-50 text-high-700 border-high-100';
const CHIP_INFO = 'bg-evidence-50 text-evidence-700 border-evidence-100';

/* ── Ask IRA — questions, tools and who leans on AI ──────────────────────── */

/**
 * Ask IRA & AI tools — from the audit log and the saved conversations.
 *
 * Questions, tool runs and per-member attribution all come from real audit
 * events (chat send → Create/Query; Concierge run → Run/<tool>). The seeded
 * history predates that instrumentation, so "who uses AI most" is empty until
 * someone actually uses AI in this session. The copy says so rather than
 * inventing a ranking.
 */
export function deriveAskIraPortfolio(days: UsageDay[], rows: UserUsageRow[]): SectionPortfolio {
  const conversations = days.reduce((s, d) => s + d.aiConversations, 0);
  const messages = days.reduce((s, d) => s + d.aiMessages, 0);
  const toolRuns = aiToolRuns(days);
  const questions = aiQuestions(days);
  const aiUsers = rows.filter(r => r.aiQueries > 0);
  const active = rows.filter(r => r.actions > 0);
  const adoption = active.length > 0 ? Math.round((aiUsers.length / active.length) * 100) : 0;
  const perChat = conversations > 0 ? Math.round(messages / conversations) : 0;

  // Every saved conversation, longest first — real titles, real message counts.
  const maxMsgs = Math.max(1, ...CHAT_HISTORY.map(c => c.messages));
  const barItems: BarItem[] = [...CHAT_HISTORY]
    .sort((a, b) => b.messages - a.messages)
    .map(c => ({ label: c.title, value: c.messages, note: `${c.messages} messages`, color: BRAND }));

  const topUsers = [...aiUsers].sort((a, b) => b.aiQueries - a.aiQueries).slice(0, 8);
  const maxQ = Math.max(1, ...topUsers.map(u => u.aiQueries));

  return {
    stats: [
      { label: 'Questions asked', value: fmt(questions), sub: 'sent to Ask IRA' },
      { label: 'Tool runs', value: fmt(toolRuns), sub: 'AI Concierge tools' },
      { label: 'Conversations', value: fmt(conversations), sub: `${messages} messages · ${perChat} each` },
      { label: 'Saved conversations', value: fmt(CHAT_HISTORY.length), sub: 'in chat history' },
      {
        label: 'Members using AI',
        value: aiUsers.length > 0 ? fmt(aiUsers.length) : '—',
        sub: aiUsers.length > 0 ? `${adoption}% of active members` : 'no AI events in this window',
      },
      { label: 'Longest conversation', value: fmt(maxMsgs), sub: 'messages' },
    ],
    bars: {
      title: 'Conversations',
      items: barItems,
      note: 'Every saved conversation, by length.',
      variant: 'list',
    },
    donut: {
      title: 'What AI time goes into',
      items: [
        { name: 'Questions', value: questions, color: BRAND },
        { name: 'Tool runs', value: toolRuns, color: '#A366F0' },
        { name: 'Conversations', value: conversations, color: INFO },
      ],
    },
    rows: {
      title: 'Who uses AI most',
      subtitle: aiUsers.length > 0
        ? 'AI events in this period'
        : 'No AI events in this window — saved conversations predate event logging',
      items: topUsers.map(u => ({
        id: u.user.email,
        title: u.user.name,
        sub: getRole(u.user.roleId)?.name ?? '—',
        bar: { label: 'AI events', value: u.aiQueries / maxQ * 100, note: fmt(u.aiQueries), color: BRAND },
      })),
    },
  };
}

/* ── Reports — the report book: generated, shared, ATRs ──────────────────── */

export function deriveReportsPortfolio(): SectionPortfolio {
  const finals = GENERATED_REPORTS.filter(r => r.status === 'final').length;
  const drafts = GENERATED_REPORTS.filter(r => r.status === 'draft').length;
  const atrFinals = ATR_LIBRARY.filter(a => a.status === 'final').length;
  const pages = GENERATED_REPORTS.reduce((s, r) => s + r.pages, 0) + ATR_LIBRARY.reduce((s, a) => s + a.pages, 0);
  const queries = GENERATED_REPORTS.reduce((s, r) => s + r.queries, 0);

  const byTag = [
    { label: 'Internal Audit', value: GENERATED_REPORTS.filter(r => r.tag === 'Internal Audit').length, color: INFO },
    { label: 'Bulk Audit', value: GENERATED_REPORTS.filter(r => r.tag === 'Bulk Audit').length, color: WARN },
    { label: 'Action Taken Reports', value: ATR_LIBRARY.length, color: BRAND },
    { label: 'Shared with teams', value: SHARED_REPORTS.length, color: GOOD },
  ];

  const recent = [...GENERATED_REPORTS]
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    .slice(0, 8);
  const maxPages = Math.max(1, ...recent.map(r => r.pages));

  return {
    stats: [
      { label: 'Reports generated', value: fmt(GENERATED_REPORTS.length), sub: `${finals} final · ${drafts} draft` },
      { label: 'Action Taken Reports', value: fmt(ATR_LIBRARY.length), sub: `${atrFinals} final` },
      { label: 'Shared reports', value: fmt(SHARED_REPORTS.length), sub: 'sent to other teams' },
      { label: 'Pages produced', value: fmt(pages), sub: 'across all reports' },
      { label: 'Queries behind them', value: fmt(queries), sub: 'data questions answered' },
      { label: 'Drafts pending', value: fmt(drafts), sub: 'not finalized yet', tone: drafts > 0 ? 'neutral' : 'good' },
    ],
    bars: { title: 'By kind', items: byTag },
    donut: {
      title: 'By status',
      items: [
        { name: 'Final', value: finals + atrFinals, color: GOOD },
        { name: 'Draft', value: drafts + ATR_LIBRARY.filter(a => a.status === 'draft').length, color: WARN },
        { name: 'Frozen', value: ATR_LIBRARY.filter(a => a.status === 'frozen').length, color: MUTED },
      ].filter(s => s.value > 0),
    },
    rows: {
      title: 'Recent reports',
      subtitle: 'Newest first',
      items: recent.map(r => ({
        id: r.id,
        title: r.name,
        chip: { label: r.tag, className: r.tag === 'Bulk Audit' ? CHIP_WARN : CHIP_INFO },
        sub: `${r.generatedAt} · ${r.queries} quer${r.queries === 1 ? 'y' : 'ies'}`,
        bar: { label: 'Pages', value: (r.pages / maxPages) * 100, note: `${r.pages} pages`, color: INFO },
        right: r.status === 'final'
          ? { text: 'Final', tone: 'good' as const }
          : { text: 'Draft', tone: 'muted' as const },
      })),
    },
  };
}

/* ── Workflows — the automation library and how much it runs ─────────────── */

const WF_TYPE_COLOR: Record<string, string> = {
  Detection: BRAND,
  Monitoring: INFO,
  Compliance: GOOD,
  Reconciliation: WARN,
};

export function deriveWorkflowsPortfolio(): SectionPortfolio {
  const totalRuns = WORKFLOWS.reduce((s, w) => s + w.runs, 0);
  const types = [...new Set(WORKFLOWS.map(w => w.type))];
  const byType: BarItem[] = types
    .map(t => ({
      label: t,
      value: WORKFLOWS.filter(w => w.type === t).reduce((s, w) => s + w.runs, 0),
      note: `${WORKFLOWS.filter(w => w.type === t).length} workflow${WORKFLOWS.filter(w => w.type === t).length === 1 ? '' : 's'}`,
      color: WF_TYPE_COLOR[t] ?? MUTED,
    }))
    .sort((a, b) => b.value - a.value);

  const byProcess = BUSINESS_PROCESSES
    .map(bp => ({ name: bp.abbr, value: WORKFLOWS.filter(w => w.bpId === bp.id).length, color: bp.color }))
    .filter(p => p.value > 0);

  const ranked = [...WORKFLOWS].sort((a, b) => b.runs - a.runs).slice(0, 8);
  const maxRuns = Math.max(1, ...ranked.map(w => w.runs));
  const mostRun = ranked[0];

  return {
    stats: [
      { label: 'Workflows in library', value: fmt(WORKFLOWS.length), sub: `${types.length} categories` },
      { label: 'Total runs', value: fmt(totalRuns), sub: 'all workflows' },
      { label: 'Most-run workflow', value: fmt(mostRun?.runs ?? 0), sub: mostRun?.name ?? '—' },
      { label: 'Runs per workflow', value: fmt(Math.round(totalRuns / Math.max(1, WORKFLOWS.length))), sub: 'average' },
      { label: 'Active workflows', value: fmt(WORKFLOWS.filter(w => w.status === 'active').length), sub: 'of the library', tone: 'good' },
      { label: 'Processes covered', value: fmt(byProcess.length), sub: byProcess.map(p => p.name).join(' · ') },
    ],
    bars: { title: 'Runs by category', items: byType },
    donut: { title: 'Workflows by process', items: byProcess },
    rows: {
      title: 'Most-run workflows',
      subtitle: 'Ranked by total runs',
      items: ranked.map(w => ({
        id: w.id,
        title: w.name,
        chip: { label: w.type, className: CHIP_NEUTRAL },
        sub: BUSINESS_PROCESSES.find(bp => bp.id === w.bpId)?.name ?? w.bpId,
        bar: { label: 'Runs', value: (w.runs / maxRuns) * 100, note: `${fmt(w.runs)} runs`, color: WF_TYPE_COLOR[w.type] ?? BRAND },
        right: { text: `Last run ${w.lastRun}`, tone: 'muted' as const },
      })),
    },
  };
}

/* ── Risk & Controls — the control environment at a glance ───────────────── */

export function deriveRiskControlsPortfolio(): SectionPortfolio {
  const openRisks = RISKS.filter(r => r.status === 'open').length;
  const keyControls = CONTROLS.filter(c => c.isKey).length;
  const effective = CONTROLS.filter(c => c.status === 'effective').length;
  const ineffective = CONTROLS.filter(c => c.status === 'ineffective').length;
  const notTested = CONTROLS.filter(c => c.status === 'not-tested').length;
  const uncovered = RISKS.filter(r => r.ctls === 0).length;
  const effectivePct = CONTROLS.length > 0 ? Math.round((effective / CONTROLS.length) * 100) : 0;

  const severities: { key: string; label: string; color: string }[] = [
    { key: 'critical', label: 'Critical', color: BAD },
    { key: 'high', label: 'High', color: WARN },
    { key: 'medium', label: 'Medium', color: INFO },
  ];
  const bySeverity: BarItem[] = severities.map(s => {
    const of = RISKS.filter(r => r.severity === s.key);
    const open = of.filter(r => r.status === 'open').length;
    return {
      label: s.label,
      value: of.length,
      fillPct: of.length > 0 ? Math.round((open / of.length) * 100) : 0,
      note: `${open} open of ${of.length}`,
      color: s.color,
    };
  });

  const activeBps = BUSINESS_PROCESSES.filter(bp => bp.risks > 0);
  const maxCoverageControls = Math.max(1, ...activeBps.map(bp => bp.controls));

  return {
    stats: [
      { label: 'Risks on the register', value: fmt(RISKS.length), sub: `${openRisks} open`, tone: openRisks > 0 ? 'neutral' : 'good' },
      { label: 'Risks without a control', value: fmt(uncovered), sub: 'no control mapped yet', tone: uncovered > 0 ? 'bad' : 'good' },
      { label: 'Controls in the library', value: fmt(CONTROLS.length), sub: `${keyControls} key controls` },
      { label: 'Controls effective', value: `${effectivePct}%`, sub: `${effective} of ${CONTROLS.length} tested effective`, tone: effectivePct >= 75 ? 'good' : 'neutral' },
      { label: 'Not tested yet', value: fmt(notTested), sub: 'controls awaiting testing', tone: notTested > 0 ? 'neutral' : 'good' },
      { label: 'RACMs', value: fmt(RACMS.length), sub: `${RACMS.filter(r => r.status === 'active').length} active` },
    ],
    bars: { title: 'Risks by severity', items: bySeverity, note: 'Bar length = risks · filled = still open.' },
    donut: {
      title: 'Control test results',
      items: [
        { name: 'Effective', value: effective, color: GOOD },
        { name: 'Ineffective', value: ineffective, color: BAD },
        { name: 'Not tested', value: notTested, color: MUTED },
      ].filter(s => s.value > 0),
    },
    rows: {
      title: 'Coverage by process',
      subtitle: 'Risks, controls and coverage per business process',
      items: activeBps.map(bp => ({
        id: bp.id,
        title: bp.name,
        chip: { label: bp.abbr, className: CHIP_BRAND },
        sub: `${bp.risks} risks · ${bp.sops} SOP${bp.sops === 1 ? '' : 's'} · ${bp.workflows} workflow${bp.workflows === 1 ? '' : 's'}`,
        bar: { label: 'Controls', value: (bp.controls / maxCoverageControls) * 100, fillPct: bp.coverage, note: `${bp.controls} controls · ${bp.coverage}% coverage`, color: bp.color },
        right: bp.coverage >= 70
          ? { text: `${bp.coverage}% covered`, tone: 'good' as const }
          : { text: `${bp.coverage}% covered`, tone: 'muted' as const },
      })),
    },
  };
}

/* ── Knowledge Hub — what data the platform can reach ────────────────────── */

const KH_TYPE_LABEL: Record<SourceType, string> = {
  file: 'Files & folders',
  database: 'Databases',
  api: 'APIs',
  cloud: 'Cloud storage',
  session: 'Session uploads',
};
const KH_TYPE_COLOR: Record<SourceType, string> = {
  file: BRAND,
  database: INFO,
  api: WARN,
  cloud: GOOD,
  session: MUTED,
};

export function deriveKnowledgePortfolio(rangeDays: number): SectionPortfolio {
  const now = Date.now();
  const inRange = (iso: string) => (now - new Date(iso).getTime()) / 86400000 <= rangeDays;
  const files = KH_SOURCES.filter(s => s.type === 'file');
  const integrations = KH_SOURCES.filter(s => s.type !== 'file');
  const degraded = KH_SOURCES.filter(s => s.health === 'degraded').length;
  const addedInRange = KH_SOURCES.filter(s => inRange(s.createdAt)).length;

  const types = (Object.keys(KH_TYPE_LABEL) as SourceType[]);
  const byType: BarItem[] = types
    .map(t => ({
      label: KH_TYPE_LABEL[t],
      value: KH_SOURCES.filter(s => s.type === t).length,
      color: KH_TYPE_COLOR[t],
    }))
    .filter(b => b.value > 0)
    .sort((a, b) => b.value - a.value);

  const recent = [...KH_SOURCES]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return {
    stats: [
      { label: 'Sources connected', value: fmt(KH_SOURCES.length), sub: `${files.length} files · ${integrations.length} integrations` },
      { label: 'Added in this period', value: fmt(addedInRange), sub: `last ${rangeDays} days` },
      { label: 'Folders indexed', value: fmt(files.filter(f => f.isFolder).length), sub: 'multi-file uploads' },
      { label: 'Live integrations', value: fmt(integrations.length), sub: 'databases, APIs, cloud' },
      { label: 'Needs reconnection', value: fmt(degraded), sub: 'integration health', tone: degraded > 0 ? 'bad' : 'good' },
      { label: 'Source types', value: fmt(byType.length), sub: byType.map(b => b.label.split(' ')[0]).join(' · ') },
    ],
    bars: { title: 'By type', items: byType },
    donut: {
      title: 'Files vs integrations',
      items: [
        { name: 'Files & folders', value: files.length, color: BRAND },
        { name: 'Integrations', value: integrations.length, color: INFO },
      ].filter(s => s.value > 0),
    },
    rows: {
      title: 'Recently added sources',
      subtitle: 'Newest first',
      items: recent.map(s => ({
        id: s.id,
        title: s.name,
        chip: { label: KH_TYPE_LABEL[s.type], className: s.type === 'file' ? CHIP_BRAND : CHIP_INFO },
        sub: s.subtype,
        right: { text: `Added ${new Date(s.displayDate ?? s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, tone: 'muted' as const },
      })),
    },
  };
}

/* ── Dashboards — what the team watches ──────────────────────────────────── */

/** The standard analytics dashboards that ship with the platform (mirrors
 *  DashboardView's catalog — names only, for reporting). */
const STANDARD_DASHBOARDS = [
  { id: 'p2p', name: 'Procurement (P2P)', area: 'Procure-to-Pay' },
  { id: 'o2c', name: 'Order to Cash (O2C)', area: 'Order-to-Cash' },
  { id: 's2c', name: 'Source to Contract (S2C)', area: 'Source-to-Contract' },
  { id: 'grc', name: 'GRC Overview', area: 'Governance & Risk' },
  { id: 'excel', name: 'Excel Analytics', area: 'Ad-hoc analysis' },
  { id: 'sql', name: 'SQL Analytics', area: 'Ad-hoc analysis' },
];

export function deriveDashboardsPortfolio(days: UsageDay[]): SectionPortfolio {
  const dashActions = days.reduce((s, d) => s + (d.byModule['Dashboards'] ?? 0), 0);
  const totalTiles = POWER_BI_DASHBOARDS.reduce((s, d) => s + d.tiles, 0);

  const maxTiles = Math.max(1, ...POWER_BI_DASHBOARDS.map(d => d.tiles));

  return {
    stats: [
      { label: 'Standard dashboards', value: fmt(STANDARD_DASHBOARDS.length), sub: 'ship with the platform' },
      { label: 'Power BI available', value: fmt(POWER_BI_DASHBOARDS.length), sub: `${totalTiles} tiles importable` },
      { label: 'Dashboard actions', value: fmt(dashActions), sub: 'in this period' },
      { label: 'Process dashboards', value: fmt(STANDARD_DASHBOARDS.filter(d => d.area.includes('-to-')).length), sub: 'P2P · O2C · S2C' },
      { label: 'Analysis dashboards', value: fmt(STANDARD_DASHBOARDS.filter(d => d.area === 'Ad-hoc analysis').length), sub: 'Excel · SQL' },
      { label: 'Workspaces linked', value: fmt(new Set(POWER_BI_DASHBOARDS.map(d => d.workspace)).size), sub: 'Power BI workspaces' },
    ],
    bars: {
      title: 'Standard catalog',
      items: STANDARD_DASHBOARDS.map(d => ({ label: d.name, value: 1, note: d.area, color: BRAND })),
      note: 'The dashboards every member can open.',
      variant: 'list',
    },
    donut: {
      title: 'Catalog split',
      items: [
        { name: 'Process analytics', value: STANDARD_DASHBOARDS.filter(d => d.area.includes('-to-')).length, color: BRAND },
        { name: 'Ad-hoc analysis', value: STANDARD_DASHBOARDS.filter(d => d.area === 'Ad-hoc analysis').length, color: INFO },
        { name: 'Governance', value: STANDARD_DASHBOARDS.filter(d => d.area === 'Governance & Risk').length, color: GOOD },
      ],
    },
    rows: {
      title: 'Power BI dashboards available to import',
      subtitle: 'From connected workspaces',
      items: POWER_BI_DASHBOARDS.map(d => ({
        id: d.id,
        title: d.name,
        chip: { label: d.workspace, className: CHIP_NEUTRAL },
        sub: `Last refreshed ${d.lastRefresh}`,
        bar: { label: 'Tiles', value: (d.tiles / maxTiles) * 100, note: `${d.tiles} tiles`, color: INFO },
      })),
    },
  };
}
