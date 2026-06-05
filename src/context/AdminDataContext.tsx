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
  role: string;
  team: string;
  status: UserStatus;
  lastLogin: string;
}

export interface AdminTeam {
  id: string;
  name: string;
  members: string[];
}

const SEED_USERS: AdminUser[] = [
  { name: 'Abhinav Sharma', initials: 'AS', email: 'abhinav@irame.ai', role: 'test role per final', team: 'SOX Audit', status: 'Active', lastLogin: 'Today, 09:14' },
  { name: 'Aditya Thakur', initials: 'AT', email: 'aditya.thakur@irame.ai', role: 'test invite permission', team: 'SOX Audit', status: 'Active', lastLogin: 'Today, 08:30' },
  { name: 'AI', initials: 'AI', email: 'ai@irame.ai', role: 'Test wf for case', team: 'Engineering', status: 'Active', lastLogin: 'Yesterday' },
  { name: 'Ajay 14110008', initials: 'AJ', email: 'ajay.aj@btech2014.iitgn.ac.in', role: 'Enabler', team: 'IFC Team', status: 'Invited', lastLogin: 'Never' },
  { name: 'ajay mudhai', initials: 'AM', email: 'ajay@irame.ai', role: 'Enabler', team: 'IFC Team', status: 'Active', lastLogin: 'Apr 20' },
  { name: 'Ajay Mudhai', initials: 'AM', email: 'ajaym@irame.ai', role: 'system clone/all permissions', team: 'Management', status: 'Active', lastLogin: 'Apr 19' },
  { name: 'Ayushi Narang', initials: 'AN', email: 'ayushi.narang@irame.ai', role: 'Enabler', team: 'SOX Audit', status: 'Active', lastLogin: 'Apr 21' },
  { name: 'Chulbul Pandey', initials: 'CP', email: 'kuldeep.msvm@gmail.com', role: 'Enabler', team: 'Management', status: 'Suspended', lastLogin: 'Mar 28' },
  { name: 'CS', initials: 'CS', email: 'cs@irame.ai', role: 'Enabler', team: 'Engineering', status: 'Active', lastLogin: 'Today, 10:02' },
  { name: 'Kuldeep Pandey', initials: 'KP', email: 'kuldeep2.msvm@gmail.com', role: 'Nitin Test', team: '—', status: 'Inactive', lastLogin: 'Feb 14' },
  { name: 'Rahul Verma', initials: 'RV', email: 'rahul@irame.ai', role: 'Viewer', team: 'IFC Team', status: 'Locked', lastLogin: 'Mar 05' },
  { name: 'Priya Singh', initials: 'PS', email: 'priya@irame.ai', role: 'Enabler', team: 'SOX Audit', status: 'Invited', lastLogin: 'Never' },
];

function deriveTeams(users: AdminUser[]): AdminTeam[] {
  const map: Record<string, string[]> = {};
  users.forEach(u => { if (u.team !== '—') { (map[u.team] ??= []).push(u.name); } });
  return Object.entries(map).map(([name, members]) => ({ id: `team-${name.toLowerCase().replace(/\s+/g, '-')}`, name, members }));
}

export interface AuditLog {
  timestamp: string;
  user: string;
  action: 'Create' | 'Update' | 'Delete' | 'Login' | 'Export';
  description: string;
  module: string;
  entity: string;
  status: 'Success' | 'Failed';
  ip: string;
}

/** Seed history shown before the session produces its own entries. */
export const SEED_LOGS: AuditLog[] = [
  { timestamp: '2026-04-19 10:30:50', user: 'Abhinav Sharma', action: 'Update', description: 'Updated business process "Procure to Pay" status to Active', module: 'Process Hub', entity: 'Business Process', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-19 09:14:22', user: 'Abhinav Sharma', action: 'Login', description: 'User logged in via SSO', module: 'Admin', entity: 'Session', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-18 14:22:11', user: 'Tushar Goel', action: 'Create', description: 'Created new role "test manik role" with 8 permissions', module: 'Admin', entity: 'Role', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-18 09:15:33', user: 'Aditya Thakur', action: 'Delete', description: 'Deleted workflow "Legacy Invoice Check" from P2P', module: 'Workflow Library', entity: 'Workflow', status: 'Success', ip: '10.0.0.42' },
  { timestamp: '2026-04-17 16:45:02', user: 'Tushar Goel', action: 'Update', description: 'Updated control "SOD Violation Detector" effectiveness to 92%', module: 'Control Library', entity: 'Control', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-17 11:08:19', user: 'Aditya Thakur', action: 'Create', description: 'Created risk "Vendor master unauthorized change" in P2P register', module: 'Risk Register', entity: 'Risk', status: 'Success', ip: '10.0.0.42' },
  { timestamp: '2026-04-17 08:30:00', user: 'Ayushi Narang', action: 'Export', description: 'Exported SOX Compliance Report as PDF', module: 'Report', entity: 'Report', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-16 15:20:41', user: 'Tushar Goel', action: 'Update', description: 'Changed user "Chulbul Pandey" status from Active to Suspended', module: 'Admin', entity: 'User', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-16 10:05:33', user: 'Unknown', action: 'Login', description: 'Failed login attempt with email admin@irame.ai', module: 'Admin', entity: 'Session', status: 'Failed', ip: '185.42.12.8' },
  { timestamp: '2026-04-15 14:12:09', user: 'Ajay Mudhai', action: 'Create', description: 'Connected new data source "SAP ERP Production"', module: 'Knowledge Hub', entity: 'Data Source', status: 'Success', ip: '172.18.0.1' },
];

/** Fields a caller supplies; actor + timestamp + ip are filled in automatically. */
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
  addTeam: (name: string, members: string[]) => void;
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
        ip: '172.18.0.1',
      },
      ...prev,
    ]);
  }, [currentUser]);

  // ── Users ──
  const inviteUser = useCallback((user: AdminUser) => {
    setUsers(prev => [user, ...prev]);
  }, []);
  const updateUser = useCallback((email: string, patch: Partial<AdminUser>) => {
    setUsers(prev => prev.map(u => (u.email === email ? { ...u, ...patch } : u)));
  }, []);
  const removeUser = useCallback((email: string) => {
    setUsers(prev => prev.filter(u => u.email !== email));
  }, []);

  // ── Teams ──
  const addTeam = useCallback((name: string, members: string[]) => {
    setTeams(prev => [...prev, { id: `team-${Date.now()}`, name, members }]);
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
