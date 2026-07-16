/**
 * Platform Usage — every number derived from the platform's own records.
 *
 * Nothing here invents a figure. Each tile is counted off something the platform
 * actually stores:
 *
 *   · actions / activeUsers / downloads / byModule  ← the audit log (AuditLog[])
 *   · reports                                       ← GENERATED_REPORTS + ATR_LIBRARY
 *   · aiEvents                                      ← Ask IRA / Concierge audit events
 *   · aiConversations                               ← CHAT_HISTORY (saved conversations)
 *
 * Those records are seeded rather than produced by a live backend — the audit
 * log's six months of history is composed in audit-history.ts — but this module
 * only ever *counts* them. There is no second, made-up series behind the page:
 * if a member has 65 actions here, there are 65 events in the log with their
 * name on them, and the drill-down lists them.
 *
 * ## The anchor
 *
 * The seeded records are fixed in the past (the newest is Apr 2026). Measuring
 * "last 30 days" against wall-clock time would therefore render every tile as 0.
 * Instead day-offset 0 is the **anchor**: the most recent real record in the
 * data set. Windows run backwards from there and the page says "Data as of
 * <anchor>".
 *
 * Events logged during *this session* are folded into the anchor bucket, so an
 * action you take right now still shows up. The anchor itself never moves —
 * otherwise a single click would slide the whole window and empty it. Those
 * session events are the only ones flagged `live` (see UsageEntry.live); the
 * anchor day's seeded events are history, not "today".
 *
 * ## Known gaps (real, not hidden)
 *
 * Report and chat records carry a date but no clock time, so they can't be
 * placed on the weekday×hour rhythm heatmap; its total is therefore ≤ the
 * window's action total, and it reports the shortfall rather than smearing
 * those events across the grid.
 */

import type { AdminUser, AuditLog, ExportFormat } from '../context/AdminDataContext';
import { GENERATED_REPORTS, CHAT_HISTORY } from './mockData';
import { ATR_LIBRARY } from './atrLibrary';
import { CONCIERGE_TOOLS } from './conciergeTools';
import { WORKSPACES, type Workspace } from './workspaces';

/* ── Modules the breakdown reports on ──
 *
 * One bucket per surface a user can actually open. This list used to be eight
 * entries with everything unrecognised falling through to 'Risk & Controls',
 * which quietly swallowed whole modules: exception triage, audit planning, the
 * Process Hub, and every Concierge tool run (those log under the tool's own
 * name — 'PDF Structure', 'QR Scanner', …). The page then reported Risk &
 * Controls as the platform's busiest area, which was an artefact of the default
 * case, not a fact about the workspace.
 */
export const USAGE_MODULES = [
  'Ask IRA',
  'AI Concierge',
  'Reports',
  'Engagements',
  'Working Papers',
  'Exceptions',
  'Audit Planning',
  'Process Hub',
  'Risk & Controls',
  'Workflows',
  'Dashboards',
  'Knowledge Hub',
  'Admin',
  'Other',
] as const;
export type UsageModule = (typeof USAGE_MODULES)[number];

/**
 * The KINDS of work, and which areas make up each. The Overview's ring plots
 * these, not the thirteen areas underneath.
 *
 * WHY THIS EXISTS. An audit lead does not arrive asking "how many actions landed
 * in Process Hub". They arrive asking "is my team spending its time on the audit,
 * or on overhead". Thirteen areas cannot answer that: the busiest is 15%, so the
 * ring came out six near-equal arcs plus a 37% grey "7 more areas" remainder —
 * the biggest mark on the chart was the one thing nobody can act on, and no
 * rollup setting fixed it. You need ten named arcs before the remainder stops
 * dominating, and ten arcs is the pinwheel the rollup exists to prevent. The
 * fault was never the ring. It was asking a part-to-whole chart to carry a
 * thirteen-way split with no dominant part.
 *
 * Grouped, the same 528 actions become 50 / 21 / 12 / 9 / 8: one clear lead, a
 * real descent, every arc named, and no remainder at all. That is a shape worth
 * drawing, and it answers the question actually being asked.
 *
 * THE JUDGEMENT CALLS, so the next person can argue with them rather than guess:
 *   · Workflows sits in Audit work. A workflow run executes audit procedures; it
 *     is the audit being done, just automated.
 *   · Knowledge Hub stands alone rather than joining Audit work. It is the firm's
 *     methodology library — consulted during the audit, but reading the manual is
 *     not fieldwork, and folding it in would flatter the Audit work number.
 *   · Admin stands alone because it is the overhead the lead is testing FOR. It
 *     must never hide inside another kind.
 *
 * Order here is the tie-break only; the ring and the list both rank by size.
 */
export const USAGE_FAMILIES = [
  {
    name: 'Audit work',
    modules: ['Risk & Controls', 'Engagements', 'Exceptions', 'Working Papers', 'Audit Planning', 'Process Hub', 'Workflows'],
  },
  /* "Reporting", not "Reports and dashboards": the long form truncated to
     "Reports and dashbo…" in the list, and the row already names Reports and
     Dashboards underneath it. */
  { name: 'Reporting', modules: ['Reports', 'Dashboards'] },
  { name: 'IRA help', modules: ['Ask IRA', 'AI Concierge'] },
  { name: 'Admin', modules: ['Admin'] },
  { name: 'Knowledge Hub', modules: ['Knowledge Hub'] },
  { name: 'Other', modules: ['Other'] },
] as const satisfies readonly { name: string; modules: readonly UsageModule[] }[];

export type UsageFamily = (typeof USAGE_FAMILIES)[number]['name'];

/** Which kind of work an area belongs to. */
export const MODULE_FAMILY = Object.fromEntries(
  USAGE_FAMILIES.flatMap(f => f.modules.map(m => [m, f.name])),
) as Record<UsageModule, UsageFamily>;

/**
 * Every area is claimed by exactly one kind, checked at compile time. Add an area
 * to USAGE_MODULES without filing it above and this line stops compiling, which is
 * the point: an unfiled area would silently vanish from the ring rather than show
 * up wrong.
 *
 * It has to read the LITERAL module names out of USAGE_FAMILIES. Asserting
 * `MODULE_FAMILY` against `Record<UsageModule, UsageFamily>` looks like the same
 * check and is worth nothing, because the `as` cast on Object.fromEntries already
 * asserts that type into being — the assertion then only proves the cast happened.
 * Verified by deleting a family and watching this fail.
 */
type FiledModule = (typeof USAGE_FAMILIES)[number]['modules'][number];
type UnfiledModules = Exclude<UsageModule, FiledModule>;
const _everyModuleIsFiled: UnfiledModules extends never ? true : ['unfiled areas:', UnfiledModules] = true;
void _everyModuleIsFiled;

/**
 * Every module string the platform actually writes, mapped to its bucket.
 *
 * Keys are lowercased on lookup, because the same surface logs itself under
 * several spellings ('Reports' and 'reports', 'Workflows' and 'workflows') and
 * a case-sensitive switch sent half of them to the default.
 *
 * Anything genuinely unknown lands in 'Other' rather than being folded into a
 * real module. A new surface that forgets to register here then shows up as
 * unattributed activity — visible, and fixable — instead of silently inflating
 * whichever bucket happened to be the default.
 */
