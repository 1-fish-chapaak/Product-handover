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
  SOPS, BUSINESS_PROCESSES, WORKFLOWS,
  SHARED_REPORTS, CHAT_HISTORY,
} from './mockData';
import { ENGAGEMENTS } from './engagements';
import { ENGAGEMENT_EXCEPTIONS, type Severity } from './engagement-exceptions';
import { processCoverage, processRisks, processControls, racmsForProcess } from './processCoverage';
import { PROCESS_HUB_RACMS } from './racmRegistry';
import { ATR_LIBRARY } from './atrLibrary';
import { reportKind, type GeneratedReport } from '../components/reports/reportShared';
import { MY_DASHBOARDS, SHARED_DASHBOARDS, countByTag, type Dashboard } from './dashboards';
import { SEED_ROLES } from './rbac';
import { WORKSPACES } from './workspaces';
import { CONTROL_LIBRARY } from './controlLibrary';
import { SEED_RISKS as RISK_REGISTER, type RiskPriority } from './riskRegister';
import { type DataSource, type SourceType } from '../components/data-sources/sources';
import { aiQuestions, askIraAskers, workspaceUsage, type UsageDay, type UserUsageRow } from './platform-usage';
import type { AdminUser } from '../context/AdminDataContext';

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
  /** Omitted by sections that have no ranked list worth showing. */
  rows?: { title: string; subtitle: string; items: RankedRow[] };
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
const CHIP_WARN = 'bg-high-50 text-high-700 border-high-100';
const CHIP_INFO = 'bg-evidence-50 text-evidence-700 border-evidence-100';

/* ── Ask IRA — the chat: questions, conversations, who asks ──────────────── */

/**
 * Ask IRA — the chat surface only. Concierge tool runs used to be mixed in
 * here; they now live in UsageConciergeSection, because a question you type and
 * a tool you run are different products and lumping their counts together left
 * nobody able to say which number meant what.
 *
 * Questions and per-member attribution come from real audit events (chat send →
 * Create/Query). The seeded history predates that instrumentation, so "who asks
 * most" is empty until someone actually uses the chat in this session. The copy
 * says so rather than inventing a ranking.
 */
export function deriveAskIraPortfolio(days: UsageDay[], rows: UserUsageRow[]): SectionPortfolio {
  const conversations = days.reduce((s, d) => s + d.aiConversations, 0);
  const messages = days.reduce((s, d) => s + d.aiMessages, 0);
  const questions = aiQuestions(days);
  const active = rows.filter(r => r.actions > 0);
  const perChat = conversations > 0 ? Math.round(messages / conversations) : 0;

  const askers = askIraAskers(days);
  const adoption = active.length > 0 ? Math.round((askers.length / active.length) * 100) : 0;

  // Every saved conversation, longest first — real titles, real message counts.
  const maxMsgs = Math.max(1, ...CHAT_HISTORY.map(c => c.messages));
  const barItems: BarItem[] = [...CHAT_HISTORY]
    .sort((a, b) => b.messages - a.messages)
    .map(c => ({ label: c.title, value: c.messages, note: `${c.messages} messages`, color: BRAND }));

  const topAskers = askers.slice(0, 8);
  const maxQ = Math.max(1, ...topAskers.map(u => u.count));

  return {
    stats: [
      { label: 'Questions asked', value: fmt(questions), sub: 'sent to Ask IRA' },
      { label: 'Conversations', value: fmt(conversations), sub: `${messages} messages · ${perChat} each` },
      { label: 'Saved conversations', value: fmt(CHAT_HISTORY.length), sub: 'in chat history' },
      {
        label: 'Members asking',
        value: askers.length > 0 ? fmt(askers.length) : '—',
        sub: askers.length > 0 ? `${adoption}% of active members` : 'no questions in this window',
      },
      { label: 'Longest conversation', value: fmt(maxMsgs), sub: 'messages' },
      { label: 'Questions per chat', value: fmt(perChat), sub: 'messages exchanged' },
    ],
    bars: {
      title: 'Conversations',
      items: barItems,
      note: 'Every saved conversation, by length.',
      variant: 'list',
    },
    donut: {
      title: 'Chat volume',
      items: [
        { name: 'Questions asked', value: questions, color: BRAND },
        { name: 'Conversations', value: conversations, color: INFO },
      ],
    },
    rows: {
      title: 'Who asks most',
      subtitle: askers.length > 0
        ? 'Questions asked in this period'
        : 'No questions in this window — saved conversations predate event logging',
      items: topAskers.map(u => ({
        id: u.user,
        title: u.user,
        bar: { label: 'Questions', value: (u.count / maxQ) * 100, note: fmt(u.count), color: BRAND },
      })),
    },
  };
}

/* ── AI Concierge — the tools ────────────────────────────────────────────────
 *
 * Not here. The Concierge is a rack of tools you run, and its section has to
 * rank the toolkit and drill into a single tool — a shape the generic
 * stats/bars/donut portfolio cannot carry. It lives in UsageConciergeSection,
 * counted off `conciergeToolUsage` in platform-usage.ts.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── Reports — the report book: generated, shared, ATRs ──────────────────── */

/** How the Reports page labels each kind. Same words, same order, same colours. */
const KIND_LABEL: Record<'sox' | 'ia' | 'atr', string> = {
  sox: 'SOX / ICFR',
  ia: 'Internal Audit',
  atr: 'Action Taken',
};
const KIND_COLOR: Record<'sox' | 'ia' | 'atr', string> = {
  sox: BRAND,
  ia: INFO,
  atr: '#A366F0',
};
const KIND_CHIP: Record<'sox' | 'ia' | 'atr', string> = {
  sox: CHIP_BRAND,
  ia: CHIP_INFO,
  atr: CHIP_WARN,
};

