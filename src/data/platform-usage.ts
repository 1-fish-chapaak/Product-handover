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
    case 'Ask IRA': case 'Chat': return 'Ask IRA';
    case 'Report': case 'Reports': return 'Reports';
    case 'Engagements': case 'Engagement Execution': return 'Engagements';
    case 'Workflow Library': case 'Workflows': return 'Workflows';
    case 'Dashboard': case 'Dashboards': return 'Dashboards';
    case 'Knowledge Hub': return 'Knowledge Hub';
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
    days.push({ dayOffset: offset, activeUsers, actions, aiQueries, reports, byModule });
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
      aiQueries: day.aiQueries + live.filter(l => usageModuleFor(l.module) === 'Ask IRA').length,
      reports: day.reports + live.filter(l => usageModuleFor(l.module) === 'Reports').length,
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
  topModule: UsageModule;
}

/** Stable per-user usage profile keyed off the email. Invited users (who have
 *  never signed in) get zero; suspended/locked/inactive users run at a
 *  fraction, since their activity stopped partway through the window. */
export function userUsageProfile(user: Pick<AdminUser, 'email' | 'status'>): UserUsage {
  if (user.status === 'Invited') {
    return { share: 0, aiRatio: 0, topModule: 'Ask IRA' };
  }
  const rnd = mulberry32(hashStr(user.email.toLowerCase()));
  const raw = 0.3 + rnd() * 0.7;
  const damp = user.status === 'Active' ? 1 : 0.25;
  const topModule = USAGE_MODULES[Math.floor(rnd() * (USAGE_MODULES.length - 1))];
  return {
    share: raw * damp,
    aiRatio: 0.15 + rnd() * 0.3,
    topModule,
  };
}

export interface UserUsageRow {
  user: AdminUser;
  actions: number;
  aiQueries: number;
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
      aiQueries: Math.round(seeded * p.aiRatio) + mine.filter(l => usageModuleFor(l.module) === 'Ask IRA').length,
      topModule: p.topModule,
    };
  });
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
