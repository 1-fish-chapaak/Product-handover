/**
 * Current user + permission context — the single place the app asks
 * "can the signed-in user do X?".
 *
 * Holds:
 *  - the roster of roles (seeded from rbac.ts, editable by the Roles & Permissions
 *    admin screen so the matrix actually drives enforcement),
 *  - the signed-in identity and their active role,
 *  - `can()` / `canAny()` for gating,
 *  - `signIn()` / `signOut()` for the login layer.
 *
 * No backend: everything lives in React state for the session.
 */

import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react';
import {
  SEED_ROLES,
  type Role,
  type PermissionKey,
} from '../data/rbac';
import { DEFAULT_WORKSPACE } from '../data/workspaces';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  title: string;
  roleId: string;
}

/** Demo personas — one per seed role so login / switcher can pick a persona.
 *  The Team Lead's email matches a roster member (Ayushi Narang, SOX Audit), so
 *  Platform Usage can resolve their team and scope the People tab to it. */
export const DEMO_USERS: AuthUser[] = [
  { id: 'u-admin',    name: 'Nilesh Anand',  email: 'nilesh.anand@irame.ai',  initials: 'NA', title: 'Administrator', roleId: 'role-admin' },
  { id: 'u-enabler',  name: 'Karan Mehta',   email: 'karan.mehta@irame.ai',   initials: 'KM', title: 'Audit Manager', roleId: 'role-enabler' },
  { id: 'u-auditor',  name: 'Tushar Goel',   email: 'tushar.goel@irame.ai',   initials: 'TG', title: 'Auditor',       roleId: 'role-auditor' },
  { id: 'u-risk',     name: 'Priya Singh',   email: 'priya.singh@irame.ai',   initials: 'PS', title: 'Risk Owner',    roleId: 'role-risk' },
  { id: 'u-reviewer', name: 'Vijay Reddy',   email: 'vijay.reddy@irame.ai',   initials: 'VR', title: 'Reviewer',      roleId: 'role-reviewer' },
  { id: 'u-viewer',   name: 'Sana Kapoor',   email: 'sana.kapoor@irame.ai',   initials: 'SK', title: 'Viewer',        roleId: 'role-viewer' },
  { id: 'u-teamlead', name: 'Ayushi Narang', email: 'ayushi.narang@irame.ai', initials: 'AN', title: 'Team Lead',     roleId: 'role-teamlead' },
];

/** Default signed-in persona (System Admin) so the full app is visible out of the box. */
export const DEFAULT_USER = DEMO_USERS[0];

interface CurrentUserContextValue {
  /** null = signed out (login screen). */
  currentUser: AuthUser | null;
  /** Workspace chosen at sign-in — shared with the sidebar switcher. */
  activeWorkspaceId: string;
  setActiveWorkspace: (id: string) => void;
  roles: Role[];
  activeRole: Role | null;
  can: (key: PermissionKey) => boolean;
  canAny: (keys: PermissionKey[]) => boolean;
  /** Sign in as a specific persona (prototype login). */
  signIn: (userId: string) => void;
  signOut: () => void;
  /** Roles editor write-back — keeps enforcement in sync with the matrix. */
  updateRolePermissions: (roleId: string, permissions: PermissionKey[]) => void;
  addRole: (role: Role) => void;
  /** Delete a custom role. Callers must guard system / default / assigned roles. */
  removeRole: (roleId: string) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

// Persist the prototype session so deep-links opened in a NEW browser tab
// (e.g. Process Hub → a control opens ?view=control-detail in window.open) stay
// signed in and land on the target view, instead of re-showing the login/
// workspace screen. Without this, every new tab boots signed-out and the
// deep-linked page never appears.
const AUTH_USER_KEY = 'auth.currentUserId';
const AUTH_WS_KEY = 'auth.activeWorkspaceId';

const readPersistedUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const id = window.localStorage.getItem(AUTH_USER_KEY);
    return id ? (DEMO_USERS.find(d => d.id === id) ?? null) : null;
  } catch { return null; }
};

const readPersistedWorkspace = (): string | null => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(AUTH_WS_KEY); } catch { return null; }
};

interface ProviderProps {
  children: ReactNode;
  /** Start signed-out (show login) — defaults to signed-in as System Admin. */
  startSignedOut?: boolean;
}

export function CurrentUserProvider({ children, startSignedOut = false }: ProviderProps) {
  const [roles, setRoles] = useState<Role[]>(() => SEED_ROLES.map(r => ({ ...r, permissions: [...r.permissions] })));
  // Hydrate from a persisted session first; only fall back to the login gate
  // (startSignedOut) when there's nothing stored.
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(
    () => readPersistedUser() ?? (startSignedOut ? null : DEFAULT_USER),
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    () => readPersistedWorkspace() ?? DEFAULT_WORKSPACE.id,
  );

  const setActiveWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    try { window.localStorage.setItem(AUTH_WS_KEY, id); } catch { /* ignore */ }
  }, []);

  const activeRole = useMemo(
    () => (currentUser ? roles.find(r => r.id === currentUser.roleId) ?? null : null),
    [currentUser, roles],
  );

  const permSet = useMemo(() => new Set(activeRole?.permissions ?? []), [activeRole]);

  const can = useCallback((key: PermissionKey) => permSet.has(key), [permSet]);
  const canAny = useCallback((keys: PermissionKey[]) => keys.some(k => permSet.has(k)), [permSet]);

  const signIn = useCallback((userId: string) => {
    const u = DEMO_USERS.find(d => d.id === userId) ?? DEFAULT_USER;
    setCurrentUser(u);
    try { window.localStorage.setItem(AUTH_USER_KEY, u.id); } catch { /* ignore */ }
  }, []);

  const signOut = useCallback(() => {
    setCurrentUser(null);
    try { window.localStorage.removeItem(AUTH_USER_KEY); } catch { /* ignore */ }
  }, []);

  const updateRolePermissions = useCallback((roleId: string, permissions: PermissionKey[]) => {
    setRoles(prev => prev.map(r => (r.id === roleId ? { ...r, permissions: [...permissions] } : r)));
  }, []);

  const addRole = useCallback((role: Role) => {
    setRoles(prev => [...prev, role]);
  }, []);

  const removeRole = useCallback((roleId: string) => {
    setRoles(prev => prev.filter(r => r.id !== roleId));
  }, []);

  const value = useMemo<CurrentUserContextValue>(() => ({
    currentUser, activeWorkspaceId, setActiveWorkspace, roles, activeRole,
    can, canAny, signIn, signOut, updateRolePermissions, addRole, removeRole,
  }), [currentUser, activeWorkspaceId, roles, activeRole, can, canAny, signIn, signOut, updateRolePermissions, addRole, removeRole]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error('useCurrentUser must be used within CurrentUserProvider');
  return ctx;
}

/** Convenience hook for the common case — just the permission checkers. */
export function useCan() {
  const { can, canAny } = useCurrentUser();
  return { can, canAny };
}
