import DatePicker from '../shared/DatePicker';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Shield, ScrollText,
  UserPlus, Plus, Download, Filter,
  Eye, ChevronDown, Search, Pencil, CopyPlus, Info, Trash2,
} from 'lucide-react';
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS, PERSON_ROLES, type PermissionKey, type Role } from '../../data/rbac';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAdminData, useAuditLog, type AuditLog, type AdminTeam } from '../../context/AdminDataContext';
import SmartTable, { type Column } from '../shared/SmartTable';
import { StatusBadge } from '../shared/StatusBadge';
import FloatingLines from '../shared/FloatingLines';
import Modal from '../shared/Modal';
import Toggle from '../shared/Toggle';
import Checkbox from '../shared/Checkbox';
import ConfirmationModal from '../shared/ConfirmationModal';
import EmptyState from '../shared/EmptyState';
import { useToast } from '../shared/Toast';

interface Props {
  activeTab?: string;
}

type TabId = 'users' | 'teams' | 'roles' | 'logs';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Users;
}

const tabs: Tab[] = [
  { id: 'users', label: 'Users & Teams', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'logs', label: 'Audit Logs', icon: ScrollText },
];

type UserStatus = 'Active' | 'Inactive' | 'Invited' | 'Suspended' | 'Locked';

interface MockUser {
  name: string;
  initials: string;
  email: string;
  role: string;
  team: string;
  status: UserStatus;
  lastLogin: string;
}

const STATUS_MAP: Record<UserStatus, string> = {
  Active: 'active',
  Inactive: 'inactive',
  Invited: 'invited',
  Suspended: 'suspended',
  Locked: 'locked',
};

/* ── Shared form-field + footer button tokens (match canonical drawer) ── */
const FIELD_LABEL = 'block text-[0.75rem] font-semibold text-ink-700 mb-1.5';
const FIELD_INPUT =
  'w-full px-3 h-10 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 outline-none placeholder:text-ink-400 focus:border-brand-600 transition-colors';
const FIELD_SELECT = `${FIELD_INPUT} appearance-none cursor-pointer pr-9`;
const FIELD_TEXTAREA =
  'w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 outline-none placeholder:text-ink-400 resize-none focus:border-brand-600 transition-colors';
const BTN_CANCEL =
  'h-9 px-5 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-lg hover:bg-canvas transition-colors cursor-pointer';
const BTN_PRIMARY =
  'h-9 px-5 text-[0.8125rem] font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-500 active:bg-brand-800 transition-colors cursor-pointer';

/* ── Page CTAs — match the Dashboard list page exactly (flat, h-10, rounded-md,
      no shadow). Not the shared <Button> (rounded-lg + shadow). ── */
const BTN_CTA_PRIMARY =
  'flex items-center gap-2 px-4 h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer';
const BTN_CTA_OUTLINE =
  'flex items-center gap-2 px-4 h-10 rounded-md border border-canvas-border bg-canvas-elevated text-ink-700 text-[0.8125rem] font-semibold hover:border-brand-200 hover:bg-canvas transition-colors cursor-pointer';
const BTN_ROW =
  'inline-flex items-center gap-1 px-2 h-7 rounded-md text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer';

/**
 * Brand-tinted initials avatar — matches the platform people convention
 * (ShareModal: `bg-primary/15 text-primary`). Monochrome on purpose: the
 * design system keeps brand as the only chromatic anchor, so people lists stay
 * calm instead of rainbow-coloured.
 */
function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2">{label}</div>
      {children}
    </div>
  );
}

function MemberSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-2 px-3 h-10 rounded-lg border border-canvas-border bg-canvas-elevated focus-within:border-brand-600 transition-colors">
      <Search size={14} className="text-ink-400 shrink-0" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-[0.8125rem] text-ink-800 placeholder:text-ink-400"
      />
    </div>
  );
}

// Permission matrix + total now come from the single RBAC source of truth.
const DETAILED_PERMISSIONS = PERMISSION_GROUPS;
const TOTAL_PERMS = ALL_PERMISSION_KEYS.length;

const userColumns: Column<MockUser & Record<string, unknown>>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'team', label: 'Team', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (item) => <StatusBadge status={STATUS_MAP[item.status as UserStatus] || 'draft'} />,
  },
  {
    key: 'lastLogin',
    label: 'Last Login',
    sortable: true,
    render: (item) => <span className="text-[0.75rem] text-ink-500 tabular-nums">{item.lastLogin as string}</span>,
  },
  { key: 'action', label: '', sortable: false, align: 'right' as const, width: '140px' },
];


const TEAM_MEMBERS = [
  { name: 'Abhinav Sharma', email: 'abhinav@irame.ai' },
  { name: 'Aditya Thakur', email: 'aditya.thakur@irame.ai' },
  { name: 'AI', email: 'ai@irame.ai' },
  { name: 'Ajay 14110008', email: 'ajay.aj@btech2014.iitgn.ac.in' },
  { name: 'ajay mudhai', email: 'ajay@irame.ai' },
  { name: 'Ajay Mudhai', email: 'ajay@irame.ai' },
  { name: 'Ayushi Narang', email: 'ayushi.narang@irame.ai' },
  { name: 'Chulbul Pandey', email: 'kuldeep.msvm@gmail.com' },
  { name: 'CS', email: 'cs@irame.ai' },
  { name: 'larobe', email: 'larobe6188@hlkes.com' },
  { name: 'Lee cheng', email: 'lecade7207@7novels.com' },
];

