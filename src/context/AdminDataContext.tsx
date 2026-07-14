/**
 * Admin session data — the in-memory audit-log store.
 *
 * `logEvent()` is the single producer: gated actions across the app (role
 * edits, integration toggles, settings saves, deletes, etc.) append an entry,
 * and the Admin > Audit Logs tab is the consumer. No backend — logs live for
 * the session.
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useCurrentUser, DEMO_USERS } from './CurrentUserContext';
import { SEED_LOGS, lastActiveByName } from '../data/audit-history';

export { SEED_LOGS };

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

/**
 * Last sign-in, read off the seeded audit history rather than typed in by hand.
 * A member who has never appeared in the log has never signed in — which is
 * exactly what an unaccepted invite looks like.
 *
 * This is what keeps Platform Usage honest: "no sign-in for 30+ days" is
 * measured against the same events the rest of the page counts, so a member
 * can't read as dormant on one card and busy on the next.
 */
const LAST_ACTIVE = lastActiveByName();
const lastLoginOf = (name: string) => LAST_ACTIVE[name] ?? 'Never';

const SEED_USERS: AdminUser[] = [
  { name: 'Abhinav Sharma', initials: 'AS', email: 'abhinav@irame.ai', roleId: 'role-admin', team: 'SOX Audit', status: 'Active', lastLogin: lastLoginOf('Abhinav Sharma') },
  { name: 'Aditya Thakur', initials: 'AT', email: 'aditya.thakur@irame.ai', roleId: 'role-auditor', team: 'SOX Audit', status: 'Active', lastLogin: lastLoginOf('Aditya Thakur') },
  { name: 'AI', initials: 'AI', email: 'ai@irame.ai', roleId: 'role-viewer', team: 'Engineering', status: 'Active', lastLogin: lastLoginOf('AI') },
  { name: 'Ajay 14110008', initials: 'AJ', email: 'ajay.aj@btech2014.iitgn.ac.in', roleId: 'role-enabler', team: 'IFC Team', status: 'Invited', lastLogin: lastLoginOf('Ajay 14110008') },
  { name: 'ajay mudhai', initials: 'AM', email: 'ajay@irame.ai', roleId: 'role-enabler', team: 'IFC Team', status: 'Active', lastLogin: lastLoginOf('ajay mudhai') },
  { name: 'Ajay Mudhai', initials: 'AM', email: 'ajaym@irame.ai', roleId: 'role-admin', team: 'Management', status: 'Active', lastLogin: lastLoginOf('Ajay Mudhai') },
  { name: 'Ayushi Narang', initials: 'AN', email: 'ayushi.narang@irame.ai', roleId: 'role-enabler', team: 'SOX Audit', status: 'Active', lastLogin: lastLoginOf('Ayushi Narang') },
  { name: 'Chulbul Pandey', initials: 'CP', email: 'kuldeep.msvm@gmail.com', roleId: 'role-enabler', team: 'Management', status: 'Suspended', lastLogin: lastLoginOf('Chulbul Pandey') },
  { name: 'CS', initials: 'CS', email: 'cs@irame.ai', roleId: 'role-enabler', team: 'Engineering', status: 'Active', lastLogin: lastLoginOf('CS') },
  { name: 'Kuldeep Pandey', initials: 'KP', email: 'kuldeep2.msvm@gmail.com', roleId: 'role-reviewer', team: '—', status: 'Inactive', lastLogin: lastLoginOf('Kuldeep Pandey') },
  // The signed-in identity (CurrentUserContext `u-admin`). Name and email must
  // match it exactly: the audit log stamps `currentUser.name`, and Platform
  // Usage attributes activity to a member by that name.
  { name: 'Nilesh Anand', initials: 'NA', email: 'nilesh.anand@irame.ai', roleId: 'role-admin', team: 'Management', status: 'Active', lastLogin: lastLoginOf('Nilesh Anand') },
  { name: 'Rahul Verma', initials: 'RV', email: 'rahul@irame.ai', roleId: 'role-viewer', team: 'IFC Team', status: 'Locked', lastLogin: lastLoginOf('Rahul Verma') },
  { name: 'Priya Singh', initials: 'PS', email: 'priya@irame.ai', roleId: 'role-risk', team: 'SOX Audit', status: 'Invited', lastLogin: lastLoginOf('Priya Singh') },
  // The remaining sign-in personas (CurrentUserContext DEMO_USERS). They belong
  // on the People list for the same reason Nilesh does: whoever you sign in as
  // stamps the audit log with their name, and an actor who isn't a member can
  // never be attributed — their usage would just vanish off this page.
  { name: 'Karan Mehta', initials: 'KM', email: 'karan.mehta@irame.ai', roleId: 'role-enabler', team: 'Management', status: 'Active', lastLogin: lastLoginOf('Karan Mehta') },
  { name: 'Tushar Goel', initials: 'TG', email: 'tushar.goel@irame.ai', roleId: 'role-auditor', team: 'SOX Audit', status: 'Active', lastLogin: lastLoginOf('Tushar Goel') },
  { name: 'Vijay Reddy', initials: 'VR', email: 'vijay.reddy@irame.ai', roleId: 'role-reviewer', team: 'IFC Team', status: 'Active', lastLogin: lastLoginOf('Vijay Reddy') },
  { name: 'Sana Kapoor', initials: 'SK', email: 'sana.kapoor@irame.ai', roleId: 'role-viewer', team: 'Engineering', status: 'Active', lastLogin: lastLoginOf('Sana Kapoor') },
];

