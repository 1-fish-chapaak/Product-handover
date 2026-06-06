// ─────────────────────────────────────────────────────────────────────────────
// Shared store for controls created via the "Create Control" wizard (e.g. from a
// risk's Link Control flow). The app's three control surfaces each keep their own
// list in their own shape — the Link Control picker (static CONTROL_LIBRARY), the
// Process Hub Controls tab (per-process localStorage), and the global Control
// Library (in-memory). None share a source, so a control created in one place
// would never appear in the others.
//
// This module is the single source of truth for *created* controls: each surface
// reads it via useCreatedControls() and merges the entries into its own list
// (mapping to its own shape). Backed by localStorage so creations survive a
// reload, matching the Controls tab's existing persistence.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import type { NewControlData } from '../components/governance/CreateControlDrawer';

export interface CreatedControl extends NewControlData {
  /** Canonical control id, reused across all surfaces, e.g. "C-48217". */
  id: string;
  /** Human date the control was created, e.g. "Jun 6, 2026". */
  createdAt: string;
}

const STORAGE_KEY = 'irame.createdControls';

function load(): CreatedControl[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CreatedControl[]) : [];
  } catch {
    return [];
  }
}

// Module-level cache so getSnapshot returns a stable reference between renders
// (required by useSyncExternalStore — a new array each call would loop forever).
let cache: CreatedControl[] = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full / unavailable — keep the in-memory copy */
  }
}

function emit() {
  listeners.forEach(fn => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): CreatedControl[] {
  return cache;
}

/** All created controls (newest first). Non-reactive read. */
export function getCreatedControls(): CreatedControl[] {
  return cache;
}

/** Append a newly-created control and notify every subscribed surface. */
export function addCreatedControl(data: NewControlData): CreatedControl {
  const created: CreatedControl = {
    ...data,
    id: `C-${String(Date.now()).slice(-5)}`,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
  cache = [created, ...cache];
  persist();
  emit();
  return created;
}

/** Reactive hook — re-renders the caller whenever a control is created. */
export function useCreatedControls(): CreatedControl[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
