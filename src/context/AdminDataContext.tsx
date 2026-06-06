/**
 * Admin session data — the in-memory audit-log store.
 *
 * `logEvent()` is the single producer: gated actions across the app (role
 * edits, integration toggles, settings saves, deletes, etc.) append an entry,
 * and the Admin > Audit Logs tab is the consumer. No backend — logs live for
 * the session.
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useCurrentUser } from './CurrentUserContext';

/* ──────────────────────────────────────────────────────────────────────────
 * Users & Teams — session-persistent admin records
 * ────────────────────────────────────────────────────────────────────────── */

export type UserStatus = 'Active' | 'Inactive' | 'Invited' | 'Suspended' | 'Locked';

export interface AdminUser {
  name: string;
  initials: string;
  email: string;
  /** References a Role.id from rbac.ts — this is what drives the user's permissions. */
  roleId: string;
  team: string;
  status: UserStatus;
  lastLogin: string;
}

export interface AdminTeam {
  id: string;
  name: string;
  members: string[];
  /** Team admin/owner — one member's name; the person who manages the team. */
  owner?: string;
}

const SEED_USERS: AdminUser[] = [
  { name: 'Abhinav Sharma', initials: 'AS', email: 'abhinav@irame.ai', roleId: 'role-admin', team: 'SOX Audit', status: 'Active', lastLogin: 'Today, 09:14' },
  { name: 'Aditya Thakur', initials: 'AT', email: 'aditya.thakur@irame.ai', roleId: 'role-auditor', team: 'SOX Audit', status: 'Active', lastLogin: 'Today, 08:30' },
  { name: 'AI', initials: 'AI', email: 'ai@irame.ai', roleId: 'role-viewer', team: 'Engineering', status: 'Active', lastLogin: 'Yesterday' },
  { name: 'Ajay 14110008', initials: 'AJ', email: 'ajay.aj@btech2014.iitgn.ac.in', roleId: 'role-enabler', team: 'IFC Team', status: 'Invited', lastLogin: 'Never' },
  { name: 'ajay mudhai', initials: 'AM', email: 'ajay@irame.ai', roleId: 'role-enabler', team: 'IFC Team', status: 'Active', lastLogin: 'Apr 20' },
  { name: 'Ajay Mudhai', initials: 'AM', email: 'ajaym@irame.ai', roleId: 'role-admin', team: 'Management', status: 'Active', lastLogin: 'Apr 19' },
  { name: 'Ayushi Narang', initials: 'AN', email: 'ayushi.narang@irame.ai', roleId: 'role-enabler', team: 'SOX Audit', status: 'Active', lastLogin: 'Apr 21' },
  { name: 'Chulbul Pandey', initials: 'CP', email: 'kuldeep.msvm@gmail.com', roleId: 'role-enabler', team: 'Management', status: 'Suspended', lastLogin: 'Mar 28' },
  { name: 'CS', initials: 'CS', email: 'cs@irame.ai', roleId: 'role-enabler', team: 'Engineering', status: 'Active', lastLogin: 'Today, 10:02' },
  { name: 'Kuldeep Pandey', initials: 'KP', email: 'kuldeep2.msvm@gmail.com', roleId: 'role-reviewer', team: '—', status: 'Inactive', lastLogin: 'Feb 14' },
  { name: 'Rahul Verma', initials: 'RV', email: 'rahul@irame.ai', roleId: 'role-viewer', team: 'IFC Team', status: 'Locked', lastLogin: 'Mar 05' },
  { name: 'Priya Singh', initials: 'PS', email: 'priya@irame.ai', roleId: 'role-risk', team: 'SOX Audit', status: 'Invited', lastLogin: 'Never' },
];