/**
 * The report book, as the Reports page itself sees it.
 *
 * Two things this gets right that the old version didn't:
 *
 * 1. **It reads the live list.** `reports` comes from useGeneratedReports(), not
 *    the `GENERATED_REPORTS` seed — so a report generated five minutes ago is
 *    counted here, instead of the page silently reporting on a frozen snapshot.
 *
 * 2. **It classifies with `reportKind()`**, the platform's own classifier, not
 *    the cosmetic `tag` string. Those disagree: `rt-001` *is* the SOX template
 *    (TEMPLATE_KIND in reportShared), yet every rt-001 report is tagged
 *    "Internal Audit". Counting by tag made SOX — a first-class kind with its
 *    own filter on the Reports page — vanish from this section entirely, and had
 *    the same report reading as SOX on one screen and Internal Audit on another.
 *
 * "Shared" is deliberately *not* on the kind axis. Sharing is a distribution
 * fact, not a kind — a shared report is still SOX or IA — so mixing it in both
 * double-counted and hid the 2 SOX reports sitting inside it. It lives in the
 * stats and the donut, where it belongs.
 *
 * Reports have no draft state — a report exists once generated. The only
 * lifecycle status anywhere is an ATR being `frozen`, so there is nothing to
 * break them down "by status" by.
 */
