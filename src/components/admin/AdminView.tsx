import { DateFilterPicker, dateInFilter, isDateFilterActive, DEFAULT_DATE_FILTER, type DateFilter } from '../shared/DateFilterPicker';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Users, User, Shield, ScrollText,
  UserPlus, Plus, Download,
  Eye, ChevronDown, Search, Pencil, CopyPlus, Info, Trash2, X, Check,
} from 'lucide-react';
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS, PERSON_ROLES, type PermissionKey, type Role } from '../../data/rbac';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAdminData, useAuditLog, type AuditLog, type AdminTeam } from '../../context/AdminDataContext';
import SmartTable, { type Column } from '../shared/SmartTable';
import ColumnFilter from '../shared/ColumnFilter';
import { StatusBadge, ActionBadge, ResultBadge } from '../shared/StatusBadge';
import FloatingLines from '../shared/FloatingLines';
import Modal from '../shared/Modal';
import Toggle from '../shared/Toggle';
import Checkbox from '../shared/Checkbox';
import ConfirmationModal from '../shared/ConfirmationModal';
import EmptyState from '../shared/EmptyState';
import { KpiTile } from '../shared/KpiTile';
import { useToast } from '../shared/Toast';

interface Props {
  activeTab?: string;
}

type TabId = 'access' | 'logs';
type AccessSeg = 'users' | 'teams' | 'roles';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Users;
}

const tabs: Tab[] = [
  { id: 'access', label: 'Access', icon: Users },
  { id: 'logs', label: 'Audit Logs', icon: ScrollText },
];

type UserStatus = 'Active' | 'Inactive' | 'Invited' | 'Suspended' | 'Locked';

interface MockUser {
  name: string;
  initials: string;
  email: string;
  roleId: string;
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

function MemberSearch({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 h-10 rounded-lg border border-canvas-border bg-canvas-elevated focus-within:border-brand-600 transition-colors ${className}`}>
      <Search size={14} className="text-ink-400 shrink-0" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[0.8125rem] text-ink-800 placeholder:text-ink-400"
      />
      {value && (
        <button onClick={() => onChange('')} className="text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Clear search">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* ── Row action — labelled pill button (icon + word). Hairline border + white
      surface so it reads clearly as a button; soft brand-tint on hover keeps
      it light and modern, not a chunky default button. ── */
const BTN_ROW =
  'inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 hover:border-brand-200 hover:bg-brand-50/60 transition-colors cursor-pointer';

function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {children}
    </div>
  );
}

/* ── KPI summary row — canonical KpiTile cascade. Tiles become click-to-filter
      chips when `onSelect` is wired (active tile gets a brand border). ── */
interface KpiStat { key: string; label: string; value: number; }
function KpiRow({ stats, active, onSelect }: { stats: KpiStat[]; active?: string; onSelect?: (key: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" role="list">
      {stats.map((s, i) => {
        const isActive = active === s.key;
        return (
          <KpiTile
            key={s.key}
            index={i}
            label={s.label}
            value={String(s.value)}
            onClick={onSelect ? () => onSelect(s.key) : undefined}
            className={isActive ? '!border-brand-500 ring-1 ring-brand-200 bg-brand-50/30' : ''}
          />
        );
      })}
    </div>
  );
}

interface RoleSeed { name: string; description: string; permissions: PermissionKey[]; }

/* ── Access sub-nav — 3-way segmented control (Users / Teams / Roles), the
      single sub-navigation for the merged Access tab. Sliding white pill. ── */
function AccessNav({ seg, setSeg, counts, action }: { seg: AccessSeg; setSeg: (s: AccessSeg) => void; counts: Record<AccessSeg, number>; action?: React.ReactNode }) {
  const prefersReduced = useReducedMotion();
  const items: { key: AccessSeg; label: string; icon: typeof Users }[] = [
    { key: 'users', label: 'Users', icon: User },
    { key: 'teams', label: 'Teams', icon: Users },
    { key: 'roles', label: 'Roles', icon: Shield },
  ];
  return (
    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
      <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-canvas-border/60 bg-canvas-elevated/40 w-fit">
      {items.map(t => {
        const isActive = seg === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => setSeg(t.key)}
            className={`relative inline-flex items-center gap-2 px-3.5 h-8 rounded-md text-[0.8125rem] transition-colors cursor-pointer ${
              isActive ? 'text-brand-700 font-semibold' : 'text-ink-500 font-medium hover:text-ink-800'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="admin-access-seg"
                className="absolute inset-0 bg-canvas-elevated rounded-md shadow-[0_1px_2px_rgb(15_8_30_/_0.06),0_2px_6px_rgb(15_8_30_/_0.04)] border border-canvas-border"
                transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon size={14} className={isActive ? 'text-brand-600' : 'text-ink-400'} />
              {t.label}
              <span className={`tabular-nums font-bold ${isActive ? 'text-brand-700' : 'text-ink-400'}`}>{counts[t.key]}</span>
            </span>
          </button>
        );
      })}
      </div>
      {action}
    </div>
  );
}

