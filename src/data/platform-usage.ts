/**
 * Platform Usage — seeded adoption metrics + live-session fold-in.
 *
 * A deterministic 90-day usage history (seeded PRNG, so numbers survive
 * reloads) that the Platform Usage view renders, plus helpers that fold the
 * current session's real audit-log events into today's bucket — so actions
 * you take right now show up in today's numbers. Same demo-data contract as
 * the Audit Log seeds: no backend, but internally consistent.
 */

import type { AdminUser, AuditLog } from '../context/AdminDataContext';

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

/** Relative share of daily activity each module gets in the seed. */
const MODULE_WEIGHTS: Record<UsageModule, number> = {
  'Ask IRA': 0.24,
  'Engagements': 0.16,
  'Reports': 0.14,
  'Workflows': 0.13,
  'Dashboards': 0.10,
  'Knowledge Hub': 0.09,
  'Risk & Controls': 0.09,
  'Admin': 0.05,
};

/** Map an AuditLog.module string onto a usage bucket (live fold-in). */
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

export interface UsageDay {
  /** Days ago: 0 = today, 89 = oldest. */
  dayOffset: number;
  /** People who did anything that day. */
  activeUsers: number;
  /** Total logged actions across the platform. */
  actions: number;
  /** Ask IRA / Concierge queries (subset of actions). */
  aiQueries: number;
  /** Reports generated that day (subset of actions). */
  reports: number;
  /** Files downloaded / exported that day (subset of actions). */
  downloads: number;
  byModule: Record<UsageModule, number>;
}

/* ── Deterministic PRNG (mulberry32) — same numbers on every reload ── */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small string hash — stable per-user seed from an email. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Longest visible range (the 90-day chip). */
export const USAGE_RANGE_DAYS = 90;
/** Seed length — twice the longest range, so every visible window has a full
 *  equal-length prior window for period-over-period deltas. */
export const USAGE_SEED_DAYS = 180;

/** The seeded daily series, oldest → today. Built once at module init. */
export const USAGE_DAYS: UsageDay[] = (() => {
  const rnd = mulberry32(0x1ea7f00d);
  const days: UsageDay[] = [];
  // Today's real weekday anchors the weekday/weekend rhythm.
  const todayDow = new Date().getDay();
  for (let offset = USAGE_SEED_DAYS - 1; offset >= 0; offset--) {
    const dow = ((todayDow - (offset % 7)) + 7) % 7;
    const weekend = dow === 0 || dow === 6;
    // Gentle adoption ramp: older days run at ~60% of current volume.
    const ramp = 0.6 + 0.4 * ((USAGE_SEED_DAYS - offset) / USAGE_SEED_DAYS);
    const base = weekend ? 14 + rnd() * 14 : 70 + rnd() * 70;
    const actions = Math.round(base * ramp);
    const activeUsers = weekend
      ? 1 + Math.floor(rnd() * 3)
      : 4 + Math.floor(rnd() * 5);
    const aiQueries = Math.round(actions * (0.24 + rnd() * 0.12));
    const reports = Math.round(actions * (0.05 + rnd() * 0.05));
    const downloads = Math.round(actions * (0.06 + rnd() * 0.06));
    const byModule = {} as Record<UsageModule, number>;
    let assigned = 0;
    USAGE_MODULES.forEach((m, i) => {
      if (i === USAGE_MODULES.length - 1) {
        byModule[m] = Math.max(0, actions - assigned);
        return;
      }
      const jitter = 0.75 + rnd() * 0.5;
      const n = Math.min(actions - assigned, Math.round(actions * MODULE_WEIGHTS[m] * jitter));
      byModule[m] = Math.max(0, n);
      assigned += byModule[m];
    });
    days.push({ dayOffset: offset, activeUsers, actions, aiQueries, reports, downloads, byModule });
  }
  return days;
})();

