// ─────────────────────────────────────────────────────────────────────────────
// Persisted risk → control links created via the "Link Existing Control" picker
// (the picker's Apply used to just toast). Keyed by risk id; backed by localStorage
// so links survive a reload, matching the created-controls store. Controls created
// via the wizard already carry `mappedRisks`, so those don't need recording here —
// the risk card derives them from the created-controls store directly.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';

export interface LinkedControl {
  id: string;
  name: string;
  description: string;
  isKey: boolean;
}

const STORAGE_KEY = 'irame.riskControlLinks';

function load(): Record<string, LinkedControl[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Module-level cache so getSnapshot returns a stable reference between renders.
let cache: Record<string, LinkedControl[]> = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable — keep the in-memory copy */
  }
}

function emit() {
  listeners.forEach(fn => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): Record<string, LinkedControl[]> {
  return cache;
}

/** Non-reactive read of all risk → control links. */
export function getRiskControlLinks(): Record<string, LinkedControl[]> {
  return cache;
}

/** Link one or more existing controls to a risk (deduped by id, case-insensitive). */
export function addRiskControlLinks(riskId: string, controls: LinkedControl[]) {
  const existing = cache[riskId] ?? [];
  const seen = new Set(existing.map(c => c.id.toUpperCase()));
  const additions = controls.filter(c => !seen.has(c.id.toUpperCase()));
  if (additions.length === 0) return;
  cache = { ...cache, [riskId]: [...existing, ...additions] };
  persist();
  emit();
}

/** Reactive hook — re-renders the caller whenever a link is added. */
export function useRiskControlLinks(): Record<string, LinkedControl[]> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
