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

/** Call after any cache write so subscribed surfaces re-render. */
export function notifyCacheChanged() {
  cacheVersion += 1;
  cacheListeners.forEach(l => l());
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