// Permission matrix + total now come from the single RBAC source of truth.
const DETAILED_PERMISSIONS = PERMISSION_GROUPS;
const TOTAL_PERMS = ALL_PERMISSION_KEYS.length;

const userColumns: Column<MockUser & Record<string, unknown>>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'roleName', label: 'Role', sortable: true },
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
  const { roles } = useCurrentUser();
  const roleLabel = roles.find(r => r.id === user.roleId)?.name ?? '—';
  const recentActivity = [
    { action: 'Logged in', time: user.lastLogin },
    { action: 'Updated risk register', time: 'Apr 18' },
    { action: 'Ran duplicate invoice workflow', time: 'Apr 16' },
    { action: 'Exported SOX report', time: 'Apr 14' },
  ];

  return (
    <Modal
      title="User Details"
      onClose={onClose}
      footer={<button className={BTN_CANCEL} onClick={onClose}>Close</button>}
    >
      <div className="space-y-6">
        {/* Identity — avatar + name/email, status pinned right. */}
        <div className="flex items-center gap-3.5">
          <InitialsAvatar name={user.name} size={48} />
          <div className="min-w-0">
            <div className="text-[0.9375rem] font-semibold text-ink-900 truncate">{user.name}</div>
            <div className="text-[0.8125rem] text-ink-500 mt-0.5 truncate">{user.email}</div>
          </div>
          <div className="ml-auto shrink-0"><StatusBadge status={STATUS_MAP[user.status] || 'draft'} /></div>
        </div>

        {/* Details — grouped in a quiet panel for structure. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-canvas-border bg-canvas p-4">
          {[
            { label: 'Role', value: roleLabel },
            { label: 'Team', value: user.team },
            { label: 'Last Login', value: user.lastLogin },
            { label: 'Account Created', value: 'Jan 15, 2026' },
          ].map(d => (
            <DetailField key={d.label} label={d.label}>
              <span className="text-[0.8125rem] font-medium text-ink-800">{d.value}</span>
            </DetailField>
          ))}
        </div>

        {/* Recent activity — bordered list with hairline row dividers. */}
        <section>
          <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2.5">Recent Activity</h3>
          <div className="rounded-xl border border-canvas-border overflow-hidden">
            {recentActivity.map((a, i) => (
              <div key={i} className={`flex items-center justify-between px-3.5 py-2.5 hover:bg-canvas transition-colors ${i > 0 ? 'border-t border-canvas-border' : ''}`}>
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
  const { roles } = useCurrentUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [roleId, setRoleId] = useState(user.roleId);
  const [team, setTeam] = useState(user.team);
  const [status, setStatus] = useState<UserStatus>(user.status);

  const save = () => {
    updateUser(user.email, { name, email, roleId, team, status });
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
              <select value={roleId} onChange={e => setRoleId(e.target.value)} className={FIELD_SELECT}>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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
  const [selectedRoleId, setSelectedRoleId] = useState(
    () => roles.find(r => r.id === defaultRoleId)?.id ?? roles[0]?.id ?? '',
  );
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  const invite = () => {
    if (!fullName.trim() || !email.trim()) { addToast({ message: 'Name and email are required', type: 'error' }); return; }
    const initials = fullName.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    const roleLabel = roles.find(r => r.id === selectedRoleId)?.name ?? selectedRoleId;
    inviteUser({ name: fullName.trim(), initials, email: email.trim(), roleId: selectedRoleId, team: team || '—', status: 'Invited', lastLogin: 'Never' });
    logEvent({ action: 'Create', description: `Invited user "${fullName.trim()}" with role "${roleLabel}"`, module: 'Admin', entity: 'User' });
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
              const isSelected = selectedRoleId === role.id;
              const isPreview = previewRole === role.name;
              const isDefault = role.id === defaultRoleId;
              const enabled = new Set(role.permissions);
              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
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
    setEnabled(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

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
function CreateRoleDrawer({ onClose, seed }: { onClose: () => void; seed?: RoleSeed | null }) {
  const { addToast } = useToast();
  const { addRole } = useCurrentUser();
  const logEvent = useAuditLog();
  const [name, setName] = useState(seed?.name ?? '');
  const [description, setDescription] = useState(seed?.description ?? '');
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set<string>(seed?.permissions ?? []));
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
      subtitle={seed ? 'Duplicated from an existing role. Adjust and save as new.' : 'Define a role and choose its permissions.'}
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

function RolesTab({ onCreateRole }: { onCreateRole: (seed?: RoleSeed) => void }) {
  const prefersReduced = useReducedMotion();
  const { roles } = useCurrentUser();
  const { defaultRoleId, setDefaultRoleId } = useAdminData();
  const { addToast } = useToast();
  const [viewRole, setViewRole] = useState<Role | null>(null);
  const [search, setSearch] = useState('');
  const [defaultOpen, setDefaultOpen] = useState(false);
  const defaultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!defaultOpen) return;
    const close = (e: MouseEvent) => { if (defaultRef.current && !defaultRef.current.contains(e.target as Node)) setDefaultOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [defaultOpen]);

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
        render: (item: RoleRow) => {
          const role = roleById[item.id as string];
          return (
            <RowActions>
              <button className={BTN_ROW} onClick={() => setViewRole(role)}><Pencil size={12} />Edit</button>
              <button
                className={BTN_ROW}
                onClick={() => onCreateRole({ name: `${role.name} (copy)`, description: role.description ?? '', permissions: [...role.permissions] })}
              ><CopyPlus size={12} />Duplicate</button>
            </RowActions>
          );
        },
      };
    }
    return col;
  });

  // KPI summary + external search (unified toolbar across all admin tabs).
  const systemCount = roles.filter(r => r.type === 'System').length;
  const customCount = roles.filter(r => r.type === 'Custom').length;
  const avgPerms = roles.length ? Math.round(roles.reduce((s, r) => s + r.permissions.length, 0) / roles.length) : 0;
  const kpiStats: KpiStat[] = [
    { key: 'total', label: 'Total Roles', value: roles.length },
    { key: 'system', label: 'System', value: systemCount },
    { key: 'custom', label: 'Custom', value: customCount },
    { key: 'avg', label: 'Avg Permissions', value: avgPerms },
  ];

  const q = search.trim().toLowerCase();
  const visibleData = q
    ? tableData.filter(r => [r.name, r.createdBy, r.description].some(v => String(v ?? '').toLowerCase().includes(q)))
    : tableData;

  const viewRoleUsers = viewRole ? (userCounts[viewRole.id] ?? 0) : 0;

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {roles.length > 0 && <KpiRow stats={kpiStats} />}

      {/* Unified toolbar: search left, default-role selector right. */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <MemberSearch value={search} onChange={setSearch} placeholder="Search roles..." className="w-full sm:w-[300px]" />
        <div className="flex items-center gap-2 text-[0.8125rem] text-ink-600 shrink-0">
          <span className="font-medium text-ink-700 whitespace-nowrap">Default role for new users</span>
          {/* Custom select popover — matches the inline team dropdown. */}
          <div className="relative" ref={defaultRef}>
            <button
              onClick={() => setDefaultOpen(o => !o)}
              className={`no-focus-ring inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border bg-canvas-elevated text-[0.8125rem] cursor-pointer transition-colors ${
                defaultOpen ? 'border-brand-600 text-brand-700' : 'border-canvas-border text-ink-700 hover:border-brand-200'
              }`}
            >
              <span className="whitespace-nowrap">{roles.find(r => r.id === defaultRoleId)?.name ?? 'Select role'}</span>
              <ChevronDown size={13} className={`text-ink-400 transition-transform ${defaultOpen ? 'rotate-180 text-brand-600' : ''}`} />
            </button>
            {defaultOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.13, ease: [0.2, 0, 0, 1] }}
                className="absolute right-0 top-full mt-1.5 w-56 max-h-[280px] overflow-y-auto origin-top-right bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_10px_30px_-12px_rgba(15,8,30,0.28)] p-1 z-30"
              >
                {roles.map(r => {
                  const selected = r.id === defaultRoleId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setDefaultRoleId(r.id); setDefaultOpen(false); addToast({ message: `Default role set to ${r.name}`, type: 'success' }); }}
                      className={`no-focus-ring flex w-full items-center justify-between gap-2 px-2.5 h-8 rounded-lg text-[0.8125rem] text-left cursor-pointer transition-colors ${
                        selected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-canvas'
                      }`}
                    >
                      <span className="truncate">{r.name}</span>
                      {selected && <Check size={14} className="shrink-0 text-brand-600" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <SmartTable
        columns={columnsWithAction}
        data={visibleData}
        keyField="id"
        searchable={false}
        paginated
        pageSize={10}
        emptyContent={
          <EmptyState
            icon={Shield}
            size="compact"
            title={search ? 'No roles match your search' : 'No roles yet'}
            body={search ? 'Try a different name or clear the search.' : 'Create a role to define what members can see and do.'}
            action={search
              ? <button className={BTN_CTA_OUTLINE} onClick={() => setSearch('')}>Clear search</button>
              : <button className={BTN_CTA_PRIMARY} onClick={() => onCreateRole()}><Plus size={14} />Create Role</button>}
          />
        }
      />
      <AnimatePresence>
        {viewRole && <RoleDetailDrawer key="role-detail" role={viewRole} userCount={viewRoleUsers} onClose={() => setViewRole(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function UsersTab({ subTab, onCreateTeam }: { subTab: 'users' | 'teams'; onCreateTeam: () => void }) {
  const prefersReduced = useReducedMotion();
  const { users, teams, updateUser } = useAdminData();
  const { roles } = useCurrentUser();
  const roleName = (roleId: string) => roles.find(r => r.id === roleId)?.name ?? '—';
  const tableData = users.map(u => ({ ...u, roleName: roleName(u.roleId) } as MockUser & Record<string, unknown>));
  const [viewUser, setViewUser] = useState<MockUser | null>(null);
  const [editUser, setEditUser] = useState<MockUser | null>(null);
  const [teamDropdown, setTeamDropdown] = useState<string | null>(null);
  const [editTeam, setEditTeam] = useState<AdminTeam | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
    if (col.key === 'roleName') {
      return {
        ...col,
        render: (item: UserRow) => (
          <button onClick={() => setEditUser(item as unknown as MockUser)} className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-600 hover:text-brand-700 cursor-pointer group">
            {item.roleName as string}
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
              {/* Trigger reads as an editable select chip; focus shown via the
                  open-state tint (no harsh global ring → .no-focus-ring). */}
              <button
                onClick={() => setTeamDropdown(isOpen ? null : rowId)}
                className={`no-focus-ring inline-flex items-center gap-1 px-2 h-7 -ml-2 rounded-md text-[0.8125rem] cursor-pointer transition-colors ${
                  isOpen ? 'bg-canvas text-brand-700' : isUnassigned ? 'text-ink-400 hover:bg-canvas hover:text-brand-700' : 'text-ink-700 hover:bg-canvas hover:text-brand-700'
                }`}
              >
                {isUnassigned ? 'Assign team' : teamName}
                <ChevronDown size={12} className={`text-ink-400 transition-transform ${isOpen ? 'rotate-180 text-brand-600' : ''}`} />
              </button>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.13, ease: [0.2, 0, 0, 1] }}
                  className="absolute left-0 top-full mt-1.5 w-48 origin-top-left bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_10px_30px_-12px_rgba(15,8,30,0.28)] p-1 z-30"
                >
                  {teamNames.map(t => {
                    const selected = t === teamName;
                    return (
                      <button
                        key={t}
                        onClick={() => { updateUser(rowId, { team: t }); setTeamDropdown(null); }}
                        className={`no-focus-ring flex w-full items-center justify-between gap-2 px-2.5 h-8 rounded-lg text-[0.8125rem] text-left cursor-pointer transition-colors ${
                          selected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-canvas'
                        }`}
                      >
                        <span className="truncate">{t}</span>
                        {selected && <Check size={14} className="shrink-0 text-brand-600" />}
                      </button>
                    );
                  })}
                  {!isUnassigned && (
                    <>
                      <div className="h-px bg-canvas-border my-1 mx-1.5" />
                      <button
                        onClick={() => { updateUser(rowId, { team: '—' }); setTeamDropdown(null); }}
                        className="no-focus-ring flex w-full items-center gap-2 px-2.5 h-8 rounded-lg text-[0.8125rem] text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors"
                      >
                        <X size={13} className="shrink-0" /> Remove from team
                      </button>
                    </>
                  )}
                </motion.div>
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
          <RowActions>
            <button className={BTN_ROW} onClick={() => setViewUser(item as unknown as MockUser)}><Eye size={12} />View</button>
            <button className={BTN_ROW} onClick={() => setEditUser(item as unknown as MockUser)}><Pencil size={12} />Edit</button>
          </RowActions>
        ),
      };
    }
    return col;
  });

  // KPI status tiles double as filters; external search keeps the toolbar
  // identical across all admin tabs.
  const STATUS_FILTER_MAP: Record<string, string | null> = { total: null, active: 'Active', invited: 'Invited', suspended: 'Suspended' };
  const kpiStats: KpiStat[] = [
    { key: 'total', label: 'Total Users', value: users.length },
    { key: 'active', label: 'Active', value: counts.active },
    { key: 'invited', label: 'Invited', value: counts.invited },
    { key: 'suspended', label: 'Suspended', value: counts.suspended },
  ];
  const activeKpi = statusFilter === null ? 'total' : (Object.keys(STATUS_FILTER_MAP).find(k => STATUS_FILTER_MAP[k] === statusFilter) ?? 'total');
  const q = search.trim().toLowerCase();
  const visibleUsers = tableData.filter(u => {
    if (statusFilter && u.status !== statusFilter) return false;
    if (q && ![u.name, u.email, u.roleName, u.team].some(v => String(v ?? '').toLowerCase().includes(q))) return false;
    return true;
  });

  // Teams KPI row (display only) — mirrors the Users/Roles summary.
  const totalMembers = teamsData.reduce((s, t) => s + t.members.length, 0);
  const avgTeamSize = teamsData.length ? Math.round(totalMembers / teamsData.length) : 0;
  const unassignedCount = users.filter(u => u.team === '—').length;
  const teamKpiStats: KpiStat[] = [
    { key: 'total', label: 'Total Teams', value: teamsData.length },
    { key: 'members', label: 'Members Assigned', value: totalMembers },
    { key: 'avg', label: 'Avg Team Size', value: avgTeamSize },
    { key: 'unassigned', label: 'Unassigned', value: unassignedCount },
  ];

  // Teams render as a table (consistent with Users & Roles) rather than a
  // sparse card grid.
  type TeamRow = { id: string; name: string; count: number; members: string[]; team: AdminTeam } & Record<string, unknown>;
  const teamTableData: TeamRow[] = teamsData.map(t => ({ id: t.id, name: t.name, count: t.members.length, members: t.members, team: t }));
  const teamColumns: Column<TeamRow>[] = [
    {
      key: 'name', label: 'Team', sortable: true,
      render: (t) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <Users size={14} className="text-brand-700" />
          </div>
          <span className="truncate text-[0.8125rem] font-semibold text-ink-800">{t.name}</span>
        </div>
      ),
    },
    {
      key: 'count', label: 'Members', sortable: true, width: '14%',
      render: (t) => <span className={`text-[0.8125rem] tabular-nums ${t.count === 0 ? 'text-ink-400' : 'font-medium text-ink-800'}`}>{t.count}</span>,
    },
    {
      key: 'avatars', label: '', sortable: false,
      render: (t) => (
        t.members.length === 0
          ? <span className="text-[0.75rem] text-ink-400">No members yet</span>
          : (
            <div className="flex items-center gap-1.5">
              {t.members.slice(0, 6).map((m, i) => <InitialsAvatar key={i} name={m} size={24} />)}
              {t.members.length > 6 && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-semibold text-ink-500 bg-canvas border border-canvas-border tabular-nums">+{t.members.length - 6}</div>
              )}
            </div>
          )
      ),
    },
    {
      key: 'action', label: '', sortable: false, align: 'right' as const, width: '120px',
      render: (t) => (
        <RowActions>
          <button className={BTN_ROW} onClick={(e) => { e.stopPropagation(); setEditTeam(t.team); }}><Pencil size={12} />Manage</button>
        </RowActions>
      ),
    },
  ];

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* KPI summary — hidden when the segment is truly empty (no records).
          Users tiles double as status filters; Teams is display only. */}
      {subTab === 'users' && users.length > 0 && (
        <KpiRow stats={kpiStats} active={activeKpi} onSelect={(k) => setStatusFilter(STATUS_FILTER_MAP[k] ?? null)} />
      )}
      {subTab === 'teams' && teamsData.length > 0 && (
        <KpiRow stats={teamKpiStats} />
      )}

      {/* Search — Users view only. The segmented nav + Create Team both live on
          the AccessNav row above, so Teams goes straight to its cards. */}
      {subTab === 'users' && (
        <div className="mb-4">
          <MemberSearch value={search} onChange={setSearch} placeholder="Search by name or email..." className="w-full sm:w-[300px]" />
        </div>
      )}

      {subTab === 'users' ? (
        <SmartTable
          columns={columnsWithAction}
          data={visibleUsers}
          keyField="email"
          searchable={false}
          paginated
          pageSize={10}
          emptyContent={
            <EmptyState
              icon={Users}
              size="compact"
              title={(statusFilter || search) ? 'No users match your filters' : 'No users yet'}
              body={(statusFilter || search) ? 'Try a different search, or clear the active filter.' : 'Invite a member to get started.'}
              action={(statusFilter || search)
                ? <button className={BTN_CTA_OUTLINE} onClick={() => { setStatusFilter(null); setSearch(''); }}>Clear filters</button>
                : undefined}
            />
          }
        />
      ) : teamsData.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          body="Group members for shared access and assignments."
          action={<button className={BTN_CTA_PRIMARY} onClick={onCreateTeam}><Plus size={14} />Create Team</button>}
        />
      ) : (
        <SmartTable
          columns={teamColumns}
          data={teamTableData}
          keyField="id"
          searchable={false}
          paginated
          pageSize={10}
          onRowClick={(t) => setEditTeam(t.team)}
        />
      )}

      <AnimatePresence>
        {viewUser && <UserDetailDrawer key="user-detail" user={viewUser} onClose={() => setViewUser(null)} />}
        {editUser && <UserEditDrawer key="user-edit" user={editUser} onClose={() => setEditUser(null)} />}
        {editTeam && <EditTeamDrawer key="team-edit" team={editTeam} onClose={() => setEditTeam(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

// Anchor for the date-range presets (Last 7/30/90 days). Midnight today.
const AUDIT_TODAY = new Date(new Date().toISOString().slice(0, 10));

const logColumns: Column<AuditLog & Record<string, unknown>>[] = [
  {
    key: 'timestamp',
    label: 'Timestamp',
    sortable: true,
    width: '15%',
    render: (item) => {
      const [date, time] = (item.timestamp as string).split(' ');
      return (
        <div className="font-mono tabular-nums leading-tight">
          <div className="text-[0.75rem] text-ink-700">{date}</div>
          <div className="text-[0.6875rem] text-ink-400 mt-1">{time}</div>
        </div>
      );
    },
  },
  {
    key: 'user',
    label: 'Performed By',
    sortable: true,
    width: '17%',
    render: (item) => {
      const name = item.user as string;
      const unknown = name === 'Unknown';
      return (
        <div className="flex items-center gap-3 min-w-0">
          <InitialsAvatar name={unknown ? 'U' : name} size={32} />
          <span className={`text-[0.8125rem] truncate ${unknown ? 'italic text-ink-400' : 'font-medium text-ink-800'}`}>{name}</span>
        </div>
      );
    },
  },
  {
    key: 'action',
    label: 'Action',
    sortable: true,
    width: '9%',
    render: (item) => <ActionBadge action={item.action as string} />,
  },
  {
    // No fixed width — Activity is the flex column that fills the row, so the
    // Result pill anchors cleanly to the right edge with no dead gap.
    key: 'description',
    label: 'Activity',
    sortable: false,
    render: (item) => (
      <div className="min-w-0">
        <div className="text-[0.8125rem] text-ink-800 leading-snug truncate">{item.description as string}</div>
        <div className="text-[0.6875rem] text-ink-400 mt-1 font-medium uppercase tracking-[0.04em] truncate">
          {item.module as string} · {item.entity as string}
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Result',
    sortable: true,
    width: '10%',
    align: 'right',
    render: (item) => <ResultBadge result={item.status as string} />,
  },
];

function AuditLogsTab() {
  const prefersReduced = useReducedMotion();
  const { logs } = useAdminData();
  const tableData = logs.map(l => ({ ...l } as AuditLog & Record<string, unknown>));
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [resultFilter, setResultFilter] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [dateOpen, setDateOpen] = useState(false);

  const uniqueUsers = [...new Set(logs.map(l => l.user))];
  const hasAnyFilter =
    searchQuery.length > 0 || actionFilter.length > 0 || resultFilter.length > 0 ||
    userFilter.length > 0 || isDateFilterActive(dateFilter);

  const clearAll = () => {
    setSearchQuery('');
    setActionFilter([]);
    setResultFilter([]);
    setUserFilter([]);
    setDateFilter(DEFAULT_DATE_FILTER);
  };

  const filtered = tableData.filter(l => {
    if (actionFilter.length && !actionFilter.includes(l.action as string)) return false;
    if (resultFilter.length && !resultFilter.includes(l.status as string)) return false;
    if (userFilter.length && !userFilter.includes(l.user as string)) return false;
    if (!dateInFilter(l.timestamp as string, dateFilter, AUDIT_TODAY)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hit = ['user', 'description', 'module', 'entity'].some(
        k => String(l[k] ?? '').toLowerCase().includes(q)
      );
      if (!hit) return false;
    }
    return true;
  });

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* One cohesive panel: filter header + table share a single card, so the
          top reads anchored instead of a toolbar floating over empty space. */}
      <div className="bg-canvas-elevated border border-canvas-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <MemberSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search logs..." className="w-full sm:w-[260px]" />
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAll}
                className="mr-0.5 text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
            <ColumnFilter
              variant="button"
              label="User"
              options={uniqueUsers}
              value={userFilter}
              onChange={setUserFilter}
              align="end"
              renderOption={(name) => (
                <>
                  <InitialsAvatar name={name === 'Unknown' ? 'U' : name} size={20} />
                  <span className="truncate">{name}</span>
                </>
              )}
            />
            <ColumnFilter variant="button" label="Action" options={['Create', 'Update', 'Delete', 'Login', 'Export']} value={actionFilter} onChange={setActionFilter} align="end" />
            <ColumnFilter variant="button" label="Result" options={['Success', 'Failed']} value={resultFilter} onChange={setResultFilter} align="end" />
            {/* Reused platform date dropdown — presets + custom range, matching the filter pills. */}
            <DateFilterPicker
              filter={dateFilter}
              open={dateOpen}
              onToggle={() => setDateOpen(o => !o)}
              onClose={() => setDateOpen(false)}
              onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
              today={AUDIT_TODAY}
              triggerHeight="h-8"
            />
          </div>
        </div>

        <SmartTable
          columns={logColumns}
          data={filtered}
          keyField="timestamp"
          variant="modern"
          searchable={false}
          paginated
          pageSize={10}
          emptyContent={
            <EmptyState
              icon={ScrollText}
              size="compact"
              title={hasAnyFilter ? 'No audit logs match your filters' : 'No audit activity yet'}
              body={hasAnyFilter ? 'Try a different search, or clear the active filters.' : 'Activity across the platform will appear here.'}
              action={hasAnyFilter ? <button className={BTN_CTA_OUTLINE} onClick={clearAll}>Clear filters</button> : undefined}
            />
          }
        />
      </div>
    </motion.div>
  );
}

export default function AdminView({ activeTab }: Props) {
  // The sidebar still passes legacy view ids (users/roles/logs); map them onto
  // the merged Access tab + its segment.
  const initialTab: TabId = activeTab === 'logs' ? 'logs' : 'access';
  const initialSeg: AccessSeg = activeTab === 'roles' ? 'roles' : 'users';

  const prefersReduced = useReducedMotion();
  const { addToast } = useToast();
  const { can, roles } = useCurrentUser();
  const logEvent = useAuditLog();
  const { logs, users, teams } = useAdminData();
  const [currentTab, setCurrentTab] = useState<TabId>(initialTab);
  const [accessSeg, setAccessSeg] = useState<AccessSeg>(initialSeg);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [createRoleSeed, setCreateRoleSeed] = useState<RoleSeed | null>(null);
  const accessCounts: Record<AccessSeg, number> = { users: users.length, teams: teams.length, roles: roles.length };

  const openCreateRole = (seed?: RoleSeed) => { setCreateRoleSeed(seed ?? null); setCreateRoleOpen(true); };
  const exportLogs = () => {
    // The relevant audit fields only — no IP. Quote every cell and escape any
    // embedded quotes so descriptions with commas stay in one column.
    const headers = ['Timestamp', 'Performed By', 'Action', 'Activity', 'Module', 'Entity', 'Result'];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = logs.map(l => [l.timestamp, l.user, l.action, l.description, l.module, l.entity, l.status].map(esc).join(','));
    const csv = [headers.map(esc).join(','), ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    logEvent({ action: 'Export', description: `Exported audit log as CSV (${logs.length} events)`, module: 'Admin', entity: 'Audit Log' });
    addToast({ message: `Exported ${logs.length} audit events as CSV.`, type: 'success' });
  };

  // Access primary action sits on the AccessNav row (right side), right above
  // the content — contextual to the active segment. Audit Logs keeps Export in
  // the header (it has no sub-nav row).
  const accessAction =
    accessSeg === 'roles' ? (
      <button className={BTN_CTA_PRIMARY} onClick={() => openCreateRole()}><Plus size={14} />Create Role</button>
    ) : accessSeg === 'teams' ? (
      <button className={BTN_CTA_PRIMARY} onClick={() => setCreateTeamOpen(true)}><Plus size={14} />Create Team</button>
    ) : (
      <button className={BTN_CTA_PRIMARY} onClick={() => setInviteOpen(true)}><UserPlus size={14} />Invite User</button>
    );

  const headerCta =
    currentTab === 'logs' && can('ad_logs_export')
      ? <button className={BTN_CTA_OUTLINE} onClick={exportLogs}><Download size={14} />Export CSV</button>
      : null;

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
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-[2.125rem] font-[420] tracking-tight text-ink-900 leading-[1.15]">Administration</h1>
                <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">Manage users, teams, roles, and audit logs.</p>
              </div>
              {headerCta && <div className="shrink-0 pt-1">{headerCta}</div>}
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
                        transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }}
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
        <AnimatePresence mode="wait">
          {currentTab === 'access' ? (
            <div key="access">
              <AccessNav seg={accessSeg} setSeg={setAccessSeg} counts={accessCounts} action={accessAction} />
              {/* Segment switch: the new content mounts (per-segment key) and
                  plays its own enter motion. No AnimatePresence/exit, so the old
                  is replaced instantly — a snappy fade-in with no empty gap. */}
              {accessSeg === 'roles'
                ? <RolesTab key="roles" onCreateRole={openCreateRole} />
                : <UsersTab key={accessSeg} subTab={accessSeg} onCreateTeam={() => setCreateTeamOpen(true)} />}
            </div>
          ) : (
            <AuditLogsTab key="logs" />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {inviteOpen && <InviteUserDrawer key="invite" onClose={() => setInviteOpen(false)} />}
        {createTeamOpen && <CreateTeamDrawer key="createteam" onClose={() => setCreateTeamOpen(false)} />}
        {createRoleOpen && <CreateRoleDrawer key="createrole" seed={createRoleSeed} onClose={() => { setCreateRoleOpen(false); setCreateRoleSeed(null); }} />}
      </AnimatePresence>
    </div>
  );
}