export function deriveReportsPortfolio(reports: GeneratedReport[]): SectionPortfolio {
  // Bulk Audit is an IA-style engagement, so reportKind() folds it into 'ia'.
  // Keep it visible separately — it's how the work was actually run.
  const bulk = reports.filter(r => r.tag === 'Bulk Audit');
  const kindOf = (r: GeneratedReport) => reportKind(r);
  const sox = reports.filter(r => kindOf(r) === 'sox');
  const ia = reports.filter(r => kindOf(r) === 'ia' && r.tag !== 'Bulk Audit');
  const atrInline = reports.filter(r => kindOf(r) === 'atr');

  // ATRs live in their own library plus any the user generated in-session.
  const atrCount = ATR_LIBRARY.length + atrInline.length;
  const atrFrozen = ATR_LIBRARY.filter(a => a.status === 'frozen').length;

  // Shared reports carry an explicit `kind`, so they classify too.
  const sharedSox = SHARED_REPORTS.filter(r => r.kind === 'sox').length;

  const pages = reports.reduce((s, r) => s + (r.pages ?? 0), 0)
    + ATR_LIBRARY.reduce((s, a) => s + a.pages, 0);
  const queries = reports.reduce((s, r) => s + (r.queries ?? 0), 0);

  const byKind = [
    { label: 'SOX / ICFR', value: sox.length, color: KIND_COLOR.sox },
    { label: 'Internal Audit', value: ia.length, color: KIND_COLOR.ia },
    { label: 'Bulk Audit', value: bulk.length, color: WARN },
    { label: 'Action Taken', value: atrCount, color: KIND_COLOR.atr },
  ];

  const recent = [...reports]
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    .slice(0, 8);
  const maxPages = Math.max(1, ...recent.map(r => r.pages ?? 1));

  return {
    stats: [
      { label: 'Reports generated', value: fmt(reports.length), sub: `${sox.length} SOX · ${ia.length} internal audit · ${bulk.length} bulk` },
      { label: 'SOX / ICFR', value: fmt(sox.length), sub: 'on the SOX framework' },
      { label: 'Action Taken Reports', value: fmt(atrCount), sub: atrFrozen > 0 ? `${atrFrozen} frozen` : 'in the ATR library' },
      { label: 'Shared reports', value: fmt(SHARED_REPORTS.length), sub: sharedSox > 0 ? `${sharedSox} of them SOX` : 'sent to other teams' },
      { label: 'Pages produced', value: fmt(pages), sub: 'across all reports' },
      { label: 'Queries behind them', value: fmt(queries), sub: 'data questions answered' },
    ],
    bars: {
      title: 'By kind',
      items: byKind,
      note: 'Classified the way the Reports page classifies them: by framework, not by the label on the card. Sharing is a separate axis, so a shared report is still SOX or Internal Audit.',
    },
    donut: {
      title: 'Report mix',
      items: [
        { name: 'Generated', value: reports.length, color: INFO },
        { name: 'Action Taken', value: atrCount, color: BRAND },
        { name: 'Shared', value: SHARED_REPORTS.length, color: GOOD },
      ].filter(s => s.value > 0),
    },
    rows: {
      title: 'Recent reports',
      subtitle: 'Newest first',
      items: recent.map(r => {
        const k = kindOf(r);
        const isBulk = r.tag === 'Bulk Audit';
        return {
          id: r.id,
          title: r.name,
          chip: isBulk
            ? { label: 'Bulk Audit', className: CHIP_WARN }
            : { label: KIND_LABEL[k], className: KIND_CHIP[k] },
          sub: `${r.generatedAt} · ${r.queries ?? 0} quer${r.queries === 1 ? 'y' : 'ies'}`,
          bar: { label: 'Pages', value: ((r.pages ?? 1) / maxPages) * 100, note: `${r.pages ?? 1} pages`, color: KIND_COLOR[k] },
        };
      }),
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

/**
 * Risk & Controls — read off the two registries the user actually works in:
 * the Risk Register (RISK_REGISTER) and the Control Library (CONTROL_LIBRARY).
 *
 * It used to count mockData's RISKS and CONTROLS instead — a different, older
 * set (the CTR-xxx controls the RACM and Process Hub join against). That made
 * this page contradict the screens it reports on: the Control Library header
 * says "14 controls · 9 key", and this said 25. The stats below are the same
 * figures those two screens put in their own headers, so the numbers agree
 * wherever a user looks.
 *
 * The control effectiveness donut is gone with it: the Control Library tracks
 * whether a control is live and automated, not whether its last test passed.
 * Test outcomes belong to an engagement, and the Engagements section already
 * reports them. Better to show what the library really knows.
 */
export function deriveRiskControlsPortfolio(): SectionPortfolio {
  // The register's own banner counts a Draft risk as "not yet mapped to a control".
  const unmappedRisks = RISK_REGISTER.filter(r => r.status === 'Draft').length;
  const activeRisks = RISK_REGISTER.filter(r => r.status === 'Active').length;

  // The Control Library's own header KPIs, to the row.
  const keyControls = CONTROL_LIBRARY.filter(c => c.classification === 'Key').length;
  const automated = CONTROL_LIBRARY.filter(c => c.automation === 'Automated').length;
  const itDependent = CONTROL_LIBRARY.filter(c => c.automation === 'IT-dependent').length;
  const manual = CONTROL_LIBRARY.filter(c => c.automation === 'Manual').length;
  const missingWorkflow = CONTROL_LIBRARY.filter(c => c.linkedWorkflows.length === 0).length;

  const priorities: { key: RiskPriority; label: string; color: string }[] = [
    { key: 'Critical', label: 'Critical', color: BAD },
    { key: 'High', label: 'High', color: WARN },
    { key: 'Medium', label: 'Medium', color: INFO },
    { key: 'Low', label: 'Low', color: MUTED },
  ];
  const byPriority: BarItem[] = priorities
    .map(p => {
      const of = RISK_REGISTER.filter(r => r.priority === p.key);
      const mapped = of.filter(r => r.status !== 'Draft').length;
      return {
        label: p.label,
        value: of.length,
        fillPct: of.length > 0 ? Math.round((mapped / of.length) * 100) : 0,
        note: `${mapped} of ${of.length} mapped`,
        color: p.color,
      };
    })
    .filter(b => b.value > 0);

  // Per process, straight off the two registries rather than the Process Hub's
  // own summary counters — same rows, same arithmetic, no third number.
  const processCodes = [...new Set([
    ...RISK_REGISTER.map(r => r.businessProcess),
    ...CONTROL_LIBRARY.map(c => c.businessProcess),
  ])];
  const perProcess = processCodes
    .map(code => {
      const bp = BUSINESS_PROCESSES.find(p => p.abbr === code);
      const risks = RISK_REGISTER.filter(r => r.businessProcess === code);
      const controls = CONTROL_LIBRARY.filter(c => c.businessProcess === code);
      const mapped = risks.filter(r => r.status !== 'Draft').length;
      return {
        id: code,
        name: bp?.name ?? code,
        abbr: code,
        color: bp?.color ?? BRAND,
        risks: risks.length,
        controls: controls.length,
        // A process with no risks on the register has no coverage to report. This
        // used to fall back to 100, so S2C — which has never had a risk assessed —
        // read "100% of risks mapped": a clean bill of health for a process nobody
        // has looked at. Zero risks is missing information, not full coverage, so
        // it is null here and the row says so in words.
        mappedPct: risks.length > 0 ? Math.round((mapped / risks.length) * 100) : null,
      };
    })
    .sort((a, b) => b.controls - a.controls || b.risks - a.risks);
  const maxProcessControls = Math.max(1, ...perProcess.map(p => p.controls));

  return {
    stats: [
      { label: 'Risks on the register', value: fmt(RISK_REGISTER.length), sub: `${activeRisks} active` },
      { label: 'Risks without a control', value: fmt(unmappedRisks), sub: 'still in draft', tone: unmappedRisks > 0 ? 'bad' : 'good' },
      { label: 'Controls in the library', value: fmt(CONTROL_LIBRARY.length), sub: `${keyControls} key controls` },
      { label: 'Automated controls', value: fmt(automated), sub: `${itDependent} IT-dependent · ${manual} manual` },
      { label: 'Missing a workflow', value: fmt(missingWorkflow), sub: 'no workflow linked yet', tone: missingWorkflow > 0 ? 'bad' : 'good' },
      // The same registry the Process Hub tile counts, so the two tiles on this
      // page cannot report a different number of RACMs.
      { label: 'RACMs', value: fmt(PROCESS_HUB_RACMS.length), sub: `${PROCESS_HUB_RACMS.filter(r => r.isValidated).length} validated` },
    ],
    bars: { title: 'Risks by priority', items: byPriority, note: 'Bar length = risks · filled = mapped to a control.' },
    donut: {
      title: 'Controls by automation',
      items: [
        { name: 'Automated', value: automated, color: GOOD },
        { name: 'IT-dependent', value: itDependent, color: INFO },
        { name: 'Manual', value: manual, color: WARN },
      ].filter(s => s.value > 0),
    },
    rows: {
      title: 'Coverage by process',
      subtitle: 'Risks and controls per business process',
      items: perProcess.map(p => ({
        id: p.id,
        title: p.name,
        chip: { label: p.abbr, className: CHIP_BRAND },
        sub: `${p.risks} risk${p.risks === 1 ? '' : 's'} · ${p.controls} control${p.controls === 1 ? '' : 's'}`,
        bar: {
          label: 'Controls',
          value: (p.controls / maxProcessControls) * 100,
          fillPct: p.mappedPct ?? 0,
          note: p.mappedPct === null
            ? `${p.controls} control${p.controls === 1 ? '' : 's'} · no risks to map them to`
            : `${p.controls} control${p.controls === 1 ? '' : 's'} · ${p.mappedPct}% of risks mapped`,
          color: p.color,
        },
        right: p.mappedPct === null
          ? { text: 'No risks captured', tone: 'bad' as const }
          : { text: `${p.mappedPct}% mapped`, tone: p.mappedPct >= 70 ? 'good' as const : 'muted' as const },
      })),
    },
  };
}

/* ── Knowledge Hub — what data the platform can reach ────────────────────── */

const KH_TYPE_LABEL: Record<SourceType, string> = {
  file: 'Files & folders',
  database: 'Databases',
  session: 'Session uploads',
};
const KH_TYPE_COLOR: Record<SourceType, string> = {
  file: BRAND,
  database: INFO,
  session: MUTED,
};

/**
 * Knowledge Hub — from the live catalog the user actually has.
 *
 * `sources` is passed in from useKnowledgeSources, the same store the Knowledge
 * Hub page renders, so a file added or deleted this session moves these numbers
 * too. It previously read a static legacy seed and reported 29 sources and 11
 * folders while the Hub itself showed 20 and 3.
 *
 * Files, folders and integrations are split exactly as the Hub splits them: a
 * folder is a `file` row flagged isFolder, and anything that isn't a file row
 * is an integration.
 */
export function deriveKnowledgePortfolio(sources: DataSource[], rangeDays: number): SectionPortfolio {
  // The catalog's dates are anchored to the wall clock (unlike the audit log,
  // which runs off the Apr 2026 anchor), so "added recently" is measured from
  // now — otherwise every source would fall outside the window.
  const now = Date.now();
  const inRange = (iso: string) => (now - new Date(iso).getTime()) / 86400000 <= rangeDays;

  const files = sources.filter(s => s.type === 'file' && !s.isFolder);
  const folders = sources.filter(s => s.type === 'file' && s.isFolder === true);
  const databases = sources.filter(s => s.type === 'database');
  const sessions = sources.filter(s => s.type === 'session');
  const integrations = sources.filter(s => s.type !== 'file');
  const degraded = sources.filter(s => s.health === 'degraded').length;
  const addedInRange = sources.filter(s => inRange(s.createdAt)).length;

  const types = (Object.keys(KH_TYPE_LABEL) as SourceType[]);
  const byType: BarItem[] = types
    .map(t => ({
      label: KH_TYPE_LABEL[t],
      value: sources.filter(s => s.type === t).length,
      color: KH_TYPE_COLOR[t],
    }))
    .filter(b => b.value > 0)
    .sort((a, b) => b.value - a.value);

  const recent = [...sources]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const sessionSub = sessions.length > 0 ? ` · ${sessions.length} session upload${sessions.length === 1 ? '' : 's'}` : '';

  return {
    stats: [
      { label: 'Sources connected', value: fmt(sources.length), sub: `${files.length} files · ${folders.length} folders · ${databases.length} database${databases.length === 1 ? '' : 's'}${sessionSub}` },
      { label: 'Added in this period', value: fmt(addedInRange), sub: `last ${rangeDays} days` },
      { label: 'Folders indexed', value: fmt(folders.length), sub: 'multi-file uploads' },
      { label: 'Databases connected', value: fmt(databases.length), sub: 'live database connections' },
      { label: 'Needs reconnection', value: fmt(degraded), sub: 'integration health', tone: degraded > 0 ? 'bad' : 'good' },
      { label: 'Source types', value: fmt(byType.length), sub: byType.map(b => b.label.split(' ')[0]).join(' · ') },
    ],
    bars: { title: 'By type', items: byType },
    donut: {
      title: 'Files vs integrations',
      items: [
        { name: 'Files & folders', value: files.length + folders.length, color: BRAND },
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

/* ── Process Hub — the process map the whole platform hangs off ──────────── */

/**
 * The Process Hub is where a business process gets an SOP, that SOP becomes a
 * RACM, and the RACM yields risks and controls. It had no tile here at all, so
 * a process sitting with no SOP — the thing that stalls everything downstream —
 * was invisible to an admin.
 *
 * Every number here is counted off the records the Process Hub itself renders,
 * never the summary fields carried on the BUSINESS_PROCESSES record. Those
 * fields are stale in every direction, and each one put a different number on
 * this page than the screen one click away:
 *
 *   field           says            Process Hub actually shows
 *   bp.risks        P2P 9, R2R 11   6 and 2 (the risk register, filtered)
 *   bp.controls     P2P 24, R2R 31  6 and 1 (controls mapped to those risks)
 *   bp.coverage     P2P 72%, R2R 85%   67% and 50%
 *   bp.sops         P2P 2, R2R 3    7 and 2 (the SOP list)
 *
 * Summing bp.controls claimed 73 controls mapped across the platform; the
 * records hold 25. So risks, controls, coverage and RACM counts all come from
 * processCoverage.ts — the Process Hub's own rules — and SOPs are counted off
 * the SOP list.
 *
 * The two SOPs whose RACM generation failed are surfaced rather than folded into
 * a "processed" count: a failed SOP is a process that silently stopped halfway,
 * and it is the one thing on this tile an admin can actually go fix.
 */
export function deriveProcessHubPortfolio(): SectionPortfolio {
  const withCoverage = BUSINESS_PROCESSES.map(bp => ({
    ...bp,
    sopCount: SOPS.filter(s => s.bpId === bp.id).length,
    racmCount: racmsForProcess(bp.abbr),
    riskCount: processRisks(bp.id).length,
    controlCount: processControls(bp.id).length,
    cover: processCoverage(bp.id),
  }));

  const mapped = withCoverage.filter(bp => bp.sopCount > 0);
  const unmapped = withCoverage.filter(bp => bp.sopCount === 0);

  // RACMs, counted off the registry the Hub's RACM tab renders. Some sit against
  // a framework (ITGC) rather than one of the four business processes, so the
  // per-process counts do not have to add up to the total — say so rather than
  // let the two numbers look broken.
  const totalRacms = PROCESS_HUB_RACMS.length;
  const racmsOnProcesses = withCoverage.reduce((s, bp) => s + bp.racmCount, 0);
  const offProcessRacms = totalRacms - racmsOnProcesses;

  const processedSops = SOPS.filter(s => s.status === 'processed').length;
  const failedSops = SOPS.filter(s => s.status === 'failed').length;

  const totalControls = withCoverage.reduce((s, bp) => s + bp.controlCount, 0);
  const totalRisks = withCoverage.reduce((s, bp) => s + bp.riskCount, 0);
  const covered = mapped.length > 0
    ? Math.round(mapped.reduce((s, bp) => s + bp.cover, 0) / mapped.length)
    : 0;

  const maxControls = Math.max(1, ...withCoverage.map(bp => bp.controlCount));

  return {
    stats: [
      { label: 'Business processes', value: fmt(BUSINESS_PROCESSES.length), sub: `${mapped.length} with an SOP` },
      { label: 'Processes with no SOP', value: fmt(unmapped.length), sub: unmapped.map(bp => bp.abbr).join(' · ') || 'all mapped', tone: unmapped.length > 0 ? 'bad' : 'good' },
      // `tone` colours the value, so it may only carry a tone when the value
      // itself is the bad thing. "10 SOPs uploaded" in red would read as "10 is
      // a problem" — it isn't; the two that failed are. So when SOPs have failed,
      // the failure IS the stat, and the upload total moves into its sub.
      failedSops > 0
        ? {
            label: 'SOPs that failed',
            value: fmt(failedSops),
            sub: `of ${SOPS.length} uploaded · no RACM produced`,
            tone: 'bad' as const,
          }
        : {
            label: 'SOPs uploaded',
            value: fmt(SOPS.length),
            sub: `all ${processedSops} made a RACM`,
            tone: 'good' as const,
          },
      {
        label: 'RACMs',
        value: fmt(totalRacms),
        sub: offProcessRacms > 0
          ? `${racmsOnProcesses} on a process · ${offProcessRacms} on a framework`
          : 'all on a business process',
      },
      { label: 'Risks captured', value: fmt(totalRisks), sub: `${totalControls} control${totalControls === 1 ? '' : 's'} mapped to them` },
      { label: 'Average coverage', value: `${covered}%`, sub: 'risks with a control mapped', tone: covered >= 70 ? 'good' : 'neutral' },
    ],
    bars: {
      title: 'Controls by process',
      items: withCoverage.map(bp => ({
        label: bp.name,
        value: bp.controlCount,
        fillPct: bp.cover,
        note: bp.sopCount === 0 ? 'No SOP yet' : `${bp.cover}% covered`,
        color: bp.sopCount === 0 ? MUTED : bp.color,
      })),
      note: 'Bar length = controls mapped · filled = coverage. A process with no SOP has nothing behind it yet.',
    },
    donut: {
      title: 'SOP → RACM',
      items: [
        { name: 'Made a RACM', value: processedSops, color: GOOD },
        { name: 'Generation failed', value: failedSops, color: BAD },
      ].filter(s => s.value > 0),
    },
    rows: {
      title: 'Process map',
      subtitle: 'SOPs, RACMs, risks and controls per process',
      items: withCoverage.map(bp => ({
        id: bp.id,
        title: bp.name,
        chip: { label: bp.abbr, className: CHIP_BRAND },
        sub: `${bp.sopCount} SOP${bp.sopCount === 1 ? '' : 's'} · ${bp.riskCount} risk${bp.riskCount === 1 ? '' : 's'} · ${bp.racmCount} RACM${bp.racmCount === 1 ? '' : 's'}`,
        bar: { label: 'Controls', value: (bp.controlCount / maxControls) * 100, fillPct: bp.cover, note: `${bp.controlCount} control${bp.controlCount === 1 ? '' : 's'}`, color: bp.color },
        right: bp.sopCount === 0
          ? { text: 'Not mapped', tone: 'bad' as const }
          : { text: `${bp.cover}% covered`, tone: bp.cover >= 70 ? 'good' as const : 'muted' as const },
      })),
    },
  };
}

/* ── Audit Planning — the book of work, by period ────────────────────────── */

/**
 * What is planned versus what is actually running. The planning timeline had no
 * representation here, so an admin could not see that (for instance) work is
 * piled onto one owner, or that a process has nothing scheduled against it.
 *
 * Reads the engagement portfolio — the same records the Audit Planning timeline
 * draws — so the two cannot disagree.
 */
export function deriveAuditPlanningPortfolio(): SectionPortfolio {
  const engagements = ENGAGEMENTS;
  const planned = engagements.filter(e => e.status === 'Planned' || e.status === 'Draft');
  const inFlight = engagements.filter(e => e.status === 'Active' || e.status === 'In Progress' || e.status === 'Review');
  const closed = engagements.filter(e => e.status === 'Closed');

  // Who is carrying the plan. An owner with half the book is a scheduling risk.
  const byOwner = [...engagements.reduce((m, e) => m.set(e.owner, (m.get(e.owner) ?? 0) + 1), new Map<string, number>())]
    .map(([owner, count]) => ({ owner, count }))
    .sort((a, b) => b.count - a.count);
  const maxOwner = Math.max(1, ...byOwner.map(o => o.count));

  const processes = [...new Set(engagements.map(e => e.process))];
  const byProcess = processes
    .map(code => {
      const bp = BUSINESS_PROCESSES.find(p => p.abbr === code);
      const of = engagements.filter(e => e.process === code);
      return { name: code, value: of.length, color: bp?.color ?? BRAND };
    })
    .sort((a, b) => b.value - a.value);

  return {
    stats: [
      { label: 'Engagements planned', value: fmt(engagements.length), sub: 'across the whole year' },
      { label: 'In flight', value: fmt(inFlight.length), sub: 'active, in progress or in review' },
      { label: 'Not started', value: fmt(planned.length), sub: 'planned or still draft', tone: planned.length > 0 ? 'neutral' : 'good' },
      { label: 'Closed', value: fmt(closed.length), sub: 'finished this year', tone: 'good' },
      { label: 'Owners carrying work', value: fmt(byOwner.length), sub: byOwner[0] ? `busiest: ${byOwner[0].owner} (${byOwner[0].count})` : '—' },
      { label: 'Processes covered', value: fmt(processes.length), sub: processes.join(' · ') },
    ],
    bars: {
      title: 'Workload by owner',
      items: byOwner.map(o => ({
        label: o.owner,
        value: o.count,
        note: `${o.count} engagement${o.count === 1 ? '' : 's'}`,
        color: o.count >= Math.max(3, maxOwner) ? WARN : BRAND,
      })),
      note: 'Engagements each person owns. One name carrying the plan is a scheduling risk.',
    },
    donut: { title: 'Engagements by process', items: byProcess },
    rows: {
      title: 'The plan',
      subtitle: 'Every engagement, with its period and owner',
      items: [...engagements]
        .sort((a, b) => a.owner.localeCompare(b.owner))
        .map(e => ({
          id: e.id,
          title: e.name,
          chip: { label: e.status, className: e.status === 'Closed' ? CHIP_NEUTRAL : e.status === 'Planned' || e.status === 'Draft' ? CHIP_WARN : CHIP_INFO },
          sub: `${e.code} · ${e.owner} · ${e.periodStart} – ${e.periodEnd}`,
          bar: { label: 'Controls in scope', value: 100, note: `${e.controls} controls`, color: BUSINESS_PROCESSES.find(p => p.abbr === e.process)?.color ?? BRAND },
          right: { text: e.process, tone: 'muted' as const },
        })),
    },
  };
}

/* ── Exceptions — the triage queue ───────────────────────────────────────── */

/**
 * Everything a workflow flagged and somebody has to deal with. This is the work
 * My Queue and case management run on, and it had no tile — so the one number an
 * admin most wants ("is the queue being worked, or is it just growing?") was not
 * on the page.
 *
 * The register itself (ENGAGEMENT_EXCEPTIONS), so it matches My Queue and the
 * Engagements overview exactly.
 */
export function deriveExceptionsPortfolio(): SectionPortfolio {
  const all = ENGAGEMENT_EXCEPTIONS;
  const open = all.filter(e => e.status === 'Open');
  const triaging = all.filter(e => e.status === 'Triaging');
  const resolved = all.filter(e => e.status === 'Resolved');
  const unresolved = all.filter(e => e.status !== 'Resolved');
  const critical = unresolved.filter(e => e.severity === 'Critical').length;
  const unclassified = unresolved.filter(e => !e.classification).length;
  const resolvedPct = all.length > 0 ? Math.round((resolved.length / all.length) * 100) : 0;

  const severities: { key: Severity; color: string }[] = [
    { key: 'Critical', color: BAD },
    { key: 'High', color: WARN },
    { key: 'Medium', color: INFO },
    { key: 'Low', color: MUTED },
  ];
  const bySeverity: BarItem[] = severities
    .map(s => {
      const of = all.filter(e => e.severity === s.key);
      const stillOpen = of.filter(e => e.status !== 'Resolved').length;
      return {
        label: s.key,
        value: of.length,
        fillPct: of.length > 0 ? Math.round((stillOpen / of.length) * 100) : 0,
        note: `${stillOpen} of ${of.length} still open`,
        color: s.color,
      };
    })
    .filter(b => b.value > 0);

  // Which workflow is generating the noise.
  const byWorkflow = [...all.reduce((m, e) => {
    const cur = m.get(e.workflowName) ?? { total: 0, open: 0 };
    cur.total += 1;
    if (e.status !== 'Resolved') cur.open += 1;
    return m.set(e.workflowName, cur);
  }, new Map<string, { total: number; open: number }>())]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);
  const maxWf = Math.max(1, ...byWorkflow.map(w => w.total));

  // Who is holding the queue.
  const byAssignee = [...unresolved.reduce((m, e) => m.set(e.assignee, (m.get(e.assignee) ?? 0) + 1), new Map<string, number>())]
    .map(([assignee, count]) => ({ assignee, count }))
    .sort((a, b) => b.count - a.count);

  return {
    stats: [
      { label: 'Open findings', value: fmt(unresolved.length), sub: `${open.length} open · ${triaging.length} in triage`, tone: unresolved.length > 0 ? 'bad' : 'good' },
      { label: 'Critical', value: fmt(critical), sub: 'unresolved, highest severity', tone: critical > 0 ? 'bad' : 'good' },
      { label: 'Resolved', value: fmt(resolved.length), sub: `${resolvedPct}% of everything raised`, tone: 'good' },
      { label: 'Unclassified', value: fmt(unclassified), sub: 'nobody has said what they are yet', tone: unclassified > 0 ? 'bad' : 'good' },
      { label: 'People holding the queue', value: fmt(byAssignee.length), sub: byAssignee[0] ? `busiest: ${byAssignee[0].assignee} (${byAssignee[0].count})` : '—' },
      { label: 'Workflows raising them', value: fmt(byWorkflow.length), sub: 'sources of exceptions' },
    ],
    bars: { title: 'By severity', items: bySeverity, note: 'Bar length = raised · filled = still unresolved.' },
    donut: {
      title: 'Queue status',
      items: [
        { name: 'Open', value: open.length, color: BAD },
        { name: 'Triaging', value: triaging.length, color: WARN },
        { name: 'Resolved', value: resolved.length, color: GOOD },
      ].filter(s => s.value > 0),
    },
    rows: {
      title: 'Where exceptions come from',
      subtitle: 'The workflow that raised them',
      items: byWorkflow.map(w => ({
        id: w.name,
        title: w.name,
        sub: `${w.total} raised · ${w.total - w.open} resolved`,
        bar: {
          label: 'Raised',
          value: (w.total / maxWf) * 100,
          fillPct: Math.round((w.open / w.total) * 100),
          note: `${w.open} still open`,
          color: w.open > 0 ? BAD : GOOD,
        },
        right: w.open > 0
          ? { text: `${w.open} open`, tone: 'bad' as const }
          : { text: 'All cleared', tone: 'good' as const },
      })),
    },
  };
}

/* ── Admin & access — who can change what ───────────────────────────────── */

/**
 * The governance view of the platform itself: workspaces, teams, roles, and the
 * config changes people make.
 *
 * Deliberately *not* a second copy of the Members card on the page. That one
 * answers "are we paying for seats nobody uses". This one answers the questions
 * an admin gets asked in a security review: how many people can change
 * everything, which roles are handing out access nobody needs, and is anybody
 * failing to get in.
 */
export function deriveAdminPortfolio(days: UsageDay[], rows: UserUsageRow[]): SectionPortfolio {
  const users = rows.map(r => r.user);
  const entries = days.flatMap(d => d.entries);
  const adminEvents = entries.filter(e => e.module === 'Admin');

  // A rejected sign-in is the one event on this page that is interesting because
  // it *failed*. The actor is 'Unknown' by definition — nobody was authenticated.
  const failedSignIns = entries.filter(e => e.action === 'Login' && e.status === 'Failed').length;

  // Config changes: everything in Admin that isn't just someone signing in.
  const configChanges = adminEvents.filter(e => e.entity !== 'Session').length;

  const teamNames = [...new Set(users.map(u => u.team).filter(t => t !== '—'))];
  const unassigned = users.filter(u => u.team === '—').length;

  // Members per role, so a role nobody holds — or one that too many people hold
  // — is visible rather than buried in the Admin tab.
  const byRole = SEED_ROLES
    .map(role => ({ role, count: users.filter(u => u.roleId === role.id).length }))
    .sort((a, b) => b.count - a.count);
  const admins = byRole.find(r => r.role.id === 'role-admin')?.count ?? 0;
  const unusedRoles = byRole.filter(r => r.count === 0).length;

  const statusCount = (s: AdminUser['status']) => users.filter(u => u.status === s).length;

  // Usage cut by workspace, off the workspace stamped on each audit event.
  const byWorkspace = workspaceUsage(days, users);
  const busiest = byWorkspace[0];

  const workspaceRows: RankedRow[] = byWorkspace.map((w, i) => ({
    id: w.workspace.id,
    title: w.workspace.name,
    chip: i === 0 && w.actions > 0
      ? { label: 'Busiest', className: 'border-brand-200 bg-brand-50 text-brand-700' }
      : undefined,
    // The right-hand slot is narrow — one fact only, or it wraps. Everything else
    // hangs off the title and the bar.
    sub: w.topModule
      ? `${w.workspace.description} · mostly ${w.topModule}`
      : w.workspace.description,
    bar: {
      label: 'Share of all activity',
      value: Math.max(6, w.sharePct),
      note: `${fmt(w.actions)} action${w.actions === 1 ? '' : 's'} · ${w.sharePct}% · ${fmt(w.aiEvents)} AI`,
      color: w.actions === 0 ? MUTED : BRAND,
    },
    right: w.actions === 0
      ? { text: 'No activity', tone: 'bad' as const }
      : { text: `${w.members} member${w.members === 1 ? '' : 's'}`, tone: 'muted' as const },
  }));

  return {
    stats: [
      {
        label: 'Workspaces',
        value: fmt(WORKSPACES.length),
        sub: busiest && busiest.actions > 0
          ? `${busiest.workspace.name} carries ${busiest.sharePct}%`
          : WORKSPACES.map(w => w.name).join(' · '),
      },
      { label: 'Members', value: fmt(users.length), sub: `across ${teamNames.length} teams` },
      {
        label: 'Failed sign-ins',
        value: fmt(failedSignIns),
        sub: 'in this period',
        tone: failedSignIns > 0 ? 'bad' : 'good',
      },
      {
        label: 'Full admins',
        value: fmt(admins),
        sub: 'can change everything',
        tone: admins > 2 ? 'bad' : 'neutral',
      },
      { label: 'Config changes', value: fmt(configChanges), sub: 'roles, users, settings' },
      {
        label: 'Unassigned',
        value: fmt(unassigned),
        sub: 'in no team',
        tone: unassigned > 0 ? 'bad' : 'good',
      },
    ],
    bars: {
      title: 'Who holds which role',
      // The renderer prints the member count in bold beside the bar, so the note
      // must not open with a digit or the two numbers run together.
      items: byRole.map(({ role, count }) => ({
        label: role.name,
        value: count,
        note: count === 0
          ? 'Nobody holds it'
          : `${role.type} role · ${role.permissions.length} permissions`,
        color: count === 0 ? MUTED : role.id === 'role-admin' ? BAD : BRAND,
      })),
      note: unusedRoles > 0
        ? `${unusedRoles} role${unusedRoles === 1 ? '' : 's'} nobody holds. ${admins} member${admins === 1 ? '' : 's'} can change every setting on the platform.`
        : `${admins} member${admins === 1 ? '' : 's'} can change every setting on the platform.`,
    },
    donut: {
      title: 'Seats by status',
      items: [
        { name: 'Active', value: statusCount('Active'), color: GOOD },
        { name: 'Invited', value: statusCount('Invited'), color: WARN },
        { name: 'Suspended', value: statusCount('Suspended'), color: BAD },
        { name: 'Locked', value: statusCount('Locked'), color: MUTED },
        { name: 'Inactive', value: statusCount('Inactive'), color: INFO },
      ],
    },
    rows: {
      title: 'Usage by workspace',
      // Teams live in the page's own Users|Teams lens; workspaces have nowhere
      // else to appear, and they're the cut nobody could make until the audit log
      // started recording which workspace an action happened in.
      subtitle: 'Where the work actually happens. A member who works in both is counted in both.',
      items: workspaceRows,
    },
  };
}

/* ── Dashboards — is anyone still using these? ───────────────────────────── */

/**
 * Rank the catalog by what people actually did to each dashboard in the window.
 *
 * The join is by name: a Dashboard audit event names the dashboard it touched,
 * so the log can be matched back to the record. That only holds because the
 * seeded history draws its names from the same dashboards (audit-history.ts)
 * — a made-up name would match nothing and a live dashboard would read as dead.
 *
 * One honest limit: the platform never logs a dashboard *view*, only edits,
 * shares, exports and widget changes. So "untouched" means nobody has changed or
 * shared it in this period — not that nobody looked at it. That's still the
 * signal worth acting on: a dashboard nobody has touched in 90 days is a
 * candidate for deletion.
 */
/**
 * The dashboards a user can actually open: the Dashboards page's own two tabs,
 * My Dashboards and Shared with Me.
 *
 * Deliberately NOT DASHBOARD_CATALOG, which also carries two onboarding sample
 * dashboards that the page never lists. Counting those made this section claim
 * 9 dashboards against the 7 on screen, and — worse — reported the samples as
 * "untouched", i.e. as a cleanup job for something the user cannot see.
 */
const LISTED_DASHBOARDS: Dashboard[] = [...MY_DASHBOARDS, ...SHARED_DASHBOARDS];

function dashboardActivity(days: UsageDay[]) {
  const events = days
    .flatMap(d => d.entries)
    .filter(e => e.module === 'Dashboards');

  return LISTED_DASHBOARDS
    .map(dash => ({
      dash,
      actions: events.filter(e => e.description.includes(dash.name)).length,
    }))
    .sort((a, b) => b.actions - a.actions || a.dash.name.localeCompare(b.dash.name));
}

export function deriveDashboardsPortfolio(days: UsageDay[]): SectionPortfolio {
  const dashActions = days.reduce((s, d) => s + (d.byModule['Dashboards'] ?? 0), 0);

  const activity = dashboardActivity(days);
  const untouched = activity.filter(a => a.actions === 0).length;

  // Tags are the dashboard's data source — the same Excel / CSV · Query · SQL
  // badges the cards show. A combo dashboard carries one tag per kind, so the
  // tag counts intentionally sum to more than the dashboard count.
  const excel = countByTag(LISTED_DASHBOARDS, 'file');
  const sql = countByTag(LISTED_DASHBOARDS, 'sql');
  const query = countByTag(LISTED_DASHBOARDS, 'query');

  return {
    stats: [
      { label: 'Dashboards', value: fmt(LISTED_DASHBOARDS.length), sub: 'on the Dashboards page' },
      { label: 'Dashboard actions', value: fmt(dashActions), sub: 'in this period' },
      {
        label: 'Untouched',
        value: fmt(untouched),
        sub: 'nobody changed or shared them',
        tone: untouched > 0 ? 'bad' : 'good',
      },
      { label: 'Excel / CSV', value: fmt(excel), sub: 'built on files' },
      { label: 'SQL', value: fmt(sql), sub: 'built on a database' },
      { label: 'Query', value: fmt(query), sub: 'built on a saved query' },
    ],
    bars: {
      // The bold figure the renderer puts beside each bar is the action count,
      // so the note qualifies it rather than repeating it.
      // One question only: how much is each dashboard used. Data source is a
      // separate dimension and already lives in the donut, so it is kept off
      // this chart — the bars read as a clean ranked "most used → dead" list.
      title: 'Most used dashboards',
      items: activity.map(({ dash, actions }) => ({
        label: dash.name,
        value: actions,
        note: actions === 0 ? 'Untouched' : undefined,
        color: actions === 0 ? MUTED : BRAND,
      })),
      note: untouched > 0
        ? `${untouched} of ${LISTED_DASHBOARDS.length} weren't touched. Counts edits, shares and exports — views aren't logged.`
        : `Counts edits, shares and exports — views aren't logged.`,
    },
    donut: {
      title: 'Dashboards by tag',
      items: [
        { name: 'Excel / CSV', value: excel, color: GOOD },
        { name: 'SQL', value: sql, color: BRAND },
        { name: 'Query', value: query, color: INFO },
      ],
    },
  };
}