/** Axis label for a day offset (e.g. "Jun 12"). */
export function usageDayLabel(offset: number): string {
  const d = new Date(Date.now() - offset * 86400000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Live fold-in — today's real session events on top of the seed
 * ────────────────────────────────────────────────────────────────────────── */

function todayStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Logs produced today (the seeds are dated months back, so today = live). */
export function liveLogsToday(logs: AuditLog[]): AuditLog[] {
  const today = todayStamp();
  return logs.filter(l => l.timestamp.startsWith(today));
}

/** A live event that counts as an AI query: a question asked or a tool run in
 *  the Ask IRA bucket — not exports/renames of chat artifacts. */
function isAiQuery(l: AuditLog): boolean {
  return usageModuleFor(l.module) === 'Ask IRA' && (l.action === 'Create' || l.action === 'Run');
}

/** The seeded series with today's live events folded into the newest bucket. */
export function usageDaysWithLive(logs: AuditLog[]): UsageDay[] {
  const live = liveLogsToday(logs);
  if (live.length === 0) return USAGE_DAYS;
  return USAGE_DAYS.map(day => {
    if (day.dayOffset !== 0) return day;
    const byModule = { ...day.byModule };
    live.forEach(l => { byModule[usageModuleFor(l.module)] += 1; });
    const liveUsers = new Set(live.map(l => l.user));
    return {
      ...day,
      actions: day.actions + live.length,
      activeUsers: Math.max(day.activeUsers, liveUsers.size),
      aiQueries: day.aiQueries + live.filter(isAiQuery).length,
      // A report counts as generated only on a Create — downloading or
      // sharing one is not a new report.
      reports: day.reports + live.filter(l => l.action === 'Create' && l.entity === 'Report').length,
      downloads: day.downloads + live.filter(l => l.action === 'Export').length,
      byModule,
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Per-user usage — deterministic per person, scaled to the selected range
 * ────────────────────────────────────────────────────────────────────────── */

export interface UserUsage {
  /** Share of total platform activity this person accounts for (0–1). */
  share: number;
  /** Fraction of their actions that are AI queries. */
  aiRatio: number;
  /** Fraction of their actions that are downloads/exports. */
  dlRatio: number;
  topModule: UsageModule;
}

/** Stable per-user usage profile keyed off the email. Invited users (who have
 *  never signed in) get zero; suspended/locked/inactive users run at a
 *  fraction, since their activity stopped partway through the window. */
export function userUsageProfile(user: Pick<AdminUser, 'email' | 'status'>): UserUsage {
  if (user.status === 'Invited') {
    return { share: 0, aiRatio: 0, dlRatio: 0, topModule: 'Ask IRA' };
  }
  const rnd = mulberry32(hashStr(user.email.toLowerCase()));
  const raw = 0.3 + rnd() * 0.7;
  const damp = user.status === 'Active' ? 1 : 0.25;
  const topModule = USAGE_MODULES[Math.floor(rnd() * (USAGE_MODULES.length - 1))];
  return {
    share: raw * damp,
    aiRatio: 0.15 + rnd() * 0.3,
    dlRatio: 0.05 + rnd() * 0.1,
    topModule,
  };
}

export interface UserUsageRow {
  user: AdminUser;
  actions: number;
  aiQueries: number;
  downloads: number;
  topModule: UsageModule;
}

/** Days since the user's last login, from the display string ('Today, 09:14',
 *  'Yesterday', 'Apr 20', 'Never'). Used to zero out people who weren't around
 *  in the selected range. */
export function lastLoginOffsetDays(lastLogin: string): number {
  if (!lastLogin || lastLogin === 'Never') return Infinity;
  if (lastLogin.startsWith('Today')) return 0;
  if (lastLogin.startsWith('Yesterday')) return 1;
  const d = new Date(`${lastLogin} ${new Date().getFullYear()}`);
  if (isNaN(d.getTime())) return Infinity;
  if (d.getTime() > Date.now()) d.setFullYear(d.getFullYear() - 1);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/** The one activity-window predicate: a member counts as active in a window
 *  when their last login falls inside it (Invited users have never signed in).
 *  Shared by the KPI totals, the per-user rows, and the seat buckets so the
 *  three surfaces can never disagree. */
function activeInWindow(user: Pick<AdminUser, 'lastLogin' | 'status'>, windowStartOffset: number, windowLen: number): boolean {
  if (user.status === 'Invited') return false;
  return lastLoginOffsetDays(user.lastLogin) <= windowStartOffset + windowLen;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Window totals + period-over-period delta
 * ────────────────────────────────────────────────────────────────────────── */

export interface UsageTotals {
  activeUsers: number;
  actions: number;
  aiQueries: number;
  reports: number;
  downloads: number;
}

/** Totals for one window of the series. `windowStartOffset` is how many days
 *  ago the window ends (0 = a window ending today; `rangeDays` = the window
 *  immediately before it). */
export function usageWindowTotals(days: UsageDay[], users: AdminUser[], windowStartOffset: number): UsageTotals {
  return {
    activeUsers: users.filter(u => activeInWindow(u, windowStartOffset, days.length)).length,
    actions: days.reduce((s, d) => s + d.actions, 0),
    aiQueries: days.reduce((s, d) => s + d.aiQueries, 0),
    reports: days.reduce((s, d) => s + d.reports, 0),
    downloads: days.reduce((s, d) => s + d.downloads, 0),
  };
}

/** Percent change vs the prior window; null when there is no prior baseline. */
export function usageDeltaPct(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

/** Per-user rows for a window: each person's share of the window total, plus
 *  their live events from this session counted one-for-one. Pass a non-zero
 *  `windowStartOffset` (and empty logs) to compute a prior window — live
 *  events only exist today, so they never belong to a past window. */
export function userUsageRows(users: AdminUser[], days: UsageDay[], logs: AuditLog[], windowStartOffset = 0): UserUsageRow[] {
  const totalActions = days.reduce((s, d) => s + d.actions, 0);
  const profiles = users.map(u => ({ u, p: userUsageProfile(u) }));
  const shareSum = profiles.reduce((s, x) => s + x.p.share, 0) || 1;
  const live = liveLogsToday(logs);
  const liveByUser = new Map<string, AuditLog[]>();
  live.forEach(l => {
    const arr = liveByUser.get(l.user) ?? [];
    arr.push(l);
    liveByUser.set(l.user, arr);
  });
  const rangeDays = days.length;
  return profiles.map(({ u, p }) => {
    // Someone whose last login predates the whole window did nothing in it —
    // same predicate as usageWindowTotals, so the KPI and the table agree.
    const inRange = activeInWindow(u, windowStartOffset, rangeDays);
    const seeded = inRange ? Math.round(totalActions * (p.share / shareSum)) : 0;
    const mine = liveByUser.get(u.name) ?? [];
    return {
      user: u,
      actions: seeded + mine.length,
      aiQueries: Math.round(seeded * p.aiRatio) + mine.filter(isAiQuery).length,
      downloads: Math.round(seeded * p.dlRatio) + mine.filter(l => l.action === 'Export').length,
      topModule: p.topModule,
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Downloads & exports — every download button funnels through logEvent, so
 * "who downloaded what" is derivable: seeded history + live Export events.
 * ────────────────────────────────────────────────────────────────────────── */

export type DownloadFormat = 'PDF' | 'CSV' | 'XLSX' | 'DOCX' | 'PPTX' | 'HTML' | 'TXT' | 'JSON';

export interface DownloadEvent {
  id: string;
  user: string;
  item: string;
  format: DownloadFormat;
  /** Days ago; 0 = today. */
  dayOffset: number;
  /** Display time (HH:MM) for the row. */
  time: string;
  /** True when this came from a real logEvent in the current session. */
  live: boolean;
}

/** The artifacts people pull out of a GRC platform — the seed catalog. */
const DOWNLOAD_CATALOG: { item: string; format: DownloadFormat }[] = [
  { item: 'SOX Compliance Report', format: 'PDF' },
  { item: 'P2P RACM matrix', format: 'XLSX' },
  { item: 'Audit log', format: 'CSV' },
  { item: 'Q2 exceptions summary', format: 'DOCX' },
  { item: 'Vendor risk dashboard data', format: 'CSV' },
  { item: 'ITGC control library', format: 'XLSX' },
  { item: 'IA engagement report', format: 'PDF' },
  { item: 'Workflow run output', format: 'CSV' },
];

/** Pull the artifact name + format out of an Export log's description.
 *  Export events come from every download button on the platform, so the
 *  phrasing varies: 'Exported audit log as CSV (12 events)', 'Downloaded
 *  ATR "…" as Word', 'Generated C-01-Working-Paper.pdf'. */
const FORMAT_ALIASES: Record<string, DownloadFormat> = {
  PDF: 'PDF', CSV: 'CSV', XLSX: 'XLSX', DOCX: 'DOCX', PPTX: 'PPTX',
  HTML: 'HTML', TXT: 'TXT', JSON: 'JSON', WORD: 'DOCX', EXCEL: 'XLSX', POWERPOINT: 'PPTX',
};
function parseExportLog(l: AuditLog): { item: string; format: DownloadFormat } {
  const m = l.description.match(/(?:Exported|Downloaded|Generated) (.+?) (?:as |\()(\w+)/i);
  const format = m ? FORMAT_ALIASES[m[2].toUpperCase()] : undefined;
  if (m && format) {
    const item = m[1];
    return { item: item.charAt(0).toUpperCase() + item.slice(1), format };
  }
  return { item: l.entity, format: 'CSV' };
}

/** Latest downloads, newest first: real session Export events on top, then a
 *  deterministic seeded history assigned to the most-active members. */
export function recentDownloads(rows: UserUsageRow[], logs: AuditLog[], limit = 6): DownloadEvent[] {
  const liveEvents: DownloadEvent[] = liveLogsToday(logs)
    .filter(l => l.action === 'Export')
    .map(l => ({
      id: l.id,
      user: l.user,
      ...parseExportLog(l),
      dayOffset: 0,
      time: l.timestamp.split(' ')[1]?.slice(0, 5) ?? '',
      live: true,
    }));
  const downloaders = [...rows].filter(r => r.downloads > 0).sort((a, b) => b.downloads - a.downloads);
  const rnd = mulberry32(0xd07a10ad);
  const seeded: DownloadEvent[] = downloaders.length === 0 ? [] : DOWNLOAD_CATALOG.map((c, i) => ({
    id: `dl-seed-${i}`,
    user: downloaders[Math.floor(rnd() * downloaders.length)].user.name,
    item: c.item,
    format: c.format,
    dayOffset: i === 0 ? 0 : Math.min(1 + Math.floor(rnd() * 6), USAGE_RANGE_DAYS),
    time: `${String(9 + Math.floor(rnd() * 8)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`,
    live: false,
  })).sort((a, b) => a.dayOffset - b.dayOffset);
  return [...liveEvents, ...seeded].slice(0, limit);
}

/** Split a download total across formats (largest-remainder, sums exactly). */
export function downloadFormatSplit(total: number): { format: DownloadFormat; count: number }[] {
  const weights: { format: DownloadFormat; w: number }[] = [
    { format: 'PDF', w: 0.38 },
    { format: 'CSV', w: 0.27 },
    { format: 'XLSX', w: 0.22 },
    { format: 'DOCX', w: 0.13 },
  ];
  const raw = weights.map(x => x.w * total);
  const floors = raw.map(v => Math.floor(v));
  let remainder = total - floors.reduce((s, f) => s + f, 0);
  const order = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return weights.map((x, i) => ({ format: x.format, count: floors[i] }));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Drill-down series — deterministic per member, reconciled to their row
 * ────────────────────────────────────────────────────────────────────────── */

export interface UserDayPoint {
  dayOffset: number;
  actions: number;
  aiQueries: number;
}

/** A member's daily activity across the visible window. Jittered per person
 *  but normalized (largest-remainder rounding) so the series sums exactly to
 *  the row's action count — the drawer always reconciles with the table. */
export function userDailySeries(row: UserUsageRow, days: UsageDay[]): UserDayPoint[] {
  const total = row.actions;
  if (total <= 0) return days.map(d => ({ dayOffset: d.dayOffset, actions: 0, aiQueries: 0 }));
  const rnd = mulberry32(hashStr(row.user.email.toLowerCase() + ':daily'));
  const weights = days.map(d => Math.max(0.05, d.actions) * (0.6 + rnd() * 0.8));
  const wSum = weights.reduce((s, w) => s + w, 0) || 1;
  const raw = weights.map(w => (w / wSum) * total);
  const floors = raw.map(v => Math.floor(v));
  let remainder = total - floors.reduce((s, f) => s + f, 0);
  const byFraction = raw
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  const aiRatio = row.aiQueries / total;
  return days.map((d, i) => ({
    dayOffset: d.dayOffset,
    actions: floors[i],
    aiQueries: Math.round(floors[i] * aiRatio),
  }));
}

/** A member's activity split across all 8 modules, scaled to their row total.
 *  Their table `topModule` is forced to rank first for consistency. */
export function fullUserModuleMix(row: UserUsageRow): { module: UsageModule; count: number }[] {
  if (row.actions <= 0) return [];
  const rnd = mulberry32(hashStr(row.user.email.toLowerCase() + ':mix'));
  const weights = USAGE_MODULES.map(m => ({ module: m, w: 0.2 + rnd() * 0.8 }));
  const maxW = Math.max(...weights.map(x => x.w));
  weights.forEach(x => { if (x.module === row.topModule) x.w = maxW * 1.3; });
  const wSum = weights.reduce((s, x) => s + x.w, 0);
  return weights
    .map(x => ({ module: x.module, count: Math.round((x.w / wSum) * row.actions) }))
    .sort((a, b) => b.count - a.count);
}

/** The drawer's ranked module list — top 4 of the full mix. */
export function userModuleMix(row: UserUsageRow): { module: UsageModule; count: number }[] {
  return fullUserModuleMix(row).slice(0, 4);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Module drill-down
 * ────────────────────────────────────────────────────────────────────────── */

/** One module's daily counts over a window (for the drill-down trend). */
export function moduleDailySeries(module: UsageModule, days: UsageDay[]): { dayOffset: number; count: number }[] {
  return days.map(d => ({ dayOffset: d.dayOffset, count: d.byModule[module] }));
}

/** The members who use a module most, from the same per-user mix the member
 *  drawer shows — the two drill-downs can never disagree. */
export function moduleTopUsers(module: UsageModule, rows: UserUsageRow[], top = 3): { name: string; email: string; count: number }[] {
  return rows
    .map(r => ({ r, count: fullUserModuleMix(r).find(m => m.module === module)?.count ?? 0 }))
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

/** Display names — plain words, not analytics jargon. "No activity" (rather
 *  than "Dormant") also keeps the segment from being confused with the
 *  Members card's "No sign-in 30+ days" bucket — they measure different
 *  things and their counts legitimately differ. */
export const SEGMENT_LABELS: Record<EngagementSegment, string> = {
  Power: 'Heavy',
  Core: 'Regular',
  Casual: 'Light',
  Dormant: 'No activity',
};

/** Mean actions across members who did anything — the segment baseline. */
export function activeMeanActions(rows: UserUsageRow[]): number {
  const active = rows.filter(r => r.actions > 0);
  if (active.length === 0) return 0;
  return active.reduce((s, r) => s + r.actions, 0) / active.length;
}

/** Segment a member relative to the active mean: Power ≥ 1.4x, Casual < 0.6x,
 *  Core in between, Dormant = nothing in the window. */
export function segmentFor(row: UserUsageRow, activeMean: number): EngagementSegment {
  if (row.actions === 0) return 'Dormant';
  if (activeMean > 0 && row.actions >= activeMean * 1.4) return 'Power';
  if (activeMean > 0 && row.actions < activeMean * 0.6) return 'Casual';
  return 'Core';
}

/** Share of active members who used AI in the window (0-100). */
export function aiAdoptionPct(rows: UserUsageRow[]): number {
  const active = rows.filter(r => r.actions > 0);
  if (active.length === 0) return 0;
  return Math.round((active.filter(r => r.aiQueries > 0).length / active.length) * 100);
}

/** Statistical outlier days: actions above mean + 2 standard deviations.
 *  Each spike carries how many times "typical" it ran and which module drove
 *  it — the passive anomaly-detection layer of the page. */
export interface UsageSpike {
  dayOffset: number;
  actions: number;
  /** Multiple of the window's mean day (e.g. 2.1). */
  ratio: number;
  topModule: UsageModule;
}

export function usageSpikes(days: UsageDay[]): UsageSpike[] {
  if (days.length < 7) return [];
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

/** How concentrated usage is: the share of all member activity that the top N
 *  members account for (0-100). High = the platform depends on a few people.
 *  Null when nobody did anything. */
export function activityConcentration(rows: UserUsageRow[], topN = 3): number | null {
  const total = rows.reduce((s, r) => s + r.actions, 0);
  if (total === 0) return null;
  const top = [...rows].sort((a, b) => b.actions - a.actions).slice(0, topN)
    .reduce((s, r) => s + r.actions, 0);
  return Math.round((top / total) * 100);
}

/* ──────────────────────────────────────────────────────────────────────────
 * What got created — workflows, dashboards, RACMs, engagements and reports
 * built in the window. Seeded counts derive from each module's daily series;
 * real Create events from this session (logged by the create flows across the
 * platform) are counted one-for-one on top.
 * ────────────────────────────────────────────────────────────────────────── */

export interface CreationKind {
  key: 'workflows' | 'dashboards' | 'racms' | 'engagements' | 'reports';
  label: string;
  /** AuditLog.entity values that count as this kind (with action 'Create'). */
  entities: string[];
  module: UsageModule;
  /** Fraction of the module's daily actions that are creations (seed only). */
  share: number;
}

export const CREATION_KINDS: CreationKind[] = [
  { key: 'workflows', label: 'Workflows', entities: ['Workflow'], module: 'Workflows', share: 0.07 },
  { key: 'dashboards', label: 'Dashboards', entities: ['Dashboard'], module: 'Dashboards', share: 0.06 },
  { key: 'racms', label: 'RACMs', entities: ['RACM'], module: 'Risk & Controls', share: 0.05 },
  { key: 'engagements', label: 'Engagements', entities: ['Engagement'], module: 'Engagements', share: 0.04 },
  // Reports reuse the day series' `reports` count, so the card and the
  // Reports KPI always show the same number.
  { key: 'reports', label: 'Reports', entities: ['Report'], module: 'Reports', share: 0 },
];

/** Seeded creations of one kind on one day — deterministic per (kind, day). */
function seededCreations(kind: CreationKind, day: UsageDay): number {
  if (kind.key === 'reports') return day.reports;
  const rnd = mulberry32(hashStr(`create:${kind.key}:${day.dayOffset}`));
  return Math.round(day.byModule[kind.module] * kind.share * (0.7 + rnd() * 0.6));
}

/** Today's real Create events for a kind. */
function liveCreates(kind: CreationKind, logs: AuditLog[]): AuditLog[] {
  return liveLogsToday(logs).filter(l => l.action === 'Create' && kind.entities.includes(l.entity));
}

export interface CreationTotal {
  kind: CreationKind;
  count: number;
  deltaPct: number | null;
}

/** Per-kind created counts for the window with prior-window deltas. Live
 *  events only exist today, so they only ever land in the current window.
 *  Reports skip the live add — `usageDaysWithLive` already folds live report
 *  events into today's `reports`, and this reuses that number. */
export function creationTotals(days: UsageDay[], priorDays: UsageDay[], logs: AuditLog[]): CreationTotal[] {
  return CREATION_KINDS.map(kind => {
    const seeded = days.reduce((s, d) => s + seededCreations(kind, d), 0);
    const prior = priorDays.reduce((s, d) => s + seededCreations(kind, d), 0);
    const live = kind.key === 'reports' ? 0 : liveCreates(kind, logs).length;
    return { kind, count: seeded + live, deltaPct: usageDeltaPct(seeded + live, prior) };
  });
}

export interface CreationEvent {
  id: string;
  user: string;
  /** What was created, e.g. 'workflow "Duplicate vendor payments"'. */
  item: string;
  kindLabel: string;
  /** Days ago; 0 = today. */
  dayOffset: number;
  /** Display time (HH:MM) for live rows. */
  time: string;
  /** True when this came from a real logEvent in the current session. */
  live: boolean;
}

/** The artifacts people build on a GRC platform — the seed catalog. */
const CREATION_CATALOG: { item: string; kind: CreationKind['key'] }[] = [
  { item: 'workflow "Duplicate vendor payments"', kind: 'workflows' },
  { item: 'Vendor risk dashboard', kind: 'dashboards' },
  { item: 'O2C revenue RACM', kind: 'racms' },
  { item: 'engagement "FY26 Q1 SOX Walkthrough"', kind: 'engagements' },
  { item: 'IA engagement report', kind: 'reports' },
  { item: 'workflow "Three-way match exceptions"', kind: 'workflows' },
  { item: 'ITGC compliance dashboard', kind: 'dashboards' },
  { item: 'SOX compliance report', kind: 'reports' },
];

/** Latest creations, newest first: real session Create events on top, then a
 *  deterministic seeded history assigned to the most-active members. */
export function recentCreations(rows: UserUsageRow[], logs: AuditLog[], limit = 6): CreationEvent[] {
  const labelByEntity = new Map<string, string>();
  CREATION_KINDS.forEach(k => k.entities.forEach(e => labelByEntity.set(e, k.label)));
  const liveEvents: CreationEvent[] = liveLogsToday(logs)
    .filter(l => l.action === 'Create' && labelByEntity.has(l.entity))
    .map(l => ({
      id: l.id,
      user: l.user,
      item: l.description.replace(/^Created /, ''),
      kindLabel: labelByEntity.get(l.entity)!,
      dayOffset: 0,
      time: l.timestamp.split(' ')[1]?.slice(0, 5) ?? '',
      live: true,
    }));
  const creators = [...rows].filter(r => r.actions > 0).sort((a, b) => b.actions - a.actions);
  const rnd = mulberry32(0xc0ffee42);
  const kindLabel = (key: CreationKind['key']) => CREATION_KINDS.find(k => k.key === key)!.label;
  const seeded: CreationEvent[] = creators.length === 0 ? [] : CREATION_CATALOG.map((c, i) => ({
    id: `cr-seed-${i}`,
    user: creators[Math.floor(rnd() * creators.length)].user.name,
    item: c.item,
    kindLabel: kindLabel(c.kind),
    dayOffset: i === 0 ? 0 : Math.min(1 + Math.floor(rnd() * 6), USAGE_RANGE_DAYS),
    time: `${String(9 + Math.floor(rnd() * 8)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`,
    live: false,
  })).sort((a, b) => a.dayOffset - b.dayOffset);
  return [...liveEvents, ...seeded].slice(0, limit);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Workflow runs — executions across the platform (library, engagements,
 * AI tools). Seeded from each area's daily series; live Run events counted
 * one-for-one on top.
 * ────────────────────────────────────────────────────────────────────────── */

export type RunArea = 'Workflow Library' | 'Engagements' | 'AI tools';
export const RUN_AREAS: { area: RunArea; bucket: UsageModule; share: number }[] = [
  { area: 'Workflow Library', bucket: 'Workflows', share: 0.30 },
  { area: 'Engagements', bucket: 'Engagements', share: 0.10 },
  { area: 'AI tools', bucket: 'Ask IRA', share: 0.08 },
];

function seededRuns(area: (typeof RUN_AREAS)[number], day: UsageDay): number {
  const rnd = mulberry32(hashStr(`run:${area.area}:${day.dayOffset}`));
  return Math.round(day.byModule[area.bucket] * area.share * (0.7 + rnd() * 0.6));
}

/** Which run area a live Run event belongs to, by its usage bucket. */
function runAreaFor(l: AuditLog): RunArea {
  const bucket = usageModuleFor(l.module);
  if (bucket === 'Ask IRA') return 'AI tools';
  if (bucket === 'Workflows') return 'Workflow Library';
  return 'Engagements';
}

export interface RunTotals {
  total: number;
  deltaPct: number | null;
  byArea: { area: RunArea; count: number }[];
}

export function workflowRunTotals(days: UsageDay[], priorDays: UsageDay[], logs: AuditLog[]): RunTotals {
  const liveRuns = liveLogsToday(logs).filter(l => l.action === 'Run');
  const byArea = RUN_AREAS.map(a => ({
    area: a.area,
    count: days.reduce((s, d) => s + seededRuns(a, d), 0) + liveRuns.filter(l => runAreaFor(l) === a.area).length,
  }));
  const total = byArea.reduce((s, a) => s + a.count, 0);
  const prior = RUN_AREAS.reduce((s, a) => s + priorDays.reduce((t, d) => t + seededRuns(a, d), 0), 0);
  return { total, deltaPct: usageDeltaPct(total, prior), byArea };
}

export interface RunEvent {
  id: string;
  user: string;
  /** Verb-first phrase, e.g. 'ran workflow "Duplicate vendor payments"'. */
  item: string;
  area: RunArea;
  dayOffset: number;
  time: string;
  live: boolean;
}

const RUN_CATALOG: { item: string; area: RunArea }[] = [
  { item: 'ran workflow "Duplicate vendor payments"', area: 'Workflow Library' },
  { item: 'ran workflow "Three-way match exceptions"', area: 'Workflow Library' },
  { item: 'executed an automation run for "P2P continuous monitoring"', area: 'Engagements' },
  { item: 'ran a document forensic scan', area: 'AI tools' },
  { item: 'ran workflow "Vendor master changes"', area: 'Workflow Library' },
  { item: 'ran attribute testing on "Invoice approval"', area: 'Engagements' },
  { item: 'extracted tables from 3 files', area: 'AI tools' },
  { item: 'ran workflow "GL journal anomalies"', area: 'Workflow Library' },
];

/** Latest runs, newest first: live session Run events on top, then a
 *  deterministic seeded history assigned to the most-active members. */
export function recentRuns(rows: UserUsageRow[], logs: AuditLog[], limit = 5): RunEvent[] {
  const liveEvents: RunEvent[] = liveLogsToday(logs)
    .filter(l => l.action === 'Run')
    .map(l => ({
      id: l.id,
      user: l.user,
      item: l.description.replace(/^./, c => c.toLowerCase()),
      area: runAreaFor(l),
      dayOffset: 0,
      time: l.timestamp.split(' ')[1]?.slice(0, 5) ?? '',
      live: true,
    }));
  const runners = [...rows].filter(r => r.actions > 0).sort((a, b) => b.actions - a.actions);
  const rnd = mulberry32(0x5eedca11);
  const seeded: RunEvent[] = runners.length === 0 ? [] : RUN_CATALOG.map((c, i) => ({
    id: `run-seed-${i}`,
    user: runners[Math.floor(rnd() * runners.length)].user.name,
    item: c.item,
    area: c.area,
    dayOffset: i === 0 ? 0 : Math.min(1 + Math.floor(rnd() * 6), USAGE_RANGE_DAYS),
    time: `${String(9 + Math.floor(rnd() * 8)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`,
    live: false,
  })).sort((a, b) => a.dayOffset - b.dayOffset);
  return [...liveEvents, ...seeded].slice(0, limit);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sharing — invites and share links across the platform. Seeded as a small
 * slice of daily activity; live Share events counted one-for-one on top.
 * ────────────────────────────────────────────────────────────────────────── */

export const SHARE_KINDS = ['Reports', 'Dashboards', 'RACMs', 'Workflows', 'Other'] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];
const SHARE_WEIGHTS: Record<ShareKind, number> = {
  Reports: 0.40, Dashboards: 0.25, RACMs: 0.15, Workflows: 0.12, Other: 0.08,
};

function seededSharesForDay(day: UsageDay): number {
  const rnd = mulberry32(hashStr(`share:${day.dayOffset}`));
  return Math.round(day.actions * 0.015 * (0.6 + rnd() * 0.8));
}

function shareKindFor(l: AuditLog): ShareKind {
  switch (l.entity) {
    case 'Report': return 'Reports';
    case 'Dashboard': return 'Dashboards';
    case 'RACM': return 'RACMs';
    case 'Workflow': return 'Workflows';
    default: return 'Other';
  }
}

export interface ShareTotals {
  total: number;
  deltaPct: number | null;
  byKind: { kind: ShareKind; count: number }[];
}

export function shareTotals(days: UsageDay[], priorDays: UsageDay[], logs: AuditLog[]): ShareTotals {
  const seeded = days.reduce((s, d) => s + seededSharesForDay(d), 0);
  const prior = priorDays.reduce((s, d) => s + seededSharesForDay(d), 0);
  const liveShares = liveLogsToday(logs).filter(l => l.action === 'Share');
  const total = seeded + liveShares.length;
  // Largest-remainder split of the seeded total, then live events by entity.
  const raw = SHARE_KINDS.map(k => SHARE_WEIGHTS[k] * seeded);
  const floors = raw.map(v => Math.floor(v));
  let remainder = seeded - floors.reduce((s, f) => s + f, 0);
  const order = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  const byKind = SHARE_KINDS.map((kind, i) => ({
    kind,
    count: floors[i] + liveShares.filter(l => shareKindFor(l) === kind).length,
  }));
  return { total, deltaPct: usageDeltaPct(total, prior), byKind };
}

export interface ShareEvent {
  id: string;
  user: string;
  /** Verb-first phrase, e.g. 'shared SOX compliance report with 2 people'. */
  item: string;
  kind: ShareKind;
  dayOffset: number;
  time: string;
  live: boolean;
}

const SHARE_CATALOG: { item: string; kind: ShareKind }[] = [
  { item: 'shared the SOX compliance report with 2 people', kind: 'Reports' },
  { item: 'shared the vendor risk dashboard with 4 people', kind: 'Dashboards' },
  { item: 'copied a share link for the P2P RACM', kind: 'RACMs' },
  { item: 'shared the IA engagement report with 1 person', kind: 'Reports' },
  { item: 'shared a workflow run output with 3 people', kind: 'Workflows' },
  { item: 'shared the ITGC compliance dashboard with 2 people', kind: 'Dashboards' },
];

/** Latest shares, newest first: live session Share events on top, then a
 *  deterministic seeded history assigned to the most-active members. */
export function recentShares(rows: UserUsageRow[], logs: AuditLog[], limit = 5): ShareEvent[] {
  const liveEvents: ShareEvent[] = liveLogsToday(logs)
    .filter(l => l.action === 'Share')
    .map(l => ({
      id: l.id,
      user: l.user,
      item: l.description.replace(/^./, c => c.toLowerCase()),
      kind: shareKindFor(l),
      dayOffset: 0,
      time: l.timestamp.split(' ')[1]?.slice(0, 5) ?? '',
      live: true,
    }));
  const sharers = [...rows].filter(r => r.actions > 0).sort((a, b) => b.actions - a.actions);
  const rnd = mulberry32(0x54a4e5);
  const seeded: ShareEvent[] = sharers.length === 0 ? [] : SHARE_CATALOG.map((c, i) => ({
    id: `share-seed-${i}`,
    user: sharers[Math.floor(rnd() * sharers.length)].user.name,
    item: c.item,
    kind: c.kind,
    dayOffset: i === 0 ? 0 : Math.min(1 + Math.floor(rnd() * 6), USAGE_RANGE_DAYS),
    time: `${String(9 + Math.floor(rnd() * 8)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`,
    live: false,
  })).sort((a, b) => a.dayOffset - b.dayOffset);
  return [...liveEvents, ...seeded].slice(0, limit);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Activity rhythm — weekday x hour heatmap
 * ────────────────────────────────────────────────────────────────────────── */

/** Working-hours intensity curve (24 slots): quiet nights, morning and
 *  afternoon peaks, a lunch dip. */
const HOUR_CURVE = [
  0.2, 0.1, 0.1, 0.1, 0.2, 0.4,   // 00-05
  0.8, 1.5, 3.0, 5.0, 6.0, 5.5,   // 06-11
  3.5, 4.5, 5.5, 6.0, 5.5, 4.5,   // 12-17
  2.5, 1.5, 1.0, 0.8, 0.5, 0.3,   // 18-23
];

/** Weekday names in JS getDay() order — shared by the heatmap and highlights. */
export const USAGE_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface UsageHeatmapData {
  /** matrix[dow][hour], dow in JS getDay() order (0 = Sunday). */
  matrix: number[][];
  max: number;
  /** Total across all cells — equals the window's action total. */
  total: number;
}

/** Distribute each day's actions across 24 hours (deterministic jitter,
 *  largest-remainder rounding so the grid sums exactly to the window total)
 *  and accumulate by weekday. */
export function usageHourlyMatrix(days: UsageDay[]): UsageHeatmapData {
  const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const todayDow = new Date().getDay();
  days.forEach(day => {
    // Same weekday derivation as the seed, so weekends stay quiet here too.
    const dow = ((todayDow - (day.dayOffset % 7)) + 7) % 7;
    const rnd = mulberry32(hashStr('rhythm:' + day.dayOffset));
    const weights = HOUR_CURVE.map(w => w * (0.7 + rnd() * 0.6));
    const wSum = weights.reduce((s, w) => s + w, 0) || 1;
    const raw = weights.map(w => (w / wSum) * day.actions);
    const floors = raw.map(v => Math.floor(v));
    let remainder = day.actions - floors.reduce((s, f) => s + f, 0);
    const byFraction = raw
      .map((v, i) => ({ i, frac: v - floors[i] }))
      .sort((a, b) => b.frac - a.frac);
    for (const { i } of byFraction) {
      if (remainder <= 0) break;
      floors[i] += 1;
      remainder -= 1;
    }
    floors.forEach((n, h) => { matrix[dow][h] += n; });
  });
  const max = Math.max(1, ...matrix.flat());
  const total = matrix.flat().reduce((s, v) => s + v, 0);
  return { matrix, max, total };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Seats & lifecycle
 * ────────────────────────────────────────────────────────────────────────── */

export interface SeatBuckets {
  total: number;
  activeInRange: AdminUser[];
  /** Active status but no login for 30+ days. */
  dormant: AdminUser[];
  invited: AdminUser[];
  suspendedOrInactive: AdminUser[];
}

/** Seat-lifecycle buckets, derived with the same lastLogin parser as the
 *  table's Last Active column so the lists always agree. */
export function seatBuckets(users: AdminUser[], rangeDays: number): SeatBuckets {
  return {
    total: users.length,
    activeInRange: users.filter(u => activeInWindow(u, 0, rangeDays)),
    dormant: users.filter(u => u.status === 'Active' && lastLoginOffsetDays(u.lastLogin) > 30),
    invited: users.filter(u => u.status === 'Invited'),
    suspendedOrInactive: users.filter(u => u.status === 'Suspended' || u.status === 'Locked' || u.status === 'Inactive'),
  };
}
