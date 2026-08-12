// ─── Insight session cache + generation registry ────────────────────────────
// Module-level so a generated insight survives navigation (cleared only on a
// hard reload). Split out of InsightGenerator so row-level surfaces — the
// "AI recommends" CTA on control / workflow rows — can read and subscribe
// without importing the component, and the component file keeps fast refresh.
//
// Row CTAs light up only once insights exist for their subject: they subscribe
// via useInsightCacheVersion, and every generation that writes the cache calls
// notifyCacheChanged so the CTAs appear live, no remount needed.

import { useSyncExternalStore } from 'react';
import {
  REC_PRIORITY_RANK,
  type AuditRecommendation, type EntityKind, type EntityRef,
  type InsightLayer, type LayeredInsight,
} from '../../data/layeredInsights';

export const CACHE = new Map<string, LayeredInsight>();
export const MULTI_CACHE = new Map<string, LayeredInsight[]>();
export const EMPTY_CACHE = new Set<string>(); // subjects whose last scan finished clean
export const cacheKey = (layer: InsightLayer, subjectId: string) => `${layer}:${subjectId}`;

const cacheListeners = new Set<() => void>();
let cacheVersion = 0;

/** Call after any cache write so subscribed surfaces re-render. Also mirrors
 *  the write to sibling tabs (see the cross-tab sync block at the bottom). */
export function notifyCacheChanged() {
  cacheVersion += 1;
  cacheListeners.forEach(l => l());
  broadcastSnapshot();
}

const subscribeCache = (cb: () => void) => {
  cacheListeners.add(cb);
  return () => { cacheListeners.delete(cb); };
};

/** The session's generated insight for a subject, if any surface produced one —
 *  its own Generate, or an engagement-level stack that included the subject. */
export function getGeneratedInsight(layer: InsightLayer, subjectId: string): LayeredInsight | null {
  return CACHE.get(cacheKey(layer, subjectId)) ?? null;
}

/** The session's generated multi-insight stack for a subject, whatever the
 *  stack size was — for header chips that summarize a Generate result without
 *  knowing how it was built (the dashboard band). */
export function getGeneratedStack(layer: InsightLayer, subjectId: string): LayeredInsight[] | null {
  const prefix = `${cacheKey(layer, subjectId)}:stack:`;
  for (const [k, v] of MULTI_CACHE) {
    if (k.startsWith(prefix)) return v;
  }
  return null;
}

/** Whether the subject's last scan (single or stack) finished clean. */
export function hasCleanScan(layer: InsightLayer, subjectId: string): boolean {
  const single = cacheKey(layer, subjectId);
  const prefix = `${single}:stack:`;
  for (const k of EMPTY_CACHE) {
    if (k === single || k.startsWith(prefix)) return true;
  }
  return false;
}

/** Re-renders the caller whenever a generation completes anywhere, so row CTAs
 *  gated on getGeneratedInsight show up without a remount. */
export function useInsightCacheVersion(): number {
  return useSyncExternalStore(subscribeCache, () => cacheVersion);
}

// ─── B+C index — reflections + targeted actions over the same cache ─────────
// Pure reads over already-generated insights: no extra generation, so the
// cost/trigger model is untouched. Surfaces subscribe via useInsightCacheVersion
// and these light up the moment an engagement-level Generate seeds the cache.

/** An action that travelled: the rec + the insight it came from (its context). */
export interface TargetedAction { rec: AuditRecommendation; source: LayeredInsight }

/** A spanned entity's slice of a higher-anchored insight. */
export interface SpanReflection { span: EntityRef; source: LayeredInsight }

/** Every cached insight, deduped (the multi-stack seeds singles per subject). */
function cachedInsights(): LayeredInsight[] {
  const seen = new Set<string>();
  const out: LayeredInsight[] = [];
  for (const ins of CACHE.values()) {
    if (seen.has(ins.id)) continue;
    seen.add(ins.id);
    out.push(ins);
  }
  return out;
}

/** Explicitly-targeted actions that land on this entity, from ANY generated
 *  insight — most urgent first. A rec without a target never travels. */
export function getActionsForTarget(kind: EntityKind, id: string): TargetedAction[] {
  const out: TargetedAction[] = [];
  for (const source of cachedInsights()) {
    for (const rec of source.recommendations ?? []) {
      if (rec.target && rec.target.kind === kind && rec.target.id === id) out.push({ rec, source });
    }
  }
  return out.sort((a, b) => REC_PRIORITY_RANK[a.rec.priority] - REC_PRIORITY_RANK[b.rec.priority]);
}

/** Higher-anchored insights that span this entity — drives its reflection
 *  strip ("part of a risk-level insight · view the anchor"). */
export function getReflectionsFor(kind: EntityKind, id: string): SpanReflection[] {
  const out: SpanReflection[] = [];
  for (const source of cachedInsights()) {
    const span = source.spans?.find(s => s.kind === kind && s.id === id);
    if (span) out.push({ span, source });
  }
  return out;
}

// ─── Action lifecycle — open → applied / dismissed ──────────────────────────
// Keyed by source-insight id + rec id (rec ids repeat across generic subjects).
// Session-scoped, like the insight cache itself.

