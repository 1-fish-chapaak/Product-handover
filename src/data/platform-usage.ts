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

/** Per-user rows for a range: each person's share of the range total, plus
 *  their live events from this session counted one-for-one. */
export function userUsageRows(users: AdminUser[], days: UsageDay[], logs: AuditLog[]): UserUsageRow[] {
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
    // Someone whose last login predates the whole range did nothing in it —
    // same predicate as usageWindowTotals, so the KPI and the table agree.
    const inRange = activeInWindow(u, 0, rangeDays);
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

/** A member's activity split by module, scaled to their row total. Their
 *  table `topModule` is forced to rank first for consistency. Top 4. */
export function userModuleMix(row: UserUsageRow): { module: UsageModule; count: number }[] {
  if (row.actions <= 0) return [];
  const rnd = mulberry32(hashStr(row.user.email.toLowerCase() + ':mix'));
  const weights = USAGE_MODULES.map(m => ({ module: m, w: 0.2 + rnd() * 0.8 }));
  const maxW = Math.max(...weights.map(x => x.w));
  weights.forEach(x => { if (x.module === row.topModule) x.w = maxW * 1.3; });
  const wSum = weights.reduce((s, x) => s + x.w, 0);
  return weights
    .map(x => ({ module: x.module, count: Math.round((x.w / wSum) * row.actions) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
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