/* ── User detail drawer (read-only) ── */
function UserDetailDrawer({ user, onClose }: { user: MockUser; onClose: () => void }) {
  const recentActivity = [
    { action: 'Logged in', time: user.lastLogin },
    { action: 'Updated risk register', time: 'Apr 18' },
    { action: 'Ran duplicate invoice workflow', time: 'Apr 16' },
    { action: 'Exported SOX report', time: 'Apr 14' },
  ];

  return (
    <Modal
      title="User Details"
      subtitle={<span className="font-mono">{user.email}</span>}
      onClose={onClose}
      footer={<button className={BTN_CANCEL} onClick={onClose}>Close</button>}
    >
      <div className="space-y-7">
        <div className="flex items-center gap-4">
          <InitialsAvatar name={user.name} size={48} />
          <div className="min-w-0">
            <div className="text-[0.9375rem] font-semibold text-ink-900 truncate">{user.name}</div>
            <div className="text-[0.8125rem] text-ink-500 mt-0.5 truncate">{user.email}</div>
            <div className="mt-2"><StatusBadge status={STATUS_MAP[user.status] || 'draft'} /></div>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-x-8 gap-y-5">
          {[
            { label: 'Role', value: user.role },
            { label: 'Team', value: user.team },
            { label: 'Last Login', value: user.lastLogin },
            { label: 'Account Created', value: 'Jan 15, 2026' },
          ].map(d => (
            <DetailField key={d.label} label={d.label}>
              <span className="text-[0.8125rem] text-ink-800">{d.value}</span>
            </DetailField>
          ))}
        </section>

        <section>
          <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2">Recent Activity</h3>
          <div className="-mx-2">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-2.5 rounded-md hover:bg-canvas transition-colors">
                <span className="text-[0.8125rem] text-ink-700">{a.action}</span>
                <span className="text-[0.75rem] text-ink-500 tabular-nums">{a.time}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

/* ── User edit drawer ── */
function UserEditDrawer({ user, onClose }: { user: MockUser; onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { updateUser, removeUser } = useAdminData();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [team, setTeam] = useState(user.team);
  const [status, setStatus] = useState<UserStatus>(user.status);

  const save = () => {
    updateUser(user.email, { name, email, role, team, status });
    logEvent({ action: 'Update', description: `Updated user "${name}" (status: ${status})`, module: 'Admin', entity: 'User' });
    onClose();
    addToast({ message: 'User updated', type: 'success' });
  };
  const remove = () => {
    removeUser(user.email);
    logEvent({ action: 'Delete', description: `Removed user "${user.name}"`, module: 'Admin', entity: 'User' });
    setConfirmDelete(false);
    onClose();
    addToast({ message: `${user.name} removed`, type: 'success' });
  };

  return (
    <>
      <Modal
        title="Edit User"
        subtitle={user.email}
        onClose={onClose}
        footer={
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              className="mr-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[0.8125rem] font-medium text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
            >
              <Trash2 size={14} /> Remove User
            </button>
            <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
            <button className={BTN_PRIMARY} onClick={save}>Save Changes</button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-canvas border border-canvas-border">
            <InitialsAvatar name={user.name} size={36} />
            <div className="min-w-0">
              <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{user.name}</div>
              <div className="text-[0.75rem] text-ink-500 truncate">{user.email}</div>
            </div>
          </div>

          <div>
            <label className={FIELD_LABEL}>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Role</label>
            <div className="relative">
              <select value={role} onChange={e => setRole(e.target.value)} className={FIELD_SELECT}>
                {[role, 'Enabler', 'Auditor', 'Risk Owner', 'Reviewer', 'Viewer'].filter((v, i, a) => a.indexOf(v) === i).map(r => <option key={r}>{r}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>Team</label>
            <div className="relative">
              <select value={team} onChange={e => setTeam(e.target.value)} className={FIELD_SELECT}>
                {['SOX Audit', 'IFC Team', 'Engineering', 'Management', '—'].filter((v, i, a) => a.indexOf(v) === i).map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>Status</label>
            <div className="flex items-center gap-2 flex-wrap">
              {(['Active', 'Suspended', 'Locked', 'Inactive'] as UserStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 h-8 rounded-lg border text-[0.75rem] font-medium transition-colors cursor-pointer ${
                    status === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-canvas'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        open={confirmDelete}
        title="Remove user?"
        description={<>This will remove <span className="font-semibold">{user.name}</span>. This action cannot be undone.</>}
        confirmLabel="Remove User"
        tone="destructive"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

/* ── Invite user drawer ── */
function InviteUserDrawer({ onClose }: { onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { inviteUser, defaultRoleId } = useAdminData();
  const { roles } = useCurrentUser();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  // Pre-select the org's configured default role.
  const [selectedRole, setSelectedRole] = useState(
    () => roles.find(r => r.id === defaultRoleId)?.name ?? roles[0]?.name ?? '',
  );
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  const invite = () => {
    if (!fullName.trim() || !email.trim()) { addToast({ message: 'Name and email are required', type: 'error' }); return; }
    const initials = fullName.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    inviteUser({ name: fullName.trim(), initials, email: email.trim(), role: selectedRole, team: team || '—', status: 'Invited', lastLogin: 'Never' });
    logEvent({ action: 'Create', description: `Invited user "${fullName.trim()}" with role "${selectedRole}"`, module: 'Admin', entity: 'User' });
    onClose();
    addToast({ message: 'Invitation sent', type: 'success' });
  };

  return (
    <Modal
      title="Invite User"
      subtitle="Add a new member and assign their initial role."
      onClose={onClose}
      footer={
        <>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={invite}>Send Invite</button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="space-y-5">
          <div>
            <label className={FIELD_LABEL}>Full Name <span className="text-risk-700">*</span></label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter full name" className={FIELD_INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={FIELD_LABEL}>Email <span className="text-risk-700">*</span></label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email address" className={FIELD_INPUT} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Team <span className="text-risk-700">*</span></label>
              <div className="relative">
                <select className={FIELD_SELECT} value={team} onChange={e => setTeam(e.target.value)}>
                  <option value="" disabled>Select team</option>
                  <option>SOX Audit</option>
                  <option>IFC Team</option>
                  <option>Management</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-canvas-border pt-5">
          <h3 className="text-[0.875rem] font-semibold text-ink-900 mb-1">Initial Role</h3>
          <p className="text-[0.8125rem] text-ink-500 mb-4">You can assign only one role to a user.</p>

          <div className="space-y-2.5">
            {roles.map(role => {
              const isSelected = selectedRole === role.name;
              const isPreview = previewRole === role.name;
              const isDefault = role.id === defaultRoleId;
              const enabled = new Set(role.permissions);
              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role.name)}
                  className={`rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'border-brand-600 bg-brand-50/40' : 'border-canvas-border hover:bg-canvas'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-brand-600' : 'border-canvas-border'
                    }`}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.8125rem] font-semibold text-ink-800 flex items-center gap-2">
                        {role.name}
                        {isDefault && <span className="px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold">Default</span>}
                      </div>
                      <div className="text-[0.75rem] text-ink-500">{role.description ?? `${role.type} role`}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[0.75rem] text-ink-500 tabular-nums">{role.permissions.length} permissions</span>
                      <button
                        onClick={e => { e.stopPropagation(); setPreviewRole(isPreview ? null : role.name); }}
                        className="text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 cursor-pointer"
                      >
                        {isPreview ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>
                  {isPreview && (
                    <div className="px-4 pb-3 border-t border-canvas-border mt-1 pt-2 max-h-[220px] overflow-y-auto">
                      {DETAILED_PERMISSIONS.map((group, gi) => (
                        <div key={group.group}>
                          <div className={`py-2 ${gi > 0 ? 'border-t border-canvas-border mt-1' : ''}`}>
                            <span className="text-[0.8125rem] font-semibold text-ink-800">{group.group}</span>
                          </div>
                          {group.perms.map(p => (
                            <div key={p.key} className="flex items-center justify-between py-2 pl-3 border-t border-canvas-border/60">
                              <div>
                                <div className="text-[0.75rem] font-medium text-ink-800">{p.name}</div>
                                <div className="text-[0.75rem] text-ink-500">{p.desc}</div>
                              </div>
                              <Toggle checked={enabled.has(p.key)} disabled />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ── Create team drawer ── */
function CreateTeamDrawer({ onClose }: { onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { addTeam } = useAdminData();
  const [teamName, setTeamName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = TEAM_MEMBERS.filter(m =>
    !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const create = () => {
    if (!teamName.trim()) { addToast({ message: 'Team name is required', type: 'error' }); return; }
    const members = TEAM_MEMBERS.filter(m => selected.has(m.email + m.name)).map(m => m.name);
    addTeam(teamName.trim(), members);
    logEvent({ action: 'Create', description: `Created team "${teamName.trim()}" with ${members.length} member${members.length !== 1 ? 's' : ''}`, module: 'Admin', entity: 'Team' });
    onClose();
    addToast({ message: 'Team created', type: 'success' });
  };

  return (
    <Modal
      title="Create Team"
      subtitle="Group members for shared access and assignments."
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[0.75rem] text-ink-500 tabular-nums">{selected.size} member{selected.size !== 1 ? 's' : ''} selected</span>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={create}>Create Team</button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <label className={FIELD_LABEL}>Team Name <span className="text-risk-700">*</span></label>
          <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Enter a unique team name" className={FIELD_INPUT} />
        </div>

        <div className="border-t border-canvas-border pt-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[0.875rem] font-semibold text-ink-900">Add Members</h3>
            {selected.size > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-[0.75rem] font-semibold text-brand-700 tabular-nums">{selected.size} selected</span>
            )}
          </div>
          <p className="text-[0.8125rem] text-ink-500 mb-4">Select users to add now. You can add more later.</p>

          <MemberSearch value={memberSearch} onChange={setMemberSearch} placeholder="Search by name or email" />

          <div className="mt-3 border border-canvas-border rounded-lg overflow-hidden">
            {filtered.map((m, i) => {
              const key = m.email + m.name;
              const isChecked = selected.has(key);
              return (
                <div
                  key={key}
                  onClick={() => toggle(key)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${i > 0 ? 'border-t border-canvas-border' : ''} ${isChecked ? 'bg-brand-50/40' : 'hover:bg-canvas'}`}
                >
                  <Checkbox checked={isChecked} />
                  <InitialsAvatar name={m.name} size={28} />
                  <div className="min-w-0">
                    <div className="text-[0.8125rem] font-medium text-ink-800 truncate">{m.name}</div>
                    <div className="text-[0.75rem] text-ink-500 truncate">{m.email}</div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-[0.8125rem] text-ink-400">No users match your search.</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ── Edit team drawer ── */
function EditTeamDrawer({ team, onClose }: { team: AdminTeam; onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { users, updateTeam, removeTeam } = useAdminData();
  const [teamName, setTeamName] = useState(team.name);
  const [memberSearch, setMemberSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [members, setMembers] = useState<Set<string>>(new Set(team.members));

  const allUsers = users.map(u => u.name);
  const filtered = allUsers.filter(name => !memberSearch || name.toLowerCase().includes(memberSearch.toLowerCase()));

  const toggle = (name: string) => {
    setMembers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const save = () => {
    updateTeam(team.id, { name: teamName.trim() || team.name, members: [...members] });
    logEvent({ action: 'Update', description: `Updated team "${teamName.trim() || team.name}" (${members.size} members)`, module: 'Admin', entity: 'Team' });
    onClose();
    addToast({ message: 'Team updated', type: 'success' });
  };
  const remove = () => {
    removeTeam(team.id);
    logEvent({ action: 'Delete', description: `Deleted team "${team.name}"`, module: 'Admin', entity: 'Team' });
    setConfirmDelete(false);
    onClose();
    addToast({ message: `Team ${team.name} deleted`, type: 'success' });
  };

  return (
    <>
      <Modal
        title="Edit Team"
        subtitle={team.name}
        onClose={onClose}
        footer={
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              className="mr-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[0.8125rem] font-medium text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
            >
              <Trash2 size={14} /> Delete Team
            </button>
            <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
            <button className={BTN_PRIMARY} onClick={save}>Save Changes</button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className={FIELD_LABEL}>Team Name</label>
            <input value={teamName} onChange={e => setTeamName(e.target.value)} className={FIELD_INPUT} />
          </div>

          <div className="border-t border-canvas-border pt-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[0.875rem] font-semibold text-ink-900">Members</h3>
              <span className="text-[0.75rem] text-ink-500 tabular-nums">{members.size} selected</span>
            </div>
            <p className="text-[0.8125rem] text-ink-500 mb-4">Add or remove members from this team.</p>

            <MemberSearch value={memberSearch} onChange={setMemberSearch} placeholder="Search members" />

            <div className="mt-3 border border-canvas-border rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
              {filtered.map((name, i) => {
                const isIn = members.has(name);
                return (
                  <div
                    key={name + i}
                    onClick={() => toggle(name)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${i > 0 ? 'border-t border-canvas-border' : ''} ${isIn ? 'bg-brand-50/40' : 'hover:bg-canvas'}`}
                  >
                    <Checkbox checked={isIn} />
                    <InitialsAvatar name={name} size={26} />
                    <span className="text-[0.8125rem] text-ink-800">{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        open={confirmDelete}
        title="Delete team?"
        description={<>This will delete <span className="font-semibold">{team.name}</span> and unassign its members.</>}
        confirmLabel="Delete Team"
        tone="destructive"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

interface MockRole {
  name: string;
  users: number;
  createdBy: string;
  type: 'System' | 'Custom';
  permissions: number;
  lastModified: string;
}

/* ── Role detail drawer (editable — writes back to the live permission model) ── */
function RoleDetailDrawer({ role, userCount, onClose }: { role: Role; userCount: number; onClose: () => void }) {
  const { addToast } = useToast();
  const { updateRolePermissions } = useCurrentUser();
  const logEvent = useAuditLog();
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(role.permissions));

  const toggle = (key: string) =>
    setEnabled(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const applyPreset = (preset: 'none' | 'readonly' | 'full') => {
    if (preset === 'none') { setEnabled(new Set()); return; }
    const n = new Set<string>();
    DETAILED_PERMISSIONS.forEach(g => {
      if (preset === 'full') g.perms.forEach(p => n.add(p.key));
      else if (g.perms[0]) n.add(g.perms[0].key);
    });
    setEnabled(n);
  };

  const save = () => {
    updateRolePermissions(role.id, [...enabled] as PermissionKey[]);
    logEvent({ action: 'Update', description: `Updated permissions for role "${role.name}" (${enabled.size} enabled)`, module: 'Admin', entity: 'Role' });
    addToast({ message: `${role.name} permissions updated`, type: 'success' });
    onClose();
  };

  const presetChip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-[0.75rem] font-medium transition-colors cursor-pointer ${
      active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-canvas'
    }`;

  return (
    <Modal
      title={role.name}
      subtitle={`${role.type} role · ${userCount} ${userCount === 1 ? 'user' : 'users'}`}
      width="max-w-[620px]"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
            <Info size={13} /> Changes apply to everyone with this role.
          </span>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={save}>Save Changes</button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="grid grid-cols-2 gap-x-8 gap-y-5">
          <DetailField label="Type">
            <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[0.75rem] font-medium ${
              role.type === 'System' ? 'bg-evidence-50 text-evidence-700' : 'bg-draft-50 text-draft-700'
            }`}>{role.type}</span>
          </DetailField>
          <DetailField label="Created By"><span className="text-[0.8125rem] text-ink-800">{role.createdBy}</span></DetailField>
        </section>

        <div className="border-t border-canvas-border pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.875rem] font-semibold text-ink-900">Permissions</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => applyPreset('none')} className={presetChip(enabled.size === 0)}>None</button>
              <button onClick={() => applyPreset('readonly')} className={presetChip(false)}>View Only</button>
              <button onClick={() => applyPreset('full')} className={presetChip(enabled.size === TOTAL_PERMS)}>Full Access</button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-1.5 rounded-full bg-canvas-border overflow-hidden">
              <div className="h-full rounded-full bg-brand-600 transition-all duration-200" style={{ width: `${(enabled.size / TOTAL_PERMS) * 100}%` }} />
            </div>
            <span className="text-[0.75rem] text-ink-500 tabular-nums shrink-0">{enabled.size}/{TOTAL_PERMS}</span>
          </div>

          <div className="border border-canvas-border rounded-lg overflow-hidden">
            {DETAILED_PERMISSIONS.map((group, gi) => (
              <div key={group.group}>
                <div className={`px-4 py-2.5 bg-canvas ${gi > 0 ? 'border-t border-canvas-border' : ''}`}>
                  <span className="text-[0.8125rem] font-semibold text-ink-800">{group.group}</span>
                </div>
                {group.perms.map(perm => {
                  const isOn = enabled.has(perm.key);
                  return (
                    <div
                      key={perm.key}
                      onClick={() => toggle(perm.key)}
                      className="flex items-center justify-between px-4 py-2.5 border-t border-canvas-border/60 cursor-pointer hover:bg-canvas transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-[0.8125rem] font-medium text-ink-800">{perm.name}</div>
                        <div className="text-[0.75rem] text-ink-500">{perm.desc}</div>
                      </div>
                      <Toggle checked={isOn} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ── Create role drawer ── */
function CreateRoleDrawer({ onClose }: { onClose: () => void }) {
  const { addToast } = useToast();
  const { addRole } = useCurrentUser();
  const logEvent = useAuditLog();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const totalPerms = TOTAL_PERMS;

  const togglePerm = (key: string) => {
    setEnabled(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const applyPreset = (preset: 'none' | 'readonly' | 'full') => {
    if (preset === 'none') { setEnabled(new Set()); return; }
    const n = new Set<string>();
    DETAILED_PERMISSIONS.forEach(g => {
      if (preset === 'full') g.perms.forEach(p => n.add(p.key));
      else if (g.perms[0]) n.add(g.perms[0].key);
    });
    setEnabled(n);
  };

  const create = () => {
    if (!name.trim()) { addToast({ message: 'Role name is required', type: 'error' }); return; }
    addRole({
      id: `role-${Date.now()}`,
      name: name.trim(),
      type: 'Custom',
      description: description.trim(),
      createdBy: 'You',
      lastModified: 'Just now',
      permissions: [...enabled] as PermissionKey[],
    });
    logEvent({ action: 'Create', description: `Created role "${name.trim()}" with ${enabled.size} permissions`, module: 'Admin', entity: 'Role' });
    onClose();
    addToast({ message: `Role "${name.trim()}" created`, type: 'success' });
  };

  const presetChip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-[0.75rem] font-medium transition-colors cursor-pointer ${
      active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-canvas'
    }`;

  return (
    <Modal
      title="Create Role"
      subtitle="Define a role and choose its permissions."
      width="max-w-[620px]"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
            <Info size={13} /> Editable later from role settings.
          </span>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={create}>Create Role</button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className={FIELD_LABEL}>Role Name <span className="text-risk-700">*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter role name" className={FIELD_INPUT} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Description <span className="text-risk-700">*</span></label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Enter a description..." className={FIELD_TEXTAREA} />
        </div>

        <div className="border-t border-canvas-border pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.875rem] font-semibold text-ink-900">Permissions</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => applyPreset('none')} className={presetChip(enabled.size === 0)}>None</button>
              <button onClick={() => applyPreset('readonly')} className={presetChip(false)}>View Only</button>
              <button onClick={() => applyPreset('full')} className={presetChip(enabled.size === totalPerms)}>Full Access</button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-1.5 rounded-full bg-canvas-border overflow-hidden">
              <div className="h-full rounded-full bg-brand-600 transition-all duration-200" style={{ width: `${(enabled.size / totalPerms) * 100}%` }} />
            </div>
            <span className="text-[0.75rem] text-ink-500 tabular-nums shrink-0">{enabled.size}/{totalPerms}</span>
          </div>

          <div className="border border-canvas-border rounded-lg overflow-hidden">
            {DETAILED_PERMISSIONS.map((group, gi) => (
              <div key={group.group}>
                <div className={`px-4 py-2.5 bg-canvas ${gi > 0 ? 'border-t border-canvas-border' : ''}`}>
                  <span className="text-[0.8125rem] font-semibold text-ink-800">{group.group}</span>
                </div>
                {group.perms.map(perm => {
                  const isOn = enabled.has(perm.key);
                  return (
                    <div
                      key={perm.key}
                      onClick={() => togglePerm(perm.key)}
                      className="flex items-center justify-between px-4 py-2.5 border-t border-canvas-border/60 cursor-pointer hover:bg-canvas transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-[0.8125rem] font-medium text-ink-800">{perm.name}</div>
                        <div className="text-[0.75rem] text-ink-500">{perm.desc}</div>
                      </div>
                      <Toggle checked={isOn} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const roleColumns: Column<MockRole & Record<string, unknown>>[] = [
  { key: 'name', label: 'Role', sortable: true, width: '32%' },
  {
    key: 'type',
    label: 'Type',
    sortable: true,
    width: '11%',
    render: (item) => (
      <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[0.75rem] font-medium ${
        item.type === 'System' ? 'bg-evidence-50 text-evidence-700' : 'bg-draft-50 text-draft-700'
      }`}>{item.type as string}</span>
    ),
  },
  {
    key: 'users',
    label: 'Users',
    sortable: true,
    width: '9%',
    render: (item) => {
      const n = item.users as number;
      return <span className={`text-[0.8125rem] tabular-nums ${n === 0 ? 'text-ink-400' : 'font-medium text-ink-800'}`}>{n}</span>;
    },
  },
  {
    key: 'permissions',
    label: 'Permissions',
    sortable: true,
    width: '17%',
    render: (item) => {
      const n = item.permissions as number;
      const pct = Math.min(100, (n / TOTAL_PERMS) * 100);
      const full = n >= TOTAL_PERMS;
      return (
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-canvas-border max-w-[84px] overflow-hidden">
            <div className={`h-full rounded-full ${full ? 'bg-brand-600' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[0.75rem] tabular-nums whitespace-nowrap"><span className="font-semibold text-ink-800">{n}</span><span className="text-ink-400">/{TOTAL_PERMS}</span></span>
        </div>
      );
    },
  },
  {
    key: 'createdBy',
    label: 'Created by',
    sortable: true,
    width: '13%',
    render: (item) => <span className="text-[0.8125rem] text-ink-600 whitespace-nowrap">{item.createdBy as string}</span>,
  },
  {
    key: 'lastModified',
    label: 'Updated',
    sortable: true,
    width: '12%',
    render: (item) => <span className="text-[0.75rem] text-ink-500 tabular-nums whitespace-nowrap">{item.lastModified as string}</span>,
  },
  { key: 'action', label: '', sortable: false, align: 'right' as const, width: '150px' },
];

function RolesTab({ onCreateRole }: { onCreateRole: () => void }) {
  const { roles } = useCurrentUser();
  const [viewRole, setViewRole] = useState<Role | null>(null);

  // User counts per role, derived from the people→role mapping.
  const userCounts = Object.values(PERSON_ROLES).reduce<Record<string, number>>((acc, rid) => {
    acc[rid] = (acc[rid] ?? 0) + 1; return acc;
  }, {});
  const roleById = Object.fromEntries(roles.map(r => [r.id, r] as const));

  type RoleRow = MockRole & Record<string, unknown>;
  const tableData: RoleRow[] = roles.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    type: r.type,
    users: userCounts[r.id] ?? 0,
    permissions: r.permissions.length,
    createdBy: r.createdBy,
    lastModified: r.lastModified,
  }));

  const columnsWithAction = roleColumns.map(col => {
    if (col.key === 'name') {
      return {
        ...col,
        render: (item: RoleRow) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'System' ? 'bg-brand-50' : 'bg-canvas'}`}>
              <Shield size={14} className={item.type === 'System' ? 'text-brand-700' : 'text-ink-400'} />
            </div>
            <div className="min-w-0">
              <button onClick={() => setViewRole(roleById[item.id as string])} className="block truncate text-[0.8125rem] font-semibold text-ink-800 hover:text-brand-700 cursor-pointer text-left">{item.name as string}</button>
              {(item.description as string) ? (
                <div className="text-[0.75rem] text-ink-500 truncate">{item.description as string}</div>
              ) : null}
            </div>
          </div>
        ),
      };
    }
    if (col.key === 'action') {
      return {
        ...col,
        render: (item: RoleRow) => (
          <div className="flex items-center justify-end gap-1">
            <button className={BTN_ROW} onClick={() => setViewRole(roleById[item.id as string])}><Pencil size={12} />Edit</button>
            <button className={BTN_ROW} onClick={onCreateRole}><CopyPlus size={12} />Duplicate</button>
          </div>
        ),
      };
    }
    return col;
  });

  const viewRoleUsers = viewRole ? (userCounts[viewRole.id] ?? 0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      <SmartTable
        columns={columnsWithAction}
        data={tableData}
        keyField="id"
        searchable
        searchPlaceholder="Search roles..."
        searchKeys={['name', 'createdBy']}
        paginated
        pageSize={10}
        emptyMessage="No roles found."
      />
      <AnimatePresence>
        {viewRole && <RoleDetailDrawer key="role-detail" role={viewRole} userCount={viewRoleUsers} onClose={() => setViewRole(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function UsersTab({ onInvite, onCreateTeam }: { onInvite: () => void; onCreateTeam: () => void }) {
  const { users, teams, updateUser } = useAdminData();
  const tableData = users.map(u => ({ ...u } as MockUser & Record<string, unknown>));
  const [viewUser, setViewUser] = useState<MockUser | null>(null);
  const [editUser, setEditUser] = useState<MockUser | null>(null);
  const [teamDropdown, setTeamDropdown] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'users' | 'teams'>('users');
  const [editTeam, setEditTeam] = useState<AdminTeam | null>(null);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teamDropdown) return;
    const close = (e: MouseEvent) => { if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) setTeamDropdown(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [teamDropdown]);

  type UserRow = MockUser & Record<string, unknown>;

  const teamsData = teams;

  const counts = {
    active: users.filter(u => u.status === 'Active').length,
    invited: users.filter(u => u.status === 'Invited').length,
    suspended: users.filter(u => u.status === 'Suspended').length,
    inactive: users.filter(u => u.status === 'Inactive' || u.status === 'Locked').length,
  };

  const columnsWithAction: Column<UserRow>[] = userColumns.map(col => {
    if (col.key === 'name') {
      return {
        ...col,
        render: (item: UserRow) => (
          <div className="flex items-center gap-3">
            <InitialsAvatar name={item.name as string} size={32} />
            <div className="min-w-0">
              <button onClick={() => setViewUser(item as unknown as MockUser)} className="text-[0.8125rem] font-semibold text-ink-800 hover:text-brand-700 cursor-pointer text-left">{item.name as string}</button>
              <div className="text-[0.75rem] text-ink-500 mt-0.5">{item.email as string}</div>
            </div>
          </div>
        ),
      };
    }
    if (col.key === 'role') {
      return {
        ...col,
        render: (item: UserRow) => (
          <button onClick={() => setEditUser(item as unknown as MockUser)} className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-600 hover:text-brand-700 cursor-pointer group">
            {item.role as string}
            <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ),
      };
    }
    if (col.key === 'team') {
      return {
        ...col,
        render: (item: UserRow) => {
          const teamName = item.team as string;
          const rowId = item.email as string;
          const isOpen = teamDropdown === rowId;
          const teamNames = teams.map(t => t.name);
          const isUnassigned = teamName === '—';

          return (
            <div className="relative" ref={isOpen ? teamDropdownRef : undefined}>
              <button
                onClick={() => setTeamDropdown(isOpen ? null : rowId)}
                className={`inline-flex items-center gap-1 text-[0.8125rem] cursor-pointer transition-colors ${isUnassigned ? 'text-ink-400 hover:text-brand-700' : 'text-ink-600 hover:text-brand-700'}`}
              >
                {isUnassigned ? 'Assign team' : teamName}
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180 text-brand-700' : ''}`} />
              </button>
              {isOpen && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-canvas-elevated border border-canvas-border rounded-lg shadow-sm py-1 z-30">
                  {teamNames.map(t => (
                    <button
                      key={t}
                      onClick={() => { updateUser(rowId, { team: t }); setTeamDropdown(null); }}
                      className={`w-full text-left px-3 py-1.5 text-[0.8125rem] cursor-pointer transition-colors ${
                        t === teamName ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-canvas'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  {!isUnassigned && (
                    <>
                      <div className="h-px bg-canvas-border my-1" />
                      <button
                        onClick={() => { updateUser(rowId, { team: '—' }); setTeamDropdown(null); }}
                        className="w-full text-left px-3 py-1.5 text-[0.8125rem] text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors"
                      >
                        Remove from team
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        },
      };
    }
    if (col.key === 'action') {
      return {
        ...col,
        render: (item: UserRow) => (
          <div className="flex items-center justify-end gap-1">
            <button className={BTN_ROW} onClick={() => setViewUser(item as unknown as MockUser)}><Eye size={12} />View</button>
            <button className={BTN_ROW} onClick={() => setEditUser(item as unknown as MockUser)}><Pencil size={12} />Edit</button>
          </div>
        ),
      };
    }
    return col;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* Toolbar: sub-tab toggle + stats + CTAs */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-5">
          {/* Segmented control — sliding white pill, matches the Knowledge Hub
              filter tabs (motion layoutId + subtle shadow). */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-canvas-border/60 bg-canvas-elevated/40 w-fit">
            {([
              { key: 'users' as const, label: 'Users', count: users.length },
              { key: 'teams' as const, label: 'Teams', count: teamsData.length },
            ]).map(t => {
              const isActive = subTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setSubTab(t.key)}
                  className={`relative inline-flex items-center gap-2 px-3.5 h-8 rounded-md text-[0.8125rem] transition-colors cursor-pointer ${
                    isActive ? 'text-brand-700 font-semibold' : 'text-ink-500 font-medium hover:text-ink-800'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="admin-subtab-pill"
                      className="absolute inset-0 bg-canvas-elevated rounded-md shadow-[0_1px_2px_rgb(15_8_30_/_0.06),0_2px_6px_rgb(15_8_30_/_0.04)] border border-canvas-border"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {t.label}
                    <span className={`tabular-nums font-bold ${isActive ? 'text-brand-700' : 'text-ink-400'}`}>{t.count}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status breakdown — semantic dot + count, only on the Users view. */}
          {subTab === 'users' && (
            <div className="hidden md:flex items-center gap-4 text-[0.75rem] tabular-nums">
              {([
                { label: 'Active',    n: counts.active,    dot: 'bg-compliant' },
                { label: 'Invited',   n: counts.invited,   dot: 'bg-brand-400' },
                { label: 'Suspended', n: counts.suspended, dot: 'bg-mitigated' },
                { label: 'Inactive',  n: counts.inactive,  dot: 'bg-ink-300' },
              ]).map(s => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className="font-semibold text-ink-800">{s.n}</span>
                  <span className="text-ink-500">{s.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button className={BTN_CTA_OUTLINE} onClick={onCreateTeam}><Plus size={14} />Create Team</button>
          <button className={BTN_CTA_PRIMARY} onClick={onInvite}><UserPlus size={14} />Invite User</button>
        </div>
      </div>

      {subTab === 'users' ? (
        <SmartTable
          columns={columnsWithAction}
          data={tableData}
          keyField="email"
          searchable
          searchPlaceholder="Search by name or email..."
          searchKeys={['name', 'email', 'role', 'team']}
          paginated
          pageSize={10}
          emptyMessage="No users match your search."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {teamsData.map(team => (
            <div
              key={team.name}
              className="bg-canvas-elevated rounded-lg border border-canvas-border p-5 hover:border-brand-200 hover:bg-canvas transition-colors cursor-pointer"
              onClick={() => setEditTeam(team)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[0.875rem] font-semibold text-ink-900">{team.name}</h3>
                <button
                  onClick={e => { e.stopPropagation(); setEditTeam(team); }}
                  className="p-1 rounded hover:bg-canvas-border/60 transition-colors cursor-pointer text-ink-400 hover:text-brand-700"
                  title="Edit team"
                >
                  <Pencil size={13} />
                </button>
              </div>
              <div className="text-[0.75rem] text-ink-500 mb-3 tabular-nums">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</div>
              <div className="flex items-center -space-x-2">
                {team.members.slice(0, 5).map((m, i) => (
                  <div key={i} className="ring-2 ring-canvas-elevated rounded-full">
                    <InitialsAvatar name={m} size={28} />
                  </div>
                ))}
                {team.members.length > 5 && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[0.75rem] font-semibold text-ink-500 bg-canvas ring-2 ring-canvas-elevated tabular-nums">
                    +{team.members.length - 5}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {viewUser && <UserDetailDrawer key="user-detail" user={viewUser} onClose={() => setViewUser(null)} />}
        {editUser && <UserEditDrawer key="user-edit" user={editUser} onClose={() => setEditUser(null)} />}
        {editTeam && <EditTeamDrawer key="team-edit" team={editTeam} onClose={() => setEditTeam(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

const logColumns: Column<AuditLog & Record<string, unknown>>[] = [
  {
    key: 'timestamp',
    label: 'Timestamp',
    sortable: true,
    width: '15%',
    render: (item) => <span className="font-mono text-[0.75rem] text-ink-500 tabular-nums">{item.timestamp as string}</span>,
  },
  {
    key: 'user',
    label: 'Performed By',
    sortable: true,
    width: '13%',
    render: (item) => (
      <span className={`text-[0.8125rem] ${item.user === 'Unknown' ? 'text-risk-700 italic' : 'font-medium text-ink-800'}`}>{item.user as string}</span>
    ),
  },
  {
    key: 'action',
    label: 'Action',
    sortable: true,
    width: '8%',
    render: (item) => (
      <StatusBadge status={
        item.action === 'Create' ? 'active' :
        item.action === 'Update' ? 'in-progress' :
        item.action === 'Delete' ? 'open' :
        item.action === 'Login' ? 'invited' :
        'draft'
      } />
    ),
  },
  {
    key: 'description',
    label: 'Activity',
    sortable: false,
    width: '36%',
    render: (item) => (
      <div>
        <div className="text-[0.8125rem] text-ink-800">{item.description as string}</div>
        <div className="text-[0.75rem] text-ink-500 mt-0.5">{item.module as string} / {item.entity as string}</div>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Result',
    sortable: true,
    width: '8%',
    render: (item) => <StatusBadge status={item.status === 'Success' ? 'active' : 'open'} />,
  },
];

function AuditLogsTab() {
  const { logs } = useAdminData();
  const tableData = logs.map(l => ({ ...l } as AuditLog & Record<string, unknown>));
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');

  const uniqueUsers = [...new Set(logs.map(l => l.user))];

  const filtered = tableData.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (resultFilter !== 'all' && l.status !== resultFilter) return false;
    if (userFilter !== 'all' && l.user !== userFilter) return false;
    return true;
  });

  const selectClass =
    'h-9 pl-3 pr-8 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-700 outline-none appearance-none cursor-pointer focus:border-brand-600 transition-colors';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 text-[0.8125rem] text-ink-500">
          <Filter size={13} />
          Filters
        </div>
        <div className="relative">
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className={selectClass}>
            <option value="all">All Users</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className={selectClass}>
            <option value="all">All Actions</option>
            <option value="Create">Create</option>
            <option value="Update">Update</option>
            <option value="Delete">Delete</option>
            <option value="Login">Login</option>
            <option value="Export">Export</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} className={selectClass}>
            <option value="all">All Results</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        </div>
        <DatePicker className="h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-700 outline-none cursor-pointer focus:border-brand-600 transition-colors" />
        <span className="text-[0.75rem] text-ink-400">to</span>
        <DatePicker className="h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-700 outline-none cursor-pointer focus:border-brand-600 transition-colors" />
      </div>

      <SmartTable
        columns={logColumns}
        data={filtered}
        keyField="timestamp"
        searchable
        searchPlaceholder="Search logs..."
        searchKeys={['user', 'description', 'module', 'entity']}
        paginated
        pageSize={10}
        emptyMessage="No audit logs match your filters."
      />
    </motion.div>
  );
}

function ComingSoonTab({ tab }: { tab: Tab }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      <EmptyState icon={tab.icon} title={tab.label} body="This section is under development and will be available soon." />
    </motion.div>
  );
}

export default function AdminView({ activeTab }: Props) {
  const resolveInitialTab = (): TabId => {
    const valid: TabId[] = ['users', 'roles', 'logs'];
    return (valid.includes(activeTab as TabId) ? activeTab : 'users') as TabId;
  };

  const { addToast } = useToast();
  const { can, roles } = useCurrentUser();
  const logEvent = useAuditLog();
  const { defaultRoleId, setDefaultRoleId } = useAdminData();
  const [currentTab, setCurrentTab] = useState<TabId>(resolveInitialTab);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const activeTabObj = tabs.find((t) => t.id === currentTab) ?? tabs[0];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Header strip — full-bleed bg-canvas-elevated with ambient FloatingLines,
          serif title + subhead, and underline tabs sitting on the strip border.
          Mirrors the Knowledge Hub chrome. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6"
          >
            <div className="min-w-0">
              <h1 className="font-display text-[2.125rem] font-[420] tracking-tight text-ink-900 leading-[1.15]">Administration</h1>
              <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">Manage users, teams, roles, and audit logs.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="-mb-px"
          >
            <div className="flex gap-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentTab(tab.id)}
                    className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
                      isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={14} />
                      {tab.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="admin-tab-underline"
                        className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content — header strip is fixed above; this region scrolls. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-5 pb-8 flex-1 min-h-0 overflow-y-auto">
        {/* Contextual action bar */}
        {currentTab === 'roles' ? (
          <div className="flex items-center justify-between gap-3 mb-5">
            <label className="flex items-center gap-2 text-[0.8125rem] text-ink-600">
              <span className="font-medium text-ink-700">Default role for new users</span>
              <div className="relative">
                <select
                  value={defaultRoleId}
                  onChange={e => { setDefaultRoleId(e.target.value); addToast({ message: `Default role set to ${roles.find(r => r.id === e.target.value)?.name ?? ''}`, type: 'success' }); }}
                  className="h-9 pl-3 pr-8 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-700 outline-none appearance-none cursor-pointer focus:border-brand-600 transition-colors"
                >
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              </div>
            </label>
            <button className={BTN_CTA_PRIMARY} onClick={() => setCreateRoleOpen(true)}><Plus size={14} />Create Role</button>
          </div>
        ) : currentTab === 'logs' ? (
          <div className="flex items-center justify-end gap-2 mb-5">
            {can('ad_logs_export') && (
              <button className={BTN_CTA_OUTLINE} onClick={() => { logEvent({ action: 'Export', description: 'Exported audit log as CSV', module: 'Admin', entity: 'Audit Log' }); addToast({ message: 'Audit log exported as CSV', type: 'success' }); }}><Download size={14} />Export CSV</button>
            )}
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {currentTab === 'users' ? (
            <UsersTab key="users" onInvite={() => setInviteOpen(true)} onCreateTeam={() => setCreateTeamOpen(true)} />
          ) : currentTab === 'roles' ? (
            <RolesTab key="roles" onCreateRole={() => setCreateRoleOpen(true)} />
          ) : currentTab === 'logs' ? (
            <AuditLogsTab key="logs" />
          ) : (
            <ComingSoonTab key={currentTab} tab={activeTabObj} />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {inviteOpen && <InviteUserDrawer key="invite" onClose={() => setInviteOpen(false)} />}
        {createTeamOpen && <CreateTeamDrawer key="createteam" onClose={() => setCreateTeamOpen(false)} />}
        {createRoleOpen && <CreateRoleDrawer key="createrole" onClose={() => setCreateRoleOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
