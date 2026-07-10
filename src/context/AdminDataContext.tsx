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
    // Every team must have an owner: prefer a System Admin member, else fall back
    // to the first member. A team is never Unassigned while it has members.
    const admin = mem.find(m => m.roleId === 'role-admin');
    return {
      id: `team-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      members: mem.map(m => m.name),
      owner: (admin ?? mem[0])?.name,
    };
  });
}

export interface AuditLog {
  /** Stable unique key — many events can share a timestamp (same second). */
  id: string;
  timestamp: string;
  user: string;
  action: 'Create' | 'Update' | 'Delete' | 'Login' | 'Export' | 'Run' | 'Upload' | 'Share';
  description: string;
  module: string;
  entity: string;
  status: 'Success' | 'Failed';
}

/** Collision-proof id (crypto.randomUUID when available, else a random fallback). */
function uid(prefix = 'id'): string {
  const rnd = (globalThis.crypto as Crypto | undefined)?.randomUUID?.();
  return `${prefix}-${rnd ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

/** Seed history shown before the session produces its own entries. Ids are
 *  assigned at provider init so every row has a stable, unique key. */
export const SEED_LOGS: Omit<AuditLog, 'id'>[] = [
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
  { timestamp: '2026-04-15 11:47:55', user: 'Ayushi Narang', action: 'Update', description: 'Updated RACM mapping for "Order to Cash" — linked 3 controls', module: 'RACM', entity: 'RACM Mapping', status: 'Success' },
  { timestamp: '2026-04-15 09:02:14', user: 'Karan Mehta', action: 'Login', description: 'User logged in via SSO', module: 'Admin', entity: 'Session', status: 'Success' },
  { timestamp: '2026-04-14 17:33:48', user: 'Aditya Thakur', action: 'Create', description: 'Created engagement "FY26 Q1 SOX Walkthrough"', module: 'Engagements', entity: 'Engagement', status: 'Success' },
  { timestamp: '2026-04-14 13:19:27', user: 'Tushar Goel', action: 'Update', description: 'Reassigned exception "Duplicate vendor payment" to Risk Owner', module: 'Exceptions', entity: 'Exception', status: 'Success' },
  { timestamp: '2026-04-14 08:51:06', user: 'Unknown', action: 'Login', description: 'Failed login attempt with email contractor@external.com', module: 'Admin', entity: 'Session', status: 'Failed' },
  { timestamp: '2026-04-13 16:08:39', user: 'Ayushi Narang', action: 'Export', description: 'Exported audit log as CSV (142 events)', module: 'Admin', entity: 'Audit Log', status: 'Success' },
  { timestamp: '2026-04-13 12:40:11', user: 'Abhinav Sharma', action: 'Update', description: 'Edited working paper "P2P-WP-007" and marked for review', module: 'Engagement Execution', entity: 'Working Paper', status: 'Success' },
  { timestamp: '2026-04-13 10:22:53', user: 'Ajay Mudhai', action: 'Delete', description: 'Removed data source "Legacy Oracle EBS"', module: 'Knowledge Hub', entity: 'Data Source', status: 'Success' },
  { timestamp: '2026-04-12 15:55:30', user: 'Tushar Goel', action: 'Create', description: 'Added control "Three-way match enforcement" to P2P library', module: 'Control Library', entity: 'Control', status: 'Success' },
  { timestamp: '2026-04-12 09:37:18', user: 'Karan Mehta', action: 'Update', description: 'Updated dashboard "Risk Heatmap" layout and shared with team', module: 'Dashboard', entity: 'Dashboard', status: 'Success' },
  { timestamp: '2026-04-11 14:48:02', user: 'Aditya Thakur', action: 'Export', description: 'Exported RACM matrix for "Procure to Pay" as XLSX', module: 'RACM', entity: 'RACM Matrix', status: 'Success' },
  { timestamp: '2026-04-11 11:14:44', user: 'Abhinav Sharma', action: 'Create', description: 'Invited user "priya.singh@irame.ai" as Risk Owner', module: 'Admin', entity: 'Invitation', status: 'Success' },
  { timestamp: '2026-04-10 16:29:57', user: 'Ayushi Narang', action: 'Update', description: 'Closed exception "Missing PO approval" with remediation note', module: 'Exceptions', entity: 'Exception', status: 'Success' },
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
  // Teams — membership is single-sourced on AdminUser.team; `members` here is
  // derived live from the user list (see the `teams` memo). A team entity only
  // stores identity + owner.
  teams: AdminTeam[];
  addTeam: (name: string, members: string[], owner?: string) => void;
  updateTeam: (id: string, patch: Partial<Omit<AdminTeam, 'id' | 'members'>>) => void;
  removeTeam: (id: string) => void;
  /** Set exactly which users belong to a team (by name) — the membership write. */
  setTeamMembership: (teamName: string, memberNames: string[]) => void;
}

/** Stored team entity — identity + owner only. Members are derived from users. */
interface TeamBase {
  id: string;
  name: string;
  owner?: string;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useCurrentUser();
  const [logs, setLogs] = useState<AuditLog[]>(() => SEED_LOGS.map(l => ({ ...l, id: uid('log') })));
  const [users, setUsers] = useState<AdminUser[]>(() => SEED_USERS.map(u => ({ ...u })));
  const [teamsBase, setTeamsBase] = useState<TeamBase[]>(
    () => deriveTeams(SEED_USERS).map(t => ({ id: t.id, name: t.name, owner: t.owner })),
  );
  const [defaultRoleId, setDefaultRoleId] = useState<string>('role-viewer');

  // Teams with live-derived membership: a team's members are exactly the users
  // whose `team` field matches its name. Owner is the stored preference if that
  // person is still a member, otherwise it self-heals to a System Admin member,
  // else the first member — so a populated team always shows a valid owner and
  // membership/owner can never drift out of sync with the People list.
  const teams = useMemo<AdminTeam[]>(() => teamsBase.map(t => {
    const members = users.filter(u => u.team === t.name).map(u => u.name);
    const ownerValid = !!t.owner && members.includes(t.owner);
    const owner = ownerValid
      ? t.owner
      : members.find(m => users.find(u => u.name === m)?.roleId === 'role-admin') ?? members[0];
    return { id: t.id, name: t.name, members, owner };
  }), [teamsBase, users]);

  const logEvent = useCallback((input: LogInput) => {
    setLogs(prev => [
      {
        id: uid('log'),
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

  // ── Users ── (membership lives here: AdminUser.team is the single source)
  const inviteUser = useCallback((user: AdminUser) => {
    // Email is the identity key (and the SmartTable row key) — never allow two
    // rows with the same email, or row identity (select/edit/remove) collides.
    // The new user's `team` field is enough to make them a member of that team;
    // no separate team write is needed (membership is derived from users).
    setUsers(prev => (
      prev.some(u => u.email.toLowerCase() === user.email.trim().toLowerCase())
        ? prev
        : [user, ...prev]
    ));
  }, []);
  const updateUser = useCallback((email: string, patch: Partial<AdminUser>) => {
    setUsers(prevUsers => {
      const before = prevUsers.find(u => u.email === email);
      // A rename only needs to follow the stored owner *preference* (members are
      // derived, so they re-derive the new name automatically).
      if (before && patch.name && patch.name !== before.name) {
        const oldName = before.name;
        const newName = patch.name;
        setTeamsBase(prev => prev.map(t => (t.owner === oldName ? { ...t, owner: newName } : t)));
      }
      // A suspended/locked person can't actively own a team — hand ownership to
      // another active System Admin member, else the first other member, so the
      // stored preference points at someone who can act. (A team they still
      // belong to keeps them as a member; they just stop being owner.)
      if (before && (patch.status === 'Suspended' || patch.status === 'Locked') && before.status !== patch.status) {
        const name = before.name;
        setTeamsBase(prev => prev.map(t => {
          if (t.owner !== name) return t;
          const otherMembers = prevUsers.filter(u => u.team === t.name && u.name !== name);
          const next = otherMembers.find(u => u.roleId === 'role-admin')?.name ?? otherMembers[0]?.name;
          return { ...t, owner: next };
        }));
      }
      return prevUsers.map(u => (u.email === email ? { ...u, ...patch } : u));
    });
  }, []);
  const removeUser = useCallback((email: string) => {
    // Membership + owner self-heal from the derived `teams` memo once the user is
    // gone, so we only have to drop the user record here.
    setUsers(prevUsers => prevUsers.filter(u => u.email !== email));
  }, []);

  // ── Teams ── (identity + owner only; membership is a user-side write)
  const addTeam = useCallback((name: string, members: string[], owner?: string) => {
    setTeamsBase(prev => [...prev, { id: uid('team'), name, owner: owner ?? members[0] }]);
    // Make the selected people members by pointing their `team` at the new team.
    if (members.length > 0) {
      const set = new Set(members);
      setUsers(prev => prev.map(u => (set.has(u.name) ? { ...u, team: name } : u)));
    }
  }, []);
  const updateTeam = useCallback((id: string, patch: Partial<Omit<AdminTeam, 'id' | 'members'>>) => {
    setTeamsBase(prev => {
      const t = prev.find(x => x.id === id);
      if (!t) return prev;
      // Renaming a team cascades to every member's `team` field so membership
      // follows the rename (members are matched to teams by name).
      if (patch.name && patch.name !== t.name) {
        const oldName = t.name;
        const newName = patch.name;
        setUsers(prevU => prevU.map(u => (u.team === oldName ? { ...u, team: newName } : u)));
      }
      return prev.map(x => (x.id === id
        ? { ...x, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.owner !== undefined ? { owner: patch.owner } : {}) }
        : x));
    });
  }, []);
  const removeTeam = useCallback((id: string) => {
    setTeamsBase(prev => {
      const t = prev.find(x => x.id === id);
      // Unassign its members (the confirm copy promises this) — set anyone on the
      // team back to '—' so no user is left pointing at a deleted team.
      if (t) setUsers(prevU => prevU.map(u => (u.team === t.name ? { ...u, team: '—' } : u)));
      return prev.filter(x => x.id !== id);
    });
  }, []);
  const setTeamMembership = useCallback((teamName: string, memberNames: string[]) => {
    const set = new Set(memberNames);
    setUsers(prev => prev.map(u => {
      if (set.has(u.name) && u.team !== teamName) return { ...u, team: teamName };   // added
      if (!set.has(u.name) && u.team === teamName) return { ...u, team: '—' };        // removed
      return u;
    }));
  }, []);

  const value = useMemo<AdminDataContextValue>(() => ({
    logs, logEvent,
    defaultRoleId, setDefaultRoleId,
    users, inviteUser, updateUser, removeUser,
    teams, addTeam, updateTeam, removeTeam, setTeamMembership,
  }), [logs, logEvent, defaultRoleId, users, inviteUser, updateUser, removeUser, teams, addTeam, updateTeam, removeTeam, setTeamMembership]);

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
