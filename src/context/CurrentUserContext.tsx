/**
 * Current user + permission context — the single place the app asks
 * "can the signed-in user do X?".
 *
 * Holds:
 *  - the roster of roles (seeded from rbac.ts, editable by the Roles & Permissions
 *    admin screen so the matrix actually drives enforcement),
 *  - the signed-in identity and their active role,
 *  - `can()` / `canAny()` for gating,
 *  - `setActiveRole()` — the "View as role" switcher (demo affordance),
 *  - `signIn()` / `signOut()` for the prototype login layer.
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

/** Demo personas — one per seed role so login / switcher can pick a persona. */
export const DEMO_USERS: AuthUser[] = [
  { id: 'u-admin',    name: 'Nilesh Anand', email: 'nilesh.anand@irame.ai', initials: 'NA', title: 'Administrator', roleId: 'role-admin' },
  { id: 'u-enabler',  name: 'Karan Mehta',  email: 'karan.mehta@irame.ai',  initials: 'KM', title: 'Audit Manager', roleId: 'role-enabler' },
  { id: 'u-auditor',  name: 'Tushar Goel',  email: 'tushar.goel@irame.ai',  initials: 'TG', title: 'Auditor',       roleId: 'role-auditor' },
  { id: 'u-risk',     name: 'Priya Singh',  email: 'priya.singh@irame.ai',  initials: 'PS', title: 'Risk Owner',    roleId: 'role-risk' },
  { id: 'u-reviewer', name: 'Vijay Reddy',  email: 'vijay.reddy@irame.ai',  initials: 'VR', title: 'Reviewer',      roleId: 'role-reviewer' },
  { id: 'u-viewer',   name: 'Sana Kapoor',  email: 'sana.kapoor@irame.ai',  initials: 'SK', title: 'Viewer',        roleId: 'role-viewer' },
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
  /** Switch the active role of the signed-in identity ("View as role"). */
  setActiveRole: (roleId: string) => void;
  /** Sign in as a specific persona (prototype login). */
  signIn: (userId: string) => void;
  signOut: () => void;
  /** Roles editor write-back — keeps enforcement in sync with the matrix. */
  updateRolePermissions: (roleId: string, permissions: PermissionKey[]) => void;
  addRole: (role: Role) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Start signed-out (show login) — defaults to signed-in as System Admin. */
  startSignedOut?: boolean;
}

export function CurrentUserProvider({ children, startSignedOut = false }: ProviderProps) {
  const [roles, setRoles] = useState<Role[]>(() => SEED_ROLES.map(r => ({ ...r, permissions: [...r.permissions] })));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(startSignedOut ? null : DEFAULT_USER);
  const [activeWorkspaceId, setActiveWorkspace] = useState<string>(DEFAULT_WORKSPACE.id);

  const activeRole = useMemo(
    () => (currentUser ? roles.find(r => r.id === currentUser.roleId) ?? null : null),
    [currentUser, roles],
  );

  const permSet = useMemo(() => new Set(activeRole?.permissions ?? []), [activeRole]);

  const can = useCallback((key: PermissionKey) => permSet.has(key), [permSet]);
  const canAny = useCallback((keys: PermissionKey[]) => keys.some(k => permSet.has(k)), [permSet]);

  const setActiveRole = useCallback((roleId: string) => {
    setCurrentUser(u => (u ? { ...u, roleId } : u));
  }, []);

  const signIn = useCallback((userId: string) => {
    const u = DEMO_USERS.find(d => d.id === userId) ?? DEFAULT_USER;
    setCurrentUser(u);
  }, []);

  const signOut = useCallback(() => setCurrentUser(null), []);

  const updateRolePermissions = useCallback((roleId: string, permissions: PermissionKey[]) => {
    setRoles(prev => prev.map(r => (r.id === roleId ? { ...r, permissions: [...permissions] } : r)));
  }, []);

  const addRole = useCallback((role: Role) => {
    setRoles(prev => [...prev, role]);
  }, []);

  const value = useMemo<CurrentUserContextValue>(() => ({
    currentUser, activeWorkspaceId, setActiveWorkspace, roles, activeRole,
    can, canAny, setActiveRole, signIn, signOut, updateRolePermissions, addRole,
  }), [currentUser, activeWorkspaceId, roles, activeRole, can, canAny, setActiveRole, signIn, signOut, updateRolePermissions, addRole]);

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
