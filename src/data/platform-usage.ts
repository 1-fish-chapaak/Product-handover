/**
 * Platform Usage — derived entirely from the platform's real records.
 *
 * There is no synthetic history here. Every number on the Platform Usage page
 * traces back to something the platform actually stores:
 *
 *   · actions / activeUsers / downloads / byModule  ← the audit log (AuditLog[])
 *   · reports                                       ← GENERATED_REPORTS + ATR_LIBRARY
 *   · aiQueries                                     ← CHAT_HISTORY (saved conversations)
 *
 * ## The anchor
 *
 * Without a backend the seeded records are fixed in the past (the newest audit
 * event is Apr 2026). Measuring "last 30 days" against wall-clock time would
 * therefore render every tile as 0. Instead day-offset 0 is the **anchor**: the
 * most recent real record in the data set. Windows run backwards from there and
 * the page labels itself "Data as of <anchor>".
 *
 * Events logged during *this session* are folded into the anchor bucket, so an
 * action you take right now still shows up. The anchor itself never moves —
 * otherwise a single click would slide the whole window and empty it.
 *
 * ## Known gaps (real, not hidden)
 *
 * Nothing on the platform writes an audit event for Ask IRA or the Concierge
 * tools, so per-member AI attribution is unavailable: `UserUsageRow.aiQueries`
 * counts Ask IRA log events, which is 0 until those flows call `logEvent`.
 * Platform-wide AI volume comes from CHAT_HISTORY instead. Report and chat
 * records carry a date but no clock time, so they are excluded from the
 * weekday×hour rhythm heatmap, whose total is therefore ≤ the action total.
 */

import type { AdminUser, AuditLog } from '../context/AdminDataContext';
import { GENERATED_REPORTS, CHAT_HISTORY } from './mockData';
import { ATR_LIBRARY } from './atrLibrary';

/* ── Modules the breakdown reports on ── */
export const USAGE_MODULES = [
  'Ask IRA',
  'Reports',
  'Engagements',
  'Workflows',
  'Dashboards',
  'Knowledge Hub',
  'Risk & Controls',
  'Admin',
] as const;
export type UsageModule = (typeof USAGE_MODULES)[number];

/** Map an AuditLog.module string onto a usage bucket. */
export function usageModuleFor(logModule: string): UsageModule {
  switch (logModule) {
    // Concierge tools count as AI usage — the PRD defines AI queries as
    // "Ask IRA and Concierge events".
    case 'Ask IRA': case 'Chat': case 'AI Concierge': return 'Ask IRA';
    case 'Report': case 'Reports': return 'Reports';
    case 'Engagements': case 'Engagement Execution': case 'SOX ICFR': return 'Engagements';
    case 'Workflow Library': case 'Workflows': return 'Workflows';
    case 'Dashboard': case 'Dashboards': return 'Dashboards';
    case 'Knowledge Hub': case 'Data Sources': return 'Knowledge Hub';
    case 'Admin': return 'Admin';
    // Process Hub, RACM, Control Library, Risk Register, Exceptions, …
    default: return 'Risk & Controls';
  }
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

/** Human label for the anchor, e.g. "Apr 19, 2026". */
export function usageAnchorLabel(logs: AuditLog[]): string {
  return new Date(usageAnchor(logs)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
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
      reports: 0, downloads: 0,
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
    const module = usageModuleFor(l.module);
    day.entries.push({
      id: l.id, user: l.user, action: l.action, entity: l.entity,
      module, hour: hourOf(l.timestamp), description: l.description,
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
function isAiEntry(e: UsageEntry): boolean {
  if (e.module !== 'Ask IRA') return false;
  return e.action === 'Run' || (e.action === 'Create' && e.entity === 'Query');
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
      live: dayOffset === 0,
    }))
    .slice(0, limit);
}

/** Real format mix across the window's Export events. */
export function downloadFormatSplit(days: UsageDay[]): { format: DownloadFormat; count: number }[] {
  const counts = new Map<DownloadFormat, number>();
  days.forEach(d => d.entries.forEach(e => {
    if (e.action !== 'Export') return;
    const { format } = parseExportLog(e.description, e.entity);
    counts.set(format, (counts.get(format) ?? 0) + 1);
  }));
  return [...counts.entries()]
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);
}

/** Flatten a window's entries newest-first, keeping each one's day offset. */
function eventsNewestFirst(
  days: UsageDay[],
  predicate: (e: UsageEntry) => boolean,
): { e: UsageEntry; dayOffset: number }[] {
  const out: { e: UsageEntry; dayOffset: number }[] = [];
  days.forEach(d => d.entries.forEach(e => { if (predicate(e)) out.push({ e, dayOffset: d.dayOffset }); }));
  return out.sort((a, b) => a.dayOffset - b.dayOffset || (b.e.hour ?? 0) - (a.e.hour ?? 0));
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

/** The drawer's ranked module list — top 4. */
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

/** Concierge / Ask IRA tool runs in the window (audit `Run` events). */
export function aiToolRuns(days: UsageDay[]): number {
  return days.reduce(
    (s, d) => s + d.entries.filter(e => e.module === 'Ask IRA' && e.action === 'Run').length,
    0,
  );
}

/** Questions asked of Ask IRA in the window (chat sends → `Create` / `Query`). */
export function aiQuestions(days: UsageDay[]): number {
  return days.reduce(
    (s, d) => s + d.entries.filter(e => e.module === 'Ask IRA' && e.action === 'Create' && e.entity === 'Query').length,
    0,
  );
}

/** Share of active members whose activity includes an AI event. */
export function aiAdoptionPct(rows: UserUsageRow[]): number {
  const active = rows.filter(r => r.actions > 0);
  if (active.length === 0) return 0;
  return Math.round((active.filter(r => r.aiQueries > 0).length / active.length) * 100);
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

export function usageSpikes(days: UsageDay[]): UsageSpike[] {
  const active = days.filter(d => d.actions > 0);
  if (active.length < 3) return [];
  const mean = days.reduce((s, d) => s + d.actions, 0) / days.length;
  if (mean <= 0) return [];
  const variance = days.reduce((s, d) => s + (d.actions - mean) ** 2, 0) / days.length;
  const threshold = mean + 2 * Math.sqrt(variance);
  return days
    .filter(d => d.actions > threshold)
    .map(d => ({
      dayOffset: d.dayOffset,
      actions: d.actions,
      ratio: Math.round((d.actions / mean) * 10) / 10,
      topModule: USAGE_MODULES.reduce((best, m) => (d.byModule[m] > d.byModule[best] ? m : best), USAGE_MODULES[0]),
    }))
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
    return { kind, count, deltaPct: usageDeltaPct(count, createdCount(kind, priorDays)) };
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
      live: dayOffset === 0,
    }))
    .slice(0, limit);
}

export type RunArea = 'Workflow Library' | 'Engagements' | 'AI tools';
export const RUN_AREAS: RunArea[] = ['Workflow Library', 'Engagements', 'AI tools'];

function runAreaFor(module: UsageModule): RunArea {
  if (module === 'Ask IRA') return 'AI tools';
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
      live: dayOffset === 0,
    }))
    .slice(0, limit);
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
      live: dayOffset === 0,
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
