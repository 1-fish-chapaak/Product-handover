/**
 * Which workspace the audit-plan stores are reading.
 *
 * A fresh workspace is a client on its first login: nothing runs on their
 * data yet, so no standard workflow starts live and there are no custom
 * controls — the state the Control Library's first-time experience is for.
 * Stores namespace their localStorage by workspace (Platform keeps the
 * original keys), so one client's progress never shows in another's.
 */
import { useSyncExternalStore } from 'react';

let current = { id: 'platform', fresh: false };
const listeners = new Set<() => void>();
const changeHandlers = new Set<() => void>();

export function setAuditWorkspace(id: string, fresh: boolean): void {
  if (current.id === id && current.fresh === fresh) return;
  current = { id, fresh };
  changeHandlers.forEach(fn => fn());
  listeners.forEach(fn => fn());
}

/** Stores register here to re-read their namespaced state on a switch. */
export function onWorkspaceChange(fn: () => void): void {
  changeHandlers.add(fn);
}

export const isFreshWorkspace = () => current.fresh;

/** localStorage key suffix — none for Platform, so its data stays put. */
export const workspaceSuffix = () => (current.id === 'platform' ? '' : `.${current.id}`);

export function useFreshWorkspace(): boolean {
  return useSyncExternalStore(
    fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => current.fresh,
    () => current.fresh,
  );
}
