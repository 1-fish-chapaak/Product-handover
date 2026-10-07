/**
 * The live-workflow ledger — who owns which live workflow since when, and
 * who reviewed what. Everything the leaderboard, streaks and milestones say
 * is derived from it.
 *
 *  • Hours go to the workflow's OWNER (who adapted / built it), for every
 *    month it is live. Approving earns no hours — rubber-stamping can't climb
 *    the board — but on-time reviews are counted and drive the streak.
 *  • A workflow is only "live" once approved; built-but-unreviewed work earns
 *    nothing.
 *
 * Seeded with the team's history (the same people Platform Usage lists) and
 * extended in localStorage as the user approves workflows.
 */
import { useSyncExternalStore } from 'react';
import { ACTORS } from '../usage/seed';
import type { ProcessCode } from '../engagements';
import { hash01 } from './stdFiles';
import { COMPLEXITY_HOURS, type Complexity } from './score';
import { isFreshWorkspace, onWorkspaceChange, workspaceSuffix } from './workspace';

export interface LiveWorkflow {
  id: string;
  name: string;
  controlId: string;
  process: ProcessCode;
  complexity: Complexity;
  hoursPerMonth: number;
  basis: 'timed' | 'est.';
  owner: string;
  approvedBy: string;
  /** ISO date it went live. */
  liveSince: string;
}

export interface ReviewRecord {
  reviewer: string;
  at: string;
  onTime: boolean;
}

const BASE_KEY = 'irame.score.ledger';
const key = () => BASE_KEY + workspaceSuffix();
const HIDE_KEY = 'irame.score.hideName';
const DAY = 86_400_000;

/** People on the board: the audit teams (engineering builds the platform). */
export const BOARD_PEOPLE = ACTORS.filter(a => a.team !== 'Engineering').map(a => a.name);

const SEED_NAMES = [
  'Duplicate payment sweep', 'GRN-less payment monitor', 'Vendor bank-change watch', 'PO split detector',
  'Manual JE after-hours scan', 'Credit-limit override scan', 'Leaver access sweep', 'Price variance monitor',
  'Suspense ageing', 'Round-sum journal scan', 'Contract cap check', 'Dormant vendor payments',
  'SoD conflict scan', 'Revenue cut-off test', 'Count vs book variance', 'Negative stock watch',
];
const SEED_PROCESSES: ProcessCode[] = ['P2P', 'P2P', 'P2P', 'P2P', 'R2R', 'O2C', 'ITGC', 'P2P', 'R2R', 'R2R', 'S2C', 'P2P', 'ITGC', 'O2C', 'INV', 'INV'];
const CADENCE_TESTS = [4, 1, 4, 1, 1 / 3];

/** Deterministic team history: 2–10 live workflows each, live since spring. */
function seedLedger(today: number): LiveWorkflow[] {
  const rows: LiveWorkflow[] = [];
  BOARD_PEOPLE.forEach((owner, pi) => {
    // Management owns fewer workflows than the auditors.
    const manager = ACTORS.find(a => a.name === owner)?.team === 'Management';
    const n = (manager ? 1 : 3) + Math.round(hash01(owner) * (manager ? 2 : 7));
    for (let k = 0; k < n; k++) {
      const h = hash01(`${owner}-${k}`);
      const idx = (pi * 5 + k * 3) % SEED_NAMES.length;
      const complexity: Complexity = h > 0.66 ? 'complex' : h > 0.3 ? 'mid' : 'easy';
      const tests = CADENCE_TESTS[Math.floor(hash01(`${owner}c${k}`) * CADENCE_TESTS.length)];
      const daysAgo = 4 + Math.round(hash01(`${owner}d${k}`) * 200);
      rows.push({
        id: `seed-${pi}-${k}`,
        name: SEED_NAMES[idx],
        controlId: `${SEED_PROCESSES[idx]}-S${String(pi * 10 + k).padStart(2, '0')}`,
        process: SEED_PROCESSES[idx],
        complexity,
        hoursPerMonth: COMPLEXITY_HOURS[complexity] * tests,
        basis: 'est.',
        owner,
        approvedBy: BOARD_PEOPLE[(pi + 1) % BOARD_PEOPLE.length],
        liveSince: new Date(today - daysAgo * DAY).toISOString().slice(0, 10),
      });
    }
  });
  return rows;
}

/** Seeded review history: on-time reviews in the last 30 days, and streaks. */
function seedReviews(today: number): ReviewRecord[] {
  const out: ReviewRecord[] = [];
  BOARD_PEOPLE.forEach(p => {
    const n = 2 + Math.round(hash01(`${p}-rev`) * 14);
    for (let k = 0; k < n; k++) {
      out.push({ reviewer: p, at: new Date(today - Math.round(hash01(`${p}r${k}`) * 29) * DAY).toISOString(), onTime: hash01(`${p}o${k}`) > 0.15 });
    }
  });
  return out;
}