export type ActionStatus = 'applied' | 'dismissed';

const ACTION_STATUS = new Map<string, ActionStatus>();
export const actionKey = (a: TargetedAction) => `${a.source.id}:${a.rec.id}`;

export function getActionStatus(a: TargetedAction): ActionStatus | null {
  return ACTION_STATUS.get(actionKey(a)) ?? null;
}

export function setActionStatus(a: TargetedAction, status: ActionStatus): void {
  ACTION_STATUS.set(actionKey(a), status);
  notifyCacheChanged();
}

// ─── Insight feedback — the signal-back loop ────────────────────────────────
// Keyed by insight id, session-scoped like everything else in this module. It
// lives here rather than in component state because one insight is rendered by
// several surfaces at once (its anchor card, the stack row, the detail
// slide-over) — a rating given in one has to be true in all of them, and has to
// survive the collapse/expand of a stack row.

export interface InsightFeedback {
  kind: 'up' | 'down';
  /** Only meaningful for 'down' — which fixed reason the reader picked. */
  reason?: string;
  /** Optional free-text note attached to the rating. */
  note?: string;
}

const INSIGHT_FEEDBACK = new Map<string, InsightFeedback>();

export function getInsightFeedback(insightId: string): InsightFeedback | null {
  return INSIGHT_FEEDBACK.get(insightId) ?? null;
}

/** Record (or, with `null`, clear) the reader's rating of an insight. */
export function setInsightFeedback(insightId: string, feedback: InsightFeedback | null): void {
  if (feedback) INSIGHT_FEEDBACK.set(insightId, feedback);
  else INSIGHT_FEEDBACK.delete(insightId);
  notifyCacheChanged();
}

// ─── Cross-tab sync ─────────────────────────────────────────────────────────
// The insights drawer's "open control to act" redirect opens the row in a NEW
// browser tab — a fresh JS context whose caches start empty, which would land
// the reader on a row that no longer shows the very insight that sent them.
// A BroadcastChannel mirrors this module's state across same-origin tabs: a
// new tab says hello and any seeded tab answers with a snapshot; after that,
// every cache write broadcasts one. Union-merge (never clears), structured
// clone (insights are plain data), still session-scoped — nothing persists.

// A long-lived tab can outlive the deploy that loaded it, then answer a new
// tab's hello with insights built by code that no longer exists — the new
// bundle renders an object shape it never produced (a card generated before
// authored KPIs existed shows the fallback band, stamped days old). Guard both
// axes: snapshots must come from the same schema version (old bundles send
// none), and an insight past the freshness window never crosses tabs — the new
// tab regenerates instead.
const SNAPSHOT_VERSION = 2;
const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const isFresh = (i: LayeredInsight) =>
  i.generatedAt == null || Date.now() - i.generatedAt < SNAPSHOT_MAX_AGE_MS;

interface CacheSnapshot {
  type: 'snapshot';
  version: number;
  single: [string, LayeredInsight][];
  multi: [string, LayeredInsight[]][];
  empty: string[];
  actions: [string, ActionStatus][];
  feedback: [string, InsightFeedback][];
}

const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ira-insight-cache');
let applyingRemote = false;
let broadcastQueued = false;

function broadcastSnapshot() {
  if (!channel || applyingRemote || broadcastQueued) return;
  broadcastQueued = true;
  // Microtask so a burst of writes (a stack Generate seeds every subject)
  // coalesces into one message.
  queueMicrotask(() => {
    broadcastQueued = false;
    const msg: CacheSnapshot = {
      type: 'snapshot',
      version: SNAPSHOT_VERSION,
      single: [...CACHE],
      multi: [...MULTI_CACHE],
      empty: [...EMPTY_CACHE],
      actions: [...ACTION_STATUS],
      feedback: [...INSIGHT_FEEDBACK],
    };
    channel.postMessage(msg);
  });
}

if (channel) {
  channel.onmessage = (e: MessageEvent) => {
    const msg = e.data as CacheSnapshot | { type: 'hello' };
    if (msg.type === 'hello') {
      if (CACHE.size || MULTI_CACHE.size || EMPTY_CACHE.size) broadcastSnapshot();
      return;
    }
    if (msg.type !== 'snapshot' || msg.version !== SNAPSHOT_VERSION) return;
    applyingRemote = true;
    try {
      msg.single.forEach(([k, v]) => { if (isFresh(v)) CACHE.set(k, v); });
      msg.multi.forEach(([k, v]) => { if (v.every(isFresh)) MULTI_CACHE.set(k, v); });
      msg.empty.forEach(k => EMPTY_CACHE.add(k));
      msg.actions.forEach(([k, v]) => ACTION_STATUS.set(k, v));
      msg.feedback.forEach(([k, v]) => INSIGHT_FEEDBACK.set(k, v));
      // Re-render subscribers; applyingRemote stops the echo broadcast.
      notifyCacheChanged();
    } finally {
      applyingRemote = false;
    }
  };
  channel.postMessage({ type: 'hello' });
}