const MODULE_BUCKETS: Record<string, UsageModule> = {
  // Chat
  'ask ira': 'Ask IRA',
  'chat': 'Ask IRA',
  // Concierge — the rack itself, plus each tool, which logs under its own name
  'ai concierge': 'AI Concierge',
  'concierge': 'AI Concierge',
  'pdf structure': 'AI Concierge',
  'image quality': 'AI Concierge',
  'content validation': 'AI Concierge',
  'content verifier': 'AI Concierge',
  'template detection': 'AI Concierge',
  'truesight ai detection': 'AI Concierge',
  'qr scanner': 'AI Concierge',
  'font forensics': 'AI Concierge',
  'jpeg forensics': 'AI Concierge',
  'metadata analysis': 'AI Concierge',
  'copy-move detection': 'AI Concierge',
  'gstin verifier': 'AI Concierge',
  // Reports
  'report': 'Reports',
  'reports': 'Reports',
  // Engagements (SOX/ICFR and fieldwork are engagement work)
  'engagements': 'Engagements',
  'engagement execution': 'Engagements',
  'sox icfr': 'Engagements',
  // Exception triage — My Queue and case management
  'exceptions': 'Exceptions',
  // Planning
  'planning': 'Audit Planning',
  'audit planning': 'Audit Planning',
  // Process Hub
  'process hub': 'Process Hub',
  'business_process': 'Process Hub',
  // The control environment
  'governance': 'Risk & Controls',
  'control library': 'Risk & Controls',
  'controls': 'Risk & Controls',
  'risk register': 'Risk & Controls',
  'risk': 'Risk & Controls',
  'racm': 'Risk & Controls',
  // Automation
  'workflow library': 'Workflows',
  'workflows': 'Workflows',
  // Intelligence
  'dashboard': 'Dashboards',
  'dashboards': 'Dashboards',
  // Data
  'knowledge hub': 'Knowledge Hub',
  'data sources': 'Knowledge Hub',
  'datasource': 'Knowledge Hub',
  // Platform
  'admin': 'Admin',
  'notifications': 'Admin',
};

/** Map an AuditLog event onto a usage bucket.
 *
 * `entity` is consulted first for the surfaces that share one module string but
 * are worth reporting apart: a working paper logs under 'Engagement Execution'
 * alongside control tests and evidence uploads, but an audit lead reads "working
 * papers" as its own body of work, so it gets its own area rather than being
 * swallowed into Engagements. Everything else falls through to the module map. */
export function usageModuleFor(logModule: string, entity?: string): UsageModule {
  if (entity && entity.trim().toLowerCase() === 'working paper') return 'Working Papers';
  return MODULE_BUCKETS[logModule.trim().toLowerCase()] ?? 'Other';
}

/** One real audit event, reduced to what the usage page needs. */
export interface UsageEntry {
  user: string;
  action: AuditLog['action'];
  entity: string;
  module: UsageModule;
  /** Clock hour 0–23, or null when the record carries only a date. */
  hour: number | null;
  description: string;
  id: string;
  /** 'Failed' is what makes a rejected sign-in legible as a security signal
   *  rather than just another action. */
  status: AuditLog['status'];
  /** The workspace the action happened in (Workspace.id). */
  workspaceId: string;
  /** Export events: the artifact's name and format as the logger stated them.
   *  Absent on an Export means the logger didn't declare them — the download
   *  feed says so rather than inventing a format. */
  artifact?: string;
  format?: ExportFormat;
  /** Produced by this session, rather than seeded. Not the same thing as
   *  "day-offset 0": the anchor day is seeded history, and calling those events
   *  "Today" would be a lie — the page is as of the anchor, not wall-clock. */
  live: boolean;
}

export interface UsageDay {
  /** Days before the anchor: 0 = the anchor day, 89 = 90 days earlier. */
  dayOffset: number;
  /** People who did anything that day (distinct audit-log actors). */
  activeUsers: number;
  /** Audit-logged actions that day. */
  actions: number;
  /** Conversations started that day (CHAT_HISTORY — saved chat records). */
  aiConversations: number;
  /** Messages exchanged in those conversations. */
  aiMessages: number;
  /** Ask IRA / Concierge audit events that day: questions asked + tool runs.
   *  Disjoint from `aiConversations` — saved chats predate event logging. */
  aiEvents: number;
  /** Reports + ATRs generated that day (the report registries). */
  reports: number;
  /** Of those reports, the ones tagged "Bulk Audit" — a subset of `reports`,
   *  surfaced on its own so the Bulk Audit rollup can be counted without a
   *  second pass over the registry. */
  bulkReports: number;
  /** Export events that day. */
  downloads: number;
  byModule: Record<UsageModule, number>;
  /** The audit events themselves, so every drill-down stays real. */
  entries: UsageEntry[];
}

/** Longest visible range (the 90-day chip). */
export const USAGE_RANGE_DAYS = 90;
/** Series length — twice the longest range, so every visible window has a full
 *  equal-length prior window for period-over-period deltas. */
export const USAGE_SERIES_DAYS = 180;

const DAY_MS = 86400000;

/* ── Date parsing for the registry records ─────────────────────────────────
 * Audit logs:  '2026-04-19 10:30:50'
 * Reports:     'Mar 20, 2026'  |  'Mar 22, 2026, 16:40'
 * Chats:       'Mar 20, 2026'
 * ────────────────────────────────────────────────────────────────────────── */

/** Midnight-normalised day key for any of the above formats. Null if unparseable. */
function dayStart(value: string): number | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  // 'Mar 22, 2026, 16:40' → drop the trailing clock time before parsing.
  const d = new Date(value.replace(/,\s*\d{1,2}:\d{2}.*$/, ''));
  if (isNaN(d.getTime())) return null;
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Clock hour from an audit-log timestamp; null for date-only records. */
function hourOf(timestamp: string): number | null {
  const m = timestamp.match(/\s(\d{2}):\d{2}/);
  return m ? Number(m[1]) : null;
}