// Two identity lists exist: DEMO_USERS (who you can sign in as) and SEED_USERS
// (who appears in Admin › People). An identity missing from the member list
// still writes audit events under its name, but nothing can attribute them —
// its usage silently vanishes from Platform Usage. Fail loudly in dev.
if (import.meta.env.DEV) {
  const members = new Set(SEED_USERS.map(u => u.name));
  const orphans = DEMO_USERS.filter(u => !members.has(u.name)).map(u => u.name);
  if (orphans.length > 0) {
    console.error(
      `[AdminData] Signed-in identities absent from Admin › People: ${orphans.join(', ')}. ` +
      'Their activity will never attribute to a member. Add them to SEED_USERS.',
    );
  }
}

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
  /** The workspace the action happened in (Workspace.id). Stamped from whichever
   *  workspace the actor had open — the same one the sidebar switcher shows. This
   *  is what makes usage answerable per workspace rather than only platform-wide. */
  workspaceId: string;
}

/** Collision-proof id (crypto.randomUUID when available, else a random fallback). */
function uid(prefix = 'id'): string {
  const rnd = (globalThis.crypto as Crypto | undefined)?.randomUUID?.();
  return `${prefix}-${rnd ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

// The seeded history (src/data/audit-history.ts) is generated from one persona
// per member, so an event can't be written by someone who isn't on the People
// list. Assert it anyway — this is the failure that silently deletes a member's
// activity from Platform Usage, and it's invisible until someone goes looking.
if (import.meta.env.DEV) {
  const members = new Set(SEED_USERS.map(u => u.name));
  const ghosts = [...new Set(SEED_LOGS.map(l => l.user))]
    .filter(name => name !== 'Unknown' && !members.has(name));
  if (ghosts.length > 0) {
    console.error(
      `[AdminData] Audit events by non-members: ${ghosts.join(', ')}. ` +
      'Their usage will never attribute to anyone. Add them to SEED_USERS or fix the persona name.',
    );
  }
}

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
  const { currentUser, activeWorkspaceId } = useCurrentUser();
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
        // Whichever workspace the actor has open. Not caller-supplied: an event
        // must be attributed to where it actually happened.
        workspaceId: activeWorkspaceId,
      },
      ...prev,
    ]);
  }, [currentUser, activeWorkspaceId]);

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
