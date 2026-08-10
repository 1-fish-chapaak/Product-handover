// ─── Memory session registry — one decision layer over the seed store ───────
//
// Every surface that shows or acts on platform memory (Smart Learn, My Queue,
// the avatar drawer, the engagement Memory tab, admin) reads THIS layer, not
// the raw seed — so approving a proposal in My Queue immediately flips the row
// in Smart Learn, a forget from the avatar menu empties the same row
// everywhere, and a capture from a clarification shows up in the registry.
//
// Mechanics mirror src/components/shared/insightCache.ts: module-level state,
// a version counter, and a useSyncExternalStore hook. State is session-only —
// the seed stays deterministic and re-seeds on reload.
//
// Audit: every governance action dispatches `irame:memory-audit`; App.tsx owns
// the single listener that writes it into the Admin audit log (module
// "Memory") via AdminDataContext.logEvent.

import { useSyncExternalStore } from 'react';
import {
  MEMORY_STORE, RENEWAL_TARGET,
  type PlatformMemory,
} from './memoryStore';

export interface MemoryDecision {
  forgotten?: boolean;
  renewedTo?: string;
  approved?: { by: string; on: string; note?: string };
  rejected?: boolean;
  /** Drift review resolved — the mapping was re-confirmed against the new schema. */
  driftResolved?: boolean;
}

interface SessionState {
  decisions: Record<string, MemoryDecision>;
  /** Rows captured this session (CaptureCard, teach-by-example bundles). */
  captured: PlatformMemory[];
  personalCleared: boolean;
}

let state: SessionState = { decisions: {}, captured: [], personalCleared: false };
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getVersion = () => version;

/** Re-render when any memory decision changes (shared across all surfaces). */
export function useMemorySessionVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

// ─── Audit hand-off (App.tsx listens and writes via AdminDataContext) ───────

export interface MemoryAuditEvent {
  action: 'Create' | 'Update' | 'Delete';
  description: string;
  entity: string;
}

function audit(action: MemoryAuditEvent['action'], description: string, entity: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<MemoryAuditEvent>('irame:memory-audit', {
    detail: { action, description, entity },
  }));
}

// ─── Actions ────────────────────────────────────────────────────────────────

function patch(id: string, d: Partial<MemoryDecision>) {
  state = { ...state, decisions: { ...state.decisions, [id]: { ...state.decisions[id], ...d } } };
  notify();
}

export function forgetMemory(m: PlatformMemory) {
  patch(m.id, { forgotten: true });
  audit('Delete', m.scope === 'personal'
    ? `Personal memory forgotten — “${m.statement.slice(0, 80)}”`
    : `Memory retired for everyone — “${m.statement.slice(0, 80)}”`, m.id);
}

export function undoForget(m: PlatformMemory) {
  patch(m.id, { forgotten: false });
  audit('Update', `Forget undone — memory restored`, m.id);
}

export function renewMemory(m: PlatformMemory) {
  patch(m.id, { renewedTo: RENEWAL_TARGET });
  audit('Update', `Memory renewed until ${RENEWAL_TARGET}`, m.id);
}

export function approveMemory(m: PlatformMemory, by: string, note?: string) {
  patch(m.id, { approved: { by, on: 'today', note }, rejected: false });
  audit('Update', `Memory proposal approved${note ? ` (${note})` : ''} — “${m.statement.slice(0, 80)}”`, m.id);
}

export function rejectMemory(m: PlatformMemory, by: string) {
  patch(m.id, { rejected: true, approved: undefined });
  audit('Update', `Memory proposal rejected by ${by}`, m.id);
}

export function undoQueueDecision(m: PlatformMemory) {
  patch(m.id, { approved: undefined, rejected: false });
  audit('Update', 'Queue decision undone — proposal reopened', m.id);
}

export function resolveDrift(m: PlatformMemory) {
  patch(m.id, { driftResolved: true });
  audit('Update', `Drifted mapping re-confirmed against the new schema`, m.id);
}

export function captureMemory(mem: PlatformMemory) {
  state = { ...state, captured: [...state.captured, mem] };
  notify();
  audit('Create', `${mem.status === 'proposed' ? 'Memory proposed' : 'Memory captured'} — “${mem.statement.slice(0, 80)}”`, mem.id);
}

export function uncaptureMemory(id: string) {
  state = { ...state, captured: state.captured.filter(m => m.id !== id) };
  notify();
  audit('Delete', 'Just-captured memory undone', id);
}

export function clearPersonal() {
  state = { ...state, personalCleared: true };
  notify();
  audit('Delete', 'All personal memories forgotten ("forget everything about me")', 'personal-scope');
}

export function undoClearPersonal() {
  state = { ...state, personalCleared: false };
  notify();
  audit('Update', 'Personal forget-everything undone', 'personal-scope');
}

// ─── Selectors (call inside components that also call useMemorySessionVersion) ─

export function isPersonalCleared(): boolean {
  return state.personalCleared;
}

export function decisionFor(id: string): MemoryDecision | undefined {
  return state.decisions[id];
}

/** Seed + session-captured rows with decisions applied. Forgotten rows are
 *  INCLUDED (flagged via decisionFor) so surfaces can render undo strips. */
export function allMemories(): PlatformMemory[] {
  const rows = [...MEMORY_STORE, ...state.captured];
  return rows.map(m => {
    const d = state.decisions[m.id];
    if (!d) return m;
    let next = m;
    if (d.renewedTo) next = { ...next, reviewBy: d.renewedTo, renewDue: false };
    if (d.approved) next = { ...next, status: 'active', approvedBy: d.approved.by, approvedOn: d.approved.on, pendingNote: undefined };
    if (d.rejected) next = { ...next, status: 'retired' };
    if (d.driftResolved) next = { ...next, drifted: false };
    return next;
  });
}

/** Rows a surface should treat as gone (forgotten, cleared, rejected). */
export function isGone(m: PlatformMemory): boolean {
  const d = state.decisions[m.id];
  if (d?.forgotten) return true;
  if (d?.rejected) return true;
  return state.personalCleared && m.scope === 'personal';
}

/** Live = decisions applied, forgotten/rejected/cleared rows removed. */
export function liveMemories(): PlatformMemory[] {
  return allMemories().filter(m => !isGone(m));
}

/** Proposals waiting in My Queue (undecided this session). */
export function pendingMemories(): PlatformMemory[] {
  return allMemories().filter(m => {
    const d = state.decisions[m.id];
    return m.status === 'proposed' && !d?.approved && !d?.rejected && !d?.forgotten;
  });
}

/** Renewals due (review date reached, not yet renewed/retired). */
export function renewalsDue(): PlatformMemory[] {
  return liveMemories().filter(m => m.renewDue);
}

/** Drifted source memories awaiting the Knowledge Hub drift review. */
export function driftedMemories(): PlatformMemory[] {
  return liveMemories().filter(m => m.drifted);
}