function todayStartUtc(): number {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Every report the registries know about, as (dayKey) stamps. */
function reportDayKeys(): number[] {
  return [
    ...GENERATED_REPORTS.map(r => dayStart(r.generatedAt)),
    ...ATR_LIBRARY.map(a => dayStart(a.generatedAt)),
  ].filter((v): v is number => v !== null);
}

/** Just the "Bulk Audit"–tagged reports, as (dayKey) stamps — the report half of
 *  the Bulk Audit rollup. Read straight off the registry tag, so it can never
 *  disagree with what the Reports list shows. */
function bulkReportDayKeys(): number[] {
  return GENERATED_REPORTS
    .filter(r => r.tag === 'Bulk Audit')
    .map(r => dayStart(r.generatedAt))
    .filter((v): v is number => v !== null);
}

/** Every saved conversation, as (dayKey, messages) pairs. */
function chatDayKeys(): { key: number; messages: number }[] {
  return CHAT_HISTORY
    .map(c => ({ key: dayStart(c.timestamp), messages: c.messages }))
    .filter((v): v is { key: number; messages: number } => v.key !== null);
}

/**
 * The anchor: the newest record that predates today. Live session events are
 * deliberately excluded so a single click can't slide the window and empty it.
 */
export function usageAnchor(logs: AuditLog[]): number {
  const today = todayStartUtc();
  const candidates = [
    ...logs.map(l => dayStart(l.timestamp)).filter((v): v is number => v !== null && v < today),
    ...reportDayKeys(),
    ...chatDayKeys().map(c => c.key),
  ];
  return candidates.length > 0 ? Math.max(...candidates) : today;
}

/** The page's one date spelling: "Apr 19, 2026". */
export function usageDateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

/** Human label for the anchor, e.g. "Apr 19, 2026". */
export function usageAnchorLabel(logs: AuditLog[]): string {
  return usageDateLabel(usageAnchor(logs));
}

/**
 * How far behind wall-clock time the records are.
 *
 * Everything on this page is measured from the anchor — the newest real record —
 * and NOT from today. When the two are the same day that distinction is
 * invisible and harmless. When the records stop months back, it is a trap: the
 * page says "the last 30 days" and means a window that closed in April, and an
 * admin reading "seat use is 71%" has no way to know they are looking at a
 * quarter-old number. So the gap gets stated out loud whenever there is one.
 */
export interface UsageStaleness {
  /** Wall-clock today, e.g. "Jul 14, 2026". */
  todayLabel: string;
  /** Newest record, e.g. "Apr 21, 2026". */
  anchorLabel: string;
  /** Whole days between the two. 0 = the records are current. */
  gapDays: number;
  /** True once the gap is big enough that the reader must be told. */
  stale: boolean;
}

/** A day or two behind is normal lag; two weeks is a different quarter's data. */
export const STALE_AFTER_DAYS = 2;

export function usageStaleness(logs: AuditLog[]): UsageStaleness {
  const today = todayStartUtc();
  const anchor = usageAnchor(logs);
  const gapDays = Math.max(0, Math.round((today - anchor) / DAY_MS));
  return {
    todayLabel: usageDateLabel(today),
    anchorLabel: usageDateLabel(anchor),
    gapDays,
    stale: gapDays >= STALE_AFTER_DAYS,
  };
}

/** Logs produced today — the current session's live events. */
export function liveLogsToday(logs: AuditLog[]): AuditLog[] {
  const today = todayStartUtc();
  return logs.filter(l => {
    const k = dayStart(l.timestamp);
    return k !== null && k === today;
  });
}

function emptyByModule(): Record<UsageModule, number> {
  const m = {} as Record<UsageModule, number>;
  USAGE_MODULES.forEach(k => { m[k] = 0; });
  return m;
}

/**
 * The real daily series, oldest → anchor. Live events (dated today) are folded
 * into the anchor bucket so this session's work is visible immediately.
 */
export function usageDaysWithLive(logs: AuditLog[]): UsageDay[] {
  const anchor = usageAnchor(logs);
  const today = todayStartUtc();

  const days: UsageDay[] = [];
  for (let offset = USAGE_SERIES_DAYS - 1; offset >= 0; offset--) {
    days.push({
      dayOffset: offset,
      activeUsers: 0, actions: 0, aiConversations: 0, aiMessages: 0, aiEvents: 0,
      reports: 0, bulkReports: 0, downloads: 0,
      byModule: emptyByModule(),
      entries: [],
    });
  }
  const byOffset = new Map<number, UsageDay>(days.map(d => [d.dayOffset, d]));

  /** Offset of a day key relative to the anchor; live (today) collapses to 0. */
  const offsetFor = (key: number): number | null => {
    if (key >= today) return 0;                       // this session's events
    const off = Math.round((anchor - key) / DAY_MS);
    return off >= 0 && off < USAGE_SERIES_DAYS ? off : null;
  };

  // 1. Audit events — actions, actors, modules, downloads.
  for (const l of logs) {
    const key = dayStart(l.timestamp);
    if (key === null) continue;
    const off = offsetFor(key);
    if (off === null) continue;
    const day = byOffset.get(off)!;
    const module = usageModuleFor(l.module, l.entity);
    day.entries.push({
      id: l.id, user: l.user, action: l.action, entity: l.entity,
      module, hour: hourOf(l.timestamp), description: l.description,
      status: l.status,
      workspaceId: l.workspaceId,
      artifact: l.artifact, format: l.format,
      live: key >= today,
    });
    day.actions += 1;
    day.byModule[module] += 1;
    if (l.action === 'Export') day.downloads += 1;
  }

  // 2. Reports — the registries are the source of truth, not the log.
  for (const key of reportDayKeys()) {
    const off = offsetFor(key);
    if (off !== null) byOffset.get(off)!.reports += 1;
  }
  // 2b. Bulk Audit reports — a labelled subset of the same registry, kept apart
  //     for the Bulk Audit rollup (does not add to the reports total above).
  for (const key of bulkReportDayKeys()) {
    const off = offsetFor(key);
    if (off !== null) byOffset.get(off)!.bulkReports += 1;
  }

  // 3. Saved conversations — CHAT_HISTORY. These predate event logging, so
  //    they carry no per-user attribution.
  for (const { key, messages } of chatDayKeys()) {
    const off = offsetFor(key);
    if (off === null) continue;
    const day = byOffset.get(off)!;
    day.aiConversations += 1;
    day.aiMessages += messages;
  }

  // 4. Distinct actors + AI events per day.
  for (const day of days) {
    day.activeUsers = new Set(day.entries.map(e => e.user)).size;
    day.aiEvents = day.entries.filter(isAiEntry).length;
  }

  return days;
}

/** Axis label for a day offset, measured back from the anchor. `logs` is
 *  required: without it the anchor would silently fall back to today and every
 *  axis label would be wrong. */
export function usageDayLabel(offset: number, logs: AuditLog[]): string {
  const anchor = usageAnchor(logs);
  return new Date(anchor - offset * DAY_MS).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Per-user rows — counted straight off the audit events
 * ────────────────────────────────────────────────────────────────────────── */

export interface UserUsageRow {
  user: AdminUser;
  actions: number;
  /** Ask IRA / Concierge log events. 0 until those flows write to the log. */
  aiQueries: number;
  downloads: number;
  topModule: UsageModule;
  moduleCounts: Record<UsageModule, number>;
}

/** Days since the user's last login, from the display string ('Today, 09:14',
 *  'Yesterday', 'Apr 20', 'Never'). */
export function lastLoginOffsetDays(lastLogin: string): number {
  if (!lastLogin || lastLogin === 'Never') return Infinity;
  if (lastLogin.startsWith('Today')) return 0;
  if (lastLogin.startsWith('Yesterday')) return 1;
  const d = new Date(`${lastLogin} ${new Date().getFullYear()}`);
  if (isNaN(d.getTime())) return Infinity;
  if (d.getTime() > Date.now()) d.setFullYear(d.getFullYear() - 1);
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

/**
 * An AI event is a question asked (chat send → Create/Query) or a tool run
 * (Concierge → Run/<tool>). Deliberately NOT every Create in the AI bucket:
 * a tool logs both a `Run` and a `Create` for the artifact it produced, so
 * counting all Creates would double-count one action and read a RACM
 * generation as a question.
 */
/** AI activity = a question asked of the chat, or a Concierge tool run. */
function isAiEntry(e: UsageEntry): boolean {
  if (e.module === 'AI Concierge') return e.action === 'Run';
  if (e.module === 'Ask IRA') return e.action === 'Create' && e.entity === 'Query';
  return false;
}

/** Per-user rows for a window, counted from that window's real events. */
export function userUsageRows(users: AdminUser[], days: UsageDay[]): UserUsageRow[] {
  const entries = days.flatMap(d => d.entries);
  return users.map(user => {
    const mine = entries.filter(e => e.user === user.name);
    const moduleCounts = emptyByModule();
    mine.forEach(e => { moduleCounts[e.module] += 1; });
    const topModule = USAGE_MODULES.reduce(
      (best, m) => (moduleCounts[m] > moduleCounts[best] ? m : best),
      USAGE_MODULES[0],
    );
    return {
      user,
      actions: mine.length,
      aiQueries: mine.filter(isAiEntry).length,
      downloads: mine.filter(e => e.action === 'Export').length,
      topModule,
      moduleCounts,
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Window totals + period-over-period delta
 * ────────────────────────────────────────────────────────────────────────── */

export interface UsageTotals {
  activeUsers: number;
  actions: number;
  /** Saved conversations started in the window. */
  aiConversations: number;
  /** Questions asked + tool runs, from the audit log. */
  aiEvents: number;
  /** Everything AI in the window — the headline figure. */
  aiActivity: number;
  reports: number;
  downloads: number;
}

/** Totals for one window. `activeUsers` counts distinct known members who
 *  actually did something — not everyone whose last login happens to fall in
 *  range, and never the 'Unknown' actor from a failed login. */
export function usageWindowTotals(days: UsageDay[], users: AdminUser[]): UsageTotals {
  const known = new Set(users.map(u => u.name));
  const actors = new Set<string>();
  days.forEach(d => d.entries.forEach(e => { if (known.has(e.user)) actors.add(e.user); }));
  const aiConversations = days.reduce((s, d) => s + d.aiConversations, 0);
  const aiEvents = days.reduce((s, d) => s + d.aiEvents, 0);
  return {
    activeUsers: actors.size,
    actions: days.reduce((s, d) => s + d.actions, 0),
    aiConversations,
    aiEvents,
    aiActivity: aiConversations + aiEvents,
    reports: days.reduce((s, d) => s + d.reports, 0),
    downloads: days.reduce((s, d) => s + d.downloads, 0),
  };
}

/** Percent change vs the prior window; null when there is no prior baseline. */
export function usageDeltaPct(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Bucketing — for the KPI trend bars
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Bucket sizes a person can actually hold in their head. The old bucketing
 * divided the window into 12 equal slices, which made a bar 2.5 days long on
 * the 30-day range — a unit nobody can read off a chart. We now pick a whole
 * number of days from this list instead, so a bar is always "1 day", "3 days",
 * "1 week" or "2 weeks" and the axis can say so.
 */
const BUCKET_SIZES = [1, 2, 3, 7, 14, 30];

/** Days per bar for a window of `dayCount` days, keeping the bar count sane. */
export function bucketSizeFor(dayCount: number, maxBars = 13): number {
  return BUCKET_SIZES.find(s => Math.ceil(dayCount / s) <= maxBars) ?? 30;
}

/** How to say that bucket size out loud. */
export function bucketSizeLabel(size: number): string {
  if (size === 1) return '1 day';
  if (size === 7) return '1 week';
  if (size === 14) return '2 weeks';
  return `${size} days`;
}

/**
 * Split a window into contiguous whole-day buckets, oldest → newest.
 *
 * Buckets are filled from the newest day backwards, so any remainder lands in
 * the *oldest* bucket. The recent bars — the ones people actually read — are
 * therefore always a full bucket wide and comparable with each other.
 */
export function bucketDays(days: UsageDay[], maxBars = 13): UsageDay[][] {
  const size = bucketSizeFor(days.length, maxBars);
  const out: UsageDay[][] = [];
  for (let end = days.length; end > 0; end -= size) {
    out.unshift(days.slice(Math.max(0, end - size), end));
  }
  return out;
}

/**
 * Distinct known members who did anything in a slice.
 *
 * Active users is the one KPI that is *not* additive: summing each day's active
 * count double-counts anyone who worked on more than one day, which would make
 * the trend bars a different — and much larger — quantity than the headline
 * figure above them. Count the people, don't add up the days.
 */
export function distinctActors(days: UsageDay[], users: AdminUser[]): number {
  const known = new Set(users.map(u => u.name));
  const actors = new Set<string>();
  days.forEach(d => d.entries.forEach(e => { if (known.has(e.user)) actors.add(e.user); }));
  return actors.size;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Downloads & exports — real Export events
 * ────────────────────────────────────────────────────────────────────────── */

export type DownloadFormat = 'PDF' | 'CSV' | 'XLSX' | 'DOCX' | 'PPTX' | 'HTML' | 'TXT' | 'JSON';

export interface DownloadEvent {
  id: string;
  user: string;
  item: string;
  format: DownloadFormat;
  dayOffset: number;
  time: string;
  /** True when this came from a real logEvent in the current session. */
  live: boolean;
}

const FORMAT_ALIASES: Record<string, DownloadFormat> = {
  PDF: 'PDF', CSV: 'CSV', XLSX: 'XLSX', DOCX: 'DOCX', PPTX: 'PPTX',
  HTML: 'HTML', TXT: 'TXT', JSON: 'JSON', WORD: 'DOCX', EXCEL: 'XLSX', POWERPOINT: 'PPTX',
};

/** Pull the artifact name + format out of an Export log's description. */
function parseExportLog(description: string, entity: string): { item: string; format: DownloadFormat } {
  const m = description.match(/(?:Exported|Downloaded|Generated) (.+?) (?:as |\()(\w+)/i);
  const format = m ? FORMAT_ALIASES[m[2].toUpperCase()] : undefined;
  if (m && format) {
    const item = m[1];
    return { item: item.charAt(0).toUpperCase() + item.slice(1), format };
  }
  return { item: entity, format: 'CSV' };
}

/** Every Export event in the window, newest first. */
export function recentDownloads(days: UsageDay[], limit = 6): DownloadEvent[] {
  return eventsNewestFirst(days, e => e.action === 'Export')
    .map(({ e, dayOffset }) => ({
      id: e.id,
      user: e.user,
      ...parseExportLog(e.description, e.entity),
      dayOffset,
      time: e.hour === null ? '' : `${String(e.hour).padStart(2, '0')}:00`,
      live: e.live,
    }))
    .slice(0, limit);
}

/** What was downloaded, by area, across the window's Export events.
 *
 * This used to split by file format — PDF 25, XLSX 11, CSV 9. Nobody asks which
 * file extension leads: the format is a property of the click, not of the work.
 * The question an audit lead actually has is *what* is leaving the platform, so
 * the split is by the area each export came out of: reports, workflow results,
 * working papers, RACM matrices. Each Export event already carries its bucket
 * (UsageEntry.module), the same vocabulary the Areas tab uses, so a reader who
 * sees "Workflows 11" here can go find those 11 there. The per-file format is
 * still on each row of the feed, where it describes one real file. */
export function downloadAreaSplit(days: UsageDay[]): { area: UsageModule; count: number }[] {
  const counts = new Map<UsageModule, number>();
  days.forEach(d => d.entries.forEach(e => {
    if (e.action !== 'Export') return;
    counts.set(e.module, (counts.get(e.module) ?? 0) + 1);
  }));
  return [...counts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

/** Flatten a window's entries newest-first, keeping each one's day offset. */
function eventsNewestFirst(
  days: UsageDay[],
  predicate: (e: UsageEntry) => boolean,
): { e: UsageEntry; dayOffset: number }[] {
  const out: { e: UsageEntry; dayOffset: number }[] = [];
  days.forEach(d => d.entries.forEach(e => { if (predicate(e)) out.push({ e, dayOffset: d.dayOffset }); }));
  /* LIVE FIRST, and it has to be explicit.
     Every feed on this page promises that work you do right now appears at the
     top of it. Sorting by (day, hour) alone does not keep that promise: a session
     event folds into the ANCHOR day, so it ties with the seeded events already
     there, and the tie is then broken by clock hour. The seeded anchor-day events
     run to 16:00-18:00, so exporting at 09:00 put your own export below all of
     them — and with the feed capped at six rows it fell off the list entirely.
     The bug hid in plain sight because it depends on the hour you happen to be
     working: the same click appears at the top at 19:00 and vanishes at 09:00. */
  return out.sort((a, b) =>
    Number(b.e.live) - Number(a.e.live)
    || a.dayOffset - b.dayOffset
    || (b.e.hour ?? 0) - (a.e.hour ?? 0));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Drill-downs — all counted from the same entries
 * ────────────────────────────────────────────────────────────────────────── */

export interface UserDayPoint {
  dayOffset: number;
  actions: number;
  aiQueries: number;
}

/** A member's real daily activity across the window. */
export function userDailySeries(row: UserUsageRow, days: UsageDay[]): UserDayPoint[] {
  return days.map(d => {
    const mine = d.entries.filter(e => e.user === row.user.name);
    return {
      dayOffset: d.dayOffset,
      actions: mine.length,
      aiQueries: mine.filter(isAiEntry).length,
    };
  });
}

/** A member's activity split across the modules they actually touched. */
export function fullUserModuleMix(row: UserUsageRow): { module: UsageModule; count: number }[] {
  return USAGE_MODULES
    .map(module => ({ module, count: row.moduleCounts[module] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** The member modal's ranked module list — top 4. */
export function userModuleMix(row: UserUsageRow): { module: UsageModule; count: number }[] {
  return fullUserModuleMix(row).slice(0, 4);
}

export function moduleDailySeries(module: UsageModule, days: UsageDay[]): { dayOffset: number; count: number }[] {
  return days.map(d => ({ dayOffset: d.dayOffset, count: d.byModule[module] }));
}

export function moduleTopUsers(module: UsageModule, rows: UserUsageRow[], top = 3): { name: string; email: string; count: number }[] {
  return rows
    .map(r => ({ r, count: r.moduleCounts[module] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, top)
    .map(x => ({ name: x.r.user.name, email: x.r.user.email, count: x.count }));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Engagement segments
 * ────────────────────────────────────────────────────────────────────────── */

export type EngagementSegment = 'Power' | 'Core' | 'Casual' | 'Dormant';
export const ENGAGEMENT_SEGMENTS: EngagementSegment[] = ['Power', 'Core', 'Casual', 'Dormant'];

export const SEGMENT_LABELS: Record<EngagementSegment, string> = {
  Power: 'Heavy',
  Core: 'Regular',
  Casual: 'Light',
  Dormant: 'No activity',
};

export function activeMeanActions(rows: UserUsageRow[]): number {
  const active = rows.filter(r => r.actions > 0);
  if (active.length === 0) return 0;
  return active.reduce((s, r) => s + r.actions, 0) / active.length;
}

export function segmentFor(row: UserUsageRow, activeMean: number): EngagementSegment {
  if (row.actions <= 0) return 'Dormant';
  if (activeMean <= 0) return 'Casual';
  if (row.actions >= activeMean * 1.5) return 'Power';
  if (row.actions >= activeMean * 0.5) return 'Core';
  return 'Casual';
}

/** A Concierge tool run: a `Run` in the Concierge bucket. Each tool logs under
 *  its own module name ('QR Scanner', 'Font Forensics', …), and they all bucket
 *  to 'AI Concierge' — so this counts the whole rack, not just the launcher. */
const isConciergeRun = (e: UsageEntry) => e.module === 'AI Concierge' && e.action === 'Run';

/** A question typed into the chat. */
const isAskIraQuestion = (e: UsageEntry) =>
  e.module === 'Ask IRA' && e.action === 'Create' && e.entity === 'Query';

/** Concierge tool runs in the window. */
export function aiToolRuns(days: UsageDay[]): number {
  return days.reduce((s, d) => s + d.entries.filter(isConciergeRun).length, 0);
}

function tallyByUser(days: UsageDay[], match: (e: UsageEntry) => boolean) {
  const byUser = new Map<string, number>();
  days.forEach(d => d.entries
    .filter(match)
    .forEach(e => byUser.set(e.user, (byUser.get(e.user) ?? 0) + 1)));
  return [...byUser.entries()]
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count);
}

/** Who ran Concierge tools in the window, busiest first. */
export function conciergeRunners(days: UsageDay[]): { user: string; count: number }[] {
  return tallyByUser(days, isConciergeRun);
}

/* ── The toolkit, tool by tool ──────────────────────────────────────────────
 *
 * A Concierge run names the tool it ran in its `entity` — the seeded history and
 * the live logger (useConciergeJob) both write the tool's catalog title there —
 * so runs join back to CONCIERGE_TOOLS by name, exactly as dashboard events do.
 * Every tool in the catalog is returned, including the ones nobody has ever run:
 * a tool sitting at zero is the finding, and dropping it would hide it. */

/** One run of one tool, with the day it happened on. */
export interface ConciergeRun {
  entry: UsageEntry;
  dayOffset: number;
}

export interface ConciergeToolUsage {
  id: string;
  title: string;
  description: string;
  tags: string[];
  runs: number;
  /** Share of every Concierge run in the window, 0–100. */
  share: number;
  /** Who ran it, busiest first. */
  runners: { user: string; count: number }[];
  /** Day offset of the most recent run — 0 is the anchor. Null when never run. */
  lastRunOffset: number | null;
  /** Runs per day across the window, oldest first — chart-ready. */
  series: { dayOffset: number; count: number }[];
  /** The runs themselves, newest first. */
  recent: ConciergeRun[];
}

export function conciergeToolUsage(days: UsageDay[]): ConciergeToolUsage[] {
  const totalRuns = aiToolRuns(days);
  // Entity → tool. Matched on the lowercased title so a stray capital in a log
  // line can't orphan a run into an unattributable bucket.
  const byName = new Map(CONCIERGE_TOOLS.map(t => [t.title.toLowerCase(), t]));

  const runsByTool = new Map<string, ConciergeRun[]>(CONCIERGE_TOOLS.map(t => [t.id, []]));
  days.forEach(d => d.entries.filter(isConciergeRun).forEach(e => {
    const tool = byName.get(e.entity.toLowerCase());
    if (tool) runsByTool.get(tool.id)!.push({ entry: e, dayOffset: d.dayOffset });
  }));

  return CONCIERGE_TOOLS
    .map(tool => {
      const runs = runsByTool.get(tool.id)!;
      const byUser = new Map<string, number>();
      runs.forEach(r => byUser.set(r.entry.user, (byUser.get(r.entry.user) ?? 0) + 1));

      return {
        id: tool.id,
        title: tool.title,
        description: tool.description,
        tags: tool.tags.map(t => t.label),
        runs: runs.length,
        share: totalRuns > 0 ? Math.round((runs.length / totalRuns) * 100) : 0,
        runners: [...byUser.entries()]
          .map(([user, count]) => ({ user, count }))
          .sort((a, b) => b.count - a.count || a.user.localeCompare(b.user)),
        // Offsets count backwards, so the smallest is the newest.
        lastRunOffset: runs.length > 0 ? Math.min(...runs.map(r => r.dayOffset)) : null,
        series: days.map(d => ({
          dayOffset: d.dayOffset,
          count: runs.filter(r => r.dayOffset === d.dayOffset).length,
        })),
        recent: [...runs].sort(
          (a, b) => a.dayOffset - b.dayOffset || (b.entry.hour ?? 0) - (a.entry.hour ?? 0),
        ),
      };
    })
    .sort((a, b) => b.runs - a.runs || a.title.localeCompare(b.title));
}

/** Members who asked Ask IRA a question in the window, busiest first. */
export function askIraAskers(days: UsageDay[]): { user: string; count: number }[] {
  return tallyByUser(days, isAskIraQuestion);
}

/** Questions asked of Ask IRA in the window (chat sends → `Create` / `Query`). */
export function aiQuestions(days: UsageDay[]): number {
  return days.reduce((s, d) => s + d.entries.filter(isAskIraQuestion).length, 0);
}

/** Share of active members whose activity includes an AI event. */
export function aiAdoptionPct(rows: UserUsageRow[]): number {
  const active = rows.filter(r => r.actions > 0);
  if (active.length === 0) return 0;
  return Math.round((active.filter(r => r.aiQueries > 0).length / active.length) * 100);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Workspaces — the same events, cut by where they happened
 * ────────────────────────────────────────────────────────────────────────── */

export interface WorkspaceUsage {
  workspace: Workspace;
  actions: number;
  /** Distinct known members who did anything in this workspace. */
  members: number;
  /** Questions asked + tool runs, in this workspace. */
  aiEvents: number;
  downloads: number;
  /** Share of all action volume in the window (0-100). */
  sharePct: number;
  /** The module they lean on most here — null when there's no activity at all. */
  topModule: UsageModule | null;
}

/**
 * Usage per workspace, from the workspace stamped on each audit event.
 *
 * The same person shows up in more than one workspace if they work in more than
 * one, so `members` summed across workspaces can exceed the platform's active-user
 * count. That's the point: it answers "who is working in this workspace", not
 * "how do we divide the seats up".
 */
export function workspaceUsage(days: UsageDay[], users: AdminUser[]): WorkspaceUsage[] {
  const known = new Set(users.map(u => u.name));
  const entries = days.flatMap(d => d.entries);
  const total = entries.length;

  return WORKSPACES
    .map(workspace => {
      const mine = entries.filter(e => e.workspaceId === workspace.id);
      const byModule = emptyByModule();
      mine.forEach(e => { byModule[e.module] += 1; });
      const topModule = mine.length === 0
        ? null
        : USAGE_MODULES.reduce((best, m) => (byModule[m] > byModule[best] ? m : best), USAGE_MODULES[0]);

      return {
        workspace,
        actions: mine.length,
        members: new Set(mine.filter(e => known.has(e.user)).map(e => e.user)).size,
        aiEvents: mine.filter(isAiEntry).length,
        downloads: mine.filter(e => e.action === 'Export').length,
        sharePct: total > 0 ? Math.round((mine.length / total) * 100) : 0,
        topModule,
      };
    })
    .sort((a, b) => b.actions - a.actions);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Spikes & concentration
 * ────────────────────────────────────────────────────────────────────────── */

export interface UsageSpike {
  dayOffset: number;
  actions: number;
  ratio: number;
  topModule: UsageModule;
}

/**
 * What counts as an "odd day" in this window (PRD §7.1: "a day well above the
 * normal level for that window").
 *
 * THE NORMAL LEVEL IS THE LEVEL OF A WORKING DAY. The mean and the standard
 * deviation are taken over days on which work actually happened — not over every
 * day on the calendar.
 *
 * This was the bug that made the whole feature dead. A GRC team works weekdays,
 * so roughly two days in seven are zero. Counting those zeros as VARIANCE is
 * counting the weekend as if it were surprising, and it inflates sigma enormously:
 * on the seeded tenant it took sigma from 1.5 to 11.3, which pushed the threshold
 * from 28 actions to 41 — while the busiest day the platform actually has is 32.
 * The detector could not fire. Not "did not" — could not, arithmetically, for any
 * possible day.
 *
 * The weekly cycle is exactly the seasonality the 7-day rolling average on the
 * chart exists to cancel, and the weekend shading exists to explain. It is not
 * signal, and it must not be fed into a test for signal.
 *
 * Exported so `usageSpikes` (which lists the odd days) and `activityPoints`
 * (which marks them on the chart) compute the SAME threshold. They used to each
 * carry their own copy of this arithmetic, which is the standard way two parts of
 * a page end up disagreeing about which day was strange.
 */
interface DayStats { threshold: number; mean: number }

const dayStats = (subset: UsageDay[]): DayStats | null => {
  // Under three days of a kind there is no distribution to speak of, and the
  // biggest of three is not an anomaly — it is just the biggest of three.
  if (subset.length < 3) return null;
  const mean = subset.reduce((s, d) => s + d.actions, 0) / subset.length;
  if (mean <= 0) return null;
  const variance = subset.reduce((s, d) => s + (d.actions - mean) ** 2, 0) / subset.length;
  return { threshold: mean + 2 * Math.sqrt(variance), mean };
};

/**
 * The odd-day test (PRD §7.1: "a day well above the normal level for that
 * window").
 *
 * A DAY IS ODD RELATIVE TO ITS OWN KIND OF DAY. Weekdays are judged against
 * weekdays, weekends against weekends.
 *
 * This is the third version of this function, and the first that can actually
 * fire. The story is worth keeping, because both failures were the same mistake:
 *
 *   1. The original took mean + 2σ across every day on the calendar. A GRC team
 *      barely works weekends, so the real 30-day series looks like
 *      `22 28 25 25 21 · 3 3 · 19 21 25 23 20 · 3 0 · …`. Those weekend troughs
 *      are not noise around a mean — they are a SECOND POPULATION, and mixing
 *      them in inflates σ to 8.6 and pushes the bar to 35 actions. The busiest
 *      day the platform has is 29. The detector could not fire. Not "did not" —
 *      could not, for any day that can physically occur.
 *   2. The first fix dropped days with zero actions, on the theory the weekends
 *      were zeros. They are not: they are 2, 3, 4, 8. That removed exactly one
 *      day out of thirty and left the bar at 35. Still dead.
 *
 * The weekly cycle is seasonality, and this page already knows it: the chart
 * shades the weekends to explain the dips, and lays a 7-day rolling average over
 * the bars precisely to cancel it. The spike test was the one place still
 * pretending Tuesday and Sunday were samples of the same thing.
 *
 * Judged properly, a weekday of 29 against a weekday normal of ~23 IS odd — and
 * so is a Saturday of 8 against a weekend normal of ~3, which no global threshold
 * could ever have surfaced and which is exactly the out-of-hours signal an auditor
 * cares about.
 */
export function oddDayTest(days: UsageDay[], logs: AuditLog[]) {
  const anchor = usageAnchor(logs);
  // Walked back from the same anchor the chart's weekend shading uses, with the
  // same local `getDay()` — so a day the chart shades as a weekend is a day this
  // test judges as one. Two spellings of "is it the weekend" is how a ring ends
  // up on a bar the shading says is a Tuesday.
  const isWeekend = (d: UsageDay) => {
    const dow = new Date(anchor - d.dayOffset * DAY_MS).getDay();
    return dow === 0 || dow === 6;
  };

  const weekend = dayStats(days.filter(isWeekend));
  const weekday = dayStats(days.filter(d => !isWeekend(d)));
  const statsFor = (d: UsageDay) => (isWeekend(d) ? weekend : weekday);

  return {
    isOdd: (d: UsageDay) => {
      const s = statsFor(d);
      return s !== null && d.actions > s.threshold;
    },
    /** What a normal day of THIS day's kind looks like — the ratio's denominator. */
    normalFor: (d: UsageDay) => statsFor(d)?.mean ?? 0,
  };
}

export function usageSpikes(days: UsageDay[], logs: AuditLog[]): UsageSpike[] {
  const test = oddDayTest(days, logs);
  return days
    .filter(test.isOdd)
    .map(d => {
      const normal = test.normalFor(d);
      return {
        dayOffset: d.dayOffset,
        actions: d.actions,
        // "1.3x a normal day" — where a normal day means a normal day OF THIS KIND.
        // Measured against a blended weekday/weekend mean, a busy Tuesday looks
        // more extreme than it is, and a worked Saturday looks like nothing.
        ratio: normal > 0 ? Math.round((d.actions / normal) * 10) / 10 : 0,
        topModule: USAGE_MODULES.reduce((best, m) => (d.byModule[m] > d.byModule[best] ? m : best), USAGE_MODULES[0]),
      };
    })
    .sort((a, b) => b.actions - a.actions);
}

/** Share of all member activity the top N members account for (0-100). */
export function activityConcentration(rows: UserUsageRow[], topN = 3): number | null {
  const total = rows.reduce((s, r) => s + r.actions, 0);
  if (total === 0) return null;
  const top = [...rows].sort((a, b) => b.actions - a.actions).slice(0, topN)
    .reduce((s, r) => s + r.actions, 0);
  return Math.round((top / total) * 100);
}

/* ──────────────────────────────────────────────────────────────────────────
 * What got created / run / shared — real Create, Run and Share events
 * ────────────────────────────────────────────────────────────────────────── */

export interface CreationKind {
  key: 'workflows' | 'dashboards' | 'racms' | 'engagements' | 'reports';
  label: string;
  /** AuditLog.entity values that count as this kind (with action 'Create'). */
  entities: string[];
}

export const CREATION_KINDS: CreationKind[] = [
  { key: 'workflows', label: 'Workflows', entities: ['Workflow'] },
  { key: 'dashboards', label: 'Dashboards', entities: ['Dashboard'] },
  { key: 'racms', label: 'RACMs', entities: ['RACM', 'RACM Mapping'] },
  { key: 'engagements', label: 'Engagements', entities: ['Engagement'] },
  // Reports come from the registries, so this card and the Reports KPI agree.
  { key: 'reports', label: 'Reports', entities: ['Report'] },
];

export interface CreationTotal {
  kind: CreationKind;
  count: number;
  /** The same count in the previous window — so a caller can total the deltas
   *  rather than re-deriving them (a % of a % does not add up). */
  prior: number;
  deltaPct: number | null;
}

function createdCount(kind: CreationKind, days: UsageDay[]): number {
  if (kind.key === 'reports') return days.reduce((s, d) => s + d.reports, 0);
  return days.reduce(
    (s, d) => s + d.entries.filter(e => e.action === 'Create' && kind.entities.includes(e.entity)).length,
    0,
  );
}

export function creationTotals(days: UsageDay[], priorDays: UsageDay[]): CreationTotal[] {
  return CREATION_KINDS.map(kind => {
    const count = createdCount(kind, days);
    const prior = createdCount(kind, priorDays);
    return { kind, count, prior, deltaPct: usageDeltaPct(count, prior) };
  });
}

export interface CreationEvent {
  id: string;
  user: string;
  item: string;
  kindLabel: string;
  dayOffset: number;
  time: string;
  live: boolean;
}

export function recentCreations(days: UsageDay[], limit = 6): CreationEvent[] {
  const labelByEntity = new Map<string, string>();
  CREATION_KINDS.forEach(k => k.entities.forEach(e => labelByEntity.set(e, k.label)));
  return eventsNewestFirst(days, e => e.action === 'Create' && labelByEntity.has(e.entity))
    .map(({ e, dayOffset }) => ({
      id: e.id,
      user: e.user,
      item: e.description.replace(/^Created /, ''),
      kindLabel: labelByEntity.get(e.entity)!,
      dayOffset,
      time: e.hour === null ? '' : `${String(e.hour).padStart(2, '0')}:00`,
      live: e.live,
    }))
    .slice(0, limit);
}

export type RunArea = 'Workflow Library' | 'Engagements' | 'IRA tools';
export const RUN_AREAS: RunArea[] = ['Workflow Library', 'Engagements', 'IRA tools'];

function runAreaFor(module: UsageModule): RunArea {
  if (module === 'Ask IRA') return 'IRA tools';
  if (module === 'Workflows') return 'Workflow Library';
  return 'Engagements';
}

export interface RunTotals {
  total: number;
  deltaPct: number | null;
  byArea: { area: RunArea; count: number }[];
}

function runsIn(days: UsageDay[]): UsageEntry[] {
  return days.flatMap(d => d.entries).filter(e => e.action === 'Run');
}

export function workflowRunTotals(days: UsageDay[], priorDays: UsageDay[]): RunTotals {
  const runs = runsIn(days);
  const byArea = RUN_AREAS.map(area => ({
    area,
    count: runs.filter(e => runAreaFor(e.module) === area).length,
  }));
  return {
    total: runs.length,
    deltaPct: usageDeltaPct(runs.length, runsIn(priorDays).length),
    byArea,
  };
}

export interface RunEvent {
  id: string;
  user: string;
  item: string;
  area: RunArea;
  dayOffset: number;
  time: string;
  live: boolean;
}

export function recentRuns(days: UsageDay[], limit = 5): RunEvent[] {
  return eventsNewestFirst(days, e => e.action === 'Run')
    .map(({ e, dayOffset }) => ({
      id: e.id,
      user: e.user,
      item: e.description.replace(/^./, c => c.toLowerCase()),
      area: runAreaFor(e.module),
      dayOffset,
      time: e.hour === null ? '' : `${String(e.hour).padStart(2, '0')}:00`,
      live: e.live,
    }))
    .slice(0, limit);
}

/* ── Bulk Audit rollup ──────────────────────────────────────────────────────
   Bulk Audit is not a module — it is a way of working that shows up in two
   places: reports generated from a bulk run (tagged "Bulk Audit" in the report
   registry) and the bulk runs themselves (logged as a 'Run' on a 'Bulk Run'
   entity). Neither the Reports figure nor the Workflow-runs figure names it, so
   an audit lead asking "how much of this was bulk" had nowhere to look. This
   rolls the two halves into one number without moving them out of the totals
   they already belong to — a bulk run is still a workflow run, a bulk report is
   still a report; this is a lens over them, not a new bucket. */
export interface BulkAuditActivity {
  /** "Bulk Audit"–tagged reports generated in the window. */
  reports: number;
  /** Bulk runs kicked off in the window. */
  runs: number;
  /** reports + runs — the headline. */
  total: number;
  deltaPct: number | null;
}

function bulkCounts(days: UsageDay[]): { reports: number; runs: number } {
  return {
    reports: days.reduce((s, d) => s + d.bulkReports, 0),
    runs: days.flatMap(d => d.entries).filter(e => e.action === 'Run' && e.entity === 'Bulk Run').length,
  };
}

export function bulkAuditActivity(days: UsageDay[], priorDays: UsageDay[]): BulkAuditActivity {
  const { reports, runs } = bulkCounts(days);
  const prior = bulkCounts(priorDays);
  const total = reports + runs;
  return { reports, runs, total, deltaPct: usageDeltaPct(total, prior.reports + prior.runs) };
}

export const SHARE_KINDS = ['Reports', 'Dashboards', 'RACMs', 'Workflows', 'Other'] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

function shareKindFor(entity: string): ShareKind {
  switch (entity) {
    case 'Report': return 'Reports';
    case 'Dashboard': return 'Dashboards';
    case 'RACM': case 'RACM Mapping': return 'RACMs';
    case 'Workflow': return 'Workflows';
    default: return 'Other';
  }
}

export interface ShareTotals {
  total: number;
  deltaPct: number | null;
  byKind: { kind: ShareKind; count: number }[];
}

function sharesIn(days: UsageDay[]): UsageEntry[] {
  return days.flatMap(d => d.entries).filter(e => e.action === 'Share');
}

export function shareTotals(days: UsageDay[], priorDays: UsageDay[]): ShareTotals {
  const shares = sharesIn(days);
  return {
    total: shares.length,
    deltaPct: usageDeltaPct(shares.length, sharesIn(priorDays).length),
    byKind: SHARE_KINDS.map(kind => ({
      kind,
      count: shares.filter(e => shareKindFor(e.entity) === kind).length,
    })),
  };
}

export interface ShareEvent {
  id: string;
  user: string;
  item: string;
  kind: ShareKind;
  dayOffset: number;
  time: string;
  live: boolean;
}

export function recentShares(days: UsageDay[], limit = 5): ShareEvent[] {
  return eventsNewestFirst(days, e => e.action === 'Share')
    .map(({ e, dayOffset }) => ({
      id: e.id,
      user: e.user,
      item: e.description.replace(/^./, c => c.toLowerCase()),
      kind: shareKindFor(e.entity),
      dayOffset,
      time: e.hour === null ? '' : `${String(e.hour).padStart(2, '0')}:00`,
      live: e.live,
    }))
    .slice(0, limit);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Activity rhythm — weekday x hour heatmap, from real clock times only
 * ────────────────────────────────────────────────────────────────────────── */

export const USAGE_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface UsageHeatmapData {
  /** matrix[dow][hour], dow in JS getDay() order (0 = Sunday). */
  matrix: number[][];
  max: number;
  /** Cells summed. ≤ the window's action total: date-only records have no hour. */
  total: number;
  /** Events with no clock time, therefore not placed on the grid. */
  untimed: number;
}

/** Real weekday × hour rhythm. Events without a clock time are reported
 *  separately rather than smeared across the grid. */
export function usageHourlyMatrix(days: UsageDay[], logs: AuditLog[]): UsageHeatmapData {
  const anchor = usageAnchor(logs);
  const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let untimed = 0;

  days.forEach(day => {
    const dow = new Date(anchor - day.dayOffset * DAY_MS).getUTCDay();
    day.entries.forEach(e => {
      if (e.hour === null) { untimed += 1; return; }
      matrix[dow][e.hour] += 1;
    });
  });

  const max = Math.max(1, ...matrix.flat());
  const total = matrix.flat().reduce((s, v) => s + v, 0);
  return { matrix, max, total, untimed };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Seats & lifecycle — from the member records
 * ────────────────────────────────────────────────────────────────────────── */

export interface SeatBuckets {
  total: number;
  activeInRange: AdminUser[];
  /** Active status but no login for 30+ days. */
  dormant: AdminUser[];
  invited: AdminUser[];
  suspendedOrInactive: AdminUser[];
}

export function seatBuckets(users: AdminUser[], rangeDays: number): SeatBuckets {
  return {
    total: users.length,
    activeInRange: users.filter(u => u.status !== 'Invited' && lastLoginOffsetDays(u.lastLogin) <= rangeDays),
    dormant: users.filter(u => u.status === 'Active' && lastLoginOffsetDays(u.lastLogin) > 30),
    invited: users.filter(u => u.status === 'Invited'),
    suspendedOrInactive: users.filter(u => u.status === 'Suspended' || u.status === 'Locked' || u.status === 'Inactive'),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Adoption — the licence questions, in Amplitude's vocabulary
 *
 * Three questions an admin of a seat-licensed tenant actually has: who is using
 * this, is it worth the licence, and what should I fix. The metrics below are
 * lifted from Amplitude's analytics model, with one deliberate departure.
 *
 * ## The departure: no DAU/MAU stickiness ratio
 *
 * Amplitude also defines stickiness as DAU/MAU, and we do NOT show it. That
 * ratio only means something for a product with a natural *daily* cadence. This
 * is a workweek product — auditors work in engagement and quarter-close bursts —
 * so the ratio is pinned low by the shape of the work, not by any failure, and
 * it never moves. Worse, its denominator is MAU: roll the tool out to more
 * people successfully and the ratio gets *worse*. A number that punishes you for
 * succeeding is not a number to put on an admin page.
 *
 * What replaces it is Amplitude's other, better stickiness definition — the
 * count of distinct days a user did something real — read as a distribution
 * rather than averaged into a ratio. A tenant with 5 power users and 12 dead
 * seats and a tenant with 17 mediocre ones produce the same ratio and completely
 * different histograms, and only one of them tells you who to call.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The critical event: did this person do real work?
 *
 * Amplitude is explicit that "active" must be gated on a completed unit of value,
 * never on a login — a login-level definition tells you someone opened the door,
 * not that the product did anything for them. Everything this platform logs is a
 * completed action (a control tested, a report exported, a risk raised) except
 * the session events, so the rule is simply: signing in is not using it.
 */
export function isValueEvent(e: UsageEntry): boolean {
  return e.entity !== 'Session';
}

/** Seats that did real work in the window, over seats we are paying for. */
export interface LicenceUse {
  /** Seats with at least one value event. */
  used: number;
  /** Every seat on the bill — including invites nobody has accepted. */
  total: number;
  pct: number;
  /** Paid-for seats with no value event in the window. */
  idle: AdminUser[];
}

export function licenceUse(days: UsageDay[], users: AdminUser[]): LicenceUse {
  const workers = new Set(
    days.flatMap(d => d.entries).filter(isValueEvent).map(e => e.user),
  );
  const idle = users.filter(u => !workers.has(u.name));
  const used = users.length - idle.length;
  return {
    used,
    total: users.length,
    pct: users.length > 0 ? Math.round((used / users.length) * 100) : 0,
    idle,
  };
}

/* ── The power-user curve ─────────────────────────────────────────────────── */

export interface PowerBucket {
  label: string;
  /** Inclusive day-count range this bucket covers. */
  min: number;
  max: number;
  seats: AdminUser[];
  /** Seats active on at least `min` days — the cumulative reading. */
  atLeast: number;
}

export interface PowerCurve {
  buckets: PowerBucket[];
  /** Days in the window the curve is measured over (Amplitude's L7 / L28). */
  windowDays: number;
  /** Distinct days of real work, per member. */
  daysActive: Map<string, number>;
  /** Seats at the bottom of the curve — one day of work or none at all. */
  reclaim: AdminUser[];
  /** Seats at the top — active on at least half the window. */
  committed: AdminUser[];
}

/** Bucket edges. Kept coarse: with a tenant-sized seat count a bar per day-count
 *  would be 28 mostly-empty bars, and the shape is what carries the meaning. */
const POWER_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0', min: 0, max: 0 },
  { label: '1–2', min: 1, max: 2 },
  { label: '3–5', min: 3, max: 5 },
  { label: '6–9', min: 6, max: 9 },
  { label: '10–14', min: 10, max: 14 },
  { label: '15–19', min: 15, max: 19 },
  { label: '20+', min: 20, max: Infinity },
];

/**
 * How many distinct days each seat did real work, as a distribution.
 *
 * This is Amplitude's stickiness chart — "X days out of N" — and the reason it is
 * a histogram rather than an average is that the shape is the whole point. The
 * left spike is the licence you are wasting; the right spike is the people the
 * licence is for.
 */
export function powerCurve(days: UsageDay[], users: AdminUser[]): PowerCurve {
  const known = new Set(users.map(u => u.name));

  const daysActive = new Map<string, number>();
  users.forEach(u => daysActive.set(u.name, 0));
  days.forEach(d => {
    const worked = new Set(
      d.entries.filter(e => isValueEvent(e) && known.has(e.user)).map(e => e.user),
    );
    worked.forEach(name => daysActive.set(name, (daysActive.get(name) ?? 0) + 1));
  });

  const buckets: PowerBucket[] = POWER_BUCKETS.map(b => {
    const seats = users.filter(u => {
      const n = daysActive.get(u.name) ?? 0;
      return n >= b.min && n <= b.max;
    });
    const atLeast = users.filter(u => (daysActive.get(u.name) ?? 0) >= b.min).length;
    return { ...b, seats, atLeast };
  });

  const half = Math.max(1, Math.ceil(days.length / 2));
  return {
    buckets,
    windowDays: days.length,
    daysActive,
    reclaim: users.filter(u => (daysActive.get(u.name) ?? 0) <= 1),
    committed: users.filter(u => (daysActive.get(u.name) ?? 0) >= half),
  };
}

/* ── The engagement matrix ────────────────────────────────────────────────── */

export type MatrixQuadrant = 'core' | 'power' | 'onboarding' | 'shelfware';

export interface MatrixPoint {
  module: UsageModule;
  /** Share of *licensed seats* who touched this module at least once (0–100).
   *  Amplitude normalises breadth against monthly actives; against seats is the
   *  honest denominator for a licence question — a module nobody outside the
   *  power users has opened is shelfware even if every active user opened it. */
  breadth: number;
  /** Average events in this module among the people who used it at all. */
  frequency: number;
  users: number;
  events: number;
  quadrant: MatrixQuadrant;
}

/* Plain names, not the analytics ones.
   These four boxes are Amplitude's engagement matrix, and its vocabulary is
   "core / power / onboarding / shelfware". The reader here is an audit lead, not
   a product analyst: "shelfware" is the single most important box on the chart
   and it is a word they have no reason to know. Every label is now what the box
   actually means, said in the words someone would use out loud. */
export const QUADRANT_LABEL: Record<MatrixQuadrant, string> = {
  core: 'Everyday: most people use it, and use it a lot',
  power: 'Specialist: a few people lean on it hard',
  onboarding: 'Set up once: most people touch it and move on',
  shelfware: 'Barely used: few people, and not much',
};

/** The one-word name for each box, for the legend and the axes. */
export const QUADRANT_NAME: Record<MatrixQuadrant, string> = {
  core: 'Everyday',
  power: 'Specialist',
  onboarding: 'Set up once',
  shelfware: 'Barely used',
};

/**
 * Every module placed on breadth × frequency, the way Amplitude's Engagement
 * Matrix places features. It is a feature audit: the bottom-left quadrant is the
 * part of the product nobody adopted, which for a licensed tenant is the part
 * you are paying for and not using.
 *
 * Quadrants split at the midpoint of each axis rather than at a fixed threshold,
 * so the read is "relative to the rest of this platform" — which is the only
 * comparison that means anything without an industry benchmark.
 */
export function engagementMatrix(days: UsageDay[], users: AdminUser[]): {
  points: MatrixPoint[];
  breadthMid: number;
  frequencyMid: number;
} {
  const known = new Set(users.map(u => u.name));
  const seats = Math.max(1, users.length);
  const entries = days.flatMap(d => d.entries).filter(e => isValueEvent(e) && known.has(e.user));

  const raw = USAGE_MODULES.map(module => {
    const mine = entries.filter(e => e.module === module);
    const people = new Set(mine.map(e => e.user));
    return {
      module,
      events: mine.length,
      users: people.size,
      breadth: Math.round((people.size / seats) * 100),
      frequency: people.size > 0 ? Math.round((mine.length / people.size) * 10) / 10 : 0,
    };
  })
    // A module with no events has no frequency — it can't be placed on the axis,
    // and plotting it at the origin would drag both midpoints down and quietly
    // reclassify the real modules around it. Absent is not the same as unused.
    .filter(r => r.events > 0);

  // Split on the median, not the midpoint of the range. One runaway module (a
  // Reports at 65% breadth) drags a min/max midpoint far enough right that
  // half the platform falls into "shelfware" — and "improve or drop six of your
  // twelve modules" is not a finding, it's noise. The median splits each axis
  // down the middle of the modules that actually exist, which is what makes the
  // bottom-left quadrant small enough to act on.
  const mid = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const breadthMid = mid(raw.map(r => r.breadth));
  const frequencyMid = mid(raw.map(r => r.frequency));

  const points: MatrixPoint[] = raw.map(r => {
    const wide = r.breadth >= breadthMid;
    const often = r.frequency >= frequencyMid;
    const quadrant: MatrixQuadrant = wide && often ? 'core'
      : !wide && often ? 'power'
      : wide && !often ? 'onboarding'
      : 'shelfware';
    return { ...r, quadrant };
  });

  return { points, breadthMid, frequencyMid };
}