function deriveTeams(users: AdminUser[]): AdminTeam[] {
  const map: Record<string, AdminUser[]> = {};
  users.forEach(u => { if (u.team !== '—') { (map[u.team] ??= []).push(u); } });
  return Object.entries(map).map(([name, mem]) => {
    // Strict: a team is owned by a System Admin member only — otherwise it starts
    // Unassigned (matches the deletion-reconcile rule; never auto-assign a
    // non-admin as team admin).
    const admin = mem.find(m => m.roleId === 'role-admin');
    return {
      id: `team-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      members: mem.map(m => m.name),
      owner: admin?.name,
    };
  });
}

export interface AuditLog {
  timestamp: string;
  user: string;
  action: 'Create' | 'Update' | 'Delete' | 'Login' | 'Export';
  description: string;
  module: string;
  entity: string;
  status: 'Success' | 'Failed';
}

/** Seed history shown before the session produces its own entries. */
export const SEED_LOGS: AuditLog[] = [
  { timestamp: '2026-04-19 10:30:50', user: 'Abhinav Sharma', action: 'Update', description: 'Updated business process "Procure to Pay" status to Active', module: 'Process Hub', entity: 'Business Process', status: 'Success' },
  { timestamp: '2026-04-19 09:14:22', user: 'Abhinav Sharma', action: 'Login', description: 'User logged in via SSO', module: 'Admin', entity: 'Session', status: 'Success' },
  { timestamp: '2026-04-18 14:22:11', user: 'Tushar Goel', action: 'Create', description: 'Created new role "test manik role" with 8 permissions', module: 'Admin', entity: 'Role', status: 'Success' },
  { timestamp: '2026-04-18 09:15:33', user: 'Aditya Thakur', action: 'Delete', description: 'Deleted workflow "Legacy Invoice Check" from P2P', module: 'Workflow Library', entity: 'Workflow', status: 'Success' },
  { timestamp: '2026-04-17 16:45:02', user: 'Tushar Goel', action: 'Update', description: 'Updated control "SOD Violation Detector" effectiveness to 92%', module: 'Control Library', entity: 'Control', status: 'Success' },
  { timestamp: '2026-04-17 11:08:19', user: 'Aditya Thakur', action: 'Create', description: 'Created risk "Vendor master unauthorized change" in P2P register', module: 'Risk Register', entity: 'Risk', status: 'Success' },
  { timestamp: '2026-04-17 08:30:00', user: 'Ayushi Narang', action: 'Export', description: 'Exported SOX Compliance Report as PDF', module: 'Report', entity: 'Report', status: 'Success' },
  { timestamp: '2026-04-16 15:20:41', user: 'Tushar Goel', action: 'Update', description: 'Changed user "Chulbul Pandey" status from Active to Suspended', module: 'Admin', entity: 'User', status: 'Success' },
  { timestamp: '2026-04-16 10:05:33', user: 'Unknown', action: 'Login', description: 'Failed login attempt with email admin@irame.ai', module: 'Admin', entity: 'Session', status: 'Failed' },
  { timestamp: '2026-04-15 14:12:09', user: 'Ajay Mudhai', action: 'Create', description: 'Connected new data source "SAP ERP Production"', module: 'Knowledge Hub', entity: 'Data Source', status: 'Success' },
];

/** Fields a caller supplies; actor + timestamp are filled in automatically. */
export interface LogInput {
  action: AuditLog['action'];
  description: string;
  module: string;
  entity: string;
  status?: AuditLog['status'];
}

interface AdminDataContextValue {
  logs: AuditLog[];
  logEvent: (input: LogInput) => void;
  /** Role id assigned to newly-invited users by default. */
  defaultRoleId: string;
  setDefaultRoleId: (id: string) => void;
  // Users
  users: AdminUser[];
  inviteUser: (user: AdminUser) => void;
  updateUser: (email: string, patch: Partial<AdminUser>) => void;
  removeUser: (email: string) => void;
  // Teams
  teams: AdminTeam[];
  addTeam: (name: string, members: string[], owner?: string) => void;
  updateTeam: (id: string, patch: Partial<Omit<AdminTeam, 'id'>>) => void;
  removeTeam: (id: string) => void;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useCurrentUser();
  const [logs, setLogs] = useState<AuditLog[]>(() => [...SEED_LOGS]);
  const [users, setUsers] = useState<AdminUser[]>(() => SEED_USERS.map(u => ({ ...u })));
  const [teams, setTeams] = useState<AdminTeam[]>(() => deriveTeams(SEED_USERS));
  const [defaultRoleId, setDefaultRoleId] = useState<string>('role-viewer');

  const logEvent = useCallback((input: LogInput) => {
    setLogs(prev => [
      {
        timestamp: nowStamp(),
        user: currentUser?.name ?? 'Unknown',
        action: input.action,
        description: input.description,
        module: input.module,
        entity: input.entity,
        status: input.status ?? 'Success',
      },
      ...prev,
    ]);
  }, [currentUser]);

  // ── Users ──
  const inviteUser = useCallback((user: AdminUser) => {
    setUsers(prev => [user, ...prev]);
  }, []);
  const updateUser = useCallback((email: string, patch: Partial<AdminUser>) => {
    setUsers(prevUsers => {
      const before = prevUsers.find(u => u.email === email);
      // Keep team member/owner references in sync when a person is renamed —
      // teams store members + owner by name, so a stale name would orphan them.
      if (before && patch.name && patch.name !== before.name) {
        const oldName = before.name;
        const newName = patch.name;
        setTeams(prevTeams => prevTeams.map(t => ({
          ...t,
          members: t.members.map(m => (m === oldName ? newName : m)),
          owner: t.owner === oldName ? newName : t.owner,
        })));
      }
      // A suspended/locked person can't actively own a team — transfer ownership
      // to another System Admin member, else leave it Unassigned. (Strict.)
      if (before && (patch.status === 'Suspended' || patch.status === 'Locked') && before.status !== patch.status) {
        const name = before.name;
        setTeams(prevTeams => prevTeams.map(t => {
          if (t.owner !== name) return t;
          const adminMember = t.members.find(mn => mn !== name && prevUsers.find(u => u.name === mn)?.roleId === 'role-admin');
          return { ...t, owner: adminMember };
        }));
      }
      return prevUsers.map(u => (u.email === email ? { ...u, ...patch } : u));
    });
  }, []);
  const removeUser = useCallback((email: string) => {
    setUsers(prevUsers => {
      const removed = prevUsers.find(u => u.email === email);
      // Reconcile teams: drop the removed person from members, and if they were
      // the owner, transfer ONLY to a System Admin member. Never auto-promote a
      // non-admin (Viewer/Enabler/etc.) to team admin — leave it Unassigned so
      // an admin makes the call deliberately.
      if (removed) {
        const name = removed.name;
        const remaining = prevUsers.filter(u => u.email !== email);
        setTeams(prevTeams => prevTeams.map(t => {
          if (!t.members.includes(name)) return t;
          const members = t.members.filter(m => m !== name);
          let owner = t.owner;
          if (t.owner === name) {
            // undefined → Unassigned when no System Admin member remains.
            owner = members.find(mn => remaining.find(u => u.name === mn)?.roleId === 'role-admin');
          }
          return { ...t, members, owner };
        }));
      }
      return prevUsers.filter(u => u.email !== email);
    });
  }, []);

  // ── Teams ──
  const addTeam = useCallback((name: string, members: string[], owner?: string) => {
    setTeams(prev => [...prev, { id: `team-${Date.now()}`, name, members, owner: owner ?? members[0] }]);
  }, []);
  const updateTeam = useCallback((id: string, patch: Partial<Omit<AdminTeam, 'id'>>) => {
    setTeams(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);
  const removeTeam = useCallback((id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id));
  }, []);

  const value = useMemo<AdminDataContextValue>(() => ({
    logs, logEvent,
    defaultRoleId, setDefaultRoleId,
    users, inviteUser, updateUser, removeUser,
    teams, addTeam, updateTeam, removeTeam,
  }), [logs, logEvent, defaultRoleId, users, inviteUser, updateUser, removeUser, teams, addTeam, updateTeam, removeTeam]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData(): AdminDataContextValue {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used within AdminDataProvider');
  return ctx;
}

/** Convenience — just the producer, for feature views that only emit events. */
export function useAuditLog() {
  return useAdminData().logEvent;
}