interface Stored { live: LiveWorkflow[]; reviews: ReviewRecord[] }
function read(): Stored {
  try {
    const raw = localStorage.getItem(key());
    const v = raw ? JSON.parse(raw) : null;
    return v && Array.isArray(v.live) ? v : { live: [], reviews: [] };
  } catch { return { live: [], reviews: [] }; }
}

const TODAY = Date.now();
const SEED_LIVE = seedLedger(TODAY);
const SEED_REVIEWS = seedReviews(TODAY);
let stored: Stored = read();
let version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach(fn => fn()); };
// Module-level so approvals made in another tab are never missed.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === key() || e.key === HIDE_KEY) { stored = read(); emit(); } });
}
// Each workspace keeps its own ledger; a new client starts with none.
onWorkspaceChange(() => { stored = read(); emit(); });
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
function persist() {
  try { localStorage.setItem(key(), JSON.stringify(stored)); } catch { /* quota */ }
  emit();
}

// The seeded team history belongs to Platform. A fresh workspace has only
// what happened in it.
export const allLive = () => (isFreshWorkspace() ? stored.live : [...stored.live, ...SEED_LIVE]);
export const allReviews = () => (isFreshWorkspace() ? stored.reviews : [...stored.reviews, ...SEED_REVIEWS]);

/** Called when a reviewer approves a built workflow — it goes live. */
export function recordApproval(row: Omit<LiveWorkflow, 'id' | 'liveSince'>, readyAt: number): void {
  const now = Date.now();
  stored = {
    live: [{ ...row, id: `live-${now.toString(36)}`, liveSince: new Date(now).toISOString().slice(0, 10) }, ...stored.live],
    reviews: [{ reviewer: row.approvedBy, at: new Date(now).toISOString(), onTime: now - readyAt < 2 * DAY }, ...stored.reviews],
  };
  persist();
}

/** Re-render on ledger changes. */
export function useLedgerVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

export type ScoreWindow = '30d' | 'all';

/** Hours a month a person's live workflows return right now — moves the
 *  moment a workflow is approved, where the 30-day total accrues slowly. */
export function runRateFor(person: string): number {
  return allLive().filter(w => w.owner === person).reduce((s, w) => s + w.hoursPerMonth, 0);
}

/** Run-rate added today (workflows that went live today). */
export function runRateAddedToday(person: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return allLive().filter(w => w.owner === person && w.liveSince === today).reduce((s, w) => s + w.hoursPerMonth, 0);
}

/** Hours a person's live workflows returned in the window. */
export function hoursFor(person: string, window: ScoreWindow, now = Date.now()): number {
  return allLive().filter(w => w.owner === person).reduce((s, w) => {
    const since = new Date(`${w.liveSince}T00:00:00`).getTime();
    const from = window === '30d' ? Math.max(since, now - 30 * DAY) : since;
    const months = Math.max(0, now - from) / (30 * DAY);
    // A workflow live for even part of a day earns at least one day.
    return s + w.hoursPerMonth * Math.max(months, now - from > 0 ? 1 / 30 : 0);
  }, 0);
}

export interface BoardRow {
  person: string;
  hours: number;
  live: number;
  onTimeReviews: number;
}

export function leaderboard(window: ScoreWindow, extraPeople: string[] = [], now = Date.now()): BoardRow[] {
  const people = Array.from(new Set([...(isFreshWorkspace() ? [] : BOARD_PEOPLE), ...extraPeople]));
  const since = window === '30d' ? now - 30 * DAY : 0;
  return people
    .map(person => ({
      person,
      hours: hoursFor(person, window, now),
      live: allLive().filter(w => w.owner === person).length,
      onTimeReviews: allReviews().filter(r => r.reviewer === person && r.onTime && new Date(r.at).getTime() >= since).length,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/** Consecutive weeks with every review done within 48 h (seeded history +
 *  this week's reviews). */
export function streakFor(person: string): number {
  const recent = allReviews().filter(r => r.reviewer === person);
  if (recent.length === 0) return 0;
  const late = recent.some(r => !r.onTime && Date.now() - new Date(r.at).getTime() < 7 * DAY);
  return late ? 0 : 1 + Math.round(hash01(`${person}-streak`) * 7);
}

// ── Name visibility ──
export function isNameHidden(): boolean {
  try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
}
export function setNameHidden(v: boolean): void {
  try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  emit();
}

export const MILESTONES = [
  { id: 'first', label: 'First live workflow', test: (live: number, hours: number) => live >= 1 && hours >= 0 },
  { id: 'h50', label: '50 hours returned', test: (_l: number, hours: number) => hours >= 50 },
  { id: 'h100', label: '100 hours returned', test: (_l: number, hours: number) => hours >= 100 },
  { id: 'ten', label: '10 workflows live', test: (live: number) => live >= 10 },
] as const;
